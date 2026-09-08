import { SceneObject, CutPiece, NestedSheet, SheetRemnant, MaterialConfig, CostBreakdown } from '../types/cad';
import { HARDWARE_PRICES } from '../constants/materials';

interface FreeRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

type SplitRule = 'horizontal' | 'vertical' | 'shorter-axis' | 'longer-axis' | 'minimize-area';
type FitRule = 'best-area-fit' | 'best-short-side-fit' | 'best-long-side-fit';
type SortOrder = 'area-desc' | 'max-side-desc' | 'perimeter-desc' | 'height-desc' | 'width-desc' | 'aspect-desc';

interface SimulationResult {
  strategyName: string;
  sheets: {
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
    strategyUsed: string;
  }[];
  totalSheets: number;
  totalWasteM2: number;
  totalReusableRemnantsM2: number;
}

export class NestingOptimizer {
  public static SAW_KERF = 4; // 4mm saw blade thickness
  public static SHEET_TRIM = 15; // 15mm perimeter trim margin
  public static MIN_REUSABLE_REMNANT_SIZE = 150; // 150mm x 150mm minimum threshold for reusable offcut

  /**
   * Extracts all cuttable panels from scene objects
   */
  public static extractCutPieces(objects: SceneObject[]): CutPiece[] {
    const pieces: CutPiece[] = [];

    objects.forEach((obj) => {
      // Ignore invisible, architectural walls/windows/columns or root container groups
      if (!obj.visible || obj.type === 'cabinet' || obj.type === 'group' || obj.metadata?.isArchitectural) {
        return;
      }

      // Determine 2D cut dimensions (Length & Width) based on panel orientation/role
      let length = 0;
      let width = 0;
      const dims = obj.dimensions;

      if (obj.role === 'left' || obj.role === 'right' || obj.type === 'divider') {
        length = dims.height;
        width = dims.depth;
      } else if (obj.role === 'bottom' || obj.role === 'top' || obj.type === 'shelf') {
        length = dims.width;
        width = dims.depth;
      } else if (obj.role === 'back') {
        length = dims.height;
        width = dims.width;
      } else if (obj.type === 'door' || obj.type === 'drawer') {
        length = Math.max(dims.width, dims.height);
        width = Math.min(dims.width, dims.height);
      } else if (obj.type === 'plinth') {
        length = dims.width;
        width = dims.height;
      } else {
        length = Math.max(dims.width, dims.height, dims.depth);
        const sorted = [dims.width, dims.height, dims.depth].sort((a, b) => b - a);
        length = sorted[0];
        width = sorted[1];
      }

      if (length <= 0 || width <= 0) return;

      const edgeBanding = obj.edgeBanding ?? {
        top: true,
        bottom: true,
        left: true,
        right: true,
        thicknessMm: 0.8,
      };

      pieces.push({
        id: `cut_${obj.id}`,
        objectId: obj.id,
        cabinetId: obj.parentId,
        name: `${obj.name} (${obj.id})`,
        width: Math.round(width),
        height: Math.round(length),
        thickness: Math.round(dims.thickness || 18),
        material: obj.material,
        edgeBanding,
        grainDirection: obj.material.grainDirection,
      });
    });

    return pieces;
  }

  /**
   * Sort pieces according to specified sorting criterion
   */
  private static sortPieces(pieces: CutPiece[], order: SortOrder): CutPiece[] {
    const sorted = [...pieces];
    switch (order) {
      case 'area-desc':
        return sorted.sort((a, b) => b.width * b.height - a.width * a.height);
      case 'max-side-desc':
        return sorted.sort((a, b) => Math.max(b.width, b.height) - Math.max(a.width, a.height));
      case 'perimeter-desc':
        return sorted.sort((a, b) => 2 * (b.width + b.height) - 2 * (a.width + a.height));
      case 'height-desc':
        return sorted.sort((a, b) => b.height - a.height || b.width - a.width);
      case 'width-desc':
        return sorted.sort((a, b) => b.width - a.width || b.height - a.height);
      case 'aspect-desc':
        return sorted.sort((a, b) => {
          const ratioB = Math.max(b.width, b.height) / Math.max(1, Math.min(b.width, b.height));
          const ratioA = Math.max(a.width, a.height) / Math.max(1, Math.min(a.width, a.height));
          return ratioB - ratioA;
        });
      default:
        return sorted;
    }
  }

