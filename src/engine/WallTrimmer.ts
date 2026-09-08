import { SceneObject, Vector3D, MaterialConfig } from '../types/cad';
import { CabinetFactory } from './CabinetFactory';

export interface Point2D {
  x: number;
  z: number;
}

interface WallSegment {
  id: string;
  sourceObject: SceneObject;
  start: Point2D;
  end: Point2D;
  height: number;
  thickness: number;
  material: MaterialConfig;
}

export class WallTrimmer {
  /**
   * Trims and cleans up intersections among all walls in the scene
   */
  public static trimAllWalls(objects: SceneObject[]): {
    updatedObjects: SceneObject[];
    trimmedCount: number;
  } {
    const wallObjects = objects.filter((o) => o.type === 'wall' && o.visible !== false);
    if (wallObjects.length < 2) {
      return { updatedObjects: objects, trimmedCount: 0 };
    }

    // Convert SceneObjects to WallSegments
    let segments: WallSegment[] = wallObjects.map((w) => this.objectToSegment(w));
    let trimmedCount = 0;

    // 1. First pass: Merge collinear overlapping walls
    const mergeResult = this.mergeCollinearSegments(segments);
    if (mergeResult.mergedCount > 0) {
      segments = mergeResult.segments;
      trimmedCount += mergeResult.mergedCount;
    }

    // 2. Second pass: Iteratively resolve X-junctions, T-junctions, and L-corners
    let changed = true;
    let iterations = 0;
    const MAX_ITERATIONS = 20;

    while (changed && iterations < MAX_ITERATIONS) {
      changed = false;
      iterations++;

      for (let i = 0; i < segments.length; i++) {
        for (let j = 0; j < segments.length; j++) {
          if (i === j) continue;

          const segA = segments[i];
          const segB = segments[j];
          if (!segA || !segB) continue;

          const trimRes = this.trimPair(segA, segB);
          if (trimRes.didTrim) {
            trimmedCount++;
            changed = true;

            // Replace segB with new segment(s)
            if (trimRes.newSegB.length === 0) {
              segments.splice(j, 1);
            } else if (trimRes.newSegB.length === 1) {
              segments[j] = trimRes.newSegB[0];
            } else {
              segments.splice(j, 1, ...trimRes.newSegB);
            }

            if (trimRes.newSegA) {
              segments[i] = trimRes.newSegA;
            }
            break;
          }
        }
        if (changed) break;
      }
    }

    // Convert trimmed segments back to SceneObjects
    const nonWallObjects = objects.filter((o) => o.type !== 'wall');
    const newWallObjects = segments
      .filter((s) => this.dist(s.start, s.end) >= 40)
      .map((s) => this.segmentToObject(s));

    return {
      updatedObjects: [...nonWallObjects, ...newWallObjects],
      trimmedCount,
    };
  }

