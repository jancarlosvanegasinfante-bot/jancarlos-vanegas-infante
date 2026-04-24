import { GoogleGenAI, Type, Modality } from "@google/genai";
import type { FunctionDeclaration } from "@google/genai";

export const JAN_SYSTEM_INSTRUCTION = `Eres Jan Vanegas, el vendedor paisa más efectivo de WhatsApp. Hablas en cortico, al punto y con mucha chispa. ⚡

TU MISIÓN: Persuadir y cerrar ventas rápido. Usa gatillos de urgencia y escasez.

REGLAS DE ORO:
1. BREVEDAD EXTREMA: Máximo 2-3 líneas por mensaje. No mandes parrafadas.
2. SALUDO NATURAL Y DIRECTO: Saluda por el nombre sin usar el '@'. Ejemplo: "¡Hola Tatiana! 👋" o "¡Qué más parce! 👋".
3. RESPETO CON LAS MUJERES: Si el cliente es mujer (o se nota por el nombre), háblale con respeto total. PROHIBIDO usar palabras como "hombre", "parce" o "mija" con ellas. Usa "querida", "reina" o simplemente su nombre.
4. FORMATO VISUAL IMPACTANTE:
   - Usa NEGRILLAS y MAYÚSCULAS para resaltar beneficios o palabras clave.
   - Si das precios con oferta, usa tachado para el anterior: "Antes ~~150.000~~, HOY SOLO **120.000** 🔥".
5. FILTRO DE ACCIÓN:
   - Si el producto solicitado NO está en el catálogo o no puedes resolver la duda -> accion = "notificar_admin"
   - Si el usuario dice que quiere comprar y da sus datos (o está en el proceso final) -> accion = "confirmar_pedido"
   - Para cualquier otra conversación o duda normal -> accion = "respuesta"
6. CAPACIDAD MULTIMODAL: Si el cliente envía fotos o audios, analízalos y responde de acuerdo a lo que ves o escuchas con tu personalidad paisa.
7. LINK ÚNICO: El ÚNICO link de catálogo permitido es https://jansel-shop-985283274281.us-west1.run.app/catalog.

ESTILO: Paisa, carismático, emojis (🚀 ✨ 🔥 📦), muy persuasivo y siempre respetuoso.`;

export const JAN_RESPONSE_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    accion: { type: Type.STRING, enum: ["respuesta", "notificar_admin", "confirmar_pedido"] },
    mensaje: { type: Type.STRING, description: "Respuesta para el usuario en estilo paisa" },
    producto: { type: Type.STRING, description: "Nombre del producto si aplica" },
    datos_pedido: {
      type: Type.OBJECT,
      properties: {
        nombre: { type: Type.STRING },
        direccion: { type: Type.STRING },
        telefono: { type: Type.STRING }
      }
    },
    imageUrl: { type: Type.STRING, description: "URL de la imagen del producto si aplica" }
  },
  required: ["accion", "mensaje"]
};

export const captureOrderTool: FunctionDeclaration = {
  name: "captureOrder",
  description: "Registra un pedido cuando el cliente proporciona sus datos COMPLETOS y confirma el producto.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      customerName: { type: Type.STRING, description: "Nombre completo del cliente" },
      customerPhone: { type: Type.STRING, description: "Teléfono de WhatsApp confirmado del cliente" },
      address: { type: Type.STRING, description: "Dirección de envío" },
      addressIndicator: { type: Type.STRING, description: "Punto de referencia o descripción de la casa (ej: casa roja)" },
      city: { type: Type.STRING, description: "Ciudad de Colombia" },
      productId: { type: Type.STRING, description: "ID del producto que desea comprar" },
      quantity: { type: Type.NUMBER, description: "Cantidad de unidades" }
    },
    required: ["customerName", "customerPhone", "address", "addressIndicator", "city", "productId", "quantity"]
  }
};

export const checkInventoryTool: FunctionDeclaration = {
  name: "checkInventory",
  description: "Consulta el catálogo actual de productos y el stock disponible.",
  parameters: {
    type: Type.OBJECT,
    properties: {}
  }
};

export const updateCustomerProfileTool: FunctionDeclaration = {
  name: "updateCustomerProfile",
  description: "Guarda o actualiza el nombre y datos del cliente para recordarlo en el futuro.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      name: { type: Type.STRING, description: "Nombre del cliente" },
      gender: { type: Type.STRING, enum: ["male", "female"], description: "Género detectado" }
    },
    required: ["name"]
  }
};

/**
 * Generates an image using Gemini (Frontend compatible)
 */
export async function generateImage(prompt: string, apiKey: string): Promise<string | null> {
  const ai = new GoogleGenAI({ apiKey });
  const model = 'imagen-3.0-generate-001';

  for (let i = 0; i < 3; i++) {
    try {
      const response = await ai.models.generateImages({
        model,
        prompt: prompt,
        config: {
          numberOfImages: 1,
          outputMimeType: 'image/jpeg',
          aspectRatio: '1:1',
        },
      });
      
      if (response.generatedImages && response.generatedImages.length > 0) {
        return response.generatedImages[0].image.imageBytes; // Return base64
      }
      break;
    } catch (err: any) {
      console.warn(`[ImageGen] Attempt ${i + 1} failed:`, err.message);
      if (i < 2) await new Promise(r => setTimeout(r, 2000));
    }
  }
  return null;
}

/**
 * Generates audio using Gemini TTS (Frontend compatible)
 */
export async function generateAudio(text: string, apiKey: string): Promise<string | null> {
  const ai = new GoogleGenAI({ apiKey });
  const model = "gemini-3.1-flash-tts-preview"; // Correct name from skill
  const ttsPrompt = `Actúa como un vendedor paisa de Medellín, carismático, alegre y con mucha energía. Di lo siguiente con un acento paisa muy marcado: ${text}`;
  
  for (let i = 0; i < 3; i++) {
    try {
      const response = await ai.models.generateContent({
        model,
        contents: [{ parts: [{ text: ttsPrompt }] }],
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: { voiceName: 'Zephyr' },
            },
          },
        },
      });

      return response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data || null;
    } catch (err: any) {
      console.warn(`[AudioGen] Attempt ${i + 1} failed:`, err.message);
      if (i < 2) await new Promise(r => setTimeout(r, 2000));
    }
  }
  return null;
}
