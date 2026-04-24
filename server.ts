import express from "express";
import axios from "axios";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import twilio from "twilio";
import { readFileSync, existsSync } from "fs";
import { GoogleGenAI } from "@google/genai";
import "dotenv/config";

// Firebase Client Imports (For Frontend / Shared types if needed)
import { initializeApp } from "firebase/app";
import { 
  getFirestore, 
  doc, 
  getDoc, 
  collection,
  addDoc,
  setDoc,
  getDocs,
  query,
  where,
  limit,
  orderBy,
  writeBatch,
  serverTimestamp,
  updateDoc
} from "firebase/firestore";
import sgMail from '@sendgrid/mail';

// 1. Initialize Firebase (Client SDK on server for cross-project compatibility)
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const firebaseConfigPath = path.join(__dirname, "firebase-applet-config.json");
const firebaseConfig = JSON.parse(readFileSync(firebaseConfigPath, "utf-8"));

console.log(`[Firebase] Initializing with project: ${firebaseConfig.projectId}, database: ${firebaseConfig.firestoreDatabaseId}`);

const firebaseApp = initializeApp(firebaseConfig);
const db = getFirestore(firebaseApp, firebaseConfig.firestoreDatabaseId);

const TWILIO_ACCOUNT_SID = process.env.TWILIO_ACCOUNT_SID;
const TWILIO_AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN;
const TWILIO_FROM_NUMBER = process.env.TWILIO_FROM_NUMBER;
const SENDGRID_API_KEY = process.env.SENDGRID_API_KEY;
const SENDGRID_FROM_EMAIL = process.env.SENDGRID_FROM_EMAIL;

if (SENDGRID_API_KEY) {
  sgMail.setApiKey(SENDGRID_API_KEY);
}

const twilioClient = TWILIO_ACCOUNT_SID && TWILIO_AUTH_TOKEN ? twilio(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN) : null;

// Global State
const mediaCache = new Map<string, { data: Buffer, mimeType: string }>();
const userRateLimitCache = new Map<string, number>();
let currentAppUrl = process.env.APP_URL || "";

function detectCurrentUrl(req: express.Request) {
  const host = req.headers["x-forwarded-host"] || req.headers["host"];
  const proto = req.headers["x-forwarded-proto"] || "https";
  if (host && !host.includes("localhost")) {
    const newUrl = `${proto}://${host}`;
    if (currentAppUrl !== newUrl) {
      currentAppUrl = newUrl;
      console.log(`[Twilio] Updated APP_URL: ${currentAppUrl}`);
    }
  }
}

interface StoreConfig {
  id: string;
  name: string;
  phone: string;
  catalogId?: string;
  paisaStyle: boolean;
  recoveryEnabled: boolean;
  dropiApiKey?: string;
  emailEnabled?: boolean;
}

/**
 * Fetches store configuration by phone number (SaaS logic)
 */
async function getStoreByPhone(phone: string): Promise<StoreConfig> {
  const q = query(collection(db, "stores"), where("phone", "==", phone), limit(1));
  const snap = await getDocs(q);
  
  if (!snap.empty) {
    const data = snap.docs[0].data();
    return { id: snap.docs[0].id, ...data } as StoreConfig;
  }
  
  // Default store for legacy support
  return {
    id: "default",
    name: "Jan Vanegas Sales",
    phone: TWILIO_FROM_NUMBER || "whatsapp:+14155238886",
    paisaStyle: true,
    recoveryEnabled: true
  };
}

/**
 * Fetches last messages for CRM memory
 */
async function getCrmContext(from: string, storeId: string): Promise<string> {
  const q = query(
    collection(db, "activities"),
    where("from", "==", from),
    where("storeId", "==", storeId),
    orderBy("timestamp", "desc"),
    limit(5)
  );
  const snap = await getDocs(q);

  if (snap.empty) return "No hay historial previo.";
  
  return [...snap.docs].reverse().map(d => {
    const data = d.data();
    return `${data.message} -> Jan: ${data.response || '(Procesando...)'}`;
  }).join("\n");
}

/**
 * Long-term memory: Fetches persistent customer data
 */
