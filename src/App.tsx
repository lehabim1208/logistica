import { useState, useEffect } from 'react';
import { Toaster, toast } from 'react-hot-toast';
import { HomeView } from './components/HomeView';
import { InputView } from './components/InputView';
import { ReviewView } from './components/ReviewView';
import { DeliveryView } from './components/DeliveryView';
import { HistoryView } from './components/HistoryView';
import { PhoneInputView } from './components/PhoneInputView';
import { CameraWatermarkModal } from './components/CameraWatermarkModal';
import { ShiftSummaryModal } from './components/ShiftSummaryModal';
import { NotesModal } from './components/NotesModal';
import { CalculatorModal } from './components/CalculatorModal';
import { ProcessingResult } from './lib/gemini';
import { Package, Clock, History, Map as MapIcon, Wallet, Camera, Settings, Moon, Sun, Monitor, StickyNote, Calculator, X } from 'lucide-react';
import localforage from 'localforage';

export type AppState = 'home' | 'input' | 'phone-input' | 'review' | 'delivering' | 'history';
export type Theme = 'light' | 'dark' | 'system';

export default function App() {
  const [appState, setAppState] = useState<AppState>('home');
  const [routeInfo, setRouteInfo] = useState<ProcessingResult | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isLoaded, setIsLoaded] = useState(false);
  const [totalFund, setTotalFund] = useState(() => {
    const saved = localStorage.getItem('logiruta_fondo');
    return saved ? Number(saved) : 0;
  });
  const [isBoxOpen, setIsBoxOpen] = useState(() => {
    const saved = localStorage.getItem('logiruta_box_open');
    return saved === 'true';
  });
  const [tpvNumber, setTpvNumber] = useState(() => {
    return localStorage.getItem('logiruta_tpv') || '';
  });
  const [showFundModal, setShowFundModal] = useState(false);
  const [showFundModalHistory, setShowFundModalHistory] = useState(false);
  const [showShiftSummary, setShowShiftSummary] = useState(false);
  const [showNotesModal, setShowNotesModal] = useState(false);
  const [showCalculatorModal, setShowCalculatorModal] = useState(false);
  const [showTpvModal, setShowTpvModal] = useState(false);
  const [tpvInput, setTpvInput] = useState('');
  const [fundInput, setFundInput] = useState('');
  
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [theme, setTheme] = useState<Theme>(() => {
    const saved = localStorage.getItem('logiruta_theme');
    return (saved as Theme) || 'system';
  });
  const [useCustomCamera, setUseCustomCamera] = useState(() => {
    const saved = localStorage.getItem('logiruta_use_custom_camera');
    return saved !== 'false'; // Default to true
  });
  const [showCameraModal, setShowCameraModal] = useState(false);
  const [pendingPhotoFn, setPendingPhotoFn] = useState<((photoDataUrl: string) => void) | null>(null);

  const [fundHistory, setFundHistory] = useState<{ id: string; type: 'open' | 'add' | 'subtract' | 'close'; amount: number; time: string; description: string }[]>(() => {
    const saved = localStorage.getItem('logiruta_fund_history');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        return [];
      }
    }
    return [];
  });

  useEffect(() => {
    const savedState = localStorage.getItem('logiruta_state');
    const isBoxOpenSaved = localStorage.getItem('logiruta_box_open') === 'true';
    if (savedState) {
      try {
        const parsed = JSON.parse(savedState);
        if (parsed.appState && parsed.appState !== 'home') setAppState(parsed.appState);
        if (parsed.routeInfo) setRouteInfo(parsed.routeInfo);
        if (parsed.currentIndex !== undefined) setCurrentIndex(parsed.currentIndex);
      } catch (e) {}
    } else {
      if (isBoxOpenSaved) {
        setAppState('input');
      }
    }
    setIsLoaded(true);
  }, []);

  useEffect(() => {
    if (isLoaded) {
      localStorage.setItem('logiruta_state', JSON.stringify({
        appState,
        routeInfo,
        currentIndex,
      }));
    }
  }, [appState, routeInfo, currentIndex, isLoaded]);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'auto' });
  }, [currentIndex, appState]);

  useEffect(() => {
    localStorage.setItem('logiruta_fondo', totalFund.toString());
  }, [totalFund]);

  useEffect(() => {
    localStorage.setItem('logiruta_tpv', tpvNumber);
  }, [tpvNumber]);

  useEffect(() => {
    localStorage.setItem('logiruta_box_open', isBoxOpen.toString());
  }, [isBoxOpen]);

  useEffect(() => {
    localStorage.setItem('logiruta_fund_history', JSON.stringify(fundHistory));
  }, [fundHistory]);

  useEffect(() => {
    localStorage.setItem('logiruta_theme', theme);
    const root = window.document.documentElement;
    root.classList.remove('light', 'dark');

    if (theme === 'system') {
      const systemTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
      root.classList.add(systemTheme);
    } else {
      root.classList.add(theme);
    }
  }, [theme]);

  // Listen for system theme changes if set to system
  useEffect(() => {
    if (theme !== 'system') return;
    
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = () => {
      const root = window.document.documentElement;
      root.classList.remove('light', 'dark');
      root.classList.add(mediaQuery.matches ? 'dark' : 'light');
    };
    
    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, [theme]);

  const addFundHistory = (type: 'open' | 'add' | 'subtract' | 'close', amount: number, description: string, isFromHome = false) => {
    if (!isBoxOpen && !isFromHome) return; // Don't log if box is closed unless forced
    const entry = {
      id: Math.random().toString(36).substring(7),
      type,
      amount,
      time: new Date().toISOString(),
      description
    };
    setFundHistory(prev => [entry, ...prev]);
  };

  const handleRouteProcessed = (newRouteInfo: ProcessingResult) => {
    setRouteInfo(newRouteInfo);
    setCurrentIndex(0);
    setAppState('phone-input');
  };

  const handleClearRoute = async () => {
    setRouteInfo(null);
    setCurrentIndex(0);
    await localforage.removeItem('logiruta_state');
  };

  if (!isLoaded) return null;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100 transition-colors duration-300">
      <div className="max-w-md mx-auto min-h-screen bg-white dark:bg-gray-800 shadow-xl relative">
        
        <Toaster position="top-center" />
        
        {/* Header / Nav */}
        {appState !== 'home' && (
        <header className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 sticky top-0 z-10 transition-colors duration-300">
          <div className="max-w-4xl mx-auto px-4 h-16 flex items-center justify-between">
            <div className="flex items-center gap-2 cursor-pointer" onClick={() => setAppState('input')}>
              <div className="bg-blue-600 p-2 rounded-xl text-white">
                <Package className="w-5 h-5" />
              </div>
              <span className="font-bold text-xl tracking-tight text-gray-900 dark:text-white hidden sm:block">LogiRuta<span className="text-blue-600 dark:text-blue-400">.</span></span>
            </div>
            
            <div className="flex items-center gap-2">
              <div 
                className="flex items-center gap-2 mr-2 cursor-pointer bg-green-50 dark:bg-green-900/30 px-3 py-1.5 rounded-lg border border-green-200 dark:border-green-800/50 hover:bg-green-100 dark:hover:bg-green-900/50 transition-colors"
                onClick={() => setShowFundModal(true)}
              >
                <Wallet className="w-4 h-4 text-green-600 dark:text-green-400" />
                <span className="font-bold text-green-700 dark:text-green-400 text-sm">
                  ${totalFund.toFixed(2)}
                </span>
              </div>
              
              <div 
                 className="flex items-center gap-1.5 mr-2 cursor-pointer bg-blue-50 dark:bg-blue-900/30 px-3 py-1.5 rounded-lg border border-blue-200 dark:border-blue-800/50 hover:bg-blue-100 dark:hover:bg-blue-900/50 transition-colors"
                 onClick={() => { setTpvInput(tpvNumber); setShowTpvModal(true); }}
                 title="Editar TPV"
              >
                 <span className="text-xs font-bold text-blue-800 dark:text-blue-400 uppercase tracking-widest hidden sm:inline">TPV</span>
                 <span className="font-bold text-blue-700 dark:text-blue-400 text-sm">{tpvNumber || '--'}</span>
              </div>

              <button 
                onClick={() => {
                  setPendingPhotoFn(null); // Don't pass the photo up, just download it
                  setShowCameraModal(true);
                }}
                className="p-2 text-blue-800 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30 hover:bg-blue-100 dark:hover:bg-blue-900/50 rounded-full transition-colors flex items-center justify-center mr-1 border border-blue-200 dark:border-blue-800/50"
                title="Cámara"
              >
                <Camera className="w-5 h-5" />
              </button>

              <button 
                onClick={() => setShowNotesModal(true)}
                className="p-2 text-sky-500 hover:bg-sky-50 dark:hover:bg-sky-900/30 rounded-full transition-colors hidden sm:flex"
                title="Notas Rápidas"
              >
                <StickyNote className="w-5 h-5" />
              </button>

              <button 
                onClick={() => setShowCalculatorModal(true)}
                className="p-2 text-sky-500 hover:bg-sky-50 dark:text-sky-400 dark:hover:bg-sky-900/30 rounded-full transition-colors hidden sm:flex"
                title="Calculadora"
              >
                <Calculator className="w-5 h-5" />
              </button>

              <button 
                onClick={() => setShowSettingsModal(true)}
                className="p-2 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700 dark:text-gray-400 dark:hover:text-gray-200 rounded-full transition-colors flex items-center justify-center"
                aria-label="Ajustes"
              >
                <Settings className="w-5 h-5" />
              </button>
              {(appState === 'input' || appState === 'history') && (
                <button 
                  onClick={() => setAppState(appState === 'history' ? 'input' : 'history')}
                  className="p-2 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700 dark:text-gray-400 dark:hover:text-gray-200 rounded-full transition-colors flex items-center justify-center"
                  aria-label="Ver historial"
                >
                  {appState === 'history' ? <Package className="w-5 h-5" /> : <History className="w-5 h-5" />}
                </button>
              )}
            </div>
          </div>
          
          {/* Mobile bottom tools bar */}
          <div className="flex sm:hidden justify-center items-center py-2 gap-4 bg-gray-50 dark:bg-gray-900 border-b border-gray-100 dark:border-gray-800">
             <button 
                onClick={() => setShowNotesModal(true)}
                className="flex items-center justify-center gap-1.5 px-4 py-2 flex-1 mx-2 text-sm font-semibold text-sky-700 dark:text-sky-500 bg-sky-50 dark:bg-sky-900/20 rounded-xl border border-sky-200 dark:border-sky-800/50"
              >
                <StickyNote className="w-4 h-4" /> Notas
              </button>
              <button 
                onClick={() => setShowCalculatorModal(true)}
                className="flex items-center justify-center gap-1.5 px-4 py-2 flex-1 mx-2 text-sm font-semibold text-sky-700 dark:text-sky-500 bg-sky-50 dark:bg-sky-900/20 rounded-xl border border-sky-200 dark:border-sky-800/50"
              >
                <Calculator className="w-4 h-4" /> Calculadora
              </button>
          </div>
        </header>
        )}

        {/* Main Content Area */}
        <main className="w-full pb-24">
          {appState === 'home' && (
            <HomeView 
              onStartShift={(fund, tpv) => {
                setTotalFund(fund);
                setTpvNumber(tpv);
                setIsBoxOpen(true);
                addFundHistory('open', fund, `Se abrió caja con $${fund.toFixed(2)}`, true);
                setAppState('input');
                toast.success(`Jornada iniciada con TPV ${tpv} y fondo de $${fund.toFixed(2)}`);
              }}
              onViewHistory={() => setAppState('history')}
            />
          )}
          {appState === 'input' && (
            <div className="p-4 md:p-6">
            <InputView 
              existingRouteInfo={routeInfo}
              onProcessed={handleRouteProcessed} 
              onClearRoute={handleClearRoute}
            />
            </div>
          )}
          {appState === 'phone-input' && routeInfo && (
            <div className="p-4 md:p-6">
        <PhoneInputView
          routeInfo={routeInfo}
          onBack={() => setAppState('input')}
          onNext={(updatedRoute) => {
            setRouteInfo(updatedRoute);
            setAppState('review');
          }}
        />
        </div>
      )}

      {appState === 'review' && routeInfo && (
        <div className="p-4 md:p-6">
            <ReviewView 
              routeInfo={routeInfo} 
              onStartDelivery={(reorderedInfo) => {
                setRouteInfo(reorderedInfo);
                setAppState('delivering');
              }}
              onCancel={() => setAppState('phone-input')}
            />
            </div>
          )}
          {appState === 'delivering' && routeInfo && (
            <div className="p-4 md:p-6">
            <DeliveryView 
              routeInfo={routeInfo} 
              currentIndex={currentIndex}
              onIndexChange={setCurrentIndex}
              onCancel={() => setAppState('review')}
              onFinish={(updatedOrder) => {
                let finalRouteInfo = routeInfo;
                if (updatedOrder) {
                  const newOrders = [...routeInfo.orders];
                  newOrders[currentIndex] = updatedOrder;
                  finalRouteInfo = { ...routeInfo, orders: newOrders };
                  setRouteInfo(finalRouteInfo);
                }

                const historyItem = {
                  date: new Date().toISOString(),
                  route: finalRouteInfo
                };
                
                // Read existing history
                const savedHistory = localStorage.getItem('logiruta_history');
                const historyArray = savedHistory ? JSON.parse(savedHistory) : [];
                
                // Add new item and save
                historyArray.push(historyItem);
                localStorage.setItem('logiruta_history', JSON.stringify(historyArray));
                
                // Clear active route state to prevent going back to finished route
                setRouteInfo(null);
                setCurrentIndex(0);
                localforage.removeItem('logiruta_images').catch(console.error);
                localforage.removeItem('logiruta_text').catch(console.error);
                localforage.removeItem('logiruta_state').catch(console.error);
                
                setAppState('history');
              }}
              onPhotoRequest={(callback) => {
                if (useCustomCamera) {
                  setPendingPhotoFn(() => callback);
                  setShowCameraModal(true);
                } else {
                  // native camera
                }
              }}
              useCustomCamera={useCustomCamera}
              onNext={(updatedOrder) => {
                if (!routeInfo) return;
                const newOrders = [...routeInfo.orders];
                newOrders[currentIndex] = updatedOrder;
                setRouteInfo({ ...routeInfo, orders: newOrders });
                setCurrentIndex(currentIndex + 1);
              }}
              onFundChange={(amount, desc, type) => {
                if (type === 'add') {
                   setTotalFund(prev => prev + amount);
                   addFundHistory('add', amount, desc);
                } else if (type === 'subtract') {
                   setTotalFund(prev => Math.max(0, prev - amount));
                   addFundHistory('subtract', amount, desc);
                }
              }}
            />
            </div>
          )}
          {appState === 'history' && (
            <div className="p-4 md:p-6">
            <HistoryView onBack={() => {
              setAppState('input');
            }} />
            </div>
          )}
        </main>
        
        {/* Modals */}
        {showCameraModal && (
          <CameraWatermarkModal
            onClose={() => {
              setShowCameraModal(false);
              setPendingPhotoFn(null);
            }}
            onCapture={(photoDataUrl) => {
              if (pendingPhotoFn) {
                pendingPhotoFn(photoDataUrl);
              } else {
                const a = document.createElement('a');
                a.href = photoDataUrl;
                a.download = `foto_${Date.now()}.jpg`;
                a.click();
                toast.success('Foto guardada');
              }
              setShowCameraModal(false);
              setPendingPhotoFn(null);
            }}
          />
        )}

        {showNotesModal && (
          <NotesModal onClose={() => setShowNotesModal(false)} />
        )}

        {showCalculatorModal && (
          <CalculatorModal onClose={() => setShowCalculatorModal(false)} />
        )}

        {/* TPV Modal */}
        {showTpvModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-gray-900/60 backdrop-blur-sm animate-in fade-in">
            <div className="bg-white dark:bg-gray-800 rounded-3xl w-full max-w-xs shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95">
              <div className="p-5 border-b border-gray-100 dark:border-gray-700 text-center">
                <h3 className="text-lg font-bold text-gray-900 dark:text-white">Editar TPV</h3>
              </div>
              <div className="p-5">
                <input
                  type="text"
                  value={tpvInput}
                  onChange={(e) => setTpvInput(e.target.value)}
                  placeholder="Ej. 1293"
                  className="w-full text-center text-xl font-bold bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl p-3 focus:ring-2 focus:ring-blue-500 outline-none text-gray-900 dark:text-white"
                  autoFocus
                />
                <button
                  onClick={() => {
                    setTpvNumber(tpvInput);
                    setShowTpvModal(false);
                    toast.success("TPV actualizado");
                  }}
                  className="w-full py-3 mt-4 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 transition"
                >
                  Guardar
                </button>
                <button
                  onClick={() => setShowTpvModal(false)}
                  className="w-full py-2 mt-2 bg-transparent text-gray-500 font-semibold hover:bg-gray-100 dark:hover:bg-gray-700 rounded-xl transition"
                >
                  Cancelar
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Settings Modal */}
        {showSettingsModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-gray-900/60 backdrop-blur-sm animate-in fade-in">
            <div className="bg-white dark:bg-gray-800 rounded-3xl w-full max-w-sm shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95">
              <div className="p-6 border-b border-gray-100 dark:border-gray-700 flex justify-between items-center bg-gray-50/50 dark:bg-gray-800/80">
                <h3 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                  <Settings className="w-5 h-5 text-gray-500" /> Ajustes
                </h3>
                <button onClick={() => setShowSettingsModal(false)} className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full transition-colors">
                  <span className="sr-only">Cerrar</span>
                  <X className="w-6 h-6" />
                </button>
              </div>
              <div className="p-6 space-y-6">
                
                {/* Theme Selector */}
                <div>
                  <h4 className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3">Apariencia</h4>
                  <div className="grid grid-cols-3 gap-2">
                    <button
                      onClick={() => setTheme('light')}
                      className={`flex flex-col items-center gap-2 p-3 rounded-xl border-2 transition-all ${theme === 'light' ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400' : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'}`}
                    >
                      <Sun className="w-5 h-5" />
                      <span className="text-xs font-semibold">Claro</span>
                    </button>
                    <button
                      onClick={() => setTheme('dark')}
                      className={`flex flex-col items-center gap-2 p-3 rounded-xl border-2 transition-all ${theme === 'dark' ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400' : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'}`}
                    >
                      <Moon className="w-5 h-5" />
                      <span className="text-xs font-semibold">Oscuro</span>
                    </button>
                    <button
                      onClick={() => setTheme('system')}
                      className={`flex flex-col items-center gap-2 p-3 rounded-xl border-2 transition-all ${theme === 'system' ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400' : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'}`}
                    >
                      <Monitor className="w-5 h-5" />
                      <span className="text-xs font-semibold">Sistema</span>
                    </button>
                  </div>
                </div>



              </div>
            </div>
          </div>
        )}

        {/* Fund Modal */}
        {showFundModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-gray-900/60 backdrop-blur-sm animate-in fade-in">
            <div className="bg-white dark:bg-gray-800 rounded-3xl w-full max-w-sm shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95">
              
              <div className="p-6 border-b border-gray-100 dark:border-gray-700 text-center bg-green-50/50 dark:bg-green-900/10">
                <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-1">Gestionar Fondo</h3>
                <div className="text-4xl font-black text-green-600 dark:text-green-500 mt-2">${totalFund.toFixed(2)}</div>
                <div className="text-xs font-semibold text-gray-500 dark:text-gray-400 tracking-wider uppercase mt-2">Fondo Actual</div>
              </div>

              <div className="p-6">
                <div className="mb-4">
                  <label className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2 block">Monto a modificar</label>
                  <div className="flex items-center bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-1 focus-within:ring-2 focus-within:ring-green-500 transition-all">
                    <span className="text-gray-400 font-bold">$</span>
                    <input 
                      type="number" 
                      min="0" 
                      step="0.01" 
                      value={fundInput} 
                      onChange={e => setFundInput(e.target.value)} 
                      className="w-full p-2 outline-none text-sm font-semibold bg-transparent dark:text-white" 
                      placeholder="0.00"
                      disabled={!isBoxOpen && totalFund === 0 && !fundInput}
                    />
                  </div>
                </div>
                <div className="flex gap-2">
                  <button 
                    onClick={() => {
                      const val = Number(fundInput);
                      if (isNaN(val) || val <= 0) return;
                      setTotalFund(prev => prev + val);
                      addFundHistory('add', val, `Se agregó $${val.toFixed(2)} manual`);
                      setFundInput('');
                      toast.success(`Se agregaron $${val.toFixed(2)} al fondo`);
                    }}
                    disabled={!isBoxOpen}
                    className={`flex-1 py-2.5 rounded-lg font-bold text-sm transition-colors ${!isBoxOpen ? 'bg-gray-200 text-gray-400 dark:bg-gray-800 dark:text-gray-600' : 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 hover:bg-green-200 dark:hover:bg-green-900/50'}`}
                  >
                    Agregar (+)
                  </button>
                  <button 
                    onClick={() => {
                      const val = Number(fundInput);
                      if (isNaN(val) || val <= 0) return;
                      setTotalFund(prev => Math.max(0, prev - val));
                      addFundHistory('subtract', val, `Se restaron $${val.toFixed(2)} manual`);
                      setFundInput('');
                      toast.success(`Se quitaron $${val.toFixed(2)} del fondo`);
                    }}
                    disabled={!isBoxOpen}
                    className={`flex-1 py-2.5 rounded-lg font-bold text-sm transition-colors ${!isBoxOpen ? 'bg-gray-200 text-gray-400 dark:bg-gray-800 dark:text-gray-600' : 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 hover:bg-red-200 dark:hover:bg-red-900/50'}`}
                  >
                    Restar (-)
                  </button>
                </div>
                {isBoxOpen && (
                  <button 
                    onClick={() => {
                      setShowFundModal(false);
                      setShowShiftSummary(true);
                    }}
                    className="w-full py-2.5 bg-gray-800 dark:bg-gray-700 text-white rounded-lg font-bold text-sm hover:bg-gray-900 dark:hover:bg-gray-600 transition-colors mt-2 shadow-md"
                  >
                    Finalizar jornada
                  </button>
                )}
                
                <button 
                  onClick={() => { setShowFundModal(false); setFundInput(''); }}
                  className="w-full py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg font-bold text-sm hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors mt-2"
                >
                  Cerrar
                </button>
              </div>

              <div className="mt-4 border-t border-gray-100 dark:border-gray-700 pt-2 px-6 pb-4">
                <button 
                  onClick={() => setShowFundModalHistory(!showFundModalHistory)}
                  className="w-full flex items-center justify-between py-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 transition-colors"
                >
                  <span className="text-sm font-semibold">Mostrar historial</span>
                  {showFundModalHistory ? <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" /></svg> : <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>}
                </button>
                {showFundModalHistory && (
                  <div className="mt-2 max-h-40 overflow-y-auto space-y-2 pr-1">
                    {fundHistory.map((entry) => (
                      <div key={entry.id} className="text-xs p-2 bg-gray-50 dark:bg-gray-800 rounded border border-gray-100 dark:border-gray-700 flex justify-between">
                        <div className="flex-1 min-w-0 pr-2">
                          <p className="text-gray-800 dark:text-gray-200 truncate">{entry.description}</p>
                          <span className="text-gray-500">{new Date(entry.time).toLocaleTimeString()}</span>
                        </div>
                        <div className={`font-bold ${entry.type === 'add' || entry.type === 'open' ? 'text-green-600 dark:text-green-400' : entry.type === 'close' ? 'text-gray-600 dark:text-gray-400' : 'text-orange-600 dark:text-orange-400'}`}>
                          {entry.type === 'add' || entry.type === 'open' ? '+' : entry.type === 'close' ? '' : '-'}${entry.amount.toFixed(2)}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

            </div>
          </div>
        )}

        {/* Shift Summary Modal */}
        {showShiftSummary && (
          <ShiftSummaryModal 
            totalFund={totalFund}
            fundHistory={fundHistory}
            onCancel={() => setShowShiftSummary(false)}
            onFinish={() => {
              addFundHistory('close', totalFund, `Se cerró caja con $${totalFund.toFixed(2)}`);
              setTotalFund(0);
              setTpvNumber('');
              setIsBoxOpen(false);
              setFundHistory([]);
              setShowShiftSummary(false);
              setAppState('home');
              toast.success(`Jornada finalizada exitosamente.`);
            }}
          />
        )}
      </div>
    </div>
  );
}
