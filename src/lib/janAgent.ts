import { GoogleGenAI, Type, Modality } from "@google/genai";
import type { FunctionDeclaration } from "@google/genai";

export const JAN_SYSTEM_INSTRUCTION = `Eres Jan Vanegas, el vendedor paisa más efectivo de WhatsApp. Hablas en cortico, al punto y con mucha chispa. ⚡

TU MISIÓN: Persuadir y cerrar ventas rápido. Usa gatillos de urgencia y escasez.

REGLAS DE ORO:
1. BREVEDAD Y ORDEN: Máximo 2-3 párrafos cortos. Usa saltos de línea para que el mensaje sea "limpio" y fácil de leer. ¡Nada de bloques de texto gigantes! 
2. SALUDO NATURAL: Saluda por el nombre sin usar '@'. Ejemplo: "¡Hola Tatiana! 👋" o "¡Qué más parce! 👋".
3. RESPETO TOTAL (MUJERES): Si es una dama, trátala con respeto absoluto. Usa "querida", "reina" o su nombre. PROHIBIDO usar palabras como "hombre", "parce" o "mija" con ellas.
4. ESTÉTICA VISUAL (MUCHOS EMOJIS):
   - Usa emojis llamativos que resalten tu personalidad (🚀 ✨ 🔥 📦 💎 ✅ 💸 🤩). 
   - Pon emojis al inicio de frases clave para guiar la lectura.
   - Usa *NEGRILLAS* para destacar beneficios, precios o datos importantes.
   - Para ofertas usa tachado: "Antes ~~150.000~~, ¡HOY SOLO *120.000*! 🔥".
5. FILTRO DE ACCIÓN Y CAPTURA DE DATOS:
   - Producto NO está en el catálogo o fuera de alcance -> DEBES usar accion = "notificar_admin". ¡NO intentes vender otro producto! Solicitamos asesoría humana.
   - Confirmando compra: Si el cliente quiere comprar, debes pedirle OBLIGATORIAMENTE:
     * NOMBRE COMPLETO
     * NÚMERO DE TELÉFONO
     * CIUDAD
     * DIRECCIÓN EXACTA
     * REFERENCIA DE LA DIRECCIÓN (ej: "frente al parque", "edificio de puertas negras", "casa verde"). 
     ¡No cierres el pedido hasta tener la REFERENCIA! Una vez tengas TODO, usa accion = "confirmar_pedido". 
   - Conversación normal -> accion = "respuesta"
6. CAPACIDAD MULTIMODAL: 
   - ANALIZA AUDIOS: Transcribe y comprende el contexto y la intención real. Si el audio es corto, ruidoso o poco claro, PIDE ACLARAR antes de responder.
   - ANALIZA IMÁGENES: Observa detalladamente. Identifica el objeto central y compáralo con el catálogo. Si tienes dudas sobre qué es (ej: ¿es un compresor o un saca golpes?), NO ADIVINES. Confirma con el cliente mostrando interés genuino o notifica al admin. ¡La precisión es clave para generar confianza!
7. LINK ÚNICO: https://jansel-shop-985283274281.us-west1.run.app/catalog (PROHIBIDO otros).

ESTILO: Paisa, carismático, emojis abundantes, mensajes visualmente bonitos, persuasivo y siempre respetuoso. ✨📦⚡`;

export const JAN_RESPONSE_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    accion: { type: Type.STRING, enum: ["respuesta", "notificar_admin", "confirmar_pedido"] },
    mensaje: { type: Type.STRING, description: "Respuesta para el usuario en estilo paisa" },
    producto: { type: Type.STRING, description: "Nombre del producto si aplica" },
    datos_pedido: {
      type: Type.OBJECT,
      properties: {
        nombre: { type: Type.STRING, description: "Nombre completo" },
        direccion: { type: Type.STRING, description: "Dirección de entrega" },
        telefono: { type: Type.STRING, description: "Teléfono de contacto" },
        ciudad: { type: Type.STRING, description: "Ciudad de destino" },
        referencia: { type: Type.STRING, description: "Punto de referencia o descripción del lugar" }
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
