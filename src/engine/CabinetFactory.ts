import {
  SceneObject,
  MaterialConfig,
  EdgeBanding,
  Vector3D,
  CabinetCell,
  SlidingDoorMetadata,
  CabinetAccessoryType,
  DrawerAccessoryType,
} from '../types/cad';
import { DEFAULT_MATERIALS } from '../constants/materials';

let cabinetCounter = 0;
let elementCounter = 0;

export class CabinetFactory {
  public static resetCounters(maxCabinetIndex = 0, maxElementIndex = 0) {
    cabinetCounter = maxCabinetIndex;
    elementCounter = maxElementIndex;
  }

  public static generateNextCabinetId(): string {
    cabinetCounter++;
    const pad = String(cabinetCounter).padStart(3, '0');
    return `cabinet_${pad}`;
  }

  public static generateNextElementId(prefix: string): string {
    elementCounter++;
    const pad = String(elementCounter).padStart(3, '0');
    return `${prefix}_${pad}`;
  }

  /**
   * Checks if an object is duplicate (same role/type, overlapping position and dimensions)
   */
  public static isDuplicateObject(candidate: SceneObject, existingObjects: SceneObject[]): boolean {
    return existingObjects.some((existing) => {
      // Must be same type or role
      const sameType = existing.type === candidate.type;
      const sameRole = existing.role && candidate.role && existing.role === candidate.role;
      if (!sameType && !sameRole) return false;

      // Check accessory type match if accessory
      if (candidate.type === 'accessory' && existing.type === 'accessory') {
        const cType = candidate.metadata?.accessory?.accessoryType;
        const eType = existing.metadata?.accessory?.accessoryType;
        if (cType && eType && cType !== eType) return false;
      }

      // Check position tolerance (within 15mm)
      const dx = Math.abs(existing.position.x - candidate.position.x);
      const dy = Math.abs(existing.position.y - candidate.position.y);
      const dz = Math.abs(existing.position.z - candidate.position.z);
      const posMatch = dx < 18 && dy < 18 && dz < 25;

      // Check dimensions tolerance (within 20mm)
      const dw = Math.abs(existing.dimensions.width - candidate.dimensions.width);
      const dh = Math.abs(existing.dimensions.height - candidate.dimensions.height);
      const dd = Math.abs(existing.dimensions.depth - candidate.dimensions.depth);
      const dimMatch = dw < 25 && dh < 25 && dd < 25;

      return posMatch && dimMatch;
    });
  }

