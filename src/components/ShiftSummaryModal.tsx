import React, { useState } from 'react';
import { ChevronDown, ChevronUp, Package, Map as MapIcon, Clock } from 'lucide-react';

interface ShiftSummaryModalProps {
  totalFund: number;
  fundHistory: any[];
  onFinish: () => void;
  onCancel: () => void;
}

export function ShiftSummaryModal({ totalFund, fundHistory, onFinish, onCancel }: ShiftSummaryModalProps) {
  const [showFundHistory, setShowFundHistory] = useState(false);
  const [showTrips, setShowTrips] = useState(false);

  // Get today's trips from history
  const historyStr = localStorage.getItem('logiruta_history');
  const allHistory = historyStr ? JSON.parse(historyStr) : [];
  
  // Filter for today's trips (crude filter by date part matching today's local date part)
  const todayStr = new Date().toLocaleDateString();
  const todayTrips = allHistory.filter((h: any) => {
    return new Date(h.date).toLocaleDateString() === todayStr;
  });

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-gray-900/60 backdrop-blur-sm animate-in fade-in">
      <div className="bg-white dark:bg-gray-800 rounded-3xl w-full max-w-md shadow-2xl flex flex-col max-h-[90vh] overflow-hidden animate-in zoom-in-95">
        
        <div className="p-6 border-b border-gray-100 dark:border-gray-700 text-center">
          <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">Resumen de la Jornada</h3>
          <p className="text-gray-500 dark:text-gray-400 text-sm">Por favor verifica la información antes de finalizar</p>
        </div>

        <div className="p-6 overflow-y-auto space-y-6 flex-1">
          {/* Fund Summary */}
          <div className="bg-green-50 dark:bg-green-900/20 rounded-2xl p-5 border border-green-100 dark:border-green-800/30 text-center space-y-1">
            <p className="text-sm font-semibold text-green-800 dark:text-green-500 uppercase tracking-wide">Fondo a entregar</p>
            <p className="text-4xl font-black text-green-600 dark:text-green-400">${totalFund.toFixed(2)}</p>
          </div>

          {/* Accordion: Fund History */}
          <div className="border border-gray-200 dark:border-gray-700 rounded-2xl overflow-hidden bg-white dark:bg-gray-800">
            <button 
              onClick={() => setShowFundHistory(!showFundHistory)}
              className="w-full flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-800/50 hover:bg-gray-100 dark:hover:bg-gray-700/50 transition-colors"
            >
              <span className="font-semibold text-gray-700 dark:text-gray-200">Historial del Fondo</span>
              {showFundHistory ? <ChevronUp className="w-5 h-5 text-gray-500" /> : <ChevronDown className="w-5 h-5 text-gray-500" />}
            </button>
            {showFundHistory && (
              <div className="p-4 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 max-h-60 overflow-y-auto space-y-2 animate-in slide-in-from-top-2">
                {fundHistory.length > 0 ? (
                  fundHistory.map((entry: any) => (
                    <div key={entry.id} className="text-sm p-3 bg-gray-50 dark:bg-gray-900/40 rounded-xl border border-gray-100 dark:border-gray-700 flex justify-between items-center gap-2">
                      <div className="flex-1 min-w-0">
                        <p className="text-gray-800 dark:text-gray-200 font-medium truncate">{entry.description}</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">{new Date(entry.time).toLocaleTimeString()}</p>
                      </div>
                      <div className={`font-bold whitespace-nowrap ${entry.type === 'add' || entry.type === 'open' ? 'text-green-600 dark:text-green-400' : entry.type === 'close' ? 'text-gray-600 dark:text-gray-400' : 'text-orange-600 dark:text-orange-400'}`}>
                        {entry.type === 'add' || entry.type === 'open' ? '+' : entry.type === 'close' ? '' : '-'}${entry.amount.toFixed(2)}
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-gray-500 text-center py-2">No hay movimientos registrados</p>
                )}
              </div>
            )}
          </div>

          {/* Accordion: Trips Today */}
          <div className="border border-gray-200 dark:border-gray-700 rounded-2xl overflow-hidden bg-white dark:bg-gray-800">
            <button 
              onClick={() => setShowTrips(!showTrips)}
              className="w-full flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-800/50 hover:bg-gray-100 dark:hover:bg-gray-700/50 transition-colors"
            >
              <div className="flex items-center gap-2">
                <span className="font-semibold text-gray-700 dark:text-gray-200">Viajes del Día</span>
                <span className="text-xs bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300 px-2 py-0.5 rounded-full font-medium">
                  {todayTrips.length}
                </span>
              </div>
              {showTrips ? <ChevronUp className="w-5 h-5 text-gray-500" /> : <ChevronDown className="w-5 h-5 text-gray-500" />}
            </button>
            {showTrips && (
              <div className="p-4 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 max-h-60 overflow-y-auto space-y-3 animate-in slide-in-from-top-2">
                {todayTrips.length > 0 ? (
                  todayTrips.map((trip: any, i: number) => (
                    <div key={i} className="bg-gray-50 dark:bg-gray-900/40 p-3 rounded-xl border border-gray-100 dark:border-gray-700">
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-xs font-bold text-gray-500 dark:text-gray-400">{new Date(trip.date).toLocaleTimeString()}</span>
                        <div className="flex items-center gap-1 text-sm font-semibold text-gray-700 dark:text-gray-300">
                          <Package className="w-4 h-4 text-blue-500" />
                          {trip.route.orders.length} pedidos
                        </div>
                      </div>
                      <div className="flex justify-between items-center text-xs text-gray-500 dark:text-gray-400 bg-white dark:bg-gray-800 p-2 rounded-lg border border-gray-100 dark:border-gray-700">
                         <div className="flex items-center gap-1"><MapIcon className="w-3.5 h-3.5 text-gray-400"/> {trip.route.totalDistanceEst || 'N/A'}</div>
                         <div className="flex items-center gap-1"><Clock className="w-3.5 h-3.5 text-gray-400"/> {(trip.route.durationEst || '').replace(/minutos?.*/i, 'min.').replace(/,\s*m[aá]s tiempo.*/i, '') || 'N/A'}</div>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-gray-500 text-center py-2">No hay viajes registrados hoy</p>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="p-6 border-t border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/80 flex gap-3">
           <button 
             onClick={onCancel}
             className="flex-1 py-3.5 bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 font-bold rounded-xl border border-gray-200 dark:border-gray-600 shadow-sm hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors"
           >
             Cancelar
           </button>
           <button 
             onClick={onFinish}
             className="flex-1 py-3.5 bg-gray-900 dark:bg-white text-white dark:text-gray-900 font-bold rounded-xl shadow-lg hover:-translate-y-0.5 transition-all"
           >
             Finalizar
           </button>
        </div>

      </div>
    </div>
  );
}
