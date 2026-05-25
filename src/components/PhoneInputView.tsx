import { useState, useEffect } from 'react';
import { ProcessingResult } from '../lib/gemini';
import { ChevronRight, Phone, User, ArrowLeft } from 'lucide-react';
import { cn } from '../lib/utils';
import { toast } from 'sonner';

interface PhoneInputViewProps {
  routeInfo: ProcessingResult;
  onNext: (result: ProcessingResult) => void;
  onBack: () => void;
}

export function PhoneInputView({ routeInfo, onNext, onBack }: PhoneInputViewProps) {
  const [phones, setPhones] = useState<Record<string, string>>({});
  const [showPhoneInputs, setShowPhoneInputs] = useState<boolean | null>(null);

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

  if (showPhoneInputs === null) {
    return (
      <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300 max-w-lg mx-auto pb-20">
        <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 text-center">
          <div className="w-16 h-16 bg-blue-100 dark:bg-blue-900/40 rounded-full flex items-center justify-center mx-auto mb-4">
            <Phone className="w-8 h-8 text-blue-600 dark:text-blue-400" />
          </div>
          <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">¿Agregar números telefónicos?</h2>
          <p className="text-sm text-gray-600 dark:text-gray-300 mb-6">
            Puedes añadir los números de teléfono de tus clientes para tener un botón de contacto directo durante tu ruta.
          </p>
          <div className="flex flex-col gap-3">
            <button
              onClick={() => setShowPhoneInputs(true)}
              className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold text-base shadow-sm transition-all"
            >
              Sí, agregar números
            </button>
            <button
              onClick={() => onNext(routeInfo)}
              className="w-full py-3 bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-800 dark:text-white rounded-xl font-bold text-base transition-all"
            >
              No, omitir este paso
            </button>
          </div>
          <div className="mt-4 pt-4 border-t border-gray-100 dark:border-gray-700">
             <button
              onClick={onBack}
              className="w-full py-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 font-medium transition-colors text-sm flex items-center justify-center gap-2"
            >
              <ArrowLeft className="w-4 h-4" />
              Volver atrás
            </button>
          </div>
        </div>
      </div>
    );
  }

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
                    className="flex-1 min-w-0 p-2.5 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none font-medium text-sm text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500"
                  />
                  <button
                    onClick={() => handlePaste(order.id)}
                    className="px-3 py-2 bg-blue-50 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 font-bold text-xs uppercase tracking-wide rounded-lg border border-blue-200 dark:border-blue-800 hover:bg-blue-100 dark:hover:bg-blue-900/60 transition-colors flex items-center justify-center shrink-0 min-w-16"
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
          onClick={() => setShowPhoneInputs(null)}
          className="w-full py-2.5 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 font-medium transition-colors text-xs flex items-center justify-center gap-1.5"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Volver a opciones
        </button>
      </div>
    </div>
  );
}
