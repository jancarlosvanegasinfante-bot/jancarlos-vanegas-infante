import React, { useCallback, useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { X, Gift, Users, Clock, Copy, Check, Share2, ShoppingCart, AlertCircle, MessageCircle, Zap } from "lucide-react";
import toast from "react-hot-toast";

const LS_CODE = "jansel_referral_code";
const LS_DEVICE = "jansel_device_id";
// Igual que en la ficha de producto: el respaldo es el numero REAL, no el
// sandbox de Twilio, y si la configuracion responde se usa el que este alli.
const WA_NUMBER = "15072233213";

// Productos que "caen" al carrito en la animacion del encabezado.
const FALLING = [
  "/images/game-stick-retro-m8.png",
  "/images/aspiradora-de-mano.png",
  "/images/soporte-de-carga-magnetica.png",
  "/images/mini-pulidora-inalambrica.png",
];

type State = {
  code: string;
  invited: number;
  goal: number;
  expiresAt: number;
  expired: boolean;
  unlocked: boolean;
  discountPct: number;
};

const deviceId = (): string => {
  try {
    let d = localStorage.getItem(LS_DEVICE);
    if (!d) {
      d = Math.random().toString(36).slice(2) + Date.now().toString(36);
      localStorage.setItem(LS_DEVICE, d);
    }
    return d;
  } catch {
    return "anon";
  }
};

const mmss = (ms: number) => {
  const t = Math.max(0, Math.floor(ms / 1000));
  return String(Math.floor(t / 60)).padStart(2, "0") + ":" + String(t % 60).padStart(2, "0");
};

// ── Animacion 3D: los productos caen y entran al carrito ─────────────────────
function FallingCart({ celebrate = false }: { celebrate?: boolean }) {
  return (
    <div className="relative h-28 mb-1" style={{ perspective: "600px" }}>
      {FALLING.map((src, i) => (
        <motion.img
          key={src}
          src={src}
          alt=""
          aria-hidden="true"
          className="absolute w-11 h-11 object-contain drop-shadow-[0_6px_12px_rgba(0,0,0,0.5)]"
          style={{ left: 18 + i * 22 + "%", transformStyle: "preserve-3d" }}
          initial={{ y: -50, opacity: 0, rotateX: -60, rotateZ: -25, scale: 1.1 }}
          animate={{
            y: [-50, 46, 52],
            opacity: [0, 1, 1, 0],
            rotateX: [-60, 20, 0],
            rotateZ: [-25, 12, 0],
            scale: [1.1, 0.85, 0.4],
          }}
          transition={{
            duration: 2.1,
            delay: i * 0.45,
            repeat: Infinity,
            repeatDelay: 1.4,
            ease: "easeIn",
            times: [0, 0.55, 0.8, 1],
          }}
          onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
        />
      ))}

      <motion.div
        className="absolute left-1/2 -translate-x-1/2 bottom-0 w-16 h-16 rounded-2xl bg-amber-500/15 border border-amber-400/40 flex items-center justify-center"
        animate={celebrate ? { scale: [1, 1.16, 1], rotate: [0, -6, 6, 0] } : { scale: [1, 1.06, 1] }}
        transition={{ duration: celebrate ? 0.6 : 1.8, repeat: Infinity, repeatDelay: celebrate ? 0.2 : 0.6 }}
        style={{ transformStyle: "preserve-3d" }}
      >
        <ShoppingCart className="text-amber-400" size={28} />
      </motion.div>
    </div>
  );
}

// Confeti sin librerias: cuadritos animados que caen al desbloquear.
export function Confetti() {
  const bits = Array.from({ length: 26 }, (_, i) => i);
  const colors = ["#fbbf24", "#f97316", "#34d399", "#60a5fa", "#f43f5e"];
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-3xl">
      {bits.map((i) => (
        <motion.span
          key={i}
          className="absolute w-2 h-2.5 rounded-[2px]"
          style={{ left: (i * 3.9) % 100 + "%", background: colors[i % colors.length] }}
          initial={{ y: -20, opacity: 1, rotate: 0 }}
          animate={{ y: 420, opacity: [1, 1, 0], rotate: 360 * (i % 2 ? 1 : -1) }}
          transition={{ duration: 2.4 + (i % 5) * 0.3, delay: (i % 8) * 0.12, ease: "easeIn" }}
        />
      ))}
    </div>
  );
}

