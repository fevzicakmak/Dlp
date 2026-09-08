export type ObjectType =
  | 'cabinet'
  | 'panel'
  | 'shelf'
  | 'divider'
  | 'drawer'
  | 'door'
  | 'handle'
  | 'leg'
  | 'plinth'
  | 'wall'
  | 'column'
  | 'beam'
  | 'window'
  | 'room_door'
  | 'group'
  | 'accessory';

export type PanelRole =
  | 'bottom'
  | 'top'
  | 'left'
  | 'right'
  | 'back'
  | 'shelf'
  | 'divider'
  | 'drawer_front'
  | 'drawer_body'
  | 'door_leaf'
  | 'plinth'
  | 'leg'
  | 'handle'
  | 'wall'
  | 'column'
  | 'beam'
  | 'other';

export type MaterialType =
  | 'mdflam'
  | 'mdf'
  | 'suntalam'
  | 'kontrplak'
  | 'masif'
  | 'lake'
  | 'glass'
  | 'metal';

export interface MaterialConfig {
  id: string;
  name: string;
  type: MaterialType;
  color: string;
  texturePattern?: 'wood-grain' | 'solid' | 'metal' | 'glass' | 'marble';
  grainDirection: 'length' | 'width' | 'none';
  roughness: number;
  metalness: number;
  sheetWidth: number; // e.g. 2800 mm
  sheetHeight: number; // e.g. 2100 mm
  defaultThickness: number; // e.g. 18 mm
  unitPricePerM2: number; // e.g. 450 TL / m2
  edgeBandPricePerM: number; // e.g. 15 TL / m
  cuttingPricePerM: number; // e.g. 12 TL / m
}

export interface EdgeBanding {
  top: boolean;
  bottom: boolean;
  left: boolean;
  right: boolean;
  thicknessMm: number; // e.g. 0.8mm or 2mm
  color?: string;
}

export interface Dimensions3D {
  width: number; // X axis in mm
  height: number; // Y axis in mm
  depth: number; // Z axis in mm
  thickness: number; // Panel thickness in mm (e.g. 18mm)
}

export interface Vector3D {
  x: number;
  y: number;
  z: number;
}

export interface Euler3D {
  x: number; // in degrees
  y: number;
  z: number;
}

export interface DoorMetadata {
  doorType: 'single_left' | 'single_right' | 'double' | 'sliding' | 'lift';
  isOpen: boolean;
  openAngle: number; // 0 to 95 degrees
  handleType: 'bar_modern' | 'knob_round' | 'recessed' | 'none';
  handlePosition: 'top' | 'middle' | 'bottom';
  handleOffsetX?: number;
  handleOffsetY?: number;
  hingeCount: number;
  sliding?: SlidingDoorMetadata;
}

export interface SlidingDoorPanelConfig {
  finish: 'mirror' | 'glass' | 'mdflam';
  verticalDividers: number;
  horizontalDividers: number;
}

export interface SlidingDoorMetadata {
  panelCount: number;
  finish: 'mirror' | 'glass' | 'mdflam';
  verticalDividers: number;
  horizontalDividers: number;
  panels?: SlidingDoorPanelConfig[];
  panelIndex?: number;
  part: 'panel' | 'top_rail' | 'bottom_rail' | 'channel';
}

export type CabinetAccessoryType =
  | 'hanging_rail'
  | 'wardrobe_lift'
  | 'pant_rack'
  | 'tie_rack'
  | 'wire_basket'
  | 'led_profile';

export type DrawerAccessoryType =
  | 'cutlery_tray'
  | 'jewelry_tray'
  | 'drawer_organizer';

export type AccessoryType = CabinetAccessoryType | DrawerAccessoryType;

export interface AccessoryMetadata {
  accessoryType: AccessoryType;
  category: 'cabinet' | 'drawer';
  subType?: string;
  isPullOut?: boolean;
  extensionMm?: number;
  maxExtensionMm?: number;
  targetDrawerId?: string;
}

