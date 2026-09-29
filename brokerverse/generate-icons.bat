@echo off
echo Creating PWA icons from your logo...

REM Make sure you have ImageMagick installed
REM Download from: https://imagemagick.org/script/download.php#windows

REM Replace "your-logo.png" with the actual path to your logo file
set LOGO_FILE=your-logo.png

if not exist "%LOGO_FILE%" (
    echo Error: Logo file not found. Please update the LOGO_FILE variable in this script.
    pause
    exit /b 1
)

echo Creating icon-192.png...
magick "%LOGO_FILE%" -resize 192x192 "public\icon-192.png"

echo Creating icon-512.png...
magick "%LOGO_FILE%" -resize 512x512 "public\icon-512.png"

echo Creating icon-180.png...
magick "%LOGO_FILE%" -resize 180x180 "public\icon-180.png"

echo Creating icon-152.png...
magick "%LOGO_FILE%" -resize 152x152 "public\icon-152.png"

echo Creating icon-120.png...
magick "%LOGO_FILE%" -resize 120x120 "public\icon-120.png"

echo Creating icon-76.png...
magick "%LOGO_FILE%" -resize 76x76 "public\icon-76.png"

echo Creating icon-60.png...
magick "%LOGO_FILE%" -resize 60x60 "public\icon-60.png"

echo All icons created successfully!
echo Please place your logo file in the project root and update the LOGO_FILE variable in this script.
pause
