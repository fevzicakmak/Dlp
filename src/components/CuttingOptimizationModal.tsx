import React, { useState, useEffect, useRef } from 'react';
import {
  Scissors,
  FileCode,
  FileSpreadsheet,
  X,
  ChevronLeft,
  ChevronRight,
  Cpu,
  Sparkles,
  Layers,
  Recycle,
  CheckCircle2,
  Box,
} from 'lucide-react';
import { SceneObject, NestedSheet } from '../types/cad';
import { NestingOptimizer } from '../engine/NestingOptimizer';
import { CncGenerator } from '../engine/CncGenerator';

interface CuttingOptimizationModalProps {
  isOpen: boolean;
  objects: SceneObject[];
  onClose: () => void;
}

export const CuttingOptimizationModal: React.FC<CuttingOptimizationModalProps> = ({
  isOpen,
  objects,
  onClose,
}) => {
  const [nestedSheets, setNestedSheets] = useState<NestedSheet[]>([]);
  const [currentSheetIdx, setCurrentSheetIdx] = useState<number>(0);
  const [activeTab, setActiveTab] = useState<'layout' | 'cutlist' | 'remnants' | 'cnc'>('layout');
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    if (isOpen) {
      const cutPieces = NestingOptimizer.extractCutPieces(objects);
      const sheets = NestingOptimizer.optimizeLayout(cutPieces);
      setNestedSheets(sheets);
      setCurrentSheetIdx(0);
    }
  }, [isOpen, objects]);

  // Draw 2D Nesting Sheet Diagram on HTML5 Canvas
  useEffect(() => {
    if (!isOpen || nestedSheets.length === 0 || activeTab !== 'layout') return;

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const sheet = nestedSheets[currentSheetIdx];
    if (!sheet) return;

    const canvasWidth = canvas.width;
    const canvasHeight = canvas.height;

    // Clear Canvas
    ctx.clearRect(0, 0, canvasWidth, canvasHeight);

    // Padding & Scale to fit
    const pad = 34;
    const availableW = canvasWidth - 2 * pad;
    const availableH = canvasHeight - 2 * pad;

    const scaleX = availableW / sheet.sheetWidth;
    const scaleY = availableH / sheet.sheetHeight;
    const scale = Math.min(scaleX, scaleY);

    const sheetRenderW = sheet.sheetWidth * scale;
    const sheetRenderH = sheet.sheetHeight * scale;

    const startX = pad + (availableW - sheetRenderW) / 2;
    const startY = pad + (availableH - sheetRenderH) / 2;

    // Draw Raw Sheet Background (Wood/MDF dark slate blueprint)
    ctx.fillStyle = '#0f172a';
    ctx.strokeStyle = '#475569';
    ctx.lineWidth = 2;
    ctx.fillRect(startX, startY, sheetRenderW, sheetRenderH);
    ctx.strokeRect(startX, startY, sheetRenderW, sheetRenderH);

    // Draw Sheet Dimensions Outer Text
    ctx.fillStyle = '#94a3b8';
    ctx.font = '11px "JetBrains Mono", monospace';
    ctx.textAlign = 'center';
    ctx.fillText(`${sheet.sheetWidth} mm`, startX + sheetRenderW / 2, startY - 12);
    ctx.save();
    ctx.translate(startX - 14, startY + sheetRenderH / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.fillText(`${sheet.sheetHeight} mm`, 0, 0);
    ctx.restore();

    // Draw Usable Remnant Rectangles (Kalan Parçalar / Offcuts)
    if (sheet.remnants) {
      sheet.remnants.forEach((remnant) => {
        const rx = startX + remnant.x * scale;
        const ry = startY + remnant.y * scale;
        const rw = remnant.width * scale;
        const rh = remnant.height * scale;

        if (rw <= 2 || rh <= 2) return;

        if (remnant.isReusable) {
          // Reusable remnant: green striped tint
          ctx.fillStyle = 'rgba(16, 185, 129, 0.18)';
          ctx.fillRect(rx, ry, rw, rh);

          ctx.strokeStyle = '#10b981';
          ctx.lineWidth = 1.5;
          ctx.setLineDash([4, 4]);
          ctx.strokeRect(rx, ry, rw, rh);
          ctx.setLineDash([]);

          if (rw > 55 && rh > 28) {
            ctx.fillStyle = '#34d399';
            ctx.font = 'bold 9px "JetBrains Mono", monospace';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('KALAN PARÇA', rx + rw / 2, ry + rh / 2 - 5);
            ctx.font = '8px "JetBrains Mono", monospace';
            ctx.fillText(`${remnant.width}x${remnant.height}`, rx + rw / 2, ry + rh / 2 + 6);
          }
        } else {
          // Minor offcut / fire
          ctx.fillStyle = 'rgba(100, 116, 139, 0.12)';
          ctx.fillRect(rx, ry, rw, rh);
        }
      });
    }

    // Draw Nested Cut Pieces
    sheet.pieces.forEach((piece, idx) => {
      const px = startX + (piece.x || 0) * scale;
      const py = startY + (piece.y || 0) * scale;
      const pw = piece.width * scale;
      const ph = piece.height * scale;

      // Color scheme for piece
      const colors = ['#2563eb', '#3b82f6', '#0284c7', '#0891b2', '#0d9488', '#d97706', '#6366f1'];
      ctx.fillStyle = colors[idx % colors.length];
      ctx.fillRect(px, py, pw, ph);

      // Part Border
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1.2;
      ctx.strokeRect(px, py, pw, ph);

      // Edge-banding indicator lines (Yellow border on banded edges)
      ctx.strokeStyle = '#f59e0b';
      ctx.lineWidth = 3;
      if (piece.edgeBanding?.top) {
        ctx.beginPath();
        ctx.moveTo(px, py);
        ctx.lineTo(px + pw, py);
        ctx.stroke();
      }
      if (piece.edgeBanding?.bottom) {
        ctx.beginPath();
        ctx.moveTo(px, py + ph);
        ctx.lineTo(px + pw, py + ph);
        ctx.stroke();
      }
      if (piece.edgeBanding?.left) {
        ctx.beginPath();
        ctx.moveTo(px, py);
        ctx.lineTo(px, py + ph);
        ctx.stroke();
      }
      if (piece.edgeBanding?.right) {
        ctx.beginPath();
        ctx.moveTo(px + pw, py);
        ctx.lineTo(px + pw, py + ph);
        ctx.stroke();
      }

      // Piece Label Text inside box
      if (pw > 28 && ph > 18) {
        ctx.fillStyle = '#ffffff';
        ctx.font = `bold ${Math.min(11, Math.max(8, Math.floor(pw / 12)))}px sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(piece.name.split('(')[0].trim(), px + pw / 2, py + ph / 2 - 6);

        ctx.font = '9px "JetBrains Mono", monospace';
        ctx.fillStyle = '#e2e8f0';
        ctx.fillText(`${piece.width} x ${piece.height}`, px + pw / 2, py + ph / 2 + 7);
      }
    });
  }, [isOpen, nestedSheets, currentSheetIdx, activeTab]);

  if (!isOpen) return null;

  const currentSheet = nestedSheets[currentSheetIdx];
  const allCutPieces = NestingOptimizer.extractCutPieces(objects);
  const totalReusableRemnants = nestedSheets.reduce(
    (acc, s) => acc + (s.remnants ? s.remnants.filter((r) => r.isReusable).length : 0),
    0
  );
  const totalRemnantAreaM2 = nestedSheets.reduce(
    (acc, s) =>
      acc +
      (s.remnants
        ? s.remnants.filter((r) => r.isReusable).reduce((sum, r) => sum + r.areaM2, 0)
        : 0),
    0
  );

  const downloadFile = (filename: string, content: string, mime: string) => {
    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleExportGCode = () => {
    if (!currentSheet) return;
    const gcode = CncGenerator.generateGCode(currentSheet);
    downloadFile(`CNC_Levha_${currentSheet.sheetIndex}.nc`, gcode, 'text/plain');
  };

  const handleExportDXF = () => {
    if (!currentSheet) return;
    const dxf = CncGenerator.generateDXF(currentSheet);
    downloadFile(`CAD_Nesting_Levha_${currentSheet.sheetIndex}.dxf`, dxf, 'application/dxf');
  };

  const handleExportCSV = () => {
    const csv = CncGenerator.generateCuttingListCSV(allCutPieces);
    downloadFile('Kesim_Ebatlama_Listesi.csv', csv, 'text/csv');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-md p-2 sm:p-6 animate-in fade-in duration-200">
      <div
        className="w-full max-w-5xl bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 bg-slate-800/90 border-b border-slate-700">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20">
              <Scissors className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                Ebatlama & CNC Optimizasyonu
                <span className="text-[10px] bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-2 py-0.5 rounded-full flex items-center gap-1 font-normal">
                  <Sparkles className="w-3 h-3" />
                  En Az Plaka & Kalan Parça Öncelikli
                </span>
              </h2>
              <p className="text-xs text-slate-400">
                Toplam {allCutPieces.length} Parça • Sadece {nestedSheets.length} Ham Levha Gerekli • {totalReusableRemnants} Reusable Kalan Parça
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-700 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation Tabs */}
        <div className="flex items-center justify-between px-5 py-2 bg-slate-900/70 border-b border-slate-800 text-xs flex-wrap gap-2">
          <div className="flex items-center gap-1.5 flex-wrap">
            <button
              onClick={() => setActiveTab('layout')}
              className={`px-3 py-1.5 rounded-lg font-semibold transition ${
                activeTab === 'layout'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800'
              }`}
            >
              Levha Yerleşim Planı
            </button>
            <button
              onClick={() => setActiveTab('cutlist')}
              className={`px-3 py-1.5 rounded-lg font-semibold transition ${
                activeTab === 'cutlist'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800'
              }`}
            >
              Kesim Listesi ({allCutPieces.length})
            </button>
            <button
              onClick={() => setActiveTab('remnants')}
              className={`px-3 py-1.5 rounded-lg font-semibold transition flex items-center gap-1.5 ${
                activeTab === 'remnants'
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800'
              }`}
            >
              <Recycle className="w-3.5 h-3.5 text-emerald-400" />
              Kalan Parçalar ({totalReusableRemnants})
            </button>
            <button
              onClick={() => setActiveTab('cnc')}
              className={`px-3 py-1.5 rounded-lg font-semibold transition ${
                activeTab === 'cnc'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800'
              }`}
            >
              CNC & G-Code Çıktısı
            </button>
          </div>

          {/* Export Quick Actions */}
          <div className="flex items-center gap-2">
            <button
              onClick={handleExportCSV}
              className="flex items-center gap-1.5 px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-lg font-medium transition"
              title="CSV Kesim Listesi İndir"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-400" />
              <span className="hidden sm:inline">CSV Listesi</span>
            </button>
            <button
              onClick={handleExportDXF}
              className="flex items-center gap-1.5 px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-lg font-medium transition"
              title="AutoCAD DXF Dosyası İndir"
            >
              <FileCode className="w-3.5 h-3.5 text-blue-400" />
              <span className="hidden sm:inline">DXF Çizimi</span>
            </button>
            <button
              onClick={handleExportGCode}
              className="flex items-center gap-1.5 px-2.5 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-semibold transition shadow-sm"
              title="CNC G-Code İndir"
            >
              <Cpu className="w-3.5 h-3.5" />
              <span>G-Code (.nc)</span>
            </button>
          </div>
        </div>

        {/* Tab Body */}
        <div className="p-4 overflow-y-auto flex-1 bg-slate-950">
          {/* TAB 1: 2D NESTING SHEET DIAGRAM */}
          {activeTab === 'layout' && (
            <div className="flex flex-col items-center">
              {/* Sheet Pagination & Info */}
              {nestedSheets.length > 0 && currentSheet && (
                <div className="w-full flex items-center justify-between mb-3 bg-slate-900 p-3 rounded-xl border border-slate-800 flex-wrap gap-2">
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => setCurrentSheetIdx((prev) => Math.max(0, prev - 1))}
                      disabled={currentSheetIdx === 0}
                      className="p-1.5 rounded-lg bg-slate-800 text-slate-300 hover:bg-slate-700 disabled:opacity-30 disabled:pointer-events-none"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </button>
                    <span className="text-sm font-bold text-white font-mono">
                      Levha {currentSheetIdx + 1} / {nestedSheets.length}
                    </span>
                    <button
                      onClick={() =>
                        setCurrentSheetIdx((prev) => Math.min(nestedSheets.length - 1, prev + 1))
                      }
                      disabled={currentSheetIdx >= nestedSheets.length - 1}
                      className="p-1.5 rounded-lg bg-slate-800 text-slate-300 hover:bg-slate-700 disabled:opacity-30 disabled:pointer-events-none"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Stats */}
                  <div className="flex items-center gap-4 text-xs font-mono flex-wrap">
                    <div>
                      <span className="text-slate-400">Malzeme: </span>
                      <span className="text-white font-semibold">{currentSheet.material.name}</span>
                    </div>
                    <div>
                      <span className="text-slate-400">Parça Sayısı: </span>
                      <span className="text-blue-400 font-bold">{currentSheet.pieces.length}</span>
                    </div>
                    <div>
                      <span className="text-slate-400">Verimlilik: </span>
                      <span className="text-emerald-400 font-bold">%{currentSheet.efficiencyPercentage ?? (100 - currentSheet.wastePercentage)}</span>
                    </div>
                    <div>
                      <span className="text-slate-400">Kalan Parça: </span>
                      <span className="text-emerald-300 font-semibold">
                        {currentSheet.remnants?.filter((r) => r.isReusable).length || 0} Adet
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-400">Kesim Boyu: </span>
                      <span className="text-emerald-400 font-bold">{currentSheet.cutLengthMeters} m</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Canvas Container */}
              <div className="w-full flex justify-center bg-slate-900/60 p-4 rounded-xl border border-slate-800">
                <canvas
                  ref={canvasRef}
                  width={800}
                  height={500}
                  className="max-w-full rounded-lg shadow-inner bg-slate-900"
                />
              </div>

              <div className="w-full flex items-center justify-between text-[11px] text-slate-400 mt-2.5 px-1 flex-wrap gap-2">
                <p className="flex items-center gap-1.5">
                  <span className="w-3 h-1 bg-amber-400 rounded-full inline-block" />
                  Sarı kenarlar PVC kenar bantı uygulanacak kenarları göstermektedir.
                </p>
                <p className="flex items-center gap-1.5 text-emerald-400">
                  <span className="w-3 h-3 border border-dashed border-emerald-400 bg-emerald-500/20 rounded inline-block" />
                  Yeşil kesikli alanlar atölyede yeniden kullanılabilecek kalan parçalardır (Remnant).
                </p>
              </div>
            </div>
          )}

          {/* TAB 2: CUT LIST TABLE */}
          {activeTab === 'cutlist' && (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-900 text-slate-400 border-b border-slate-800">
                    <th className="p-2.5">No</th>
                    <th className="p-2.5">Parça Adı</th>
                    <th className="p-2.5">Boy (mm)</th>
                    <th className="p-2.5">En (mm)</th>
                    <th className="p-2.5">Kalınlık</th>
                    <th className="p-2.5">Malzeme</th>
                    <th className="p-2.5">Kenar Bantları (Ü/A/S/S)</th>
                    <th className="p-2.5">Levha</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 font-mono">
                  {allCutPieces.map((piece, idx) => (
                    <tr key={piece.id} className="hover:bg-slate-900/60 text-slate-300">
                      <td className="p-2.5 text-slate-500">{idx + 1}</td>
                      <td className="p-2.5 text-white font-sans font-semibold">{piece.name}</td>
                      <td className="p-2.5 text-blue-400 font-bold">{piece.height}</td>
                      <td className="p-2.5 text-blue-400 font-bold">{piece.width}</td>
                      <td className="p-2.5">{piece.thickness} mm</td>
                      <td className="p-2.5 font-sans">{piece.material.name}</td>
                      <td className="p-2.5">
                        <span className="text-emerald-400">
                          {piece.edgeBanding.top ? 'Ü ' : '- '}
                          {piece.edgeBanding.bottom ? 'A ' : '- '}
                          {piece.edgeBanding.left ? 'S ' : '- '}
                          {piece.edgeBanding.right ? 'S' : '-'}
                        </span>
                      </td>
                      <td className="p-2.5 text-amber-400">#{piece.sheetIndex || 1}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* TAB 3: REUSABLE REMNANTS / KALAN PARÇALAR */}
          {activeTab === 'remnants' && (
            <div className="space-y-4">
              <div className="bg-emerald-950/30 border border-emerald-500/30 p-4 rounded-xl flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-emerald-500/20 text-emerald-400 rounded-xl">
                    <Recycle className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-white">Kazanılan Kalan Levha Parçaları (Remnants)</h3>
                    <p className="text-xs text-slate-400">
                      Minimum plaka optimizasyonu sonucunda sonraki üretimlerde kullanılmak üzere kurtarılan sağlam levha parçaları.
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-lg font-bold font-mono text-emerald-400">{totalRemnantAreaM2.toFixed(2)} m²</div>
                  <div className="text-[11px] text-slate-400">{totalReusableRemnants} Adet Reusable Parça</div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {nestedSheets.flatMap((sh) =>
                  (sh.remnants || [])
                    .filter((r) => r.isReusable)
                    .map((remnant) => (
                      <div
                        key={remnant.id}
                        className="p-3.5 rounded-xl bg-slate-900/90 border border-emerald-500/30 hover:border-emerald-500/60 transition flex items-center justify-between"
                      >
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-semibold text-white">Levha #{sh.sheetIndex} Artığı</span>
                            <span className="text-[10px] bg-emerald-500/20 text-emerald-300 px-1.5 py-0.5 rounded font-mono">
                              {sh.material.name}
                            </span>
                          </div>
                          <div className="text-sm font-bold font-mono text-emerald-400 mt-1">
                            {remnant.width} mm × {remnant.height} mm
                          </div>
                          <div className="text-[10px] text-slate-400 mt-0.5">
                            Konum: X:{remnant.x}mm, Y:{remnant.y}mm
                          </div>
                        </div>
                        <div className="text-right">
                          <span className="text-xs font-mono font-bold text-slate-200">
                            {remnant.areaM2} m²
                          </span>
                        </div>
                      </div>
                    ))
                )}
              </div>
            </div>
          )}

          {/* TAB 4: CNC G-CODE PREVIEW */}
          {activeTab === 'cnc' && currentSheet && (
            <div className="space-y-3">
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-400">
                  ISO G-Code Programı — Levha #{currentSheet.sheetIndex} ({currentSheet.pieces.length} Parça)
                </span>
                <button
                  onClick={handleExportGCode}
                  className="px-3 py-1 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-semibold"
                >
                  G-Code İndir (.nc)
                </button>
              </div>
              <pre className="p-4 bg-slate-900 border border-slate-800 rounded-xl text-xs font-mono text-emerald-400 overflow-x-auto max-h-96">
                {CncGenerator.generateGCode(currentSheet)}
              </pre>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
