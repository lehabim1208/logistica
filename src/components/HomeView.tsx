import React, { useState } from 'react';
import { LogIn, DollarSign, CreditCard, History } from 'lucide-react';
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
    <div className="flex flex-col items-center justify-center min-h-[70vh] px-4 animate-in fade-in duration-500">
      <div className="w-full max-w-sm flex flex-col items-center text-center space-y-8">
        
        <div className="space-y-2">
          <h1 className="text-4xl font-bold text-gray-900 dark:text-white tracking-tight">
            {greeting}
          </h1>
          <p className="text-gray-500 dark:text-gray-400 text-lg">
            ¿Listo para comenzar la jornada?
          </p>
        </div>

        {!showFundInput ? (
          <button
            onClick={handleStartShift}
            className="w-full py-4 bg-gray-900 dark:bg-white text-white dark:text-gray-900 rounded-2xl font-bold text-lg shadow-lg hover:shadow-xl hover:-translate-y-0.5 transition-all flex items-center justify-center gap-2"
          >
            <LogIn className="w-6 h-6" />
            Iniciar jornada
          </button>
        ) : (
          <div className="w-full bg-white dark:bg-gray-800 p-6 rounded-3xl shadow-xl border border-gray-100 dark:border-gray-700 space-y-6 animate-in slide-in-from-bottom-4 fade-in">
            <h2 className="text-xl font-semibold text-gray-800 dark:text-gray-200">Datos de la jornada</h2>
            
            <div className="space-y-4">
              <div className="text-left space-y-1">
                <label className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider ml-1">Fondo de caja</label>
                <div className="flex items-center justify-center border-b-2 border-green-500 dark:border-green-400 py-3 mx-4">
                  <span className="text-3xl font-bold text-green-600 dark:text-green-400 mr-1">$</span>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={fundAmount}
                    onChange={(e) => setFundAmount(e.target.value)}
                    placeholder="0.00"
                    className="w-full text-4xl font-bold text-green-600 dark:text-green-400 bg-transparent outline-none text-center placeholder-green-300 dark:placeholder-green-700/50"
                    autoFocus
                  />
                </div>
              </div>

              <div className="text-left space-y-1">
                <label className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider ml-1">Número de TPV</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <CreditCard className="h-5 w-5 text-gray-400" />
                  </div>
                  <input
                    type="text"
                    value={tpvNumber}
                    onChange={(e) => setTpvNumber(e.target.value)}
                    placeholder="Ej. TPV-01 o 4876"
                    className="w-full pl-10 pr-4 py-3 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none font-medium text-gray-900 dark:text-white placeholder-gray-400"
                  />
                </div>
              </div>
            </div>

            <button
              onClick={handleSetFund}
              className="w-full py-3.5 bg-green-500 hover:bg-green-600 text-white rounded-xl font-bold text-lg shadow-md transition-colors"
            >
              Iniciar
            </button>
          </div>
        )}

        {onViewHistory && (
          <button
            onClick={onViewHistory}
            className="w-full py-4 mt-6 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-2xl font-bold border border-gray-200 dark:border-gray-700 shadow-sm hover:bg-gray-50 dark:hover:bg-gray-750 transition-colors flex justify-center items-center gap-2"
          >
            <History className="w-5 h-5 text-gray-500" />
            Historial de Viajes
          </button>
        )}
      </div>

      {showConfirm && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-gray-900/40 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white dark:bg-gray-800 rounded-2xl w-full max-w-sm p-6 shadow-2xl animate-in zoom-in-95">
            <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2 text-center">Confirmar Inicio</h3>
            <div className="bg-gray-50 dark:bg-gray-900/50 rounded-xl p-4 mb-6 space-y-3">
              <div className="flex justify-between items-center bg-white dark:bg-gray-800 p-2 rounded-lg border border-gray-100 dark:border-gray-700">
                <span className="text-sm text-gray-500 dark:text-gray-400 font-medium">Fondo:</span>
                <span className="font-bold text-green-600 dark:text-green-400 text-lg">${Number(fundAmount).toFixed(2)}</span>
              </div>
              <div className="flex justify-between items-center bg-white dark:bg-gray-800 p-2 rounded-lg border border-gray-100 dark:border-gray-700">
                <span className="text-sm text-gray-500 dark:text-gray-400 font-medium">TPV:</span>
                <span className="font-bold text-gray-900 dark:text-white">{tpvNumber}</span>
              </div>
            </div>
            
            <div className="flex gap-3">
              <button
                onClick={() => setShowConfirm(false)}
                className="flex-1 py-3 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 font-semibold rounded-xl hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={confirmStart}
                className="flex-1 py-3 bg-gray-900 dark:bg-white text-white dark:text-gray-900 font-semibold rounded-xl hover:bg-gray-800 dark:hover:bg-gray-100 transition-colors shadow-sm"
              >
                Comenzar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
