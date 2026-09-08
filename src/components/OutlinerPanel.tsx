import React, { useState } from 'react';
import {
  Layers,
  Box,
  Eye,
  EyeOff,
  Lock,
  Unlock,
  Trash2,
  ChevronRight,
  ChevronDown,
  Folder,
  FolderOpen,
  PanelLeft,
  X,
} from 'lucide-react';
import { SceneObject } from '../types/cad';

interface OutlinerPanelProps {
  objects: SceneObject[];
  selectedIds: string[];
  onSelectObject: (id: string, isMulti: boolean) => void;
  onToggleLock: (id: string) => void;
  onToggleVisibility: (id: string) => void;
  onDeleteObject: (id: string) => void;
  onClose: () => void;
}

export const OutlinerPanel: React.FC<OutlinerPanelProps> = ({
  objects,
  selectedIds,
  onSelectObject,
  onToggleLock,
  onToggleVisibility,
  onDeleteObject,
  onClose,
}) => {
  const [collapsedCabinets, setCollapsedCabinets] = useState<Set<string>>(new Set());

  const toggleCabinetCollapse = (cabId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const next = new Set(collapsedCabinets);
    if (next.has(cabId)) {
      next.delete(cabId);
    } else {
      next.add(cabId);
    }
    setCollapsedCabinets(next);
  };

  // Group objects by cabinet or root architectural
  const cabinets = objects.filter((o) => o.type === 'cabinet');
  const standaloneObjects = objects.filter((o) => !o.parentId && o.type !== 'cabinet');

  return (
    <aside className="cad-mobile-panel fixed top-14 left-2 sm:left-4 z-20 bg-slate-900/95 backdrop-blur-md border border-slate-700/80 rounded-2xl shadow-2xl flex flex-col max-h-[82vh] overflow-hidden select-none">
      {/* Header */}
      <div className="p-3.5 bg-slate-800/80 border-b border-slate-700/80 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Layers className="w-4 h-4 text-blue-400" />
          <h2 className="text-xs font-bold text-white uppercase tracking-wider">
            Sahne Hiyerarşisi ({objects.length})
          </h2>
        </div>
        <button
          onClick={onClose}
          className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-700"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Tree View */}
      <div className="p-2 space-y-1 overflow-y-auto flex-1 text-xs">
        {cabinets.map((cab) => {
          const isCollapsed = collapsedCabinets.has(cab.id);
          const isSelected = selectedIds.includes(cab.id);
          const childParts = objects.filter((o) => o.parentId === cab.id);

          return (
            <div key={cab.id} className="rounded-xl overflow-hidden bg-slate-800/40 border border-slate-800">
              {/* Cabinet Root Row */}
              <div
                onClick={(e) => onSelectObject(cab.id, e.shiftKey || e.ctrlKey || e.metaKey)}
                className={`flex items-center justify-between p-2 cursor-pointer transition ${
                  isSelected ? 'bg-blue-600/30 text-white font-semibold' : 'hover:bg-slate-800/80 text-slate-200'
                }`}
              >
                <div className="flex items-center gap-1.5 overflow-hidden">
                  <button
                    onClick={(e) => toggleCabinetCollapse(cab.id, e)}
                    className="p-0.5 text-slate-400 hover:text-white"
                  >
                    {isCollapsed ? (
                      <ChevronRight className="w-3.5 h-3.5" />
                    ) : (
                      <ChevronDown className="w-3.5 h-3.5" />
                    )}
                  </button>
                  <Box className="w-4 h-4 text-blue-400 shrink-0" />
                  <span className="truncate">{cab.name}</span>
                </div>

                <div className="flex items-center gap-1 shrink-0">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onToggleVisibility(cab.id);
                    }}
                    className="p-1 text-slate-400 hover:text-white"
                  >
                    {cab.visible ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5 text-slate-600" />}
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onToggleLock(cab.id);
                    }}
                    className="p-1 text-slate-400 hover:text-white"
                  >
                    {cab.locked ? <Lock className="w-3.5 h-3.5 text-amber-400" /> : <Unlock className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>

              {/* Child Parts Tree */}
              {!isCollapsed && (
                <div className="pl-6 pr-2 py-1 space-y-0.5 border-t border-slate-800/60 bg-slate-900/30">
                  {childParts.map((part) => {
                    const isPartSelected = selectedIds.includes(part.id);
                    return (
                      <div
                        key={part.id}
                        onClick={(e) => onSelectObject(part.id, e.shiftKey || e.ctrlKey || e.metaKey)}
                        className={`flex items-center justify-between py-1 px-2 rounded-lg cursor-pointer transition text-[11px] ${
                          isPartSelected
                            ? 'bg-blue-600 text-white font-semibold'
                            : 'hover:bg-slate-800/80 text-slate-300'
                        }`}
                      >
                        <div className="flex items-center gap-1.5 truncate">
                          <span className="w-1.5 h-1.5 rounded-full bg-slate-500 shrink-0" />
                          <span className="truncate">{part.name}</span>
                        </div>

                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onToggleVisibility(part.id);
                            }}
                            className="p-0.5 text-slate-400 hover:text-white"
                          >
                            {part.visible ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3 text-slate-600" />}
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onToggleLock(part.id);
                            }}
                            className="p-0.5 text-slate-400 hover:text-white"
                          >
                            {part.locked ? <Lock className="w-3 h-3 text-amber-400" /> : <Unlock className="w-3 h-3" />}
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onDeleteObject(part.id);
                            }}
                            className="p-0.5 text-slate-500 hover:text-red-400"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}

        {/* Standalone Architectural / Other items */}
        {standaloneObjects.length > 0 && (
          <div className="pt-2">
            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider px-2 mb-1">
              Mimari Elemanlar
            </div>
            {standaloneObjects.map((obj) => {
              const isSelected = selectedIds.includes(obj.id);
              return (
                <div
                  key={obj.id}
                  onClick={(e) => onSelectObject(obj.id, e.shiftKey || e.ctrlKey || e.metaKey)}
                  className={`flex items-center justify-between p-2 rounded-xl cursor-pointer transition ${
                    isSelected ? 'bg-blue-600 text-white font-semibold' : 'hover:bg-slate-800/80 text-slate-300 bg-slate-850'
                  }`}
                >
                  <div className="flex items-center gap-1.5 truncate">
                    <span className="truncate">{obj.name}</span>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onToggleLock(obj.id);
                      }}
                      className="p-1 text-slate-400 hover:text-white"
                    >
                      {obj.locked ? <Lock className="w-3.5 h-3.5 text-amber-400" /> : <Unlock className="w-3.5 h-3.5" />}
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onDeleteObject(obj.id);
                      }}
                      className="p-1 text-slate-500 hover:text-red-400"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </aside>
  );
};
