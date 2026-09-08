import React, { useState } from 'react';
import {
  Box,
  Plus,
  Undo2,
  Redo2,
  Eye,
  Camera,
  Layers,
  Scissors,
  ReceiptText,
  Save,
  HelpCircle,
  Maximize2,
  Minimize2,
  Compass,
  Download,
  FolderOpen,
  Sparkles,
  MoreHorizontal,
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
}

export const HeaderBar: React.FC<HeaderBarProps> = ({
  state,
  onAddCabinet,
  onUndo,
  onRedo,
  onSetRenderMode,
  onSetCameraMode,
  onSetCameraPreset,
  onOpenCuttingModal,
  onOpenCostModal,
  onOpenHelpModal,
  onSaveProject,
  onExportImage,
}) => {
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isCameraMenuOpen, setIsCameraMenuOpen] = useState(false);
  const [isMobileActionsOpen, setIsMobileActionsOpen] = useState(false);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
      setIsFullscreen(true);
    } else {
      document.exitFullscreen().catch(() => {});
      setIsFullscreen(false);
    }
  };

  return (
    <header className="fixed top-0 left-0 right-0 z-30 bg-slate-900/90 backdrop-blur-md border-b border-slate-800 text-slate-100 shadow-md select-none">
      <div className="flex items-center justify-between px-3 sm:px-4 py-2 gap-2 overflow-x-auto no-scrollbar">
        {/* Left: Brand & Project Name */}
        <div className="flex items-center gap-3 shrink-0">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-blue-600 to-indigo-500 flex items-center justify-center text-white shadow-glow">
              <Box className="w-5 h-5 stroke-[2.2]" />
            </div>
            <div className="hidden sm:block">
              <h1 className="text-sm font-bold tracking-wider text-white flex items-center gap-1.5 font-mono">
                MODUCAD <span className="text-xs bg-blue-500/20 text-blue-400 px-1.5 py-0.5 rounded font-normal">3D PRO</span>
              </h1>
              <p className="text-[10px] text-slate-400 truncate max-w-[140px] font-mono">
                {state.projectName}
              </p>
            </div>
          </div>

          <div className="h-6 w-px bg-slate-800 mx-1 hidden sm:block" />

          {/* New Cabinet Action */}
          <button
            onClick={onAddCabinet}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 active:scale-95 text-white text-xs font-semibold shadow-sm transition shrink-0"
            title="Yeni Dolap Ekle"
          >
            <Plus className="w-4 h-4" />
            <span>Dolap Ekle</span>
          </button>

          <div className="relative sm:hidden">
            <button
              onClick={() => setIsMobileActionsOpen(!isMobileActionsOpen)}
              className="p-1.5 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-300 border border-slate-700/60 transition"
              title="Diğer işlemler"
              aria-label="Diğer işlemler"
            >
              <MoreHorizontal className="w-4 h-4" />
            </button>
            {isMobileActionsOpen && (
              <div className="absolute top-full left-0 mt-2 z-50 w-52 rounded-xl border border-slate-700 bg-slate-900/95 p-1.5 shadow-2xl backdrop-blur-xl">
                <button onClick={() => { onOpenCuttingModal(); setIsMobileActionsOpen(false); }} className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-xs font-semibold text-amber-300 hover:bg-slate-800">
                  <Scissors className="h-4 w-4 text-amber-400" /> Ebatlama & CNC
                </button>
                <button onClick={() => { onOpenCostModal(); setIsMobileActionsOpen(false); }} className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-xs font-semibold text-emerald-300 hover:bg-slate-800">
                  <ReceiptText className="h-4 w-4 text-emerald-400" /> Maliyet Raporu
                </button>
                <button onClick={() => { onSaveProject(); setIsMobileActionsOpen(false); }} className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-xs font-semibold text-slate-200 hover:bg-slate-800">
                  <Save className="h-4 w-4" /> Projeyi Kaydet
                </button>
                <button onClick={() => { onOpenHelpModal(); setIsMobileActionsOpen(false); }} className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-xs font-semibold text-slate-200 hover:bg-slate-800">
                  <HelpCircle className="h-4 w-4 text-blue-400" /> Kullanım Rehberi
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Center: History & View Modes */}
        <div className="flex items-center gap-1.5 shrink-0">
          {/* Undo / Redo */}
          <div className="flex items-center bg-slate-800/80 rounded-lg p-0.5 border border-slate-700/60">
            <button
              onClick={onUndo}
              disabled={state.historyIndex <= 0}
              className="p-1.5 rounded-md hover:bg-slate-700 active:scale-95 text-slate-300 disabled:opacity-30 disabled:pointer-events-none transition"
              title="Geri Al (Ctrl+Z)"
            >
              <Undo2 className="w-4 h-4" />
            </button>
            <button
              onClick={onRedo}
              disabled={state.historyIndex >= state.history.length - 1}
              className="p-1.5 rounded-md hover:bg-slate-700 active:scale-95 text-slate-300 disabled:opacity-30 disabled:pointer-events-none transition"
              title="İleri Al (Ctrl+Y)"
            >
              <Redo2 className="w-4 h-4" />
            </button>
          </div>

          {/* Render Mode Switcher */}
          <div className="flex items-center bg-slate-800/80 rounded-lg p-0.5 border border-slate-700/60 text-xs font-medium">
            <button
              onClick={() => onSetRenderMode('sketch')}
              className={`px-2.5 py-1 rounded-md transition ${
                state.renderMode === 'sketch'
                  ? 'bg-blue-600 text-white font-semibold shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
              title="Eskiz / Çizgisel Mod"
            >
              Eskiz
            </button>
            <button
              onClick={() => onSetRenderMode('realistic')}
              className={`px-2.5 py-1 rounded-md transition ${
                state.renderMode === 'realistic'
                  ? 'bg-blue-600 text-white font-semibold shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
              title="Realistik Kaplamalı Mod"
            >
              Realistik
            </button>
            <button
              onClick={() => onSetRenderMode('unpainted')}
              className={`px-2.5 py-1 rounded-md transition ${
                state.renderMode === 'unpainted'
                  ? 'bg-blue-600 text-white font-semibold shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
              title="Boyasız / Ham Malzeme Modu"
            >
              Boyasız
            </button>
            <button
              onClick={() => onSetRenderMode('wood_textured')}
              className={`px-2.5 py-1 rounded-md transition flex items-center gap-1 ${
                state.renderMode === 'wood_textured'
                  ? 'bg-blue-600 text-white font-semibold shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
              title="Mobilya Kaplama Ahşap Doku ve Rengi (Fotogerçekçi Ahşap Modu)"
            >
              <Sparkles className="w-3 h-3 text-amber-300" />
              <span>Ahşap Kaplama</span>
            </button>
          </div>

          {/* Camera Angles Menu */}
          <div className="relative">
            <button
              onClick={() => setIsCameraMenuOpen(!isCameraMenuOpen)}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-200 border border-slate-700/60 text-xs font-medium transition"
              title="Kamera Açıları"
            >
              <Camera className="w-3.5 h-3.5 text-blue-400" />
              <span className="capitalize hidden md:inline">{state.cameraPreset}</span>
            </button>

            {isCameraMenuOpen && (
              <div
                className="absolute top-full mt-1.5 left-0 z-50 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl p-1.5 min-w-[140px] flex flex-col gap-1 animate-in fade-in"
                onClick={() => setIsCameraMenuOpen(false)}
              >
                <div className="px-2 py-1 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                  Kamera Görünümleri
                </div>
                {[
                  { id: 'iso', label: '3D İzometrik' },
                  { id: 'front', label: 'Ön Görünüş' },
                  { id: 'top', label: 'Üst (Plan)' },
                  { id: 'left', label: 'Sol Yan' },
                  { id: 'right', label: 'Sağ Yan' },
                ].map((cam) => (
                  <button
                    key={cam.id}
                    onClick={() => onSetCameraPreset(cam.id as CameraPreset)}
                    className={`text-left px-2.5 py-1.5 rounded-lg text-xs font-medium transition flex items-center justify-between ${
                      state.cameraPreset === cam.id
                        ? 'bg-blue-600 text-white'
                        : 'text-slate-300 hover:bg-slate-800'
                    }`}
                  >
                    <span>{cam.label}</span>
                  </button>
                ))}

                <div className="h-px bg-slate-800 my-1" />

                <div className="px-2 py-1 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                  Projeksiyon
                </div>
                <button
                  onClick={() =>
                    onSetCameraMode(
                      state.cameraMode === 'perspective' ? 'orthographic' : 'perspective'
                    )
                  }
                  className="text-left px-2.5 py-1.5 rounded-lg text-xs font-medium text-slate-300 hover:bg-slate-800 transition flex items-center justify-between"
                >
                  <span>{state.cameraMode === 'perspective' ? 'Perspektif' : 'Ortografik (CAD)'}</span>
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Right: Actions (Nesting, Cost, Save, Help) */}
        <div className="flex items-center gap-1.5 shrink-0">
          {/* Ebatlama & CNC */}
          <button
            onClick={onOpenCuttingModal}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/30 text-amber-300 text-xs font-semibold transition"
            title="Ebatlama & CNC Yerleşim Planı"
          >
            <Scissors className="w-3.5 h-3.5 text-amber-400" />
            <span className="hidden sm:inline">Ebatlama & CNC</span>
          </button>

          {/* Maliyet & Rapor */}
          <button
            onClick={onOpenCostModal}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/30 text-emerald-300 text-xs font-semibold transition"
            title="Maliyet ve Parça Listesi Raporu"
          >
            <ReceiptText className="w-3.5 h-3.5 text-emerald-400" />
            <span className="hidden sm:inline">Maliyet Raporu</span>
          </button>

          {/* Screenshot / Download */}
          <button
            onClick={onExportImage}
            className="p-1.5 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-300 border border-slate-700/60 transition"
            title="Görsel Olarak İndir (PNG)"
          >
            <Download className="w-4 h-4" />
          </button>

          {/* Save Project */}
          <button
            onClick={onSaveProject}
            className="p-1.5 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-300 border border-slate-700/60 transition"
            title="Projeyi Kaydet"
          >
            <Save className="w-4 h-4" />
          </button>

          {/* Help Guide */}
          <button
            onClick={onOpenHelpModal}
            className="p-1.5 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-300 border border-slate-700/60 transition"
            title="Kullanım Rehberi & Kısayollar"
          >
            <HelpCircle className="w-4 h-4 text-blue-400" />
          </button>

          {/* Fullscreen */}
          <button
            onClick={toggleFullscreen}
            className="p-1.5 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-300 border border-slate-700/60 transition hidden sm:flex"
            title={isFullscreen ? 'Tam Ekrandan Çık' : 'Tam Ekran'}
          >
            {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>
        </div>
      </div>
    </header>
  );
};