  /**
   * Creates a standard initial cabinet consisting strictly of:
   * 1. Alt tabla (Bottom)
   * 2. Üst tabla (Top)
   * 3. Sol yan panel (Left side)
   * 4. Sağ yan panel (Right side)
   * 5. Arkalık (Back panel)
   * All with hierarchical, independent IDs and full individual interactivity.
   */
  public static createCabinet(options?: {
    id?: string;
    width?: number; // default: 800 mm
    height?: number; // default: 2000 mm
    depth?: number; // default: 600 mm
    thickness?: number; // default: 18 mm
    backThickness?: number; // default: 8 mm
    position?: Vector3D;
    material?: MaterialConfig;
    backMaterial?: MaterialConfig;
  }): { cabinetRoot: SceneObject; parts: SceneObject[] } {
    const width = options?.width ?? 800;
    const height = options?.height ?? 2000;
    const depth = options?.depth ?? 600;
    const thickness = options?.thickness ?? 18;
    const backThickness = options?.backThickness ?? 8;
    const pos = options?.position ?? { x: 0, y: 0, z: 0 };
    const mat = options?.material ?? DEFAULT_MATERIALS[0]; // MDFLAM White
    const backMat = options?.backMaterial ?? DEFAULT_MATERIALS[8]; // Back panel 8mm

    const cabId = options?.id ?? this.generateNextCabinetId();

    const edgeBandStandard: EdgeBanding = {
      top: true,
      bottom: true,
      left: true,
      right: true,
      thicknessMm: 0.8,
    };

    // Root container object
    const cabinetRoot: SceneObject = {
      id: cabId,
      name: `Dolap (${width}x${height}x${depth}mm)`,
      type: 'cabinet',
      position: { ...pos },
      rotation: { x: 0, y: 0, z: 0 },
      dimensions: { width, height, depth, thickness },
      material: mat,
      locked: false,
      visible: true,
      metadata: {
        isCabinetRoot: true,
        defaultThickness: thickness,
        backThickness: backThickness,
      },
    };

    // Internal dimensions:
    // Left & Right panels stand between bottom and top, or bottom/top rest between/over sides.
    // Standard European/Turkish cabinet construction:
    // Side panels run full height (from Y=0 to Y=height),
    // Bottom & Top panels are clamped between sides, or Bottom/Top run full width.
    // Let's use the standard modular cabinet standard:
    // Sides run full height: H = height, W = thickness, D = depth - backThickness
    // Bottom & Top sit inside: Width = width - (2 * thickness), D = depth - backThickness
    // Back sits at the back: W = width - 2, H = height - 2, D = backThickness

    const internalWidth = width - 2 * thickness;
    const usableDepth = depth - backThickness;

    // 1. Sol Yan Panel (Left Side Panel)
    const leftPanel: SceneObject = {
      id: `${cabId}_left`,
      parentId: cabId,
      name: 'Sol Yan Panel',
      type: 'panel',
      role: 'left',
      position: {
        x: pos.x - width / 2 + thickness / 2,
        y: pos.y + height / 2,
        z: pos.z - backThickness / 2,
      },
      rotation: { x: 0, y: 0, z: 0 },
      dimensions: { width: thickness, height: height, depth: usableDepth, thickness },
      material: mat,
      edgeBanding: { ...edgeBandStandard },
      locked: false,
      visible: true,
      metadata: { role: 'left_side' },
    };

    // 2. Sağ Yan Panel (Right Side Panel)
    const rightPanel: SceneObject = {
      id: `${cabId}_right`,
      parentId: cabId,
      name: 'Sağ Yan Panel',
      type: 'panel',
      role: 'right',
      position: {
        x: pos.x + width / 2 - thickness / 2,
        y: pos.y + height / 2,
        z: pos.z - backThickness / 2,
      },
      rotation: { x: 0, y: 0, z: 0 },
      dimensions: { width: thickness, height: height, depth: usableDepth, thickness },
      material: mat,
      edgeBanding: { ...edgeBandStandard },
      locked: false,
      visible: true,
      metadata: { role: 'right_side' },
    };

    // 3. Alt Tabla (Bottom Panel)
    const bottomPanel: SceneObject = {
      id: `${cabId}_bottom`,
      parentId: cabId,
      name: 'Alt Tabla',
      type: 'panel',
      role: 'bottom',
      position: {
        x: pos.x,
        y: pos.y + thickness / 2,
        z: pos.z - backThickness / 2,
      },
      rotation: { x: 0, y: 0, z: 0 },
      dimensions: { width: internalWidth, height: thickness, depth: usableDepth, thickness },
      material: mat,
      edgeBanding: { ...edgeBandStandard },
      locked: false,
      visible: true,
      metadata: { role: 'bottom' },
    };

    // 4. Üst Tabla (Top Panel)
    const topPanel: SceneObject = {
      id: `${cabId}_top`,
      parentId: cabId,
      name: 'Üst Tabla',
      type: 'panel',
      role: 'top',
      position: {
        x: pos.x,
        y: pos.y + height - thickness / 2,
        z: pos.z - backThickness / 2,
      },
      rotation: { x: 0, y: 0, z: 0 },
      dimensions: { width: internalWidth, height: thickness, depth: usableDepth, thickness },
      material: mat,
      edgeBanding: { ...edgeBandStandard },
      locked: false,
      visible: true,
      metadata: { role: 'top' },
    };

    // 5. Arkalık (Back Panel)
    const backPanel: SceneObject = {
      id: `${cabId}_back`,
      parentId: cabId,
      name: 'Arkalık',
      type: 'panel',
      role: 'back',
      position: {
        x: pos.x,
        y: pos.y + height / 2,
        z: pos.z + depth / 2 - backThickness / 2,
      },
      rotation: { x: 0, y: 0, z: 0 },
      dimensions: { width: width - 4, height: height - 4, depth: backThickness, thickness: backThickness },
      material: backMat,
      edgeBanding: { top: false, bottom: false, left: false, right: false, thicknessMm: 0 },
      locked: false,
      visible: true,
      metadata: { role: 'back' },
    };

    const parts = [leftPanel, rightPanel, bottomPanel, topPanel, backPanel];
    return { cabinetRoot, parts };
  }

  /**
   * Creates a horizontal shelf fitted to a cell or custom bounds
   */
  public static createShelf(cell: CabinetCell, material?: MaterialConfig, thickness = 18): SceneObject {
    const mat = material ?? DEFAULT_MATERIALS[0];
    const id = this.generateNextElementId(`${cell.cabinetId}_shelf`);

    return {
      id,
      parentId: cell.cabinetId,
      name: 'Yatay Raf',
      type: 'shelf',
      role: 'shelf',
      position: {
        x: (cell.minX + cell.maxX) / 2,
        y: (cell.minY + cell.maxY) / 2,
        z: (cell.minZ + cell.maxZ) / 2,
      },
      rotation: { x: 0, y: 0, z: 0 },
      dimensions: {
        width: cell.width,
        height: thickness,
        depth: cell.depth,
        thickness,
      },
      material: mat,
      edgeBanding: { top: true, bottom: false, left: false, right: false, thicknessMm: 0.8 },
      locked: false,
      visible: true,
      metadata: {
        cellId: cell.id,
        isMovableVertically: true,
      },
    };
  }

  /**
   * Creates a vertical divider fitted to a cell
   */
  public static createDivider(cell: CabinetCell, material?: MaterialConfig, thickness = 18): SceneObject {
    const mat = material ?? DEFAULT_MATERIALS[0];
    const id = this.generateNextElementId(`${cell.cabinetId}_divider`);

    return {
      id,
      parentId: cell.cabinetId,
      name: 'Dikey Dikme',
      type: 'divider',
      role: 'divider',
      position: {
        x: (cell.minX + cell.maxX) / 2,
        y: (cell.minY + cell.maxY) / 2,
        z: (cell.minZ + cell.maxZ) / 2,
      },
      rotation: { x: 0, y: 0, z: 0 },
      dimensions: {
        width: thickness,
        height: cell.height,
        depth: cell.depth,
        thickness,
      },
      material: mat,
      edgeBanding: { top: false, bottom: false, left: true, right: false, thicknessMm: 0.8 },
      locked: false,
      visible: true,
      metadata: {
        cellId: cell.id,
        isMovableHorizontally: true,
      },
    };
  }

