import { SceneObject, CabinetCell } from '../types/cad';

interface RawCell {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
}

export class CellDetector {
  /**
   * Calculates all enclosed 3D cells for all cabinets or a specific cabinet
   */
  public static calculateCabinetCells(
    cabinet: SceneObject,
    allObjects: SceneObject[]
  ): CabinetCell[] {
    const cabinetParts = allObjects.filter((obj) => obj.parentId === cabinet.id);

    // Find main boundary panels
    const leftPanel = cabinetParts.find((o) => o.role === 'left' || o.id.endsWith('_left'));
    const rightPanel = cabinetParts.find((o) => o.role === 'right' || o.id.endsWith('_right'));
    const bottomPanel = cabinetParts.find((o) => o.role === 'bottom' || o.id.endsWith('_bottom'));
    const topPanel = cabinetParts.find((o) => o.role === 'top' || o.id.endsWith('_top'));
    const backPanel = cabinetParts.find((o) => o.role === 'back' || o.id.endsWith('_back'));

    const thickness = cabinet.dimensions.thickness || 18;
    const backThick = backPanel?.dimensions.depth || 8;

    // Fallback internal bounds if explicit panels not found
    const cabPos = cabinet.position;
    const cabDims = cabinet.dimensions;

    const minX = leftPanel
      ? leftPanel.position.x + leftPanel.dimensions.width / 2
      : cabPos.x - cabDims.width / 2 + thickness;

    const maxX = rightPanel
      ? rightPanel.position.x - rightPanel.dimensions.width / 2
      : cabPos.x + cabDims.width / 2 - thickness;

    const minY = bottomPanel
      ? bottomPanel.position.y + bottomPanel.dimensions.height / 2
      : cabPos.y + thickness;

    const maxY = topPanel
      ? topPanel.position.y - topPanel.dimensions.height / 2
      : cabPos.y + cabDims.height - thickness;

    const minZ = cabPos.z - cabDims.depth / 2;
    const maxZ = cabPos.z + cabDims.depth / 2 - backThick;

    // If cabinet internal volume is too small or invalid, return fallback
    if (maxX <= minX + 30 || maxY <= minY + 30) {
      return [
        {
          id: `cell_${cabinet.id}_1`,
          cabinetId: cabinet.id,
          minX: Math.round(minX),
          maxX: Math.round(maxX),
          minY: Math.round(minY),
          maxY: Math.round(maxY),
          minZ: Math.round(minZ),
          maxZ: Math.round(maxZ),
          width: Math.max(10, Math.round(maxX - minX)),
          height: Math.max(10, Math.round(maxY - minY)),
          depth: Math.max(10, Math.round(maxZ - minZ)),
        },
      ];
    }

    // Find all vertical dividers and horizontal shelves in this cabinet
    const dividers = cabinetParts.filter(
      (o) => (o.type === 'divider' || o.role === 'divider') && o.visible
    );
    const shelves = cabinetParts.filter(
      (o) => (o.type === 'shelf' || o.role === 'shelf') && o.visible
    );

    // Start with the full internal cavity
    let cells: RawCell[] = [
      {
        minX,
        maxX,
        minY,
        maxY,
      },
    ];

    // Iteratively partition cells with shelves and dividers that span across them.
    // This ensures a divider only splits the cell it physically resides in vertically,
    // and does NOT bleed through or split cells above/below it.
    let changed = true;
    let iteration = 0;
    const MAX_ITERATIONS = 200;

    while (changed && iteration < MAX_ITERATIONS) {
      changed = false;
      iteration++;

      for (let i = 0; i < cells.length; i++) {
        const cell = cells[i];

        // 1. Check if any shelf spans across this cell horizontally
        let splitShelf: SceneObject | null = null;
        for (const sh of shelves) {
          const shY = sh.position.y;
          const shH = sh.dimensions.height || thickness;
          const shBottom = shY - shH / 2;
          const shTop = shY + shH / 2;
          const shLeft = sh.position.x - sh.dimensions.width / 2;
          const shRight = sh.position.x + sh.dimensions.width / 2;

          // Must be strictly inside the cell's vertical span
          if (shBottom <= cell.minY + 15 || shTop >= cell.maxY - 15) continue;

          // Must cover the cell's horizontal span (allowing for 25mm mounting tolerance)
          if (shLeft <= cell.minX + 25 && shRight >= cell.maxX - 25) {
            splitShelf = sh;
            break;
          }
        }

        if (splitShelf) {
          const shY = splitShelf.position.y;
          const shH = splitShelf.dimensions.height || thickness;
          const shBottom = shY - shH / 2;
          const shTop = shY + shH / 2;

          const bottomCell: RawCell = {
            minX: cell.minX,
            maxX: cell.maxX,
            minY: cell.minY,
            maxY: shBottom,
          };
          const topCell: RawCell = {
            minX: cell.minX,
            maxX: cell.maxX,
            minY: shTop,
            maxY: cell.maxY,
          };

          if (bottomCell.maxY - bottomCell.minY >= 30 && topCell.maxY - topCell.minY >= 30) {
            cells.splice(i, 1, bottomCell, topCell);
            changed = true;
            break;
          }
        }

        // 2. Check if any divider spans across this cell vertically
        let splitDivider: SceneObject | null = null;
        for (const div of dividers) {
          const divX = div.position.x;
          const divW = div.dimensions.width || thickness;
          const divLeft = divX - divW / 2;
          const divRight = divX + divW / 2;
          const divBottom = div.position.y - div.dimensions.height / 2;
          const divTop = div.position.y + div.dimensions.height / 2;

          // Must be strictly inside the cell's horizontal span
          if (divLeft <= cell.minX + 15 || divRight >= cell.maxX - 15) continue;

          // Must cover the cell's vertical span (allowing for 25mm mounting tolerance)
          if (divBottom <= cell.minY + 25 && divTop >= cell.maxY - 25) {
            splitDivider = div;
            break;
          }
        }

        if (splitDivider) {
          const divX = splitDivider.position.x;
          const divW = splitDivider.dimensions.width || thickness;
          const divLeft = divX - divW / 2;
          const divRight = divX + divW / 2;

          const leftCell: RawCell = {
            minX: cell.minX,
            maxX: divLeft,
            minY: cell.minY,
            maxY: cell.maxY,
          };
          const rightCell: RawCell = {
            minX: divRight,
            maxX: cell.maxX,
            minY: cell.minY,
            maxY: cell.maxY,
          };

          if (leftCell.maxX - leftCell.minX >= 30 && rightCell.maxX - rightCell.minX >= 30) {
            cells.splice(i, 1, leftCell, rightCell);
            changed = true;
            break;
          }
        }
      }
    }

    // Filter valid cells and sort logically: top-to-bottom (higher Y first), then left-to-right (lower X first)
    return cells
      .filter((c) => c.maxX - c.minX >= 30 && c.maxY - c.minY >= 30)
      .sort((a, b) => {
        if (Math.abs(b.minY - a.minY) > 20) {
          return b.minY - a.minY;
        }
        return a.minX - b.minX;
      })
      .map((c, idx) => ({
        id: `cell_${cabinet.id}_${idx + 1}`,
        cabinetId: cabinet.id,
        minX: Math.round(c.minX),
        maxX: Math.round(c.maxX),
        minY: Math.round(c.minY),
        maxY: Math.round(c.maxY),
        minZ: Math.round(minZ),
        maxZ: Math.round(maxZ),
        width: Math.round(c.maxX - c.minX),
        height: Math.round(c.maxY - c.minY),
        depth: Math.round(maxZ - minZ),
      }));
  }