  /**
   * Evaluates split rule on a free rectangle when placing a piece
   */
  private static splitFreeRect(
    freeRect: FreeRect,
    pieceW: number,
    pieceH: number,
    splitRule: SplitRule
  ): FreeRect[] {
    const kerf = this.SAW_KERF;
    const rightW = freeRect.width - pieceW - kerf;
    const topH = freeRect.height - pieceH - kerf;

    let chosenSplit: 'horizontal' | 'vertical' = 'horizontal';

    switch (splitRule) {
      case 'horizontal':
        chosenSplit = 'horizontal';
        break;
      case 'vertical':
        chosenSplit = 'vertical';
        break;
      case 'shorter-axis':
        chosenSplit = pieceW <= pieceH ? 'horizontal' : 'vertical';
        break;
      case 'longer-axis':
        chosenSplit = pieceW > pieceH ? 'horizontal' : 'vertical';
        break;
      case 'minimize-area':
        // Choose split that minimizes smaller remnant fragmentation
        const areaH = rightW * pieceH;
        const areaV = pieceW * topH;
        chosenSplit = areaH <= areaV ? 'horizontal' : 'vertical';
        break;
    }

    const newFreeRects: FreeRect[] = [];

    if (chosenSplit === 'horizontal') {
      // Horizontal split: Bottom-Right remnant of height pieceH, Top remnant of full width
      if (rightW > 0 && pieceH > 0) {
        newFreeRects.push({
          x: freeRect.x + pieceW + kerf,
          y: freeRect.y,
          width: rightW,
          height: pieceH,
        });
      }
      if (freeRect.width > 0 && topH > 0) {
        newFreeRects.push({
          x: freeRect.x,
          y: freeRect.y + pieceH + kerf,
          width: freeRect.width,
          height: topH,
        });
      }
    } else {
      // Vertical split: Right remnant of full height, Top remnant of width pieceW
      if (rightW > 0 && freeRect.height > 0) {
        newFreeRects.push({
          x: freeRect.x + pieceW + kerf,
          y: freeRect.y,
          width: rightW,
          height: freeRect.height,
        });
      }
      if (pieceW > 0 && topH > 0) {
        newFreeRects.push({
          x: freeRect.x,
          y: freeRect.y + pieceH + kerf,
          width: pieceW,
          height: topH,
        });
      }
    }

    return newFreeRects;
  }