  /**
   * Trims a pair of walls (segA is prioritized as main, segB is trimmed against segA)
   */
  private static trimPair(
    segA: WallSegment,
    segB: WallSegment
  ): {
    didTrim: boolean;
    newSegA?: WallSegment;
    newSegB: WallSegment[];
  } {
    const A1 = segA.start;
    const A2 = segA.end;
    const B1 = segB.start;
    const B2 = segB.end;

    const lenA = this.dist(A1, A2);
    const lenB = this.dist(B1, B2);
    if (lenA < 40 || lenB < 40) {
      return { didTrim: false, newSegB: [segB] };
    }

    const dirA = { x: (A2.x - A1.x) / lenA, z: (A2.z - A1.z) / lenA };
    const dirB = { x: (B2.x - B1.x) / lenB, z: (B2.z - B1.z) / lenB };

    // Parallel check
    const cross = dirA.x * dirB.z - dirA.z * dirB.x;
    if (Math.abs(cross) < 0.05) {
      return { didTrim: false, newSegB: [segB] };
    }

    // Calculate line intersection parameter t (for line A) and s (for line B)
    const dx = B1.x - A1.x;
    const dz = B1.z - A1.z;

    const t = (dx * dirB.z - dz * dirB.x) / (cross * lenA);
    const s = (dx * dirA.z - dz * dirA.x) / (cross * lenB);

    const halfThickA = segA.thickness / 2;
    const halfThickB = segB.thickness / 2;

    const intersection: Point2D = {
      x: A1.x + t * (A2.x - A1.x),
      z: A1.z + t * (A2.z - A1.z),
    };

    // 1. X-Junction: Cross intersection (both t and s strictly inside [0.08, 0.92])
    if (t >= 0.05 && t <= 0.95 && s >= 0.05 && s <= 0.95) {
      const cutOffset = halfThickA / Math.max(0.2, Math.abs(cross));

      const cutEnd1: Point2D = {
        x: intersection.x - dirB.x * cutOffset,
        z: intersection.z - dirB.z * cutOffset,
      };
      const cutStart2: Point2D = {
        x: intersection.x + dirB.x * cutOffset,
        z: intersection.z + dirB.z * cutOffset,
      };

      const result: WallSegment[] = [];
      if (this.dist(B1, cutEnd1) >= 50) {
        result.push({
          ...segB,
          id: segB.id,
          start: B1,
          end: cutEnd1,
        });
      }
      if (this.dist(cutStart2, B2) >= 50) {
        result.push({
          ...segB,
          id: CabinetFactory.generateNextElementId('arch_wall'),
          start: cutStart2,
          end: B2,
        });
      }

      return {
        didTrim: true,
        newSegB: result,
      };
    }

    // 2. T-Junction: B terminates into body of A
    // t is strictly within A's span [0.02, 0.98]
    if (t >= 0.02 && t <= 0.98) {
      const cutOffset = halfThickA / Math.max(0.2, Math.abs(cross));

      // B1 is penetrating or near A (s close to 0)
      if (s >= -0.2 && s <= 0.45) {
        const newB1: Point2D = {
          x: intersection.x + dirB.x * cutOffset,
          z: intersection.z + dirB.z * cutOffset,
        };

        // Only trim if there was a meaningful change
        if (this.dist(B1, newB1) > 5 && this.dist(newB1, B2) >= 40) {
          return {
            didTrim: true,
            newSegB: [{ ...segB, start: newB1 }],
          };
        }
      }

      // B2 is penetrating or near A (s close to 1)
      if (s >= 0.55 && s <= 1.2) {
        const newB2: Point2D = {
          x: intersection.x - dirB.x * cutOffset,
          z: intersection.z - dirB.z * cutOffset,
        };

        if (this.dist(B2, newB2) > 5 && this.dist(B1, newB2) >= 40) {
          return {
            didTrim: true,
            newSegB: [{ ...segB, end: newB2 }],
          };
        }
      }
    }

    // 3. L-Corner: Endpoints near each other (Corner junction)
    const endNearStart = this.dist(A2, B1) <= halfThickA + halfThickB + 80;
    const startNearStart = this.dist(A1, B1) <= halfThickA + halfThickB + 80;
    const endNearEnd = this.dist(A2, B2) <= halfThickA + halfThickB + 80;
    const startNearEnd = this.dist(A1, B2) <= halfThickA + halfThickB + 80;

    if (endNearStart || startNearStart || endNearEnd || startNearEnd) {
      if (t >= -0.3 && t <= 1.3 && s >= -0.3 && s <= 1.3) {
        let newA = { ...segA };
        let newB = { ...segB };
        let modified = false;

        if (endNearStart) {
          newA.end = intersection;
          newB.start = intersection;
          modified = true;
        } else if (startNearStart) {
          newA.start = intersection;
          newB.start = intersection;
          modified = true;
        } else if (endNearEnd) {
          newA.end = intersection;
          newB.end = intersection;
          modified = true;
        } else if (startNearEnd) {
          newA.start = intersection;
          newB.end = intersection;
          modified = true;
        }

        if (modified && (this.dist(segA.start, newA.end) > 5 || this.dist(segB.start, newB.start) > 5)) {
          return {
            didTrim: true,
            newSegA: newA,
            newSegB: [newB],
          };
        }
      }
    }

    return { didTrim: false, newSegB: [segB] };
  }

