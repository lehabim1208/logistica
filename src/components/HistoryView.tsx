import { useEffect, useState } from 'react';
import { ProcessingResult } from '../lib/gemini';
import { ArrowLeft, Clock, Map as MapIcon, Package, Eye, X, CheckCircle, CreditCard, Receipt, User, ChevronDown, ChevronUp, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';

interface HistoryItem {
  date: string;
  route: ProcessingResult;
}

export function HistoryView({ onBack, hideHeader }: { onBack: () => void, hideHeader?: boolean }) {
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [selectedItem, setSelectedItem] = useState<HistoryItem | null>(null);
  const [expandedDates, setExpandedDates] = useState<Record<string, boolean>>({});
  const [dateToDelete, setDateToDelete] = useState<string | null>(null);

  useEffect(() => {
    const data = localStorage.getItem('logiruta_history');
    if (data) {
      try {
        const parsed = JSON.parse(data);
        setHistory(parsed);
        // Expand the most recent date by default if exists
      } catch (e) {}
    }
  }, []);

  const groupedHistory = history.reduce((acc, item) => {
    const d = new Date(item.date);
    const dateStr = isNaN(d.getTime()) 
      ? 'Fecha desconocida' 
      : d.toLocaleDateString('es-MX', { year: 'numeric', month: 'long', day: 'numeric' });
      
    if (!acc[dateStr]) acc[dateStr] = [];
    acc[dateStr].push(item);
    return acc;
  }, {} as Record<string, HistoryItem[]>);

  const sortedDates = Object.keys(groupedHistory).sort((a, b) => {
    if (a === 'Fecha desconocida') return 1;
    if (b === 'Fecha desconocida') return -1;
    return new Date(groupedHistory[b]?.[0]?.date || 0).getTime() - new Date(groupedHistory[a]?.[0]?.date || 0).getTime();
  });

  // Initialize first date as expanded
  useEffect(() => {
    if (sortedDates.length > 0 && Object.keys(expandedDates).length === 0) {
      setExpandedDates({ [sortedDates[0]]: true });
    }
  }, [sortedDates]);

  const toggleDate = (dateStr: string) => {
    setExpandedDates(prev => ({ ...prev, [dateStr]: !prev[dateStr] }));
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-left-4 duration-300">
      {!hideHeader && (
        <div className="flex items-center gap-4 mb-6">
          <button 
            onClick={onBack}
            className="p-2 bg-white dark:bg-gray-800 rounded-full shadow-sm border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
          >
            <ArrowLeft className="w-6 h-6 text-gray-700 dark:text-gray-300" />
          </button>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Historial de Viajes</h2>
        </div>
      )}

      {history.length === 0 ? (
        <div className="text-center py-20 bg-white dark:bg-gray-800 rounded-3xl border border-gray-200 dark:border-gray-700 shadow-sm">
          <Clock className="w-16 h-16 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
          <h3 className="text-xl font-medium text-gray-700 dark:text-gray-300 mb-2">No hay viajes registrados</h3>
          <p className="text-gray-500 dark:text-gray-400">Los viajes finalizados aparecerán aquí.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {sortedDates.map((dateStr) => (
            <div key={dateStr} className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
              <div className="w-full flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-800/80 hover:bg-gray-100 dark:hover:bg-gray-700/80 transition-colors">
                <button 
                  onClick={() => toggleDate(dateStr)}
                  className="flex-1 flex items-center justify-between text-left pr-4"
                >
                  <div className="flex items-center gap-2">
                    <h3 className="font-bold text-gray-700 dark:text-gray-200 uppercase tracking-wider">{dateStr}</h3>
                    <span className="text-xs bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300 px-2 py-0.5 rounded-full font-medium whitespace-nowrap">
                      {groupedHistory[dateStr].length} {groupedHistory[dateStr].length === 1 ? 'viaje' : 'viajes'}
                    </span>
                  </div>
                  {expandedDates[dateStr] ? (
                    <ChevronUp className="w-5 h-5 text-gray-500 dark:text-gray-400" />
                  ) : (
                    <ChevronDown className="w-5 h-5 text-gray-500 dark:text-gray-400" />
                  )}
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setDateToDelete(dateStr);
                  }}
                  className="p-2 text-red-500 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition-colors flex-shrink-0"
                  title="Borrar viajes del día"
                >
                  <Trash2 className="w-5 h-5" />
                </button>
              </div>
              
              {expandedDates[dateStr] && (
                <div className="p-4 space-y-4 animate-in fade-in slide-in-from-top-2 duration-200">
                  {groupedHistory[dateStr].map((item, i) => (
                    <div key={i} className="bg-white dark:bg-gray-800 p-5 rounded-xl border border-gray-100 dark:border-gray-700 flex flex-col gap-4 relative shadow-sm">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <div>
                          <div className="text-sm text-gray-500 dark:text-gray-400 mb-1">
                            {new Date(item.date).toLocaleTimeString()}
                          </div>
                          <div className="font-semibold text-gray-900 dark:text-white text-lg flex items-center gap-2">
                            <Package className="w-5 h-5 text-blue-500" />
                            {item.route.orders.length} Pedidos
                          </div>
                        </div>
                        <div className="flex gap-4 text-sm text-gray-600 dark:text-gray-300 bg-gray-50 dark:bg-gray-900/50 p-3 rounded-xl border border-gray-100 dark:border-gray-800">
                          <div className="flex items-center gap-1.5">
                            <MapIcon className="w-4 h-4 text-gray-400 dark:text-gray-500" />
                            <span>{item.route.totalDistanceEst}</span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <Clock className="w-4 h-4 text-gray-400 dark:text-gray-500" />
                            <span>{item.route.durationEst.replace(/minutos?.*/i, 'min.').replace(/,\s*m[aá]s tiempo.*/i, '')}</span>
                          </div>
                        </div>
                      </div>
                      
                      <div className="w-full mt-1 pt-3 border-t border-gray-100 dark:border-gray-700">
                        <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">Resumen de Cobro:</p>
                        <div className="grid grid-cols-3 gap-2">
                          <div className="bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 px-2 py-1.5 rounded-lg text-xs font-medium text-center truncate border border-green-100 dark:border-green-800/30">
                            Efe: ${item.route.orders.reduce((sum, o) => sum + (o.collectedCash || 0), 0).toFixed(2)}
                          </div>
                          <div className="bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400 px-2 py-1.5 rounded-lg text-xs font-medium text-center truncate border border-blue-100 dark:border-blue-800/30">
                            Tar: ${item.route.orders.reduce((sum, o) => sum + (o.collectedCard || 0), 0).toFixed(2)}
                          </div>
                          <div className="bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-400 px-2 py-1.5 rounded-lg text-xs font-medium text-center truncate border border-purple-100 dark:border-purple-800/30">
                            Val: ${item.route.orders.reduce((sum, o) => sum + (o.collectedVales || 0), 0).toFixed(2)}
                          </div>
                        </div>
                      </div>

                      <button 
                        onClick={() => setSelectedItem(item)}
                        className="w-full mt-2 py-3 bg-gray-50 dark:bg-gray-700 hover:bg-gray-100 dark:hover:bg-gray-600 text-gray-700 dark:text-white rounded-xl font-semibold text-sm border border-gray-200 dark:border-gray-600 transition-colors flex items-center justify-center gap-2"
                      >
                        <Eye className="w-4 h-4" />
                        Ver Detalles del Viaje
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {selectedItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-gray-50 dark:bg-gray-900 rounded-2xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="bg-white dark:bg-gray-800 px-5 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between sticky top-0 z-10">
              <div>
                <h3 className="font-bold text-lg text-gray-900 dark:text-white">Detalles del Viaje</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400">{new Date(selectedItem.date).toLocaleString()}</p>
              </div>
              <button 
                onClick={() => setSelectedItem(null)}
                className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
            
            <div className="p-5 overflow-y-auto space-y-4">
              {selectedItem.route.orders.map((order, idx) => (
                <div key={order.id} className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-4 shadow-sm">
                  <div className="flex justify-between items-start mb-2">
                    <div className="flex items-center gap-2">
                      <span className="bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 font-bold px-2 py-1 rounded text-xs">#{idx + 1}</span>
                      <h4 className="font-bold text-gray-900 dark:text-white line-clamp-1">{order.clientName}</h4>
                    </div>
                    <span className="text-xs font-mono text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-900 px-2 py-1 rounded border border-gray-100 dark:border-gray-700">
                      Folio: {order.orderNumber}
                    </span>
                  </div>
                  
                  <p className="text-sm text-gray-600 dark:text-gray-300 mb-3 line-clamp-2">{order.address}</p>

                  {order.subOrders && order.subOrders.length > 0 && (
                    <div className="mb-3 p-2 bg-gray-100/50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg space-y-2">
                      <p className="text-xs font-bold text-gray-600 dark:text-gray-400">Pedidos Agrupados ({order.subOrders.length}):</p>
                      {order.subOrders.map((sub, sidx) => (
                        <div key={sidx} className="flex justify-between items-center text-xs">
                          <span className="font-mono text-gray-500 dark:text-gray-400">{sub.orderNumber}</span>
                          <span className="font-semibold text-gray-700 dark:text-gray-300">{sub.amount}</span>
                        </div>
                      ))}
                    </div>
                  )}
                  
                  <div className="bg-gray-50 dark:bg-gray-900/50 rounded-lg p-3 space-y-2 text-sm border border-gray-100 dark:border-gray-700/50">
                    {order.delivered ? (
                      <div className="flex items-center gap-1.5 text-green-700 dark:text-green-500 font-medium pb-2 border-b border-gray-200/50 dark:border-gray-800">
                        <CheckCircle className="w-4 h-4" /> Entregado a: {order.receiverName || 'No especificado'}
                      </div>
                    ) : (
                      <div className="flex items-center gap-1.5 text-amber-600 dark:text-amber-500 font-medium pb-2 border-b border-gray-200/50 dark:border-gray-800">
                        <Clock className="w-4 h-4" /> No finalizado
                      </div>
                    )}
                    
                    <div className="flex justify-between items-center pt-1 text-gray-600 dark:text-gray-300">
                      <span className="text-gray-500 dark:text-gray-400">Monto Original:</span>
                      <span className="font-semibold">{order.amount}</span>
                    </div>

                    {((order.collectedCash && order.collectedCash > 0) || (order.changeGiven && order.changeGiven > 0)) && (
                      <div className="flex justify-between items-center text-green-700 dark:text-green-500">
                        <span className="flex items-center gap-1"><Receipt className="w-3.5 h-3.5"/> {order.changeGiven && order.changeGiven > 0 ? 'Efectivo recibido:' : 'Cobro Efectivo:'}</span>
                        <span className="font-semibold">${((order.collectedCash || 0) + (order.changeGiven || 0)).toFixed(2)}</span>
                      </div>
                    )}
                    {(order.collectedCard ? order.collectedCard > 0 : false) && (
                      <div className="flex justify-between items-center text-blue-700 dark:text-blue-500">
                        <span className="flex items-center gap-1"><CreditCard className="w-3.5 h-3.5"/> Cobro Tarjeta:</span>
                        <span className="font-semibold">${order.collectedCard?.toFixed(2)}</span>
                      </div>
                    )}
                    {(order.collectedVales ? order.collectedVales > 0 : false) && (
                      <div className="flex justify-between items-center text-purple-700 dark:text-purple-400">
                        <span className="flex items-center gap-1"><Receipt className="w-3.5 h-3.5"/> Cobro Vales:</span>
                        <span className="font-semibold">${order.collectedVales?.toFixed(2)}</span>
                      </div>
                    )}
                    {(order.changeGiven ? order.changeGiven > 0 : false) && (
                      <div className="flex justify-between items-center text-orange-600 dark:text-orange-500 border-t border-gray-200/50 dark:border-gray-700/50 pt-1 mt-1">
                        <span className="flex items-center gap-1">Cambio dado (se restó del fondo):</span>
                        <span className="font-semibold">${order.changeGiven?.toFixed(2)}</span>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
            
            <div className="bg-white dark:bg-gray-800 p-4 border-t border-gray-200 dark:border-gray-700 sticky bottom-0 z-10">
              <button 
                onClick={() => setSelectedItem(null)}
                className="w-full py-3 bg-gray-900 dark:bg-white text-white dark:text-gray-900 rounded-xl font-bold hover:bg-gray-800 dark:hover:bg-gray-100 transition-colors"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {dateToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white dark:bg-gray-800 rounded-2xl w-full max-w-sm p-6 shadow-2xl animate-in zoom-in-95 duration-200">
            <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2 text-center">¿Borrar historial?</h3>
            <p className="text-gray-600 dark:text-gray-300 text-center mb-6">
              ¿Estás seguro de que deseas borrar todos los viajes del día <span className="font-bold">{dateToDelete}</span>? Esta acción no se puede deshacer.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setDateToDelete(null)}
                className="flex-1 py-3 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 font-semibold rounded-xl hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={() => {
                  const updatedHistory = history.filter(item => {
                    const d = new Date(item.date);
                    const itemDateStr = isNaN(d.getTime()) 
                      ? 'Fecha desconocida' 
                      : d.toLocaleDateString('es-MX', { year: 'numeric', month: 'long', day: 'numeric' });
                    return itemDateStr !== dateToDelete;
                  });
                  setHistory(updatedHistory);
                  localStorage.setItem('logiruta_history', JSON.stringify(updatedHistory));
                  toast.success(`Viajes del día ${dateToDelete} eliminados`);
                  setDateToDelete(null);
                }}
                className="flex-1 py-3 bg-red-500 dark:bg-red-600 text-white font-semibold rounded-xl hover:bg-red-600 dark:hover:bg-red-700 transition-colors shadow-sm"
              >
                Borrar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
