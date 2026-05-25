import React, { useState, useEffect } from 'react';
import { X, Delete } from 'lucide-react';

interface CalculatorModalProps {
  onClose: () => void;
}

export function CalculatorModal({ onClose }: CalculatorModalProps) {
  const [display, setDisplay] = useState(() => {
    return localStorage.getItem('logiruta_calc_display') || '0';
  });
  const [equation, setEquation] = useState(() => {
    return localStorage.getItem('logiruta_calc_equation') || '';
  });
  const [isNewValue, setIsNewValue] = useState(false);

  // Sync state to localStorage on every change
  useEffect(() => {
    localStorage.setItem('logiruta_calc_display', display || '0');
    localStorage.setItem('logiruta_calc_equation', equation || '');
  }, [display, equation]);

  const calculate = (expr: string) => {
    try {
      // Clean up spaces and normalize operators
      let clean = expr.replace(/\s+/g, '').replace(/×/g, '*').replace(/÷/g, '/');
      
      // Match pattern for X [op] Y % at the end of the expression
      // e.g. "900-10%" or "500+15%"
      const percentMatch = clean.match(/^([\d.]+)([+\-*/])([\d.]+)%$/);
      if (percentMatch) {
        const x = parseFloat(percentMatch[1]);
        const op = percentMatch[2];
        const y = parseFloat(percentMatch[3]);
        if (!isNaN(x) && !isNaN(y)) {
          let result = 0;
          if (op === '+') {
            result = x + (x * y / 100);
          } else if (op === '-') {
            result = x - (x * y / 100);
          } else if (op === '*') {
            result = x * (y / 100);
          } else if (op === '/') {
            result = x / (y / 100);
          }
          return parseFloat(result.toPrecision(12)).toString();
        }
      }
      
      // Fallback: If it's just Y% (like "15%")
      const simplePercent = clean.match(/^([\d.]+)%$/);
      if (simplePercent) {
        const val = parseFloat(simplePercent[1]);
        if (!isNaN(val)) return (val / 100).toString();
      }

      // Replace standard percent blocks with /100 division
      let replaced = clean.replace(/([\d.]+)%/g, '($1/100)');
      
      // Basic safe evaluation
      const safeEval = new Function('return ' + replaced.replace(/[^0-9+\-*/.()]/g, ''));
      const result = safeEval();
      
      if (!isFinite(result) || isNaN(result)) return 'Error';
      return parseFloat(result.toPrecision(12)).toString();
    } catch {
      return 'Error';
    }
  };

  const handleInput = (val: string) => {
    if (display === 'Error') {
      setDisplay(val === 'C' ? '0' : val);
      setEquation('');
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
       // Append percent sign to current display number
       if (display !== '0' && !display.includes('%')) {
         setDisplay(prev => prev + '%');
       }
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
          <div className="text-gray-400 text-lg h-6 font-medium">{equation.replace(/\*/g, '×').replace(/\//g, '÷')}</div>
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
