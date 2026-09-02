// Píxel de Meta y TikTok, compartido por TODAS las rutas.
//
// Antes el píxel se inicializaba dentro de LandingPage.tsx, así que solo existía
// en /landing. En /producto/:id no cargaba nada: ni PageView, ni ViewContent, ni
// Contact cuando el cliente tocaba el botón de WhatsApp. Y esa es justamente la
// página a la que apuntan los anuncios, o sea que Meta no recibía ninguna señal
// del tráfico por el que se está pagando.
//
// Aquí vive el arranque, con guarda de idempotencia para que PageView se dispare
// una sola vez por carga aunque se llame desde varios sitios.

let arranqueIniciado = false;
let idMetaCargado = "";
let idTiktokCargado = "";

function getCookie(name: string): string {
  const match = document.cookie.match(new RegExp("(^| )" + name + "=([^;]+)"));
  return match ? decodeURIComponent(match[2]) : "";
}

export function getFbp(): string {
  return getCookie("_fbp");
}

// fbc: si ya existe la cookie _fbc se usa; si no, y hay fbclid en la URL, se
// construye con el formato que exige Meta: fb.1.<timestamp>.<fbclid>
export function getFbc(): string {
  const existing = getCookie("_fbc");
  if (existing) return existing;
  const fbclid = new URLSearchParams(window.location.search).get("fbclid");
  return fbclid ? `fb.1.${Date.now()}.${fbclid}` : "";
}

// ── QUIÉN Y DE DÓNDE ────────────────────────────────────────────────────────
// Hasta ahora cada evento se guardaba suelto, sin nada que lo conectara con los
// demás: se podía contar "3 se fueron en ciudad" pero no reconstruir el
// recorrido de una persona. Este identificador es ANÓNIMO — un código al azar
// en el navegador, sin nombre, correo ni teléfono. Solo sirve para enlazar los
// pasos de una misma visita.
const CLAVE_VISITANTE = "jan_sel_visitante";
const CLAVE_ORIGEN = "jan_sel_origen";

export function idVisitante(): string {
  try {
    let id = localStorage.getItem(CLAVE_VISITANTE);
    if (!id) {
      id = "v_" + Math.random().toString(36).slice(2, 8) + Date.now().toString(36).slice(-4);
      localStorage.setItem(CLAVE_VISITANTE, id);
    }
    return id;
  } catch {
    return "";
  }
}

// De dónde llegó. Se calcula UNA vez por sesión y se conserva: si no, al
// navegar dentro del sitio el origen pasaría a ser la página anterior y todo
// el tráfico acabaría pareciendo "directo".
export function origenVisita(): string {
  try {
    const guardado = sessionStorage.getItem(CLAVE_ORIGEN);
    if (guardado) return guardado;

    const q = new URLSearchParams(window.location.search);
    let origen = "";
    if (q.get("fbclid")) origen = "Anuncio de Meta";
    else if (q.get("utm_source")) origen = `${q.get("utm_source")}${q.get("utm_campaign") ? " · " + q.get("utm_campaign") : ""}`;
    else {
      const ref = document.referrer || "";
      if (!ref) origen = "Directo";
      else {
        const host = (() => { try { return new URL(ref).hostname.replace(/^www\./, ""); } catch { return ""; } })();
        if (!host || host.includes(window.location.hostname)) origen = "Directo";
        else if (/facebook|instagram|fb\.com/.test(host)) origen = "Meta (orgánico)";
        else if (/whatsapp|wa\.me/.test(host)) origen = "WhatsApp";
        else if (/google|bing/.test(host)) origen = "Buscador";
        else origen = host;
      }
    }
    sessionStorage.setItem(CLAVE_ORIGEN, origen);
    return origen;
  } catch {
    return "";
  }
}

export function generateEventId(): string {
  const c = window.crypto as any;
  if (c?.randomUUID) return c.randomUUID();
  return `evt_${Date.now()}_${Math.random().toString(36).slice(2)}`;
}

export function trackMetaEvent(eventName: string, params?: any, eventId?: string) {
  const w = window as any;
  if (!w.fbq) return;
  if (eventId) w.fbq("track", eventName, params, { eventID: eventId });
  else w.fbq("track", eventName, params);
}

export function trackTiktokEvent(eventName: string, params?: any) {
  const w = window as any;
  if (w.ttq) w.ttq.track(eventName, params);
}

// Respaldo server-side (CAPI). Va con el MISMO eventId que el píxel del
// navegador para que Meta deduplique y no cuente doble. Importa sobre todo en
// iOS y con bloqueadores, donde el evento del navegador se pierde.
export type EventoEmbudo = "ViewContent" | "AddToCart" | "InitiateCheckout" | "Contact";