  /**
   * Simulates packing for a list of pieces using a specific heuristic strategy
   */
  private static simulatePackingStrategy(
    pieces: CutPiece[],
    material: MaterialConfig,
    fitRule: FitRule,
    splitRule: SplitRule,
    sortOrder: SortOrder,
    startIndex = 1
  ): SimulationResult {
    const sheetW = material.sheetWidth || 2800;
    const sheetH = material.sheetHeight || 2100;
    const kerf = this.SAW_KERF;
    const trim = this.SHEET_TRIM;

    const usableW = sheetW - 2 * trim;
    const usableH = sheetH - 2 * trim;

    const sortedPieces = this.sortPieces(pieces, sortOrder);
    const unplaced = sortedPieces.map((p) => ({ ...p }));

    interface SheetState {
      sheetIndex: number;
      freeRects: FreeRect[];
      placedPieces: CutPiece[];
      remnants: SheetRemnant[];
    }

    const sheets: SheetState[] = [];
    let currentSheetIndex = startIndex;

    // Helper to open a new sheet with standard trim boundaries
    const openNewSheet = (): SheetState => {
      const newSheet: SheetState = {
        sheetIndex: currentSheetIndex++,
        freeRects: [
          {
            x: trim,
            y: trim,
            width: usableW,
            height: usableH,
          },
        ],
        placedPieces: [],
        remnants: [],
      };
      sheets.push(newSheet);
      return newSheet;
    };

    // Open first sheet
    if (unplaced.length > 0) {
      openNewSheet();
    }

    // Pack each piece into existing sheets / remnants first before opening a new sheet
    for (const piece of unplaced) {
      let bestFit: {
        sheet: SheetState;
        freeRectIndex: number;
        w: number;
        h: number;
        rotated: boolean;
        score: number;
      } | null = null;

      const canRotate = piece.grainDirection === 'none';

      // Scan all currently open sheets to prioritize filling existing remnants/offcuts!
      for (const sheet of sheets) {
        for (let rIdx = 0; rIdx < sheet.freeRects.length; rIdx++) {
          const fr = sheet.freeRects[rIdx];

          // Orientations to test: normal (w, h) and rotated (h, w)
          const orientations = [
            { w: piece.width, h: piece.height, rotated: false },
          ];
          if (canRotate && piece.width !== piece.height) {
            orientations.push({ w: piece.height, h: piece.width, rotated: true });
          }

          for (const ori of orientations) {
            if (ori.w <= fr.width && ori.h <= fr.height) {
              let score = Infinity;

              if (fitRule === 'best-area-fit') {
                score = fr.width * fr.height - ori.w * ori.h;
              } else if (fitRule === 'best-short-side-fit') {
                score = Math.min(fr.width - ori.w, fr.height - ori.h);
              } else if (fitRule === 'best-long-side-fit') {
                score = Math.max(fr.width - ori.w, fr.height - ori.h);
              }

              // Prefer placing in older sheets / earlier remnants first to minimize sheet expansion
              const sheetPenalty = (sheet.sheetIndex - startIndex) * 10000;
              const totalScore = score + sheetPenalty;

              if (bestFit === null || totalScore < bestFit.score) {
                bestFit = {
                  sheet,
                  freeRectIndex: rIdx,
                  w: ori.w,
                  h: ori.h,
                  rotated: ori.rotated,
                  score: totalScore,
                };
              }
            }
          }
        }
      }

      // If no open sheet remnant could fit this piece, open a fresh new sheet!
      if (!bestFit) {
        const freshSheet = openNewSheet();
        const fr = freshSheet.freeRects[0];

        let w = piece.width;
        let h = piece.height;
        let rotated = false;

        if (canRotate && (w > fr.width || h > fr.height) && (h <= fr.width && w <= fr.height)) {
          w = piece.height;
          h = piece.width;
          rotated = true;
        }

        bestFit = {
          sheet: freshSheet,
          freeRectIndex: 0,
          w,
          h,
          rotated,
          score: 0,
        };
      }

      // Place the piece into the chosen free rectangle
      const { sheet, freeRectIndex, w, h, rotated } = bestFit;
      const targetRect = sheet.freeRects[freeRectIndex];

      piece.x = targetRect.x;
      piece.y = targetRect.y;
      piece.width = w;
      piece.height = h;
      piece.rotated = rotated;
      piece.sheetIndex = sheet.sheetIndex;

      sheet.placedPieces.push({ ...piece });

      // Remove the used free rect and split into remaining free rectangles
      sheet.freeRects.splice(freeRectIndex, 1);
      const splitRects = this.splitFreeRect(targetRect, w, h, splitRule);

      // Add valid split remnants back to sheet's free rects pool
      for (const sr of splitRects) {
        if (sr.width > 0 && sr.height > 0) {
          sheet.freeRects.push(sr);
        }
      }
    }

    // Post-process sheets: extract reusable remnants and calculate metrics
    const finalSheets = sheets.map((sh) => {
      const totalAreaM2 = (sheetW * sheetH) / 1000000;
      const usedAreaM2 = sh.placedPieces.reduce(
        (sum, p) => sum + (p.width * p.height) / 1000000,
        0
      );
      const wastePercentage = Math.max(
        0,
        Math.round(((totalAreaM2 - usedAreaM2) / totalAreaM2) * 1000) / 10
      );
      const efficiencyPercentage = Math.max(0, Math.min(100, Math.round((100 - wastePercentage) * 10) / 10));
      const cutLengthMeters = sh.placedPieces.reduce(
        (sum, p) => sum + (2 * (p.width + p.height)) / 1000,
        0
      );

      // Identify usable remnant rectangles (Kalan / Artık Parçalar)
      const remnants: SheetRemnant[] = sh.freeRects
        .filter((fr) => fr.width >= 50 && fr.height >= 50)
        .map((fr, idx) => {
          const areaM2 = (fr.width * fr.height) / 1000000;
          return {
            id: `remnant_${sh.sheetIndex}_${idx + 1}`,
            x: Math.round(fr.x),
            y: Math.round(fr.y),
            width: Math.round(fr.width),
            height: Math.round(fr.height),
            areaM2: Math.round(areaM2 * 100) / 100,
            isReusable:
              fr.width >= this.MIN_REUSABLE_REMNANT_SIZE &&
              fr.height >= this.MIN_REUSABLE_REMNANT_SIZE,
          };
        })
        .sort((a, b) => b.areaM2 - a.areaM2);

      return {
        sheetIndex: sh.sheetIndex,
        material,
        sheetWidth: sheetW,
        sheetHeight: sheetH,
        pieces: sh.placedPieces,
        remnants,
        usedAreaM2: Math.round(usedAreaM2 * 100) / 100,
        totalAreaM2: Math.round(totalAreaM2 * 100) / 100,
        wastePercentage,
        cutLengthMeters: Math.round(cutLengthMeters * 10) / 10,
        efficiencyPercentage,
        strategyUsed: `Guillotine (${fitRule} / ${splitRule} / ${sortOrder})`,
      };
    });

    const totalSheets = finalSheets.length;
    const totalWasteM2 = finalSheets.reduce((sum, s) => sum + (s.totalAreaM2 - s.usedAreaM2), 0);
    const totalReusableRemnantsM2 = finalSheets.reduce(
      (sum, s) =>
        sum +
        s.remnants
          .filter((r) => r.isReusable)
          .reduce((rSum, r) => rSum + r.areaM2, 0),
      0
    );

    return {
      strategyName: `${fitRule} + ${splitRule} (${sortOrder})`,
      sheets: finalSheets,
      totalSheets,
      totalWasteM2,
      totalReusableRemnantsM2,
    };
  }

