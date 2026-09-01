// Métricas de la cuenta publicitaria de Meta, leídas desde el servidor.
//
// La versión de la API va FIJA y en una variable de entorno. El primer intento
// fue llamar sin versión, para no tener que acordarse de subirla; Meta lo
// rechazó con "(#2635) You are calling a deprecated version of the Ads API".
// Resulta que sin versión resuelve a una vieja y ya retirada. Queda en
// META_API_VERSION para poder subirla desde Railway el día que toque, sin
// tocar código.
//
// Nunca lanza: si falta el token o la petición falla, devuelve `disponible:
// false` con el motivo, para que el informe cargue igual y diga qué pasó.

const VERSION = String(process.env.META_API_VERSION || "v24.0").trim();

export interface FilaAnuncio {
  nombre: string;
  gasto: number;
  impresiones: number;
  clics: number;
  ctr: number;
  cpc: number;
  carritos: number;
  compras: number;
}

/** Un día de la serie, para las barras. */
export interface DiaMetrica {
  fecha: string;      // YYYY-MM-DD
  gasto: number;
  impresiones: number;
  clics: number;
  ctr: number;
  carritos: number;
  compras: number;
}

/** Un evento tal como Meta lo registró, con su valor exacto y sin agrupar. */
export interface EventoReal {
  tipo: string;
  etiqueta: string;
  cantidad: number;
}

export interface MetricasMeta {
  disponible: boolean;
  motivo?: string;
  gastoHoy: number;
  gasto7d: number;
  impresiones7d: number;
  alcance7d: number;
  frecuencia7d: number;
  clics7d: number;
  ctr7d: number;
  cpc7d: number;
  cpm7d: number;
  carritos7d: number;
  checkouts7d: number;
  compras7d: number;
  valorCompras7d: number;
  anuncios: FilaAnuncio[];
  dias: DiaMetrica[];
  eventos: EventoReal[];
  version: string;
}

const VACIO: MetricasMeta = {
  disponible: false,
  gastoHoy: 0, gasto7d: 0, impresiones7d: 0, alcance7d: 0, frecuencia7d: 0,
  clics7d: 0, ctr7d: 0, cpc7d: 0, cpm7d: 0,
  carritos7d: 0, checkouts7d: 0, compras7d: 0, valorCompras7d: 0,
  anuncios: [], dias: [], eventos: [], version: VERSION
};

// Nombres legibles para los action_type de Meta. Los que no estén aquí se
// muestran con su nombre técnico: es preferible enseñar un nombre feo pero
// real que esconder un evento que sí se está disparando.
const NOMBRES: Record<string, string> = {
  "page_engagement": "Interacción con la página",
  "post_engagement": "Interacción con la publicación",
  "landing_page_view": "Vieron la página completa",
  "link_click": "Clic en el enlace",
  "video_view": "Vieron el video",
  "view_content": "Vieron producto",
  "add_to_cart": "Agregaron al carrito",
  "initiate_checkout": "Iniciaron el pedido",
  "purchase": "Compraron",
  "lead": "Dejaron datos",
  "contact": "Escribieron",
  "offsite_conversion.fb_pixel_view_content": "Vieron producto (píxel)",
  "offsite_conversion.fb_pixel_add_to_cart": "Agregaron al carrito (píxel)",
  "offsite_conversion.fb_pixel_initiate_checkout": "Iniciaron el pedido (píxel)",
  "offsite_conversion.fb_pixel_purchase": "Compraron (píxel)",
  "offsite_conversion.fb_pixel_lead": "Dejaron datos (píxel)",
  "offsite_conversion.fb_pixel_custom": "Evento personalizado (píxel)",
  "omni_view_content": "Vieron producto (total)",
  "omni_add_to_cart": "Agregaron al carrito (total)",
  "omni_initiated_checkout": "Iniciaron el pedido (total)",
  "omni_purchase": "Compraron (total)",
  "onsite_conversion.post_save": "Guardaron la publicación",
  "onsite_conversion.messaging_conversation_started_7d": "Iniciaron conversación"
};

function n(v: any): number {
  const x = Number(v);
  return Number.isFinite(x) ? x : 0;
}

// Meta devuelve las conversiones en un arreglo `actions` con un `action_type`
// por fila. Los nombres varían según de dónde venga el evento (píxel del
// navegador, CAPI, o la app), así que se suman todas las variantes conocidas
// de cada tipo en vez de confiar en una sola.
function sumaAccion(arr: any[], tipos: string[]): number {
  if (!Array.isArray(arr)) return 0;
  let total = 0;
  for (const a of arr) {
    if (a && tipos.includes(String(a.action_type))) total += n(a.value);
  }
  return total;
}

const CARRITO = ["add_to_cart", "offsite_conversion.fb_pixel_add_to_cart", "omni_add_to_cart"];
const CHECKOUT = ["initiate_checkout", "offsite_conversion.fb_pixel_initiate_checkout", "omni_initiated_checkout"];
const COMPRA = ["purchase", "offsite_conversion.fb_pixel_purchase", "omni_purchase"];