  /**
   * Creates a drawer inside a cell with front panel, drawer box and handle.
   * Supports both 'outer' (dış çekmece) and 'inner' (iç çekmece).
   */
  public static createDrawer(
    cell: CabinetCell,
    material?: MaterialConfig,
    frontHeight?: number,
    drawerIndex = 0,
    totalDrawers = 1,
    placement: 'outer' | 'inner' = 'outer',
    customY?: number
  ): SceneObject {
    const mat = material ?? DEFAULT_MATERIALS[0];
    const isInner = placement === 'inner';
    const id = this.generateNextElementId(`${cell.cabinetId}_drawer`);
    const fHeight = frontHeight ?? cell.height;
    const boxDepth = cell.depth;

    const targetY = customY ?? (cell.minY + fHeight / 2 + drawerIndex * fHeight);
    const targetZ = cell.minZ + boxDepth / 2 - (isInner ? 0 : 18);
    const width = cell.width;
    const actualHeight = Math.max(1, Math.round(fHeight));

    const namePrefix = isInner ? 'İç Çekmece' : 'Çekmece';
    const name = totalDrawers > 1 ? `${namePrefix} ${drawerIndex + 1}/${totalDrawers}` : `${namePrefix} ${drawerIndex + 1}`;

    return {
      id,
      parentId: cell.cabinetId,
      name,
      type: 'drawer',
      role: 'drawer_front',
      position: {
        x: (cell.minX + cell.maxX) / 2,
        y: Math.round(targetY),
        z: Math.round(targetZ),
      },
      rotation: { x: 0, y: 0, z: 0 },
      dimensions: {
        width,
        height: actualHeight,
        depth: boxDepth,
        thickness: 18,
      },
      material: mat,
      edgeBanding: { top: true, bottom: true, left: true, right: true, thicknessMm: 0.8 },
      locked: false,
      visible: true,
      metadata: {
        cellId: cell.id,
        drawer: {
          drawerIndex,
          totalDrawers,
          extensionMm: 0,
          maxExtensionMm: boxDepth * 0.8,
          frontHeight: actualHeight,
          slideType: 'telescopic',
          handleType: isInner ? 'recessed' : 'bar_modern',
          placement,
        },
      },
    };
  }

  /**
   * Creates multiple vertically stacked drawers inside a single cell,
   * dividing the cell height equally with standard gaps.
   */
  public static createMultipleDrawers(
    cell: CabinetCell,
    count = 3,
    material?: MaterialConfig,
    placement: 'outer' | 'inner' = 'outer'
  ): SceneObject[] {
    const validCount = Math.max(1, Math.min(count, 8));
    const isInner = placement === 'inner';
    const mat = material ?? DEFAULT_MATERIALS[0];
    const totalHeight = cell.height;
    const gap = 3; // 3mm vertical gap between drawer fronts
    const edgeMargin = 2; // 2mm top & bottom margin
    const usableHeight = totalHeight - (validCount - 1) * gap - 2 * edgeMargin;
    const eachHeight = Math.max(40, usableHeight / validCount);
    const boxDepth = cell.depth;
    const width = cell.width;

    const drawers: SceneObject[] = [];
    const namePrefix = isInner ? 'İç Çekmece' : 'Çekmece';

    for (let i = 0; i < validCount; i++) {
      const id = this.generateNextElementId(`${cell.cabinetId}_drawer`);
      const bottomY = cell.minY + edgeMargin + i * (eachHeight + gap);
      const centerY = bottomY + eachHeight / 2;
      const targetZ = cell.minZ + boxDepth / 2 - (isInner ? 0 : 18);

      drawers.push({
        id,
        parentId: cell.cabinetId,
        name: `${namePrefix} ${i + 1} (${validCount}'lü)`,
        type: 'drawer',
        role: 'drawer_front',
        position: {
          x: (cell.minX + cell.maxX) / 2,
          y: Math.round(centerY),
          z: Math.round(targetZ),
        },
        rotation: { x: 0, y: 0, z: 0 },
        dimensions: {
          width,
          height: Math.round(eachHeight),
          depth: boxDepth,
          thickness: 18,
        },
        material: mat,
        edgeBanding: { top: true, bottom: true, left: true, right: true, thicknessMm: 0.8 },
        locked: false,
        visible: true,
        metadata: {
          cellId: cell.id,
          drawer: {
            drawerIndex: i,
            totalDrawers: validCount,
            extensionMm: 0,
            maxExtensionMm: boxDepth * 0.8,
            frontHeight: Math.round(eachHeight),
            slideType: 'telescopic',
            handleType: isInner ? 'recessed' : 'bar_modern',
            placement,
          },
        },
      });
    }

    return drawers;
  }

