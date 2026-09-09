// Utility for Native Windows / Android / Mac System Notifications + Sound Synth + Voice Alerts

let audioCtx: AudioContext | null = null;

// ── Voz: robustez contra los bugs de Chrome ─────────────────────────────────
// Chrome tiene dos manías con speechSynthesis que hacían que la voz "dejara de
// hablar sola":
//  1. getVoices() llega VACÍO al cargar la página y se llena después (evento
//     'voiceschanged'). Si se consulta en el momento equivocado, no hay voz.
//  2. El motor se "duerme" tras un rato abierto y speak() ya no suena hasta que
//     se le hace resume(). Por eso funcionaba un rato y luego se callaba.
// Solución: cacheamos las voces cuando lleguen y mantenemos el motor despierto
// con un resume() periódico. Es aditivo y no cambia el comportamiento normal.
let cachedVoices: SpeechSynthesisVoice[] = [];
function refreshVoices() {
  try {
    const v = window.speechSynthesis.getVoices();
    if (v && v.length) cachedVoices = v;
  } catch { /* noop */ }
}
if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
  refreshVoices();
  try { window.speechSynthesis.addEventListener('voiceschanged', refreshVoices); } catch { /* noop */ }
  // Keep-alive: cada 8s revive el motor si Chrome lo dejó en pausa/dormido.
  setInterval(() => {
    try {
      if (window.speechSynthesis.paused) window.speechSynthesis.resume();
    } catch { /* noop */ }
  }, 8000);
}

// 🔓 Desbloqueo automático de la voz.
// Chrome NO deja hablar a speechSynthesis hasta que el usuario interactúa con la
// página (regla de autoplay). Por eso el PRIMER aviso del día no sonaba si el
// admin abría el panel y no tocaba nada. Aquí "primamos" el motor con el primer
// clic/tecla/toque en cualquier parte: hablamos una locución muda para dejarlo
// habilitado, y desde ahí todos los avisos automáticos suenan solos.
let voicePrimed = false;
function primeVoice() {
  if (voicePrimed) return;
  voicePrimed = true;
  try {
    window.speechSynthesis.resume();
    const u = new SpeechSynthesisUtterance(" ");
    u.volume = 0; // mudo: solo sirve para desbloquear el motor
    window.speechSynthesis.speak(u);
  } catch { /* noop */ }
  ["pointerdown", "keydown", "click", "touchstart"].forEach((ev) => {
    try { window.removeEventListener(ev, primeVoice, true); } catch { /* noop */ }
  });
}
if (typeof window !== "undefined" && "speechSynthesis" in window) {
  ["pointerdown", "keydown", "click", "touchstart"].forEach((ev) => {
    try { window.addEventListener(ev, primeVoice, { capture: true, passive: true } as AddEventListenerOptions); } catch { /* noop */ }
  });
}

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (!audioCtx) {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (AudioContextClass) {
      audioCtx = new AudioContextClass();
    }
  }
  if (audioCtx && audioCtx.state === 'suspended') {
    audioCtx.resume().catch(() => {});
  }
  return audioCtx;
}