export interface DrawerMetadata {
  drawerCount?: number;
  drawerIndex?: number;
  totalDrawers?: number;
  extensionMm?: number; // 0 to max extension
  maxExtensionMm?: number;
  frontHeight?: number;
  slideType?: 'telescopic' | 'undermount_soft_close';
  handleType?: 'bar_modern' | 'knob_round' | 'profile' | 'recessed' | 'none';
  placement?: 'outer' | 'inner'; // 'outer' (Dış Çekmece) | 'inner' (İç Çekmece)
  accessoryType?: DrawerAccessoryType;
}

export interface SceneObject {
  id: string;
  name: string;
  type: ObjectType;
  role?: PanelRole;
  parentId?: string; // e.g., cabinet_001
  groupId?: string; // SketchUp style group
  position: Vector3D; // mm
  rotation: Euler3D; // degrees
  dimensions: Dimensions3D; // mm
  material: MaterialConfig;
  edgeBanding?: EdgeBanding;
  locked: boolean;
  visible: boolean;
  isCustomPiece?: boolean;
  metadata?: {
    door?: DoorMetadata;
    sliding?: SlidingDoorMetadata;
    drawer?: DrawerMetadata;
    accessory?: AccessoryMetadata;
    cellId?: string;
    cellIds?: string[];
    isAutoGrouped?: boolean;
    wallPoints?: { start: Vector3D; end: Vector3D };
    hardware?: {
      hingeHoles?: { x: number; y: number; diameter: number }[];
      minifixHoles?: { x: number; y: number; diameter: number }[];
      shelfPinHoles?: { x: number; y: number; diameter: number }[];
    };
    [key: string]: any;
  };
  children?: SceneObject[];
}

export interface CabinetCell {
  id: string;
  cabinetId: string;
  minX: number; // local or world bounds in mm
  maxX: number;
  minY: number;
  maxY: number;
  minZ: number;
  maxZ: number;
  width: number;
  height: number;
  depth: number;
  occupiedByType?: ObjectType;
}

export type RenderMode = 'sketch' | 'realistic' | 'unpainted' | 'wood_textured';
export type CameraMode = 'perspective' | 'orthographic';
export type CameraPreset = 'iso' | 'front' | 'top' | 'left' | 'right' | 'back';

export interface CutPiece {
  id: string;
  objectId: string;
  cabinetId?: string;
  name: string;
  width: number; // mm
  height: number; // mm
  thickness: number; // mm
  material: MaterialConfig;
  edgeBanding: EdgeBanding;
  grainDirection: 'length' | 'width' | 'none';
  rotated?: boolean;
  x?: number; // positioned on sheet
  y?: number;
  sheetIndex?: number;
}

export interface SheetRemnant {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  areaM2: number;
  isReusable: boolean;
}

export interface NestedSheet {
  sheetIndex: number;
  material: MaterialConfig;
  sheetWidth: number;
  sheetHeight: number;
  pieces: CutPiece[];
  remnants: SheetRemnant[];
  usedAreaM2: number;
  totalAreaM2: number;
  wastePercentage: number;
  cutLengthMeters: number;
  efficiencyPercentage: number;
  strategyUsed?: string;
}

export interface CostBreakdown {
  materials: {
    material: MaterialConfig;
    sheetCount: number;
    totalAreaM2: number;
    cost: number;
  }[];
  edgeBanding: {
    totalLengthMeters: number;
    cost: number;
  };
  cuttingAndMachining: {
    totalCutMeters: number;
    cost: number;
  };
  hardware: {
    hinges: { count: number; unitPrice: number; total: number };
    drawerSlides: { count: number; unitPrice: number; total: number };
    handles: { count: number; unitPrice: number; total: number };
    minifixKavela: { count: number; unitPrice: number; total: number };
    legs: { count: number; unitPrice: number; total: number };
    total: number;
  };
  laborAndAssembly: number;
  totalCost: number;
}

export interface HistoryAction {
  description: string;
  timestamp: number;
  objects: SceneObject[];
  groups: string[];
}
