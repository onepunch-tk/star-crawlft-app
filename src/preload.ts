// See the Electron documentation for details on how to use preload scripts:
// https://www.electronjs.org/docs/latest/tutorial/process-model#preload-scripts

import { contextBridge, ipcRenderer } from "electron";
import {
  API_STAR_CRAWLFT,
  CHANNEL_INSTAGRAM_SCRAP,
  CHANNEL_INSTAGRAM_SCRAP_RESULT,
  CHANNEL_INSTAGRAM_SIGNED_IN_USER,
  CHANNEL_INSTAGRAM_SIGNIN,
  OPEN_DIALOG,
} from "./utils/ipc/ipc.constant";
import {
  ScrapInfo,
  ScrapResult,
  SignInInput,
  SignInResponse,
} from "./utils/ipc/handlers/instagram/interface";
import { User } from "./db/models/user.model";

contextBridge.exposeInMainWorld(API_STAR_CRAWLFT, {
  instagramApi: {
    signIn: (signInInput: SignInInput): Promise<SignInResponse> =>
      ipcRenderer.invoke(CHANNEL_INSTAGRAM_SIGNIN, signInInput),
    // scrapFeed: (scrapInput: ScrapInfo): Promise<void> =>
    //   ipcRenderer.invoke(CHANNEL_INSTAGRAM_SCRAP),
    scrapFeed: (scrapInput: ScrapInfo): Promise<void> =>
      ipcRenderer.invoke(CHANNEL_INSTAGRAM_SCRAP, scrapInput),
    openDialog: (): Promise<string> => ipcRenderer.invoke(OPEN_DIALOG),
    getSignedInUser: (): Promise<User | null> =>
      ipcRenderer.invoke(CHANNEL_INSTAGRAM_SIGNED_IN_USER),
    getSignedInUserById: (): Promise<User | null> =>
      ipcRenderer.invoke(CHANNEL_INSTAGRAM_SIGNED_IN_USER),
    onScrapResult: (callback: (scrapResult: ScrapResult) => void) =>
      ipcRenderer.on(CHANNEL_INSTAGRAM_SCRAP_RESULT, (_event, value) =>
        callback(value)
      ),
    removeOnScrapResult: () =>
      ipcRenderer.removeAllListeners(CHANNEL_INSTAGRAM_SCRAP_RESULT),
  },
});