  /**
   * Creates Cabinet Interior Accessories (Askı Borusu, Asansörlü Askı, Pantolonluk, Kravatlık, Tel Sepet, LED Profil)
   */
  public static createAccessory(
    cell: CabinetCell,
    accessoryType: CabinetAccessoryType,
    material?: MaterialConfig
  ): SceneObject {
    const id = this.generateNextElementId(`${cell.cabinetId}_acc`);
    const metalMat = DEFAULT_MATERIALS[10] || DEFAULT_MATERIALS[0];
    const mat = material ?? metalMat;

    let name = 'Dolap İçi Aksesuar';
    let dims = { width: cell.width, height: 30, depth: cell.depth, thickness: 30 };
    let pos = {
      x: (cell.minX + cell.maxX) / 2,
      y: (cell.minY + cell.maxY) / 2,
      z: (cell.minZ + cell.maxZ) / 2,
    };
    let isPullOut = false;
    let maxExtensionMm = 0;

    switch (accessoryType) {
      case 'hanging_rail':
        name = 'Askı Borusu (Alüminyum Oval)';
        dims = { width: Math.max(100, cell.width - 4), height: 30, depth: cell.depth, thickness: 16 };
        pos = {
          x: (cell.minX + cell.maxX) / 2,
          y: Math.round(cell.maxY - 70),
          z: Math.round((cell.minZ + cell.maxZ) / 2),
        };
        break;

      case 'wardrobe_lift':
        name = 'Asansörlü Askılık (Hidrolik)';
        dims = { width: Math.max(100, cell.width - 24), height: 380, depth: cell.depth, thickness: 25 };
        pos = {
          x: (cell.minX + cell.maxX) / 2,
          y: Math.round(cell.maxY - 200),
          z: Math.round((cell.minZ + cell.maxZ) / 2),
        };
        break;

      case 'pant_rack':
        name = 'Raylı Pantolonluk (Teleskopik)';
        isPullOut = true;
        maxExtensionMm = Math.max(250, cell.depth - 60) * 0.8;
        dims = {
          width: Math.max(100, cell.width - 28),
          height: 110,
          depth: cell.depth,
          thickness: 25,
        };
        pos = {
          x: (cell.minX + cell.maxX) / 2,
          y: Math.round(cell.minY + 90),
          z: Math.round((cell.minZ + cell.maxZ) / 2),
        };
        break;

      case 'tie_rack':
        name = 'Kravatlık & Kemerlik (Yana Monte)';
        isPullOut = true;
        maxExtensionMm = Math.max(200, cell.depth - 80) * 0.75;
        dims = {
          width: 45,
          height: 90,
          depth: cell.depth,
          thickness: 20,
        };
        pos = {
          x: Math.round(cell.minX + 26),
          y: Math.round((cell.minY + cell.maxY) / 2),
          z: Math.round((cell.minZ + cell.maxZ) / 2),
        };
        break;

      case 'wire_basket':
        name = 'Raylı Tel Sepet';
        isPullOut = true;
        maxExtensionMm = Math.max(250, cell.depth - 60) * 0.8;
        dims = {
          width: Math.max(100, cell.width - 28),
          height: 180,
          depth: cell.depth,
          thickness: 20,
        };
        pos = {
          x: (cell.minX + cell.maxX) / 2,
          y: Math.round(cell.minY + 100),
          z: Math.round((cell.minZ + cell.maxZ) / 2),
        };
        break;

      case 'led_profile':
        name = 'LED Profil Aydınlatma';
        dims = {
          width: Math.max(100, cell.width - 10),
          height: 12,
          depth: cell.depth,
          thickness: 12,
        };
        pos = {
          x: (cell.minX + cell.maxX) / 2,
          y: Math.round(cell.maxY - 8),
          z: Math.round(cell.minZ + 35),
        };
        break;
    }

    return {
      id,
      parentId: cell.cabinetId,
      name,
      type: 'accessory',
      role: 'other',
      position: pos,
      rotation: { x: 0, y: 0, z: 0 },
      dimensions: dims,
      material: mat,
      locked: false,
      visible: true,
      metadata: {
        cellId: cell.id,
        accessory: {
          accessoryType,
          category: 'cabinet',
          isPullOut,
          extensionMm: 0,
          maxExtensionMm,
        },
      },
    };
  }

  /**
   * Creates Drawer Interior Accessories (Kaşıklık, Takılık, Çekmece Bölücü)
   */
  public static createDrawerAccessory(
    drawer: SceneObject,
    accessoryType: DrawerAccessoryType,
    material?: MaterialConfig
  ): SceneObject {
    const id = this.generateNextElementId(`${drawer.id}_dacc`);
    const defaultMat = DEFAULT_MATERIALS[1] || DEFAULT_MATERIALS[0];
    const mat = material ?? defaultMat;

    const dw = Math.max(80, drawer.dimensions.width - 34);
    const dh = Math.min(65, Math.max(35, drawer.dimensions.height - 40));
    const dd = Math.max(150, drawer.dimensions.depth - 30);

    let name = 'Çekmece İçi Aksesuar';
    switch (accessoryType) {
      case 'cutlery_tray':
        name = 'Çatal Kaşıklık Organizer';
        break;
      case 'jewelry_tray':
        name = 'Takılık & Mücevher Kutusu';
        break;
      case 'drawer_organizer':
        name = 'Çekmece İçi Bölücü Izgara';
        break;
    }

    // Accessory sits inside the drawer box bottom
    const posX = drawer.position.x;
    const posY = drawer.position.y - drawer.dimensions.height / 2 + dh / 2 + 20;
    const posZ = drawer.position.z;

    return {
      id,
      parentId: drawer.parentId,
      name: `${name} (${drawer.name})`,
      type: 'accessory',
      role: 'other',
      position: {
        x: Math.round(posX),
        y: Math.round(posY),
        z: Math.round(posZ),
      },
      rotation: { x: 0, y: 0, z: 0 },
      dimensions: {
        width: Math.round(dw),
        height: Math.round(dh),
        depth: Math.round(dd),
        thickness: 12,
      },
      material: mat,
      locked: false,
      visible: true,
      metadata: {
        cellId: drawer.metadata?.cellId,
        accessory: {
          accessoryType,
          category: 'drawer',
          targetDrawerId: drawer.id,
        },
      },
    };
  }