async function getCustomerProfile(phone: string): Promise<any> {
  const cleanPhone = phone.replace('whatsapp:', '');
  const snap = await getDoc(doc(db, "customers", cleanPhone));
  return snap.exists() ? snap.data() : null;
}

/**
 * Downloads media from Twilio and prepares it for Gemini analysis
 */
async function downloadMediaAsBase64(url: string): Promise<{ data: string, mimeType: string } | null> {
  console.log(`[Media Download] Fetching: ${url}`);
  try {
    const response = await axios.get(url, {
      responseType: 'arraybuffer',
      auth: {
        username: process.env.TWILIO_ACCOUNT_SID || "",
        password: process.env.TWILIO_AUTH_TOKEN || ""
      }
    });
    const mimeType = response.headers['content-type'] || 'image/jpeg';
    if (!mimeType.startsWith('image/')) {
       console.log(`[Media Download] Skipping non-image type: ${mimeType}`);
       return null;
    }
    const base64Data = Buffer.from(response.data, 'binary').toString('base64');
    return { data: base64Data, mimeType };
  } catch (err: any) {
    console.warn(`[Media Download][Error] From ${url}:`, err.message);
    return null;
  }
}

/**
 * Anti-spam: Prevents loops and saturated inbox
 */
function canReply(userId: string): boolean {
  const now = Date.now();
  const lastTime = userRateLimitCache.get(userId) || 0;
  if (now - lastTime < 3000) return false; // 3 seconds cooldown
  userRateLimitCache.set(userId, now);
  return true;
}

/**
 * Seeding Function: Populates the products collection using Admin SDK to bypass rules
 */
async function seedDatabase(force = false, customCatalog?: any) {
  const productsColl = collection(db, "products");
  
  if (!force) {
    const qCount = query(productsColl, limit(1));
    const snapshot = await getDocs(qCount);
    if (!snapshot.empty) return;
  }

  console.log("[DB] Iniciando reseteo de catálogo con Client SDK (rules open)...");

  let catalogData: any = customCatalog;
  
  if (!catalogData) {
    const catalogPath = path.join(__dirname, "src", "catalog.json");
    if (existsSync(catalogPath)) {
      try {
        const raw = readFileSync(catalogPath, "utf-8");
        catalogData = JSON.parse(raw);
        console.log(`[DB] Catalog loaded from file system: ${catalogData?.products?.length || 0} products.`);
      } catch (e) {
        console.error("[DB] Error parsing catalog.json:", e);
      }
    } else {
      console.error("[DB] catalog.json not found at:", catalogPath);
    }
  }

  if (!catalogData || !catalogData.products || !Array.isArray(catalogData.products)) {
    console.warn("[DB] No valid products found to seed. Aborting to prevent data loss.");
    return;
  }

  if (force) {
    try {
      const snap = await getDocs(productsColl);
      if (!snap.empty) {
        console.log(`[DB] Clearing ${snap.size} old products before re-seeding...`);
        const batch = writeBatch(db);
        snap.docs.forEach(d => batch.delete(d.ref));
        await batch.commit();
      }
    } catch (e: any) {
      console.error("[DB] Error cleaning catalog:", e.message);
    }
  }

  try {
    console.log(`[DB] Inserting ${catalogData.products.length} products...`);
    const batch = writeBatch(db);
    for (const product of catalogData.products) {
      const docRef = doc(db, "products", product.id);
      batch.set(docRef, {
        ...product,
        stock: product.stock !== undefined ? product.stock : 20,
        updatedAt: serverTimestamp()
      });
    }
    await batch.commit();
    console.log("[DB] Catálogo sembrado con éxito.");
  } catch (e: any) {
    console.error("[DB] Error inserting catalog:", e.message);
    if (force && customCatalog) throw e; 
  }

  // Seed default store
  await setDoc(doc(db, "stores", "jan-vanegas-hq"), {
    name: "Jan Vanegas - Sales Architecture",
    phone: TWILIO_FROM_NUMBER || "whatsapp:+14155238886",
    paisaStyle: true,
    recoveryEnabled: true,
    dropiApiKey: "DROPI_MOCK_KEY_12345",
    emailEnabled: true,
    createdAt: serverTimestamp()
  }, { merge: true });
  
  console.log("[DB] Store seeded.");
}

