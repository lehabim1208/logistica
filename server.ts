import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Increase payload limit for images
  app.use(express.json({ limit: "50mb" }));

  // API Route for Gemini
  app.post("/api/process-logistics", async (req, res) => {
    try {
      const { imagesBase64, financialText } = req.body;
      const rawApiKey = req.headers['x-gemini-api-key'] || process.env.GEMINI_API_KEY;
      let clientApiKey = Array.isArray(rawApiKey) ? rawApiKey[0] : (rawApiKey || "");
      if (clientApiKey === "AIzaSyBlncNsXg3OghqzPiWo7_sqpASFN10swMY") {
        clientApiKey = process.env.GEMINI_API_KEY || "";
      }
      
      if (!clientApiKey || clientApiKey === "MY_GEMINI_API_KEY" || clientApiKey.trim() === "") {
        return res.status(401).json({ error: "No se encontró API Key. Configura GEMINI_API_KEY en Vercel o en las variables de entorno, o ingrésala en la app." });
      }

      let activeAi = new GoogleGenAI({ apiKey: clientApiKey });

      const schema = {
        type: Type.OBJECT,
        properties: {
          orders: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                orderNumber: { type: Type.STRING },
                last4: { type: Type.STRING },
                clientName: { type: Type.STRING },
                address: { type: Type.STRING },
                amount: { type: Type.STRING },
                paymentMethod: { type: Type.STRING },
                trCode: { type: Type.STRING },
                comments: { type: Type.STRING },
                isAmbiguous: { type: Type.BOOLEAN },
                deliveryTime: { type: Type.STRING, description: "Hora de entrega pactada o programada visible en la captura (ej. '14:30', '18:15'). Si no se encuentra, poner 'No especificada'." }
              },
              required: ["orderNumber", "last4", "clientName", "address", "amount", "paymentMethod", "trCode", "comments", "isAmbiguous", "deliveryTime"]
            }
          },
          mismatches: { 
            type: Type.ARRAY, 
            items: { type: Type.STRING },
            description: "Lista exclusiva de los códigos TR o referencias del texto que NO pudieron asociarse a ninguna orden. Si todo cuadra, devuelve un arreglo vacío. NO incluyas mensajes de error ni justificaciones aquí."
          }
        },
        required: ["orders", "mismatches"]
      };

      const systemInstruction = `
ERES UN SISTEMA DE EXTRACCIÓN DE DATOS ULTRA PRECISO Y RÁPIDO.
TU ÚNICO OBJETIVO: Extraer datos principales de las imágenes y NO INVENTAR NADA.

REGLAS CRUCIALES (INCUMPLIRLAS ES UN ERROR CRÍTICO):
1. NUNCA inventes clientes o repartos.
2. NÚMERO DE ORDEN (FOLIO): Extrae el folio EXACTO y LITERAL de la imagen.
3. Extraer Número de Orden, Cliente y Dirección. Si el texto financiero indica "pagado", "pl" o algo similar, **NO** lo pongas en "comments", simplemente asigna paymentMethod a "Pago en Línea" y el monto a "$0.00". Si dice "tdc" -> "Tarjeta o Efectivo".
4. DIRECCIÓN COMPLETA Y CÓDIGO POSTAL: Es OBLIGATORIO extraer la calle, municipio, estado y **CÓDIGO POSTAL (C.P. / CP)** si aparece. Si una calle no la encuentra el GPS sin el CP, el repartidor se perderá, así que siempre incluye el Código Postal para evitar direcciones ambiguas.
5. AGRUPACIÓN: Si dos capturas tienen la MISMA DIRECCIÓN, únelas en un solo array "orders", sumando montos y concatenando folios.
6. MANTÉN EL ORDEN ORIGINAL: No intentes calcular distancias ni crear la "mejor ruta". Devuelve los pedidos estrictamente en el orden de las imágenes capturadas.
7. LIMPIEZA DE DIRECCIONES PARA GPS: En el campo 'address', OMITE detalles descriptivos que confunden a Google Maps (ej. "edificio azul", "entre calles", "junto a la tienda", descripciones del interior). Extrae SOLO la información oficial (Calle, Número exterior, Colonia, Ciudad, Estado y Código Postal).
8. Si una dirección es demasiado informal, extrae al menos la Calle principal y el Código Postal.
`;

      const prompt = `Aquí están los datos del viaje. Recibes ${imagesBase64.length} capturas.

Texto financiero o extra:
${financialText}

RECUERDA: Agrupa pedidos de la misma dirección en uno solo, y extrae los números de orden exactamente como se leen en las imágenes, sin falsificarlos.`;

      const parts: any[] = imagesBase64.map((img: any) => ({
        inlineData: {
          mimeType: img.mimeType,
          data: img.data.split(',')[1] || img.data
        }
      }));
      parts.push({ text: prompt });

      let response;
      try {
        response = await activeAi.models.generateContent({
          model: "gemini-2.5-flash",
          contents: { parts },
          config: {
            systemInstruction,
            responseMimeType: "application/json",
            responseSchema: schema,
            temperature: 0.1,
            topK: 32,
          }
        });
      } catch (innerError: any) {
        const errStr = typeof innerError === 'object' ? JSON.stringify(innerError) : String(innerError);
        const isKeyError = errStr.includes("API key expired") || 
                           errStr.includes("API_KEY_INVALID") || 
                           errStr.includes("API key") || 
                           errStr.includes("apiKey") ||
                           (innerError.message && innerError.message.includes("API key"));
                           
        if (isKeyError && clientApiKey !== backupKey) {
          console.warn("API key error detected. Falling back to the provided user key...");
          const recoveryAi = new GoogleGenAI({ apiKey: backupKey });
          response = await recoveryAi.models.generateContent({
            model: "gemini-2.5-flash",
            contents: { parts },
            config: {
              systemInstruction,
              responseMimeType: "application/json",
              responseSchema: schema,
              temperature: 0.1,
              topK: 32,
            }
          });
        } else {
          throw innerError;
        }
      }

      const text = response.text || "{}";
      const result = JSON.parse(text);
      
      // Strict guard against hallucinated extra orders
      if (result.orders && Array.isArray(result.orders)) {
        if (result.orders.length > imagesBase64.length) {
          result.orders = result.orders.slice(0, imagesBase64.length);
        }
      }
      
      res.json(result);
    } catch (error: any) {
      console.error("Error in Gemini API:", error);
      let message = error.message || "Error interno del servidor";
      const errorStr = typeof error === 'object' ? JSON.stringify(error) : String(error);
      
      if (
        message.includes("API key expired") || 
        message.includes("API_KEY_INVALID") || 
        errorStr.includes("API key expired") || 
        errorStr.includes("API_KEY_INVALID") ||
        errorStr.includes("API key") ||
        errorStr.includes("apiKey")
      ) {
        message = "La clave API de Google AI Studio (Gemini) ha expirado o es inválida. Por favor, renuévala o añade una clave de API válida en el menú de Configuración (Settings) para poder procesar capturas.";
      }
      res.status(500).json({ error: message });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
