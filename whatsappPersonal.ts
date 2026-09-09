// ============================================================================
//  MÓDULO AISLADO — "Espía" de WhatsApp personal vía Baileys (WhatsApp Web)
// ----------------------------------------------------------------------------
//  Objetivo: conectar un WhatsApp PERSONAL por QR (como WhatsApp Web) y CAPTURAR
//  los pedidos de clientes que llegan por anuncio, guardándolos en la app —
//  SIN tocar ni depender del bot de Twilio.
//
//  Reglas de riesgo mínimo (para no exponer el número a baneos):
//   - SOLO LEE. Nunca envía mensajes ni marca "leído" ni aparece "en línea".
//   - Ignora el historial viejo (syncFullHistory:false) — solo mensajes NUEVOS.
//   - Suelta los chats personales: si un chat no habla de productos, deja de
//     procesarlo. Solo sigue los que preguntan por productos / vienen del anuncio.
//
//  Aislamiento: Baileys se carga con import() dinámico DENTRO de start(), así
//  que si la librería falla, el resto del servidor sigue intacto. Todo va en
//  try/catch. Este archivo no importa nada de la lógica del bot de Twilio.
// ============================================================================

import axios from "axios";
import { createClient } from "@supabase/supabase-js";
import QRCode from "qrcode";

// ── Supabase propio (mismo proyecto, cliente independiente) ─────────────────
let SB_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "";
if (SB_URL.endsWith("/rest/v1/")) SB_URL = SB_URL.replace("/rest/v1/", "");
else if (SB_URL.endsWith("/rest/v1")) SB_URL = SB_URL.replace("/rest/v1", "");
const SB_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || "";
const sb = (SB_URL && SB_KEY) ? createClient(SB_URL, SB_KEY, { auth: { persistSession: false } }) : null;

// ── Estado en memoria (para el endpoint de status/QR) ───────────────────────
type WaStatus = {
  enabled: boolean;
  connecting: boolean;
  connected: boolean;
  qr: string | null;          // data URL del QR (para pintarlo en la app)
  phone: string | null;       // número conectado
  lastConnectedAt: number | null;
  lastError: string | null;
  capturados: number;         // pedidos capturados en esta sesión
};
const status: WaStatus = {
  enabled: false, connecting: false, connected: false,
  qr: null, phone: null, lastConnectedAt: null, lastError: null, capturados: 0,
};

let sock: any = null;
let starting = false;
let reconnectDelay = 3000;
const MAX_RECONNECT_DELAY = 60000;

// Estado por chat: "tracked" (sigue pedidos) | "ignored" (personal, se suelta)
type ChatState = { estado: "nuevo" | "tracked" | "ignored"; strikes: number; textos: string[]; pedidoGuardado: boolean; ultimoExtract: number };
const chats = new Map<string, ChatState>();

