export interface Order {
  id: string; // Internal, can just generate UI-side
  orderNumber: string; // Full order number
  last4: string; // Last 4 digits for matching
  clientName: string;
  address: string;
  deliveryTime?: string; // Optional delivery time from capture
  coords?: string; // Optional coordinates override
  lat?: number; 
  lng?: number; 
  amount: string; // normalized or 'No se proporcionó monto'
  paymentMethod: string; // normalized
  trCode: string; // or 'No se proporcionó TR'
  comments: string;
  isAmbiguous: boolean;
  phone?: string;
  collectedCash?: number;
  collectedCard?: number;
  collectedVales?: number;
  receiverName?: string;
  delivered?: boolean;
  deliveredAt?: string;
  changeGiven?: number;
  subOrders?: Order[];
}

export interface ProcessingResult {
  orders: Order[];
  mismatches: string[];
}

export async function processLogisticsData(imagesBase64: { mimeType: string, data: string }[], financialText: string): Promise<ProcessingResult> {
  const payload = {
    imagesBase64,
    financialText
  };

  const headers: Record<string, string> = {
    'Content-Type': 'application/json'
  };

  const customKey = localStorage.getItem('logiruta_custom_gemini_api_key');
  if (customKey && customKey.trim() && customKey !== 'AIzaSyBlncNsXg3OghqzPiWo7_sqpASFN10swMY') {
    headers['x-gemini-api-key'] = customKey.trim();
  }

  const response = await fetch('/api/process-logistics', {
    method: 'POST',
    headers,
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    let errorMsg = 'Error al procesar los datos';
    try {
      const errorData = await response.json();
      errorMsg = errorData.error || errorMsg;
    } catch (e) {
      errorMsg = response.statusText;
    }
    throw new Error(errorMsg);
  }

  const result = await response.json();
  
  if (!result.orders || !Array.isArray(result.orders)) {
    result.orders = [];
  }

  const rawOrders: Order[] = result.orders.map((o: any) => ({ ...o, id: crypto.randomUUID() }));
  
  // Group orders with similar clientName and address
  const groupedOrders: Order[] = [];
  for (const order of rawOrders) {
    const match = groupedOrders.find(g => 
      g.clientName.trim().toLowerCase() === order.clientName.trim().toLowerCase() && 
      g.address.trim().toLowerCase() === order.address.trim().toLowerCase()
    );
    if (match) {
      if (!match.subOrders) {
        match.subOrders = [ { ...match } ];
      }
      match.subOrders.push(order);
      
      // Sum the amounts
      const currentTotal = match.subOrders.reduce((sum, o) => {
        const num = parseFloat(o.amount.replace(/[^0-9.]/g, ''));
        return sum + (isNaN(num) ? 0 : num);
      }, 0);
      match.amount = `$${currentTotal.toFixed(2)} (Total de ${match.subOrders.length} pedidos)`;
      
      // Combine payment methods and tr codes if they differ
      if (!match.paymentMethod.includes(order.paymentMethod)) {
         match.paymentMethod += ` / ${order.paymentMethod}`;
      }
      if (order.trCode && order.trCode !== 'No se proporcionó TR' && match.trCode !== order.trCode) {
         if (match.trCode === 'No se proporcionó TR') {
            match.trCode = order.trCode;
         } else if (!match.trCode.includes(order.trCode)) {
            match.trCode += ` | ${order.trCode}`;
         }
      }
    } else {
      groupedOrders.push(order);
    }
  }

  return {
    ...result,
    mismatches: (result.mismatches || []).filter((m: string) => m.length < 50 && !m.toLowerCase().includes("no se dispone") && !m.toLowerCase().includes("no disponible")),
    orders: groupedOrders
  };
}