  /**
   * Automatic Multi-Heuristic Layout Optimizer:
   * Prioritizes remnant reuse and tests multiple packing strategies to find
   * the solution with the minimum number of raw sheets and highest yield!
   */
  public static optimizeLayout(pieces: CutPiece[]): NestedSheet[] {
    if (pieces.length === 0) return [];

    // Group pieces by material ID and thickness
    const groups: { [key: string]: { material: MaterialConfig; pieces: CutPiece[] } } = {};

    pieces.forEach((p) => {
      const key = `${p.material.id}_${p.thickness}`;
      if (!groups[key]) {
        groups[key] = { material: p.material, pieces: [] };
      }
      groups[key].pieces.push({ ...p });
    });

    const allFinalSheets: NestedSheet[] = [];
    let globalSheetIndex = 1;

    // Define heuristics matrix to evaluate
    const fitRules: FitRule[] = ['best-short-side-fit', 'best-area-fit', 'best-long-side-fit'];
    const splitRules: SplitRule[] = ['shorter-axis', 'longer-axis', 'minimize-area', 'horizontal', 'vertical'];
    const sortOrders: SortOrder[] = [
      'area-desc',
      'max-side-desc',
      'perimeter-desc',
      'height-desc',
      'width-desc',
      'aspect-desc',
    ];

    Object.values(groups).forEach(({ material, pieces: groupPieces }) => {
      let winningSimulation: SimulationResult | null = null;

      // Run multiple optimization passes to find the absolute minimum sheet count
      for (const fitRule of fitRules) {
        for (const splitRule of splitRules) {
          for (const sortOrder of sortOrders) {
            const simulation = this.simulatePackingStrategy(
              groupPieces,
              material,
              fitRule,
              splitRule,
              sortOrder,
              globalSheetIndex
            );

            if (!winningSimulation) {
              winningSimulation = simulation;
              continue;
            }

            // Primary objective: Minimum sheet count
            if (simulation.totalSheets < winningSimulation.totalSheets) {
              winningSimulation = simulation;
            } else if (simulation.totalSheets === winningSimulation.totalSheets) {
              // Secondary objective: Lowest total waste
              if (simulation.totalWasteM2 < winningSimulation.totalWasteM2) {
                winningSimulation = simulation;
              } else if (
                Math.abs(simulation.totalWasteM2 - winningSimulation.totalWasteM2) < 0.05 &&
                simulation.totalReusableRemnantsM2 > winningSimulation.totalReusableRemnantsM2
              ) {
                // Tertiary objective: Largest reusable consolidated remnants
                winningSimulation = simulation;
              }
            }
          }
        }
      }

      if (winningSimulation) {
        // Re-index sheets sequentially
        winningSimulation.sheets.forEach((s) => {
          s.sheetIndex = globalSheetIndex++;
          s.pieces.forEach((p) => {
            p.sheetIndex = s.sheetIndex;
          });
        });
        allFinalSheets.push(...winningSimulation.sheets);
      }
    });

    return allFinalSheets;
  }

