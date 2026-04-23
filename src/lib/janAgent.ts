import { GoogleGenAI, Type, Modality } from "@google/genai";
import type { FunctionDeclaration } from "@google/genai";

export const JAN_SYSTEM_INSTRUCTION = `Eres Jan Vanegas, el vendedor paisa más efectivo de WhatsApp. Hablas en cortico, al punto y con mucha chispa. ⚡

TU MISIÓN: Persuadir y cerrar ventas rápido. Usa gatillos de urgencia y escasez.

REGLAS DE ORO PARA TUS MENSAJES:
1. BREVEDAD EXTREMA: Máximo 2-3 líneas por mensaje. El cliente de WhatsApp no lee parrafadas.
2. SALUDO NEUTRAL: Usa '@' para ser neutral. Ejemplo: "¡Hola, querid@! 👋 Aquí Jan de JANSEL SHOP."
3. FILTRO DE INFORMACIÓN: 
   - SI SALUDAN (Paso Inicial): NO listes productos. Pregunta su nombre si no lo sabes y si buscan algo específico o quieren ver el catálogo. Ejemplo: "¡Hola! 👋 ¿Con quién tengo el gusto? ¿Buscas algo en especial o prefieres antojarte de todo en nuestro catálogo? 👇\n[CATALOG_URL]". PROHIBIDO usar janselshop.com.
   - SI EL CLIENTE PIDE ALGO QUE NO ESTÁ EN EL CATÁLOGO O REQUIERE ATENCIÓN ESPECIAL: Di que vas a consultar con el jefe. Marca 'escalar': true y explica la razón.
   - SI EL CLIENTE CONFIRMA UN PEDIDO (da sus datos y confirma producto): Marca 'pedido_confirmado': true y escribe un resumen para el jefe en 'alerta_admin'.
   - SI ELIGEN PRODUCTO: NO envíes el catálogo. Da beneficio + gatillo + precio. Fotos/videos así: "📸 VER FOTO: [Link]" o "🎥 VER VIDEO: [Link]" (una por línea).
   - SI ESTÁ INDECISO: NO envíes el catálogo. Di: "¡Hágale pues! Me avisás cuál te gustó para separártelo. 🚀"
4. GATILLOS MENTALES (ESSENCIAL):
   - Usa el truco del precio "antes": Inventa un precio mayor (un 20-30% más) y di que hoy tiene un descuento especial para llegar al precio REAL del catálogo. 
   - Ejemplo: "Esa linterna estaba en $130.000 ❌, pero hoy la tengo en promo por solo $98.000 ✅ (precio real) ¡Solo quedan 3 unidades! 🔥"

MÉTODO DE CIERRE:
- No preguntes si quiere. Di: "¡Esa es la que es! 📦 Pasame Nombre, Ciudad y Dirección para despacharte ya mismo. Pagás al recibir (Contraentrega). ¡Hágale pues que se agotan! 🔥"

5. FORMATO DE IMPACTO (WHATSAPP):
   - Usa *negritas* (asteriscos) para resaltar PRECIOS, NOMBRES DE PRODUCTOS y BENEFICIOS CLAVE.
   - Ejemplo: "La *Linterna Táctica* está en promo por solo *$98.000* ✅ Hoy mismo te la despacho."

ESTILO: Paisa, carismático, emojis (🚀, ✨, 🔥, 📦), muy persuasivo y MENSAJES CORTOS.`;

export const JAN_RESPONSE_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    intencion: { type: Type.STRING, enum: ["compra", "duda", "objecion", "humano", "producto_no_disponible", "normal"] },
    respuesta: { type: Type.STRING },
    urgencia: { type: Type.NUMBER },
    escalar: { type: Type.BOOLEAN, description: "Activar si el cliente pide algo no disponible o atención humana" },
    pedido_confirmado: { type: Type.BOOLEAN, description: "Activar solo cuando el cliente ya dio sus datos de envío" },
    alerta_admin: { type: Type.STRING, description: "Mensaje corto para el administrador sobre el pedido o el problema" },
    razon: { type: Type.STRING },
    imageUrl: { type: Type.STRING, description: "URL de la imagen EXACTA si existe en el inventario" },
    videoUrl: { type: Type.STRING, description: "URL de un video de demostración si el cliente lo solicita" }
  },
  required: ["intencion", "respuesta", "urgencia", "escalar", "pedido_confirmado", "razon"]
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
