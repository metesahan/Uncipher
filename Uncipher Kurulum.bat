@echo off
rem Uncipher - Windows tek tik kurulum
rem Cift tiklayin: paketleri kurar, Uncipher.exe'yi olusturur, Masaustune koyar ve acar.
chcp 65001 >nul
setlocal
cd /d "%~dp0"
set "SRC=%CD%"
set "APPDIR=%LOCALAPPDATA%\Uncipher"
set "VENV=%APPDIR%\venv"
set "WORK=%APPDIR%\build"
if not exist "%APPDIR%" mkdir "%APPDIR%"

echo == Uncipher kurulumu ==

set "PY="
py -3 -c "import sys" >nul 2>nul && set "PY=py -3"
if not defined PY python -c "import sys" >nul 2>nul && set "PY=python"
if not defined PY (
  echo Python bulunamadi. Acilan sayfadan Python'u kurun ^(Add python.exe to PATH kutusunu isaretleyin^), sonra bu dosyayi tekrar calistirin.
  start "" "https://www.python.org/downloads/windows/"
  pause
  exit /b 1
)

echo -- Sanal ortam hazirlaniyor
if exist "%VENV%" rmdir /s /q "%VENV%"
%PY% -m venv "%VENV%" || goto fail
set "VPY=%VENV%\Scripts\python.exe"

echo -- pip guncelleniyor
"%VPY%" -m pip install --upgrade pip setuptools wheel || goto fail

echo -- Paketler kuruluyor
"%VPY%" -m pip install --prefer-binary -r "%SRC%\requirements.txt" || goto fail

echo -- Uncipher.exe olusturuluyor
"%VPY%" -m PyInstaller --noconfirm --clean --onefile --windowed --name Uncipher --icon "%SRC%\assets\Uncipher.ico" --add-data "%SRC%\ui;ui" --distpath "%WORK%\dist" --workpath "%WORK%\pyi" --specpath "%WORK%" "%SRC%\main.py" || goto fail

for /f "usebackq delims=" %%D in (`powershell -NoProfile -Command "[Environment]::GetFolderPath('Desktop')"`) do set "DESK=%%D"
copy /y "%WORK%\dist\Uncipher.exe" "%DESK%\Uncipher.exe" >nul || goto fail

echo.
echo Kurulum tamamlandi: %DESK%\Uncipher.exe
echo Bundan sonra Masaustundeki Uncipher simgesine cift tiklamaniz yeterli.
start "" "%DESK%\Uncipher.exe"
timeout /t 4 >nul
exit /b 0

:fail
echo.
echo HATA: Kurulum tamamlanamadi. Yukaridaki mesajlari kontrol edin.
pause
exit /b 1
