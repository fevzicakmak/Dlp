import React from 'react';
import {
  HelpCircle,
  X,
  MousePointer,
  Touchpad,
  Magnet,
  Layers,
  Scissors,
  CheckCircle2,
  Sliders,
} from 'lucide-react';

interface HelpGuideModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const HelpGuideModal: React.FC<HelpGuideModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-md p-3 sm:p-6 animate-in fade-in duration-200 select-none">
      <div
        className="w-full max-w-3xl bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 bg-slate-800/90 border-b border-slate-700">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-blue-500/10 text-blue-400 border border-blue-500/20">
              <HelpCircle className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">3D Dolap CAD Pro — Kullanım Rehberi</h2>
              <p className="text-xs text-slate-400">SketchUp sezgiselliğinde profesyonel mobilya tasarımı</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-700 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 space-y-5 overflow-y-auto flex-1 bg-slate-950 text-xs text-slate-300">
          {/* Section 1: 3D Navigasyon & Dokunmatik */}
          <div className="bg-slate-900 p-4 rounded-xl border border-slate-800 space-y-2">
            <h3 className="font-bold text-white text-sm flex items-center gap-2">
              <Touchpad className="w-4 h-4 text-blue-400" />
              1. 3D Canvas & Dokunmatik Kontroller
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
              <div className="p-2.5 bg-slate-950 rounded-lg border border-slate-800">
                <span className="font-bold text-white block mb-0.5">Döndürme (Orbit):</span>
                <span>Mobilde tek parmakla sürükleyin, masaüstünde sol tık ile çevirin.</span>
              </div>
              <div className="p-2.5 bg-slate-950 rounded-lg border border-slate-800">
                <span className="font-bold text-white block mb-0.5">Kaydırma (Pan):</span>
                <span>Mobilde iki parmakla kaydırın, masaüstünde sağ tık veya Shift+Sol Tık.</span>
              </div>
              <div className="p-2.5 bg-slate-950 rounded-lg border border-slate-800">
                <span className="font-bold text-white block mb-0.5">Yakınlaştırma (Zoom):</span>
                <span>Mobilde iki parmakla çimdikleyin (pinch), masaüstünde mouse tekerleği.</span>
              </div>
              <div className="p-2.5 bg-slate-950 rounded-lg border border-slate-800">
                <span className="font-bold text-white block mb-0.5">Nesne Seçme:</span>
                <span>Parçaya dokunup/tıklayıp seçin. Çoklu seçim için Shift tuşuna basılı tutun.</span>
              </div>
            </div>
          </div>

          {/* Section 2: Hücre Algılama Sistemi */}
          <div className="bg-slate-900 p-4 rounded-xl border border-slate-800 space-y-2">
            <h3 className="font-bold text-white text-sm flex items-center gap-2">
              <Sliders className="w-4 h-4 text-emerald-400" />
              2. Akıllı Hücre Algılama Sistemi (Cell Detection)
            </h3>
            <p className="leading-relaxed">
              Dolap içi paneller, dikmeler ve raflar arasındaki kapalı hacimler sistem tarafından otomatik olarak <strong>HÜCRE</strong> olarak algılanır.
            </p>
            <ul className="list-disc pl-5 space-y-1 text-slate-300">
              <li><strong>+ Raf:</strong> Hücrenin genişliğine otomatik oturur.</li>
              <li><strong>+ Dikey Dikme:</strong> Hücreyi sol ve sağ olarak 2 yeni bölmeye ayırır.</li>
              <li><strong>+ Çekmece (1-6'lı Dikey Mod):</strong> Butona dokunarak 1'den 6'ya kadar dikey çekmece grubu seçebilir veya sürükleyerek hücreye yerleştirebilirsiniz. Hücre yüksekliği eşit parçalara bölünür.</li>
              <li><strong>+ Çoklu Hücre Kapak:</strong> Kapak eklerken dokunmayı bırakmadan birden fazla hücrenin üzerinden geçtiğinizde tüm seçili hücreleri tek veya çift kapak içine alır.</li>
              <li><strong>+ Canlı Duvar, Kiriş ve Kolon Çizimi:</strong> Butona tıkladığınızda kamera otomatik 2D Kuş Bakışı (Plan) görünümüne geçer. Zeminde bir noktaya dokunup sürükleyerek eş zamanlı ölçülü duvar/kiriş oluşturabilirsiniz. Dokunmayı bıraktığınızda çizim tamamlanır ve otomatik 3D görünüme geri döner.</li>
            </ul>
          </div>

          {/* Section 3: Mıknatıs (Snap) & Çakışma Önleme */}
          <div className="bg-slate-900 p-4 rounded-xl border border-slate-800 space-y-2">
            <h3 className="font-bold text-white text-sm flex items-center gap-2">
              <Magnet className="w-4 h-4 text-amber-400" />
              3. Mıknatıs (Snap) ve Çakışma Algılama
            </h3>
            <p className="leading-relaxed">
              Dolaplar zemine (Y=0), duvara veya birbirlerine yaklaştırıldığında mıknatıs gibi otomatik hizalanır. Fizik motoru nesnelerin birbirlerinin içinden geçmesini engeller.
            </p>
          </div>

          {/* Section 4: Toplu Seçim & Gruplama */}
          <div className="bg-slate-900 p-4 rounded-xl border border-slate-800 space-y-2">
            <h3 className="font-bold text-white text-sm flex items-center gap-2">
              <Layers className="w-4 h-4 text-cyan-400" />
              4. Toplu Seçim & SketchUp Tarzı Gruplama
            </h3>
            <p className="leading-relaxed">
              İşlemler sekmesindeki <strong>"Toplu Seç"</strong> butonuna dokunarak ekranda sürükle-bırak çerçevesi ile birden fazla parçayı aynı anda seçebilirsiniz. Seçim tamamlandığında <strong>"Grup Oluştur"</strong> butonu aktive olur ve tek tıkla parçaları birleşik grup haline getirir.
            </p>
          </div>

          {/* Section 5: Ebatlama, Minimum Plaka & Kalan Parça Optimizasyonu */}
          <div className="bg-slate-900 p-4 rounded-xl border border-slate-800 space-y-2">
            <h3 className="font-bold text-white text-sm flex items-center gap-2">
              <Scissors className="w-4 h-4 text-purple-400" />
              5. Ebatlama & Minimum Plaka Optimizasyonu (Kalan Parça Öncelikli)
            </h3>
            <p className="leading-relaxed">
              Tasarım bittiğinde <strong>"Ebatlama & CNC"</strong> butonuna tıklayarak parçaların ham levhalara en az sayıda plaka kullanacak ve kalan parçaları (remnant) en verimli şekilde değerlendirecek otomatik Guillotine yerleşimini görüntüleyebilir, CNC G-Code (.nc) ve DXF çıktısı alabilirsiniz.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-900 border-t border-slate-800 flex justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-bold text-xs"
          >
            Anladım, Tasarıma Başla
          </button>
        </div>
      </div>
    </div>
  );
};
