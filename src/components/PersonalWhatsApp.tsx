import { useEffect, useRef, useState, type CSSProperties } from "react";
import { adminAuthHeaders } from "../supabase";
import { speakVoiceAlert, playSoundAlert } from "../utils/nativeNotifications";

// Sección AISLADA del panel: conecta el WhatsApp PERSONAL por QR (Baileys),
// muestra el estado en tiempo real y una división aparte con los mensajes que
// captura (solo clientes que preguntan por productos). No toca nada del bot.

type WaStatus = {
  enabled: boolean; connecting: boolean; connected: boolean;
  qr: string | null; phone: string | null;
  lastConnectedAt: number | null; lastError: string | null; capturados: number;
};

type PmMsg = { id: string; telefono?: string; texto?: string; createdAt?: string };

export default function PersonalWhatsApp() {
  const [status, setStatus] = useState<WaStatus | null>(null);
  const [messages, setMessages] = useState<PmMsg[]>([]);
  const lastMsgIdRef = useRef<string | null>(null);
  const lastCapturadosRef = useRef<number>(0);
  const firstLoadRef = useRef(true);

  async function cargarEstado() {
    try {
      const r = await fetch("/api/admin/personal-wa/status", { headers: { ...adminAuthHeaders() } });
      if (!r.ok) return;
      const s: WaStatus = await r.json();
      setStatus(s);
      // La voz de PEDIDO capturado se dispara a nivel GLOBAL en App.tsx (para que
      // suene desde cualquier pantalla). Aquí solo actualizamos el estado.
      lastCapturadosRef.current = s.capturados || 0;
    } catch { /* noop */ }
  }

  async function cargarMensajes() {
    try {
      const r = await fetch("/api/admin/personal-wa/messages", { headers: { ...adminAuthHeaders() } });
      if (!r.ok) return;
      const { messages: msgs } = await r.json();
      const lista: PmMsg[] = Array.isArray(msgs) ? msgs : [];
      // Voz distinta cuando entra un mensaje NUEVO de un cliente por el personal.
      if (!firstLoadRef.current && lista.length && lista[0]?.id && lista[0].id !== lastMsgIdRef.current) {
        playSoundAlert("message");
        speakVoiceAlert("Nuevo mensaje de un cliente por tu WhatsApp personal.", false);
      }
      if (lista[0]?.id) lastMsgIdRef.current = lista[0].id;
      setMessages(lista);
    } catch { /* noop */ }
  }

  useEffect(() => {
    let vivo = true;
    const tick = async () => {
      if (!vivo) return;
      await cargarEstado();
      await cargarMensajes();
      firstLoadRef.current = false;
    };
    tick();
    const iv = setInterval(tick, 2000);
    return () => { vivo = false; clearInterval(iv); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function desconectar() {
    try {
      await fetch("/api/admin/personal-wa/logout", { method: "POST", headers: { ...adminAuthHeaders(), "Content-Type": "application/json" }, body: "{}" });
      lastCapturadosRef.current = 0;
    } catch { /* noop */ }
  }

  const conectado = !!status?.connected;
  const conectando = !!status?.connecting;

  return (
    <div style={{ maxWidth: 900, margin: "0 auto", padding: "1rem" }}>
      {/* ── Tarjeta de conexión / QR ── */}
      <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 16, padding: "1.2rem", marginBottom: "1.2rem" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
          <span style={{ fontSize: 22 }}>📲</span>
          <h2 style={{ margin: 0, fontSize: "1.1rem", color: "#fff" }}>WhatsApp personal (captura de pedidos)</h2>
          <span style={{
            marginLeft: "auto", fontSize: 12, fontWeight: 800, padding: "4px 10px", borderRadius: 999,
            background: conectado ? "rgba(34,197,94,0.15)" : conectando ? "rgba(251,191,36,0.15)" : "rgba(239,68,68,0.15)",
            color: conectado ? "#22c55e" : conectando ? "#fbbf24" : "#ef4444",
          }}>
            {conectado ? "🟢 Conectado" : conectando ? "🟡 Conectando…" : "🔴 Desconectado"}
          </span>
        </div>

        {conectado ? (
          <div style={{ color: "#cbd5e1", fontSize: 14 }}>
            Conectado como <strong style={{ color: "#fff" }}>+{status?.phone || "?"}</strong>.
            Está escuchando <strong>solo</strong> mensajes nuevos de clientes que preguntan por productos.
            <div style={{ marginTop: 6, fontSize: 13, color: "#94a3b8" }}>
              Pedidos capturados en esta sesión: <strong style={{ color: "#22c55e" }}>{status?.capturados ?? 0}</strong>
            </div>
            <button onClick={desconectar} style={btnStyle("#ef4444")}>Desconectar / re-escanear</button>
          </div>
        ) : status?.qr ? (
          <div style={{ textAlign: "center" }}>
            <p style={{ color: "#cbd5e1", fontSize: 14, marginTop: 0 }}>
              Escanea este QR desde tu WhatsApp → <strong>Dispositivos vinculados → Vincular un dispositivo</strong>
            </p>
            <img src={status.qr} alt="QR de WhatsApp" style={{ width: 260, height: 260, borderRadius: 12, background: "#fff", padding: 8 }} />
            <p style={{ color: "#64748b", fontSize: 12 }}>El QR se refresca solo. Si expira, espera unos segundos.</p>
          </div>
        ) : (
          <div style={{ color: "#94a3b8", fontSize: 14 }}>
            {status?.lastError ? `Estado: ${status.lastError}. ` : ""}Generando código QR… espera unos segundos.
            <button onClick={desconectar} style={btnStyle("#334155")}>Reintentar</button>
          </div>
        )}
      </div>

      {/* ── División de mensajes capturados (reportes del personal) ── */}
      <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 16, padding: "1.2rem" }}>
        <h3 style={{ margin: "0 0 10px", fontSize: "1rem", color: "#fff", display: "flex", alignItems: "center", gap: 8 }}>
          💬 Mensajes de clientes (WhatsApp personal)
          <span style={{ fontSize: 12, color: "#64748b" }}>· {messages.length}</span>
        </h3>
        {messages.length === 0 ? (
          <p style={{ color: "#64748b", fontSize: 14 }}>Aún no hay mensajes capturados. Aparecerán aquí los clientes que pregunten por productos.</p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8, maxHeight: 460, overflowY: "auto" }}>
            {messages.map((m) => (
              <div key={m.id} style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 10, padding: "8px 12px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                  <strong style={{ color: "#22c55e", fontSize: 13 }}>+{m.telefono || "?"}</strong>
                  <span style={{ color: "#64748b", fontSize: 11 }}>{m.createdAt ? new Date(m.createdAt).toLocaleString("es-CO") : ""}</span>
                </div>
                <div style={{ color: "#e2e8f0", fontSize: 14, marginTop: 2, whiteSpace: "pre-wrap" }}>{m.texto || ""}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function btnStyle(color: string): CSSProperties {
  return { marginTop: 12, background: color, color: "#fff", border: "none", borderRadius: 10, padding: "8px 14px", fontSize: 13, fontWeight: 700, cursor: "pointer" };
}
