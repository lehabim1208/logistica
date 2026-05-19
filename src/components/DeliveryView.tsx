import { useState, useEffect } from 'react';
import { ProcessingResult, Order } from '../lib/gemini';
import { Navigation2, CheckCircle, ChevronRight, ChevronDown, ChevronUp, MessageSquare, CreditCard, Receipt, Camera, User, Phone, MessageCircle, X, Plus, Ticket } from 'lucide-react';
import { cn } from '../lib/utils';
import toast from 'react-hot-toast';

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

export function DeliveryView({ routeInfo, currentIndex, onNext, onFinish, onCancel, onFundChange }: DeliveryViewProps) {
  const order = routeInfo?.orders?.[currentIndex];
  const [showSubOrders, setShowSubOrders] = useState(false);
  
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
  const [receiverName, setReceiverName] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [isPlOverride, setIsPlOverride] = useState(false);
  const [showWaModal, setShowWaModal] = useState(false);

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
    }
  }, [order?.id]);

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

    const updatedOrder: Order = {
      ...order,
      receiverName: receiverName.trim(),
      collectedCash: finalCollectedCash,
      collectedCard: finalCollectedCard,
      collectedVales: finalCollectedVales,
      delivered: true,
      changeGiven: actualChangeGiven,
    };

    setIsSaving(true);
    toast.success("Pedido entregado. Cargando siguiente...");
    
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
      
      {/* Header Status */}
      <div className="bg-gray-900 text-white p-3 flex justify-between items-center rounded-xl shadow-md">
        <div className="font-medium text-gray-300 text-sm">
          Entrega {currentIndex + 1} <span className="opacity-50">de</span> {routeInfo.orders.length}
        </div>
        <div className="text-xs bg-white/20 px-2.5 py-0.5 rounded-full font-mono">
          #{order.orderNumber}
        </div>
      </div>

      {/* TR Code Prominent if exists */}
      {order.trCode && order.trCode !== 'No se proporcionó TR' && (
        <div className="bg-blue-50 dark:bg-blue-900/30 border-l-4 border-blue-500 dark:border-blue-400 p-3 rounded-r-xl shadow-sm flex items-center justify-between border border-blue-100 dark:border-blue-900/50">
          <span className="font-bold text-blue-800 dark:text-blue-300 text-sm tracking-wide uppercase">CÓDIGO TR:</span>
          <span className="text-xl font-black font-mono text-blue-900 dark:text-blue-100">{order.trCode}</span>
        </div>
      )}

      {/* Main Delivery Card */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="p-4 md:p-5 space-y-3">
          
          <div>
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-1 leading-tight">{order.clientName}</h2>
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
                        <span className="text-xs font-mono font-bold bg-gray-100 dark:bg-gray-900 px-1.5 py-0.5 rounded text-gray-700 dark:text-gray-300">Folio: {sub.orderNumber}</span>
                        <span className="text-xs font-bold text-blue-700 dark:text-blue-400">{sub.amount}</span>
                      </div>
                      <p className="text-xs text-gray-600 dark:text-gray-400 mb-2">Pago: {sub.paymentMethod}</p>
                      {sub.trCode && sub.trCode !== 'No se proporcionó TR' && (
                        <div className="text-xs bg-blue-50 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300 p-1.5 rounded font-mono border border-blue-100 dark:border-blue-900/50">TR: {sub.trCode}</div>
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
            {isPaid ? (
              <div className="bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-900/50 p-3 rounded-xl space-y-2">
                <div className="flex items-center gap-2 text-emerald-800 dark:text-emerald-400">
                  <CheckCircle className="w-5 h-5 flex-shrink-0" />
                  <div>
                    <h3 className="font-bold text-sm">📝 Pedido Pagado</h3>
                    <p className="text-emerald-700 dark:text-emerald-500 font-medium leading-snug text-xs">Solo entregar, no recibir pago.</p>
                  </div>
                </div>
                <div className="bg-emerald-100/50 dark:bg-emerald-900/40 p-2 rounded-lg flex items-start gap-1.5 text-emerald-800 dark:text-emerald-300 text-xs font-medium">
                  <Camera className="w-4 h-4 flex-shrink-0" />
                  <p>Subir captura de "Entregado".</p>
                </div>
              </div>
            ) : (
              <div className="bg-gray-50 dark:bg-gray-700/50 border border-gray-100 dark:border-gray-600 p-3.5 rounded-xl space-y-3">
                <div className="flex items-center justify-between">
                  <span className="font-medium text-gray-600 dark:text-gray-300 text-sm">Monto a Cobrar</span>
                  <div className="flex items-center gap-2">
                    <span className="text-lg font-bold text-gray-900 dark:text-white">{order.amount}</span>
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

            {/* Always ask for receiver name */}
            <div>
              <label className="flex items-center gap-1.5 text-xs font-semibold text-gray-800 dark:text-gray-200 mb-1.5">
                <User className="w-3.5 h-3.5 text-gray-500 dark:text-gray-400" />
                Recibe:
              </label>
              <input 
                type="text" 
                value={receiverName} 
                onChange={e => setReceiverName(e.target.value)} 
                placeholder="Ej. María o Juan" 
                className="w-full p-2.5 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white rounded-lg focus:ring-2 focus:ring-blue-500 outline-none font-medium text-sm"
              />
            </div>
            
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
           <p className="text-base font-bold text-gray-800 dark:text-gray-200">Entregado</p>
           <p className="text-gray-500 dark:text-gray-400 text-xs">Siguiente pedido...</p>
        </div>
      ) : (
      <div className="flex flex-col gap-2.5">
         <button
          onClick={() => handleAction(isLast)}
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
    </div>
  );
}
