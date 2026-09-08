import React, { useEffect, useRef, useState, useCallback } from 'react';
import { cadStore, CadState } from './store/cadStore';
import { ThreeEngine } from './engine/ThreeEngine';
import { CabinetFactory } from './engine/CabinetFactory';
import { CellDetector } from './engine/CellDetector';
import { HeaderBar } from './components/HeaderBar';
import { FloatingToolbox, DraggableItemType, ITEM_METADATA } from './components/FloatingToolbox';
import { PropertyInspector } from './components/PropertyInspector';
import { NumericKeypadModal } from './components/NumericKeypadModal';
import { OutlinerPanel } from './components/OutlinerPanel';
import { CuttingOptimizationModal } from './components/CuttingOptimizationModal';
import { CostReportModal } from './components/CostReportModal';
import { AutoGroupToast } from './components/AutoGroupToast';
import { HelpGuideModal } from './components/HelpGuideModal';
import { ToastNotification } from './components/ToastNotification';
import { SlidingDoorOptionsModal } from './components/SlidingDoorOptionsModal';
import { RenderMode, CameraMode, CameraPreset, CabinetCell, Vector3D, SlidingDoorMetadata } from './types/cad';
import {
  Layers,
  Pencil,
  Sparkles,
  Rows,
  Columns,
  Archive,
  DoorClosed,
  Grid,
  Footprints,
  Building,
  SquareDashed,
  PencilRuler,
  Compass,
  Magnet,
  Eye,
  Check,
  X,
  Plus,
} from 'lucide-react';

