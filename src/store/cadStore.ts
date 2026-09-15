import {
  SceneObject,
  CabinetCell,
  RenderMode,
  CameraMode,
  CameraPreset,
  MaterialConfig,
  Vector3D,
  HistoryAction,
  CabinetAccessoryType,
  DrawerAccessoryType,
  SlidingDoorMetadata,
} from '../types/cad';
import { CabinetFactory } from '../engine/CabinetFactory';
import { CellDetector } from '../engine/CellDetector';
import { CollisionDetector, SnapResult } from '../engine/CollisionDetector';
import { WallTrimmer } from '../engine/WallTrimmer';
import { DEFAULT_MATERIALS } from '../constants/materials';

export interface CadState {
  projectName: string;
  objects: SceneObject[];
  selectedIds: string[];
  groups: { id: string; name: string; memberIds: string[] }[];
  history: HistoryAction[];
  historyIndex: number;
  renderMode: RenderMode;
  cameraMode: CameraMode;
  cameraPreset: CameraPreset;
  activeCell: CabinetCell | null;
  autoGroupRecommendation: { cabinetId: string; partIds: string[] } | null;
  notification: { message: string; type: 'info' | 'success' | 'warning' } | null;
}

const STORAGE_KEY = '3D_CABINET_CAD_STUDIO_V1';

export class CadStore {
  private state: CadState;
  private listeners: Set<() => void> = new Set();

  constructor() {
    this.state = this.loadInitialState();
  }

