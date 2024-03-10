import { Permission, ResourceType } from "puppeteer";

export type UserDataDirType = "insta" | "ytb" | "coupang" | "naver";

export type BrowserProps = {
  dirPrefix?: UserDataDirType;
  username?: string;
  blockResources: ResourceType[];
  permission?: {
    origin: string;
    permissions: Permission[];
  };
};