  /**
   * Calculates detailed project costs and bill of materials
   */
  public static calculateProjectCost(
    nestedSheets: NestedSheet[],
    allObjects: SceneObject[]
  ): CostBreakdown {
    // 1. Material sheets costs
    const materialMap: { [matId: string]: { material: MaterialConfig; sheetCount: number; totalAreaM2: number; cost: number } } = {};

    nestedSheets.forEach((sheet) => {
      const mat = sheet.material;
      if (!materialMap[mat.id]) {
        materialMap[mat.id] = { material: mat, sheetCount: 0, totalAreaM2: 0, cost: 0 };
      }
      materialMap[mat.id].sheetCount += 1;
      materialMap[mat.id].totalAreaM2 += sheet.totalAreaM2;
      materialMap[mat.id].cost += sheet.totalAreaM2 * mat.unitPricePerM2;
    });

    const materials = Object.values(materialMap);

    // 2. Edge Banding length and cost
    let totalEdgeBandMeters = 0;
    let edgeBandCost = 0;

    nestedSheets.forEach((sheet) => {
      sheet.pieces.forEach((p) => {
        const eb = p.edgeBanding;
        let pMeters = 0;
        if (eb.top) pMeters += p.width / 1000;
        if (eb.bottom) pMeters += p.width / 1000;
        if (eb.left) pMeters += p.height / 1000;
        if (eb.right) pMeters += p.height / 1000;

        totalEdgeBandMeters += pMeters;
        edgeBandCost += pMeters * (p.material.edgeBandPricePerM || 15);
      });
    });

    // 3. Cutting & Machining
    let totalCutMeters = 0;
    let cuttingCost = 0;

    nestedSheets.forEach((sheet) => {
      totalCutMeters += sheet.cutLengthMeters;
      cuttingCost += sheet.cutLengthMeters * (sheet.material.cuttingPricePerM || 10);
    });

    // 4. Hardware items count
    let hingeCount = 0;
    let drawerSlideCount = 0;
    let handleCount = 0;
    let legCount = 0;
    let minifixCount = 0;

    allObjects.forEach((obj) => {
      if (!obj.visible) return;

      if (obj.type === 'door') {
        const h = obj.metadata?.door?.hingeCount || (obj.dimensions.height > 1200 ? 3 : 2);
        hingeCount += h;
        handleCount += 1;
      } else if (obj.type === 'drawer') {
        drawerSlideCount += 1;
        handleCount += 1;
      } else if (obj.type === 'leg') {
        legCount += 1;
      } else if (obj.type === 'shelf') {
        minifixCount += 4; // 4 shelf pins or minifixes
      } else if (obj.type === 'panel') {
        minifixCount += 4;
      }
    });

    const hingesTotal = hingeCount * HARDWARE_PRICES.hingeSoftClose;
    const slidesTotal = drawerSlideCount * HARDWARE_PRICES.drawerSlideTelescopic;
    const handlesTotal = handleCount * HARDWARE_PRICES.handleModernBar;
    const legsTotal = legCount * HARDWARE_PRICES.adjustableLeg;
    const minifixTotal = minifixCount * HARDWARE_PRICES.minifixSet;
    const hardwareTotal = hingesTotal + slidesTotal + handlesTotal + legsTotal + minifixTotal;

    // 5. Labor and assembly estimate (approx 18% of materials + hardware)
    const matTotal = materials.reduce((s, m) => s + m.cost, 0);
    const laborAndAssembly = Math.round((matTotal + edgeBandCost + cuttingCost + hardwareTotal) * 0.18);

    const totalCost = Math.round(
      matTotal + edgeBandCost + cuttingCost + hardwareTotal + laborAndAssembly
    );

    return {
      materials,
      edgeBanding: {
        totalLengthMeters: Math.round(totalEdgeBandMeters * 10) / 10,
        cost: Math.round(edgeBandCost),
      },
      cuttingAndMachining: {
        totalCutMeters: Math.round(totalCutMeters * 10) / 10,
        cost: Math.round(cuttingCost),
      },
      hardware: {
        hinges: { count: hingeCount, unitPrice: HARDWARE_PRICES.hingeSoftClose, total: hingesTotal },
        drawerSlides: { count: drawerSlideCount, unitPrice: HARDWARE_PRICES.drawerSlideTelescopic, total: slidesTotal },
        handles: { count: handleCount, unitPrice: HARDWARE_PRICES.handleModernBar, total: handlesTotal },
        minifixKavela: { count: minifixCount, unitPrice: HARDWARE_PRICES.minifixSet, total: minifixTotal },
        legs: { count: legCount, unitPrice: HARDWARE_PRICES.adjustableLeg, total: legsTotal },
        total: hardwareTotal,
      },
      laborAndAssembly,
      totalCost,
    };
  }
}