export function playSoundAlert(type: 'order' | 'message' | 'cart' | 'visitor' | 'alert') {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.connect(gain);
    gain.connect(ctx.destination);

    if (type === 'order') {
      // High bright double chime for orders (C5 -> G5)
      osc.type = 'sine';
      osc.frequency.setValueAtTime(523.25, now);
      osc.frequency.setValueAtTime(783.99, now + 0.15);
      gain.gain.setValueAtTime(0.3, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.6);
      osc.start(now);
      osc.stop(now + 0.6);
    } else if (type === 'cart') {
      // Cheerful cash register chime
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(659.25, now);
      osc.frequency.setValueAtTime(880.00, now + 0.12);
      gain.gain.setValueAtTime(0.25, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.5);
      osc.start(now);
      osc.stop(now + 0.5);
    } else if (type === 'message') {
      // Soft ping
      osc.type = 'sine';
      osc.frequency.setValueAtTime(440, now);
      gain.gain.setValueAtTime(0.2, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
      osc.start(now);
      osc.stop(now + 0.3);
    } else if (type === 'visitor') {
      // Soft ambient pop
      osc.type = 'sine';
      osc.frequency.setValueAtTime(329.63, now);
      gain.gain.setValueAtTime(0.15, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
      osc.start(now);
      osc.stop(now + 0.25);
    } else if (type === 'alert') {
      // Urgent alert beep
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(880, now);
      osc.frequency.setValueAtTime(440, now + 0.15);
      gain.gain.setValueAtTime(0.3, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.5);
      osc.start(now);
      osc.stop(now + 0.5);
    }
  } catch (err) {
    console.warn('[SoundAlert] Audio error:', err);
  }
}

// Cola de voz.
//
// Antes esta función empezaba con speechSynthesis.cancel(), o sea que CADA
// aviso cortaba al anterior. Con dos tipos de evento casi no se notaba, pero
// una visita dispara varios seguidos (entró, agregó al carrito, abrió el
// formulario, empezó a escribir) y todos llegan en el mismo ciclo: se pisaban
// unos a otros y solo alcanzaba a sonar el último, cuando alcanzaba.
//
// Ahora se encolan y se dicen de a uno. La venta es la excepción: esa sí
// interrumpe, porque es lo único que no puede esperar.
export function speakVoiceAlert(text: string, prioritario = false) {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
  if (!text) return;

  try {
    // speechSynthesis YA tiene su propia cola: si se llama speak() varias veces
    // seguidas, el navegador las dice una tras otra.
    //
    // El bug original era el cancel() incondicional al principio: cortaba lo
    // anterior en cada aviso, y como una sola visita dispara varios eventos en
    // el mismo ciclo, se pisaban y solo sonaba el ultimo.
    //
    // El intento siguiente —una cola propia con un flag "hablando"— fue peor:
    // si el navegador no arranca la locucion (pasa cuando aun no ha habido
    // ningun clic en la pagina), onend y onerror no se disparan nunca, el flag
    // se queda encendido y NO VUELVE A HABLAR JAMAS. Antes al menos reintentaba
    // en cada aviso.
    //
    // Asi que se deja la cola del navegador, que es la que si funciona, y el
    // cancel() se reserva para la venta, que es lo unico que puede interrumpir.
    if (prioritario) window.speechSynthesis.cancel();

    // Chrome a veces deja el motor "dormido" (en pausa, o trabado sin pausa
    // aparente) y speak() no suena. Un resume() aquí lo despierta; si no estaba
    // en pausa, no hace nada. Esto es lo que evita que la voz se quede muda.
    try { window.speechSynthesis.resume(); } catch { /* noop */ }

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'es-CO';
    utterance.rate = 1.05;
    utterance.pitch = 1.0;
    utterance.volume = 1.0;

    // Usamos las voces cacheadas (que sí están listas); si aún no, pedimos en vivo.
    const voices = (cachedVoices.length ? cachedVoices : window.speechSynthesis.getVoices()) || [];
    const spanishVoice = voices.find(v => v.lang.startsWith('es'));
    if (spanishVoice) utterance.voice = spanishVoice;

    utterance.onerror = (e: any) => {
      console.warn('[Voz] No se pudo decir el aviso:', e?.error || e);
    };

    window.speechSynthesis.speak(utterance);
  } catch (err) {
    console.warn('[SpeechSynthesis] Error speaking:', err);
  }
}

export async function requestNotificationPermission(): Promise<boolean> {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    alert('Tu navegador no soporta notificaciones nativas de sistema.');
    return false;
  }
  if (Notification.permission === 'granted') {
    return true;
  }
  if (Notification.permission !== 'denied') {
    const permission = await Notification.requestPermission();
    return permission === 'granted';
  }
  return false;
}

export function sendNativeBannerNotification(title: string, options?: Record<string, any>) {
  if (typeof window === 'undefined' || !('Notification' in window)) return;

  if (Notification.permission === 'granted') {
    try {
      const defaultIcon = 'https://cdn-icons-png.flaticon.com/512/2645/2645897.png';
      const notification = new Notification(title, {
        icon: defaultIcon,
        badge: defaultIcon,
        ...options,
      } as any);

      notification.onclick = () => {
        window.focus();
        notification.close();
      };
    } catch (e) {
      console.warn('[Notification] Banner error:', e);
    }
  }
}

export async function triggerNativeEventAlert(event: {
  title: string;
  body: string;
  voiceText: string;
  type: 'order' | 'message' | 'cart' | 'visitor' | 'alert';
  enabled: boolean;
}) {
  if (!event.enabled) return;

  // La venta es lo único que interrumpe lo que se esté diciendo.
  const esVenta = event.type === 'order';

  // 1. Play synth sound chime
  playSoundAlert(event.type);

  // 2. Speak voice alert in Spanish
  speakVoiceAlert(event.voiceText, esVenta);

  // 3. Send system Windows / Android / Mac notification banner
  sendNativeBannerNotification(event.title, {
    body: event.body,
    tag: `alert_${event.type}_${Date.now()}`,
  });
}
