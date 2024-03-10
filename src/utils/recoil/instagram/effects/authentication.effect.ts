import { AtomEffect } from "recoil";
import { SignedInUser } from "../atoms";
import { API_STAR_CRAWLFT } from "../../../ipc/ipc.constant";

export const authenticationEffect: AtomEffect<SignedInUser | null> = ({
  setSelf,
}) => {
  const fetchAndSetUser = async () => {
    try {
      const user = await window[
        API_STAR_CRAWLFT
      ].instagramApi.getSignedInUser();
      if (user) {
        const { username, id: userId } = user.dataValues;
        setSelf({ username, userId }); // 비동기 호출 결과를 사용해 상태를 설정합니다.
      } else {
        // 사용자 정보가 없는 경우의 처리
        console.log("No signed-in user found");
      }
    } catch (error) {
      console.error("Error fetching user", error);
      // 에러 처리 로직
    }
  };

  fetchAndSetUser(); // 비동기 함수를 즉시 호출합니다.
};
