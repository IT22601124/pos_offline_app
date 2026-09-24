const { app, BrowserWindow } = require("electron");
const path = require("path");

let mainWindow;
const isDev = !app.isPackaged;
const devServerUrl = process.env.ELECTRON_START_URL || "https://mpos.studiorespectweddings.com";
const distIndexPath = path.join(__dirname, "../dist/index.html");

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1200,
        height: 800,
        minWidth: 900,
        minHeight: 600,

        webPreferences: {
            contextIsolation: true,
            nodeIntegration: false
        }
    });

    if (isDev) {
        mainWindow.loadURL(devServerUrl).catch(() => {
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