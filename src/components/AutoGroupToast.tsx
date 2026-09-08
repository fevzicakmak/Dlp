import React from 'react';
import { Layers, Sparkles, Check, X } from 'lucide-react';

interface AutoGroupToastProps {
  recommendation: { cabinetId: string; partIds: string[] } | null;
  onAccept: () => void;
  onDismiss: () => void;
}

export const AutoGroupToast: React.FC<AutoGroupToastProps> = ({
  recommendation,
  onAccept,
  onDismiss,
}) => {
  if (!recommendation) return null;

  return (
    <div className="fixed top-16 left-1/2 -translate-x-1/2 z-40 animate-in slide-in-from-top duration-300 select-none">
      <div className="bg-slate-900/95 backdrop-blur-md border border-blue-500/40 text-slate-100 px-4 py-3 rounded-2xl shadow-2xl flex items-center gap-3.5 max-w-md">
        <div className="p-2 bg-blue-500/10 text-blue-400 rounded-xl border border-blue-500/20 shrink-0">
          <Sparkles className="w-5 h-5 animate-pulse" />
        </div>

        <div className="text-xs">
          <div className="font-semibold text-white">Akıllı Grup Önerisi</div>
          <div className="text-slate-300 text-[11px] mt-0.5">
            Bu {recommendation.partIds.length} parça <span className="font-mono text-blue-400 font-bold">{recommendation.cabinetId}</span> dolabına ait görünüyor. Grup oluşturulsun mu?
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0 ml-2">
          <button
            onClick={onAccept}
            className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 active:scale-95 text-white rounded-xl text-xs font-bold transition shadow-sm flex items-center gap-1"
          >
            <Check className="w-3.5 h-3.5 stroke-[3]" />
            <span>Grup Yap</span>
          </button>
          <button
            onClick={onDismiss}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 active:scale-95 transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
