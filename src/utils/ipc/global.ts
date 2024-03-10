import { API_STAR_CRAWLFT } from "./ipc.constant";
import {
  ScrapInput,
  SignInInput,
  SignInResponse,
} from "./handlers/instagram/interface";
import { User } from "../../db/models/user.model";

export {};
declare global {
  interface Window {
    [API_STAR_CRAWLFT]: {
      instagramApi: {
        signIn: (signInInput: SignInInput) => Promise<SignInResponse>;
        // scrapFeed: (scrapInput: ScrapInput) => Promise<void>;
        scrapFeed: (scrapInput: ScrapInput) => Promise<void>;
        openDialog: () => Promise<string>;
        getSignedInUser: () => Promise<User | null>;
        getSignedInUserById: (userId: number) => Promise<User | null>;
      };
    };
  }
}
