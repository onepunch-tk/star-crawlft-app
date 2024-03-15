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

export enum ScrapStatus {
  SUCCESS = "SUCCESS",
  FAILURE = "FAILURE",
}

export interface ScrapField {
  id: number;
  feedUri: string;
  dirName?: string;
  mark: MarkStatus;
  message?: string;
}
export interface ScrapInfo {
  rootDir: string;
  key: string;
  signedId: number;
  scrapFields: ScrapField[];
}

export interface SignInResponse extends CommonResponse {
  userId?: number;
  username?: string;
}

export interface ScrapResult {
  id: number;
  key: string;
  status: ScrapStatus;
  message: string;
}
