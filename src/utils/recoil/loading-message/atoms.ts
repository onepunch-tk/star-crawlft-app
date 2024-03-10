import { atom } from "recoil";

export const loadingMessageState = atom<string>({
  key: "loadingMessageState",
  default: "Loading...",
});
