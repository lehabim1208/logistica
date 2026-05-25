import React, { useState } from 'react';
import { LogIn, DollarSign, CreditCard, History, StickyNote } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { toast } from 'sonner';

interface HomeViewProps {
  onStartShift: (fund: number, tpv: string, startTime: string, endTime: string) => void;
  onViewHistory?: () => void;
  onViewNotes?: () => void;
}

export function HomeView({ onStartShift, onViewHistory, onViewNotes }: HomeViewProps) {
  const [showFundInput, setShowFundInput] = useState(false);
  const [fundAmount, setFundAmount] = useState('');
  const [tpvNumber, setTpvNumber] = useState('');
  const [startTime, setStartTime] = useState(() => localStorage.getItem('logiruta_start_time') || '08:00');
  const [endTime, setEndTime] = useState(() => localStorage.getItem('logiruta_end_time') || '16:00');
  const [showConfirm, setShowConfirm] = useState(false);

  // Get current time in Mexico City / Central time (assuming Xalapa is Central)
  const dt = new Date(new Date().toLocaleString("en-US", { timeZone: "America/Mexico_City" }));
  const hour = dt.getHours();
  
  let greeting = 'Buenos días';
  if (hour >= 12 && hour < 19) {
    greeting = 'Buenas tardes';
  } else if (hour >= 19 || hour < 5) {
    greeting = 'Buenas noches';
  }

  const handleStartShift = () => {
    setShowFundInput(true);
  };

  const handleSetFund = () => {
    const val = Number(fundAmount);
    if (isNaN(val) || fundAmount.trim() === '') {
      toast.error('Por favor ingresa un monto válido');
      return;
    }
    if (tpvNumber.trim() === '') {
      toast.error('Por favor ingresa tu número de TPV');
      return;
    }
    setShowConfirm(true);
  };

  const confirmStart = () => {
    const val = Number(fundAmount);
    localStorage.setItem('logiruta_start_time', startTime);
    localStorage.setItem('logiruta_end_time', endTime);
    onStartShift(val, tpvNumber, startTime, endTime);
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-[85vh] px-4 overflow-hidden">
      <div className={`w-full max-w-md flex flex-col items-center text-center ${showFundInput ? 'space-y-5' : 'space-y-12'}`}>
        
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: "easeOut" }}
          className={showFundInput ? 'space-y-2' : 'space-y-4'}
        >
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.2, duration: 0.5 }}
            className={`bg-blue-600 rounded-3xl mx-auto flex items-center justify-center text-white shadow-2xl shadow-blue-500/30 ${showFundInput ? 'w-14 h-14 mb-2' : 'w-20 h-20 mb-6'}`}
          >
            <LogIn className={showFundInput ? 'w-7 h-7' : 'w-10 h-10'} />
          </motion.div>
          <h1 className={`font-bold text-gray-900 dark:text-white tracking-tight leading-tight ${showFundInput ? 'text-2xl sm:text-3xl' : 'text-4xl sm:text-5xl'}`}>
            {greeting}
          </h1>
          <p className={`text-gray-500 dark:text-gray-400 font-medium ${showFundInput ? 'text-sm' : 'text-lg sm:text-xl'}`}>
            ¿Listo para comenzar la jornada?
          </p>
        </motion.div>

        <AnimatePresence mode="wait">
          {!showFundInput ? (
            <motion.button
              key="start-button"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={handleStartShift}
              className="w-full py-5 bg-gray-900 dark:bg-white text-white dark:text-gray-900 rounded-2xl font-bold text-xl shadow-2xl shadow-gray-500/20 dark:shadow-white/5 transition-all flex items-center justify-center gap-3 group cursor-pointer"
            >
              <span>Iniciar jornada</span>
              <LogIn className="w-6 h-6 group-hover:translate-x-1 transition-transform" />
            </motion.button>
          ) : (
            <motion.div 
              key="fund-input"
              initial={{ opacity: 0, y: 50 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 50 }}
              className="w-full max-w-sm bg-white dark:bg-gray-800 p-4.5 rounded-2xl shadow-xl border border-gray-100 dark:border-gray-700/60 space-y-4"
            >
              <h2 className="text-sm font-black text-gray-700 dark:text-gray-200 tracking-wider uppercase">DATOS DE PREPARACIÓN</h2>
              
              <div className="space-y-3.5">
                <div className="text-left space-y-1">
                  <label className="text-[9px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest ml-1">Fondo de caja inicial</label>
                  <div className="flex items-center justify-center border-b border-green-500/20 dark:border-green-400/20 py-1 focus-within:border-green-500 transition-all">
                    <span className="text-xl font-bold text-green-600 dark:text-green-400 mr-1">$</span>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={fundAmount}
                      onChange={(e) => setFundAmount(e.target.value)}
                      placeholder="0.00"
                      className="w-full text-xl font-bold text-green-600 dark:text-green-400 bg-transparent outline-none text-center placeholder-green-100 dark:placeholder-green-900/10"
                      autoFocus
                    />
                  </div>
                </div>

                <div className="text-left space-y-1">
                  <label className="text-[9px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest ml-1">Número de TPV asignado</label>
                  <div className="relative group">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <CreditCard className="h-4 w-4 text-gray-300 dark:text-gray-600 group-focus-within:text-blue-500 transition-colors" />
                    </div>
                    <input
                      type="text"
                      value={tpvNumber}
                      onChange={(e) => setTpvNumber(e.target.value)}
                      placeholder="Ej. 69"
                      className="w-full pl-9 pr-3 py-2 bg-gray-50 dark:bg-gray-900/50 border border-gray-200 dark:border-gray-700 focus:border-blue-500 rounded-xl outline-none font-bold text-xs text-gray-900 dark:text-white placeholder-gray-300 dark:placeholder-gray-700 transition-all"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 text-left">
                  <div className="space-y-1">
                    <label className="text-[9px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest ml-1">Entrada</label>
                    <input
                      type="time"
                      value={startTime}
                      onChange={(e) => setStartTime(e.target.value)}
                      className="w-full px-2 py-1.5 bg-gray-50 dark:bg-gray-900/50 border border-gray-200 dark:border-gray-700 focus:border-blue-500 rounded-xl outline-none font-semibold text-xs text-gray-900 dark:text-white transition-all text-center"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[9px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest ml-1">Salida</label>
                    <input
                      type="time"
                      value={endTime}
                      onChange={(e) => setEndTime(e.target.value)}
                      className="w-full px-2 py-1.5 bg-gray-50 dark:bg-gray-900/50 border border-gray-200 dark:border-gray-700 focus:border-blue-500 rounded-xl outline-none font-semibold text-xs text-gray-900 dark:text-white transition-all text-center"
                    />
                  </div>
                </div>
              </div>

              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={handleSetFund}
                className="w-full py-2.5 bg-green-500 text-white rounded-xl font-bold text-xs shadow-md shadow-green-500/10 hover:bg-green-600 transition-all cursor-pointer"
              >
                Comenzar Turno
              </motion.button>
            </motion.div>
          )}
        </AnimatePresence>

        {!showFundInput && (
          <div className="w-full flex flex-col sm:flex-row gap-2 sm:gap-4 justify-center items-center pt-2">
            {onViewHistory && (
              <motion.button
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.8 }}
                onClick={onViewHistory}
                className="py-3 px-4 text-gray-500 hover:text-blue-600 dark:text-gray-400 dark:hover:text-blue-400 transition-colors flex justify-center items-center gap-2 text-sm font-semibold border border-dashed border-gray-200 dark:border-gray-700 hover:border-solid hover:border-blue-500 rounded-xl w-full sm:w-auto min-w-[180px]"
              >
                <History className="w-4 h-4" />
                <span>Historial de rutas</span>
              </motion.button>
            )}
            {onViewNotes && (
              <motion.button
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.9 }}
                onClick={onViewNotes}
                className="py-3 px-4 text-gray-500 hover:text-blue-600 dark:text-gray-400 dark:hover:text-blue-400 transition-colors flex justify-center items-center gap-2 text-sm font-semibold border border-dashed border-gray-200 dark:border-gray-700 hover:border-solid hover:border-blue-500 rounded-xl w-full sm:w-auto min-w-[180px]"
              >
                <StickyNote className="w-4 h-4" />
                <span>Ver Notas Rápidas</span>
              </motion.button>
            )}
          </div>
        )}
      </div>

      <AnimatePresence>
        {showConfirm && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-gray-900/60 backdrop-blur-md"
          >
            <motion.div 
              initial={{ scale: 0.9, y: 20, opacity: 0 }}
              animate={{ scale: 1, y: 0, opacity: 1 }}
              exit={{ scale: 0.9, y: 20, opacity: 0 }}
              className="bg-white dark:bg-gray-800 rounded-3xl w-full max-w-sm p-6 shadow-2xl border border-gray-100 dark:border-gray-700"
            >
              <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-6 text-center">¿Confirmar Turno?</h3>
              <div className="bg-gray-50 dark:bg-gray-900/50 rounded-2xl p-4 mb-8 space-y-4">
                <div className="flex justify-between items-center">
                  <span className="text-xs font-bold text-gray-400 uppercase">Fondo</span>
                  <span className="font-bold text-green-600 dark:text-green-400 text-xl">${Number(fundAmount).toFixed(2)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-xs font-bold text-gray-400 uppercase">TPV</span>
                  <span className="font-bold text-gray-900 dark:text-white text-lg">{tpvNumber}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-xs font-bold text-gray-400 uppercase">Horario</span>
                  <span className="font-bold text-gray-900 dark:text-white text-md">{startTime} - {endTime}</span>
                </div>
              </div>
              
              <div className="flex gap-4">
                <button
                  onClick={() => setShowConfirm(false)}
                  className="flex-1 py-3 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 font-bold rounded-xl hover:bg-gray-200"
                >
                  Regresar
                </button>
                <button
                  onClick={confirmStart}
                  className="flex-1 py-3 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 shadow-lg shadow-blue-600/20"
                >
                  Confirmar
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
