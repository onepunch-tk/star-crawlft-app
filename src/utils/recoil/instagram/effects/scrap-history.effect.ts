// 로컬 스토리지를 다루는 effect 함수
import { AtomEffect } from "recoil";
import { ScrapHistory } from "../atoms";

export const localStorageEffect: AtomEffect<ScrapHistory[] | []> = ({
  setSelf,
  onSet,
}) => {
  // 컴포넌트가 마운트될 때 실행
  setSelf(() => {
    const savedValue = localStorage.getItem("scrapResults");
    if (savedValue != null) {
      return JSON.parse(savedValue) as ScrapHistory[];
    }
    return []; // 로컬 스토리지에 값이 없으면 빈 배열을 반환
  });

  // atom 값이 변경될 때마다 실행
  onSet((newState) => {
    localStorage.setItem("scrapResults", JSON.stringify(newState));
  });
};
