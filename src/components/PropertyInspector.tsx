import React, { useState } from 'react';
import {
  Sliders,
  Maximize,
  Move,
  RotateCw,
  Palette,
  Shield,
  Layers,
  Sparkles,
  ChevronRight,
  ChevronLeft,
  Lock,
  Unlock,
  Calculator,
  Square,
  CheckSquare,
  Plus,
  Minus,
  Rows,
  Columns,
  Archive,
  DoorClosed,
  Box,
  Building,
} from 'lucide-react';
import { SceneObject, MaterialConfig, EdgeBanding } from '../types/cad';
import { DEFAULT_MATERIALS } from '../constants/materials';

interface PropertyInspectorProps {
  selectedObjects: SceneObject[];
  onUpdateObject: (id: string, partial: Partial<SceneObject>) => void;
  onUpdateBatch: (partial: Partial<SceneObject>) => void;
  onOpenKeypad: (title: string, value: number, onConfirm: (v: number) => void, min?: number, max?: number, unit?: string) => void;
  onAddDrawerTopPanel?: (drawerId: string) => void;
  onClose: () => void;
}

interface SliderControlProps {
  label: string;
  icon?: React.ReactNode;
  value: number;
  min: number;
  max: number;
  step?: number;
  unit?: string;
  onChange: (val: number) => void;
  onOpenKeypad?: () => void;
  quickDeltas?: number[];
}

const SliderControl: React.FC<SliderControlProps> = ({
  label,
  icon,
  value,
  min,
  max,
  step = 1,
  unit = 'mm',
  onChange,
  onOpenKeypad,
  quickDeltas = [-10, 10],
}) => {
  const clampedValue = Math.max(min, Math.min(max, value));

  return (
    <div className="bg-slate-800/50 p-2.5 rounded-xl border border-slate-700/60 space-y-1.5 transition hover:border-slate-600">
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-1.5 text-slate-300 font-semibold text-xs">
          {icon}
          <span>{label}</span>
        </div>

        <div className="flex items-center gap-1">
          {quickDeltas.map((delta) => (
            <button
              key={delta}
              type="button"
              onClick={() => onChange(Math.max(min, Math.min(max, value + delta)))}
              className="px-1.5 py-0.5 rounded bg-slate-700/80 hover:bg-slate-600 active:scale-95 text-slate-300 text-[10px] font-mono"
              title={`${delta > 0 ? '+' : ''}${delta}${unit}`}
            >
              {delta > 0 ? `+${delta}` : delta}
            </button>
          ))}

          {onOpenKeypad && (
            <button
              type="button"
              onClick={onOpenKeypad}
              className="flex items-center gap-1 text-blue-400 bg-blue-500/10 hover:bg-blue-500/20 active:scale-95 px-2 py-0.5 rounded font-mono font-bold text-xs transition border border-blue-500/30 ml-1"
              title="Tuş Takımı ile Değer Gir"
            >
              <Calculator className="w-3 h-3" />
              <span>{value} {unit}</span>
            </button>
          )}

          {!onOpenKeypad && (
            <span className="font-mono font-bold text-blue-400 text-xs px-1.5 py-0.5 bg-blue-500/10 rounded">
              {value} {unit}
            </span>
          )}
        </div>
      </div>

      <div className="space-y-1">
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={clampedValue}
          onChange={(e) => onChange(Number(e.target.value))}
          className="w-full cursor-pointer accent-blue-500"
        />
        <div className="flex justify-between text-[10px] text-slate-500 font-mono">
          <span>{min}{unit}</span>
          <span>{Math.round((min + max) / 2)}{unit}</span>
          <span>{max}{unit}</span>
        </div>
      </div>
    </div>
  );
};

