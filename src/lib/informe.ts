// Página de informe en vivo, servida por el propio servidor de la tienda.
//
// El primer intento fue publicarlo como artefacto que consultara los
// conectores, pero ese camino no funcionó en la cuenta del dueño. Servirlo
// desde aquí no depende de nada externo: es el mismo dominio y la misma base
// de datos que ya usa la tienda.
//
// Es SOLO LECTURA: consulta conteos y no escribe ni modifica nada. Va detrás de
// un token en la URL, y si no hay token configurado las rutas ni se registran.

import { recogerMetricasMeta, type MetricasMeta } from "./metaInsights.js";

export interface DatosInforme {
  generadoEn: string;
  pedidos: number;
  clientes: number;
  productos: number;
  enCheckout: number;
  vistas24h: number;
  carritos24h: number;
  checkouts24h: number;
  contactos24h: number;
  mensajesWa24h: number;
  carritos7d: number;
  pedidos7d: number;
  // El mismo embudo a 7 días desde la base propia. Va aparte del de Meta a
  // propósito: Meta solo cuenta lo que le puede atribuir a un anuncio, así que
  // sus cifras salen muy por debajo del tráfico real. Verlas juntas y bien
  // rotuladas evita compararlas como si midieran lo mismo.
  vistas7d: number;
  checkouts7d: number;
  contactos7d: number;
  mensajesWa7d: number;
  // Diagnóstico del formulario: separa "lo abrió y no tocó nada" de "escribió
  // y se fue a mitad". Son dos problemas distintos con soluciones distintas.
  formEmpezado7d: number;
  formAbandonado7d: number;
  abandonoPorCampo: Array<{ campo: string; veces: number }>;
  // Ingresos REALES, sumados de los pedidos de la base. No son los de Meta:
  // las ventas se cierran contraentrega por WhatsApp y Meta nunca las ve, así
  // que su ROAS siempre saldría bajo aunque el negocio esté vendiendo bien.
  ingresos7d: number;
  ticketPromedio: number;
  roasReal: number;
  cpaReal: number;
  meta: MetricasMeta;
  reactivacionActiva: boolean;
  ultimosPedidos: Array<{ fecha: string; cliente: string; producto: string; estado: string }>;
  advertencias: string[];
}

function n(v: any): number {
  const x = Number(v);
  return Number.isFinite(x) ? x : 0;
}

// Caché en memoria del informe. El panel se refresca cada hora, pero si hay
// varias pestañas o el celular abierto al tiempo, cada una pediría lo suyo y se
// multiplicarían las consultas a la base y a Meta. Con esto todas comparten la
// misma lectura durante 10 minutos, y el botón "Actualizar" la salta.
let cache: { datos: DatosInforme; hasta: number } | null = null;
const CACHE_MS = 10 * 60 * 1000;

export function invalidarCacheInforme() { cache = null; }

export async function obtenerInforme(supabase: any, reactivacionActiva: boolean, forzar: boolean): Promise<DatosInforme> {
  if (!forzar && cache && Date.now() < cache.hasta) return cache.datos;
  const datos = await recogerDatosInforme(supabase, reactivacionActiva);
  cache = { datos, hasta: Date.now() + CACHE_MS };
  return datos;
}

/** Recoge todos los conteos del informe. Nunca lanza: si una consulta falla,
 *  ese dato queda en 0 y el motivo se acumula en `advertencias`, para que la
 *  página cargue igual en vez de quedarse en blanco por un solo fallo. */
