import { GoogleGenAI, Type } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Aumentar el límite de payload si usa Body Parser integrado (Vercel permite hasta 4.5MB en Serverless gratuitos, tener precaución)
  try {
    const { imagesBase64, financialText, userLocation } = req.body;

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
        totalDistanceEst: { type: Type.STRING, description: "Calcula y estima la distancia total aproximada según las direcciones (ej. '15 km'). Trata de dar una estimación lógica de la ciudad." },
        durationEst: { type: Type.STRING, description: "Calcula y estima la duración aproximada de toda la ruta (ej. '45 min')." },
        trafficCondition: { type: Type.STRING, description: "Gusto de tráfico esperado ej: 'Moderado'. No usar N/A, siempre inventar una predicción lógica." },
        mismatches: { 
          type: Type.ARRAY, 
          items: { type: Type.STRING },
          description: "Lista exclusiva de los códigos TR o referencias del texto que NO pudieron asociarse a ninguna orden. Si todo cuadra, devuelve un arreglo vacío. NO incluyas mensajes de error ni justificaciones aquí."
        }
      },
      required: ["orders", "totalDistanceEst", "durationEst", "trafficCondition", "mismatches"]
    };

    const systemInstruction = `
ERES UN SISTEMA DE EXTRACCIÓN DE DATOS ULTRA PRECISO Y RÁPIDO.
TU ÚNICO OBJETIVO: Extraer datos principales de las imágenes y NO INVENTAR NADA.

REGLAS CRUCIALES (INCUMPLIRLAS ES UN ERROR CRÍTICO):
1. NUNCA inventes clientes, números de orden o repartos.
2. IMPORTANTE: Extrae ÚNICAMENTE el pedido PRINCIPAL visible en primera plana (expandido o centrado) de cada captura.
   - IGNORA por completo cualquier otro pedido que aparezca parcialmente visible arriba o abajo en la lista.
   - IGNORA calles de fondo del mapa.
   - Ignora cualquier texto cortado o difuso.
3. Extraer Número de Orden (suele traer un # o 'Orden'), Cliente y Dirección completa de las imágenes.
4. Cruzar los últimos 4 dígitos con el texto financiero para asociar Monto, Pago, TR, Comentarios. (Si tdc -> "Tarjeta o Efectivo", si pl/pagado -> "Pago en Línea"). Si no hay monto numérico pero dice pl/pagado, pon "Pago en línea".
5. TR faltante -> "No se proporcionó TR"
6. ORDENAMIENTO EN RUTA LÓGICO: Es OBLIGATORIO ordenar la lista de pedidos empezando desde el punto más cercano a la ubicación de inicio (si la hay) o dando un orden lógico que acorte distancias de punto a punto según tu conocimiento general de la ciudad y colonias. No entregues el orden al azar. Minimiza los viajes de regreso.
`;

    const prompt = `Aquí están los datos del viaje. Recibes EXACTAMENTE ${imagesBase64.length} capturas.

Texto financiero o extra:
${financialText}

Punto de Inicio Fijo: ${userLocation ? "Ubicación GPS: " + userLocation.lat + ", " + userLocation.lng : "Ubicación actual del repartidor"}.

IMPERATIVO Y CRÍTICO: 
- Debes generar ÚNICA y EXACTAMENTE ${imagesBase64.length} elementos en el array "orders" en total. UNA ORDEN POR IMAGEN. NI UNA MÁS, NI UNA MENOS.
- NO EXTRAIGAS NOMBRES DE OTROS LADOS, NI DEL EXTREMO FONDO.
- No alucines historial ni datos pasados. Procesa ultra rápido, estricto a las ${imagesBase64.length} imágenes.`;

    const parts: any[] = imagesBase64.map((img: any) => ({
      inlineData: {
        mimeType: img.mimeType,
        data: img.data.split(',')[1] || img.data
      }
    }));
    parts.push({ text: prompt });

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: { parts },
      config: {
        systemInstruction,
        responseMimeType: "application/json",
        responseSchema: schema,
      }
    });

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
    res.status(500).json({ error: error.message || "Internal Server Error" });
  }
}
