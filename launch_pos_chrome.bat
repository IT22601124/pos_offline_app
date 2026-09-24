@echo off
echo Starting NOVA POS in Silent Kiosk Printing Mode...
taskkill /F /IM chrome.exe >nul 2>&1
timeout /t 1 >nul
start "" "C:\Program Files\Google\Chrome\Application\chrome.exe" --kiosk-printing "https://mpos.studiorespectweddings.com/pos"
exit