  /**
   * Creates doors spanning a custom 3D bounding box (single cell or merged multi-cells)
   */
  public static createDoorFromBounds(
    bounds: {
      minX: number;
      maxX: number;
      minY: number;
      maxY: number;
      minZ: number;
      maxZ: number;
      cabinetId: string;
      cellIds?: string[];
    },
    doorType: 'single_left' | 'single_right' | 'double' = 'single_left',
    material?: MaterialConfig
  ): SceneObject[] {
    const mat = material ?? DEFAULT_MATERIALS[0];
    const width = Math.max(100, bounds.maxX - bounds.minX);
    const height = Math.max(100, bounds.maxY - bounds.minY);
    const doors: SceneObject[] = [];

    if (doorType === 'double') {
      const halfWidth = (width - 6) / 2;

      const leftDoorId = this.generateNextElementId(`${bounds.cabinetId}_door_left`);
      doors.push({
        id: leftDoorId,
        parentId: bounds.cabinetId,
        name: 'Sol Kapak (Çoklu Hücre)',
        type: 'door',
        role: 'door_leaf',
        position: {
          x: bounds.minX + halfWidth / 2 + 2,
          y: (bounds.minY + bounds.maxY) / 2,
          z: bounds.minZ - 9,
        },
        rotation: { x: 0, y: 0, z: 0 },
        dimensions: {
          width: Math.round(halfWidth),
          height: Math.round(height - 4),
          depth: 18,
          thickness: 18,
        },
        material: mat,
        edgeBanding: { top: true, bottom: true, left: true, right: true, thicknessMm: 0.8 },
        locked: false,
        visible: true,
        metadata: {
          cellIds: bounds.cellIds,
          door: {
            doorType: 'single_left',
            isOpen: false,
            openAngle: 0,
            handleType: 'bar_modern',
            handlePosition: 'middle',
            hingeCount: height > 1200 ? (height > 1800 ? 4 : 3) : 2,
          },
        },
      });

      const rightDoorId = this.generateNextElementId(`${bounds.cabinetId}_door_right`);
      doors.push({
        id: rightDoorId,
        parentId: bounds.cabinetId,
        name: 'Sağ Kapak (Çoklu Hücre)',
        type: 'door',
        role: 'door_leaf',
        position: {
          x: bounds.maxX - halfWidth / 2 - 2,
          y: (bounds.minY + bounds.maxY) / 2,
          z: bounds.minZ - 9,
        },
        rotation: { x: 0, y: 0, z: 0 },
        dimensions: {
          width: Math.round(halfWidth),
          height: Math.round(height - 4),
          depth: 18,
          thickness: 18,
        },
        material: mat,
        edgeBanding: { top: true, bottom: true, left: true, right: true, thicknessMm: 0.8 },
        locked: false,
        visible: true,
        metadata: {
          cellIds: bounds.cellIds,
          door: {
            doorType: 'single_right',
            isOpen: false,
            openAngle: 0,
            handleType: 'bar_modern',
            handlePosition: 'middle',
            hingeCount: height > 1200 ? (height > 1800 ? 4 : 3) : 2,
          },
        },
      });
    } else {
      const doorId = this.generateNextElementId(`${bounds.cabinetId}_door`);
      doors.push({
        id: doorId,
        parentId: bounds.cabinetId,
        name: doorType === 'single_left' ? 'Kapak (Sol Açılır)' : 'Kapak (Sağ Açılır)',
        type: 'door',
        role: 'door_leaf',
        position: {
          x: (bounds.minX + bounds.maxX) / 2,
          y: (bounds.minY + bounds.maxY) / 2,
          z: bounds.minZ - 9,
        },
        rotation: { x: 0, y: 0, z: 0 },
        dimensions: {
          width: Math.round(width - 4),
          height: Math.round(height - 4),
          depth: 18,
          thickness: 18,
        },
        material: mat,
        edgeBanding: { top: true, bottom: true, left: true, right: true, thicknessMm: 0.8 },
        locked: false,
        visible: true,
        metadata: {
          cellIds: bounds.cellIds,
          door: {
            doorType,
            isOpen: false,
            openAngle: 0,
            handleType: 'bar_modern',
            handlePosition: 'middle',
            hingeCount: height > 1200 ? (height > 1800 ? 4 : 3) : 2,
          },
        },
      });
    }

    return doors;
  }

  /**
   * Creates a Wall drawn from 2 ground points (start and end)
   */
  public static createWallFromPoints(
    start: Vector3D,
    end: Vector3D,
    height = 2600,
    thickness = 150,
    material?: MaterialConfig
  ): SceneObject {
    const id = this.generateNextElementId('arch_wall');
    const dx = end.x - start.x;
    const dz = end.z - start.z;
    const length = Math.max(50, Math.round(Math.hypot(dx, dz)));
    const angleRad = Math.atan2(dz, dx);
    const angleDeg = -Math.round((angleRad * 180) / Math.PI);

    const midX = Math.round((start.x + end.x) / 2);
    const midZ = Math.round((start.z + end.z) / 2);
    const midY = Math.round(height / 2);

    const mat = material ?? DEFAULT_MATERIALS[0];

    return {
      id,
      name: `Duvar (${length}x${height}mm)`,
      type: 'wall',
      role: 'wall',
      position: { x: midX, y: midY, z: midZ },
      rotation: { x: 0, y: angleDeg, z: 0 },
      dimensions: {
        width: length,
        height,
        depth: thickness,
        thickness,
      },
      material: mat,
      locked: false,
      visible: true,
      metadata: {
        isArchitectural: true,
        wallPoints: { start, end },
      },
    };
  }

