// Utility for Native Windows / Android / Mac System Notifications + Sound Synth + Voice Alerts

let audioCtx: AudioContext | null = null;

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

export function speakVoiceAlert(text: string) {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
  try {
    window.speechSynthesis.cancel(); // Stop previous voice speech
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'es-CO'; // Spanish
    utterance.rate = 1.05;
    utterance.pitch = 1.0;
    utterance.volume = 1.0;

    const voices = window.speechSynthesis.getVoices();
    const spanishVoice = voices.find(v => v.lang.startsWith('es'));
    if (spanishVoice) {
      utterance.voice = spanishVoice;
    }

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

  // 1. Play synth sound chime
  playSoundAlert(event.type);

  // 2. Speak voice alert in Spanish
  speakVoiceAlert(event.voiceText);

  // 3. Send system Windows / Android / Mac notification banner
  sendNativeBannerNotification(event.title, {
    body: event.body,
    tag: `alert_${event.type}_${Date.now()}`,
  });
}
