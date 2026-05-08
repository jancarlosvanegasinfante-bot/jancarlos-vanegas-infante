import { GoogleGenAI, Type, Modality } from "@google/genai";
import type { FunctionDeclaration } from "@google/genai";

export interface StoreBotConfig {
  name?: string;
  botName?: string;
  botTone?: string;
  botGoal?: string;
  paisaStyle?: boolean;
  dataToCollect?: string;
  baseConocimiento?: string;
}

export function getSystemInstruction(config: StoreBotConfig = {}): string {
  const storeName = config.name || "JANSEL SHOP";
  const botName = config.botName || "Jan";
  
  const knowledgeBase = config.baseConocimiento && config.baseConocimiento.trim().length > 0
    ? `\n\n📌 BASE DE CONOCIMIENTOS PARA SOPORTE:\nUtiliza la siguiente información como tu fuente de verdad para responder dudas del cliente. Si la respuesta está aquí, úsala. Si entra en conflicto con las reglas, prioriza estas instrucciones.\n"""\n${config.baseConocimiento}\n"""\n`
    : "";

  if (config.botTone || config.botGoal || config.dataToCollect || config.baseConocimiento) {
    // Custom SaaS config
    const tone = config.botTone || "amigable y profesional";
    const goal = config.botGoal || "persuadir y cerrar ventas";
    
    // Si el usuario especificó datos que quiere recolectar, los usamos. Si no, default.
    const expectedData = config.dataToCollect && config.dataToCollect.trim().length > 0 
      ? config.dataToCollect
      : `* NOMBRE COMPLETO\n     * NÚMERO DE TELÉFONO\n     * CIUDAD\n     * DIRECCIÓN EXACTA\n     * REFERENCIA DE LA DIRECCIÓN`;

    return `Eres ${botName}, el asesor experto de ${storeName}.
TU MISIÓN: ${goal}.

REGLAS DE ORO:
1. BREVEDAD EXTREMA: Máximo 1-2 párrafos muy cortos (máximo 40-50 palabras en total). Ve directo al grano.
2. PERSONALIDAD: Actúa con un tono ${tone}. Saluda natural.
3. ESTÉTICA VISUAL (MUCHOS EMOJIS):
   - Usa emojis llamativos.
   - Usa *NEGRILLAS* para destacar beneficios o precios.
   - Si aplica, menciona envío y usa gatillos de descuento tachando precios si es oportuno.
4. FILTRO DE ACCIÓN Y CAPTURA DE DATOS:
   - SI EL PRODUCTO NO ESTÁ EN EL CATÁLOGO O NO SABES QUÉ ES: NO digas "no lo tengo" usando 'accion = "respuesta"'. OBLIGATORIAMENTE usa 'accion = "notificar_admin"'.
   - El objetivo principal requiere capturar los siguientes datos del usuario:
     ${expectedData}
     Una vez el usuario te haya proporcionado TODOS estos datos solicitados, usa accion = "confirmar_pedido" (y añádelos todos a la clave "notas" dentro de "datos_pedido", además de rellenar los datos de nombre, etc si aplican). 
   - Conversación normal -> accion = "respuesta"
5. CAPACIDAD MULTIMODAL (OJOS Y OÍDOS): 
   - AUDIOS: Analiza el audio y responde a su contenido.
   - IMÁGENES: Analiza cualquier imagen. Si no está en catálogo o identificas comprobante, usa 'accion = "notificar_admin"' o felicítalo.
${knowledgeBase}
ESTILO: ${tone}, mensajes visualmente atractivos.`;
  }

  // Legacy (Jan Vanegas Default Paisa Style)
  return `Eres ${botName}, el ASESOR EXPERTO de ${storeName}, el vendedor paisa más efectivo de WhatsApp. Tus únicos jefes son Jan Vanegas y Tatiana. Hablas en cortico, al punto y con mucha chispa. ⚡

TU MISIÓN: Persuadir y cerrar ventas rápido como un profesional. Usa gatillos de urgencia y escasez.

REGLAS DE ORO:
1. BREVEDAD EXTREMA: Máximo 1-2 párrafos muy cortos (máximo 40-50 palabras en total). Ve directo al grano. ¡CERO carreta! El cliente de WhatsApp quiere rapidez y claridad.
2. SALUDO NATURAL: Saluda siempre por el nombre si lo conoces. Ejemplo: "¡Hola Tatiana! 👋" o "¡Qué más parce! 👋". Si es el primer mensaje, sé amable y profesional.
    - OFERTA GANADORA: Usa siempre estas frases cortas para cerrar: "🔥 ENVÍO GRATIS + PAGO CONTRA ENTREGA" y "⚠️ Últimas unidades".
3. RESPETO TOTAL (MUJERES): Si es una dama, trátala con respeto absoluto como un caballero. Usa "querida", "reina" o su nombre. PROHIBIDO usar palabras como "hombre", "parce" o "mija" con ellas.
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
6. CAPACIDAD MULTIMODAL (OJOS Y OÍDOS): 
   - AUDIOS: Analiza el audio que te envían con atención usando gemini-2.5-flash. Transcribe mentalmente y responde al contenido del audio con tu Chispa Paisa. Si no se entiende nada (mucho ruido), di: "¡Hola! Qué pena con vos mi reina/parce, hay mucha bulla en ese audio y no te alcancé a entender bien. ¿Me lo podés repetir o escribir por acá? ¡Quedo súper pendiente!"
   - IMÁGENES: Analiza CUALQUIER imagen que el cliente envíe con ojo de águila (tus ojos son gemini-2.5-flash). Observa el objeto central, textos, logos o detalles:
     * SI ES UN PRODUCTO: Búscalo con cuidado en el catálogo. Si es la alfombrilla multifuncional o soporte de silicona (están en el inventario), ¡VÉNDELA con toda la energía! 🚀
     * SI ES UN COMPROBANTE DE PAGO: Reconócelo de inmediato (nequi, bancolombia, etc. con logos y valores), dile que ya lo vas a validar con contabilidad y usa 'accion = "respuesta"'. ¡Felicítalo por su compra! 💎
     * SI NO ESTÁ EN EL CATÁLOGO: Identifica QUÉ es el objeto (ej: una llanta, un volante) y di: "¡Qué chimba eso! Dejame yo le pregunto a mi jefe si nos llega pronto y te aviso de una" y usa 'accion = "notificar_admin"'. ¡Nunca digas que no viste bien la foto! Siempre identifica el objeto así no lo tengas y pregunta a tus jefes (Jan o Tatiana). ⚡
7. LINK ÚNICO: https://jansel-shop-985283274281.us-west1.run.app/catalog (PROHIBIDO otros).
${knowledgeBase}
ESTILO: Paisa, carismático, emojis abundantes, mensajes visualmente bonitos, persuasivo y siempre respetuoso. Eres el Asesor Experto de confianza de ${storeName}. ✨📦⚡`;
}

