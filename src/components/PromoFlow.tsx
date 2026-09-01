import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Crown, Gift, X, Zap, ChevronRight, Clock, Sparkles, MessageCircle, Truck } from "lucide-react";
import { ACTIVE_PROMOTIONS } from "../lib/promotions";

/* ──────────────────────────────────────────────────────────────────────────
   PromoFlow — Gatillos mentales de Jansel Shop
   Popup de entrada → 3 regalos → ¿qué conduces? → Ruleta Real (amañada) → Combo
   La ruleta SIEMPRE cae en el combo (descuento atractivo, margen sano).
   ────────────────────────────────────────────────────────────────────────── */

const cop = (n: number) => "$" + n.toLocaleString("es-CO");

type ComboKey = "moto" | "carro" | "tech";

// Los precios y nombres salen de ACTIVE_PROMOTIONS, la unica fuente que leen
// tambien la landing, el bot de WhatsApp y las fichas de producto. Antes este
// popup tenia su propia copia con otros precios: el cliente veia "Combo Motero
// $149.900" aqui y "Kit Motero Completo $155.900" en la seccion de abajo, y al
// pedirlo por WhatsApp el bot no reconocia ese nombre y le ofrecia otros.
// Las imagenes se mantienen aqui porque son decorativas de este flujo.
const IMAGENES: Record<ComboKey, { id: string; emoji: string; imgs: { img: string; name: string }[] }> = {
  moto: {
    id: "combo-kit-motero-completo", emoji: "🏍️",
    imgs: [
      { img: "/images/soporte-holder-moto.png", name: "Soporte Holder Moto" },
      { img: "/images/cargador-celular-moto.png", name: "Cargador Celular Moto" },
      { img: "/images/candado-moto-manubrio.png", name: "Candado Antirrobo" },
    ],
  },
  carro: {
    id: "combo-carro-completo", emoji: "🚗",
    imgs: [
      { img: "/images/soporte-de-carga-magnetica.png", name: "Carga Magnética 3 en 1" },
      { img: "/images/iniciador-de-bateria.png", name: "Iniciador de Batería" },
      { img: "/images/carpa-cobertor-carro.png", name: "Carpa Cobertor" },
    ],
  },
  tech: {
    id: "combo-tecnologia-completo", emoji: "📱",
    imgs: [
      { img: "/images/game-stick-retro-m8.png", name: "Game Stick Retro 4K" },
      { img: "/images/aspiradora-de-mano.png", name: "Aspiradora de Mano" },
      { img: "/images/mini-pulidora-inalambrica.png", name: "Mini Pulidora" },
    ],
  },
};

const COMBOS: Record<ComboKey, { label: string; emoji: string; list: number; combo: number; items: { name: string; img: string }[] }> =
  (Object.keys(IMAGENES) as ComboKey[]).reduce((acc, k) => {
    const meta = IMAGENES[k];
    const oficial = ACTIVE_PROMOTIONS.find(c => c.id === meta.id);
    acc[k] = oficial
      ? {
          label: oficial.name,
          emoji: meta.emoji,
          list: oficial.originalPrice,
          combo: oficial.promoPrice,
          items: oficial.productIds.map((_, i) => meta.imgs[i] || meta.imgs[0]),
        }
      : { label: "Combo", emoji: meta.emoji, list: 0, combo: 0, items: [] };
    return acc;
  }, {} as Record<ComboKey, { label: string; emoji: string; list: number; combo: number; items: { name: string; img: string }[] }>);

const GOLD = "linear-gradient(100deg,#B8860B,#F4D77B 50%,#C8971F)";

/* ── Ruleta amañada ── */
const SEG = 45, TARGET = 2;
const WHEEL = ["−5%", "😱 CASI", "👑 COMBO", "ENVÍO 0", "−10%", "✨", "−15%", "🎁"];
const WHEEL_COLORS = ["#2a2620", "#B8860B", "#E23A2E", "#2a2620", "#B8860B", "#2a2620", "#C8971F", "#B8860B"];

function slicePath(cx: number, cy: number, r: number, i: number) {
  const a0 = ((i * SEG - 90) * Math.PI) / 180;
  const a1 = (((i + 1) * SEG - 90) * Math.PI) / 180;
  const x0 = cx + r * Math.cos(a0), y0 = cy + r * Math.sin(a0);
  const x1 = cx + r * Math.cos(a1), y1 = cy + r * Math.sin(a1);
  return `M${cx},${cy} L${x0},${y0} A${r},${r} 0 0 1 ${x1},${y1} Z`;
}