export async function recogerDatosInforme(supabase: any, reactivacionActiva: boolean): Promise<DatosInforme> {
  const advertencias: string[] = [];
  const ahora = Date.now();
  const desde24 = new Date(ahora - 24 * 3600 * 1000).toISOString();
  const desde7d = new Date(ahora - 7 * 24 * 3600 * 1000).toISOString();

  const base: DatosInforme = {
    generadoEn: new Date().toISOString(),
    pedidos: 0, clientes: 0, productos: 0, enCheckout: 0,
    vistas24h: 0, carritos24h: 0, checkouts24h: 0, contactos24h: 0, mensajesWa24h: 0,
    carritos7d: 0, pedidos7d: 0,
    vistas7d: 0, checkouts7d: 0, contactos7d: 0, mensajesWa7d: 0,
    formEmpezado7d: 0, formAbandonado7d: 0, abandonoPorCampo: [],
    ingresos7d: 0, ticketPromedio: 0, roasReal: 0, cpaReal: 0,
    meta: await recogerMetricasMeta(),
    reactivacionActiva,
    ultimosPedidos: [],
    advertencias
  };
  if (!base.meta.disponible && base.meta.motivo) advertencias.push(base.meta.motivo);

  if (!supabase) {
    advertencias.push("Sin conexión a la base de datos.");
    return base;
  }

  const contar = async (tabla: string, etiqueta: string, ajustar?: (q: any) => any): Promise<number> => {
    try {
      let q = supabase.from(tabla).select("*", { count: "exact", head: true });
      if (ajustar) q = ajustar(q);
      const { count, error } = await q;
      if (error) { advertencias.push(`${etiqueta}: ${error.message}`); return 0; }
      return n(count);
    } catch (e: any) {
      advertencias.push(`${etiqueta}: ${e?.message || "error desconocido"}`);
      return 0;
    }
  };

  const tipoDesde = (tipo: string, desde: string) => (q: any) =>
    q.eq("data->>type", tipo).gte("data->>timestamp", desde);

  const [
    pedidos, clientes, productos, enCheckout,
    vistas24h, carritos24h, checkouts24h, contactos24h, carritos7d
  ] = await Promise.all([
    contar("orders", "pedidos"),
    contar("customers", "clientes"),
    contar("products", "productos"),
    contar("customers", "en checkout", (q: any) => q.not("data->>checkoutStep", "is", null)),
    contar("activities", "visitas 24h", tipoDesde("page_view", desde24)),
    contar("activities", "carritos 24h", tipoDesde("add_to_cart", desde24)),
    contar("activities", "checkouts 24h", tipoDesde("funnel_event", desde24)),
    contar("activities", "contactos 24h", tipoDesde("contact", desde24)),
    contar("activities", "carritos 7d", tipoDesde("add_to_cart", desde7d))
  ]);

  Object.assign(base, {
    pedidos, clientes, productos, enCheckout,
    vistas24h, carritos24h, checkouts24h, contactos24h, carritos7d
  });

  // Mensajes de WhatsApp: las actividades de conversación no traen 'type', se
  // reconocen porque llevan teléfono del cliente.
  base.mensajesWa24h = await contar("activities", "mensajes WhatsApp 24h",
    (q: any) => q.not("data->>customerPhone", "is", null).gte("data->>timestamp", desde24));

  const [vistas7d, checkouts7d, contactos7d, mensajesWa7d] = await Promise.all([
    contar("activities", "visitas 7d", tipoDesde("page_view", desde7d)),
    contar("activities", "checkouts 7d", tipoDesde("funnel_event", desde7d)),
    contar("activities", "contactos 7d", tipoDesde("contact", desde7d)),
    contar("activities", "mensajes WhatsApp 7d",
      (q: any) => q.not("data->>customerPhone", "is", null).gte("data->>timestamp", desde7d))
  ]);
  Object.assign(base, { vistas7d, checkouts7d, contactos7d, mensajesWa7d });

  const [formEmpezado7d, formAbandonado7d] = await Promise.all([
    contar("activities", "empezaron el formulario 7d", tipoDesde("form_start", desde7d)),
    contar("activities", "abandonos del formulario 7d", tipoDesde("form_abandon", desde7d))
  ]);
  Object.assign(base, { formEmpezado7d, formAbandonado7d });

  // En qué campo se quedaron. El mensaje guardado termina en "se fue en: X",
  // así que se agrupa por ese pedazo. Saber que 8 de 10 se van en "dirección"
  // vale mucho más que saber que hubo 10 abandonos.
  if (formAbandonado7d > 0) {
    try {
      const { data, error } = await supabase
        .from("activities").select("data")
        .eq("data->>type", "form_abandon")
        .gte("data->>timestamp", desde7d)
        .limit(400);
      if (error) advertencias.push(`abandono por campo: ${error.message}`);
      else if (Array.isArray(data)) {
        const cuenta: Record<string, number> = {};
        for (const row of data) {
          const msg = String(row?.data?.message || "");
          const m = msg.match(/se fue en:\s*(.+?)\s*$/i);
          const campo = m ? m[1].trim() : "sin dato";
          cuenta[campo] = (cuenta[campo] || 0) + 1;
        }
        base.abandonoPorCampo = Object.entries(cuenta)
          .map(([campo, veces]) => ({ campo, veces }))
          .sort((a, b) => b.veces - a.veces)
          .slice(0, 6);
      }
    } catch (e: any) {
      advertencias.push(`abandono por campo: ${e?.message || "error"}`);
    }
  }

  base.pedidos7d = await contar("orders", "pedidos 7d",
    (q: any) => q.gte("data->>createdAt", desde7d));

  // Ingresos reales de los últimos 7 días. Se traen los pedidos y se suman en
  // memoria: son pocos, y 'totalPrice' vive dentro del JSON, donde no hay una
  // suma directa que valga la pena montar.
  try {
    const { data, error } = await supabase
      .from("orders").select("data").gte("data->>createdAt", desde7d).limit(500);
    if (error) advertencias.push(`ingresos 7d: ${error.message}`);
    else if (Array.isArray(data)) {
      const validos = data.filter((r: any) => String(r?.data?.status || "").toLowerCase() !== "cancelado");
      base.ingresos7d = validos.reduce((s: number, r: any) => s + n(r?.data?.totalPrice), 0);
      base.ticketPromedio = validos.length ? Math.round(base.ingresos7d / validos.length) : 0;
    }
  } catch (e: any) {
    advertencias.push(`ingresos 7d: ${e?.message || "error"}`);
  }

  const gastoMeta = base.meta.disponible ? base.meta.gasto7d : 0;
  base.roasReal = gastoMeta > 0 ? base.ingresos7d / gastoMeta : 0;
  base.cpaReal = base.pedidos7d > 0 && gastoMeta > 0 ? Math.round(gastoMeta / base.pedidos7d) : 0;

  try {
    const { data, error } = await supabase
      .from("orders").select("data").order("data->>createdAt", { ascending: false }).limit(6);
    if (error) advertencias.push(`últimos pedidos: ${error.message}`);
    else if (Array.isArray(data)) {
      base.ultimosPedidos = data.map((row: any) => {
        const d = row?.data || {};
        return {
          fecha: String(d.createdAt || "").slice(0, 16).replace("T", " "),
          cliente: String(d.customerName || "—"),
          producto: String(d.productName || "—").slice(0, 60),
          estado: String(d.status || "—")
        };
      });
    }
  } catch (e: any) {
    advertencias.push(`últimos pedidos: ${e?.message || "error"}`);
  }

  return base;
}

