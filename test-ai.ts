import { getSystemInstruction, JAN_RESPONSE_SCHEMA } from "./src/lib/janAgent.js";
import { GoogleGenAI } from "@google/genai";
import dotenv from 'dotenv';
dotenv.config();

async function test() {
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  console.log("Config loaded...", getSystemInstruction());
  const primaryModel = "gemini-2.5-flash";
  const contents = [
    { 
      role: 'user', 
      parts: [
        { text: "Hola quiero unos cables para auto" }
      ] 
    }
  ];

  try {
    const result = await ai.models.generateContent({
      model: primaryModel,
      contents: contents,
      config: {
        systemInstruction: getSystemInstruction(),
        responseMimeType: "application/json",
        responseSchema: JAN_RESPONSE_SCHEMA
      }
    });

    console.log("SUCCESS:", result.text);
  } catch (err: any) {
    console.log("ERROR:", err);
  }
}

test().catch(console.error);