  private loadInitialState(): CadState {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed && Array.isArray(parsed.objects) && parsed.objects.length > 0) {
          const normalizedObjects = this.normalizeDrawerFrontAlignment(parsed.objects);
          localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...parsed, objects: normalizedObjects }));
          return {
            projectName: parsed.projectName || 'Özel Dolap Tasarımı',
            objects: normalizedObjects,
            selectedIds: [],
            groups: parsed.groups || [],
            history: [{ description: 'Başlangıç', timestamp: Date.now(), objects: normalizedObjects, groups: [] }],
            historyIndex: 0,
            renderMode: 'realistic',
            cameraMode: 'perspective',
            cameraPreset: 'iso',
            activeCell: null,
            autoGroupRecommendation: null,
            notification: null,
          };
        }
      } catch (e) {
        console.error('Failed to load saved CAD state:', e);
      }
    }

    // Initialize with a standard cabinet
    const { cabinetRoot, parts } = CabinetFactory.createCabinet({
      width: 800,
      height: 2000,
      depth: 600,
      position: { x: 0, y: 0, z: 0 },
      material: DEFAULT_MATERIALS[0],
    });

    const initialObjects = [cabinetRoot, ...parts];

    return {
      projectName: 'Özel Dolap Tasarımı 1',
      objects: initialObjects,
      selectedIds: [cabinetRoot.id],
      groups: [],
      history: [{ description: 'İlk Dolap Oluşturuldu', timestamp: Date.now(), objects: initialObjects, groups: [] }],
      historyIndex: 0,
      renderMode: 'realistic',
      cameraMode: 'perspective',
      cameraPreset: 'iso',
      activeCell: null,
      autoGroupRecommendation: null,
      notification: { message: '3D Dolap Tasarım Stüdyosu Hazır!', type: 'success' },
    };
  }

  public getState(): CadState {
    return this.state;
  }

  public subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notify() {
    this.saveToStorage();
    this.listeners.forEach((l) => l());
  }

  private saveToStorage() {
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          projectName: this.state.projectName,
          objects: this.state.objects,
          groups: this.state.groups,
        })
      );
    } catch (e) {
      console.warn('Storage save failed:', e);
    }
  }

  private recordHistory(description: string) {
    const newHistory = this.state.history.slice(0, this.state.historyIndex + 1);
    newHistory.push({
      description,
      timestamp: Date.now(),
      objects: JSON.parse(JSON.stringify(this.state.objects)),
      groups: this.state.groups.map((g) => g.id),
    });

    // Limit history stack size
    if (newHistory.length > 50) {
      newHistory.shift();
    }

    this.state.history = newHistory;
    this.state.historyIndex = newHistory.length - 1;
  }

  // --- ACTIONS ---

  public setProjectName(name: string) {
    this.state.projectName = name;
    this.notify();
  }

  public notifyUser(message: string, type: 'info' | 'success' | 'warning' = 'info') {
    this.state.notification = { message, type };
    this.notify();
  }

  public clearNotification() {
    this.state.notification = null;
    this.notify();
  }

  public setRenderMode(mode: RenderMode) {
    this.state.renderMode = mode;
    this.notify();
  }

  public setCameraMode(mode: CameraMode) {
    this.state.cameraMode = mode;
    this.notify();
  }

  public setCameraPreset(preset: CameraPreset) {
    this.state.cameraPreset = preset;
    this.notify();
  }

  public selectObject(objectId: string | null, isMultiSelect = false) {
    if (!objectId) {
      this.state.selectedIds = [];
      this.state.autoGroupRecommendation = null;
      this.notify();
      return;
    }

    if (isMultiSelect) {
      if (this.state.selectedIds.includes(objectId)) {
        this.state.selectedIds = this.state.selectedIds.filter((id) => id !== objectId);
      } else {
        this.state.selectedIds = [...this.state.selectedIds, objectId];
      }
    } else {
      this.state.selectedIds = [objectId];
    }

    // Check Auto-Group recommendation
    this.checkAutoGroupRecommendation();
    this.notify();
  }

  public selectMultipleObjects(objectIds: string[]) {
    this.state.selectedIds = Array.from(new Set(objectIds));
    this.checkAutoGroupRecommendation();
    if (this.state.selectedIds.length > 0) {
      this.notifyUser(
        `${this.state.selectedIds.length} parça seçildi.${this.state.selectedIds.length > 1 ? ' "Grup Oluştur" butonu ile gruplayabilirsiniz.' : ''}`,
        'info'
      );
    }
    this.notify();
  }

  public selectAll() {
    this.state.selectedIds = this.state.objects.map((o) => o.id);
    this.notify();
  }

  public deselectAll() {
    this.state.selectedIds = [];
    this.state.autoGroupRecommendation = null;
    this.notify();
  }

  private normalizeDrawerFrontAlignment(objects: SceneObject[]): SceneObject[] {
    const cabinets = objects.filter((object) => object.type === 'cabinet');

    return objects.map((object) => {
      if (object.type !== 'drawer' || !object.metadata?.cellId) return object;

      const cabinet = cabinets.find((candidate) => candidate.id === object.parentId);
      if (!cabinet) return object;

      const cells = CellDetector.calculateCabinetCells(cabinet, objects);
      const cell = cells.find(
        (candidate) =>
          object.position.x >= candidate.minX &&
          object.position.x <= candidate.maxX &&
          object.position.y >= candidate.minY &&
          object.position.y <= candidate.maxY
      ) || cells.find((candidate) => candidate.id === object.metadata?.cellId);
      if (!cell) return object;

      return {
        ...object,
        position: {
          ...object.position,
          z: Math.round(
            cell.minZ + object.dimensions.depth / 2 -
            (object.metadata?.drawer?.placement === 'inner' ? 0 : 18)
          ),
        },
      };
    });
  }

  /**
   * Adds a new modular cabinet to the scene at the given position (or origin by default)
   */
  public addCabinet(options?: {
    width?: number;
    height?: number;
    depth?: number;
    position?: Vector3D;
    material?: MaterialConfig;
  }) {
    const { cabinetRoot, parts } = CabinetFactory.createCabinet({
      ...options,
      position: options?.position ?? { x: 0, y: 0, z: 0 },
    });

    const snapResult = CollisionDetector.calculateSnap(cabinetRoot, cabinetRoot.position, this.state.objects);
    const collision = CollisionDetector.checkCollision(cabinetRoot, snapResult.position, this.state.objects);
    if (collision.hasCollision) {
      this.notifyUser(
        collision.collidingWith
          ? `Dolap ${collision.collidingWith.name} ile çakışıyor; iç içe yerleştirilemez.`
          : 'Dolap zeminin veya mevcut bir nesnenin dışına taşamaz.',
        'warning'
      );
      return;
    }

    const positionedRoot = { ...cabinetRoot, position: snapResult.position };
    const dx = positionedRoot.position.x - cabinetRoot.position.x;
    const dy = positionedRoot.position.y - cabinetRoot.position.y;
    const dz = positionedRoot.position.z - cabinetRoot.position.z;
    const positionedParts = parts.map((part) => ({
      ...part,
      position: {
        x: part.position.x + dx,
        y: part.position.y + dy,
        z: part.position.z + dz,
      },
    }));

    this.state.objects = [...this.state.objects, positionedRoot, ...positionedParts];
    this.ensureCabinetGroup(positionedRoot.id);
    this.state.selectedIds = [positionedRoot.id];
    this.recordHistory(`Yeni Dolap Eklendi (${positionedRoot.id})`);
    this.notifyUser(
      snapResult.snapped ? `Yeni Dolap (${positionedRoot.name}) hizalanarak eklendi` : `Yeni Dolap (${positionedRoot.name}) sahneye eklendi`,
      'success'
    );
    this.notify();
  }

  /**
   * Adds a shelf to the currently selected or active cell / cabinet
   */
  public addShelfToActiveCell(customCell?: CabinetCell, material?: MaterialConfig) {
    const targetCell = customCell || this.getActiveOrSelectedCell();
    if (!targetCell) {
      this.notifyUser('Lütfen raf eklemek için dolap içi bir hücre veya dolap seçin', 'warning');
      return;
    }

    const shelf = CabinetFactory.createShelf(targetCell, material);

    // 1. Mükerrer / Duplicate Kontrolü
    if (CabinetFactory.isDuplicateObject(shelf, this.state.objects)) {
      this.notifyUser('Bu konumda zaten aynı ebatta bir raf mevcut! (Mükerrer ekleme engellendi)', 'warning');
      return;
    }

    this.state.objects = [...this.state.objects, shelf];
    this.ensureCabinetGroup(targetCell.cabinetId);
    this.state.selectedIds = [shelf.id];
    this.recordHistory(`Yatay Raf Eklendi (${shelf.id})`);
    this.notifyUser('Yatay raf hücreye yerleştirildi', 'success');
  }

  /**
   * Adds a vertical divider to the active cell / cabinet
   */
  public addDividerToActiveCell(customCell?: CabinetCell, material?: MaterialConfig) {
    const targetCell = customCell || this.getActiveOrSelectedCell();
    if (!targetCell) {
      this.notifyUser('Lütfen dikme eklemek için dolap içi bir alan seçin', 'warning');
      return;
    }

    let divider = CabinetFactory.createDivider(targetCell, material);
    let supportShelf: SceneObject | null = null;

    const existingDrawers = this.state.objects.filter((o) => {
      if (o.type !== 'drawer' || o.parentId !== targetCell.cabinetId) return false;

      const drawerCenterX = o.position.x;
      const drawerCenterY = o.position.y;
      return (
        drawerCenterX >= targetCell.minX &&
        drawerCenterX <= targetCell.maxX &&
        drawerCenterY >= targetCell.minY &&
        drawerCenterY <= targetCell.maxY
      );
    });
    if (existingDrawers.length > 0) {
      const drawerTop = Math.max(
        ...existingDrawers.map((drawer) => drawer.position.y + drawer.dimensions.height / 2)
      );
      const clearance = 3;
      const shelfThickness = 18;
      const shelfBottom = drawerTop + clearance;
      const shelfTop = shelfBottom + shelfThickness;
      const availableHeight = targetCell.maxY - shelfTop;

      if (availableHeight < 100) {
        this.notifyUser('Bu hücrede çekmecelerin üstünde dikme için yeterli boşluk yok.', 'warning');
        return;
      }

      supportShelf = CabinetFactory.createShelf(targetCell, material, shelfThickness);
      supportShelf = {
        ...supportShelf,
        position: {
          ...supportShelf.position,
          y: Math.round(shelfBottom + shelfThickness / 2),
        },
      };

      divider = {
        ...divider,
        position: {
          ...divider.position,
          y: Math.round(shelfTop + availableHeight / 2),
        },
        dimensions: {
          ...divider.dimensions,
          height: Math.round(availableHeight),
        },
      };
    }

    // 1. Mükerrer / Duplicate Kontrolü
    if (CabinetFactory.isDuplicateObject(divider, this.state.objects)) {
      this.notifyUser('Bu konumda zaten aynı ebatta bir dikme mevcut! (Mükerrer ekleme engellendi)', 'warning');
      return;
    }

    const objectsToAdd = supportShelf && !CabinetFactory.isDuplicateObject(supportShelf, this.state.objects)
      ? [supportShelf, divider]
      : [divider];
    this.state.objects = [...this.state.objects, ...objectsToAdd];
    this.ensureCabinetGroup(targetCell.cabinetId);
    this.state.selectedIds = [divider.id];
    this.recordHistory(supportShelf ? `Dikey Dikme ve Üst Raf Eklendi (${divider.id})` : `Dikey Dikme Eklendi (${divider.id})`);
    this.notifyUser(
      supportShelf ? 'Dikey dikme çekmecelerin üstüne raf ile tamamlandı' : 'Dikey dikme bölücü yerleştirildi',
      'success'
    );
  }

  /**
   * Adds a drawer with smart stackable auto-sizing according to remaining cell vertical space.
   * Checks for duplicate and adjusts height up to cell ceiling.
   */
  public addDrawerToActiveCell(
    customCell?: CabinetCell,
    material?: MaterialConfig,
    count = 1,
    placement: 'outer' | 'inner' = 'outer'
  ) {
    const targetCell = customCell || this.getActiveOrSelectedCell();
    if (!targetCell) {
      this.notifyUser('Lütfen çekmece eklemek için dolap içi bir alan seçin', 'warning');
      return;
    }

    if (count > 1) {
      const drawers = CabinetFactory.createMultipleDrawers(targetCell, count, material, placement);
      // Filter out any that already exist
      const nonDuplicates = drawers.filter((d) => !CabinetFactory.isDuplicateObject(d, this.state.objects));
      if (nonDuplicates.length === 0) {
        this.notifyUser('Hücrede bu ebat ve konumda çekmeceler zaten mevcut!', 'warning');
        return;
      }
      this.state.objects = [...this.state.objects, ...nonDuplicates];
      this.ensureCabinetGroup(targetCell.cabinetId);
      this.state.selectedIds = nonDuplicates.map((d) => d.id);
      this.recordHistory(`${count}'lü ${placement === 'inner' ? 'İç Çekmece' : 'Çekmece'} Grubu Eklendi`);
      this.notifyUser(`${count} adet dikey ${placement === 'inner' ? 'iç çekmece' : 'çekmece'} hücreye monte edildi`, 'success');
      this.notify();
      return;
    }

    // Existing drawers in target cell
    const existingDrawers = this.state.objects
      .filter((o) => o.type === 'drawer' && o.metadata?.cellId === targetCell.id)
      .sort((a, b) => a.position.y - b.position.y);

    let drawer: SceneObject;
    const standardDrawerHeight = Math.min(200, targetCell.height);

    if (existingDrawers.length === 0) {
      const startY = targetCell.minY + standardDrawerHeight / 2;
      drawer = CabinetFactory.createDrawer(
        targetCell,
        material,
        standardDrawerHeight,
        0,
        1,
        placement,
        startY
      );
    } else {
      // Stack new drawers from the top edge of the highest existing drawer.
      const highestDrawer = existingDrawers[existingDrawers.length - 1];
      const highestTop = highestDrawer.position.y + highestDrawer.dimensions.height / 2;

      const gap = 3; // 3mm vertical gap between drawers
      const topMargin = 2; // 2mm clearance from cell ceiling
      const remainingHeight = targetCell.maxY - highestTop - gap - topMargin;

      if (remainingHeight < 40) {
        this.notifyUser('Bu hücrede yeni çekmece için yeterli yükseklik kalmadı.', 'warning');
        return;
      }

      // Keep standard height until the remaining space becomes the last drawer.
      const newHeight = Math.min(standardDrawerHeight, remainingHeight);
      const centerY = highestTop + gap + newHeight / 2;
      const nextIdx = existingDrawers.length;

      drawer = CabinetFactory.createDrawer(
        targetCell,
        material,
        newHeight,
        nextIdx,
        nextIdx + 1,
        placement,
        centerY
      );
    }

    // 1. Mükerrer / Duplicate Kontrolü
    if (CabinetFactory.isDuplicateObject(drawer, this.state.objects)) {
      this.notifyUser('Bu konumda aynı ebatta çekmece zaten mevcut! (Mükerrer ekleme engellendi)', 'warning');
      return;
    }

    this.state.objects = [...this.state.objects, drawer];
    this.ensureCabinetGroup(targetCell.cabinetId);
    this.state.selectedIds = [drawer.id];
    this.recordHistory(`${placement === 'inner' ? 'İç Çekmece' : 'Çekmece'} Eklendi (${drawer.id})`);
    this.notifyUser(
      `${placement === 'inner' ? 'İç Çekmece' : 'Çekmece'} kalan tavan boşluğuna göre ayarlanarak monte edildi`,
      'success'
    );
    this.notify();
  }

  /**
   * Adds multiple vertically stacked drawers to the active cell
   */
  public addMultipleDrawersToActiveCell(
    count = 3,
    customCell?: CabinetCell,
    material?: MaterialConfig,
    placement: 'outer' | 'inner' = 'outer'
  ) {
    this.addDrawerToActiveCell(customCell, material, count, placement);
  }

  /**
   * Toggles or sets drawer placement between 'outer' (Dış Çekmece) and 'inner' (İç Çekmece)
   */
  public setDrawerPlacement(drawerId: string, placement: 'outer' | 'inner') {
    const obj = this.state.objects.find((o) => o.id === drawerId);
    if (!obj || obj.type !== 'drawer') return;

    const isInner = placement === 'inner';
    const cellId = obj.metadata?.cellId;
    const allCells = this.getAllCells();
    const cell = allCells.find((c) => c.id === cellId);

    const boxDepth = cell?.depth || obj.dimensions.depth;

    const newWidth = cell?.width || obj.dimensions.width;

    const targetZ = cell
      ? cell.minZ + boxDepth / 2 - (isInner ? 0 : 18)
      : obj.position.z;

    const name = isInner ? obj.name.replace(/^Çekmece/, 'İç Çekmece') : obj.name.replace(/^İç Çekmece/, 'Çekmece');

    this.updateObject(
      drawerId,
      {
        name,
        position: { ...obj.position, z: Math.round(targetZ) },
        dimensions: { ...obj.dimensions, width: newWidth, depth: boxDepth },
        metadata: {
          ...obj.metadata,
          drawer: {
            ...obj.metadata?.drawer,
            placement,
            handleType: isInner ? 'recessed' : 'bar_modern',
          },
        },
      },
      true
    );

    this.notifyUser(`Çekmece '${isInner ? 'İç Çekmece' : 'Dış Çekmece'}' olarak ayarlandı`, 'info');
  }

  /**
   * Adds door(s) to active cell.
   * If the cell contains drawers, automatically converts them to inner drawers!
   */
  public addDoorToActiveCell(
    doorType: 'single_left' | 'single_right' | 'double' = 'single_left',
    customCell?: CabinetCell,
    material?: MaterialConfig
  ) {
    const targetCell = customCell || this.getActiveOrSelectedCell();
    if (!targetCell) {
      this.notifyUser('Lütfen kapak takmak için bir hücre seçin', 'warning');
      return;
    }

    if (CellDetector.isCellCoveredByDoor(targetCell, this.state.objects)) {
      this.notifyUser('Bu hücrede zaten kapak bulunmaktadır.', 'warning');
      return;
    }

    const availableDoorBounds = CellDetector.getDoorBoundsForCell(targetCell, this.state.objects);
    if (!CellDetector.isCellEligibleForDoor(targetCell, this.state.objects)) {
      this.notifyUser('Kapak yalnızca iç çekmeceli hücrelere eklenebilir.', 'warning');
      return;
    }

    const doorBounds = availableDoorBounds ?? {
      minX: targetCell.minX,
      maxX: targetCell.maxX,
      minY: targetCell.minY,
      maxY: targetCell.maxY,
      minZ: targetCell.minZ,
      maxZ: targetCell.maxZ,
      cabinetId: targetCell.cabinetId,
      cellIds: [targetCell.id],
    };

    const doors = CabinetFactory.createDoorFromBounds(doorBounds, doorType, material);

    // 1. Mükerrer / Duplicate Kontrolü
    const nonDuplicates = doors.filter((d) => !CabinetFactory.isDuplicateObject(d, this.state.objects));
    if (nonDuplicates.length === 0) {
      this.notifyUser('Bu hücrede aynı ebat ve tipte kapak zaten takılı! (Mükerrer ekleme engellendi)', 'warning');
      return;
    }

    // 2. Dış çekmecenin üstündeki boş göz boşluğuna kapak ekleniyorsa, çekmeceler iç çekmeceye dönüştürülmez.
    const updatedObjects = availableDoorBounds
      ? this.state.objects
      : this.convertCellDrawersToInner([targetCell]);

    this.state.objects = [...updatedObjects, ...nonDuplicates];
    this.ensureCabinetGroup(targetCell.cabinetId);
    this.state.selectedIds = nonDuplicates.map((d) => d.id);
    this.recordHistory(`Kapak Eklendi (${doorType})`);
    this.notifyUser(`${doorType === 'double' ? 'Çift Kapak' : 'Kapak'} dolaba takıldı`, 'success');
    this.notify();
  }

  public addSlidingDoorToCell(
    cell: CabinetCell,
    options: Omit<SlidingDoorMetadata, 'part' | 'panelIndex'>
  ) {
    if (!cell) return;
    if (CellDetector.isCellCoveredByDoor(cell, this.state.objects)) {
      this.notifyUser('Bu hücrede zaten kapak bulunmaktadır.', 'warning');
      return;
    }
    const preparedObjects = this.prepareCellForSlidingDoor(cell);
    const objects = CabinetFactory.createSlidingDoorSet(cell, options);
    this.state.objects = [...preparedObjects, ...objects];
    this.ensureCabinetGroup(cell.cabinetId);
    this.state.selectedIds = objects.filter((object) => object.metadata?.sliding?.part === 'panel').map((object) => object.id);
    this.recordHistory(`Ray Kapak Eklendi (${options.panelCount} Panel)`);
    this.notifyUser(`${options.panelCount} panelli ray kapak ve alt/üst ray kanalları oluşturuldu`, 'success');
    this.notify();
  }

  private prepareCellForSlidingDoor(cell: CabinetCell): SceneObject[] {
    const railClearance = 12;
    const innerDrawers = this.convertCellDrawersToInner([cell]);
    const cabinetShellRoles = new Set(['left', 'right', 'bottom', 'top', 'back']);

    return innerDrawers.map((object) => {
      if (
        object.parentId !== cell.cabinetId ||
        cabinetShellRoles.has(object.role || '') ||
        object.id.endsWith('_left') || object.id.endsWith('_right') ||
        object.id.endsWith('_bottom') || object.id.endsWith('_top') || object.id.endsWith('_back') ||
        object.metadata?.sliding || object.type === 'cabinet' || object.type === 'leg' || object.type === 'plinth'
      ) {
        return object;
      }

      const objectBox = CollisionDetector.getAABB(object);
      const overlapsCell =
        objectBox.minX < cell.maxX && objectBox.maxX > cell.minX &&
        objectBox.minY < cell.maxY && objectBox.maxY > cell.minY;
      if (!overlapsCell || object.dimensions.depth <= railClearance) return object;

      return {
        ...object,
        position: { ...object.position, z: object.position.z + railClearance / 2 },
        dimensions: { ...object.dimensions, depth: object.dimensions.depth - railClearance },
      };
    });
  }

  /**
   * Adds door(s) spanning multiple selected/swept cells.
   * If any drawers are inside the selected cells, automatically detects and converts them to inner drawers!
   */
  public addDoorToMultiCells(
    cells: CabinetCell[],
    doorType: 'single_left' | 'single_right' | 'double' = 'single_left',
    material?: MaterialConfig
  ) {
    if (!cells || cells.length === 0) {
      this.notifyUser('Lütfen kapak takmak için en az bir hücre seçin', 'warning');
      return;
    }

    // Filter out cells that already have doors
    const validCells = cells.filter(
      (c) =>
        !CellDetector.isCellCoveredByDoor(c, this.state.objects) &&
        CellDetector.isCellEligibleForDoor(c, this.state.objects)
    );

    if (validCells.length === 0) {
      this.notifyUser('Kapak yalnızca iç çekmeceli hücrelere eklenebilir.', 'warning');
      return;
    }

    if (validCells.length === 1) {
      this.addDoorToActiveCell(doorType, validCells[0], material);
      return;
    }

    // Merge bounding box of valid cells
    const minX = Math.min(...validCells.map((c) => c.minX));
    const maxX = Math.max(...validCells.map((c) => c.maxX));
    const minY = Math.min(...validCells.map((c) => c.minY));
    const maxY = Math.max(...validCells.map((c) => c.maxY));
    const minZ = Math.min(...validCells.map((c) => c.minZ));
    const maxZ = Math.max(...validCells.map((c) => c.maxZ));
    const cabinetId = validCells[0].cabinetId;

    const doors = CabinetFactory.createDoorFromBounds(
      {
        minX,
        maxX,
        minY,
        maxY,
        minZ,
        maxZ,
        cabinetId,
        cellIds: validCells.map((c) => c.id),
      },
      doorType,
      material
    );

    // 1. Mükerrer / Duplicate Kontrolü
    const nonDuplicates = doors.filter((d) => !CabinetFactory.isDuplicateObject(d, this.state.objects));
    if (nonDuplicates.length === 0) {
      this.notifyUser('Bu hücreleri kapsayan aynı ebatta kapak zaten mevcut! (Mükerrer engellendi)', 'warning');
      return;
    }

    // 2. Çoklu hücre seçimindeki çekmeceleri otomatik İç Çekmeceye dönüştür
    const updatedObjects = this.convertCellDrawersToInner(cells);

    this.state.objects = [...updatedObjects, ...nonDuplicates];
    this.ensureCabinetGroup(cabinetId);
    this.state.selectedIds = nonDuplicates.map((d) => d.id);
    this.recordHistory(`Çoklu Hücre Kapağı Eklendi (${cells.length} Hücre, ${doorType})`);
    this.notifyUser(`${cells.length} hücreyi kapsayan ${doorType === 'double' ? 'Çift Kapak' : 'Tek Kapak'} takıldı`, 'success');
    this.notify();
  }

  /**
   * Converts any drawers residing in the given cells to inner drawers (recessed Z and hinge clearance)
   */
  private convertCellDrawersToInner(cells: CabinetCell[]): SceneObject[] {
    const cellIds = new Set(cells.map((c) => c.id));
    let convertedCount = 0;

    const newObjects = this.state.objects.map((o) => {
      if (o.type === 'drawer') {
        const inCellId = o.metadata?.cellId && cellIds.has(o.metadata.cellId);
        // Also check geometric containment in case cellId is absent
        const inBounds = cells.some(
          (c) =>
            o.position.x >= c.minX - 20 &&
            o.position.x <= c.maxX + 20 &&
            o.position.y >= c.minY - 20 &&
            o.position.y <= c.maxY + 20
        );

        if (inCellId || inBounds) {
          const matchingCell = cells.find((c) => c.id === o.metadata?.cellId) || cells[0];
          const boxDepth = matchingCell.depth;
          const newWidth = matchingCell.width;
          const targetZ =
            matchingCell.minZ + boxDepth / 2 -
            (o.metadata?.drawer?.placement === 'inner' ? 0 : 18);

          convertedCount++;
          return {
            ...o,
            name: o.name.replace(/^Çekmece/, 'İç Çekmece'),
            position: { ...o.position, z: Math.round(targetZ) },
            dimensions: { ...o.dimensions, width: newWidth, depth: boxDepth },
            metadata: {
              ...o.metadata,
              drawer: {
                ...o.metadata?.drawer,
                placement: 'inner' as const,
                handleType: 'recessed' as const,
              },
            },
          };
        }
      }
      return o;
    });

    if (convertedCount > 0) {
      this.notifyUser(
        `${convertedCount} adet çekmece kapak arkasında kaldığı için otomatik 'İç Çekmece'ye dönüştürüldü`,
        'info'
      );
    }

    return newObjects;
  }

  /**
   * Adds Cabinet Interior Accessory (Askı Borusu, Asansörlü Askılık, Pantolonluk, Kravatlık, Tel Sepet, LED Profil)
   */
  public addAccessoryToActiveCell(
    accessoryType: CabinetAccessoryType,
    customCell?: CabinetCell,
    material?: MaterialConfig
  ) {
    const targetCell = customCell || this.getActiveOrSelectedCell();
    if (!targetCell) {
      this.notifyUser('Lütfen aksesuar eklemek için dolap içi bir hücre seçin', 'warning');
      return;
    }

    const acc = CabinetFactory.createAccessory(targetCell, accessoryType, material);

    // 1. Mükerrer / Duplicate Kontrolü
    if (CabinetFactory.isDuplicateObject(acc, this.state.objects)) {
      this.notifyUser('Bu hücrede aynı tip ve ebatta aksesuar zaten mevcut! (Mükerrer engellendi)', 'warning');
      return;
    }

    this.state.objects = [...this.state.objects, acc];
    this.ensureCabinetGroup(targetCell.cabinetId);
    this.state.selectedIds = [acc.id];
    this.recordHistory(`${acc.name} Eklendi`);
    this.notifyUser(`${acc.name} hücreye yerleştirildi`, 'success');
    this.notify();
  }

  /**
   * Adds Drawer Interior Accessory (Kaşıklık, Takılık, Çekmece Bölücü)
   */
  public addDrawerAccessoryToSelected(
    accessoryType: DrawerAccessoryType,
    targetDrawerId?: string,
    material?: MaterialConfig
  ) {
    let targetDrawer: SceneObject | null = null;

    if (targetDrawerId) {
      targetDrawer = this.state.objects.find((o) => o.id === targetDrawerId && o.type === 'drawer') || null;
    }

    if (!targetDrawer && this.state.selectedIds.length > 0) {
      targetDrawer = this.state.objects.find(
        (o) => this.state.selectedIds.includes(o.id) && o.type === 'drawer'
      ) || null;
    }

    if (!targetDrawer) {
      // Find drawer in active cell
      const activeCell = this.getActiveOrSelectedCell();
      if (activeCell) {
        targetDrawer = this.state.objects.find(
          (o) => o.type === 'drawer' && o.metadata?.cellId === activeCell.id
        ) || null;
      }
    }

    if (!targetDrawer) {
      // Find any drawer in the scene
      targetDrawer = this.state.objects.find((o) => o.type === 'drawer') || null;
    }

    if (!targetDrawer) {
      this.notifyUser('Lütfen çekmece içi aksesuarı eklemek için önce bir çekmece seçin veya oluşturun', 'warning');
      return;
    }

    const dacc = CabinetFactory.createDrawerAccessory(targetDrawer, accessoryType, material);

    // 1. Mükerrer / Duplicate Kontrolü
    if (CabinetFactory.isDuplicateObject(dacc, this.state.objects)) {
      this.notifyUser('Bu çekmecede aynı aksesuar zaten mevcut! (Mükerrer engellendi)', 'warning');
      return;
    }

    this.state.objects = [...this.state.objects, dacc];
    if (targetDrawer.parentId) this.ensureCabinetGroup(targetDrawer.parentId);
    this.state.selectedIds = [dacc.id];
    this.recordHistory(`${dacc.name} Eklendi`);
    this.notifyUser(`${dacc.name} çekmece içerisine yerleştirildi`, 'success');
    this.notify();
  }

  /**
   * Adds an optional closing/filler panel above a drawer that doesn't fully fill its cell height.
   */
  public addDrawerTopClosingPanel(targetDrawerId?: string, material?: MaterialConfig) {
    let targetDrawer: SceneObject | null = null;

    if (targetDrawerId) {
      targetDrawer = this.state.objects.find((o) => o.id === targetDrawerId && o.type === 'drawer') || null;
    }
    if (!targetDrawer && this.state.selectedIds.length > 0) {
      targetDrawer = this.state.objects.find(
        (o) => this.state.selectedIds.includes(o.id) && o.type === 'drawer'
      ) || null;
    }

    if (!targetDrawer) {
      this.notifyUser('Lütfen üst kapama paneli eklemek için önce bir çekmece seçin', 'warning');
      return;
    }

    const cell = this.getAllCells().find((c) => c.id === targetDrawer!.metadata?.cellId);
    if (!cell) {
      this.notifyUser('Çekmecenin bağlı olduğu hücre bulunamadı', 'warning');
      return;
    }

    const drawerTop = targetDrawer.position.y + targetDrawer.dimensions.height / 2;
    const gap = cell.maxY - drawerTop;
    if (gap < 15) {
      this.notifyUser('Çekmecenin üstünde kapama paneli için yeterli boşluk yok', 'warning');
      return;
    }

    const panel = CabinetFactory.createDrawerTopPanel(targetDrawer, cell, material ?? targetDrawer.material);

    if (CabinetFactory.isDuplicateObject(panel, this.state.objects)) {
      this.notifyUser('Bu çekmecenin üstünde zaten bir kapama paneli mevcut!', 'warning');
      return;
    }

    this.state.objects = [...this.state.objects, panel];
    this.ensureCabinetGroup(cell.cabinetId);
    this.state.selectedIds = [panel.id];
    this.recordHistory(`${panel.name} Eklendi`);
    this.notifyUser('Çekmece üstü kapama paneli yerleştirildi', 'success');
    this.notify();
  }

  /**
   * Adds drawn Architectural element (Wall / Beam / Column) with automatic wall trimming
   */
  public addDrawnArchitecturalElement(element: SceneObject) {
    if (element.type === 'wall') {
      const solidObjects = this.state.objects.filter((object) => object.type !== 'wall');
      const collision = CollisionDetector.checkCollision(element, element.position, solidObjects);
      if (collision.hasCollision) {
        this.notifyUser(
          collision.collidingWith
            ? `Duvar ${collision.collidingWith.name} ile çakışıyor; mevcut nesnenin içinden geçemez.`
            : 'Duvar zeminin altında oluşturulamaz.',
          'warning'
        );
        return;
      }
    }

    let newObjects = [...this.state.objects, element];

    if (element.type === 'wall') {
      const trimRes = WallTrimmer.trimAllWalls(newObjects);
      newObjects = trimRes.updatedObjects;
      if (trimRes.trimmedCount > 0) {
        this.notifyUser(`${element.name} eklendi ve duvar kesişimleri otomatik trimlendi (${trimRes.trimmedCount} kesişim)`, 'success');
      } else {
        this.notifyUser(`${element.name} sahneye yerleştirildi`, 'success');
      }
    } else {
      this.notifyUser(`${element.name} sahneye yerleştirildi`, 'success');
    }

    this.state.objects = newObjects;
    this.state.selectedIds = [element.id];
    this.recordHistory(`${element.name} Eklendi`);
    this.notify();
  }

  /**
   * Manually or automatically triggers wall intersection trimming
   */
  public autoTrimAllWalls() {
    const trimRes = WallTrimmer.trimAllWalls(this.state.objects);
    if (trimRes.trimmedCount > 0) {
      this.state.objects = trimRes.updatedObjects;
      this.recordHistory('Duvar Kesişimleri Trimlendi');
      this.notifyUser(`Duvar kesişimleri otomatik trimlendi (${trimRes.trimmedCount} kesişim)`, 'success');
      this.notify();
    } else {
      this.notifyUser('Trimlenecek duvar kesişimi bulunamadı', 'info');
    }
  }

  /**
   * Adds Plinth (Baza) or Legs
   */
  public addPlinthOrLegs(type: 'plinth' | 'legs', cabinetId?: string) {
    const cab = this.getNearestCabinet(cabinetId);
    if (!cab) {
      this.notifyUser('Lütfen baza veya ayak eklemek için bir dolap seçin', 'warning');
      return;
    }

    if (type === 'plinth') {
      const plinth = CabinetFactory.createPlinth(cab, 100);
      if (CabinetFactory.isDuplicateObject(plinth, this.state.objects)) {
        this.notifyUser('Bu dolapta baza zaten mevcut!', 'warning');
        return;
      }
      this.state.objects = [...this.state.objects, plinth];
      this.ensureCabinetGroup(cab.id);
      this.recordHistory(`Baza Eklendi (${plinth.id})`);
      this.notifyUser('Dolap bazası eklendi', 'success');
    } else {
      const legs = CabinetFactory.createLegs(cab, 100);
      this.state.objects = [...this.state.objects, ...legs];
      this.ensureCabinetGroup(cab.id);
      this.recordHistory(`Ayaklar Eklendi (${cab.id})`);
      this.notifyUser('4 adet ayarlanabilir dolap ayağı eklendi', 'success');
    }
  }

  /**
   * Adds Architectural element
   */
  public addArchitecturalElement(type: 'wall' | 'column' | 'beam' | 'window' | 'room_door') {
    const arch = CabinetFactory.createArchitecturalElement(type);
    let newObjects = [...this.state.objects, arch];

    if (type === 'wall') {
      const trimRes = WallTrimmer.trimAllWalls(newObjects);
      newObjects = trimRes.updatedObjects;
      if (trimRes.trimmedCount > 0) {
        this.notifyUser(`${arch.name} sahneye eklendi ve kesişimler trimlendi`, 'success');
      } else {
        this.notifyUser(`${arch.name} sahneye eklendi`, 'success');
      }
    } else {
      this.notifyUser(`${arch.name} sahneye eklendi`, 'success');
    }

    this.state.objects = newObjects;
    this.state.selectedIds = [arch.id];
    this.recordHistory(`Mimari Eleman Eklendi (${arch.name})`);
    this.notify();
  }

  /**
   * Updates an object's properties (Dimensions, Position, Rotation, Material, Locked, Edgebanding)
   */
  public updateObject(id: string, partial: Partial<SceneObject>, recordHistoryAction = true) {
    const idx = this.state.objects.findIndex((o) => o.id === id);
    if (idx === -1) return;

    const current = this.state.objects[idx];
    if (current.locked && partial.position && !partial.locked) {
      this.notifyUser('Kilitli nesneler taşınamaz veya değiştirilemez', 'warning');
      return;
    }

    let normalizedPartial = partial;
    if (current.type === 'drawer' && partial.dimensions?.height !== undefined) {
      normalizedPartial = this.constrainDrawerHeight(current, partial.dimensions.height, partial);
    }

    const updated = { ...current, ...normalizedPartial };
    const newObjects = [...this.state.objects];
    newObjects[idx] = updated;

    // If updating a cabinet root container, adjust child panels
    if (current.type === 'cabinet' && partial.dimensions) {
      this.resizeCabinetChildren(current, updated.dimensions, newObjects);
    }

    // Keep any drawer top closing panel in sync when the drawer it covers is resized/moved
    if (current.type === 'drawer' && (partial.dimensions || partial.position)) {
      const cell = this.getAllCells().find((c) => c.id === updated.metadata?.cellId);
      if (cell) {
        const drawerTop = updated.position.y + updated.dimensions.height / 2;
        newObjects.forEach((o, i) => {
          if (o.metadata?.closesDrawerId === id) {
            newObjects[i] = {
              ...o,
              dimensions: {
                ...o.dimensions,
                width: updated.dimensions.width,
                height: Math.max(1, cell.maxY - drawerTop),
                depth: updated.dimensions.depth,
              },
              position: {
                x: updated.position.x,
                y: drawerTop + Math.max(1, cell.maxY - drawerTop) / 2,
                z: updated.position.z,
              },
            };
          }
        });
      }
    }

    this.state.objects = newObjects;

    if (recordHistoryAction) {
      this.recordHistory(`${updated.name} Güncellendi`);
    }
    this.notify();
  }

  private constrainDrawerHeight(
    drawer: SceneObject,
    requestedHeight: number,
    partial: Partial<SceneObject>
  ): Partial<SceneObject> {
    const currentHeight = drawer.dimensions.height;
    const bottomY = drawer.position.y - currentHeight / 2;
    const cellId = drawer.metadata?.cellId;
    const cell = this.getAllCells().find((candidate) => candidate.id === cellId);
    const cellTopY = cell?.maxY ?? Infinity;
    const drawerBox = CollisionDetector.getAABB(drawer);

    // Only objects above this drawer and inside its horizontal/depth footprint can stop growth.
    const obstacleTop = this.state.objects
      .filter((object) => object.id !== drawer.id && object.visible !== false)
      .filter((object) => {
        const obstacleBox = CollisionDetector.getAABB(object);
        const overlapsX = obstacleBox.minX < drawerBox.maxX && obstacleBox.maxX > drawerBox.minX;
        const overlapsZ = obstacleBox.minZ < drawerBox.maxZ && obstacleBox.maxZ > drawerBox.minZ;
        return overlapsX && overlapsZ && obstacleBox.minY > bottomY + 1;
      })
      .reduce((top, object) => Math.min(top, CollisionDetector.getAABB(object).minY), cellTopY);

    const maxHeight = Math.max(1, obstacleTop - bottomY);
    const height = Math.min(Math.max(1, requestedHeight), maxHeight);
    const position = partial.position ?? drawer.position;

    return {
      ...partial,
      dimensions: { ...drawer.dimensions, ...partial.dimensions, height },
      position: { ...position, y: bottomY + height / 2 },
    };
  }

  /**
   * Batch update for multiple selected objects
   */
  public updateSelectedObjects(partial: Partial<SceneObject>) {
    if (this.state.selectedIds.length === 0) return;

    const newObjects = this.state.objects.map((o) => {
      if (this.state.selectedIds.includes(o.id)) {
        return { ...o, ...partial };
      }
      return o;
    });

    this.state.objects = newObjects;
    this.recordHistory(`${this.state.selectedIds.length} Nesne Toplu Güncellendi`);
    this.notify();
  }

  /**
   * Move object with smart Snap & Collision Detection.
   * Pass recordHistoryAction=false for live drag previews to avoid flooding the undo stack.
   */
  public moveObject(id: string, newPosition: Vector3D, recordHistoryAction = true) {
    const obj = this.state.objects.find((o) => o.id === id);
    if (!obj || obj.locked) return;

    // 1. Calculate Snap to floor, walls, neighbors
    const snapResult = CollisionDetector.calculateSnap(obj, newPosition, this.state.objects);
    const targetPos = snapResult.position;

    // 2. Check collision
    const collision = CollisionDetector.checkCollision(obj, targetPos, this.state.objects);
    if (collision.hasCollision) {
      if (recordHistoryAction) {
        this.notifyUser('Çakışma algılandı! Nesneler birbirinin içinden geçemez', 'warning');
      }
      return;
    }

    // Apply delta movement to child parts if moving cabinet or group
    if (obj.type === 'cabinet' || obj.groupId) {
      const dx = targetPos.x - obj.position.x;
      const dy = targetPos.y - obj.position.y;
      const dz = targetPos.z - obj.position.z;

      this.state.objects = this.state.objects.map((o) => {
        if (o.id === id) {
          return { ...o, position: targetPos };
        }
        if (o.parentId === id || (obj.groupId && o.groupId === obj.groupId)) {
          return {
            ...o,
            position: {
              x: o.position.x + dx,
              y: o.position.y + dy,
              z: o.position.z + dz,
            },
          };
        }
        return o;
      });
    } else {
      this.state.objects = this.state.objects.map((o) =>
        o.id === id ? { ...o, position: targetPos } : o
      );
    }

    if (snapResult.snapped && recordHistoryAction) {
      this.notifyUser(`${snapResult.snapTargetName} hedefine kenetlendi (Snap)`, 'info');
    }

    if (recordHistoryAction) {
      this.recordHistory(`${obj.name} Taşındı`);
    }
    this.notify();
  }

  /**
   * Resolves any clicked part to its parent cabinet hierarchy (or group) and selects
   * every member together, so the whole cabinet can be moved/dragged as one unit.
   */
  public selectCabinetGroupByMemberId(id: string): string | null {
    const obj = this.state.objects.find((o) => o.id === id);
    if (!obj) return null;

    let cabinetId: string | null = null;
    if (obj.type === 'cabinet') {
      cabinetId = obj.id;
    } else if (obj.parentId) {
      const parent = this.state.objects.find((o) => o.id === obj.parentId);
      cabinetId = parent?.type === 'cabinet' ? parent.id : obj.parentId;
    }

    if (!cabinetId && obj.groupId) {
      const group = this.state.groups.find((g) => g.id === obj.groupId);
      const cabinetMember = group?.memberIds
        .map((mid) => this.state.objects.find((o) => o.id === mid))
        .find((o) => o?.type === 'cabinet');
      cabinetId = cabinetMember?.id || null;
    }

    if (!cabinetId) cabinetId = obj.id;

    const memberIds = this.state.objects
      .filter((o) => o.id === cabinetId || o.parentId === cabinetId)
      .map((o) => o.id);

    this.state.selectedIds = memberIds.length > 0 ? memberIds : [obj.id];
    this.notify();
    return cabinetId;
  }

  /**
   * Deletes selected object(s) or whole cabinet hierarchy
   */
  public deleteSelected() {
    if (this.state.selectedIds.length === 0) return;

    const objectsById = new Map(this.state.objects.map((o) => [o.id, o]));

    // Locked objects (and locked ancestors) cannot be deleted at all
    const lockedIds = this.state.selectedIds.filter((id) => objectsById.get(id)?.locked);
    const unlockedSelectedIds = this.state.selectedIds.filter((id) => !objectsById.get(id)?.locked);

    if (unlockedSelectedIds.length === 0) {
      this.notifyUser('Kilitli nesneler silinemez. Önce kilidi açın.', 'warning');
      return;
    }

    const idsToDelete = new Set(unlockedSelectedIds);

    // If cabinet is selected, include all unlocked child panels (locked children stay)
    unlockedSelectedIds.forEach((id) => {
      this.state.objects.forEach((o) => {
        if ((o.parentId === id || o.groupId === id) && !o.locked) {
          idsToDelete.add(o.id);
        }
      });
    });

    this.state.objects = this.state.objects.filter((o) => !idsToDelete.has(o.id));
    this.state.selectedIds = [];
    this.recordHistory(`${idsToDelete.size} Parça Silindi`);
    this.notifyUser(
      lockedIds.length > 0
        ? `${idsToDelete.size} parça silindi, ${lockedIds.length} kilitli nesne korundu`
        : 'Seçili parça(lar) silindi',
      'info'
    );
  }

  /**
   * Lock / Unlock selected objects
   */
  public toggleLockSelected() {
    if (this.state.selectedIds.length === 0) return;

    const isAnyUnlocked = this.state.objects.some(
      (o) => this.state.selectedIds.includes(o.id) && !o.locked
    );

    this.state.objects = this.state.objects.map((o) => {
      if (this.state.selectedIds.includes(o.id)) {
        return { ...o, locked: isAnyUnlocked };
      }
      return o;
    });

    this.recordHistory(isAnyUnlocked ? 'Nesneler Kilitlendi' : 'Kilit Açıldı');
    this.notifyUser(isAnyUnlocked ? 'Seçili nesneler kilitlendi' : 'Kilitler açıldı', 'info');
  }

  /**
   * Lock / Unlock all scene objects
   */
  public toggleLockAll() {
    const isAnyUnlocked = this.state.objects.some((o) => !o.locked);
    this.state.objects = this.state.objects.map((o) => ({ ...o, locked: isAnyUnlocked }));
    this.recordHistory(isAnyUnlocked ? 'Tüm Sahne Kilitlendi' : 'Tüm Kilitler Açıldı');
    this.notifyUser(isAnyUnlocked ? 'Tüm sahne kilitlendi' : 'Tüm kilitler açıldı', 'info');
  }

  // --- GROUPING SYSTEM (SketchUp Style) ---

  public createGroupFromSelection() {
    if (this.state.selectedIds.length < 2) {
      this.notifyUser('Grup oluşturmak için en az 2 nesne seçin', 'warning');
      return;
    }

    const groupId = `group_${Date.now()}`;
    const memberIds = [...this.state.selectedIds];

    this.state.groups.push({
      id: groupId,
      name: `Grup ${this.state.groups.length + 1}`,
      memberIds,
    });

    this.state.objects = this.state.objects.map((o) => {
      if (memberIds.includes(o.id)) {
        return { ...o, groupId };
      }
      return o;
    });

    this.state.autoGroupRecommendation = null;
    this.recordHistory(`Grup Oluşturuldu (${groupId})`);
    this.notifyUser(`${memberIds.length} parça tek bir grup yapıldı`, 'success');
  }

  public ungroupSelected() {
    const selectedGroupIds = new Set<string>();

    this.state.objects.forEach((o) => {
      if (this.state.selectedIds.includes(o.id) && o.groupId) {
        selectedGroupIds.add(o.groupId);
      }
    });

    if (selectedGroupIds.size === 0) {
      this.notifyUser('Seçili nesneler bir gruba ait değil', 'warning');
      return;
    }

    this.state.objects = this.state.objects.map((o) => {
      if (o.groupId && selectedGroupIds.has(o.groupId)) {
        const copy = { ...o };
        delete copy.groupId;
        return copy;
      }
      return o;
    });

    this.state.groups = this.state.groups.filter((g) => !selectedGroupIds.has(g.id));
    this.recordHistory('Grup Çözüldü');
    this.notifyUser('Grup dağıtıldı, parçalar bağımsızlaştırıldı', 'info');
  }

  /**
   * Auto-groups a cabinet root together with all of its current parts so that
   * anything added into a cabinet automatically belongs to that cabinet's group.
   */
  private ensureCabinetGroup(cabinetId: string) {
    const cabinetRoot = this.state.objects.find((o) => o.id === cabinetId && o.type === 'cabinet');
    if (!cabinetRoot) return;

    const groupId = cabinetRoot.groupId || `group_${cabinetId}`;
    const memberIds = this.state.objects
      .filter((o) => o.id === cabinetId || o.parentId === cabinetId)
      .map((o) => o.id);

    this.state.objects = this.state.objects.map((o) =>
      memberIds.includes(o.id) && o.groupId !== groupId ? { ...o, groupId } : o
    );

    const existingGroup = this.state.groups.find((g) => g.id === groupId);
    if (existingGroup) {
      existingGroup.memberIds = memberIds;
    } else {
      this.state.groups.push({ id: groupId, name: cabinetRoot.name, memberIds });
    }
  }

  private checkAutoGroupRecommendation() {
    if (this.state.selectedIds.length < 2) {
      this.state.autoGroupRecommendation = null;
      return;
    }

    const selectedObjs = this.state.objects.filter((o) => this.state.selectedIds.includes(o.id));
    const parentIds = new Set(selectedObjs.map((o) => o.parentId).filter(Boolean));

    if (parentIds.size === 1) {
      const cabinetId = Array.from(parentIds)[0] as string;
      const isAlreadyGrouped = selectedObjs.every((o) => o.groupId);
      if (!isAlreadyGrouped) {
        this.state.autoGroupRecommendation = {
          cabinetId,
          partIds: this.state.selectedIds,
        };
        return;
      }
    }

    this.state.autoGroupRecommendation = null;
  }

  // --- UNDO / REDO ---

  public undo() {
    if (this.state.historyIndex > 0) {
      this.state.historyIndex--;
      const snapshot = this.state.history[this.state.historyIndex];
      this.state.objects = JSON.parse(JSON.stringify(snapshot.objects));
      this.state.selectedIds = [];
      this.notifyUser(`Geri Alındı: ${snapshot.description}`, 'info');
    }
  }

  public redo() {
    if (this.state.historyIndex < this.state.history.length - 1) {
      this.state.historyIndex++;
      const snapshot = this.state.history[this.state.historyIndex];
      this.state.objects = JSON.parse(JSON.stringify(snapshot.objects));
      this.state.selectedIds = [];
      this.notifyUser(`İleri Alındı: ${snapshot.description}`, 'info');
    }
  }

  // --- PROJECT EXPORT / IMPORT ---

  public exportProjectJSON(): string {
    const data = {
      version: '1.0',
      projectName: this.state.projectName,
      objects: this.state.objects,
      groups: this.state.groups,
      timestamp: Date.now(),
    };
    return JSON.stringify(data, null, 2);
  }

  public importProjectJSON(json: string) {
    try {
      const data = JSON.parse(json);
      if (Array.isArray(data.objects)) {
        this.state.objects = data.objects;
        this.state.projectName = data.projectName || 'İçe Aktarılan Proje';
        this.state.groups = Array.isArray(data.groups) ? data.groups : [];
        this.state.selectedIds = [];
        this.recordHistory('Proje Yüklendi');
        this.notifyUser('Proje başarıyla yüklendi', 'success');
      }
    } catch {
      this.notifyUser('Geçersiz proje dosyası', 'warning');
    }
  }

  // --- HELPER QUERIES ---

  public getAllCells(): CabinetCell[] {
    const cabinets = this.state.objects.filter((o) => o.type === 'cabinet');
    const allCells: CabinetCell[] = [];

    cabinets.forEach((cab) => {
      const cells = CellDetector.calculateCabinetCells(cab, this.state.objects);
      allCells.push(...cells);
    });

    return allCells;
  }

  public getActiveOrSelectedCell(): CabinetCell | null {
    const allCells = this.getAllCells();
    if (allCells.length === 0) return null;

    if (this.state.activeCell) {
      const found = allCells.find((c) => c.id === this.state.activeCell?.id);
      if (found) return found;
    }

    // A selected cabinet component is not an explicit cell selection.
    if (this.state.selectedIds.length > 0) {
      const selObj = this.state.objects.find((o) => o.id === this.state.selectedIds[0]);
      if (selObj) {
        const cell = CellDetector.findCellAtPoint(selObj.position, allCells, 0);
        if (cell) return cell;
      }
    }

    return null;
  }

  private getNearestCabinet(cabinetId?: string): SceneObject | null {
    if (cabinetId) {
      return this.state.objects.find((o) => o.id === cabinetId && o.type === 'cabinet') || null;
    }

    if (this.state.selectedIds.length > 0) {
      const selObj = this.state.objects.find((o) => o.id === this.state.selectedIds[0]);
      if (selObj?.type === 'cabinet') return selObj;
      if (selObj?.parentId) {
        return this.state.objects.find((o) => o.id === selObj.parentId) || null;
      }
    }

    return this.state.objects.find((o) => o.type === 'cabinet') || null;
  }

  private resizeCabinetChildren(
    cabinet: SceneObject,
    newDims: { width: number; height: number; depth: number },
    allObjects: SceneObject[]
  ) {
    const thickness = cabinet.dimensions.thickness || 18;
    const backThick = 8;
    const pos = cabinet.position;

    const internalWidth = newDims.width - 2 * thickness;
    const usableDepth = newDims.depth - backThick;
    const minX = pos.x - newDims.width / 2 + thickness;
    const maxX = pos.x + newDims.width / 2 - thickness;
    const minY = pos.y + thickness;
    const maxY = pos.y + newDims.height - thickness;
    const minZ = pos.z - newDims.depth / 2;
    const maxZ = pos.z + newDims.depth / 2 - backThick;
    const oldMinX = pos.x - cabinet.dimensions.width / 2 + thickness;
    const oldMaxX = pos.x + cabinet.dimensions.width / 2 - thickness;
    const oldMinY = pos.y + thickness;
    const oldMaxY = pos.y + cabinet.dimensions.height - thickness;
    const oldMinZ = pos.z - cabinet.dimensions.depth / 2;
    const clamp = (value: number, min: number, max: number) =>
      Math.min(max, Math.max(min, value));
    const remap = (value: number, oldMin: number, oldMax: number, newMin: number, newMax: number) => {
      const range = oldMax - oldMin;
      return range > 0 ? newMin + ((value - oldMin) / range) * (newMax - newMin) : (newMin + newMax) / 2;
    };
    const childParts = allObjects.filter((part) => part.parentId === cabinet.id);
    const shelves = childParts.filter((part) => part.type === 'shelf' || part.role === 'shelf');
    const dividers = childParts.filter((part) => part.type === 'divider' || part.role === 'divider');
    const getXBounds = (y: number, x: number) => {
      const crossingDividers = dividers
        .filter((divider) => {
          const dividerTop = divider.position.y + divider.dimensions.height / 2;
          const dividerBottom = divider.position.y - divider.dimensions.height / 2;
          return y >= dividerBottom - 25 && y <= dividerTop + 25;
        })
        .sort((a, b) => a.position.x - b.position.x);
      const leftDivider = crossingDividers.filter((divider) => divider.position.x < x).pop();
      const rightDivider = crossingDividers.find((divider) => divider.position.x >= x);
      return {
        min: leftDivider ? leftDivider.position.x + leftDivider.dimensions.width / 2 : minX,
        max: rightDivider ? rightDivider.position.x - rightDivider.dimensions.width / 2 : maxX,
      };
    };
    const getYBounds = (x: number, y: number) => {
      const crossingShelves = shelves
        .filter((shelf) => {
          const shelfLeft = shelf.position.x - shelf.dimensions.width / 2;
          const shelfRight = shelf.position.x + shelf.dimensions.width / 2;
          return x >= shelfLeft - 25 && x <= shelfRight + 25;
        })
        .sort((a, b) => a.position.y - b.position.y);
      const lowerShelf = crossingShelves.filter((shelf) => shelf.position.y < y).pop();
      const upperShelf = crossingShelves.find((shelf) => shelf.position.y >= y);
      return {
        min: lowerShelf ? lowerShelf.position.y + lowerShelf.dimensions.height / 2 : minY,
        max: upperShelf ? upperShelf.position.y - upperShelf.dimensions.height / 2 : maxY,
      };
    };

    // Move the existing layout proportionally before recalculating each cell's dimensions.
    childParts.forEach((part) => {
      const isShell = part.role === 'left' || part.role === 'right' || part.role === 'bottom' ||
        part.role === 'top' || part.role === 'back' || part.id.endsWith('_left') ||
        part.id.endsWith('_right') || part.id.endsWith('_bottom') || part.id.endsWith('_top') ||
        part.id.endsWith('_back');
      if (isShell || part.type === 'plinth' || part.type === 'leg') return;
      part.position.x = remap(part.position.x, oldMinX, oldMaxX, minX, maxX);
      part.position.y = remap(part.position.y, oldMinY, oldMaxY, minY, maxY);
      part.position.z = remap(part.position.z, oldMinZ, oldMinZ + cabinet.dimensions.depth - backThick, minZ, maxZ);
    });

    // Update the cabinet shell first so the remapped layout fits the new bounds.
    childParts.forEach((part) => {
      if (part.role === 'left' || part.id.endsWith('_left')) {
        part.dimensions.height = newDims.height;
        part.dimensions.depth = usableDepth;
        part.position.x = pos.x - newDims.width / 2 + thickness / 2;
        part.position.y = pos.y + newDims.height / 2;
        part.position.z = pos.z - backThick / 2;
      } else if (part.role === 'right' || part.id.endsWith('_right')) {
        part.dimensions.height = newDims.height;
        part.dimensions.depth = usableDepth;
        part.position.x = pos.x + newDims.width / 2 - thickness / 2;
        part.position.y = pos.y + newDims.height / 2;
        part.position.z = pos.z - backThick / 2;
      } else if (part.role === 'bottom' || part.id.endsWith('_bottom')) {
        part.dimensions.width = internalWidth;
        part.dimensions.depth = usableDepth;
        part.position.x = pos.x;
        part.position.y = pos.y + thickness / 2;
        part.position.z = pos.z - backThick / 2;
      } else if (part.role === 'top' || part.id.endsWith('_top')) {
        part.dimensions.width = internalWidth;
        part.dimensions.depth = usableDepth;
        part.position.x = pos.x;
        part.position.y = pos.y + newDims.height - thickness / 2;
        part.position.z = pos.z - backThick / 2;
      } else if (part.role === 'back' || part.id.endsWith('_back')) {
        part.dimensions.width = newDims.width - 4;
        part.dimensions.height = newDims.height - 4;
        part.position.x = pos.x;
        part.position.y = pos.y + newDims.height / 2;
        part.position.z = pos.z + newDims.depth / 2 - backThick / 2;
      }
    });

    childParts.forEach((part) => {
      if (part.metadata?.closesDrawerId) {
        const targetDrawer = allObjects.find((o) => o.id === part.metadata?.closesDrawerId);
        if (targetDrawer) {
          const drawerTop = targetDrawer.position.y + targetDrawer.dimensions.height / 2;
          const yBounds = getYBounds(targetDrawer.position.x, targetDrawer.position.y);
          const gap = Math.max(1, yBounds.max - drawerTop);
          part.dimensions.width = targetDrawer.dimensions.width;
          part.dimensions.height = gap;
          part.dimensions.depth = targetDrawer.dimensions.depth;
          part.position.x = targetDrawer.position.x;
          part.position.y = drawerTop + gap / 2;
          part.position.z = targetDrawer.position.z;
        }
      } else if (part.type === 'shelf' || part.role === 'shelf') {
        const xBounds = getXBounds(part.position.y, part.position.x);
        part.dimensions.width = xBounds.max - xBounds.min;
        part.dimensions.depth = usableDepth;
        part.position.x = (xBounds.min + xBounds.max) / 2;
        part.position.z = minZ + part.dimensions.depth / 2;
        part.position.y = clamp(part.position.y, minY + part.dimensions.height / 2, maxY - part.dimensions.height / 2);
      } else if (part.type === 'divider' || part.role === 'divider') {
        const yBounds = getYBounds(part.position.x, part.position.y);
        part.dimensions.height = yBounds.max - yBounds.min;
        part.dimensions.depth = usableDepth;
        part.position.x = clamp(part.position.x, minX + part.dimensions.width / 2, maxX - part.dimensions.width / 2);
        part.position.y = (yBounds.min + yBounds.max) / 2;
        part.position.z = minZ + part.dimensions.depth / 2;
      } else if (part.type === 'drawer') {
        const isInner = part.metadata?.drawer?.placement === 'inner';
        const drawerDepth = usableDepth;
        const xBounds = getXBounds(part.position.y, part.position.x);
        const yBounds = getYBounds(part.position.x, part.position.y);
        const cellWidth = xBounds.max - xBounds.min;
        part.dimensions.width = cellWidth;
        part.dimensions.depth = drawerDepth;
        part.position.x = (xBounds.min + xBounds.max) / 2;
        part.position.z = minZ + drawerDepth / 2;
        const drawerCount = part.metadata?.drawer?.totalDrawers ?? 1;
        if (drawerCount <= 1) {
          part.dimensions.height = yBounds.max - yBounds.min;
          part.position.y = (yBounds.min + yBounds.max) / 2;
        } else {
          const drawerGap = 3;
          const drawerHeight = (yBounds.max - yBounds.min - (drawerCount - 1) * drawerGap) / drawerCount;
          part.dimensions.height = Math.max(1, drawerHeight);
          const drawerIndex = part.metadata?.drawer?.drawerIndex ?? 0;
          part.position.y = yBounds.min + drawerIndex * (drawerHeight + drawerGap) + drawerHeight / 2;
        }
        if (part.metadata?.drawer) {
          part.metadata.drawer.maxExtensionMm = drawerDepth * 0.8;
        }
      } else if (part.metadata?.sliding || part.metadata?.door?.sliding) {
        // Ray (sliding) door panel / rail / mullion: refit to the covering cell's new bounds
        const sliding = part.metadata.sliding || part.metadata.door?.sliding!;
        const xBounds = getXBounds(part.position.y, part.position.x);
        const yBounds = getYBounds(part.position.x, part.position.y);
        const cellWidth = xBounds.max - xBounds.min;
        const cellHeight = yBounds.max - yBounds.min;
        const panelCount = sliding.panelCount || 2;
        const gap = 6;
        const panelWidth = (cellWidth - (panelCount - 1) * gap) / panelCount;
        const panelIndex = sliding.panelIndex ?? 0;
        const panelCenterX = xBounds.min + panelWidth / 2 + panelIndex * (panelWidth + gap);
        const frontFaceZ = minZ - 9;

        if (sliding.part === 'panel') {
          part.dimensions.width = Math.round(panelWidth);
          part.dimensions.height = Math.max(100, Math.round(cellHeight - 8));
          part.position.x = panelCenterX;
          part.position.y = (yBounds.min + yBounds.max) / 2;
          part.position.z = frontFaceZ + (panelIndex % 2 === 0 ? 0 : 14);
        } else if (sliding.part === 'top_rail' || sliding.part === 'bottom_rail') {
          part.dimensions.width = Math.round(cellWidth);
          part.position.x = (xBounds.min + xBounds.max) / 2;
          part.position.y = sliding.part === 'bottom_rail' ? yBounds.min + 6 : yBounds.max - 6;
          part.position.z = frontFaceZ + 8;
        } else if (sliding.part === 'channel') {
          const isVertical = part.dimensions.height > part.dimensions.width;
          if (isVertical) {
            part.dimensions.height = Math.max(100, Math.round(cellHeight - 8));
            part.position.x = clamp(part.position.x, panelCenterX - panelWidth / 2, panelCenterX + panelWidth / 2);
          } else {
            part.dimensions.width = Math.round(panelWidth);
            part.position.x = panelCenterX;
          }
          part.position.y = clamp(part.position.y, yBounds.min, yBounds.max);
        }
      } else if (part.type === 'door' || part.role === 'door_leaf') {
        const isMultiDoor = part.name.includes('Çoklu Hücre');
        part.dimensions.width = isMultiDoor
          ? Math.max(100, (internalWidth - 6) / 2)
          : Math.max(100, internalWidth - 4);
        part.dimensions.height = Math.max(100, newDims.height - 4);
        part.position.x = isMultiDoor
          ? pos.x + (part.position.x < pos.x ? -1 : 1) * (internalWidth / 4)
          : pos.x;
        part.position.y = pos.y + newDims.height / 2;
        part.position.z = minZ - part.dimensions.depth / 2;
      } else if (part.type === 'plinth') {
        part.dimensions.width = newDims.width;
        part.dimensions.depth = Math.max(40, newDims.depth - 40);
        part.position.x = pos.x;
        part.position.z = pos.z - 20;
      } else if (part.type === 'leg') {
        const xOffset = part.position.x < pos.x ? -1 : 1;
        const zOffset = part.position.z < pos.z ? -1 : 1;
        part.position.x = pos.x + xOffset * (newDims.width / 2 - 50);
        part.position.z = pos.z + zOffset * (newDims.depth / 2 - 50);
      } else if (part.type === 'accessory') {
        const accessoryType = part.metadata?.accessory?.accessoryType;
        const targetDrawer = part.metadata?.accessory?.targetDrawerId
          ? allObjects.find((object) => object.id === part.metadata?.accessory?.targetDrawerId)
          : null;

        if (part.metadata?.accessory?.category === 'drawer' && targetDrawer) {
          part.dimensions.width = Math.max(50, targetDrawer.dimensions.width - 34);
          part.dimensions.depth = Math.max(150, targetDrawer.dimensions.depth - 30);
          part.position.x = targetDrawer.position.x;
          part.position.y = clamp(
            targetDrawer.position.y - targetDrawer.dimensions.height / 2 + part.dimensions.height / 2 + 20,
            minY + part.dimensions.height / 2,
            maxY - part.dimensions.height / 2
          );
          part.position.z = targetDrawer.position.z;
        } else {
          const xBounds = getXBounds(part.position.y, part.position.x);
          const yBounds = getYBounds(part.position.x, part.position.y);
          part.position.x = (xBounds.min + xBounds.max) / 2;
          part.position.y = clamp(part.position.y, yBounds.min + part.dimensions.height / 2, yBounds.max - part.dimensions.height / 2);
          if (accessoryType === 'hanging_rail') {
            part.dimensions.width = Math.max(100, internalWidth - 4);
            part.position.y = clamp(maxY - 70, minY + part.dimensions.height / 2, maxY - part.dimensions.height / 2);
          } else if (accessoryType === 'wardrobe_lift') {
            part.dimensions.width = Math.max(100, internalWidth - 24);
            part.position.y = clamp(maxY - 200, minY + part.dimensions.height / 2, maxY - part.dimensions.height / 2);
          } else {
            part.dimensions.width = Math.max(100, xBounds.max - xBounds.min - 28);
          }
          part.position.z = minZ + Math.min(part.dimensions.depth, usableDepth) / 2;
          part.dimensions.depth = Math.min(part.dimensions.depth, Math.max(100, usableDepth));
        }
      }
    });

    const resizedCabinet = allObjects.find((part) => part.id === cabinet.id) || cabinet;
    const resizedCells = CellDetector.calculateCabinetCells(resizedCabinet, allObjects);
    childParts.forEach((part) => {
      if (!part.metadata || resizedCells.length === 0) return;

      const linkedCell = CellDetector.findCellAtPoint(part.position, resizedCells, 150);
      if (linkedCell) {
        part.metadata.cellId = linkedCell.id;
      }

      if (part.metadata.cellIds) {
        const coveredCells = resizedCells.filter((cell) => {
          const partLeft = part.position.x - part.dimensions.width / 2;
          const partRight = part.position.x + part.dimensions.width / 2;
          const partBottom = part.position.y - part.dimensions.height / 2;
          const partTop = part.position.y + part.dimensions.height / 2;
          return (
            Math.min(partRight, cell.maxX) - Math.max(partLeft, cell.minX) > 0 &&
            Math.min(partTop, cell.maxY) - Math.max(partBottom, cell.minY) > 0
          );
        });
        if (coveredCells.length > 0) {
          part.metadata.cellIds = coveredCells.map((cell) => cell.id);
        }
      }
    });
  }
}

export const cadStore = new CadStore();
