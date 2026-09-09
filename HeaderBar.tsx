import React, { useEffect, useRef, useState } from 'react';
import {
  Box, Plus, Undo2, Redo2, Camera, Scissors, ReceiptText, Save, HelpCircle,
  Maximize2, Minimize2, Download, Sparkles, ChevronDown, History,
  SlidersHorizontal, Wrench,
} from 'lucide-react';
import { CadState } from '../store/cadStore';
import { RenderMode, CameraMode, CameraPreset } from '../types/cad';

interface HeaderBarProps {
  state: CadState;
  onAddCabinet: () => void;
  onUndo: () => void;
  onRedo: () => void;
  onSetRenderMode: (mode: RenderMode) => void;
  onSetCameraMode: (mode: CameraMode) => void;
  onSetCameraPreset: (preset: CameraPreset) => void;
  onOpenCuttingModal: () => void;
  onOpenCostModal: () => void;
  onOpenHelpModal: () => void;
  onSaveProject: () => void;
  onExportImage: () => void;
  topControls?: React.ReactNode;
}

type HeaderMenu = 'history' | 'view' | 'tools' | null;

const menuButtonClass = 'flex items-center gap-1.5 rounded-lg border border-slate-700/70 bg-slate-800/80 px-2.5 py-1.5 text-xs font-semibold text-slate-200 transition hover:bg-slate-700 hover:text-white';
const menuItemClass = 'flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-xs font-semibold text-slate-200 transition hover:bg-slate-800';

