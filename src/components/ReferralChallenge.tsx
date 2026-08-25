import React, { useCallback, useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { X, Gift, Users, Clock, Copy, Check, Share2 } from "lucide-react";
import toast from "react-hot-toast";

const NL = String.fromCharCode(10);
const LS_CODE = "jansel_referral_code";
const LS_DEVICE = "jansel_device_id";

type State = {
  code: string;
  invited: number;
  goal: number;
  expiresAt: number;
  msLeft: number;
  expired: boolean;
  unlocked: boolean;
  discountPct: number;
};

// Id de dispositivo estable: sirve para que el dueño del reto no pueda
// contarse a sí mismo como invitado.
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
  const m = String(Math.floor(t / 60)).padStart(2, "0");
  const s = String(t % 60).padStart(2, "0");
  return m + ":" + s;
};

export default function ReferralChallenge({
  open,
  onClose,
  onUnlock,
}: {
  open: boolean;
  onClose: () => void;
  onUnlock?: (pct: number) => void;
}) {
  const [state, setState] = useState<State | null>(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [now, setNow] = useState(Date.now());
  const notified = useRef(false);

  // Reloj local para el contador (no consultamos al servidor cada segundo).
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const refresh = useCallback(async (code: string) => {
    try {
      const r = await fetch("/api/referral/status?code=" + encodeURIComponent(code));
      if (!r.ok) return;
      setState(await r.json());
    } catch {
      /* sin conexión: mantenemos el último estado conocido */
    }
  }, []);

  // Retomar un reto ya empezado al volver a abrir la página.
  useEffect(() => {
    if (!open) return;
    let saved = "";
    try { saved = localStorage.getItem(LS_CODE) || ""; } catch { /* ignore */ }
    if (saved) refresh(saved);
  }, [open, refresh]);

  // Sondeo suave mientras el reto está vivo, para ver entrar a los invitados.
  useEffect(() => {
    if (!open || !state?.code || state.expired || state.unlocked) return;
    const t = setInterval(() => refresh(state.code), 8000);
    return () => clearInterval(t);
  }, [open, state?.code, state?.expired, state?.unlocked, refresh]);

  // Avisar una sola vez al desbloquear.
  useEffect(() => {
    if (state?.unlocked && !notified.current) {
      notified.current = true;
      onUnlock?.(state.discountPct);
      toast.success("Meta cumplida! " + state.discountPct + "% de descuento desbloqueado");
    }
  }, [state?.unlocked, state?.discountPct, onUnlock]);

  const start = async () => {
    setLoading(true);
    try {
      const r = await fetch("/api/referral/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ deviceId: deviceId() }),
      });
      if (!r.ok) throw new Error("No se pudo iniciar el reto");
      const s: State = await r.json();
      try { localStorage.setItem(LS_CODE, s.code); } catch { /* ignore */ }
      notified.current = false;
      setState(s);
    } catch (e: any) {
      toast.error(e?.message || "No se pudo iniciar el reto");
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
    } catch {
      /* el usuario canceló */
    }
  };

  const msLeft = state ? Math.max(0, state.expiresAt - now) : 0;
  const vencido = !!state && msLeft <= 0 && !state.unlocked;

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.92, y: 20 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.92, y: 20 }}
            transition={{ type: "spring", damping: 22 }}
            onClick={(e) => e.stopPropagation()}
            className="relative w-full max-w-md glass-card rounded-3xl border border-amber-500/30 p-6 sm:p-7"
          >
            <button
              onClick={onClose}
              className="absolute top-4 right-4 text-slate-500 hover:text-white transition-colors"
              aria-label="Cerrar"
            >
              <X size={18} />
            </button>

            <div className="text-center space-y-2 mb-5">
              <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-amber-500/15 mb-1">
                <Gift className="text-amber-400" size={26} />
              </div>
              <h2 className="text-2xl font-black leading-tight">
                Invita y <span className="text-gradient-gold">llévate 15% OFF</span>
              </h2>
              <p className="text-slate-400 text-sm leading-relaxed">
                Comparte tu link. Cuando <strong className="text-white">3 personas</strong> entren y dejen su
                WhatsApp, se te aplica <strong className="text-amber-400">15% de descuento</strong> en este pedido.
              </p>
            </div>

            {!state ? (
              <>
                <div className="glass-card rounded-2xl border border-white/10 p-4 mb-4">
                  <div className="flex items-center gap-2 text-amber-400 mb-1">
                    <Clock size={15} />
                    <span className="text-xs font-black uppercase tracking-wider">Tienes 1 hora</span>
                  </div>
                  <p className="text-slate-400 text-xs leading-relaxed">
                    El tiempo empieza a correr cuando aceptas, no antes. Tómate tu momento.
                  </p>
                </div>
                <button
                  onClick={start}
                  disabled={loading}
                  className="w-full bg-gradient-to-r from-amber-400 to-orange-500 text-black font-black text-sm uppercase tracking-widest py-4 rounded-2xl hover:scale-[1.02] active:scale-95 transition-transform disabled:opacity-60"
                >
                  {loading ? "Preparando..." : "Acepto el reto"}
                </button>
              </>
            ) : (
              <>
                <div className="flex items-center justify-between gap-3 mb-4">
                  <div className="flex items-center gap-2">
                    <Users size={16} className="text-amber-400" />
                    <span className="text-lg font-black">
                      {state.invited}
                      <span className="text-slate-500">/{state.goal}</span>
                    </span>
                    <span className="text-slate-400 text-xs">invitados</span>
                  </div>
                  <div
                    className={
                      "flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-black font-mono " +
                      (vencido ? "bg-slate-500/15 text-slate-400" : "bg-red-500/15 text-red-400")
                    }
                  >
                    <Clock size={13} />
                    {vencido ? "VENCIDO" : mmss(msLeft)}
                  </div>
                </div>

                <div className="h-2 rounded-full bg-white/5 overflow-hidden mb-5">
                  <motion.div
                    className="h-full bg-gradient-to-r from-amber-400 to-orange-500"
                    animate={{ width: Math.min(100, (state.invited / state.goal) * 100) + "%" }}
                    transition={{ type: "spring", damping: 20 }}
                  />
                </div>

                {state.unlocked ? (
                  <div className="text-center py-4 space-y-2">
                    <p className="text-4xl">🎉</p>
                    <p className="text-emerald-400 font-black text-lg">¡{state.discountPct}% desbloqueado!</p>
                    <p className="text-slate-400 text-xs">Ya está aplicado en tu carrito.</p>
                  </div>
                ) : vencido ? (
                  <div className="text-center py-4 space-y-3">
                    <p className="text-slate-400 text-sm">Se acabó el tiempo, pero puedes intentarlo otra vez.</p>
                    <button
                      onClick={start}
                      className="w-full bg-white/5 border border-amber-500/30 text-amber-300 font-black text-xs uppercase tracking-widest py-3.5 rounded-2xl hover:bg-amber-500/10 transition-colors"
                    >
                      Reintentar el reto
                    </button>
                  </div>
                ) : (
                  <>
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2">
                      Comparte tu link
                    </p>
                    <div className="grid grid-cols-4 gap-2 mb-3">
                      {[
                        { k: "whatsapp", label: "WhatsApp", cls: "text-emerald-400" },
                        { k: "facebook", label: "Facebook", cls: "text-blue-400" },
                        { k: "telegram", label: "Telegram", cls: "text-sky-400" },
                        { k: "x", label: "X", cls: "text-white" },
                      ].map((n) => (
                        <button
                          key={n.k}
                          onClick={() => share(n.k)}
                          className="glass-card rounded-2xl border border-white/10 py-3 hover:border-amber-400/40 transition-colors"
                        >
                          <span className={"text-[10px] font-black uppercase tracking-wide " + n.cls}>{n.label}</span>
                        </button>
                      ))}
                    </div>

                    <div className="flex gap-2">
                      <button
                        onClick={copy}
                        className="flex-1 flex items-center justify-center gap-2 glass-card rounded-2xl border border-white/10 py-3 text-xs font-bold text-slate-300 hover:border-amber-400/40 transition-colors"
                      >
                        {copied ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
                        {copied ? "Copiado" : "Copiar link"}
                      </button>
                      <button
                        onClick={nativeShare}
                        className="flex-1 flex items-center justify-center gap-2 bg-gradient-to-r from-amber-400 to-orange-500 text-black rounded-2xl py-3 text-xs font-black uppercase tracking-wider"
                      >
                        <Share2 size={14} />
                        Compartir
                      </button>
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

// Pantalla que ve el invitado al entrar por un link con ?ref=CODIGO.
// Pide el WhatsApp porque contamos personas reales, no aperturas.
export function ReferralJoin({ code, onDone }: { code: string; onDone: () => void }) {
  const [phone, setPhone] = useState("");
  const [sending, setSending] = useState(false);
  const [ok, setOk] = useState(false);

  const submit = async () => {
    const clean = phone.replace(/\D/g, "");
    if (clean.length < 10) {
      toast.error("Escribe tu WhatsApp completo");
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
      if (!r.ok) throw new Error(data?.error || "No se pudo registrar");
      setOk(true);
      toast.success("Listo, ya ayudaste a tu amigo!");
      setTimeout(onDone, 1800);
    } catch (e: any) {
      toast.error(e?.message || "No se pudo registrar");
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm">
      <motion.div
        initial={{ scale: 0.92, y: 20 }}
        animate={{ scale: 1, y: 0 }}
        className="w-full max-w-sm glass-card rounded-3xl border border-amber-500/30 p-6 text-center"
      >
        {ok ? (
          <div className="space-y-3 py-4">
            <p className="text-4xl">🙌</p>
            <h2 className="text-xl font-black">¡Gracias!</h2>
            <p className="text-slate-400 text-sm">Ya cuentas para el reto de tu amigo.</p>
          </div>
        ) : (
          <>
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-amber-500/15 mb-3">
              <Gift className="text-amber-400" size={26} />
            </div>
            <h2 className="text-xl font-black leading-tight mb-1">Un amigo te invitó</h2>
            <p className="text-slate-400 text-sm mb-5 leading-relaxed">
              Deja tu WhatsApp y le ayudas a desbloquear su descuento. También te escribimos las ofertas del día.
            </p>
            <input
              type="tel"
              inputMode="numeric"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="Ej: 3001234567"
              className="w-full bg-slate-950 border border-white/10 rounded-2xl px-4 py-3.5 text-white text-center font-mono focus:border-amber-400/50 focus:outline-none mb-3"
            />
            <button
              onClick={submit}
              disabled={sending}
              className="w-full bg-gradient-to-r from-amber-400 to-orange-500 text-black font-black text-xs uppercase tracking-widest py-3.5 rounded-2xl disabled:opacity-60"
            >
              {sending ? "Enviando..." : "Ayudar a mi amigo"}
            </button>
            <button onClick={onDone} className="w-full text-slate-500 text-xs mt-3 hover:text-slate-300 transition-colors">
              Solo quiero ver las ofertas
            </button>
          </>
        )}
      </motion.div>
    </div>
  );
}
