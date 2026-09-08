import React, { useState, useRef } from 'react';
import {
  Columns,
  Rows,
  Archive,
  DoorClosed,
  PanelTop,
  Grid,
  Layers,
  Trash2,
  Lock,
  ChevronDown,
  ChevronUp,
  Footprints,
  Building,
  GripHorizontal,
  SquareDashed,
  PencilRuler,
  Plus,
  Minus,
  Sparkles,
  Shirt,
  Scissors,
  Lightbulb,
  ShoppingBag,
  PackageCheck,
  Utensils,
  Gem,
  LayoutGrid,
} from 'lucide-react';
import { CadState } from '../store/cadStore';
import { CabinetAccessoryType, DrawerAccessoryType } from '../types/cad';

export type DraggableItemType =
  | 'shelf'
  | 'divider'
  | 'drawer'
  | 'drawer_inner'
  | 'door_single_left'
  | 'door_single_right'
  | 'door_double'
  | 'door_sliding'
  | 'acc_hanging_rail'
  | 'acc_wardrobe_lift'
  | 'acc_pant_rack'
  | 'acc_tie_rack'
  | 'acc_wire_basket'
  | 'acc_led_profile'
  | 'dacc_cutlery_tray'
  | 'dacc_jewelry_tray'
  | 'dacc_drawer_organizer'
  | 'plinth'
  | 'legs'
  | 'wall'
  | 'column'
  | 'beam'
  | 'window'
  | 'room_door';

export interface DragItemMetadata {
  type: DraggableItemType;
  label: string;
  icon: string;
  category: 'parts' | 'doors' | 'accessories' | 'drawer_accessories' | 'arch';
}

export const ITEM_METADATA: Record<DraggableItemType, { label: string; icon: string }> = {
  shelf: { label: 'Yatay Raf', icon: 'Rows' },
  divider: { label: 'Dikey Dikme', icon: 'Columns' },
  drawer: { label: 'Dış Çekmece', icon: 'Archive' },
  drawer_inner: { label: 'İç Çekmece', icon: 'Archive' },
  door_single_left: { label: 'Sol Kapak', icon: 'DoorClosed' },
  door_single_right: { label: 'Sağ Kapak', icon: 'DoorClosed' },
  door_double: { label: 'Çift Kapak', icon: 'DoorClosed' },
  door_sliding: { label: 'Ray Kapak', icon: 'PanelTop' },
  acc_hanging_rail: { label: 'Askı Borusu', icon: 'Shirt' },
  acc_wardrobe_lift: { label: 'Asansörlü Askılık', icon: 'Shirt' },
  acc_pant_rack: { label: 'Raylı Pantolonluk', icon: 'Scissors' },
  acc_tie_rack: { label: 'Kravatlık & Kemerlik', icon: 'ShoppingBag' },
  acc_wire_basket: { label: 'Raylı Tel Sepet', icon: 'PackageCheck' },
  acc_led_profile: { label: 'LED Profil Aydınlatma', icon: 'Lightbulb' },
  dacc_cutlery_tray: { label: 'Çatal Kaşıklık', icon: 'Utensils' },
  dacc_jewelry_tray: { label: 'Takılık / Mücevherlik', icon: 'Gem' },
  dacc_drawer_organizer: { label: 'Çekmece İçi Bölücü', icon: 'LayoutGrid' },
  plinth: { label: 'Baza', icon: 'Grid' },
  legs: { label: 'Ayaklar', icon: 'Footprints' },
  wall: { label: 'Duvar Çiz', icon: 'Building' },
  column: { label: 'Kolon Çiz', icon: 'Building' },
  beam: { label: 'Kiriş Çiz', icon: 'Rows' },
  window: { label: 'Pencere', icon: 'Grid' },
  room_door: { label: 'Oda Kapısı', icon: 'DoorClosed' },
};

interface FloatingToolboxProps {
  state: CadState;
  isMarqueeSelectActive?: boolean;
  activeDrawingTool?: 'wall' | 'beam' | 'column' | null;
  onToggleMarqueeSelect?: () => void;
  onStartDrawing?: (type: 'wall' | 'beam' | 'column') => void;
  onCancelDrawing?: () => void;
  onAddShelf: () => void;
  onAddDivider: () => void;
  onAddDrawer: (placement?: 'outer' | 'inner') => void;
  onAddDrawerWithCount?: (count: number, placement?: 'outer' | 'inner') => void;
  onAddDoor: (type: 'single_left' | 'single_right' | 'double') => void;
  onAddSlidingDoor?: () => void;
  onAddAccessory: (type: CabinetAccessoryType) => void;
  onAddDrawerAccessory: (type: DrawerAccessoryType) => void;
  onAddPlinth: () => void;
  onAddLegs: () => void;
  onAddArchitectural: (type: 'wall' | 'column' | 'beam' | 'window' | 'room_door') => void;
  onCreateGroup: () => void;
  onUngroup: () => void;
  onToggleLock: () => void;
  onDeleteSelected: () => void;
  onPointerDragStart: (type: DraggableItemType, startX: number, startY: number) => void;
  onTrimWalls?: () => void;
}

