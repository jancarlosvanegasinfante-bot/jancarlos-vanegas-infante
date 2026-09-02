import express from "express";
import axios from "axios";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import twilio from "twilio";
import { readFileSync, existsSync, writeFileSync, readdirSync, mkdirSync, copyFileSync } from "fs";
import "dotenv/config";

import { createClient } from "@supabase/supabase-js";
import sgMail from '@sendgrid/mail';
import { getSystemInstruction } from "./src/lib/janAgent.js";
import { ACTIVE_PROMOTIONS } from "./src/lib/promotions.js";
import { obtenerInforme, paginaInforme } from "./src/lib/informe.js";
import crypto from "crypto";

// 1. Initialize Supabase / Local JSON File Storage
const cwd = process.cwd();

let SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "";
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || "";
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

if (SUPABASE_URL.endsWith('/rest/v1/')) {
  SUPABASE_URL = SUPABASE_URL.replace('/rest/v1/', '');
} else if (SUPABASE_URL.endsWith('/rest/v1')) {
  SUPABASE_URL = SUPABASE_URL.replace('/rest/v1', '');
}

const supabaseKey = SUPABASE_SERVICE_ROLE_KEY || SUPABASE_ANON_KEY;
// Si hay credenciales reales de Supabase configuradas, estamos en producción real
// (no en modo local emulado con local_db.json) — usado para decidir cuándo exigir
// autenticación de admin en las rutas /api/db/*.
const IS_CLOUD_DB_MODE = !!(SUPABASE_URL && supabaseKey);
export const supabaseServer = (SUPABASE_URL && supabaseKey)
  ? createClient(SUPABASE_URL, supabaseKey)
  : null;

console.log(`[Supabase Server] Mode: ${supabaseServer ? "Cloud Connected" : "Local Emulated (Auto-Fallback)"}`);

// Local JSON File Database Path
const LOCAL_DB_PATH = path.join(cwd, "local_db.json");
let localDbCache: Record<string, Record<string, any>> = {};

function sanitizeProductImage(item: any) {
  if (!item || typeof item !== "object") return item;
  let url = item.imageUrl || "";

  if (url.startsWith("/images/")) return item;

  const publicDir = path.join(process.cwd(), "public", "images");
  if (existsSync(publicDir)) {
    try {
      const files = readdirSync(publicDir);
      const norm = (s: string) => (s || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/g, "");

      const lastPart = url.split("/").pop() || "";
      const urlBaseNorm = norm(lastPart.split(".")[0]);
      const idNorm = norm(item.id);
      const nameNorm = norm(item.name);

      for (const file of files) {
        const dot = file.lastIndexOf(".");
        const fileBase = dot !== -1 ? file.substring(0, dot) : file;
        const fileNorm = norm(fileBase);

        if (fileNorm.length >= 3 && (fileNorm === urlBaseNorm || fileNorm === idNorm || fileNorm === nameNorm || (urlBaseNorm.length >= 4 && (urlBaseNorm.includes(fileNorm) || fileNorm.includes(urlBaseNorm))) || (idNorm.length >= 4 && (idNorm.includes(fileNorm) || fileNorm.includes(idNorm))) || (nameNorm.length >= 5 && (nameNorm.includes(fileNorm) || fileNorm.includes(nameNorm))))) {
          item.imageUrl = "/images/" + file;
          return item;
        }
      }
    } catch (e) {}
  }

  if (!url || url.includes("ibb.co")) {
    item.imageUrl = "/images/logo.jpeg";
  }

  return item;
}

function sanitizeAllProductsInCache() {
  if (localDbCache && localDbCache["products"]) {
    for (const key in localDbCache["products"]) {
      localDbCache["products"][key] = sanitizeProductImage(localDbCache["products"][key]);
    }
  }
}

// Load local database cache
function loadLocalDb() {
  try {
    if (existsSync(LOCAL_DB_PATH)) {
      localDbCache = JSON.parse(readFileSync(LOCAL_DB_PATH, "utf8"));
      sanitizeAllProductsInCache();
      saveLocalDb();
    } else {
      localDbCache = {};
    }
  } catch (err) {
    console.error("[Local DB] Error loading database:", err);
    localDbCache = {};
  }
}

// Save local database cache
function saveLocalDb() {
  try {
    writeFileSync(LOCAL_DB_PATH, JSON.stringify(localDbCache, null, 2), "utf8");
  } catch (err) {
    console.error("[Local DB] Error saving database:", err);
  }
}

// Initial load on boot
loadLocalDb();

// Automatically ensure public/images and dist/images contain all assets on boot
function ensurePublicImages() {
  const srcDir = path.join(process.cwd(), "src", "assets", "images");
  const destDir = path.join(process.cwd(), "public", "images");
  const distDestDir = path.join(process.cwd(), "dist", "images");
  console.log("[Image Sync] Running automatic public and dist images sync on boot...");
  try {
    if (!existsSync(destDir)) {
      mkdirSync(destDir, { recursive: true });
    }
    if (!existsSync(distDestDir)) {
      mkdirSync(distDestDir, { recursive: true });
    }
    if (existsSync(srcDir)) {
      const files = readdirSync(srcDir);
      let copiedPublic = 0;
      let copiedDist = 0;
      for (const file of files) {
        const srcFile = path.join(srcDir, file);
        
        // Copy to public/images
        const destFile = path.join(destDir, file);
        copyFileSync(srcFile, destFile);
        copiedPublic++;

        // Copy to dist/images
        const distDestFile = path.join(distDestDir, file);
        copyFileSync(srcFile, distDestFile);
        copiedDist++;
      }
      console.log(`[Image Sync] Successfully synchronized ${copiedPublic} images to public and ${copiedDist} images to dist`);
    } else {
      console.warn(`[Image Sync] Warning: Source assets folder ${srcDir} does not exist.`);
    }
  } catch (err: any) {
    console.error("[Image Sync] Error synchronizing images:", err.message);
  }
}
ensurePublicImages();

// Preload all data from Supabase on startup to avoid empty localDbCache on redeployment or container restart
async function preloadSupabaseData() {
  if (!supabaseServer) {
    console.log("[Supabase Server] Not connected, skipping prefetch.");
    return;
  }
  const collections = ["stores", "products", "orders", "activities", "customers", "conversations", "config", "followups", "processed_messages", "demand_requests"];
  console.log(`[Supabase Prefetch] Starting prefetch on startup for: ${collections.join(", ")}`);
  for (const col of collections) {
    try {
      const { data, error } = await supabaseServer.from(col).select("*");
      if (error) {
        console.warn(`[Supabase Prefetch] Error loading table "${col}": ${error.message}.
If the table does not exist in your Supabase database, please execute this in your Supabase SQL Editor:

CREATE TABLE ${col} (
  id TEXT PRIMARY KEY,
  data JSONB,
  "updatedAt" TEXT
);`);
        continue;
      }
      if (data && data.length > 0) {
        if (!localDbCache[col]) {
          localDbCache[col] = {};
        }
        for (const item of data) {
          let record = item.data || item;
          if (col === "products") {
            record = sanitizeProductImage(record);
          }
          localDbCache[col][item.id] = record;
        }
        console.log(`[Supabase Prefetch] Successfully loaded ${data.length} records for table "${col}"`);
      }
    } catch (e: any) {
      console.warn(`[Supabase Prefetch] Failed to preload table "${col}":`, e.message);
    }
  }
  saveLocalDb();
}
preloadSupabaseData();

// -------------------------------------------------------------
// 🗄️ SUPABASE-COMPATIBLE API ADAPTER FOR BACKEND
// -------------------------------------------------------------

export const db = { type: "supabase-proxy" };

export function doc(dbObj: any, collectionName: string, id: string) {
  return { type: "doc", collection: collectionName, id };
}

export function collection(dbObj: any, collectionName: string) {
  return { type: "collection", name: collectionName };
}

export function where(field: string, op: string, value: any) {
  return { type: "where", field, op, value };
}

export function orderBy(field: string, direction: string = "asc") {
  return { type: "orderBy", field, op: direction, value: null };
}

export function limit(value: number) {
  return { type: "limit", field: "", op: "", value };
}

export function query(collectionRef: any, ...constraints: any[]) {
  return {
    type: "query",
    collection: collectionRef.name,
    constraints
  };
}

export function serverTimestamp() {
  return new Date().toISOString();
}

// Low-level helper: read doc
export async function dbGetDoc(collectionName: string, id: string): Promise<{ exists: boolean; data: any }> {
  if (supabaseServer) {
    try {
      const { data, error } = await supabaseServer
        .from(collectionName)
        .select("*")
        .eq("id", id)
        .maybeSingle();
      
      if (!error && data) {
        return { exists: true, data: data.data || data };
      }
    } catch (err: any) {
      console.warn(`[Supabase DB Server] Read failed for table ${collectionName}: ${err.message}. Using local.`);
    }
  }

  const col = localDbCache[collectionName] || {};
  const docData = col[id];
  if (docData) {
    return { exists: true, data: docData };
  }
  return { exists: false, data: null };
}

// Low-level helper: write doc
export async function dbSetDoc(collectionName: string, id: string, data: any, merge: boolean = true): Promise<void> {
  if (!localDbCache[collectionName]) {
    localDbCache[collectionName] = {};
  }

  // Pre-fetch from Supabase if not in local cache to prevent data loss on container restarts
  if (merge && !localDbCache[collectionName][id] && supabaseServer) {
    try {
      const { data: remoteData, error } = await supabaseServer
        .from(collectionName)
        .select("*")
        .eq("id", id)
        .maybeSingle();
      if (!error && remoteData) {
        localDbCache[collectionName][id] = remoteData.data || remoteData;
        console.log(`[Supabase Prefetch] Successfully loaded existing doc "${id}" for merge in collection "${collectionName}"`);
      }
    } catch (e: any) {
      console.warn(`[Supabase Prefetch] Failed to prefetch doc ${id} for merge:`, e?.message);
    }
  }

  if (merge) {
    localDbCache[collectionName][id] = {
      ...(localDbCache[collectionName][id] || {}),
      ...data,
      updatedAt: new Date().toISOString()
    };
  } else {
    localDbCache[collectionName][id] = {
      ...data,
      id,
      updatedAt: new Date().toISOString()
    };
  }
  saveLocalDb();

  if (supabaseServer) {
    try {
      const docPayload = localDbCache[collectionName][id];
      // Try Option 1: Schema with id, data, and updatedAt
      let { error } = await supabaseServer
        .from(collectionName)
        .upsert({
          id,
          data: docPayload,
          updatedAt: new Date().toISOString()
        });
      
      if (error) {
        // Fallback 1: Try with only id and data (most standard schema for key-value stores)
        console.log(`[Supabase DB Server] Option 1 failed for table ${collectionName} (${error.message}). Trying Fallback 1 (id, data)...`);
        const { error: error2 } = await supabaseServer
          .from(collectionName)
          .upsert({
            id,
            data: docPayload
          });
        
        if (error2) {
          // Fallback 2: Try upserting flat properties directly
          console.log(`[Supabase DB Server] Fallback 1 failed for table ${collectionName} (${error2.message}). Trying Fallback 2 (flat properties)...`);
          const { error: error3 } = await supabaseServer
            .from(collectionName)
            .upsert({ id, ...docPayload });
          
          if (error3) {
            console.error(`[Supabase DB Server] All upsert attempts failed for table ${collectionName}. Errors:
1. ${error.message}
2. ${error2.message}
3. ${error3.message}`);
          } else {
            console.log(`[Supabase DB Server] Upsert succeeded on Fallback 2 (flat schema) for table ${collectionName}`);
          }
        } else {
          console.log(`[Supabase DB Server] Upsert succeeded on Fallback 1 (id/data schema) for table ${collectionName}`);
        }
      } else {
        console.log(`[Supabase DB Server] Upsert succeeded on Option 1 (updatedAt schema) for table ${collectionName}`);
      }
    } catch (err: any) {
      console.warn(`[Supabase DB Server] Upsert failed with exception for table ${collectionName}: ${err.message}`);
    }
  }
}

// Low-level helper: delete doc
export async function dbDeleteDoc(collectionName: string, id: string): Promise<void> {
  if (localDbCache[collectionName]) {
    delete localDbCache[collectionName][id];
    saveLocalDb();
  }

  if (supabaseServer) {
    try {
      await supabaseServer
        .from(collectionName)
        .delete()
        .eq("id", id);
    } catch (err: any) {
      console.warn(`[Supabase DB Server] Delete failed for table ${collectionName}: ${err.message}`);
    }
  }
}

// Low-level helper: read collection
export async function dbGetDocs(collectionName: string, constraints: any[] = []): Promise<any[]> {
  let list: any[] = [];

  const col = localDbCache[collectionName] || {};
  list = Object.entries(col).map(([id, data]) => ({ id, data }));

  if (supabaseServer) {
    try {
      // Empujamos orden, limite e igualdades a Postgres en vez de traer la tabla
      // entera y filtrar en memoria. Antes, cada consulta del panel descargaba
      // TODAS las actividades (520 kB con 818 registros) y el panel las pide cada
      // 3.5s por pestana: con el volumen creciendo eso se vuelve insostenible.
      let q: any = supabaseServer.from(collectionName).select("*");
      for (const c of constraints) {
        if (c.type === "where" && c.op === "==" && c.field) {
          // Los documentos guardan sus campos dentro de la columna jsonb "data".
          q = q.eq("data->>" + c.field, String(c.value));
        } else if (c.type === "orderBy" && c.field) {
          const asc = (c.direction || c.op) !== "desc";
          q = q.order("data->>" + c.field, { ascending: asc, nullsFirst: false });
        } else if (c.type === "limit") {
          const n = Number(c.value ?? c.limit);
          if (Number.isFinite(n) && n > 0) q = q.limit(n);
        }
      }
      const { data, error } = await q;
      if (!error && data && data.length > 0) {
        if (!localDbCache[collectionName]) {
          localDbCache[collectionName] = {};
        }
        for (const item of data) {
          localDbCache[collectionName][item.id] = item.data || item;
        }
        saveLocalDb();
        
        list = data.map((item: any) => ({
          id: item.id,
          data: item.data || item
        }));
      }
    } catch (err: any) {
      console.warn(`[Supabase DB Server] Query failed for table ${collectionName}: ${err.message}. Using local.`);
    }
  }

  // Filter in-memory (matches Supabase proxy logic perfectly)
  for (const c of constraints) {
    if (c.type === "where") {
      const { field, op, value } = c;
      list = list.filter(item => {
        const val = item.data?.[field];
        if (op === "==") return val === value;
        if (op === "!=") return val !== value;
        if (op === ">") return val > value;
        if (op === "<") return val < value;
        if (op === ">=") return val >= value;
        if (op === "<=") return val <= value;
        if (op === "array-contains") return Array.isArray(val) && val.includes(value);
        return true;
      });
    }

  // orderBy y limit se creaban en el cliente pero NUNCA se aplicaban aqui, asi
  // que toda consulta volvia en el orden arbitrario de Postgres y con la coleccion
  // entera. Por eso el panel mostraba los mensajes desordenados y los recientes
  // quedaban enterrados entre cientos de registros viejos.
  const orderConstraints = constraints.filter((c: any) => c.type === "orderBy");
  for (const c of orderConstraints) {
    const field = c.field;
    const desc = (c.direction || c.op) === "desc";
    list.sort((a: any, b: any) => {
      const av = a.data?.[field];
      const bv = b.data?.[field];
      // Los documentos sin ese campo van siempre al final, en ambos sentidos.
      const aEmpty = av === undefined || av === null;
      const bEmpty = bv === undefined || bv === null;
      if (aEmpty && bEmpty) return 0;
      if (aEmpty) return 1;
      if (bEmpty) return -1;
      let cmp: number;
      if (typeof av === "number" && typeof bv === "number") cmp = av - bv;
      else cmp = String(av).localeCompare(String(bv));
      return desc ? -cmp : cmp;
    });
  }

  const limitConstraint = constraints.find((c: any) => c.type === "limit");
  if (limitConstraint) {
    const n = Number(limitConstraint.value ?? limitConstraint.limit);
    if (Number.isFinite(n) && n > 0) list = list.slice(0, n);
  }
  }

  // Order in-memory
  for (const c of constraints) {
    if (c.type === "orderBy") {
      const { field, op: direction } = c;
      list.sort((a, b) => {
        const valA = a.data?.[field];
        const valB = b.data?.[field];
        if (valA === undefined) return 1;
        if (valB === undefined) return -1;
        if (valA < valB) return direction === "desc" ? 1 : -1;
        if (valA > valB) return direction === "desc" ? -1 : 1;
        return 0;
      });
    }
  }

  // Limit in-memory
  for (const c of constraints) {
    if (c.type === "limit") {
      list = list.slice(0, c.value);
    }
  }

  return list;
}

// Supabase compatible functions for server.ts
export async function getDoc(docRef: any) {
  const result = await dbGetDoc(docRef.collection, docRef.id);
  return {
    id: docRef.id,
    exists: () => result.exists,
    data: () => result.data,
    ref: docRef
  };
}

export async function getDocs(queryObj: any) {
  const isQuery = queryObj.type === "query";
  const collectionName = isQuery ? queryObj.collection : queryObj.name;
  const constraints = isQuery ? queryObj.constraints : [];

  const docsData = await dbGetDocs(collectionName, constraints);
  const docs = docsData.map(item => ({
    id: item.id,
    exists: () => true,
    data: () => item.data,
    ref: { type: "doc", collection: collectionName, id: item.id }
  }));

  return {
    docs,
    empty: docs.length === 0,
    size: docs.length,
    forEach: (callback: (doc: any) => void) => docs.forEach(callback)
  };
}

export async function setDoc(docRef: any, data: any, options?: { merge?: boolean }) {
  await dbSetDoc(docRef.collection, docRef.id, data, options?.merge !== false);
}

export async function addDoc(collectionRef: any, data: any) {
  const id = Math.random().toString(36).substring(2, 15);
  await dbSetDoc(collectionRef.name, id, data, false);
  return {
    id,
    ref: { type: "doc", collection: collectionRef.name, id }
  };
}

export async function updateDoc(docRef: any, data: any) {
  const collName = docRef.collection || docRef.ref?.collection;
  const docId = docRef.id || docRef.ref?.id;
  await dbSetDoc(collName, docId, data, true);
}

// Batch write helper
export function writeBatch(dbObj?: any) {
  const ops: Array<() => Promise<void>> = [];
  return {
    set: (docRef: any, data: any, options?: any) => {
      ops.push(() => setDoc(docRef, data, options));
    },
    update: (docRef: any, data: any) => {
      ops.push(() => updateDoc(docRef, data));
    },
    delete: (docRef: any) => {
      ops.push(() => dbDeleteDoc(docRef.collection, docRef.id));
    },
    commit: async () => {
      for (const op of ops) {
        await op();
      }
    }
  };
}

// Robust Environment Variable Detection (Railway & Google Cloud compat)
const TWILIO_ACCOUNT_SID = process.env.TWILIO_ACCOUNT_SID || process.env.SID_DE_CUENTA_TWILIO || process.env.VITE_TWILIO_ACCOUNT_SID;
const TWILIO_AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN || process.env.TOKEN_DE_AUTORIZACION_DE_TWILIO || process.env.VITE_TWILIO_AUTH_TOKEN;
const TWILIO_FROM_NUMBER = process.env.TWILIO_FROM_NUMBER || process.env.TWILIO_DESDE_NÚMERO || process.env.TWILIO_NUMBER || process.env.VITE_TWILIO_FROM_NUMBER;
const NVIDIA_API_KEY = process.env.NVIDIA_API_KEY;
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
const SENDGRID_API_KEY = process.env.SENDGRID_API_KEY;
const SENDGRID_FROM_EMAIL = process.env.SENDGRID_FROM_EMAIL;
const FB_PAGE_ACCESS_TOKEN = process.env.FB_PAGE_ACCESS_TOKEN;

// ==============================================
// 🚦 GLOBAL QUOTA BREAKER (ANTI-SPAM / QUOTA LOOP)
// ==============================================
let globalQuotaExceeded = false;
let quotaExceededTime = 0;
const QUOTA_COOLDOWN_MS = 60 * 60 * 1000; // 1 Hora

function checkGlobalQuota(): boolean {
  if (globalQuotaExceeded) {
    if (Date.now() - quotaExceededTime > QUOTA_COOLDOWN_MS) {
      globalQuotaExceeded = false;
      console.log("[QUOTA BREAKER] Cooldown finished. Resuming writes.");
      return false;
    }
    return true; // Still locked
  }
  return false;
}

function handleSupabaseError(e: any): never {
  throw e;
}


if (SENDGRID_API_KEY) {
  sgMail.setApiKey(SENDGRID_API_KEY);
}

// 📧 Canal de respaldo por email: si WhatsApp está teniendo problemas de
// envío, un aviso por WhatsApp podría no llegar. El email es independiente
// de Twilio/Meta, así que es la red de seguridad real.
const ADMIN_ALERT_EMAIL = "jancarlosvanegasinfante@gmail.com";
async function sendAdminAlertEmail(subject: string, body: string): Promise<void> {
  if (!SENDGRID_API_KEY || !SENDGRID_FROM_EMAIL) {
    console.error("[Email Alert] SendGrid no configurado (falta SENDGRID_API_KEY o SENDGRID_FROM_EMAIL), no se pudo mandar alerta por correo.");
    return;
  }
  try {
    await sgMail.send({
      to: ADMIN_ALERT_EMAIL,
      from: SENDGRID_FROM_EMAIL,
      subject,
      text: body
    });
    console.log(`[Email Alert] Alerta enviada a ${ADMIN_ALERT_EMAIL}: ${subject}`);
  } catch (e: any) {
    console.error("[Email Alert] Error enviando alerta por correo:", e.message);
  }
}

// 🚦 Rastreo de errores de límite de Twilio recientes (últimos 60 min)
const recentTwilioLimitErrors: number[] = [];
let lastTwilioLimitAlertAt = 0;

const twilioClient = TWILIO_ACCOUNT_SID && TWILIO_AUTH_TOKEN ? twilio(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN) : null;

// Caché en memoria de MessageSids ya procesados (protección anti-duplicados
// contra reintentos del webhook de Twilio). Ver uso en /api/webhook/whatsapp.
const processedMessageSids = new Set<string>();

// Global State
const mediaCache = new Map<string, { data: Buffer, mimeType: string }>();

// 💾 PERSISTENCIA DE MEDIA (fix de imágenes que no llegaban)
// Antes, los archivos subidos desde el dashboard solo vivían en memoria
// (mediaCache). Si Railway reiniciaba/redesplegaba el servidor justo después
// de subir una imagen (algo común, pasa en cada deploy), Twilio intentaba
// descargar la imagen y se encontraba con que ya no existía — el mensaje
// fallaba con "media urls must be specified". Ahora también se guarda en
// Supabase, que sí sobrevive reinicios. La memoria se sigue usando como
// acceso rápido; si no está ahí (por un reinicio), se busca en Supabase.
async function saveMediaPersistent(id: string, data: Buffer, mimeType: string): Promise<void> {
  mediaCache.set(id, { data, mimeType });
  try {
    await setDoc(doc(db, "media_cache", id), {
      dataBase64: data.toString("base64"),
      mimeType
    });
  } catch (e: any) {
    console.error("[Media Persist] Error guardando media en Supabase:", e.message);
  }
}

async function getMediaPersistent(id: string): Promise<{ data: Buffer, mimeType: string } | null> {
  const cached = mediaCache.get(id);
  if (cached) return cached;
  try {
    const snap = await getDoc(doc(db, "media_cache", id));
    if (snap.exists()) {
      const d = snap.data();
      const buf = Buffer.from(d.dataBase64, "base64");
      const result = { data: buf, mimeType: d.mimeType };
      mediaCache.set(id, result); // recalentar la caché rápida
      return result;
    }
  } catch (e: any) {
    console.error("[Media Persist] Error leyendo media de Supabase:", e.message);
  }
  return null;
}

const userRateLimitCache = new Map<string, { lastTime: number, msgCount: number }>();
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
 * Determines the associated store based on a WhatsApp/Meta message
 */
async function determineStoreId(cleanPhone: string, message: string, toBotPhone?: string): Promise<string> {
  // HARDCODED UNIFIED STORE OVERRIDE
  // All messages and events will funnel to the single "default" session per the user's request
  return "default";
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
 * Saves customer data
 */
async function saveCustomerProfile(phone: string, data: any): Promise<void> {
  const cleanPhone = phone.replace('whatsapp:', '');
  await setDoc(doc(db, "customers", cleanPhone), data, { merge: true });
}

function calcularScore(analisisIA: any, datosAdicionales: any): number {
  let score = 0;
  if (typeof analisisIA.probabilidad_compra === 'number') {
    score += analisisIA.probabilidad_compra;
  }
  if (datosAdicionales.dio_direccion) score += 40;
  if (datosAdicionales.pregunto_precio) score += 10;
  if (datosAdicionales.pidio_envio) score += 30;
  return Math.min(score, 100);
}

async function definirEtapa(score: number): Promise<string> {
  if (score > 80) return "negociando";
  if (score > 50) return "interesado";
  return "nuevo";
}

async function cancelPendingFollowUps(phone: string, storeId: string = "default") {
  const cleanPhone = phone.replace('whatsapp:', '');
  const q = query(
    collection(db, "followups"),
    where("phone", "==", cleanPhone),
    where("storeId", "==", storeId),
    where("status", "==", "pending")
  );
  try {
    const snap = await getDocs(q);
    if (!snap.empty) {
      const batch = writeBatch(db);
      snap.docs.forEach(d => batch.update(d.ref, { status: "cancelled", updatedAt: serverTimestamp() }));
      await batch.commit();
      console.log(`[Follow-up] Cancelled ${snap.size} pending follow-ups for ${cleanPhone}`);
    }
  } catch (e) {
    console.warn("[Follow-up] Error cancelling:", e);
  }
}

// ── Cierre limpio de la conversacion por inactividad ────────────────────────
// Minutos sin que el cliente escriba antes de avisarle, y margen que se le da
// tras el aviso. Estan juntos para poder ajustarlos sin rastrear el archivo.
const INACTIVIDAD_AVISO_MIN = 20;
const INACTIVIDAD_CIERRE_MIN = 10;

// Cancela solo los cierres pendientes, sin tocar los seguimientos comerciales.
async function cancelInactivityClose(phone: string, storeId: string = "default") {
  const cleanPhone = phone.replace('whatsapp:', '');
  try {
    const snap = await getDocs(query(
      collection(db, "followups"),
      where("phone", "==", cleanPhone),
      where("storeId", "==", storeId),
      where("status", "==", "pending")
    ));
    const cierres = snap.docs.filter((d: any) => String(d.data()?.tipo || "").startsWith("cierre_"));
    if (cierres.length === 0) return;
    const batch = writeBatch(db);
    cierres.forEach((d: any) => batch.update(d.ref, { status: "cancelled", updatedAt: serverTimestamp() }));
    await batch.commit();
  } catch (e: any) {
    console.warn("[Cierre] No se pudieron cancelar cierres previos:", e?.message);
  }
}

// Programa el aviso (fase 'cierre_aviso') o la despedida (fase 'cierre_final').
// Se reprograma en cada mensaje del cliente, asi que solo se dispara cuando de
// verdad dejo de escribir.
async function scheduleInactivityClose(
  phone: string,
  storeId: string = "default",
  fase: "cierre_aviso" | "cierre_final" = "cierre_aviso"
) {
  const cleanPhone = phone.replace('whatsapp:', '');
  await cancelInactivityClose(phone, storeId);
  const minutos = fase === "cierre_aviso" ? INACTIVIDAD_AVISO_MIN : INACTIVIDAD_CIERRE_MIN;
  try {
    await addDoc(collection(db, "followups"), {
      phone: cleanPhone,
      storeId,
      tipo: fase,
      scheduledAt: new Date(Date.now() + minutos * 60 * 1000).toISOString(),
      status: "pending",
      reason: fase === "cierre_aviso" ? "Inactividad del cliente" : "Cierre tras aviso",
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
    console.log(`[Cierre] ${fase} programado para ${cleanPhone} en ${minutos} min`);
  } catch (e: any) {
    console.warn("[Cierre] No se pudo programar:", e?.message);
  }
}

async function scheduleFollowUp(phone: string, score: number, reason: string, storeId: string = "default") {
  const cleanPhone = phone.replace('whatsapp:', '');
  
  // Rule: Only one pending follow-up at a time
  await cancelPendingFollowUps(phone, storeId);

  let delayMs = 40 * 60 * 1000; // 40 mins
  if (score > 80) delayMs = 10 * 60 * 1000; // AGRESIVO: 10 mins
  else if (score > 50) delayMs = 20 * 60 * 1000; // AGRESIVO: 20 mins

  const scheduledAt = new Date(Date.now() + delayMs);
  
  try {
    await addDoc(collection(db, "followups"), {
      phone: cleanPhone,
      storeId: storeId,
      scheduledAt: scheduledAt.toISOString(),
      status: "pending",
      initialScore: score,
      reason,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
    console.log(`[Follow-up] Scheduled for ${cleanPhone} in ${delayMs / 60000} mins (Score: ${score})`);
  } catch (e) {
    console.error("[Follow-up] Error scheduling:", e);
  }
}

/**
 * Transcribe un audio de WhatsApp usando un modelo multimodal con soporte de
 * audio vía OpenRouter (NVIDIA NIM no expone modelos de audio en este stack).
 * Se intenta una pequeña cascada de modelos; si todos fallan, retorna null y
 * el llamador debe caer al mensaje honesto de "no pude escuchar el audio".
 *
 * NOTA IMPORTANTE PARA JOSÉ MARÍA: esto quedó implementado con la mejor
 * integración disponible (formato estándar OpenAI "input_audio"), pero no lo
 * pude probar contra la API real sin tus keys desplegadas en Railway. Twilio
 * manda el audio de WhatsApp como audio/ogg (codec opus). Si el modelo
 * rechaza el formato "ogg", prueba cambiando `audioFormat` abajo a "mp3" o
 * "wav" tras revisar qué acepta el modelo elegido, o dime y lo ajustamos
 * viendo el error real de los logs de Railway.
 */
async function transcribeAudioWithAI(base64Audio: string, mimeType: string): Promise<string | null> {
  if (!OPENROUTER_API_KEY && !process.env.OPENROUTER_API_KEY) {
    console.warn("[Audio Transcribe] No hay OPENROUTER_API_KEY configurada, no se puede transcribir.");
    return null;
  }

  let audioFormat = "ogg";
  if (mimeType.includes("mpeg") || mimeType.includes("mp3")) audioFormat = "mp3";
  else if (mimeType.includes("wav")) audioFormat = "wav";
  else if (mimeType.includes("ogg") || mimeType.includes("oga")) audioFormat = "ogg";

  const candidateModels = [
    "google/gemini-2.5-flash",
    "google/gemini-2.0-flash-001"
  ];

  for (const model of candidateModels) {
    try {
      const resp = await axios.post(
        "https://openrouter.ai/api/v1/chat/completions",
        {
          model,
          messages: [
            {
              role: "user",
              content: [
                { type: "text", text: "Transcribe exactamente lo que dice este audio en español. Responde SOLO con el texto transcrito, sin explicaciones ni comillas." },
                { type: "input_audio", input_audio: { data: base64Audio, format: audioFormat } }
              ]
            }
          ],
          max_tokens: 500,
          temperature: 0.1
        },
        {
          headers: {
            "Authorization": `Bearer ${OPENROUTER_API_KEY || process.env.OPENROUTER_API_KEY}`,
            "Content-Type": "application/json"
          },
          timeout: 20000
        }
      );
      const text = resp.data?.choices?.[0]?.message?.content;
      if (text && typeof text === "string" && text.trim().length > 0) {
        console.log(`[Audio Transcribe] Transcripción exitosa con ${model}`);
        return text.trim();
      }
    } catch (e: any) {
      console.warn(`[Audio Transcribe] Falló ${model}:`, e?.response?.data?.error?.message || e.message);
    }
  }
  return null;
}

/**
 * Cuando el cliente manda una foto de un producto, hacemos una llamada de
 * visión CORTA Y BARATA (un solo modelo, respuesta breve) solo para sacar
 * 3-6 palabras clave de lo que se ve (tipo de producto, color, características
 * visibles). Con esas palabras buscamos coincidencias REALES en el catálogo,
 * en vez de dejar que el modelo principal invente un producto/precio que no
 * existe. Si esto falla, simplemente no agrega contexto extra y el flujo
 * sigue normal (el modelo principal igual recibe la imagen).
 */
const imageKeywordCache = new Map<string, { keywords: string[]; time: number }>();

async function identifyProductKeywordsFromImage(imagePart: { data: string; mimeType: string }): Promise<string[]> {
  const apiKey = NVIDIA_API_KEY || process.env.NVIDIA_API_KEY;
  if (!apiKey) return [];

  // Cache por hash del contenido: si Twilio reintenta el webhook (timeouts,
  // reintentos de red) o el cliente reenvía la misma imagen, no pagamos la
  // llamada de visión dos veces.
  const cacheKey = crypto.createHash("md5").update(imagePart.data).digest("hex");
  const cached = imageKeywordCache.get(cacheKey);
  if (cached && Date.now() - cached.time < 10 * 60 * 1000) {
    console.log("[Image Product Match] Usando resultado en caché (misma imagen reciente)");
    return cached.keywords;
  }

  try {
    const resp = await axios.post(
      "https://integrate.api.nvidia.com/v1/chat/completions",
      {
        model: "meta/llama-3.2-11b-vision-instruct",
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: "Mira esta imagen de un producto. Responde SOLO con 3 a 6 palabras clave en español separadas por coma que describan qué tipo de producto es (categoría, uso, color si aplica). No agregues explicaciones ni frases completas. Ejemplo de respuesta válida: camisa, ropa, algodon, azul" },
              { type: "image_url", image_url: { url: `data:${imagePart.mimeType};base64,${imagePart.data}` } }
            ]
          }
        ],
        max_tokens: 60,
        temperature: 0.1
      },
      {
        headers: { "Authorization": `Bearer ${apiKey}`, "Content-Type": "application/json" },
        timeout: 15000
      }
    );
    const text = resp.data?.choices?.[0]?.message?.content || "";
    const stopWords = new Set(["para", "con", "del", "los", "las", "una", "unos", "unas", "uso", "que", "como", "esta", "esto", "este"]);
    const keywords = text
      .split(/[,;\n\s]+/)
      .map((k: string) => k.trim().toLowerCase().replace(/[^a-z0-9áéíóúñ]/g, ''))
      .filter((k: string) => k.length > 3 && !stopWords.has(k))
      .slice(0, 8);
    imageKeywordCache.set(cacheKey, { keywords, time: Date.now() });
    return keywords;
  } catch (e: any) {
    console.warn("[Image Product Match] No se pudo identificar el producto de la imagen:", e?.response?.data?.error?.message || e.message);
    return [];
  }
}

/**
 * Downloads media from Twilio for AI analysis (image vision / audio)
 */
async function downloadMediaAsBase64(url: string): Promise<{ data: string, mimeType: string } | null> {
  console.log(`[Media Download] Fetching: ${url}`);
  try {
    const response = await axios.get(url, {
      responseType: 'arraybuffer',
      auth: {
        username: process.env.SID_DE_CUENTA_TWILIO || process.env.TWILIO_ACCOUNT_SID || "",
        password: process.env.TOKEN_DE_AUTORIZACION_DE_TWILIO || process.env.TWILIO_AUTH_TOKEN || ""
      }
    });
    const mimeType = response.headers['content-type'] || 'image/jpeg';
    
    // Support images and audio
    if (!mimeType.startsWith('image/') && !mimeType.startsWith('audio/')) {
       console.log(`[Media Download] Skipping unsupported type: ${mimeType}`);
       return null;
    }
    
    // Twilio audio often comes as audio/ogg; codecs=opus, we need the base mime type
    const cleanMimeType = mimeType.split(';')[0].trim();
    
    const base64Data = Buffer.from(response.data, 'binary').toString('base64');
    return { data: base64Data, mimeType: cleanMimeType };
  } catch (err: any) {
    console.warn(`[Media Download][Error] From ${url}:`, err.message);
    return null;
  }
}

/**
 * Valida que un request al webhook realmente venga de Twilio (usando la firma
 * X-Twilio-Signature + tu Auth Token), y no de cualquiera que descubra la URL
 * y mande POSTs falsos simulando ser un cliente (gastando tus créditos de IA,
 * metiendo pedidos falsos, etc.)
 *
 * MODO SEGURO POR DEFECTO: por ahora esto solo AUDITA (loguea si la firma no
 * cuadra) pero NO BLOQUEA nada, para no arriesgarnos a tumbar el bot en
 * producción por un detalle de URL/dominio que no puedo verificar sin
 * desplegarlo. Revisa los logs de Railway por unos días buscando
 * "[Twilio Security] Firma inválida" — si NO aparece para tráfico real de
 * clientes, activa la variable de entorno STRICT_TWILIO_SIGNATURE_VALIDATION=true
 * en Railway para que empiece a BLOQUEAR (403) los requests falsos de verdad.
 */
function validateTwilioWebhookSignature(req: express.Request): boolean {
  if (!TWILIO_AUTH_TOKEN) {
    console.warn("[Twilio Security] TWILIO_AUTH_TOKEN no configurado, no se puede validar la firma del webhook.");
    return true;
  }
  const twilioSignature = req.headers["x-twilio-signature"] as string | undefined;
  if (!twilioSignature) {
    console.warn(`[Twilio Security] Request sin X-Twilio-Signature. IP: ${req.ip}`);
    return false;
  }
  try {
    const base = (currentAppUrl || process.env.APP_URL || `${req.protocol}://${req.headers.host}`).replace(/\/$/, "");
    const fullUrl = `${base}${req.originalUrl}`;
    const isValid = twilio.validateRequest(TWILIO_AUTH_TOKEN, twilioSignature, fullUrl, req.body || {});
    if (!isValid) {
      console.warn(`[Twilio Security] Firma inválida para ${fullUrl}. IP: ${req.ip}`);
    }
    return isValid;
  } catch (e: any) {
    console.warn("[Twilio Security] Error validando firma:", e.message);
    return false;
  }
}

const STRICT_TWILIO_SIGNATURE_VALIDATION = process.env.STRICT_TWILIO_SIGNATURE_VALIDATION === "true";
if (!STRICT_TWILIO_SIGNATURE_VALIDATION) {
  console.warn(
    "[Seguridad] ⚠️ STRICT_TWILIO_SIGNATURE_VALIDATION está apagado. El webhook de WhatsApp acepta " +
    "solicitudes sin firma válida de Twilio (solo se audita, no se bloquea). Actívalo con la variable " +
    "de entorno STRICT_TWILIO_SIGNATURE_VALIDATION=true cuando confirmes que las firmas se validan bien " +
    "en tus logs."
  );
}

// -------------------------------------------------------------
// 🔐 PROTECCIÓN DE /api/db/* — antes cualquiera podía leer, escribir o borrar
// CUALQUIER colección (pedidos, clientes, todo) sin login, pegándole directo a
// estas rutas. Solo dejamos público, de solo-lectura, lo que el storefront
// realmente necesita mostrar sin login: catálogo (products) y tiendas (stores).
// Todo lo demás (leer otras colecciones, o escribir/borrar CUALQUIER cosa)
// exige un token de sesión de admin válido.
// -------------------------------------------------------------
const PUBLIC_READ_COLLECTIONS = new Set(["products", "stores"]);
const ADMIN_SESSION_SECRET =
  process.env.ADMIN_SESSION_SECRET || SUPABASE_SERVICE_ROLE_KEY || process.env.TWILIO_AUTH_TOKEN || "";
const ADMIN_PHONE_SERVER = (process.env.ADMIN_PHONE || "+573133647176").replace(/\s+/g, "");
const ADMIN_PASSWORD_SERVER = process.env.ADMIN_PASSWORD || "";

if (IS_CLOUD_DB_MODE && !ADMIN_SESSION_SECRET) {
  console.warn(
    "[Seguridad] ⚠️ No hay ADMIN_SESSION_SECRET/SUPABASE_SERVICE_ROLE_KEY configurado. " +
    "Las rutas /api/db/* para colecciones privadas (orders, customers, etc.) quedarán " +
    "bloqueadas hasta que configures uno de los dos."
  );
}

function issueAdminSessionToken(phone: string): string {
  const expiresAt = Date.now() + 1000 * 60 * 60 * 12; // 12 horas
  const payload = `${phone}.${expiresAt}`;
  const sig = crypto.createHmac("sha256", ADMIN_SESSION_SECRET || "fallback-inseguro").update(payload).digest("hex");
  return Buffer.from(`${payload}.${sig}`).toString("base64url");
}

function verifyAdminSessionToken(token: string): boolean {
  if (!token || !ADMIN_SESSION_SECRET) return false;
  try {
    const decoded = Buffer.from(token, "base64url").toString("utf8");
    const parts = decoded.split(".");
    if (parts.length !== 3) return false;
    const [phone, expiresAtStr, sig] = parts;
    const expiresAt = Number(expiresAtStr);
    if (!expiresAt || Date.now() > expiresAt) return false;
    const payload = `${phone}.${expiresAtStr}`;
    const expectedSig = crypto.createHmac("sha256", ADMIN_SESSION_SECRET).update(payload).digest("hex");
    if (sig.length !== expectedSig.length) return false;
    if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expectedSig))) return false;
    return phone === ADMIN_PHONE_SERVER;
  } catch {
    return false;
  }
}

// En modo local emulado (sin Supabase real configurado) no hay datos de producción
// en riesgo — se mantiene el comportamiento abierto que ya usa el proyecto para
// desarrollo local (mismo criterio que el OTP fijo "123456" del modo emulado).
function isAdminRequestAuthorized(req: express.Request): boolean {
  if (!IS_CLOUD_DB_MODE) return true;
  const authHeader = String(req.headers["authorization"] || "");
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
  return verifyAdminSessionToken(token);
}

/**
 * Media (audio/imagen) por cliente: límite aparte del rate-limit general de
 * texto, porque transcribir audio y analizar imágenes cuesta más (llamadas
 * extra de IA). Evita que alguien queme presupuesto de OpenRouter/NVIDIA
 * mandando fotos o audios en bucle.
 */
const mediaRateLimitCache = new Map<string, { lastTime: number, count: number }>();
function canProcessMedia(userId: string): boolean {
  const now = Date.now();
  const record = mediaRateLimitCache.get(userId) || { lastTime: 0, count: 0 };
  if (now - record.lastTime > 15 * 60 * 1000) {
    record.count = 0;
  }
  record.count++;
  record.lastTime = now;
  mediaRateLimitCache.set(userId, record);
  // Límite: 8 audios/imágenes por cliente cada 15 minutos
  if (record.count > 8) {
    console.warn(`[ANTI-SPAM] ${userId} superó el límite de 8 audios/imágenes en 15 min. Bloqueando análisis de IA extra.`);
    return false;
  }
  return true;
}


function canReply(userId: string): boolean {
  const now = Date.now();
  const record = userRateLimitCache.get(userId) || { lastTime: 0, msgCount: 0 };
  
  // If last message was more than 10 minutes ago, reset count
  if (now - record.lastTime > 10 * 60 * 1000) {
    record.msgCount = 0;
  }
  
  if (now - record.lastTime < 3000) {
    record.lastTime = now;
    userRateLimitCache.set(userId, record);
    return false; // 3 seconds cooldown
  }
  
  record.msgCount++;
  record.lastTime = now;
  userRateLimitCache.set(userId, record);
  
  // Hard limit: 30 messages per 10 minutes (prevents bot loops)
  if (record.msgCount > 30) {
    console.warn(`[ANTI-BOT] Bloqueado ${userId} por más de 30 mensajes en 10 mins.`);
    return false;
  }

  return true;
}

/**
 * Seeding Function: Populates the products collection using Admin SDK to bypass rules
 */
async function seedDatabase(force = false, customCatalog?: any, storeId: string = "default") {
  const productsColl = collection(db, "products");
  
  if (!force) {
    const qCount = query(productsColl, where("storeId", "==", storeId), limit(1));
    const snapshot = await getDocs(qCount);
    if (!snapshot.empty) return;
  }

  console.log(`[DB] Iniciando reseteo de catálogo para store: ${storeId}...`);

  let catalogData: any = customCatalog;
  
  if (!catalogData) {
    const catalogPath = path.join(cwd, "src", "catalog.json");
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
      const qDelete = query(productsColl, where("storeId", "==", storeId));
      const snap = await getDocs(qDelete);
      if (!snap.empty) {
        console.log(`[DB] Clearing ${snap.size} old products before re-seeding para ${storeId}...`);
        const batch = writeBatch(db);
        snap.docs.forEach(d => batch.delete(d.ref));
        await batch.commit();
      }
    } catch (e: any) {
      console.error("[DB] Error cleaning catalog:", e.message);
    }
  }

  try {
    console.log(`[DB] Inserting ${catalogData.products.length} products para ${storeId}...`);
    const batch = writeBatch(db);
    for (const product of catalogData.products) {
      // Must generate unique id combining storeId and product id to avoid overwriting other stores
      const finalDocId = `${storeId}_${product.id}`;
      const docRef = doc(db, "products", finalDocId);
      batch.set(docRef, {
        ...product,
        storeId,
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
 * Tool & schema definitions (reference, ver src/lib/janAgent.ts)
 */
// Tools are imported from janAgent.ts

// Detecta respuestas afirmativas/negativas en texto libre (fallback por si el
// cliente escribe en vez de tocar el botón). Se usa para el atajo determinístico
// de "pendingImageOffer" y evita que la IA vuelva a preguntar lo mismo en loop.
function isAffirmativeText(text: string): boolean {
  const t = normalizeCatText(text).trim();
  return /^(si+|s|dale|claro|obvio|de una|listo|ok|okay|vale|me interesa|lo quiero|quiero eso|si porfa|si porfavor|si por favor|si señor|si señora)$/.test(t) ||
    /^(si|s[ií]),?\s/.test(t);
}
function isNegativeText(text: string): boolean {
  const t = normalizeCatText(text).trim();
  return /^(no+|no gracias|nel|no porfa|no por ahora|no por favor|nop)$/.test(t);
}

function getColombiaLocalTimeFormatted(): string {
  try {
    return new Intl.DateTimeFormat("es-CO", {
      timeZone: "America/Bogota",
      dateStyle: "full",
      timeStyle: "medium"
    }).format(new Date());
  } catch (e) {
    return new Date().toISOString();
  }
}

function getTimeGreeting(): string {
  try {
    const colTimeStr = new Intl.DateTimeFormat("en-US", {
      timeZone: "America/Bogota",
      hour: "numeric",
      hour12: false
    }).format(new Date());
    
    const hour = parseInt(colTimeStr, 10);
    if (hour >= 5 && hour < 12) {
      return "¡Buenos días! ☀️";
    } else if (hour >= 12 && hour < 18) {
      return "¡Buenas tardes! 🌤️";
    } else {
      return "¡Buenas noches! 🌙";
    }
  } catch (error) {
    const hour = (new Date().getUTCHours() - 5 + 24) % 24;
    if (hour >= 5 && hour < 12) {
      return "¡Buenos días! ☀️";
    } else if (hour >= 12 && hour < 18) {
      return "¡Buenas tardes! 🌤️";
    } else {
      return "¡Buenas noches! 🌙";
    }
  }
}

async function checkIsCustomerAiPaused(cleanFrom: string, storeId: string = "default"): Promise<{ isPaused: boolean; reason?: string; customerData?: any; convoData?: any }> {
  if (!cleanFrom) return { isPaused: false };
  const digitsOnly = cleanFrom.replace(/\D/g, "");
  const withoutCountry = digitsOnly.length > 10 && digitsOnly.startsWith("57") ? digitsOnly.slice(2) : digitsOnly;
  
  const phoneKeys = Array.from(new Set([
    cleanFrom,
    digitsOnly,
    `+${digitsOnly}`,
    withoutCountry,
    `+57${withoutCountry}`,
    `whatsapp:${cleanFrom}`,
    `whatsapp:+${digitsOnly}`
  ].filter(Boolean)));

  let customerData: any = null;
  let convoData: any = null;

  for (const key of phoneKeys) {
    try {
      const snap = await getDoc(doc(db, "conversations", key));
      if (snap.exists()) {
        const d = snap.data();
        if (d) {
          if (!convoData) convoData = d;
          if (d.aiPaused === true) {
            return { isPaused: true, reason: `conversations key=${key}`, convoData: d };
          }
        }
      }
    } catch (e) {}
  }

  const storesToCheck = Array.from(new Set([storeId, "default"].filter(Boolean)));
  for (const sId of storesToCheck) {
    for (const pKey of phoneKeys) {
      try {
        const custRefId = `${sId}_${pKey}`;
        const snap = await getDoc(doc(db, "customers", custRefId));
        if (snap.exists()) {
          const d = snap.data();
          if (d) {
            if (!customerData) customerData = d;
            // Solo la pausa MANUAL calla al bot. Antes tambien lo callaba la etapa
            // "asesoria_solicitada", lo que contradecia el diseño documentado dos
            // pasos mas abajo ("solo pausamos la IA cuando el asesor responda
            // manualmente por primera vez") y dejaba al cliente hablando solo: pedia
            // asesor de madrugada, nadie contestaba y el bot enmudecia. Encima volvia
            // inalcanzable el contexto de acompañamiento que ya existe (asesoriaContext).
            // Cuando el asesor toma el chat se marca aiPaused, y ahi si el bot calla.
            if (d.aiPaused === true) {
              return { isPaused: true, reason: `customers key=${custRefId}`, customerData: d };
            }
          }
        }
      } catch (e) {}
    }
  }

  return { isPaused: false, customerData, convoData };
}

async function setCustomerAiPauseState(cleanFrom: string, storeId: string = "default", pause: boolean): Promise<void> {
  if (!cleanFrom) return;
  const digitsOnly = cleanFrom.replace(/\D/g, "");
  const withoutCountry = digitsOnly.length > 10 && digitsOnly.startsWith("57") ? digitsOnly.slice(2) : digitsOnly;

  const phoneKeys = Array.from(new Set([
    cleanFrom,
    digitsOnly,
    `+${digitsOnly}`,
    withoutCountry,
    `+57${withoutCountry}`
  ].filter(Boolean)));

  for (const key of phoneKeys) {
    try {
      await setDoc(doc(db, "conversations", key), {
        aiPaused: !!pause,
        updatedAt: serverTimestamp()
      }, { merge: true });
    } catch (e) {}
  }

  const storesSnap = await getDocs(collection(db, "stores"));
  const storeIds = storesSnap.docs.map(d => d.id);
  if (!storeIds.includes("default")) storeIds.push("default");
  if (storeId && !storeIds.includes(storeId)) storeIds.push(storeId);

  for (const sId of storeIds) {
    for (const key of phoneKeys) {
      try {
        await setDoc(doc(db, "customers", customerDocId(sId, key)), {
          aiPaused: !!pause,
          ...(pause ? { etapa: "asesoria_solicitada" } : { etapa: "interesado" }),
          lastInteractionAt: serverTimestamp()
        }, { merge: true });
      } catch (e) {}
    }
  }
}

async function processInferenceOnServer(activityId: string, data: any) {
  try {
    await updateDoc(doc(db, "activities", activityId), { 
      status: "procesando",
      processingAt: serverTimestamp()
    });
    
    const assignedStoreId = data.storeId || "default";
    const fromPhone = data.from.replace("whatsapp:", "").trim();

    // STRICT CHECK: IF AI IS PAUSED OR HUMAN ADVISOR ACTIVE, DO NOT RUN INFERENCE OR SEND MESSAGES!
    const pauseCheck = await checkIsCustomerAiPaused(fromPhone, assignedStoreId);
    if (pauseCheck.isPaused) {
      console.log(`[Server AI] ⏸️ El bot está pausado para ${fromPhone} (razón: ${pauseCheck.reason}). Actuando solo como inbox.`);
      await updateDoc(doc(db, "activities", activityId), { 
        status: "respondido",
        response: "",
        senderType: "customer",
        customerPhone: fromPhone,
        processingAt: serverTimestamp(),
        errorAt: serverTimestamp()
      });
      return;
    }

    // Lookup Store Config
    let storeConfig: any = {};
    const storeSnap = await getDoc(doc(db, "stores", assignedStoreId));
    if (storeSnap.exists()) {
      storeConfig = storeSnap.data();
    }

    // ==============================================
    // 🎯 CONFIRMACIÓN DETERMINÍSTICA DE OFERTA MANUAL PENDIENTE
    // ==============================================
    // Si el asesor humano le ofreció al cliente un producto/precio (por fuera
    // del catálogo) y luego reactivó la IA, el cliente puede responder
    // afirmativamente HORAS después. En vez de confiar en que la IA entienda
    // bien el contexto, revisamos aquí mismo, de forma determinística y sin
    // margen de error, si hay una "pendingManualOffer" guardada y si el
    // mensaje del cliente suena a un "sí". Si es así, mandamos los botones de
    // confirmación exactos de una vez, sin pasar por el modelo de IA.
    try {
      const customerProfileIdForOffer = customerDocId(assignedStoreId, fromPhone);
      const custSnapForOffer = await getDoc(doc(db, "customers", customerProfileIdForOffer));
      const pendingOffer = custSnapForOffer.exists() ? custSnapForOffer.data()?.pendingManualOffer : null;

      if (pendingOffer && pendingOffer.producto && pendingOffer.valor) {
        const msgNorm = String(data.message || "").toLowerCase().trim();
        const affirmativePatterns = [
          "si", "sí", "sisas", "claro", "dale", "listo", "de una", "obvio",
          "me interesa", "quiero", "lo quiero", "confirmo", "va", "vale", "ok", "okay"
        ];
        const isShortAffirmative = msgNorm.length <= 40 && affirmativePatterns.some(p => msgNorm === p || msgNorm.startsWith(p + " ") || msgNorm.includes(" " + p));

        if (isShortAffirmative) {
          console.log(`[Oferta Pendiente] ${fromPhone} confirmó afirmativamente la oferta manual: ${pendingOffer.producto} @ ${pendingOffer.valor}. Enviando botones sin pasar por IA.`);

          const custData = custSnapForOffer.data() || {};
          const checkoutData = {
            producto: pendingOffer.producto,
            cantidad: pendingOffer.cantidad || 1,
            nombre: custData?.name || custData?.nombre || "",
            telefono: `whatsapp:${fromPhone}`,
            ciudad: custData?.city || custData?.ciudad || "",
            direccion: custData?.address || custData?.direccion || "",
            referencia: custData?.addressIndicator || "N/A",
            valor: Number(pendingOffer.valor),
            notas: "Producto ofrecido manualmente por asesor, confirmado por el cliente tras reanudar la IA."
          };

          await sendCheckoutSummaryAndButtons(
            `whatsapp:${fromPhone}`,
            TWILIO_FROM_NUMBER || "+14155238886",
            customerProfileIdForOffer,
            checkoutData,
            undefined,
            assignedStoreId
          );

          // Limpiamos la oferta pendiente para que no se vuelva a disparar
          await setDoc(doc(db, "customers", customerProfileIdForOffer), { pendingManualOffer: null }, { merge: true });

          await updateDoc(doc(db, "activities", activityId), {
            status: "respondido",
            response: "[Confirmación automática de oferta manual enviada]",
            senderType: "bot",
            processingAt: serverTimestamp()
          });
          return;
        }
      }
    } catch (offerErr: any) {
      console.error("[Oferta Pendiente] Error revisando oferta manual pendiente:", offerErr.message);
      // Si esto falla, seguimos con el flujo normal de IA sin bloquear al cliente.
    }

    // Al menos una clave de IA (NVIDIA u OpenRouter) debe existir, ya sea global (env) o por tienda
    const hasNvidiaKey = !!(NVIDIA_API_KEY || storeConfig.nvidiaApiKey);
    const hasOpenrouterKey = !!(OPENROUTER_API_KEY || storeConfig.openrouterApiKey);
    if (!hasNvidiaKey && !hasOpenrouterKey) {
      console.error("[Server AI] Faltan claves de IA (NVIDIA_API_KEY / OPENROUTER_API_KEY) en el servidor.");
      await updateDoc(doc(db, "activities", activityId), { status: "error", response: "Error: No hay clave de IA (NVIDIA/OpenRouter) configurada en Railway." });
      return;
    }

    // SAFETY: Truncate message if it's too long to prevent crashes
    let safeMessage = data.message || "";
    if (safeMessage.length > 10000) {
      console.warn(`[Server AI] Mensaje recibido de ${fromPhone} es demasiado largo (${safeMessage.length} chars). Recortando...`);
      safeMessage = safeMessage.substring(0, 10000) + "\n...[CONTENIDO RECORTADO POR EXCESO DE TAMAÑO]";
    }

    // Unique customer profile per store to prevent mixing CRM states
    const customerProfileId = customerDocId(assignedStoreId, fromPhone);
    const cxSnap = await getDoc(doc(db, "customers", customerProfileId));
    const customerProfile = cxSnap.exists() ? cxSnap.data() : null;

    // ==============================================
    // 🔘 ATAJO DETERMINÍSTICO: respuesta a oferta de producto por imagen
    // ==============================================
    // Si el turno anterior identificamos un producto por FOTO y le mandamos
    // botones (pendingImageOffer), y el cliente responde por TEXTO en vez de
    // tocar el botón (ej. escribe "SI"), resolvemos acá mismo sin volver a
    // pasar por la IA. Esto es lo que eliminaba el loop de "¿te interesa?".
    const hasNewImageThisTurn = Array.isArray(data.mediaItems) && data.mediaItems.some((it: any) => it.mimeType?.startsWith("image/"));
    if (!hasNewImageThisTurn && customerProfile?.pendingImageOffer?.producto) {
      const rawText = (data.message || "").trim();
      if (isAffirmativeText(rawText)) {
        console.log(`[Server AI] Cliente confirmó por texto el producto identificado por imagen (${customerProfile.pendingImageOffer.producto}). Pasando directo a checkout...`);
        const cleanFrom = data.from.replace("whatsapp:", "").trim();
        await updateDoc(doc(db, "customers", customerProfileId), { pendingImageOffer: null });
        await startCheckoutFlow(data.from, cleanFrom, data.to, assignedStoreId, customerProfile.pendingImageOffer.producto);
        await updateDoc(doc(db, "activities", activityId), {
          status: "respondido",
          response: "[Checkout iniciado desde oferta por imagen confirmada por texto]",
          respondedAt: serverTimestamp()
        });
        return;
      } else if (isNegativeText(rawText)) {
        console.log(`[Server AI] Cliente rechazó por texto el producto identificado por imagen.`);
        await updateDoc(doc(db, "customers", customerProfileId), { pendingImageOffer: null });
        await sendWhatsApp(data.from, "Tranqui 🙂 ¿Buscas algo más o te muestro otras opciones?", undefined, activityId, data.to);
        await updateDoc(doc(db, "activities", activityId), {
          status: "respondido",
          response: "[Oferta por imagen descartada]",
          respondedAt: serverTimestamp()
        });
        return;
      }
      // Si no fue ni sí ni no claro, dejamos que siga el flujo normal (la IA
      // responderá con el contexto de la foto ya identificada previamente).
    }

    const history = await getCrmContext(data.from, assignedStoreId);
    
    // Get products specific to this store, or fallback to default
    let products: any[] = await loadProductsForStore(assignedStoreId);

    // Separar imágenes (sí soportadas por los modelos de visión de NVIDIA/OpenRouter)
    // de audio (NINGÚN modelo de la cascada actual puede transcribir audio de forma nativa
    // sin Gemini; antes se le pasaba el audio como si fuera comprendido y el LLM alucinaba
    // una respuesta genérica. Ahora avisamos honestamente al cliente).
    const imageParts: { data: string; mimeType: string }[] = [];
    let hasAudio = false;
    if (data.mediaItems && Array.isArray(data.mediaItems)) {
      for (const item of data.mediaItems) {
        if (item.mimeType && item.mimeType.startsWith("audio/")) {
          hasAudio = true;
        } else if (item.mimeType && item.mimeType.startsWith("image/")) {
          imageParts.push({ data: item.data, mimeType: item.mimeType });
        }
      }
    }

    // Antes: si el cliente mandaba SOLO audio, respondíamos de una que no
    // podíamos escucharlo (para no gastar tiempo/costo en una cascada que
    // igual iba a alucinar). Ahora intentamos transcribirlo de verdad con un
    // modelo de audio (ver `transcribeAudioWithAI`) y solo si eso falla,
    // avisamos honestamente al cliente.
    if (hasAudio && imageParts.length === 0 && (!safeMessage || !safeMessage.trim())) {
      const audioItem = data.mediaItems.find((it: any) => it.mimeType?.startsWith("audio/"));

      if (audioItem && !canProcessMedia(fromPhone)) {
        const rateLimitMsg = "¡Uy! Me has mandado varios audios seguidos y necesito un momentico para ponerme al día 😅. ¿Me das un par de minutos o me escribes directamente?";
        if (data.from.startsWith("whatsapp:")) {
          await sendWhatsApp(data.from, rateLimitMsg, undefined, activityId, data.to);
        } else if (data.platform === "instagram" || data.platform === "messenger") {
          await sendMetaMessage(data.from, rateLimitMsg, data.platform, data.to);
        }
        await updateDoc(doc(db, "activities", activityId), {
          status: "respondido",
          response: rateLimitMsg,
          respondedAt: serverTimestamp()
        });
        return;
      }

      const transcript = audioItem ? await transcribeAudioWithAI(audioItem.data, audioItem.mimeType) : null;

      if (transcript) {
        console.log(`[Server AI] Audio transcrito de ${fromPhone}: "${transcript}"`);
        safeMessage = transcript;
        // Sigue el flujo normal más abajo usando este texto transcrito como si
        // el cliente lo hubiera escrito.
      } else {
        const audioFallbackMsg = "¡Hola! Qué pena, no logré entender bien tu audio 🙉. ¿Me lo escribís por acá porfa? ¡Quedo pendiente!";
        if (data.from.startsWith("whatsapp:")) {
          await sendWhatsApp(data.from, audioFallbackMsg, undefined, activityId, data.to);
        } else if (data.platform === "instagram" || data.platform === "messenger") {
          await sendMetaMessage(data.from, audioFallbackMsg, data.platform, data.to);
        }
        await updateDoc(doc(db, "activities", activityId), {
          status: "respondido",
          response: audioFallbackMsg,
          respondedAt: serverTimestamp()
        });
        return;
      }
    }

    // Hybrid Smart Context Filter: Select only Top 15 featured products and those matching user keywords
    // to prevent prompt truncation issues and speed up inference significantly!
    let filteredProductsForPrompt: any[] = [];

    // Si mandó una imagen, identificamos palabras clave del producto ANTES de
    // armar el contexto, para que los productos reales que coinciden con la
    // foto queden garantizados dentro del inventario que ve la IA (y no se
    // pierdan en el recorte de 360+ productos).
    let imageMatchedProducts: any[] = [];
    let imageKeywords: string[] = [];
    if (imageParts.length > 0 && canProcessMedia(fromPhone)) {
      imageKeywords = await identifyProductKeywordsFromImage(imageParts[0]);
      if (imageKeywords.length > 0) {
        const scoredProducts = products.map(p => {
          const nameLower = (p.name || "").toLowerCase();
          const catLower = (p.category || "").toLowerCase();
          let score = 0;
          for (const k of imageKeywords) {
            if (nameLower.includes(k)) score += 2;
            else if (catLower.includes(k)) score += 1;
          }
          return { product: p, score };
        }).filter(item => item.score > 0)
          .sort((a, b) => b.score - a.score);
        
        imageMatchedProducts = scoredProducts.slice(0, 5).map(item => item.product);
        console.log(`[Image Product Match] Palabras clave detectadas: ${imageKeywords.join(", ")} | Coincidencias en catálogo: ${imageMatchedProducts.length}`);
      }
    }

    const topKeywords = [
      "modem", "retrovisor", "intercomunicador", "soporte de carga", "funda", 
      "destornillador", "frontal", "linterna", "camping", "ever brite", 
      "candado", "compresor", "hidrolavadora", "aspiradora", "cargador"
    ];
    
    const topProducts = products.filter(p => {
      const nameLower = (p.name || "").toLowerCase();
      return topKeywords.some(keyword => nameLower.includes(keyword));
    }).slice(0, 15);
    
    if (topProducts.length < 15) {
      const remaining = products.filter(p => !topProducts.some(tp => tp.id === p.id));
      topProducts.push(...remaining.slice(0, 15 - topProducts.length));
    }
    
    const msgWords = safeMessage.toLowerCase().split(/\s+/).filter(w => w.length > 3);
    const matchedProducts = products.filter(p => {
      const nameLower = (p.name || "").toLowerCase();
      return msgWords.some(word => nameLower.includes(word));
    }).slice(0, 10);
    
    const combinedSet = new Map<string, any>();
    topProducts.forEach(p => combinedSet.set(p.id, p));
    matchedProducts.forEach(p => combinedSet.set(p.id, p));
    imageMatchedProducts.forEach(p => combinedSet.set(p.id, p));

    // "Vendedor experto": el bot conoce qué productos vienen del mismo lote/proveedor
    // real (dato interno, NUNCA se muestra al cliente) y los usa para sugerir
    // complementos que aumenten el ticket. Priorizamos mismo proveedor + misma
    // categoría (más relevante para el cliente); si no hay suficientes, completamos
    // con mismo proveedor aunque cambie la categoría. Esto es solo señal interna
    // para la IA — el prompt le prohíbe explícitamente nombrar proveedores.
    const anchorProducts = Array.from(combinedSet.values()).filter(p => p.provider);
    const upsellProducts: any[] = [];
    if (anchorProducts.length > 0) {
      const anchorIds = new Set(anchorProducts.map(p => p.id));
      const seenUpsell = new Set<string>();
      for (const anchor of anchorProducts) {
        if (upsellProducts.length >= 6) break;
        const sameProviderSameCategory = products.filter(p =>
          p.provider && p.provider === anchor.provider &&
          p.category === anchor.category &&
          !anchorIds.has(p.id) && !seenUpsell.has(p.id)
        ).slice(0, 2);
        const sameProviderOnly = sameProviderSameCategory.length < 2
          ? products.filter(p =>
              p.provider && p.provider === anchor.provider &&
              !anchorIds.has(p.id) && !seenUpsell.has(p.id) &&
              !sameProviderSameCategory.some(sp => sp.id === p.id)
            ).slice(0, 2 - sameProviderSameCategory.length)
          : [];
        for (const p of [...sameProviderSameCategory, ...sameProviderOnly]) {
          if (upsellProducts.length >= 6) break;
          seenUpsell.add(p.id);
          upsellProducts.push(p);
        }
      }
    }
    upsellProducts.forEach(p => combinedSet.set(p.id, p));

    filteredProductsForPrompt = Array.from(combinedSet.values());
    
    const compactProductsString = filteredProductsForPrompt.map(p => {
      // 🔧 FIX: antes la descripción SIEMPRE se cortaba a 80 caracteres, así
      // que cuando el cliente preguntaba "más características" sobre un
      // producto puntual, la IA no tenía info real para responder y
      // terminaba repitiendo un relleno genérico. Ahora, para el producto
      // específico que coincide con lo que el cliente está preguntando (o ya
      // tiene en el carrito), le damos la descripción COMPLETA.
      const isRelevantProduct = matchedProducts.some(mp => mp.id === p.id) || topProducts.some(tp => tp.id === p.id);
      const desc = p.description
        ? (isRelevantProduct || p.description.length <= 80 ? p.description : p.description.substring(0, 80) + "...")
        : "";
      const isImageMatch = imageMatchedProducts.some(imp => imp.id === p.id);
      const isUpsell = !isImageMatch && upsellProducts.some(up => up.id === p.id) && !matchedProducts.some(mp => mp.id === p.id) && !topProducts.some(tp => tp.id === p.id);
      return `- ${p.name} ($${p.price}) [id: ${p.id}]${p.category ? ` [Cat: ${p.category}]` : ""}${desc ? ` - ${desc}` : ""}${isImageMatch ? " ⭐ COINCIDE CON LA FOTO QUE ENVIÓ EL CLIENTE" : ""}${isUpsell ? " 🔁 COMPLEMENTO SUGERIDO (mismo lote de despacho — bueno para ofrecer junto al producto principal)" : ""}`;
    }).join("\n");

    const checkoutContext = customerProfile?.checkoutStep 
      ? `\nPASO DE CHECKOUT DETERMINÍSTICO ACTIVO EN CURSO: "${customerProfile.checkoutStep}"
DATOS DEL PEDIDO CAPTURADOS HASTA EL MOMENTO EN ESTE CHECKOUT: ${JSON.stringify(customerProfile.checkoutData || {})}
REGLA DE CONTEXTO DE CHECKOUT: Si el cliente está enviando un mensaje libre, foto o audio que cambia, corrige o complementa estos datos, utiliza esta información para actualizar el pedido en "datos_pedido" y proponer "accion": "confirmar_pedido" (si ya tienes todo corregido y completo) o "accion": "iniciar_checkout" (para arrancar un flujo nuevo con el producto corregido/correcto si cambió de opinión).`
      : "";

    const isAwaitingHuman = customerProfile?.etapa === "asesoria_solicitada";
    const asesoriaContext = isAwaitingHuman
      ? `\n📌 ATENCION PERSONALIZADA (el cliente pidio hablar con un asesor):\nA partir de aqui TU ERES el asesor. No estas haciendo tiempo ni cubriendo a nadie:\natiendes tu, de principio a fin, como lo haria el dueño de la tienda.\nREGLAS:\n1. NUNCA digas que lo transferiste, que un asesor va a entrar, que esta en cola ni\n   que espere a alguien. Nadie mas va a entrar. Prometer eso y no cumplirlo es la\n   forma mas rapida de perder al cliente.\n2. Respondele lo que sea que pregunte, con calma y en frases cortas, como escribe\n   una persona por WhatsApp. Nada de parrafos largos ni lenguaje de robot.\n3. Si es algo del catalogo, precios, envios, garantia o su pedido: resuelvelo tu,\n   tienes toda la informacion.\n4. Si de verdad es algo que no puedes resolver (un reclamo serio, un problema con\n   una entrega ya hecha, algo delicado), recien ahi di que lo vas a consultar con\n   el equipo y usa accion = "notificar_admin". Solo en ese caso.\n5. Manten viva la conversacion y no la dejes en silencio nunca.`
      : "";

    const colombianTimeStr = getColombiaLocalTimeFormatted();

    const promptText = `ESTÁS ATENDIENDO EN LA TIENDA: ${storeConfig.name || "Jan Sel Shop"} (Slug: ${assignedStoreId})
CLIENTE: ${fromPhone}
NOMBRE: ${customerProfile?.name || "Desconocido"}
HORA LOCAL EN COLOMBIA: ${colombianTimeStr}
ETAPA CRM: ${customerProfile?.etapa || "nuevo"} (Probabilidad de compra: ${customerProfile?.score || 0}%)
INTENCIÓN ANTERIOR: ${customerProfile?.intencion || "Ninguna"}${checkoutContext}${asesoriaContext}
HISTORIAL:
${history}

MENSAJE ACTUAL: ${safeMessage}${imageParts.length > 0 ? ` (El cliente también envió una imagen que adjunto para tu análisis.${imageMatchedProducts.length > 0 ? ` Ya identificamos posibles coincidencias reales en el inventario, marcadas abajo con ⭐ — si la foto se parece a alguno de esos, ofrécelo con seguridad usando su nombre y precio EXACTOS del inventario, no inventes uno nuevo.` : ` No encontramos una coincidencia exacta en el inventario para esta foto — descríbele lo que ves y pregúntale qué necesita para poder ayudarlo mejor, sin inventar un producto que no existe.`}` : ""}

INVENTARIO ACTUAL (Vista curada de los más vendidos y productos relevantes para esta consulta. Este es TODO el catalogo disponible; si piden algo que no esta aqui NO lo inventes, usa "notificar_admin"):
${compactProductsString}

🧠 ROL DE VENDEDOR EXPERTO (aumento de ticket):
Eres un vendedor que conoce perfectamente TODO el catálogo y sabe qué productos combinan bien entre sí.
- Los productos marcados "🔁 COMPLEMENTO SUGERIDO" están relacionados con lo que el cliente ya está viendo — son buenos candidatos para ofrecer como combo o adicional, cuando encaje de forma natural en la conversación (no en cada mensaje, no si el cliente ya está fastidiado o solo quiere pagar).
- Preséntalos siempre como parte de NUESTRO propio catálogo ("también tenemos...", "te consigue muy bien con..."), nunca como si vinieran de otro lado.
- PROHIBIDO ABSOLUTO: nunca menciones la palabra "proveedor", "distribuidor", "lote", "Dropi", ni ningún nombre de proveedor real al cliente, bajo ninguna circunstancia. Esa información es 100% interna.
- Si el cliente ya decidió comprar y está en checkout, no lo interrumpas con ofertas adicionales salvo que sea un anexo muy rápido y de bajo esfuerzo (ej. "¿le agrego también el cargador por $X?").

⚠️ REGLA DE SALIDA ULTRA-ESTRICTA (OBLIGATORIA):
DEBES RESPONDER EXCLUSIVAMENTE CON UN OBJETO JSON VÁLIDO.
NO incluyas explicaciones antes o después del JSON. NO uses formato markdown fuera del JSON.
El JSON debe cumplir ESTRICTAMENTE con la siguiente estructura de campos (no inventes otras llaves):

{
  "accion": "respuesta" | "notificar_admin" | "confirmar_pedido" | "iniciar_checkout",
  "explicacion_accion": "Usa 'iniciar_checkout' SI el cliente acaba de decir que SÍ quiere comprar o llevar el producto pero NO tienes sus datos de envío. Usa 'confirmar_pedido' SOLO si YA tienes todos sus datos (nombre, dirección, etc.).",
  "mensaje": "Mensaje en español (tono cercano de vendedor colombiano real, natural y variado — evita sonar repetitivo o de guion. Breve y persuasivo, máximo 1-2 párrafos cortos, con emojis con moderación, no en cada frase)",
  "producto": "Nombre del producto interesado si aplica (usa el nombre EXACTO del inventario, nunca inventado)",
  "intencion": "intención detectada",
  "nivel_interes": "alto" | "medio" | "bajo",
  "objeciones": "objeciones o 'ninguna'",
  "urgencia": "nivel de urgencia",
  "probabilidad_compra": 0, // Número entero de 0 a 100
  "siguiente_mejor_accion": "próxima acción",
  "datos_pedido": {
    "nombre": "Nombre completo del cliente",
    "direccion": "Dirección exacta de entrega",
    "telefono": "Teléfono de contacto",
    "ciudad": "Ciudad de Colombia",
    "referencia": "Punto de referencia o descripción de la casa",
    "valor": 0, // Precio/valor acordado como número entero
    "cantidad": 1, // Cantidad de unidades pedidas (número entero, por defecto 1 si el cliente no especifica)
    "notes": "Notas adicionales"
  },
  "imageUrl": "URL pública de imagen del producto si aplica (SOLO devuélvela si el cliente pide una foto explícitamente, o si es la PRIMERA VEZ que le ofreces este producto. NUNCA la devuelvas si él fue quien te envió la foto a ti)"
}

Asegúrate de que la propiedad "mensaje" contenga tu respuesta real dirigida al cliente.`;

    let result: any = null;

    // Cascada de modelos NVIDIA NIM (free endpoints, confirmados por el catálogo real
    // de build.nvidia.com que compartiste) + OpenRouter como respaldo final.
    // Orden: primero los modelos livianos/rápidos (mejor para latencia en el caso normal),
    // y al final los "tanque" (más grandes/lentos pero más capaces) por si los de arriba fallan.
    // Un solo intento por modelo (no reintentos) para no acumular tiempos muertos.
    const visionModels: Array<{ name: string; label: string; provider: string }> = [
      { name: "meta/llama-3.2-11b-vision-instruct", provider: "nvidia", label: "NVIDIA Llama 3.2 11B Vision" },
      { name: "meta/llama-3.2-90b-vision-instruct", provider: "nvidia", label: "NVIDIA Llama 3.2 90B Vision" },
      { name: "nvidia/llama-3.1-nemotron-nano-vl-8b-v1", provider: "nvidia", label: "NVIDIA Nemotron Nano VL 8B" },
      { name: "nvidia/nemotron-nano-12b-v2-vl", provider: "nvidia", label: "NVIDIA Nemotron Nano 12B VL" },
    ];
    const textModels: Array<{ name: string; label: string; provider: string }> = [
      // Rápidos / livianos primero
      { name: "meta/llama-3.1-8b-instruct", provider: "nvidia", label: "NVIDIA Llama 3.1 8B" },
      { name: "nvidia/llama-3.1-nemotron-nano-8b-v1", provider: "nvidia", label: "NVIDIA Nemotron Nano 8B" },
      { name: "nvidia/nvidia-nemotron-nano-9b-v2", provider: "nvidia", label: "NVIDIA Nemotron Nano 9B v2" },
      { name: "google/gemma-2-2b-it", provider: "nvidia", label: "NVIDIA Gemma 2 2B" },
      { name: "mistralai/mixtral-8x7b-instruct-v0.1", provider: "nvidia", label: "NVIDIA Mixtral 8x7B" },
      { name: "microsoft/phi-4-mini-instruct", provider: "nvidia", label: "NVIDIA Phi-4 Mini" },
      { name: "upstage/solar-10.7b-instruct", provider: "nvidia", label: "NVIDIA Solar 10.7B" },
      // Medianos, buena calidad
      { name: "meta/llama-3.3-70b-instruct", provider: "nvidia", label: "NVIDIA Llama 3.3 70B" },
      { name: "google/gemma-4-31b-it", provider: "nvidia", label: "NVIDIA Gemma 4 31B" },
      { name: "nvidia/llama-3.3-nemotron-super-49b-v1.5", provider: "nvidia", label: "NVIDIA Nemotron Super 49B v1.5" },
      { name: "mistralai/mistral-medium-3.5-128b", provider: "nvidia", label: "NVIDIA Mistral Medium 3.5" },
      { name: "deepseek-ai/deepseek-v4-flash", provider: "nvidia", label: "NVIDIA DeepSeek V4 Flash" },
      { name: "qwen/qwen3.5-122b-a10b", provider: "nvidia", label: "NVIDIA Qwen 3.5 122B" },
      // Pesados / último recurso
      { name: "mistralai/mistral-large-3-675b-instruct-2512", provider: "nvidia", label: "NVIDIA Mistral Large 3" },
      { name: "deepseek-ai/deepseek-v4-pro", provider: "nvidia", label: "NVIDIA DeepSeek V4 Pro" },
      { name: "qwen/qwen3.5-397b-a17b", provider: "nvidia", label: "NVIDIA Qwen 3.5 397B" },
      // Respaldo final vía OpenRouter, por si NVIDIA falla por completo (caída del servicio, etc.)
      { name: "meta-llama/llama-3.3-70b-instruct", provider: "openrouter", label: "OpenRouter Llama 3.3 70B" },
      { name: "openai/gpt-4o-mini", provider: "openrouter", label: "OpenRouter GPT-4o-Mini" }
    ];
    const modelsCascade: Array<{ name: string; label: string; provider: string }> =
      imageParts.length > 0 ? [...visionModels, ...textModels] : textModels;

    // Construye el "content" del mensaje de usuario en formato compatible OpenAI.
    // Para modelos de visión metemos las imágenes como image_url (base64 data URI).
    // NOTA: Meta exige que con imágenes NO se use mensaje "system" aparte, así que
    // en ese caso el system prompt se antepone dentro del propio mensaje de usuario.
    // Se le pasa el catalogo real que acabamos de leer de la base, para que la
    // lista de productos del prompt no pueda quedar desfasada del inventario.
    const systemInst = getSystemInstruction({
      ...storeConfig,
      storeUrl: currentAppUrl || process.env.APP_URL || "https://jansel-shop.com"
    }, products);
    const buildMessages = (isVision: boolean) => {
      if (isVision && imageParts.length > 0) {
        const userContent: any[] = [
          { type: "text", text: `${systemInst}\n\n---\n\n${promptText}` }
        ];
        // Solo se soporta 1 imagen por request en los modelos de visión de NVIDIA
        const img = imageParts[0];
        userContent.push({
          type: "image_url",
          image_url: { url: `data:${img.mimeType};base64,${img.data}` }
        });
        return [{ role: "user", content: userContent }];
      }
      return [
        { role: "system", content: systemInst },
        { role: "user", content: promptText }
      ];
    };

    let lastError: any = null;
    const timeoutMs = 7000; // subido un poco de 5000 a 7000: el free-tier de NVIDIA a veces
    // tarda más por congestión, y 5s estaba generando timeouts incluso en modelos chiquitos.

    // Helper: intenta un modelo puntual, retorna { text, modelObj } o lanza error.
    async function callModel(modelObj: { name: string; label: string; provider: string }) {
      const isVisionModel = visionModels.some(v => v.name === modelObj.name);
      const apiUrl = modelObj.provider === "nvidia"
        ? "https://integrate.api.nvidia.com/v1/chat/completions"
        : "https://openrouter.ai/api/v1/chat/completions";

      const apiKey = modelObj.provider === "nvidia"
        ? (process.env.NVIDIA_API_KEY || storeConfig.nvidiaApiKey)
        : (process.env.OPENROUTER_API_KEY || storeConfig.openrouterApiKey);

      if (!apiKey) {
        throw new Error(`${modelObj.provider === "nvidia" ? "NVIDIA_API_KEY" : "OPENROUTER_API_KEY"} no está configurada.`);
      }

      console.log(`[Server AI] Intentando modelo: ${modelObj.name} (${modelObj.provider}) para ${fromPhone} con timeout de ${timeoutMs}ms...`);

      const response = await axios.post(
        apiUrl,
        {
          model: modelObj.name,
          messages: buildMessages(isVisionModel),
          temperature: 0.2,
          max_tokens: 1024,
          top_p: 0.7,
          response_format: { type: "json_object" }
        },
        {
          headers: {
            "Authorization": `Bearer ${apiKey}`,
            "Content-Type": "application/json"
          },
          timeout: timeoutMs
        }
      );

      let text = response.data?.choices?.[0]?.message?.content || "";
      if (text.includes("```json")) {
        text = text.split("```json")[1].split("```")[0].trim();
      } else if (text.includes("```")) {
        text = text.split("```")[1].split("```")[0].trim();
      }

      if (!text) {
        throw new Error(`La respuesta de ${modelObj.provider} no devolvió contenido de texto válido.`);
      }

      // CRÍTICO: algunos modelos (ej. NVIDIA meta/llama-3.1-8b-instruct) ignoran
      // el response_format:"json_object" y devuelven prosa/markdown en vez de
      // JSON. Antes esto se aceptaba como "éxito" (solo se validaba que no
      // viniera vacío) y el texto de prosa terminaba rompiendo el JSON.parse
      // más abajo, cayendo al mensaje genérico de "me enredé". Ahora validamos
      // el JSON AQUÍ MISMO: si no parsea, lo tratamos como fallo de este
      // modelo para que la cascada siga probando el siguiente.
      try {
        JSON.parse(text);
      } catch {
        throw new Error(`El modelo ${modelObj.name} devolvió texto que no es JSON válido (probablemente prosa/markdown).`);
      }

      console.log(`[Server AI] [${modelObj.provider.toUpperCase()}] Éxito con el modelo ${modelObj.name}`);
      return { text, modelObj };
    }

    // FASE 1: carrera en paralelo entre los primeros N modelos (los más livianos/rápidos).
    // Esto evita el problema que viste en los logs: 5-7 modelos en fila haciendo timeout
    // uno detrás del otro (80+ segundos). Con la carrera, si 2-3 modelos livianos están
    // lentos/caídos al mismo tiempo, no importa: apenas UNO responda, seguimos.
    const RACE_SIZE = Math.min(4, modelsCascade.length);
    const raceGroup = modelsCascade.slice(0, RACE_SIZE);
    const sequentialRest = modelsCascade.slice(RACE_SIZE);

    try {
      const winner = await Promise.any(raceGroup.map(m => callModel(m)));
      result = { text: winner.text };
    } catch (aggErr: any) {
      // Todos los de la carrera fallaron: seguimos con el resto de la cascada, uno por uno.
      lastError = aggErr?.errors?.[aggErr.errors.length - 1] || aggErr;
      console.warn(`[Server AI] Los ${RACE_SIZE} modelos en carrera fallaron. Pasando a la cascada secuencial de respaldo (${sequentialRest.length} modelos restantes)...`);

      for (const modelObj of sequentialRest) {
        try {
          const r = await callModel(modelObj);
          result = { text: r.text };
          break;
        } catch (err: any) {
          lastError = err;
          console.warn(`[Server AI] Falló modelo ${modelObj.name}: ${err instanceof Error ? err.message : String(err)}`);
        }
      }
    }

    if (!result || !result.text) {
      console.error("[Server AI] Todos los modelos de la cascada fallaron o no devolvieron texto.");
      // No dejamos al cliente sin respuesta: le avisamos que hubo un problema técnico
      // en vez de solo loguear el error en el dashboard (antes se quedaba sin nada).
      const outageMsg = "¡Uy, disculpá! Tuve un problema técnico procesando tu mensaje 😅. Ya le avisé a mi equipo, en un momento te escriben o intentá de nuevo en unos minutos.";
      try {
        if (data.from.startsWith("whatsapp:")) {
          await sendWhatsApp(data.from, outageMsg, undefined, activityId, data.to);
        } else if (data.platform === "instagram" || data.platform === "messenger") {
          await sendMetaMessage(data.from, outageMsg, data.platform, data.to);
        }
      } catch (sendErr) {
        console.error("[Server AI] Ni siquiera se pudo enviar el mensaje de outage:", sendErr);
      }
      throw new Error(`Todos los modelos fallaron. Último error: ${lastError?.message || lastError}`);
    }

    if (!result.text) throw new Error("La IA no devolvió texto.");
    let jsonResponse;
    const safeFallbackResponse = {
      accion: "respuesta",
      mensaje: "Hola, me enredé un poquito procesando eso. ¿Me repites porfa en un mensaje más cortico?",
      intencion: "error",
      nivel_interes: "bajo"
    };
    try {
      jsonResponse = JSON.parse(result.text);
    } catch (parseErr: any) {
      console.error(`[Server AI] Error parseando JSON de la IA. Longitud del texto: ${result.text.length}`);
      if (result.text.length > 500) {
         console.debug("[Server AI] Primeros 500 chars:", result.text.substring(0, 500));
         console.debug("[Server AI] Últimos 500 chars:", result.text.substring(result.text.length - 500));
      }
      // Fallback response to avoid freezing the conversation
      jsonResponse = safeFallbackResponse;
    }

    // VALIDACIÓN: el JSON puede haber parseado bien pero venir sin el campo "mensaje"
    // (ej. un modelo genérico como gpt-4o-mini que no siguió el esquema al pie de la letra).
    // Sin esta validación, Twilio rechaza el envío por venir con body vacío/undefined y
    // el cliente se queda sin respuesta. Intentamos rescatar el texto de otros campos
    // comunes antes de recurrir al fallback genérico.
    if (!jsonResponse || typeof jsonResponse.mensaje !== "string" || !jsonResponse.mensaje.trim()) {
      const rescatado = jsonResponse?.respuesta || jsonResponse?.message || jsonResponse?.text || jsonResponse?.reply;
      if (typeof rescatado === "string" && rescatado.trim()) {
        console.warn(`[Server AI] jsonResponse vino sin "mensaje" válido; se rescató de un campo alterno.`);
        jsonResponse = { ...jsonResponse, mensaje: rescatado };
      } else {
        console.error(`[Server AI] jsonResponse sin "mensaje" utilizable. Texto crudo (primeros 300 chars): ${String(result.text).substring(0, 300)}`);
        jsonResponse = safeFallbackResponse;
      }
    }

    // AUTO PRODUCT IMAGE LOOKUP FOR WHATSAPP/CHAT RESPONSE
    try {
      let productForImage: any = null;
      const productsList = products || [];

      if (jsonResponse.producto) {
        const prodQuery = String(jsonResponse.producto).toLowerCase().trim();
        productForImage = productsList.find((p: any) =>
          (p.id && p.id.toLowerCase() === prodQuery) ||
          (p.name && p.name.toLowerCase() === prodQuery) ||
          (p.name && p.name.toLowerCase().includes(prodQuery)) ||
          (p.id && prodQuery.includes(p.id.toLowerCase()))
        );
      }

      if (!productForImage && data.message) {
        const originalMsg = String(data.message).toLowerCase();
        for (const p of productsList) {
          if (p.name && originalMsg.includes(p.name.toLowerCase())) {
            productForImage = p;
            break;
          }
        }
      }

      if (productForImage && productForImage.imageUrl) {
        let finalImgUrl = productForImage.imageUrl;
        if (!finalImgUrl.startsWith("http")) {
          const baseUrl = (currentAppUrl || process.env.APP_URL || "https://chatbotjanadsia.up.railway.app").replace(/\/$/, "");
          finalImgUrl = `${baseUrl}${finalImgUrl.startsWith("/") ? "" : "/"}${finalImgUrl}`;
        }
        
        const askedForPhoto = /foto|imagen|ve[or]|muestra|diseño|como es|cómo es|catálogo|catalogo/i.test(data.message || "");
        if (askedForPhoto || jsonResponse.imageUrl || jsonResponse.accion === "iniciar_checkout") {
          jsonResponse.imageUrl = finalImgUrl;
          console.log(`[Server AI Image Resolver] Auto-populated imageUrl for product "${productForImage.name}": ${finalImgUrl}`);
        }
      }
    } catch (err) {
      console.error("[Server AI Image Resolver] Error during product image lookup:", err);
    }

    console.log(`[Server AI] Respuesta generada para ${fromPhone} (Acción: ${jsonResponse.accion}):`, jsonResponse.mensaje);

    // CRM / Scoring update
    let profile = customerProfile || {};
    profile.name = jsonResponse.datos_pedido?.nombre || profile.name || fromPhone;
    profile.phone = profile.phone || fromPhone;
    profile.intencion = jsonResponse.intencion || profile.intencion || "";
    profile.producto_interes = jsonResponse.producto || profile.producto_interes || "";
    profile.objeciones = jsonResponse.objeciones || "ninguna";
    
    const msgLower = (data.message || "").toLowerCase();
    const score = calcularScore(jsonResponse, {
      dio_direccion: msgLower.includes("cr") || msgLower.includes("#") || msgLower.includes("calle") || msgLower.includes("carrera") || !!jsonResponse.datos_pedido?.direccion,
      pregunto_precio: msgLower.includes("precio") || msgLower.includes("cuanto") || msgLower.includes("costo") || msgLower.includes("vale"),
      pidio_envio: msgLower.includes("envío") || msgLower.includes("envio") || msgLower.includes("llega") || msgLower.includes("domicilio")
    });

    profile.score = score;
    profile.etapa = await definirEtapa(score);
    profile.prioridad = score > 70 ? "alta" : "media";
    profile.ultima_interaccion = serverTimestamp();
    
    // Save enriched CRM Data per store
    await setDoc(doc(db, "customers", customerProfileId), profile, { merge: true });

    // Seguro extra (defensa en profundidad): Twilio rechaza el envío si el body viene
    // vacío/undefined ("A text message body or media urls must be specified"). Nunca debería
    // llegar acá vacío gracias a la validación de arriba, pero por si acaso.
    if (typeof jsonResponse.mensaje !== "string" || !jsonResponse.mensaje.trim()) {
      jsonResponse.mensaje = "Uy, se me enredó la respuesta 😅. ¿Me repites porfa?";
    }

    // Pausa "humana" antes de responder: un vendedor real no contesta en
    // 200ms, se demora un poco leyendo/escribiendo. Esto ayuda a que el bot
    // no se sienta tan robótico. Proporcional al largo del mensaje, con topes
    // para no hacer esperar de más ni sentirse instantáneo.
    const humanDelayMs = Math.min(4000, Math.max(1200, jsonResponse.mensaje.length * 25));
    await new Promise(resolve => setTimeout(resolve, humanDelayMs));

    // 3.0 Si la IA detecta intención de confirmar pedido, en vez de mandar el texto normal
    // y crear el pedido de una, mandamos BOTONES de confirmación (Sí/No) y dejamos el pedido
    // en pendingConfirmation hasta que el cliente toque el botón. Evita pedidos mal-confirmados
    // por una interpretación ambigua de texto libre.
    if (jsonResponse.accion === "iniciar_checkout") {
      console.log("[Server AI] Intención de comprar detectada por IA. Pasando al flujo determinístico de checkout...");
      const cleanFrom = data.from.replace("whatsapp:", "").trim();
      // Si venía de una oferta por imagen pendiente, la limpiamos: ya se resolvió.
      if (customerProfile?.pendingImageOffer) {
        await updateDoc(doc(db, "customers", customerProfileId), { pendingImageOffer: null });
      }
      await startCheckoutFlow(data.from, cleanFrom, data.to, assignedStoreId, jsonResponse.producto || "");
      jsonResponse._skipTextReply = true;
    } else if (imageParts.length > 0 && imageMatchedProducts.length > 0 && jsonResponse.producto && jsonResponse.accion === "respuesta" && data.from.startsWith("whatsapp:")) {
      // Producto real identificado a partir de la FOTO que envió el cliente.
      // En vez de dejar la conversación abierta en texto libre (lo que causaba
      // el loop de "¿te interesa?" repetido), mandamos el mensaje de la IA
      // seguido de botones Sí/No deterministas, y guardamos pendingImageOffer
      // para resolver la respuesta del cliente sin margen de error.
      console.log(`[Server AI] Producto identificado por imagen (${jsonResponse.producto}). Enviando botones de confirmación de interés...`);
      try {
        if (jsonResponse.mensaje) {
          await sendWhatsApp(data.from, jsonResponse.mensaje, undefined, activityId, data.to);
        }
        const sentBtns = await sendImageProductButtons(data.from, data.to, jsonResponse.producto);
        if (sentBtns) {
          await setDoc(doc(db, "customers", customerProfileId), {
            pendingImageOffer: {
              producto: jsonResponse.producto,
              createdAt: serverTimestamp()
            }
          }, { merge: true });
        }
        jsonResponse._skipTextReply = true;
      } catch (e) {
        console.error("[Server AI] Error en el flujo de botones de producto por imagen:", e);
      }
    } else if (jsonResponse.accion === "confirmar_pedido") {
      console.log("[Server AI] Intención de confirmar pedido detectada. Enviando botones de confirmación...");
      try {
        const sent = await sendOrderConfirmationButtons(data.from, data.to, jsonResponse);
        if (sent) {
          await setDoc(doc(db, "customers", customerProfileId), {
            pendingConfirmation: {
              jsonResponse,
              storeId: assignedStoreId,
              createdAt: serverTimestamp()
            }
          }, { merge: true });
          jsonResponse._skipTextReply = true;
        } else {
          // Si por algo falla el envío de botones (ej. Twilio no listo), hacemos
          // lo de siempre: confirmar directo, para no dejar el pedido perdido.
          await finalizeOrder(jsonResponse, storeConfig, customerProfile, fromPhone, assignedStoreId, products, db);
        }
      } catch (e) {
        console.error("[Server AI] Error en el flujo de confirmación por botones:", e);
      }
    } else if (jsonResponse.accion === "mostrar_menu" && data.from.startsWith("whatsapp:")) {
      console.log("[Server AI] Acción mostrar_menu detectada. Enviando botones de menú principal...");
      try {
        if (jsonResponse.mensaje) {
          await sendWhatsApp(data.from, jsonResponse.mensaje, undefined, activityId, data.to);
        }
        await sendMainMenu(data.from, data.to);
        jsonResponse._skipTextReply = true;
      } catch (e) {
        console.error("[Server AI] Error en el flujo de mostrar_menu:", e);
      }
    } else if (jsonResponse.accion === "mostrar_categorias" && data.from.startsWith("whatsapp:")) {
      console.log("[Server AI] Acción mostrar_categorias detectada. Enviando botones de categorías...");
      try {
        if (jsonResponse.mensaje) {
          await sendWhatsApp(data.from, jsonResponse.mensaje, undefined, activityId, data.to);
        }
        await sendCategoriesMenu(data.from, data.to);
        jsonResponse._skipTextReply = true;
      } catch (e) {
        console.error("[Server AI] Error en el flujo de mostrar_categorias:", e);
      }
    } else if (jsonResponse.accion === "preguntar_continuar" && data.from.startsWith("whatsapp:")) {
      console.log("[Server AI] Acción preguntar_continuar detectada. Enviando prompt de continuar chat...");
      try {
        if (jsonResponse.mensaje) {
          await sendWhatsApp(data.from, jsonResponse.mensaje, undefined, activityId, data.to);
        }
        await sendKeepChatPrompt(data.from, data.to);
        jsonResponse._skipTextReply = true;
      } catch (e) {
        console.error("[Server AI] Error en el flujo de preguntar_continuar:", e);
      }
    } else if (jsonResponse.accion === "finalizar_chat") {
      console.log("[Server AI] Acción finalizar_chat detectada. Finalizando conversación...");
      try {
        if (jsonResponse.mensaje) {
          await sendWhatsApp(data.from, jsonResponse.mensaje, undefined, activityId, data.to);
        }
        await updateDoc(doc(db, "customers", customerProfileId), { 
          pendingConfirmation: null,
          etapa: "finalizado",
          score: 0 
        });
        jsonResponse._skipTextReply = true;
      } catch (e) {
        console.error("[Server AI] Error en el flujo de finalizar_chat:", e);
      }
    }

    // 3. Enviar respuesta por la plataforma correcta
    if (!jsonResponse._skipTextReply) {
      if (data.from.startsWith("whatsapp:")) {
        let mediaUrl = jsonResponse.imageUrl || undefined;
        if (imageParts.length > 0 && mediaUrl) {
           console.log("[Server AI] Omitiendo mediaUrl porque el cliente acaba de enviar una imagen.");
           mediaUrl = undefined;
        }
        await sendWhatsApp(data.from, jsonResponse.mensaje, mediaUrl, activityId, data.to);
      } else if (data.platform === "instagram" || data.platform === "messenger") {
        await sendMetaMessage(data.from, jsonResponse.mensaje, data.platform, data.to);
      }
    }

    // 4. Actualizar actividad
    await updateDoc(doc(db, "activities", activityId), {
      status: "respondido",
      response: jsonResponse._skipTextReply ? "[Botones de confirmación enviados]" : jsonResponse.mensaje,
      respondedAt: serverTimestamp()
    });

    // 6. Notificar si se requiere atención humana y pausar IA automáticamente
    // ==============================================
    // 🛟 RED DE SEGURIDAD: forzar escalamiento a humano
    // ==============================================
    // La IA a veces "olvida" marcar accion="notificar_admin" aunque su propio
    // texto ya está diciendo que no tiene el producto o que no sabe algo. En
    // vez de depender 100% de que el modelo se acuerde, revisamos su propia
    // respuesta por frases de incertidumbre/no-disponibilidad y forzamos la
    // escalación de todas formas, para nunca dejar a un cliente colgado.
    const uncertaintyPhrases = [
      "no lo tenemos", "no lo tengo", "no está disponible", "no tenemos ese",
      "no manejamos ese", "no contamos con", "no sé si", "no estoy seguro",
      "no tengo información", "voy a consultar", "permíteme consultar",
      "un asesor te", "no puedo confirmar", "no encuentro ese producto",
      "estoy aquí para ayudarte con tus necesidades", "qué te gustaría saber o comprar"
    ];
    const mensajeLower = String(jsonResponse.mensaje || "").toLowerCase();
    if (jsonResponse.accion === "respuesta" && uncertaintyPhrases.some(p => mensajeLower.includes(p))) {
      console.log("[Server AI] 🛟 Red de seguridad activada: la IA mostró incertidumbre sin marcar notificar_admin. Forzando escalamiento.");
      jsonResponse.accion = "notificar_admin";
    }

    // 🔁 DETECTOR DE RESPUESTA REPETIDA (loop): a veces la IA queda "trabada"
    // repitiendo casi textualmente su mensaje anterior cuando el cliente
    // pregunta algo muy genérico/amplio que no matchea productos concretos
    // (ej. "repuestos o herramientas"). En vez de dejar al cliente colgado
    // con la misma frase de relleno una y otra vez, si detectamos que la
    // respuesta es casi igual a la última que le mandamos a este mismo
    // cliente, forzamos escalación a humano.
    if (jsonResponse.accion === "respuesta" && jsonResponse.mensaje) {
      try {
        const lastBotActQ = query(
          collection(db, "activities"),
          where("customerPhone", "==", fromPhone),
          where("senderType", "==", "bot"),
          orderBy("timestamp", "desc"),
          limit(1)
        );
        const lastBotActSnap = await getDocs(lastBotActQ);
        if (!lastBotActSnap.empty) {
          const lastResponseText = String(lastBotActSnap.docs[0].data()?.response || lastBotActSnap.docs[0].data()?.message || "").toLowerCase().trim();
          const currentText = mensajeLower.trim();
          if (lastResponseText.length > 20 && currentText.length > 20) {
            const shortestLen = Math.min(lastResponseText.length, currentText.length);
            const matchingPrefixLen = (() => {
              let i = 0;
              while (i < shortestLen && lastResponseText[i] === currentText[i]) i++;
              return i;
            })();
            const similarity = matchingPrefixLen / shortestLen;
            if (similarity > 0.85) {
              console.log("[Server AI] 🔁 Respuesta casi idéntica a la anterior detectada (posible loop). Forzando escalamiento.");
              jsonResponse.accion = "notificar_admin";
            }
          }
        }
      } catch (e: any) {
        console.error("[Server AI] Error verificando respuesta repetida:", e.message);
      }
    }

    if (jsonResponse.accion === "notificar_admin" || jsonResponse.accion === "solicitar_asesor") {
      console.log("[Server AI] ¡ASESORÍA HUMANA SOLICITADA! Notificando (la IA sigue aclarando dudas, no se pausa todavía)...");
      // 🔄 CAMBIO IMPORTANTE: ya NO pausamos la IA de una vez aquí. La IA
      // sigue activa y le puede seguir preguntando al cliente detalles del
      // producto (ej. "¿es forro de sillas o tipo pijama?") para que, cuando
      // el asesor (Jan) entre a cerrar, ya tenga la info clara — sin que la
      // IA llegue a dar precio ni confirmar disponibilidad de ese producto
      // fuera de catálogo (eso lo indica el prompt de la IA). Solo pausamos
      // la IA cuando el asesor responda manualmente por primera vez (ver
      // /api/admin/send-message, que ya hace setCustomerAiPauseState).
      await setDoc(doc(db, "customers", customerProfileId), { etapa: "asesoria_solicitada" }, { merge: true });

      // 📊 Registro aparte y queryable para el reporte semanal de demanda:
      // qué productos pide la gente que NO tenemos en catálogo. Esto es lo
      // que nos dice qué agregar con demanda ya comprobada.
      try {
        await addDoc(collection(db, "demand_requests"), {
          customerPhone: fromPhone,
          requestedProduct: jsonResponse.producto || data.message,
          customerMessage: data.message,
          storeId: assignedStoreId,
          timestamp: serverTimestamp()
        });
      } catch (e: any) {
        console.error("[Demand Report] Error registrando solicitud:", e.message);
      }

      const adminMessage = `🚨 *ASESORÍA HUMANA SOLICITADA*
Cliente: ${customerProfile?.name || fromPhone} (${fromPhone})
Producto/Duda: ${jsonResponse.producto || 'No especificado'}
Mensaje del cliente: "${data.message}"
Jan (IA) respondió: "${jsonResponse.mensaje}"

ℹ️ La IA sigue conversando con el cliente para aclarar detalles (sin dar precio). Entra cuando puedas a cerrar la venta.`;
      
      await sendAdminAlert(adminMessage);
      // ⏰ RECORDATORIO SI TARDAS EN ENTRAR: si en 20 minutos no has
      // respondido manualmente (no hay ninguna actividad con manualAgent
      // registrada después de este momento), te mandamos un segundo aviso
      // más urgente para que no se enfríe el cliente.
      const escalationTimestamp = Date.now();
      setTimeout(async () => {
        try {
          const recentActQ = query(
            collection(db, "activities"),
            where("customerPhone", "==", fromPhone),
            orderBy("timestamp", "desc"),
            limit(5)
          );
          const recentSnap = await getDocs(recentActQ);
          const alreadyHandled = recentSnap.docs.some(d => {
            const dd = d.data();
            const ts = dd.timestamp?.toMillis?.() || 0;
            return dd.manualAgent && ts >= escalationTimestamp;
          });
          if (alreadyHandled) return;

          const reminderMsg = `🚨🚨 *RECORDATORIO:* Sigues sin responder a ${customerProfile?.name || fromPhone} sobre "${jsonResponse.producto || 'su duda'}" — ya pasaron 20 minutos. ¡No dejes que se enfríe! 🔥`;
          await sendAdminAlert(reminderMsg);
        } catch (e: any) {
          console.error("[Reminder] Error enviando recordatorio de asesoría pendiente:", e.message);
        }
      }, 20 * 60 * 1000);
    }

    // 7. PROGRAMAR SEGUIMIENTO INTELIGENTE SI NO CERRÓ
    if (jsonResponse.accion !== "confirmar_pedido" && score > 20) {
      // Solo si el score es relevante (interesado de verdad)
      await scheduleFollowUp(fromPhone, score, jsonResponse.intencion || "Interés general", assignedStoreId);
    }

    // 8. CIERRE LIMPIO POR INACTIVIDAD
    // Se reprograma en CADA respuesta, asi que el reloj siempre cuenta desde el
    // ultimo mensaje. Va despues del seguimiento comercial a proposito: aquel
    // cancela los pendientes al programarse, y este debe sobrevivir a esa
    // cancelacion. Si el pedido ya se confirmo no hay nada que cerrar.
    if (jsonResponse.accion !== "confirmar_pedido" && jsonResponse.accion !== "finalizar_chat") {
      await scheduleInactivityClose(fromPhone, assignedStoreId, "cierre_aviso");
    } else {
      await cancelInactivityClose(fromPhone, assignedStoreId);
    }

  } catch (err: any) {
    console.error(`[Server AI][Error] Falló procesamiento en Railway:`, err.message);
    try { handleSupabaseError(err); } catch (e) {}
    if (!checkGlobalQuota()) {
      await updateDoc(doc(db, "activities", activityId), { 
        status: "error", 
        response: `Jan tuvo un mareo: ${err.message}`,
        errorAt: serverTimestamp()
      }).catch((e)=>console.error("Failed to write error due to quota", e));
    }
  }
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
// ==============================================
// 🔘 BOTONES DE CONFIRMACIÓN DE PEDIDO (WhatsApp Quick Reply)
// ==============================================
// Se auto-provisiona UNA sola vez el Content Template en Twilio (no requiere
// tocar la consola de Twilio a mano). El ContentSid resultante se guarda en
// Supabase (config/system) para no volver a crearlo en cada arranque.
const CONFIRM_YES_ID = "JAN_CONFIRM_YES";
const CONFIRM_NO_ID = "JAN_CONFIRM_NO";

// ==============================================
// 🚚 CONFIRMACIÓN FINAL DE DESPACHO (antes de subir a Dropi)
// ==============================================
// Esto es DISTINTO a la confirmación inicial del pedido (CONFIRM_YES_ID /
// CONFIRM_NO_ID de arriba, que es cuando el cliente arma su carrito). Este
// otro flujo es para cuando TÚ, como dueño, ya vas a llevar el pedido
// físicamente a Dropi (ej. a las 5pm revisas lo que se pidió en el día) y
// quieres una última confirmación del cliente antes de despachar, con un
// mensaje de urgencia/gatillo mental, y la opción extra de reprogramar.
const DISPATCH_YES_ID = "JAN_DISPATCH_YES";
const DISPATCH_NO_ID = "JAN_DISPATCH_NO";
const DISPATCH_RESCHEDULE_ID = "JAN_DISPATCH_RESCHEDULE";

async function ensureDispatchConfirmTemplate(): Promise<string | null> {
  if (!twilioClient) return null;
  try {
    const cfgSnap = await getDoc(doc(db, "config", "system"));
    const d = cfgSnap.exists() ? cfgSnap.data() : {};
    if (d?.dispatchConfirmTemplateSid) return d.dispatchConfirmTemplateSid;

    const content = await (twilioClient as any).content.v1.contents.create({
      friendlyName: `jan_dispatch_confirm_${Date.now()}`,
      language: "es",
      variables: { "1": "tu pedido" },
      types: {
        "twilio/quick-reply": {
          body: "📦 *¡Última llamada!* 🚨\n\nTu pedido de *{{1}}* está a punto de salir con la transportadora en las próximas horas — este es el último momento para confirmar antes de despacharlo. ⏰\n\n¿Sigues interesado en recibirlo?",
          actions: [
            { title: "✅ Sí, lo quiero", id: DISPATCH_YES_ID },
            { title: "❌ No, cancelar", id: DISPATCH_NO_ID },
            { title: "📅 Reprogramar", id: DISPATCH_RESCHEDULE_ID }
          ]
        }
      }
    });

    await setDoc(doc(db, "config", "system"), { dispatchConfirmTemplateSid: content.sid }, { merge: true });
    return content.sid;
  } catch (e: any) {
    console.error("[Dispatch Confirm] Error creando template:", e.message);
    return null;
  }
}

// ==============================================
// 🚨 ALERTA A ADMIN CONFIABLE (bypass de ventana de 24h de WhatsApp)
// ==============================================
// Antes, las alertas al dueño (escalación, recordatorios, límites, etc.) se
// mandaban como texto libre con sendWhatsApp(). El problema: si el dueño no
// le ha escrito a su propio número de bot en las últimas 24 horas, WhatsApp
// BLOQUEA en silencio los mensajes de texto libre — Twilio dice "enviado"
// pero nunca llega. Usamos un template APROBADO (que sí puede saltarse esa
// ventana) para garantizar que las alertas críticas siempre lleguen.
async function ensureAdminAlertTemplate(): Promise<string | null> {
  if (!twilioClient) return null;
  try {
    const cfgSnap = await getDoc(doc(db, "config", "system"));
    const d = cfgSnap.exists() ? cfgSnap.data() : {};
    if (d?.adminAlertTemplateSid) return d.adminAlertTemplateSid;

    const content = await (twilioClient as any).content.v1.contents.create({
      friendlyName: `jan_admin_alert_${Date.now()}`,
      language: "es",
      variables: { "1": "Alerta del sistema" },
      types: {
        "twilio/text": {
          body: "{{1}}"
        }
      }
    });

    await setDoc(doc(db, "config", "system"), { adminAlertTemplateSid: content.sid }, { merge: true });
    return content.sid;
  } catch (e: any) {
    console.error("[Admin Alert] Error creando template de alerta:", e.message);
    return null;
  }
}

async function sendAdminAlert(message: string): Promise<void> {
  const admins = getAdminNumbers();
  for (const num of admins) {
    const target = num.trim().startsWith("whatsapp:") ? num.trim() : `whatsapp:${num.trim()}`;
    try {
      const contentSid = await ensureAdminAlertTemplate();
      if (contentSid && twilioClient) {
        await (twilioClient as any).messages.create({
          from: normalizePhone(TWILIO_FROM_NUMBER || "+14155238886"),
          to: normalizePhone(target),
          contentSid,
          contentVariables: JSON.stringify({ "1": message.slice(0, 1024) })
        });
      } else {
        // Respaldo si el template falla por algún motivo
        await sendWhatsApp(target, message);
      }
    } catch (e: any) {
      console.error(`[Admin Alert] Error enviando alerta a ${target}:`, e.message);
    }
  }
}


async function sendDispatchConfirmationButtons(to: string, from: string, orderId: string, productName: string): Promise<boolean> {
  if (!twilioClient) return false;
  try {
    const contentSid = await ensureDispatchConfirmTemplate();
    if (!contentSid) return false;

    await (twilioClient as any).messages.create({
      from: normalizePhone(from || TWILIO_FROM_NUMBER || "+14155238886"),
      to: normalizePhone(to),
      contentSid,
      contentVariables: JSON.stringify({ "1": productName })
    });

    await logOutgoingButtonsActivity(
      to, "default", from,
      `📦 ¡Última llamada! Tu pedido de ${productName} está a punto de salir con la transportadora. ¿Sigues interesado en recibirlo?`,
      ["✅ Sí, lo quiero", "❌ No, cancelar", "📅 Reprogramar"]
    );

    // Guardamos a qué pedido corresponde esta confirmación, para saber qué
    // orden actualizar cuando el cliente responda.
    const cleanPhone = to.replace("whatsapp:", "").trim();
    const customerProfileId = `default_${cleanPhone}`;
    await setDoc(doc(db, "customers", customerProfileId), {
      pendingDispatchConfirmation: { orderId, productName }
    }, { merge: true });

    return true;
  } catch (e: any) {
    console.error("[Dispatch Confirm] Error enviando botones:", e.message);
    return false;
  }
}


async function ensureOrderConfirmationTemplate(): Promise<string | null> {
  if (!twilioClient) return null;
  try {
    const cfgSnap = await getDoc(doc(db, "config", "system"));
    const existingSid = cfgSnap.exists() ? cfgSnap.data()?.orderConfirmTemplateSid : null;
    if (existingSid) {
      console.log(`[WhatsApp Buttons] Usando template existente: ${existingSid}`);
      return existingSid;
    }

    console.log("[WhatsApp Buttons] No hay template de confirmación aún. Creando uno nuevo...");
    const content = await (twilioClient as any).content.v1.contents.create({
      friendlyName: `jan_order_confirm_${Date.now()}`,
      language: "es",
      variables: { "1": "Producto x1 - $50.000, Cra 10 #20-30" },
      types: {
        "twilio/quick-reply": {
          body: "🧾 Resumen de tu pedido:\n{{1}}\n\n¿Confirmas para enviarlo ya?",
          actions: [
            { title: "Sí, confirmar ✅", id: CONFIRM_YES_ID },
            { title: "No, cambiar algo ✏️", id: CONFIRM_NO_ID }
          ]
        },
        "twilio/text": {
          body: "🧾 Resumen de tu pedido:\n{{1}}\n\n¿Confirmas para enviarlo ya? Responde SI o NO."
        }
      }
    });

    await setDoc(doc(db, "config", "system"), { orderConfirmTemplateSid: content.sid }, { merge: true });
    console.log(`[WhatsApp Buttons] Template creado y guardado: ${content.sid}`);
    return content.sid;
  } catch (e: any) {
    console.error("[WhatsApp Buttons] No se pudo crear/obtener el template de confirmación:", e.message);
    return null;
  }
}

// ==============================================
// 🔘 BOTONES DE INTERÉS SOBRE PRODUCTO IDENTIFICADO POR IMAGEN
// ==============================================
// Cuando el cliente envía una FOTO y logramos identificar un producto real del
// inventario que coincide, en vez de dejar que la IA siga la conversación en
// texto libre (lo que generaba el loop de "¿te interesa?" -> "SI" -> "¿te
// interesa?" otra vez), mandamos botones deterministas de Sí/No. Al tocar
// "Sí", se dispara directo el flujo de checkout sin volver a pasar por la IA.
const IMG_YES_ID = "JAN_IMG_YES";
const IMG_NO_ID = "JAN_IMG_NO";
const TREND_YES_ID = "JAN_TREND_YES";
const TREND_NO_ID = "JAN_TREND_NO";
const UPSELL_YES_ID = "JAN_UPSELL_YES";
const UPSELL_NO_ID = "JAN_UPSELL_NO";

async function ensureImageProductTemplate(): Promise<string | null> {
  if (!twilioClient) return null;
  try {
    const cfgSnap = await getDoc(doc(db, "config", "system"));
    const existingSid = cfgSnap.exists() ? cfgSnap.data()?.imageProductTemplateSid : null;
    if (existingSid) {
      console.log(`[WhatsApp Buttons] Usando template de producto por imagen existente: ${existingSid}`);
      return existingSid;
    }

    console.log("[WhatsApp Buttons] No hay template de producto por imagen aún. Creando uno nuevo...");
    const content = await (twilioClient as any).content.v1.contents.create({
      friendlyName: `jan_image_product_${Date.now()}`,
      language: "es",
      variables: { "1": "Cargador Iniciador de Batería Para Carro" },
      types: {
        "twilio/quick-reply": {
          body: "¿Te interesa el *{{1}}*? 🤔",
          actions: [
            { title: "Sí, lo quiero ✅", id: IMG_YES_ID },
            { title: "No, gracias ❌", id: IMG_NO_ID }
          ]
        },
        "twilio/text": {
          body: "¿Te interesa el *{{1}}*? Responde SI o NO."
        }
      }
    });

    await setDoc(doc(db, "config", "system"), { imageProductTemplateSid: content.sid }, { merge: true });
    console.log(`[WhatsApp Buttons] Template de producto por imagen creado y guardado: ${content.sid}`);
    return content.sid;
  } catch (e: any) {
    console.error("[WhatsApp Buttons] No se pudo crear/obtener el template de producto por imagen:", e.message);
    return null;
  }
}

async function sendImageProductButtons(to: string, from: string, productName: string): Promise<boolean> {
  if (!twilioClient) return false;
  const contentSid = await ensureImageProductTemplate();
  if (!contentSid) return false;

  try {
    await (twilioClient as any).messages.create({
      from: normalizePhone(from || TWILIO_FROM_NUMBER || "+14155238886"),
      to: normalizePhone(to),
      contentSid,
      contentVariables: JSON.stringify({ "1": String(productName || "este producto").slice(0, 300) })
    });
    console.log(`[WhatsApp Buttons] Botones de producto por imagen enviados a ${to}`);
    return true;
  } catch (e: any) {
    console.error("[WhatsApp Buttons] Error enviando botones de producto por imagen:", e.message);
    return false;
  }
}

async function ensureUpsellOfferTemplate(): Promise<string | null> {
  if (!twilioClient) return null;
  try {
    const cfgSnap = await getDoc(doc(db, "config", "system"));
    const existingSid = cfgSnap.exists() ? cfgSnap.data()?.upsellOfferTemplateSid : null;
    if (existingSid) return existingSid;

    const content = await (twilioClient as any).content.v1.contents.create({
      friendlyName: `jan_upsell_offer_${Date.now()}`,
      language: "es",
      variables: { "1": "Como eres cliente VIP, tenemos algo especial para ti hoy. 🎁" },
      types: {
        "twilio/quick-reply": {
          body: "{{1}}",
          actions: [
            { title: "Sí, la quiero 🛒", id: UPSELL_YES_ID },
            { title: "No, gracias ❌", id: UPSELL_NO_ID }
          ]
        },
        "twilio/text": {
          body: "{{1}} Responde SI o NO."
        }
      }
    });

    await setDoc(doc(db, "config", "system"), { upsellOfferTemplateSid: content.sid }, { merge: true });
    return content.sid;
  } catch (e: any) {
    console.error("[WhatsApp Buttons] Error creando template de oferta VIP:", e.message);
    return null;
  }
}

async function sendUpsellOfferButtons(to: string, from: string, message: string): Promise<boolean> {
  if (!twilioClient) return false;
  const contentSid = await ensureUpsellOfferTemplate();
  if (!contentSid) return false;

  try {
    await (twilioClient as any).messages.create({
      from: normalizePhone(from || TWILIO_FROM_NUMBER || "+14155238886"),
      to: normalizePhone(to),
      contentSid,
      contentVariables: JSON.stringify({ "1": String(message || "Tenemos una oferta especial para ti.").slice(0, 1000) })
    });
    return true;
  } catch (e: any) {
    console.error("[WhatsApp Buttons] Error enviando botones de oferta VIP:", e.message);
    return false;
  }
}

// Template de "producto en tendencia" con imagen (header), texto y botones Sí/No.
// Usa "twilio/card" porque, a diferencia de "twilio/quick-reply", soporta media (imagen).
async function ensureTrendOfferTemplate(): Promise<string | null> {
  if (!twilioClient) return null;
  try {
    const cfgSnap = await getDoc(doc(db, "config", "system"));
    const existingSid = cfgSnap.exists() ? cfgSnap.data()?.trendOfferTemplateSid : null;
    if (existingSid) return existingSid;

    const content = await (twilioClient as any).content.v1.contents.create({
      friendlyName: `jan_trend_offer_${Date.now()}`,
      language: "es",
      variables: {
        "1": "Lámpara LED con Sensor",
        "2": "🔥 ¡Nuevo en tendencia! Pensamos en ti por tus compras anteriores. Envío gratis contraentrega.",
        "3": "https://via.placeholder.com/600"
      },
      types: {
        "twilio/card": {
          // El 'subtitle' de una card aterriza en el PIE DE PÁGINA de la
          // plantilla de WhatsApp, y ese campo no admite variables: Twilio
          // respondía "Subtitle cannot contain variables" y la creación fallaba.
          // Al fallar nunca se guardaba el SID, así que se reintentaba en cada
          // oferta y la campaña de tendencias jamás llegó a salir. El pitch se
          // pasa al cuerpo (title), que sí acepta variables, y el pie queda fijo.
          title: "{{2}}\n\n*{{1}}*",
          subtitle: "Envío gratis · Pagas contra entrega",
          media: ["{{3}}"],
          actions: [
            // Sin emojis: Twilio rechaza el template con "Button Title text cannot
            // contain emojis". Al fallar nunca se guardaba el SID, asi que se
            // reintentaba en bucle en cada oferta de tendencia y el mensaje con
            // imagen nunca llegaba a salir.
            { type: "QUICK_REPLY", title: "Si, la quiero", id: TREND_YES_ID },
            { type: "QUICK_REPLY", title: "No, gracias", id: TREND_NO_ID }
          ]
        },
        "twilio/text": {
          body: "🔥 Nuevo en tendencia: {{1}}. {{2}} Responde SI o NO."
        }
      }
    });

    await setDoc(doc(db, "config", "system"), { trendOfferTemplateSid: content.sid }, { merge: true });
    return content.sid;
  } catch (e: any) {
    console.error("[WhatsApp Buttons] Error creando template de oferta en tendencia:", e.message);
    return null;
  }
}

async function sendTrendOfferButtons(to: string, from: string, productName: string, pitch: string, imageUrl: string, price?: number): Promise<boolean> {
  if (!twilioClient) return false;
  const contentSid = await ensureTrendOfferTemplate();
  if (!contentSid) return false;

  try {
    await (twilioClient as any).messages.create({
      from: normalizePhone(from || TWILIO_FROM_NUMBER || "+14155238886"),
      to: normalizePhone(to),
      contentSid,
      contentVariables: JSON.stringify({
        "1": String(productName || "Producto").slice(0, 100),
        "2": String(pitch || "¡Nuevo en tendencia!").slice(0, 300),
        "3": imageUrl || "https://via.placeholder.com/600"
      })
    });

    // 🎯 Guardamos EXACTAMENTE qué producto y precio se ofreció, para que si
    // el cliente toca "Sí, la quiero", el servidor sepa con certeza a qué se
    // refiere (sin depender de que la IA lo adivine del historial).
    if (price) {
      const cleanPhone = to.replace("whatsapp:", "").trim();
      const customerProfileId = `default_${cleanPhone}`;
      await setDoc(doc(db, "customers", customerProfileId), {
        pendingManualOffer: { producto: productName, valor: Number(price), cantidad: 1, offeredAt: new Date().toISOString() }
      }, { merge: true });
    }

    return true;
  } catch (e: any) {
    console.error("[WhatsApp Buttons] Error enviando oferta de tendencia:", e.message);
    return false;
  }
}

// Arma el texto corto que va dentro de la variable {{1}} del template
function buildOrderSummaryLine(jsonResponse: any): string {
  const producto = jsonResponse.producto || "Producto";
  const valor = jsonResponse.datos_pedido?.valor ? `$${Number(jsonResponse.datos_pedido.valor).toLocaleString("es-CO")}` : "";
  const direccion = jsonResponse.datos_pedido?.direccion || "";
  const ciudad = jsonResponse.datos_pedido?.ciudad || "";
  return [producto, valor, [direccion, ciudad].filter(Boolean).join(", ")].filter(Boolean).join(" - ").slice(0, 300);
}

// Construye y envía (o reenvía, tras una corrección puntual) el resumen del
// pedido en el flujo determinístico de checkout, guardando el
// pendingConfirmation en Firestore y adjuntando la foto del producto si la
// encontramos en el catálogo, para darle más confianza al cliente.
async function sendCheckoutSummaryAndButtons(
  customerPhone: string,
  botPhone: string,
  customerProfileId: string,
  checkoutData: any,
  activityId: string | undefined,
  assignedStoreId: string
): Promise<void> {
  if (!checkoutData.valor || checkoutData.valor <= 0) {
    const products = await loadProductsForStore(assignedStoreId);
    const checkProd = (checkoutData.producto || "").toLowerCase();
    const match = products.find((p: any) =>
      (p.name && p.name.toLowerCase().includes(checkProd)) ||
      (p.name && checkProd.includes(p.name.toLowerCase()))
    );
    if (match && match.price) checkoutData.valor = match.price;
  }

  const cantidad = checkoutData.cantidad && checkoutData.cantidad > 0 ? checkoutData.cantidad : 1;
  const totalPagar = Number(checkoutData.valor || 0) * cantidad;

  await setDoc(doc(db, "customers", customerProfileId), {
    checkoutStep: "confirmacion",
    checkoutData: checkoutData,
    pendingConfirmation: {
      jsonResponse: {
        accion: "confirmar_pedido",
        producto: checkoutData.producto,
        datos_pedido: {
          nombre: checkoutData.nombre,
          telefono: checkoutData.telefono,
          ciudad: checkoutData.ciudad,
          direccion: checkoutData.direccion,
          referencia: checkoutData.referencia,
          valor: checkoutData.valor,
          cantidad: cantidad,
          notas: `Pedido capturado por flujo determinístico de Checkout.`
        }
      },
      storeId: assignedStoreId,
      createdAt: serverTimestamp()
    }
  }, { merge: true });

  const fakeJsonResponse = {
    producto: checkoutData.producto,
    datos_pedido: {
      valor: totalPagar,
      direccion: checkoutData.direccion,
      ciudad: checkoutData.ciudad
    }
  };

  // Buscar imagen del producto en el catálogo para adjuntarla al resumen
  let productImageUrl: string | undefined;
  try {
    const products = await loadProductsForStore(assignedStoreId);
    const checkProd = (checkoutData.producto || "").toLowerCase();
    const match = products.find((p: any) =>
      (p.name && p.name.toLowerCase() === checkProd) ||
      (p.name && p.name.toLowerCase().includes(checkProd)) ||
      (p.name && checkProd.includes(p.name.toLowerCase()))
    );
    if (match && match.imageUrl && !String(match.imageUrl).startsWith("/")) {
      productImageUrl = match.imageUrl;
    }
  } catch (e) {
    console.error("[Checkout Summary] No se pudo buscar la imagen del producto:", e);
  }

  const summaryText = `🚨 *RESUMEN DE TU PEDIDO* 🚨\n\n📦 *Producto:* ${checkoutData.producto}\n🔢 *Cantidad:* ${cantidad}\n💵 *Total a Pagar:* $${totalPagar.toLocaleString("es-CO")} *(Pagas al recibir)*\n👤 *Nombre:* ${checkoutData.nombre}\n📞 *Teléfono:* ${checkoutData.telefono}\n🇨🇴 *Destino:* ${checkoutData.ciudad}\n🏠 *Dirección:* ${checkoutData.direccion}\n📍 *Referencia:* ${checkoutData.referencia}\n\n🔥 *¡El envío es 100% GRATIS!*`;
  await sendWhatsApp(customerPhone, summaryText, productImageUrl, activityId, botPhone);

  if (activityId) {
    await updateDoc(doc(db, "activities", activityId), {
      status: "respondido",
      response: summaryText,
      respondedAt: serverTimestamp()
    });
  }

  await new Promise(resolve => setTimeout(resolve, 1200));

  const buttonsSent = await sendOrderConfirmationButtons(customerPhone, botPhone, fakeJsonResponse);
  if (!buttonsSent) {
    await sendWhatsApp(customerPhone, `¿Confirmas que todos tus datos están correctos para proceder con el despacho? Escribe *SÍ* para confirmar o *NO* para corregir.`, undefined, activityId, botPhone);
    if (activityId) {
      await updateDoc(doc(db, "activities", activityId), {
        status: "respondido",
        response: summaryText + "\n\n¿Confirmas que todos tus datos están correctos para proceder con el despacho? Escribe *SÍ* para confirmar o *NO* para corregir.",
        respondedAt: serverTimestamp()
      });
    }
  } else {
    if (activityId) {
      await updateDoc(doc(db, "activities", activityId), {
        status: "respondido",
        response: summaryText + "\n\n[Botones de confirmación de pedido enviados]",
        respondedAt: serverTimestamp()
      });
    }
  }
}


// Reenvía la pregunta correspondiente al paso de checkout donde el cliente
// se quedó, usado cuando retoma desde el botón "Continuar mi pedido" de un
// follow-up de carrito abandonado.
async function resendCurrentCheckoutStepPrompt(customerPhone: string, botPhone: string, customerData: any, activityId?: string): Promise<void> {
  const step = customerData?.checkoutStep;
  const cd = customerData?.checkoutData || {};
  const prompts: Record<string, string> = {
    producto: "¡Retomemos! ¿Qué producto deseas pedir? 📦",
    cantidad: `¡Seguimos con tu pedido de *${cd.producto || "tu producto"}*! ¿Cuántas *unidades* deseas? 🔢`,
    nombre: "¡Seguimos! ¿Cuál es tu *Nombre y Apellido completo*? 📝",
    telefono: "¡Seguimos! ¿A qué *número de teléfono* te contactamos? 📞",
    ciudad: "¡Seguimos! ¿A qué *ciudad o municipio* enviamos tu pedido? 🇨🇴",
    direccion: "¡Seguimos! ¿Cuál es tu *dirección exacta de entrega*? 🏠",
    referencia: "¡Seguimos! ¿Alguna *referencia* de la dirección? 📍 (o escribe *ninguna*)",
  };
  if (step === "confirmacion") {
    await sendCheckoutSummaryAndButtons(customerPhone, botPhone, `${customerData?.storeId || "default"}_${customerPhone.replace("whatsapp:", "")}`, cd, activityId, customerData?.storeId || "default");
    return;
  }
  const msg = prompts[step] || "¡Seguimos con tu pedido! Cuéntame en qué íbamos. 😊";
  await sendWhatsApp(customerPhone, msg, undefined, activityId, botPhone);
  if (activityId) {
    await updateDoc(doc(db, "activities", activityId), {
      status: "respondido",
      response: msg,
      respondedAt: serverTimestamp()
    });
  }
}

async function ensureResumeCheckoutTemplate(): Promise<string | null> {
  if (!twilioClient) return null;
  try {
    const cfgSnap = await getDoc(doc(db, "config", "system"));
    const existingSid = cfgSnap.exists() ? cfgSnap.data()?.resumeCheckoutTemplateSid : null;
    if (existingSid) return existingSid;

    const content = await (twilioClient as any).content.v1.contents.create({
      friendlyName: `jan_resume_checkout_${Date.now()}`,
      language: "es",
      variables: { "1": "tu pedido" },
      types: {
        "twilio/quick-reply": {
          body: "¡Hola de nuevo! 👋 Veo que quedaste a mitad de registrar {{1}}. ¿Seguimos donde quedamos?",
          actions: [
            { title: "🛒 Continuar mi pedido", id: "RESUME_CHECKOUT" },
            { title: "❌ No, gracias", id: "RESUME_CHECKOUT_NO" }
          ]
        },
        "twilio/text": {
          body: "¡Hola de nuevo! 👋 Veo que quedaste a mitad de registrar {{1}}. Responde CONTINUAR para seguir donde quedamos, o NO GRACIAS si prefieres dejarlo así."
        }
      }
    });

    await setDoc(doc(db, "config", "system"), { resumeCheckoutTemplateSid: content.sid }, { merge: true });
    return content.sid;
  } catch (e: any) {
    console.error("[WhatsApp Buttons] Error creando template de retomar checkout:", e.message);
    return null;
  }
}

async function sendResumeCheckoutButtons(to: string, from: string, productoTexto: string): Promise<boolean> {
  if (!twilioClient) return false;
  const contentSid = await ensureResumeCheckoutTemplate();
  if (!contentSid) return false;

  try {
    await (twilioClient as any).messages.create({
      from: normalizePhone(from || TWILIO_FROM_NUMBER || "+14155238886"),
      to: normalizePhone(to),
      contentSid,
      contentVariables: JSON.stringify({ "1": (productoTexto || "tu pedido").slice(0, 100) })
    });
    return true;
  } catch (e: any) {
    console.error("[WhatsApp Buttons] Error enviando botones de retomar checkout:", e.message);
    return false;
  }
}

async function sendOrderConfirmationButtons(to: string, from: string, jsonResponse: any): Promise<boolean> {
  if (!twilioClient) return false;
  const contentSid = await ensureOrderConfirmationTemplate();
  if (!contentSid) return false;

  try {
    await (twilioClient as any).messages.create({
      from: normalizePhone(from || TWILIO_FROM_NUMBER || "+14155238886"),
      to: normalizePhone(to),
      contentSid,
      contentVariables: JSON.stringify({ "1": buildOrderSummaryLine(jsonResponse) })
    });
    console.log(`[WhatsApp Buttons] Botones de confirmación enviados a ${to}`);
    await logOutgoingButtonsActivity(to, "default", from, `🧾 Resumen de tu pedido:\n${buildOrderSummaryLine(jsonResponse)}\n\n¿Confirmas para enviarlo ya?`, [
      "Sí, confirmar ✅", "No, cambiar algo ✏️"
    ]);
    return true;
  } catch (e: any) {
    console.error("[WhatsApp Buttons] Error enviando botones de confirmación:", e.message);
    return false;
  }
}

// Unified Template Provisioner for All Interactive Bot Flow Elements
async function ensureAllTemplates(): Promise<{
  orderConfirmSid: string | null;
  mainMenuSid: string | null;
  categoriesSid: string | null;
  otherCategoriesSid: string | null;
  keepChatSid: string | null;
}> {
  const result = {
    orderConfirmSid: null as string | null,
    mainMenuSid: null as string | null,
    categoriesSid: null as string | null,
    otherCategoriesSid: null as string | null,
    keepChatSid: null as string | null
  };

  if (!twilioClient) return result;

  try {
    const cfgSnap = await getDoc(doc(db, "config", "system"));
    const d = cfgSnap.exists() ? cfgSnap.data() : {};

    // 1. Order Confirm
    if (d?.orderConfirmTemplateSid) {
      result.orderConfirmSid = d.orderConfirmTemplateSid;
    } else {
      console.log("[WhatsApp Buttons] Creando template de confirmación...");
      const content = await (twilioClient as any).content.v1.contents.create({
        friendlyName: `jan_order_confirm_${Date.now()}`,
        language: "es",
        variables: { "1": "Producto x1 - $50.000, Cra 10 #20-30" },
        types: {
          "twilio/quick-reply": {
            body: "🧾 Resumen de tu pedido:\n{{1}}\n\n¿Confirmas para enviarlo ya?",
            actions: [
              { title: "Sí, confirmar ✅", id: CONFIRM_YES_ID },
              { title: "No, cambiar algo ✏️", id: CONFIRM_NO_ID }
            ]
          },
          "twilio/text": {
            body: "🧾 Resumen de tu pedido:\n{{1}}\n\n¿Confirmas para enviarlo ya? Responde SI o NO."
          }
        }
      });
      result.orderConfirmSid = content.sid;
      await setDoc(doc(db, "config", "system"), { orderConfirmTemplateSid: content.sid }, { merge: true });
    }

    // 2. Main Menu
    if (d?.mainMenuTemplateSidV2) {
      result.mainMenuSid = d.mainMenuTemplateSidV2;
    } else {
      console.log("[WhatsApp Buttons] Creando template de menú principal...");
      const content = await (twilioClient as any).content.v1.contents.create({
        friendlyName: `jan_main_menu_v2_${Date.now()}`,
        language: "es",
        variables: {},
        types: {
          "twilio/quick-reply": {
            // Sin saludo aquí: el saludo personalizado ya se manda antes en un
            // mensaje de texto aparte. Repetirlo aquí causaba el "saluda dos
            // veces" (texto de bienvenida + este menú saludando otra vez).
            body: "Selecciona una opción para continuar 👇",
            actions: [
              { title: "Ver Catálogo 📦", id: "MENU_CATALOG" },
              { title: "Hablar con Asesor 🙋‍♂️", id: "MENU_HUMAN" },
              { title: "Finalizar Chat 🛑", id: "MENU_END" }
            ]
          },
          "twilio/text": {
            body: "Selecciona una opción para continuar:\n\n1. Ver Catálogo 📦\n2. Hablar con Asesor 🙋‍♂️\n3. Finalizar Chat 🛑"
          }
        }
      });
      result.mainMenuSid = content.sid;
      await setDoc(doc(db, "config", "system"), { mainMenuTemplateSidV2: content.sid }, { merge: true });
    }

    // 3. Categories Menu
    if (d?.categoriesTemplateSidV3) {
      result.categoriesSid = d.categoriesTemplateSidV3;
    } else {
      console.log("[WhatsApp Buttons] Creando template de categorías v3...");
      const content = await (twilioClient as any).content.v1.contents.create({
        friendlyName: `jan_categories_v3_${Date.now()}`,
        language: "es",
        variables: {},
        types: {
          "twilio/quick-reply": {
            body: "Tenemos las mejores ofertas de Colombia. ¡Mira los más vendidos del día o explora nuestras categorías! 👇",
            actions: [
              { title: "🔥 Tendencias 🔥", id: "CAT_TRENDS" },
              { title: "Tecnología 💻", id: "CAT_TECH" },
              { title: "Más Secciones ➡️", id: "CAT_OTHER" }
            ]
          },
          "twilio/text": {
            body: "Selecciona una sección para ver los productos destacados:\n\n- 🔥 Tendencias 🔥\n- Tecnología 💻\n- Más Secciones ➡️"
          }
        }
      });
      result.categoriesSid = content.sid;
      await setDoc(doc(db, "config", "system"), { categoriesTemplateSidV3: content.sid }, { merge: true });
    }

    // 4. Other Categories Menu
    if (d?.otherCategoriesTemplateSidV4) {
      result.otherCategoriesSid = d.otherCategoriesTemplateSidV4;
    } else {
      console.log("[WhatsApp Buttons] Creando template de otras categorías v4...");
      const content = await (twilioClient as any).content.v1.contents.create({
        friendlyName: `jan_other_cats_v4_${Date.now()}`,
        language: "es",
        variables: {},
        types: {
          "twilio/quick-reply": {
            body: "También contamos con estas increíbles secciones. Selecciona una opción 👇",
            actions: [
              { title: "Motos 🏍️", id: "CAT_MOTOS" },
              { title: "Autos 🚗", id: "CAT_AUTOS" },
              { title: "Menú Principal 🔙", id: "MENU_BACK" }
            ]
          },
          "twilio/text": {
            body: "Otras secciones disponibles:\n\n- Motos 🏍️\n- Autos 🚗\n- Menú Principal 🔙"
          }
        }
      });
      result.otherCategoriesSid = content.sid;
      await setDoc(doc(db, "config", "system"), { otherCategoriesTemplateSidV4: content.sid }, { merge: true });
    }

    // 5. Keep Chatting Menu
    if (d?.keepChatTemplateSid) {
      result.keepChatSid = d.keepChatTemplateSid;
    } else {
      console.log("[WhatsApp Buttons] Creando template de continuar chat...");
      const content = await (twilioClient as any).content.v1.contents.create({
        friendlyName: `jan_keep_chat_${Date.now()}`,
        language: "es",
        variables: {},
        types: {
          "twilio/quick-reply": {
            body: "¿Deseas continuar chateando o tienes alguna otra consulta sobre nuestros productos? 👇",
            actions: [
              { title: "Sí, continuar ✅", id: "CHAT_KEEP" },
              { title: "No, finalizar 🛑", id: "CHAT_END" }
            ]
          },
          "twilio/text": {
            body: "¿Deseas continuar chateando o tienes alguna otra consulta sobre nuestros productos?\n\n- Sí, continuar ✅\n- No, finalizar 🛑"
          }
        }
      });
      result.keepChatSid = content.sid;
      await setDoc(doc(db, "config", "system"), { keepChatTemplateSid: content.sid }, { merge: true });
    }

  } catch (e: any) {
    console.error("[WhatsApp Buttons] Error asegurando templates de Twilio Content API:", e.message);
  }

  return result;
}

// ==============================================
// 📋 REGISTRO DE BOTONES ENVIADOS (para el panel admin)
// ==============================================
// Antes, cuando el bot mandaba un mensaje de botones (menú, categorías,
// confirmar pedido, etc.), esa información se perdía apenas Twilio la
// entregaba — el panel de administración solo veía texto plano, nunca los
// botones reales que el cliente estaba viendo en su celular. Esta función
// guarda esos botones en la actividad para que el dashboard los pueda
// dibujar exactamente como se ven en WhatsApp.
async function logOutgoingButtonsActivity(
  customerPhone: string,
  storeId: string,
  botNumber: string,
  bodyText: string,
  buttons: string[]
): Promise<void> {
  try {
    const cleanPhone = customerPhone.replace("whatsapp:", "").trim();
    await addDoc(collection(db, "activities"), {
      from: `whatsapp:${cleanPhone}`,
      to: botNumber,
      recipient: `whatsapp:${cleanPhone}`,
      customerPhone: cleanPhone,
      storeId: storeId || "default",
      message: "[Menú de botones]",
      response: bodyText,
      buttons,
      status: "respondido",
      whatsappStatus: "sent",
      senderType: "bot",
      timestamp: serverTimestamp(),
      receivedAt: serverTimestamp()
    });
  } catch (e: any) {
    console.error("[Log Buttons Activity] Error guardando botones enviados:", e.message);
  }
}

async function sendMainMenu(to: string, from: string): Promise<boolean> {
  if (!twilioClient) return false;
  const templates = await ensureAllTemplates();
  if (!templates.mainMenuSid) return false;
  try {
    await (twilioClient as any).messages.create({
      from: normalizePhone(from || TWILIO_FROM_NUMBER || "+14155238886"),
      to: normalizePhone(to),
      contentSid: templates.mainMenuSid
    });
    console.log(`[WhatsApp Buttons] Menú principal enviado a ${to}`);
    await logOutgoingButtonsActivity(to, "default", from, "Selecciona una opción para continuar 👇", [
      "Ver Catálogo 📦", "Hablar con Asesor 🙋‍♂️", "Finalizar Chat 🛑"
    ]);
    return true;
  } catch (e: any) {
    console.error("[WhatsApp Buttons] Error enviando Menú Principal:", e.message);
    return false;
  }
}

async function sendCategoriesMenu(to: string, from: string): Promise<boolean> {
  if (!twilioClient) return false;
  const templates = await ensureAllTemplates();
  if (!templates.categoriesSid) return false;
  try {
    await (twilioClient as any).messages.create({
      from: normalizePhone(from || TWILIO_FROM_NUMBER || "+14155238886"),
      to: normalizePhone(to),
      contentSid: templates.categoriesSid
    });
    console.log(`[WhatsApp Buttons] Menú de categorías enviado a ${to}`);
    await logOutgoingButtonsActivity(to, "default", from, "Tenemos las mejores ofertas de Colombia. ¡Mira los más vendidos del día o explora nuestras categorías! 👇", [
      "🔥 Tendencias 🔥", "Tecnología 💻", "Más Secciones ➡️"
    ]);
    return true;
  } catch (e: any) {
    console.error("[WhatsApp Buttons] Error enviando Menú de Categorías:", e.message);
    return false;
  }
}

async function sendOtherCategoriesMenu(to: string, from: string): Promise<boolean> {
  if (!twilioClient) return false;
  const templates = await ensureAllTemplates();
  if (!templates.otherCategoriesSid) return false;
  try {
    await (twilioClient as any).messages.create({
      from: normalizePhone(from || TWILIO_FROM_NUMBER || "+14155238886"),
      to: normalizePhone(to),
      contentSid: templates.otherCategoriesSid
    });
    console.log(`[WhatsApp Buttons] Menú de otras categorías enviado a ${to}`);
    return true;
  } catch (e: any) {
    console.error("[WhatsApp Buttons] Error enviando Menú de Otras Categorías:", e.message);
    return false;
  }
}
async function sendKeepChatPrompt(to: string, from: string): Promise<boolean> {
  if (!twilioClient) return false;
  const templates = await ensureAllTemplates();
  if (!templates.keepChatSid) return false;
  try {
    await (twilioClient as any).messages.create({
      from: normalizePhone(from || TWILIO_FROM_NUMBER || "+14155238886"),
      to: normalizePhone(to),
      contentSid: templates.keepChatSid
    });
    console.log(`[WhatsApp Buttons] Prompt de continuar chat enviado a ${to}`);
    return true;
  } catch (e: any) {
    console.error("[WhatsApp Buttons] Error enviando Prompt de Continuar Chat:", e.message);
    return false;
  }
}

const CATEGORY_PAGE_SIZE = 9; // dejamos 1 slot libre para el item "Ver más" (límite WhatsApp = 10)

function normalizeCatText(s: string): string {
  return String(s || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

// ── Campaña Automática de Tendencias ────────────────────────────────────────
// Cuando se agrega un producto nuevo (marcado trending:true), este motor:
// 1. Busca clientes candidatos combinando (a) categoría de compras previas
//    y (b) un pase de IA que personaliza y filtra quién de verdad lo querría.
// 2. Respeta un cooldown para no aburrir al mismo cliente con ofertas seguidas.
// 3. Reparte el envío: primeros 15 al instante, el resto en tandas de 15 cada
//    3 horas, solo entre 8am y 9pm (para no rozar límites de spam de WhatsApp).
const TREND_INSTANT_BATCH_SIZE = 15;
const TREND_BATCH_SIZE = 15;
const TREND_BATCH_INTERVAL_MS = 3 * 60 * 60 * 1000; // 3 horas
const TREND_COOLDOWN_MS = 4 * 24 * 60 * 60 * 1000; // 4 días sin repetir oferta al mismo cliente
const TREND_WINDOW_START_HOUR = 8;
const TREND_WINDOW_END_HOUR = 21;

function nextSendableTime(base: Date): Date {
  const d = new Date(base);
  if (d.getHours() < TREND_WINDOW_START_HOUR) {
    d.setHours(TREND_WINDOW_START_HOUR, 0, 0, 0);
  } else if (d.getHours() >= TREND_WINDOW_END_HOUR) {
    d.setDate(d.getDate() + 1);
    d.setHours(TREND_WINDOW_START_HOUR, 0, 0, 0);
  }
  return d;
}

async function triggerTrendCampaign(product: any, storeId: string): Promise<void> {
  try {
    if (!product?.id || !product?.name) {
      console.warn("[Trend Campaign] Producto inválido, se omite campaña.");
      return;
    }

    const ordersSnap = await getDocs(query(collection(db, "orders"), where("storeId", "==", storeId)));
    const allOrders = ordersSnap.docs.map(d => d.data() as any);

    // Agrupar compras por teléfono normalizado
    const byPhone = new Map<string, any[]>();
    for (const o of allOrders) {
      const phone = normalizePhoneForMeta(o.customerPhone || "");
      if (!phone) continue;
      if (!byPhone.has(phone)) byPhone.set(phone, []);
      byPhone.get(phone)!.push(o);
    }

    const catalogProducts = await loadProductsForStore(storeId);
    const productCategory = (product.category || "General").toLowerCase();

    // Señal 1: coincidencia por categoría de compras previas
    const categoryCandidates: { phone: string; name: string; orders: any[] }[] = [];
    for (const [phone, orders] of byPhone.entries()) {
      const matchesCategory = orders.some(o => {
        const matchProd = catalogProducts.find((p: any) =>
          p.name && o.productName && (o.productName.includes(p.name) || p.name.includes(o.productName))
        );
        const cat = (matchProd?.category || "").toLowerCase();
        return cat && cat === productCategory;
      });
      if (matchesCategory) {
        categoryCandidates.push({ phone, name: orders[0]?.customerName || "Cliente", orders });
      }
    }

    if (categoryCandidates.length === 0) {
      console.log(`[Trend Campaign] Sin clientes con historial en la categoría "${productCategory}" para "${product.name}". No se envía nada.`);
      return;
    }

    // Filtro de cooldown + opt-out: nadie recibe una oferta de tendencia si ya recibió
    // una hace poco, NI si pidió explícitamente no recibir más mensajes de marketing.
    const eligible: { phone: string; name: string; orders: any[] }[] = [];
    for (const c of categoryCandidates) {
      const custId = customerDocId(storeId, c.phone);
      const custSnap = await getDoc(doc(db, "customers", custId));
      const custData = custSnap.exists() ? custSnap.data() : null;
      if (custData?.marketingOptOut) continue;
      const lastOffer = custData?.lastTrendOfferAt || 0;
      if (Date.now() - lastOffer < TREND_COOLDOWN_MS) continue;
      eligible.push(c);
    }

    if (eligible.length === 0) {
      console.log(`[Trend Campaign] Todos los candidatos de "${product.name}" están en cooldown. No se envía nada por ahora.`);
      return;
    }

    // Señal 2: pase de IA — personaliza el mensaje y filtra quién de verdad calza
    // (una sola llamada por campaña, para no disparar 1 request de IA por cliente)
    let personalized: Record<string, { message: string; wants: boolean }> = {};
    try {
      const apiKey = process.env.OPENROUTER_API_KEY || process.env.NVIDIA_API_KEY;
      if (apiKey) {
        const candidatesStr = eligible
          .map(c => `- Teléfono: "${c.phone}", Nombre: "${c.name}", Compras previas: ${c.orders.map(o => o.productName).join(" | ")}`)
          .join("\n");
        const prompt = `Producto nuevo en tendencia: "${product.name}" (categoría: ${product.category}, precio: $${product.price} COP).

Clientes candidatos (ya compraron antes en la misma categoría):
${candidatesStr}

Para cada cliente, decide si le tiene sentido ofrecerle este producto según su historial, y si sí, escribe un mensaje corto de WhatsApp (máximo 2 líneas, cálido, con 1-2 emojis, mencionando su compra anterior) ofreciendo este producto en tendencia con envío gratis contraentrega.

Devuelve ÚNICAMENTE un JSON válido con esta forma exacta, una entrada por cada teléfono:
{ "TELEFONO": { "wants": true, "message": "mensaje personalizado" } }`;

        const resp = await axios.post(
          "https://openrouter.ai/api/v1/chat/completions",
          {
            model: "google/gemini-2.5-flash",
            messages: [{ role: "user", content: prompt }],
            response_format: { type: "json_object" }
          },
          {
            headers: { Authorization: `Bearer ${process.env.OPENROUTER_API_KEY || process.env.NVIDIA_API_KEY}` },
            timeout: 20000
          }
        );
        const raw = resp.data?.choices?.[0]?.message?.content || "{}";
        personalized = JSON.parse(String(raw).replace(/```json|```/g, "").trim());
      }
    } catch (e: any) {
      console.warn("[Trend Campaign] La IA de personalización falló, se usará mensaje genérico para todos:", e.message);
    }

    // Combina las dos señales: si la IA respondió, usa su filtro (wants=false se descarta);
    // si la IA no respondió (sin API key o error), se conserva todo el filtro por categoría.
    const finalList = eligible.filter(c => {
      const p = personalized[c.phone];
      return !p || p.wants !== false;
    });

    if (finalList.length === 0) {
      console.log(`[Trend Campaign] La IA descartó a todos los candidatos para "${product.name}".`);
      return;
    }

    const campaignId = `${product.id}_${Date.now()}`;
    await setDoc(doc(db, "trendCampaigns", campaignId), {
      productId: product.id,
      productName: product.name,
      storeId,
      totalCandidates: finalList.length,
      createdAt: serverTimestamp()
    });

    const batch = writeBatch(db);
    let scheduledAt = new Date();
    finalList.forEach((c, idx) => {
      const isInstant = idx < TREND_INSTANT_BATCH_SIZE;
      if (!isInstant && (idx - TREND_INSTANT_BATCH_SIZE) % TREND_BATCH_SIZE === 0) {
        const batchIndex = Math.floor((idx - TREND_INSTANT_BATCH_SIZE) / TREND_BATCH_SIZE) + 1;
        scheduledAt = nextSendableTime(new Date(Date.now() + batchIndex * TREND_BATCH_INTERVAL_MS));
      }
      const defaultMsg = `¡Hola ${c.name}! 🔥 Nos llegó algo en tendencia que te va a encantar según tus compras anteriores: *${product.name}*. ¡Envío gratis contraentrega!`;
      const finalMessage = personalized[c.phone]?.message || defaultMsg;

      batch.set(doc(db, "trendQueue", `${campaignId}_${c.phone}`), {
        campaignId,
        productId: product.id,
        productName: product.name,
        productImage: product.imageUrl || "",
        productPrice: product.price || 0,
        storeId,
        phone: c.phone,
        customerName: c.name,
        message: finalMessage,
        status: "pending",
        scheduledAt: isInstant ? new Date() : scheduledAt,
        createdAt: serverTimestamp()
      });
    });
    await batch.commit();

    console.log(`[Trend Campaign] Cola creada: ${finalList.length} clientes para "${product.name}" (${Math.min(finalList.length, TREND_INSTANT_BATCH_SIZE)} al instante, el resto escalonado).`);
  } catch (e: any) {
    console.error("[Trend Campaign] Error:", e.message);
  }
}

// Revisa la cola cada 5 minutos y envía lo que ya esté "vencido" (scheduledAt <= ahora),
// respetando siempre el límite por tanda para no disparar todo de golpe.
async function dispatchTrendQueue(): Promise<void> {
  try {
    const now = new Date();
    const qPending = query(collection(db, "trendQueue"), where("status", "==", "pending"), limit(TREND_BATCH_SIZE));
    const snap = await getDocs(qPending);
    if (snap.empty) return;

    for (const d of snap.docs) {
      const item = d.data() as any;
      const scheduledAt = item.scheduledAt?.toDate ? item.scheduledAt.toDate() : new Date(item.scheduledAt);
      if (scheduledAt > now) continue;

      const sent = await sendTrendOfferButtons(
        item.phone,
        TWILIO_FROM_NUMBER || "+14155238886",
        item.productName,
        item.message,
        item.productImage
      );

      await updateDoc(d.ref, { status: sent ? "sent" : "failed", sentAt: Date.now() });

      if (sent) {
        await setDoc(doc(db, "customers", customerDocId(item.storeId, item.phone)), { lastTrendOfferAt: Date.now() }, { merge: true });
        await addDoc(collection(db, "activities"), {
          from: normalizePhone(TWILIO_FROM_NUMBER || ""),
          to: `+${item.phone}`,
          message: item.message,
          status: "respondido",
          whatsappStatus: "sent",
          manualAgent: "AI Trend Campaign",
          createdAt: serverTimestamp(),
          storeId: item.storeId,
          timestamp: serverTimestamp(),
        });
      }
    }
  } catch (e: any) {
    console.error("[Trend Dispatcher] Error:", e.message);
  }
}

async function sendTrendingProducts(to: string, from: string, assignedStoreId: string, offset: number = 0) {
  try {
    const products = await loadProductsForStore(assignedStoreId);
    
    const TRENDING_IDS = [
      "cargador-aromatizante-carro",
      "game-stick-retro-m8",
      "mini-pulidora-inalambrica",
      "soporte-de-carga-magnetica",
      "selfie-stick-tripode",
      "iniciador-de-bateria",
      "aspiradora-de-mano",
      "carpa-cobertor-carro",
      "candado-moto-manubrio",
      "cargador-celular-moto",
      "soporte-holder-moto"
    ];

    const matched = products.filter((p: any) => {
      const origId = p.id.includes("_") ? p.id.split("_").slice(1).join("_") : p.id;
      return TRENDING_IDS.includes(origId);
    });

    matched.sort((a: any, b: any) => {
      const aOrig = a.id.includes("_") ? a.id.split("_").slice(1).join("_") : a.id;
      const bOrig = b.id.includes("_") ? b.id.split("_").slice(1).join("_") : b.id;
      return TRENDING_IDS.indexOf(aOrig) - TRENDING_IDS.indexOf(bOrig);
    });

    const page = matched.slice(offset, offset + CATEGORY_PAGE_SIZE);
    const hasMore = matched.length > offset + CATEGORY_PAGE_SIZE;

    const baseUrl = (currentAppUrl || process.env.APP_URL || "https://chatbotjanadsia.up.railway.app").replace(/\/$/, "");
    const landingUrl = `${baseUrl}/landing`;

    let responseText = `🔥 *PRODUCTOS EN TENDENCIA — JAN SEL SHOP* 🔥\n\nEstos son nuestros productos más vendidos y recomendados de hoy:\n`;
    
    responseText += `\n⚠️ *RECUERDA:* Vendemos cualquier tipo de producto que imagines. Si buscas algo específico que no ves en esta lista, ¡solo pregúntame por él aquí mismo! 📲\n`;

    const TWILIO_BODY_LIMIT = 1550;
    if (responseText.length > TWILIO_BODY_LIMIT) {
      responseText = responseText.slice(0, TWILIO_BODY_LIMIT - 20).trimEnd() + "\n…(sigue en la lista 👇)";
    }

    await sendWhatsApp(to, responseText, undefined, undefined, from);

    // 🛒 REDUCIR FRICCIÓN: en vez de que el único camino sea salir a la
    // página web, mandamos el producto #1 más destacado como tarjeta de
    // compra instantánea (imagen + botón "Sí, la quiero 🛒") directo en el
    // chat. Solo en la primera página para no repetirla en "ver más".
    if (offset === 0 && page.length > 0) {
      const featured = page[0];
      const featuredImg = featured.imageUrl && featured.imageUrl.startsWith("/")
        ? `${baseUrl}${featured.imageUrl}`
        : (featured.imageUrl || "https://via.placeholder.com/600");
      await sendTrendOfferButtons(
        to, from,
        featured.name,
        `🔥 ¡Nuestro producto más pedido! $${Number(featured.price || 0).toLocaleString("es-CO")} COP — Envío gratis contraentrega. Cómpralo aquí mismo, sin salir de WhatsApp 👇`,
        featuredImg,
        featured.price
      );
    }

    await sendLandingPageButton(to, from, landingUrl);

    if (matched.length === 0) return;

    const cleanClientPhone = to.replace('whatsapp:', '').trim();
    const customerProfileId = customerDocId(assignedStoreId, cleanClientPhone);

    await setDoc(doc(db, "customers", customerProfileId), {
      lastCategorySearch: { categories: ["trends"], categoryLabel: "Tendencias 🔥", nextOffset: offset + CATEGORY_PAGE_SIZE, isTrends: true }
    }, { merge: true });

    const categoryKey = `trends_p${offset}`;

    setTimeout(async () => {
      const sent = await sendProductListPicker(to, from, page, categoryKey, customerProfileId, hasMore);
      if (!sent) {
        await sendWhatsApp(to, "¿Cuál de estos productos en tendencia te interesó? 🚛💨 ¡Escríbeme el nombre o número y te lo reservo de una! 🔥", undefined, undefined, from);
      }
    }, 1500);

  } catch (e: any) {
    console.error(`[WhatsApp Buttons] Error enviando tendencias destacadas:`, e.message);
  }
}

// `category` puede ser un string (una sola palabra clave) o un array de
// palabras clave (ej: ["hogar","cocina","aseo"]) para que un solo botón de
// menú cubra varias categorías reales del catálogo sin dejar productos fuera.
async function sendCategoryFeaturedProducts(to: string, from: string, category: string | string[], categoryLabel: string, assignedStoreId: string, offset: number = 0) {
  try {
    const products = await loadProductsForStore(assignedStoreId);
    const categories = Array.isArray(category) ? category : [category];
    const searchCats = categories.map(normalizeCatText);

    const matched = products.filter((p: any) => {
      if (!p.category) return false;
      const prodCat = normalizeCatText(p.category);
      return searchCats.some(sc => prodCat.includes(sc) || sc.includes(prodCat));
    });

    const page = matched.slice(offset, offset + CATEGORY_PAGE_SIZE);
    const hasMore = matched.length > offset + CATEGORY_PAGE_SIZE;

    let responseText = ``;

    if (matched.length === 0) {
      responseText += `Actualmente estamos actualizando esta sección, pero contamos con excelentes opciones. ¡Pregúntame por lo que buscas! 🛒\n\n`;
    }

    const baseUrl = (currentAppUrl || process.env.APP_URL || "https://chatbotjanadsia.up.railway.app").replace(/\/$/, "");
    const landingUrl = `${baseUrl}/landing`;

    responseText += `⚠️ *RECUERDA:* Vendemos cualquier tipo de producto que imagines. Si buscas algo específico (marca, modelo, tipo de artículo) que no ves aquí, ¡solo pregúntame por él por este chat para confirmar disponibilidad y precio de inmediato! 📲\n`;

    // Red de seguridad: por más que acortemos, nunca dejar pasar un mensaje que
    // exceda el límite de Twilio/WhatsApp (1600 caracteres).
    const TWILIO_BODY_LIMIT = 1550;
    if (responseText.length > TWILIO_BODY_LIMIT) {
      responseText = responseText.slice(0, TWILIO_BODY_LIMIT - 20).trimEnd() + "\n…(sigue en la lista 👇)";
    }

    // Enviar la lista de productos en texto
    await sendWhatsApp(to, responseText, undefined, undefined, from);

    await sendLandingPageButton(to, from, landingUrl);

    if (matched.length === 0) return;

    const cleanClientPhone = to.replace('whatsapp:', '').trim();
    const customerProfileId = customerDocId(assignedStoreId, cleanClientPhone);

    // Guardamos la búsqueda activa (categorías + próximo offset) para poder
    // resolver el tap en "➡️ Ver más productos" sin tener que codificar todo
    // en el id del item (que tiene límite de caracteres).
    await setDoc(doc(db, "customers", customerProfileId), {
      lastCategorySearch: { categories, categoryLabel, nextOffset: offset + CATEGORY_PAGE_SIZE }
    }, { merge: true });

    const categoryKey = `${searchCats.join("_")}_p${offset}`;

    // Enviar la lista interactiva (tocable) para que elija el producto con un tap
    setTimeout(async () => {
      const sent = await sendProductListPicker(to, from, page, categoryKey, customerProfileId, hasMore);
      if (!sent) {
        // Fallback: si no se pudo crear/enviar la lista interactiva, seguimos con texto libre
        await sendWhatsApp(to, "¿Cuál de estos productos te interesó para agendar tu despacho hoy mismo con *ENVÍO GRATIS* y *PAGO CONTRA ENTREGA*? 🚛💨 ¡Escríbeme el nombre o número y te lo reservo de una! 🔥", undefined, undefined, from);
      }
    }, 1500);

  } catch (e: any) {
    console.error(`[WhatsApp Buttons] Error enviando productos destacados para categoría ${category}:`, e.message);
  }
}

// ==============================================
// 🛒 LISTA INTERACTIVA DE PRODUCTOS + CARRITO (WhatsApp List Picker)
// ==============================================
// WhatsApp/Twilio no soporta selección múltiple dentro de una sola lista, así que
// el flujo es: el cliente toca UN producto de la lista -> se agrega al carrito ->
// le mostramos botones "➕ Agregar otro" / "✅ Confirmar pedido". Así puede
// repetir cuantas veces quiera antes de cerrar el pedido.

// Crea (o reutiliza, si el catálogo no cambió) el Content Template de tipo
// twilio/list-picker para una categoría específica. Se cachea por hash del
// contenido para no crear un template nuevo en cada mensaje.
async function ensureProductListTemplate(categoryKey: string, items: any[], hasMore: boolean = false): Promise<string | null> {
  if (!twilioClient) return null;
  try {
    const hashSource = items.map((p: any) => `${p.name}|${p.price}`).join(";") + `|hasMore=${hasMore}|v2`;
    const hash = crypto.createHash("md5").update(hashSource).digest("hex").slice(0, 12);
    const cfgKey = `productListSid_${categoryKey}`;
    const cfgHashKey = `productListHash_${categoryKey}`;

    const cfgSnap = await getDoc(doc(db, "config", "system"));
    const d = cfgSnap.exists() ? cfgSnap.data() : {};
    if (d?.[cfgKey] && d?.[cfgHashKey] === hash) {
      return d[cfgKey];
    }

    const listItems = items.map((p: any, idx: number) => ({
      item: String(p.name || `Producto ${idx + 1}`).slice(0, 24),
      id: `PROD_${idx}`,
      description: `$${Number(p.price || 0).toLocaleString("es-CO")} COP`.slice(0, 72)
    }));

    if (hasMore) {
      listItems.push({
        item: "➡️ Ver más productos",
        id: "MORE_PAGE",
        description: "Toca aquí para ver más opciones de esta sección"
      });
    }

    const textFallback = items
      .map((p: any, idx: number) => `${idx + 1}. ${p.name} - $${Number(p.price || 0).toLocaleString("es-CO")}`)
      .join("\n") + (hasMore ? `\n\nEscribe "más" para ver más opciones.` : "");

    const content = await (twilioClient as any).content.v1.contents.create({
      friendlyName: `jan_prodlist_${categoryKey}_${Date.now()}`,
      language: "es",
      variables: {},
      types: {
        "twilio/list-picker": {
          body: "👀 *¿Cuál de estos te gustó más?*\n\nToca *Ver productos* 👇, o simplemente dime el nombre o número aquí mismo y te lo aparto de una vez antes de que se agote. 🙌",
          button: "Ver productos 📦",
          items: listItems
        },
        "twilio/text": {
          body: `👀 ¿Cuál de estos te gustó más? Escríbeme el número y te lo aparto de una:\n\n${textFallback}`
        }
      }
    });

    await setDoc(doc(db, "config", "system"), { [cfgKey]: content.sid, [cfgHashKey]: hash }, { merge: true });
    console.log(`[WhatsApp List] Template de lista creado para categoría ${categoryKey}: ${content.sid}`);
    return content.sid;
  } catch (e: any) {
    console.error(`[WhatsApp List] Error creando lista de productos (${categoryKey}):`, e.message);
    return null;
  }
}

// Envía la lista interactiva y guarda en el perfil del cliente qué productos se
// le mostraron (índice -> producto), para poder resolver cuál tocó.

// ── Menú de combos por WhatsApp ─────────────────────────────────────────────
// Se apoya en el mismo mecanismo de listas que ya se usa para productos (hasta
// 10 opciones, con la plantilla cacheada por hash para no recrearla en cada
// envío). Los combos son lo que mejor margen deja, así que merecen su propia
// entrada y no quedar solo como sugerencia suelta dentro de una conversación.
async function ensureCombosListTemplate(items: typeof ACTIVE_PROMOTIONS): Promise<string | null> {
  if (!twilioClient) return null;
  try {
    const hashSource = items.map(c => `${c.id}|${c.promoPrice}`).join(";") + "|combos_v1";
    const hash = crypto.createHash("md5").update(hashSource).digest("hex").slice(0, 12);

    const cfgSnap = await getDoc(doc(db, "config", "system"));
    const d = cfgSnap.exists() ? cfgSnap.data() : {};
    if (d?.combosListSid && d?.combosListHash === hash) return d.combosListSid;

    const listItems = items.map((c, idx) => ({
      // Twilio corta los títulos de lista en 24 caracteres y rechaza emojis en
      // los botones, así que el nombre va limpio y el gancho en la descripción.
      item: String(c.name).slice(0, 24),
      id: `COMBO_${idx}`,
      description: `$${c.promoPrice.toLocaleString("es-CO")} — ahorras $${(c.originalPrice - c.promoPrice).toLocaleString("es-CO")}`.slice(0, 72)
    }));

    const textFallback = items
      .map((c, idx) => `${idx + 1}. ${c.name} - $${c.promoPrice.toLocaleString("es-CO")} (ahorras $${(c.originalPrice - c.promoPrice).toLocaleString("es-CO")})`)
      .join(String.fromCharCode(10));

    const content = await (twilioClient as any).content.v1.contents.create({
      friendlyName: `jan_combos_list_${Date.now()}`,
      language: "es",
      variables: {},
      types: {
        "twilio/list-picker": {
          body: "🎁 Estos son nuestros combos. Llevando el combo pagas menos que comprando por separado 👇",
          button: "Ver combos",
          items: listItems
        },
        "twilio/text": {
          body: `🎁 *NUESTROS COMBOS*${String.fromCharCode(10)}${String.fromCharCode(10)}${textFallback}${String.fromCharCode(10)}${String.fromCharCode(10)}Respóndeme con el número del que te interese.`
        }
      }
    });

    await setDoc(doc(db, "config", "system"), { combosListSid: content.sid, combosListHash: hash }, { merge: true });
    return content.sid;
  } catch (e: any) {
    console.error("[WhatsApp Combos] Error creando la lista de combos:", e.message);
    return null;
  }
}

async function sendCombosList(to: string, from: string, customerProfileId: string): Promise<boolean> {
  if (!twilioClient) return false;
  const combos = ACTIVE_PROMOTIONS.slice(0, 10);
  if (combos.length === 0) return false;

  const contentSid = await ensureCombosListTemplate(combos as any);
  if (!contentSid) {
    // Sin plantilla (Twilio caído o en revisión) igual se responde en texto: es
    // preferible un mensaje plano a dejar al cliente sin respuesta.
    const NL = String.fromCharCode(10);
    const texto = "🎁 *NUESTROS COMBOS*" + NL + NL +
      combos.map((c, i) => `${i + 1}. *${c.name}* — $${c.promoPrice.toLocaleString("es-CO")} (ahorras $${(c.originalPrice - c.promoPrice).toLocaleString("es-CO")})`).join(NL) +
      NL + NL + "Dime el número del que quieras y te cuento qué trae 🙌";
    await sendWhatsApp(to, texto, undefined, undefined, from);
    return true;
  }

  try {
    // Se guarda la lista mostrada para poder resolver después qué eligió.
    await setDoc(doc(db, "customers", customerProfileId), {
      lastCombosList: combos.map(c => ({ id: c.id, name: c.name, promoPrice: c.promoPrice }))
    }, { merge: true });

    await (twilioClient as any).messages.create({
      from: normalizePhone(from || TWILIO_FROM_NUMBER || "+14155238886"),
      to: normalizePhone(to),
      contentSid
    });
    console.log(`[WhatsApp Combos] Lista de combos enviada a ${to}`);
    return true;
  } catch (e: any) {
    console.error("[WhatsApp Combos] Error enviando la lista:", e.message);
    return false;
  }
}

// Detalle de un combo con todo lo que el cliente necesita para decidir, y un
// cierre por elección en vez de un "¿lo quieres?" que invita al no.
function textoDetalleCombo(combo: typeof ACTIVE_PROMOTIONS[0], productos: any[]): string {
  const NL = String.fromCharCode(10);
  const incluidos = combo.productIds
    .map(pid => productos.find((p: any) => {
      const origId = String(p.id).includes("_") ? String(p.id).split("_").slice(1).join("_") : String(p.id);
      return origId === pid;
    }))
    .filter(Boolean)
    .map((p: any) => `✅ ${p.name}`)
    .join(NL);

  const ahorro = combo.originalPrice - combo.promoPrice;
  return [
    `🎁 *${combo.name}*`,
    "",
    incluidos || combo.tagline,
    "",
    `~~$${combo.originalPrice.toLocaleString("es-CO")}~~  →  *$${combo.promoPrice.toLocaleString("es-CO")}*`,
    `💰 Te ahorras $${ahorro.toLocaleString("es-CO")}`,
    "",
    "🚛 Envío gratis y pagas cuando lo recibas",
    "",
    "¿Te lo despacho hoy o prefieres mañana?"
  ].join(NL);
}
async function sendProductListPicker(to: string, from: string, products: any[], categoryKey: string, customerProfileId: string, hasMore: boolean = false): Promise<boolean> {
  if (!twilioClient) return false;
  // `products` ya viene paginado (máx 9) por sendCategoryFeaturedProducts; si se
  // llama desde otro lado con más de 9, igual respetamos el límite de 10 de WhatsApp
  // dejando espacio para el item "Ver más" cuando aplique.
  const maxItems = hasMore ? 9 : 10;
  const top = products.slice(0, maxItems);
  if (top.length === 0) return false;

  const contentSid = await ensureProductListTemplate(categoryKey, top, hasMore);
  if (!contentSid) return false;

  try {
    await setDoc(doc(db, "customers", customerProfileId), {
      lastProductList: top.map((p: any) => ({ name: p.name, price: Number(p.price || 0) }))
    }, { merge: true });

    await (twilioClient as any).messages.create({
      from: normalizePhone(from || TWILIO_FROM_NUMBER || "+14155238886"),
      to: normalizePhone(to),
      contentSid
    });
    console.log(`[WhatsApp List] Lista de productos (${categoryKey}) enviada a ${to}`);

    const buttonLabels = top.map((p: any) => `${p.name} — $${Number(p.price || 0).toLocaleString("es-CO")} COP`);
    if (hasMore) buttonLabels.push("➡️ Ver más productos");
    await logOutgoingButtonsActivity(
      to,
      "default",
      from,
      "👀 ¿Cuál de estos te gustó más? Toca Ver productos o dime el nombre y te lo aparto de una.",
      buttonLabels
    );

    // 📌 SEGUIMIENTO AUTOMÁTICO: este es el punto exacto donde más clientes
    // "desaparecen" (ven la lista de productos y nunca vuelven a escribir).
    // Programamos un mensaje de recordatorio con gatillo mental si no
    // responden en un rato — antes esto solo se disparaba cuando la IA
    // respondía con texto, pero la mayoría de la navegación es por botones,
    // así que ese seguimiento casi nunca se activaba en la práctica.
    scheduleFollowUp(to, 45, `Vio la lista de productos de la categoría "${categoryKey}" y no confirmó nada`, "default").catch(e =>
      console.error("[Follow-up] Error programando seguimiento tras lista de productos:", e.message)
    );

    return true;
  } catch (e: any) {
    console.error(`[WhatsApp List] Error enviando lista de productos:`, e.message);
    return false;
  }
}

// ==============================================
// 🌐 BOTÓN DE ENLACE A LA PÁGINA WEB (Call To Action - Abre URL directamente)
// ==============================================
async function ensureLandingPageCallToActionTemplate(landingUrl: string): Promise<string | null> {
  if (!twilioClient) return null;
  try {
    const cfgSnap = await getDoc(doc(db, "config", "system"));
    const d = cfgSnap.exists() ? cfgSnap.data() : {};
    const existingSid = d?.landingCtaSidV5;
    if (existingSid) return existingSid;

    const content = await (twilioClient as any).content.v1.contents.create({
      friendlyName: `jan_landing_cta_v6_${Date.now()}`,
      language: "es",
      variables: {},
      types: {
        "twilio/call-to-action": {
          body: "🌐 *¿Prefieres explorar todo nuestro catálogo con fotos y descripciones detalladas?*\n\nToca el botón de abajo para ir directamente a nuestra página web oficial:",
          actions: [
            {
              type: "URL",
              title: "🌐 Ver en Página Web",
              url: landingUrl
            }
          ]
        }
      }
    });

    await setDoc(doc(db, "config", "system"), { landingCtaSidV5: content.sid }, { merge: true });
    console.log(`[WhatsApp CTA] Template CTA de landing creado: ${content.sid}`);
    return content.sid;
  } catch (e: any) {
    console.error(`[WhatsApp CTA] Error creando template CTA:`, e.message);
    return null;
  }
}

async function sendLandingPageButton(to: string, from: string, landingUrl: string): Promise<boolean> {
  if (!twilioClient) return false;
  try {
    const contentSid = await ensureLandingPageCallToActionTemplate(landingUrl);
    if (!contentSid) return false;

    await (twilioClient as any).messages.create({
      from: normalizePhone(from || TWILIO_FROM_NUMBER || "+14155238886"),
      to: normalizePhone(to),
      contentSid
    });
    console.log(`[WhatsApp CTA] Botón CTA de landing enviado correctamente a ${to}`);
    scheduleFollowUp(to, 40, "Tocó el botón de ver la página web/catálogo completo y no volvió a escribir", "default").catch(e =>
      console.error("[Follow-up] Error programando seguimiento tras botón de landing:", e.message)
    );
    await logOutgoingButtonsActivity(to, "default", from, "🌐 ¿Prefieres explorar todo nuestro catálogo con fotos y descripciones detalladas?", [
      "🌐 Ver en Página Web"
    ]);
    return true;
  } catch (e: any) {
    console.error(`[WhatsApp CTA] Error enviando botón CTA de landing:`, e.message);
    return false;
  }
}


// Botones "➕ Agregar otro producto" / "✅ Confirmar pedido" que aparecen justo
// después de que el cliente toca un producto de la lista.
async function ensureCartActionTemplate(): Promise<string | null> {
  if (!twilioClient) return null;
  try {
    const cfgSnap = await getDoc(doc(db, "config", "system"));
    // Versionado a V2: el template viejo (cacheado en Firestore) solo tenía 2
    // acciones (Agregar otro / Confirmar). Si seguíamos leyendo la key vieja,
    // el nuevo botón de "Quitar producto" nunca se habría mostrado de verdad.
    const existingSid = cfgSnap.exists() ? cfgSnap.data()?.cartActionTemplateSidV2 : null;
    if (existingSid) return existingSid;

    const content = await (twilioClient as any).content.v1.contents.create({
      friendlyName: `jan_cart_action_v2_${Date.now()}`,
      language: "es",
      variables: { "1": "1x Producto - $50.000" },
      types: {
        "twilio/quick-reply": {
          body: "🛒 *Tu carrito:*\n{{1}}\n\n¿Qué quieres hacer?",
          actions: [
            { title: "➕ Agregar otro", id: "CART_ADD_MORE" },
            { title: "✅ Confirmar pedido", id: "CART_CHECKOUT" },
            { title: "🗑️ Quitar producto", id: "CART_REMOVE" }
          ]
        },
        "twilio/text": {
          body: "🛒 Tu carrito:\n{{1}}\n\n¿Deseas agregar otro producto, confirmarlo o quitar algo? Responde AGREGAR, CONFIRMAR o QUITAR."
        }
      }
    });

    await setDoc(doc(db, "config", "system"), { cartActionTemplateSidV2: content.sid }, { merge: true });
    return content.sid;
  } catch (e: any) {
    console.error("[WhatsApp Buttons] Error creando template de carrito:", e.message);
    return null;
  }
}

async function sendCartActionButtons(to: string, from: string, cartSummary: string, total: number): Promise<boolean> {
  if (!twilioClient) return false;
  const contentSid = await ensureCartActionTemplate();
  if (!contentSid) return false;

  try {
    const line = `${cartSummary}\n💵 *Total: $${total.toLocaleString("es-CO")} COP*`.slice(0, 620);
    await (twilioClient as any).messages.create({
      from: normalizePhone(from || TWILIO_FROM_NUMBER || "+14155238886"),
      to: normalizePhone(to),
      contentSid,
      contentVariables: JSON.stringify({ "1": line })
    });
    await logOutgoingButtonsActivity(to, "default", from, line, [
      "➕ Agregar otro", "✅ Confirmar pedido", "🗑️ Quitar producto"
    ]);
    return true;
  } catch (e: any) {
    console.error("[WhatsApp Buttons] Error enviando botones de carrito:", e.message);
    return false;
  }
}

// ── VENTA DETERMINÍSTICA DE UN SOLO PRODUCTO ─────────────────────────────────
// El cliente que llegaba desde la ficha web preguntando por un producto puntual
// caía en el interceptor de catálogo (su mensaje trae "producto" y "tienen") y
// recibía el saludo genérico más la lista completa de tendencias, sin que la IA
// llegara a verlo siquiera. Pedía UNA cosa y se iba con quince opciones.
// Aquí se detecta cuál producto está nombrando, se le manda SU ficha de venta y
// se entra directo a pedir los datos. Sin IA: el mismo mensaje siempre, sin
// margen para que improvise ni para que se desvíe a otro producto.

function normalizarParaBuscar(s: string): string {
  return String(s || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// Palabras que aparecen en casi cualquier mensaje y no distinguen un producto de
// otro. Sin esta lista, "producto" o "precio" sumarían puntos por sí solas.
const PALABRAS_NO_DISTINTIVAS = new Set([
  "producto", "productos", "precio", "cop", "hola", "interesa", "vengo",
  "pagina", "tienen", "tiene", "hay", "envio", "hoy", "disponible", "quiero",
  "necesito", "cuanto", "vale", "cuesta", "para", "con", "del", "las", "los",
  "shop", "jan", "sel", "jansel", "que", "por", "una", "uno"
]);

// Devuelve el producto del catálogo que el cliente está nombrando, o null.
// Compara por palabras significativas y no por igualdad: el nombre que manda la
// web ("Modulador Cargador Aromatizante 4 en 1") no es idéntico al del catálogo
// ("Modulador Cargador Aromatizante Carro TC"), así que comparar textos completos
// fallaría siempre.
function detectarProductoUnico(mensaje: string, products: any[]): any | null {
  const texto = normalizarParaBuscar(mensaje);
  if (!texto) return null;

  // La ficha web manda el nombre entre asteriscos ("Me interesa: *NOMBRE*").
  // Cuando viene así es la señal más limpia que existe, por eso pesa el doble.
  const entreAsteriscos = String(mensaje || "").match(/\*([^*]{3,120})\*/);
  const textoFuerte = entreAsteriscos ? normalizarParaBuscar(entreAsteriscos[1]) : "";

  let mejor: any = null;
  let mejorPuntaje = 0;
  let segundoPuntaje = 0;

  for (const p of products) {
    const palabras = normalizarParaBuscar(p.name)
      .split(" ")
      .filter(w => w.length > 2 && !PALABRAS_NO_DISTINTIVAS.has(w));
    if (palabras.length === 0) continue;

    let puntaje = 0;
    for (const w of palabras) {
      if (textoFuerte && textoFuerte.includes(w)) puntaje += 2;
      else if (texto.includes(w)) puntaje += 1;
    }

    if (puntaje > mejorPuntaje) {
      segundoPuntaje = mejorPuntaje;
      mejorPuntaje = puntaje;
      mejor = p;
    } else if (puntaje > segundoPuntaje) {
      segundoPuntaje = puntaje;
    }
  }

  // Dos condiciones, y las dos tienen que cumplirse:
  //  1. Al menos 2 puntos, para que una sola palabra suelta no dispare nada.
  //  2. Que le saque MÍNIMO el doble al segundo. Un umbral fijo no sirve:
  //     "la aspiradora de mano" solo suma 2 y es inequívoco, mientras que
  //     "el cargador" también sumaría pero lo contienen DOS productos distintos.
  //     Lo que separa un caso del otro no es el puntaje, es la distancia.
  //     Ante un empate preferimos no adivinar y dejar seguir el flujo normal.
  if (mejorPuntaje < 2) return null;
  if (mejorPuntaje < segundoPuntaje * 2) return null;
  return mejor;
}

// Puntos de venta por producto, redactados a partir de la descripción real del
// catálogo. Viven en código y no en la base para no depender de un re-seed (que
// ya borró el catálogo una vez). Si entra un producto que no esté aquí,
// puntosDeVenta() arma las viñetas con las frases de su propia descripción.
const PUNTOS_DE_VENTA: Record<string, string[]> = {
  "cargador-aromatizante-carro": [
    "Dos *cables retráctiles que se recogen solos* — se acabaron los cables enredados en la consola",
    "Carga *4 dispositivos a la vez*: el tuyo, el del copiloto y los de atrás",
    "*Difusor de aroma* que mantiene el carro fresco todo el día",
    "*Luces LED* que le dan un aire premium al tablero"
  ],
  "game-stick-retro-m8": [
    "*Más de 10.000 juegos* clásicos: NES, SNES, SEGA, PS1, N64 y GBA",
    "*2 controles inalámbricos incluidos* — la partida arranca desde el primer día",
    "*Salida 4K y 64GB*: conectas el HDMI y en un minuto estás jugando",
    "*Sin instalar nada* y sin suscripciones"
  ],
  "soporte-de-carga-magnetica": [
    "El celular *se pega solo con imán*, sin pelear con cables",
    "Carga *celular, audífonos y reloj al mismo tiempo* con 15W",
    "*Se pliega del tamaño de tu palma* — cabe en cualquier maleta"
  ],
  "candado-moto-manubrio": [
    "Bloquea *freno o manubrio*: por más que la empujen, no gira ni avanza",
    "Cuerpo de *acero de alta resistencia* a cortes y golpes",
    "Se pone y se quita *en segundos*, sin herramientas"
  ],
  "iniciador-de-bateria": [
    "*Arranca tu carro solo*, sin depender de que alguien te dé corriente",
    "Sirve para *carro, camioneta, moto y lancha*",
    "Lo dejas en la guantera y *te salva el día que menos lo esperas*"
  ],
  "aspiradora-de-mano": [
    "Saca *la arena entre los asientos y las migas* que el trapo no alcanza",
    "*Inalámbrica*: no tienes que ir hasta el lavadero",
    "*Filtro lavable* — no gastas en repuestos"
  ],
  "carpa-cobertor-carro": [
    "Lo cubre completo contra *lluvia, rayos UV, polvo y excrementos de pájaro*",
    "*Impermeable* y forrada por dentro para no rayar la pintura",
    "Se guarda en su bolsa y *cabe en el baúl*"
  ],
  "soporte-holder-moto": [
    "Deja el celular *fijo al manubrio y a la vista* — nunca más en la mano",
    "*Funda táctil*: contestas y navegas sin sacarlo, incluso bajo el aguacero",
    "*Gira 360°* y aguanta el agua"
  ],
  "cargador-celular-moto": [
    "*Carga rápida QC 3.0*: llena tu celular hasta 4 veces más rápido rodando",
    "*Voltímetro digital* para ver la batería de la moto en tiempo real",
    "Instalación *en minutos*"
  ],
  "mini-pulidora-inalambrica": [
    "*19.000 RPM* con disco de 115mm: corta, pule, desbasta y limpia",
    "Sirve en *metal, acero, cerámica y madera*",
    "*Inalámbrica*: no tienes que buscar dónde enchufarla"
  ],
  "selfie-stick-tripode": [
    "*Luz LED regulable en 3 niveles* para verte bien incluso de noche",
    "*Trípode con control remoto Bluetooth* hasta 10 metros",
    "*Gira 360°* y se pliega para llevarlo a donde sea"
  ]
};

function puntosDeVenta(p: any): string[] {
  const curados = PUNTOS_DE_VENTA[p.id];
  if (curados && curados.length) return curados;
  // Respaldo para un producto nuevo: las primeras frases de su descripción real.
  // Nunca se inventa nada; si no hay descripción, no salen viñetas.
  return String(p.description || "")
    .split(/(?<=\.)\s+/)
    .map(s => s.trim())
    .filter(s => s.length > 25)
    .slice(0, 3);
}

// Ficha de venta de UN producto. Todos los gatillos que usa son verificables
// contra el catálogo, ninguno inventado:
//   · Anclaje ....... el precio de lista real ('originalPrice') junto al de hoy.
//   · Pérdida ....... el ahorro se nombra en pesos, que pesa más que un %.
//   · Escasez ....... el stock que hay de verdad, y solo si ya está bajo.
//   · Cero riesgo ... paga cuando lo recibe.
//   · Compromiso .... cierra pidiendo el nombre, que es un "sí" pequeño y fácil.
function textoVentaProducto(p: any): string {
  const precio = Number(p.price) || 0;
  const antes = Number(p.originalPrice) || 0;
  const cop = (n: number) => "$" + n.toLocaleString("es-CO");

  const l: string[] = [];
  l.push(`¡Excelente elección! 🔥 El *${p.name}* es de los que más nos piden.`);
  l.push("");

  const puntos = puntosDeVenta(p);
  if (puntos.length) {
    l.push("✅ *Esto es lo que te llevas:*");
    for (const punto of puntos) l.push(`• ${punto}`);
    l.push("");
  }

  if (antes > precio) {
    l.push(`💵 Antes: ~${cop(antes)}~`);
    l.push(`🔥 *Hoy lo pagas en ${cop(precio)}* — te ahorras *${cop(antes - precio)}*`);
  } else {
    l.push(`💵 *Precio: ${cop(precio)}*`);
  }

  if (p.id === "cargador-aromatizante-carro") {
    l.push("🎁 Y va con *3 esencias de regalo*");
  }

  l.push("");
  l.push("🚚 *Envío GRATIS* a toda Colombia");
  l.push("💰 *Pagas cuando lo recibas* en la puerta de tu casa — no mandas un peso por adelantado");

  // Escasez solo cuando es cierta. Si quedan 40 unidades, decir "quedan pocas"
  // es una mentira que se cae sola cuando el cliente vuelve mañana.
  const stock = Number(p.stock) || 0;
  if (stock > 0 && stock <= 15) {
    l.push(`📦 Quedan *${stock} unidades* de este lote`);
  }

  l.push("");
  l.push("¿Te lo despacho hoy? 🚀 Dime tu *Nombre y Apellido completo* para la guía de despacho 📝");

  return l.join("\n");
}

// Manda la ficha del producto y deja al cliente ya dentro del checkout, parado
// en el paso de nombre. El checkout es el determinístico que ya existía; lo
// único nuevo es cómo se entra a él.
async function sendProductSalesFlow(
  from: string,
  cleanFrom: string,
  to: string,
  assignedStoreId: string,
  producto: any,
  activityId?: string
): Promise<boolean> {
  try {
    const customerProfileId = customerDocId(assignedStoreId, cleanFrom);
    const mensaje = textoVentaProducto(producto);

    await sendWhatsApp(from, mensaje, undefined, activityId, to);

    await setDoc(doc(db, "customers", customerProfileId), {
      checkoutStep: "nombre",
      checkoutData: {
        producto: producto.name,
        nombre: "",
        telefono: "",
        ciudad: "",
        direccion: "",
        referencia: "",
        valor: Number(producto.price) || 0
      },
      etapa: "negociando",
      intencion: "comprar_producto_puntual",
      productoEnfocado: producto.id,
      score: 70,
      lastInteractionAt: serverTimestamp()
    }, { merge: true });

    if (activityId) {
      await updateDoc(doc(db, "activities", activityId), {
        status: "respondido",
        response: mensaje,
        respondedAt: serverTimestamp()
      });
    }
    return true;
  } catch (e: any) {
    console.error("[Venta Producto] No se pudo enviar la ficha de venta:", e.message);
    return false;
  }
}

// Variante de startCheckoutFlow que arranca directamente desde un carrito ya
// armado (varios productos), en vez de un solo producto suelto.
async function startCheckoutFlowFromCart(from: string, cleanFrom: string, to: string, assignedStoreId: string, productoTexto: string, valorTotal: number, activityId?: string) {
  try {
    const customerProfileId = customerDocId(assignedStoreId, cleanFrom);
    const checkoutData = {
      producto: productoTexto,
      nombre: "",
      telefono: "",
      ciudad: "",
      direccion: "",
      referencia: "",
      valor: valorTotal
    };

    await setDoc(doc(db, "customers", customerProfileId), {
      checkoutStep: "nombre",
      checkoutData,
      etapa: "negociando",
      lastInteractionAt: serverTimestamp()
    }, { merge: true });

    const msg = `¡Excelente elección! 🛒 Tu pedido quedó así:\n\n📦 *${productoTexto}*\n💵 *Total: $${valorTotal.toLocaleString("es-CO")} COP*\n\nPor favor dime tu *Nombre y Apellido completo* para la guía de despacho: 📝`;
    await sendWhatsApp(from, msg, undefined, activityId, to);
    if (activityId) {
      await updateDoc(doc(db, "activities", activityId), {
        status: "respondido",
        response: msg,
        respondedAt: serverTimestamp()
      });
    }
    return true;
  } catch (e: any) {
    console.error(`[startCheckoutFlowFromCart] Error:`, e.message);
    return false;
  }
}

async function startCheckoutFlow(from: string, cleanFrom: string, to: string, assignedStoreId: string, initialProduct: string = "", activityId?: string) {
  try {
    const customerProfileId = customerDocId(assignedStoreId, cleanFrom);
    const step = initialProduct ? "nombre" : "producto";
    const checkoutData = {
      producto: initialProduct,
      nombre: "",
      telefono: "",
      ciudad: "",
      direccion: "",
      referencia: "",
      valor: 0
    };

    if (initialProduct) {
      const products = await loadProductsForStore(assignedStoreId);
      const checkProd = initialProduct.toLowerCase();
      const match = products.find((p: any) =>
        (p.name && p.name.toLowerCase().includes(checkProd)) ||
        (p.name && checkProd.includes(p.name.toLowerCase()))
      );
      if (match && match.price) {
        checkoutData.valor = match.price;
        checkoutData.producto = match.name;
      }
    }

    await setDoc(doc(db, "customers", customerProfileId), {
      checkoutStep: step,
      checkoutData: checkoutData,
      etapa: "negociando",
      lastInteractionAt: serverTimestamp()
    }, { merge: true });

    let msg = "";
    if (!initialProduct) {
      msg = `¡Excelente decisión! 🛒 Vamos a registrar tu pedido de una, sin demoras y súper profesional.\n\nContame: ¿Qué producto(s) de nuestro catálogo deseas ordenar hoy? 🔎 (Escríbelo por acá 👇)`;
    } else {
      msg = `¡Excelente decisión! 🛒 Vamos a registrar tu pedido para *${checkoutData.producto || initialProduct}* súper rápido.\n\nPor favor dime tu *Nombre y Apellido completo* para la guía de despacho de tu pedido: 📝`;
    }
    await sendWhatsApp(from, msg, undefined, activityId, to);
    if (activityId) {
      await updateDoc(doc(db, "activities", activityId), {
        status: "respondido",
        response: msg,
        respondedAt: serverTimestamp()
      });
    }
    return true;
  } catch (e: any) {
    console.error(`[startCheckoutFlow] Error initializing:`, e.message);
    return false;
  }
}

// Crea el pedido en Supabase, sincroniza con Shopify/Dropi si aplica, y notifica a los admins.
// Extraída como función reutilizable: se llama tanto cuando el cliente confirma por botón
// como en el fallback directo si no se pudieron mandar los botones.
async function finalizeOrder(
  jsonResponse: any,
  storeConfig: any,
  customerProfile: any,
  fromPhone: string,
  assignedStoreId: string,
  products: any[],
  dbRef: any
) {
  console.log("[Server AI] ¡PEDIDO CONFIRMADO! Notificando y Persistiendo...");
  try {
    let finalPrice = jsonResponse.datos_pedido?.valor || 0;
    let finalProductId = "manual";
    const productNameInput = jsonResponse.producto || "No especificado";
    const checkProd = productNameInput.toLowerCase();

    // Partimos "producto" en sus items individuales (el prompt le pide a la IA que use
    // nombres reales separados por coma, ej: "Volante Seguro Pro, Cámara DVR") para poder
    // resolver cada uno contra el catálogo real, en vez de tratar todo el string como un
    // solo bloque de texto (así no se "pierde" el segundo producto de un pedido).
    const productParts = checkProd.split(",").map((s: string) => s.trim()).filter(Boolean);
    const matchedItems: any[] = [];
    for (const part of productParts) {
      const found = products.find((p: any) => {
        const name = (p?.name || "").toLowerCase();
        return name && (name === part || name.includes(part) || part.includes(name));
      });
      if (found && !matchedItems.some((m) => m.id === found.id)) matchedItems.push(found);
    }

    // 1. ¿Coincide con un combo activo? Comparamos por los IDs reales de los productos
    // del combo (no por texto de tagline/nombre, que casi nunca calza literal).
    const matchedIds = new Set(matchedItems.map((p: any) => p.id));
    const comboMatch = matchedItems.length > 0
      ? ACTIVE_PROMOTIONS.find((combo: any) =>
          Array.isArray(combo.productIds) &&
          combo.productIds.length === matchedIds.size &&
          combo.productIds.every((id: string) => matchedIds.has(id))
        )
      : undefined;

    if (comboMatch) {
      console.log(`[Server AI] Match found in Active Promotions: ${comboMatch.name} (${comboMatch.id})`);
      finalPrice = comboMatch.promoPrice;
      finalProductId = comboMatch.id;
    } else if (matchedItems.length > 0) {
      // 2. No es combo: sumamos el precio real de TODOS los productos identificados
      // (antes solo se tomaba uno solo y el resto del pedido se perdía del cálculo).
      const catalogSum = matchedItems.reduce((sum: number, p: any) => sum + (Number(p.price) || 0), 0);
      const tolerance = Math.max(2000, catalogSum * 0.05);
      if (catalogSum > 0 && (finalPrice <= 0 || Math.abs(finalPrice - catalogSum) > tolerance)) {
        console.warn(
          `[Server AI] ⚠️ Precio propuesto por la IA ($${finalPrice}) no coincide con la suma real de catálogo ($${catalogSum}). Se usa el precio de catálogo.`
        );
        finalPrice = catalogSum;
      }
      finalProductId = matchedItems[0]?.id || matchedItems[0]?.productId || "manual";
    }

    // Force fallback to catalog price if the AI provided $0 or invalid values
    if (finalPrice <= 0 && jsonResponse.producto) {
      const match = products.find((p: any) =>
        (p.name && p.name.toLowerCase().includes(checkProd)) ||
        (p.name && checkProd.includes(p.name.toLowerCase()))
      );
      if (match && (match as any).price) {
        finalPrice = (match as any).price;
        finalProductId = match.id || "manual";
      }
    }

    let quantity = parseInt(jsonResponse.datos_pedido?.cantidad, 10);
    if (!quantity || isNaN(quantity) || quantity < 1) quantity = 1;
    if (quantity > 20) quantity = 20; // límite razonable anti-error de digitación

    const orderInfo = {
      storeId: assignedStoreId,
      customerName: jsonResponse.datos_pedido?.nombre || customerProfile?.name || fromPhone,
      customerPhone: jsonResponse.datos_pedido?.telefono || fromPhone,
      productName: productNameInput,
      productId: finalProductId,
      quantity,
      totalPrice: finalPrice * quantity,
      address: jsonResponse.datos_pedido?.direccion || "No especificada",
      city: jsonResponse.datos_pedido?.ciudad || "No especificada",
      addressIndicator: jsonResponse.datos_pedido?.referencia || "N/A",
      notes: jsonResponse.datos_pedido?.notes || "",
      status: 'pendiente',
      shopifyStatus: 'no_enviado',
      dropiStatus: 'no_enviado',
      createdAt: serverTimestamp()
    };

    const orderRef = await addDoc(collection(dbRef, "orders"), orderInfo);
    const newOrderId = orderRef.id;
    console.log(`[Server AI] Pedido guardado en base de datos con ID: ${newOrderId}`);

    if (storeConfig?.shopifyAutoSync && storeConfig?.shopifyDomain && storeConfig?.shopifyAccessToken) {
      console.log("[Server AI] Shopify Auto Sync activo. Sincronizando pedido...");
      try {
        await pushOrderToShopify(newOrderId, orderInfo, storeConfig, dbRef);
        console.log("[Server AI] Pedido sincronizado con Shopify automáticamente.");
      } catch (shopErr: any) {
        console.error("[Server AI] Error sincronizando con Shopify automáticamente:", shopErr.message);
        await updateDoc(doc(dbRef, "orders", newOrderId), {
          shopifyStatus: "error",
          shopifyError: shopErr.message
        });
      }
    }

    // SUBIDA AUTOMÁTICA A DROPI DESACTIVADA TEMPORALMENTE (Soporte técnico, se mantiene la configuración)
    if (false && storeConfig?.dropiAutoSync && storeConfig?.dropiApiKey) {
      console.log("[Server AI] Dropi Auto Sync activo. Sincronizando pedido...");
      try {
        await pushOrderToDropi(newOrderId, orderInfo, storeConfig, dbRef);
        console.log("[Server AI] Pedido sincronizado con Dropi automáticamente.");
      } catch (dropErr: any) {
        console.error("[Server AI] Error sincronizando con Dropi automáticamente:", dropErr.message);
        await updateDoc(doc(dbRef, "orders", newOrderId), {
          dropiStatus: "error",
          dropiError: dropErr.message
        });
      }
    }

    await notifyAdmins(orderInfo, storeConfig?.name || "Jan Vanegas", storeConfig);
    return orderInfo;
  } catch (e) {
    console.error("[Server AI] Error persistiendo o notificando pedido:", e);
    return null;
  }
}

/**
 * SINCRONIZACIÓN EN VIVO DE IMÁGENES/CATÁLOGO DESDE GOOGLE SHEETS (CSV PUBLICADO)
 * ---------------------------------------------------------------------------
 * José María va pegando enlaces de imágenes a medida que los consigue, y
 * necesita que el bot los tome en cuenta sin tener que redeployar. OneDrive
 * bloquea la descarga automatizada de archivos, así que la solución estable
 * es: publicar la hoja de Google Sheets como CSV (Archivo > Compartir >
 * Publicar en la web > Valores separados por comas) y poner ese link en la
 * variable de entorno GOOGLE_SHEETS_CATALOG_CSV_URL. Este bloque lee la hoja
 * cada cierto tiempo y actualiza SOLO los campos imageUrl (y opcionalmente
 * price/stock si vienen en la hoja) de los productos ya existentes en
 * Firestore, buscando por "id" y si no hay match, por "name".
 *
 * Columnas esperadas (nombres flexibles, sin importar mayúsculas/acentos):
 * id | name (o nombre) | imageUrl (o imagen/foto). Opcionales: price, stock.
 */
function parseCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') { cur += '"'; i++; }
        else inQuotes = false;
      } else {
        cur += ch;
      }
    } else {
      if (ch === '"') inQuotes = true;
      else if (ch === ',') { out.push(cur); cur = ""; }
      else cur += ch;
    }
  }
  out.push(cur);
  return out.map(s => s.trim());
}

function normalizeHeader(h: string): string {
  return h.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/g, "");
}

let lastCatalogSyncSummary = { lastRun: null as string | null, updated: 0, matched: 0, rows: 0, error: null as string | null };

async function syncCatalogFromSheet(): Promise<void> {
  // Sincronización deshabilitada por solicitud del usuario para manejar imágenes manualmente.
  lastCatalogSyncSummary = {
    lastRun: new Date().toISOString(),
    updated: 0,
    matched: 0,
    rows: 0,
    error: "Sincronización automática desactivada por solicitud del usuario (manejo manual de imágenes)."
  };
  return;
}

// Carga el catálogo de productos de una tienda (con fallback a JSON local si Supabase falla).
// Extraída para reutilizarla tanto en el flujo normal de IA como en la confirmación por botón.
async function loadProductsForStore(assignedStoreId: string): Promise<any[]> {
  let products: any[] = [];
  try {
    // UNIFIED MODE: Fetch all products across all stores
    let prodSnap = await getDocs(collection(db, "products"));
    products = prodSnap.docs.map(d => ({ id: d.id, ...d.data() }));
  } catch (e) {
    console.error("Supabase read error, using local JSON:", e);
  }

  if (products.length === 0) {
    try {
      const catalogData = JSON.parse(readFileSync(path.join(cwd, "src/catalog.json"), "utf8"));
      products = catalogData.products;
    } catch (errFallback) {
      console.error("Error reading local catalog fallback:", errFallback);
    }
  }
  return products;
}

// ── Meta Conversions API (CAPI) Helpers ─────────────────────────────────────
// Envía eventos server-side a Meta para complementar el pixel del navegador.
// Usa el mismo event_id que el pixel del cliente para que Meta deduplique
// el evento (no lo cuenta dos veces) mientras usa AMBAS fuentes para aprender.
function sha256Hash(value: string): string {
  return crypto.createHash("sha256").update(value.trim().toLowerCase()).digest("hex");
}

function normalizePhoneForMeta(phone: string): string {
  if (!phone) return "";
  let clean = phone.toLowerCase().replace("whatsapp:", "").replace(/\D/g, "");
  if (clean.length === 10 && clean.startsWith("3")) {
    clean = "57" + clean;
  }
  return clean;
}

interface MetaCapiParams {
  pixelId: string;
  accessToken: string;
  eventName: string;
  eventId: string;
  eventSourceUrl?: string;
  customerPhone?: string;
  fbp?: string;
  fbc?: string;
  clientIp?: string;
  userAgent?: string;
  customData?: Record<string, any>;
}

async function sendMetaCapiEvent(params: MetaCapiParams): Promise<void> {
  const { eventName, eventId, eventSourceUrl, customerPhone, fbp, fbc, clientIp, userAgent, customData } = params;
  // Se limpian espacios: el id del pixel llego a estar guardado como
  // " 841277818494170", y con un id mal formado Meta descarta los eventos, que
  // es justo lo que la campana necesita para optimizar.
  const pixelId = String(params.pixelId || "").trim();
  const accessToken = String(params.accessToken || "").trim();
  if (!pixelId || !accessToken) {
    console.warn(`[Meta CAPI] Faltan pixelId o accessToken, se omite el evento server-side "${eventName}".`);
    return;
  }
  try {
    const userData: Record<string, any> = {};
    if (customerPhone) {
      const normalized = normalizePhoneForMeta(customerPhone);
      if (normalized) userData.ph = [sha256Hash(normalized)];
    }
    if (fbp) userData.fbp = fbp;
    if (fbc) userData.fbc = fbc;
    if (clientIp) userData.client_ip_address = clientIp;
    if (userAgent) userData.client_user_agent = userAgent;

    const eventPayload = {
      data: [
        {
          event_name: eventName,
          event_time: Math.floor(Date.now() / 1000),
          event_id: eventId,
          action_source: "website",
          event_source_url: eventSourceUrl,
          user_data: userData,
          custom_data: customData || {},
        },
      ],
    };

    const url = `https://graph.facebook.com/v19.0/${pixelId}/events?access_token=${accessToken}`;
    await axios.post(url, eventPayload);
    console.log(`[Meta CAPI] Evento "${eventName}" enviado correctamente (event_id: ${eventId}).`);
  } catch (err: any) {
    console.error(`[Meta CAPI] Error enviando evento "${eventName}":`, err?.response?.data || err.message);
  }
}

function getClientIp(req: express.Request): string {
  const forwarded = req.headers["x-forwarded-for"];
  if (typeof forwarded === "string" && forwarded.length > 0) {
    return forwarded.split(",")[0].trim();
  }
  return req.socket?.remoteAddress || "";
}

function normalizePhone(phone: string): string {
  if (!phone) return "";
  // 1. Remove the 'whatsapp:' prefix if present to avoid double-prepending
  let clean = phone.toLowerCase().replace('whatsapp:', '');
  // 2. Remove all non-digit characters
  clean = clean.replace(/\D/g, '');
  // 3. Smart Colombia handling: if it has exactly 10 digits and starts with '3', prepend '57'
  if (clean.length === 10 && clean.startsWith('3')) {
    clean = '57' + clean;
  }
  // 4. Return with the correct Twilio prefix
  return `whatsapp:+${clean}`;
}

// Clave canonica de un telefono: solo digitos y siempre con indicativo de pais.
// Sin esto el mismo cliente se guardaba como "+573001112233", "573001112233" y
// "3001112233" a la vez, creando hasta tres fichas del mismo numero.
function customerKey(phone: string): string {
  return normalizePhone(phone).replace("whatsapp:+", "");
}

// Id estable de la ficha de cliente dentro de una tienda. Todo el codigo debe
// construir el id por aqui para que un numero tenga UNA sola ficha, para siempre.
function customerDocId(storeId: string, phone: string): string {
  return (storeId || "default") + "_" + customerKey(phone);
}

function getAdminNumbers(storeConfig?: any): string[] {
  const adminNumbersRaw = process.env.ADMIN_WHATSAPP_NUMBERS || "";
  let adminNumbers = adminNumbersRaw.split(",").map(n => n.trim()).filter(n => n.length > 0);
  if (storeConfig?.notificationPhone) {
    adminNumbers = [storeConfig.notificationPhone.trim()];
  }
  if (adminNumbers.length === 0) {
    adminNumbers = ["3133647176", "3133615984"];
  }
  return adminNumbers;
}

async function sendWhatsApp(to: string, body: string, mediaUrl?: string | string[], activityId?: string, from?: string) {
  if (!twilioClient) {
    console.error("[WhatsApp Send] Client not initialized.");
    return;
  }

  // Derive base URL for status callbacks
  const appUrl = currentAppUrl || process.env.APP_URL || "";
  
  const finalTo = normalizePhone(to);
  const finalFrom = normalizePhone(from || TWILIO_FROM_NUMBER || "+14155238886");
  
  if (finalTo === finalFrom) {
    console.warn(`[WhatsApp Block] Attempted to send message to itself: ${finalTo}. Aborting to prevent infinite loop.`);
    return;
  }

  console.log(`[Twilio Debug] Final Numbers: FROM=${finalFrom} TO=${finalTo}`);

  // 🔧 Se eliminó el chequeo de "límite de cuenta trial" (Jan ya hizo el
  // upgrade de su cuenta de Twilio a una cuenta paga real, así que ese
  // límite de 50 mensajes de prueba no le aplica más). Mantenerlo solo
  // arriesgaba falsos positivos como el que causó el apagón total de hoy.

  // Normalizamos a arreglo para poder soportar 1 o varias imágenes al mismo
  // tiempo (WhatsApp/Twilio permite hasta 10 medios por mensaje).
  let mediaUrls: string[] = mediaUrl ? (Array.isArray(mediaUrl) ? mediaUrl : [mediaUrl]) : [];

  // Ensure mediaUrl is absolute
  mediaUrls = mediaUrls.map(u => (u && u.startsWith("/")) ? `${appUrl.replace(/\/$/, '')}${u}` : u).filter(Boolean);

  // Enviamos las imágenes como adjunto NATIVO de WhatsApp (no como link de
  // texto), para que se vean como fotos reales en el chat del cliente.
  let finalMediaUrl = mediaUrls[0]; // usado solo para el registro/log de una sola imagen
  let finalBody = body;

  const params: any = {
    from: finalFrom,
    to: finalTo,
    body: finalBody
  };

  if (mediaUrls.length > 0) {
    params.mediaUrl = mediaUrls.slice(0, 10);
  }

  if (activityId && appUrl) {
    params.statusCallback = `${appUrl.replace(/\/$/, '')}/api/webhook/whatsapp/status?activityId=${activityId}`;
  }

  try {
    console.log(`[Twilio Action] Sending... From:${params.from} To:${params.to} MsgLen:${body?.length || 0} Media:${!!params.mediaUrl}`);
    const msg = await twilioClient.messages.create(params);
    console.log(`[Twilio Success] SID: ${msg.sid}. Status: ${msg.status}`);
    
    // 📝 REGISTRAR LA RESPUESTA DEL BOT (para que el dashboard muestre la conversación completa)
    try {
      const cleanCustomerPhone = finalTo.replace('whatsapp:', '').trim();
      const assignedStoreId = await determineStoreId(cleanCustomerPhone, finalBody, finalFrom);
      await addDoc(collection(db, "activities"), {
        from: finalFrom,
        to: finalTo,
        recipient: finalTo,
        customerPhone: cleanCustomerPhone,
        botNumber: finalFrom,
        storeId: assignedStoreId,
        message: finalBody,
        mediaUrl: finalMediaUrl || null,
        status: "respondido",
        whatsappStatus: msg.status,
        senderType: "bot",
        timestamp: serverTimestamp()
      });
    } catch (logErr: any) {
      console.error("[Activity Log] No se pudo registrar la respuesta del bot:", logErr.message);
    }
    
    return msg;
  } catch (err: any) {
    console.error(`[Twilio Error] FATAL: From:${finalFrom} To:${finalTo} Error: ${err.message}`);

    // 🚨 DETECCIÓN DE LÍMITES DE ENVÍO (para que no se te vaya en silencio)
    // Códigos de Twilio relacionados con límites de mensajería/calidad de
    // número: 63038 (límite diario de mensajes excedido), 63016/63024/63018
    // (problemas de template/ventana de 24h), y 429 genérico de rate-limit.
    const LIMIT_ERROR_CODES = [63038, 63016, 63024, 63018];
    const isLimitError = LIMIT_ERROR_CODES.includes(Number(err.code)) || err.status === 429;
    if (isLimitError) {
      const oneHourAgo = Date.now() - 60 * 60 * 1000;
      recentTwilioLimitErrors.push(Date.now());
      while (recentTwilioLimitErrors.length && recentTwilioLimitErrors[0] < oneHourAgo) {
        recentTwilioLimitErrors.shift();
      }
      console.error(`[Twilio Límite] ⚠️ Error de límite/calidad detectado (code=${err.code}). Van ${recentTwilioLimitErrors.length} en la última hora.`);

      const nowLimitCheck = Date.now();
      if (recentTwilioLimitErrors.length >= 5 && nowLimitCheck - lastTwilioLimitAlertAt > 30 * 60 * 1000) {
        lastTwilioLimitAlertAt = nowLimitCheck;
        const alertBody = `Se detectaron ${recentTwilioLimitErrors.length} errores de límite/calidad de Twilio en la última hora (código más reciente: ${err.code} - ${err.message}).

Esto puede significar que WhatsApp está limitando tus envíos. Revisa tu cuenta de Twilio y el Meta Business Manager.`;

        (async () => {
          try {
            const admins = getAdminNumbers();
            const limitAlertContentSid = await ensureAdminAlertTemplate();
            const fullAlertText = `🚨🚨 *ALERTA DE ENVÍO DE WHATSAPP* 🚨🚨\n\n${alertBody}`;
            for (const num of admins) {
              const target = num.trim().startsWith("whatsapp:") ? num.trim() : `whatsapp:${num.trim()}`;
              if (limitAlertContentSid) {
                await twilioClient?.messages.create({
                  from: normalizePhone(TWILIO_FROM_NUMBER || "+14155238886"),
                  to: normalizePhone(target),
                  contentSid: limitAlertContentSid,
                  contentVariables: JSON.stringify({ "1": fullAlertText.slice(0, 1024) })
                }).catch(() => {});
              } else {
                await twilioClient?.messages.create({
                  from: normalizePhone(TWILIO_FROM_NUMBER || "+14155238886"),
                  to: normalizePhone(target),
                  body: fullAlertText
                }).catch(() => {});
              }
            }
          } catch {}
        })();

        sendAdminAlertEmail("🚨 Alerta: Posible limite de envio en WhatsApp - Jansel Shop", alertBody).catch(() => {});
      }
    }
    
    // Fallback: If it failed with media, try text only
    if (finalMediaUrl) {
      try {
        console.log("[Twilio Fallback] Retrying with TEXT ONLY...");
        const textOnlyParams = { ...params };
        delete textOnlyParams.mediaUrl;
        const msg = await twilioClient.messages.create(textOnlyParams);
        console.log(`[Twilio Success][Fallback] SID: ${msg.sid}`);
        
        // 📝 REGISTRAR LA RESPUESTA DEL BOT (para que el dashboard muestre la conversación completa)
        try {
          const cleanCustomerPhone = finalTo.replace('whatsapp:', '').trim();
          const assignedStoreId = await determineStoreId(cleanCustomerPhone, finalBody, finalFrom);
          await addDoc(collection(db, "activities"), {
            from: finalFrom,
            to: finalTo,
            recipient: finalTo,
            customerPhone: cleanCustomerPhone,
            botNumber: finalFrom,
            storeId: assignedStoreId,
            message: finalBody,
            mediaUrl: null, // text only fallback
            status: "respondido",
            whatsappStatus: msg.status,
            senderType: "bot",
            timestamp: serverTimestamp()
          });
        } catch (logErr: any) {
          console.error("[Activity Log] No se pudo registrar la respuesta del bot:", logErr.message);
        }
        
        return msg;
      } catch (innerErr: any) {
        console.error("[Twilio Fallback] FAILED TOO:", innerErr.message);
        throw innerErr;
      }
    }
    
    // 🔧 Se eliminó por completo el mecanismo de "bloqueo por límite trial":
    // como la cuenta de Twilio ya está en modo pago (upgrade confirmado),
    // este concepto no aplica y solo representaba un riesgo de falso
    // positivo (como el que causó el apagón total del 4 de agosto).
    throw err;
  }
}

/**
 * Sends a message via Meta Graph API (Instagram or Messenger)
 */
async function sendMetaMessage(recipientId: string, text: string, platform: 'instagram' | 'messenger', pageId?: string) {
  if (!FB_PAGE_ACCESS_TOKEN) {
    console.warn(`[Meta Send] No access token configured. Cannot reply to ${recipientId} on ${platform}`);
    return;
  }

  const endpoint = pageId ? `${pageId}/messages` : `me/messages`;
  const url = `https://graph.facebook.com/v19.0/${endpoint}?access_token=${FB_PAGE_ACCESS_TOKEN}`;
  
  try {
    console.log(`[Meta Send] Sending to ${recipientId} on ${platform}...`);
    const response = await axios.post(url, {
      recipient: { id: recipientId },
      message: { text: text },
      // platform: platform // Automatically inferred by Meta based on the Page/Account linked to the token
    });
    console.log(`[Meta Success] Message sent to ${recipientId}. MID: ${response.data.message_id}`);
    return response.data;
  } catch (err: any) {
    console.error(`[Meta Error] Failed to send to ${recipientId}:`, err.response?.data || err.message);
    throw err;
  }
}

/**
 * Pushes an order to Shopify API
 */
async function pushOrderToShopify(orderId: string, orderData: any, storeConfig: any, db: any) {
  const { shopifyDomain, shopifyAccessToken } = storeConfig;
  if (!shopifyDomain || !shopifyAccessToken) {
    throw new Error("Credenciales de Shopify incompletas");
  }

  const cleanDomain = shopifyDomain.replace(/https?:\/\//, '').trim();
  const payload = {
    order: {
      line_items: [
        {
          title: orderData.productName || "Producto general",
          price: (orderData.totalPrice || 0).toString(),
          quantity: orderData.quantity || 1
        }
      ],
      customer: {
        first_name: orderData.customerName,
        phone: orderData.customerPhone
      },
      shipping_address: {
        first_name: orderData.customerName,
        address1: orderData.address,
        city: orderData.city,
        phone: orderData.customerPhone,
        country: "Colombia"
      },
      billing_address: {
        first_name: orderData.customerName,
        address1: orderData.address,
        city: orderData.city,
        phone: orderData.customerPhone,
        country: "Colombia"
      },
      financial_status: "pending",
      payment_gateway_names: ["Cash on Delivery (COD)", "Contra Entrega"],
      note: orderData.notes || orderData.addressIndicator || "",
      tags: "WhatsApp AI, Pago Contra Entrega"
    }
  };

  const response = await axios.post(
    `https://${cleanDomain}/admin/api/2024-01/orders.json`,
    payload,
    {
      headers: {
        "X-Shopify-Access-Token": shopifyAccessToken,
        "Content-Type": "application/json"
      },
      timeout: 10000
    }
  );

  const shopifyOrder = response.data.order;
  
  await updateDoc(doc(db, "orders", orderId), {
    shopifyStatus: "enviado",
    shopifyOrderId: shopifyOrder.id.toString(),
    shopifyError: null
  });

  return shopifyOrder;
}

/**
 * Pushes an order to Dropi API (or simulates success if key contains test/demo)
 */
async function pushOrderToDropi(orderId: string, orderData: any, storeConfig: any, db: any) {
  const { dropiApiKey, dropiPreferredCarrier, dropiBackupCarrier } = storeConfig;
  if (!dropiApiKey) {
    throw new Error("Token o API Key de Dropi ausente.");
  }

  const quantity = orderData.quantity || 1;
  const unitPrice = orderData.totalPrice ? Math.round(orderData.totalPrice / quantity) : 0;

  // Resolve custom Dropi Product ID / SKU if configured on the product document
  let resolvedProductId = orderData.productId && orderData.productId !== "manual" ? orderData.productId : undefined;
  if (orderData.productId && orderData.productId !== "manual") {
    try {
      const prodRes = await dbGetDoc("products", orderData.productId);
      if (prodRes.exists) {
        const prodData = prodRes.data;
        resolvedProductId = prodData.dropiProductId || prodData.sku || prodData.id || resolvedProductId;
        console.log(`[Dropi Push] Resolved catalog product ID "${orderData.productId}" to Dropi API ID/SKU "${resolvedProductId}"`);
      }
    } catch (e: any) {
      console.warn(`[Dropi Push] Non-blocking warning when resolving product SKU: ${e.message}`);
    }
  }

  const payload: any = {
    customer: {
      name: orderData.customerName,
      phone: orderData.customerPhone,
      address: orderData.address,
      city: orderData.city,
      indicator: orderData.addressIndicator || ""
    },
    payment_method: "contra_entrega",
    carrier: dropiPreferredCarrier || "Servientrega",
    products: [
      {
        id: resolvedProductId,
        name: orderData.productName,
        quantity: quantity,
        price: unitPrice
      }
    ],
    notes: orderData.notes || ""
  };

  const key = dropiApiKey.trim();
  if (key.toLowerCase().includes("test") || key.toLowerCase().includes("demo") || key === "12345") {
    // Elegant fallback simulation for testing/demo keys
    const mockTracking = `CO-${Math.floor(100000000 + Math.random() * 900000000)}CO`;
    const mockOrderId = `DROP-${Math.floor(10000 + Math.random() * 90000)}`;
    const chosenCarrier = dropiPreferredCarrier || "Servientrega";
    await updateDoc(doc(db, "orders", orderId), {
      dropiStatus: "enviado",
      dropiOrderId: mockOrderId,
      dropiTrackingNumber: mockTracking,
      dropiCarrier: chosenCarrier + " (Simulado)",
      dropiError: null
    });
    return { dropiOrderId: mockOrderId, tracking: mockTracking, simulated: true };
  }

  let response;
  let chosenCarrier = payload.carrier;
  
  try {
    console.log(`[Dropi Push] Attempting to push order with preferred carrier: ${chosenCarrier}`);
    response = await axios.post(
      "https://api.dropi.co/api/v2/orders", 
      payload,
      {
        headers: {
          "Authorization": `Bearer ${key}`,
          "Content-Type": "application/json"
        },
        timeout: 10000
      }
    );
  } catch (err: any) {
    const errorMsg = err.response?.data?.message || err.response?.data?.error || err.message || "";
    const backupCarrier = dropiBackupCarrier || "Interrapidisimo";
    
    // Check if the error is carrier-related, coverage-related, or a general routing error
    const isCarrierIssue = errorMsg.toLowerCase().includes("carrier") || 
                           errorMsg.toLowerCase().includes("transportadora") || 
                           errorMsg.toLowerCase().includes("cobertura") || 
                           errorMsg.toLowerCase().includes("no disponible") || 
                           errorMsg.toLowerCase().includes("no admite") ||
                           errorMsg.toLowerCase().includes("sin servicio");

    if (isCarrierIssue && backupCarrier && backupCarrier !== chosenCarrier) {
      console.log(`[Dropi Push] Preferred carrier "${chosenCarrier}" failed with error: "${errorMsg}". Retrying automatically with backup carrier: "${backupCarrier}"...`);
      chosenCarrier = backupCarrier;
      payload.carrier = backupCarrier;
      
      try {
        response = await axios.post(
          "https://api.dropi.co/api/v2/orders", 
          payload,
          {
            headers: {
              "Authorization": `Bearer ${key}`,
              "Content-Type": "application/json"
            },
            timeout: 10000
          }
        );
      } catch (backupErr: any) {
        console.error(`[Dropi Push] Backup carrier retry also failed:`, backupErr.response?.data || backupErr.message);
        throw backupErr;
      }
    } else {
      throw err;
    }
  }

  const dropiData = response.data;
  const tracking = dropiData.tracking_number || dropiData.guia || `DROP-${Math.floor(Math.random() * 10000000)}`;
  const dropiOrderId = dropiData.order_id || dropiData.id || `DO-${Math.floor(Math.random() * 100000)}`;

  await updateDoc(doc(db, "orders", orderId), {
    dropiStatus: "enviado",
    dropiOrderId: dropiOrderId.toString(),
    dropiTrackingNumber: tracking,
    dropiCarrier: chosenCarrier,
    dropiError: null
  });

  return { dropiOrderId, tracking };
}

// ==============================================
// 🚚 AUTOMATED TRACKING SYSTEM & ANALYZER (Dropi, Servientrega, etc.)
// ==============================================

function extractGuideFromUrlOrText(url: string, text: string): string {
  try {
    const urlObj = new URL(url);
    const params = ["id", "guia", "guide", "tracking", "num", "numero", "doc", "code", "ref", "tracking_number", "tracking_id", "id_guia", "documento"];
    for (const p of params) {
      const val = urlObj.searchParams.get(p);
      if (val && /^[A-Za-z0-9-]{6,20}$/.test(val)) {
        return val;
      }
    }
    const pathSegments = urlObj.pathname.split("/");
    for (const segment of pathSegments) {
      if (/^[0-9]{8,15}$/.test(segment)) {
        return segment;
      }
    }
  } catch (e) {
    // Ignore URL parse error
  }

  const patterns = [
    /(?:guia|guía|tracking|rastreo|documento|remesa|numero|número|no\.?\s*guia|nº\s*guia)[:#\s]+([A-Za-z0-9-]{7,20})/i,
    /\b([0-9]{9,13})\b/
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match && match[1]) {
      return match[1];
    }
  }

  return "No detectada";
}

async function analyzeTrackingUrl(url: string): Promise<{ status: string; comment: string; carrier: string; guide: string }> {
  try {
    console.log(`[Tracking Analyzer] Fetching tracking page: ${url}`);
    
    // Simple mock check for testing
    if (url.includes("test") || url.includes("mock") || url.includes("demo")) {
      return {
        status: "en_ruta",
        comment: "El pedido está en camino a la dirección de entrega (Simulado)",
        carrier: "Servientrega",
        guide: "9876543210"
      };
    }

    const response = await axios.get(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8"
      },
      timeout: 15000
    });

    const html = response.data;
    if (!html || typeof html !== "string") {
      throw new Error("No HTML content returned or invalid content type.");
    }

    // Clean HTML to save token/regex space
    let textContent = html
      .replace(/<script[^>]*>([\s\S]*?)<\/script>/gi, '')
      .replace(/<style[^>]*>([\s\S]*?)<\/style>/gi, '')
      .replace(/<svg[^>]*>([\s\S]*?)<\/svg>/gi, '')
      .replace(/<head[^>]*>([\s\S]*?)<\/head>/gi, '')
      .replace(/<nav[^>]*>([\s\S]*?)<\/nav>/gi, '')
      .replace(/<footer[^>]*>([\s\S]*?)<\/footer>/gi, '')
      .replace(/<\/?[a-z][a-z0-9]*[^<>]*>/gi, ' ') // remove HTML tags
      .replace(/\s+/g, ' ') // normalize whitespace
      .trim();

    // Limit length to avoid blowing context windows
    const maxTextLength = 6000;
    if (textContent.length > maxTextLength) {
      textContent = textContent.slice(0, maxTextLength);
    }

    // Attempt AI-based extraction if API keys are available
    const apiKey = process.env.NVIDIA_API_KEY || process.env.OPENROUTER_API_KEY;
    if (apiKey) {
      try {
        const isNvidia = !!process.env.NVIDIA_API_KEY;
        const apiUrl = isNvidia
          ? "https://integrate.api.nvidia.com/v1/chat/completions"
          : "https://openrouter.ai/api/v1/chat/completions";
        const modelName = isNvidia ? "meta/llama-3.1-8b-instruct" : "google/gemini-2.5-flash";

        console.log(`[Tracking Analyzer] Asking AI (${modelName}) to analyze tracking text...`);
        const resp = await axios.post(
          apiUrl,
          {
            model: modelName,
            messages: [
              {
                role: "user",
                content: `Analiza el siguiente texto extraído de una página de seguimiento/rastreo de envío (en Colombia). Identifica cuál es el estado actual de la entrega de manera precisa.\nDebe ser exactamente uno de los siguientes estados:\n- 'preparacion' (si la guía está generada, en preparación, o en bodega)\n- 'en_ruta' (si ya fue despachado, está en tránsito, en ruta de entrega, o viajando)\n- 'entregado' (si el cliente ya lo recibió)\n- 'novedad' (si hubo un intento fallido de entrega, dirección errónea, rehusado, o necesita reprogramación)\n\nDevuelve una respuesta JSON estricta con el formato:\n{\n  "estado": "preparacion" | "en_ruta" | "entregado" | "novedad",\n  "comentario": "Breve descripción de lo que indica la página (ej: 'El envío se encuentra en camino a Medellín')",\n  "transportadora": "Servientrega" | "Interrapidisimo" | "Coordinadora" | "Envía" | "Dropi" | "Desconocida",\n  "guia": "Número de guía o número de rastreo detectado (ej: '1002345678')"\n}\n\nTexto de la página:\n${textContent}`
              }
            ],
            temperature: 0.1,
            max_tokens: 300,
            response_format: { type: "json_object" }
          },
          {
            headers: {
              "Authorization": `Bearer ${apiKey}`,
              "Content-Type": "application/json"
            },
            timeout: 15000
          }
        );

        let aiText = resp.data?.choices?.[0]?.message?.content || "";
        if (aiText.includes("```json")) {
          aiText = aiText.split("```json")[1].split("```")[0].trim();
        } else if (aiText.includes("```")) {
          aiText = aiText.split("```")[1].split("```")[0].trim();
        }

        const parsed = JSON.parse(aiText);
        if (parsed.estado && ["preparacion", "en_ruta", "entregado", "novedad"].includes(parsed.estado)) {
          console.log(`[Tracking Analyzer] AI extracted: state=${parsed.estado}, carrier=${parsed.transportadora}, guide=${parsed.guia}`);
          return {
            status: parsed.estado,
            comment: parsed.comentario || "Actualizado por IA",
            carrier: parsed.transportadora || "Desconocida",
            guide: parsed.guia || extractGuideFromUrlOrText(url, textContent)
          };
        }
      } catch (aiErr: any) {
        console.warn("[Tracking Analyzer] AI extraction failed, falling back to regex:", aiErr.message);
      }
    }

    // REGEX FALLBACK (highly reliable fallback based on common Colombian shipping words)
    const normalizedText = textContent.toLowerCase();
    let status = "preparacion";
    let comment = "En preparación";
    let carrier = "Desconocida";

    if (normalizedText.includes("servientrega")) carrier = "Servientrega";
    else if (normalizedText.includes("interrapidisimo") || normalizedText.includes("inter rapidisimo")) carrier = "Interrapidisimo";
    else if (normalizedText.includes("coordinadora")) carrier = "Coordinadora";
    else if (normalizedText.includes("envia")) carrier = "Envía";
    else if (normalizedText.includes("dropi")) carrier = "Dropi";

    if (
      normalizedText.includes("entregado") ||
      normalizedText.includes("entrega exitosa") ||
      normalizedText.includes("recibido") ||
      normalizedText.includes("finalizado")
    ) {
      status = "entregado";
      comment = "Pedido entregado con éxito.";
    } else if (
      normalizedText.includes("novedad") ||
      normalizedText.includes("devolucion") ||
      normalizedText.includes("fallido") ||
      normalizedText.includes("reprogramado") ||
      normalizedText.includes("no entregado") ||
      normalizedText.includes("no recibido") ||
      normalizedText.includes("direccion errada") ||
      normalizedText.includes("ausente")
    ) {
      status = "novedad";
      comment = "Novedad en la entrega reportada por la transportadora.";
    } else if (
      normalizedText.includes("en ruta") ||
      normalizedText.includes("despachado") ||
      normalizedText.includes("transito") ||
      normalizedText.includes("en camino") ||
      normalizedText.includes("viaje") ||
      normalizedText.includes("reparto") ||
      normalizedText.includes("movimiento")
    ) {
      status = "en_ruta";
      comment = "El pedido se encuentra en tránsito o en ruta de reparto.";
    } else if (
      normalizedText.includes("recibido en oficina") ||
      normalizedText.includes("admision") ||
      normalizedText.includes("preparacion") ||
      normalizedText.includes("bodega") ||
      normalizedText.includes("generado") ||
      normalizedText.includes("alistamiento")
    ) {
      status = "preparacion";
      comment = "Guía generada o en proceso de alistamiento.";
    }

    const guide = extractGuideFromUrlOrText(url, textContent);

    return { status, comment, carrier, guide };
  } catch (err: any) {
    console.error(`[Tracking Analyzer] Error fetching or analyzing URL:`, err.message);
    // If it completely fails, return 'preparacion' status as safe default
    return { status: "preparacion", comment: "No se pudo consultar el estado actual en tiempo real.", carrier: "Desconocida", guide: extractGuideFromUrlOrText(url, "") };
  }
}

/**
 * Generates an intelligent, VIP post-purchase cross-sell recommendation using Gemini AI
 */
async function generatePostPurchaseUpsell(order: any, customerOrders: any[], products: any[]): Promise<{
  customerProfile: string;
  recommendedProductId: string;
  recommendedProductName: string;
  suggestedMessage: string;
  reasoning: string;
}> {
  const customerName = order.customerName || "Cliente";
  const productName = order.productName || "producto";
  const normalizedProduct = productName.toLowerCase();

  // Find purchased product in catalog to extract its provider/proveedor
  const purchasedProductInCatalog = products.find(p => 
    (p.id && order.productId && String(p.id).toLowerCase() === String(order.productId).toLowerCase()) ||
    (p.name && p.name.toLowerCase().includes(normalizedProduct)) ||
    (normalizedProduct && p.name && normalizedProduct.includes(p.name.toLowerCase()))
  );
  const purchasedProvider = purchasedProductInCatalog?.provider || purchasedProductInCatalog?.proveedor || purchasedProductInCatalog?.vendor || order.provider || order.proveedor || null;

  // Create list of catalog products highlighting same provider
  const catalogStr = products.map(p => {
    const pProvider = p.provider || p.proveedor || p.vendor || null;
    const isSameProvider = purchasedProvider && pProvider && String(pProvider).toLowerCase() === String(purchasedProvider).toLowerCase();
    return `- ID: "${p.id}", Nombre: "${p.name}", Categoría: "${p.category || 'General'}", Precio: $${p.price || 0} COP${isSameProvider ? " ⭐ [MISMO PROVEEDOR Y BODEGA DE DESPACHO QUE EL PRODUCTO COMPRADO - PERMITE COMBO Y ENVÍO EN LA MISMA GUÍA]" : ""}${p.description ? `, Desc: "${p.description.slice(0, 80)}..."` : ""}`;
  }).join("\n");

  const purchaseHistoryStr = customerOrders.map(o => `- Producto: "${o.productName}", Cantidad: ${o.quantity}, Precio: $${o.totalPrice} COP, Fecha: ${o.createdAt ? new Date(o.createdAt).toLocaleDateString() : 'N/A'}`).join("\n");

  const systemInstruction = `Eres un consultor experto de E-commerce y especialista en marketing relacional VIP para "Jansel Shop".
Tu rol es analizar lo que un cliente compró anteriormente, deducir su perfil de intereses, y recomendarle de manera inteligente el MEJOR producto complementario o un COMBO espectacular del catálogo para realizar una venta cruzada (cross-sell).

PAUTAS DE SELECCIÓN Y LOGÍSTICA:
1. Analiza el historial de compras para entender sus gustos. Ejemplo: si compró un artículo de vehículo, le interesan los accesorios automotrices; si compró belleza, el cuidado personal, etc.
2. REGLA DE PROVEEDOR Y BODEGA (OPTIMIZACIÓN DE FLETE): El producto comprado originalmente por el cliente provino de un proveedor/bodega específica. Si en el catálogo existen productos marcados con "⭐ [MISMO PROVEEDOR Y BODEGA DE DESPACHO QUE EL PRODUCTO COMPRADO...]", DEBES PRIORIZAR fuertemente la selección de uno de ellos como producto complementario. Esto permite despachar ambos productos con el mismo proveedor y la misma transportadora sin generar costos de flete dobles. Si no hay ningún producto del mismo proveedor que combine lógicamente, selecciona la mejor opción general del catálogo.
3. CONFIDENCIALIDAD ABSOLUTA: NUNCA menciones nombres de proveedores, "Dropi", "bodega", "lote", "proveedor" ni términos técnicos de logística al cliente en el mensaje. Presenta todo como stock exclusivo de Jansel Shop.
4. Escribe un mensaje de WhatsApp amigable, sumamente persuasivo, profesional y personalizado.
- El tono debe ser de exclusividad VIP: "Como eres cliente VIP de Jansel Shop..." y mencionar que le notificas a él antes que a nadie debido a stock muy limitado.
- Debe iniciar con un saludo personalizado y preguntar sutilmente cómo le ha ido con su compra anterior (entregada hace unos días).
- Debe ofrecer el producto o combo en promoción con un descuento exclusivo y envío gratis contra entrega.
- Debe incluir un llamado a la acción claro, directo y conversacional: "Dime si te lo despacho hoy mismo" o "¿Quieres que te asegure uno de los pocos disponibles?".
- Usa un formato estructurado con emojis apropiados y limpios. No abuses de los emojis.

Devuelve estrictamente un JSON válido con esta estructura exacta:
{
  "customerProfile": "Breve análisis de gustos e intereses del cliente.",
  "recommendedProductId": "ID del producto recomendado del catálogo (o un ID de combo inventado si creas un combo)",
  "recommendedProductName": "Nombre del producto o combo recomendado",
  "reasoning": "Explicación lógica de por qué recomendaste esto basado en su compra anterior y proveedor",
  "suggestedMessage": "Mensaje de WhatsApp profesional, listo para copiar y enviar."
}`;

  const prompt = `CLIENTE:
Nombre: ${customerName}
Compra reciente entregada: ${productName} (Cantidad: ${order.quantity})${purchasedProvider ? `\nProveedor/Bodega de origen: ${purchasedProvider}` : ""}

HISTORIAL DE COMPRAS DEL CLIENTE:
${purchaseHistoryStr || "Ninguna otra compra previa registrada."}

CATÁLOGO DE PRODUCTOS DISPONIBLES EN JANSEL SHOP:
${catalogStr || "No hay productos adicionales en el catálogo digital."}

Genera la recomendación en JSON respetando la estructura solicitada.`;

  // Try LLM cascade
  const apiKey = process.env.OPENROUTER_API_KEY || process.env.NVIDIA_API_KEY || process.env.GEMINI_API_KEY;
  if (apiKey) {
    try {
      let responseText = "";
      if (process.env.OPENROUTER_API_KEY) {
        const resp = await axios.post("https://openrouter.ai/api/v1/chat/completions", {
          model: "google/gemini-2.5-flash",
          messages: [
            { role: "system", content: systemInstruction },
            { role: "user", content: prompt }
          ],
          temperature: 0.3,
          response_format: { type: "json_object" }
        }, {
          headers: {
            "Authorization": `Bearer ${process.env.OPENROUTER_API_KEY}`,
            "Content-Type": "application/json"
          },
          timeout: 15000
        });
        responseText = resp.data.choices[0].message.content;
      } else if (process.env.NVIDIA_API_KEY) {
        const resp = await axios.post("https://integrate.api.nvidia.com/v1/chat/completions", {
          model: "meta/llama-3.1-8b-instruct",
          messages: [
            { role: "system", content: systemInstruction },
            { role: "user", content: prompt }
          ],
          temperature: 0.3,
          response_format: { type: "json_object" }
        }, {
          headers: {
            "Authorization": `Bearer ${process.env.NVIDIA_API_KEY}`,
            "Content-Type": "application/json"
          },
          timeout: 15000
        });
        responseText = resp.data.choices[0].message.content;
      } else if (process.env.GEMINI_API_KEY) {
        const resp = await axios.post(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`, {
          contents: [
            { role: "user", parts: [{ text: `${systemInstruction}\n\n${prompt}` }] }
          ],
          generationConfig: {
            responseMimeType: "application/json",
            temperature: 0.3
          }
        }, {
          headers: { "Content-Type": "application/json" },
          timeout: 15000
        });
        responseText = resp.data.candidates[0].content.parts[0].text;
      }

      if (responseText) {
        const cleaned = responseText.substring(responseText.indexOf("{"), responseText.lastIndexOf("}") + 1);
        const parsed = JSON.parse(cleaned);
        if (parsed.suggestedMessage && parsed.recommendedProductName) {
          return {
            customerProfile: parsed.customerProfile || "Perfil analizado por IA",
            recommendedProductId: parsed.recommendedProductId || "custom-recommendation",
            recommendedProductName: parsed.recommendedProductName,
            suggestedMessage: parsed.suggestedMessage,
            reasoning: parsed.reasoning || "Recomendado por IA"
          };
        }
      }
    } catch (aiErr: any) {
      console.warn("[Post-Purchase AI] AI generation failed, falling back to procedural rules:", aiErr.message);
    }
  }

  // PROCEDURAL RULES FALLBACK (Master fallback if no keys or API failed)
  // Recomendaciones ancladas al catálogo real de 10 productos.
  let customerProfile = "Cliente práctico que valora la tecnología útil en su día a día.";
  let recommendedProductId = "soporte-de-carga-magnetica";
  let recommendedProductName = "Soporte de Carga Magnética 3 en 1";
  let reasoning = "Sin señal clara de categoría, se recomienda el producto más transversal del catálogo: sirve en casa, oficina y carro, y resuelve el problema universal de la batería.";
  let suggestedMessage = `Hola *${customerName}* 👋\n\nHace unos días recibiste tu *${productName}* de Jansel Shop. ¡Esperamos que te haya encantado! 🙌\n\nComo *Cliente VIP*, quiero contarte del *Soporte de Carga Magnética 3 en 1*: carga celular, audífonos y reloj al mismo tiempo con 15W, es plegable y te lo llevas a donde sea.\n\nHoy con *envío gratis* y Pago Contra Entrega. ¿Te lo despacho? 😊`;

  if (normalizedProduct.includes("moto") || normalizedProduct.includes("holder") || normalizedProduct.includes("candado") || normalizedProduct.includes("casco")) {
    customerProfile = "Motociclista que invierte en seguridad y comodidad para su moto.";
    recommendedProductId = "candado-moto-manubrio";
    recommendedProductName = "Candado para Moto Manubrio Seguridad RC";
    reasoning = "El cliente compró un accesorio de moto. La preocupación número uno de todo motero es el robo, y el candado de manubrio es la compra complementaria natural.";
    suggestedMessage = `Hola *${customerName}* 👋\n\nHace unos días recibiste tu *${productName}* de Jansel Shop. ¡Esperamos que la estés disfrutando en cada rodada! 🏍\n\nComo *Cliente VIP*, te cuento del *Candado de Manubrio Antirrobo*: bloquea el freno o el manubrio con acero de alta resistencia, y se pone en segundos.\n\nHoy con *envío gratis* Contra Entrega. ¿Te aseguro uno? 🔒`;
  } else if (normalizedProduct.includes("carpa") || normalizedProduct.includes("carro") || normalizedProduct.includes("auto") || normalizedProduct.includes("aspirador") || normalizedProduct.includes("pulidora") || normalizedProduct.includes("bateria")) {
    customerProfile = "Dueño de vehículo que cuida su carro y quiere evitar imprevistos.";
    recommendedProductId = "iniciador-de-bateria";
    recommendedProductName = "Iniciador de Batería TC 12V";
    reasoning = "El cliente compró algo para su vehículo. Quedarse varado por la batería es el miedo más común, y el iniciador con Pulse Repair resuelve ese dolor puntual.";
    suggestedMessage = `Hola *${customerName}* 👋\n\nHace unos días recibiste tu *${productName}* de Jansel Shop. ¡Esperamos que tu carro esté impecable! 🚗\n\nComo *Cliente VIP*, te cuento del *Iniciador de Batería 12V con Pulse Repair*: carga, repara y arranca tu carro o moto sin depender de nadie.\n\nHoy con *envío gratis* Contra Entrega. ¿Te lo despacho? 🔋`;
  } else if (normalizedProduct.includes("game") || normalizedProduct.includes("consola") || normalizedProduct.includes("selfie") || normalizedProduct.includes("tripode") || normalizedProduct.includes("carga")) {
    customerProfile = "Perfil tecnológico: entretenimiento, gadgets y creación de contenido.";
    recommendedProductId = "game-stick-retro-m8";
    recommendedProductName = "Game Stick Retro M8 4K";
    reasoning = "El cliente compró tecnología. La consola retro es el producto de mayor atractivo emocional del catálogo y encaja con un perfil de entretenimiento en casa.";
    suggestedMessage = `Hola *${customerName}* 👋\n\nHace unos días recibiste tu *${productName}* de Jansel Shop. ¡Esperamos que le estés sacando provecho! 🎮\n\nComo *Cliente VIP*, te cuento del *Game Stick Retro M8*: salida 4K, 64GB, más de 10.000 juegos clásicos y 2 controles inalámbricos incluidos. Conectas el HDMI y listo.\n\nHoy con *envío gratis* Contra Entrega. ¿Te lo aparto? 🔥`;
  }

  return { customerProfile, recommendedProductId, recommendedProductName, suggestedMessage, reasoning };
}

/**
 * Notifies administrators (Jan and Tatiana) about new orders via WhatsApp
 */
async function notifyAdmins(orderData: any, storeName: string, storeConfig?: any) {
  const adminNumbers = getAdminNumbers(storeConfig);
  
  if (adminNumbers.length === 0) {
    console.log("[Admin Notify] No admin numbers configured.");
    return;
  }

  let message = "";
  if (orderData.productName === "Solicitud de asesor humano") {
    message = `🙋‍♂️ *¡SOLICITUD DE ASESORÍA HUMANA!*
Un cliente solicita hablar con un asesor real en *${storeName}*.

👤 *Cliente:* ${orderData.customerName || "Desconocido"}
📞 *Teléfono:* ${orderData.customerPhone || "No especificado"}

_La IA seguirá interactuando y acompañándolo amablemente en el chat de forma natural mientras ingresas al chat._`;
  } else if (storeConfig?.msgNewOrderTemplate) {
    message = storeConfig.msgNewOrderTemplate
      .replace(/{nombre}/g, orderData.customerName || "No especificado")
      .replace(/{telefono}/g, orderData.customerPhone || "No especificado")
      .replace(/{ciudad}/g, orderData.city || "No especificada")
      .replace(/{direccion}/g, orderData.address || "No especificada")
      .replace(/{producto}/g, orderData.productName || "No especificado")
      .replace(/{total}/g, `$${(orderData.totalPrice || 0).toLocaleString()}`);
  } else {
    message = `🚀 *¡NUEVO PEDIDO, JEFE!*
Jan acaba de cerrar un negocio de una vez.

👤 *Cliente:* ${orderData.customerName}
📦 *Producto:* ${orderData.productName}
🔢 *Cant:* ${orderData.quantity}
📍 *Envío:* ${orderData.address}, ${orderData.city}
🏠 *Ref:* ${orderData.addressIndicator || 'N/A'}
💰 *Total:* $${(orderData.totalPrice || 0).toLocaleString()}

_El inventario ya fue descontado automáticamente._`;
  }

  await sendAdminAlert(message);
}

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT) || 3000;

  // Test Database connectivity on boot
  try {
    console.log("[Database] Testing backend connectivity...");
    await getDoc(doc(db, 'test', 'connection'));
    console.log("[Database] Backend connection successful.");
  } catch (err: any) {
    console.warn("[Database] Details:", err.message);
  }

  // Auto-provisionar el template de botones de confirmación de pedido (una sola vez,
  // sin necesidad de tocar la consola de Twilio). Si falla, no bloquea el arranque:
  // el bot cae de vuelta a confirmación por texto normal.
  ensureOrderConfirmationTemplate().catch(e =>
    console.warn("[WhatsApp Buttons] No se pudo pre-provisionar el template al arrancar:", e.message)
  );

  app.use(express.urlencoded({ extended: true }));
  app.use(express.json({ limit: '10mb' }));

  // Railway (y la mayoría de PaaS) terminan TLS en un proxy y reenvían por HTTP
  // internamente. Sin esto, req.protocol siempre daría "http" y req.ip mostraría
  // la IP del proxy en vez de la real — ambos necesarios para validar la firma
  // de Twilio correctamente y para logging/rate-limit por IP real.
  app.set("trust proxy", true);

  // -------------------------------------------------------------
  // 🗄️ SUPABASE / LOCAL DB REST API FOR CLIENT-FRONTEND PROXY
  // -------------------------------------------------------------
  
  app.post("/api/admin/login", async (req: express.Request, res: express.Response) => {
    try {
      const { phone, password, supabaseAccessToken } = req.body || {};
      const normalizedPhone = String(phone || "").replace(/[^\d+]/g, "");
      let verified = false;

      // Opción 1: sesión real verificada contra Supabase Auth (OTP por SMS o Google)
      if (!verified && supabaseAccessToken && supabaseServer) {
        try {
          const { data, error } = await supabaseServer.auth.getUser(supabaseAccessToken);
          if (!error && data?.user) {
            const userPhone = data.user.phone ? `+${String(data.user.phone).replace(/[^\d]/g, "")}` : "";
            if (userPhone === ADMIN_PHONE_SERVER) verified = true;
          }
        } catch (e) {
          console.warn("[Admin Login] Error verificando token de Supabase:", e);
        }
      }

      // Opción 2: password server-side (NUNCA se manda al navegador, a diferencia de
      // VITE_ADMIN_PASSWORD que sí queda visible en el bundle público).
      if (!verified && ADMIN_PASSWORD_SERVER && password === ADMIN_PASSWORD_SERVER && normalizedPhone === ADMIN_PHONE_SERVER) {
        verified = true;
      }

      // En modo local emulado (sin Supabase real) no hay datos reales en riesgo.
      if (!verified && !IS_CLOUD_DB_MODE && normalizedPhone === ADMIN_PHONE_SERVER) {
        verified = true;
      }

      if (!verified) {
        return res.status(401).json({ error: "No autorizado" });
      }

      const token = issueAdminSessionToken(ADMIN_PHONE_SERVER);
      res.json({ token, expiresIn: 12 * 60 * 60 });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get("/api/db/getDoc", async (req, res) => {
    const { collection: colName, id } = req.query;
    const col = String(colName);
    if (!PUBLIC_READ_COLLECTIONS.has(col) && !isAdminRequestAuthorized(req)) {
      return res.status(403).json({ error: "Acceso no autorizado a esta colección" });
    }
    try {
      const result = await dbGetDoc(col, String(id));
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/db/getDocs", async (req, res) => {
    const { collection: colName, constraints } = req.body;
    if (!PUBLIC_READ_COLLECTIONS.has(colName) && !isAdminRequestAuthorized(req)) {
      return res.status(403).json({ error: "Acceso no autorizado a esta colección" });
    }
    try {
      const docs = await dbGetDocs(colName, constraints || []);
      res.json({ docs });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/db/setDoc", async (req, res) => {
    if (!isAdminRequestAuthorized(req)) {
      return res.status(403).json({ error: "Acceso no autorizado" });
    }
    const { collection: colName, id, data, merge } = req.body;
    try {
      await dbSetDoc(colName, id, data, merge !== false);
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/db/updateDoc", async (req, res) => {
    if (!isAdminRequestAuthorized(req)) {
      return res.status(403).json({ error: "Acceso no autorizado" });
    }
    const { collection: colName, id, data } = req.body;
    try {
      await dbSetDoc(colName, id, data, true);
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/db/deleteDoc", async (req, res) => {
    if (!isAdminRequestAuthorized(req)) {
      return res.status(403).json({ error: "Acceso no autorizado" });
    }
    const { collection: colName, id } = req.body;
    try {
      await dbDeleteDoc(colName, id);
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/storage/upload", (req, res) => {
    res.json({ url: "https://images.unsplash.com/photo-1546868871-7041f2a55e12?auto=format&fit=crop&q=80&w=400" });
  });

  app.get("/api/db/supabase-status", (req, res) => {
    const status: Record<string, any> = {
      connected: !!supabaseServer,
      mode: supabaseServer ? "Conectado a la Nube (Supabase)" : "Simulación Local (Auto-Fallback)",
      collections: {}
    };
    const colNames = ["stores", "products", "orders", "activities", "customers", "conversations", "config", "followups"];
    for (const name of colNames) {
      status.collections[name] = {
        localCount: Object.keys(localDbCache[name] || {}).length,
      };
    }
    res.json(status);
  });

  // DEBUG ROUTE: Visit /api/health to see if Jan is alive
  app.get("/api/health", (req, res) => {
    res.json({
      status: "Jan is alive",
      time: new Date().toISOString(),
      twilio_configured: !!process.env.TWILIO_ACCOUNT_SID,
      nvidia_key_detected: !!process.env.NVIDIA_API_KEY,
      openrouter_key_detected: !!process.env.OPENROUTER_API_KEY,
      app_url: currentAppUrl || process.env.APP_URL || "Not set"
    });
  });

  // IMAGE PROXY: Bypasses anti-hotlinking protection (403/405 blocks) on MercadoLibre/Dropi CDNs
  app.get("/api/image-proxy", async (req, res) => {
    const imageUrl = req.query.url as string;
    if (!imageUrl) {
      return res.status(400).send("Missing url parameter");
    }

    // 🛡️ VALIDACIÓN DE SEGURIDAD (SSRF): sin esto, cualquiera podía usar
    // este endpoint para que el servidor consultara direcciones internas de
    // la red o el endpoint de metadatos de la nube (un vector clásico de
    // robo de credenciales), o usarlo como un "open redirect" de phishing.
    let parsedUrl: URL;
    try {
      parsedUrl = new URL(imageUrl);
    } catch {
      return res.status(400).send("URL inválida");
    }
    if (parsedUrl.protocol !== "http:" && parsedUrl.protocol !== "https:") {
      return res.status(400).send("Protocolo no permitido");
    }
    const hostname = parsedUrl.hostname.toLowerCase();
    const isBlockedHost =
      hostname === "localhost" ||
      hostname === "0.0.0.0" ||
      hostname === "169.254.169.254" || // metadata de la nube (AWS/GCP/Azure)
      /^127\./.test(hostname) ||
      /^10\./.test(hostname) ||
      /^192\.168\./.test(hostname) ||
      /^172\.(1[6-9]|2\d|3[01])\./.test(hostname);
    if (isBlockedHost) {
      console.warn(`[Image Proxy] Bloqueado intento de acceder a host interno: ${hostname}`);
      return res.status(403).send("Host no permitido");
    }

    try {
      const response = await axios.get(imageUrl, {
        responseType: "arraybuffer",
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          "Accept": "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8"
        },
        timeout: 10000, // 10s timeout
        maxRedirects: 3
      });
      const contentType = response.headers["content-type"] || "image/jpeg";
      res.setHeader("Content-Type", contentType);
      res.setHeader("Cache-Control", "public, max-age=31536000"); // Cache for 1 year
      return res.send(response.data);
    } catch (error: any) {
      console.error(`[Image Proxy Error] Failed to proxy image: ${imageUrl}. Error: ${error.message}`);
      // Ya NO hacemos redirect a la URL arbitraria (era un open-redirect).
      // Devolvemos un error controlado en su lugar.
      return res.status(502).send("No se pudo cargar la imagen");
    }
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

  // Manual Admin Send Message Endpoint
  app.post("/api/admin/send-message", express.json(), async (req, res) => {
    try {
      const { to, message, mediaUrl, platform, pageId, offeredProduct, offeredPrice, offeredQuantity } = req.body;
      if (!to || (!message && !mediaUrl)) {
        return res.status(400).json({ success: false, error: "Falta destinatario o contenido del mensaje." });
      }

      const cleanPhone = String(to).replace("whatsapp:", "").trim();
      const formattedPhone = to.startsWith("whatsapp:") ? to : `whatsapp:${cleanPhone}`;
      const targetPlatform = platform || (to.startsWith("whatsapp:") || !to.startsWith("0x") ? "whatsapp" : "instagram");
      const botNumber = pageId ? (pageId.startsWith("whatsapp:") ? pageId : `whatsapp:${pageId}`) : (TWILIO_FROM_NUMBER || "whatsapp:+14155238886");
      const assignedStoreId = await determineStoreId(cleanPhone, message || "");

      // 🛡️ Nunca dejar que el bot/asesor se mande un mensaje a sí mismo
      // (protección rescatada de una ruta duplicada que existía antes).
      if (targetPlatform === "whatsapp" && formattedPhone === (botNumber.startsWith("whatsapp:") ? botNumber : `whatsapp:${botNumber}`)) {
        console.warn("[Admin Send Message] Intento de enviar mensaje al propio número del bot. Bloqueado.");
        return res.status(400).json({ success: false, error: "No se puede enviar un mensaje al mismo número del bot." });
      }


      // 1. Auto-pause AI for this customer when human manually sends a message
      await setCustomerAiPauseState(cleanPhone, assignedStoreId, true);

      // 1b. Si el asesor indicó qué producto/precio le está ofreciendo (campo
      // opcional desde el dashboard), lo guardamos como "oferta pendiente".
      // Esto permite que, cuando el asesor reactive la IA y el cliente
      // responda afirmativamente (aunque sea horas después), el servidor
      // reconozca EXACTAMENTE en qué quedaron y mande los botones de
      // confirmación correctos — sin depender de que la IA "adivine" bien.
      if (offeredProduct && offeredPrice) {
        const customerProfileId = customerDocId(assignedStoreId, cleanPhone);
        await setDoc(doc(db, "customers", customerProfileId), {
          pendingManualOffer: {
            producto: offeredProduct,
            valor: Number(offeredPrice),
            cantidad: offeredQuantity && offeredQuantity > 0 ? offeredQuantity : 1,
            offeredAt: new Date().toISOString()
          }
        }, { merge: true });
        console.log(`[Admin Send Message] Oferta pendiente guardada para ${cleanPhone}: ${offeredProduct} @ ${offeredPrice}`);
      }

      let sendResult: any = false;
      if (targetPlatform === "whatsapp" || formattedPhone.startsWith("whatsapp:")) {
        sendResult = await sendWhatsApp(formattedPhone, message || "", mediaUrl || undefined, undefined, botNumber);
      } else {
        await sendMetaMessage(to, message || "", targetPlatform, pageId);
        sendResult = true;
      }

      // 2. Register activity in Firestore so it appears in chat UI
      // IMPORTANTE: "from" debe ser el teléfono del CLIENTE (no el del bot),
      // porque getCrmContext() arma el historial de la IA filtrando por
      // from == customerPhone. Si aquí se guardaba from=botNumber, el mensaje
      // del asesor humano quedaba invisible para la IA al reanudarse, dando
      // la sensación de que "se pierde el contexto" tras la intervención manual.
      const activityData = {
        from: formattedPhone,
        to: botNumber,
        recipient: formattedPhone,
        customerPhone: cleanPhone,
        storeId: assignedStoreId,
        message: "[Asesor Humano]",
        response: message || (mediaUrl ? "[Imagen adjunta]" : ""),
        mediaUrl: mediaUrl || null,
        status: "respondido",
        whatsappStatus: "sent",
        senderType: "bot",
        manualAgent: "Asesor Humano",
        timestamp: serverTimestamp(),
        receivedAt: serverTimestamp()
      };
      await addDoc(collection(db, "activities"), activityData);

      console.log(`[Admin Send Message] Manual message sent to ${cleanPhone}`);
      res.json({ success: true });
    } catch (e: any) {
      console.error("[Admin Send Message Error]", e);
      res.status(500).json({ success: false, error: e.message });
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
    const testContentSid = await ensureAdminAlertTemplate();
    for (const num of adminNumbers) {
      try {
        const target = num.trim().startsWith("whatsapp:") ? num.trim() : `whatsapp:${num.trim()}`;
        if (testContentSid && twilioClient) {
          await (twilioClient as any).messages.create({
            from: normalizePhone(TWILIO_FROM_NUMBER || "+14155238886"),
            to: normalizePhone(target),
            contentSid: testContentSid,
            contentVariables: JSON.stringify({ "1": message.slice(0, 1024) })
          });
        } else {
          await sendWhatsApp(target, message);
        }
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
      const { storeId } = req.body || {};
      const targetStore = storeId || "default";
      console.log(`[Admin Clear] Deleting all orders and activities for store ${targetStore}...`);
      
      const qOrders = query(collection(db, "orders"), where("storeId", "==", targetStore));
      const qActivities = query(collection(db, "activities"), where("storeId", "==", targetStore));
      
      const ordersSnap = await getDocs(qOrders);
      const activitiesSnap = await getDocs(qActivities);
      
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
      const { catalog, storeId } = req.body || {};
      await seedDatabase(true, catalog, storeId || "default");
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

  // ─── Sistema de referidos (mecánica estilo Temu) ────────────────────────────
  // Las reglas del reto viven aquí y en ningún otro sitio: para pasar de 1 hora
  // a 24, o de 3 invitados a 5, se cambia solo esta constante.
  const REFERRAL_GOAL = 3;                     // invitados válidos para desbloquear
  const REFERRAL_WINDOW_MS = 60 * 60 * 1000;   // 1 hora, contada desde que ACEPTA el reto
  const REFERRAL_DISCOUNT_PCT = 15;            // % de descuento al completar la meta
  const GUEST_DISCOUNT_PCT = 15;               // cupón que gana el invitado por dejar su WhatsApp
  const GUEST_DISCOUNT_HOURS = 24;             // vigencia de ese cupón
  const DISCOUNT_MIN_ITEMS = 2;                // ambos descuentos exigen 2+ productos: asi el
                                               // margen absoluto del pedido los absorbe sin perdida

  const newReferralCode = () => Math.random().toString(36).slice(2, 8).toUpperCase();

  // Estado derivado: nunca confiamos en un "unlocked" guardado, se recalcula
  // siempre contra el reloj para que un reto vencido no siga dando descuento.
  const referralState = (d: any) => {
    const invited: string[] = Array.isArray(d?.invited) ? d.invited : [];
    const expiresAt = Number(d?.expiresAt) || 0;
    const expired = Date.now() > expiresAt;
    const unlocked = invited.length >= REFERRAL_GOAL && !expired;
    return {
      code: d?.code || "",
      invited: invited.length,
      goal: REFERRAL_GOAL,
      expiresAt,
      msLeft: Math.max(0, expiresAt - Date.now()),
      expired,
      unlocked,
      discountPct: unlocked ? REFERRAL_DISCOUNT_PCT : 0,
    };
  };

  const findReferral = async (code: string) => {
    if (!code) return null;
    const snap = await getDocs(query(collection(db, "referrals"), where("code", "==", code)));
    return snap.empty ? null : snap.docs[0];
  };

  // Arranca el reto. El reloj empieza AQUÍ y no al cargar la página: es lo que
  // convierte un banner en un compromiso, que es de donde sale la urgencia real.
  app.post("/api/referral/start", async (req, res) => {
    try {
      const { deviceId } = req.body || {};
      if (!deviceId || typeof deviceId !== "string") {
        return res.status(400).json({ error: "deviceId requerido" });
      }
      const code = newReferralCode();
      const expiresAt = Date.now() + REFERRAL_WINDOW_MS;
      await setDoc(doc(db, "referrals", code), {
        code,
        ownerDeviceId: deviceId,
        invited: [],
        startedAt: Date.now(),
        expiresAt,
      }, { merge: false });
      console.log(`[Referral] Reto iniciado: ${code} (meta ${REFERRAL_GOAL} en ${REFERRAL_WINDOW_MS / 60000} min)`);
      res.json(referralState({ code, invited: [], expiresAt }));
    } catch (e: any) {
      console.error("[Referral Start] Error:", e?.message);
      res.status(500).json({ error: e?.message || "Error iniciando el reto" });
    }
  });

  // Un invitado deja su WhatsApp. Contamos personas, no aperturas: por eso pedimos
  // el número y deduplicamos. Así el reto no se infla con pestañas de incógnito.
  app.post("/api/referral/join", async (req, res) => {
    try {
      const { code, phone, deviceId } = req.body || {};
      if (!code || !phone) return res.status(400).json({ error: "code y phone requeridos" });

      const clean = String(phone).replace(/\D/g, "");
      if (clean.length < 10) return res.status(400).json({ error: "Número de WhatsApp inválido" });

      const snap = await findReferral(String(code).toUpperCase());
      if (!snap) return res.status(404).json({ error: "Ese reto no existe" });

      const d: any = snap.data();
      const state = referralState(d);
      if (state.expired) return res.status(410).json({ ...state, error: "El reto ya vencío" });

      // El dueño no puede autoinvitarse.
      if (deviceId && d.ownerDeviceId && deviceId === d.ownerDeviceId) {
        return res.status(400).json({ ...state, error: "No puedes contarte a ti mismo" });
      }

      const invited: string[] = Array.isArray(d.invited) ? d.invited : [];
      if (invited.includes(clean)) {
        return res.json({ ...referralState(d), already: true });
      }

      const next = [...invited, clean];
      await setDoc(doc(db, "referrals", snap.id), { invited: next }, { merge: true });

      // Cada invitado es además un lead real para el bot, y se lleva su propio
      // cupón. Guardamos la vigencia para poder validarla después contra el reloj.
      const guestExpires = Date.now() + GUEST_DISCOUNT_HOURS * 60 * 60 * 1000;
      try {
        await setDoc(doc(db, "customers", clean), {
          phone: clean,
          source: "referido",
          referralCode: d.code,
          discountPct: GUEST_DISCOUNT_PCT,
          discountMinItems: DISCOUNT_MIN_ITEMS,
          discountExpiresAt: guestExpires,
          createdAt: new Date().toISOString(),
        }, { merge: true });
      } catch (e: any) {
        console.warn("[Referral] No se pudo guardar el lead:", e?.message);
      }

      // Mensaje de bienvenida con el cupón. Ojo: Twilio solo permite escribir
      // primero dentro de la ventana de 24h o con plantilla aprobada, así que
      // esto llega si ese número ya habló con el bot antes. Para el resto, el
      // front muestra un botón que abre WhatsApp y así el propio invitado abre
      // la ventana — por eso devolvemos también el texto ya armado.
      const guestMsg = [
        "🎁 *¡Ganaste 15% de descuento!*",
        "",
        "Gracias por ayudar a tu amigo. Te activamos un *" + GUEST_DISCOUNT_PCT + "% OFF* en Jan Sel Shop.",
        "",
        "✅ Válido por " + GUEST_DISCOUNT_HOURS + " horas",
        "✅ En el producto que quieras del catálogo",
        "✅ Aplica llevando " + DISCOUNT_MIN_ITEMS + " productos o más",
        "🚚 Envío gratis y pagas al recibir",
        "",
        "Escríbeme *QUIERO* y te muestro el catálogo 👇",
      ].join(String.fromCharCode(10));

      try {
        await sendWhatsApp("whatsapp:+" + clean, guestMsg);
        console.log(`[Referral] Cupón enviado por WhatsApp a ${clean}`);
      } catch (e: any) {
        console.warn(`[Referral] No se pudo escribir primero a ${clean} (ventana de 24h):`, e?.message);
      }

      console.log(`[Referral] ${d.code}: ${next.length}/${REFERRAL_GOAL} invitados`);
      res.json({
        ...referralState({ ...d, invited: next }),
        guest: {
          discountPct: GUEST_DISCOUNT_PCT,
          hours: GUEST_DISCOUNT_HOURS,
          minItems: DISCOUNT_MIN_ITEMS,
          expiresAt: guestExpires,
          waText: guestMsg,
        },
      });
    } catch (e: any) {
      console.error("[Referral Join] Error:", e?.message);
      res.status(500).json({ error: e?.message || "Error registrando el invitado" });
    }
  });

  // Progreso del reto. El front lo consulta para pintar el contador y el 0/3.
  app.get("/api/referral/status", async (req, res) => {
    try {
      const code = String(req.query.code || "").toUpperCase();
      const snap = await findReferral(code);
      if (!snap) return res.status(404).json({ error: "Ese reto no existe" });
      res.json(referralState(snap.data()));
    } catch (e: any) {
      console.error("[Referral Status] Error:", e?.message);
      res.status(500).json({ error: e?.message || "Error consultando el reto" });
    }
  });


  // Sincronización manual de imágenes/catálogo desde Google Sheets (o consultar el último estado)
  app.post("/api/admin/sync-catalog-images", async (req, res) => {
    try {
      await syncCatalogFromSheet();
      res.json({ success: true, summary: lastCatalogSyncSummary });
    } catch (e: any) {
      res.status(500).json({ success: false, error: e.message });
    }
  });
  app.get("/api/admin/sync-catalog-images", (req, res) => {
    res.json({ success: true, summary: lastCatalogSyncSummary, configured: !!process.env.GOOGLE_SHEETS_CATALOG_CSV_URL });
  });

  // Toggle AI (Synchronize pause state across conversations and customer profiles)
  app.post("/api/whatsapp/toggle-ai", async (req, res) => {
    const { phone, pause } = req.body;
    if (!phone) return res.status(400).json({ error: "Número requerido" });
    const cleanPhone = String(phone).replace("whatsapp:", "").trim();
    try {
      await setCustomerAiPauseState(cleanPhone, "default", !!pause);
      console.log(`[Toggle AI] Estado de IA actualizado para ${cleanPhone}: pause=${!!pause}`);
      res.json({ success: true, pause: !!pause });
    } catch (e: any) {
      console.error("[Toggle AI] Error:", e);
      res.status(500).json({ error: e.message });
    }
  });

  // Manual Order Confirmation Request Endpoint (Dispatches interactive WA buttons to client)
  // ==============================================
  // 🆕 OFRECER PRODUCTO PERSONALIZADO (fuera de catálogo)
  // ==============================================
  // El asesor humano usa esto cuando le ofrece manualmente al cliente un
  // producto que NO está en el catálogo (ej. "luces LED" a un precio que se
  // negoció por chat). En vez de que el asesor tenga que redactar el mensaje
  // Y esperar la respuesta del cliente a mano, este endpoint le manda
  // botones reales de "Sí, confirmar" / "No, cambiar algo", y si el cliente
  // toca "Sí", el flujo normal de checkout (ya existente) continúa solo:
  // pide los datos de envío que falten y sube el pedido al dashboard, sin
  // que el asesor tenga que hacer nada más.
  // ==============================================
  // 🔄 CAMPAÑA DE REACTIVACIÓN DE CLIENTES FRÍOS
  // ==============================================
  // Le manda un mensaje de "reactivación" (con gatillo mental de urgencia)
  // a clientes que navegaron el catálogo pero nunca confirmaron pedido y
  // llevan tiempo sin escribir. Usa el mismo template YA APROBADO por Meta
  // que usa la campaña de tendencias (obligatorio, porque WhatsApp no deja
  // mandar texto libre a alguien con quien no hablas hace más de 24h).
  // Personaliza el mensaje con el ÚLTIMO producto que esa persona vio
  // (guardado en lastProductList), para que se sienta relevante y no como
  // spam genérico.
  async function runReactivationCampaign(storeId: string = "default", dormantHours: number = 12): Promise<{ sent: number; totalCandidates: number }> {
    const cooldownHours = 72; // no reactivar al mismo cliente más de 1 vez cada 3 días

    const custSnap = await getDocs(query(collection(db, "customers")));
    const now = Date.now();
    const candidates: any[] = [];

    custSnap.forEach(d => {
      const c = d.data();
      if (c.marketingOptOut) return;
      if (c.etapa === "compro" || c.etapa === "pedido_confirmado") return;

      const lastInteraction = c.lastInteractionAt ? new Date(c.lastInteractionAt).getTime() : 0;
      if (!lastInteraction) return;
      const hoursSince = (now - lastInteraction) / (1000 * 60 * 60);
      if (hoursSince < dormantHours) return; // todavía "caliente", no tocar

      const lastReactivation = c.lastReactivationAt || 0;
      if (now - lastReactivation < cooldownHours * 60 * 60 * 1000) return; // ya se reactivó hace poco

      if (!c.phone) return;
      candidates.push({ id: d.id, phone: c.phone, name: c.name, lastProductList: c.lastProductList || [] });
    });

    if (candidates.length === 0) {
      return { sent: 0, totalCandidates: 0 };
    }

    // El producto guardado en el cliente puede ser del catálogo viejo. El 01/09
    // salieron 44 mensajes ofreciendo Carplay Para Moto, Cera M1 y Kit
    // Lubristone, que ya no se venden: 34 de 37 clientes tenían guardado algo
    // descontinuado. Se valida contra el catálogo vigente y, si no está, se usa
    // el mensaje genérico en vez de prometer algo que no se puede despachar.
    const catalogoVigente = await loadProductsForStore(storeId);
    const nombresVigentes = new Set(catalogoVigente.map((p: any) => normalizarParaBuscar(p.name)));

    // Tope por corrida: aunque se acumulen candidatos, nunca se manda una ráfaga.
    // Los 44 mensajes en 82 segundos de esa madrugada son exactamente el patrón
    // que WhatsApp lee como spam.
    const TOPE_POR_CORRIDA = 12;

    let sentCount = 0;
    let descartadosPorProducto = 0;
    for (const c of candidates) {
      if (sentCount >= TOPE_POR_CORRIDA) {
        console.log(`[Reactivation Campaign] Tope de ${TOPE_POR_CORRIDA} alcanzado; el resto queda para la próxima corrida.`);
        break;
      }

      const guardado = c.lastProductList?.[0];
      const sigueVigente = guardado?.name && nombresVigentes.has(normalizarParaBuscar(guardado.name));
      if (guardado && !sigueVigente) descartadosPorProducto++;
      const topProduct = sigueVigente ? guardado : null;

      const productName = topProduct?.name || "nuestro catálogo";
      const pitch = topProduct
        ? `¡Hola! 👋 Vi que te interesó *${topProduct.name}* — se está agotando rápido y no quería que te quedaras sin el tuyo. ¿Seguimos con tu pedido? 🚀 Envío gratis contraentrega.`
        : `¡Hola! 👋 ¿Sigues buscando algo especial? Tenemos ofertas nuevas esta semana con envío gratis contraentrega. ¡Cuéntame qué necesitas! 🛍️`;

      const sent = await sendTrendOfferButtons(
        `whatsapp:${c.phone.replace("whatsapp:", "").replace("+", "")}`,
        TWILIO_FROM_NUMBER || "+14155238886",
        productName,
        pitch,
        topProduct?.imageUrl || ""
      );

      if (sent) {
        sentCount++;
        await setDoc(doc(db, "customers", c.id), { lastReactivationAt: now }, { merge: true });
        await addDoc(collection(db, "activities"), {
          from: normalizePhone(TWILIO_FROM_NUMBER || ""),
          to: `whatsapp:${c.phone}`,
          customerPhone: c.phone.replace("+", ""),
          message: pitch,
          status: "respondido",
          whatsappStatus: "sent",
          manualAgent: "Campaña de Reactivación",
          storeId,
          timestamp: serverTimestamp()
        });
      }

      await new Promise(r => setTimeout(r, 1500));
    }

    if (descartadosPorProducto > 0) {
      console.log(`[Reactivation Campaign] ${descartadosPorProducto} clientes tenían guardado un producto que ya no está en el catálogo; se les mandó el mensaje genérico en vez del producto.`);
    }
    return { sent: sentCount, totalCandidates: candidates.length };
  }

  // ==============================================
  // 📊 REPORTE DE DEMANDA (qué piden que NO tenemos)
  // ==============================================
  // Agrupa las solicitudes de productos fuera de catálogo (registradas cada
  // vez que la IA escala a un asesor) para saber qué agregar al catálogo
  // con demanda YA comprobada por clientes reales.
  async function buildDemandReport(days: number = 7): Promise<{ total: number; grouped: { producto: string; veces: number; ejemploMensaje: string }[] }> {
    const sinceTs = Date.now() - days * 24 * 60 * 60 * 1000;
    const snap = await getDocs(query(collection(db, "demand_requests"), orderBy("timestamp", "desc")));

    const items: any[] = [];
    snap.forEach(d => {
      const data = d.data();
      const ts = data.timestamp?.toMillis?.() || 0;
      if (ts >= sinceTs) items.push(data);
    });

    const groups: Record<string, { veces: number; ejemploMensaje: string }> = {};
    for (const it of items) {
      const key = String(it.requestedProduct || "Sin especificar").trim().toLowerCase();
      if (!groups[key]) groups[key] = { veces: 0, ejemploMensaje: it.customerMessage || it.requestedProduct };
      groups[key].veces++;
    }

    const grouped = Object.entries(groups)
      .map(([producto, v]) => ({ producto, veces: v.veces, ejemploMensaje: v.ejemploMensaje }))
      .sort((a, b) => b.veces - a.veces);

    return { total: items.length, grouped };
  }

  app.get("/api/admin/demand-report", async (req, res) => {
    try {
      const days = Number(req.query.days) || 7;
      const report = await buildDemandReport(days);
      res.json({ success: true, periodDays: days, ...report });
    } catch (e: any) {
      console.error("[Demand Report] Error:", e);
      res.status(500).json({ error: e.message });
    }
  });

  app.post("/api/admin/reactivation-campaign", async (req, res) => {
    try {
      const storeId = req.body?.storeId || "default";
      const dormantHours = Number(req.body?.dormantHours) || 12;
      const result = await runReactivationCampaign(storeId, dormantHours);
      if (result.totalCandidates === 0) {
        return res.json({ success: true, sent: 0, message: "No hay clientes fríos elegibles en este momento (o todos siguen en cooldown)." });
      }
      res.json({ success: true, ...result });
    } catch (e: any) {
      console.error("[Reactivation Campaign] Error:", e);
      res.status(500).json({ error: e.message });
    }
  });

  app.post("/api/admin/offer-custom-product", async (req, res) => {
    try {
      const { phone, productName, price, quantity, notes } = req.body;
      if (!phone || !productName || !price) {
        return res.status(400).json({ error: "Faltan datos: phone, productName y price son requeridos." });
      }

      const cleanPhone = String(phone).replace("whatsapp:", "").trim();
      const storeId = "default";
      const customerProfileId = customerDocId(storeId, cleanPhone);

      // Traemos cualquier dato que ya tengamos del cliente (nombre, ciudad,
      // dirección) para no pedirle de nuevo lo que ya sabemos.
      const custSnap = await getDoc(doc(db, "customers", customerProfileId));
      const custData = custSnap.exists() ? custSnap.data() : {};

      const checkoutData = {
        producto: productName,
        cantidad: quantity && quantity > 0 ? quantity : 1,
        nombre: custData?.name || custData?.nombre || "",
        telefono: `whatsapp:${cleanPhone}`,
        ciudad: custData?.city || custData?.ciudad || "",
        direccion: custData?.address || custData?.direccion || "",
        referencia: custData?.addressIndicator || "N/A",
        valor: Number(price),
        notas: notes || "Producto ofrecido manualmente por asesor (fuera de catálogo)."
      };

      // Pausamos la IA para este cliente mientras se resuelve esta oferta
      // puntual, para que no se cruce con lo que el asesor ya está haciendo.
      await setCustomerAiPauseState(cleanPhone, storeId, true);

      await sendCheckoutSummaryAndButtons(
        `whatsapp:${cleanPhone}`,
        TWILIO_FROM_NUMBER || "+14155238886",
        customerProfileId,
        checkoutData,
        undefined,
        storeId
      );

      res.json({ success: true, message: "Oferta enviada con botones de confirmación por WhatsApp." });
    } catch (e: any) {
      console.error("[Offer Custom Product] Error:", e);
      res.status(500).json({ error: e.message });
    }
  });

  app.post("/api/admin/request-order-confirmation", async (req, res) => {
    try {
      const { orderId } = req.body;
      if (!orderId) return res.status(400).json({ error: "orderId requerido" });

      const orderSnap = await getDoc(doc(db, "orders", orderId));
      if (!orderSnap.exists()) return res.status(404).json({ error: "Pedido no encontrado" });

      const orderData = orderSnap.data();
      const rawPhone = orderData.customerPhone || "";
      const cleanPhone = rawPhone.replace("whatsapp:", "").trim();

      await sendDispatchConfirmationButtons(
        `whatsapp:${cleanPhone}`,
        TWILIO_FROM_NUMBER || "+14155238886",
        orderId,
        orderData.productName || "tu producto"
      );

      await updateDoc(doc(db, "orders", orderId), {
        confirmationRequestedAt: serverTimestamp()
      });

      res.json({ success: true, message: "Mensaje de confirmación de despacho enviado exitosamente por WhatsApp." });
    } catch (e: any) {
      console.error("[Request Order Confirmation] Error:", e);
      res.status(500).json({ error: e.message });
    }
  });

  // Forced Sync on Boot (Self-Correction for Sincronizar button issues)
  // SEED ONLY IF EMPTY to save quota
  seedDatabase().catch(e => console.error("[Jan Sync] Error en arranque:", e));

  // Reparte automáticamente la cola de ofertas de tendencia cada 5 minutos.
  setInterval(() => {
    dispatchTrendQueue().catch(e => console.error("[Trend Dispatcher] Error en el ciclo:", e.message));
  }, 5 * 60 * 1000);

  // Admin Config Endpoints
  app.post("/api/admin/upload", express.raw({ type: "*/*", limit: "50mb" }), async (req, res) => {
    const mimeType = req.headers["content-type"] || "application/octet-stream";
    const id = Math.random().toString(36).substring(7);
    await saveMediaPersistent(id, req.body, String(mimeType));
    
    let ext = "";
    if (mimeType.includes("image/jpeg")) ext = ".jpg";
    else if (mimeType.includes("image/png")) ext = ".png";
    else if (mimeType.includes("image/gif")) ext = ".gif";
    else if (mimeType.includes("image/webp")) ext = ".webp";
    else if (mimeType.includes("video/mp4")) ext = ".mp4";
    else if (mimeType.includes("video/webm")) ext = ".webm";
    else if (mimeType.includes("audio/mpeg") || mimeType.includes("audio/mp3")) ext = ".mp3";
    else if (mimeType.includes("audio/wav")) ext = ".wav";
    else if (mimeType.includes("audio/ogg") || mimeType.includes("audio/oga")) ext = ".ogg";
    else if (mimeType.includes("application/pdf")) ext = ".pdf";
    else if (mimeType.includes("msword")) ext = ".doc";
    else if (mimeType.includes("officedocument.wordprocessingml")) ext = ".docx";
    else if (mimeType.includes("ms-excel")) ext = ".xls";
    else if (mimeType.includes("officedocument.spreadsheetml")) ext = ".xlsx";
    else if (mimeType.includes("text/plain")) ext = ".txt";
    else if (mimeType.includes("zip")) ext = ".zip";
    else if (mimeType.includes("csv")) ext = ".csv";
    
    let protocol = req.headers["x-forwarded-proto"] || req.protocol;
    if (Array.isArray(protocol)) protocol = protocol[0];
    const host = req.headers["x-forwarded-host"] || req.headers["host"];
    const baseUrl = currentAppUrl || process.env.APP_URL || `${protocol}://${host}`;
    
    res.json({ success: true, mediaId: id, url: `${baseUrl}/api/media/${id}${ext}` });
  });

  // Agrega UN producto sin afectar el resto del catálogo (a diferencia de /api/admin/seed,
  // que reemplaza TODO el catálogo). Además marca el producto como "en tendencia" y dispara
  // automáticamente el estudio + envío escalonado a clientes.
  app.post("/api/admin/products/add-trending", express.json(), async (req, res) => {
    try {
      const { name, price, category, description, storeId, imageUrl } = req.body;
      if (!name || !price) {
        return res.status(400).json({ success: false, error: "Falta el nombre o el precio del producto." });
      }
      const targetStoreId = storeId || "default";
      const rawId = Math.random().toString(36).substring(7);
      const finalDocId = `${targetStoreId}_${rawId}`;
      const productData = {
        id: rawId,
        name,
        price: Number(price),
        category: category || "General",
        description: description || "Producto agregado manualmente",
        imageUrl: imageUrl || "",
        stock: 20,
        storeId: targetStoreId,
        trending: true,
        trendingAt: Date.now(),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      };

      // setDoc con merge = UPSERT de un solo documento. Nunca borra ni toca otros productos.
      await setDoc(doc(db, "products", finalDocId), productData, { merge: true });
      console.log(`[Add Product] Producto "${name}" agregado sin afectar el resto del catálogo (${finalDocId}).`);

      // Dispara el estudio + campaña de tendencia en segundo plano (no bloquea la respuesta al admin)
      triggerTrendCampaign(productData, targetStoreId).catch((e: any) =>
        console.error("[Trend Campaign] Error al disparar campaña automática:", e.message)
      );

      res.json({
        success: true,
        message: `Producto "${name}" agregado con éxito. La campaña de tendencia se está armando automáticamente.`,
        product: productData
      });
    } catch (e: any) {
      console.error("[Add Product] Error:", e.message);
      res.status(500).json({ success: false, error: e.message });
    }
  });

  // Dispara manualmente la campaña de tendencia para un producto YA existente en el catálogo
  // (para cuando quieras re-lanzar la oferta a mano, como pediste mantener).
  app.post("/api/admin/products/:docId/send-trend-campaign", express.json(), async (req, res) => {
    try {
      const { docId } = req.params;
      const prodSnap = await getDoc(doc(db, "products", docId));
      if (!prodSnap.exists()) {
        return res.status(404).json({ success: false, error: "Producto no encontrado." });
      }
      const product = prodSnap.data() as any;
      const targetStoreId = product.storeId || "default";
      await triggerTrendCampaign(product, targetStoreId);
      res.json({ success: true, message: `Campaña de tendencia (re)lanzada para "${product.name}".` });
    } catch (e: any) {
      console.error("[Trend Campaign Manual] Error:", e.message);
      res.status(500).json({ success: false, error: e.message });
    }
  });

  app.post("/api/admin/config", (req, res) => {
    res.json({ success: true, message: "Usando API Key del sistema." });
  });

  app.get("/api/admin/catalog", (req, res) => {
    try {
      const catalogPath = path.join(cwd, "src", "catalog.json");
      if (existsSync(catalogPath)) {
        const catalogData = JSON.parse(readFileSync(catalogPath, "utf-8"));
        return res.json(catalogData);
      }
      res.status(404).json({ error: "Catálogo no encontrado" });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get("/api/public/config", async (req, res) => {
    let metaPixelId = "";
    let tiktokPixelId = "";
    try {
      const storeSnap = await getDoc(doc(db, "stores", "default"));
      if (storeSnap.exists()) {
        const storeData = storeSnap.data();
        metaPixelId = storeData.metaPixelId || "";
        tiktokPixelId = storeData.tiktokPixelId || "";
      }
    } catch (err) {
      console.error("[Config API] Error loading store config for default:", err);
    }

    res.json({
      whatsappNumber: process.env.TWILIO_FROM_NUMBER ? process.env.TWILIO_FROM_NUMBER.replace(/\D/g, '') : null,
      metaPixelId,
      tiktokPixelId
    });
  });

  // Evento "Contact" server-side para los clicks directos a WhatsApp (no pasan por landing-order)
  // Evento genérico server-side para ViewContent / AddToCart / InitiateCheckout —
  // los eventos de "intención" que alimentan los públicos de remarketing.
  // Lista blanca de eventos por seguridad (no se puede mandar cualquier nombre de evento).
  // "Contact" estaba en el comentario de arriba pero NO en esta lista, asi que
  // el endpoint lo rechazaba con 400 y el evento viajaba solo por el navegador,
  // sin respaldo de servidor. Cualquier bloqueador o un iPhone con seguimiento
  // restringido lo borraba y no quedaba rastro de que el cliente escribio.
  const ALLOWED_FUNNEL_EVENTS = new Set([
    "ViewContent", "AddToCart", "InitiateCheckout", "Contact",
    // Diagnóstico propio del formulario. Sin esto no hay forma de distinguir
    // entre "abrió el formulario y no tocó nada" y "escribió sus datos y se
    // fue a mitad": los dos casos se ven idénticos en el embudo, y se arreglan
    // de forma muy distinta.
    "FormStart", "FormAbandon"
  ]);

  // Estos dos NO se mandan a Meta: son para entender el formulario, no eventos
  // de campaña, y ensuciarían el píxel con nombres que Meta no reconoce.
  const EVENTOS_SOLO_INTERNOS = new Set(["FormStart", "FormAbandon"]);
  app.post("/api/public/track-event", express.json(), async (req, res) => {
    try {
      const { eventName, storeId, eventId, fbp, fbc, eventSourceUrl, customerPhone, contentIds, contentName, value, visitorId, origen } = req.body;
      if (!ALLOWED_FUNNEL_EVENTS.has(eventName)) {
        return res.status(400).json({ success: false, error: "Evento no permitido." });
      }
      const targetStoreId = storeId || "default";
      let storeConfig: any = {};
      try {
        const storeSnap = await getDoc(doc(db, "stores", targetStoreId));
        if (storeSnap.exists()) storeConfig = storeSnap.data();
      } catch (err) {
        console.error("[Track Event] Error loading store config:", err);
      }
      const capiAccessToken = storeConfig?.metaCapiAccessToken || process.env.META_CAPI_ACCESS_TOKEN || "";
      if (storeConfig?.metaPixelId && capiAccessToken && eventId && !EVENTOS_SOLO_INTERNOS.has(eventName)) {
        await sendMetaCapiEvent({
          pixelId: storeConfig.metaPixelId,
          accessToken: capiAccessToken,
          eventName,
          eventId,
          eventSourceUrl,
          customerPhone,
          fbp,
          fbc,
          clientIp: getClientIp(req),
          userAgent: req.headers["user-agent"] as string,
          customData: {
            currency: "COP",
            value: value || 0,
            content_ids: contentIds || [],
            content_name: contentName || "",
            content_type: "product",
          },
        });
      }

      // Record real-time activity for live admin audio/voice notifications
      try {
        await addDoc(collection(db, "activities"), {
          type: eventName === "AddToCart" ? "add_to_cart" : eventName === "ViewContent" ? "page_view" : eventName === "Contact" ? "contact" : eventName === "FormStart" ? "form_start" : eventName === "FormAbandon" ? "form_abandon" : "funnel_event",
          customerName: customerPhone ? `Cliente ${customerPhone}` : "Visitante Web",
          message: eventName === "AddToCart" ? `🛒 Producto añadido al carrito: ${contentName || 'Producto'}` : eventName === "ViewContent" ? `👀 Visita en tienda web: ${contentName || 'Página Principal'}` : eventName === "Contact" ? `💬 Escribió por WhatsApp desde: ${contentName || 'la tienda'}` : eventName === "FormStart" ? `✍️ Empezó a llenar el formulario: ${contentName || 'pedido'}` : eventName === "FormAbandon" ? `🚪 Se fue del formulario: ${contentName || 'sin datos'}` : `⚡ Inicio de Checkout: ${contentName || 'Carrito'}`,
          timestamp: serverTimestamp(),
          storeId: targetStoreId,
          contentName: contentName || "",
          value: value || 0,
          // Código ANÓNIMO del navegador: enlaza los pasos de una misma visita
          // para poder reconstruir el recorrido. No identifica a nadie.
          visitorId: String(visitorId || "").slice(0, 40),
          origen: String(origen || "").slice(0, 60)
        });
      } catch (actErr: any) {
        console.error("[Track Event] Error saving activity:", actErr.message);
      }

      res.json({ success: true });
    } catch (err: any) {
      console.error("[Track Event] Error:", err.message);
      res.json({ success: false });
    }
  });

  app.post("/api/public/track-contact", express.json(), async (req, res) => {
    try {
      const { storeId, eventId, fbp, fbc, eventSourceUrl, customerPhone, value } = req.body;
      const targetStoreId = storeId || "default";
      let storeConfig: any = {};
      try {
        const storeSnap = await getDoc(doc(db, "stores", targetStoreId));
        if (storeSnap.exists()) storeConfig = storeSnap.data();
      } catch (err) {
        console.error("[Track Contact] Error loading store config:", err);
      }
      const capiAccessToken = storeConfig?.metaCapiAccessToken || process.env.META_CAPI_ACCESS_TOKEN || "";
      if (storeConfig?.metaPixelId && capiAccessToken && eventId) {
        await sendMetaCapiEvent({
          pixelId: storeConfig.metaPixelId,
          accessToken: capiAccessToken,
          eventName: "Contact",
          eventId,
          eventSourceUrl,
          customerPhone,
          fbp,
          fbc,
          clientIp: getClientIp(req),
          userAgent: req.headers["user-agent"] as string,
          customData: { currency: "COP", value: value || 0 },
        });
      }
      res.json({ success: true });
    } catch (err: any) {
      console.error("[Track Contact] Error:", err.message);
      res.json({ success: false });
    }
  });

  app.post("/api/public/landing-order", express.json(), async (req, res) => {
    try {
      const { 
        storeId, 
        customerName, 
        customerPhone, 
        address, 
        addressIndicator, 
        city, 
        productName, 
        productId, 
        quantity, 
        totalPrice, 
        notes,
        eventId,
        fbp,
        fbc,
        eventSourceUrl
      } = req.body;

      const targetStoreId = storeId || "default";

      // 1. Fetch store config
      let storeConfig: any = {};
      try {
        const storeSnap = await getDoc(doc(db, "stores", targetStoreId));
        if (storeSnap.exists()) {
          storeConfig = storeSnap.data();
        }
      } catch (err) {
        console.error("[Landing Order] Error loading store config:", err);
      }

      // 2. Formulate order info
      const orderInfo: any = {
        storeId: targetStoreId,
        customerName: customerName || "No especificado",
        customerPhone: customerPhone || "No especificado",
        productName: productName || "No especificado",
        productId: productId || "manual",
        quantity: Number(quantity) || 1,
        totalPrice: Number(totalPrice) || 0,
        address: address || "No especificada",
        city: city || "No especificada",
        addressIndicator: addressIndicator || "N/A",
        notes: notes || "Pedido desde la Landing Page",
        origin: "landing",
        status: "pendiente",
        shopifyStatus: "no_enviado",
        dropiStatus: "no_enviado",
        createdAt: serverTimestamp()
      };

      // 3. Save order to DB
      const orderRef = await addDoc(collection(db, "orders"), orderInfo);
      const newOrderId = orderRef.id;
      orderInfo.id = newOrderId;
      console.log(`[Landing Order] Saved landing order successfully with ID: ${newOrderId}`);

      // 3a. Meta CAPI: server-side "Purchase" event, deduplicado con el pixel del navegador (mismo event_id)
      const capiAccessToken = storeConfig?.metaCapiAccessToken || process.env.META_CAPI_ACCESS_TOKEN || "";
      if (storeConfig?.metaPixelId && capiAccessToken && eventId) {
        sendMetaCapiEvent({
          pixelId: storeConfig.metaPixelId,
          accessToken: capiAccessToken,
          eventName: "Purchase",
          eventId,
          eventSourceUrl,
          customerPhone: orderInfo.customerPhone,
          fbp,
          fbc,
          clientIp: getClientIp(req),
          userAgent: req.headers["user-agent"] as string,
          customData: {
            currency: "COP",
            value: orderInfo.totalPrice,
            content_ids: [orderInfo.productId],
            content_type: "product",
            num_items: orderInfo.quantity,
          },
        }).catch(() => {});
      }

      // 3b. Send automatic WhatsApp confirmation to customer
      try {
        const finalPhone = normalizePhone(orderInfo.customerPhone);
        const botNum = TWILIO_FROM_NUMBER || "+14155238886";
        const formattedBotNum = botNum.startsWith("whatsapp:") ? botNum : `whatsapp:${botNum}`;
        const customerWelcomeMsg = `¡Hola *${orderInfo.customerName}*! 👋 Muchas gracias por confiar en nosotros en Jansel Shop.\n\nPor este medio te estaré notificando sobre tu pedido de *${orderInfo.productName}*. Te confirmamos que ya se encuentra en *etapa de preparación* 📦 y pronto saldrá en ruta de entrega.\n\n¡Cualquier duda que tengas me puedes escribir por aquí! ✨`;
        
        console.log(`[Landing Order Welcome] Initializing customer notification. From: ${formattedBotNum} To: ${finalPhone}`);
        if (!twilioClient) {
          console.warn("[Landing Order Welcome] TWILIO IS NOT INITIALIZED! Cannot send welcome message. Please verify TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN and TWILIO_FROM_NUMBER environment variables.");
        } else {
          await sendWhatsApp(finalPhone, customerWelcomeMsg, undefined, undefined, formattedBotNum);
          console.log(`[Landing Order Welcome] Welcomed customer ${finalPhone} successfully.`);
        }
      } catch (welcomeErr: any) {
        console.error(`[Landing Order Welcome] Failed to welcome customer:`, welcomeErr.message);
      }

      // 4. Handle Shopify Auto Sync
      if (storeConfig?.shopifyAutoSync && storeConfig?.shopifyDomain && storeConfig?.shopifyAccessToken) {
        console.log("[Landing Order] Shopify Auto Sync activo. Sincronizando pedido...");
        try {
          await pushOrderToShopify(newOrderId, orderInfo, storeConfig, db);
          console.log("[Landing Order] Pedido sincronizado con Shopify automáticamente.");
        } catch (shopErr: any) {
          console.error("[Landing Order] Error sincronizando con Shopify automáticamente:", shopErr.message);
          await updateDoc(doc(db, "orders", newOrderId), {
            shopifyStatus: "error",
            shopifyError: shopErr.message
          });
        }
      }

      // 5. Handle Dropi Auto Sync
      // SUBIDA AUTOMÁTICA A DROPI DESACTIVADA TEMPORALMENTE (Soporte técnico, se mantiene la configuración)
      if (false && storeConfig?.dropiAutoSync && storeConfig?.dropiApiKey) {
        console.log("[Landing Order] Dropi Auto Sync activo. Sincronizando pedido...");
        try {
          await pushOrderToDropi(newOrderId, orderInfo, storeConfig, db);
          console.log("[Landing Order] Pedido sincronizado con Dropi automáticamente.");
        } catch (dropErr: any) {
          console.error("[Landing Order] Error sincronizando con Dropi automáticamente:", dropErr.message);
          await updateDoc(doc(db, "orders", newOrderId), {
            dropiStatus: "error",
            dropiError: dropErr.message
          });
        }
      }

      // 6. Formulate exciting Admin WhatsApp Notification
      const customMessage = `🚀 *¡NUEVO PEDIDO DESDE LA LANDING!* 🚀
Jan acaba de recibir una compra directa por formulario de Landing Page.

👤 *Cliente:* ${orderInfo.customerName}
📞 *Teléfono:* ${orderInfo.customerPhone}
📦 *Producto:* ${orderInfo.productName} (x${orderInfo.quantity})
📍 *Destino:* ${orderInfo.city}
🏠 *Dirección:* ${orderInfo.address}
🗺️ *Ref:* ${orderInfo.addressIndicator || 'N/A'}
💰 *Total:* $${(orderInfo.totalPrice || 0).toLocaleString()} COP *(Paga al recibir)*

_El pedido ya se guardó y está listo en tu tablero._`;

      // Modify the standard notification phone if config exists
      const adminNumbers = getAdminNumbers(storeConfig);

      console.log(`[Landing Order Notify] Preparing admin notifications for: ${adminNumbers.join(", ")}`);
      for (const num of adminNumbers) {
        try {
          const formattedNum = num.startsWith("whatsapp:") ? num : `whatsapp:${num}`;
          const botNum = TWILIO_FROM_NUMBER || "+14155238886";
          const formattedBotNum = botNum.startsWith("whatsapp:") ? botNum : `whatsapp:${botNum}`;
          
          if (!twilioClient) {
            console.warn(`[Landing Order Notify] TWILIO IS NOT INITIALIZED! Cannot notify admin ${formattedNum}. Please verify your environment variables.`);
          } else {
            await sendWhatsApp(formattedNum, customMessage, undefined, undefined, formattedBotNum);
            console.log(`[Landing Order Notify] Admin ${formattedNum} notified successfully.`);
          }
        } catch (notifyErr: any) {
          console.error(`[Landing Order Notify] Failed to notify ${num}:`, notifyErr.message);
        }
      }

      // 7. Return success
      res.status(200).json({ success: true, order: orderInfo });
    } catch (err: any) {
      console.error("[Landing Order Error] Failed to create order:", err);
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // --- SHOPIFY AND DROPI INTEGRATION ROUTES ---

  app.post("/api/integration/shopify/push-order", async (req, res) => {
    try {
      const { orderId, storeId } = req.body;
      if (!orderId || !storeId) {
        return res.status(400).json({ success: false, error: "Missing orderId or storeId" });
      }

      const orderSnap = await getDoc(doc(db, "orders", orderId));
      if (!orderSnap.exists()) {
        return res.status(404).json({ success: false, error: "Pedido no encontrado." });
      }
      const orderData = orderSnap.data();

      const storeSnap = await getDoc(doc(db, "stores", storeId));
      if (!storeSnap.exists()) {
        return res.status(404).json({ success: false, error: "Tienda no encontrada." });
      }
      const storeConfig = storeSnap.data();

      const shopifyOrder = await pushOrderToShopify(orderId, orderData, storeConfig, db);
      res.json({ success: true, message: "Pedido enviado exitosamente a Shopify.", shopifyOrderId: shopifyOrder.id.toString() });
    } catch (e: any) {
      console.error("[Shopify Push Error]", e);
      const errMsg = e.response?.data?.errors ? JSON.stringify(e.response.data.errors) : e.message;
      res.status(500).json({ success: false, error: errMsg });
    }
  });

  app.post("/api/integration/dropi/push-order", async (req, res) => {
    try {
      const { orderId, storeId } = req.body;
      if (!orderId || !storeId) {
        return res.status(400).json({ success: false, error: "Missing orderId or storeId" });
      }

      const orderSnap = await getDoc(doc(db, "orders", orderId));
      if (!orderSnap.exists()) {
        return res.status(404).json({ success: false, error: "Pedido no encontrado." });
      }
      const orderData = orderSnap.data();

      const storeSnap = await getDoc(doc(db, "stores", storeId));
      if (!storeSnap.exists()) {
        return res.status(404).json({ success: false, error: "Tienda no encontrada." });
      }
      const storeConfig = storeSnap.data();

      const result = await pushOrderToDropi(orderId, orderData, storeConfig, db);
      res.json({ success: true, message: "Pedido enviado exitosamente a Dropi.", trackingNumber: result.tracking, dropiOrderId: result.dropiOrderId });
    } catch (e: any) {
      console.error("[Dropi Push Error]", e);
      res.status(500).json({ success: false, error: e.message });
    }
  });

  // ==============================================
  // 📱 NOTIFICACIÓN AUTOMÁTICA DE CAMBIO DE ESTADO
  // ==============================================
  app.post("/api/orders/update-status", express.json(), async (req, res) => {
    try {
      const { orderId, status, notifyCustomer = true, orderData } = req.body;

      if (!orderId || !status) {
        return res.status(400).json({ success: false, error: "Faltan parámetros obligatorios: orderId o status." });
      }

      // 1. Get order details from Firestore if not provided
      const orderRef = doc(db, "orders", orderId);
      let currentOrder: any = orderData;

      if (!currentOrder || !currentOrder.customerPhone) {
        const snap = await getDoc(orderRef);
        if (snap.exists()) {
          currentOrder = { id: snap.id, ...snap.data() };
        }
      }

      // Update status in Firestore
      await updateDoc(orderRef, { 
        status,
        updatedAt: new Date().toISOString()
      }).catch(async () => {
        await setDoc(orderRef, { status, updatedAt: new Date().toISOString() }, { merge: true });
      });

      // Update local cache
      if (localDbCache && localDbCache["orders"] && localDbCache["orders"][orderId]) {
        localDbCache["orders"][orderId].status = status;
        saveLocalDb();
      }

      let notificationSent = false;
      let messageText = "";

      if (notifyCustomer && currentOrder && currentOrder.customerPhone) {
        const customerName = currentOrder.customerName || "Cliente";
        const productName = currentOrder.productName || "tu producto";
        const rawPrice = currentOrder.totalPrice || 0;
        const totalPrice = typeof rawPrice === 'number' ? rawPrice.toLocaleString() : rawPrice;
        const city = currentOrder.city || "tu ciudad";
        const address = currentOrder.address || "tu dirección";
        const customerPhone = currentOrder.customerPhone;

        switch (status) {
          case "despachado":
            messageText = `🚚 *¡Tu pedido ha sido despachado!* 📦\n\nHola *${customerName}*, te informamos que tu pedido de *${productName}* ya se encuentra en camino a tu dirección en *${city}*.\n\n📍 *Dirección de entrega:* ${address}\n💰 *Total a pagar (Contra Entrega):* $${totalPrice} COP\n\n🚛 Por favor permanece atento/a a la llamada del repartidor. ¡Muchas gracias por tu compra en *Jan Sel Shop*! ✨`;
            break;

          case "entregado":
            messageText = `🎉 *¡Tu pedido ha sido entregado con éxito!* 📦\n\nHola *${customerName}*, nos alegra informarte que tu pedido de *${productName}* fue entregado en *${city}*.\n\n🌟 Queremos asegurarnos de que todo haya llegado en perfecto estado y estés feliz con tu compra. Si tienes cualquier inquietud con tu producto, ¡estamos aquí para ayudarte! 🤝\n\n¡Muchas gracias por confiar en *Jan Sel Shop*! ❤️`;
            break;

          case "confirmado":
            messageText = `✅ *¡Tu pedido ha sido confirmado!* 🛒\n\nHola *${customerName}*, tu pedido de *${productName}* fue verificado correctamente y pasó a empaque para su posterior despacho a *${city}*.\n\n💰 *Total a pagar:* $${totalPrice} COP (Pago Contra Entrega)\n\nTe notificaremos tan pronto sea entregado a la transportadora. ¡Gracias por elegir *Jan Sel Shop*! 📦✨`;
            break;

          case "cancelado":
            messageText = `❌ *Actualización de tu pedido* ❌\n\nHola *${customerName}*, te notificamos que tu pedido de *${productName}* ha sido cancelado.\n\nSi deseas reprogramar la entrega o solicitar asistencia, por favor escríbenos por este medio y con gusto te ayudaremos. 🤝`;
            break;

          case "pendiente":
          default:
            messageText = `⏳ *Estado de tu pedido: Pendiente* 📋\n\nHola *${customerName}*, tu pedido de *${productName}* está registrado y en proceso de verificación. Te avisaremos tan pronto sea procesado. ¡Gracias por preferirnos!`;
            break;
        }

        const formattedBotNum = currentOrder.origin === 'landing' ? '+15072233213' : TWILIO_FROM_NUMBER;

        try {
          await sendWhatsApp(customerPhone, messageText, undefined, undefined, formattedBotNum);
          notificationSent = true;

          // Save activity log
          await addDoc(collection(db, "activities"), {
            type: "status_notification",
            customerName,
            customerPhone,
            orderId,
            newStatus: status,
            text: `📱 Notificación WhatsApp enviada (${status.toUpperCase()}) a ${customerName} (${customerPhone})`,
            createdAt: new Date().toISOString(),
            timestamp: serverTimestamp(),
          });
          console.log(`[Order Status WhatsApp] Notification sent to ${customerPhone} for order ${orderId} (${status})`);
        } catch (sendErr: any) {
          console.error(`[Order Status WhatsApp Error] Failed sending to ${customerPhone}:`, sendErr.message);
        }
      }

      res.json({
        success: true,
        message: `Estado actualizado a "${status}"`,
        notificationSent,
        messageText
      });
    } catch (e: any) {
      console.error("[Update Order Status Endpoint Error]", e);
      res.status(500).json({ success: false, error: e.message });
    }
  });

  app.post("/api/integration/orders/:orderId/tracking", express.json(), async (req, res) => {
    try {
      const { orderId } = req.params;
      const { trackingUrl } = req.body;

      if (!orderId) {
        return res.status(400).json({ success: false, error: "Missing orderId" });
      }

      const orderRef = doc(db, "orders", orderId);
      const orderSnap = await getDoc(orderRef);
      if (!orderSnap.exists()) {
        return res.status(404).json({ success: false, error: "Pedido no encontrado." });
      }

      const order = orderSnap.data();

      if (trackingUrl === "") {
        await updateDoc(orderRef, {
          trackingUrl: null,
          trackingStatus: null,
          trackingCarrier: null,
          trackingComment: null,
          trackingGuide: null,
          trackingPaused: null,
          trackingHistory: null
        });
        return res.json({ success: true, message: "Seguimiento de envío restablecido de manera exitosa." });
      }

      // Immediately run the analysis to get initial carrier state
      console.log(`[Tracking Setup] Triggering initial analysis for tracking URL: ${trackingUrl}`);
      const analysis = await analyzeTrackingUrl(trackingUrl);

      const updateData = {
        trackingUrl,
        trackingStatus: analysis.status || "preparacion",
        trackingCarrier: analysis.carrier || "Desconocida",
        trackingComment: analysis.comment || "Iniciando seguimiento",
        trackingGuide: analysis.guide || "No detectada",
        trackingPaused: false,
        lastTrackedAt: Date.now(),
        trackingHistory: [
          {
            status: analysis.status || "preparacion",
            comment: analysis.comment || "Iniciando seguimiento",
            timestamp: Date.now()
          }
        ]
      };

      await updateDoc(orderRef, updateData);

      // Send the immediate WhatsApp message to the customer with the official tracking link!
      try {
        const finalPhone = normalizePhone(order.customerPhone);
        const botNum = process.env.TWILIO_FROM_NUMBER || "+14155238886";
        const formattedBotNum = botNum.startsWith("whatsapp:") ? botNum : `whatsapp:${botNum}`;
        
        const customerMsg = `Hola *${order.customerName}* 👋\n\nTu pedido de *${order.productName}* ya fue despachado. 🚀\n\n🚚 *Transportadora:*\n${analysis.carrier || 'Desconocida'}\n\n📦 *Guía:*\n${analysis.guide || 'No detectada'}\n\nPuedes hacer seguimiento aquí:\n${trackingUrl}\n\nTe estaremos notificando automáticamente cada cambio de estado de tu despacho. ¡Muchas gracias por tu confianza! 🚚💨`;
        
        await sendWhatsApp(finalPhone, customerMsg, undefined, undefined, formattedBotNum);
        console.log(`[Tracking Setup] Sent immediate tracking WhatsApp to ${finalPhone}`);
      } catch (wsErr: any) {
        console.error(`[Tracking Setup] Failed to send instant WhatsApp message:`, wsErr.message);
      }

      res.json({
        success: true,
        message: "Enlace de seguimiento configurado y cliente notificado.",
        order: { ...order, ...updateData }
      });
    } catch (err: any) {
      console.error("[Tracking Endpoint Error]", err);
      res.status(500).json({ success: false, error: err.message });
    }
  });

  app.post("/api/integration/orders/:orderId/tracking/scan", async (req, res) => {
    try {
      const { orderId } = req.params;
      if (!orderId) {
        return res.status(400).json({ success: false, error: "Missing orderId" });
      }

      const orderRef = doc(db, "orders", orderId);
      const orderSnap = await getDoc(orderRef);
      if (!orderSnap.exists()) {
        return res.status(404).json({ success: false, error: "Pedido no encontrado." });
      }

      const order = orderSnap.data();
      if (!order.trackingUrl) {
        return res.status(400).json({ success: false, error: "Este pedido no tiene enlace de seguimiento configurado." });
      }

      console.log(`[Manual Scan] Scanning tracking page for order ${orderId}: ${order.trackingUrl}`);
      const result = await analyzeTrackingUrl(order.trackingUrl);

      const previousStatus = order.trackingStatus || "preparacion";
      const updateData: any = {
        lastTrackedAt: Date.now(),
        trackingComment: result.comment,
        trackingCarrier: result.carrier,
        trackingStatus: result.status,
        trackingGuide: result.guide || order.trackingGuide || "No detectada"
      };

      if (result.status !== previousStatus) {
        console.log(`[Manual Scan] State changed from ${previousStatus} to ${result.status}`);
        
        // Add tracking history event
        const history = Array.isArray(order.trackingHistory) ? [...order.trackingHistory] : [];
        history.push({
          status: result.status,
          comment: result.comment,
          timestamp: Date.now()
        });
        updateData.trackingHistory = history;

        // Also sync standard order status
        if (result.status === "entregado") {
          updateData.status = "entregado";
        } else if (result.status === "en_ruta") {
          updateData.status = "despachado";
        }

        // Notify client
        try {
          const finalPhone = normalizePhone(order.customerPhone);
          const botNum = process.env.TWILIO_FROM_NUMBER || "+14155238886";
          const formattedBotNum = botNum.startsWith("whatsapp:") ? botNum : `whatsapp:${botNum}`;
          let notificationText = "";

          if (result.status === "en_ruta") {
            notificationText = `📦 *¡Tu pedido de Jansel Shop está en camino!* 🚚💨\n\nHola *${order.customerName}*, te traemos excelentes noticias. Tu pedido de *${order.productName}* ya ha sido entregado a la transportadora (*${result.carrier}*) y se encuentra *En Ruta* de entrega.\n\n📍 Sigue el recorrido oficial aquí en tiempo real: ${order.trackingUrl}\n\nRecuerda tener listo el dinero en efectivo ($${(order.totalPrice || 0).toLocaleString()} COP) para tu Pago Contra Entrega. ¡Muchas gracias por tu compra! ✨`;
          } else if (result.status === "entregado") {
            notificationText = `🎉 *¡Tu pedido ha sido entregado con éxito!* 🥳\n\nHola *${order.customerName}*, confirmamos que tu pedido de *${order.productName}* ya fue entregado el día de hoy.\n\nQueremos darte las gracias por confiar en Jansel Shop. Esperamos que disfrutes al máximo de tu producto. ❤️\n\n¿Cómo estuvo tu experiencia? Si nos dejas un comentario por aquí, ¡nos ayudaría muchísimo! 🙏`;
          } else if (result.status === "novedad") {
            notificationText = `⚠️ *Actualización importante sobre tu entrega* 🚚\n\nHola *${order.customerName}*, la transportadora (*${result.carrier}*) nos reporta una *Novedad* con la entrega de tu pedido de *${order.productName}* (ej: dirección incompleta o no se encontraba nadie en casa).\n\n🔗 Puedes ver el detalle oficial de la transportadora aquí: ${order.trackingUrl}\n\nNo te preocupes, ¡queremos ayudarte a solucionarlo hoy mismo! Cuéntanos por este chat qué pasó o indícanos si quieres que reprogramemos la entrega para que no se devuelva tu paquete. ¡Quedamos muy atentos! 📲`;
          }

          if (notificationText) {
            await sendWhatsApp(finalPhone, notificationText, undefined, undefined, formattedBotNum);
            console.log(`[Manual Scan] Notified customer ${finalPhone} about state change: ${result.status}`);
          }
        } catch (notifErr: any) {
          console.error(`[Manual Scan] Failed to send WhatsApp update:`, notifErr.message);
        }
      }

      await updateDoc(orderRef, updateData);

      res.json({
        success: true,
        status: result.status,
        comment: result.comment,
        carrier: result.carrier,
        guide: result.guide,
        order: { ...order, ...updateData }
      });
    } catch (e: any) {
      console.error("[Manual Scan Error]", e);
      res.status(500).json({ success: false, error: e.message });
    }
  });

  app.post("/api/integration/orders/:orderId/tracking/toggle-monitoring", express.json(), async (req, res) => {
    try {
      const { orderId } = req.params;
      const { paused } = req.body;

      if (!orderId) {
        return res.status(400).json({ success: false, error: "Missing orderId" });
      }

      const orderRef = doc(db, "orders", orderId);
      const orderSnap = await getDoc(orderRef);
      if (!orderSnap.exists()) {
        return res.status(404).json({ success: false, error: "Pedido no encontrado." });
      }

      await updateDoc(orderRef, {
        trackingPaused: !!paused
      });

      res.json({
        success: true,
        message: `Monitoreo ${paused ? "pausado" : "activado"} correctamente.`,
        trackingPaused: !!paused
      });
    } catch (err: any) {
      console.error("[Toggle Monitoring Error]", err);
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // 1. Generate Intelligent Upsell Recommendation
  app.post("/api/integration/orders/:orderId/generate-upsell", async (req, res) => {
    try {
      const { orderId } = req.params;
      if (!orderId) {
        return res.status(400).json({ success: false, error: "Missing orderId" });
      }

      const orderRef = doc(db, "orders", orderId);
      const orderSnap = await getDoc(orderRef);
      if (!orderSnap.exists()) {
        return res.status(404).json({ success: false, error: "Pedido no encontrado." });
      }
      const order = orderSnap.data();

      // Fetch customer's full purchase history to "learn" from them
      const normalizedPhone = order.customerPhone ? order.customerPhone.trim() : "";
      let customerOrders: any[] = [];
      if (normalizedPhone) {
        const qHistory = query(collection(db, "orders"), where("customerPhone", "==", normalizedPhone));
        const historySnap = await getDocs(qHistory);
        historySnap.forEach((d: any) => {
          if (d.id !== orderId) {
            customerOrders.push({ id: d.id, ...d.data() });
          }
        });
      }

      // Fetch catalog products
      let prodSnap = await getDocs(collection(db, "products"));
      const productsList: any[] = [];
      prodSnap.forEach((d: any) => {
        productsList.push({ id: d.id, ...d.data() });
      });

      // Call AI to learn and recommend
      console.log(`[AI Upsell] Generating post-purchase cross-sell suggestion for ${order.customerName}...`);
      const result = await generatePostPurchaseUpsell(order, customerOrders, productsList);

      // Save suggestion into the order object so the merchant can review / edit / send
      const updateData = {
        upsellProfile: result.customerProfile,
        upsellRecommendedProductId: result.recommendedProductId,
        upsellRecommendedProductName: result.recommendedProductName,
        upsellSuggestedMsg: result.suggestedMessage,
        upsellReasoning: result.reasoning,
        upsellStatus: order.upsellStatus || "pendiente",
        upsellCreatedAt: Date.now()
      };

      await updateDoc(orderRef, updateData);

      res.json({
        success: true,
        data: {
          id: orderId,
          ...order,
          ...updateData
        }
      });
    } catch (err: any) {
      console.error("[Generate Upsell Error]", err);
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // 2. Send Intelligent Upsell Message
  app.post("/api/integration/orders/:orderId/send-upsell", express.json(), async (req, res) => {
    try {
      const { orderId } = req.params;
      const { customMessage } = req.body; // Optional override message from admin input

      if (!orderId) {
        return res.status(400).json({ success: false, error: "Missing orderId" });
      }

      const orderRef = doc(db, "orders", orderId);
      const orderSnap = await getDoc(orderRef);
      if (!orderSnap.exists()) {
        return res.status(404).json({ success: false, error: "Pedido no encontrado." });
      }
      const order = orderSnap.data();

      const messageToSend = customMessage || order.upsellSuggestedMsg;
      if (!messageToSend) {
        return res.status(400).json({ success: false, error: "No hay un mensaje sugerido generado todavía para enviar." });
      }

      // Send via Twilio/WhatsApp usando un Content Template pre-aprobado (con botones Sí/No).
      // Un mensaje de texto libre lo bloquea WhatsApp si el cliente no te ha escrito en las
      // últimas 24h — que es siempre el caso en un seguimiento post-venta días después.
      const finalPhone = normalizePhone(order.customerPhone);
      const botNum = process.env.TWILIO_FROM_NUMBER || "+14155238886";
      const formattedBotNum = botNum.startsWith("whatsapp:") ? botNum : `whatsapp:${botNum}`;

      console.log(`[AI Upsell] Sending WhatsApp cross-sell to ${order.customerName} (${finalPhone})`);

      let sid = "mock-sid";
      let sendSucceeded = true;
      if (process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && !process.env.TWILIO_ACCOUNT_SID.startsWith("ACmock")) {
        sendSucceeded = await sendUpsellOfferButtons(finalPhone, formattedBotNum, messageToSend);
        if (!sendSucceeded) {
          return res.status(502).json({
            success: false,
            error: "No se pudo enviar la oferta VIP por WhatsApp. Verifica que el template esté aprobado por Meta (puede tardar minutos a horas la primera vez) y que las credenciales de Twilio sean correctas."
          });
        }
      } else {
        console.log("[AI Upsell MOCK] Twilio not fully configured. Outputting message body:");
        console.log("-----------------------------------------");
        console.log(messageToSend);
        console.log("-----------------------------------------");
      }

      // Record activity history
      await addDoc(collection(db, "activities"), {
        from: formattedBotNum,
        to: `+${finalPhone}`,
        message: messageToSend,
        status: "respondido",
        whatsappStatus: "sent",
        manualAgent: "AI Post-Purchase Followup",
        createdAt: serverTimestamp(),
        storeId: order.storeId || "",
        timestamp: serverTimestamp(),
      });

      // Update order status
      const updateData = {
        upsellSent: true,
        upsellSentAt: Date.now(),
        upsellStatus: "enviado",
        upsellSuggestedMsg: messageToSend // Keep the actual sent copy
      };
      await updateDoc(orderRef, updateData);

      res.json({
        success: true,
        message: "¡Oferta de venta cruzada enviada correctamente por WhatsApp!",
        data: updateData
      });
    } catch (err: any) {
      console.error("[Send Upsell Error]", err);
      res.status(500).json({ success: false, error: err.message });
    }
  });

  app.post("/api/integration/shopify/sync-products", async (req, res) => {
    try {
      const { storeId, direction } = req.body;
      if (!storeId || !direction) {
        return res.status(400).json({ success: false, error: "Missing storeId or direction" });
      }

      const storeSnap = await getDoc(doc(db, "stores", storeId));
      if (!storeSnap.exists()) {
        return res.status(404).json({ success: false, error: "Tienda no encontrada." });
      }
      const storeConfig = storeSnap.data();
      const { shopifyDomain, shopifyAccessToken } = storeConfig;

      if (!shopifyDomain || !shopifyAccessToken) {
        return res.status(400).json({ success: false, error: "Shopify no configurado en los ajustes de esta tienda." });
      }

      const cleanDomain = shopifyDomain.replace(/https?:\/\//, '').trim();

      if (direction === "from_shopify") {
        console.log(`[Shopify Sync] Importando productos desde ${cleanDomain}...`);
        const response = await axios.get(`https://${cleanDomain}/admin/api/2024-01/products.json`, {
          headers: {
            "X-Shopify-Access-Token": shopifyAccessToken,
            "Content-Type": "application/json"
          },
          timeout: 15000
        });

        const shopifyProducts = response.data.products || [];
        let count = 0;

        for (const sp of shopifyProducts) {
          const docId = `shopify_${sp.id}`;
          const prodData = {
            id: docId,
            name: sp.title,
            description: sp.body_html || "",
            price: parseFloat(sp.variants?.[0]?.price || "0"),
            stock: parseInt(sp.variants?.[0]?.inventory_quantity || "100"),
            currency: "COP",
            category: sp.product_type || "General",
            imageUrl: sp.images?.[0]?.src || "",
            storeId: storeId,
            createdAt: serverTimestamp()
          };

          await setDoc(doc(db, "products", docId), prodData);
          count++;
        }

        res.json({ success: true, count, message: `Se importaron ${count} productos correctamente de Shopify a tu catálogo.` });
      } else if (direction === "to_shopify") {
        console.log(`[Shopify Sync] Exportando catálogo a ${cleanDomain}...`);
        const qProd = query(collection(db, "products"), where("storeId", "==", storeId));
        const prodSnap = await getDocs(qProd);
        const localProducts: any[] = [];
        prodSnap.forEach((doc) => {
          localProducts.push({ id: doc.id, ...doc.data() });
        });

        if (localProducts.length === 0) {
          return res.status(400).json({ success: false, error: "No tienes productos en tu catálogo para exportar." });
        }

        let count = 0;
        for (const lp of localProducts) {
          const payload = {
            product: {
              title: lp.name,
              body_html: lp.description,
              product_type: lp.category || "General",
              variants: [
                {
                  price: lp.price.toString(),
                  inventory_quantity: lp.stock || 10,
                  inventory_management: "shopify"
                }
              ],
              images: lp.imageUrl ? [{ src: lp.imageUrl }] : []
            }
          };

          await axios.post(`https://${cleanDomain}/admin/api/2024-01/products.json`, payload, {
            headers: {
              "X-Shopify-Access-Token": shopifyAccessToken,
              "Content-Type": "application/json"
            },
            timeout: 10000
          });
          count++;
        }

        res.json({ success: true, count, message: `Se exportaron ${count} productos exitosamente a tu tienda de Shopify.` });
      } else {
        res.status(400).json({ success: false, error: "Dirección de sincronización inválida. Debe ser 'from_shopify' o 'to_shopify'." });
      }
    } catch (e: any) {
      console.error("[Shopify Sync Error]", e);
      const errMsg = e.response?.data?.errors ? JSON.stringify(e.response.data.errors) : e.message;
      res.status(500).json({ success: false, error: errMsg });
    }
  });

  // ---------------------------------------------

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
      if (checkGlobalQuota()) {
        return res.sendStatus(200);
      }

      // Solo auditamos (nunca bloqueamos) — este endpoint solo actualiza estados
      // de mensajes ya enviados, no es tan sensible como el webhook principal.
      validateTwilioWebhookSignature(req);

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
        const existingStatus = snap.data()?.whatsappStatus;
        if (existingStatus !== mappedStatus) {
          await updateDoc(doc(db, "activities", actId), { 
            whatsappStatus: mappedStatus,
            statusUpdateAt: serverTimestamp()
          });
          console.log(`[Twilio Status] Successfully updated Activity ${actId} to ${mappedStatus}`);
        } else {
          console.log(`[Twilio Status] Status for Activity ${actId} is already ${mappedStatus}. Skipping update.`);
        }
      }
    } catch (e: any) {
        console.error("[Twilio Status][Error] Update failed:", e.message);
      }
      
      res.sendStatus(200);
  });

  // Meta (Instagram & Messenger) Webhook Verification (GET)
  app.get("/api/webhook/instagram", (req, res) => {
    console.log("[Instagram Webhook] Verification request received");
    const mode = req.query["hub.mode"];
    const token = req.query["hub.verify_token"];
    const challenge = req.query["hub.challenge"];

    // The user provided "JAN_SEL_SECRET"
    const VERIFY_TOKEN = process.env.FB_VERIFY_TOKEN || "JAN_SEL_SECRET";

    if (mode === "subscribe" && token === VERIFY_TOKEN) {
      console.log("[Instagram Webhook] Verified successfully!");
      res.status(200).header("Content-Type", "text/plain").send(challenge);
    } else {
      console.error("[Instagram Webhook] Verification failed. Expected:", VERIFY_TOKEN, "Got:", token);
      res.sendStatus(403);
    }
  });

  app.get("/api/webhook/messenger", (req, res) => {
    console.log("[Messenger Webhook] Verification request received");
    const mode = req.query["hub.mode"];
    const token = req.query["hub.verify_token"];
    const challenge = req.query["hub.challenge"];

    const VERIFY_TOKEN = process.env.FB_VERIFY_TOKEN || "JAN_SEL_SECRET";

    if (mode === "subscribe" && token === VERIFY_TOKEN) {
      console.log("[Messenger Webhook] Verified successfully!");
      res.status(200).header("Content-Type", "text/plain").send(challenge);
    } else {
      console.error("[Messenger Webhook] Verification failed. Expected:", VERIFY_TOKEN, "Got:", token);
      res.sendStatus(403);
    }
  });

  // Meta Webhook Receivers (POST)
  app.post("/api/webhook/instagram", async (req, res) => {
    console.log("[Instagram Webhook] Received notification:", JSON.stringify(req.body));
    
    const entry = req.body.entry?.[0];
    const messaging = entry?.messaging?.[0];
    
    if (messaging && messaging.message && !messaging.message.is_echo) {
      const senderId = messaging.sender.id;
      const messageText = messaging.message.text;
      
      console.log(`[Instagram Webhook] Message from ${senderId}: ${messageText}`);
      
      const assignedStoreId = await determineStoreId(senderId, messageText);
      const activityData = {
        from: senderId,
        to: entry.id, // Page ID
        recipient: senderId,
        customerPhone: senderId,
        storeId: assignedStoreId,
        message: messageText,
        platform: "instagram",
        status: "recibido",
        senderType: 'customer',
        receivedAt: serverTimestamp(),
        timestamp: serverTimestamp()
      };

      try {
        const activityRef = await addDoc(collection(db, "activities"), activityData);
        processInferenceOnServer(activityRef.id, activityData).catch(e => {
          console.error(`[Meta AI] Error processing Instagram message:`, e.message);
        });
      } catch (e: any) {
        console.error("[Meta Webhook] Error registering activity:", e.message);
      }
    }
    
    res.sendStatus(200);
  });

  app.post("/api/webhook/messenger", async (req, res) => {
    console.log("[Messenger Webhook] Received notification:", JSON.stringify(req.body));
    
    const entry = req.body.entry?.[0];
    const messaging = entry?.messaging?.[0];
    
    if (messaging && messaging.message && !messaging.message.is_echo) {
      const senderId = messaging.sender.id;
      const messageText = messaging.message.text;
      
      console.log(`[Messenger Webhook] Message from ${senderId}: ${messageText}`);
      
      const assignedStoreId = await determineStoreId(senderId, messageText);
      const activityData = {
        from: senderId,
        to: entry.id, // Page ID
        recipient: senderId,
        customerPhone: senderId,
        storeId: assignedStoreId,
        message: messageText,
        platform: "messenger",
        status: "recibido",
        senderType: 'customer',
        receivedAt: serverTimestamp(),
        timestamp: serverTimestamp()
      };

      try {
        const activityRef = await addDoc(collection(db, "activities"), activityData);
        processInferenceOnServer(activityRef.id, activityData).catch(e => {
          console.error(`[Meta AI] Error processing Messenger message:`, e.message);
        });
      } catch (e: any) {
        console.error("[Meta Webhook] Error registering activity:", e.message);
      }
    }
    
    res.sendStatus(200);
  });

  // Twilio Webhook
  app.post("/api/webhook/whatsapp", async (req, res) => {
    if (checkGlobalQuota()) {
      return res.status(200).send(""); // Early exit
    }

    detectCurrentUrl(req);

    // Seguridad: validamos que este request realmente venga de Twilio (ver
    // `validateTwilioWebhookSignature` para el detalle del modo audit-only vs strict).
    const twilioSignatureValid = validateTwilioWebhookSignature(req);
    if (!twilioSignatureValid && STRICT_TWILIO_SIGNATURE_VALIDATION) {
      console.error(`[Twilio Security] Bloqueado request con firma inválida. IP: ${req.ip}`);
      return res.status(403).send("Firma inválida");
    }

    // Log incoming body for debugging
    console.log("[WhatsApp Webhook] Received call. Body keys:", Object.keys(req.body));
    console.log("[WhatsApp Webhook] Incoming From:", req.body?.From, "To:", req.body?.To);

    // ==============================================
    // 🛡️ PROTECCIÓN ANTI-DUPLICADOS (MessageSid)
    // ==============================================
    // Twilio puede reintentar el webhook (timeouts, hipos de red, etc.) y
    // reenviar el MISMO mensaje. Sin esto, el bot procesaba el mensaje dos
    // veces y generaba respuestas duplicadas. Usamos el MessageSid (único por
    // mensaje de Twilio) como llave de idempotencia, con una caché en memoria
    // rápida + un respaldo en Supabase por si el proceso se reinicia.
    const incomingMessageSid = req.body?.MessageSid || req.body?.SmsMessageSid || req.body?.SmsSid;
    if (incomingMessageSid) {
      if (processedMessageSids.has(incomingMessageSid)) {
        console.log(`[WhatsApp Webhook] 🔁 MessageSid ${incomingMessageSid} ya fue procesado. Ignorando duplicado.`);
        return res.status(200).send("");
      }
      try {
        const dedupRef = doc(db, "processed_messages", incomingMessageSid);
        const dedupSnap = await getDoc(dedupRef);
        if (dedupSnap.exists()) {
          console.log(`[WhatsApp Webhook] 🔁 MessageSid ${incomingMessageSid} ya estaba registrado en BD. Ignorando duplicado.`);
          processedMessageSids.add(incomingMessageSid);
          return res.status(200).send("");
        }
        await setDoc(dedupRef, { processedAt: serverTimestamp() });
      } catch (dedupErr: any) {
        console.error("[WhatsApp Webhook] Error verificando dedup de MessageSid:", dedupErr.message);
        // Si falla la verificación en BD, seguimos igual (no bloqueamos el mensaje
        // por un error de infraestructura), pero sí queda el guard en memoria.
      }
      processedMessageSids.add(incomingMessageSid);
      // Limpieza simple para no crecer indefinidamente en memoria
      if (processedMessageSids.size > 5000) {
        const first = processedMessageSids.values().next().value;
        if (first) processedMessageSids.delete(first);
      }
    }

    const from = req.body?.From || req.body?.from;
    const to = req.body?.To || req.body?.to;
    const messageBody = req.body?.Body || req.body?.body || "";
    const numMedia = parseInt(req.body?.NumMedia || req.body?.numMedia || "0");

    if (!from || !to) {
      console.warn("[WhatsApp Webhook] Missing From/To. Body:", JSON.stringify(req.body));
      return res.status(200).send(""); 
    }

    // IGNORE STATUS CALLBACKS ON INCOMING WEBHOOK (prevents infinite loops if misconfigured in Twilio)
    // Twilio includes SmsStatus: 'received' for incoming messages, so we check for other statuses.
    const isStatusCallback = (req.body?.MessageStatus || (req.body?.SmsStatus && req.body.SmsStatus !== "received")) && !req.body?.Body;
    
    if (isStatusCallback) {
       console.log(`[WhatsApp Webhook] Received status callback on incoming webhook for ${from}. Ignoring.`);
       return res.status(200).send("");
    }

    // IGNORE MESSAGES FROM SELF (TWILIO ECHOES OR LOOPBACKS)
    const normBot = normalizePhone(TWILIO_FROM_NUMBER || "+14155238886");
    const normTo = normalizePhone(to);
    const normFrom = normalizePhone(from);

    if (normFrom === normBot || normFrom === normTo) {
      console.log(`[WhatsApp Webhook] Ignoring loopback message from bot (${normFrom})`);
      return res.status(200).send("");
    }
    
    // ANTI SPAM
    if (!canReply(normFrom)) {
      console.warn(`[WhatsApp Webhook] Anti-spam: Ignorando mensajes múltiples de ${normFrom}`);
      return res.status(200).send("");
    }

    // Dynamic URL detection for status callbacks
    if (!currentAppUrl) {
      const host = req.headers["x-forwarded-host"] || req.headers["host"];
      const proto = req.headers["x-forwarded-proto"] || "https";
      currentAppUrl = `${proto}://${host}`;
      console.log(`[Twilio Webhook] Detected APP_URL: ${currentAppUrl}`);
    }

    // EXRACT MEDIA IF ANY
    let finalMessage = messageBody;
    const mediaItems: { data: string, mimeType: string }[] = [];
    if (numMedia > 0) {
      for (let i = 0; i < numMedia; i++) {
        const mUrl = req.body[`MediaUrl${i}`];
        try {
          const mediaItem = await downloadMediaAsBase64(mUrl);
          if (mediaItem) {
            mediaItems.push(mediaItem);
            const mediaId = Math.random().toString(36).substring(7) + Date.now().toString(36);
            await saveMediaPersistent(mediaId, Buffer.from(mediaItem.data, 'base64'), mediaItem.mimeType);
            let extension = "";
            if (mediaItem.mimeType.includes("image/jpeg")) extension = ".jpg";
            else if (mediaItem.mimeType.includes("image/png")) extension = ".png";
            else if (mediaItem.mimeType.includes("image/gif")) extension = ".gif";
            else if (mediaItem.mimeType.includes("image/webp")) extension = ".webp";
            else if (mediaItem.mimeType.includes("video/mp4")) extension = ".mp4";
            else if (mediaItem.mimeType.includes("video/webm")) extension = ".webm";
            else if (mediaItem.mimeType.includes("audio/mpeg") || mediaItem.mimeType.includes("audio/mp3")) extension = ".mp3";
            else if (mediaItem.mimeType.includes("audio/wav")) extension = ".wav";
            else if (mediaItem.mimeType.includes("audio/ogg") || mediaItem.mimeType.includes("audio/oga")) extension = ".ogg";
            else if (mediaItem.mimeType.includes("application/pdf")) extension = ".pdf";
            else if (mediaItem.mimeType.includes("msword")) extension = ".doc";
            else if (mediaItem.mimeType.includes("wordprocessingml")) extension = ".docx";
            else if (mediaItem.mimeType.includes("ms-excel")) extension = ".xls";
            else if (mediaItem.mimeType.includes("spreadsheetml")) extension = ".xlsx";
            else if (mediaItem.mimeType.includes("text/plain")) extension = ".txt";
            else if (mediaItem.mimeType.includes("zip")) extension = ".zip";
            else if (mediaItem.mimeType.includes("csv")) extension = ".csv";
            else if (mediaItem.mimeType.includes("audio")) extension = ".ogg";
            else extension = ".jpg";
            let baseUrl = currentAppUrl || process.env.APP_URL || `https://${req.headers.host}`;
            const proxiedUrl = `${baseUrl.replace(/\/$/, '')}/api/media/${mediaId}${extension}`;
            finalMessage += ` [Media: ${proxiedUrl}]`;
          } else {
             finalMessage += ` [Media original Twilio: ${mUrl}]`;
          }
        } catch (e) {
          console.error(`[Webhook Media] Could not cache media ${mUrl}`, e);
          finalMessage += ` [Media: ${mUrl}]`;
        }
      }
    }

    const cleanFrom = from.replace('whatsapp:', '').trim();
    let assignedStoreId = await determineStoreId(cleanFrom, finalMessage, to);

    // CANCEL ANY PENDING FOLLOW-UP BECAUSE CLIENT RESPONDED
    await cancelPendingFollowUps(from, assignedStoreId);

    // Determinar texto del mensaje para loguear según si fue un botón interactivo
    const buttonPayload = req.body?.ButtonPayload || req.body?.ListId;
    let actMsg = finalMessage;
    if (buttonPayload) {
      actMsg = req.body?.ButtonText || `[Botón: ${buttonPayload}]`;
    }

    const profileNameFromTwilio = req.body?.ProfileName || req.body?.profileName || null;

    // REGISTRAR ACTIVIDAD INMEDIATAMENTE PARA QUE APAREZCA EN CHAT
    const activityData = {
      from,
      to,
      recipient: from, // THE CUSTOMER is always the recipient/thread-ID
      customerPhone: cleanFrom,
      customerName: profileNameFromTwilio,
      botNumber: to,   // Store which bot number received this
      storeId: assignedStoreId,
      message: actMsg,
      mediaUrl: mediaItems.length > 0 ? mediaItems.map((_, i) => req.body[`MediaUrl${i}`]).join(",") : null,
      status: "recibido",
      senderType: 'customer',
      receivedAt: serverTimestamp(),
      timestamp: serverTimestamp()
    };
    
    let activityRefId = "";
    let activityRef: any = null;
    try {
      activityRef = await addDoc(collection(db, "activities"), activityData);
      activityRefId = activityRef.id;
      console.log(`[Activity] Registered: ${activityRefId}. Bot receiving: ${to}`);
    } catch (e: any) {
      console.error("[WhatsApp Webhook] Error registering initial activity:", e.message);
    }

    const customerProfileId = customerDocId(assignedStoreId, cleanFrom);
    const cxSnap = await getDoc(doc(db, "customers", customerProfileId));
    const customerData = cxSnap.exists() ? cxSnap.data() : null;
    const pending = customerData?.pendingConfirmation;

    // CHECK IF AI IS PAUSED OR HUMAN ADVISOR WAS REQUESTED FOR THIS CUSTOMER
    const pauseCheck = await checkIsCustomerAiPaused(cleanFrom, assignedStoreId);
    if (pauseCheck.isPaused) {
      console.log(`[WhatsApp Webhook] ⏸️ AI is PAUSED for ${cleanFrom} (reason: ${pauseCheck.reason}). Activity registered (${activityRefId}), skipping all automated responses.`);
      return res.status(200).send("");
    }

    // ==============================================
    // 🔘 RESPUESTA A BOTONES INTERACTIVOS (MENÚS Y CONFIRMACIÓN)
    // ==============================================
    if (buttonPayload) {
      try {
        if (buttonPayload === CONFIRM_YES_ID) {
          if (pending && pending.jsonResponse) {
            let storeConfig: any = {};
            const storeSnap = await getDoc(doc(db, "stores", assignedStoreId));
            if (storeSnap.exists()) storeConfig = storeSnap.data();
            const products = await loadProductsForStore(assignedStoreId);

            await finalizeOrder(pending.jsonResponse, storeConfig, customerData, cleanFrom, assignedStoreId, products, db);
            await updateDoc(doc(db, "customers", customerProfileId), { pendingConfirmation: null });
            
            const confMsg = "¡Listo! 🎉 Tu pedido quedó confirmado, ya te lo estamos alistando. ¡Gracias por tu compra!";
            await sendWhatsApp(from, confMsg, undefined, activityRefId, to);
            if (activityRefId) {
              await updateDoc(doc(db, "activities", activityRefId), {
                status: "respondido",
                response: confMsg,
                respondedAt: serverTimestamp()
              });
            }
          } else {
            const noPendMsg = "No encontramos ningún pedido pendiente de confirmación. 😊 ¿En qué más te puedo ayudar?";
            await sendWhatsApp(from, noPendMsg, undefined, activityRefId, to);
            if (activityRefId) {
              await updateDoc(doc(db, "activities", activityRefId), {
                status: "respondido",
                response: noPendMsg,
                respondedAt: serverTimestamp()
              });
            }
          }
        } else if (buttonPayload === CONFIRM_NO_ID) {
          await updateDoc(doc(db, "customers", customerProfileId), { pendingConfirmation: null });
          const noMsg = "Tranqui, no confirmé nada todavía 🙂 Contame qué querés cambiar y seguimos.";
          await sendWhatsApp(from, noMsg, undefined, activityRefId, to);
          if (activityRefId) {
            await updateDoc(doc(db, "activities", activityRefId), {
              status: "respondido",
              response: noMsg,
              respondedAt: serverTimestamp()
            });
          }
        } else if (buttonPayload === DISPATCH_YES_ID || buttonPayload === DISPATCH_NO_ID || buttonPayload === DISPATCH_RESCHEDULE_ID) {
          // ==============================================
          // 🚚 RESPUESTAS A LA CONFIRMACIÓN FINAL DE DESPACHO
          // ==============================================
          const dispatchPending = customerData?.pendingDispatchConfirmation;
          const orderIdForDispatch = dispatchPending?.orderId;

          if (!orderIdForDispatch) {
            const noPendMsg = "No encontramos ningún pedido pendiente de despacho en este momento. 😊 ¿En qué más te puedo ayudar?";
            await sendWhatsApp(from, noPendMsg, undefined, activityRefId, to);
          } else if (buttonPayload === DISPATCH_YES_ID) {
            await updateDoc(doc(db, "orders", orderIdForDispatch), {
              status: "confirmado",
              dispatchConfirmedAt: serverTimestamp()
            });
            const yesMsg = "¡Genial! 🎉 Confirmado — tu pedido sigue en camino con la transportadora, en breve lo tendrás en tus manos. ¡Gracias por tu compra! 🚚📦";
            await sendWhatsApp(from, yesMsg, undefined, activityRefId, to);
          } else if (buttonPayload === DISPATCH_NO_ID) {
            await updateDoc(doc(db, "orders", orderIdForDispatch), {
              status: "cancelado",
              dispatchCancelledAt: serverTimestamp()
            });
            const noMsg = "Entendido, cancelamos el envío de tu pedido. 🙏 Si cambias de opinión o buscas otra cosa, aquí estamos. ¿Te ayudo con algo más?";
            await sendWhatsApp(from, noMsg, undefined, activityRefId, to);
            // Avisamos al dueño de la tienda que un pedido se canceló en el último momento
            try {
              const admins = getAdminNumbers();
              for (const num of admins) {
                await sendWhatsApp(`whatsapp:+${num}`, `⚠️ El pedido ${orderIdForDispatch} (${dispatchPending.productName}) fue *cancelado* por el cliente justo antes del despacho.`, undefined, undefined, TWILIO_FROM_NUMBER);
              }
            } catch {}
          } else if (buttonPayload === DISPATCH_RESCHEDULE_ID) {
            await updateDoc(doc(db, "orders", orderIdForDispatch), {
              status: "pendiente",
              dispatchRescheduleRequestedAt: serverTimestamp()
            });
            const rescheduleMsg = "¡Sin problema! 📅 Vamos a reprogramar la entrega de tu pedido. Un asesor te va a escribir en breve para acordar la nueva fecha. 🙌";
            await sendWhatsApp(from, rescheduleMsg, undefined, activityRefId, to);
            // Esto SÍ requiere seguimiento humano, así que pausamos la IA y avisamos.
            await setCustomerAiPauseState(cleanFrom, assignedStoreId, true);
            try {
              const admins = getAdminNumbers();
              for (const num of admins) {
                await sendWhatsApp(`whatsapp:+${num}`, `📅 El cliente de ${cleanFrom} pidió *reprogramar* la entrega del pedido ${orderIdForDispatch} (${dispatchPending.productName}). Escríbele para acordar nueva fecha.`, undefined, undefined, TWILIO_FROM_NUMBER);
              }
            } catch {}
          }

          await updateDoc(doc(db, "customers", customerProfileId), { pendingDispatchConfirmation: null });
          if (activityRefId) {
            await updateDoc(doc(db, "activities", activityRefId), {
              status: "respondido",
              response: "[Respuesta a confirmación de despacho procesada]",
              respondedAt: serverTimestamp()
            });
          }
        } else if (buttonPayload === IMG_YES_ID) {
          const pendingImg = customerData?.pendingImageOffer;
          if (pendingImg?.producto) {
            await updateDoc(doc(db, "customers", customerProfileId), { pendingImageOffer: null });
            await startCheckoutFlow(from, cleanFrom, to, assignedStoreId, pendingImg.producto, activityRefId);
          } else {
            const okMsg = "¡Perfecto! Contame qué producto te interesó y seguimos. 😊";
            await sendWhatsApp(from, okMsg, undefined, activityRefId, to);
            if (activityRefId) {
              await updateDoc(doc(db, "activities", activityRefId), {
                status: "respondido",
                response: okMsg,
                respondedAt: serverTimestamp()
              });
            }
          }
        } else if (buttonPayload === IMG_NO_ID) {
          await updateDoc(doc(db, "customers", customerProfileId), { pendingImageOffer: null });
          const cancelImgMsg = "Tranqui 🙂 ¿Buscas algo más o te muestro otras opciones?";
          await sendWhatsApp(from, cancelImgMsg, undefined, activityRefId, to);
          if (activityRefId) {
            await updateDoc(doc(db, "activities", activityRefId), {
              status: "respondido",
              response: cancelImgMsg,
              respondedAt: serverTimestamp()
            });
          }
        } else if (buttonPayload === "MENU_CATALOG") {
          await sendCategoriesMenu(from, to);
          if (activityRefId) {
            await updateDoc(doc(db, "activities", activityRefId), {
              status: "respondido",
              response: "[Menú enviado: Categorías del catálogo]",
              respondedAt: serverTimestamp()
            });
          }
        } else if (buttonPayload === "GO_TO_WEBSITE") {
          const baseUrl = (currentAppUrl || process.env.APP_URL || "https://chatbotjanadsia.up.railway.app").replace(/\/$/, "");
          const landingUrl = `${baseUrl}/landing`;
          const websiteMsg = `🌐 *JAN SEL SHOP - Página Web Oficial* 🌐\n\nIngresa directamente aquí para ver nuestro catálogo completo interactivo:\n👉 ${landingUrl}`;
          await sendWhatsApp(from, websiteMsg, undefined, activityRefId, to);
          if (activityRefId) {
            await updateDoc(doc(db, "activities", activityRefId), {
              status: "respondido",
              response: websiteMsg,
              respondedAt: serverTimestamp()
            });
          }
        } else if (buttonPayload === "MENU_HUMAN") {
          await setCustomerAiPauseState(cleanFrom, assignedStoreId, true);
          
          const humanReplyMsg = "¡Claro que sí! 🙌 Ya le transferí tu conversación a uno de nuestros asesores humanos. En unos minutos se contactará contigo por aquí para atenderte personalmente.";
          await sendWhatsApp(from, humanReplyMsg, undefined, activityRefId, to);

          const adminMessage = `🚨 *ASESORÍA HUMANA SOLICITADA*
Cliente: ${customerData?.name || profileNameFromTwilio || cleanFrom} (${cleanFrom})
Solicitado haciendo click en el botón "Hablar con Asesor" 🙋‍♂️.`;
          await sendAdminAlert(adminMessage);
          if (activityRefId) {
            await updateDoc(doc(db, "activities", activityRefId), {
              status: "respondido",
              response: humanReplyMsg,
              respondedAt: serverTimestamp()
            });
          }
          return res.status(200).send("");
        } else if (buttonPayload === "RESUME_CHECKOUT") {
          await resendCurrentCheckoutStepPrompt(from, to, customerData, activityRefId);
        } else if (buttonPayload === "RESUME_CHECKOUT_NO") {
          await setDoc(doc(db, "customers", customerProfileId), {
            checkoutStep: null,
            checkoutData: null,
            pendingConfirmation: null,
            etapa: "interesado"
          }, { merge: true });
          const resumeNoMsg = "¡Listo, sin problema! Aquí estaré si cambias de idea. 😊 ¿En qué más te puedo colaborar?";
          await sendWhatsApp(from, resumeNoMsg, undefined, activityRefId, to);
          if (activityRefId) {
            await updateDoc(doc(db, "activities", activityRefId), {
              status: "respondido",
              response: resumeNoMsg,
              respondedAt: serverTimestamp()
            });
          }
        } else if (buttonPayload === TREND_YES_ID) {
          const pendingTrendOffer = customerData?.pendingManualOffer;
          if (pendingTrendOffer && pendingTrendOffer.producto && pendingTrendOffer.valor) {
            // Camino determinístico: ya sabemos exactamente qué producto y
            // precio se ofreció, así que vamos directo a pedir los datos de
            // envío con el resumen correcto, sin ambigüedad.
            const custDataForOffer = customerData || {};
            await sendCheckoutSummaryAndButtons(
              from,
              to,
              customerProfileId,
              {
                producto: pendingTrendOffer.producto,
                cantidad: pendingTrendOffer.cantidad || 1,
                nombre: custDataForOffer?.name || custDataForOffer?.nombre || "",
                telefono: from,
                ciudad: custDataForOffer?.city || custDataForOffer?.ciudad || "",
                direccion: custDataForOffer?.address || custDataForOffer?.direccion || "",
                referencia: custDataForOffer?.addressIndicator || "N/A",
                valor: Number(pendingTrendOffer.valor),
                notas: "Compra directa desde tarjeta de producto en tendencia (sin salir de WhatsApp)."
              },
              undefined,
              "default"
            );
            await setDoc(doc(db, "customers", customerProfileId), { pendingManualOffer: null }, { merge: true });
          } else {
            // Respaldo: si por algún motivo no quedó guardada la oferta,
            // seguimos preguntando de forma normal (comportamiento anterior).
            const trendMsg = "¡Genial! 🎉 Dame un momento para confirmarte el pedido. ¿Me confirmas tu nombre completo, dirección y ciudad para despacharlo hoy mismo?";
            await setDoc(doc(db, "customers", customerProfileId), {
              etapa: "interesado",
              checkoutStep: "recolectando_datos"
            }, { merge: true });
            await sendWhatsApp(from, trendMsg, undefined, activityRefId, to);
          }
          if (activityRefId) {
            await updateDoc(doc(db, "activities", activityRefId), {
              status: "respondido",
              response: "[Confirmación de compra directa desde tarjeta de tendencia]",
              respondedAt: serverTimestamp()
            });
          }
        } else if (buttonPayload === TREND_NO_ID) {
          const trendNoMsg = "¡Sin problema! 😊 Seguimos en contacto, cualquier cosa que necesites me escribes.";
          await sendWhatsApp(from, trendNoMsg, undefined, activityRefId, to);
          if (activityRefId) {
            await updateDoc(doc(db, "activities", activityRefId), {
              status: "respondido",
              response: trendNoMsg,
              respondedAt: serverTimestamp()
            });
          }
        } else if (buttonPayload === UPSELL_YES_ID) {
          const upsellYesMsg = "¡Excelente elección! 🎉 Confírmame tu dirección y ciudad para despacharlo hoy mismo con el descuento VIP.";
          await setDoc(doc(db, "customers", customerProfileId), {
            etapa: "interesado",
            checkoutStep: "recolectando_datos"
          }, { merge: true });
          await sendWhatsApp(from, upsellYesMsg, undefined, activityRefId, to);
          if (activityRefId) {
            await updateDoc(doc(db, "activities", activityRefId), {
              status: "respondido",
              response: upsellYesMsg,
              respondedAt: serverTimestamp()
            });
          }
        } else if (buttonPayload === UPSELL_NO_ID) {
          const upsellNoMsg = "¡Entendido! Gracias por tu tiempo. Cualquier cosa que necesites, aquí estoy. 😊";
          await sendWhatsApp(from, upsellNoMsg, undefined, activityRefId, to);
          if (activityRefId) {
            await updateDoc(doc(db, "activities", activityRefId), {
              status: "respondido",
              response: upsellNoMsg,
              respondedAt: serverTimestamp()
            });
          }
        } else if (buttonPayload === "MENU_END" || buttonPayload === "CHAT_END") {
          await updateDoc(doc(db, "customers", customerProfileId), { 
            pendingConfirmation: null,
            etapa: "finalizado",
            score: 0 
          });
          const endMsg = "¡Fue un gusto ayudarte! 😊 Una vez vuelvas a escribir, iniciaremos una nueva conversación. ¡Te espero de regreso! 👋";
          await sendWhatsApp(from, endMsg, undefined, activityRefId, to);
          if (activityRefId) {
            await updateDoc(doc(db, "activities", activityRefId), {
              status: "respondido",
              response: endMsg,
              respondedAt: serverTimestamp()
            });
          }
        } else if (buttonPayload === "CHAT_KEEP") {
          const keepMsg = "¡Súper! Dime en qué más te puedo colaborar hoy o qué producto estás buscando. 🔎";
          await sendWhatsApp(from, keepMsg, undefined, activityRefId, to);
          if (activityRefId) {
            await updateDoc(doc(db, "activities", activityRefId), {
              status: "respondido",
              response: keepMsg,
              respondedAt: serverTimestamp()
            });
          }
        } else if (buttonPayload === "CAT_TECH") {
          await sendCategoryFeaturedProducts(from, to, ["tecnologia"], "Tecnología 💻", assignedStoreId);
          if (activityRefId) {
            await updateDoc(doc(db, "activities", activityRefId), {
              status: "respondido",
              response: "[Productos enviados: Tecnología 💻]",
              respondedAt: serverTimestamp()
            });
          }
        } else if (buttonPayload === "CAT_TRENDS") {
          await sendTrendingProducts(from, to, assignedStoreId);
          if (activityRefId) {
            await updateDoc(doc(db, "activities", activityRefId), {
              status: "respondido",
              response: "[Productos enviados: Tendencias 🔥]",
              respondedAt: serverTimestamp()
            });
          }
        } else if (buttonPayload === "CAT_MOTOS") {
          await sendCategoryFeaturedProducts(from, to, ["motos"], "Motos 🏍️", assignedStoreId);
          if (activityRefId) {
            await updateDoc(doc(db, "activities", activityRefId), {
              status: "respondido",
              response: "[Productos enviados: Motos 🏍️]",
              respondedAt: serverTimestamp()
            });
          }
        } else if (buttonPayload === "CAT_OTHER") {
          await sendOtherCategoriesMenu(from, to);
          if (activityRefId) {
            await updateDoc(doc(db, "activities", activityRefId), {
              status: "respondido",
              response: "[Menú de otras categorías enviado]",
              respondedAt: serverTimestamp()
            });
          }
        } else if (buttonPayload === "CAT_AUTOS") {
          await sendCategoryFeaturedProducts(from, to, ["autos"], "Autos 🚗", assignedStoreId);
          if (activityRefId) {
            await updateDoc(doc(db, "activities", activityRefId), {
              status: "respondido",
              response: "[Productos enviados: Autos 🚗]",
              respondedAt: serverTimestamp()
            });
          }
        } else if (buttonPayload === "MORE_PAGE") {
          const lastSearch = customerData?.lastCategorySearch;
          if (!lastSearch) {
            await sendWhatsApp(from, "Uy, esa búsqueda ya expiró 😅. Elige una categoría de nuevo:", undefined, activityRefId, to);
            await sendCategoriesMenu(from, to);
            if (activityRefId) {
              await updateDoc(doc(db, "activities", activityRefId), {
                status: "respondido",
                response: "[Búsqueda expirada, menú de categorías enviado]",
                respondedAt: serverTimestamp()
              });
            }
          } else if (lastSearch.isTrends) {
            await sendTrendingProducts(from, to, assignedStoreId, lastSearch.nextOffset || 0);
            if (activityRefId) {
              await updateDoc(doc(db, "activities", activityRefId), {
                status: "respondido",
                response: "[Página siguiente de tendencias enviada]",
                respondedAt: serverTimestamp()
              });
            }
          } else if (!Array.isArray(lastSearch.categories)) {
            await sendWhatsApp(from, "Uy, esa búsqueda ya expiró 😅. Elige una categoría de nuevo:", undefined, activityRefId, to);
            await sendCategoriesMenu(from, to);
            if (activityRefId) {
              await updateDoc(doc(db, "activities", activityRefId), {
                status: "respondido",
                response: "[Búsqueda expirada, menú de categorías enviado]",
                respondedAt: serverTimestamp()
              });
            }
          } else {
            await sendCategoryFeaturedProducts(from, to, lastSearch.categories, lastSearch.categoryLabel || "Productos", assignedStoreId, lastSearch.nextOffset || 0);
            if (activityRefId) {
              await updateDoc(doc(db, "activities", activityRefId), {
                status: "respondido",
                response: "[Página siguiente de productos enviada]",
                respondedAt: serverTimestamp()
              });
            }
          }
        } else if (buttonPayload === "MENU_BACK") {
          await sendMainMenu(from, to);
          if (activityRefId) {
            await updateDoc(doc(db, "activities", activityRefId), {
              status: "respondido",
              response: "[Menú principal enviado]",
              respondedAt: serverTimestamp()
            });
          }
        } else if (buttonPayload.startsWith("COMBO_")) {
          // El cliente eligio un combo de la lista. Se le manda el detalle con
          // lo que incluye, el ahorro en pesos y un cierre por eleccion.
          const cIdx = parseInt(buttonPayload.replace("COMBO_", ""), 10);
          const guardados = customerData?.lastCombosList || [];
          const elegido = guardados[cIdx];
          const combo = elegido
            ? ACTIVE_PROMOTIONS.find(c => c.id === elegido.id)
            : ACTIVE_PROMOTIONS[cIdx];

          if (!combo) {
            await sendWhatsApp(from, "Uy, ese combo ya no esta disponible 😅. Mira los que tenemos:", undefined, activityRefId, to);
            await sendCombosList(from, to, customerProfileId);
          } else {
            const productos = await loadProductsForStore(assignedStoreId);
            await sendWhatsApp(from, textoDetalleCombo(combo, productos), undefined, activityRefId, to);
            // Queda registrado como la oferta viva de esta conversacion, para que
            // al confirmar se cobre el precio del combo y no la suma suelta.
            await setDoc(doc(db, "customers", customerProfileId), {
              comboOfrecido: { id: combo.id, name: combo.name, precio: combo.promoPrice },
              etapa: "negociando"
            }, { merge: true });
          }
          if (activityRefId) {
            await updateDoc(doc(db, "activities", activityRefId), {
              status: "respondido",
              response: `[Combo enviado: ${combo?.name || buttonPayload}]`,
              respondedAt: serverTimestamp()
            });
          }
        } else if (buttonPayload.startsWith("PROD_")) {
          const idx = parseInt(buttonPayload.replace("PROD_", ""), 10);
          const lastList = customerData?.lastProductList || [];
          const picked = lastList[idx];

          if (!picked) {
            await sendWhatsApp(from, "Uy, esa opción ya no está disponible 😅. Volvamos al catálogo:", undefined, activityRefId, to);
            await sendCategoriesMenu(from, to);
            if (activityRefId) {
              await updateDoc(doc(db, "activities", activityRefId), {
                status: "respondido",
                response: "[Opción no disponible, catálogo enviado]",
                respondedAt: serverTimestamp()
              });
            }
          } else {
            const currentCart: any[] = Array.isArray(customerData?.cart) ? [...customerData.cart] : [];
            const existing = currentCart.find((it: any) => it.name === picked.name);
            if (existing) {
              existing.cantidad = (existing.cantidad || 1) + 1;
            } else {
              currentCart.push({ name: picked.name, price: picked.price, cantidad: 1 });
            }
            await updateDoc(doc(db, "customers", customerProfileId), { cart: currentCart });

            const cartSummary = currentCart
              .map((it: any) => `• ${it.cantidad}x ${it.name} - $${Number(it.price * it.cantidad).toLocaleString("es-CO")}`)
              .join("\n");
            const totalCart = currentCart.reduce((sum: number, it: any) => sum + (it.price * it.cantidad), 0);

            const sent = await sendCartActionButtons(from, to, cartSummary, totalCart);
            if (!sent) {
              const addedCartMsg = `🛒 Agregado a tu carrito:\n${cartSummary}\n\n💵 Total: $${totalCart.toLocaleString("es-CO")} COP\n\n¿Deseas agregar otro producto? Responde AGREGAR o CONFIRMAR.`;
              await sendWhatsApp(from, addedCartMsg, undefined, activityRefId, to);
              if (activityRefId) {
                await updateDoc(doc(db, "activities", activityRefId), {
                  status: "respondido",
                  response: addedCartMsg,
                  respondedAt: serverTimestamp()
                });
              }
            } else {
              if (activityRefId) {
                await updateDoc(doc(db, "activities", activityRefId), {
                  status: "respondido",
                  response: `[Producto agregado al carrito interactivo: ${picked.name}]`,
                  respondedAt: serverTimestamp()
                });
              }
            }
          }
        } else if (buttonPayload === "CART_ADD_MORE") {
          await sendCategoriesMenu(from, to);
          if (activityRefId) {
            await updateDoc(doc(db, "activities", activityRefId), {
              status: "respondido",
              response: "[Menú de categorías enviado para agregar más productos]",
              respondedAt: serverTimestamp()
            });
          }
        } else if (buttonPayload === "CART_CHECKOUT") {
          const currentCart: any[] = Array.isArray(customerData?.cart) ? customerData.cart : [];
          if (currentCart.length === 0) {
            await sendWhatsApp(from, "Tu carrito está vacío todavía 🙂. Elige al menos un producto del catálogo.", undefined, activityRefId, to);
            await sendCategoriesMenu(from, to);
            if (activityRefId) {
              await updateDoc(doc(db, "activities", activityRefId), {
                status: "respondido",
                response: "[Carrito vacío, catálogo enviado]",
                respondedAt: serverTimestamp()
              });
            }
          } else {
            const productoTexto = currentCart.map((it: any) => `${it.cantidad}x ${it.name}`).join(", ");
            const valorTotal = currentCart.reduce((sum: number, it: any) => sum + (it.price * it.cantidad), 0);
            await updateDoc(doc(db, "customers", customerProfileId), { cart: null });
            await startCheckoutFlowFromCart(from, cleanFrom, to, assignedStoreId, productoTexto, valorTotal, activityRefId);
          }
        } else if (buttonPayload === "CART_REMOVE") {
          const currentCart: any[] = Array.isArray(customerData?.cart) ? customerData.cart : [];
          if (currentCart.length === 0) {
            const cartEmptyMsg = "Tu carrito ya está vacío 🙂.";
            await sendWhatsApp(from, cartEmptyMsg, undefined, activityRefId, to);
            if (activityRefId) {
              await updateDoc(doc(db, "activities", activityRefId), {
                status: "respondido",
                response: cartEmptyMsg,
                respondedAt: serverTimestamp()
              });
            }
          } else if (currentCart.length === 1) {
            await updateDoc(doc(db, "customers", customerProfileId), { cart: [], pendingCartAction: null });
            const removedMsg = `🗑️ Listo, quité *${currentCart[0].name}* de tu carrito. ¿Quieres ver el catálogo de nuevo?`;
            await sendWhatsApp(from, removedMsg, undefined, activityRefId, to);
            await sendCategoriesMenu(from, to);
            if (activityRefId) {
              await updateDoc(doc(db, "activities", activityRefId), {
                status: "respondido",
                response: removedMsg,
                respondedAt: serverTimestamp()
              });
            }
          } else {
            const listText = currentCart
              .map((it: any, idx: number) => `${idx + 1}. ${it.cantidad}x ${it.name} - $${Number(it.price * it.cantidad).toLocaleString("es-CO")}`)
              .join("\n");
            await updateDoc(doc(db, "customers", customerProfileId), { pendingCartAction: "remove" });
            const whichRemoveMsg = `🗑️ ¿Cuál quieres quitar? Escríbeme el número:\n\n${listText}\n\nO escribe "todos" para vaciar el carrito completo.`;
            await sendWhatsApp(from, whichRemoveMsg, undefined, activityRefId, to);
            if (activityRefId) {
              await updateDoc(doc(db, "activities", activityRefId), {
                status: "respondido",
                response: whichRemoveMsg,
                respondedAt: serverTimestamp()
              });
            }
          }
        } else {
          console.warn(`[WhatsApp Webhook] ButtonPayload desconocido: ${buttonPayload}`);
        }

        return res.status(200).send("");
      } catch (e: any) {
        console.error("[WhatsApp Webhook] Error procesando ButtonPayload:", e.message);
        try {
          const failMsg = "Uy, algo falló procesando tu selección 😅. ¿Puedes intentarlo de nuevo o decirme qué producto buscas?";
          await sendWhatsApp(from, failMsg, undefined, activityRefId, to);
          if (activityRefId) {
            await updateDoc(doc(db, "activities", activityRefId), {
              status: "respondido",
              response: failMsg,
              respondedAt: serverTimestamp()
            });
          }
        } catch (sendErr: any) {
          console.error("[WhatsApp Webhook] Error enviando fallback tras fallo de ButtonPayload:", sendErr.message);
        }
        return res.status(200).send("");
      }
    }

    // Respaldo por texto: si Twilio NO mandó ni ButtonPayload ni ListId (por
    // ejemplo, si el cliente tocó un item pero por algún motivo llegó como
    // texto plano, o si escribió el nombre del producto/acción a mano),
    // intentamos resolverlo igual antes de caer en el flujo genérico de IA.
    if (!buttonPayload && messageBody && !(numMedia > 0 || (mediaItems && mediaItems.length > 0))) {
      try {
        const normalizedMsg = normalizeCatText(messageBody).trim();

        // 0) ¿Está en medio de un flujo de "quitar producto" que arrancó con
        //    el botón 🗑️? Si es así, resolvemos ESO primero, antes que
        //    cualquier otra interpretación del texto (evita ambigüedad).
        if (customerData?.pendingCartAction === "remove") {
          const cartNow: any[] = Array.isArray(customerData?.cart) ? [...customerData.cart] : [];
          if (/^todos?$/i.test(normalizedMsg) || /vaciar/.test(normalizedMsg)) {
            await updateDoc(doc(db, "customers", customerProfileId), { cart: [], pendingCartAction: null });
            const allClearedMsg = "🗑️ Listo, vacié todo tu carrito. ¿Vemos el catálogo de nuevo?";
            await sendWhatsApp(from, allClearedMsg, undefined, activityRefId, to);
            await sendCategoriesMenu(from, to);
            if (activityRefId) {
              await updateDoc(doc(db, "activities", activityRefId), {
                status: "respondido",
                response: allClearedMsg,
                respondedAt: serverTimestamp()
              });
            }
            return res.status(200).send("");
          }
          const removeIdx = parseInt(normalizedMsg, 10);
          if (!isNaN(removeIdx) && removeIdx >= 1 && removeIdx <= cartNow.length) {
            const removed = cartNow.splice(removeIdx - 1, 1)[0];
            await updateDoc(doc(db, "customers", customerProfileId), { cart: cartNow, pendingCartAction: null });
            if (cartNow.length === 0) {
              const emptyRemovedMsg = `🗑️ Quité *${removed.name}*. Tu carrito quedó vacío. ¿Vemos el catálogo?`;
              await sendWhatsApp(from, emptyRemovedMsg, undefined, activityRefId, to);
              await sendCategoriesMenu(from, to);
              if (activityRefId) {
                await updateDoc(doc(db, "activities", activityRefId), {
                  status: "respondido",
                  response: emptyRemovedMsg,
                  respondedAt: serverTimestamp()
                });
              }
            } else {
              const cartSummary = cartNow
                .map((it: any) => `• ${it.cantidad}x ${it.name} - $${Number(it.price * it.cantidad).toLocaleString("es-CO")}`)
                .join("\n");
              const totalCart = cartNow.reduce((sum: number, it: any) => sum + (it.price * it.cantidad), 0);
              const oneRemovedMsg = `🗑️ Quité *${removed.name}* de tu carrito.`;
              await sendWhatsApp(from, oneRemovedMsg, undefined, activityRefId, to);
              const sent = await sendCartActionButtons(from, to, cartSummary, totalCart);
              if (!sent) {
                const manualCartMsg = `🛒 Tu carrito ahora:\n${cartSummary}\n\n💵 Total: $${totalCart.toLocaleString("es-CO")} COP`;
                await sendWhatsApp(from, manualCartMsg, undefined, activityRefId, to);
                if (activityRefId) {
                  await updateDoc(doc(db, "activities", activityRefId), {
                    status: "respondido",
                    response: `${oneRemovedMsg} ${manualCartMsg}`,
                    respondedAt: serverTimestamp()
                  });
                }
              } else {
                if (activityRefId) {
                  await updateDoc(doc(db, "activities", activityRefId), {
                    status: "respondido",
                    response: oneRemovedMsg,
                    respondedAt: serverTimestamp()
                  });
                }
              }
            }
            return res.status(200).send("");
          }
          const helpRemMsg = "No entendí cuál 😅. Responde con el número (ej: 1) o escribe \"todos\" para vaciar el carrito.";
          await sendWhatsApp(from, helpRemMsg, undefined, activityRefId, to);
          if (activityRefId) {
            await updateDoc(doc(db, "activities", activityRefId), {
              status: "respondido",
              response: helpRemMsg,
              respondedAt: serverTimestamp()
            });
          }
          return res.status(200).send("");
        }

        const lastList: any[] = Array.isArray(customerData?.lastProductList) ? customerData.lastProductList : [];

        // 1) ¿El texto coincide (por número de la lista o por nombre) con un
        //    producto de la última lista que le mostramos?
        let matchedIdx = -1;
        const asNumber = parseInt(normalizedMsg, 10);
        if (!isNaN(asNumber) && asNumber >= 1 && asNumber <= lastList.length) {
          matchedIdx = asNumber - 1;
        } else if (normalizedMsg.length > 2) {
          matchedIdx = lastList.findIndex((p: any) => {
            const prodName = normalizeCatText(p?.name || "");
            return prodName && (prodName.includes(normalizedMsg) || normalizedMsg.includes(prodName));
          });
        }

        if (matchedIdx >= 0 && lastList[matchedIdx]) {
          const picked = lastList[matchedIdx];
          const currentCart: any[] = Array.isArray(customerData?.cart) ? [...customerData.cart] : [];
          const existing = currentCart.find((it: any) => it.name === picked.name);
          if (existing) {
            existing.cantidad = (existing.cantidad || 1) + 1;
          } else {
            currentCart.push({ name: picked.name, price: picked.price, cantidad: 1 });
          }
          await updateDoc(doc(db, "customers", customerProfileId), { cart: currentCart });

          const cartSummary = currentCart
            .map((it: any) => `• ${it.cantidad}x ${it.name} - $${Number(it.price * it.cantidad).toLocaleString("es-CO")}`)
            .join("\n");
          const totalCart = currentCart.reduce((sum: number, it: any) => sum + (it.price * it.cantidad), 0);

          const sent = await sendCartActionButtons(from, to, cartSummary, totalCart);
          if (!sent) {
            const textCartMsg = `🛒 Agregado a tu carrito:\n${cartSummary}\n\n💵 Total: $${totalCart.toLocaleString("es-CO")} COP\n\n¿Deseas agregar otro producto? Responde AGREGAR o CONFIRMAR.`;
            await sendWhatsApp(from, textCartMsg, undefined, activityRefId, to);
            if (activityRefId) {
              await updateDoc(doc(db, "activities", activityRefId), {
                status: "respondido",
                response: textCartMsg,
                respondedAt: serverTimestamp()
              });
            }
          } else {
            if (activityRefId) {
              await updateDoc(doc(db, "activities", activityRefId), {
                status: "respondido",
                response: `[Producto agregado al carrito por texto: ${picked.name}]`,
                respondedAt: serverTimestamp()
              });
            }
          }
          return res.status(200).send("");
        }

        // 2) Palabras clave de acciones de carrito por texto libre
        if (/\bagregar\b/.test(normalizedMsg)) {
          await sendCategoriesMenu(from, to);
          if (activityRefId) {
            await updateDoc(doc(db, "activities", activityRefId), {
              status: "respondido",
              response: "[Categorías enviadas para agregar más por texto]",
              respondedAt: serverTimestamp()
            });
          }
          return res.status(200).send("");
        }
        if (/\bconfirmar\b/.test(normalizedMsg)) {
          const currentCart: any[] = Array.isArray(customerData?.cart) ? customerData.cart : [];
          if (currentCart.length === 0) {
            const noItemsMsg = "Tu carrito está vacío todavía 🙂. Elige al menos un producto del catálogo.";
            await sendWhatsApp(from, noItemsMsg, undefined, activityRefId, to);
            await sendCategoriesMenu(from, to);
            if (activityRefId) {
              await updateDoc(doc(db, "activities", activityRefId), {
                status: "respondido",
                response: noItemsMsg,
                respondedAt: serverTimestamp()
              });
            }
          } else {
            const productoTexto = currentCart.map((it: any) => `${it.cantidad}x ${it.name}`).join(", ");
            const valorTotal = currentCart.reduce((sum: number, it: any) => sum + (it.price * it.cantidad), 0);
            await updateDoc(doc(db, "customers", customerProfileId), { cart: null });
            await startCheckoutFlowFromCart(from, cleanFrom, to, assignedStoreId, productoTexto, valorTotal, activityRefId);
          }
          return res.status(200).send("");
        }
      } catch (e: any) {
        console.error("[WhatsApp Webhook] Error en respaldo por texto (sin ButtonPayload):", e.message);
      }
    }

    console.log(`[WhatsApp Webhook] Incoming from ${from} to ${to}: ${finalMessage}`);

    // Deterministic message processing & Interceptors (bypasses LLM for maximum performance & reliability)
    const cleanMsg = (finalMessage || "").toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .trim();

      // ==============================================
      // 0.A0 INTERCEPTOR GLOBAL: OPT-OUT DE MARKETING ("no me escribas más")
      // ==============================================
      // Antes no había forma de que un cliente pidiera permanentemente no
      // recibir más mensajes de las campañas automáticas de "producto en
      // tendencia" — el único freno era el cooldown temporal. Esto marca
      // marketingOptOut=true en su perfil, que triggerTrendCampaign respeta.
      const optOutPhrases = [
        "no me escribas mas", "no me vuelvas a escribir", "dejen de escribirme",
        "quitame de la lista", "no quiero mas mensajes", "no me mandes mas publicidad",
        "no me mandes mas promociones", "unsubscribe", "stop", "no me contactes mas"
      ];
      const wantsOptOut = optOutPhrases.some(p => cleanMsg.includes(p));

      if (wantsOptOut && from.startsWith("whatsapp:")) {
        await setDoc(doc(db, "customers", customerProfileId), { marketingOptOut: true }, { merge: true });
        await sendWhatsApp(
          from,
          "Listo, no te volveremos a escribir con ofertas ni promociones. Si necesitas algo de un pedido o quieres volver a comprar, aquí seguimos. 🙂",
          undefined,
          activityRef.id,
          to
        );
        return res.status(200).send("");
      }

      // ==============================================
      // 0.A INTERCEPTOR GLOBAL: PEDIR ASESOR HUMANO (funciona en cualquier punto)
      // ==============================================
      // Antes, "Hablar con Asesor" solo era un botón que aparecía en ciertos
      // menús. Ahora cualquier frase que claramente pida un humano dispara lo
      // mismo sin importar en qué parte del flujo esté el cliente (catálogo,
      // checkout, etc.), salvo que ya haya un asesor activo para no repetir.
      const advisorPhrases = [
        "hablar con asesor", "hablar con alguien", "hablar con una persona",
        "hablar con un humano", "quiero un asesor", "necesito un asesor",
        "atencion al cliente", "persona real", "hablar con soporte",
        "quiero hablar con una persona", "asesor humano", "un humano por favor"
      ];
      const wantsAdvisor = advisorPhrases.some(p => cleanMsg.includes(p)) ||
        (cleanMsg.includes("asesor") && !cleanMsg.includes("no quiero"));

      if (wantsAdvisor && from.startsWith("whatsapp:")) {
        // ANTES: aqui se ponia aiPaused=true en customers Y en conversations, se
        // mandaba "ya le transferi tu chat a un asesor" y se cortaba el flujo. El
        // bot quedaba mudo para siempre hasta que alguien lo despausara a mano: el
        // cliente escribia y no le contestaba nadie. Un lead pagado perdido cada vez.
        //
        // AHORA: no se pausa nada. Solo se marca la etapa, que activa el contexto de
        // acompañamiento del prompt, y se avisa al equipo. La IA sigue atendiendo como
        // lo haria una persona y filtra la conversacion. La pausa real ocurre unicamente
        // cuando un asesor responde de verdad por el panel (ver /api/admin/send-message),
        // que es el unico momento en que tiene sentido que el bot se aparte.
        await setDoc(doc(db, "customers", customerProfileId), { etapa: "asesoria_solicitada" }, { merge: true });

        // El equipo se entera igual, para poder entrar si el caso lo amerita.
        try {
          let storeConfig: any = {};
          const storeSnap = await getDoc(doc(db, "stores", assignedStoreId));
          if (storeSnap.exists()) storeConfig = storeSnap.data();
          await notifyAdmins({
            customerName: customerData?.name || cleanFrom,
            customerPhone: cleanFrom,
            productName: "Solicitud de asesor humano",
            totalPrice: 0
          }, storeConfig?.name || "Jan Vanegas", storeConfig);
        } catch (e) {
          console.error("[Advisor Interceptor] Error notificando asesoría:", e);
        }

        // Sin return a proposito: el mensaje sigue su curso normal y lo responde la
        // IA con el contexto de asesoria, en vez de dejar al cliente esperando.
        // Saludo de traspaso: el cliente pidio una persona, asi que lo primero que
        // recibe es una presentacion con nombre. Es un mensaje fijo a proposito
        // (no pasa por la IA) para que salga siempre igual, al instante y sin
        // riesgo de que el modelo lo enrede. De aqui en adelante contesta la IA
        // con el contexto de atencion personalizada.
        const nombreAsesor = "Jan Vanegas";
        const saludoAsesor = [
          "¡Hola! 👋 Hablas con *" + nombreAsesor + "*, asesor de ventas de Jan Sel Shop.",
          "",
          "Ya tomé tu conversación personalmente 🙌",
          "",
          "Cuéntame, ¿en qué te puedo ayudar hoy?"
        ].join(String.fromCharCode(10));
        await sendWhatsApp(from, saludoAsesor, undefined, activityRefId, to);
        if (activityRefId) {
          await updateDoc(doc(db, "activities", activityRefId), {
            status: "respondido",
            response: saludoAsesor,
            respondedAt: serverTimestamp()
          });
        }

        console.log(`[Advisor] ${cleanFrom} pidio asesor. La IA sigue atendiendo; el equipo fue notificado.`);
        // Se corta solo este mensaje para no responder dos veces (el saludo y la IA).
        // La IA NO queda pausada: el proximo mensaje del cliente lo atiende ella.
        return res.status(200).send("");
      }

      // ==============================================
      // 0.B INTERCEPTOR GLOBAL: SEGUIMIENTO / "¿DÓNDE VA MI PEDIDO?"
      // ==============================================
      const trackingPhrases = [
        "donde va mi pedido", "donde esta mi pedido", "estado de mi pedido",
        "seguimiento de mi pedido", "seguimiento del pedido", "rastrear mi pedido",
        "numero de guia", "guia de envio", "mi pedido va", "ver mi pedido",
        "donde viene mi pedido", "cuando llega mi pedido"
      ];
      const wantsTracking = trackingPhrases.some(p => cleanMsg.includes(p));

      if (wantsTracking && from.startsWith("whatsapp:")) {
        try {
          const ordersQ = query(
            collection(db, "orders"),
            where("customerPhone", "==", cleanFrom),
            orderBy("createdAt", "desc"),
            limit(1)
          );
          const ordersSnap = await getDocs(ordersQ);
          if (ordersSnap.empty) {
            const noOrderMsg = "No encuentro ningún pedido asociado a tu número todavía. 🙁 Si ya hiciste uno, cuéntame el nombre con el que lo registraste y te ayudo a buscarlo.";
            await sendWhatsApp(from, noOrderMsg, undefined, activityRef.id, to);
            await updateDoc(doc(db, "activities", activityRef.id), {
              status: "respondido",
              response: noOrderMsg,
              respondedAt: serverTimestamp()
            });
            return res.status(200).send("");
          }
          const order = ordersSnap.docs[0].data() as any;
          const statusLabel: Record<string, string> = {
            preparacion: "🟡 En preparación, aún no ha sido despachado",
            en_ruta: "🔵 En tránsito, va en camino",
            entregado: "🟢 ¡Ya fue entregado!",
            novedad: "🔴 Tiene una novedad, un asesor te contactará"
          };
          const label = statusLabel[order.trackingStatus] || "🟡 En preparación, aún no ha sido despachado";
          let msg = `📦 *Estado de tu pedido:* ${order.productName || ""}\n\n${label}`;
          if (order.trackingGuide) msg += `\n\n🚚 *Guía:* ${order.trackingGuide}`;
          if (order.trackingUrl) msg += `\n🔗 *Rastrear aquí:* ${order.trackingUrl}`;
          if (!order.trackingUrl) msg += `\n\nApenas se despache te mandaremos el número de guía automáticamente. 😊`;
          await sendWhatsApp(from, msg, undefined, activityRef.id, to);
          await updateDoc(doc(db, "activities", activityRef.id), {
            status: "respondido",
            response: msg,
            respondedAt: serverTimestamp()
          });
        } catch (e) {
          console.error("[Tracking Interceptor] Error buscando pedido:", e);
          const errorMsg = "Tuve un problema buscando tu pedido. Un asesor te va a confirmar el estado en un momento. 🙏";
          await sendWhatsApp(from, errorMsg, undefined, activityRef.id, to);
          await updateDoc(doc(db, "activities", activityRef.id), {
            status: "respondido",
            response: errorMsg,
            respondedAt: serverTimestamp()
          });
        }
        return res.status(200).send("");
      }

      // Bypass conditions for the deterministic state machine to let the IA process the message:
      let shouldBypassCheckout = false;
      const hasMedia = numMedia > 0 || (mediaItems && mediaItems.length > 0);

      if (hasMedia) {
        shouldBypassCheckout = true;
        console.log(`[Checkout State Machine] Bypassing checkout state machine for ${cleanFrom} because media was received.`);
      }

      const currentStep = customerData?.checkoutStep;
      if (!shouldBypassCheckout && customerData && currentStep === "confirmacion") {
        const normConfirm = cleanMsg.replace(/[^a-z]/g, "");
        const fieldMap: Record<string, string> = {
          nombre: "nombre", telefono: "telefono", numero: "telefono",
          ciudad: "ciudad", direccion: "direccion", referencia: "referencia",
          producto: "producto", cantidad: "cantidad"
        };
        const fieldRequested = Object.keys(fieldMap).find(k => normConfirm === k || normConfirm.includes(k));
        const isAwaitingField = customerData.checkoutData?._awaitingFieldChoice && fieldRequested;
        const isYes = ["si", "sii", "sigo", "correcto", "confirmar", "confirmo", "deuna", "dale", "yes"].some(k => normConfirm === k || normConfirm.startsWith(k));
        const isNo = ["no", "cancelar", "cambiar", "corregir", "incorrecto"].some(k => normConfirm === k || normConfirm.startsWith(k));

        if (!isAwaitingField && !isYes && !isNo) {
          shouldBypassCheckout = true;
          console.log(`[Checkout State Machine] Bypassing confirmacion step for ${cleanFrom} because message "${finalMessage}" is not a standard Yes/No confirmation.`);
        }
      }

      if (!shouldBypassCheckout && customerData && currentStep === "producto") {
        const products = await loadProductsForStore(assignedStoreId);
        const match = products.find((p: any) =>
          (p.name && p.name.toLowerCase().includes(finalMessage.toLowerCase())) ||
          (p.name && finalMessage.toLowerCase().includes(p.name.toLowerCase()))
        );
        if (!match) {
          shouldBypassCheckout = true;
          console.log(`[Checkout State Machine] Bypassing producto step for ${cleanFrom} because input "${finalMessage}" does not match any product in catalog.`);
        }
      }

      // ==============================================
      // 1. ACTIVE CHECKOUT STATE MACHINE (DETERMINISTIC)
      // ==============================================
      if (customerData && customerData.checkoutStep && from.startsWith("whatsapp:") && !shouldBypassCheckout) {
        const currentStep = customerData.checkoutStep;
        const checkoutData = customerData.checkoutData || {};

        console.log(`[Checkout State Machine] Client ${cleanFrom} in step: ${currentStep}. Msg: ${finalMessage}`);

        // Allow cancel or back
        if (["cancelar", "cancelar pedido", "cancelar compra", "salir", "atras"].some(k => cleanMsg === k || cleanMsg.includes(k))) {
          await setDoc(doc(db, "customers", customerProfileId), {
            checkoutStep: null,
            checkoutData: null,
            etapa: "interesado"
          }, { merge: true });
          const cancelMsg = `¡Listo! Cancelamos tu proceso de compra. 🙂 ¿En qué más te puedo colaborar hoy?`;
          await sendWhatsApp(from, cancelMsg, undefined, activityRef.id, to);
          await updateDoc(doc(db, "activities", activityRef.id), {
            status: "respondido",
            response: cancelMsg,
            respondedAt: serverTimestamp()
          });
          await new Promise(resolve => setTimeout(resolve, 800));
          await sendMainMenu(from, to);
          return res.status(200).send("");
        }

        // Retomar checkout tras un follow-up de carrito abandonado (por si el
        // botón no llegó y el cliente escribió "continuar" en texto plano)
        if (["continuar", "seguir", "continuar pedido", "seguir pedido"].some(k => cleanMsg === k || cleanMsg.startsWith(k))) {
          await resendCurrentCheckoutStepPrompt(from, to, customerData, activityRef.id);
          return res.status(200).send("");
        }

        // Interceptor de distracciones en Checkout (Evita que fotos, saludos, catálogos
        // o preguntas por otros productos se guarden como ciudad, dirección, nombre, etc.)
        const isDataStep = ["cantidad", "nombre", "telefono", "ciudad", "direccion", "referencia"].includes(currentStep);
        if (isDataStep) {
          const hasMedia = numMedia > 0 || (mediaItems && mediaItems.length > 0) || (finalMessage || "").includes("[Media:");
          const isGreeting = (cleanMsg.length <= 15 && ["hola", "buenas", "buenos dias", "buenas tardes", "buenas noches", "que tal", "alo", "buen dia", "saludos", "epale", "parce", "oe", "que mas"].some(w => cleanMsg === w || cleanMsg.startsWith(w)));
          const isCatalog = ["catalogo", "ver catalogo", "ver productos", "portafolio", "que productos tienen", "que productos tienes", "que productos venden", "que venden"].some(k => cleanMsg.includes(k));
          const isProductInquiry = [
            "tienes de este", "tienes este", "cuanto vale este", "precio de este", 
            "que cuesta este", "cuanto cuesta este", "vendes de este", "este lo tienes",
            "que precio", "que costo", "valor de este", "tienen de este"
          ].some(q => cleanMsg.includes(q)) || (
            [
              "modem", "retrovisor", "intercomunicador", "soporte", "funda", "destornillador", 
              "linterna", "camping", "candado", "compresor", "hidrolavadora", "aspiradora", "cargador"
            ].some(kw => cleanMsg.includes(kw) && !String(checkoutData.producto || "").toLowerCase().includes(kw))
          );

          if (hasMedia || isGreeting || isCatalog || isProductInquiry) {
            console.log(`[Checkout State Machine] Distraction detected at step ${currentStep}: hasMedia=${hasMedia}, isGreeting=${isGreeting}, isCatalog=${isCatalog}, isProductInquiry=${isProductInquiry}`);
            
            let distractionMsg = "";
            if (hasMedia) {
              distractionMsg = `He recibido tu foto/archivo, pero veo que estabas en medio de registrar tu pedido de *${checkoutData.producto || "tu producto"}*. 📦\n\n¿Qué deseas hacer?\n\n🛒 Escribe *CONTINUAR* para seguir con tu pedido de *${checkoutData.producto || "tu producto"}*.\n❌ Escribe *CANCELAR* si prefieres cancelar este pedido para que podamos ver la foto que me enviaste.`;
            } else if (isCatalog) {
              distractionMsg = `Veo que quieres ver nuestro catálogo, pero estás en medio de registrar tu pedido de *${checkoutData.producto || "tu producto"}*. 📦\n\n¿Qué deseas hacer?\n\n🛒 Escribe *CONTINUAR* para seguir con tu pedido de *${checkoutData.producto || "tu producto"}*.\n❌ Escribe *CANCELAR* si prefieres cancelar esta compra para ver el catálogo.`;
            } else if (isProductInquiry) {
              distractionMsg = `Veo que estás preguntando por otro producto, pero estás en medio de registrar tu pedido de *${checkoutData.producto || "tu producto"}*. 📦\n\n¿Qué deseas hacer?\n\n🛒 Escribe *CONTINUAR* para seguir con tu pedido de *${checkoutData.producto || "tu producto"}*.\n❌ Escribe *CANCELAR* si prefieres cancelar esta compra para consultar sobre el otro producto.`;
            } else {
              distractionMsg = `¡Hola de nuevo! 👋 Veo que estabas en medio de registrar tu pedido de *${checkoutData.producto || "tu producto"}*.\n\n¿Qué deseas hacer?\n\n🛒 Escribe *CONTINUAR* para seguir con tu pedido de *${checkoutData.producto || "tu producto"}*.\n❌ Escribe *CANCELAR* si prefieres cancelar tu pedido.`;
            }

            await sendWhatsApp(from, distractionMsg, undefined, activityRef.id, to);
            await updateDoc(doc(db, "activities", activityRef.id), {
              status: "respondido",
              response: distractionMsg,
              respondedAt: serverTimestamp()
            });
            return res.status(200).send("");
          }
        }

        if (currentStep === "producto") {
          checkoutData.producto = finalMessage;
          
          let matchedPrice = 0;
          const products = await loadProductsForStore(assignedStoreId);
          const match = products.find((p: any) =>
            (p.name && p.name.toLowerCase().includes(finalMessage.toLowerCase())) ||
            (p.name && finalMessage.toLowerCase().includes(p.name.toLowerCase()))
          );
          if (match && match.price) {
            matchedPrice = match.price;
            checkoutData.producto = match.name;
          }
          checkoutData.valor = matchedPrice;

          if (checkoutData._editing === true) {
            delete checkoutData._editing;
            await sendCheckoutSummaryAndButtons(from, to, customerProfileId, checkoutData, activityRef.id, assignedStoreId);
            return res.status(200).send("");
          }

          await setDoc(doc(db, "customers", customerProfileId), {
            checkoutStep: "cantidad",
            checkoutData: checkoutData
          }, { merge: true });

          await sendWhatsApp(from, `¡Perfecto! Vamos a registrar tu pedido para: *${checkoutData.producto}*. 📦\n\n¿Cuántas *unidades* deseas? (Escribe un número, o *1* si solo quieres una) 🔢`, undefined, activityRef.id, to);
          return res.status(200).send("");
        }

        if (currentStep === "cantidad") {
          let qty = parseInt(finalMessage.replace(/[^0-9]/g, ""), 10);
          if (!qty || isNaN(qty) || qty < 1) qty = 1;
          if (qty > 20) qty = 20;
          checkoutData.cantidad = qty;

          const isEditing = checkoutData._editing === true;
          if (isEditing) {
            delete checkoutData._editing;
            await sendCheckoutSummaryAndButtons(from, to, customerProfileId, checkoutData, activityRef.id, assignedStoreId);
            return res.status(200).send("");
          }

          await setDoc(doc(db, "customers", customerProfileId), {
            checkoutStep: "nombre",
            checkoutData: checkoutData
          }, { merge: true });

          await sendWhatsApp(from, `¡Listo, *${qty}* unidad${qty > 1 ? "es" : ""}! Ahora, por favor dime tu *Nombre y Apellido completo* para la guía de envío de tu pedido: 📝`, undefined, activityRef.id, to);
          return res.status(200).send("");
        }

        if (currentStep === "nombre") {
          checkoutData.nombre = finalMessage;

          const isEditingNombre = checkoutData._editing === true;
          if (isEditingNombre) {
            delete checkoutData._editing;
            await sendCheckoutSummaryAndButtons(from, to, customerProfileId, checkoutData, activityRef.id, assignedStoreId);
            return res.status(200).send("");
          }

          await setDoc(doc(db, "customers", customerProfileId), {
            checkoutStep: "telefono",
            checkoutData: checkoutData
          }, { merge: true });

          await sendWhatsApp(from, `¡Mucho gusto, *${finalMessage}*! 🤝 ¿A qué *número de teléfono* te puede contactar la transportadora si hay alguna novedad? \n\n✍️ Escríbelo, o responde con la palabra *mismo* para usar tu número de WhatsApp actual (${cleanFrom}) 📞`, undefined, activityRef.id, to);
          return res.status(200).send("");
        }

        if (currentStep === "telefono") {
          let phoneVal = finalMessage.trim();
          if (["mismo", "el mismo", "este mismo", "este"].some(k => cleanMsg.includes(k))) {
            phoneVal = cleanFrom;
          }
          checkoutData.telefono = phoneVal;

          if (checkoutData._editing === true) {
            delete checkoutData._editing;
            await sendCheckoutSummaryAndButtons(from, to, customerProfileId, checkoutData, activityRef.id, assignedStoreId);
            return res.status(200).send("");
          }

          await setDoc(doc(db, "customers", customerProfileId), {
            checkoutStep: "ciudad",
            checkoutData: checkoutData
          }, { merge: true });

          await sendWhatsApp(from, `¡Listo! Quedó registrado el número *${phoneVal}*. \n\nAhora contame: ¿A qué *ciudad, municipio o corregimiento* y de qué *departamento* enviamos tu pedido? (Acuérdate de que el envío es GRATIS a toda Colombia) 🇨🇴`, undefined, activityRef.id, to);
          return res.status(200).send("");
        }

        if (currentStep === "ciudad") {
          checkoutData.ciudad = finalMessage;

          if (checkoutData._editing === true) {
            delete checkoutData._editing;
            await sendCheckoutSummaryAndButtons(from, to, customerProfileId, checkoutData, activityRef.id, assignedStoreId);
            return res.status(200).send("");
          }

          await setDoc(doc(db, "customers", customerProfileId), {
            checkoutStep: "direccion",
            checkoutData: checkoutData
          }, { merge: true });

          await sendWhatsApp(from, `¡Entendido! ¿Cuál es tu *dirección exacta de entrega*? (Por favor incluye calle, carrera, número de casa, apartamento, torre o barrio para que no haya demoras) 🏠`, undefined, activityRef.id, to);
          return res.status(200).send("");
        }

        if (currentStep === "direccion") {
          checkoutData.direccion = finalMessage;

          if (checkoutData._editing === true) {
            delete checkoutData._editing;
            await sendCheckoutSummaryAndButtons(from, to, customerProfileId, checkoutData, activityRef.id, assignedStoreId);
            return res.status(200).send("");
          }

          await setDoc(doc(db, "customers", customerProfileId), {
            checkoutStep: "referencia",
            checkoutData: checkoutData
          }, { merge: true });

          await sendWhatsApp(from, `¡Súper! Para que la transportadora entregue volando y sin enredos, ¿tienes alguna *indicación o referencia adicional*? \n\n📍 (Ej: "casa de rejas blancas", "frente al parque", "entregar en portería", o escribe *ninguna* si no aplica) 👇`, undefined, activityRef.id, to);
          return res.status(200).send("");
        }

        if (currentStep === "referencia") {
          checkoutData.referencia = finalMessage;

          if (checkoutData._editing === true) {
            delete checkoutData._editing;
          }

          await sendCheckoutSummaryAndButtons(from, to, customerProfileId, checkoutData, activityRef.id, assignedStoreId);
          return res.status(200).send("");
        }

        if (currentStep === "confirmacion") {
          const normConfirm = cleanMsg.replace(/[^a-z]/g, "");

          // Si el cliente estaba corrigiendo un campo puntual y responde algo
          // que coincide con el nombre de un campo, lo mandamos directo a
          // capturar ese campo en vez de tratarlo como SI/NO.
          const fieldMap: Record<string, string> = {
            nombre: "nombre", telefono: "telefono", numero: "telefono",
            ciudad: "ciudad", direccion: "direccion", referencia: "referencia",
            producto: "producto", cantidad: "cantidad"
          };
          const fieldRequested = Object.keys(fieldMap).find(k => normConfirm === k || normConfirm.includes(k));

          if (customerData.checkoutData?._awaitingFieldChoice && fieldRequested) {
            const targetStep = fieldMap[fieldRequested];
            const cd = { ...checkoutData, _editing: true };
            delete cd._awaitingFieldChoice;
            await setDoc(doc(db, "customers", customerProfileId), {
              checkoutStep: targetStep,
              checkoutData: cd
            }, { merge: true });
            const prompts: Record<string, string> = {
              nombre: "¡Dale! ¿Cuál es el *nombre y apellido* correcto? 📝",
              telefono: "¡Dale! ¿Cuál es el *teléfono* correcto? 📞",
              ciudad: "¡Dale! ¿Cuál es la *ciudad/municipio* correcta? 🇨🇴",
              direccion: "¡Dale! ¿Cuál es la *dirección exacta* correcta? 🏠",
              referencia: "¡Dale! ¿Cuál es la *referencia* correcta? 📍",
              producto: "¡Dale! ¿Cuál es el *producto* correcto? 📦",
              cantidad: "¡Dale! ¿Cuántas *unidades* correctas quieres? 🔢"
            };
            await sendWhatsApp(from, prompts[targetStep], undefined, activityRef.id, to);
            return res.status(200).send("");
          }

          if (["si", "sii", "sigo", "correcto", "confirmar", "confirmo", "deuna", "dale", "yes"].some(k => normConfirm === k || normConfirm.startsWith(k))) {
            const pending = customerData.pendingConfirmation;
            if (pending && pending.jsonResponse) {
              let storeConfig: any = {};
              const storeSnap = await getDoc(doc(db, "stores", assignedStoreId));
              if (storeSnap.exists()) storeConfig = storeSnap.data();
              const products = await loadProductsForStore(assignedStoreId);

              await finalizeOrder(pending.jsonResponse, storeConfig, customerData, cleanFrom, assignedStoreId, products, db);
              await setDoc(doc(db, "customers", customerProfileId), { 
                pendingConfirmation: null, 
                checkoutStep: null, 
                checkoutData: null,
                etapa: "finalizado"
              }, { merge: true });
              
              await sendWhatsApp(from, "¡Listo! 🎉 Tu pedido quedó confirmado, ya te lo estamos alistando para despacho hoy mismo. ¡Muchísimas gracias por confiar en Jan Sel Shop! 👋", undefined, activityRef.id, to);
            } else {
              await sendWhatsApp(from, "No encontramos ningún pedido pendiente de confirmación. 😊 ¿En qué más te puedo colaborar?", undefined, activityRef.id, to);
            }
            return res.status(200).send("");
          } else if (["no", "cancelar", "cambiar", "corregir", "incorrecto"].some(k => normConfirm === k || normConfirm.startsWith(k))) {
            // Antes esto borraba TODOS los datos capturados y obligaba a
            // empezar de cero. Ahora preguntamos puntualmente qué campo
            // quiere corregir, y solo reiniciamos ese campo.
            await setDoc(doc(db, "customers", customerProfileId), {
              checkoutStep: "confirmacion",
              checkoutData: { ...checkoutData, _awaitingFieldChoice: true }
            }, { merge: true });
            await sendWhatsApp(from, `Tranqui, no he confirmado nada todavía 🙂 ¿Qué deseas corregir? Responde una de estas palabras:\n\n📦 *producto*\n🔢 *cantidad*\n👤 *nombre*\n📞 *telefono*\n🇨🇴 *ciudad*\n🏠 *direccion*\n📍 *referencia*\n\nO escribe *cancelar* si prefieres cancelar todo el pedido.`, undefined, activityRef.id, to);
            return res.status(200).send("");
          } else {
            // Antes: si la respuesta no era ni "SI" ni "NO" reconocido, el código
            // seguía de largo hacia los interceptores de más abajo (compra,
            // catálogo, saludo) sin resolver el pedido pendiente — dejando al
            // cliente atascado en "confirmacion" sin que nada se lo aclarara,
            // y con riesgo de que un nuevo "quiero comprar X" pisara los datos
            // ya capturados. Ahora reforzamos la pregunta y cortamos acá,
            // igual que en el resto de los pasos de este mismo flujo.
            await sendWhatsApp(from, "Perdón, no te entendí bien 🙏 ¿Confirmas tu pedido? Responde *SÍ* para confirmar o *NO* si quieres corregir algo.", undefined, activityRef.id, to);
            return res.status(200).send("");
          }
        }
      }

      // ==============================================
      // 2. BUY INTENT DETECTOR & CHECKOUT START (DETERMINISTIC)
      // ==============================================
      const isBuyIntent = [
        "quiero comprar", "comprar", "hacer pedido", "hacer el pedido", "ordenar", 
        "me interesa comprar", "hacer un pedido", "quiero pedir", "quiero ordenar", 
        "hacer la compra", "pedir", "compra"
      ].some(k => cleanMsg.includes(k)) || 
      (cleanMsg.startsWith("quiero ") && (cleanMsg.includes("el ") || cleanMsg.includes("la ") || cleanMsg.includes("un ") || cleanMsg.includes("una ")) && !cleanMsg.includes("saber") && !cleanMsg.includes("preguntar") && !cleanMsg.includes("info") && !cleanMsg.includes("foto"));

      if (isBuyIntent && from.startsWith("whatsapp:")) {
        let matchedProduct = "";
        const productKeywords = [
          { kw: "modem", name: "Módem Wifi Portátil Pro" },
          { kw: "retrovisor", name: "Espejo Retrovisor Cámara Dual" },
          { kw: "intercomunicador", name: "Intercomunicador Y10" },
          { kw: "soporte", name: "Soporte de Carga Magnética" },
          { kw: "funda", name: "Funda Protectora para Moto" },
          { kw: "destornillador", name: "Destornillador Atornillador Eléctrico" },
          { kw: "frontal", name: "Linterna Frontal" },
          { kw: "linterna", name: "Linterna Multipropósito" },
          { kw: "camping", name: "Bombillo para Camping Recargable" },
          { kw: "ever brite", name: "Lámpara LED Sensor Ever Brite" },
          { kw: "candado", name: "Candado con Alarma" },
          { kw: "compresor", name: "Compresor / Inflador" },
          { kw: "hidrolavadora", name: "Hidrolavadora inalámbrica" },
          { kw: "aspiradora", name: "Aspiradora para carro" },
          { kw: "cargador", name: "Cargador/Accesorio para celular" }
        ];
        for (const pk of productKeywords) {
          if (cleanMsg.includes(pk.kw)) {
            matchedProduct = pk.name;
            break;
          }
        }
        
        console.log(`[WhatsApp Checkout Trigger] Buying intent detected. Product: ${matchedProduct || "none"}. Starting checkout flow...`);
        await startCheckoutFlow(from, cleanFrom, to, assignedStoreId, matchedProduct, activityRef.id);
        return res.status(200).send("");
      }

      // ==============================================
      // 3. CATALOG REQUEST INTERCEPTOR (DETERMINISTIC)
      // ==============================================
      const isCatalogRequest = [
        "que productos tienen",
        "que productos tienes",
        "que productos venden",
        "que producto tiene",
        "que productos hay",
        "catalogo",
        "ver catalogo",
        "ver productos",
        "portafolio",
        "lista de productos",
        "inventario",
        "que venden",
        "que vende",
        "que tiene",
        "que tienen",
        "productos destacados",
        "mejores productos",
        "top 15",
        "que vendes",
        "mostrar catalogo",
        "enviar catalogo",
        "mandar catalogo",
        "lista de precios"
      ].some(k => cleanMsg.includes(k)) || 
      (cleanMsg.includes("producto") && (cleanMsg.includes("que") || cleanMsg.includes("cual") || cleanMsg.includes("ver") || cleanMsg.includes("mostrar") || cleanMsg.includes("tienen") || cleanMsg.includes("tienes")));

      // Pedido explicito de combos. Va ANTES del interceptor de catalogo porque
      // "que combos tienen" tambien contiene "que tienen" y caeria en el catalogo
      // general, que no es lo que el cliente pidio.
      const isCombosRequest = [
        "combo", "combos", "promo", "promos", "promocion", "promociones",
        "paquete", "paquetes", "oferta especial", "ofertas especiales"
      ].some(k => (cleanMsg || "").includes(k));
      
      if (isCombosRequest && from.startsWith("whatsapp:")) {
        console.log(`[WhatsApp Interceptor] Pedido de combos detectado desde ${from}`);
        const enviado = await sendCombosList(from, to, customerProfileId);
        if (enviado) {
          await updateDoc(doc(db, "activities", activityRef.id), {
            status: "respondido",
            response: "[Lista de combos enviada]",
            respondedAt: serverTimestamp()
          });
          await setDoc(doc(db, "customers", customerProfileId), {
            etapa: "interesado",
            intencion: "ver_combos",
            score: 45,
            lastInteractionAt: serverTimestamp()
          }, { merge: true });
          return res.status(200).send("");
        }
        // Si la lista no pudo salir, se deja seguir el flujo normal de la IA en vez
        // de dejar al cliente sin respuesta.
      }
      
      // ==============================================
      // 3.4 INTERCEPTOR: PREGUNTA POR UN PRODUCTO PUNTUAL
      // ==============================================
      // Va ANTES del interceptor de catálogo a propósito, y esa es justamente la
      // corrección. El mensaje que manda la ficha web ("Vengo de la página del
      // producto... ¿Tienen disponible para envío hoy?") contiene "producto" y
      // "tienen", así que activaba isCatalogRequest: el cliente pedía UN producto
      // y recibía el saludo genérico más la lista completa de tendencias, sin que
      // la IA alcanzara a verlo. Verificado en la base el 31/08/2026: el cliente
      // escribió a las 18:34:30 y a las 18:34:32 ya tenía encima el catálogo.
      let productoPreguntado: any = null;
      if (from.startsWith("whatsapp:")) {
        try {
          const catalogoTienda = await loadProductsForStore(assignedStoreId);
          productoPreguntado = detectarProductoUnico(finalMessage || "", catalogoTienda);
        } catch (e: any) {
          console.error("[WhatsApp Interceptor] No se pudo leer el catálogo para detectar producto:", e.message);
        }
      }

      if (productoPreguntado) {
        console.log(`[WhatsApp Interceptor] Pregunta por producto puntual: ${productoPreguntado.name} (${productoPreguntado.id}) desde ${from}`);
        const enviado = await sendProductSalesFlow(from, cleanFrom, to, assignedStoreId, productoPreguntado, activityRef.id);
        if (enviado) return res.status(200).send("");
        // Si la ficha no pudo salir se deja seguir el flujo normal, para no dejar
        // al cliente sin ninguna respuesta.
      }

      if (isCatalogRequest && from.startsWith("whatsapp:")) {
        console.log(`[WhatsApp Interceptor] Catalog request detected from ${from}. Replying deterministically with trending products first...`);

        const greeting = getTimeGreeting();
        const CATALOG_SHORT_MESSAGE = `${greeting} 👋 Bienvenido a *Jan Sel Shop*! 💎\n\nTrabajamos una *selección corta de productos que sí funcionan*, no un catálogo interminable. Si buscas algo puntual pregúntame y te digo de una si te lo conseguimos 🚀\n\n🔥 *ENVÍO GRATIS A TODA COLOMBIA* 🇨🇴\n🚛 *PAGAS CUANDO LO RECIBAS* — no mandas un peso por adelantado\n\n👇 Mira lo más vendido de hoy:`;

        await sendWhatsApp(from, CATALOG_SHORT_MESSAGE, undefined, activityRef.id, to);
        await new Promise(resolve => setTimeout(resolve, 1200));
        await sendTrendingProducts(from, to, assignedStoreId);

        await updateDoc(doc(db, "activities", activityRef.id), {
          status: "respondido",
          response: CATALOG_SHORT_MESSAGE,
          respondedAt: serverTimestamp()
        });

        await setDoc(doc(db, "customers", customerProfileId), {
          etapa: "explorando_catalogo",
          intencion: "ver_catalogo",
          score: 25,
          lastInteractionAt: serverTimestamp()
        }, { merge: true });

        return res.status(200).send("");
      }

      // ==============================================
      // 3.5. NUMERIC OR DIRECT MENU SELECTION INTERCEPTOR
      // ==============================================
      const normCleanText = (cleanMsg || "").toLowerCase().replace(/[^\w\s]/gi, " ").replace(/\s+/g, " ").trim();
      
      if (from.startsWith("whatsapp:") && (normCleanText === "1" || normCleanText === "1." || normCleanText === "opcion 1" || normCleanText === "ver catalogo")) {
        console.log(`[WhatsApp Menu Interceptor] Opción 1 (Catálogo) seleccionada por ${from}`);
        await sendCategoriesMenu(from, to);
        await updateDoc(doc(db, "activities", activityRef.id), {
          status: "respondido",
          response: "[Opción 1: Menú de categorías enviado]",
          respondedAt: serverTimestamp()
        });
        return res.status(200).send("");
      }

      if (from.startsWith("whatsapp:") && (normCleanText === "2" || normCleanText === "2." || normCleanText === "opcion 2" || normCleanText === "asesor" || normCleanText === "hablar con asesor" || normCleanText === "asesor humano")) {
        console.log(`[WhatsApp Menu Interceptor] Opción 2 (Asesor Humano) seleccionada por ${from}`);
        await setCustomerAiPauseState(cleanFrom, assignedStoreId, true);
        const advisorTextMsg = "¡Claro que sí! 🙌 Ya le transferí tu conversación a uno de nuestros asesores humanos. En unos minutos se contactará contigo por aquí.";
        await sendWhatsApp(from, advisorTextMsg, undefined, activityRef.id, to);

        const adminMessage = `🚨 *ASESORÍA HUMANA SOLICITADA*
Cliente: ${customerData?.name || cleanFrom} (${cleanFrom})
Mensaje: "${finalMessage}"`;
        await sendAdminAlert(adminMessage);

        await updateDoc(doc(db, "activities", activityRef.id), {
          status: "respondido",
          response: advisorTextMsg,
          respondedAt: serverTimestamp()
        });
        return res.status(200).send("");
      }

      if (from.startsWith("whatsapp:") && (normCleanText === "3" || normCleanText === "3." || normCleanText === "opcion 3" || normCleanText === "finalizar" || normCleanText === "finalizar chat")) {
        console.log(`[WhatsApp Menu Interceptor] Opción 3 (Finalizar) seleccionada por ${from}`);
        const endChatMsg = "¡Muchas gracias por contactarnos en *Jan Sel Shop*! 🌟 Si necesitas algo más en el futuro, estamos a tu orden.";
        await sendWhatsApp(from, endChatMsg, undefined, activityRef.id, to);
        await updateDoc(doc(db, "activities", activityRef.id), {
          status: "respondido",
          response: endChatMsg,
          respondedAt: serverTimestamp()
        });
        return res.status(200).send("");
      }

      // ==============================================
      // 4. GREETING / WELCOME INTERCEPTOR (DETERMINISTIC)
      // ==============================================
      const greetingPhrases = [
        "hola", "buenas", "buenos dias", "buenas tardes", "buenas noches", 
        "que tal", "alo", "buen dia", "saludos", "epale", "oe", "que mas"
      ];
      const isGreetingStart = greetingPhrases.some(w => normCleanText === w || normCleanText.startsWith(w + " ") || normCleanText.startsWith(w + ","));
      const isProductOrOrderInquiry = [
        "precio", "cuanto vale", "cuanto cuesta", "comprar", "pedido", "catalogo", "cargador", "camara", "compresor",
        "hidrolavadora", "intercomunicador", "funda", "aspiradora", "candado", "iniciador", "retrovisor", "lampara",
        "envio", "direccion", "pago", "contraentrega", "dropi"
      ].some(term => normCleanText.includes(term));

      const isGreeting = (isGreetingStart || normCleanText === "hola" || normCleanText.startsWith("hola")) && !isProductOrOrderInquiry;
      const isAwaitingHuman = customerData?.etapa === "asesoria_solicitada" || customerData?.aiPaused === true;

      if (isGreeting && from.startsWith("whatsapp:") && !isAwaitingHuman) {
        console.log(`[WhatsApp Greeting Interceptor] Greeting detected from ${from} ("${finalMessage}"). Replying deterministically...`);

        const greeting = getTimeGreeting();
        let WELCOME_MESSAGE = `${greeting} 👋 Te doy la bienvenida a *Jan Sel Shop*! 💎\n\n¿Cómo estás? Cuéntame en qué te puedo colaborar hoy o qué estás buscando de nuestro catálogo. ¡Aquí abajo te dejo unas opciones rápidas para empezar de una! 👇`;

        try {
          if (customerData?.name) {
            const firstName = String(customerData.name).split(" ")[0];
            const prevOrdersQ = query(
              collection(db, "orders"),
              where("customerPhone", "==", cleanFrom),
              orderBy("createdAt", "desc"),
              limit(1)
            );
            const prevOrdersSnap = await getDocs(prevOrdersQ);
            if (!prevOrdersSnap.empty) {
              const lastOrder = prevOrdersSnap.docs[0].data() as any;
              WELCOME_MESSAGE = `${greeting} *${firstName}*! 👋 Qué gusto verte otra vez por *Jan Sel Shop* 💎\n\n¿Cómo te fue con tu *${lastOrder.productName || "pedido anterior"}*? Cuéntame en qué te puedo colaborar hoy. 👇`;
            } else {
              WELCOME_MESSAGE = `${greeting} *${firstName}*! 👋 Te doy la bienvenida a *Jan Sel Shop*! 💎\n\n¿Cómo estás? Cuéntame en qué te puedo colaborar hoy o qué estás buscando de nuestro catálogo. ¡Aquí abajo te dejo unas opciones rápidas para empezar de una! 👇`;
            }
          } else if (customerData?.lastProductList && customerData.lastProductList.length > 0) {
            // 👀 CASO MÁS COMÚN: la persona ya navegó el catálogo antes (vio
            // productos) pero nunca llegó a dar su nombre ni a comprar. En
            // vez del saludo genérico de siempre, le recordamos justo lo que
            // vio la última vez — se siente atendida, no como si fuera la
            // primera vez que habla con nosotros.
            const lastSeenProduct = customerData.lastProductList[0];
            if (lastSeenProduct?.name) {
              WELCOME_MESSAGE = `${greeting} de nuevo! 👋 Qué bueno verte otra vez por *Jan Sel Shop* 💎\n\nLa última vez estabas mirando *${lastSeenProduct.name}* — ¿seguimos con eso, o buscas algo más hoy? Aquí abajo te dejo opciones rápidas 👇`;
            }
          }
        } catch (e) {
          console.error("[Greeting Interceptor] Error buscando historial para saludo personalizado:", e);
        }

        await sendWhatsApp(from, WELCOME_MESSAGE, undefined, activityRef.id, to);
        await new Promise(resolve => setTimeout(resolve, 1000));
        const menuButtonsSent = await sendMainMenu(from, to);

        if (!menuButtonsSent) {
          const TEXT_FALLBACK_MENU = `📌 *MENÚ PRINCIPAL DE OPCIONES:*
Responde directamente con el número de tu opción:

1️⃣ Ver Catálogo de Productos 📦
2️⃣ Hablar con un Asesor Humano 🙋‍♂️
3️⃣ Finalizar Conversación 🛑`;
          await sendWhatsApp(from, TEXT_FALLBACK_MENU, undefined, activityRef.id, to);
        }

        await updateDoc(doc(db, "activities", activityRef.id), {
          status: "respondido",
          response: WELCOME_MESSAGE,
          respondedAt: serverTimestamp()
        });
        
        await setDoc(doc(db, "customers", customerProfileId), {
          etapa: "interesado",
          lastInteractionAt: serverTimestamp()
        }, { merge: true });
        
        return res.status(200).send("");
      }

      // TRIGGER SERVER-SIDE INFERENCE IMMEDIATELY
      if (activityRefId) {
        processInferenceOnServer(activityRefId, { ...activityData, mediaItems, NumMedia: numMedia }).catch(e => {
          console.error(`[Server Inference] Fatal error during async execution:`, e.message);
        });
      }

    // 1. ACKNOWLEDGE TWILIO IMMEDIATELY
    res.status(200).send("");
  });

  app.post("/api/admin/test-notify", express.json(), async (req, res) => {
    try {
      const { storeId } = req.body;
      let storeConfig = null;
      if (storeId) {
        const snap = await getDoc(doc(db, "stores", storeId));
        if (snap.exists()) storeConfig = snap.data();
      }

      const mockOrder = {
        customerName: "Cliente de Prueba",
        productName: "Producto Demo Premium",
        quantity: 1,
        address: "Calle de las Rosas #123",
        city: "Bogotá",
        totalPrice: 159900
      };
      await notifyAdmins(mockOrder, storeConfig?.name || "Test Store", storeConfig);
      res.json({ success: true, message: "Prueba enviada a los jefes." });
    } catch (e: any) {
      res.status(500).json({ success: false, error: e.message });
    }
  });

  app.post("/api/admin/cache-media", express.json({ limit: '50mb' }), async (req, res) => {
    detectCurrentUrl(req);
    const { data, mimeType } = req.body;
    if (!data || !mimeType) return res.status(400).json({ error: "Missing data" });
    const id = Math.random().toString(36).substring(7);
    await saveMediaPersistent(id, Buffer.from(data, 'base64'), mimeType);
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


  // Media Serving Endpoint
  app.get("/api/media/:id", async (req, res) => {
    // Handle optional extensions like .mp3 or .png
    const id = req.params.id.split(".")[0];
    const media = await getMediaPersistent(id);
    if (media) {
      res.set("Content-Type", media.mimeType);
      res.send(media.data);
    } else {
      res.status(404).send("Not found");
    }
  });

  // ── INFORME EN VIVO ──────────────────────────────────────────────────────
  // Solo lectura: cuenta filas y no escribe nada. Va detrás de un token en la
  // URL y, si INFORME_TOKEN no está configurado, las rutas NI SE REGISTRAN —
  // así no queda nada expuesto por descuido. Se declara antes del catch-all
  // del SPA para que no lo capture el enrutador de React.
  const INFORME_TOKEN = String(process.env.INFORME_TOKEN || "").trim();
  if (INFORME_TOKEN.length >= 16) {
    const tokenValido = (req: any) => {
      const k = String(req.query?.k || "");
      // Comparación de longitud constante para no filtrar el token por tiempos.
      if (k.length !== INFORME_TOKEN.length) return false;
      let dif = 0;
      for (let i = 0; i < k.length; i++) dif |= k.charCodeAt(i) ^ INFORME_TOKEN.charCodeAt(i);
      return dif === 0;
    };

    app.get("/informe", (req, res) => {
      if (!tokenValido(req)) return res.status(404).send("No encontrado");
      res.setHeader("Content-Type", "text/html; charset=utf-8");
      res.setHeader("Cache-Control", "no-store");
      res.setHeader("X-Robots-Tag", "noindex, nofollow");
      res.send(paginaInforme(INFORME_TOKEN));
    });

    app.get("/api/informe", async (req, res) => {
      // Dos puertas: el token de la URL (para abrirlo suelto desde el celular)
      // o la sesión de administrador (para el apartado dentro del panel, que
      // ya viene autenticado y no debería tener que cargar el token).
      if (!tokenValido(req) && !isAdminRequestAuthorized(req)) {
        return res.status(404).json({ success: false, error: "No encontrado" });
      }
      try {
        const activa = String(process.env.REACTIVACION_AUTOMATICA || "").toLowerCase() === "true";
        // ?fresh=1 lo manda el botón "Actualizar": salta la caché de 10 minutos
        // que comparten todas las pestañas abiertas.
        const forzar = String(req.query?.fresh || "") === "1";
        const datos = await obtenerInforme(supabaseServer, activa, forzar);
        res.setHeader("Cache-Control", "no-store");
        res.json({ success: true, datos });
      } catch (e: any) {
        console.error("[Informe] Error recogiendo datos:", e?.message);
        res.status(500).json({ success: false, error: e?.message || "Error interno" });
      }
    });

    console.log("[Informe] Disponible en /informe (requiere token).");
  } else {
    console.log("[Informe] Desactivado: falta INFORME_TOKEN (mínimo 16 caracteres).");
  }

  // Servir imágenes locales desde src/assets para asegurar que siempre carguen en producción o dev
  app.use("/src/assets", express.static(path.join(process.cwd(), "src/assets")));

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
    console.log("[SERVER] Jan Vanegas Dashboard: http://localhost:3000");
  });

  /**
   * SINCRONIZACIÓN DE IMÁGENES/CATÁLOGO DESDE GOOGLE SHEETS (en vivo)
   * Corre apenas arranca el server y luego cada 90 segundos. Si no hay
   * GOOGLE_SHEETS_CATALOG_CSV_URL configurada, la función simplemente no
   * hace nada (ver syncCatalogFromSheet).
   */
  syncCatalogFromSheet();
  setInterval(() => { syncCatalogFromSheet(); }, 90 * 1000);

  /**
   * 🔄 CAMPAÑA DE REACTIVACIÓN AUTOMÁTICA
   * Corre sola cada 6 horas, sin que nadie tenga que llamar el endpoint a
   * mano. El cooldown interno de 3 días por cliente evita que se vuelva
   * spam repetitivo.
   */
  // APAGADA POR DEFECTO desde el 01/09/2026. El 1 de septiembre a las 3:36 de la
  // madrugada esta campaña mandó 44 mensajes a 41 personas ofreciendo Carplay
  // Para Moto, Cera M1 y Kit Lubristone: tres productos que ya no existen en el
  // catálogo. Llevaba meses cayéndose sola porque el template de Twilio fallaba,
  // y al arreglar ese template se destapó todo lo represado de una sola vez.
  //
  // Mandar decenas de mensajes no solicitados, de madrugada y sobre productos
  // inexistentes es la forma más rápida de que la gente bloquee o reporte el
  // número. Meta califica la calidad del número con eso y puede restringirlo, y
  // sin WhatsApp no hay por dónde cerrar ventas.
  //
  // Para volver a encenderla: REACTIVACION_AUTOMATICA=true en Railway. Antes de
  // hacerlo, revisar que los clientes tengan productos vigentes guardados.
  const reactivacionActiva = String(process.env.REACTIVACION_AUTOMATICA || "").toLowerCase() === "true";
  if (!reactivacionActiva) {
    console.log("[Reactivation Campaign] Desactivada (REACTIVACION_AUTOMATICA no es 'true'). No se enviarán mensajes automáticos.");
  } else {
    setInterval(async () => {
      try {
        // Nadie quiere publicidad a las 3 de la mañana, y un mensaje a esa hora
        // es justo el que termina en "bloquear". Solo entre 9am y 8pm Colombia.
        const horaCol = Number(new Date().toLocaleString("en-US", { timeZone: "America/Bogota", hour: "2-digit", hour12: false }));
        if (horaCol < 9 || horaCol >= 20) {
          console.log(`[Reactivation Campaign] Fuera de horario (${horaCol}h Colombia). Se omite esta corrida.`);
          return;
        }
        const result = await runReactivationCampaign("default", 12);
        if (result.sent > 0) {
          console.log(`[Reactivation Campaign] Auto-ejecutada: ${result.sent}/${result.totalCandidates} mensajes de reactivación enviados.`);
        }
      } catch (e: any) {
        console.error("[Reactivation Campaign] Error en ejecución automática:", e.message);
      }
    }, 6 * 60 * 60 * 1000);
  }

  /**
   * 📊 REPORTE SEMANAL DE DEMANDA AUTOMÁTICO
   * Revisa una vez al día si ya es lunes y si no se ha mandado el reporte
   * esta semana; si es así, le manda a Jan por WhatsApp un resumen de qué
   * productos pidió la gente que no están en el catálogo.
   */
  setInterval(async () => {
    try {
      const cfgSnap = await getDoc(doc(db, "config", "system"));
      const lastSent = cfgSnap.exists() ? cfgSnap.data()?.lastDemandReportSentAt || 0 : 0;
      const daysSinceLastSent = (Date.now() - lastSent) / (1000 * 60 * 60 * 24);
      const today = new Date();
      const isMonday = today.getDay() === 1;

      if (!isMonday || daysSinceLastSent < 6) return;

      const report = await buildDemandReport(7);
      if (report.total === 0) return;

      const top = report.grouped.slice(0, 10);
      let msg = `📊 *REPORTE SEMANAL DE DEMANDA*\n\nEsto pidieron tus clientes esta semana que NO tenemos en catálogo:\n\n`;
      top.forEach((g, i) => {
        msg += `${i + 1}. *${g.producto}* — ${g.veces} ${g.veces === 1 ? 'vez' : 'veces'}\n`;
      });
      msg += `\n💡 Considera agregar los más pedidos a tu catálogo — ya tienen demanda comprobada.`;

      await sendAdminAlert(msg);

      await setDoc(doc(db, "config", "system"), { lastDemandReportSentAt: Date.now() }, { merge: true });
      console.log("[Demand Report] Reporte semanal enviado.");
    } catch (e: any) {
      console.error("[Demand Report] Error en envío automático:", e.message);
    }
  }, 24 * 60 * 60 * 1000);



  /**
   * FOLLOW-UP ENGINE (individual per customer)
   */
  setInterval(async () => {
    if (checkGlobalQuota()) {
      return; // Skip execution if quota is broken
    }

    try {
      const nowISO = new Date().toISOString();
      const q = query(
        collection(db, "followups"),
        where("status", "==", "pending"),
        where("scheduledAt", "<=", nowISO),
        limit(5)
      );
      
      const snap = await getDocs(q);
      if (snap.empty) return;

      console.log(`[Follow-up Engine] Processing ${snap.size} due follow-ups...`);
      
      for (const docSnap of snap.docs) {
        if (checkGlobalQuota()) break;

        const fu = docSnap.data();
        const phone = fu.phone;
        
        // PRE-MARK as 'processing' to prevent infinite loops if Quota Exceeded later
        try {
          await updateDoc(docSnap.ref, { status: "processing", updatedAt: serverTimestamp() });
        } catch (e: any) {
          handleSupabaseError(e); // This will trigger global breaker
          console.error(`[Follow-up] Failed to lock doc (Quota?). Skipping ${phone}`, e.message);
          continue; 
        }

        const cleanPhone = phone.replace('whatsapp:', '');
        const formattedPhone = phone.includes(':') ? phone : `whatsapp:${phone}`;

        // 1. Verify customer status (Double check they didn't respond)
        // We do this by checking if the last activity was a 'bot' response and later than the follow-up creation
        const lastActQ = query(
          collection(db, "activities"),
          where("from", "==", formattedPhone),
          orderBy("timestamp", "desc"),
          limit(1)
        );
        const lastActSnap = await getDocs(lastActQ);
        
        let shouldExecute = true;
        
        // 1.5 Verify AI is not paused
        let convoSnap = await getDoc(doc(db, "conversations", cleanPhone));
        if (!convoSnap.exists() && cleanPhone.startsWith('+')) {
           convoSnap = await getDoc(doc(db, "conversations", cleanPhone.substring(1)));
        }
        if (!convoSnap.exists() && !cleanPhone.startsWith('+') && !isNaN(Number(cleanPhone))) {
           convoSnap = await getDoc(doc(db, "conversations", `+${cleanPhone}`));
        }

        if (convoSnap.exists() && convoSnap.data().aiPaused) {
          console.log(`[Follow-up] Skipping ${phone}: bot is paused for manual intervention.`);
          shouldExecute = false;
        }

        if (!lastActSnap.empty && shouldExecute) {
          const lastMsgAt = lastActSnap.docs[0].data().timestamp?.toMillis?.() || 0;
          const fuCreatedAt = fu.createdAt?.toMillis?.() || 0;
          if (lastMsgAt > fuCreatedAt) {
            console.log(`[Follow-up] Skipping ${phone}: Customer responded since scheduling.`);
            shouldExecute = false;
          }
        }

        if (shouldExecute) {
          // ── Cierre por inactividad ──────────────────────────────────────
          // Mensajes fijos a proposito: no pasan por la IA, asi que no pueden
          // fallar ni salir raros, y se leen cortos y claros. Si el cliente
          // respondio en el intervalo, la verificacion de arriba ya descarto
          // este followup, de modo que estos mensajes solo salen cuando de
          // verdad dejo la conversacion abierta.
          const tipoCierre = String(fu.tipo || "");
          if (tipoCierre === "cierre_aviso" || tipoCierre === "cierre_final") {
            const storeIdC = fu.storeId || "default";
            const NL = String.fromCharCode(10);
            const texto = tipoCierre === "cierre_aviso"
              ? [
                  "¿Sigues por ahí? 👀",
                  "",
                  `Si no me escribes en ${INACTIVIDAD_CIERRE_MIN} minutos voy a cerrar esta conversación, pero no te preocupes: puedes escribirme cuando quieras y seguimos donde la dejamos.`,
                  "",
                  "¿Te quedó alguna duda o te ayudo con tu pedido? 🙌"
                ].join(NL)
              : [
                  "Cierro por ahora para no seguir molestándote 😊",
                  "",
                  "Cuando quieras retomar solo escríbeme y seguimos. Aquí estaré.",
                  "",
                  "¡Que tengas un buen día! 🚀"
                ].join(NL);
            try {
              await sendWhatsApp(formattedPhone, texto);
              await addDoc(collection(db, "activities"), {
                from: normalizePhone(TWILIO_FROM_NUMBER || ""),
                to: formattedPhone,
                customerPhone: cleanPhone,
                storeId: storeIdC,
                message: tipoCierre === "cierre_aviso" ? "[Aviso de cierre por inactividad]" : "[Conversación cerrada por inactividad]",
                status: "respondido",
                senderType: "bot",
                timestamp: serverTimestamp()
              });
              if (tipoCierre === "cierre_aviso") {
                // Se le da el margen prometido antes de despedirse.
                await scheduleInactivityClose(cleanPhone, storeIdC, "cierre_final");
              }
              console.log(`[Cierre] ${tipoCierre} enviado a ${cleanPhone}`);
            } catch (e: any) {
              console.error(`[Cierre] Error enviando ${tipoCierre} a ${cleanPhone}:`, e?.message);
            }
            await updateDoc(docSnap.ref, { status: "completed", updatedAt: serverTimestamp() });
            continue;
          }

          const storeId = fu.storeId || "default";

          let storeConfig: any = {};
          const storeSnap = await getDoc(doc(db, "stores", storeId));
          if (storeSnap.exists()) {
            storeConfig = storeSnap.data();
          }
          const tone = storeConfig.botTone || "carismático y respetuoso";
          const botName = storeConfig.botName || "Jan";
          const botGoal = storeConfig.botGoal || "reactivar ventas";

          // 2. Generate nudge with IA
          const customerProfileId = customerDocId(storeId, cleanPhone);
          const cxSnap = await getDoc(doc(db, "customers", customerProfileId));
          const profile = cxSnap.exists() ? cxSnap.data() : null;
          const history = await getCrmContext(formattedPhone, storeId);
          
          const isSupport = botGoal.toLowerCase().includes("soporte") || botGoal.toLowerCase().includes("support") || storeConfig.name?.toLowerCase().includes("soporte");

          const prompt = `CLIENTE: ${phone}
ESTADO: ${profile?.etapa || "interesado"}
SCORE: ${profile?.score || 0}
INTENCION: ${fu.reason}
HISTORIAL RECIENTE:
${history}

TAREA: Actúa como ${botName}. El cliente dejó de responder hace unos minutos. Escribe un mensaje MUY CORTO con tono ${tone} para ${botGoal}.
${isSupport 
  ? "Ayúdalo a completar su proceso técnico o resolver su duda pendiente. No intentes vender nada físico si es soporte." 
  : "Integra gatillos mentales de ESCASEZ (pocas unidades disponibles) o BENEFICIO (recordando el envío gratis y el pago contra entrega hoy)."}
Mantenlo respetuoso. Si es mujer, usa un trato amable sin ser informal de más. 
Máximo 18 palabras.
NO RESPONDAS EN JSON, RESPONDE SOLO EL TEXTO DEL MENSAJE.`;

          let nudgeMsg = "";
          let nudgeSuccess = false;

          // Try Llama first
          try {
            const currentNvidiaKey = process.env.NVIDIA_API_KEY || storeConfig.nvidiaApiKey;
            if (!currentNvidiaKey) throw new Error("No NVIDIA API Key");
            
            const response = await axios.post(
              "https://integrate.api.nvidia.com/v1/chat/completions",
              {
                model: "meta/llama-3.1-8b-instruct",
                messages: [{ role: "user", content: prompt }],
                temperature: 0.2,
                max_tokens: 100
              },
              {
                headers: {
                  "Authorization": `Bearer ${currentNvidiaKey}`,
                  "Content-Type": "application/json"
                },
                timeout: 5000
              }
            );
            nudgeMsg = response.data?.choices?.[0]?.message?.content?.trim() || "";
            if (nudgeMsg) {
              nudgeSuccess = true;
            }
          } catch (llamaErr: any) {
            console.warn(`[Follow-up] NVIDIA Llama 3.1 8B falló para el nudge. Error: ${llamaErr.message}`);
            
            const currentNvidiaKey = process.env.NVIDIA_API_KEY || storeConfig.nvidiaApiKey;
            if (currentNvidiaKey) {
              try {
                const response = await axios.post(
                  "https://integrate.api.nvidia.com/v1/chat/completions",
                  {
                    model: "meta/llama-3.3-70b-instruct",
                    messages: [
                      { role: "system", content: "Eres un asistente de seguimiento amable. Máximo 18 palabras. Escribe en español." },
                      { role: "user", content: prompt }
                    ],
                    temperature: 0.5,
                    max_tokens: 150
                  },
                  {
                    headers: {
                      "Authorization": `Bearer ${currentNvidiaKey}`,
                      "Content-Type": "application/json"
                    },
                    timeout: 6000
                  }
                );
                nudgeMsg = (response.data?.choices?.[0]?.message?.content || "").trim();
                if (nudgeMsg) {
                  nudgeSuccess = true;
                  console.log(`[Follow-up] Fallback exitoso con NVIDIA Llama 3.3 para el nudge.`);
                }
              } catch (nvidiaErr: any) {
                console.error(`[Follow-up] Fallback con NVIDIA también falló para el nudge. Error: ${nvidiaErr.message}`);
              }
            }
          }

          if (!nudgeSuccess || !nudgeMsg) {
            nudgeMsg = "¡Hola! Sigues ahí? Cuéntame si tienes alguna duda con tu pedido, con gusto te ayudo.";
          }

          console.log(`[Follow-up] Sending nudge to ${phone}: ${nudgeMsg}`);
          
          // 3. Send — si el cliente quedó a mitad de un checkout, mandamos un
          // botón directo para retomar exactamente donde quedó, en vez de
          // solo un mensaje de texto que lo obligue a escribir de nuevo.
          if (profile?.checkoutStep && profile.checkoutStep !== "confirmacion") {
            const productoTexto = profile?.checkoutData?.producto || "tu pedido";
            const buttonsSent = await sendResumeCheckoutButtons(formattedPhone, TWILIO_FROM_NUMBER || "whatsapp:+14155238886", productoTexto);
            if (!buttonsSent) {
              await sendWhatsApp(formattedPhone, `¡Hola de nuevo! 👋 Quedaste a mitad de registrar *${productoTexto}*. Escribe *continuar* para seguir donde quedamos. 🛒`);
            }
          } else {
            await sendWhatsApp(formattedPhone, nudgeMsg);
          }
          
          // 4. Log as activity
          await addDoc(collection(db, "activities"), {
            from: TWILIO_FROM_NUMBER || "whatsapp:+14155238886",
            to: formattedPhone,
            recipient: formattedPhone,
            message: "[Seguimiento Automático]",
            response: nudgeMsg,
            status: "respondido",
            whatsappStatus: "sent",
            senderType: 'bot',
            storeId: storeId,
            timestamp: serverTimestamp(),
            customerPhone: cleanPhone
          });
        }

        // 5. Mark as executed (or cancelled if logic above decided)
        await updateDoc(docSnap.ref, { 
          status: shouldExecute ? "executed" : "cancelled", 
          executedAt: serverTimestamp(),
          updatedAt: serverTimestamp() 
        });
      }
    } catch (e) {
      console.error("[Follow-up Engine] Error:", e);
    }
  }, 60000); // Check every minute

  // ==============================================
  // 🚚 BACKGROUND TRACKING SCANNER ENGINE
  // ==============================================
  let trackingCheckInterval: NodeJS.Timeout | null = null;

  function startBackgroundTrackingChecker() {
    if (trackingCheckInterval) return;
    
    console.log("[Tracking System] Starting background tracking status checker (every 10 minutes)...");
    
    // Run check every 10 minutes
    trackingCheckInterval = setInterval(async () => {
      try {
        console.log("[Tracking System] Checking active orders with tracking links...");
        const dbRef = db;
        
        // Fetch all active orders
        const q = query(collection(dbRef, "orders"));
        const snapshot = await getDocs(q);
        
        const now = Date.now();
        const fifteenDaysMs = 15 * 24 * 60 * 60 * 1000;
        
        for (const orderDoc of snapshot.docs) {
          const order = orderDoc.data();
          const orderId = orderDoc.id;
          
          // Skip if no trackingUrl, already entregado / cancelled, or if monitoring is paused
          if (!order.trackingUrl || order.trackingStatus === "entregado" || order.status === "entregado" || order.trackingPaused === true) {
            continue;
          }
          
          // Skip orders older than 15 days to save resources
          const createdAt = order.createdAt ? (order.createdAt.seconds * 1000 || order.createdAt) : now;
          if (now - createdAt > fifteenDaysMs) {
            continue;
          }
          
          // Throttle check: only analyze every 30 minutes in background per order
          const lastChecked = order.lastTrackedAt || 0;
          if (now - lastChecked < 30 * 60 * 1000) {
            continue;
          }
          
          console.log(`[Tracking System] Scanning order ${orderId} (${order.customerName}) tracking page: ${order.trackingUrl}`);
          const result = await analyzeTrackingUrl(order.trackingUrl);
          
          const previousStatus = order.trackingStatus || "preparacion";
          
          // Update database with latest scan info
          const updateData: any = {
            lastTrackedAt: now,
            trackingComment: result.comment,
            trackingCarrier: result.carrier,
            trackingGuide: result.guide || order.trackingGuide || "No detectada"
          };
          
          if (result.status !== previousStatus) {
            console.log(`[Tracking System] Order ${orderId} changed state: ${previousStatus} -> ${result.status}`);
            updateData.trackingStatus = result.status;
            
            // Add tracking history event
            const history = Array.isArray(order.trackingHistory) ? [...order.trackingHistory] : [];
            history.push({
              status: result.status,
              comment: result.comment,
              timestamp: now
            });
            updateData.trackingHistory = history;
            
            // Also sync with the standard order status if appropriate
            if (result.status === "entregado") {
              updateData.status = "entregado";
            } else if (result.status === "en_ruta") {
              updateData.status = "despachado";
            }
            
            // Send WhatsApp Notification to the customer!
            try {
              const finalPhone = normalizePhone(order.customerPhone);
              const botNum = process.env.TWILIO_FROM_NUMBER || "+14155238886";
              const formattedBotNum = botNum.startsWith("whatsapp:") ? botNum : `whatsapp:${botNum}`;
              let notificationText = "";
              
              if (result.status === "en_ruta") {
                notificationText = `📦 *¡Tu pedido de Jansel Shop está en camino!* 🚚💨\n\nHola *${order.customerName}*, te traemos excelentes noticias. Tu pedido de *${order.productName}* ya ha sido entregado a la transportadora (*${result.carrier}*) y se encuentra *En Ruta* de entrega.\n\n📍 Sigue el recorrido oficial aquí en tiempo real: ${order.trackingUrl}\n\nRecuerda tener listo el dinero en efectivo ($${(order.totalPrice || 0).toLocaleString()} COP) para tu Pago Contra Entrega. ¡Muchas gracias por tu compra! ✨`;
              } else if (result.status === "entregado") {
                notificationText = `🎉 *¡Tu pedido ha sido entregado con éxito!* 🥳\n\nHola *${order.customerName}*, confirmamos que tu pedido de *${order.productName}* ya fue entregado el día de hoy.\n\nQueremos darte las gracias por confiar en Jansel Shop. Esperamos que disfrutes al máximo de tu producto. ❤️\n\n¿Cómo estuvo tu experiencia? Si nos dejas un comentario por aquí, ¡nos ayudaría muchísimo! 🙏`;
              } else if (result.status === "novedad") {
                notificationText = `⚠️ *Actualización importante sobre tu entrega* 🚚\n\nHola *${order.customerName}*, la transportadora (*${result.carrier}*) nos reporta una *Novedad* con la entrega de tu pedido de *${order.productName}* (ej: dirección incompleta o no se encontraba nadie en casa).\n\n🔗 Puedes ver el detalle oficial de la transportadora aquí: ${order.trackingUrl}\n\nNo te preocupes, ¡queremos ayudarte a solucionarlo hoy mismo! Cuéntanos por este chat qué pasó o indícanos si quieres que reprogramemos la entrega para que no se devuelva tu paquete. ¡Quedamos muy atentos! 📲`;
              }
              
              if (notificationText) {
                await sendWhatsApp(finalPhone, notificationText, undefined, undefined, formattedBotNum);
                console.log(`[Tracking System] Notified customer ${finalPhone} about state change: ${result.status}`);
              }
            } catch (notifErr: any) {
              console.error(`[Tracking System] Failed to send WhatsApp update for order ${orderId}: ${notifErr.message}`);
            }
          }
          
          await updateDoc(doc(dbRef, "orders", orderId), updateData);
        }

        // ==============================================
        // 🛍️ AUTOMATIC POST-PURCHASE AI UPSELL CHECKER
        // ==============================================
        console.log("[AI Upsell System] Checking delivered orders for automatic post-purchase recommendations...");
        for (const orderDoc of snapshot.docs) {
          const order = orderDoc.data();
          const orderId = orderDoc.id;

          // Only process orders that are delivered ('entregado')
          if (order.status !== "entregado" && order.trackingStatus !== "entregado") {
            continue;
          }

          // Skip if already sent or if upsell is paused/ignored
          if (order.upsellSent === true || order.upsellPaused === true) {
            continue;
          }

          // Trigger condition: Delivered at least 7 days ago.
          // To make it friendly for testing, we also support "triggerUpsellImmediately" flag
          const deliveredAt = order.lastTrackedAt || order.createdAt || now;
          const ageInDays = (now - deliveredAt) / (24 * 60 * 60 * 1000);

          // We'll auto-trigger if it has been 7 days, OR if they have manual test flags
          if (ageInDays >= 7 || order.triggerUpsellImmediately === true) {
            console.log(`[AI Upsell System] Order ${orderId} (${order.customerName}) is eligible for auto-upsell (Age: ${ageInDays.toFixed(2)} days). Triggering AI...`);
            
            try {
              // 1. Fetch other customer orders
              const normalizedPhone = order.customerPhone ? order.customerPhone.trim() : "";
              let customerOrders: any[] = [];
              if (normalizedPhone) {
                const qHistory = query(collection(dbRef, "orders"), where("customerPhone", "==", normalizedPhone));
                const historySnap = await getDocs(qHistory);
                historySnap.forEach((d: any) => {
                  if (d.id !== orderId) customerOrders.push({ id: d.id, ...d.data() });
                });
              }

              // 2. Fetch products
              let prodSnap = await getDocs(collection(dbRef, "products"));
              const productsList: any[] = [];
              prodSnap.forEach((d: any) => {
                productsList.push({ id: d.id, ...d.data() });
              });

              // 3. Generate suggestion
              const result = await generatePostPurchaseUpsell(order, customerOrders, productsList);

              // 4. Send via Twilio/WhatsApp automatically!
              const finalPhone = normalizePhone(order.customerPhone);
              const botNum = process.env.TWILIO_FROM_NUMBER || "+14155238886";
              const formattedBotNum = botNum.startsWith("whatsapp:") ? botNum : `whatsapp:${botNum}`;

              console.log(`[AI Upsell System] AUTO-SENDING WhatsApp cross-sell to ${order.customerName} (${finalPhone}): ${result.recommendedProductName}`);
              
              let sendSucceeded = true;
              if (process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && !process.env.TWILIO_ACCOUNT_SID.startsWith("ACmock")) {
                sendSucceeded = await sendUpsellOfferButtons(finalPhone, formattedBotNum, result.suggestedMessage);
              }

              // Record activity history
              await addDoc(collection(dbRef, "activities"), {
                from: formattedBotNum,
                to: `+${finalPhone}`,
                message: result.suggestedMessage,
                status: "respondido",
                whatsappStatus: sendSucceeded ? "sent" : "failed",
                manualAgent: "AI Post-Purchase Automatic Followup",
                createdAt: serverTimestamp(),
                storeId: order.storeId || ""
              });

              // Save into Firestore
              await updateDoc(doc(dbRef, "orders", orderId), {
                upsellProfile: result.customerProfile,
                upsellRecommendedProductId: result.recommendedProductId,
                upsellRecommendedProductName: result.recommendedProductName,
                upsellSuggestedMsg: result.suggestedMessage,
                upsellReasoning: result.reasoning,
                upsellSent: true,
                upsellSentAt: Date.now(),
                upsellStatus: sendSucceeded ? "enviado" : "error_envio",
                triggerUpsellImmediately: false
              });

            } catch (upsellErr: any) {
              console.error(`[AI Upsell System] Failed automatic upsell for order ${orderId}:`, upsellErr.message);
            }
          }
        }
      } catch (err: any) {
        console.error("[Tracking System] Error in background scanner interval:", err.message);
      }
    }, 10 * 60 * 1000); // 10 minutes
  }

  // Launch background tracking scanner
  startBackgroundTrackingChecker();

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