/** La página. Se sirve completa y pide los datos a /api/informe cada hora. */
export function paginaInforme(token: string): string {
  const t = JSON.stringify(token);
  return `<!doctype html>
<html lang="es"><head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex,nofollow">
<title>Jansel Shop en vivo</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,600;12..96,700&family=JetBrains+Mono:wght@400;500&family=Public+Sans:wght@400;500;600&display=swap">
<style>
  :root{--bg:#EDF0F3;--surface:#fff;--surface-2:#F4F7F9;--ink:#0E141A;--muted:#57646F;
    --faint:#8695A1;--line:#D6DDE4;--line-2:#BCC7D0;--accent:#0E6A70;
    --good:#1B7040;--good-soft:#DDEFE4;--warn:#9A6000;--warn-soft:#F8EAD1;
    --bad:#A62F1C;--bad-soft:#FADFD9;--shadow:0 1px 2px rgba(14,20,26,.05),0 4px 16px rgba(14,20,26,.05)}
  @media (prefers-color-scheme:dark){:root:not([data-theme="light"]){
    --bg:#0F1317;--surface:#161C22;--surface-2:#1D242B;--ink:#E6ECF2;--muted:#93A1AE;
    --faint:#6C7B88;--line:#252E36;--line-2:#36424C;--accent:#4FC3C8;
    --good:#57C185;--good-soft:#122E1F;--warn:#E0A94B;--warn-soft:#312413;
    --bad:#F0705C;--bad-soft:#361A16;--shadow:0 1px 2px rgba(0,0,0,.45),0 4px 16px rgba(0,0,0,.35)}}
  :root[data-theme="dark"]{--bg:#0F1317;--surface:#161C22;--surface-2:#1D242B;--ink:#E6ECF2;
    --muted:#93A1AE;--faint:#6C7B88;--line:#252E36;--line-2:#36424C;--accent:#4FC3C8;
    --good:#57C185;--good-soft:#122E1F;--warn:#E0A94B;--warn-soft:#312413;
    --bad:#F0705C;--bad-soft:#361A16;--shadow:0 1px 2px rgba(0,0,0,.45),0 4px 16px rgba(0,0,0,.35)}
  *{box-sizing:border-box}
  body{margin:0;background:var(--bg);color:var(--ink);font-family:"Public Sans",system-ui,sans-serif;
    font-size:16px;line-height:1.6;-webkit-font-smoothing:antialiased}
  .wrap{max-width:900px;margin:0 auto;padding:30px 18px 80px}
  .mono{font-family:"JetBrains Mono",ui-monospace,monospace;font-variant-numeric:tabular-nums}
  header{border-bottom:2px solid var(--line-2);padding-bottom:18px;margin-bottom:6px}
  .kicker{font-family:"JetBrains Mono",monospace;font-size:11px;letter-spacing:.16em;
    text-transform:uppercase;color:var(--faint);margin-bottom:10px}
  h1{font-family:"Bricolage Grotesque",sans-serif;font-weight:700;font-size:clamp(28px,5.2vw,42px);
    line-height:1.06;letter-spacing:-.025em;margin:0 0 8px}
  .sub{margin:0;color:var(--muted);max-width:62ch}
  .bar{display:flex;align-items:center;gap:9px;flex-wrap:wrap;margin:14px 0 2px;
    font-family:"JetBrains Mono",monospace;font-size:11.5px;color:var(--faint)}
  .dot{width:8px;height:8px;border-radius:50%;background:var(--faint)}
  .dot.on{background:var(--good);box-shadow:0 0 0 3px var(--good-soft)}
  .dot.off{background:var(--bad)}
  button{font-family:"Public Sans",sans-serif;font-size:12.5px;font-weight:500;padding:4px 11px;
    border-radius:6px;cursor:pointer;background:var(--surface);color:var(--ink);border:1px solid var(--line-2)}
  button:hover{background:var(--surface-2)}
  button:focus-visible{outline:2px solid var(--accent);outline-offset:2px}
  .kpis{display:grid;grid-template-columns:repeat(auto-fit,minmax(144px,1fr));gap:11px;margin:20px 0}
  .kpi{background:var(--surface);border:1px solid var(--line);border-radius:10px;padding:13px 15px;box-shadow:var(--shadow)}
  .kpi .lbl{font-family:"JetBrains Mono",monospace;font-size:10.5px;letter-spacing:.1em;
    text-transform:uppercase;color:var(--faint);display:block;margin-bottom:5px}
  .kpi .val{font-family:"Bricolage Grotesque",sans-serif;font-weight:700;font-size:26px;
    letter-spacing:-.02em;font-variant-numeric:tabular-nums;line-height:1.1}
  .kpi .note{font-size:12.5px;color:var(--muted);margin-top:2px}
  .kpi.good .val{color:var(--good)}.kpi.bad .val{color:var(--bad)}.kpi.warn .val{color:var(--warn)}
  h2{font-family:"Bricolage Grotesque",sans-serif;font-weight:700;font-size:21px;
    letter-spacing:-.018em;margin:36px 0 8px}
  p{margin:0 0 12px;max-width:70ch}
  .scroll{overflow-x:auto;margin:12px 0;border:1px solid var(--line);border-radius:10px;
    background:var(--surface);box-shadow:var(--shadow)}
  table{width:100%;border-collapse:collapse;font-size:14.5px;min-width:480px}
  th,td{padding:9px 13px;text-align:left;border-bottom:1px solid var(--line)}
  th{font-family:"JetBrains Mono",monospace;font-size:10.5px;letter-spacing:.09em;
    text-transform:uppercase;color:var(--faint);font-weight:500;background:var(--surface-2)}
  td.num{font-family:"JetBrains Mono",monospace;font-variant-numeric:tabular-nums;text-align:right}
  tr:last-child td{border-bottom:none}
  .aviso{border-radius:10px;padding:16px 18px;margin:16px 0;border:1px solid;box-shadow:var(--shadow)}
  .aviso.ok{background:var(--good-soft);border-color:var(--good)}
  .aviso.warn{background:var(--warn-soft);border-color:var(--warn)}
  .aviso.bad{background:var(--bad-soft);border-color:var(--bad)}
  .aviso h3{margin:0 0 6px;font-size:16px;font-family:"Bricolage Grotesque",sans-serif}
  .aviso.ok h3{color:var(--good)}.aviso.warn h3{color:var(--warn)}.aviso.bad h3{color:var(--bad)}
  .aviso p:last-child{margin-bottom:0}
  a{color:var(--accent)}
  footer{margin-top:44px;padding-top:16px;border-top:1px solid var(--line);font-size:13px;color:var(--faint)}
  @media (prefers-reduced-motion:reduce){*{transition:none!important}}
</style></head><body>
<div class="wrap">
<header>
  <div class="kicker">Jansel Shop · informe en vivo</div>
  <h1>Cómo va la tienda</h1>
  <p class="sub">Se lee directo de tu base de datos y se actualiza solo cada hora.</p>
</header>

<div class="bar">
  <span class="dot" id="dot"></span>
  <span id="estado">Cargando…</span>
  <button id="btn" type="button">Actualizar ahora</button>
</div>

<div class="kpis">
  <div class="kpi"><span class="lbl">ROAS real</span><div class="val mono" id="k-roas">—</div><div class="note" id="k-roas-n">7 días</div></div>
  <div class="kpi"><span class="lbl">Gasto 7 días</span><div class="val mono" id="k-gasto">—</div><div class="note" id="k-gastohoy">—</div></div>
  <div class="kpi"><span class="lbl">Ingresos 7 días</span><div class="val mono" id="k-ing">—</div><div class="note" id="k-ticket">—</div></div>
  <div class="kpi"><span class="lbl">CTR</span><div class="val mono" id="k-ctr">—</div><div class="note">referente: 1–2%</div></div>
  <div class="kpi"><span class="lbl">CPA real</span><div class="val mono" id="k-cpa">—</div><div class="note">costo por pedido</div></div>
  <div class="kpi"><span class="lbl">Pedidos</span><div class="val mono" id="k-ped">—</div><div class="note">total en la base</div></div>
</div>

<div id="alertas"></div>

<h2>Métricas de los anuncios · 7 días</h2>
<div class="scroll"><table>
  <thead><tr><th>Métrica</th><th class="num">Valor</th><th>Qué te dice</th></tr></thead>
  <tbody id="metricas"><tr><td colspan="3">Cargando…</td></tr></tbody>
</table></div>

<h2>Rendimiento por anuncio · 7 días</h2>
<div class="scroll"><table>
  <thead><tr><th>Anuncio</th><th class="num">Gasto</th><th class="num">Clics</th><th class="num">CTR</th><th class="num">CPC</th><th class="num">Carritos</th></tr></thead>
  <tbody id="anuncios"><tr><td colspan="6">Cargando…</td></tr></tbody>
</table></div>

<h2>Embudo de las últimas 24 horas</h2>
<div class="scroll"><table>
  <thead><tr><th>Paso</th><th class="num">Cantidad</th><th>Qué significa</th></tr></thead>
  <tbody id="embudo"><tr><td colspan="3">Cargando…</td></tr></tbody>
</table></div>

<h2>Últimos pedidos</h2>
<div class="scroll"><table>
  <thead><tr><th>Fecha</th><th>Cliente</th><th>Producto</th><th>Estado</th></tr></thead>
  <tbody id="pedidos"><tr><td colspan="4">Cargando…</td></tr></tbody>
</table></div>

<h2>Anuncios</h2>
<p>Las cifras de gasto y CTR viven en Meta y no se pueden leer desde aquí.
  <a href="https://www.facebook.com/adsmanager/manage/campaigns?act=816603727681853" target="_blank" rel="noopener">Abrir el administrador de anuncios →</a></p>

<footer id="pie">—</footer>
</div>

<script>
(function(){
  var TOKEN = ${t};
  var $=function(i){return document.getElementById(i)};
  var esc=function(s){return String(s==null?"":s).replace(/[&<>"']/g,function(c){
    return {"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]})};
  var num=function(v){var x=Number(v);return isFinite(x)?x.toLocaleString("es-CO"):"—"};

  var pesos=function(v){var x=Number(v);return isFinite(x)?"$"+Math.round(x).toLocaleString("es-CO"):"—"};
  var dec=function(v,d){var x=Number(v);return isFinite(x)?x.toFixed(d==null?2:d).replace(".",","):"—"};

  function pintar(d){
    var m=d.meta||{}, hay=!!m.disponible;

    // ROAS: por cada peso puesto en Meta, cuántos volvieron en pedidos reales.
    // Bajo 1 se está perdiendo plata; sobre 2 el negocio respira.
    if(hay && Number(m.gasto7d)>0){
      $("k-roas").textContent=dec(d.roasReal)+"x";
      $("k-roas").parentElement.className="kpi"+(d.roasReal>=2?" good":(d.roasReal>=1?" warn":" bad"));
      $("k-roas-n").textContent=d.roasReal>=1?"por cada $1 invertido":"estás perdiendo plata";
    } else { $("k-roas").textContent="—"; $("k-roas-n").textContent=hay?"sin gasto aún":"sin datos de Meta"; }

    $("k-gasto").textContent=hay?pesos(m.gasto7d):"—";
    $("k-gastohoy").textContent=hay?("hoy: "+pesos(m.gastoHoy)):"sin datos de Meta";
    $("k-ing").textContent=pesos(d.ingresos7d);
    $("k-ticket").textContent="ticket: "+pesos(d.ticketPromedio);
    if(hay){
      $("k-ctr").textContent=dec(m.ctr7d)+"%";
      $("k-ctr").parentElement.className="kpi"+(Number(m.ctr7d)>=3?" good":(Number(m.ctr7d)>=1?"":" warn"));
    } else $("k-ctr").textContent="—";
    $("k-cpa").textContent=d.cpaReal>0?pesos(d.cpaReal):"—";
    $("k-ped").textContent=num(d.pedidos);
    $("k-ped").parentElement.className="kpi"+(Number(d.pedidos)===0?" bad":" good");

    if(hay){
      var mets=[
        ["Gasto",pesos(m.gasto7d),"lo que llevas invertido"],
        ["Impresiones",num(m.impresiones7d),"veces que se mostró tu anuncio"],
        ["Alcance",num(m.alcance7d),"personas distintas que lo vieron"],
        ["Frecuencia",dec(m.frecuencia7d,1),"veces que lo vio cada una · sobre 3 cansa"],
        ["Clics",num(m.clics7d),"cuántos entraron a la tienda"],
        ["CTR",dec(m.ctr7d)+"%","qué tan bien engancha · 1–2% es normal"],
        ["CPC",pesos(m.cpc7d),"lo que pagas por cada clic"],
        ["CPM",pesos(m.cpm7d),"costo por cada mil impresiones"],
        ["Carritos (Meta)",num(m.carritos7d),"agregaron al carrito"],
        ["Iniciaron pedido",num(m.checkouts7d),"llegaron al formulario"],
        ["Compras (Meta)",num(m.compras7d),"lo que Meta alcanza a ver"],
        ["Costo por carrito",Number(m.carritos7d)>0?pesos(Number(m.gasto7d)/Number(m.carritos7d)):"—","cuánto te cuesta un carrito"],
        ["Pedidos reales",num(d.pedidos7d),"de tu base, incluidos los de WhatsApp"],
        ["CPA real",d.cpaReal>0?pesos(d.cpaReal):"—","lo que te cuesta cada pedido de verdad"],
        ["ROAS real",Number(m.gasto7d)>0?dec(d.roasReal)+"x":"—","ingresos ÷ gasto"]
      ];
      $("metricas").innerHTML=mets.map(function(x){
        return "<tr><td>"+esc(x[0])+'</td><td class="num">'+esc(x[1])+"</td><td>"+esc(x[2])+"</td></tr>"}).join("");

      var ads=m.anuncios||[];
      $("anuncios").innerHTML=ads.length?ads.map(function(a){
        return "<tr><td>"+esc(a.nombre)+'</td><td class="num">'+pesos(a.gasto)+
          '</td><td class="num">'+num(a.clics)+'</td><td class="num">'+dec(a.ctr)+
          '%</td><td class="num">'+pesos(a.cpc)+'</td><td class="num">'+num(a.carritos)+"</td></tr>"}).join("")
        : '<tr><td colspan="6">Sin anuncios con datos en los últimos 7 días.</td></tr>';
    } else {
      var aviso='<tr><td colspan="3">'+esc(m.motivo||"Sin datos de Meta.")+"</td></tr>";
      $("metricas").innerHTML=aviso;
      $("anuncios").innerHTML='<tr><td colspan="6">'+esc(m.motivo||"Sin datos de Meta.")+"</td></tr>";
    }

    var pasos=[["Visitas",d.vistas24h,"entraron a la tienda"],
      ["Al carrito",d.carritos24h,"agregaron un producto"],
      ["Iniciaron pedido",d.checkouts24h,"llegaron al formulario"],
      ["Escribieron",d.contactos24h,"tocaron el botón de WhatsApp"],
      ["Mensajes WhatsApp",d.mensajesWa24h,"conversaciones con el bot"]];
    $("embudo").innerHTML=pasos.map(function(p){
      return "<tr><td>"+esc(p[0])+'</td><td class="num">'+num(p[1])+"</td><td>"+esc(p[2])+"</td></tr>"}).join("");

    var ped=d.ultimosPedidos||[];
    $("pedidos").innerHTML=ped.length
      ? ped.map(function(o){return "<tr><td>"+esc(o.fecha)+"</td><td>"+esc(o.cliente)+
          "</td><td>"+esc(o.producto)+"</td><td>"+esc(o.estado)+"</td></tr>"}).join("")
      : '<tr><td colspan="4">Todavía no ha entrado ningún pedido.</td></tr>';

    var av=[];
    if(d.reactivacionActiva)
      av.push('<div class="aviso warn"><h3>Campaña de reactivación ENCENDIDA</h3><p>Está mandando mensajes automáticos por WhatsApp. Si no era lo que querías, quita <b>REACTIVACION_AUTOMATICA</b> en Railway.</p></div>');
    else
      av.push('<div class="aviso ok"><h3>Campaña de reactivación apagada</h3><p>No se están enviando mensajes automáticos por WhatsApp.</p></div>');
    if((d.advertencias||[]).length)
      av.push('<div class="aviso bad"><h3>Algunos datos no se pudieron leer</h3><p>'+
        d.advertencias.map(esc).join("<br>")+"</p></div>");
    $("alertas").innerHTML=av.join("");

    $("dot").className="dot on";
    $("estado").textContent="Al día · se actualiza solo cada hora";
    $("pie").textContent="Última lectura: "+new Date(d.generadoEn).toLocaleString("es-CO")+
      " · "+num(d.clientes)+" clientes y "+num(d.productos)+" productos en catálogo.";
  }

  var cargando=false;
  function cargar(forzar){
    if(cargando)return; cargando=true;
    fetch("/api/informe?k="+encodeURIComponent(TOKEN)+(forzar?"&fresh=1":""),{cache:"no-store"})
      .then(function(r){ if(!r.ok) throw new Error("HTTP "+r.status); return r.json()})
      .then(function(j){ if(!j||!j.success) throw new Error((j&&j.error)||"respuesta inesperada"); pintar(j.datos)})
      .catch(function(e){
        $("dot").className="dot off";
        $("estado").textContent="No se pudo leer: "+e.message;
      })
      .then(function(){cargando=false});
  }
  $("btn").addEventListener("click",function(){cargar(true)});
  cargar();
  setInterval(function(){ if(!document.hidden) cargar() },3600000);
})();
</script>
</body></html>`;
}