  /**
   * Finds the cell enclosing or closest to a world coordinate point
   */
  public static findCellAtPoint(
    point: { x: number; y: number; z: number },
    allCells: CabinetCell[],
    tolerance = 100
  ): CabinetCell | null {
    if (!allCells || allCells.length === 0) return null;

    // 1. Strict interior containment
    for (const cell of allCells) {
      if (
        point.x >= cell.minX &&
        point.x <= cell.maxX &&
        point.y >= cell.minY &&
        point.y <= cell.maxY &&
        point.z >= cell.minZ - 50 &&
        point.z <= cell.maxZ + 50
      ) {
        return cell;
      }
    }

    // 2. Tolerance containment
    for (const cell of allCells) {
      if (
        point.x >= cell.minX - 10 &&
        point.x <= cell.maxX + 10 &&
        point.y >= cell.minY - 10 &&
        point.y <= cell.maxY + 10 &&
        point.z >= cell.minZ - 100 &&
        point.z <= cell.maxZ + 100
      ) {
        return cell;
      }
    }

    return null;
  }

  /**
   * Checks whether a given CabinetCell already has a door covering it
   */
  public static isCellCoveredByDoor(
    cell: CabinetCell,
    allObjects: SceneObject[]
  ): boolean {
    if (!cell || !allObjects || allObjects.length === 0) return false;

    const doors = allObjects.filter(
      (o) => (o.type === 'door' || o.role === 'door_leaf') && o.visible !== false
    );

    if (doors.length === 0) return false;

    for (const door of doors) {
      // 1. Direct metadata match
      if (door.metadata?.cellId === cell.id) {
        return true;
      }
      if (
        Array.isArray(door.metadata?.cellIds) &&
        door.metadata.cellIds.includes(cell.id)
      ) {
        return true;
      }

      // 2. Spatial 2D overlap check on cabinet front face
      const sameCabinet = !door.parentId || door.parentId === cell.cabinetId;
      if (sameCabinet) {
        const doorWidth = door.dimensions.width;
        const doorHeight = door.dimensions.height;
        const doorMinX = door.position.x - doorWidth / 2;
        const doorMaxX = door.position.x + doorWidth / 2;
        const doorMinY = door.position.y - doorHeight / 2;
        const doorMaxY = door.position.y + doorHeight / 2;

        const overlapX = Math.max(
          0,
          Math.min(doorMaxX, cell.maxX) - Math.max(doorMinX, cell.minX)
        );
        const overlapY = Math.max(
          0,
          Math.min(doorMaxY, cell.maxY) - Math.max(doorMinY, cell.minY)
        );
        const overlapArea = overlapX * overlapY;
        const cellArea = Math.max(1, cell.width * cell.height);

        // If door covers at least 30% of this cell's 2D area or covers the cell center
        const cellCenterX = (cell.minX + cell.maxX) / 2;
        const cellCenterY = (cell.minY + cell.maxY) / 2;

        const coversCenter =
          cellCenterX >= doorMinX - 15 &&
          cellCenterX <= doorMaxX + 15 &&
          cellCenterY >= doorMinY - 15 &&
          cellCenterY <= doorMaxY + 15;

        if (overlapArea / cellArea > 0.3 || coversCenter) {
          return true;
        }
      }
    }

    return false;
  }

