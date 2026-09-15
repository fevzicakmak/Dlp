import React from 'react';
import { FolderMinus, Layers, Lock, Move, SquareDashed, Trash2, Unlock, ChevronLeft, ChevronRight } from 'lucide-react';

interface SceneActionsToolbarProps {
  objectCount: number;
  selectedCount: number;
  isOutlinerOpen: boolean;
  isActionsBarVisible: boolean;
  isMarqueeSelectActive: boolean;
  isCabinetMoveActive: boolean;
  isAnySelectedLocked: boolean;
  onToggleOutliner: () => void;
  onToggleActions: () => void;
  onToggleMarquee: () => void;
  onToggleCabinetMove: () => void;
  onCreateGroup: () => void;
  onUngroup: () => void;
  onToggleLock: () => void;
  onDelete: () => void;
}

export const SceneActionsToolbar: React.FC<SceneActionsToolbarProps> = ({
  objectCount,
  selectedCount,
  isOutlinerOpen,
  isActionsBarVisible,
  isMarqueeSelectActive,
  isCabinetMoveActive,
  isAnySelectedLocked,
  onToggleOutliner,
  onToggleActions,
  onToggleMarquee,
  onToggleCabinetMove,
  onCreateGroup,
  onUngroup,
  onToggleLock,
  onDelete,
}) => (
  <div className="scene-actions-toolbar flex w-full items-center gap-1.5 overflow-x-auto no-scrollbar rounded-xl border border-slate-700/80 bg-slate-900/95 p-1 shadow-2xl select-none">
    <button onClick={onToggleOutliner} className={`flex shrink-0 items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-semibold shadow-sm transition ${isOutlinerOpen ? 'bg-blue-600 text-white shadow-blue-500/20' : 'border border-slate-700/60 bg-slate-800/90 text-slate-200 hover:bg-slate-700 hover:text-white'}`} title="Sahne Hiyerarşisi & Parça Listesi (Aç/Kapat)">
      <Layers className="h-4 w-4 text-blue-400" />
      <span className="hidden sm:inline">Sahne Hiyerarşisi</span>
      <span className="sm:hidden">Hiyerarşi</span>
      <span className="rounded-full bg-slate-950/60 px-1.5 py-0.5 text-[10px] font-bold text-slate-300">{objectCount}</span>
    </button>

    <div className="h-5 w-px shrink-0 bg-slate-700/80" />

    <button onClick={onToggleActions} className={`flex shrink-0 items-center gap-1 rounded-xl px-2 py-2 text-xs font-semibold transition ${isActionsBarVisible ? 'text-slate-400 hover:bg-slate-800 hover:text-white' : 'border border-amber-500/30 bg-amber-500/10 text-amber-400 hover:bg-amber-500/20'}`} title={isActionsBarVisible ? 'İşlemler Butonlarını Gizle' : 'İşlemler Butonlarını Göster'}>
      {isActionsBarVisible ? <ChevronLeft className="h-4 w-4" /> : <><ChevronRight className="h-4 w-4" /><span className="hidden xs:inline text-[11px] font-medium">İşlemler</span></>}
    </button>

    {isActionsBarVisible && <div className="flex shrink-0 items-center gap-1 animate-in fade-in duration-150">
      <button onClick={onToggleMarquee} className={`flex shrink-0 items-center gap-1.5 rounded-xl px-2.5 py-2 text-xs font-medium transition ${isMarqueeSelectActive ? 'border border-cyan-400 bg-cyan-600 text-white shadow-glow ring-2 ring-cyan-400/50 animate-pulse' : 'border border-slate-700/60 bg-slate-800/90 text-slate-200 hover:bg-slate-700 hover:text-white'}`} title="Toplu Seç: Ekranda sürükleyerek çerçeve ile çoklu parça seçin">
        <SquareDashed className={`h-4 w-4 ${isMarqueeSelectActive ? 'text-white' : 'text-cyan-400'}`} /><span className="hidden md:inline">{isMarqueeSelectActive ? 'Seçim Açık' : 'Toplu Seç'}</span>
      </button>
      <button onClick={onToggleCabinetMove} className={`flex shrink-0 items-center gap-1.5 rounded-xl px-2.5 py-2 text-xs font-medium transition ${isCabinetMoveActive ? 'border border-emerald-400 bg-emerald-600 text-white shadow-glow ring-2 ring-emerald-400/50 animate-pulse' : 'border border-slate-700/60 bg-slate-800/90 text-slate-200 hover:bg-slate-700 hover:text-white'}`} title="Dolap Taşı: Sahnedeki bir dolaba dokunup tüm hiyerarşisini sürükleyerek taşıyın">
        <Move className={`h-4 w-4 ${isCabinetMoveActive ? 'text-white' : 'text-emerald-400'}`} /><span className="hidden md:inline">{isCabinetMoveActive ? 'Taşıma Açık' : 'Dolap Taşı'}</span>
      </button>
      <button onClick={onCreateGroup} disabled={selectedCount < 2} className={`flex shrink-0 items-center gap-1.5 rounded-xl border px-2.5 py-2 text-xs font-medium transition ${selectedCount > 1 ? 'border-indigo-400/60 bg-indigo-600 text-white shadow-md' : 'border-slate-700/40 bg-slate-800/50 text-slate-400 opacity-30'}`} title="Seçili Parçaları Grup Yap">
        <Layers className="h-4 w-4" /><span className="hidden md:inline">Grup Yap</span>
      </button>
      <button onClick={onUngroup} disabled={!selectedCount} className="flex shrink-0 items-center gap-1.5 rounded-xl border border-slate-700/60 bg-slate-800/90 px-2.5 py-2 text-xs font-medium text-slate-200 transition hover:bg-slate-700 hover:text-white disabled:pointer-events-none disabled:opacity-30" title="Seçili Grubu Dağıt">
        <FolderMinus className="h-4 w-4 text-slate-400" /><span className="hidden md:inline">Grup Çöz</span>
      </button>
      <button onClick={onToggleLock} disabled={!selectedCount} className="flex shrink-0 items-center gap-1.5 rounded-xl border border-slate-700/60 bg-slate-800/90 px-2.5 py-2 text-xs font-medium text-slate-200 transition hover:bg-slate-700 hover:text-white disabled:pointer-events-none disabled:opacity-30" title={isAnySelectedLocked ? 'Seçili Parçaların Kilidini Aç' : 'Seçili Parçaları Kilitle'}>
        {isAnySelectedLocked ? <Unlock className="h-4 w-4 text-amber-400" /> : <Lock className="h-4 w-4 text-amber-400" />}<span className="hidden md:inline">{isAnySelectedLocked ? 'Kilit Aç' : 'Kilitle'}</span>
      </button>
      <button onClick={onDelete} disabled={!selectedCount} className="flex shrink-0 items-center gap-1.5 rounded-xl border border-red-500/30 bg-red-500/15 px-2.5 py-2 text-xs font-medium text-red-300 transition hover:bg-red-600 hover:text-white disabled:pointer-events-none disabled:opacity-30" title="Seçili Parçaları Sil (Del)">
        <Trash2 className="h-4 w-4 text-red-400" /><span className="hidden md:inline">Sil</span>
      </button>
    </div>}
  </div>
);
