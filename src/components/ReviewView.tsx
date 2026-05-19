import { useState, useEffect, useRef } from 'react';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import { ProcessingResult, Order } from '../lib/gemini';
import { AlertCircle, Play, MapPin, GripVertical, Info, Edit2, Check, X, Save, ExternalLink, RefreshCw, Loader2 } from 'lucide-react';
import { cn } from '../lib/utils';

interface ReviewViewProps {
  routeInfo: ProcessingResult;
  onStartDelivery: (updatedRoute: ProcessingResult) => void;
  onCancel: () => void;
}

export function ReviewView({ routeInfo, onStartDelivery, onCancel }: ReviewViewProps) {
  const [orders, setOrders] = useState(routeInfo.orders);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editAddress, setEditAddress] = useState('');
  
  const [currentLoc, setCurrentLoc] = useState<{lat: number, lng: number} | null>(null);
  const [locError, setLocError] = useState('');
  const [routeChanged, setRouteChanged] = useState(false);

  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => setCurrentLoc({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
        (err) => setLocError('No se pudo obtener la ubicación actual. Activa el GPS.')
      );
    } else {
      setLocError('Geolocalización no soportada en este navegador.');
    }
  }, []);

  const [isUpdatingRoute, setIsUpdatingRoute] = useState(false);

  const handleDragEnd = (result: any) => {
    if (!result.destination) return;
    if (result.destination.index === result.source.index) return; // no change
    const items = Array.from(orders);
    const [reorderedItem] = items.splice(result.source.index, 1);
    items.splice(result.destination.index, 0, reorderedItem);
    setOrders(items);
    
    setIsUpdatingRoute(true);
    setRouteChanged(false);
    setTimeout(() => setIsUpdatingRoute(false), 1200);
  };

  const [editCoords, setEditCoords] = useState('');

  const saveEdit = (id: string, originalAddress: string, originalCoords: string) => {
    if (editAddress.trim() === originalAddress.trim() && editCoords.trim() === originalCoords.trim()) {
      setEditingId(null);
      setEditCoords('');
      return;
    }
    
    setOrders(o => o.map(order => order.id === id ? { ...order, address: editAddress, coords: editCoords, isAmbiguous: false } : order));
    setEditingId(null);
    setEditCoords('');
    
    setIsUpdatingRoute(true);
    setRouteChanged(false);
    setTimeout(() => setIsUpdatingRoute(false), 1200);
  };

  const [showAmbiguousModal, setShowAmbiguousModal] = useState(false);

  const openValidGoogleMapsRoute = () => {
    setRouteChanged(false);
    if (!currentLoc) {
      alert("Esperando ubicación actual... por favor acepta los permisos de ubicación o revisa tu GPS.");
      return;
    }
    
    // Origin is current location
    const origin = `${currentLoc.lat},${currentLoc.lng}`;
    
    // We need at least one destination
    if (orders.length === 0) return;
    
    const getLocationStr = (o: Order) => {
      if (o.coords) {
        return o.coords.replace(/\s+/g, '');
      }
      const match = o.address.match(/(-?\d+\.\d+)[,\s]+(-?\d+\.\d+)/);
      if (match) {
        return `${match[1]},${match[2]}`;
      }
      const cleanAddress = o.address.replace(/https?:\/\/[^\s]+/g, '').trim();
      return `${cleanAddress || o.clientName}, Veracruz`;
    };

    const waypoints = orders.slice(0, -1).map(getLocationStr).map(encodeURIComponent).join('|');
    const destination = getLocationStr(orders[orders.length - 1]);
    const url = `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(origin)}&destination=${encodeURIComponent(destination)}&waypoints=${waypoints}&travelmode=driving`;
    window.open(url, '_blank');
  };

  const openGoogleMapsRoute = () => {
    // Check if any order is ambiguous
    if (orders.some(o => o.isAmbiguous)) {
      setShowAmbiguousModal(true);
      return;
    }
    openValidGoogleMapsRoute();
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      
      {/* Route Map replacement */}
      <div className="bg-blue-50 rounded-2xl shadow-sm border border-blue-200 overflow-hidden p-6 text-center">
        <h3 className="text-blue-900 font-bold mb-2">Ruta en Google Maps</h3>
        <p className="text-blue-700 text-sm mb-4">
          Haz clic en el siguiente botón para revisar la ruta en Google Maps. El botón te llevará a la app con los puntos ordenados: tu ubicación actual como partida, y los pedidos como destinos.
        </p>
        
        {locError && <p className="text-red-500 text-xs mb-3 font-semibold">{locError}</p>}
        {!currentLoc && !locError && <p className="text-blue-500 text-xs mb-3 animate-pulse">Obteniendo ubicación actual...</p>}
        
        <button
          onClick={openGoogleMapsRoute}
          disabled={!currentLoc || isUpdatingRoute}
          className={cn(
            "inline-flex items-center gap-2 px-6 py-3 rounded-xl font-bold transition-all shadow-sm",
            currentLoc && !isUpdatingRoute ? "bg-blue-600 text-white hover:bg-blue-700" : "bg-blue-400 text-white cursor-not-allowed"
          )}
        >
          {isUpdatingRoute ? <Loader2 className="w-5 h-5 animate-spin" /> : <ExternalLink className="w-5 h-5" />}
          {isUpdatingRoute ? "Actualizando ruta..." : "Ver ruta completa"}
        </button>
      </div>

      {/* Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-gray-800 p-4 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
          <div className="text-sm text-gray-500 dark:text-gray-400 font-medium">Distancia</div>
          <div className="text-lg font-bold text-gray-900 dark:text-white">{routeInfo.totalDistanceEst}</div>
        </div>
        <div className="bg-white dark:bg-gray-800 p-4 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
          <div className="text-sm text-gray-500 dark:text-gray-400 font-medium">Duración</div>
          <div className="text-lg font-bold text-gray-900 dark:text-white">{routeInfo.durationEst}</div>
        </div>
        <div className="bg-white dark:bg-gray-800 p-4 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
          <div className="text-sm text-gray-500 dark:text-gray-400 font-medium">Tráfico</div>
          <div className="text-lg font-semibold text-orange-600 dark:text-orange-400">{routeInfo.trafficCondition}</div>
        </div>
        <div className="bg-white dark:bg-gray-800 p-4 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
          <div className="text-sm text-gray-500 dark:text-gray-400 font-medium">Pedidos</div>
          <div className="text-lg font-bold text-gray-900 dark:text-white">{orders.length}</div>
        </div>
      </div>

      {routeInfo.mismatches.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 p-4 rounded-xl flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
          <div>
            <h4 className="font-medium text-amber-800">Dígitos no coincidentes</h4>
            <p className="text-amber-700 text-sm mt-1">Los siguientes TR/Pagos no coincidieron con ninguna factura: {routeInfo.mismatches.join(', ')}</p>
          </div>
        </div>
      )}

      {/* Reorderable List */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 p-4 sm:p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold text-gray-800 dark:text-gray-200">Secuencia de Ruta</h2>
          <span className="text-xs text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded">Arrastra para reordenar</span>
        </div>
        
        <DragDropContext onDragEnd={handleDragEnd}>
          <Droppable droppableId="orders">
            {(provided) => (
              <div {...provided.droppableProps} ref={provided.innerRef} className="space-y-3">
                {orders.map((order, index) => (
                  // @ts-ignore
                  <Draggable key={order.id} draggableId={order.id} index={index}>
                    {(provided, snapshot) => (
                      <div
                        ref={provided.innerRef}
                        {...provided.draggableProps}
                        className={cn(
                          "flex items-stretch gap-3 bg-white dark:bg-gray-800 p-4 rounded-xl border transition-shadow",
                          snapshot.isDragging ? "shadow-lg border-blue-300 dark:border-blue-500 z-10 relative" : "shadow-sm border-gray-200 dark:border-gray-700",
                          order.isAmbiguous ? "border-red-300 dark:border-red-500/50 bg-red-50 dark:bg-red-900/20" : ""
                        )}
                      >
                        <div {...provided.dragHandleProps} className="flex items-center text-gray-400 hover:text-gray-600 dark:hover:text-gray-200">
                          <GripVertical className="w-5 h-5" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2">
                            <div className="font-bold text-gray-900 dark:text-white truncate">
                              {index + 1}. {order.clientName}
                            </div>
                            <div className="text-sm font-mono text-gray-500 dark:text-gray-400 whitespace-nowrap">#{order.orderNumber}</div>
                          </div>
                          
                          {editingId === order.id ? (
                            <div className="flex flex-col gap-2 mt-3 bg-blue-50/50 p-3 rounded-lg border border-blue-100">
                              <p className="text-xs text-gray-600 font-medium">Dirección original:</p>
                              <div>
                                <input 
                                  type="text"
                                  value={editAddress}
                                  onChange={e => setEditAddress(e.target.value)}
                                  className="w-full text-sm p-2 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                  placeholder="Escribe la dirección"
                                />
                              </div>
                              <p className="text-xs text-gray-600 font-medium mt-1">Coordenadas o Link de Maps:</p>
                              <div className="flex items-center justify-between gap-2">
                                <input 
                                  type="text"
                                  value={editCoords}
                                  onChange={e => setEditCoords(e.target.value)}
                                  className="flex-1 min-w-0 text-sm p-2 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                  placeholder="Ej. https://maps.app.goo.gl/..."
                                />
                                <div className="flex items-center gap-1 shrink-0">
                                  <button onClick={() => { setEditingId(null); setEditCoords(''); }} className="text-gray-600 dark:text-gray-400 bg-gray-200 dark:bg-gray-700 p-2 hover:bg-gray-300 dark:hover:bg-gray-600 rounded-lg transition-colors" title="Cancelar">
                                    <X className="w-5 h-5" />
                                  </button>
                                  <button onClick={() => saveEdit(order.id, order.address, order.coords || '')} className="text-white bg-blue-600 p-2 hover:bg-blue-700 rounded-lg shadow-sm transition-colors" title="Guardar">
                                    <Save className="w-5 h-5" />
                                  </button>
                                </div>
                              </div>
                            </div>
                          ) : (
                            <div className="flex items-start gap-2 mt-1">
                              <MapPin className={cn("w-4 h-4 mt-0.5 flex-shrink-0", order.isAmbiguous ? "text-red-500" : "text-gray-400 dark:text-gray-500")} />
                              <div className="flex flex-col flex-1 min-w-0">
                                <span className={cn("text-sm line-clamp-2", order.isAmbiguous ? "text-red-600 dark:text-red-400 font-medium" : "text-gray-600 dark:text-gray-300")}
                                  style={{ wordBreak: 'break-all' }}>
                                  {order.address}
                                </span>
                                {order.coords && (
                                  <span className="text-xs text-blue-600 dark:text-blue-400 font-mono mt-1">
                                    📍 Info GPS: {order.coords}
                                  </span>
                                )}
                              </div>
                              <button 
                                onClick={() => {
                                  setEditAddress(order.address);
                                  setEditCoords(order.coords || '');
                                  setEditingId(order.id);
                                }}
                                className="text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/30 p-1 rounded transition-colors flex-shrink-0"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          )}
                          
                          {order.comments && (
                            <div className="mt-2 text-xs bg-yellow-50 dark:bg-yellow-900/20 text-yellow-800 dark:text-yellow-500 px-2 py-1 rounded inline-flex">
                              <Info className="w-3 h-3 mr-1 mt-0.5" />
                              {order.comments}
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </Draggable>
                ))}
                {provided.placeholder}
              </div>
            )}
          </Droppable>
        </DragDropContext>
      </div>

      <div className="flex gap-4">
        <button
          onClick={onCancel}
          className="px-5 py-3 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-300 rounded-xl font-semibold text-base hover:bg-gray-50 dark:hover:bg-gray-700 transition-all flex-1"
        >
          Cancelar
        </button>
        <button
          onClick={() => onStartDelivery({ ...routeInfo, orders })}
          className="flex-[2] py-3 bg-green-600 hover:bg-green-700 text-white rounded-xl font-semibold text-base shadow-md transition-all flex items-center justify-center gap-2"
        >
          <Play className="w-5 h-5 fill-current" />
          Iniciar Reparto
        </button>
      </div>

      {showAmbiguousModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/60 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white dark:bg-gray-800 rounded-3xl w-full max-w-lg shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95 max-h-[90vh]">
            <div className="p-6 border-b border-gray-100 dark:border-gray-700 flex justify-between items-center bg-red-50/50 dark:bg-red-900/10">
              <h3 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                <AlertCircle className="w-6 h-6 text-red-500" />
                Direcciones ambiguas
              </h3>
              <button onClick={() => setShowAmbiguousModal(false)} className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-6 overflow-y-auto space-y-4">
              <p className="text-sm text-gray-600 dark:text-gray-400 font-medium">
                Las siguientes rutas no coincidieron con ninguna ubicación exacta en Google Maps.
                Agrega el <strong>link de Google Maps</strong> o <strong>coordenadas</strong> para corregir la ubicación manualmente, o pulsa en Continuar de todos modos para forzar la ruta.
              </p>
              
              {orders.filter(o => o.isAmbiguous).map((order) => (
                <div key={order.id} className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-900 p-4 rounded-xl">
                  <p className="font-bold text-gray-900 dark:text-white mb-1">{order.clientName}</p>
                  <p className="text-sm text-gray-600 dark:text-gray-400 line-clamp-2 leading-relaxed mb-3">{order.address}</p>
                  <button 
                    onClick={() => {
                      setEditAddress(order.address);
                      setEditingId(order.id);
                      setShowAmbiguousModal(false);
                      // Scroll to top or specific edit block
                      window.scrollTo({ top: 0, behavior: 'smooth' });
                    }}
                    className="w-full flex items-center justify-center gap-2 py-2 text-red-700 dark:text-red-400 bg-red-100 dark:bg-red-900/40 hover:bg-red-200 dark:hover:bg-red-900/60 rounded-lg font-bold text-sm transition-colors"
                  >
                    <Edit2 className="w-4 h-4" /> Corregir dirección
                  </button>
                </div>
              ))}
            </div>
            
            <div className="p-6 border-t border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/80 flex flex-col sm:flex-row gap-3">
              <button 
                onClick={() => setShowAmbiguousModal(false)} 
                className="flex-1 py-3 text-gray-600 dark:text-gray-300 font-semibold hover:bg-gray-100 dark:hover:bg-gray-700 rounded-xl transition-colors"
              >
                Cancelar
              </button>
              <button 
                onClick={() => {
                  setShowAmbiguousModal(false);
                  openValidGoogleMapsRoute();
                }} 
                className="flex-[2] py-3 bg-red-600 hover:bg-red-700 text-white rounded-xl font-bold transition-all shadow-md flex items-center justify-center gap-2"
              >
                <ExternalLink className="w-5 h-5" />
                Continuar de todos modos
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