  public static isCellEligibleForDoor(
    cell: CabinetCell,
    allObjects: SceneObject[]
  ): boolean {
    if (!cell || !allObjects || allObjects.length === 0) return false;

    const drawers = allObjects.filter(
      (o) => o.type === 'drawer' && o.visible !== false && o.parentId === cell.cabinetId
    );
    const matchingDrawers = drawers.filter((drawer) => {
      if (drawer.metadata?.cellId === cell.id) return true;

      const drawerMinX = drawer.position.x - drawer.dimensions.width / 2;
      const drawerMaxX = drawer.position.x + drawer.dimensions.width / 2;
      const drawerMinY = drawer.position.y - drawer.dimensions.height / 2;
      const drawerMaxY = drawer.position.y + drawer.dimensions.height / 2;
      const overlapX = Math.max(0, Math.min(drawerMaxX, cell.maxX) - Math.max(drawerMinX, cell.minX));
      const overlapY = Math.max(0, Math.min(drawerMaxY, cell.maxY) - Math.max(drawerMinY, cell.minY));
      const drawerArea = Math.max(1, drawer.dimensions.width * drawer.dimensions.height);

      return overlapX * overlapY / drawerArea > 0.5;
    });

    const hasOuterDrawer = matchingDrawers.some(
      (drawer) => drawer.metadata?.drawer?.placement !== 'inner'
    );

    // Empty cells, inner-drawer cells, and accessory cells can receive doors.
    // A door must never cover an outer drawer.
    return !hasOuterDrawer;
  }

  /**
   * Returns only cells that do NOT currently have a door on them
   */
  public static getAvailableCellsForDoor(
    allCells: CabinetCell[],
    allObjects: SceneObject[]
  ): CabinetCell[] {
    return allCells.filter((c) => !this.isCellCoveredByDoor(c, allObjects));
  }
}
