// Métricas de la cuenta publicitaria de Meta, leídas desde el servidor.
//
// Se usa la Graph API SIN número de versión en la ruta. Fijar una versión
// (v21.0, v23.0…) obliga a acordarse de subirla antes de que Meta la retire, y
// el día que la retira el informe se cae solo. Sin versión, Meta resuelve a una
// vigente por su cuenta.
//
// Nunca lanza: si falta el token o la petición falla, devuelve `disponible:
// false` con el motivo, para que el informe cargue igual y diga qué pasó.

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
}

const VACIO: MetricasMeta = {
  disponible: false,
  gastoHoy: 0, gasto7d: 0, impresiones7d: 0, alcance7d: 0, frecuencia7d: 0,
  clics7d: 0, ctr7d: 0, cpc7d: 0, cpm7d: 0,
  carritos7d: 0, checkouts7d: 0, compras7d: 0, valorCompras7d: 0,
  anuncios: []
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
  const base = `https://graph.facebook.com/act_${encodeURIComponent(cuenta)}/insights`;
  const auth = `access_token=${encodeURIComponent(token)}`;

  try {
    const [hoy, semana, porAnuncio] = await Promise.all([
      pedir(`${base}?fields=spend&date_preset=today&${auth}`),
      pedir(`${base}?fields=${campos}&date_preset=last_7d&${auth}`),
      pedir(`${base}?fields=name,${campos}&level=ad&date_preset=last_7d&limit=25&${auth}`)
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

    return {
      disponible: true,
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