export default function ReferralChallenge({
  open,
  onClose,
  onUnlock,
  minItems = 2,
}: {
  open: boolean;
  onClose: () => void;
  onUnlock?: (pct: number) => void;
  minItems?: number;
}) {
  const [state, setState] = useState<State | null>(null);
  const [loading, setLoading] = useState(false);
  // Mientras se consulta el reto guardado no se puede mostrar "Acepto el reto":
  // si el usuario lo pulsaba en ese instante se creaba un codigo NUEVO y el link
  // que ya habia compartido quedaba huerfano, con sus invitados contando para un
  // reto que el ya no estaba mirando.
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const [now, setNow] = useState(Date.now());
  const notified = useRef(false);

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const refresh = useCallback(async (code: string): Promise<void> => {
    try {
      const r = await fetch("/api/referral/status?code=" + encodeURIComponent(code));
      if (!r.ok) return;
      setState(await r.json());
    } catch {
      /* sin conexion: conservamos el ultimo estado */
    }
  }, []);

  useEffect(() => {
    if (!open) return;
    let saved = "";
    try { saved = localStorage.getItem(LS_CODE) || ""; } catch { /* ignore */ }
    if (!saved) { setCargando(false); return; }
    setCargando(true);
    refresh(saved).finally(() => setCargando(false));
  }, [open, refresh]);

  useEffect(() => {
    if (!open || !state?.code || state.expired || state.unlocked) return;
    const t = setInterval(() => refresh(state.code), 8000);
    return () => clearInterval(t);
  }, [open, state?.code, state?.expired, state?.unlocked, refresh]);

  useEffect(() => {
    if (state?.unlocked && !notified.current) {
      notified.current = true;
      onUnlock?.(state.discountPct);
    }
  }, [state?.unlocked, state?.discountPct, onUnlock]);

  const start = async () => {
    setLoading(true);
    setError("");
    try {
      // Si ya hay un reto vigente guardado, se retoma en vez de crear otro: crear
      // uno nuevo invalidaria el link que el cliente ya compartio con sus amigos.
      let guardado = "";
      try { guardado = localStorage.getItem(LS_CODE) || ""; } catch { /* ignore */ }
      if (guardado) {
        const prev = await fetch("/api/referral/status?code=" + encodeURIComponent(guardado));
        if (prev.ok) {
          const est = await prev.json();
          if (est && !est.expired) { setState(est); return; }
        }
      }
      const r = await fetch("/api/referral/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ deviceId: deviceId() }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data?.error || "No se pudo iniciar el reto");
      try { localStorage.setItem(LS_CODE, data.code); } catch { /* ignore */ }
      notified.current = false;
      setState(data);
    } catch (e: any) {
      const m = e?.message || "No se pudo iniciar el reto";
      setError(m);
      toast.error(m);
    } finally {
      setLoading(false);
    }
  };

  const link = state ? window.location.origin + "/landing?ref=" + state.code : "";
  const invite = "Mira estas ofertas de Jan Sel Shop! Entra por mi link y me ayudas a desbloquear un descuento:";

  const share = (net: string) => {
    const text = encodeURIComponent(invite + " " + link);
    const url = encodeURIComponent(link);
    const dest: Record<string, string> = {
      whatsapp: "https://wa.me/?text=" + text,
      facebook: "https://www.facebook.com/sharer/sharer.php?u=" + url,
      telegram: "https://t.me/share/url?url=" + url + "&text=" + encodeURIComponent(invite),
      x: "https://twitter.com/intent/tweet?text=" + text,
    };
    window.open(dest[net], "_blank", "noopener");
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      toast.success("Link copiado");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("No se pudo copiar, seleccionalo a mano");
    }
  };

  const nativeShare = async () => {
    if (!navigator.share) return share("whatsapp");
    try {
      await navigator.share({ title: "Jan Sel Shop", text: invite, url: link });
    } catch { /* cancelado */ }
  };

  const msLeft = state ? Math.max(0, state.expiresAt - now) : 0;
  const vencido = !!state && msLeft <= 0 && !state.unlocked;
  const pct = state ? Math.min(100, (state.invited / state.goal) * 100) : 0;

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm"
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.9, y: 30, rotateX: 8 }}
            animate={{ scale: 1, y: 0, rotateX: 0 }}
            exit={{ scale: 0.9, y: 30 }}
            transition={{ type: "spring", damping: 20 }}
            onClick={(e) => e.stopPropagation()}
            className="relative w-full max-w-md glass-card rounded-3xl border border-amber-500/30 p-6 sm:p-7 overflow-hidden"
            style={{ transformStyle: "preserve-3d" }}
          >
            {state?.unlocked && <Confetti />}

            <button onClick={onClose} className="absolute top-4 right-4 z-10 text-slate-500 hover:text-white transition-colors" aria-label="Cerrar">
              <X size={18} />
            </button>

            <div className="relative text-center space-y-1 mb-4">
              <FallingCart celebrate={!!state?.unlocked} />
              <h2 className="text-2xl font-black leading-tight">
                Invita y <span className="text-gradient-gold">llévate 15% OFF</span>
              </h2>
              <p className="text-slate-400 text-sm leading-relaxed px-1">
                Comparte tu link. Cuando <strong className="text-white">3 personas</strong> entren y dejen su
                WhatsApp, se te aplica <strong className="text-amber-400">15% de descuento</strong>.
              </p>
              <p className="text-slate-500 text-[11px]">
                Válido llevando {minItems} productos o más · Envío gratis
              </p>
            </div>

            {error && (
              <div className="flex items-start gap-2 bg-red-500/10 border border-red-500/20 rounded-2xl px-3 py-2.5 mb-3">
                <AlertCircle size={14} className="text-red-400 mt-0.5 shrink-0" />
                <span className="text-red-300 text-xs">{error}</span>
              </div>
            )}

            {cargando ? (
              <p className="text-center text-slate-400 text-sm py-6">Cargando tu reto…</p>
            ) : !state ? (
              <>
                <div className="glass-card rounded-2xl border border-white/10 p-4 mb-4">
                  <div className="flex items-center gap-2 text-amber-400 mb-1">
                    <Clock size={15} />
                    <span className="text-xs font-black uppercase tracking-wider">Tienes 1 hora</span>
                  </div>
                  <p className="text-slate-400 text-xs leading-relaxed">
                    El tiempo empieza cuando aceptas, no antes. Tómate tu momento.
                  </p>
                </div>
                <motion.button
                  onClick={start} disabled={loading}
                  whileTap={{ scale: 0.96 }}
                  animate={{ boxShadow: ["0 0 0 rgba(251,191,36,0)", "0 0 22px rgba(251,191,36,0.35)", "0 0 0 rgba(251,191,36,0)"] }}
                  transition={{ duration: 2, repeat: Infinity }}
                  className="w-full bg-gradient-to-r from-amber-400 to-orange-500 text-black font-black text-sm uppercase tracking-widest py-4 rounded-2xl disabled:opacity-60"
                >
                  {loading ? "Preparando..." : "Acepto el reto"}
                </motion.button>
              </>
            ) : (
              <>
                <div className="flex items-center justify-between gap-3 mb-3">
                  <div className="flex items-center gap-2">
                    <Users size={16} className="text-amber-400" />
                    <span className="text-lg font-black">
                      {state.invited}<span className="text-slate-500">/{state.goal}</span>
                    </span>
                    <span className="text-slate-400 text-xs">invitados</span>
                  </div>
                  <motion.div
                    animate={vencido ? {} : { scale: [1, 1.07, 1] }}
                    transition={{ duration: 1, repeat: Infinity }}
                    className={"flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-black font-mono " +
                      (vencido ? "bg-slate-500/15 text-slate-400" : "bg-red-500/15 text-red-400")}
                  >
                    <Clock size={13} />
                    {vencido ? "VENCIDO" : mmss(msLeft)}
                  </motion.div>
                </div>

                <div className="flex gap-1.5 mb-4">
                  {Array.from({ length: state.goal }).map((_, i) => (
                    <motion.div
                      key={i}
                      className={"flex-1 h-2.5 rounded-full " + (i < state.invited ? "bg-gradient-to-r from-amber-400 to-orange-500" : "bg-white/8")}
                      animate={i < state.invited ? { scale: [1, 1.08, 1] } : {}}
                      transition={{ duration: 0.4 }}
                    />
                  ))}
                </div>

                {state.unlocked ? (
                  <motion.div initial={{ scale: 0.85 }} animate={{ scale: 1 }} className="text-center py-4 space-y-2">
                    <motion.p className="text-5xl" animate={{ rotate: [0, -12, 12, 0], scale: [1, 1.15, 1] }} transition={{ duration: 0.8, repeat: 2 }}>🎉</motion.p>
                    <p className="text-emerald-400 font-black text-xl">¡{state.discountPct}% desbloqueado!</p>
                    <p className="text-slate-400 text-xs">Ya está aplicado en tu carrito.</p>
                  </motion.div>
                ) : vencido ? (
                  <div className="text-center py-3 space-y-3">
                    <p className="text-slate-400 text-sm">Se acabó el tiempo, pero puedes intentarlo otra vez.</p>
                    <button onClick={start} className="w-full bg-white/5 border border-amber-500/30 text-amber-300 font-black text-xs uppercase tracking-widest py-3.5 rounded-2xl hover:bg-amber-500/10 transition-colors">
                      Reintentar el reto
                    </button>
                  </div>
                ) : (
                  <>
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2">Comparte tu link</p>
                    <div className="grid grid-cols-4 gap-2 mb-3">
                      {[
                        { k: "whatsapp", label: "WhatsApp", cls: "text-emerald-400" },
                        { k: "facebook", label: "Facebook", cls: "text-blue-400" },
                        { k: "telegram", label: "Telegram", cls: "text-sky-400" },
                        { k: "x", label: "X", cls: "text-white" },
                      ].map((n) => (
                        <motion.button
                          key={n.k} onClick={() => share(n.k)} whileTap={{ scale: 0.92 }} whileHover={{ y: -2 }}
                          className="glass-card rounded-2xl border border-white/10 py-3 hover:border-amber-400/40 transition-colors"
                        >
                          <span className={"text-[10px] font-black uppercase tracking-wide " + n.cls}>{n.label}</span>
                        </motion.button>
                      ))}
                    </div>
                    <div className="flex gap-2">
                      <button onClick={copy} className="flex-1 flex items-center justify-center gap-2 glass-card rounded-2xl border border-white/10 py-3 text-xs font-bold text-slate-300 hover:border-amber-400/40 transition-colors">
                        {copied ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
                        {copied ? "Copiado" : "Copiar link"}
                      </button>
                      <motion.button whileTap={{ scale: 0.95 }} onClick={nativeShare} className="flex-1 flex items-center justify-center gap-2 bg-gradient-to-r from-amber-400 to-orange-500 text-black rounded-2xl py-3 text-xs font-black uppercase tracking-wider">
                        <Share2 size={14} />
                        Compartir
                      </motion.button>
                    </div>
                  </>
                )}
              </>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// ── Pantalla del invitado (llega por ?ref=CODIGO) ────────────────────────────
export function ReferralJoin({ code, onDone }: { code: string; onDone: () => void }) {
  const [phone, setPhone] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [reward, setReward] = useState<{ discountPct: number; hours: number; minItems: number; waText: string } | null>(null);

  const submit = async () => {
    const clean = phone.replace(/\D/g, "");
    setError("");
    if (clean.length < 10) {
      setError("Escribe tu WhatsApp completo (10 dígitos)");
      return;
    }
    setSending(true);
    try {
      const r = await fetch("/api/referral/join", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code, phone: clean, deviceId: deviceId() }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data?.error || "No se pudo registrar, intenta de nuevo");
      setReward(data.guest || { discountPct: 15, hours: 24, minItems: 2, waText: "" });
      toast.success("¡Listo! Ganaste tu descuento");
    } catch (e: any) {
      const m = e?.message || "No se pudo registrar";
      setError(m);
      toast.error(m);
    } finally {
      setSending(false);
    }
  };

  const claim = () => {
    const text = reward?.waText || "Hola! Acabo de ganar mi descuento, quiero ver el catalogo";
    window.open("https://wa.me/" + WA_NUMBER + "?text=" + encodeURIComponent(text), "_blank");
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/90 backdrop-blur-sm">
      <motion.div
        initial={{ scale: 0.9, y: 25 }} animate={{ scale: 1, y: 0 }}
        transition={{ type: "spring", damping: 20 }}
        className="relative w-full max-w-sm glass-card rounded-3xl border border-amber-500/30 p-6 text-center overflow-hidden"
      >
        {reward ? (
          <>
            <Confetti />
            <div className="relative space-y-3 py-2">
              <motion.p className="text-6xl" animate={{ rotate: [0, -14, 14, 0], scale: [1, 1.18, 1] }} transition={{ duration: 0.9, repeat: 2 }}>🎁</motion.p>
              <h2 className="text-2xl font-black leading-tight">
                ¡Ganaste <span className="text-gradient-gold">{reward.discountPct}% OFF</span>!
              </h2>
              <p className="text-slate-400 text-sm leading-relaxed">
                Válido por {reward.hours} horas en lo que quieras del catálogo, llevando {reward.minItems} productos o más.
              </p>
              {/* El formulario primero, igual que en el resto de la tienda: cerrar
                  aqui no obliga al cliente a cambiar de app ni a esperar respuesta.
                  WhatsApp queda como alternativa para quien prefiera escribir. */}
              <motion.button
                onClick={onDone}
                whileTap={{ scale: 0.96 }}
                animate={{ boxShadow: ["0 0 0 rgba(251,191,36,0)", "0 0 24px rgba(251,191,36,0.4)", "0 0 0 rgba(251,191,36,0)"] }}
                transition={{ duration: 1.8, repeat: Infinity }}
                className="w-full bg-gradient-to-r from-amber-400 to-orange-500 text-black font-black text-xs uppercase tracking-widest py-4 rounded-2xl flex items-center justify-center gap-2"
              >
                <Zap size={16} />
                Ver ofertas y pedir aquí
              </motion.button>
              <button
                onClick={claim}
                className="w-full border border-[#25D366]/50 bg-[#25D366]/10 text-[#25D366] font-black text-[11px] uppercase tracking-widest py-3 rounded-2xl flex items-center justify-center gap-2"
              >
                <MessageCircle size={15} />
                O reclamar por WhatsApp
              </button>
            </div>
          </>
        ) : (
          <>
            <FallingCart />
            <h2 className="text-xl font-black leading-tight mb-1">Un amigo te invitó</h2>
            <p className="text-slate-400 text-sm mb-4 leading-relaxed">
              Deja tu WhatsApp, le ayudas a desbloquear su descuento y <strong className="text-amber-400">tú también ganas 15% OFF</strong>.
            </p>
            <input
              type="tel" inputMode="numeric" value={phone}
              onChange={(e) => { setPhone(e.target.value); if (error) setError(""); }}
              onKeyDown={(e) => { if (e.key === "Enter") submit(); }}
              placeholder="Ej: 3001234567"
              className={"w-full bg-slate-950 border rounded-2xl px-4 py-3.5 text-white text-center font-mono focus:outline-none mb-2 " +
                (error ? "border-red-500/50" : "border-white/10 focus:border-amber-400/50")}
            />
            {error && (
              <div className="flex items-center justify-center gap-1.5 mb-2">
                <AlertCircle size={13} className="text-red-400 shrink-0" />
                <span className="text-red-300 text-xs">{error}</span>
              </div>
            )}
            <motion.button
              onClick={submit} disabled={sending} whileTap={{ scale: 0.96 }}
              className="w-full bg-gradient-to-r from-amber-400 to-orange-500 text-black font-black text-xs uppercase tracking-widest py-3.5 rounded-2xl disabled:opacity-60"
            >
              {sending ? "Enviando..." : "Ayudar a mi amigo"}
            </motion.button>
            <button onClick={onDone} className="w-full text-slate-500 text-xs mt-3 hover:text-slate-300 transition-colors">
              Solo quiero ver las ofertas
            </button>
          </>
        )}
      </motion.div>
    </div>
  );
}