export const FloatingToolbox: React.FC<FloatingToolboxProps> = ({
  state,
  isMarqueeSelectActive = false,
  activeDrawingTool = null,
  onToggleMarqueeSelect,
  onStartDrawing,
  onCancelDrawing,
  onAddShelf,
  onAddDivider,
  onAddDrawer,
  onAddDrawerWithCount,
  onAddDoor,
  onAddSlidingDoor,
  onAddAccessory,
  onAddDrawerAccessory,
  onAddPlinth,
  onAddLegs,
  onAddArchitectural,
  onCreateGroup,
  onUngroup,
  onToggleLock,
  onDeleteSelected,
  onPointerDragStart,
  onTrimWalls,
}) => {
  const [isExpanded, setIsExpanded] = useState(true);
  const [activeTab, setActiveTab] = useState<'parts' | 'doors' | 'accessories' | 'drawer_acc' | 'arch' | 'actions'>('parts');
  const [drawerCountPickerOpen, setDrawerCountPickerOpen] = useState(false);
  const [selectedDrawerCount, setSelectedDrawerCount] = useState<number>(3);
  const [selectedDrawerPlacement, setSelectedDrawerPlacement] = useState<'outer' | 'inner'>('outer');

  const pointerDownRef = useRef<{ type: DraggableItemType; x: number; y: number; time: number; hasMoved: boolean } | null>(null);

  const hasSelection = state.selectedIds.length > 0;
  const isMultipleSelected = state.selectedIds.length > 1;

  const handlePointerDown = (type: DraggableItemType, e: React.PointerEvent) => {
    // Record starting touch/pointer coordinates
    pointerDownRef.current = {
      type,
      x: e.clientX,
      y: e.clientY,
      time: performance.now(),
      hasMoved: false,
    };
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!pointerDownRef.current) return;
    const dist = Math.hypot(
      e.clientX - pointerDownRef.current.x,
      e.clientY - pointerDownRef.current.y
    );

    // If moved more than 5px, immediately start mobile-optimized fluid drag
    if (dist > 5 && !pointerDownRef.current.hasMoved) {
      pointerDownRef.current.hasMoved = true;
      const { type } = pointerDownRef.current;
      pointerDownRef.current = null;
      onPointerDragStart(type, e.clientX, e.clientY);
    }
  };

  const handlePointerUp = () => {
    pointerDownRef.current = null;
  };

  const handleConfirmDrawerCount = (count: number) => {
    setDrawerCountPickerOpen(false);
    if (onAddDrawerWithCount) {
      onAddDrawerWithCount(count, selectedDrawerPlacement);
    } else {
      onAddDrawer(selectedDrawerPlacement);
    }
  };

  return (
    <div className="cad-bottom-dock fixed bottom-0 sm:bottom-2 left-1/2 -translate-x-1/2 z-30 flex flex-col items-center w-full max-w-[94vw] sm:max-w-2xl px-2 pointer-events-none select-none">
      {/* Drawer Count & Placement Quick Modal / Popover */}
      {drawerCountPickerOpen && (
        <div className="mb-2 p-3 bg-slate-900/95 border border-emerald-500/50 rounded-2xl shadow-2xl backdrop-blur-xl pointer-events-auto flex flex-col items-center gap-2.5 animate-in slide-in-from-bottom-2 w-full max-w-sm">
          <div className="flex items-center justify-between w-full px-1">
            <span className="text-xs font-bold text-emerald-400 flex items-center gap-1.5">
              <Archive className="w-4 h-4" />
              Çekmece Ayarları & Adedi
            </span>
            <button
              onClick={() => setDrawerCountPickerOpen(false)}
              className="text-slate-400 hover:text-white text-xs px-1.5 py-0.5 rounded-md hover:bg-slate-800"
            >
              ✕
            </button>
          </div>

          {/* Inner / Outer Placement Toggle */}
          <div className="flex w-full gap-1.5 p-1 bg-slate-950 rounded-xl border border-slate-800">
            <button
              type="button"
              onClick={() => setSelectedDrawerPlacement('outer')}
              className={`flex-1 py-1.5 rounded-lg text-xs font-semibold transition ${
                selectedDrawerPlacement === 'outer'
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Dış Çekmece (Standart)
            </button>
            <button
              type="button"
              onClick={() => setSelectedDrawerPlacement('inner')}
              className={`flex-1 py-1.5 rounded-lg text-xs font-semibold transition ${
                selectedDrawerPlacement === 'inner'
                  ? 'bg-amber-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              İç Çekmece (Kapak İçi)
            </button>
          </div>

          <div className="flex items-center gap-1.5 w-full justify-center">
            {[1, 2, 3, 4, 5, 6].map((count) => (
              <button
                key={count}
                onClick={() => handleConfirmDrawerCount(count)}
                className={`px-3 py-2 rounded-xl text-xs font-bold transition flex flex-col items-center min-w-[42px] ${
                  selectedDrawerCount === count
                    ? 'bg-emerald-600 text-white shadow-lg scale-105 ring-2 ring-emerald-400/60'
                    : 'bg-slate-800 text-slate-200 hover:bg-slate-700 hover:text-white'
                }`}
              >
                <span>{count}</span>
                <span className="text-[9px] font-normal opacity-80">Göz</span>
              </button>
            ))}
          </div>

          <div className="text-[10px] text-slate-400 text-center">
            {selectedDrawerPlacement === 'inner'
              ? 'İç çekmeceler kapak menteşelerinden kurtulacak şekilde içe gömülü oluşturulur.'
              : 'Seçtiğiniz hücre tavanına ve kalan boşluğa göre çekmeceler otomatik boyutlandırılır.'}
          </div>
        </div>
      )}

      <div className="w-full bg-slate-900/95 backdrop-blur-xl border border-slate-800/90 rounded-2xl shadow-2xl p-2 pointer-events-auto transition-all duration-300">
        {/* Header Tabs Bar */}
        <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-800/80 px-1">
          <div className="flex items-center gap-1 overflow-x-auto no-scrollbar">
            <button
              onClick={() => setActiveTab('parts')}
              className={`px-2.5 py-1 rounded-lg text-xs font-semibold shrink-0 transition ${
                activeTab === 'parts'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
              }`}
            >
              İç Parçalar
            </button>
            <button
              onClick={() => setActiveTab('doors')}
              className={`px-2.5 py-1 rounded-lg text-xs font-semibold shrink-0 transition ${
                activeTab === 'doors'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
              }`}
            >
              Kapaklar
            </button>
            <button
              onClick={() => setActiveTab('accessories')}
              className={`px-2.5 py-1 rounded-lg text-xs font-semibold shrink-0 transition ${
                activeTab === 'accessories'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
              }`}
            >
              Dolap Aksesuarları
            </button>
            <button
              onClick={() => setActiveTab('drawer_acc')}
              className={`px-2.5 py-1 rounded-lg text-xs font-semibold shrink-0 transition ${
                activeTab === 'drawer_acc'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
              }`}
            >
              Çekmece İçi
            </button>
            <button
              onClick={() => setActiveTab('arch')}
              className={`px-2.5 py-1 rounded-lg text-xs font-semibold shrink-0 transition ${
                activeTab === 'arch'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
              }`}
            >
              Mimari & Ayak
            </button>
            <button
              onClick={() => setActiveTab('actions')}
              className={`px-2.5 py-1 rounded-lg text-xs font-semibold shrink-0 transition relative ${
                activeTab === 'actions'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
              }`}
            >
              İşlemler
              {hasSelection && (
                <span className="inline-flex items-center justify-center w-4 h-4 ml-1.5 text-[9px] font-bold bg-amber-500 text-slate-950 rounded-full">
                  {state.selectedIds.length}
                </span>
              )}
            </button>
          </div>

          <div className="flex items-center gap-1">
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
              title={isExpanded ? 'Araç Kutusunu Daralt' : 'Araç Kutusunu Genişlet'}
            >
              {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {/* Content Item Grids */}
        {isExpanded && (
          <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-1">
            {activeTab === 'parts' && (
              <>
                <button
                  onPointerDown={(e) => handlePointerDown('shelf', e)}
                  onPointerMove={handlePointerMove}
                  onPointerUp={handlePointerUp}
                  onClick={onAddShelf}
                  className="flex flex-col items-center justify-center min-w-[76px] sm:min-w-[84px] h-14 rounded-xl bg-slate-800/90 hover:bg-slate-700/90 hover:border-blue-500/60 active:scale-95 border border-slate-700 text-slate-200 transition shadow-sm group shrink-0 cursor-grab active:cursor-grabbing relative touch-none"
                  title="Dolap İçine Yatay Raf Ekle (Sürükle veya Dokun)"
                >
                  <Rows className="w-5 h-5 text-blue-400 group-hover:scale-110 transition" />
                  <span className="text-[11px] font-medium mt-1">Yatay Raf</span>
                  <GripHorizontal className="w-3 h-3 text-slate-500 absolute top-1 right-1 opacity-60 group-hover:opacity-100" />
                </button>

                <button
                  onPointerDown={(e) => handlePointerDown('divider', e)}
                  onPointerMove={handlePointerMove}
                  onPointerUp={handlePointerUp}
                  onClick={onAddDivider}
                  className="flex flex-col items-center justify-center min-w-[76px] sm:min-w-[84px] h-14 rounded-xl bg-slate-800/90 hover:bg-slate-700/90 hover:border-indigo-500/60 active:scale-95 border border-slate-700 text-slate-200 transition shadow-sm group shrink-0 cursor-grab active:cursor-grabbing relative touch-none"
                  title="Dolap İçine Dikey Dikme Ekle (Sürükle veya Dokun)"
                >
                  <Columns className="w-5 h-5 text-indigo-400 group-hover:scale-110 transition" />
                  <span className="text-[11px] font-medium mt-1">Dikey Dikme</span>
                  <GripHorizontal className="w-3 h-3 text-slate-500 absolute top-1 right-1 opacity-60 group-hover:opacity-100" />
                </button>

                {/* Dış Çekmece Butonu */}
                <div className="relative shrink-0 flex items-center">
                  <button
                    onPointerDown={(e) => handlePointerDown('drawer', e)}
                    onPointerMove={handlePointerMove}
                    onPointerUp={handlePointerUp}
                    onClick={() => {
                      setSelectedDrawerPlacement('outer');
                      setDrawerCountPickerOpen(!drawerCountPickerOpen);
                    }}
                    className="flex flex-col items-center justify-center min-w-[76px] sm:min-w-[84px] h-14 rounded-xl bg-slate-800/90 hover:bg-slate-700/90 hover:border-emerald-500/60 active:scale-95 border border-slate-700 text-slate-200 transition shadow-sm group cursor-grab active:cursor-grabbing relative touch-none"
                    title="Dış Çekmece Ekle (Dokununca Adet Seçin / Sürükleyin)"
                  >
                    <Archive className="w-5 h-5 text-emerald-400 group-hover:scale-110 transition" />
                    <span className="text-[11px] font-medium mt-1">Dış Çekmece</span>
                    <span className="absolute top-1 right-1 px-1 py-0.2 bg-emerald-500/30 text-emerald-300 rounded text-[9px] font-bold">
                      1-6'lı
                    </span>
                  </button>
                </div>

                {/* İç Çekmece Butonu */}
                <div className="relative shrink-0 flex items-center">
                  <button
                    onPointerDown={(e) => handlePointerDown('drawer_inner', e)}
                    onPointerMove={handlePointerMove}
                    onPointerUp={handlePointerUp}
                    onClick={() => {
                      setSelectedDrawerPlacement('inner');
                      setDrawerCountPickerOpen(!drawerCountPickerOpen);
                    }}
                    className="flex flex-col items-center justify-center min-w-[76px] sm:min-w-[84px] h-14 rounded-xl bg-slate-800/90 hover:bg-slate-700/90 hover:border-amber-500/60 active:scale-95 border border-slate-700 text-slate-200 transition shadow-sm group cursor-grab active:cursor-grabbing relative touch-none"
                    title="İç Çekmece Ekle (Kapak Arkası Gizli Çekmece)"
                  >
                    <Archive className="w-5 h-5 text-amber-400 group-hover:scale-110 transition" />
                    <span className="text-[11px] font-medium mt-1">İç Çekmece</span>
                    <span className="absolute top-1 right-1 px-1 py-0.2 bg-amber-500/30 text-amber-300 rounded text-[9px] font-bold">
                      Gizli
                    </span>
                  </button>
                </div>
              </>
            )}

            {/* Dolap İçi Mobilya Aksesuarları Tab */}
            {activeTab === 'accessories' && (
              <>
                <button
                  onPointerDown={(e) => handlePointerDown('acc_hanging_rail', e)}
                  onPointerMove={handlePointerMove}
                  onPointerUp={handlePointerUp}
                  onClick={() => onAddAccessory('hanging_rail')}
                  className="flex flex-col items-center justify-center min-w-[80px] sm:min-w-[90px] h-14 rounded-xl bg-slate-800/90 hover:bg-slate-700/90 hover:border-sky-500/60 active:scale-95 border border-slate-700 text-slate-200 transition shadow-sm group shrink-0 cursor-grab active:cursor-grabbing relative touch-none"
                  title="Askı Borusu Ekle (Sürükleyin veya Dokunun)"
                >
                  <Shirt className="w-5 h-5 text-sky-400 group-hover:scale-110 transition" />
                  <span className="text-[10.5px] font-medium mt-1">Askı Borusu</span>
                  <GripHorizontal className="w-3 h-3 text-slate-500 absolute top-1 right-1 opacity-60 group-hover:opacity-100" />
                </button>

                <button
                  onPointerDown={(e) => handlePointerDown('acc_wardrobe_lift', e)}
                  onPointerMove={handlePointerMove}
                  onPointerUp={handlePointerUp}
                  onClick={() => onAddAccessory('wardrobe_lift')}
                  className="flex flex-col items-center justify-center min-w-[80px] sm:min-w-[90px] h-14 rounded-xl bg-slate-800/90 hover:bg-slate-700/90 hover:border-sky-500/60 active:scale-95 border border-slate-700 text-slate-200 transition shadow-sm group shrink-0 cursor-grab active:cursor-grabbing relative touch-none"
                  title="Asansörlü Askılık (Hidrolik Dolap İçi Askı)"
                >
                  <Shirt className="w-5 h-5 text-cyan-400 group-hover:scale-110 transition" />
                  <span className="text-[10.5px] font-medium mt-1">Asansörlü Askı</span>
                  <GripHorizontal className="w-3 h-3 text-slate-500 absolute top-1 right-1 opacity-60 group-hover:opacity-100" />
                </button>

                <button
                  onPointerDown={(e) => handlePointerDown('acc_pant_rack', e)}
                  onPointerMove={handlePointerMove}
                  onPointerUp={handlePointerUp}
                  onClick={() => onAddAccessory('pant_rack')}
                  className="flex flex-col items-center justify-center min-w-[80px] sm:min-w-[90px] h-14 rounded-xl bg-slate-800/90 hover:bg-slate-700/90 hover:border-indigo-500/60 active:scale-95 border border-slate-700 text-slate-200 transition shadow-sm group shrink-0 cursor-grab active:cursor-grabbing relative touch-none"
                  title="Raylı Teleskopik Pantolonluk"
                >
                  <Scissors className="w-5 h-5 text-indigo-400 group-hover:scale-110 transition" />
                  <span className="text-[10.5px] font-medium mt-1">Pantolonluk</span>
                  <GripHorizontal className="w-3 h-3 text-slate-500 absolute top-1 right-1 opacity-60 group-hover:opacity-100" />
                </button>

                <button
                  onPointerDown={(e) => handlePointerDown('acc_tie_rack', e)}
                  onPointerMove={handlePointerMove}
                  onPointerUp={handlePointerUp}
                  onClick={() => onAddAccessory('tie_rack')}
                  className="flex flex-col items-center justify-center min-w-[80px] sm:min-w-[90px] h-14 rounded-xl bg-slate-800/90 hover:bg-slate-700/90 hover:border-purple-500/60 active:scale-95 border border-slate-700 text-slate-200 transition shadow-sm group shrink-0 cursor-grab active:cursor-grabbing relative touch-none"
                  title="Kravatlık & Kemerlik (Yana Monte)"
                >
                  <ShoppingBag className="w-5 h-5 text-purple-400 group-hover:scale-110 transition" />
                  <span className="text-[10.5px] font-medium mt-1">Kravatlık</span>
                  <GripHorizontal className="w-3 h-3 text-slate-500 absolute top-1 right-1 opacity-60 group-hover:opacity-100" />
                </button>

                <button
                  onPointerDown={(e) => handlePointerDown('acc_wire_basket', e)}
                  onPointerMove={handlePointerMove}
                  onPointerUp={handlePointerUp}
                  onClick={() => onAddAccessory('wire_basket')}
                  className="flex flex-col items-center justify-center min-w-[80px] sm:min-w-[90px] h-14 rounded-xl bg-slate-800/90 hover:bg-slate-700/90 hover:border-emerald-500/60 active:scale-95 border border-slate-700 text-slate-200 transition shadow-sm group shrink-0 cursor-grab active:cursor-grabbing relative touch-none"
                  title="Raylı Tel Sepet"
                >
                  <PackageCheck className="w-5 h-5 text-emerald-400 group-hover:scale-110 transition" />
                  <span className="text-[10.5px] font-medium mt-1">Tel Sepet</span>
                  <GripHorizontal className="w-3 h-3 text-slate-500 absolute top-1 right-1 opacity-60 group-hover:opacity-100" />
                </button>

                <button
                  onPointerDown={(e) => handlePointerDown('acc_led_profile', e)}
                  onPointerMove={handlePointerMove}
                  onPointerUp={handlePointerUp}
                  onClick={() => onAddAccessory('led_profile')}
                  className="flex flex-col items-center justify-center min-w-[80px] sm:min-w-[90px] h-14 rounded-xl bg-slate-800/90 hover:bg-slate-700/90 hover:border-amber-500/60 active:scale-95 border border-slate-700 text-slate-200 transition shadow-sm group shrink-0 cursor-grab active:cursor-grabbing relative touch-none"
                  title="LED Profil Aydınlatma"
                >
                  <Lightbulb className="w-5 h-5 text-amber-400 group-hover:scale-110 transition" />
                  <span className="text-[10.5px] font-medium mt-1">LED Profil</span>
                  <GripHorizontal className="w-3 h-3 text-slate-500 absolute top-1 right-1 opacity-60 group-hover:opacity-100" />
                </button>
              </>
            )}

            {/* Çekmece İçi Aksesuarlar Tab */}
            {activeTab === 'drawer_acc' && (
              <>
                <button
                  onPointerDown={(e) => handlePointerDown('dacc_cutlery_tray', e)}
                  onPointerMove={handlePointerMove}
                  onPointerUp={handlePointerUp}
                  onClick={() => onAddDrawerAccessory('cutlery_tray')}
                  className="flex flex-col items-center justify-center min-w-[80px] sm:min-w-[92px] h-14 rounded-xl bg-slate-800/90 hover:bg-slate-700/90 hover:border-amber-500/60 active:scale-95 border border-slate-700 text-slate-200 transition shadow-sm group shrink-0 cursor-grab active:cursor-grabbing relative touch-none"
                  title="Çatal Kaşıklık Organizer (Çekmece içine yerleştirilir)"
                >
                  <Utensils className="w-5 h-5 text-amber-400 group-hover:scale-110 transition" />
                  <span className="text-[10.5px] font-medium mt-1">Kaşıklık</span>
                  <GripHorizontal className="w-3 h-3 text-slate-500 absolute top-1 right-1 opacity-60 group-hover:opacity-100" />
                </button>

                <button
                  onPointerDown={(e) => handlePointerDown('dacc_jewelry_tray', e)}
                  onPointerMove={handlePointerMove}
                  onPointerUp={handlePointerUp}
                  onClick={() => onAddDrawerAccessory('jewelry_tray')}
                  className="flex flex-col items-center justify-center min-w-[80px] sm:min-w-[92px] h-14 rounded-xl bg-slate-800/90 hover:bg-slate-700/90 hover:border-pink-500/60 active:scale-95 border border-slate-700 text-slate-200 transition shadow-sm group shrink-0 cursor-grab active:cursor-grabbing relative touch-none"
                  title="Takılık & Mücevher Kutusu Organizer"
                >
                  <Gem className="w-5 h-5 text-pink-400 group-hover:scale-110 transition" />
                  <span className="text-[10.5px] font-medium mt-1">Takılık</span>
                  <GripHorizontal className="w-3 h-3 text-slate-500 absolute top-1 right-1 opacity-60 group-hover:opacity-100" />
                </button>

                <button
                  onPointerDown={(e) => handlePointerDown('dacc_drawer_organizer', e)}
                  onPointerMove={handlePointerMove}
                  onPointerUp={handlePointerUp}
                  onClick={() => onAddDrawerAccessory('drawer_organizer')}
                  className="flex flex-col items-center justify-center min-w-[80px] sm:min-w-[92px] h-14 rounded-xl bg-slate-800/90 hover:bg-slate-700/90 hover:border-cyan-500/60 active:scale-95 border border-slate-700 text-slate-200 transition shadow-sm group shrink-0 cursor-grab active:cursor-grabbing relative touch-none"
                  title="Çekmece İçi Bölücü Izgara"
                >
                  <LayoutGrid className="w-5 h-5 text-cyan-400 group-hover:scale-110 transition" />
                  <span className="text-[10.5px] font-medium mt-1">Bölücü Izgara</span>
                  <GripHorizontal className="w-3 h-3 text-slate-500 absolute top-1 right-1 opacity-60 group-hover:opacity-100" />
                </button>
              </>
            )}

            {activeTab === 'doors' && (
              <>
                <button
                  onPointerDown={(e) => handlePointerDown('door_sliding', e)}
                  onPointerMove={handlePointerMove}
                  onPointerUp={handlePointerUp}
                  onClick={onAddSlidingDoor}
                  className="flex flex-col items-center justify-center min-w-[76px] sm:min-w-[84px] h-14 rounded-xl bg-slate-800/90 hover:bg-slate-700/90 hover:border-cyan-500/60 active:scale-95 border border-slate-700 text-slate-200 transition shadow-sm group shrink-0 cursor-grab active:cursor-grabbing relative touch-none"
                  title="Ray Kapak (Hücreye bırakınca panel ve ray seçeneklerini açar)"
                >
                  <PanelTop className="w-5 h-5 text-cyan-400 group-hover:scale-110 transition" />
                  <span className="text-[11px] font-medium mt-1">Ray Kapak</span>
                  <GripHorizontal className="w-3 h-3 text-slate-500 absolute top-1 right-1 opacity-60 group-hover:opacity-100" />
                </button>

                <button
                  onPointerDown={(e) => handlePointerDown('door_single_left', e)}
                  onPointerMove={handlePointerMove}
                  onPointerUp={handlePointerUp}
                  onClick={() => onAddDoor('single_left')}
                  className="flex flex-col items-center justify-center min-w-[76px] sm:min-w-[84px] h-14 rounded-xl bg-slate-800/90 hover:bg-slate-700/90 hover:border-amber-500/60 active:scale-95 border border-slate-700 text-slate-200 transition shadow-sm group shrink-0 cursor-grab active:cursor-grabbing relative touch-none"
                  title="Sağa Açılır Tek Kapak (Hücrelerin üzerinden sürükleyerek çoklu hücre seçebilirsiniz)"
                >
                  <DoorClosed className="w-5 h-5 text-amber-400 group-hover:scale-110 transition -scale-x-100" />
                  <span className="text-[11px] font-medium mt-1">Sağa Açılır</span>
                  <GripHorizontal className="w-3 h-3 text-slate-500 absolute top-1 right-1 opacity-60 group-hover:opacity-100" />
                </button>

                <button
                  onPointerDown={(e) => handlePointerDown('door_single_right', e)}
                  onPointerMove={handlePointerMove}
                  onPointerUp={handlePointerUp}
                  onClick={() => onAddDoor('single_right')}
                  className="flex flex-col items-center justify-center min-w-[76px] sm:min-w-[84px] h-14 rounded-xl bg-slate-800/90 hover:bg-slate-700/90 hover:border-amber-500/60 active:scale-95 border border-slate-700 text-slate-200 transition shadow-sm group shrink-0 cursor-grab active:cursor-grabbing relative touch-none"
                  title="Sola Açılır Tek Kapak (Hücrelerin üzerinden sürükleyerek çoklu hücre seçebilirsiniz)"
                >
                  <DoorClosed className="w-5 h-5 text-amber-400 group-hover:scale-110 transition" />
                  <span className="text-[11px] font-medium mt-1">Sola Açılır</span>
                  <GripHorizontal className="w-3 h-3 text-slate-500 absolute top-1 right-1 opacity-60 group-hover:opacity-100" />
                </button>

                <button
                  onPointerDown={(e) => handlePointerDown('door_double', e)}
                  onPointerMove={handlePointerMove}
                  onPointerUp={handlePointerUp}
                  onClick={() => onAddDoor('double')}
                  className="flex flex-col items-center justify-center min-w-[76px] sm:min-w-[84px] h-14 rounded-xl bg-slate-800/90 hover:bg-slate-700/90 hover:border-amber-500/60 active:scale-95 border border-slate-700 text-slate-200 transition shadow-sm group shrink-0 cursor-grab active:cursor-grabbing relative touch-none"
                  title="Çift Kanatlı Kapak (Hücrelerin üzerinden sürükleyerek çoklu hücre seçebilirsiniz)"
                >
                  <div className="flex items-center gap-0.5 text-amber-400">
                    <DoorClosed className="w-4 h-4 -scale-x-100" />
                    <DoorClosed className="w-4 h-4" />
                  </div>
                  <span className="text-[11px] font-medium mt-1">Çift Kapak</span>
                  <GripHorizontal className="w-3 h-3 text-slate-500 absolute top-1 right-1 opacity-60 group-hover:opacity-100" />
                </button>

                <div className="flex flex-col justify-center px-2 py-1 bg-slate-800/60 border border-slate-700/80 rounded-xl shrink-0 text-[10px] text-slate-300 max-w-[150px]">
                  <span className="font-bold text-amber-400 flex items-center gap-1">
                    <Sparkles className="w-3 h-3 text-amber-400" />
                    Çoklu Hücre:
                  </span>
                  <span>Dokunmayı bırakmadan birden fazla göze sürükleyin</span>
                </div>
              </>
            )}

            {activeTab === 'arch' && (
              <>
                {/* Duvar Çizim Butonu (Tıklanıp zeminde sürüklenerek çizilir, Kuş bakışına geçer) */}
                <button
                  onClick={() => {
                    if (activeDrawingTool === 'wall') {
                      onCancelDrawing?.();
                    } else {
                      onStartDrawing?.('wall');
                    }
                  }}
                  className={`flex flex-col items-center justify-center min-w-[78px] sm:min-w-[88px] h-14 rounded-xl active:scale-95 border transition shadow-sm group shrink-0 cursor-pointer ${
                    activeDrawingTool === 'wall'
                      ? 'bg-sky-600 border-sky-400 text-white shadow-glow ring-2 ring-sky-400/60 animate-pulse'
                      : 'bg-slate-800/90 hover:bg-slate-700/90 hover:border-sky-500/60 border-slate-700 text-slate-200'
                  }`}
                  title="Duvar Çiz (Butona tıklayın, zeminde sürükleyerek eş zamanlı çizin)"
                >
                  <Building className={`w-5 h-5 ${activeDrawingTool === 'wall' ? 'text-white scale-110' : 'text-sky-400'} group-hover:scale-110 transition`} />
                  <span className="text-[11px] font-semibold mt-1">
                    {activeDrawingTool === 'wall' ? 'Duvar Çiz...' : 'Duvar Çiz'}
                  </span>
                </button>

                {/* Kiriş Çizim Butonu */}
                <button
                  onClick={() => {
                    if (activeDrawingTool === 'beam') {
                      onCancelDrawing?.();
                    } else {
                      onStartDrawing?.('beam');
                    }
                  }}
                  className={`flex flex-col items-center justify-center min-w-[78px] sm:min-w-[88px] h-14 rounded-xl active:scale-95 border transition shadow-sm group shrink-0 cursor-pointer ${
                    activeDrawingTool === 'beam'
                      ? 'bg-amber-600 border-amber-400 text-white shadow-glow ring-2 ring-amber-400/60 animate-pulse'
                      : 'bg-slate-800/90 hover:bg-slate-700/90 hover:border-amber-500/60 border-slate-700 text-slate-200'
                  }`}
                  title="Kiriş Çiz (Butona tıklayın, tavanda/zeminde sürükleyerek çizin)"
                >
                  <Rows className={`w-5 h-5 ${activeDrawingTool === 'beam' ? 'text-white scale-110' : 'text-amber-400'} group-hover:scale-110 transition`} />
                  <span className="text-[11px] font-semibold mt-1">
                    {activeDrawingTool === 'beam' ? 'Kiriş Çiz...' : 'Kiriş Çiz'}
                  </span>
                </button>

                {/* Kolon Çizim Butonu */}
                <button
                  onClick={() => {
                    if (activeDrawingTool === 'column') {
                      onCancelDrawing?.();
                    } else {
                      onStartDrawing?.('column');
                    }
                  }}
                  className={`flex flex-col items-center justify-center min-w-[78px] sm:min-w-[88px] h-14 rounded-xl active:scale-95 border transition shadow-sm group shrink-0 cursor-pointer ${
                    activeDrawingTool === 'column'
                      ? 'bg-violet-600 border-violet-400 text-white shadow-glow ring-2 ring-violet-400/60 animate-pulse'
                      : 'bg-slate-800/90 hover:bg-slate-700/90 hover:border-violet-500/60 border-slate-700 text-slate-200'
                  }`}
                  title="Kolon Çiz (Butona tıklayın, zeminde sürükleyerek çizin)"
                >
                  <Building className={`w-5 h-5 ${activeDrawingTool === 'column' ? 'text-white scale-110' : 'text-violet-400'} group-hover:scale-110 transition`} />
                  <span className="text-[11px] font-semibold mt-1">
                    {activeDrawingTool === 'column' ? 'Kolon Çiz...' : 'Kolon Çiz'}
                  </span>
                </button>

                {/* Duvar Kesişimlerini Trimle Butonu */}
                <button
                  onClick={onTrimWalls}
                  className="flex flex-col items-center justify-center min-w-[78px] sm:min-w-[88px] h-14 rounded-xl bg-slate-800/90 hover:bg-slate-700/90 hover:border-sky-500/60 active:scale-95 border border-slate-700 text-slate-200 transition shadow-sm group shrink-0 cursor-pointer"
                  title="Duvar Kesişimlerini Otomatik Trimle (L-Köşe, T-Birleşim, X-Kesişim)"
                >
                  <Scissors className="w-5 h-5 text-sky-400 group-hover:scale-110 transition" />
                  <span className="text-[11px] font-semibold mt-1">Duvar Trim</span>
                </button>

                {/* Baza & Ayaklar */}
                <button
                  onPointerDown={(e) => handlePointerDown('plinth', e)}
                  onPointerMove={handlePointerMove}
                  onPointerUp={handlePointerUp}
                  onClick={onAddPlinth}
                  className="flex flex-col items-center justify-center min-w-[76px] sm:min-w-[84px] h-14 rounded-xl bg-slate-800/90 hover:bg-slate-700/90 hover:border-emerald-500/60 active:scale-95 border border-slate-700 text-slate-200 transition shadow-sm group shrink-0 cursor-grab active:cursor-grabbing relative touch-none"
                  title="Dolap Altına Baza Ekle"
                >
                  <Grid className="w-5 h-5 text-emerald-400 group-hover:scale-110 transition" />
                  <span className="text-[11px] font-medium mt-1">Baza</span>
                  <GripHorizontal className="w-3 h-3 text-slate-500 absolute top-1 right-1 opacity-60 group-hover:opacity-100" />
                </button>

                <button
                  onPointerDown={(e) => handlePointerDown('legs', e)}
                  onPointerMove={handlePointerMove}
                  onPointerUp={handlePointerUp}
                  onClick={onAddLegs}
                  className="flex flex-col items-center justify-center min-w-[76px] sm:min-w-[84px] h-14 rounded-xl bg-slate-800/90 hover:bg-slate-700/90 hover:border-emerald-500/60 active:scale-95 border border-slate-700 text-slate-200 transition shadow-sm group shrink-0 cursor-grab active:cursor-grabbing relative touch-none"
                  title="Dolap Altına 4 Ayak Ekle"
                >
                  <Footprints className="w-5 h-5 text-emerald-400 group-hover:scale-110 transition" />
                  <span className="text-[11px] font-medium mt-1">Ayaklar</span>
                  <GripHorizontal className="w-3 h-3 text-slate-500 absolute top-1 right-1 opacity-60 group-hover:opacity-100" />
                </button>

                <button
                  onClick={() => onAddArchitectural('window')}
                  className="flex flex-col items-center justify-center min-w-[76px] sm:min-w-[84px] h-14 rounded-xl bg-slate-800/90 hover:bg-slate-700/90 hover:border-blue-300/60 active:scale-95 border border-slate-700 text-slate-200 transition shadow-sm group shrink-0"
                  title="Pencere Ekle"
                >
                  <Grid className="w-5 h-5 text-blue-300 group-hover:scale-110 transition" />
                  <span className="text-[11px] font-medium mt-1">Pencere</span>
                </button>

                <button
                  onClick={() => onAddArchitectural('room_door')}
                  className="flex flex-col items-center justify-center min-w-[76px] sm:min-w-[84px] h-14 rounded-xl bg-slate-800/90 hover:bg-slate-700/90 hover:border-amber-500/60 active:scale-95 border border-slate-700 text-slate-200 transition shadow-sm group shrink-0"
                  title="Oda Kapısı Ekle"
                >
                  <DoorClosed className="w-5 h-5 text-amber-500 group-hover:scale-110 transition" />
                  <span className="text-[11px] font-medium mt-1">Oda Kapısı</span>
                </button>
              </>
            )}

            {activeTab === 'actions' && (
              <>
                {/* Toplu Seç Butonu (Sürükle-Bırak Seçim Çerçevesi) */}
                <button
                  onClick={onToggleMarqueeSelect}
                  className={`flex flex-col items-center justify-center min-w-[76px] sm:min-w-[84px] h-14 rounded-xl active:scale-95 transition shadow-sm group shrink-0 border ${
                    isMarqueeSelectActive
                      ? 'bg-blue-600 border-cyan-400 text-white ring-2 ring-blue-500/50 shadow-glow animate-pulse'
                      : 'bg-slate-800/90 hover:bg-slate-700/90 border-slate-700 text-slate-200'
                  }`}
                  title="Toplu Seç: Ekranda sürükleyerek çerçeve ile çoklu parça seçin"
                >
                  <SquareDashed className={`w-5 h-5 ${isMarqueeSelectActive ? 'text-white' : 'text-cyan-400'} group-hover:scale-110 transition`} />
                  <span className="text-[11px] font-medium mt-1">
                    {isMarqueeSelectActive ? 'Seçim Açık' : 'Toplu Seç'}
                  </span>
                </button>

                {/* Grup Oluştur / Grup Yap Butonu */}
                <button
                  onClick={onCreateGroup}
                  disabled={!isMultipleSelected}
                  className={`flex flex-col items-center justify-center min-w-[76px] sm:min-w-[84px] h-14 rounded-xl active:scale-95 transition shadow-sm group shrink-0 border ${
                    isMultipleSelected
                      ? 'bg-gradient-to-tr from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 border-blue-400 text-white shadow-glow ring-2 ring-blue-500/40 cursor-pointer animate-in fade-in'
                      : 'bg-slate-800/90 hover:bg-slate-700/90 border-slate-700 text-slate-200 disabled:opacity-30 disabled:pointer-events-none'
                  }`}
                  title="Seçili Parçaları Grup Yap (SketchUp Style)"
                >
                  <Layers className={`w-5 h-5 ${isMultipleSelected ? 'text-white scale-110' : 'text-blue-400'} group-hover:scale-110 transition`} />
                  <span className="text-[11px] font-medium mt-1">
                    Grup Oluştur
                  </span>
                </button>

                {/* Grubu Dağıt */}
                <button
                  onClick={onUngroup}
                  disabled={!hasSelection}
                  className="flex flex-col items-center justify-center min-w-[76px] sm:min-w-[84px] h-14 rounded-xl bg-slate-800/90 hover:bg-slate-700/90 active:scale-95 border border-slate-700 text-slate-200 disabled:opacity-30 disabled:pointer-events-none transition shadow-sm group shrink-0"
                  title="Grubu Dağıt"
                >
                  <Layers className="w-5 h-5 text-slate-400 group-hover:scale-110 transition stroke-dashed" />
                  <span className="text-[11px] font-medium mt-1">Grup Çöz</span>
                </button>

                {/* Kilitle */}
                <button
                  onClick={onToggleLock}
                  disabled={!hasSelection}
                  className="flex flex-col items-center justify-center min-w-[76px] sm:min-w-[84px] h-14 rounded-xl bg-slate-800/90 hover:bg-slate-700/90 active:scale-95 border border-slate-700 text-slate-200 disabled:opacity-30 disabled:pointer-events-none transition shadow-sm group shrink-0"
                  title="Kilitle / Kilidi Aç"
                >
                  <Lock className="w-5 h-5 text-amber-400 group-hover:scale-110 transition" />
                  <span className="text-[11px] font-medium mt-1">Kilitle</span>
                </button>

                {/* Sil */}
                <button
                  onClick={onDeleteSelected}
                  disabled={!hasSelection}
                  className="flex flex-col items-center justify-center min-w-[76px] sm:min-w-[84px] h-14 rounded-xl bg-red-500/15 hover:bg-red-500/25 active:scale-95 border border-red-500/30 text-red-300 disabled:opacity-30 disabled:pointer-events-none transition shadow-sm group shrink-0"
                  title="Seçili Parçaları Sil (Del)"
                >
                  <Trash2 className="w-5 h-5 text-red-400 group-hover:scale-110 transition" />
                  <span className="text-[11px] font-medium mt-1">Sil</span>
                </button>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