export function sendFunnelEventCapi(
  eventName: EventoEmbudo,
  eventId: string,
  opts: { contentIds?: string[]; contentName?: string; value?: number; customerPhone?: string } = {}
) {
  fetch("/api/public/track-event", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      eventName,
      storeId: "default",
      eventId,
      fbp: getFbp(),
      fbc: getFbc(),
      eventSourceUrl: window.location.href,
      customerPhone: opts.customerPhone || "",
      contentIds: opts.contentIds || [],
      contentName: opts.contentName || "",
      value: opts.value || 0,
      visitorId: idVisitante(),
      origen: origenVisita()
    })
  }).catch(() => {});
}

// Dispara el evento por los dos canales a la vez con un solo eventId.
export function trackEvento(
  eventName: EventoEmbudo,
  params: { contentIds?: string[]; contentName?: string; value?: number; customerPhone?: string } = {},
  metaParams: any = {}
) {
  const eventId = generateEventId();
  trackMetaEvent(eventName, {
    content_ids: params.contentIds || [],
    content_name: params.contentName || "",
    content_type: "product",
    value: params.value || 0,
    currency: "COP",
    ...metaParams
  }, eventId);
  trackTiktokEvent(eventName, {
    contents: (params.contentIds || []).map((id) => ({ content_id: id, content_name: params.contentName || "" })),
    value: params.value || 0,
    currency: "COP"
  });
  sendFunnelEventCapi(eventName, eventId, params);
  return eventId;
}

function initMeta(rawPixelId: string) {
  // El id llegaba con un espacio delante por cómo se pegó en la configuración.
  // Un id mal formado hace que Meta no registre nada, así que se limpia siempre.
  const pixelId = String(rawPixelId || "").trim();
  if (!pixelId || idMetaCargado === pixelId) return;
  const w = window as any;

  if (!w.fbq) {
    (function (f: any, b: Document, e: string, v: string, n?: any, t?: any, s?: any) {
      if (f.fbq) return;
      n = f.fbq = function () {
        n.callMethod ? n.callMethod.apply(n, arguments) : n.queue.push(arguments);
      };
      if (!f._fbq) f._fbq = n;
      n.push = n;
      n.loaded = !0;
      n.version = "2.0";
      n.queue = [];
      t = b.createElement(e);
      t.async = !0;
      t.src = v;
      s = b.getElementsByTagName(e)[0];
      s.parentNode?.insertBefore(t, s);
    })(w, document, "script", "https://connect.facebook.net/en_US/fbevents.js");
  }

  w.fbq("init", pixelId);
  w.fbq("track", "PageView");
  idMetaCargado = pixelId;
  console.log(`[Meta Pixel] Inicializado con ID ${pixelId} en ${window.location.pathname}`);
}

function initTiktok(rawPixelId: string) {
  const pixelId = String(rawPixelId || "").trim();
  if (!pixelId || idTiktokCargado === pixelId) return;
  const w = window as any;

  if (!w.ttq) {
    (function (win: any, doc: Document, t: string) {
      win.TiktokAnalyticsObject = t;
      const ttq = (win[t] = win[t] || []);
      ttq.methods = ["page", "track", "identify", "instances", "debug", "on", "off", "once", "ready", "alias", "group", "enableCookie", "disableCookie"];
      ttq.setAndDefer = function (obj: any, method: string) {
        obj[method] = function () { obj.push([method].concat(Array.prototype.slice.call(arguments, 0))); };
      };
      for (let i = 0; i < ttq.methods.length; i++) ttq.setAndDefer(ttq, ttq.methods[i]);
      ttq.instance = function (id: string) {
        const inst = ttq._i[id] || [];
        for (let i = 0; i < ttq.methods.length; i++) ttq.setAndDefer(inst, ttq.methods[i]);
        return inst;
      };
      ttq.load = function (id: string) {
        const url = "https://analytics.tiktok.com/i18n/pixel/events.js";
        ttq._i = ttq._i || {};
        ttq._i[id] = [];
        ttq._i[id]._u = url;
        ttq._t = ttq._t || {};
        ttq._t[id] = +new Date();
        ttq._o = ttq._o || {};
        ttq._o[id] = {};
        const script = doc.createElement("script");
        script.type = "text/javascript";
        script.async = true;
        script.src = url + "?sdkid=" + id + "&lib=" + t;
        const first = doc.getElementsByTagName("script")[0];
        first.parentNode?.insertBefore(script, first);
      };
    })(w, document, "ttq");
  }

  w.ttq.load(pixelId);
  w.ttq.page();
  idTiktokCargado = pixelId;
}

// Arranca los píxeles una sola vez por carga de página, en cualquier ruta.
export function ensurePixels() {
  if (arranqueIniciado) return;
  arranqueIniciado = true;
  fetch("/api/public/config")
    .then((r) => r.json())
    .then((data) => {
      if (data.metaPixelId) initMeta(data.metaPixelId);
      if (data.tiktokPixelId) initTiktok(data.tiktokPixelId);
    })
    .catch((err) => console.error("[Pixel] No se pudo cargar la configuración:", err));
}
