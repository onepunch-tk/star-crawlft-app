import { app, BrowserWindow, ipcMain } from "electron";
import path from "path";
import { initializeDatabase } from "./db";
import {
  getSignedInUser,
  getSignedInUserById,
  instagramSignIn,
  scrapFeed,
} from "./utils/ipc/handlers/instagram";
import {
  CHANNEL_INSTAGRAM_GET_USER_BY_ID,
  CHANNEL_INSTAGRAM_SCRAP,
  CHANNEL_INSTAGRAM_SIGNED_IN_USER,
  CHANNEL_INSTAGRAM_SIGNIN,
  OPEN_DIALOG,
} from "./utils/ipc/ipc.constant";
import { openDialog } from "./utils/ipc/handlers/common.handle";

// Handle creating/removing shortcuts on Windows when installing/uninstalling.
if (require("electron-squirrel-startup")) {
  app.quit();
}

export let mainWindow: BrowserWindow;

const createWindow = async () => {
  await initializeDatabase();
  // Create the browser window.
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 1280,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
    },
  });

  // and load the index.html of the app.
  if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
    await mainWindow.loadURL(MAIN_WINDOW_VITE_DEV_SERVER_URL);
    // Open the DevTools.
    mainWindow.webContents.openDevTools();
  } else {
    await mainWindow.loadFile(
      path.join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`),
      { hash: "/" }
    );
  }
};

app.on("ready", createWindow);

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("activate", () => {
  // On OS X it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

ipcMain.handle(CHANNEL_INSTAGRAM_SIGNIN, instagramSignIn);
ipcMain.handle(CHANNEL_INSTAGRAM_SCRAP, scrapFeed);
ipcMain.handle(CHANNEL_INSTAGRAM_SIGNED_IN_USER, getSignedInUser);
ipcMain.handle(CHANNEL_INSTAGRAM_GET_USER_BY_ID, getSignedInUserById);
ipcMain.handle(OPEN_DIALOG, openDialog);
