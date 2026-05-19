import React, { useState } from 'react';
import { X, Delete } from 'lucide-react';

interface CalculatorModalProps {
  onClose: () => void;
}

export function CalculatorModal({ onClose }: CalculatorModalProps) {
  const [display, setDisplay] = useState('0');
  const [equation, setEquation] = useState('');
  const [isNewValue, setIsNewValue] = useState(false);

  const calculate = (expr: string) => {
    try {
      // Replace % with /100 and evaluate safely
      // A full regex for percentage calculations like 50 + 10%
      let modifiedExpr = expr;
      
      // Basic safe eval function using Function
      const safeEval = new Function('return ' + modifiedExpr.replace(/[^0-9+\-*/.()]/g, ''));
      const result = safeEval();
      
      if (!isFinite(result) || isNaN(result)) return 'Error';
      
      return parseFloat(result.toPrecision(12)).toString();
    } catch {
      return 'Error';
    }
  };

  const calculatePercentage = () => {
     try {
       // Only handles x% = x/100 right now for simplicity on mobile calc
       const val = parseFloat(display);
       if (!isNaN(val)) {
         setDisplay((val / 100).toString());
       }
     } catch {}
  };

  const handleInput = (val: string) => {
    if (display === 'Error') {
      setDisplay(val);
      setIsNewValue(false);
      return;
    }

    if (val === 'C') {
      setDisplay('0');
      setEquation('');
      setIsNewValue(false);
      return;
    }

    if (val === '⌫') {
      if (isNewValue) return;
      setDisplay(display.length > 1 ? display.slice(0, -1) : '0');
      return;
    }

    if (val === '=') {
      if (!equation && !isNewValue) return;
      const finalExpr = equation + display;
      const res = calculate(finalExpr);
      setDisplay(res);
      setEquation('');
      setIsNewValue(true);
      return;
    }

    if (['+', '-', '*', '/'].includes(val)) {
      if (isNewValue && !equation) {
        setEquation(display + val);
      } else {
         const res = calculate(equation + display);
         setDisplay(res);
         setEquation(res + val);
      }
      setIsNewValue(true);
      return;
    }

    if (val === '%') {
       calculatePercentage();
       return;
    }
    
    // Numbers and decimals
    if (isNewValue) {
      if (val === '.') setDisplay('0.');
      else setDisplay(val);
      setIsNewValue(false);
    } else {
      if (val === '.' && display.includes('.')) return;
      if (display === '0' && val !== '.') setDisplay(val);
      else setDisplay(display + val);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-gray-900/60 backdrop-blur-sm animate-in fade-in">
      <div className="bg-gray-900 w-full max-w-xs rounded-[3rem] shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95 border-b-[6px] border-r-[4px] border-gray-800">
        
        <div className="flex justify-end p-4 pb-0">
          <button onClick={onClose} className="p-2 text-gray-500 hover:text-white hover:bg-gray-800 rounded-full transition-colors">
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="p-6 pt-2 pb-6 flex flex-col items-end justify-end space-y-1">
          <div className="text-gray-400 text-lg h-6 font-medium">{equation.replace('*', '×').replace('/', '÷')}</div>
          <div className="text-white text-5xl font-light tracking-tight truncate w-full text-right">{display}</div>
        </div>

        <div className="p-4 grid grid-cols-4 gap-3 bg-gray-800 rounded-t-3xl">
          <button onClick={() => handleInput('C')} className="p-4 bg-gray-300 text-gray-900 rounded-2xl font-semibold text-xl active:scale-95 transition-transform">C</button>
          <button onClick={() => handleInput('⌫')} className="p-4 bg-gray-300 text-gray-900 rounded-2xl font-semibold text-xl flex items-center justify-center active:scale-95 transition-transform"><Delete className="w-6 h-6" /></button>
          <button onClick={() => handleInput('%')} className="p-4 bg-gray-300 text-gray-900 rounded-2xl font-semibold text-xl active:scale-95 transition-transform">%</button>
          <button onClick={() => handleInput('/')} className="p-4 bg-orange-500 text-white rounded-2xl font-semibold text-2xl active:scale-95 transition-transform">÷</button>

          <button onClick={() => handleInput('7')} className="p-4 bg-gray-700 text-white rounded-2xl font-semibold text-2xl active:scale-95 transition-transform">7</button>
          <button onClick={() => handleInput('8')} className="p-4 bg-gray-700 text-white rounded-2xl font-semibold text-2xl active:scale-95 transition-transform">8</button>
          <button onClick={() => handleInput('9')} className="p-4 bg-gray-700 text-white rounded-2xl font-semibold text-2xl active:scale-95 transition-transform">9</button>
          <button onClick={() => handleInput('*')} className="p-4 bg-orange-500 text-white rounded-2xl font-semibold text-2xl active:scale-95 transition-transform">×</button>

          <button onClick={() => handleInput('4')} className="p-4 bg-gray-700 text-white rounded-2xl font-semibold text-2xl active:scale-95 transition-transform">4</button>
          <button onClick={() => handleInput('5')} className="p-4 bg-gray-700 text-white rounded-2xl font-semibold text-2xl active:scale-95 transition-transform">5</button>
          <button onClick={() => handleInput('6')} className="p-4 bg-gray-700 text-white rounded-2xl font-semibold text-2xl active:scale-95 transition-transform">6</button>
          <button onClick={() => handleInput('-')} className="p-4 bg-orange-500 text-white rounded-2xl font-semibold text-3xl active:scale-95 transition-transform">-</button>

          <button onClick={() => handleInput('1')} className="p-4 bg-gray-700 text-white rounded-2xl font-semibold text-2xl active:scale-95 transition-transform">1</button>
          <button onClick={() => handleInput('2')} className="p-4 bg-gray-700 text-white rounded-2xl font-semibold text-2xl active:scale-95 transition-transform">2</button>
          <button onClick={() => handleInput('3')} className="p-4 bg-gray-700 text-white rounded-2xl font-semibold text-2xl active:scale-95 transition-transform">3</button>
          <button onClick={() => handleInput('+')} className="p-4 bg-orange-500 text-white rounded-2xl font-semibold text-3xl active:scale-95 transition-transform">+</button>

          <button onClick={() => handleInput('0')} className="p-4 bg-gray-700 text-white rounded-2xl font-semibold text-2xl col-span-2 active:scale-95 transition-transform">0</button>
          <button onClick={() => handleInput('.')} className="p-4 bg-gray-700 text-white rounded-2xl font-semibold text-3xl active:scale-95 transition-transform">.</button>
          <button onClick={() => handleInput('=')} className="p-4 bg-orange-500 text-white rounded-2xl font-semibold text-3xl active:scale-95 transition-transform">=</button>
        </div>

      </div>
    </div>
  );
}
