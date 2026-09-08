import React, { useState, useEffect } from 'react';
import {
  ReceiptText,
  Printer,
  Download,
  X,
  TrendingUp,
  Box,
  Layers,
  Wrench,
  Percent,
  CheckCircle2,
  Sliders,
} from 'lucide-react';
import { SceneObject, CostBreakdown } from '../types/cad';
import { NestingOptimizer } from '../engine/NestingOptimizer';

interface CostReportModalProps {
  isOpen: boolean;
  objects: SceneObject[];
  projectName: string;
  onClose: () => void;
}

export const CostReportModal: React.FC<CostReportModalProps> = ({
  isOpen,
  objects,
  projectName,
  onClose,
}) => {
  const [costData, setCostData] = useState<CostBreakdown | null>(null);
  const [markupPercent, setMarkupPercent] = useState<number>(25); // Kar Marjı %25
  const [taxPercent, setTaxPercent] = useState<number>(20); // KDV %20

  useEffect(() => {
    if (isOpen) {
      const cutPieces = NestingOptimizer.extractCutPieces(objects);
      const sheets = NestingOptimizer.optimizeLayout(cutPieces);
      const cost = NestingOptimizer.calculateProjectCost(sheets, objects);
      setCostData(cost);
    }
  }, [isOpen, objects]);

  if (!isOpen || !costData) return null;

  const rawTotal = costData.totalCost;
  const markupAmount = Math.round(rawTotal * (markupPercent / 100));
  const subtotalWithMarkup = rawTotal + markupAmount;
  const taxAmount = Math.round(subtotalWithMarkup * (taxPercent / 100));
  const grandTotal = subtotalWithMarkup + taxAmount;

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-md p-2 sm:p-6 animate-in fade-in duration-200">
      <div
        className="w-full max-w-4xl bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 bg-slate-800/90 border-b border-slate-700">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <ReceiptText className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                Maliyet ve Üretim Teklif Raporu
              </h2>
              <p className="text-xs text-slate-400 font-mono">{projectName}</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-lg text-xs font-semibold transition"
            >
              <Printer className="w-4 h-4 text-blue-400" />
              <span>Yazdır / PDF</span>
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-700 transition"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="p-5 space-y-5 overflow-y-auto flex-1 bg-slate-950 text-xs">
          {/* Summary Stat Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-slate-900 p-3.5 rounded-xl border border-slate-800">
              <div className="text-slate-400 text-[11px] mb-1">Ham Levha Gideri</div>
              <div className="text-base font-bold font-mono text-white">
                {costData.materials.reduce((s, m) => s + m.cost, 0).toLocaleString('tr-TR')} ₺
              </div>
              <div className="text-[10px] text-slate-500">
                {costData.materials.reduce((s, m) => s + m.sheetCount, 0)} Adet Plaka
              </div>
            </div>

            <div className="bg-slate-900 p-3.5 rounded-xl border border-slate-800">
              <div className="text-slate-400 text-[11px] mb-1">PVC Kenar Bantı</div>
              <div className="text-base font-bold font-mono text-white">
                {costData.edgeBanding.cost.toLocaleString('tr-TR')} ₺
              </div>
              <div className="text-[10px] text-slate-500">
                {costData.edgeBanding.totalLengthMeters} Metre
              </div>
            </div>

            <div className="bg-slate-900 p-3.5 rounded-xl border border-slate-800">
              <div className="text-slate-400 text-[11px] mb-1">Aksesuar & Donanım</div>
              <div className="text-base font-bold font-mono text-white">
                {costData.hardware.total.toLocaleString('tr-TR')} ₺
              </div>
              <div className="text-[10px] text-slate-500">Menteşe, Ray, Kulplar</div>
            </div>

            <div className="bg-slate-900 p-3.5 rounded-xl border border-emerald-500/30 bg-emerald-500/5">
              <div className="text-emerald-400 text-[11px] mb-1 font-semibold">Toplam Teklif Fiyatı</div>
              <div className="text-lg font-bold font-mono text-emerald-400">
                {grandTotal.toLocaleString('tr-TR')} ₺
              </div>
              <div className="text-[10px] text-emerald-500/80">KDV & Kar Dahil</div>
            </div>
          </div>

          {/* Section 1: Malzeme Detayları */}
          <div className="bg-slate-900 rounded-xl border border-slate-800 overflow-hidden">
            <div className="p-3 bg-slate-800/80 border-b border-slate-800 font-bold text-white flex items-center justify-between">
              <span>1. Levha Malzeme Maliyetleri</span>
              <span className="font-mono text-blue-400">
                {costData.materials.reduce((s, m) => s + m.cost, 0).toLocaleString('tr-TR')} ₺
              </span>
            </div>
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-950 text-slate-400 border-b border-slate-800">
                <tr>
                  <th className="p-2.5">Malzeme Türü</th>
                  <th className="p-2.5">Plaka Ölçüsü</th>
                  <th className="p-2.5">Adet</th>
                  <th className="p-2.5">Birim Fiyat</th>
                  <th className="p-2.5 text-right">Tutar</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-mono text-slate-300">
                {costData.materials.map((m) => (
                  <tr key={m.material.id}>
                    <td className="p-2.5 font-sans font-semibold text-white">{m.material.name}</td>
                    <td className="p-2.5">
                      {m.material.sheetWidth}x{m.material.sheetHeight}mm ({m.material.defaultThickness}mm)
                    </td>
                    <td className="p-2.5 text-blue-400 font-bold">{m.sheetCount} Levha</td>
                    <td className="p-2.5">{m.material.unitPricePerM2} ₺/m²</td>
                    <td className="p-2.5 text-right text-emerald-400 font-bold">
                      {m.cost.toLocaleString('tr-TR')} ₺
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Section 2: Aksesuar ve Bağlantı Elemanları */}
          <div className="bg-slate-900 rounded-xl border border-slate-800 overflow-hidden">
            <div className="p-3 bg-slate-800/80 border-b border-slate-800 font-bold text-white flex items-center justify-between">
              <span>2. Mobilya Aksesuarları ve Bağlantı Donanımları</span>
              <span className="font-mono text-blue-400">
                {costData.hardware.total.toLocaleString('tr-TR')} ₺
              </span>
            </div>
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-950 text-slate-400 border-b border-slate-800">
                <tr>
                  <th className="p-2.5">Donanım</th>
                  <th className="p-2.5">Miktar</th>
                  <th className="p-2.5">Birim Fiyat</th>
                  <th className="p-2.5 text-right">Tutar</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-mono text-slate-300">
                <tr>
                  <td className="p-2.5 font-sans text-white font-medium">Frenli Tas Menteşe (Soft-Close)</td>
                  <td className="p-2.5">{costData.hardware.hinges.count} Adet</td>
                  <td className="p-2.5">{costData.hardware.hinges.unitPrice} ₺</td>
                  <td className="p-2.5 text-right">{costData.hardware.hinges.total.toLocaleString('tr-TR')} ₺</td>
                </tr>
                <tr>
                  <td className="p-2.5 font-sans text-white font-medium">Teleskopik Çekmece Rayı</td>
                  <td className="p-2.5">{costData.hardware.drawerSlides.count} Takım</td>
                  <td className="p-2.5">{costData.hardware.drawerSlides.unitPrice} ₺</td>
                  <td className="p-2.5 text-right">{costData.hardware.drawerSlides.total.toLocaleString('tr-TR')} ₺</td>
                </tr>
                <tr>
                  <td className="p-2.5 font-sans text-white font-medium">Modern Mobilya Kulpu</td>
                  <td className="p-2.5">{costData.hardware.handles.count} Adet</td>
                  <td className="p-2.5">{costData.hardware.handles.unitPrice} ₺</td>
                  <td className="p-2.5 text-right">{costData.hardware.handles.total.toLocaleString('tr-TR')} ₺</td>
                </tr>
                <tr>
                  <td className="p-2.5 font-sans text-white font-medium">Minifix + Ahşap Kavela Bağlantı</td>
                  <td className="p-2.5">{costData.hardware.minifixKavela.count} Set</td>
                  <td className="p-2.5">{costData.hardware.minifixKavela.unitPrice} ₺</td>
                  <td className="p-2.5 text-right">{costData.hardware.minifixKavela.total.toLocaleString('tr-TR')} ₺</td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Section 3: Kar Marjı ve KDV Slider Bar Hesaplayıcı */}
          <div className="bg-slate-900 p-4 rounded-xl border border-slate-800 space-y-3">
            <h3 className="font-bold text-white text-xs flex items-center gap-1.5">
              <Sliders className="w-4 h-4 text-blue-400" />
              Teklif ve Fiyatlandırma Slider Ayarları
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="bg-slate-800/60 p-3 rounded-xl border border-slate-700/60 space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-slate-300 font-semibold">Kar Marjı Oranı (%)</span>
                  <span className="font-mono font-bold text-blue-400 text-xs px-2 py-0.5 bg-blue-500/10 rounded">
                    %{markupPercent}
                  </span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={100}
                  step={5}
                  value={markupPercent}
                  onChange={(e) => setMarkupPercent(Number(e.target.value))}
                  className="w-full accent-blue-500 cursor-pointer"
                />
                <div className="flex justify-between text-[10px] text-slate-500 font-mono">
                  <span>%0</span>
                  <span>%50</span>
                  <span>%100</span>
                </div>
              </div>

              <div className="bg-slate-800/60 p-3 rounded-xl border border-slate-700/60 space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-slate-300 font-semibold">KDV Oranı (%)</span>
                  <span className="font-mono font-bold text-blue-400 text-xs px-2 py-0.5 bg-blue-500/10 rounded">
                    %{taxPercent}
                  </span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={30}
                  step={1}
                  value={taxPercent}
                  onChange={(e) => setTaxPercent(Number(e.target.value))}
                  className="w-full accent-blue-500 cursor-pointer"
                />
                <div className="flex justify-between text-[10px] text-slate-500 font-mono">
                  <span>%0</span>
                  <span>%15</span>
                  <span>%30</span>
                </div>
              </div>
            </div>

            {/* Grand Total Summary Box */}
            <div className="pt-3 border-t border-slate-800 space-y-1.5 font-mono">
              <div className="flex justify-between text-slate-400">
                <span>İmalat Maliyeti (Ham):</span>
                <span>{rawTotal.toLocaleString('tr-TR')} ₺</span>
              </div>
              <div className="flex justify-between text-slate-400">
                <span>Kar Marjı (+%{markupPercent}):</span>
                <span>{markupAmount.toLocaleString('tr-TR')} ₺</span>
              </div>
              <div className="flex justify-between text-slate-400">
                <span>KDV (+%{taxPercent}):</span>
                <span>{taxAmount.toLocaleString('tr-TR')} ₺</span>
              </div>
              <div className="flex justify-between text-sm font-bold text-emerald-400 pt-2 border-t border-slate-800">
                <span>GENEL TOPLAM (MÜŞTERİ TEKLİFİ):</span>
                <span className="text-base">{grandTotal.toLocaleString('tr-TR')} ₺</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
