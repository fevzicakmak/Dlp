# 3D Dolap CAD Pro — Özel Mobilya Tasarım & Ebatlama Stüdyosu

Tarayıcı üzerinde çalışan, mobil dokunmatik uyumlu, profesyonel 3D özel dolap ve mobilya tasarım uygulaması.

## 🚀 Özellikler

- **Geniş 3D Canvas:** WebGL (Three.js) tabanlı, mobil ve masaüstü ekranlarına otomatik uyum sağlayan tam ekran çalışma alanı.
- **3D Görüntüleme Modları:**
  - *Eskiz (Sketch):* Kalın keskin kontur çizgileri ve teknik çizim stili.
  - *Realistik (Realistic):* Gerçekçi ahşap dokuları, gölgelendirme ve yansımalar.
  - *Boyasız (Clay/Ham):* Ham malzeme ve astar modu.
- **Bağımsız Parça Hiyerarşisi:**
  - Başlangıç dolabı ayrı ID'lere sahip panellerden oluşur: `cabinet_001_bottom`, `cabinet_001_top`, `cabinet_001_left`, `cabinet_001_right`, `cabinet_001_back`.
- **Akıllı Hücre Algılama Sistemi (Cell Detection):** Dolap içi paneller arasındaki kapalı hacimler otomatik algılanır; eklenen raf, dikme, çekmece ve kapaklar hücre sınırlarına milimetrik oturur.
- **Mıknatıs (Snap) & Çakışma Önleme (Collision Detection):** Zemin (Y=0), duvarlar ve komşu dolaplara otomatik kenetlenme. Nesnelerin birbirinin içinden geçmesi engellenir.
- **SketchUp Benzeri Gruplama:** Parçaları gruplama, çözme ve akıllı grup önerisi: *"Bu parçalar aynı dolaba ait görünüyor. Grup oluşturulsun mu?"*.
- **Dokunmatik Numerik Klavye:** Mobil cihazlar için özel sayısal tuş takımı ve belirgin "OK / ONAYLA" onay butonu.
- **Malzeme & Maliyet Analizi:** MDFLAM, MDF, Suntalam, Kontrplak, Masif Ahşap ve Lake malzemeleri için plaka maliyeti, PVC kenar bantı, aksesuarlar ve kar marjı hesaplama.
- **Ebatlama & CNC Optimizasyonu:**
  - Parçaların 2800x2100mm ham levhalara en az zaiyatla yerleştirildiği 2D görsel nesting yerleşim planı.
  - Kesim listesi, testere payı (kerf) ve zaiyat oranı hesabı.
  - CNC G-Code (.nc) ve AutoCAD DXF (.dxf) üretimi.
- **Kalıcı Kayıt & Dışa Aktarma:** LocalStorage ile otomatik kayıt, `.dolap` JSON proje dışa aktarımı ve 3D PNG ekran görüntüsü.

## 🛠️ Kullanılan Teknolojiler

- **React 18** & **TypeScript**
- **Three.js** (WebGL 3D Engine & OrbitControls)
- **Tailwind CSS** (Mimari CAD Arayüz Tasarımı)
- **Lucide Icons** (Vektörel CAD İkon Seti)
- **Vite** (Hızlı derleme ve geliştirme)

## 💻 Yerel Geliştirme (Local Setup)

```bash
# Bağımlılıkları yükleyin
npm install

# Geliştirme sunucusunu başlatın
npm run dev
```

## 📱 iPhone'da Yerel Çalıştırma

Uygulama üretim derlemesinde PWA olarak paketlenir ve verileri cihazdaki `localStorage` alanında saklar. iPhone'a kurmak için bilgisayarınızı ve iPhone'u aynı Wi-Fi ağına bağlayın, ardından proje klasöründe:

```bash
npm run serve:iphone
```

Terminalde gösterilen `http://192.168.x.x:8889` adresini iPhone Safari'de açın. Safari paylaş menüsünden **Ana Ekrana Ekle** seçeneğiyle kurduktan sonra uygulama, ilk açılışın ardından ağ bağlantısı olmadan da açılabilir. Windows Güvenlik Duvarı sorarsa 8889 portuna özel ağlarda izin verin.

`server.mjs`, yalnızca Node.js'in yerleşik modüllerini kullanır; ek sunucu paketi gerektirmez. Sunucu bilgisayarda çalışır, iPhone ise arayüzü ve CAD motorunu yerel tarayıcı/PWA olarak çalıştırır.
