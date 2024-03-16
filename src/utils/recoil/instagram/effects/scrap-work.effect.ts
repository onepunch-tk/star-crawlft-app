import { AtomEffect } from "recoil";
import { ScrapWorkInfo } from "../atoms";
import {
  MarkImgCount,
  MarkStatus,
  ScrapField,
  TextStatus,
} from "../../../ipc/handlers/instagram/interface";

export const initializeScrapFields = (): ScrapField[] => {
  const fields: ScrapField[] = [];
  for (let i = 0; i < 10; i++) {
    fields.push({
      id: i + 1,
      feedUri: "",
      dirName: "",
      mark: MarkStatus.NONE, // 'InitialMarkStatus'를 적절한 MarkStatus 값으로 대체하세요.
      markCount: MarkImgCount.FIRST,
      textStatus: TextStatus.NONE,
    });
  }
  return fields;
};

export const scrapWorkEffect: AtomEffect<ScrapWorkInfo> = ({ setSelf }) => {
  setSelf({
    isWorking: false,
    scrapWorkList: initializeScrapFields(),
  });
};
