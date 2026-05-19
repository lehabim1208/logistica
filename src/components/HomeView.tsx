import React, { useState } from 'react';
import { LogIn, DollarSign, CreditCard, History } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { toast } from 'react-hot-toast';

interface HomeViewProps {
  onStartShift: (fund: number, tpv: string) => void;
  onViewHistory?: () => void;
}

export function HomeView({ onStartShift, onViewHistory }: HomeViewProps) {
  const [showFundInput, setShowFundInput] = useState(false);
  const [fundAmount, setFundAmount] = useState('');
  const [tpvNumber, setTpvNumber] = useState('');
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
    onStartShift(val, tpvNumber);
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-[85vh] px-4 overflow-hidden">
      <div className="w-full max-w-md flex flex-col items-center text-center space-y-12">
        
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: "easeOut" }}
          className="space-y-4"
        >
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.2, duration: 0.5 }}
            className="w-20 h-20 bg-blue-600 rounded-3xl mx-auto flex items-center justify-center text-white shadow-2xl shadow-blue-500/30 mb-6"
          >
            <LogIn className="w-10 h-10" />
          </motion.div>
          <h1 className="text-4xl sm:text-5xl font-bold text-gray-900 dark:text-white tracking-tight leading-tight">
            {greeting}
          </h1>
          <p className="text-gray-500 dark:text-gray-400 text-lg sm:text-xl font-medium">
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
              className="w-full py-5 bg-gray-900 dark:bg-white text-white dark:text-gray-900 rounded-2xl font-bold text-xl shadow-2xl shadow-gray-500/20 dark:shadow-white/5 transition-all flex items-center justify-center gap-3 group"
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
              className="w-full bg-white dark:bg-gray-800 p-6 sm:p-8 rounded-[2rem] shadow-[0_20px_50px_rgba(0,0,0,0.1)] dark:shadow-[0_20px_50px_rgba(0,0,0,0.3)] border border-gray-100 dark:border-gray-700 space-y-8"
            >
              <h2 className="text-xl sm:text-2xl font-bold text-gray-800 dark:text-gray-100 tracking-tight">DATOS DE PREPARACIÓN</h2>
              
              <div className="space-y-6">
                <div className="text-left space-y-3">
                  <label className="text-[11px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest ml-1">Fondo de caja inicial</label>
                  <div className="flex items-center justify-center border-b-2 border-green-500/30 dark:border-green-400/20 py-2 group focus-within:border-green-500 transition-all">
                    <span className="text-3xl font-bold text-green-600 dark:text-green-400 mr-2">$</span>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={fundAmount}
                      onChange={(e) => setFundAmount(e.target.value)}
                      placeholder="0.00"
                      className="w-full text-4xl font-bold text-green-600 dark:text-green-400 bg-transparent outline-none text-center placeholder-green-100 dark:placeholder-green-900/20"
                      autoFocus
                    />
                  </div>
                </div>

                <div className="text-left space-y-3">
                  <label className="text-[11px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest ml-1">Número de TPV asignado</label>
                  <div className="relative group">
                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                      <CreditCard className="h-5 w-5 text-gray-300 dark:text-gray-600 group-focus-within:text-blue-500 transition-colors" />
                    </div>
                    <input
                      type="text"
                      value={tpvNumber}
                      onChange={(e) => setTpvNumber(e.target.value)}
                      placeholder="Ej. 69"
                      className="w-full pl-12 pr-4 py-4 bg-gray-50 dark:bg-gray-900/50 border border-gray-200 dark:border-gray-700 focus:border-blue-500 rounded-xl outline-none font-bold text-lg text-gray-900 dark:text-white placeholder-gray-300 dark:placeholder-gray-700 transition-all"
                    />
                  </div>
                </div>
              </div>

              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={handleSetFund}
                className="w-full py-4 bg-green-500 text-white rounded-xl font-bold text-lg shadow-lg shadow-green-500/20 hover:bg-green-600 transition-all"
              >
                Comenzar Turno
              </motion.button>
            </motion.div>
          )}
        </AnimatePresence>

        {onViewHistory && !showFundInput && (
          <motion.button
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1 }}
            onClick={onViewHistory}
            className="w-full py-4 text-gray-400 dark:text-gray-500 font-bold hover:text-blue-600 dark:hover:text-blue-400 transition-colors flex justify-center items-center gap-2"
          >
            <History className="w-5 h-5" />
            <span>Ver historial de rutas</span>
          </motion.button>
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
