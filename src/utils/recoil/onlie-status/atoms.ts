import { atom } from "recoil";
import { connectionChangeEffect } from "./effects/connection-change.effect";

export const onlineState = atom<boolean>({
  key: "onlineState",
  effects: [connectionChangeEffect],
});