  /**
   * Creates a Beam drawn from 2 ground/ceiling points
   */
  public static createBeamFromPoints(
    start: Vector3D,
    end: Vector3D,
    height = 400,
    thickness = 300,
    elevationY = 2400,
    material?: MaterialConfig
  ): SceneObject {
    const id = this.generateNextElementId('arch_beam');
    const dx = end.x - start.x;
    const dz = end.z - start.z;
    const length = Math.max(50, Math.round(Math.hypot(dx, dz)));
    const angleRad = Math.atan2(dz, dx);
    const angleDeg = -Math.round((angleRad * 180) / Math.PI);

    const midX = Math.round((start.x + end.x) / 2);
    const midZ = Math.round((start.z + end.z) / 2);
    const midY = Math.round(elevationY - height / 2);

    const mat = material ?? DEFAULT_MATERIALS[0];

    return {
      id,
      name: `Kiriş (${length}x${height}mm)`,
      type: 'beam',
      role: 'beam',
      position: { x: midX, y: midY, z: midZ },
      rotation: { x: 0, y: angleDeg, z: 0 },
      dimensions: {
        width: length,
        height,
        depth: thickness,
        thickness,
      },
      material: mat,
      locked: false,
      visible: true,
      metadata: {
        isArchitectural: true,
        wallPoints: { start, end },
      },
    };
  }

  /**
   * Creates a Column drawn on ground between two corner points
   */
  public static createColumnFromPoints(
    start: Vector3D,
    end: Vector3D,
    height = 2600,
    material?: MaterialConfig
  ): SceneObject {
    const id = this.generateNextElementId('arch_column');
    const w = Math.max(100, Math.round(Math.abs(end.x - start.x)));
    const d = Math.max(100, Math.round(Math.abs(end.z - start.z)));

    const midX = Math.round((start.x + end.x) / 2);
    const midZ = Math.round((start.z + end.z) / 2);
    const midY = Math.round(height / 2);

    const mat = material ?? DEFAULT_MATERIALS[0];

    return {
      id,
      name: `Kolon (${w}x${d}x${height}mm)`,
      type: 'column',
      role: 'column',
      position: { x: midX, y: midY, z: midZ },
      rotation: { x: 0, y: 0, z: 0 },
      dimensions: {
        width: w,
        height,
        depth: d,
        thickness: Math.min(w, d),
      },
      material: mat,
      locked: false,
      visible: true,
      metadata: {
        isArchitectural: true,
        wallPoints: { start, end },
      },
    };
  }

  /**
   * Creates doors for a cell (Single Left, Single Right, or Double)
   */
  public static createDoor(
    cell: CabinetCell,
    doorType: 'single_left' | 'single_right' | 'double' = 'single_left',
    material?: MaterialConfig
  ): SceneObject[] {
    const mat = material ?? DEFAULT_MATERIALS[0];
    const doors: SceneObject[] = [];

    if (doorType === 'double') {
      const halfWidth = (cell.width - 6) / 2; // 2mm gap between doors + sides
      
      const leftDoorId = this.generateNextElementId(`${cell.cabinetId}_door_left`);
      doors.push({
        id: leftDoorId,
        parentId: cell.cabinetId,
        name: 'Sol Kapak',
        type: 'door',
        role: 'door_leaf',
        position: {
          x: cell.minX + halfWidth / 2 + 2,
          y: (cell.minY + cell.maxY) / 2,
          z: cell.minZ - 9, // sits flush on front
        },
        rotation: { x: 0, y: 0, z: 0 },
        dimensions: {
          width: halfWidth,
          height: cell.height - 4,
          depth: 18,
          thickness: 18,
        },
        material: mat,
        edgeBanding: { top: true, bottom: true, left: true, right: true, thicknessMm: 0.8 },
        locked: false,
        visible: true,
        metadata: {
          cellId: cell.id,
          door: {
            doorType: 'single_left',
            isOpen: false,
            openAngle: 0,
            handleType: 'bar_modern',
            handlePosition: 'middle',
            hingeCount: cell.height > 1200 ? 3 : 2,
          },
        },
      });

      const rightDoorId = this.generateNextElementId(`${cell.cabinetId}_door_right`);
      doors.push({
        id: rightDoorId,
        parentId: cell.cabinetId,
        name: 'Sağ Kapak',
        type: 'door',
        role: 'door_leaf',
        position: {
          x: cell.maxX - halfWidth / 2 - 2,
          y: (cell.minY + cell.maxY) / 2,
          z: cell.minZ - 9,
        },
        rotation: { x: 0, y: 0, z: 0 },
        dimensions: {
          width: halfWidth,
          height: cell.height - 4,
          depth: 18,
          thickness: 18,
        },
        material: mat,
        edgeBanding: { top: true, bottom: true, left: true, right: true, thicknessMm: 0.8 },
        locked: false,
        visible: true,
        metadata: {
          cellId: cell.id,
          door: {
            doorType: 'single_right',
            isOpen: false,
            openAngle: 0,
            handleType: 'bar_modern',
            handlePosition: 'middle',
            hingeCount: cell.height > 1200 ? 3 : 2,
          },
        },
      });
    } else {
      const doorId = this.generateNextElementId(`${cell.cabinetId}_door`);
      doors.push({
        id: doorId,
        parentId: cell.cabinetId,
        name: doorType === 'single_left' ? 'Kapak (Sol Açılır)' : 'Kapak (Sağ Açılır)',
        type: 'door',
        role: 'door_leaf',
        position: {
          x: (cell.minX + cell.maxX) / 2,
          y: (cell.minY + cell.maxY) / 2,
          z: cell.minZ - 9,
        },
        rotation: { x: 0, y: 0, z: 0 },
        dimensions: {
          width: cell.width - 4,
          height: cell.height - 4,
          depth: 18,
          thickness: 18,
        },
        material: mat,
        edgeBanding: { top: true, bottom: true, left: true, right: true, thicknessMm: 0.8 },
        locked: false,
        visible: true,
        metadata: {
          cellId: cell.id,
          door: {
            doorType,
            isOpen: false,
            openAngle: 0,
            handleType: 'bar_modern',
            handlePosition: 'middle',
            hingeCount: cell.height > 1200 ? 3 : 2,
          },
        },
      });
    }

    return doors;
  }

