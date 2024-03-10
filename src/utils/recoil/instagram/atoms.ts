import { atom } from "recoil";
import { authenticationEffect } from "./effects/authentication.effect";

export interface SignedInUser {
  userId: number;
  username: string;
}
export const signedInUserState = atom<SignedInUser | null>({
  key: "signedInUserState",
  default: null,
  effects: [authenticationEffect],
});
