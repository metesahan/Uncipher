#!/bin/bash
# Uncipher - macOS tek tık kurulum
# Çift tıklayın: gerekli paketleri kurar, Uncipher.app'i oluşturur, Uygulamalar klasörüne koyar ve açar.

cd "$(dirname "$0")" || exit 1
SRC="$(pwd)"
SUPPORT="$HOME/Library/Application Support/Uncipher"
VENV="$SUPPORT/venv"
WORK="$SUPPORT/build"
LOG="$SUPPORT/kurulum.log"
mkdir -p "$SUPPORT"
: > "$LOG"
exec > >(tee -a "$LOG") 2>&1

fail() {
  echo ""
  echo "HATA: $1"
  echo "Ayrıntılar: $LOG"
  osascript -e "display dialog \"Uncipher kurulamadı: $1\n\nAyrıntılar: kurulum.log\" buttons {\"Tamam\"} default button 1 with icon stop with title \"Uncipher\"" >/dev/null 2>&1
  exit 1
}

echo "== Uncipher kurulumu =="

# 1) Python bul (önce 3.10+, yoksa macOS'un yerleşik python3'ü)
PY=""
for c in \
  /Library/Frameworks/Python.framework/Versions/Current/bin/python3 \
  /opt/homebrew/bin/python3 /usr/local/bin/python3 \
  python3.13 python3.12 python3.11 python3.10 python3; do
  if command -v "$c" >/dev/null 2>&1 && "$c" -c 'import sys; sys.exit(0 if sys.version_info >= (3, 9) else 1)' 2>/dev/null; then
    PY="$(command -v "$c")"; break
  fi
done
if [ -z "$PY" ]; then
  osascript -e 'display dialog "Python bulunamadı. Açılan sayfadan Python yükleyicisini indirip kurun, sonra bu dosyayı tekrar çift tıklayın." buttons {"Tamam"} default button 1 with title "Uncipher"' >/dev/null 2>&1
  open "https://www.python.org/downloads/macos/"
  exit 1
fi
echo "Python: $PY ($("$PY" -V 2>&1))"

# 2) Uygulamaya özel sanal ortam
echo "-- Sanal ortam hazırlanıyor"
rm -rf "$VENV"
"$PY" -m venv "$VENV" || fail "Sanal ortam oluşturulamadı."
VPY="$VENV/bin/python"

echo "-- pip güncelleniyor"
"$VPY" -m pip install --upgrade pip setuptools wheel || fail "pip güncellenemedi (internet bağlantısını kontrol edin)."

echo "-- Paketler kuruluyor"
"$VPY" -m pip install --prefer-binary -r "$SRC/requirements.txt" || fail "Paketler kurulamadı."
"$VPY" -c "import webview" || fail "pywebview yüklenemedi."

# 3) Simge
ICNS=""
if [ -f "$SRC/assets/icon.png" ] && command -v iconutil >/dev/null 2>&1; then
  ICONSET="$WORK/Uncipher.iconset"
  rm -rf "$ICONSET"; mkdir -p "$ICONSET"
  for s in 16 32 128 256 512; do
    sips -z $s $s "$SRC/assets/icon.png" --out "$ICONSET/icon_${s}x${s}.png" >/dev/null 2>&1
    d=$((s * 2))
    sips -z $d $d "$SRC/assets/icon.png" --out "$ICONSET/icon_${s}x${s}@2x.png" >/dev/null 2>&1
  done
  iconutil -c icns "$ICONSET" -o "$WORK/Uncipher.icns" 2>/dev/null && ICNS="$WORK/Uncipher.icns"
fi

# 4) Uncipher.app oluştur
echo "-- Uncipher.app oluşturuluyor"
rm -rf "$WORK/dist" "$WORK/pyi"
ICON_ARG=()
[ -n "$ICNS" ] && ICON_ARG=(--icon "$ICNS")
if "$VPY" -m PyInstaller --noconfirm --clean --windowed --name Uncipher "${ICON_ARG[@]}" \
     --add-data "$SRC/ui:ui" --osx-bundle-identifier com.metesahan.uncipher \
     --distpath "$WORK/dist" --workpath "$WORK/pyi" --specpath "$WORK" \
     "$SRC/main.py" && [ -d "$WORK/dist/Uncipher.app" ]; then
  BUILT="$WORK/dist/Uncipher.app"
else
  echo "-- PyInstaller paketi oluşturamadı; doğrudan başlatıcı uygulama hazırlanıyor"
  BUILT="$WORK/dist/Uncipher.app"
  rm -rf "$BUILT"
  mkdir -p "$BUILT/Contents/MacOS" "$BUILT/Contents/Resources"
  cp "$SRC/main.py" "$BUILT/Contents/Resources/"
  cp -R "$SRC/ui" "$BUILT/Contents/Resources/ui"
  [ -n "$ICNS" ] && cp "$ICNS" "$BUILT/Contents/Resources/Uncipher.icns"
  cat > "$BUILT/Contents/MacOS/Uncipher" <<EOF
#!/bin/bash
DIR="\$(cd "\$(dirname "\$0")/../Resources" && pwd)"
exec "$VPY" "\$DIR/main.py"
EOF
  chmod +x "$BUILT/Contents/MacOS/Uncipher"
  cat > "$BUILT/Contents/Info.plist" <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
  <key>CFBundleName</key><string>Uncipher</string>
  <key>CFBundleDisplayName</key><string>Uncipher</string>
  <key>CFBundleIdentifier</key><string>com.metesahan.uncipher</string>
  <key>CFBundleExecutable</key><string>Uncipher</string>
  <key>CFBundleIconFile</key><string>Uncipher</string>
  <key>CFBundlePackageType</key><string>APPL</string>
  <key>CFBundleShortVersionString</key><string>1.0</string>
  <key>NSHighResolutionCapable</key><true/>
</dict></plist>
EOF
fi

# 5) Uygulamalar klasörüne taşı ve aç
if [ -w /Applications ]; then DEST="/Applications"; else DEST="$HOME/Applications"; mkdir -p "$DEST"; fi
rm -rf "$DEST/Uncipher.app"
cp -R "$BUILT" "$DEST/Uncipher.app" || fail "Uygulama $DEST klasörüne kopyalanamadı."
xattr -cr "$DEST/Uncipher.app" 2>/dev/null

echo ""
echo "Kurulum tamamlandı: $DEST/Uncipher.app"
echo "Bundan sonra Uncipher'i Launchpad'den ya da Uygulamalar klasöründen tek tıkla açabilirsiniz."
open "$DEST/Uncipher.app"