/**
 * Tool Definitions for Gemini (Reference for sync/seed)
 */
const checkInventoryTool = {
  name: "checkInventory",
  parameters: {
    type: "OBJECT",
    properties: {}
  }
};

async function processInferenceOnServer(data: any) {
  const GEMINI_API_KEY = process.env.GEMINI_API_KEY || process.env.API_KEY || process.env.GOOGLE_API_KEY;
  console.log('[DEBUG] Entrando a processInferenceOnServer');
  console.log('[DEBUG] KEY:', !!GEMINI_API_KEY);
  console.log('[DEBUG] Data:', JSON.stringify(data).substring(0, 100));
  if (!GEMINI_API_KEY) throw new Error("No Gemini API Key");

  const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });
  const model = "gemini-flash-latest";

  // Get available products for whitelisting URLs
  const prodSnap = await getDocs(collection(db, "products"));
  const availableProducts = prodSnap.docs.map(d => ({
    id: d.id,
    name: d.data().name,
    imageUrl: d.data().imageUrl,
    videoUrl: d.data().videoUrl,
  }));

  // ... (Inference and Whitelist Logic)
  // This will require adding imports and function structure to server.ts.
  console.log("[Server Inference] Processing message from:", data.from);
}
async function updateTwilioStatus(limitReached: boolean, error?: string) {
  try {
    await setDoc(doc(db, "config", "system"), {
      twilioLimitReached: limitReached,
      lastTwilioError: error || null,
      updatedAt: serverTimestamp()
    }, { merge: true });
    console.log(`[Twilio Status] Updated: LimitReached=${limitReached}`);
  } catch (e) {
    console.error("[Twilio Status] Failed to update status:", e);
  }
}

/**
 * Checks if we can still send messages today
 */
async function checkTwilioStatus(): Promise<boolean> {
  try {
    const snap = await getDoc(doc(db, "config", "system"));
    if (!snap.exists()) return true;
    
    const data = snap.data();
    if (!data) return true;

    // Auto-reset if the last update was yesterday
    if (data.updatedAt) {
      const updatedAt = data.updatedAt;
      const lastUpdate = typeof updatedAt.toDate === 'function' ? updatedAt.toDate() : new Date(updatedAt);
      const today = new Date();
      if (lastUpdate.toDateString() !== today.toDateString()) {
        await updateTwilioStatus(false);
        return true;
      }
    }
    
    return !data.twilioLimitReached;
  } catch (e) {
    return true; // Optimistic
  }
}

/**
 * Normalizes a phone number for Twilio (whatsapp:+...)
 */
function normalizePhone(phone: string): string {
  if (!phone) return "";
  // 1. Remove the 'whatsapp:' prefix if present to avoid double-prepending
  let clean = phone.toLowerCase().replace('whatsapp:', '');
  // 2. Remove all non-digit characters
  clean = clean.replace(/\D/g, '');
  // 3. Return with the correct Twilio prefix
  return `whatsapp:+${clean}`;
}

