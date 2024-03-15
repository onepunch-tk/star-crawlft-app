import { atom } from "recoil";
import { authenticationEffect } from "./effects/authentication.effect";
import {
  ScrapField,
  ScrapResult,
} from "../../ipc/handlers/instagram/interface";
import { scrapWorkEffect } from "./effects/scrap-work.effect";
import { localStorageEffect } from "./effects/scrap-history.effect";

export interface SignedInUser {
  userId: number;
  username: string;
}

export interface ScrapWorkInfo {
  isWorking: boolean;
  scrapWorkList: ScrapField[];
}

export interface ScrapHistory {
  key: string;
  result: ScrapResult[];
}

export const signedInUserState = atom<SignedInUser | null>({
  key: "signedInUserState",
  default: null,
  effects: [authenticationEffect],
});

export const scrapWorkingState = atom<ScrapWorkInfo>({
  key: "scrapWorkingState",
  effects: [scrapWorkEffect],
});

// ScrapResult 데이터를 관리하는 atom 정의
export const scrapResultState = atom<ScrapHistory[]>({
  key: "scrapResultState",
  default: [],
  effects: [localStorageEffect],
});