  public static createSlidingDoorSet(
    cell: CabinetCell,
    options: {
      panelCount: number;
      finish: SlidingDoorMetadata['finish'];
      verticalDividers: number;
      horizontalDividers: number;
      panels?: Array<{
        finish: SlidingDoorMetadata['finish'];
        verticalDividers: number;
        horizontalDividers: number;
      }>;
    }
  ): SceneObject[] {
    const panelCount = Math.max(2, Math.min(5, Math.round(options.panelCount)));
    const panelConfigs = Array.from({ length: panelCount }, (_, index) => {
      const config = options.panels?.[index] ?? {
        finish: options.finish,
        verticalDividers: options.verticalDividers,
        horizontalDividers: options.horizontalDividers,
      };
      return {
        finish: config.finish ?? options.finish,
        verticalDividers: Math.max(0, Math.min(3, Number(config.verticalDividers ?? options.verticalDividers))),
        horizontalDividers: Math.max(0, Math.min(3, Number(config.horizontalDividers ?? options.horizontalDividers))),
      };
    });

    const panelWidth = (cell.width - (panelCount - 1) * 6) / panelCount;
    const panelHeight = Math.max(100, cell.height - 8);
    const panelDepth = 18;
    const frontFaceZ = cell.minZ - 9;
    const objects: SceneObject[] = [];

    for (let index = 0; index < panelCount; index++) {
      const cfg = panelConfigs[index];
      const finishMaterial = cfg.finish === 'glass'
        ? DEFAULT_MATERIALS.find((material) => material.type === 'glass') ?? DEFAULT_MATERIALS[0]
        : cfg.finish === 'mirror'
        ? { ...DEFAULT_MATERIALS[0], name: 'Ayna Panel', color: '#cbd5e1', metalness: 0.75, roughness: 0.08 }
        : DEFAULT_MATERIALS[0];
      const x = cell.minX + panelWidth / 2 + index * (panelWidth + 6);
      const railLayerOffset = index % 2 === 0 ? 0 : 14;
      objects.push({
        id: this.generateNextElementId(`${cell.cabinetId}_sliding_panel`),
        parentId: cell.cabinetId,
        name: `Ray Kapak ${index + 1}/${panelCount}`,
        type: 'door',
        role: 'door_leaf',
        position: { x, y: (cell.minY + cell.maxY) / 2, z: frontFaceZ + railLayerOffset },
        rotation: { x: 0, y: 0, z: 0 },
        dimensions: { width: Math.round(panelWidth), height: Math.round(panelHeight), depth: panelDepth, thickness: panelDepth },
        material: finishMaterial,
        locked: false,
        visible: true,
        metadata: {
          cellId: cell.id,
          door: {
            doorType: 'sliding', isOpen: false, openAngle: 0,
            handleType: 'bar_modern', handlePosition: 'middle', hingeCount: 0,
            sliding: { ...options, ...cfg, panelCount, panelIndex: index, part: 'panel' },
          },
        },
      });
    }

    const railMaterial = { ...DEFAULT_MATERIALS[10], name: 'Ray Mekanizması', color: '#475569', metalness: 0.85, roughness: 0.25 };
    for (const part of ['bottom_rail', 'top_rail'] as const) {
      objects.push({
        id: this.generateNextElementId(`${cell.cabinetId}_${part}`), parentId: cell.cabinetId,
        name: part === 'bottom_rail' ? 'Alt Ray Kanalı' : 'Üst Ray Kanalı', type: 'accessory', role: 'other',
        position: { x: (cell.minX + cell.maxX) / 2, y: part === 'bottom_rail' ? cell.minY + 6 : cell.maxY - 6, z: frontFaceZ + 8 },
        rotation: { x: 0, y: 0, z: 0 }, dimensions: { width: cell.width, height: 12, depth: 28, thickness: 12 },
        material: railMaterial, locked: false, visible: true,
        metadata: { cellId: cell.id, sliding: { ...options, ...panelConfigs[0], panelCount, part } },
      });
    }

    const dividerEntries = panelConfigs.flatMap((cfg, index) => {
      const verticalDividers = cfg.verticalDividers;
      const horizontalDividers = cfg.horizontalDividers;
      const entries: Array<{ vertical: boolean; index: number; localIndex: number; z: number; x: number; y: number; w: number; h: number }> = [];
      for (let i = 0; i < verticalDividers; i++) {
        entries.push({
          vertical: true,
          index,
          localIndex: i,
          z: frontFaceZ + 4,
          x: cell.minX + (i + 1) * panelWidth / (verticalDividers + 1) + index * (panelWidth + 6),
          y: (cell.minY + cell.maxY) / 2,
          w: 8,
          h: panelHeight,
        });
      }
      for (let i = 0; i < horizontalDividers; i++) {
        entries.push({
          vertical: false,
          index,
          localIndex: i,
          z: frontFaceZ + 2,
          x: cell.minX + panelWidth / 2 + index * (panelWidth + 6),
          y: cell.minY + (i + 1) * panelHeight / (horizontalDividers + 1),
          w: panelWidth,
          h: 8,
        });
      }
      return entries;
    });

    for (const divider of dividerEntries) {
      objects.push({
        id: this.generateNextElementId(`${cell.cabinetId}_sliding_mullion`), parentId: cell.cabinetId,
        name: divider.vertical ? 'Ray Kapak Dikey Çıta' : 'Ray Kapak Yatay Çıta', type: 'accessory', role: 'other',
        position: { x: divider.x, y: divider.y, z: divider.z },
        rotation: { x: 0, y: 0, z: 0 },
        dimensions: divider.vertical ? { width: divider.w, height: divider.h, depth: 6, thickness: 6 } : { width: divider.w, height: divider.h, depth: 6, thickness: 6 },
        material: railMaterial, locked: false, visible: true,
        metadata: { cellId: cell.id, sliding: { ...options, ...panelConfigs[divider.index], panelCount, panelIndex: divider.index, part: 'channel' } },
      });
    }
    return objects;
  }

