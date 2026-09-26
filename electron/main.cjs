const { app, BrowserWindow, ipcMain } = require("electron");
const path = require("path");

app.setName("NOVA POS");

// Disable GPU hardware acceleration to prevent Windows GPU process crash
app.disableHardwareAcceleration();
app.commandLine.appendSwitch('disable-gpu');
app.commandLine.appendSwitch('disable-software-rasterizer');

// Kiosk printing switch for instant silent printing without print preview dialogs
app.commandLine.appendSwitch('kiosk-printing');

// Request single instance lock to prevent duplicate instances from locking IndexedDB/Quota databases
const gotTheLock = app.requestSingleInstanceLock();

let mainWindow;
const distIndexPath = path.join(__dirname, "../dist/index.html");

if (!gotTheLock) {
    app.quit();
} else {
    app.on('second-instance', () => {
        if (mainWindow) {
            if (mainWindow.isMinimized()) mainWindow.restore();
            mainWindow.focus();
        }
    });

    function createWindow() {
        mainWindow = new BrowserWindow({
            width: 1200,
            height: 800,
            minWidth: 900,
            minHeight: 600,
            icon: path.join(__dirname, "icon.ico"),
            autoHideMenuBar: true,
            webPreferences: {
                contextIsolation: true,
                nodeIntegration: false,
                preload: path.join(__dirname, "preload.cjs")
            }
        });

        if (process.env.ELECTRON_START_URL) {
            mainWindow.loadURL(process.env.ELECTRON_START_URL).catch(() => {
                mainWindow.loadFile(distIndexPath);
            });
        } else {
            mainWindow.loadFile(distIndexPath);
        }
    }

    app.whenReady().then(() => {
        createWindow();

        app.on("activate", () => {
            if (BrowserWindow.getAllWindows().length === 0) {
                createWindow();
            }
        });
    });

    ipcMain.handle('print-silent', async (event, options) => {
        const win = BrowserWindow.fromWebContents(event.sender) || mainWindow;
        try {
            const systemPrinters = win ? await win.webContents.getPrintersAsync() : [];
            let targetPrinter = '';

            if (options?.deviceName) {
                const cleanName = options.deviceName.toLowerCase().trim();
                const match = systemPrinters.find(p => p.name.toLowerCase().includes(cleanName) || cleanName.includes(p.name.toLowerCase()));
                if (match) {
                    targetPrinter = match.name;
                }
            }

            if (!targetPrinter && systemPrinters.length > 0) {
                const thermalKeywords = ['rongta', 'pos', 'thermal', 'receipt', 'rpp', 'epson', 'bixolon', 'star', '80mm', '58mm', 'xp-'];
                const thermalMatch = systemPrinters.find(p => thermalKeywords.some(k => p.name.toLowerCase().includes(k)));
                if (thermalMatch) {
                    targetPrinter = thermalMatch.name;
                } else {
                    const defaultP = systemPrinters.find(p => p.isDefault) || systemPrinters[0];
                    if (defaultP) targetPrinter = defaultP.name;
                }
            }

            console.log(`Printing receipt silently to target printer: "${targetPrinter}"`);

            const requestedPaperWidthMM = Number(options?.paperWidth) || 72;
            const paperWidthMM = requestedPaperWidthMM === 80 ? 72 : requestedPaperWidthMM;

            const printOptions = {
                // This handler is intentionally silent so receipt printing never opens
                // the native Electron print dialog.
                silent: true,
                printBackground: true,
                copies: options?.copies || 1,
                // Override label-driver defaults such as 10 x 10 mm with receipt paper.
                pageSize: {
                    width: Math.round(paperWidthMM * 1000),
                    height: 150000
                },
                margins: {
                    marginType: 'none'
                }
            };

            if (targetPrinter) {
                printOptions.deviceName = targetPrinter;
            }

            if (options?.html && options.html.trim().length > 0) {
                const fullHtml = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>POS Receipt</title>
  <style>
    @page {
      size: auto;
      margin: 0mm;
    }
    html, body {
      margin: 0 !important;
      padding: 0 !important;
      width: ${paperWidthMM}mm !important;
      max-width: ${paperWidthMM}mm !important;
      background: #ffffff !important;
      color: #000000 !important;
      font-family: 'Courier New', Consolas, 'Noto Sans Mono', monospace !important;
      font-size: ${paperWidthMM <= 58 ? '12px' : '13.5px'} !important;
      line-height: 1.3 !important;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
    .no-print { display: none !important; visibility: hidden !important; }
    * { box-sizing: border-box; }
  </style>
</head>
<body style="margin: 0; padding: 0; width: ${paperWidthMM}mm; background: #ffffff; color: #000000;">
  ${options.html}
</body>
</html>`;

                const printWin = new BrowserWindow({
                    show: false,
                    width: Math.round(paperWidthMM * 3.8),
                    height: 800,
                    webPreferences: {
                        nodeIntegration: false,
                        contextIsolation: true
                    }
                });

                await printWin.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(fullHtml));

                // Fit the thermal page to the rendered receipt instead of feeding a
                // fixed-length ticket with unnecessary blank lines at the end.
                const contentHeightPx = await printWin.webContents.executeJavaScript(
                    'Math.max(document.body.scrollHeight, document.documentElement.scrollHeight)'
                );
                const contentHeightMicrons = Math.ceil(Number(contentHeightPx || 0) * 264.583);
                printOptions.pageSize.height = Math.min(
                    300000,
                    Math.max(20000, contentHeightMicrons + 2000)
                );

                return new Promise((resolve) => {
                    printWin.webContents.print(printOptions, (success, failureReason) => {
                        if (!success) {
                            console.warn('Silent offscreen print status:', failureReason);
                        } else {
                            console.log(`Silent offscreen print succeeded to printer: ${targetPrinter} (${paperWidthMM}mm)`);
                        }
                        try { printWin.destroy(); } catch { }
                        resolve(success);
                    });
                });
            }

            if (!win) return false;

            return new Promise((resolve) => {
                win.webContents.print(
                    printOptions,
                    (success, failureReason) => {
                        if (!success) {
                            console.warn('Silent print status:', failureReason);
                        } else {
                            console.log(`Silent print succeeded to printer: ${targetPrinter} (${paperWidthMM}mm)`);
                        }
                        resolve(success);
                    }
                );
            });
        } catch (err) {
            console.error('Error executing silent print:', err);
            return false;
        }
    });

    ipcMain.handle('get-printers', async (event) => {
        const win = BrowserWindow.fromWebContents(event.sender);
        if (win) {
            return await win.webContents.getPrintersAsync();
        }
        return [];
    });

    app.on("window-all-closed", () => {
        if (process.platform !== "darwin") {
            app.quit();
        }
    });
}