async function sendWhatsApp(to: string, body: string, mediaUrl?: string, activityId?: string, from?: string) {
  if (!twilioClient) {
    console.error("[WhatsApp Send] Client not initialized.");
    return;
  }

  // Derive base URL for status callbacks
  const appUrl = currentAppUrl || process.env.APP_URL || "";
  
  const finalTo = normalizePhone(to);
  const finalFrom = normalizePhone(from || TWILIO_FROM_NUMBER || "+14155238886");
  
  console.log(`[Twilio Debug] Final Numbers: FROM=${finalFrom} TO=${finalTo}`);

  // Check Twilio limits early
  const canSend = await checkTwilioStatus();
  if (!canSend) {
    console.error("[Twilio Limit] Blocked: Trial 50-message limit reached.");
    throw new Error("TWILIO_LIMIT_REACHED: Twilio 50-message trial limit exceeded.");
  }

  // Ensure mediaUrl is absolute
  if (mediaUrl && mediaUrl.startsWith("/")) {
    mediaUrl = `${appUrl.replace(/\/$/, '')}${mediaUrl}`;
  }

  // SIMPLIFY: Send as text links for reliability (User request)
  let finalMediaUrl = mediaUrl;
  let finalBody = body;

  if (finalMediaUrl) {
    // If the link is not already in the body, append it
    if (!finalBody.includes(finalMediaUrl)) {
      finalBody += `\n\nVer aquí: ${finalMediaUrl}`;
    }
    
    // Only send as 'media' if it's an internal resource (cached audio/image)
    // External catalog links are sent as text links for 100% delivery
    const isInternal = finalMediaUrl.includes('/api/admin/cache-media') || finalMediaUrl.includes('/api/media/');
    if (!isInternal) {
      console.log(`[Twilio Bot] Sending catalog link as text: ${finalMediaUrl}`);
      finalMediaUrl = undefined;
    }
  }

  const params: any = {
    from: finalFrom,
    to: finalTo,
    body: finalBody
  };

  if (finalMediaUrl) {
    params.mediaUrl = [finalMediaUrl];
  }

  if (activityId && appUrl) {
    params.statusCallback = `${appUrl.replace(/\/$/, '')}/api/webhook/whatsapp/status?activityId=${activityId}`;
  }

  try {
    console.log(`[Twilio Action] Sending... From:${params.from} To:${params.to} MsgLen:${body?.length || 0} Media:${!!params.mediaUrl}`);
    const msg = await twilioClient.messages.create(params);
    console.log(`[Twilio Success] SID: ${msg.sid}. Status: ${msg.status}`);
    return msg;
  } catch (err: any) {
    console.error(`[Twilio Error] FATAL: From:${finalFrom} To:${finalTo} Error: ${err.message}`);
    
    // Fallback: If it failed with media, try text only
    if (finalMediaUrl) {
      try {
        console.log("[Twilio Fallback] Retrying with TEXT ONLY...");
        const textOnlyParams = { ...params };
        delete textOnlyParams.mediaUrl;
        const msg = await twilioClient.messages.create(textOnlyParams);
        console.log(`[Twilio Success][Fallback] SID: ${msg.sid}`);
        return msg;
      } catch (innerErr: any) {
        console.error("[Twilio Fallback] FAILED TOO:", innerErr.message);
        throw innerErr;
      }
    }
    
    if (err.message.includes("limit") || err.message.includes("50")) {
      await updateTwilioStatus(true, err.message);
    }
    throw err;
  }
}

/**
 * Notifies administrators (Jan and Tatiana) about new orders via WhatsApp
 */
async function notifyAdmins(orderData: any, storeName: string) {
  const adminNumbersRaw = process.env.ADMIN_WHATSAPP_NUMBERS || "";
  const adminNumbers = adminNumbersRaw.split(",").filter(n => n.trim().length > 0);
  
  if (adminNumbers.length === 0) {
    console.log("[Admin Notify] No admin numbers configured in ADMIN_WHATSAPP_NUMBERS.");
    return;
  }

  const message = `🚀 *¡NUEVO PEDIDO, JEFE!*
Jan acaba de cerrar un negocio de una vez.

👤 *Cliente:* ${orderData.customerName}
📦 *Producto:* ${orderData.productName}
🔢 *Cant:* ${orderData.quantity}
📍 *Envío:* ${orderData.address}, ${orderData.city}
🏠 *Ref:* ${orderData.addressIndicator || 'N/A'}
💰 *Total:* $${orderData.totalPrice.toLocaleString()}

_El inventario ya fue descontado automáticamente._`;

  console.log(`[Admin Notify] Notifying ${adminNumbers.length} admins...`);
  
  for (const num of adminNumbers) {
    try {
      // Ensure 'whatsapp:' prefix
      const target = num.trim().startsWith("whatsapp:") ? num.trim() : `whatsapp:${num.trim()}`;
      await sendWhatsApp(target, message);
    } catch (e: any) {
      console.error(`[Admin Notify] Error notifying ${num}:`, e.message);
    }
  }
}