// ── Detección de interés en producto (mismo espíritu que el bot) ────────────
const PRODUCT_HINTS = [
  "me interesa", "vi en su anuncio", "vi el anuncio", "anuncio", "cuanto vale",
  "cuanto cuesta", "precio", "producto", "comprar", "pedido", "quiero", "lo quiero",
  "cargador", "aromatizante", "game stick", "gamestick", "domicilio", "envio",
  "contraentrega", "disponible", "pedir",
];
function pareceProducto(texto: string): boolean {
  const t = (texto || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
  return PRODUCT_HINTS.some((k) => t.includes(k));
}

function soloTexto(msg: any): string {
  try {
    const m = msg.message || {};
    return (
      m.conversation ||
      m.extendedTextMessage?.text ||
      m.imageMessage?.caption ||
      m.videoMessage?.caption ||
      m.buttonsResponseMessage?.selectedDisplayText ||
      m.listResponseMessage?.title ||
      ""
    );
  } catch { return ""; }
}

// ── IA: extraer un pedido de la conversación (cascada igual que el bot) ──────
async function extraerPedidoIA(conversacion: string): Promise<any | null> {
  const apiKey = process.env.OPENROUTER_API_KEY || process.env.NVIDIA_API_KEY || process.env.GEMINI_API_KEY;
  if (!apiKey) return null;
  const system = "Eres un extractor de pedidos. Te paso una conversación de WhatsApp de una tienda colombiana (contraentrega). Devuelve SOLO JSON.";
  const prompt = `Analiza esta conversación y dime si el cliente YA dejó un pedido con datos suficientes para despachar (nombre, ciudad y dirección como mínimo).

Conversación:
${conversacion}

Devuelve JSON EXACTO:
{"pedido_completo": true/false, "producto": "", "nombre": "", "telefono": "", "ciudad": "", "direccion": "", "referencia": "", "cantidad": 1, "valor": 0}
Si falta nombre, ciudad o dirección, pedido_completo=false. No inventes datos que no estén en la conversación.`;
  try {
    let txt = "";
    if (process.env.OPENROUTER_API_KEY) {
      const r = await axios.post("https://openrouter.ai/api/v1/chat/completions", {
        model: "google/gemini-2.5-flash",
        messages: [{ role: "system", content: system }, { role: "user", content: prompt }],
        temperature: 0.1, response_format: { type: "json_object" },
      }, { headers: { Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`, "Content-Type": "application/json" }, timeout: 15000 });
      txt = r.data.choices[0].message.content;
    } else if (process.env.GEMINI_API_KEY) {
      const r = await axios.post(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`, {
        contents: [{ role: "user", parts: [{ text: `${system}\n\n${prompt}` }] }],
        generationConfig: { responseMimeType: "application/json", temperature: 0.1 },
      }, { headers: { "Content-Type": "application/json" }, timeout: 15000 });
      txt = r.data.candidates[0].content.parts[0].text;
    } else return null;
    const limpio = String(txt).replace(/```json/gi, "").replace(/```/g, "").trim();
    return JSON.parse(limpio);
  } catch (e: any) {
    console.warn("[WA Personal] IA extract falló (no crítico):", e?.message);
    return null;
  }
}

// ── Guardar mensaje capturado (para la división de reportes) ────────────────
async function guardarMensaje(chatId: string, telefono: string, texto: string): Promise<void> {
  if (!sb) return;
  try {
    const id = "pm_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
    await sb.from("personal_wa_messages").upsert({
      id,
      data: { chatId, telefono, texto, canal: "personal", createdAt: new Date().toISOString() },
      updatedAt: new Date().toISOString(),
    });
  } catch (e: any) {
    console.warn("[WA Personal] No se pudo guardar mensaje (no crítico):", e?.message);
  }
}

// ── Guardar pedido capturado en la tabla orders (etiquetado como personal) ──
async function guardarPedido(telefono: string, pedido: any): Promise<void> {
  if (!sb) return;
  try {
    const id = "wapp_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
    await sb.from("orders").upsert({
      id,
      data: {
        id,
        storeId: "default",
        canal: "personal",                 // de qué WhatsApp vino
        origin: "whatsapp_personal",
        botNumber: status.phone || "personal",
        needsReview: true,                  // capturado por IA: revisar antes de despachar
        productName: pedido.producto || "Por confirmar",
        productId: "manual",
        quantity: Number(pedido.cantidad) || 1,
        totalPrice: Number(pedido.valor) || 0,
        customerName: pedido.nombre || "Por confirmar",
        customerPhone: pedido.telefono || telefono,
        city: pedido.ciudad || "Por confirmar",
        address: pedido.direccion || "Por confirmar",
        addressIndicator: pedido.referencia || "",
        status: "pendiente",
        shopifyStatus: "no_enviado",
        dropiStatus: "no_enviado",
        createdAt: new Date().toISOString(),
      },
      updatedAt: new Date().toISOString(),
    });
    status.capturados++;
    console.log(`[WA Personal] 🛒 Pedido capturado y guardado (${id}) de ${telefono}`);
  } catch (e: any) {
    console.warn("[WA Personal] No se pudo guardar pedido (no crítico):", e?.message);
  }
}

// ── Manejo de mensajes entrantes (solo NUEVOS, solo directos) ───────────────
async function onMessages(ev: any): Promise<void> {
  try {
    if (!ev || ev.type !== "notify") return;       // solo mensajes nuevos
    for (const msg of ev.messages || []) {
      try {
        if (!msg?.key) continue;
        if (msg.key.fromMe) continue;               // ignora lo que YO escribo
        const jid: string = msg.key.remoteJid || "";
        if (!jid || jid.endsWith("@g.us") || jid === "status@broadcast") continue; // sin grupos ni estados
        if (!jid.endsWith("@s.whatsapp.net")) continue;

        const telefono = jid.split("@")[0];
        const texto = soloTexto(msg).trim();
        if (!texto) continue;

        let cs = chats.get(jid);
        if (!cs) { cs = { estado: "nuevo", strikes: 0, textos: [], pedidoGuardado: false, ultimoExtract: 0 }; chats.set(jid, cs); }

        if (cs.estado === "ignored") continue;      // chat personal: ya se soltó

        const esProducto = pareceProducto(texto);

        if (cs.estado === "nuevo") {
          if (esProducto) {
            cs.estado = "tracked";
          } else {
            cs.strikes++;
            // Si a los 2 mensajes no menciona nada de productos, es personal → soltar.
            if (cs.strikes >= 2) cs.estado = "ignored";
            continue;
          }
        }

        // A partir de aquí el chat es "tracked": capturamos.
        cs.textos.push(`Cliente: ${texto}`);
        if (cs.textos.length > 25) cs.textos = cs.textos.slice(-25);
        await guardarMensaje(jid, telefono, texto);

        // Intento de extraer pedido: solo si parece que ya hay datos (dirección/ciudad)
        // y como máximo cada 25s por chat, para no gastar IA de más.
        const ahora = Date.now();
        const pareceDatos = /(calle|carrera|cra|diagonal|transversal|manzana|barrio|vereda|municipio|ciudad|direccion|casa|apto|apartamento|kilometro|km|#|numero)/i.test(texto);
        if (!cs.pedidoGuardado && pareceDatos && cs.textos.length >= 3 && (ahora - cs.ultimoExtract) > 25000) {
          cs.ultimoExtract = ahora;
          const pedido = await extraerPedidoIA(cs.textos.join("\n"));
          if (pedido && pedido.pedido_completo) {
            cs.pedidoGuardado = true;
            await guardarPedido(telefono, pedido);
          }
        }
      } catch (e: any) {
        console.warn("[WA Personal] Error procesando un mensaje (ignorado):", e?.message);
      }
    }
  } catch (e: any) {
    console.warn("[WA Personal] Error en onMessages (ignorado):", e?.message);
  }
}

// ── Auth state persistido en Supabase (tabla wa_personal_auth) ──────────────
async function useSupabaseAuthState(baileys: any) {
  const { initAuthCreds, BufferJSON, proto } = baileys;
  const writeData = async (id: string, value: any) => {
    if (!sb) return;
    await sb.from("wa_personal_auth").upsert({ id, data: JSON.stringify(value, BufferJSON.replacer), updated_at: new Date().toISOString() });
  };
  const readData = async (id: string): Promise<any | null> => {
    if (!sb) return null;
    const { data, error } = await sb.from("wa_personal_auth").select("data").eq("id", id).maybeSingle();
    if (error || !data) return null;
    try { return JSON.parse(typeof data.data === "string" ? data.data : JSON.stringify(data.data), BufferJSON.reviver); } catch { return null; }
  };
  const removeData = async (id: string) => { if (sb) await sb.from("wa_personal_auth").delete().eq("id", id); };

  const creds = (await readData("creds")) || initAuthCreds();
  return {
    clearAll: async () => {
      if (sb) { try { await sb.from("wa_personal_auth").delete().neq("id", "___none___"); } catch {} }
    },
    state: {
      creds,
      keys: {
        get: async (type: string, ids: string[]) => {
          const out: Record<string, any> = {};
          for (const id of ids) {
            let val = await readData(`${type}-${id}`);
            if (type === "app-state-sync-key" && val) { try { val = proto.Message.AppStateSyncKeyData.fromObject(val); } catch {} }
            out[id] = val;
          }
          return out;
        },
        set: async (data: any) => {
          for (const type in data) {
            for (const id in data[type]) {
              const val = data[type][id];
              const key = `${type}-${id}`;
              if (val) await writeData(key, val); else await removeData(key);
            }
          }
        },
      },
    },
    saveCreds: async () => { await writeData("creds", creds); },
  };
}

// ── Arranque de la conexión ─────────────────────────────────────────────────
export async function startPersonalWhatsApp(): Promise<void> {
  if (starting || status.connected) return;
  if (!sb) { console.warn("[WA Personal] Sin Supabase configurado; módulo inactivo."); return; }
  starting = true;
  status.enabled = true;
  status.connecting = true;
  status.lastError = null;
  try {
    const baileys: any = await import("@whiskeysockets/baileys");
    const makeWASocket = baileys.default || baileys.makeWASocket;
    const { DisconnectReason, fetchLatestBaileysVersion, makeCacheableSignalKeyStore } = baileys;

    // logger silencioso (Baileys pide uno tipo pino)
    const silent: any = { level: "silent", child: () => silent, trace() {}, debug() {}, info() {}, warn() {}, error() {}, fatal() {} };

    const { state, saveCreds, clearAll } = await useSupabaseAuthState(baileys);
    (startPersonalWhatsApp as any)._clearAll = clearAll;

    let version: any = undefined;
    try { const v = await fetchLatestBaileysVersion(); version = v.version; } catch {}

    sock = makeWASocket({
      version,
      auth: { creds: state.creds, keys: makeCacheableSignalKeyStore(state.keys, silent) },
      logger: silent,
      printQRInTerminal: false,
      syncFullHistory: false,        // 🔒 NO trae historial viejo
      markOnlineOnConnect: false,    // 🔒 no aparece "en línea"
      browser: ["Jansel App", "Chrome", "1.0"],
      getMessage: async () => undefined,
    });

    sock.ev.on("creds.update", async () => { try { await saveCreds(); } catch (e: any) { console.warn("[WA Personal] saveCreds:", e?.message); } });

    sock.ev.on("connection.update", async (u: any) => {
      try {
        const { connection, lastDisconnect, qr } = u;
        if (qr) {
          try { status.qr = await QRCode.toDataURL(qr); } catch { status.qr = null; }
          status.connecting = true;
          console.log("[WA Personal] QR generado — escanéalo desde la app.");
        }
        if (connection === "open") {
          status.connected = true;
          status.connecting = false;
          status.qr = null;
          status.lastConnectedAt = Date.now();
          reconnectDelay = 3000;
          try { status.phone = (sock?.user?.id || "").split(":")[0].split("@")[0] || null; } catch {}
          console.log(`[WA Personal] ✅ Conectado como ${status.phone || "?"}`);
        }
        if (connection === "close") {
          status.connected = false;
          const code = lastDisconnect?.error?.output?.statusCode;
          const loggedOut = code === DisconnectReason.loggedOut;
          status.lastError = loggedOut ? "Sesión cerrada (re-escanea el QR)" : `Desconectado (${code || "?"})`;
          console.warn(`[WA Personal] Conexión cerrada. loggedOut=${loggedOut} code=${code}`);
          sock = null;
          starting = false;
          if (loggedOut) {
            status.qr = null;
            try { await clearAll(); } catch {}
            // No reconecta solo: hay que re-escanear desde la app.
          } else {
            // Reconexión con backoff acotado.
            const d = reconnectDelay;
            reconnectDelay = Math.min(reconnectDelay * 2, MAX_RECONNECT_DELAY);
            setTimeout(() => { startPersonalWhatsApp().catch(() => {}); }, d);
          }
        }
      } catch (e: any) {
        console.warn("[WA Personal] connection.update error (ignorado):", e?.message);
      }
    });

    sock.ev.on("messages.upsert", onMessages);

    starting = false;
  } catch (e: any) {
    starting = false;
    status.connecting = false;
    status.lastError = e?.message || "Error al iniciar";
    console.warn("[WA Personal] No se pudo iniciar (el resto del server sigue normal):", e?.message);
  }
}

export function getPersonalWaStatus(): WaStatus {
  return { ...status };
}

export async function logoutPersonalWa(): Promise<void> {
  try { if (sock) await sock.logout().catch(() => {}); } catch {}
  try { const clearAll = (startPersonalWhatsApp as any)._clearAll; if (clearAll) await clearAll(); } catch {}
  sock = null;
  chats.clear();
  status.connected = false;
  status.connecting = false;
  status.qr = null;
  status.phone = null;
  status.lastError = null;
  // Reinicia para volver a generar QR.
  setTimeout(() => { startPersonalWhatsApp().catch(() => {}); }, 1500);
}
