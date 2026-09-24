const { app, BrowserWindow } = require("electron");
const path = require("path");

app.setName("NOVA POS");

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
                nodeIntegration: false
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

    app.on("window-all-closed", () => {
        if (process.platform !== "darwin") {
            app.quit();
        }
    });
}