export const HeaderBar: React.FC<HeaderBarProps> = ({
  state, onAddCabinet, onUndo, onRedo, onSetRenderMode, onSetCameraMode,
  onSetCameraPreset, onOpenCuttingModal, onOpenCostModal, onOpenHelpModal,
  onSaveProject, onExportImage, topControls,
}) => {
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [openMenu, setOpenMenu] = useState<HeaderMenu>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handlePointerDown = (event: PointerEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) setOpenMenu(null);
    };
    document.addEventListener('pointerdown', handlePointerDown);
    return () => document.removeEventListener('pointerdown', handlePointerDown);
  }, []);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
      setIsFullscreen(true);
    } else {
      document.exitFullscreen().catch(() => {});
      setIsFullscreen(false);
    }
  };

  const closeMenu = () => setOpenMenu(null);

  return (
    <header className="fixed inset-x-0 top-0 z-30 border-b border-slate-800 bg-slate-900/95 text-slate-100 shadow-md backdrop-blur-md select-none">
      <div ref={menuRef} className="mx-auto flex min-h-[3.5rem] w-full max-w-[1800px] items-center gap-2 px-2 py-1.5 sm:px-4">
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <div className="flex shrink-0 items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-tr from-blue-600 to-indigo-500 text-white shadow-glow">
              <Box className="h-5 w-5 stroke-[2.2]" />
            </div>
            <div className="hidden md:block">
              <h1 className="flex items-center gap-1.5 text-sm font-bold tracking-wider text-white font-mono">
                MODUCAD <span className="rounded bg-blue-500/20 px-1.5 py-0.5 text-xs font-normal text-blue-400">3D PRO</span>
              </h1>
              <p className="max-w-[140px] truncate text-[10px] text-slate-400 font-mono">{state.projectName}</p>
            </div>
          </div>
          <div className="hidden h-6 w-px bg-slate-800 sm:block" />
          <button onClick={onAddCabinet} className="flex shrink-0 items-center gap-1.5 rounded-lg bg-blue-600 px-2.5 py-1.5 text-xs font-semibold text-white shadow-sm transition hover:bg-blue-500 active:scale-95 sm:px-3" title="Yeni Dolap Ekle">
            <Plus className="h-4 w-4" /><span>Dolap Ekle</span>
          </button>
        </div>

        <div className="relative flex shrink-0 items-center gap-1.5">
          <div className="relative">
            <button onClick={() => setOpenMenu(openMenu === 'history' ? null : 'history')} className={menuButtonClass} title="Geçmiş işlemleri" aria-expanded={openMenu === 'history'}>
              <History className="h-4 w-4 text-slate-300" /><span className="hidden sm:inline">Geçmiş</span><ChevronDown className="h-3.5 w-3.5 text-slate-400" />
            </button>
            {openMenu === 'history' && <div className="header-popover absolute right-0 top-full z-50 mt-2 w-44 rounded-xl border border-slate-700 bg-slate-900/98 p-1.5 shadow-2xl backdrop-blur-xl">
              <button onClick={() => { onUndo(); closeMenu(); }} disabled={state.historyIndex <= 0} className={`${menuItemClass} disabled:pointer-events-none disabled:opacity-30`}><Undo2 className="h-4 w-4" /> Geri Al <span className="ml-auto text-[10px] text-slate-500">Ctrl+Z</span></button>
              <button onClick={() => { onRedo(); closeMenu(); }} disabled={state.historyIndex >= state.history.length - 1} className={`${menuItemClass} disabled:pointer-events-none disabled:opacity-30`}><Redo2 className="h-4 w-4" /> İleri Al <span className="ml-auto text-[10px] text-slate-500">Ctrl+Y</span></button>
            </div>}
          </div>

          <div className="relative">
            <button onClick={() => setOpenMenu(openMenu === 'view' ? null : 'view')} className={menuButtonClass} title="Görünüm ve kamera ayarları" aria-expanded={openMenu === 'view'}>
              <SlidersHorizontal className="h-4 w-4 text-blue-400" /><span className="hidden sm:inline">Görünüm</span><ChevronDown className="h-3.5 w-3.5 text-slate-400" />
            </button>
            {openMenu === 'view' && <div className="header-popover absolute right-0 top-full z-50 mt-2 w-[min(18rem,calc(100vw-1rem))] rounded-xl border border-slate-700 bg-slate-900/98 p-2 shadow-2xl backdrop-blur-xl">
              <div className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-500">Görüntü modu</div>
              <div className="grid grid-cols-2 gap-1">
                {([['sketch', 'Eskiz'], ['realistic', 'Realistik'], ['unpainted', 'Boyasız'], ['wood_textured', 'Ahşap Kaplama']] as [RenderMode, string][]).map(([mode, label]) => <button key={mode} onClick={() => { onSetRenderMode(mode); closeMenu(); }} className={`rounded-lg px-2 py-2 text-left text-xs font-semibold transition ${state.renderMode === mode ? 'bg-blue-600 text-white' : 'text-slate-300 hover:bg-slate-800'}`}>{mode === 'wood_textured' && <Sparkles className="mr-1 inline h-3 w-3 text-amber-300" />}{label}</button>)}
              </div>
              <div className="my-1.5 h-px bg-slate-800" />
              <div className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-500">Kamera</div>
              {([['iso', '3D İzometrik'], ['front', 'Ön Görünüş'], ['top', 'Üst (Plan)'], ['left', 'Sol Yan'], ['right', 'Sağ Yan']] as [CameraPreset, string][]).map(([preset, label]) => <button key={preset} onClick={() => { onSetCameraPreset(preset); closeMenu(); }} className={`${menuItemClass} ${state.cameraPreset === preset ? 'bg-blue-600 text-white' : ''}`}><Camera className="h-4 w-4 text-blue-400" /> {label}</button>)}
              <button onClick={() => { onSetCameraMode(state.cameraMode === 'perspective' ? 'orthographic' : 'perspective'); closeMenu(); }} className={menuItemClass}><Camera className="h-4 w-4 text-violet-400" /> {state.cameraMode === 'perspective' ? 'Perspektif' : 'Ortografik (CAD)'}</button>
            </div>}
          </div>

          <div className="relative">
            <button onClick={() => setOpenMenu(openMenu === 'tools' ? null : 'tools')} className={`${menuButtonClass} border-amber-500/30 bg-amber-500/10 text-amber-200 hover:bg-amber-500/20`} title="Proje araçları" aria-expanded={openMenu === 'tools'}>
              <Wrench className="h-4 w-4 text-amber-400" /><span className="hidden sm:inline">Araçlar</span><ChevronDown className="h-3.5 w-3.5 text-amber-300/70" />
            </button>
            {openMenu === 'tools' && <div className="header-popover absolute right-0 top-full z-50 mt-2 w-[min(14rem,calc(100vw-1rem))] rounded-xl border border-slate-700 bg-slate-900/98 p-1.5 shadow-2xl backdrop-blur-xl">
              <button onClick={() => { onOpenCuttingModal(); closeMenu(); }} className={`${menuItemClass} text-amber-300`}><Scissors className="h-4 w-4 text-amber-400" /> Ebatlama & CNC</button>
              <button onClick={() => { onOpenCostModal(); closeMenu(); }} className={`${menuItemClass} text-emerald-300`}><ReceiptText className="h-4 w-4 text-emerald-400" /> Maliyet Raporu</button>
              <button onClick={() => { onExportImage(); closeMenu(); }} className={menuItemClass}><Download className="h-4 w-4" /> Görsel İndir</button>
              <button onClick={() => { onSaveProject(); closeMenu(); }} className={menuItemClass}><Save className="h-4 w-4" /> Projeyi Kaydet</button>
              <button onClick={() => { onOpenHelpModal(); closeMenu(); }} className={menuItemClass}><HelpCircle className="h-4 w-4 text-blue-400" /> Kullanım Rehberi</button>
              <button onClick={() => { toggleFullscreen(); closeMenu(); }} className={`${menuItemClass} sm:hidden`}><Maximize2 className="h-4 w-4" /> {isFullscreen ? 'Tam Ekrandan Çık' : 'Tam Ekran'}</button>
            </div>}
          </div>
          <button onClick={toggleFullscreen} className="hidden rounded-lg border border-slate-700/60 bg-slate-800/80 p-1.5 text-slate-300 transition hover:bg-slate-700 sm:flex" title={isFullscreen ? 'Tam Ekrandan Çık' : 'Tam Ekran'}>
            {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
          </button>
        </div>
      </div>
      {topControls && <div className="header-top-controls border-t border-slate-800/80 px-2 py-1.5 sm:px-4">{topControls}</div>}
    </header>
  );
};
