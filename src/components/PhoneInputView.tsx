import { useState, useEffect } from 'react';
import { ProcessingResult } from '../lib/gemini';
import { ChevronRight, Phone, User } from 'lucide-react';
import { cn } from '../lib/utils';
import toast from 'react-hot-toast';

interface PhoneInputViewProps {
  routeInfo: ProcessingResult;
  onNext: (result: ProcessingResult) => void;
  onBack: () => void;
}

export function PhoneInputView({ routeInfo, onNext, onBack }: PhoneInputViewProps) {
  const [phones, setPhones] = useState<Record<string, string>>({});

  useEffect(() => {
    // Initialize with existing phones if any
    const initialPhones: Record<string, string> = {};
    routeInfo.orders.forEach(o => {
      if (o.phone) initialPhones[o.id] = o.phone;
    });
    setPhones(initialPhones);
  }, [routeInfo]);

  const handleNext = () => {
    const updatedOrders = routeInfo.orders.map(order => ({
      ...order,
      phone: phones[order.id] || ''
    }));
    
    onNext({
      ...routeInfo,
      orders: updatedOrders
    });
  };

  const handlePaste = async (orderId: string) => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) {
        setPhones(prev => ({ ...prev, [orderId]: text }));
        toast.success('Número pegado');
      }
    } catch (err) {
      toast.error('Mantén presionado el campo de texto para pegar el número.', { duration: 4000 });
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300 max-w-lg mx-auto pb-20">
      <div className="bg-white dark:bg-gray-800 p-5 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700">
        <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">Teléfonos de Clientes</h2>
        <p className="text-sm text-gray-600 dark:text-gray-300 mb-4">Ingresa el número telefónico de cada cliente para poder contactarlos durante la ruta.</p>

        <div className="space-y-4">
          {routeInfo.orders.map((order, index) => (
            <div key={order.id} className="bg-gray-50 dark:bg-gray-700 border border-gray-100 dark:border-gray-600 p-4 rounded-xl">
              <div className="flex justify-between items-start mb-3">
                <div className="flex items-center gap-2">
                  <span className="bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 font-bold px-2 py-0.5 rounded text-xs">#{index + 1}</span>
                  <p className="font-bold text-gray-900 dark:text-white text-sm leading-tight line-clamp-2">{order.clientName}</p>
                </div>
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-300 mb-3 line-clamp-1">{order.address}</p>
              
              <div>
                <label className="flex items-center gap-1.5 text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1.5">
                  <Phone className="w-3.5 h-3.5" />
                  Número de Teléfono:
                </label>
                <div className="flex gap-2">
                  <input
                    type="tel"
                    placeholder="Ej. 228 123 4567"
                    value={phones[order.id] || ''}
                    onChange={e => setPhones(prev => ({ ...prev, [order.id]: e.target.value }))}
                    className="flex-1 p-2.5 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none font-medium text-sm text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500"
                  />
                  <button
                    onClick={() => handlePaste(order.id)}
                    className="px-3 py-2 bg-blue-50 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 font-bold text-xs uppercase tracking-wide rounded-lg border border-blue-200 dark:border-blue-800 hover:bg-blue-100 dark:hover:bg-blue-900/60 transition-colors flex items-center justify-center shrink-0"
                  >
                    Pegar
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-2.5">
        <button
          onClick={handleNext}
          className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold text-base shadow-sm transition-all flex items-center justify-center gap-2"
        >
          Siguiente (Acomodar Ruta)
          <ChevronRight className="w-5 h-5" />
        </button>
        <button
          onClick={onBack}
          className="w-full py-2.5 text-gray-500 hover:text-gray-700 font-medium transition-colors text-xs"
        >
          Volver
        </button>
      </div>
    </div>
  );
}
