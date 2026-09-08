import React, { useState, useEffect } from 'react';
import { Check, X, Delete, Plus, Minus, Sliders } from 'lucide-react';

interface NumericKeypadModalProps {
  isOpen: boolean;
  title: string;
  unit?: string;
  initialValue: number;
  min?: number;
  max?: number;
  step?: number;
  onConfirm: (val: number) => void;
  onClose: () => void;
}

export const NumericKeypadModal: React.FC<NumericKeypadModalProps> = ({
  isOpen,
  title,
  unit = 'mm',
  initialValue,
  min = 1,
  max = 5000,
  step = 10,
  onConfirm,
  onClose,
}) => {
  const [valueStr, setValueStr] = useState<string>(String(initialValue));

  useEffect(() => {
    if (isOpen) {
      setValueStr(String(initialValue));
    }
  }, [isOpen, initialValue]);

  if (!isOpen) return null;

  const currentNum = parseFloat(valueStr) || 0;
  const clampedSliderVal = Math.max(min, Math.min(max, currentNum));

  const handleDigit = (digit: string) => {
    if (digit === '.' && valueStr.includes('.')) return;
    if (valueStr === '0' && digit !== '.') {
      setValueStr(digit);
    } else {
      setValueStr((prev) => prev + digit);
    }
  };

  const handleBackspace = () => {
    setValueStr((prev) => (prev.length > 1 ? prev.slice(0, -1) : '0'));
  };

  const handleClear = () => {
    setValueStr('0');
  };

  const handleQuickAdd = (delta: number) => {
    const cur = parseFloat(valueStr) || 0;
    const newVal = Math.max(min, Math.min(max, cur + delta));
    setValueStr(String(newVal));
  };

  const handleSliderChange = (newVal: number) => {
    setValueStr(String(newVal));
  };

  const handleConfirm = () => {
    const num = parseFloat(valueStr);
    if (!isNaN(num)) {
      const clamped = Math.max(min, Math.min(max, num));
      onConfirm(clamped);
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-sm p-0 sm:p-4 animate-in fade-in duration-150">
      <div
        className="w-full sm:max-w-md bg-slate-900 border border-slate-700 rounded-t-2xl sm:rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-800 bg-slate-800/90">
          <div>
            <h3 className="text-base font-semibold text-white tracking-wide">{title}</h3>
            <p className="text-xs text-slate-400">
              Aralık: {min} {unit} — {max} {unit}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-700 active:scale-95 transition-all"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Display Screen */}
        <div className="p-4 bg-slate-950 flex flex-col items-center justify-center border-b border-slate-800">
          <div className="flex items-baseline gap-2">
            <span className="text-4xl font-bold font-mono tracking-tight text-blue-400">
              {valueStr || '0'}
            </span>
            <span className="text-lg font-medium text-slate-500 font-mono">{unit}</span>
          </div>
        </div>

        {/* Real-time Interactive Slider Bar */}
        <div className="px-5 py-3 bg-slate-900/95 border-b border-slate-800/80 space-y-1.5">
          <div className="flex justify-between items-center text-[11px] text-slate-400">
            <span className="flex items-center gap-1 text-slate-300 font-medium">
              <Sliders className="w-3.5 h-3.5 text-blue-400" />
              Slider ile Ayarla
            </span>
            <span className="font-mono text-blue-400 font-bold">
              {clampedSliderVal} {unit}
            </span>
          </div>
          <input
            type="range"
            min={min}
            max={max}
            step={step}
            value={clampedSliderVal}
            onChange={(e) => handleSliderChange(Number(e.target.value))}
            className="w-full cursor-pointer accent-blue-500"
          />
          <div className="flex justify-between text-[10px] text-slate-500 font-mono">
            <span>{min} {unit}</span>
            <span>{Math.round((min + max) / 2)} {unit}</span>
            <span>{max} {unit}</span>
          </div>
        </div>

        {/* Quick Increment Buttons */}
        <div className="grid grid-cols-4 gap-2 px-4 pt-2.5 pb-1 bg-slate-900/90">
          <button
            onClick={() => handleQuickAdd(-50)}
            className="py-2 px-1 text-xs font-semibold rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 active:scale-95 transition"
          >
            -50
          </button>
          <button
            onClick={() => handleQuickAdd(-10)}
            className="py-2 px-1 text-xs font-semibold rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 active:scale-95 transition"
          >
            -10
          </button>
          <button
            onClick={() => handleQuickAdd(10)}
            className="py-2 px-1 text-xs font-semibold rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 active:scale-95 transition"
          >
            +10
          </button>
          <button
            onClick={() => handleQuickAdd(50)}
            className="py-2 px-1 text-xs font-semibold rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 active:scale-95 transition"
          >
            +50
          </button>
        </div>

        {/* Keypad Grid */}
        <div className="p-4 grid grid-cols-3 gap-2 bg-slate-900">
          {['1', '2', '3', '4', '5', '6', '7', '8', '9', 'C', '0', '.'].map((key) => {
            const isClear = key === 'C';
            return (
              <button
                key={key}
                onClick={() => (isClear ? handleClear() : handleDigit(key))}
                className={`h-13 rounded-xl text-xl font-semibold font-mono flex items-center justify-center active:scale-95 transition-all shadow-sm ${
                  isClear
                    ? 'bg-red-500/10 text-red-400 hover:bg-red-500/20 border border-red-500/30'
                    : 'bg-slate-800 text-white hover:bg-slate-700 border border-slate-700/60'
                }`}
              >
                {key}
              </button>
            );
          })}
        </div>

        {/* Action Buttons with prominent OK button */}
        <div className="p-4 grid grid-cols-2 gap-3 border-t border-slate-800 bg-slate-950">
          <button
            onClick={handleBackspace}
            className="h-12 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium flex items-center justify-center gap-2 active:scale-95 transition border border-slate-700"
          >
            <Delete className="w-5 h-5 text-slate-400" />
            <span>Sil (Geri)</span>
          </button>

          <button
            onClick={handleConfirm}
            className="h-12 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white font-bold flex items-center justify-center gap-2 shadow-lg shadow-emerald-900/40 active:scale-95 transition"
          >
            <Check className="w-6 h-6 stroke-[3]" />
            <span className="text-base">ONAYLA (OK)</span>
          </button>
        </div>
      </div>
    </div>
  );
};
