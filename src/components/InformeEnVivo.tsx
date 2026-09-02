import React, { useCallback, useEffect, useRef, useState } from "react";
import { motion } from "motion/react";
import {
  RefreshCw, TrendingUp, TrendingDown, AlertTriangle, CheckCircle2,
  Megaphone, ShoppingCart, MessageCircle, Lightbulb, Wallet, BarChart3, Footprints
} from "lucide-react";
import { adminAuthHeaders } from "../supabase";

// Informe en vivo dentro del panel. Lee /api/informe, que solo cuenta y no
// escribe nada, y se refresca solo cada minuto. Se pausa cuando la pestaña no
// está visible: si el panel queda abierto todo el día, no tiene sentido seguir
// consultando contra algo que nadie está mirando.

interface FilaAnuncio {
  nombre: string; gasto: number; impresiones: number; clics: number;
  ctr: number; cpc: number; carritos: number; compras: number;
}
interface DiaMetrica {
  fecha: string; gasto: number; impresiones: number; clics: number;
  ctr: number; carritos: number; compras: number;
}
interface EventoReal { tipo: string; etiqueta: string; cantidad: number; }
interface Datos {
  generadoEn: string;
  pedidos: number; clientes: number; productos: number; enCheckout: number;
  vistas24h: number; carritos24h: number; checkouts24h: number;
  contactos24h: number; mensajesWa24h: number;
  carritos7d: number; pedidos7d: number;
  vistas7d: number; checkouts7d: number; contactos7d: number; mensajesWa7d: number;
  formEmpezado7d: number; formAbandonado7d: number;
  abandonoPorCampo: Array<{ campo: string; veces: number }>;
  recorridos: Array<{
    visitante: string; origen: string; desde: string; hasta: string;
    pasos: Array<{ hora: string; texto: string }>;
  }>;
  ingresos7d: number; ticketPromedio: number; roasReal: number; cpaReal: number;
  reactivacionActiva: boolean;
  ultimosPedidos: Array<{ fecha: string; cliente: string; producto: string; estado: string }>;
  advertencias: string[];
  meta: {
    disponible: boolean; motivo?: string;
    gastoHoy: number; gasto7d: number; impresiones7d: number; alcance7d: number;
    frecuencia7d: number; clics7d: number; ctr7d: number; cpc7d: number; cpm7d: number;
    carritos7d: number; checkouts7d: number; compras7d: number; valorCompras7d: number;
    anuncios: FilaAnuncio[];
    dias: DiaMetrica[];
    eventos: EventoReal[];
    version: string;
  };
}

