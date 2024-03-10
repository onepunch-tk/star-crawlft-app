export interface CommonResponse {
  ok: boolean;
  error?: string;
}

export interface SignInInput {
  currentUserId?: number;
  username: string;
  password: string;
}

export enum MarkStatus {
  RE_GRAM = "reGram",
  AD = "ad",
  ORIGIN = "origin",
  SPONSOR = "sponsor",
  NONE = "none",
}

export interface FeedInfo {
  dirName?: string;
  feedUri: string;
  mark: MarkStatus;
}
export interface ScrapInput {
  rootDir: string;
  signedId: number;
  feeds: FeedInfo[];
}

export interface SignInResponse extends CommonResponse {
  userId?: number;
  username?: string;
}
