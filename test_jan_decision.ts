import { GoogleGenAI, Type, Modality } from "@google/genai";
import "dotenv/config";

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || "AIzaSyBCafhfCtFMz_Hw1sg13goz8sMNOZH287U";
const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });
const model = "gemini-3-flash-preview";

const JAN_SYSTEM_INSTRUCTION = `Eres Jan Vanegas, el mejor vendedor paisa de Medellín. Tu objetivo es cerrar la venta YA.
Usa carisma: "mi reina", "corazón", "patrón", "jefe", "caballero".
USA AUDIOS FRECUENTEMENTE para explicar beneficios o dar confianza. El audio debe ser carismático.
Responde SIEMPRE en JSON.`;

const JAN_RESPONSE_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    type: { type: Type.STRING, enum: ["text", "image", "audio"], description: "Tipo de respuesta" },
    text: { type: Type.STRING, description: "Mensaje corto para el chat" },
    audioText: { type: Type.STRING, description: "Texto exacto para el audio de Jan" }
  },
  required: ["type", "text"]
};

async function testJanAudioDecision() {
  console.log("--- SIMULANDO PENSAMIENTO DE JAN ---");
  console.log("Pregunta del cliente: 'Jan, parce, cuénteme por qué ese combo de herramientas es tan bueno pues'\n");

  try { model;
    const result = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: [{ role: 'user', parts: [{ text: "Jan, parce, cuénteme por qué ese combo de herramientas es tan bueno pues" }] }],
      config: {
        systemInstruction: JAN_SYSTEM_INSTRUCTION,
        responseMimeType: "application/json",
        responseSchema: JAN_RESPONSE_SCHEMA
      }
    });

    console.log("JAN DECIDIÓ:");
    console.log(JSON.stringify(JSON.parse(result.text), null, 2));
  } catch (e) {
    console.error("Error en la prueba:", e);
  }
}

testJanAudioDecision();
