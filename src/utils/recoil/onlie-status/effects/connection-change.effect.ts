import { AtomEffect } from "recoil";
import notification from "../../../notification.util";

export const connectionChangeEffect: AtomEffect<boolean> = ({ setSelf }) => {
  notification.setup();
  setSelf(navigator.onLine);

  addEventListener("online", () => {
    setSelf(true);
    notification.show("연결 상태 :", "정상 연결 확인!");
  });
  addEventListener("offline", () => {
    setSelf(false);
    notification.show("연결 상태 :", "상태 확인 바람.");
  });
};