function Wheel({ onDone }: { onDone: () => void }) {
  const [rot, setRot] = useState(0);
  const [spinning, setSpinning] = useState(false);
  const [done, setDone] = useState(false);
  const spin = () => {
    if (spinning || done) return;
    setSpinning(true);
    const jitter = (Math.random() * 2 - 1) * 12;
    const final = 360 * 6 - (TARGET * SEG + SEG / 2) + jitter;
    setRot(final);
    setTimeout(() => { setSpinning(false); setDone(true); onDone(); }, 4300);
  };
  return (
    <div className="flex flex-col items-center mt-4">
      <div className="relative">
        <div
          className="absolute left-1/2 -translate-x-1/2 -top-1 z-10"
          style={{ width: 0, height: 0, borderLeft: "13px solid transparent", borderRight: "13px solid transparent", borderTop: "22px solid #E23A2E", filter: "drop-shadow(0 2px 3px rgba(0,0,0,.4))" }}
        />
        <svg width="290" height="290" viewBox="0 0 300 300" style={{ transform: `rotate(${rot}deg)`, transition: "transform 4.2s cubic-bezier(.16,.7,.28,1)" }}>
          <circle cx="150" cy="150" r="146" fill="none" stroke="#B8860B" strokeWidth="8" />
          {WHEEL.map((l, i) => {
            const mid = ((i * SEG + SEG / 2 - 90) * Math.PI) / 180;
            const tx = 150 + 92 * Math.cos(mid), ty = 150 + 92 * Math.sin(mid);
            return (
              <g key={i}>
                <path d={slicePath(150, 150, 140, i)} fill={WHEEL_COLORS[i]} stroke="#F4D77B" strokeWidth="1.5" />
                <text x={tx} y={ty} fill="#fff" fontSize="15" fontWeight={700} textAnchor="middle" dominantBaseline="middle" transform={`rotate(${i * SEG + SEG / 2}, ${tx}, ${ty})`}>{l}</text>
              </g>
            );
          })}
          <circle cx="150" cy="150" r="24" fill="#14110C" stroke="#F4D77B" strokeWidth="3" />
        </svg>
      </div>
      {!done && (
        <button onClick={spin} disabled={spinning}
          className="mt-5 px-8 py-3.5 rounded-2xl font-black text-sm uppercase tracking-wider text-[#231a05] disabled:opacity-60 cursor-pointer"
          style={{ background: GOLD, boxShadow: "0 6px 18px rgba(184,134,11,.35)" }}>
          {spinning ? "Girando..." : "Girar la ruleta 👑"}
        </button>
      )}
    </div>
  );
}

function useCountdown(seconds: number) {
  const [t, setT] = useState(seconds);
  useEffect(() => {
    const i = setInterval(() => setT((s) => (s > 0 ? s - 1 : 0)), 1000);
    return () => clearInterval(i);
  }, []);
  const mm = String(Math.floor(t / 60)).padStart(2, "0");
  const ss = String(t % 60).padStart(2, "0");
  return `${mm}:${ss}`;
}

const shell = "relative w-full max-w-md rounded-3xl border border-amber-500/20 bg-[#0d0f18] p-7 text-center shadow-2xl";
const title = "text-2xl font-black text-white leading-tight";
const sub = "mt-2 text-sm text-slate-400";

