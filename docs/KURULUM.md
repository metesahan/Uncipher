# Uncipher Kurulum Rehberi

Kurulum bir kez yapılır. Sonrasında Uncipher, diğer uygulamalar gibi tek tıkla açılır.

## En kolayı: hazır uygulamayı indir

https://github.com/metesahan/Uncipher/releases/latest adresinden indir:

- **macOS (Apple Silicon):** `Uncipher-macOS.zip` → aç → `Uncipher.app`'i Uygulamalar'a sürükle → çift tıkla.
- **Windows:** `Uncipher-Windows.exe` → çift tıkla.

İlk açılışta uyarı çıkarsa: macOS'ta Sistem Ayarları → Gizlilik ve Güvenlik → **Yine de Aç**; Windows'ta **Ek bilgi → Yine de çalıştır**.

Intel Mac kullanıyorsan ya da uygulamayı kendi bilgisayarında derlemek istiyorsan aşağıdaki tek tık kurulumu kullan.

## macOS

1. GitHub sayfasında **Code → Download ZIP** ile projeyi indirip açın.
2. Klasördeki **Uncipher Kurulum.command** dosyasına çift tıklayın.
3. Terminal penceresi açılır ve her şeyi kendisi yapar: paketleri kurar, `Uncipher.app` uygulamasını oluşturur, Uygulamalar klasörüne koyar ve açar. İlk kurulum internet hızına göre birkaç dakika sürer.
4. Bundan sonra Uncipher'i Launchpad'den veya Uygulamalar klasöründen tek tıkla açın. Kurulum dosyasına bir daha gerek yok.

**"Açılamıyor / geliştirici doğrulanamadı" uyarısı çıkarsa:**
Sistem Ayarları → Gizlilik ve Güvenlik → en altta "Uncipher Kurulum.command engellendi" satırındaki **Yine de Aç** düğmesine basın.
Ya da Terminal'e şu satırı yapıştırıp Enter'a basın:

```
bash ~/Downloads/Uncipher-main/"Uncipher Kurulum.command"
```

Notlar:
- macOS'un kendi Python'u (3.9) yeterlidir; kurulum dosyası onunla uyumlu paket sürümlerini seçer. Python hiç yoksa kurulum dosyası indirme sayfasını açar.
- Kurulum günlüğü: `~/Library/Application Support/Uncipher/kurulum.log`

## Windows

1. GitHub sayfasında **Code → Download ZIP** ile projeyi indirin, sağ tıklayıp **Tümünü ayıkla** deyin.
2. Python yüklü değilse https://www.python.org/downloads/windows/ adresinden kurun ve kurulum ekranında **"Add python.exe to PATH"** kutusunu işaretleyin.
3. Klasördeki **Uncipher Kurulum.bat** dosyasına çift tıklayın. ("Windows bilgisayarınızı korudu" uyarısı çıkarsa **Ek bilgi → Yine de çalıştır**.)
4. Kurulum bitince Masaüstünde **Uncipher.exe** oluşur ve açılır. Sonraki her seferde ona çift tıklamanız yeterli.

## Elle derleme (isteğe bağlı)

```
pip install -r requirements.txt
pyinstaller --noconfirm --windowed --name Uncipher --add-data "ui:ui" main.py            # macOS → dist/Uncipher.app
pyinstaller --noconfirm --onefile --windowed --name Uncipher --add-data "ui;ui" main.py  # Windows → dist\Uncipher.exe
```
