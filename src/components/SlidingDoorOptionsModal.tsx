import React from 'react';
import { Check, X, Rows3, Columns3, GlassWater, ScanFace } from 'lucide-react';
import { SlidingDoorMetadata } from '../types/cad';

interface SlidingDoorPanelOption {
  finish: SlidingDoorMetadata['finish'];
  verticalDividers: number;
  horizontalDividers: number;
}

interface SlidingDoorOptionsModalProps {
  isOpen: boolean;
  cellLabel?: string;
  panelCount: number;
  finish: SlidingDoorMetadata['finish'];
  verticalDividers: number;
  horizontalDividers: number;
  panels?: SlidingDoorPanelOption[];
  onChange: (changes: Partial<SlidingDoorOptionsModalProps>) => void;
  onConfirm: () => void;
  onClose: () => void;
}

export const SlidingDoorOptionsModal: React.FC<SlidingDoorOptionsModalProps> = ({
  isOpen, cellLabel, panelCount, finish, verticalDividers, horizontalDividers, panels = [], onChange, onConfirm, onClose,
}) => {
  if (!isOpen) return null;
  const choices = [
    { value: 'mdflam' as const, label: 'MDFLAM', icon: <Rows3 className="w-4 h-4" /> },
    { value: 'mirror' as const, label: 'Ayna', icon: <ScanFace className="w-4 h-4" /> },
    { value: 'glass' as const, label: 'Cam', icon: <GlassWater className="w-4 h-4" /> },
  ];

  const ensurePanels = Array.from({ length: Math.max(2, panelCount) }, (_, index) => {
    const existing = panels[index] ?? { finish, verticalDividers, horizontalDividers };
    return {
      finish: existing.finish ?? finish,
      verticalDividers: existing.verticalDividers ?? verticalDividers,
      horizontalDividers: existing.horizontalDividers ?? horizontalDividers,
    };
  });

  const updatePanelCount = (count: number) => {
    const nextPanels = Array.from({ length: count }, (_, index) => ensurePanels[index] ?? {
      finish,
      verticalDividers,
      horizontalDividers,
    });
    onChange({ panelCount: count, panels: nextPanels, finish: nextPanels[0].finish, verticalDividers: nextPanels[0].verticalDividers, horizontalDividers: nextPanels[0].horizontalDividers });
  };

  const updatePanel = (panelIndex: number, updates: Partial<SlidingDoorPanelOption>) => {
    const nextPanels = ensurePanels.map((panel, index) => index === panelIndex ? { ...panel, ...updates } : panel);
    onChange({
      panels: nextPanels,
      finish: nextPanels[0].finish,
      verticalDividers: nextPanels[0].verticalDividers,
      horizontalDividers: nextPanels[0].horizontalDividers,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-sm p-0 sm:p-4">
      <div className="w-full sm:max-w-lg bg-slate-900 border border-cyan-500/40 rounded-t-2xl sm:rounded-2xl shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800">
          <div>
            <h2 className="text-base font-semibold text-white">Ray Kapak Tasarımı</h2>
            <p className="text-xs text-slate-400">{cellLabel || 'Seçilen göz'} için seçenekleri belirleyin</p>
          </div>
          <button type="button" onClick={onClose} className="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800" aria-label="Kapat"><X className="w-5 h-5" /></button>
        </div>
        <div className="p-5 space-y-5 max-h-[70vh] overflow-y-auto">
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-2">Panel adedi</label>
            <div className="grid grid-cols-4 gap-2">
              {[2, 3, 4, 5].map((count) => <button key={count} type="button" onClick={() => updatePanelCount(count)} className={`py-2 rounded-lg border text-sm font-semibold ${panelCount === count ? 'bg-cyan-600 border-cyan-400 text-white' : 'bg-slate-800 border-slate-700 text-slate-300'}`}>{count} panel</button>)}
            </div>
          </div>

          {ensurePanels.map((panel, index) => (
            <div key={`panel-config-${index}`} className="rounded-xl border border-slate-800 bg-slate-950/40 p-3 space-y-3">
              <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-400">Kapak {index + 1}</div>
              <div>
                <label className="block text-[10px] font-semibold text-slate-300 mb-2">Yüzey</label>
                <div className="grid grid-cols-3 gap-2">
                  {choices.map((choice) => (
                    <button key={`${index}-${choice.value}`} type="button" onClick={() => updatePanel(index, { finish: choice.value })} className={`flex items-center justify-center gap-1.5 py-2 rounded-lg border text-[11px] font-semibold ${panel.finish === choice.value ? 'bg-cyan-600 border-cyan-400 text-white' : 'bg-slate-800 border-slate-700 text-slate-300'}`}>
                      {choice.icon}{choice.label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <label className="text-[10px] text-slate-300">Dikey çıta
                  <select value={panel.verticalDividers} onChange={(e) => updatePanel(index, { verticalDividers: Number(e.target.value) })} className="mt-1 w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white"><option value={0}>Yok</option><option value={1}>1</option><option value={2}>2</option><option value={3}>3</option></select>
                </label>
                <label className="text-[10px] text-slate-300">Yatay çıta
                  <select value={panel.horizontalDividers} onChange={(e) => updatePanel(index, { horizontalDividers: Number(e.target.value) })} className="mt-1 w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white"><option value={0}>Yok</option><option value={1}>1</option><option value={2}>2</option><option value={3}>3</option></select>
                </label>
              </div>
            </div>
          ))}

          <div className="flex items-center gap-2 p-3 bg-cyan-500/10 border border-cyan-500/20 rounded-lg text-xs text-cyan-200"><Columns3 className="w-4 h-4 shrink-0" />Her kapak ayrı yüzey ve bölme tanımı ile oluşturulur.</div>
        </div>
        <div className="flex gap-2 px-5 py-4 border-t border-slate-800"><button type="button" onClick={onClose} className="flex-1 py-2.5 rounded-lg bg-slate-800 text-slate-300 font-semibold">Vazgeç</button><button type="button" onClick={onConfirm} className="flex-1 py-2.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white font-semibold flex items-center justify-center gap-2"><Check className="w-4 h-4" />Ray Kapak Oluştur</button></div>
      </div>
    </div>
  );
};