// Barras por día. Se dibuja con divs y no con una librería de gráficas: son
// pocos datos y meter una dependencia entera para 14 barras engordaría el
// bundle, que ya pasa de 1,5 MB.
function BarrasPorDia({ dias }: { dias: DiaMetrica[] }) {
  const [metrica, setMetrica] = useState<"gasto" | "clics" | "impresiones" | "carritos">("gasto");
  if (!dias?.length) return null;

  const OPCIONES: Array<[typeof metrica, string]> = [
    ["gasto", "Gasto"], ["clics", "Clics"], ["impresiones", "Impresiones"], ["carritos", "Carritos"]
  ];
  const valores = dias.map(d => Number(d[metrica]) || 0);
  const tope = Math.max(...valores, 1);
  const total = valores.reduce((a, b) => a + b, 0);
  const fmt = (v: number) => metrica === "gasto" ? cop(v) : nu(v);

  return (
    <div className="bg-neutral-900/40 border border-neutral-800 rounded-2xl p-4">
      <div className="flex items-center justify-between gap-3 flex-wrap mb-4">
        <div className="flex gap-1 bg-neutral-900 p-1 rounded-xl">
          {OPCIONES.map(([k, etiqueta]) => (
            <button
              key={k}
              onClick={() => setMetrica(k)}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all ${
                metrica === k ? "bg-amber-500/15 text-amber-400" : "text-neutral-500 hover:text-neutral-300"
              }`}
            >{etiqueta}</button>
          ))}
        </div>
        <span className="text-[11px] text-neutral-500">
          Total 14 días: <span className="text-white font-bold tabular-nums">{fmt(total)}</span>
        </span>
      </div>

      <div className="flex items-end gap-1 h-36">
        {dias.map((d) => {
          const v = Number(d[metrica]) || 0;
          const alto = tope > 0 ? Math.round((v / tope) * 100) : 0;
          const dia = d.fecha.slice(8, 10);
          const mes = d.fecha.slice(5, 7);
          return (
            <div key={d.fecha} className="flex-1 flex flex-col items-center gap-1 min-w-0 group relative">
              <span className="text-[9px] text-neutral-500 tabular-nums opacity-0 group-hover:opacity-100 transition-opacity absolute -top-4 whitespace-nowrap bg-neutral-800 px-1.5 py-0.5 rounded z-10">
                {fmt(v)}
              </span>
              <div className="w-full bg-neutral-800/60 rounded-t-sm flex items-end" style={{ height: "100%" }}>
                <div
                  className={`w-full rounded-t-sm transition-all ${v > 0 ? "bg-amber-500/70 group-hover:bg-amber-400" : "bg-neutral-700"}`}
                  style={{ height: Math.max(v > 0 ? 3 : 1, alto) + "%" }}
                />
              </div>
              <span className="text-[9px] text-neutral-600 tabular-nums">{dia}/{mes}</span>
            </div>
          );
        })}
      </div>
      <p className="text-[11px] text-neutral-500 mt-3">
        Pasa el dedo o el mouse por una barra para ver el valor exacto de ese día.
      </p>
    </div>
  );
}

const cop = (v: number | undefined) => {
  const x = Number(v);
  return Number.isFinite(x) ? "$" + Math.round(x).toLocaleString("es-CO") : "—";
};
const nu = (v: number | undefined) => {
  const x = Number(v);
  return Number.isFinite(x) ? x.toLocaleString("es-CO") : "—";
};
const dec = (v: number | undefined, d = 2) => {
  const x = Number(v);
  return Number.isFinite(x) ? x.toFixed(d).replace(".", ",") : "—";
};

type Tono = "bien" | "ojo" | "mal" | "neutro";
const TONOS: Record<Tono, string> = {
  bien: "text-emerald-400",
  ojo: "text-amber-400",
  mal: "text-red-400",
  neutro: "text-white"
};

function Kpi({ etiqueta, valor, nota, tono = "neutro", icono }: {
  etiqueta: string; valor: string; nota?: string; tono?: Tono; icono?: React.ReactNode;
}) {
  return (
    <div className="bg-neutral-900/60 border border-neutral-800 rounded-2xl p-4 flex flex-col gap-1">
      <div className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wider text-neutral-500">
        {icono}<span>{etiqueta}</span>
      </div>
      <div className={`text-2xl font-black tabular-nums leading-tight ${TONOS[tono]}`}>{valor}</div>
      {nota && <div className="text-[11px] text-neutral-500 leading-snug">{nota}</div>}
    </div>
  );
}

// Los consejos se calculan sobre los números del momento, no son un texto fijo.
// Cada uno dice QUÉ pasa y QUÉ hacer: un tablero que solo muestra cifras deja
// al dueño adivinando cuál es el siguiente movimiento.
function construirConsejos(d: Datos): Array<{ tono: Tono; titulo: string; texto: string }> {
  const c: Array<{ tono: Tono; titulo: string; texto: string }> = [];
  const m = d.meta;

  if (d.reactivacionActiva) {
    c.push({
      tono: "ojo",
      titulo: "La campaña de reactivación está encendida",
      texto: "Está mandando mensajes automáticos por WhatsApp. Revisa que los clientes tengan productos vigentes guardados; ofrecer algo descontinuado hace que la gente bloquee el número."
    });
  }

  if (m?.disponible && m.gasto7d > 0) {
    if (d.roasReal >= 2) {
      c.push({
        tono: "bien",
        titulo: `ROAS de ${dec(d.roasReal)}x — puedes subir presupuesto`,
        texto: `Por cada $1 en Meta están volviendo $${dec(d.roasReal)} en pedidos. Sube el presupuesto de a poco, un 20% cada 2 o 3 días: subirlo de golpe reinicia el aprendizaje.`
      });
    } else if (d.roasReal >= 1) {
      c.push({
        tono: "ojo",
        titulo: `ROAS de ${dec(d.roasReal)}x — apenas empatas`,
        texto: "Estás recuperando lo invertido pero sin margen. Antes de subir presupuesto, apaga el anuncio de peor CPC y deja correr solo el mejor."
      });
    } else if (d.pedidos7d > 0) {
      c.push({
        tono: "mal",
        titulo: `ROAS de ${dec(d.roasReal)}x — estás perdiendo plata`,
        texto: "Entra menos de lo que sale. Baja el presupuesto o pausa el anuncio más caro mientras se arregla la conversión."
      });
    }

    if (m.ctr7d > 0 && m.ctr7d < 1) {
      c.push({
        tono: "mal",
        titulo: `CTR de ${dec(m.ctr7d)}% — el creativo no engancha`,
        texto: "Bajo 1% significa que la gente ve el anuncio y sigue de largo. El problema es el video o el primer renglón del texto, no la segmentación."
      });
    } else if (m.ctr7d >= 3) {
      c.push({
        tono: "bien",
        titulo: `CTR de ${dec(m.ctr7d)}% — muy por encima del promedio`,
        texto: "El referente del sector es 1–2%. El creativo funciona: si algo falla, búscalo de la página hacia adelante, no en el anuncio."
      });
    }

    if (m.frecuencia7d >= 3) {
      c.push({
        tono: "ojo",
        titulo: `Frecuencia de ${dec(m.frecuencia7d, 1)} — se está quemando el público`,
        texto: "Cada persona ya vio tu anuncio más de 3 veces. Amplía el público o cambia el creativo antes de que empiecen a ocultarlo."
      });
    }

    if (m.clics7d >= 30 && d.pedidos7d === 0) {
      c.push({
        tono: "mal",
        titulo: `${nu(m.clics7d)} clics y ningún pedido`,
        texto: "El problema no es el anuncio, es lo que pasa después del clic. Entra a la página desde tu celular y haz el pedido completo: casi siempre aparece ahí."
      });
    }
  } else if (!m?.disponible) {
    c.push({
      tono: "neutro",
      titulo: "Faltan las métricas de Meta",
      texto: m?.motivo || "No se pudo leer la cuenta publicitaria. Sin eso no hay ROAS, CTR ni CPC."
    });
  }

  if (d.enCheckout > 0) {
    c.push({
      tono: "ojo",
      titulo: `${nu(d.enCheckout)} ${d.enCheckout === 1 ? "persona quedó" : "personas quedaron"} a mitad del pedido`,
      texto: "Ya dieron sus datos al bot y se detuvieron. Son los más fáciles de cerrar de todo el embudo: escríbeles hoy desde la pestaña de Recuperación."
    });
  }

  if (d.carritos24h > 0 && d.checkouts24h === 0) {
    c.push({
      tono: "ojo",
      titulo: "Agregan al carrito pero nadie llega al formulario",
      texto: `${nu(d.carritos24h)} carritos y ningún inicio de pedido en 24 horas. Revisa que el botón para continuar se vea sin tener que bajar la página en el celular.`
    });
  }

  if (d.mensajesWa24h > 0 && d.contactos24h === 0) {
    c.push({
      tono: "neutro",
      titulo: "Hay conversaciones que no vienen de la tienda",
      texto: `${nu(d.mensajesWa24h)} mensajes de WhatsApp pero ningún clic registrado desde la web. Están llegando por otro lado: guardaron el número, o los buscaste tú.`
    });
  }

  if (!c.length) {
    c.push({
      tono: "neutro",
      titulo: "Sin alertas por ahora",
      texto: "Ningún número está fuera de rango. Vuelve a mirar en unas horas cuando haya más movimiento."
    });
  }
  return c;
}

export default function InformeEnVivo() {
  const [datos, setDatos] = useState<Datos | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cargando, setCargando] = useState(false);
  const pidiendo = useRef(false);

  const cargar = useCallback(async (forzar = false) => {
    if (pidiendo.current) return;
    pidiendo.current = true;
    setCargando(true);
    try {
      const url = "/api/informe" + (forzar ? "?fresh=1" : "");
      const r = await fetch(url, { headers: { ...adminAuthHeaders() }, cache: "no-store" });
      if (!r.ok) throw new Error(r.status === 404 ? "El informe no está habilitado en el servidor." : `HTTP ${r.status}`);
      const j = await r.json();
      if (!j?.success) throw new Error(j?.error || "Respuesta inesperada del servidor.");
      setDatos(j.datos);
      setError(null);
    } catch (e: any) {
      setError(e?.message || "No se pudo cargar el informe.");
    } finally {
      pidiendo.current = false;
      setCargando(false);
    }
  }, []);

  // Cada hora, no cada minuto: estos números no cambian de un minuto a otro y
  // cada consulta pega a la base y a la API de Meta. Con el panel abierto todo
  // el día, un minuto serían 1.440 consultas diarias para ver lo mismo.
  // Para el dato del momento está el botón "Actualizar".
  useEffect(() => {
    cargar();
    const t = setInterval(() => { if (!document.hidden) cargar(); }, 60 * 60 * 1000);
    return () => clearInterval(t);
  }, [cargar]);

  if (!datos && error) {
    return (
      <div className="bg-neutral-900/60 border border-red-900/40 rounded-3xl p-8 text-center space-y-3">
        <AlertTriangle className="mx-auto text-red-400" size={32} />
        <p className="text-white font-bold">No se pudo cargar el informe</p>
        <p className="text-neutral-400 text-sm max-w-md mx-auto">{error}</p>
        <button onClick={cargar} className="mt-2 px-4 py-2 bg-amber-500/10 text-amber-400 border border-amber-500/30 rounded-xl text-sm font-bold">
          Reintentar
        </button>
      </div>
    );
  }

  if (!datos) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="bg-neutral-900/40 border border-neutral-800 rounded-2xl p-4 h-24 animate-pulse" />
        ))}
      </div>
    );
  }

  const d = datos;
  const m = d.meta;
  const hayMeta = !!m?.disponible;
  const consejos = construirConsejos(d);

  const tonoRoas: Tono = !hayMeta || m.gasto7d <= 0 ? "neutro"
    : d.roasReal >= 2 ? "bien" : d.roasReal >= 1 ? "ojo" : "mal";
  const tonoCtr: Tono = !hayMeta ? "neutro" : m.ctr7d >= 3 ? "bien" : m.ctr7d >= 1 ? "neutro" : "ojo";

  const metricas: Array<[string, string, string]> = hayMeta ? [
    ["Gasto", cop(m.gasto7d), "lo que llevas invertido"],
    ["Impresiones", nu(m.impresiones7d), "veces que se mostró el anuncio"],
    ["Alcance", nu(m.alcance7d), "personas distintas que lo vieron"],
    ["Frecuencia", dec(m.frecuencia7d, 1), "veces por persona · sobre 3 cansa"],
    ["Clics", nu(m.clics7d), "cuántos entraron a la tienda"],
    ["CTR", dec(m.ctr7d) + "%", "qué tan bien engancha · 1–2% es normal"],
    ["CPC", cop(m.cpc7d), "lo que pagas por cada clic"],
    ["CPM", cop(m.cpm7d), "costo por mil impresiones"],
    ["Carritos (Meta)", nu(m.carritos7d), "agregaron al carrito"],
    ["Iniciaron pedido", nu(m.checkouts7d), "llegaron al formulario"],
    ["Compras (Meta)", nu(m.compras7d), "solo lo que Meta alcanza a ver"],
    ["Costo por carrito", m.carritos7d > 0 ? cop(m.gasto7d / m.carritos7d) : "—", "cuánto cuesta un carrito"],
    ["Pedidos reales", nu(d.pedidos7d), "de tu base, incluidos los de WhatsApp"],
    ["CPA real", d.cpaReal > 0 ? cop(d.cpaReal) : "—", "lo que cuesta cada pedido de verdad"],
    ["ROAS real", m.gasto7d > 0 ? dec(d.roasReal) + "x" : "—", "ingresos ÷ gasto"]
  ] : [];

  const embudo: Array<[string, number, string]> = [
    ["Visitas", d.vistas24h, "entraron a la tienda"],
    ["Al carrito", d.carritos24h, "agregaron un producto"],
    ["Iniciaron pedido", d.checkouts24h, "llegaron al formulario"],
    ["Escribieron", d.contactos24h, "tocaron el botón de WhatsApp"],
    ["Mensajes WhatsApp", d.mensajesWa24h, "conversaciones con el bot"]
  ];

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">

      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2 text-[11px] text-neutral-500">
          <span className="w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_0_3px_rgba(52,211,153,0.15)]" />
          <span>Última lectura {new Date(d.generadoEn).toLocaleTimeString("es-CO", { hour: "2-digit", minute: "2-digit" })} · se actualiza solo cada hora</span>
        </div>
        <button
          onClick={() => cargar(true)}
          disabled={cargando}
          className="flex items-center gap-1.5 text-[11px] font-black uppercase bg-amber-500/10 text-amber-400 border border-amber-500/30 px-3 py-1.5 rounded-lg active:scale-95 transition-all disabled:opacity-50"
        >
          <RefreshCw size={13} className={cargando ? "animate-spin" : ""} />
          Actualizar
        </button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <Kpi etiqueta="ROAS real" tono={tonoRoas} icono={<TrendingUp size={12} />}
          valor={hayMeta && m.gasto7d > 0 ? dec(d.roasReal) + "x" : "—"}
          nota={hayMeta && m.gasto7d > 0 ? (d.roasReal >= 1 ? "por cada $1 invertido" : "estás perdiendo plata") : "sin datos de Meta"} />
        <Kpi etiqueta="Gasto 7 días" icono={<Wallet size={12} />}
          valor={hayMeta ? cop(m.gasto7d) : "—"} nota={hayMeta ? "hoy: " + cop(m.gastoHoy) : "sin datos de Meta"} />
        <Kpi etiqueta="Ingresos 7 días" tono={d.ingresos7d > 0 ? "bien" : "neutro"}
          valor={cop(d.ingresos7d)} nota={"ticket: " + cop(d.ticketPromedio)} />
        <Kpi etiqueta="CTR" tono={tonoCtr} icono={<Megaphone size={12} />}
          valor={hayMeta ? dec(m.ctr7d) + "%" : "—"} nota="referente: 1–2%" />
        <Kpi etiqueta="CPA real" valor={d.cpaReal > 0 ? cop(d.cpaReal) : "—"} nota="costo por pedido" />
        <Kpi etiqueta="Pedidos" tono={d.pedidos > 0 ? "bien" : "mal"} icono={<ShoppingCart size={12} />}
          valor={nu(d.pedidos)} nota="total en la base" />
      </div>

      {/* Consejos */}
      <div className="space-y-2.5">
        <h3 className="flex items-center gap-2 text-sm font-black uppercase tracking-wider text-neutral-400">
          <Lightbulb size={15} className="text-amber-400" /> Qué hacer ahora
        </h3>
        {consejos.map((c, i) => {
          const borde = c.tono === "mal" ? "border-red-900/40 bg-red-950/20"
            : c.tono === "ojo" ? "border-amber-900/40 bg-amber-950/20"
            : c.tono === "bien" ? "border-emerald-900/40 bg-emerald-950/20"
            : "border-neutral-800 bg-neutral-900/40";
          const Icono = c.tono === "bien" ? CheckCircle2 : c.tono === "neutro" ? Lightbulb : AlertTriangle;
          return (
            <div key={i} className={`rounded-2xl border p-4 flex gap-3 ${borde}`}>
              <Icono size={17} className={`shrink-0 mt-0.5 ${TONOS[c.tono]}`} />
              <div className="min-w-0">
                <p className={`font-bold text-sm ${TONOS[c.tono]}`}>{c.titulo}</p>
                <p className="text-neutral-400 text-[13px] leading-relaxed mt-0.5">{c.texto}</p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Métricas de anuncios */}
      <div>
        <h3 className="text-sm font-black uppercase tracking-wider text-neutral-400 mb-2.5">Métricas de anuncios · 7 días</h3>
        {hayMeta ? (
          <div className="bg-neutral-900/40 border border-neutral-800 rounded-2xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <tbody>
                  {metricas.map(([k, v, ayuda]) => (
                    <tr key={k} className="border-b border-neutral-800/70 last:border-0">
                      <td className="px-4 py-2.5 text-neutral-300 whitespace-nowrap">{k}</td>
                      <td className="px-4 py-2.5 text-right font-bold text-white tabular-nums whitespace-nowrap">{v}</td>
                      <td className="px-4 py-2.5 text-neutral-500 text-[12px]">{ayuda}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <div className="bg-neutral-900/40 border border-neutral-800 rounded-2xl p-5 text-neutral-400 text-sm">
            {m?.motivo || "Sin datos de Meta."}
          </div>
        )}
      </div>

      {/* Métricas por día */}
      {hayMeta && m.dias?.length > 0 && (
        <div>
          <h3 className="flex items-center gap-2 text-sm font-black uppercase tracking-wider text-neutral-400 mb-2.5">
            <BarChart3 size={15} /> Por día · últimos 14 días
          </h3>
          <BarrasPorDia dias={m.dias} />
        </div>
      )}

      {/* Eventos que de verdad se dispararon */}
      {hayMeta && (
        <div>
          <h3 className="text-sm font-black uppercase tracking-wider text-neutral-400 mb-2.5">
            Eventos registrados por Meta · 7 días
          </h3>
          {m.eventos?.length > 0 ? (
            <div className="bg-neutral-900/40 border border-neutral-800 rounded-2xl overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm min-w-[420px]">
                  <tbody>
                    {m.eventos.map((e) => (
                      <tr key={e.tipo} className="border-b border-neutral-800/70 last:border-0">
                        <td className="px-4 py-2.5 text-neutral-200">{e.etiqueta}</td>
                        <td className="px-4 py-2.5 text-right font-bold text-white tabular-nums whitespace-nowrap">{nu(e.cantidad)}</td>
                        <td className="px-4 py-2.5 text-neutral-600 text-[11px] font-mono">{e.tipo}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <div className="bg-neutral-900/40 border border-neutral-800 rounded-2xl p-5 text-neutral-400 text-sm">
              Meta no registró ningún evento en los últimos 7 días.
            </div>
          )}
          <p className="text-[11px] text-neutral-600 mt-2">
            Son los valores exactos que Meta tiene guardados, sin agrupar ni redondear. El nombre técnico va a la derecha.
          </p>
        </div>
      )}

      {/* Por anuncio */}
      {hayMeta && m.anuncios?.length > 0 && (
        <div>
          <h3 className="text-sm font-black uppercase tracking-wider text-neutral-400 mb-2.5">Rendimiento por anuncio</h3>
          <div className="bg-neutral-900/40 border border-neutral-800 rounded-2xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[520px]">
                <thead>
                  <tr className="bg-neutral-900/80 text-[10px] uppercase tracking-wider text-neutral-500">
                    <th className="px-4 py-2.5 text-left font-medium">Anuncio</th>
                    <th className="px-4 py-2.5 text-right font-medium">Gasto</th>
                    <th className="px-4 py-2.5 text-right font-medium">Clics</th>
                    <th className="px-4 py-2.5 text-right font-medium">CTR</th>
                    <th className="px-4 py-2.5 text-right font-medium">CPC</th>
                    <th className="px-4 py-2.5 text-right font-medium">Carritos</th>
                  </tr>
                </thead>
                <tbody>
                  {m.anuncios.map((a, i) => (
                    <tr key={i} className="border-b border-neutral-800/70 last:border-0">
                      <td className="px-4 py-2.5 text-neutral-200">{a.nombre}</td>
                      <td className="px-4 py-2.5 text-right tabular-nums text-white">{cop(a.gasto)}</td>
                      <td className="px-4 py-2.5 text-right tabular-nums text-neutral-300">{nu(a.clics)}</td>
                      <td className={`px-4 py-2.5 text-right tabular-nums font-bold ${a.ctr >= 3 ? "text-emerald-400" : a.ctr < 1 ? "text-red-400" : "text-neutral-300"}`}>{dec(a.ctr)}%</td>
                      <td className="px-4 py-2.5 text-right tabular-nums text-neutral-300">{cop(a.cpc)}</td>
                      <td className="px-4 py-2.5 text-right tabular-nums text-neutral-300">{nu(a.carritos)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Tráfico real vs lo que ve Meta */}
      {hayMeta && (() => {
        const evs: Record<string, number> = {};
        (m.eventos || []).forEach((e) => { evs[e.tipo] = e.cantidad; });
        const filas: Array<[string, number, number]> = [
          ["Vieron producto", evs["view_content"] || 0, d.vistas7d],
          ["Agregaron al carrito", evs["add_to_cart"] || 0, d.carritos7d],
          ["Iniciaron pedido", evs["initiate_checkout"] || 0, d.checkouts7d],
          ["Escribieron", evs["contact"] || 0, d.contactos7d]
        ];
        return (
          <div>
            <h3 className="text-sm font-black uppercase tracking-wider text-neutral-400 mb-2.5">
              Tráfico real vs lo que ve Meta · 7 días
            </h3>
            <div className="bg-neutral-900/40 border border-neutral-800 rounded-2xl overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm min-w-[420px]">
                  <thead>
                    <tr className="bg-neutral-900/80 text-[10px] uppercase tracking-wider text-neutral-500">
                      <th className="px-4 py-2.5 text-left font-medium">Paso</th>
                      <th className="px-4 py-2.5 text-right font-medium">Meta</th>
                      <th className="px-4 py-2.5 text-right font-medium">Tu tienda</th>
                      <th className="px-4 py-2.5 text-right font-medium">Diferencia</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filas.map(([k, meta, propio]) => (
                      <tr key={k} className="border-b border-neutral-800/70 last:border-0">
                        <td className="px-4 py-2.5 text-neutral-200">{k}</td>
                        <td className="px-4 py-2.5 text-right tabular-nums text-neutral-400">{nu(meta)}</td>
                        <td className="px-4 py-2.5 text-right tabular-nums font-bold text-white">{nu(propio)}</td>
                        <td className="px-4 py-2.5 text-right tabular-nums text-emerald-400 font-bold">
                          {meta > 0 && propio > meta ? "×" + dec(propio / meta, 1) : propio > 0 && meta === 0 ? "solo tú" : "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
            <p className="text-[11px] text-neutral-500 mt-2 leading-relaxed">
              No se contradicen: <b className="text-neutral-400">Meta</b> solo cuenta a quien puede atribuirle a un anuncio, y pierde gente
              por bloqueadores y iPhones con seguimiento restringido. <b className="text-neutral-400">Tu tienda</b> cuenta a todo el que entra,
              venga de donde venga. Para saber si el anuncio rinde, mira Meta; para saber cuánta gente tienes de verdad, mira tu tienda.
            </p>
          </div>
        );
      })()}

      {/* Embudo */}
      <div>
        <h3 className="flex items-center gap-2 text-sm font-black uppercase tracking-wider text-neutral-400 mb-2.5">
          <MessageCircle size={15} /> Embudo · últimas 24 horas
        </h3>
        <div className="bg-neutral-900/40 border border-neutral-800 rounded-2xl overflow-hidden">
          {embudo.map(([k, v, ayuda], i) => {
            const tope = Math.max(...embudo.map(e => e[1] as number), 1);
            const ancho = Math.max(2, Math.round((Number(v) / tope) * 100));
            return (
              <div key={k} className={`px-4 py-3 ${i < embudo.length - 1 ? "border-b border-neutral-800/70" : ""}`}>
                <div className="flex items-baseline justify-between gap-3">
                  <span className="text-neutral-200 text-sm font-medium">{k}</span>
                  <span className="text-white font-black tabular-nums">{nu(v)}</span>
                </div>
                <div className="mt-1.5 h-1.5 bg-neutral-800 rounded-full overflow-hidden">
                  <div className="h-full bg-amber-500/70 rounded-full" style={{ width: ancho + "%" }} />
                </div>
                <div className="text-[11px] text-neutral-500 mt-1">{ayuda}</div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Dónde se cae la gente dentro del formulario */}
      <div>
        <h3 className="text-sm font-black uppercase tracking-wider text-neutral-400 mb-2.5">
          Dentro del formulario · 7 días
        </h3>
        {d.checkouts7d > 0 ? (
          <div className="bg-neutral-900/40 border border-neutral-800 rounded-2xl overflow-hidden">
            {([
              ["Abrieron el formulario", d.checkouts7d, "tocaron pedir"],
              ["Empezaron a escribir", d.formEmpezado7d, "tocaron alguna tecla"],
              ["Se fueron sin terminar", d.formAbandonado7d, "cerraron a mitad"],
              ["Pedidos completados", d.pedidos7d, "llegaron hasta el final"]
            ] as Array<[string, number, string]>).map(([k, v, ayuda], i, arr) => {
              const tope = Math.max(...arr.map(x => x[1]), 1);
              const ancho = Math.max(2, Math.round((v / tope) * 100));
              const ultimo = i === arr.length - 1;
              return (
                <div key={k} className={`px-4 py-3 ${i < arr.length - 1 ? "border-b border-neutral-800/70" : ""}`}>
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="text-neutral-200 text-sm font-medium">{k}</span>
                    <span className={`font-black tabular-nums ${ultimo && v === 0 ? "text-red-400" : "text-white"}`}>{nu(v)}</span>
                  </div>
                  <div className="mt-1.5 h-1.5 bg-neutral-800 rounded-full overflow-hidden">
                    <div className={`h-full rounded-full ${ultimo ? "bg-emerald-500/70" : "bg-amber-500/70"}`} style={{ width: ancho + "%" }} />
                  </div>
                  <div className="text-[11px] text-neutral-500 mt-1">{ayuda}</div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="bg-neutral-900/40 border border-neutral-800 rounded-2xl p-5 text-neutral-400 text-sm">
            Nadie ha abierto el formulario en los últimos 7 días.
          </div>
        )}

        {d.abandonoPorCampo?.length > 0 && (
          <div className="mt-3 bg-neutral-900/40 border border-neutral-800 rounded-2xl overflow-hidden">
            <div className="px-4 py-2.5 bg-neutral-900/80 text-[10px] uppercase tracking-wider text-neutral-500 font-medium">
              ¿En qué campo se quedaron?
            </div>
            {d.abandonoPorCampo.map((f) => (
              <div key={f.campo} className="px-4 py-2.5 border-b border-neutral-800/70 last:border-0 flex items-baseline justify-between gap-3">
                <span className="text-neutral-200 text-sm">{f.campo}</span>
                <span className="text-white font-bold tabular-nums">{nu(f.veces)}</span>
              </div>
            ))}
          </div>
        )}

        <p className="text-[11px] text-neutral-500 mt-2 leading-relaxed">
          Si muchos <b className="text-neutral-400">abren y no escriben</b>, el formulario asusta de entrada.
          Si <b className="text-neutral-400">escriben y se van</b>, mira en qué campo: ahí está el estorbo.
          Si <b className="text-neutral-400">llenan todo y no confirman</b>, el problema es el botón o el precio final.
        </p>
      </div>

      {/* Recorridos: qué hizo cada visita */}
      <div>
        <h3 className="flex items-center gap-2 text-sm font-black uppercase tracking-wider text-neutral-400 mb-2.5">
          <Footprints size={15} /> Recorridos · últimas 24 horas
        </h3>
        {d.recorridos?.length > 0 ? (
          <div className="space-y-2.5">
            {d.recorridos.map((r) => {
              const hora = (t: string) => t ? new Date(t).toLocaleTimeString("es-CO", { hour: "2-digit", minute: "2-digit" }) : "";
              const segundos = r.desde && r.hasta
                ? Math.max(0, Math.round((Date.parse(r.hasta) - Date.parse(r.desde)) / 1000)) : 0;
              const duracion = segundos >= 60 ? `${Math.floor(segundos / 60)} min ${segundos % 60}s` : `${segundos}s`;
              const compro = r.pasos.some((p) => /pedido|compr/i.test(p.texto));
              const seFue = r.pasos.some((p) => /se fue del formulario/i.test(p.texto));
              return (
                <div key={r.visitante} className="bg-neutral-900/40 border border-neutral-800 rounded-2xl overflow-hidden">
                  <div className="px-4 py-2.5 bg-neutral-900/70 flex items-center justify-between gap-3 flex-wrap">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="font-mono text-[11px] text-neutral-500">{r.visitante}</span>
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-neutral-800 text-neutral-300">{r.origen}</span>
                    </div>
                    <div className="flex items-center gap-2 text-[11px]">
                      <span className="text-neutral-500 tabular-nums">{hora(r.desde)} · {duracion}</span>
                      {compro ? <span className="text-emerald-400 font-bold">compró</span>
                        : seFue ? <span className="text-red-400 font-bold">se fue</span>
                        : <span className="text-neutral-500">sin cerrar</span>}
                    </div>
                  </div>
                  <div className="px-4 py-2.5 space-y-1">
                    {r.pasos.map((p, i) => (
                      <div key={i} className="flex gap-2.5 text-[13px] leading-snug">
                        <span className="text-neutral-600 tabular-nums shrink-0 font-mono text-[11px] pt-0.5">{hora(p.hora)}</span>
                        <span className="text-neutral-300 min-w-0">{p.texto}</span>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="bg-neutral-900/40 border border-neutral-800 rounded-2xl p-5 text-neutral-400 text-sm">
            Todavía no hay recorridos. Empiezan a aparecer con las visitas nuevas, porque el código de visitante
            se crea la primera vez que alguien entra después de este cambio.
          </div>
        )}
        <p className="text-[11px] text-neutral-500 mt-2 leading-relaxed">
          El código (<span className="font-mono">v_a7f3k2</span>) es <b className="text-neutral-400">anónimo</b>: un número al azar
          guardado en el navegador. Sirve para enlazar los pasos de una misma visita, no identifica a nadie.
        </p>
      </div>

      {/* Últimos pedidos */}
      <div>
        <h3 className="text-sm font-black uppercase tracking-wider text-neutral-400 mb-2.5">Últimos pedidos</h3>
        <div className="bg-neutral-900/40 border border-neutral-800 rounded-2xl overflow-hidden">
          {d.ultimosPedidos?.length ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[460px]">
                <tbody>
                  {d.ultimosPedidos.map((o, i) => (
                    <tr key={i} className="border-b border-neutral-800/70 last:border-0">
                      <td className="px-4 py-2.5 text-neutral-500 text-[12px] whitespace-nowrap">{o.fecha}</td>
                      <td className="px-4 py-2.5 text-white">{o.cliente}</td>
                      <td className="px-4 py-2.5 text-neutral-400 text-[12px]">{o.producto}</td>
                      <td className="px-4 py-2.5 text-amber-400 text-[12px] whitespace-nowrap">{o.estado}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="p-6 text-center text-neutral-500 text-sm">
              <TrendingDown className="mx-auto mb-2 opacity-40" size={22} />
              Todavía no ha entrado ningún pedido.
            </div>
          )}
        </div>
      </div>

      {d.advertencias?.length > 0 && (
        <div className="bg-neutral-900/40 border border-neutral-800 rounded-2xl p-4">
          <p className="text-[11px] font-black uppercase tracking-wider text-neutral-500 mb-1.5">Datos que no se pudieron leer</p>
          {d.advertencias.map((a, i) => (
            <p key={i} className="text-neutral-400 text-[12px] leading-relaxed">{a}</p>
          ))}
        </div>
      )}
    </motion.div>
  );
}