async function pedir(url: string, timeoutMs = 12000): Promise<any> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: ctrl.signal });
    const cuerpo = await res.json().catch(() => null);
    if (!res.ok) {
      const msg = cuerpo?.error?.message || `HTTP ${res.status}`;
      throw new Error(msg);
    }
    return cuerpo;
  } finally {
    clearTimeout(t);
  }
}

export async function recogerMetricasMeta(): Promise<MetricasMeta> {
  const token = String(process.env.META_ADS_ACCESS_TOKEN || process.env.META_CAPI_ACCESS_TOKEN || "").trim();
  const cuenta = String(process.env.META_AD_ACCOUNT_ID || "816603727681853").replace(/^act_/, "").trim();

  if (!token) {
    return { ...VACIO, motivo: "No hay token de Meta configurado (META_ADS_ACCESS_TOKEN)." };
  }

  const campos = "spend,impressions,clicks,ctr,cpc,cpm,reach,frequency,actions,action_values";
  const base = `https://graph.facebook.com/${VERSION}/act_${encodeURIComponent(cuenta)}/insights`;
  const auth = `access_token=${encodeURIComponent(token)}`;

  try {
    const [hoy, semana, porAnuncio, serie] = await Promise.all([
      pedir(`${base}?fields=spend&date_preset=today&${auth}`),
      pedir(`${base}?fields=${campos}&date_preset=last_7d&${auth}`),
      pedir(`${base}?fields=name,${campos}&level=ad&date_preset=last_7d&limit=25&${auth}`),
      // time_increment=1 devuelve UNA FILA POR DÍA, que es lo que alimenta las
      // barras. 14 días para que se vea la tendencia y no solo la semana suelta.
      pedir(`${base}?fields=spend,impressions,clicks,ctr,actions&time_increment=1&date_preset=last_14d&${auth}`)
    ]);

    const s = (semana?.data && semana.data[0]) || {};
    const acciones = s.actions || [];
    const valores = s.action_values || [];

    const anuncios: FilaAnuncio[] = Array.isArray(porAnuncio?.data)
      ? porAnuncio.data.map((a: any) => ({
          nombre: String(a.name || "—"),
          gasto: n(a.spend),
          impresiones: n(a.impressions),
          clics: n(a.clicks),
          ctr: n(a.ctr),
          cpc: n(a.cpc),
          carritos: sumaAccion(a.actions, CARRITO),
          compras: sumaAccion(a.actions, COMPRA)
        })).sort((x: FilaAnuncio, y: FilaAnuncio) => y.gasto - x.gasto)
      : [];

    const dias: DiaMetrica[] = Array.isArray(serie?.data)
      ? serie.data.map((f: any) => ({
          fecha: String(f.date_start || ""),
          gasto: n(f.spend),
          impresiones: n(f.impressions),
          clics: n(f.clicks),
          ctr: n(f.ctr),
          carritos: sumaAccion(f.actions, CARRITO),
          compras: sumaAccion(f.actions, COMPRA)
        })).sort((a: DiaMetrica, b: DiaMetrica) => a.fecha.localeCompare(b.fecha))
      : [];

    // Todos los eventos que Meta registró de verdad, con su valor exacto y sin
    // agrupar. Antes solo se mostraban los tres que interesaban de antemano, y
    // así no había forma de notar que un evento no se estaba disparando.
    const eventos: EventoReal[] = Array.isArray(acciones)
      ? acciones
          .map((a: any) => ({
            tipo: String(a?.action_type || ""),
            etiqueta: NOMBRES[String(a?.action_type || "")] || String(a?.action_type || ""),
            cantidad: n(a?.value)
          }))
          .filter((e: EventoReal) => e.tipo && e.cantidad > 0)
          .sort((a: EventoReal, b: EventoReal) => b.cantidad - a.cantidad)
      : [];

    return {
      disponible: true,
      version: VERSION,
      dias,
      eventos,
      gastoHoy: n(hoy?.data?.[0]?.spend),
      gasto7d: n(s.spend),
      impresiones7d: n(s.impressions),
      alcance7d: n(s.reach),
      frecuencia7d: n(s.frequency),
      clics7d: n(s.clicks),
      ctr7d: n(s.ctr),
      cpc7d: n(s.cpc),
      cpm7d: n(s.cpm),
      carritos7d: sumaAccion(acciones, CARRITO),
      checkouts7d: sumaAccion(acciones, CHECKOUT),
      compras7d: sumaAccion(acciones, COMPRA),
      valorCompras7d: sumaAccion(valores, COMPRA),
      anuncios
    };
  } catch (e: any) {
    const msg = String(e?.message || "error desconocido");
    // El fallo típico no es la red sino los permisos: un token de CAPI sirve
    // para MANDAR eventos pero no para LEER anuncios, y ahí Meta responde que
    // falta ads_read. Se dice explícito para no dejarlo en "algo falló".
    const permisos = /permission|ads_read|ads_management|OAuth|token/i.test(msg);
    return {
      ...VACIO,
      motivo: permisos
        ? `Meta no deja leer los anuncios con el token actual: ${msg}`
        : `No se pudo consultar Meta: ${msg}`
    };
  }
}