export const App: React.FC = () => {
  const canvasContainerRef = useRef<HTMLDivElement | null>(null);
  const engineRef = useRef<ThreeEngine | null>(null);

  const [state, setState] = useState<CadState>(cadStore.getState());

  // Inspector & Modal States
  const [isInspectorOpen, setIsInspectorOpen] = useState(false);
  const [isCuttingModalOpen, setIsCuttingModalOpen] = useState(false);
  const [isCostModalOpen, setIsCostModalOpen] = useState(false);
  const [isHelpModalOpen, setIsHelpModalOpen] = useState(false);
  const [isOutlinerOpen, setIsOutlinerOpen] = useState(false);
  const [slidingDoorCell, setSlidingDoorCell] = useState<CabinetCell | null>(null);
  const createDefaultSlidingDoorPanels = (count = 2, finish: SlidingDoorMetadata['finish'] = 'mdflam') =>
    Array.from({ length: count }, () => ({
      finish,
      verticalDividers: 0,
      horizontalDividers: 0,
    }));

  const [slidingDoorOptions, setSlidingDoorOptions] = useState({
    panelCount: 2,
    finish: 'mdflam' as SlidingDoorMetadata['finish'],
    verticalDividers: 0,
    horizontalDividers: 0,
    panels: createDefaultSlidingDoorPanels(2, 'mdflam'),
  });

  // Marquee Selection Mode State
  const [isMarqueeSelectActive, setIsMarqueeSelectActive] = useState(false);
  const [marqueeBox, setMarqueeBox] = useState<{
    startX: number;
    startY: number;
    currentX: number;
    currentY: number;
  } | null>(null);
  const marqueeStartRef = useRef<{ x: number; y: number } | null>(null);

  // Interactive 2D/3D Wall/Beam/Column Drawing State
  const [activeDrawingTool, setActiveDrawingTool] = useState<'wall' | 'beam' | 'column' | null>(null);
  const [isDrawingStroke, setIsDrawingStroke] = useState(false);
  const [drawingStartPoint, setDrawingStartPoint] = useState<Vector3D | null>(null);
  const [drawingCurrentPoint, setDrawingCurrentPoint] = useState<Vector3D | null>(null);
  const [drawingSnapOrtho, setDrawingSnapOrtho] = useState(true);
  const [isTopDownView, setIsTopDownView] = useState(true);

  // Wall / Beam / Column parametric defaults for drawing
  const [drawnWallHeight, setDrawnWallHeight] = useState(2600);
  const [drawnWallThickness, setDrawnWallThickness] = useState(150);
  const [drawnBeamHeight, setDrawnBeamHeight] = useState(400);
  const [drawnBeamThickness, setDrawnBeamThickness] = useState(300);
  const [drawnColumnHeight, setDrawnColumnHeight] = useState(2600);

  const activeDrawingToolRef = useRef<'wall' | 'beam' | 'column' | null>(null);
  const isDrawingStrokeRef = useRef(false);
  const drawingStartPointRef = useRef<Vector3D | null>(null);
  const drawingCurrentPointRef = useRef<Vector3D | null>(null);
  const drawingSnapOrthoRef = useRef(true);

  // Keep refs in sync for high performance pointer event handlers
  useEffect(() => {
    activeDrawingToolRef.current = activeDrawingTool;
    isDrawingStrokeRef.current = isDrawingStroke;
    drawingStartPointRef.current = drawingStartPoint;
    drawingCurrentPointRef.current = drawingCurrentPoint;
    drawingSnapOrthoRef.current = drawingSnapOrtho;
  }, [activeDrawingTool, isDrawingStroke, drawingStartPoint, drawingCurrentPoint, drawingSnapOrtho]);

  // Mobile & Desktop Drag and Drop State
  const [draggingItem, setDraggingItem] = useState<DraggableItemType | null>(null);
  const [dragPos, setDragPos] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [hoveredCell, setHoveredCell] = useState<CabinetCell | null>(null);
  const [sweptCells, setSweptCells] = useState<CabinetCell[]>([]);

  const draggingItemRef = useRef<DraggableItemType | null>(null);
  const hoveredCellRef = useRef<CabinetCell | null>(null);
  const sweptCellsRef = useRef<CabinetCell[]>([]);
  const rafIdRef = useRef<number | null>(null);

  // Keypad Modal State
  const [keypadConfig, setKeypadConfig] = useState<{
    isOpen: boolean;
    title: string;
    unit?: string;
    value: number;
    min?: number;
    max?: number;
    step?: number;
    onConfirm: (val: number) => void;
  }>({
    isOpen: false,
    title: '',
    value: 0,
    onConfirm: () => {},
  });

  // Subscribe to CadStore state updates
  useEffect(() => {
    const unsubscribe = cadStore.subscribe(() => {
      const nextState = cadStore.getState();
      setState({ ...nextState });
    });
    return unsubscribe;
  }, []);

  // Initialize Three.js Engine
  useEffect(() => {
    if (!canvasContainerRef.current) return;

    const engine = new ThreeEngine(canvasContainerRef.current);
    engineRef.current = engine;

    // Handle 3D object selection
    engine.onSelectObject = (objectId, isMulti) => {
      if (activeDrawingToolRef.current) return;
      cadStore.selectObject(objectId, isMulti);
    };

    // Initial 3D sync
    const curState = cadStore.getState();
    engine.syncObjects(curState.objects, new Set(curState.selectedIds));
    engine.setRenderMode(curState.renderMode, curState.objects, new Set(curState.selectedIds));

    const handleResize = () => {
      engine.handleResize();
    };
    window.addEventListener('resize', handleResize);
    window.addEventListener('orientationchange', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('orientationchange', handleResize);
      engine.destroy();
      engineRef.current = null;
    };
  }, []);

  // Sync state changes to 3D Scene
  useEffect(() => {
    if (engineRef.current) {
      engineRef.current.syncObjects(state.objects, new Set(state.selectedIds));
    }
  }, [state.objects, state.selectedIds]);

  // Handle Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore when typing in an input
      if (['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement)?.tagName)) {
        return;
      }

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (e.shiftKey) {
          cadStore.redo();
        } else {
          cadStore.undo();
        }
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') {
        e.preventDefault();
        cadStore.redo();
      } else if (e.key === 'Delete' || e.key === 'Backspace') {
        if (state.selectedIds.length > 0) {
          e.preventDefault();
          cadStore.deleteSelected();
        }
      } else if (e.key === 'Escape') {
        if (activeDrawingTool) {
          handleCancelDrawing();
        } else if (isMarqueeSelectActive) {
          setIsMarqueeSelectActive(false);
          if (engineRef.current) {
            engineRef.current.setControlsEnabled(true);
          }
        } else {
          cadStore.deselectAll();
        }
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'a') {
        e.preventDefault();
        cadStore.selectAll();
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'g') {
        e.preventDefault();
        if (e.shiftKey) {
          cadStore.ungroupSelected();
        } else {
          cadStore.createGroupFromSelection();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [state.selectedIds, isMarqueeSelectActive, activeDrawingTool]);

  // ===================== WALL / BEAM / COLUMN DRAWING ENGINE =====================

  const handleStartDrawing = (tool: 'wall' | 'beam' | 'column') => {
    setActiveDrawingTool(tool);
    setIsDrawingStroke(false);
    setDrawingStartPoint(null);
    setDrawingCurrentPoint(null);
    setIsTopDownView(true);

    if (engineRef.current) {
      engineRef.current.switchToTopDownView();
    }

    const toolName = tool === 'wall' ? 'Duvar' : tool === 'beam' ? 'Kiriş' : 'Kolon';
    cadStore.notifyUser(
      `✏️ ${toolName} Çizim Modu: Sahne zeminine dokunup sürükleyerek eş zamanlı ${toolName.toLowerCase()} çizin.`,
      'info'
    );
  };

  const handleCancelDrawing = () => {
    if (engineRef.current) {
      engineRef.current.hideDrawingPreview();
      engineRef.current.restoreCameraState();
      engineRef.current.setControlsEnabled(true);
    }
    setActiveDrawingTool(null);
    setIsDrawingStroke(false);
    setDrawingStartPoint(null);
    setDrawingCurrentPoint(null);
    cadStore.notifyUser('Çizim modu kapatıldı', 'info');
  };

  const handleToggleDrawingCamera = () => {
    if (!engineRef.current) return;
    if (isTopDownView) {
      engineRef.current.setCameraPreset('iso');
      engineRef.current.setCameraMode('perspective');
      setIsTopDownView(false);
    } else {
      engineRef.current.switchToTopDownView();
      setIsTopDownView(true);
    }
  };

  // Toggle Marquee Box Selection Mode
  const handleToggleMarqueeSelect = () => {
    setIsMarqueeSelectActive((prev) => {
      const next = !prev;
      if (engineRef.current) {
        engineRef.current.setControlsEnabled(!next);
      }
      if (next) {
        cadStore.notifyUser(
          'Toplu Seçim Modu: Ekranda sürükleyerek seçim çerçevesi çizin.',
          'info'
        );
      }
      return next;
    });
  };

  // Canvas pointer down for drawing wall/beam/column or marquee selection
  const handleCanvasPointerDown = (e: React.PointerEvent) => {
    // Allow right-click and middle-click to pan freely in 2D and 3D views
    if (e.button !== 0 && e.pointerType === 'mouse') return;

    if (activeDrawingToolRef.current && engineRef.current) {
      const hit = engineRef.current.raycastGroundPlane(e.clientX, e.clientY);
      if (hit) {
        // Snap start point to 50mm grid
        const snapX = Math.round(hit.x / 50) * 50;
        const snapZ = Math.round(hit.z / 50) * 50;
        const pt = { x: snapX, y: 0, z: snapZ };

        setDrawingStartPoint(pt);
        setDrawingCurrentPoint(pt);
        setIsDrawingStroke(true);
        drawingStartPointRef.current = pt;
        drawingCurrentPointRef.current = pt;
        isDrawingStrokeRef.current = true;

        if (navigator.vibrate) navigator.vibrate(12);
      }
      return;
    }

    if (!isMarqueeSelectActive) return;

    marqueeStartRef.current = { x: e.clientX, y: e.clientY };
    setMarqueeBox({
      startX: e.clientX,
      startY: e.clientY,
      currentX: e.clientX,
      currentY: e.clientY,
    });
  };

  // Window pointer listeners for marquee selection & real-time drawing
  useEffect(() => {
    const handleWindowPointerMove = (e: PointerEvent) => {
      // 1. Live Wall / Beam / Column Interactive Stroke Drawing
      if (activeDrawingToolRef.current && isDrawingStrokeRef.current && drawingStartPointRef.current && engineRef.current) {
        const hit = engineRef.current.raycastGroundPlane(e.clientX, e.clientY);
        if (hit) {
          const start = drawingStartPointRef.current;
          let snapX = Math.round(hit.x / 50) * 50;
          let snapZ = Math.round(hit.z / 50) * 50;

          // Apply Ortho 45°/90° Angle Snapping if enabled
          if (drawingSnapOrthoRef.current && activeDrawingToolRef.current !== 'column') {
            const dx = snapX - start.x;
            const dz = snapZ - start.z;
            const dist = Math.hypot(dx, dz);

            if (dist > 30) {
              const angleRad = Math.atan2(dz, dx);
              // Snap angle to nearest 45 degrees (PI / 4)
              const snapAngle = Math.round(angleRad / (Math.PI / 4)) * (Math.PI / 4);
              snapX = Math.round((start.x + dist * Math.cos(snapAngle)) / 50) * 50;
              snapZ = Math.round((start.z + dist * Math.sin(snapAngle)) / 50) * 50;
            }
          }

          const cur = { x: snapX, y: 0, z: snapZ };
          drawingCurrentPointRef.current = cur;
          setDrawingCurrentPoint(cur);

          const tool = activeDrawingToolRef.current;
          const h = tool === 'wall' ? drawnWallHeight : tool === 'beam' ? drawnBeamHeight : drawnColumnHeight;
          const th = tool === 'wall' ? drawnWallThickness : tool === 'beam' ? drawnBeamThickness : 400;

          engineRef.current.showDrawingPreview(tool, start, cur, h, th);
        }
        return;
      }

      // 2. Marquee Box Move
      if (!isMarqueeSelectActive || !marqueeStartRef.current) return;
      setMarqueeBox({
        startX: marqueeStartRef.current.x,
        startY: marqueeStartRef.current.y,
        currentX: e.clientX,
        currentY: e.clientY,
      });
    };

    const handleWindowPointerUp = (e: PointerEvent) => {
      // 1. Finish Wall / Beam / Column Interactive Stroke Drawing
      if (activeDrawingToolRef.current && isDrawingStrokeRef.current && drawingStartPointRef.current && drawingCurrentPointRef.current) {
        const start = drawingStartPointRef.current;
        const end = drawingCurrentPointRef.current;
        const tool = activeDrawingToolRef.current;

        const dist = Math.hypot(end.x - start.x, end.z - start.z);

        if (dist >= 100) {
          if (tool === 'wall') {
            const wall = CabinetFactory.createWallFromPoints(start, end, drawnWallHeight, drawnWallThickness);
            cadStore.addDrawnArchitecturalElement(wall);
          } else if (tool === 'beam') {
            const beam = CabinetFactory.createBeamFromPoints(start, end, drawnBeamHeight, drawnBeamThickness, 2400);
            cadStore.addDrawnArchitecturalElement(beam);
          } else if (tool === 'column') {
            const column = CabinetFactory.createColumnFromPoints(start, end, drawnColumnHeight);
            cadStore.addDrawnArchitecturalElement(column);
          }

          if (navigator.vibrate) navigator.vibrate([20, 30, 20]);

          // Automatically return to standard 3D isometric view smoothly
          if (engineRef.current) {
            engineRef.current.hideDrawingPreview();
            engineRef.current.restoreCameraState();
          }
          setActiveDrawingTool(null);
        } else {
          cadStore.notifyUser('Çizim çok kısa olduğu için iptal edildi. En az 100mm sürükleyiniz.', 'info');
          if (engineRef.current) {
            engineRef.current.hideDrawingPreview();
          }
        }

        setIsDrawingStroke(false);
        setDrawingStartPoint(null);
        setDrawingCurrentPoint(null);
        isDrawingStrokeRef.current = false;
        drawingStartPointRef.current = null;
        drawingCurrentPointRef.current = null;
        return;
      }

      // 2. Marquee Box Complete
      if (!isMarqueeSelectActive || !marqueeStartRef.current) return;
      const start = marqueeStartRef.current;
      marqueeStartRef.current = null;
      setMarqueeBox(null);

      const dx = Math.abs(e.clientX - start.x);
      const dy = Math.abs(e.clientY - start.y);

      if (dx > 6 || dy > 6) {
        if (engineRef.current) {
          const rect = {
            left: Math.min(start.x, e.clientX),
            top: Math.min(start.y, e.clientY),
            right: Math.max(start.x, e.clientX),
            bottom: Math.max(start.y, e.clientY),
          };
          const ids = engineRef.current.getObjectsInScreenRect(rect);
          if (ids.length > 0) {
            cadStore.selectMultipleObjects(ids);
          } else {
            cadStore.deselectAll();
            cadStore.notifyUser('Çerçeve içinde parça bulunamadı', 'warning');
          }
        }
      }
    };

    window.addEventListener('pointermove', handleWindowPointerMove);
    window.addEventListener('pointerup', handleWindowPointerUp);
    window.addEventListener('pointercancel', handleWindowPointerUp);

    return () => {
      window.removeEventListener('pointermove', handleWindowPointerMove);
      window.removeEventListener('pointerup', handleWindowPointerUp);
      window.removeEventListener('pointercancel', handleWindowPointerUp);
    };
  }, [isMarqueeSelectActive, drawnWallHeight, drawnWallThickness, drawnBeamHeight, drawnBeamThickness, drawnColumnHeight]);

  // High-performance Mobile & Desktop Pointer Drag Start
  const handlePointerDragStart = useCallback((type: DraggableItemType, startX: number, startY: number) => {
    setDraggingItem(type);
    setDragPos({ x: startX, y: startY });
    setHoveredCell(null);
    setSweptCells([]);
    draggingItemRef.current = type;
    hoveredCellRef.current = null;
    sweptCellsRef.current = [];

    if (navigator.vibrate) {
      navigator.vibrate(12);
    }
  }, []);

  // Window Event Listeners for Smooth Drag Tracking & 3D Multi-Cell Sweeping
  useEffect(() => {
    if (!draggingItem) return;

    const isDoorItem = draggingItem.startsWith('door_');
    const isSlidingDoorItem = draggingItem === 'door_sliding';

    const handlePointerMove = (e: PointerEvent) => {
      if (rafIdRef.current) cancelAnimationFrame(rafIdRef.current);

      rafIdRef.current = requestAnimationFrame(() => {
        setDragPos({ x: e.clientX, y: e.clientY });

        if (!engineRef.current) return;

        const allCells = cadStore.getAllCells();
        const detectedCell = engineRef.current.findCellAtScreenPos(e.clientX, e.clientY, allCells);

        if (isDoorItem) {
          const currentObjects = cadStore.getState().objects;
          const isEligible = detectedCell
            ? (isSlidingDoorItem || CellDetector.isCellEligibleForDoor(detectedCell, currentObjects)) &&
              !CellDetector.isCellCoveredByDoor(detectedCell, currentObjects)
            : false;

          if (detectedCell && isEligible) {
            hoveredCellRef.current = detectedCell;
            setHoveredCell(detectedCell);
            const exists = sweptCellsRef.current.some((c) => c.id === detectedCell.id);
            if (!exists) {
              const firstCabinetId = sweptCellsRef.current[0]?.cabinetId;
              if (!firstCabinetId || detectedCell.cabinetId === firstCabinetId) {
                const updated = [...sweptCellsRef.current, detectedCell];
                sweptCellsRef.current = updated;
                setSweptCells(updated);
                engineRef.current.highlightMultiCells(updated);
                if (navigator.vibrate) navigator.vibrate(12);
              }
            }
            if (sweptCellsRef.current.length <= 1) {
              engineRef.current.highlightCell(detectedCell);
            }
          } else if (hoveredCellRef.current) {
            hoveredCellRef.current = null;
            setHoveredCell(null);
            engineRef.current.highlightCell(null);
          }
        } else if (detectedCell?.id !== hoveredCellRef.current?.id) {
          hoveredCellRef.current = detectedCell;
          setHoveredCell(detectedCell);
          engineRef.current.highlightCell(detectedCell);

          if (detectedCell && navigator.vibrate) {
            navigator.vibrate(10);
          }
        }
      });
    };

    const handlePointerUp = (e: PointerEvent) => {
      if (rafIdRef.current) cancelAnimationFrame(rafIdRef.current);

      const itemType = draggingItemRef.current;
      const targetCell = hoveredCellRef.current;
      const currentSweptCells = sweptCellsRef.current;
      const releaseCell =
        targetCell ||
        (itemType?.startsWith('door_') && engineRef.current
          ? engineRef.current.findCellAtScreenPos(e.clientX, e.clientY, cadStore.getAllCells())
          : null);

      if (itemType) {
        if (itemType === 'door_sliding' && targetCell) {
          setSlidingDoorCell(targetCell);
        } else if (itemType.startsWith('door_') && (currentSweptCells.length > 0 || releaseCell)) {
          // Multi-cell door creation spanning all valid swept cells (excluding any with existing doors)
          const doorCandidates = currentSweptCells.length > 0 ? currentSweptCells : [releaseCell];
          const validSwept = doorCandidates.filter(
            (c): c is CabinetCell =>
              Boolean(c) &&
              !CellDetector.isCellCoveredByDoor(c, cadStore.getState().objects) &&
              CellDetector.isCellEligibleForDoor(c, cadStore.getState().objects)
          );

          if (validSwept.length > 0) {
            const doorType =
              itemType === 'door_double'
                ? 'double'
                : itemType === 'door_single_right'
                ? 'single_right'
                : 'single_left';

            if (validSwept.length > 1) {
              cadStore.addDoorToMultiCells(validSwept, doorType);
            } else {
              cadStore.addDoorToActiveCell(doorType, validSwept[0]);
            }
            if (navigator.vibrate) navigator.vibrate([15, 30, 15]);
          } else {
            cadStore.notifyUser('Kapak yalnızca iç çekmeceli hücrelere eklenebilir.', 'warning');
          }
        } else if (targetCell) {
          // Drop onto specific 3D detected cell
          switch (itemType) {
            case 'shelf':
              cadStore.addShelfToActiveCell(targetCell);
              break;
            case 'divider':
              cadStore.addDividerToActiveCell(targetCell);
              break;
            case 'drawer':
              cadStore.addDrawerToActiveCell(targetCell, undefined, 1, 'outer');
              break;
            case 'drawer_inner':
              cadStore.addDrawerToActiveCell(targetCell, undefined, 1, 'inner');
              break;
            case 'door_single_left':
              cadStore.addDoorToActiveCell('single_left', targetCell);
              break;
            case 'door_single_right':
              cadStore.addDoorToActiveCell('single_right', targetCell);
              break;
            case 'door_double':
              cadStore.addDoorToActiveCell('double', targetCell);
              break;
            case 'acc_hanging_rail':
              cadStore.addAccessoryToActiveCell('hanging_rail', targetCell);
              break;
            case 'acc_wardrobe_lift':
              cadStore.addAccessoryToActiveCell('wardrobe_lift', targetCell);
              break;
            case 'acc_pant_rack':
              cadStore.addAccessoryToActiveCell('pant_rack', targetCell);
              break;
            case 'acc_tie_rack':
              cadStore.addAccessoryToActiveCell('tie_rack', targetCell);
              break;
            case 'acc_wire_basket':
              cadStore.addAccessoryToActiveCell('wire_basket', targetCell);
              break;
            case 'acc_led_profile':
              cadStore.addAccessoryToActiveCell('led_profile', targetCell);
              break;
            case 'dacc_cutlery_tray':
              cadStore.addDrawerAccessoryToSelected('cutlery_tray');
              break;
            case 'dacc_jewelry_tray':
              cadStore.addDrawerAccessoryToSelected('jewelry_tray');
              break;
            case 'dacc_drawer_organizer':
              cadStore.addDrawerAccessoryToSelected('drawer_organizer');
              break;
            case 'plinth':
              cadStore.addPlinthOrLegs('plinth', targetCell.cabinetId);
              break;
            case 'legs':
              cadStore.addPlinthOrLegs('legs', targetCell.cabinetId);
              break;
            case 'window':
            case 'room_door':
              cadStore.addArchitecturalElement(itemType);
              break;
          }
          if (navigator.vibrate) {
            navigator.vibrate([15, 30, 15]);
          }
        } else {
          // Dropped in 3D viewport without specific cell
          if (itemType.startsWith('dacc_')) {
            const accType = itemType.replace('dacc_', '') as any;
            cadStore.addDrawerAccessoryToSelected(accType);
          } else if (['window', 'room_door'].includes(itemType)) {
            cadStore.addArchitecturalElement(itemType as any);
          } else if (itemType === 'plinth') {
            cadStore.addPlinthOrLegs('plinth');
          } else if (itemType === 'legs') {
            cadStore.addPlinthOrLegs('legs');
          } else {
            cadStore.notifyUser(
              'Parçayı dolap içine yerleştirmek için dolap gözünün üzerine bırakınız.',
              'info'
            );
          }
        }
      }

      // Cleanup drag state
      setDraggingItem(null);
      setHoveredCell(null);
      setSweptCells([]);
      draggingItemRef.current = null;
      hoveredCellRef.current = null;
      sweptCellsRef.current = [];

      if (engineRef.current) {
        engineRef.current.highlightCell(null);
        engineRef.current.highlightMultiCells([]);
      }
    };

    window.addEventListener('pointermove', handlePointerMove, { passive: true });
    window.addEventListener('pointerup', handlePointerUp);
    window.addEventListener('pointercancel', handlePointerUp);

    return () => {
      if (rafIdRef.current) cancelAnimationFrame(rafIdRef.current);
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
      window.removeEventListener('pointercancel', handlePointerUp);
    };
  }, [draggingItem]);

  // Helper to open numeric keypad
  const handleOpenKeypad = (
    title: string,
    value: number,
    onConfirm: (val: number) => void,
    min = 1,
    max = 5000,
    unit = 'mm'
  ) => {
    setKeypadConfig({
      isOpen: true,
      title,
      unit,
      value,
      min,
      max,
      onConfirm,
    });
  };

  // Switch Render Mode
  const handleSetRenderMode = (mode: RenderMode) => {
    cadStore.setRenderMode(mode);
    if (engineRef.current) {
      engineRef.current.setRenderMode(mode, state.objects, new Set(state.selectedIds));
    }
  };

  // Switch Camera Mode (Perspective / Orthographic)
  const handleSetCameraMode = (mode: CameraMode) => {
    cadStore.setCameraMode(mode);
    if (engineRef.current) {
      engineRef.current.setCameraMode(mode);
    }
  };

  // Switch Camera Preset
  const handleSetCameraPreset = (preset: CameraPreset) => {
    if (engineRef.current) {
      engineRef.current.setCameraPreset(preset);
    }
  };

  // Save Project as JSON file
  const handleSaveProject = () => {
    const json = cadStore.exportProjectJSON();
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${state.projectName.replace(/\s+/g, '_')}_Proje.moducad`;
    a.click();
    URL.revokeObjectURL(url);
    cadStore.notifyUser('Proje dosyası başarıyla indirildi', 'success');
  };

  // Export 3D Render as PNG
  const handleExportImage = () => {
    if (!engineRef.current) return;
    const dataUrl = engineRef.current.captureScreenshot();
    const a = document.createElement('a');
    a.href = dataUrl;
    a.download = `${state.projectName.replace(/\s+/g, '_')}_Render.png`;
    a.click();
    cadStore.notifyUser('3D Görsel (Render) indirildi', 'success');
  };

  // Helper icon renderer for dragging badge
  const renderItemIcon = (type: DraggableItemType) => {
    switch (type) {
      case 'shelf':
        return <Rows className="w-5 h-5 text-blue-400" />;
      case 'divider':
        return <Columns className="w-5 h-5 text-indigo-400" />;
      case 'drawer':
        return <Archive className="w-5 h-5 text-emerald-400" />;
      case 'drawer_inner':
        return <Archive className="w-5 h-5 text-amber-400" />;
      case 'door_single_left':
      case 'door_single_right':
      case 'door_double':
      case 'room_door':
        return <DoorClosed className="w-5 h-5 text-amber-400" />;
      case 'acc_hanging_rail':
      case 'acc_wardrobe_lift':
        return <Sparkles className="w-5 h-5 text-sky-400" />;
      case 'acc_pant_rack':
      case 'acc_tie_rack':
      case 'acc_wire_basket':
      case 'acc_led_profile':
        return <Sparkles className="w-5 h-5 text-purple-400" />;
      case 'dacc_cutlery_tray':
      case 'dacc_jewelry_tray':
      case 'dacc_drawer_organizer':
        return <Sparkles className="w-5 h-5 text-amber-400" />;
      case 'plinth':
      case 'window':
        return <Grid className="w-5 h-5 text-emerald-400" />;
      case 'legs':
        return <Footprints className="w-5 h-5 text-emerald-400" />;
      case 'wall':
      case 'column':
      case 'beam':
        return <Building className="w-5 h-5 text-sky-400" />;
      default:
        return <Layers className="w-5 h-5 text-blue-400" />;
    }
  };

  const hasSelection = state.selectedIds.length > 0;
  const selectedObjects = state.objects.filter((o) => state.selectedIds.includes(o.id));

  const handleToggleEditInspector = () => {
    setIsInspectorOpen(!isInspectorOpen);
  };

  // Drawing dynamic dimension calculations for HUD
  const currentDrawLength =
    drawingStartPoint && drawingCurrentPoint
      ? Math.round(Math.hypot(drawingCurrentPoint.x - drawingStartPoint.x, drawingCurrentPoint.z - drawingStartPoint.z))
      : 0;

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-slate-950 font-sans select-none">
      {/* 3D WebGL Canvas Viewport */}
      <div
        ref={canvasContainerRef}
        onPointerDown={handleCanvasPointerDown}
        className={`w-full h-full absolute inset-0 touch-none ${
          activeDrawingTool ? 'cursor-crosshair' : isMarqueeSelectActive ? 'cursor-crosshair' : 'cursor-default'
        }`}
      />

      {/* Real-Time Architectural Drawing Top HUD Banner */}
      {activeDrawingTool && (
        <div className="fixed top-14 left-1/2 -translate-x-1/2 z-40 flex flex-col sm:flex-row items-center gap-2 p-2 px-3 sm:px-4 rounded-2xl bg-slate-900/95 border border-sky-500/80 text-white shadow-2xl backdrop-blur-xl animate-in slide-in-from-top-3 max-w-[96vw]">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-xl bg-sky-500/20 text-sky-400">
              <PencilRuler className="w-4 h-4 animate-pulse" />
            </div>
            <div>
              <div className="text-xs font-bold text-sky-200 flex items-center gap-1.5">
                <span>{activeDrawingTool === 'wall' ? 'Duvar Çizimi' : activeDrawingTool === 'beam' ? 'Kiriş Çizimi' : 'Kolon Çizimi'}</span>
                <span className="text-[10px] px-1.5 py-0.2 bg-sky-500/30 text-sky-300 rounded font-mono">
                  {isDrawingStroke ? `${currentDrawLength} mm` : 'Zemine dokunup sürükleyin'}
                </span>
              </div>
              <div className="text-[10px] text-slate-400 hidden sm:block">
                Dokunmayı bırakınca otomatik oluşup 3D'ye geçer
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1.5 border-t sm:border-t-0 sm:border-l border-slate-800 pt-1.5 sm:pt-0 sm:pl-2">
            {/* Ortho Snap 45/90 button */}
            <button
              onClick={() => setDrawingSnapOrtho(!drawingSnapOrtho)}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium transition ${
                drawingSnapOrtho
                  ? 'bg-sky-600/30 border border-sky-400 text-sky-200'
                  : 'bg-slate-800 text-slate-400 hover:text-slate-200'
              }`}
              title="Açı Kilidi (0°, 45°, 90°, 180° Düz Çizim)"
            >
              <Magnet className="w-3.5 h-3.5" />
              <span>Ortho</span>
            </button>

            {/* 2D Kuş Bakışı / 3D Görünüm Toggle */}
            <button
              onClick={handleToggleDrawingCamera}
              className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-200 transition"
              title="Kuş Bakışı (2D Plan) ile 3D Görünüm arasında geçiş yapın"
            >
              <Eye className="w-3.5 h-3.5 text-sky-400" />
              <span>{isTopDownView ? '2D Kuş Bakışı' : '3D Görünüm'}</span>
            </button>

            {/* Cancel Button */}
            <button
              onClick={handleCancelDrawing}
              className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-red-500/20 hover:bg-red-500/30 text-red-300 text-xs font-medium transition"
            >
              <X className="w-3.5 h-3.5" />
              <span>İptal</span>
            </button>
          </div>
        </div>
      )}

      {/* Marquee Selection Drag Rectangle */}
      {marqueeBox && (
        <div
          className="fixed pointer-events-none z-40 border-2 border-dashed border-cyan-400 bg-blue-500/20 rounded shadow-glow transition-none"
          style={{
            left: `${Math.min(marqueeBox.startX, marqueeBox.currentX)}px`,
            top: `${Math.min(marqueeBox.startY, marqueeBox.currentY)}px`,
            width: `${Math.max(1, Math.abs(marqueeBox.currentX - marqueeBox.startX))}px`,
            height: `${Math.max(1, Math.abs(marqueeBox.currentY - marqueeBox.startY))}px`,
          }}
        >
          <div className="absolute -top-7 left-0 px-2 py-0.5 bg-slate-900/95 border border-cyan-400/80 rounded-md text-[10px] font-mono text-cyan-300 font-bold shadow-md flex items-center gap-1 whitespace-nowrap">
            <SquareDashed className="w-3 h-3" />
            <span>Seçim Çerçevesi</span>
          </div>
        </div>
      )}

      {/* Top Banner Guide when Marquee Select is Active */}
      {isMarqueeSelectActive && !activeDrawingTool && (
        <div className="fixed top-14 left-1/2 -translate-x-1/2 z-30 flex items-center gap-2.5 px-4 py-2 rounded-2xl bg-slate-900/95 border border-cyan-500/80 text-white shadow-2xl backdrop-blur-md animate-in slide-in-from-top-3">
          <SquareDashed className="w-4 h-4 text-cyan-400 animate-pulse" />
          <span className="text-xs font-semibold text-cyan-100">
            Toplu Seçim: Ekranda sürükleyerek seçim çerçevesi çizin, ardından "Grup Oluştur"a basın
          </span>
          <button
            onClick={handleToggleMarqueeSelect}
            className="ml-1 px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs text-slate-300 font-medium transition"
          >
            Kapat
          </button>
        </div>
      )}

      {/* Top Header Bar */}
      <HeaderBar
        state={state}
        onAddCabinet={() => cadStore.addCabinet()}
        onUndo={() => cadStore.undo()}
        onRedo={() => cadStore.redo()}
        onSetRenderMode={handleSetRenderMode}
        onSetCameraMode={handleSetCameraMode}
        onSetCameraPreset={handleSetCameraPreset}
        onOpenCuttingModal={() => setIsCuttingModalOpen(true)}
        onOpenCostModal={() => setIsCostModalOpen(true)}
        onOpenHelpModal={() => setIsHelpModalOpen(true)}
        onSaveProject={handleSaveProject}
        onExportImage={handleExportImage}
      />

      {/* Outliner Open Toggle (Floating on left) */}
      {!isOutlinerOpen && !activeDrawingTool && (
        <button
          onClick={() => setIsOutlinerOpen(true)}
          className="fixed top-14 left-3 z-20 p-2.5 rounded-xl bg-slate-900/90 hover:bg-slate-800 text-slate-200 border border-slate-700/80 shadow-xl transition flex items-center gap-1.5 text-xs font-semibold"
          title="Sahne Parça Listesi (Hiyerarşi)"
        >
          <Layers className="w-4 h-4 text-blue-400" />
          <span className="hidden sm:inline">Parçalar ({state.objects.length})</span>
        </button>
      )}

      {/* Outliner Panel */}
      {isOutlinerOpen && (
        <OutlinerPanel
          objects={state.objects}
          selectedIds={state.selectedIds}
          onSelectObject={(id, isMulti) => cadStore.selectObject(id, isMulti)}
          onToggleLock={(id) => {
            const obj = state.objects.find((o) => o.id === id);
            if (obj) cadStore.updateObject(id, { locked: !obj.locked });
          }}
          onToggleVisibility={(id) => {
            const obj = state.objects.find((o) => o.id === id);
            if (obj) cadStore.updateObject(id, { visible: !obj.visible });
          }}
          onDeleteObject={(id) => {
            cadStore.selectObject(id, false);
            cadStore.deleteSelected();
          }}
          onClose={() => setIsOutlinerOpen(false)}
        />
      )}

      {/* Property Inspector Panel - Opens on user request or FAB tap */}
      {isInspectorOpen && (
        <PropertyInspector
          selectedObjects={hasSelection ? selectedObjects : state.objects.slice(0, 1)}
          onUpdateObject={(id, partial) => cadStore.updateObject(id, partial)}
          onUpdateBatch={(partial) => cadStore.updateSelectedObjects(partial)}
          onOpenKeypad={handleOpenKeypad}
          onClose={() => setIsInspectorOpen(false)}
        />
      )}

      {/* Floating Action Button (FAB) for Edit / Settings */}
      {state.objects.length > 0 && !isInspectorOpen && !activeDrawingTool && (
        <div className="fixed right-3.5 sm:right-6 portrait:bottom-[128px] landscape:bottom-5 bottom-[128px] sm:bottom-6 z-30 flex items-center gap-2 animate-in fade-in zoom-in-95">
          <button
            onClick={handleToggleEditInspector}
            className="w-13 h-13 sm:w-14 sm:h-14 rounded-full bg-gradient-to-tr from-blue-600 via-indigo-600 to-blue-500 hover:from-blue-500 hover:to-indigo-500 active:scale-95 text-white shadow-2xl flex items-center justify-center border-2 border-blue-400/60 hover:scale-105 transition-all cursor-pointer group relative shadow-glow"
            title={hasSelection ? `Seçili Parçayı Düzenle (${selectedObjects[0]?.name})` : 'Ölçü & Ayarları Düzenle'}
            aria-label="Düzenle"
          >
            <Pencil className="w-5 h-5 sm:w-6 sm:h-6 text-white group-hover:rotate-12 transition-transform" />
            {hasSelection && (
              <span className="absolute -top-1 -right-1 w-5 h-5 bg-emerald-500 text-white text-[11px] font-bold rounded-full flex items-center justify-center border-2 border-slate-900 shadow-sm animate-pulse">
                {selectedObjects.length}
              </span>
            )}
          </button>
        </div>
      )}

      {/* Floating Bottom Toolbox */}
      <FloatingToolbox
        state={state}
        isMarqueeSelectActive={isMarqueeSelectActive}
        activeDrawingTool={activeDrawingTool}
        onToggleMarqueeSelect={handleToggleMarqueeSelect}
        onStartDrawing={handleStartDrawing}
        onCancelDrawing={handleCancelDrawing}
        onAddShelf={() => cadStore.addShelfToActiveCell()}
        onAddDivider={() => cadStore.addDividerToActiveCell()}
        onAddDrawer={(placement) => cadStore.addDrawerToActiveCell(undefined, undefined, 1, placement || 'outer')}
        onAddDrawerWithCount={(count, placement) => cadStore.addMultipleDrawersToActiveCell(count, undefined, undefined, placement || 'outer')}
        onAddDoor={(type) => cadStore.addDoorToActiveCell(type)}
        onAddSlidingDoor={() => {
          const cell = cadStore.getActiveOrSelectedCell();
          if (cell) setSlidingDoorCell(cell);
          else cadStore.notifyUser('Ray kapak eklemek için bir dolap gözü seçin veya üzerine bırakın', 'warning');
        }}
        onAddAccessory={(type) => cadStore.addAccessoryToActiveCell(type)}
        onAddDrawerAccessory={(type) => cadStore.addDrawerAccessoryToSelected(type)}
        onAddPlinth={() => cadStore.addPlinthOrLegs('plinth')}
        onAddLegs={() => cadStore.addPlinthOrLegs('legs')}
        onAddArchitectural={(type) => {
          if (type === 'wall' || type === 'beam' || type === 'column') {
            handleStartDrawing(type);
          } else {
            cadStore.addArchitecturalElement(type);
          }
        }}
        onCreateGroup={() => cadStore.createGroupFromSelection()}
        onUngroup={() => cadStore.ungroupSelected()}
        onToggleLock={() => cadStore.toggleLockSelected()}
        onDeleteSelected={() => cadStore.deleteSelected()}
        onPointerDragStart={handlePointerDragStart}
        onTrimWalls={() => cadStore.autoTrimAllWalls()}
      />

      {/* Mobile & Desktop High-Performance Floating Drag Ghost Badge */}
      {draggingItem && (
        <div
          className="fixed pointer-events-none z-50 -translate-x-1/2 -translate-y-1/2 will-change-transform flex flex-col items-center gap-1.5 drop-shadow-2xl"
          style={{
            left: `${dragPos.x}px`,
            top: `${dragPos.y}px`,
          }}
        >
          <div className="flex items-center gap-2 px-3.5 py-2 rounded-2xl bg-slate-900/95 border-2 border-blue-400/80 shadow-2xl backdrop-blur-md text-white font-semibold text-xs scale-105">
            <div className="p-1.5 rounded-xl bg-slate-800 border border-slate-700 text-white">
              {renderItemIcon(draggingItem)}
            </div>
            <span>{ITEM_METADATA[draggingItem]?.label || draggingItem}</span>
          </div>

          {sweptCells.length > 1 ? (
            <div className="px-3 py-1 rounded-full bg-amber-600/95 border border-amber-400 text-white font-bold text-[11px] shadow-xl flex items-center gap-1.5 animate-pulse">
              <Sparkles className="w-3.5 h-3.5 text-yellow-300" />
              <span>{sweptCells.length} Hücre Seçildi — Bırakınca Tek Kapak Oluşur</span>
            </div>
          ) : hoveredCell ? (
            <div className="px-3 py-1 rounded-full bg-emerald-600/95 border border-emerald-400 text-white font-bold text-[11px] shadow-xl flex items-center gap-1.5 animate-bounce">
              <Sparkles className="w-3.5 h-3.5 text-yellow-300" />
              <span>Göz Algılandı — Bırakın ({hoveredCell.width}x{hoveredCell.height}mm)</span>
            </div>
          ) : (
            <div className="px-2.5 py-0.5 rounded-full bg-slate-800/90 border border-slate-700 text-slate-300 font-medium text-[10px] shadow">
              🎯 Dolap gözü üzerine sürükleyin
            </div>
          )}
        </div>
      )}

      {/* Auto Group Toast Recommendation */}
      <AutoGroupToast
        recommendation={state.autoGroupRecommendation}
        onAccept={() => cadStore.createGroupFromSelection()}
        onDismiss={() => cadStore.selectObject(null)}
      />

      {/* Toast Notification */}
      <ToastNotification
        notification={state.notification}
        onClose={() => cadStore.clearNotification()}
      />

      {/* Numeric Keypad Modal for Precise Touch Input */}
      <NumericKeypadModal
        isOpen={keypadConfig.isOpen}
        title={keypadConfig.title}
        unit={keypadConfig.unit}
        initialValue={keypadConfig.value}
        min={keypadConfig.min}
        max={keypadConfig.max}
        step={keypadConfig.step}
        onConfirm={keypadConfig.onConfirm}
        onClose={() => setKeypadConfig((prev) => ({ ...prev, isOpen: false }))}
      />

      <SlidingDoorOptionsModal
        isOpen={Boolean(slidingDoorCell)}
        cellLabel={slidingDoorCell ? `${slidingDoorCell.width}x${slidingDoorCell.height} mm göz` : undefined}
        {...slidingDoorOptions}
        onChange={(changes) => setSlidingDoorOptions((current) => ({ ...current, ...changes }))}
        onConfirm={() => {
          if (slidingDoorCell) cadStore.addSlidingDoorToCell(slidingDoorCell, slidingDoorOptions);
          setSlidingDoorCell(null);
        }}
        onClose={() => setSlidingDoorCell(null)}
      />

      {/* Ebatlama & CNC Modal */}
      <CuttingOptimizationModal
        isOpen={isCuttingModalOpen}
        objects={state.objects}
        onClose={() => setIsCuttingModalOpen(false)}
      />

      {/* Cost Breakdown & BOM Report Modal */}
      <CostReportModal
        isOpen={isCostModalOpen}
        objects={state.objects}
        projectName={state.projectName}
        onClose={() => setIsCostModalOpen(false)}
      />

      {/* Help & Guide Modal */}
      <HelpGuideModal
        isOpen={isHelpModalOpen}
        onClose={() => setIsHelpModalOpen(false)}
      />
    </div>
  );
};
