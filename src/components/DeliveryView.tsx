import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ProcessingResult, Order } from '../lib/gemini';
import { Navigation2, CheckCircle, ChevronRight, ChevronLeft, ChevronDown, ChevronUp, MessageSquare, CreditCard, Receipt, Camera, User, Phone, MessageCircle, X, Plus, Ticket, Pencil } from 'lucide-react';
import { cn } from '../lib/utils';
import { dbLocal } from '../lib/dbLocal';
import { toast } from 'sonner';

type PaymentMethodType = 'cash' | 'card' | 'vales';

interface DeliveryViewProps {
  routeInfo: ProcessingResult;
  currentIndex: number;
  onNext?: (updatedOrder: Order) => void;
  onFinish?: (updatedOrder?: Order) => void;
  onCancel?: () => void;
  onIndexChange?: (index: number) => void;
  onPhotoRequest?: (callback: (dataUrl: string) => void) => void;
  useCustomCamera?: boolean;
  onFundChange?: (amount: number, desc: string, type: 'open' | 'add' | 'subtract' | 'close') => void;
  onRouteUpdate?: (updatedRoute: ProcessingResult) => void;
}

function extractNumber(amountStr: string | number | undefined) {
  if (amountStr === undefined || amountStr === null) return '';
  const str = String(amountStr);
  const match = str.replace(/,/g, '').match(/(\d+(\.\d+)?)/);
  return match ? match[1] : '';
}

function getGreeting() {
  const hour = new Date().getHours();
  if (hour >= 0 && hour < 12) return 'Buenos días';
  if (hour >= 12 && hour < 19) return 'Buenas tardes';
  return 'Buenas noches';
}