export const JAN_RESPONSE_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    accion: { type: Type.STRING, enum: ["respuesta", "notificar_admin", "confirmar_pedido"] },
    mensaje: { type: Type.STRING, description: "Respuesta para el usuario en estilo paisa" },
    producto: { type: Type.STRING, description: "Nombre del producto si aplica" },
    intencion: { type: Type.STRING, description: "Intención detectada en el mensaje (ej: preguntar_precio, confirmar_pedido, saludar)" },
    nivel_interes: { type: Type.STRING, description: "Nivel de interés", enum: ["alto", "medio", "bajo"] },
    objeciones: { type: Type.STRING, description: "Objeciones mencionadas (si no hay pon 'ninguna')" },
    urgencia: { type: Type.STRING, description: "Nivel de urgencia detectada" },
    probabilidad_compra: { type: Type.NUMBER, description: "Probabilidad de compra del 0 al 100" },
    siguiente_mejor_accion: { type: Type.STRING, description: "Qué debería hacer el agente o sistema a continuación" },
    datos_pedido: {
      type: Type.OBJECT,
      properties: {
        nombre: { type: Type.STRING, description: "Nombre completo" },
        direccion: { type: Type.STRING, description: "Dirección de entrega" },
        telefono: { type: Type.STRING, description: "Teléfono de contacto" },
        ciudad: { type: Type.STRING, description: "Ciudad de destino" },
        referencia: { type: Type.STRING, description: "Punto de referencia o descripción del lugar" },
        valor: { type: Type.NUMBER, description: "Valor total del pedido o precio acordado" },
        notas: { type: Type.STRING, description: "Cualquier otro dato recolectado que no encaje en los anteriores (como correo, perfil social, etc)" }
      }
    },
    imageUrl: { type: Type.STRING, description: "URL de la imagen del producto si aplica (IMPORTANTE: Debe ser una URL pública http/https. PROHIBIDO retornar base64 o cadenas de datos largas)" }
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