  /**
   * Merges collinear overlapping segments into single continuous segments
   */
  private static mergeCollinearSegments(segments: WallSegment[]): {
    segments: WallSegment[];
    mergedCount: number;
  } {
    let mergedCount = 0;
    const result = [...segments];

    for (let i = 0; i < result.length; i++) {
      for (let j = i + 1; j < result.length; j++) {
        const a = result[i];
        const b = result[j];
        if (!a || !b) continue;

        const lenA = this.dist(a.start, a.end);
        const lenB = this.dist(b.start, b.end);
        if (lenA < 30 || lenB < 30) continue;

        const dirA = { x: (a.end.x - a.start.x) / lenA, z: (a.end.z - a.start.z) / lenA };
        const dirB = { x: (b.end.x - b.start.x) / lenB, z: (b.end.z - b.start.z) / lenB };

        // Parallel test
        const dot = Math.abs(dirA.x * dirB.x + dirA.z * dirB.z);
        if (dot < 0.98) continue;

        // Distance from B's start/end to Line A
        const distB1 = this.pointToLineDist(b.start, a.start, dirA);
        const distB2 = this.pointToLineDist(b.end, a.start, dirA);
        if (distB1 > 25 || distB2 > 25) continue;

        // Project all 4 points onto line A
        const pA1 = 0;
        const pA2 = lenA;
        const pB1 = (b.start.x - a.start.x) * dirA.x + (b.start.z - a.start.z) * dirA.z;
        const pB2 = (b.end.x - a.start.x) * dirA.x + (b.end.z - a.start.z) * dirA.z;

        const minB = Math.min(pB1, pB2);
        const maxB = Math.max(pB1, pB2);

        // Check if overlapping or touching
        if (minB <= pA2 + 40 && maxB >= pA1 - 40) {
          const globalMin = Math.min(pA1, minB);
          const globalMax = Math.max(pA2, maxB);

          const mergedStart: Point2D = {
            x: a.start.x + dirA.x * globalMin,
            z: a.start.z + dirA.z * globalMin,
          };
          const mergedEnd: Point2D = {
            x: a.start.x + dirA.x * globalMax,
            z: a.start.z + dirA.z * globalMax,
          };

          result[i] = {
            ...a,
            start: mergedStart,
            end: mergedEnd,
          };
          result.splice(j, 1);
          j--;
          mergedCount++;
        }
      }
    }

    return { segments: result, mergedCount };
  }

  private static pointToLineDist(p: Point2D, linePt: Point2D, lineDir: Point2D): number {
    const vx = p.x - linePt.x;
    const vz = p.z - linePt.z;
    const proj = vx * lineDir.x + vz * lineDir.z;
    const perpX = vx - proj * lineDir.x;
    const perpZ = vz - proj * lineDir.z;
    return Math.hypot(perpX, perpZ);
  }

  private static dist(p1: Point2D, p2: Point2D): number {
    return Math.hypot(p2.x - p1.x, p2.z - p1.z);
  }

  private static objectToSegment(obj: SceneObject): WallSegment {
    if (obj.metadata?.wallPoints?.start && obj.metadata?.wallPoints?.end) {
      return {
        id: obj.id,
        sourceObject: obj,
        start: { x: obj.metadata.wallPoints.start.x, z: obj.metadata.wallPoints.start.z },
        end: { x: obj.metadata.wallPoints.end.x, z: obj.metadata.wallPoints.end.z },
        height: obj.dimensions.height || 2600,
        thickness: obj.dimensions.depth || 150,
        material: obj.material,
      };
    }

    // Derive from position and rotation
    const angleRad = -((obj.rotation.y || 0) * Math.PI) / 180;
    const halfLen = (obj.dimensions.width || 1000) / 2;
    const dx = halfLen * Math.cos(angleRad);
    const dz = halfLen * Math.sin(angleRad);

    return {
      id: obj.id,
      sourceObject: obj,
      start: { x: obj.position.x - dx, z: obj.position.z - dz },
      end: { x: obj.position.x + dx, z: obj.position.z + dz },
      height: obj.dimensions.height || 2600,
      thickness: obj.dimensions.depth || 150,
      material: obj.material,
    };
  }

  private static segmentToObject(seg: WallSegment): SceneObject {
    const dx = seg.end.x - seg.start.x;
    const dz = seg.end.z - seg.start.z;
    const length = Math.max(50, Math.round(Math.hypot(dx, dz)));
    const angleRad = Math.atan2(dz, dx);
    const angleDeg = -Math.round((angleRad * 180) / Math.PI);

    const midX = Math.round((seg.start.x + seg.end.x) / 2);
    const midZ = Math.round((seg.start.z + seg.end.z) / 2);
    const midY = Math.round(seg.height / 2);

    const start3D: Vector3D = { x: Math.round(seg.start.x), y: 0, z: Math.round(seg.start.z) };
    const end3D: Vector3D = { x: Math.round(seg.end.x), y: 0, z: Math.round(seg.end.z) };

    return {
      ...seg.sourceObject,
      id: seg.id,
      name: `Duvar (${length}x${seg.height}mm)`,
      type: 'wall',
      role: 'wall',
      position: { x: midX, y: midY, z: midZ },
      rotation: { x: 0, y: angleDeg, z: 0 },
      dimensions: {
        width: length,
        height: seg.height,
        depth: seg.thickness,
        thickness: seg.thickness,
      },
      metadata: {
        ...seg.sourceObject.metadata,
        isArchitectural: true,
        wallPoints: { start: start3D, end: end3D },
      },
    };
  }
}