async function startServer() {
  const app = express();
  const PORT = process.env.PORT || 8080;

  // Test Firestore connection on boot
  try {
    console.log("[Firebase] Testing backend connectivity (Client)...");
    await getDoc(doc(db, 'test', 'connection'));
    console.log("[Firebase] Backend connection successful.");
  } catch (err: any) {
    console.warn("[Firebase] Warning: Backend could not reach Firestore during test.");
    console.warn("[Firebase] Details:", err.message);
  }

  app.use(express.urlencoded({ extended: true }));
  app.use(express.json({ limit: '10mb' }));

  // DEBUG ROUTE: Visit /api/health to see if Jan is alive
  app.get("/api/health", (req, res) => {
    res.json({
      status: "Jan is alive",
      time: new Date().toISOString(),
      twilio_configured: !!process.env.TWILIO_ACCOUNT_SID,
      gemini_key_detected: !!process.env.GEMINI_API_KEY,
      app_url: currentAppUrl || process.env.APP_URL || "Not set"
    });
  });

  // Global Middleware
  app.use((req, res, next) => {
    if (!currentAppUrl) {
      const host = req.headers["x-forwarded-host"] || req.headers["host"];
      const proto = req.headers["x-forwarded-proto"] || "https";
      currentAppUrl = `${proto}://${host}`;
      console.log(`[Jan Dashboard] Captured APP_URL: ${currentAppUrl}`);
    }
    next();
  });

  // Manual Intervention Endpoint
  app.post("/api/whatsapp/intervene", async (req, res) => {
    const { phone, agentName } = req.body;
    if (!phone || !agentName) return res.status(400).json({ error: "Missing phone or agentName" });

    const cleanPhone = phone.replace("whatsapp:", "");
    const formattedPhone = phone.startsWith("whatsapp:") ? phone : `whatsapp:${phone}`;
    const message = `Hola, le habla ${agentName} personalmente. Voy a retomar su caso para darle una atención VIP. Cuénteme, ¿en qué más le puedo ayudar?`;

    try {
    // 1. Pause AI
    await setDoc(doc(db, "conversations", cleanPhone), {
      phone: cleanPhone,
      aiPaused: true,
      lastInterventionBy: agentName,
      updatedAt: serverTimestamp()
    }, { merge: true });

    // 2. Send Message
    const sent = await sendWhatsApp(formattedPhone, message);
    
    // 3. Log Activity
    await addDoc(collection(db, "activities"), {
      from: formattedPhone,
      to: TWILIO_FROM_NUMBER,
      storeId: "default",
      message: "[Asesor Humano]",
      response: message,
      status: "respondido",
      whatsappStatus: "sent",
      manualAgent: agentName,
      timestamp: serverTimestamp()
    });

      res.json({ success: true });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.post("/api/admin/bulk-notify", async (req, res) => {
    const { message } = req.body;
    if (!message) return res.status(400).json({ error: "Missing message" });
    
    const adminNumbersRaw = process.env.ADMIN_WHATSAPP_NUMBERS || "";
    const adminNumbers = adminNumbersRaw.split(",").filter(n => n.trim().length > 0);
    
    if (adminNumbers.length === 0) {
      return res.status(400).json({ error: "No admin numbers configured" });
    }

    const results = [];
    for (const num of adminNumbers) {
      try {
        const target = num.trim().startsWith("whatsapp:") ? num.trim() : `whatsapp:${num.trim()}`;
        await sendWhatsApp(target, message);
        results.push({ phone: num, success: true });
      } catch (e: any) {
        results.push({ phone: num, success: false, error: e.message });
      }
    }
    res.json({ success: true, results });
  });

  // Admin Seed Trigger
  app.post("/api/admin/clear-transactions", async (req, res) => {
    try {
      console.log("[Admin Clear] Deleting all orders and activities...");
      
      const ordersSnap = await getDocs(collection(db, "orders"));
      const activitiesSnap = await getDocs(collection(db, "activities"));
      
      const batch = writeBatch(db);
      ordersSnap.docs.forEach(doc => batch.delete(doc.ref));
      activitiesSnap.docs.forEach(doc => batch.delete(doc.ref));
      
      await batch.commit();
      
      // Also clear system Twilio limit status to start fresh
      await setDoc(doc(db, "config", "system"), {
        twilioLimitReached: false,
        lastTwilioError: null,
        updatedAt: serverTimestamp()
      }, { merge: true });

      res.json({ success: true, message: "Historial de ventas y actividades borrado con éxito." });
    } catch (e: any) {
      console.error("[Admin Clear] Error:", e);
      res.status(500).json({ success: false, error: e.message });
    }
  });

  app.post("/api/admin/seed", async (req, res) => {
    try {
      const { catalog } = req.body || {};
      await seedDatabase(true, catalog);
      res.json({ success: true, message: "Catálogo actualizado con éxito (Admin)." });
    } catch (e: any) {
      console.error("[API Admin Seed] Error:", e);
      res.status(500).json({ 
        success: false, 
        error: e.message,
        details: JSON.stringify(e, null, 2)
      });
    }
  });

  // Toggle AI
  app.post("/api/whatsapp/toggle-ai", async (req, res) => {
    const { phone, pause } = req.body;
    const cleanPhone = phone.replace("whatsapp:", "");
    try {
      await setDoc(doc(db, "conversations", cleanPhone), {
        aiPaused: pause,
        updatedAt: serverTimestamp()
      }, { merge: true });
      res.json({ success: true });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // Forced Sync on Boot (Self-Correction for Sincronizar button issues)
  console.log("[Jan Sync] Ejecutando sincronización forzada de arranque...");
  seedDatabase(true).catch(e => console.error("[Jan Sync] Error en arranque:", e));

  // Initialize DB
  seedDatabase().catch(err => {
    console.warn("[DB] No se pudo sembrar el catálogo (posiblemente por permisos):", err.message);
  });

  // Admin Config Endpoints
  app.post("/api/admin/upload", express.raw({ type: "*/*", limit: "10mb" }), async (req, res) => {
    const mimeType = req.headers["content-type"] || "application/octet-stream";
    const id = Math.random().toString(36).substring(7);
    mediaCache.set(id, { data: req.body, mimeType });
    
    let protocol = req.headers["x-forwarded-proto"] || req.protocol;
    if (Array.isArray(protocol)) protocol = protocol[0];
    const host = req.headers["host"];
    const baseUrl = process.env.APP_URL || `https://${host}`;
    
    res.json({ success: true, mediaId: id, url: `${baseUrl}/api/media/${id}` });
  });

  app.post("/api/admin/config", (req, res) => {
    res.json({ success: true, message: "Usando API Key del sistema." });
  });

  app.get("/api/admin/catalog", (req, res) => {
    try {
      const catalogPath = path.join(__dirname, "src", "catalog.json");
      if (existsSync(catalogPath)) {
        const catalogData = JSON.parse(readFileSync(catalogPath, "utf-8"));
        return res.json(catalogData);
      }
      res.status(404).json({ error: "Catálogo no encontrado" });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/admin/reset-db", async (req, res) => {
    try {
      // NOTE: Seeding is now handled CLIENT-SIDE in App.tsx via /api/admin/catalog
      // This endpoint is left as a successful no-op for backward compatibility.
      res.json({ success: true, message: "Base de datos lista para sincronización frontend." });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

    // Twilio Status Webhook (Sent, Delivered, Read)
    app.post("/api/webhook/whatsapp/status", async (req, res) => {
      const { activityId } = req.query as { activityId: string };
      // Normalizing Twilio params (they can be in body or query depending on Twilio config)
      const status = req.body.MessageStatus || req.body.SmsStatus || req.query.MessageStatus;
      const actId = activityId || req.body.activityId;

      console.log(`[Twilio Status] Event: ${status} for Activity: ${actId}`);

      if (!actId) return res.sendStatus(200);

    try {
      const snap = await getDoc(doc(db, "activities", actId));
      if (!snap.exists()) return res.sendStatus(200);

      let mappedStatus: string = "";
      
      switch (status) {
        case 'read': mappedStatus = 'read'; break;
        case 'delivered': mappedStatus = 'delivered'; break;
        case 'sent': mappedStatus = 'sent'; break;
        case 'failed':
        case 'undelivered': mappedStatus = 'failed'; break;
      }

      if (mappedStatus) {
        await updateDoc(doc(db, "activities", actId), { 
          whatsappStatus: mappedStatus,
          statusUpdateAt: serverTimestamp()
        });
        console.log(`[Twilio Status] Successfully updated Activity ${actId} to ${mappedStatus}`);
      }
    } catch (e: any) {
        console.error("[Twilio Status][Error] Update failed:", e.message);
      }
      
      res.sendStatus(200);
    });

  // Twilio Webhook
  app.post("/api/webhook/whatsapp", async (req, res) => {
    detectCurrentUrl(req);
    // Log incoming body for debugging
    console.log("[WhatsApp Webhook] Received call. Body keys:", Object.keys(req.body));
    console.log("[WhatsApp Webhook] Incoming From:", req.body?.From, "To:", req.body?.To);

    const from = req.body?.From || req.body?.from;
    const to = req.body?.To || req.body?.to;
    const messageBody = req.body?.Body || req.body?.body || "";
    const numMedia = parseInt(req.body?.NumMedia || req.body?.numMedia || "0");

    if (!from || !to) {
      console.warn("[WhatsApp Webhook] Missing From/To. Body:", JSON.stringify(req.body));
      return res.status(200).send(""); 
    }

    // IGNORE MESSAGES FROM SELF (TWILIO ECHOES OR LOOPBACKS)
    const normalizedFrom = from.toLowerCase();
    const normalizedBot = (TWILIO_FROM_NUMBER || "").toLowerCase();
    if (normalizedFrom === normalizedBot || normalizedFrom === `whatsapp:${normalizedBot}`) {
      console.log("[WhatsApp Webhook] Ignoring message from bot's own number.");
      return res.status(200).send("");
    }

    // Dynamic URL detection for status callbacks
    if (!currentAppUrl) {
      const host = req.headers["x-forwarded-host"] || req.headers["host"];
      const proto = req.headers["x-forwarded-proto"] || "https";
      currentAppUrl = `${proto}://${host}`;
      console.log(`[Twilio Webhook] Detected APP_URL: ${currentAppUrl}`);
    }

    console.log(`[WhatsApp Webhook] Incoming from ${from} to ${to}: ${messageBody}`);

    // EXRACT MEDIA IF ANY
    let finalMessage = messageBody;
    if (numMedia > 0) {
      for (let i = 0; i < numMedia; i++) {
        const mUrl = req.body[`MediaUrl${i}`];
        finalMessage += ` [Media: ${mUrl}]`;
      }
    }

    // LOG IMMEDIATELY
    try {
      const cleanFrom = from.replace('whatsapp:', '').trim();
      const activityRef = await addDoc(collection(db, "activities"), {
        from,
        to,
        recipient: from, // THE CUSTOMER is always the recipient/thread-ID
        customerPhone: cleanFrom,
        botNumber: to,   // Store which bot number received this
        storeId: "default",
        message: finalMessage,
        status: "recibido",
        senderType: 'customer',
        receivedAt: serverTimestamp(),
        timestamp: serverTimestamp()
      });
      console.log(`[Activity] Registered: ${activityRef.id}. Bot receiving: ${to}`);
    } catch (e: any) {
      console.warn("[Activity] Registration failed:", e.message);
    }

    // 1. ACKNOWLEDGE TWILIO IMMEDIATELY
    res.status(200).send("");
  });

  app.post("/api/admin/test-notify", async (req, res) => {
    try {
      const mockOrder = {
        customerName: "Cliente de Prueba",
        productName: "Sneakers Medellín Premium",
        quantity: 1,
        address: "Calle 10 #12-34",
        city: "Medellín",
        totalPrice: 245000
      };
      await notifyAdmins(mockOrder, "Test Store");
      res.json({ success: true, message: "Prueba enviada a los jefes." });
    } catch (e: any) {
      res.status(500).json({ success: false, error: e.message });
    }
  });

  app.post("/api/admin/cache-media", express.json({ limit: '50mb' }), (req, res) => {
    detectCurrentUrl(req);
    const { data, mimeType } = req.body;
    if (!data || !mimeType) return res.status(400).json({ error: "Missing data" });
    const id = Math.random().toString(36).substring(7);
    mediaCache.set(id, {
      data: Buffer.from(data, 'base64'),
      mimeType: mimeType
    });
    let baseUrl = currentAppUrl || (req.headers.origin && !req.headers.origin.includes('localhost') ? req.headers.origin : process.env.APP_URL);
    if (!baseUrl) {
      console.warn("[Media Cache] No absolute base URL found, Twilio might fail to download this media.");
      baseUrl = "";
    }
    const extension = mimeType.includes('jpeg') ? '.jpg' : mimeType.includes('png') ? '.png' : '.mp3';
    const url = baseUrl ? `${baseUrl}/api/media/${id}${extension}` : `/api/media/${id}${extension}`;
    console.log(`[Media Cache] Stored media at URL: ${url}`);
    res.json({ id, url });
  });

  app.get("/api/admin/recovery-leads", async (req, res) => {
    try {
      const { storeId } = req.query;
      const q = query(
        collection(db, "activities"),
        where("storeId", "==", storeId),
        where("status", "==", "recibido"),
        orderBy("timestamp", "desc"),
        limit(20)
      );
      const snap = await getDocs(q);
      const leads = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      res.json({ success: true, leads });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  app.post("/api/admin/send-message", async (req, res) => {
    detectCurrentUrl(req);
    const { to, message, mediaUrl, from: requestedFrom } = req.body;

    if (!to || (!message && !mediaUrl) || !twilioClient) {
      console.warn("[Admin Send] Validation failed:", { to: !!to, hasMsg: !!message, hasMedia: !!mediaUrl, hasTwilio: !!twilioClient });
      return res.status(400).json({ success: false, error: "Missing data or client" });
    }

    try {
      const cleanTo = to.startsWith("whatsapp:") ? to : `whatsapp:${to}`;
      const customerPhone = cleanTo.replace("whatsapp:", "").trim();
      const finalFrom = requestedFrom || TWILIO_FROM_NUMBER || "whatsapp:+14155238886";

      console.log(`[Admin] Sending FROM ${finalFrom} TO ${to}. Message: ${message?.substring(0, 20)}...`);
      
      // CRITICAL: Ensure Jan never talks to himself
      if (cleanTo === (finalFrom.startsWith("whatsapp:") ? finalFrom : `whatsapp:${finalFrom}`)) {
        console.warn("[Admin] Bot attempted to send message to itself. Blocked.");
        return res.status(400).json({ success: false, error: "Cannot send to self" });
      }

      // Log activity
      const activityRef = await addDoc(collection(db, "activities"), {
        from: finalFrom, 
        to: cleanTo, 
        recipient: cleanTo,
        message: message || "[Media enviado]",
        status: "respondido",
        whatsappStatus: "sending",
        senderType: 'bot',
        timestamp: serverTimestamp(),
        customerPhone: customerPhone
      });

      try {
        const twilioRes = await sendWhatsApp(to, message || "", mediaUrl, activityRef.id, requestedFrom);
        res.json({ success: true, SID: twilioRes?.sid, activityId: activityRef.id });
      } catch (sendErr: any) {
        console.error("[Twilio] Send failed:", sendErr.message);
        await updateDoc(activityRef, { 
          status: "error", 
          whatsappStatus: "failed", 
          errorMessage: sendErr.message 
        });
        throw sendErr;
      }
    } catch (err: any) {
      const isLimitError = err.message.includes("limit") || err.message.includes("50");
      res.status(isLimitError ? 429 : 500).json({ 
        success: false, 
        error: err.message,
        limitReached: isLimitError
      });
    }
  });

  // App API
  app.get("/api/health", (req, res) => res.json({ status: "ok" }));

  // Media Serving Endpoint
  app.get("/api/media/:id", (req, res) => {
    // Handle optional extensions like .mp3 or .png
    const id = req.params.id.split(".")[0];
    const media = mediaCache.get(id);
    if (media) {
      res.set("Content-Type", media.mimeType);
      res.send(media.data);
    } else {
      res.status(404).send("Not found");
    }
  });

  // Vite setup
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { 
        middlewareMode: true,
        hmr: false, 
      },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => res.sendFile(path.join(distPath, "index.html")));
  }

  const server = app.listen(PORT, "0.0.0.0", () => {
    console.log(`[SERVER] Jan Vanegas Dashboard: http://localhost:${PORT}`);
  });

  // Handle server errors (like port in use) gracefully
  server.on("error", (err: any) => {
    if (err.code === "EADDRINUSE") {
      console.error(`[SERVER] EL PUERTO ${PORT} ESTÁ OCUPADO. El sistema de Google reintentará automáticamente.`);
    } else {
      console.error("[SERVER] Error fatal:", err.message);
    }
  });
}

startServer();
