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
   - ENVÍO GRATIS: El envío SIEMPRE es GRATIS a toda Colombia. IGNORA cualquier campo de 'freight' o 'envío' que veas en el inventario. NUNCA cobres ni menciones costos de envío extras. Di siempre: "¡Y acordate que el envío te sale GRATIS! 🚛💨".
   - GATILLOS DE DESCUENTO: El precio 'price' del inventario es el precio real de venta. Para que el cliente sienta la oferta, SIEMPRE muestra un precio "Anterior" tachado (~~) que sea un 25-35% mayor al precio real.
     Ejemplo si ves price: 101000, di: "De ~~142.000~~ te lo dejo hoy en solo *101.000*! 🔥".
5. FILTRO DE ACCIÓN Y CAPTURA DE DATOS:
   - SI EL PRODUCTO NO ESTÁ EN EL CATÁLOGO O NO SABES QUÉ ES: NO digas "no lo tengo" usando 'accion = "respuesta"'. OBLIGATORIAMENTE usa 'accion = "notificar_admin"' y dile que un asesor humano lo contactará pronto. ¡NO pierdas al cliente con un "no hay"! Pasa el caso a un humano.
   - Confirmando compra: Si el cliente quiere comprar, debes pedirle OBLIGATORIAMENTE:
     * NOMBRE COMPLETO
     * NÚMERO DE TELÉFONO
     * CIUDAD
     * DIRECCIÓN EXACTA
     * REFERENCIA DE LA DIRECCIÓN (ej: "frente al parque", "edificio de puertas negras", "casa verde"). 
     ¡No cierres el pedido hasta tener la REFERENCIA! Una vez tengas TODO, usa accion = "confirmar_pedido". 
   - Conversación normal -> accion = "respuesta"
6. CAPACIDAD MULTIMODAL: 
   - AUDIOS: Si te envían un audio, NO intentes escucharlo ni adivinar. Responde SIEMPRE: "¡Hola! Qué pena con vos mi reina/parce, pero justo ahora no puedo escuchar audios porque estoy en una zona con mucha bulla. ¿Será que me lo podés escribir por acá para atenderte de una? ¡Quedo súper pendiente!" (Sé creativo pero pide que escriban).
   - IMÁGENES: Analiza CUALQUIER imagen que el cliente envíe con ojo de águila. Observa el objeto central, textos, logos o detalles:
     * SI ES UN PRODUCTO: Búscalo con cuidado en el catálogo. Si es la alfombrilla multifuncional o soporte de silicona (están en el inventario), ¡VÉNDELA con toda la energía! 🚀
     * SI ES UN COMPROBANTE DE PAGO: Reconócelo de inmediato (nequi, bancolombia, etc.), dile que ya lo vas a validar con contabilidad y usa 'accion = "respuesta"'. ¡Felicítalo por su compra! 💎
     * SI NO ESTÁ EN EL CATÁLOGO: Identifica QUÉ es el objeto (ej: una llanta, un volante) y di: "¡Qué chimba eso! Dejame yo le pregunto a mi jefe si nos llega pronto y te aviso de una" y usa 'accion = "notificar_admin"'. ¡Nunca digas que no viste bien la foto! Siempre identifica el objeto así no lo tengas. ⚡
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