export default function PromoFlow({ officialBotNumber, onPedirFormulario }: { officialBotNumber?: string; onPedirFormulario?: (comboId: string) => void }) {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<"entry" | "gifts" | "vehicle" | "wheel" | "combo">("entry");
  const [cat, setCat] = useState<ComboKey>("moto");
  const [picked, setPicked] = useState<number | null>(null);

  useEffect(() => {
    // NO abrir cuando la persona ya viene decidida. La ficha de producto manda
    // a /landing?add=<id> y el combo a ?combo=<id>: en los dos casos el cliente
    // acaba de tocar "pedir" y la página lo está bajando al formulario. El
    // popup se abría 600 ms después y le tapaba justo el formulario al que iba,
    // con una ruleta que él no pidió. Interrumpir ahí es perder la venta.
    try {
      const q = new URLSearchParams(window.location.search);
      if (q.get("add") || q.get("combo")) return;
    } catch { /* si no se puede leer la URL, sigue el comportamiento normal */ }

    const seen = typeof sessionStorage !== "undefined" && sessionStorage.getItem("jansel_promo_seen");
    if (!seen) {
      const t = setTimeout(() => setOpen(true), 600);
      return () => clearTimeout(t);
    }
  }, []);

  const close = () => {
    setOpen(false);
    try { sessionStorage.setItem("jansel_promo_seen", "1"); } catch {}
  };
  const goProducts = () => {
    close();
    document.getElementById("productos")?.scrollIntoView({ behavior: "smooth" });
  };

  const phone = officialBotNumber || "15072233213";
  const c = COMBOS[cat];
  const wa = (msg: string) => `https://wa.me/${phone}?text=${encodeURIComponent(msg)}`;

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[120] flex items-center justify-center p-4"
          style={{ background: "rgba(4,4,8,.72)", backdropFilter: "blur(6px)" }}
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        >
          <motion.div className={shell} initial={{ y: 24, opacity: 0, scale: .96 }} animate={{ y: 0, opacity: 1, scale: 1 }} exit={{ y: 20, opacity: 0 }}>
            <button onClick={close} className="absolute right-4 top-4 grid h-8 w-8 place-items-center rounded-full border border-white/10 bg-white/5 text-slate-300 cursor-pointer" aria-label="Cerrar">
              <X size={18} />
            </button>

            {/* ENTRY */}
            {step === "entry" && (
              <>
                <Crown size={38} className="mx-auto mb-1 text-amber-400" />
                <h2 className={title}>Bienvenido a Jansel Shop</h2>
                <p className={sub}>Antes de entrar... ¿qué te gustaría hacer?</p>
                <div className="mt-6 flex flex-col gap-3">
                  <button onClick={goProducts} className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 p-4 text-left transition hover:border-amber-400/50 cursor-pointer">
                    <Zap size={22} className="shrink-0 text-amber-400" />
                    <div className="flex-1">
                      <b className="block text-white">Seguir viendo el producto</b>
                      <span className="block text-xs text-slate-400">El del anuncio que te trajo aquí</span>
                    </div>
                    <ChevronRight size={18} className="text-slate-500" />
                  </button>
                  <button onClick={() => setStep("gifts")} className="flex items-center gap-3 rounded-2xl border border-amber-400/40 p-4 text-left transition hover:border-amber-400 cursor-pointer" style={{ background: "linear-gradient(120deg,rgba(184,134,11,.18),rgba(244,215,123,.08))" }}>
                    <Gift size={22} className="shrink-0 text-amber-400" />
                    <div className="flex-1">
                      <b className="block text-white">Ver promociones y regalos</b>
                      <span className="block text-xs text-slate-400">Tienes 3 regalos + ruleta de descuentos 🎁</span>
                    </div>
                    <ChevronRight size={18} className="text-slate-500" />
                  </button>
                </div>
                <button onClick={goProducts} className="mx-auto mt-4 block text-xs font-semibold text-amber-400/80 cursor-pointer">Solo quiero explorar la tienda</button>
              </>
            )}

            {/* GIFTS */}
            {step === "gifts" && (
              <>
                <span className="inline-flex items-center gap-1.5 rounded-full border border-red-500/30 bg-red-500/10 px-3.5 py-1.5 text-xs font-bold text-red-300"><Gift size={14} /> ¡Tienes 3 regalos esperando!</span>
                <h2 className={`${title} mt-3`}>Elige tu regalo sorpresa 🎁</h2>
                <p className={sub}>Toca una caja para descubrir tu descuento del día.</p>
                <div className="mt-6 flex justify-center gap-3">
                  {[0, 1, 2].map((i) => (
                    <button key={i} onClick={() => { setPicked(i); setTimeout(() => setStep("vehicle"), 350); }}
                      className={`flex flex-1 flex-col items-center gap-2 rounded-2xl border-2 border-amber-400/40 p-5 text-xs font-bold text-amber-300 transition hover:-translate-y-1 cursor-pointer ${picked === i ? "scale-95" : ""}`}
                      style={{ background: "linear-gradient(135deg,rgba(255,255,255,.06),rgba(244,215,123,.10))" }}>
                      <Gift size={38} />
                      <span>Regalo {i + 1}</span>
                    </button>
                  ))}
                </div>
              </>
            )}

            {/* VEHICLE */}
            {step === "vehicle" && (
              <>
                <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-500/30 bg-amber-500/10 px-3.5 py-1.5 text-xs font-bold text-amber-300"><Crown size={14} /> Casi listo...</span>
                <h2 className={`${title} mt-3`}>¿Qué conduces tú?</h2>
                <p className={sub}>Así te muestro los productos perfectos para ti.</p>
                <div className="mt-6 grid grid-cols-2 gap-3">
                  {([["moto", "🏍️", "Moto"], ["carro", "🚗", "Carro"], ["carro", "🏍️🚗", "Ambos"], ["tech", "📱", "Solo tecnología"]] as [ComboKey, string, string][]).map(([k, e, l], i) => (
                    <button key={i} onClick={() => { setCat(k); setStep("wheel"); }}
                      className="flex flex-col items-center gap-2 rounded-2xl border border-white/10 bg-white/5 p-4 font-bold text-white transition hover:border-amber-400/60 cursor-pointer">
                      <span className="text-2xl">{e}</span>{l}
                    </button>
                  ))}
                </div>
              </>
            )}

            {/* WHEEL */}
            {step === "wheel" && (
              <>
                <h2 className={title}>Tu Ruleta Real 👑</h2>
                <p className={sub}>Gira y desbloquea tu descuento del <b className="text-amber-400">{c.label}</b>.</p>
                <Wheel onDone={() => setTimeout(() => setStep("combo"), 900)} />
              </>
            )}

            {/* COMBO */}
            {step === "combo" && <ComboReveal cat={cat} wa={wa} onPedirFormulario={onPedirFormulario} onCerrar={close} />}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function ComboReveal({ cat, wa, onPedirFormulario, onCerrar }: { cat: ComboKey; wa: (m: string) => string; onPedirFormulario?: (comboId: string) => void; onCerrar?: () => void }) {
  const c = COMBOS[cat];
  const time = useCountdown(10 * 60);
  const ahorro = c.list - c.combo;
  const msg = `Hola Jansel Shop 👑 Quiero el ${c.label} completo (3 productos) por ${cop(c.combo)} con envío GRATIS y pago contraentrega. Mis datos:`;
  return (
    <>
      <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3.5 py-1.5 text-xs font-bold text-emerald-300"><Sparkles size={14} /> ¡Ganaste un descuento real!</span>
      <Crown size={32} className="mx-auto mt-2 text-amber-400" />
      <h2 className={`${title} mt-1`}>{c.emoji} {c.label}</h2>
      <p className={sub}>Los 3 productos juntos, con un solo envío GRATIS contraentrega.</p>

      <div className="mt-4 flex gap-2">
        {c.items.map((it, i) => (
          <div key={i} className="flex flex-1 flex-col items-center gap-1">
            <div className="aspect-square w-full overflow-hidden rounded-xl border border-white/10 bg-white">
              <img src={it.img} alt={it.name} className="h-full w-full object-cover" />
            </div>
            <span className="text-[10px] leading-tight text-slate-400">{it.name}</span>
          </div>
        ))}
      </div>

      <div className="mt-4 flex items-center justify-center gap-3">
        <span className="text-base text-slate-500 line-through">{cop(c.list)}</span>
        <span className="text-3xl font-black text-white">{cop(c.combo)}</span>
        <span className="rounded-lg bg-emerald-500 px-2.5 py-1 text-xs font-black text-white">Ahorras {cop(ahorro)}</span>
      </div>

      <div className="mt-3 inline-flex items-center justify-center gap-2 rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm font-bold text-red-300">
        <Clock size={16} /> Reservado por <b className="text-white">{time}</b> — luego se pierde
      </div>

      {onPedirFormulario && (
        <button
          onClick={() => { onPedirFormulario(IMAGENES[cat].id); onCerrar?.(); }}
          className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-amber-400 to-orange-500 py-4 text-base font-black uppercase tracking-wider text-black active:scale-95 transition-transform"
        >
          <Zap size={18} /> Pedirlo aquí mismo
        </button>
      )}

      <a href={wa(msg)} target="_blank" rel="noreferrer"
        className="mt-2 flex w-full items-center justify-center gap-2 rounded-2xl border border-[#25D366]/50 bg-[#25D366]/10 py-3 text-sm font-black uppercase tracking-wider text-[#25D366]">
        <MessageCircle size={18} /> Reclamar mi combo por WhatsApp
      </a>
      <p className="mt-2 flex items-center justify-center gap-1.5 text-xs text-slate-400"><Truck size={13} /> No pagas nada ahora. Pagas cuando lo recibas. 🇨🇴</p>
    </>
  );
}