export function DeliveryView({ routeInfo, currentIndex, onNext, onFinish, onCancel, onIndexChange, onFundChange, onRouteUpdate }: DeliveryViewProps) {
  const order = routeInfo?.orders?.[currentIndex];
  const [showSubOrders, setShowSubOrders] = useState(false);
  
  const activeOrderIndex = routeInfo.orders.findIndex(o => !o.delivered);
  // Un pedido es "futuro" si no estamos todos entregados, y el local index > activeOrderIndex
  const isFutureOrder = activeOrderIndex !== -1 && currentIndex > activeOrderIndex;

  const [paymentMode, setPaymentMode] = useState<'single' | 'split'>('single');
  const [cashAmount, setCashAmount] = useState('');
  const [cardAmount, setCardAmount] = useState('');
  const [valesAmount, setValesAmount] = useState('');
  const [receivedCashStr, setReceivedCashStr] = useState('');
  
  type SplitMethod = { id: string; type: PaymentMethodType; amount: string };
  const [splitMethods, setSplitMethods] = useState<SplitMethod[]>([
    { id: 'initial-cash', type: 'cash', amount: '' },
    { id: 'initial-card', type: 'card', amount: '' }
  ]);
  
  const [showAddMethodModal, setShowAddMethodModal] = useState(false);
  const [showSaveConfirm, setShowSaveConfirm] = useState(false);
  const [receiverName, setReceiverName] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [isPlOverride, setIsPlOverride] = useState(false);
  const [showWaModal, setShowWaModal] = useState(false);

  const [isEditingAmount, setIsEditingAmount] = useState(false);
  const [editedAmountValue, setEditedAmountValue] = useState('');

  useEffect(() => {
    if (order) {
      setPaymentMode('single');
      setCashAmount(order.collectedCash ? String(order.collectedCash) : '');
      setCardAmount(order.collectedCard ? String(order.collectedCard) : '');
      setValesAmount(order.collectedVales ? String(order.collectedVales) : '');
      setReceivedCashStr('');
      setReceiverName(order.receiverName || '');
      setIsPlOverride(false);
      setShowWaModal(false);
      setSplitMethods([]);
      setIsEditingAmount(false);
      setEditedAmountValue('');
    }
  }, [order?.id]);

  const handleSaveAmount = () => {
    if (!editedAmountValue.trim()) {
      toast.error('Por favor ingresa un monto válido.');
      return;
    }
    const updatedOrders = [...routeInfo.orders];
    const currentOrder = updatedOrders[currentIndex];
    
    let formattedAmount = editedAmountValue.trim();
    if (!formattedAmount.startsWith('$')) {
      formattedAmount = `$${formattedAmount}`;
    }
    
    updatedOrders[currentIndex] = {
      ...currentOrder,
      amount: formattedAmount
    };
    
    const updatedRoute = {
      ...routeInfo,
      orders: updatedOrders
    };
    
    if (onRouteUpdate) {
      onRouteUpdate(updatedRoute);
    }
    
    setIsEditingAmount(false);
    toast.success(`Monto del pedido actualizado a ${formattedAmount}`);
  };

  if (!order) return null;

  const paymentMethod = String(order.paymentMethod || '');
  const isPaid = paymentMethod.toLowerCase().includes('pagado') || paymentMethod.toLowerCase().includes('línea') || isPlOverride;
  const parsedDefaultAmount = extractNumber(order.amount);
  const totalAmountValue = Number(parsedDefaultAmount) || 0;
  
  const splitTotal = splitMethods.reduce((sum, m) => sum + (Number(m.amount) || 0), 0);
  const diff = totalAmountValue - splitTotal;
  const remainingAmount = diff > 0 ? diff : 0;
  const changeToGive = diff < 0 ? Math.abs(diff) : 0;
  
  const changeSingle = cashAmount && Number(receivedCashStr) > totalAmountValue 
    ? Number(receivedCashStr) - totalAmountValue 
    : 0;
    
  const addSplitMethod = (type: PaymentMethodType) => {
    setSplitMethods(prev => [...prev, { id: Math.random().toString(), type, amount: '' }]);
  };

  const updateSplitMethodAmount = (id: string, amount: string) => {
    setSplitMethods(prev => prev.map(m => m.id === id ? { ...m, amount } : m));
  };

  const removeSplitMethod = (id: string) => {
    setSplitMethods(prev => prev.filter(m => m.id !== id));
  };

  const handleAction = (isFinishing: boolean) => {
    if (!receiverName.trim()) {
      toast.error("Por favor, ingresa el nombre de quién recibe el pedido.");
      return;
    }

    let finalCollectedCash = 0;
    let finalCollectedCard = 0;
    let finalCollectedVales = 0;

    if (!isPaid) {
      if (paymentMode === 'single') {
        finalCollectedCash = Number(cashAmount) || 0;
        finalCollectedCard = Number(cardAmount) || 0;
        finalCollectedVales = Number(valesAmount) || 0;
      } else {
        const totalCard = splitMethods.filter(m => m.type === 'card').reduce((sum, m) => sum + (Number(m.amount) || 0), 0);
        const totalVales = splitMethods.filter(m => m.type === 'vales').reduce((sum, m) => sum + (Number(m.amount) || 0), 0);
        let totalCash = splitMethods.filter(m => m.type === 'cash').reduce((sum, m) => sum + (Number(m.amount) || 0), 0);
        
        const currentSplitTotal = totalCard + totalVales + totalCash;
        if (currentSplitTotal > totalAmountValue) {
          const change = currentSplitTotal - totalAmountValue;
          totalCash = Math.max(0, totalCash - change);
        }

        finalCollectedCard = totalCard;
        finalCollectedVales = totalVales;
        finalCollectedCash = totalCash;
      }
    }

    const actualChangeGiven = paymentMode === 'single' ? changeSingle : changeToGive;

    if (actualChangeGiven > 0 && onFundChange) {
      const orderSubStr = order.orderNumber ? order.orderNumber.slice(-4) : '';
      onFundChange(actualChangeGiven, `Cambio Pedido ${orderSubStr}`.trim(), 'subtract');
    }

    const now = new Date();
    const timeString = now.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })
      .toLowerCase()
      .replace('pm', 'p.m.')
      .replace('am', 'a.m.');

    const updatedOrder: Order = {
      ...order,
      receiverName: receiverName.trim(),
      collectedCash: finalCollectedCash,
      collectedCard: finalCollectedCard,
      collectedVales: finalCollectedVales,
      delivered: true,
      deliveredAt: timeString,
      changeGiven: actualChangeGiven,
    };

    setIsSaving(true);
    
    // Offline sync queue
    dbLocal.addToQueue({
      type: 'delivery_update',
      data: updatedOrder
    }).catch(console.error);

    toast.success("Pedido entregado. Cargando siguiente...");
    
    // Intent para llamar a nuestra Aplicación Puente (Bridge APK)
    // Cuando el usuario instale tu APK puente, este intent la abrirá,
    // y tu APK se encargará de abrir Spark nativamente.
    const bridgeIntent = "intent://open#Intent;scheme=sparkbridge;package=com.tuempresa.sparkbridge;end;";

    // Intentar abrir la app puente
    window.location.href = bridgeIntent;

    // Sistema de Fallback inteligente con validación de foco
    const timer = setTimeout(() => {
      // Si la PWA sigue visible después de 2.5s, es porque la app puente NO está instalada.
      // Aquí podemos enviarlo a descargar la app puente o dejar un mensaje.
      if (!document.hidden) {
        toast.error("Por favor instala la app puente para abrir Spark automáticamente.");
      }
    }, 2500);

    // Si la app se abre con éxito, limpiamos el timer para evitar el salto a la Play Store al regresar
    const limpiarTimer = () => {
      clearTimeout(timer);
      window.removeEventListener("pagehide", limpiarTimer);
      document.removeEventListener("visibilitychange", limpiarTimer);
    };

    window.addEventListener("pagehide", limpiarTimer);
    document.addEventListener("visibilitychange", limpiarTimer);

    // El retraso de 2 segundos SOLO APLICA a los cambios visuales de la interfaz
    // para dar tiempo a ver el Toast o para la transición cuando regrese a la app.
    setTimeout(() => {
      setIsSaving(false);
      
      if (isFinishing) {
        if (onFinish) onFinish(updatedOrder);
      } else {
        if (onNext) onNext(updatedOrder);
      }
    }, 2000);
  };

  const openGPS = () => {
    const coordsStr = typeof order.coords === 'string' ? order.coords.trim() : '';
    
    if (coordsStr && coordsStr.startsWith('http')) {
      window.open(coordsStr, '_blank');
      return;
    }

    if (coordsStr) {
      const query = encodeURIComponent(coordsStr);
      window.open(`https://www.google.com/maps/search/?api=1&query=${query}`, '_blank');
      return;
    }

    const query = encodeURIComponent(`${order.address || ''}, Veracruz`);
    const url = `https://www.google.com/maps/search/?api=1&query=${query}`;
    window.open(url, '_blank');
  };

  const getShortName = (fullName?: string) => {
    if (!fullName) return 'Cliente';
    const parts = fullName.trim().split(/\s+/);
    if (parts.length <= 2) return fullName;
    if (parts.length === 3) return `${parts[0]} ${parts[1]}`;
    return `${parts[0]} ${parts[2]}`;
  };

  const sendWhatsApp = (msgIndex: number) => {
    if (!order.phone) {
      toast.error("No hay teléfono registrado.");
      return;
    }
    const greeting = getGreeting().toLowerCase();
    const shortName = getShortName(order.clientName || 'Cliente');
    let text = "";
    if (msgIndex === 1) {
      text = `Hola ${shortName}, ${greeting} 🙋🏻‍♂️\nSoy el repartidor asignado de *Walmart* .\nMe comunico con usted para informarle que acabo de iniciar mi ruta de entrega de pedidos. Me comunico más tarde con usted cuando me dirija a su domicilio. 📦`;
    } else if (msgIndex === 2) {
      text = `Hola ${shortName}, ${greeting}. Me comunico de Walmart. Soy el repartidor asignado, traigo su pedido. Me encuentro ya en el punto que me marca el GPS 📍`;
    } else if (msgIndex === 3) {
      text = `Hola ${shortName}, ${greeting}. Me comunico de Walmart. Llevo su pedido. ¿Me podría compartir su ubicación por favor?`;
    }
    
    const phoneStr = String(order.phone || '');
    const cleanPhone = phoneStr.replace(/\D/g, '');
    const finalPhone = cleanPhone.length === 10 ? `52${cleanPhone}` : cleanPhone;
    window.open(`https://wa.me/${finalPhone}?text=${encodeURIComponent(text)}`, '_blank');
    setShowWaModal(false);
  };

  const isLast = currentIndex === routeInfo.orders.length - 1;

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300 max-w-lg mx-auto">
      
      {/* Header Status con Paginacion */}
      <div className="bg-gray-900 text-white p-3 flex justify-between items-center rounded-xl shadow-md">
        <div className="flex items-center gap-1.5 xs:gap-2">
          <button
            type="button"
            disabled={currentIndex === 0}
            onClick={() => onIndexChange && onIndexChange(currentIndex - 1)}
            className="p-1 px-2.5 bg-white/10 hover:bg-white/20 disabled:opacity-30 disabled:hover:bg-white/10 rounded-lg text-xs font-bold transition-all"
            title="Pedido Anterior"
          >
            ← Volver
          </button>
          <div className="font-semibold text-gray-300 text-xs sm:text-sm">
            {currentIndex + 1} / {routeInfo.orders.length}
          </div>
          <button
            type="button"
            disabled={currentIndex === routeInfo.orders.length - 1}
            onClick={() => onIndexChange && onIndexChange(currentIndex + 1)}
            className="p-1 px-2.5 bg-white/10 hover:bg-white/20 disabled:opacity-30 disabled:hover:bg-white/10 rounded-lg text-xs font-bold transition-all"
            title="Siguiente Pedido"
          >
            Sig. →
          </button>
        </div>
        <div className="flex items-center gap-2">
          <div className="text-xs bg-white/20 px-2 py-0.5 rounded-md font-mono">
            #{String(order.orderNumber || '').slice(0, -4)}<strong className="font-extrabold text-white">{String(order.orderNumber || '').slice(-4)}</strong>
          </div>
        </div>
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={currentIndex}
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -20 }}
          transition={{ duration: 0.2, ease: "easeInOut" }}
          className="space-y-6"
        >
          {/* TR Code Prominent if exists */}
          {order.trCode && order.trCode !== 'No se proporcionó TR' && (
        <div className="bg-blue-50 dark:bg-blue-900/30 border-l-4 border-blue-500 dark:border-blue-400 p-3 rounded-r-xl shadow-sm flex items-center justify-between border border-blue-100 dark:border-blue-900/50">
          <span className="font-bold text-blue-800 dark:text-blue-300 text-sm tracking-wide uppercase">CÓDIGO TR:</span>
          <span className="text-xl font-black font-mono text-blue-900 dark:text-blue-100">{order.trCode.replace(/^tr\s*/i, '').replace(/^TR\s*/i, '')}</span>
        </div>
      )}

      {/* Main Delivery Card */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="p-4 md:p-5 space-y-3">
          
          <div>
            <div className="flex items-start justify-between gap-2 flex-wrap mb-1">
              <h2 className="text-lg sm:text-xl font-bold text-gray-900 dark:text-white leading-tight">{order.clientName}</h2>
              {order.deliveryTime && order.deliveryTime !== 'No especificada' && (
                <span className="inline-flex items-center gap-1 text-[11px] font-bold bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/60 text-amber-700 dark:text-amber-400 px-2 py-0.5 rounded-full uppercase tracking-wider animate-pulse">
                  ⏱ Prometido: {order.deliveryTime}
                </span>
              )}
            </div>
            <p className="text-sm text-gray-600 dark:text-gray-300 leading-snug">{order.address}</p>
          </div>

          <div className="flex flex-col gap-2">
            <button
              onClick={openGPS}
              className="w-full py-2.5 bg-blue-600 text-white rounded-xl font-bold text-base hover:bg-blue-700 transition-colors shadow flex items-center justify-center gap-2"
            >
              <Navigation2 className="w-5 h-5 fill-current" />
              Navegar al GPS
            </button>
            {order.phone && (
              <div className="flex gap-2">
                <a
                  href={`tel:${order.phone}`}
                  className="flex-1 py-2 bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded-xl font-bold text-sm border border-gray-200 dark:border-gray-600 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors flex items-center justify-center gap-1.5"
                >
                  <Phone className="w-4 h-4" /> Llamar
                </a>
                <button
                  onClick={() => setShowWaModal(true)}
                  className="flex-1 py-2 bg-[#25D366] text-white rounded-xl font-bold text-sm shadow-sm hover:bg-[#128C7E] transition-colors flex items-center justify-center gap-1.5"
                >
                  <MessageCircle className="w-4 h-4" /> WhatsApp
                </button>
              </div>
            )}
          </div>

          <hr className="border-gray-100 dark:border-gray-700" />

          {order.subOrders && order.subOrders.length > 0 && (
            <div className="border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden bg-gray-50 dark:bg-gray-800 w-full mb-3">
              <button 
                onClick={() => setShowSubOrders(!showSubOrders)}
                className="w-full flex items-center justify-between p-3 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
              >
                <span className="font-bold text-gray-800 dark:text-gray-200 text-sm">Ver los {order.subOrders.length} pedidos incluidos</span>
                {showSubOrders ? <ChevronUp className="w-5 h-5 text-gray-500 dark:text-gray-400" /> : <ChevronDown className="w-5 h-5 text-gray-500 dark:text-gray-400" />}
              </button>
              {showSubOrders && (
                <div className="p-3 space-y-2 border-t border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50">
                  {order.subOrders.map((sub, idx) => (
                    <div key={idx} className="bg-white dark:bg-gray-800 p-3 rounded-lg border border-gray-200 dark:border-gray-700">
                      <div className="flex justify-between items-start mb-1">
                        <span className="text-xs font-mono font-bold bg-gray-100 dark:bg-gray-900 px-1.5 py-0.5 rounded text-gray-700 dark:text-gray-300">
                          Folio: {String(sub.orderNumber || '').slice(0, -4)}<strong className="font-extrabold text-gray-900 dark:text-white">{String(sub.orderNumber || '').slice(-4)}</strong>
                        </span>
                        <span className="text-xs font-bold text-blue-700 dark:text-blue-400">{sub.amount}</span>
                      </div>
                      <p className="text-xs text-gray-600 dark:text-gray-400 mb-2">Pago: {sub.paymentMethod}</p>
                      {sub.trCode && sub.trCode !== 'No se proporcionó TR' && (
                        <div className="text-xs bg-blue-50 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300 p-1.5 rounded font-mono border border-blue-100 dark:border-blue-900/50">TR: {sub.trCode.replace(/^tr\s*/i, '')}</div>
                      )}
                      {sub.comments && (
                        <div className="text-xs text-amber-700 dark:text-amber-400 mt-1 bg-amber-50 dark:bg-amber-900/30 p-1.5 rounded border border-amber-100 dark:border-amber-900/50 italic">{sub.comments}</div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Payment Section */}
          <div className="space-y-3">
            {order.delivered ? (
              <div className="bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-100 dark:border-emerald-900/60 p-3.5 rounded-xl space-y-3">
                <div className="flex items-center gap-2 text-emerald-800 dark:text-emerald-400 mb-2">
                  <CheckCircle className="w-5 h-5 flex-shrink-0" />
                  <h3 className="font-bold text-sm">Resumen de Entrega</h3>
                  {order.deliveredAt && (
                    <span className="ml-auto text-xs font-semibold bg-emerald-100 dark:bg-emerald-900/40 px-2 py-0.5 rounded-md border border-emerald-200 dark:border-emerald-800">
                      {order.deliveredAt}
                    </span>
                  )}
                </div>
                
                <div className="space-y-1.5 text-sm font-medium text-emerald-900 dark:text-emerald-300 bg-white/50 dark:bg-black/20 p-2.5 rounded-lg">
                  {order.collectedCash ? <div className="flex justify-between"><span>Efectivo:</span> <span>${order.collectedCash.toFixed(2)}</span></div> : null}
                  {order.collectedCard ? <div className="flex justify-between"><span>Tarjeta:</span> <span>${order.collectedCard.toFixed(2)}</span></div> : null}
                  {order.collectedVales ? <div className="flex justify-between"><span>Vales:</span> <span>${order.collectedVales.toFixed(2)}</span></div> : null}
                  {order.changeGiven ? <div className="flex justify-between text-orange-600 dark:text-orange-400"><span>Cambio entregado:</span> <span>${order.changeGiven.toFixed(2)}</span></div> : null}
                  {!order.collectedCash && !order.collectedCard && !order.collectedVales && (
                    <div className="text-emerald-700 dark:text-emerald-400">Pago en línea (No se cobró nada)</div>
                  )}
                </div>
                
                <div className="text-sm pt-2 bg-white/40 dark:bg-black/10 p-2.5 rounded-lg flex items-center gap-2">
                  <User className="w-4 h-4 text-emerald-600 dark:text-emerald-500" />
                  <span className="font-semibold text-emerald-900 dark:text-emerald-300">Recibió:</span>
                  <span className="text-emerald-800 dark:text-emerald-200">{order.receiverName || 'No registrado'}</span>
                </div>
              </div>
            ) : isPaid ? (
              <div className="bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-900/50 p-3 rounded-xl space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 text-emerald-800 dark:text-emerald-400">
                    <CheckCircle className="w-5 h-5 flex-shrink-0" />
                    <div>
                      <h3 className="font-bold text-sm">📝 Pedido Pagado</h3>
                      <p className="text-emerald-700 dark:text-emerald-500 font-medium leading-snug text-xs">Solo entregar, no recibir pago.</p>
                    </div>
                  </div>
                  {/* Edit Amount Pencil for prepaid orders too */}
                  <div className="flex items-center gap-1.5 bg-emerald-100/50 dark:bg-emerald-900/50 px-2 py-1 rounded-lg">
                    <span className="text-xs font-bold text-emerald-800 dark:text-emerald-300">{order.amount}</span>
                    <button 
                      onClick={() => {
                        setEditedAmountValue(String(order.amount).replace('$', ''));
                        setIsEditingAmount(true);
                      }}
                      className="text-emerald-700 hover:text-emerald-900 dark:text-emerald-400 dark:hover:text-emerald-200 transition-colors p-0.5 rounded cursor-pointer"
                      title="Editar monto"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
                <div className="bg-emerald-100/50 dark:bg-emerald-900/40 p-2 rounded-lg flex items-start gap-1.5 text-emerald-800 dark:text-emerald-300 text-xs font-medium">
                  <Camera className="w-4 h-4 flex-shrink-0" />
                  <p>Subir captura de "Entregado".</p>
                </div>
              </div>
            ) : (
              <div className={cn("bg-gray-50 dark:bg-gray-700/50 border border-gray-100 dark:border-gray-600 p-3.5 rounded-xl space-y-3", isFutureOrder && "opacity-50 pointer-events-none")}>
                <div className="flex items-center justify-between">
                  <span className="font-medium text-gray-600 dark:text-gray-300 text-sm">Monto a Cobrar</span>
                  <div className="flex items-center gap-2">
                    <div className="flex items-center gap-1.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl px-2.5 py-1">
                      <span className="text-lg font-bold text-gray-900 dark:text-white">{order.amount}</span>
                      <button 
                        onClick={() => {
                          setEditedAmountValue(String(order.amount).replace('$', ''));
                          setIsEditingAmount(true);
                        }}
                        className="text-gray-400 hover:text-blue-500 transition-colors p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer animate-pulse"
                        title="Editar monto"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    <button 
                      onClick={() => setIsPlOverride(true)}
                      className="text-xs bg-emerald-100 dark:bg-emerald-900/40 text-emerald-800 dark:text-emerald-400 px-2 py-1 rounded font-bold hover:bg-emerald-200 dark:hover:bg-emerald-900/60 transition-colors flex items-center gap-1"
                      title="Marcar como Pago en Línea"
                    >
                      PL 
                      <ChevronRight className="w-3 h-3" />
                    </button>
                  </div>
                </div>

                <div className="flex gap-2 p-1 bg-gray-200/50 dark:bg-gray-900/50 rounded-lg">
                  <button onClick={() => setPaymentMode('single')} className={cn("flex-1 py-1.5 text-xs rounded-md font-semibold transition-all", paymentMode === 'single' ? "bg-white dark:bg-gray-600 text-gray-900 dark:text-white shadow-sm" : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200")}>Un método</button>
                  <button onClick={() => setPaymentMode('split')} className={cn("flex-1 py-1.5 text-xs rounded-md font-semibold transition-all", paymentMode === 'split' ? "bg-white dark:bg-gray-600 text-gray-900 dark:text-white shadow-sm" : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200")}>Dividir pago</button>
                </div>

                {paymentMode === 'single' ? (
                  <div className="space-y-3">
                    <div className="flex gap-2">
                      <button onClick={() => { setCashAmount(parsedDefaultAmount); setCardAmount(''); setValesAmount(''); setReceivedCashStr(''); }} className={cn("flex-1 py-2.5 rounded-xl border-2 transition-all flex flex-col items-center gap-0.5", cashAmount ? "bg-green-50 dark:bg-green-900/20 border-green-500 text-green-700 dark:text-green-400" : "bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-600 text-gray-500 dark:text-gray-400 hover:border-green-300 dark:hover:border-green-700")}>
                        <Receipt className="w-4 h-4" />
                        <span className="font-bold text-xs">Efectivo</span>
                      </button>
                      <button onClick={() => { setCardAmount(parsedDefaultAmount); setCashAmount(''); setValesAmount(''); setReceivedCashStr(''); }} className={cn("flex-1 py-2.5 rounded-xl border-2 transition-all flex flex-col items-center gap-0.5", cardAmount ? "bg-blue-50 dark:bg-blue-900/20 border-blue-500 text-blue-700 dark:text-blue-400" : "bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-600 text-gray-500 dark:text-gray-400 hover:border-blue-300 dark:hover:border-blue-700")}>
                        <CreditCard className="w-4 h-4" />
                        <span className="font-bold text-xs">Tarjeta</span>
                      </button>
                      <button onClick={() => { setValesAmount(parsedDefaultAmount); setCashAmount(''); setCardAmount(''); setReceivedCashStr(''); }} className={cn("flex-1 py-2.5 rounded-xl border-2 transition-all flex flex-col items-center gap-0.5", valesAmount ? "bg-purple-50 dark:bg-purple-900/20 border-purple-500 text-purple-700 dark:text-purple-400" : "bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-600 text-gray-500 dark:text-gray-400 hover:border-purple-300 dark:hover:border-purple-700")}>
                        <Ticket className="w-4 h-4" />
                        <span className="font-bold text-xs">Vales</span>
                      </button>
                    </div>
                    {cashAmount && (
                      <div className="bg-white dark:bg-gray-800 p-2.5 rounded-xl border border-gray-200 dark:border-gray-600 mt-2">
                        <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1.5">Efectivo recibido (opcional para calcular cambio)</label>
                        <div className="relative flex items-center border border-gray-300 dark:border-gray-600 rounded-lg focus-within:ring-2 focus-within:ring-blue-500 bg-white dark:bg-gray-900">
                          <span className="pl-3 text-gray-500 font-medium">$</span>
                          <input type="number" step="0.01" value={receivedCashStr} onChange={e => setReceivedCashStr(e.target.value)} className="w-full p-2 outline-none text-sm font-semibold bg-transparent dark:text-white" placeholder={parsedDefaultAmount} />
                        </div>
                        {changeSingle > 0 && (
                          <div className="mt-2 text-center p-1.5 bg-orange-50 dark:bg-orange-900/30 border border-orange-200 dark:border-orange-800/50 text-orange-700 dark:text-orange-400 rounded-lg text-sm font-bold">
                            Cambio a dar: ${changeSingle.toFixed(2)}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="space-y-2">
                    <div className="flex justify-between items-center text-sm font-semibold mb-2 px-1">
                      {remainingAmount > 0 ? (
                        <span className="text-orange-600 dark:text-orange-400">Por pagar: ${remainingAmount.toFixed(2)}</span>
                      ) : changeToGive > 0 ? (
                        <span className="text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30 px-2 py-0.5 rounded">Cambio a dar: ${changeToGive.toFixed(2)}</span>
                      ) : (
                        <span className="text-green-600 dark:text-green-400">Pago completado</span>
                      )}
                      <span className="text-gray-500 dark:text-gray-400 text-xs">Total: ${totalAmountValue.toFixed(2)}</span>
                    </div>
                    {splitMethods.map((method) => (
                      <div key={method.id} className="relative">
                        <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-0.5">
                          {method.type === 'cash' ? 'Efectivo' : method.type === 'card' ? 'Tarjeta' : 'Vales'}
                        </label>
                        <div className="relative flex items-center border border-gray-300 dark:border-gray-600 rounded-lg focus-within:ring-2 focus-within:ring-blue-500 bg-white dark:bg-gray-900">
                          <span className="pl-3 text-gray-500 font-medium">$</span>
                          <input type="number" step="0.01" value={method.amount} onChange={e => updateSplitMethodAmount(method.id, e.target.value)} className="w-full p-2 outline-none text-sm font-semibold bg-transparent dark:text-white" placeholder="0.00" />
                          <button onClick={() => removeSplitMethod(method.id)} className="absolute right-2 p-1 text-gray-400 hover:text-red-500 rounded-md bg-white/80 dark:bg-gray-900/80"><X className="w-4 h-4"/></button>
                        </div>
                      </div>
                    ))}
                    <button 
                      onClick={() => setShowAddMethodModal(true)}
                      className="w-full py-2.5 mt-1 border-2 border-dashed border-gray-300 dark:border-gray-600 text-gray-500 dark:text-gray-400 rounded-lg text-sm font-bold hover:bg-gray-50 dark:hover:bg-gray-700/50 hover:text-blue-600 dark:hover:text-blue-400 hover:border-blue-300 dark:hover:border-blue-700 transition-colors flex items-center justify-center gap-1"
                    >
                      <Plus className="w-4 h-4" /> Agregar método
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Always ask for receiver name if not delivered */}
            {!order.delivered && (
              <div>
                <label className="flex items-center gap-1.5 text-xs font-semibold text-gray-800 dark:text-gray-200 mb-1.5">
                  <User className="w-3.5 h-3.5 text-gray-500 dark:text-gray-400" />
                  Recibe:
                </label>
                <input 
                  type="text" 
                  value={receiverName} 
                  onChange={e => setReceiverName(e.target.value)} 
                  disabled={isFutureOrder}
                  placeholder="Ej. María o Juan" 
                  className={cn("w-full p-2.5 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white rounded-lg outline-none font-medium text-sm transition-colors", isFutureOrder ? "opacity-50 cursor-not-allowed bg-gray-50 focus:ring-0" : "focus:ring-2 focus:ring-blue-500")}
                />
              </div>
            )}
            
            {order.comments && (
              <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-900/50 p-2.5 rounded-lg">
                <div className="flex items-center gap-1.5 text-yellow-800 dark:text-yellow-500 font-bold mb-1">
                  <MessageSquare className="w-3.5 h-3.5" />
                  <span className="text-xs">Comentarios</span>
                </div>
                <p className="text-yellow-900 dark:text-yellow-400 text-sm leading-snug">{order.comments}</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {isSaving ? (
        <div className="flex flex-col items-center justify-center py-4 animate-pulse">
           <CheckCircle className="w-10 h-10 text-blue-500 mb-2" />
           <p className="text-base font-bold text-gray-800 dark:text-gray-200">Guardando...</p>
           <p className="text-gray-500 dark:text-gray-400 text-xs">Siguiente pedido...</p>
        </div>
      ) : order.delivered ? (
        <div className="flex flex-col gap-2.5 mt-2">
          {(!isLast) && (
            <button
               onClick={() => { if (onIndexChange) onIndexChange(currentIndex + 1); }}
               className="w-full py-3.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold text-base shadow-sm transition-all flex items-center justify-center gap-2"
            >
              Siguiente Pedido
              <ChevronRight className="w-5 h-5" />
            </button>
          )}
          <button
            onClick={() => { if (onCancel) onCancel(); }}
            className="w-full py-2.5 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300 font-medium transition-colors text-xs bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 rounded-lg"
          >
            Volver al mapa de rutas
          </button>
        </div>
      ) : isFutureOrder ? (
         <div className="flex flex-col gap-2.5 mt-2">
           <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900 flex items-start gap-2 p-3.5 rounded-xl">
             <div className="text-amber-600 dark:text-amber-400">
               <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><path d="M12 9v4"/><path d="M12 17h.01"/></svg>
             </div>
             <div>
               <p className="text-sm font-bold text-amber-800 dark:text-amber-400">Pedido Futuro</p>
               <p className="text-xs text-amber-700 dark:text-amber-500 font-medium">No puedes procesar este pedido hasta completar los anteriores.</p>
             </div>
           </div>
           <button
            disabled
            className="w-full py-3.5 text-white/50 bg-gray-400 dark:bg-gray-700 rounded-xl font-bold text-base shadow-sm transition-all flex items-center justify-center gap-2 cursor-not-allowed"
          >
            Guardar y Continuar
          </button>
        </div>
      ) : (
      <div className="flex flex-col gap-2.5">
         <button
          onClick={() => {
            if (!receiverName.trim()) {
              toast.error("Por favor, ingresa el nombre de quién recibe el pedido.");
              return;
            }
            setShowSaveConfirm(true);
          }}
          className={cn(
            "w-full py-3.5 text-white rounded-xl font-bold text-base shadow-sm transition-all flex items-center justify-center gap-2",
            isLast ? "bg-green-600 hover:bg-green-700" : "bg-gray-900 hover:bg-black dark:bg-gray-100 dark:hover:bg-white dark:text-gray-900"
          )}
        >
          {isLast ? (
            <>
              <CheckCircle className="w-5 h-5" />
              Finalizar Viaje
            </>
          ) : (
            <>
              Guardar y Continuar
              <ChevronRight className="w-5 h-5" />
            </>
          )}
        </button>
        <button
          onClick={() => { if (onCancel) onCancel(); }}
          className="w-full py-2.5 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300 font-medium transition-colors text-xs"
        >
          Pausa / Volver al mapa de rutas
        </button>
      </div>
      )}

      </motion.div>
      </AnimatePresence>

      {/* Save Confirmation Modal */}
      {showSaveConfirm && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-gray-900/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white dark:bg-gray-800 rounded-3xl w-full max-w-sm p-6 shadow-2xl border border-gray-100 dark:border-gray-700 animate-in zoom-in-95">
            <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4 text-center">Registrar Entrega</h3>
            
            <div className="bg-gray-50 dark:bg-gray-900/40 rounded-2xl p-4 mb-6 space-y-3 text-sm">
              <div className="flex justify-between items-start gap-2 border-b border-gray-100 dark:border-gray-800 pb-2">
                <span className="text-[10px] text-gray-400 font-bold uppercase shrink-0">Cliente</span>
                <span className="font-semibold text-gray-800 dark:text-white text-right leading-tight max-w-[200px] truncate">{order.clientName}</span>
              </div>
              <div className="flex justify-between items-center border-b border-gray-100 dark:border-gray-800 pb-2">
                <span className="text-[10px] text-gray-400 font-bold uppercase">Recibe</span>
                <span className="font-bold text-gray-800 dark:text-white">{receiverName}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-[10px] text-gray-400 font-bold uppercase">Monto</span>
                <span className="font-black text-blue-600 dark:text-blue-400">
                  {isPaid ? 'Pagado en línea' : (
                    <>
                      ${(
                        (paymentMode === 'single'
                          ? (Number(cashAmount) || 0) + (Number(cardAmount) || 0) + (Number(valesAmount) || 0)
                          : splitMethods.reduce((sum, m) => sum + (Number(m.amount) || 0), 0)
                        )
                      ).toFixed(2)}
                    </>
                  )}
                </span>
              </div>
              {!isPaid && (
                <div className="text-xs text-gray-400 dark:text-gray-500 border-t border-gray-100 dark:border-gray-800 pt-2 flex flex-col gap-1">
                  {paymentMode === 'single' ? (
                    <>
                      {cashAmount && <div>• Efectivo: ${Number(cashAmount).toFixed(2)}</div>}
                      {cardAmount && <div>• Tarjeta: ${Number(cardAmount).toFixed(2)}</div>}
                      {valesAmount && <div>• Vales: ${Number(valesAmount).toFixed(2)}</div>}
                    </>
                  ) : (
                    splitMethods.map((m, idx) => m.amount && (
                      <div key={idx}>• {m.type === 'cash' ? 'Efectivo' : m.type === 'card' ? 'Tarjeta' : 'Vales'}: ${Number(m.amount).toFixed(2)}</div>
                    ))
                  )}
                </div>
              )}
              {(paymentMode === 'single' ? changeSingle : changeToGive) > 0 && (
                <div className="flex justify-between items-center bg-orange-50 dark:bg-orange-950/20 px-2.5 py-1.5 rounded-lg text-orange-700 dark:text-orange-400 font-bold text-xs">
                  <span>Cambio Entregado:</span>
                  <span>${(paymentMode === 'single' ? changeSingle : changeToGive).toFixed(2)}</span>
                </div>
              )}
            </div>
            
            <p className="text-sm font-semibold text-center text-gray-700 dark:text-gray-300 mb-6">
              ¿Estás seguro de registrar la entrega?
            </p>
            
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setShowSaveConfirm(false)}
                className="flex-1 py-2.5 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 font-bold rounded-xl hover:bg-gray-200"
              >
                Regresar
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowSaveConfirm(false);
                  handleAction(isLast);
                }}
                className="flex-1 py-2.5 bg-green-600 hover:bg-green-700 text-white font-bold rounded-xl shadow-lg shadow-green-600/20"
              >
                Confirmar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Method Modal */}
      {showAddMethodModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/40 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white dark:bg-gray-800 rounded-2xl w-full max-w-sm flex flex-col shadow-2xl overflow-hidden">
             <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
              <h3 className="font-bold text-gray-900 dark:text-white">Agregar Método</h3>
              <button onClick={() => setShowAddMethodModal(false)} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4 flex flex-col gap-2">
               {!splitMethods.some(m => m.type === 'cash') && (
                 <button onClick={() => { addSplitMethod('cash'); setShowAddMethodModal(false); }} className="p-3 bg-gray-50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600 text-gray-800 dark:text-gray-200 rounded-xl font-semibold flex items-center gap-2 hover:border-green-400 hover:bg-green-50 dark:hover:bg-green-900/20 transition-colors"><Receipt className="w-5 h-5 text-green-600 dark:text-green-400" /> Efectivo</button>
               )}
               <button onClick={() => { addSplitMethod('card'); setShowAddMethodModal(false); }} className="p-3 bg-gray-50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600 text-gray-800 dark:text-gray-200 rounded-xl font-semibold flex items-center gap-2 hover:border-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors"><CreditCard className="w-5 h-5 text-blue-600 dark:text-blue-400" /> Tarjeta</button>
               <button onClick={() => { addSplitMethod('vales'); setShowAddMethodModal(false); }} className="p-3 bg-gray-50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600 text-gray-800 dark:text-gray-200 rounded-xl font-semibold flex items-center gap-2 hover:border-purple-400 hover:bg-purple-50 dark:hover:bg-purple-900/20 transition-colors"><Ticket className="w-5 h-5 text-purple-600 dark:text-purple-400" /> Vales</button>
            </div>
          </div>
        </div>
      )}

      {/* WhatsApp Modal */}
      {showWaModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/40 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white dark:bg-gray-800 rounded-2xl w-full max-w-sm flex flex-col shadow-2xl overflow-hidden">
            <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
              <h3 className="font-bold text-gray-900 dark:text-white flex items-center gap-2">
                <MessageCircle className="w-5 h-5 text-[#25D366]" /> Mensaje de WhatsApp
              </h3>
              <button onClick={() => setShowWaModal(false)} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4 space-y-3">
              <button 
                onClick={() => sendWhatsApp(1)}
                className="w-full p-3 text-left border border-gray-200 dark:border-gray-700 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors text-sm text-gray-700 dark:text-gray-300"
              >
                "🙋🏻‍♂️ Hola [Nombre], [buenas tardes]. Soy el repartidor asignado..."
              </button>
              <button 
                onClick={() => sendWhatsApp(2)}
                className="w-full p-3 text-left border border-gray-200 dark:border-gray-700 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors text-sm text-gray-700 dark:text-gray-300"
              >
                "📍 Hola [Nombre], [buenas tardes]. Me encuentro ya en el punto..."
              </button>
              <button 
                onClick={() => sendWhatsApp(3)}
                className="w-full p-3 text-left border border-gray-200 dark:border-gray-700 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors text-sm text-gray-700 dark:text-gray-300"
              >
                "📱 Hola [Nombre], [buenas tardes]. ¿Me podría compartir su ubicación?"
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Amount Modal */}
      {isEditingAmount && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/40 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white dark:bg-gray-800 rounded-2xl w-full max-w-sm flex flex-col shadow-2xl overflow-hidden border border-gray-100 dark:border-gray-700 animate-in zoom-in-95 duration-200">
            <div className="p-5 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between">
              <h3 className="font-bold text-gray-900 dark:text-white flex items-center gap-1.5 text-sm">
                <Pencil className="w-5 h-5 text-blue-500" />
                Editar monto del pedido
              </h3>
              <button 
                onClick={() => setIsEditingAmount(false)} 
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-5 space-y-4">
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Usa este campo para corregir el monto total de la entrega. El sistema actualizará los cálculos de cambio y remesas correspondientes.
              </p>
              <div className="relative flex items-center border border-gray-300 dark:border-gray-600 rounded-xl focus-within:ring-2 focus-within:ring-blue-500 bg-white dark:bg-gray-900">
                <span className="pl-4 text-gray-400 font-bold">$</span>
                <input 
                  type="text" 
                  value={editedAmountValue} 
                  onChange={e => setEditedAmountValue(e.target.value)} 
                  className="w-full p-3 pl-1 outline-none text-base font-bold bg-transparent dark:text-white" 
                  placeholder="0.00" 
                  autoFocus
                />
              </div>
            </div>
            <div className="p-5 border-t border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/30 flex gap-3">
              <button
                type="button"
                onClick={() => setIsEditingAmount(false)}
                className="flex-1 py-3 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 font-bold rounded-xl text-xs cursor-pointer transition-all"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleSaveAmount}
                className="flex-1 py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-xs shadow-md cursor-pointer transition-all"
              >
                Guardar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