  /**
   * Creates plinth (baza) or legs under a cabinet
   */
  public static createPlinth(cabinet: SceneObject, height = 100): SceneObject {
    const id = this.generateNextElementId(`${cabinet.id}_plinth`);
    const mat = cabinet.material ?? DEFAULT_MATERIALS[0];

    return {
      id,
      parentId: cabinet.id,
      name: 'Dolap Bazası',
      type: 'plinth',
      role: 'plinth',
      position: {
        x: cabinet.position.x,
        y: cabinet.position.y - height / 2,
        z: cabinet.position.z - 20, // inset 20mm
      },
      rotation: { x: 0, y: 0, z: 0 },
      dimensions: {
        width: cabinet.dimensions.width,
        height: height,
        depth: cabinet.dimensions.depth - 40,
        thickness: 18,
      },
      material: mat,
      edgeBanding: { top: true, bottom: false, left: true, right: true, thicknessMm: 0.8 },
      locked: false,
      visible: true,
      metadata: { plinthHeight: height },
    };
  }

  /**
   * Creates 4 legs under a cabinet
   */
  public static createLegs(cabinet: SceneObject, legHeight = 100): SceneObject[] {
    const legs: SceneObject[] = [];
    const mat = DEFAULT_MATERIALS[10]; // Metal/Black
    const w = cabinet.dimensions.width;
    const d = cabinet.dimensions.depth;

    const cornerOffsets = [
      { x: -w / 2 + 50, z: -d / 2 + 50, name: 'Sol Ön Ayak' },
      { x: w / 2 - 50, z: -d / 2 + 50, name: 'Sağ Ön Ayak' },
      { x: -w / 2 + 50, z: d / 2 - 50, name: 'Sol Arka Ayak' },
      { x: w / 2 - 50, z: d / 2 - 50, name: 'Sağ Arka Ayak' },
    ];

    cornerOffsets.forEach((corner) => {
      const id = this.generateNextElementId(`${cabinet.id}_leg`);
      legs.push({
        id,
        parentId: cabinet.id,
        name: corner.name,
        type: 'leg',
        role: 'leg',
        position: {
          x: cabinet.position.x + corner.x,
          y: cabinet.position.y - legHeight / 2,
          z: cabinet.position.z + corner.z,
        },
        rotation: { x: 0, y: 0, z: 0 },
        dimensions: {
          width: 40,
          height: legHeight,
          depth: 40,
          thickness: 40,
        },
        material: mat,
        locked: false,
        visible: true,
      });
    });

    return legs;
  }

  /**
   * Creates Architectural Elements (Wall, Column, Beam, Window, Room Door)
   */
  public static createArchitecturalElement(
    type: 'wall' | 'column' | 'beam' | 'window' | 'room_door',
    options?: {
      position?: Vector3D;
      dimensions?: { width: number; height: number; depth: number };
      startPoint?: Vector3D;
      endPoint?: Vector3D;
    }
  ): SceneObject {
    const id = this.generateNextElementId(`arch_${type}`);
    const pos = options?.position ?? { x: 0, y: 0, z: -1000 };
    
    let dims = options?.dimensions ?? { width: 2400, height: 2600, depth: 150 };
    let name = 'Duvar';
    let mat = DEFAULT_MATERIALS[0];

    if (type === 'column') {
      name = 'Kolon';
      dims = options?.dimensions ?? { width: 400, height: 2600, depth: 400 };
    } else if (type === 'beam') {
      name = 'Kiriş';
      dims = options?.dimensions ?? { width: 2400, height: 400, depth: 300 };
    } else if (type === 'window') {
      name = 'Pencere';
      dims = options?.dimensions ?? { width: 1200, height: 1400, depth: 100 };
      mat = DEFAULT_MATERIALS[9]; // Glass
    } else if (type === 'room_door') {
      name = 'Oda Kapısı';
      dims = options?.dimensions ?? { width: 900, height: 2100, depth: 100 };
      mat = DEFAULT_MATERIALS[2]; // Walnut
    }

    return {
      id,
      name,
      type,
      role: 'wall',
      position: { ...pos, y: pos.y + dims.height / 2 },
      rotation: { x: 0, y: 0, z: 0 },
      dimensions: { ...dims, thickness: dims.depth },
      material: mat,
      locked: false,
      visible: true,
      metadata: {
        isArchitectural: true,
        wallPoints: options?.startPoint && options?.endPoint ? { start: options.startPoint, end: options.endPoint } : undefined
      }
    };
  }
}
