import { SceneObject, Vector3D } from '../types/cad';

export interface BoundingBox3D {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
  minZ: number;
  maxZ: number;
}

export interface SnapResult {
  position: Vector3D;
  snapped: boolean;
  snapTargetName?: string;
  snapType?: 'floor' | 'wall' | 'cabinet_side' | 'shelf_edge' | 'grid';
}

export class CollisionDetector {
  public static SNAP_THRESHOLD = 50; // mm

  /**
   * Computes the 3D Axis-Aligned Bounding Box (AABB) for an object
   */
  public static getAABB(obj: SceneObject, customPos?: Vector3D): BoundingBox3D {
    const pos = customPos ?? obj.position;
    const dims = obj.dimensions;

    const hw = dims.width / 2;
    const hh = dims.height / 2;
    const hd = dims.depth / 2;

    return {
      minX: pos.x - hw,
      maxX: pos.x + hw,
      minY: pos.y - hh,
      maxY: pos.y + hh,
      minZ: pos.z - hd,
      maxZ: pos.z + hd,
    };
  }

  /**
   * Checks if two bounding boxes intersect with tolerance
   */
  public static checkIntersection(
    boxA: BoundingBox3D,
    boxB: BoundingBox3D,
    tolerance = 1
  ): boolean {
    return (
      boxA.minX + tolerance < boxB.maxX &&
      boxA.maxX - tolerance > boxB.minX &&
      boxA.minY + tolerance < boxB.maxY &&
      boxA.maxY - tolerance > boxB.minY &&
      boxA.minZ + tolerance < boxB.maxZ &&
      boxA.maxZ - tolerance > boxB.minZ
    );
  }

  /**
   * Checks if moving an object to targetPos collides with any other obstacles
   */
  public static checkCollision(
    movingObject: SceneObject,
    targetPos: Vector3D,
    allObjects: SceneObject[],
    ignoreIds: Set<string> = new Set()
  ): { hasCollision: boolean; collidingWith?: SceneObject } {
    const movingBox = this.getAABB(movingObject, targetPos);

    // Floor collision check: Base cannot sink below ground (Y = 0)
    if (movingBox.minY < -1) {
      return { hasCollision: true };
    }

    for (const other of allObjects) {
      if (other.id === movingObject.id || ignoreIds.has(other.id)) continue;
      // Skip if object belongs to the same parent cabinet when moving a whole cabinet
      if (movingObject.type === 'cabinet' && other.parentId === movingObject.id) continue;
      // Skip child parts if moving parent
      if (other.parentId === movingObject.parentId && movingObject.type === other.type) {
        // Different shelves or dividers can collide
      }

      const otherBox = this.getAABB(other);
      if (this.checkIntersection(movingBox, otherBox)) {
        return { hasCollision: true, collidingWith: other };
      }
    }

    return { hasCollision: false };
  }

  /**
   * Smart Magnetic Snap system that automatically snaps objects to floor, walls, and neighbor cabinets
   * without penetrating them!
   */
  public static calculateSnap(
    movingObject: SceneObject,
    desiredPos: Vector3D,
    allObjects: SceneObject[]
  ): SnapResult {
    const hw = movingObject.dimensions.width / 2;
    const hh = movingObject.dimensions.height / 2;
    const hd = movingObject.dimensions.depth / 2;

    let resX = desiredPos.x;
    let resY = desiredPos.y;
    let resZ = desiredPos.z;

    let snapped = false;
    let snapType: SnapResult['snapType'];
    let snapTargetName: string | undefined;

    // 1. Floor Snap: if bottom is close to Y = 0 (or bottom aligned on plinth)
    const currentBottomY = desiredPos.y - hh;
    if (Math.abs(currentBottomY) < this.SNAP_THRESHOLD) {
      resY = hh;
      snapped = true;
      snapType = 'floor';
      snapTargetName = 'Zemin (Y=0)';
    }

    // 2. Neighbor Objects Snap (Cabinets, Walls, Panels)
    for (const other of allObjects) {
      if (other.id === movingObject.id || other.parentId === movingObject.id) continue;
      if (movingObject.parentId && other.parentId === movingObject.parentId && movingObject.type !== 'shelf' && movingObject.type !== 'divider') {
        continue;
      }

      const otherBox = this.getAABB(other);

      // A. Snap to Right side of other object
      if (Math.abs((desiredPos.x - hw) - otherBox.maxX) < this.SNAP_THRESHOLD) {
        // Check Y and Z proximity
        if (
          desiredPos.y + hh > otherBox.minY - 100 &&
          desiredPos.y - hh < otherBox.maxY + 100 &&
          desiredPos.z + hd > otherBox.minZ - 100 &&
          desiredPos.z - hd < otherBox.maxZ + 100
        ) {
          resX = otherBox.maxX + hw;
          snapped = true;
          snapType = 'cabinet_side';
          snapTargetName = `${other.name} (Sağ Yüzey)`;
        }
      }

      // B. Snap to Left side of other object
      if (Math.abs((desiredPos.x + hw) - otherBox.minX) < this.SNAP_THRESHOLD) {
        if (
          desiredPos.y + hh > otherBox.minY - 100 &&
          desiredPos.y - hh < otherBox.maxY + 100 &&
          desiredPos.z + hd > otherBox.minZ - 100 &&
          desiredPos.z - hd < otherBox.maxZ + 100
        ) {
          resX = otherBox.minX - hw;
          snapped = true;
          snapType = 'cabinet_side';
          snapTargetName = `${other.name} (Sol Yüzey)`;
        }
      }

      // C. Snap Flush Back to Wall or other object front/back
      if (other.type === 'wall' || other.role === 'wall') {
        const wallFront = otherBox.maxZ;
        if (Math.abs((desiredPos.z - hd) - wallFront) < this.SNAP_THRESHOLD) {
          resZ = wallFront + hd;
          snapped = true;
          snapType = 'wall';
          snapTargetName = `${other.name} (Duvar Yaslama)`;
        }
      }

      // D. Snap Flush Top or Bottom
      if (Math.abs((desiredPos.y - hh) - otherBox.maxY) < this.SNAP_THRESHOLD) {
        resY = otherBox.maxY + hh;
        snapped = true;
        snapType = 'cabinet_side';
        snapTargetName = `${other.name} (Üzerine Oturma)`;
      }
    }

    // Ensure floor bound
    if (resY - hh < 0) {
      resY = hh;
    }

    return {
      position: { x: Math.round(resX), y: Math.round(resY), z: Math.round(resZ) },
      snapped,
      snapType,
      snapTargetName,
    };
  }
}
