import { GoogleGenAI, Type } from "@google/genai";

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Aumentar el límite de payload si usa Body Parser integrado (Vercel permite hasta 4.5MB en Serverless gratuitos, tener precaución)
  try {
    const { imagesBase64, financialText, isPairMode, userLocation } = req.body;
    const rawApiKey = req.headers['x-gemini-api-key'] || process.env.GEMINI_API_KEY;
    let clientApiKey = Array.isArray(rawApiKey) ? rawApiKey[0] : (rawApiKey || "");
    
    if (!clientApiKey || clientApiKey === "MY_GEMINI_API_KEY" || clientApiKey.trim() === "") {
      return res.status(401).json({ error: "No se encontró API Key. Configura GEMINI_API_KEY en Vercel o en las variables de entorno, o ingrésala en la app." });
    }

    const activeAi = new GoogleGenAI({ apiKey: clientApiKey });

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
          description: "Lista de códigos TR que no pudieron asociarse. Vacío en parejas."
        }
      },
      required: ["orders", "totalDistanceEst", "durationEst", "trafficCondition", "mismatches"]
    };

    let systemInstruction = "";
    let prompt = "";

    if (isPairMode) {
      systemInstruction = `
ERES UN SISTEMA DE EXTRACCIÓN DE DATOS DE LOGÍSTICA ULTRA PRECISO EN MODO PAREJAS DE IMÁGENES.
Recibes pares de fotos organizadas secuencialmente: por cada pedido hay (1) captura de información de entrega y envío, y (2) captura de información financiera del mismo pedido.

REGLAS CRUCIALES PARA ENLAZAR EL PAR DE IMÁGENES DE CADA PEDIDO:
1. Para cada pedido "i" (de 1 a N), asocia la captura de entrega (índice 2*(i-1)) con su captura financiera (índice 2*(i-1) + 1).
2. De la primera captura (entrega): extrae el folio/número de orden EXACTO y LITERAL (orderNumber, y almacena los últimos 4 dígitos en "last4"), nombre del cliente (clientName), dirección completa (address, incluyendo calle, número, colonia, ciudad y CÓDIGO POSTAL CP si viene) y hora de entrega o "deliveryTime" si existe (ej. '14:30', '18:15'; si no, 'No especificada').
3. De la segunda captura (financiera) vinculante:
   - Reconoce el número de TR (trCode) y el monto.
   - Si en "tipo de pago", "estado" o información dice "prepago" o indica que es pago electrónico/en línea, el paymentMethod será "Pago en Línea" y el monto (amount) será "$0.00".
   - Si en "tipo de pago" o similar dice "postpago" o indica pago al recibir, debe reconocer el número de TR (trCode) e identificar el monto a cobrar de la sección de [Total] o del valor total de la imagen financiera. Su paymentMethod será "Tarjeta o Efectivo".
4. DIRECCIÓN DE GPS: Limpia detalles del interior o referencias demasiado informales en el campo 'address' dejando solo la dirección oficial apta para Google Parks/Maps con el Código Postal.
5. El tamaño de la respuesta 'orders' debe ser EXACTAMENTE el número de pedidos: ${imagesBase64.length / 2}. No alucines pedidos extras.
`;

      prompt = `Procesa las siguientes ${imagesBase64.length} capturas en parejas de dos imágenes por pedido. No alucines ninguna orden extra. Devuelve exactamente ${imagesBase64.length / 2} pedidos.`;
    } else {
      systemInstruction = `
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

      prompt = `Aquí están los datos del viaje. Recibes EXACTAMENTE ${imagesBase64.length} capturas.

Texto financiero o extra:
${financialText}

Punto de Inicio Fijo: ${userLocation ? "Ubicación GPS: " + userLocation.lat + ", " + userLocation.lng : "Ubicación actual del repartidor"}.

IMPERATIVO Y CRÍTICO: 
- Debes generar ÚNICA y EXACTAMENTE ${imagesBase64.length} elementos en el array "orders" en total. UNA ORDEN POR IMAGEN. NI UNA MÁS, NI UNA MENOS.
- NO EXTRAIGAS NOMBRES DE OTROS LADOS, NI DEL EXTREMO FONDO.
- No alucines historial ni datos pasados. Procesa ultra rápido, estricto a las ${imagesBase64.length} imágenes.`;
    }

    const parts: any[] = imagesBase64.map((img: any) => ({
      inlineData: {
        mimeType: img.mimeType,
        data: img.data.split(',')[1] || img.data
      }
    }));
    parts.push({ text: prompt });

    const response = await activeAi.models.generateContent({
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
    let message = error.message || "Internal Server Error";
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
}