export const PropertyInspector: React.FC<PropertyInspectorProps> = ({
  selectedObjects,
  onUpdateObject,
  onUpdateBatch,
  onOpenKeypad,
  onAddDrawerTopPanel,
  onClose,
}) => {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [activeSection, setActiveSection] = useState<'dims' | 'pos' | 'mat' | 'extra'>('dims');

  if (selectedObjects.length === 0) return null;

  const isMulti = selectedObjects.length > 1;
  const primary = selectedObjects[0];

  const isShelf = primary.type === 'shelf' || primary.role === 'shelf' || primary.name.toLowerCase().includes('raf');
  const isDivider = primary.type === 'divider' || primary.role === 'divider' || primary.name.toLowerCase().includes('dikme');
  const isDrawer = primary.type === 'drawer' || primary.role === 'drawer_front' || primary.role === 'drawer_body' || primary.name.toLowerCase().includes('çekmece');
  const isDoor = primary.type === 'door' || primary.role === 'door_leaf' || primary.name.toLowerCase().includes('kapak');
  const isCabinet = primary.type === 'cabinet';
  const isPlinthOrLeg = primary.type === 'plinth' || primary.type === 'leg' || primary.role === 'plinth' || primary.role === 'leg';
  const isArch = ['wall', 'column', 'beam', 'window', 'room_door'].includes(primary.type);

  const handleDimChange = (dim: 'width' | 'height' | 'depth' | 'thickness', val: number) => {
    if (isMulti) {
      onUpdateBatch({
        dimensions: { ...primary.dimensions, [dim]: val },
      });
    } else {
      onUpdateObject(primary.id, {
        dimensions: { ...primary.dimensions, [dim]: val },
      });
    }
  };

  const handlePosChange = (axis: 'x' | 'y' | 'z', val: number) => {
    if (isMulti) {
      onUpdateBatch({
        position: { ...primary.position, [axis]: val },
      });
    } else {
      onUpdateObject(primary.id, {
        position: { ...primary.position, [axis]: val },
      });
    }
  };

  const handleRotChange = (axis: 'x' | 'y' | 'z', val: number) => {
    if (isMulti) {
      onUpdateBatch({
        rotation: { ...primary.rotation, [axis]: val },
      });
    } else {
      onUpdateObject(primary.id, {
        rotation: { ...primary.rotation, [axis]: val },
      });
    }
  };

  const handleMaterialSelect = (mat: MaterialConfig) => {
    if (isMulti) {
      onUpdateBatch({ material: mat });
    } else {
      onUpdateObject(primary.id, { material: mat });
    }
  };

  const handleEdgeBandToggle = (side: keyof EdgeBanding) => {
    const current = primary.edgeBanding ?? { top: true, bottom: true, left: true, right: true, thicknessMm: 0.8 };
    const updated = { ...current, [side]: !current[side] };
    if (isMulti) {
      onUpdateBatch({ edgeBanding: updated });
    } else {
      onUpdateObject(primary.id, { edgeBanding: updated });
    }
  };

  const handleDoorAngleChange = (angle: number) => {
    const currentDoor = primary.metadata?.door;
    if (!currentDoor) return;
    onUpdateObject(primary.id, {
      metadata: {
        ...primary.metadata,
        door: {
          ...currentDoor,
          isOpen: angle > 0,
          openAngle: angle,
        },
      },
    });
  };

  const handleDoorHandlePositionChange = (pos: 'top' | 'middle' | 'bottom') => {
    const currentDoor = primary.metadata?.door;
    if (!currentDoor) return;
    onUpdateObject(primary.id, {
      metadata: {
        ...primary.metadata,
        door: {
          ...currentDoor,
          handlePosition: pos,
        },
      },
    });
  };

  const handleDoorHandleOffsetChange = (axis: 'x' | 'y', value: number) => {
    const currentDoor = primary.metadata?.door;
    if (!currentDoor) return;
    onUpdateObject(primary.id, {
      metadata: {
        ...primary.metadata,
        door: {
          ...currentDoor,
          [axis === 'x' ? 'handleOffsetX' : 'handleOffsetY']: value,
        },
      },
    });
  };

  const handleDrawerExtensionChange = (ext: number) => {
    const currentDrawer = primary.metadata?.drawer;
    if (!currentDrawer) return;
    onUpdateObject(primary.id, {
      metadata: {
        ...primary.metadata,
        drawer: {
          ...currentDrawer,
          extensionMm: ext,
        },
      },
    });
  };

  const getRoleIcon = () => {
    if (isShelf) return <Rows className="w-4 h-4 text-blue-400" />;
    if (isDivider) return <Columns className="w-4 h-4 text-indigo-400" />;
    if (isDrawer) return <Archive className="w-4 h-4 text-amber-400" />;
    if (isDoor) return <DoorClosed className="w-4 h-4 text-emerald-400" />;
    if (isCabinet) return <Box className="w-4 h-4 text-cyan-400" />;
    if (isArch) return <Building className="w-4 h-4 text-sky-400" />;
    return <Layers className="w-4 h-4 text-blue-400" />;
  };

  return (
    <aside
      className={`cad-mobile-panel fixed top-14 right-2 sm:right-4 z-40 sm:w-92 bg-slate-900/95 backdrop-blur-md border border-slate-700/80 rounded-2xl shadow-2xl flex flex-col max-h-[84vh] overflow-hidden select-none transition-all duration-300 ${
        isCollapsed ? 'translate-x-[calc(100%+1rem)]' : 'translate-x-0'
      }`}
    >
      {/* Collapse Tab Button */}
      <button
        onClick={() => setIsCollapsed(!isCollapsed)}
        className="absolute -left-8 top-4 bg-slate-900/90 border border-r-0 border-slate-700 text-slate-300 p-1.5 rounded-l-xl shadow-lg hover:text-white"
        title={isCollapsed ? 'Özellik Panelini Aç' : 'Gizle'}
      >
        {isCollapsed ? <ChevronLeft className="w-5 h-5" /> : <ChevronRight className="w-5 h-5" />}
      </button>

      {/* Header */}
      <div className="p-3.5 bg-slate-800/90 border-b border-slate-700/80 flex items-center justify-between">
        <div className="flex items-center gap-2.5 overflow-hidden">
          <div className="p-2 rounded-xl bg-slate-700/80 border border-slate-600 shrink-0">
            {getRoleIcon()}
          </div>
          <div className="overflow-hidden">
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] font-bold text-blue-400 font-mono uppercase tracking-wider">
                {isMulti ? `Çoklu Seçim (${selectedObjects.length})` : primary.type.toUpperCase()}
              </span>
              {primary.locked && <Lock className="w-3.5 h-3.5 text-amber-400" />}
            </div>
            <h2 className="text-sm font-semibold text-white truncate max-w-[190px]">
              {isMulti ? 'Toplu Nesne Düzenleme' : primary.name}
            </h2>
          </div>
        </div>

        <button
          onClick={onClose}
          className="text-xs px-2.5 py-1.5 rounded-lg bg-slate-700/80 hover:bg-slate-600 text-slate-200 active:scale-95 transition"
        >
          Kapat
        </button>
      </div>

      {/* Navigation Tabs */}
      <div className="flex border-b border-slate-800 bg-slate-950/60 p-1 text-xs">
        <button
          onClick={() => setActiveSection('dims')}
          className={`flex-1 py-1.5 rounded-md font-semibold transition ${
            activeSection === 'dims' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          Boyutlar
        </button>
        <button
          onClick={() => setActiveSection('pos')}
          className={`flex-1 py-1.5 rounded-md font-semibold transition ${
            activeSection === 'pos' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          Konum
        </button>
        <button
          onClick={() => setActiveSection('mat')}
          className={`flex-1 py-1.5 rounded-md font-semibold transition ${
            activeSection === 'mat' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          Malzeme
        </button>
        {(primary.type === 'door' || primary.type === 'drawer' || primary.metadata?.door || primary.metadata?.drawer) && (
          <button
            onClick={() => setActiveSection('extra')}
            className={`flex-1 py-1.5 rounded-md font-semibold transition ${
              activeSection === 'extra' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Mekanizma
          </button>
        )}
      </div>

      {/* Body Content */}
      <div className="p-3.5 space-y-3 overflow-y-auto flex-1 text-xs">
        {/* ===================== DIMENSIONS SECTION (ALL SLIDER BARS) ===================== */}
        {activeSection === 'dims' && (
          <div className="space-y-3">
            {/* Shelf Specialized Dimension Sliders */}
            {isShelf && (
              <div className="p-2 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-300 text-[11px] flex items-center gap-1.5">
                <Rows className="w-4 h-4 shrink-0" />
                <span>Yatay Raf Boyut ve Seviye Ayar Çubukları</span>
              </div>
            )}

            {/* Divider Specialized Dimension Sliders */}
            {isDivider && (
              <div className="p-2 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 text-[11px] flex items-center gap-1.5">
                <Columns className="w-4 h-4 shrink-0" />
                <span>Dikey Dikme / Bölücü Boyut ve Konum Çubukları</span>
              </div>
            )}

            {/* Drawer Specialized Dimension Sliders */}
            {isDrawer && (
              <div className="p-2 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-300 text-[11px] flex items-center gap-1.5">
                <Archive className="w-4 h-4 shrink-0" />
                <span>Çekmece Kasa ve Kapak Ölçü Çubukları</span>
              </div>
            )}

            {/* Door Specialized Dimension Sliders */}
            {isDoor && (
              <div className="p-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-[11px] flex items-center gap-1.5">
                <DoorClosed className="w-4 h-4 shrink-0" />
                <span>Dolap Kapağı Ölçü ve Açı Çubukları</span>
              </div>
            )}

            {/* Cabinet Specialized Dimension Sliders */}
            {isCabinet && (
              <div className="p-2 rounded-xl bg-cyan-500/10 border border-cyan-500/20 text-cyan-300 text-[11px] flex items-center gap-1.5">
                <Box className="w-4 h-4 shrink-0" />
                <span>Modüler Dolap Ana Gövde Ölçü Çubukları</span>
              </div>
            )}

            {/* 1. Genişlik (Width Slider Bar) */}
            <SliderControl
              label={isDivider ? 'Dikme Kalınlığı (X)' : isCabinet ? 'Toplam Dolap Genişliği' : isShelf ? 'Raf Genişliği (En)' : 'Genişlik (X)'}
              value={primary.dimensions.width}
              min={isDivider ? 8 : 50}
              max={isDivider ? 50 : isCabinet ? 3000 : 2500}
              step={isDivider ? 1 : 10}
              onChange={(v) => handleDimChange('width', v)}
              onOpenKeypad={() =>
                onOpenKeypad(
                  `${primary.name} Genişlik`,
                  primary.dimensions.width,
                  (v) => handleDimChange('width', v),
                  isDivider ? 8 : 50,
                  3000
                )
              }
            />

            {/* 2. Yükseklik (Height Slider Bar) */}
            <SliderControl
              label={isShelf ? 'Raf Panel Kalınlığı (Y)' : isCabinet ? 'Toplam Dolap Yüksekliği' : isDrawer ? 'Çekmece Ön Yüksekliği' : 'Yükseklik (Y)'}
              value={primary.dimensions.height}
              min={isShelf ? 8 : 18}
              max={isShelf ? 50 : isCabinet ? 3000 : 2800}
              step={isShelf ? 1 : 10}
              onChange={(v) => handleDimChange('height', v)}
              onOpenKeypad={() =>
                onOpenKeypad(
                  `${primary.name} Yükseklik`,
                  primary.dimensions.height,
                  (v) => handleDimChange('height', v),
                  isShelf ? 8 : 18,
                  3000
                )
              }
            />

            {/* 3. Derinlik (Depth Slider Bar) */}
            <SliderControl
              label={isCabinet ? 'Toplam Dolap Derinliği' : isShelf ? 'Raf Derinliği' : 'Derinlik (Z)'}
              value={primary.dimensions.depth}
              min={50}
              max={isCabinet ? 1200 : 1000}
              step={10}
              onChange={(v) => handleDimChange('depth', v)}
              onOpenKeypad={() =>
                onOpenKeypad(
                  `${primary.name} Derinlik`,
                  primary.dimensions.depth,
                  (v) => handleDimChange('depth', v),
                  50,
                  1500
                )
              }
            />

            {/* 4. Panel Kalınlığı Slider Bar (Thickness) */}
            <div className="bg-slate-800/50 p-2.5 rounded-xl border border-slate-700/60 space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-slate-300 font-semibold text-xs">Panel Kalınlığı</span>
                <span className="font-mono font-bold text-blue-400 text-xs px-2 py-0.5 bg-blue-500/10 rounded">
                  {primary.dimensions.thickness} mm
                </span>
              </div>
              <input
                type="range"
                min={6}
                max={40}
                step={1}
                value={primary.dimensions.thickness}
                onChange={(e) => handleDimChange('thickness', Number(e.target.value))}
                className="w-full cursor-pointer accent-blue-500"
              />
              <div className="grid grid-cols-5 gap-1 pt-1">
                {[8, 12, 18, 22, 25].map((th) => (
                  <button
                    key={th}
                    type="button"
                    onClick={() => handleDimChange('thickness', th)}
                    className={`py-1 rounded text-[11px] font-mono font-semibold transition ${
                      primary.dimensions.thickness === th
                        ? 'bg-blue-600 text-white shadow-sm'
                        : 'bg-slate-700/60 text-slate-300 hover:bg-slate-700'
                    }`}
                  >
                    {th}mm
                  </button>
                ))}
              </div>
            </div>

            {/* Shelf Vertical Level Adjustment (Raf Yükseklik Seviyesi Slider) */}
            {isShelf && (
              <SliderControl
                label="Raf Seviyesi / Y Konumu (Dolap İçi)"
                value={primary.position.y}
                min={50}
                max={2500}
                step={10}
                onChange={(v) => handlePosChange('y', v)}
                onOpenKeypad={() =>
                  onOpenKeypad(
                    'Raf Yükseklik Seviyesi',
                    primary.position.y,
                    (v) => handlePosChange('y', v),
                    50,
                    2500
                  )
                }
              />
            )}

            {/* Divider Horizontal Placement Slider (Dikme X Konumu Slider) */}
            {isDivider && (
              <SliderControl
                label="Dikme Konumu / X Ekseni (Bölme Ayarı)"
                value={primary.position.x}
                min={-1500}
                max={1500}
                step={10}
                onChange={(v) => handlePosChange('x', v)}
                onOpenKeypad={() =>
                  onOpenKeypad(
                    'Dikme X Konumu',
                    primary.position.x,
                    (v) => handlePosChange('x', v),
                    -1500,
                    1500
                  )
                }
              />
            )}

            {/* Edge Banding (PVC Kenar Bantları) */}
            {primary.edgeBanding && (
              <div className="pt-2 border-t border-slate-800">
                <label className="font-semibold text-slate-300 block mb-1.5 text-xs">
                  Kenar Bantları (PVC 0.8mm)
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {(['top', 'bottom', 'left', 'right'] as const).map((side) => {
                    const label = side === 'top' ? 'Üst' : side === 'bottom' ? 'Alt' : side === 'left' ? 'Sol' : 'Sağ';
                    const active = primary.edgeBanding?.[side];
                    return (
                      <button
                        key={side}
                        type="button"
                        onClick={() => handleEdgeBandToggle(side)}
                        className={`flex items-center justify-between px-2.5 py-1.5 rounded-lg border transition ${
                          active
                            ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300'
                            : 'bg-slate-800/80 border-slate-700 text-slate-400'
                        }`}
                      >
                        <span>{label} Kenar</span>
                        {active ? <CheckSquare className="w-4 h-4 text-emerald-400" /> : <Square className="w-4 h-4" />}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ===================== POSITION SECTION (ALL SLIDER BARS) ===================== */}
        {activeSection === 'pos' && (
          <div className="space-y-3">
            {/* Position X Slider */}
            <SliderControl
              label="Konum X (Sağ / Sol)"
              value={primary.position.x}
              min={-3000}
              max={3000}
              step={10}
              onChange={(v) => handlePosChange('x', v)}
              onOpenKeypad={() =>
                onOpenKeypad(
                  'Konum X (mm)',
                  primary.position.x,
                  (v) => handlePosChange('x', v),
                  -5000,
                  5000
                )
              }
            />

            {/* Position Y Slider */}
            <SliderControl
              label="Konum Y (Yükseklik)"
              value={primary.position.y}
              min={0}
              max={3000}
              step={10}
              onChange={(v) => handlePosChange('y', v)}
              onOpenKeypad={() =>
                onOpenKeypad(
                  'Konum Y (mm)',
                  primary.position.y,
                  (v) => handlePosChange('y', v),
                  0,
                  5000
                )
              }
            />

            {/* Position Z Slider */}
            <SliderControl
              label="Konum Z (İleri / Geri)"
              value={primary.position.z}
              min={-3000}
              max={3000}
              step={10}
              onChange={(v) => handlePosChange('z', v)}
              onOpenKeypad={() =>
                onOpenKeypad(
                  'Konum Z (mm)',
                  primary.position.z,
                  (v) => handlePosChange('z', v),
                  -5000,
                  5000
                )
              }
            />

            {/* Rotation Sliders */}
            <div className="pt-2 border-t border-slate-800 space-y-2">
              <label className="font-semibold text-slate-300 block text-xs">Döndürme / Rotasyon Açısı</label>
              <SliderControl
                label="Y Ekseni Dönüşü"
                value={primary.rotation.y || 0}
                min={0}
                max={360}
                step={15}
                unit="°"
                quickDeltas={[-90, 90]}
                onChange={(v) => handleRotChange('y', v)}
              />

              <div className="grid grid-cols-3 gap-1.5 pt-1">
                {[
                  { label: '0° Sıfırla', deg: 0 },
                  { label: '90° Döndür', deg: 90 },
                  { label: '180° Ters', deg: 180 },
                ].map((item) => (
                  <button
                    key={item.label}
                    type="button"
                    onClick={() => handleRotChange('y', item.deg)}
                    className="py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 font-medium text-xs active:scale-95 transition"
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ===================== MATERIAL SECTION ===================== */}
        {activeSection === 'mat' && (
          <div className="space-y-3">
            <p className="text-slate-400 font-medium">Mobilya Malzeme Kataloğu</p>
            <div className="grid grid-cols-2 gap-2">
              {DEFAULT_MATERIALS.map((mat) => {
                const isSelected = primary.material.id === mat.id;
                return (
                  <button
                    key={mat.id}
                    type="button"
                    onClick={() => handleMaterialSelect(mat)}
                    className={`flex items-center gap-2.5 p-2 rounded-xl border text-left transition ${
                      isSelected
                        ? 'bg-blue-600/20 border-blue-500 text-white shadow-sm'
                        : 'bg-slate-800/80 border-slate-700 text-slate-300 hover:bg-slate-700/80'
                    }`}
                  >
                    <div
                      className="w-6 h-6 rounded-lg shrink-0 border border-slate-600 shadow-inner"
                      style={{ backgroundColor: mat.color }}
                    />
                    <div className="overflow-hidden">
                      <div className="font-semibold truncate">{mat.name}</div>
                      <div className="text-[10px] text-slate-400">{mat.unitPricePerM2} ₺/m²</div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* ===================== MECHANISM SECTION (SLIDER BARS) ===================== */}
        {activeSection === 'extra' && (
          <div className="space-y-4">
            {(primary.type === 'door' || primary.metadata?.door) && (
              <div className="space-y-3">
                <SliderControl
                  label="Kapak Açılma Açısı"
                  value={primary.metadata?.door?.openAngle || 0}
                  min={0}
                  max={95}
                  step={5}
                  unit="°"
                  quickDeltas={[-45, 45]}
                  onChange={(v) => handleDoorAngleChange(v)}
                />
                <div className="flex justify-between gap-2">
                  <button
                    type="button"
                    onClick={() => handleDoorAngleChange(0)}
                    className="flex-1 py-1.5 bg-slate-800 hover:bg-slate-700 rounded-lg text-slate-300 font-medium active:scale-95 transition"
                  >
                    Kapat (0°)
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDoorAngleChange(90)}
                    className="flex-1 py-1.5 bg-blue-600 hover:bg-blue-500 rounded-lg text-white font-medium active:scale-95 transition"
                  >
                    Tam Aç (90°)
                  </button>
                </div>

                {/* Handle Position */}
                <div className="pt-2 border-t border-slate-800">
                  <label className="text-[11px] font-semibold text-slate-300 block mb-1.5">
                    Kulp Konumu
                  </label>
                  <div className="grid grid-cols-3 gap-1.5">
                    {(['top', 'middle', 'bottom'] as const).map((pos) => {
                      const isActive = (primary.metadata?.door?.handlePosition || 'middle') === pos;
                      const label = pos === 'top' ? 'Üst' : pos === 'middle' ? 'Orta' : 'Alt';
                      return (
                        <button
                          key={pos}
                          type="button"
                          onClick={() => handleDoorHandlePositionChange(pos)}
                          className={`py-1.5 px-2 rounded-lg font-medium border text-[11px] transition ${
                            isActive
                              ? 'bg-blue-600 border-blue-500 text-white'
                              : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-slate-200 hover:bg-slate-700'
                          }`}
                        >
                          {label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="pt-2 border-t border-slate-800 space-y-3">
                  <SliderControl
                    label="Kulp Sağa / Sola"
                    value={primary.metadata?.door?.handleOffsetX || 0}
                    min={-Math.max(0, primary.dimensions.width / 2 - 50)}
                    max={Math.max(0, primary.dimensions.width / 2 - 50)}
                    step={5}
                    unit=" mm"
                    onChange={(v) => handleDoorHandleOffsetChange('x', v)}
                  />
                  <SliderControl
                    label="Kulp Yukarı / Aşağı"
                    value={primary.metadata?.door?.handleOffsetY || 0}
                    min={-Math.max(0, primary.dimensions.height / 2 - 50)}
                    max={Math.max(0, primary.dimensions.height / 2 - 50)}
                    step={5}
                    unit=" mm"
                    onChange={(v) => handleDoorHandleOffsetChange('y', v)}
                  />
                </div>
              </div>
            )}

            {(primary.type === 'drawer' || primary.metadata?.drawer) && (
              <div className="space-y-3">
                {/* Drawer Inner / Outer Placement Toggle */}
                <div className="p-2 bg-slate-800/80 rounded-xl border border-slate-700">
                  <label className="text-[11px] font-semibold text-slate-300 block mb-1.5">
                    Çekmece Tipi (İç / Dış)
                  </label>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        const isInner = primary.metadata?.drawer?.placement === 'inner';
                        const newPlacement = isInner ? 'outer' : 'inner';
                        onUpdateObject(primary.id, {
                          name: newPlacement === 'inner' ? primary.name.replace(/^Çekmece/, 'İç Çekmece') : primary.name.replace(/^İç Çekmece/, 'Çekmece'),
                          metadata: {
                            ...primary.metadata,
                            drawer: {
                              ...primary.metadata?.drawer,
                              placement: newPlacement,
                              handleType: newPlacement === 'inner' ? 'recessed' : 'bar_modern',
                            },
                          },
                        });
                      }}
                      className={`flex-1 py-1.5 px-2 rounded-lg font-medium border text-[11px] transition ${
                        primary.metadata?.drawer?.placement === 'inner'
                          ? 'bg-amber-600/30 border-amber-500 text-amber-200'
                          : 'bg-emerald-600/30 border-emerald-500 text-emerald-200'
                      }`}
                    >
                      {primary.metadata?.drawer?.placement === 'inner' ? 'Gizli İç Çekmece (Kapak İçi)' : 'Standart Dış Çekmece'}
                    </button>
                  </div>
                </div>

                <SliderControl
                  label="Çekmece Açılma Mesafesi"
                  value={primary.metadata?.drawer?.extensionMm || 0}
                  min={0}
                  max={primary.metadata?.drawer?.maxExtensionMm || 400}
                  step={10}
                  unit="mm"
                  quickDeltas={[-50, 50]}
                  onChange={(v) => handleDrawerExtensionChange(v)}
                />
                <div className="flex justify-between gap-2">
                  <button
                    type="button"
                    onClick={() => handleDrawerExtensionChange(0)}
                    className="flex-1 py-1.5 bg-slate-800 hover:bg-slate-700 rounded-lg text-slate-300 font-medium active:scale-95 transition"
                  >
                    Kapat (0mm)
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      handleDrawerExtensionChange(primary.metadata?.drawer?.maxExtensionMm || 350)
                    }
                    className="flex-1 py-1.5 bg-blue-600 hover:bg-blue-500 rounded-lg text-white font-medium active:scale-95 transition"
                  >
                    Tam Aç
                  </button>
                </div>

                {onAddDrawerTopPanel && !isMulti && (
                  <button
                    type="button"
                    onClick={() => onAddDrawerTopPanel(primary.id)}
                    className="w-full py-1.5 rounded-lg border border-cyan-500/40 bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-200 font-medium text-[11px] transition"
                    title="Çekmece ile hücre tavanı arasındaki boşluğu kapatan ince bir panel ekler"
                  >
                    Üst Kapama Paneli Ekle
                  </button>
                )}
              </div>
            )}

            {primary.type === 'accessory' && primary.metadata?.accessory && (
              <div className="space-y-3">
                <div className="p-3 bg-slate-800/70 border border-slate-700/80 rounded-xl space-y-2">
                  <div className="text-xs font-semibold text-slate-200">Aksesuar Bilgisi</div>
                  <div className="text-[11px] text-slate-300 flex justify-between">
                    <span className="text-slate-400">Kategori:</span>
                    <span className="font-medium">{primary.metadata.accessory.category === 'cabinet' ? 'Dolap İçi Mobilya Donanımı' : 'Çekmece İçi Organizer'}</span>
                  </div>
                  <div className="text-[11px] text-slate-300 flex justify-between">
                    <span className="text-slate-400">Tip:</span>
                    <span className="font-medium text-sky-400">{primary.name}</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </aside>
  );
};
