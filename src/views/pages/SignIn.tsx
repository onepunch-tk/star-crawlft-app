import { cls } from "../../utils/helpers";
import { useState } from "react";
import { API_STAR_CRAWLFT } from "../../utils/ipc/ipc.constant";
import { useRecoilState, useSetRecoilState } from "recoil";
import {
  signedInUserState,
  signInWorkState,
} from "../../utils/recoil/instagram/atoms";
import { useNavigate } from "react-router-dom";
import { Path } from "./Root";
import { loadingMessageState } from "../../utils/recoil/loading-message/atoms";
import { Loading } from "../components/Loding";

export function SignIn() {
  // 상태 초기화
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [signedUser, setSignedIn] = useRecoilState(signedInUserState);
  const [signInWorking, setSignInWorking] = useRecoilState(signInWorkState);
  const setLodingMessage = useSetRecoilState(loadingMessageState);
  const navigate = useNavigate();

  // 이벤트 핸들러: username 입력 필드 업데이트
  const handleUsernameChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setUsername(event.target.value);
  };

  // 이벤트 핸들러: password 입력 필드 업데이트
  const handlePasswordChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setPassword(event.target.value);
  };

  // 이벤트 핸들러: 폼 제출
  const signInHandle = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLodingMessage("로그인 중...");
    setSignInWorking(true);
    if (!username || !password) {
      return;
    }
    // 예: 로그인 API 호출
    const result = await window[
      API_STAR_CRAWLFT
    ].instagramApi.signIn({
      username,
      password,
      currentUserId: signedUser ? signedUser.userId : undefined,
    });
    console.log(result);
    if (result.ok) {
      const authUser = await window[
        API_STAR_CRAWLFT
      ].instagramApi.getSignedInUserById(result.userId);
      if (authUser) {
        const { username, id } = authUser.dataValues;
        setSignedIn({ username, userId: id });
        navigate(Path.HOME);
      }
      console.log("authUser:", authUser);
    }

    setSignInWorking(false);
  };

  if (signInWorking) {
    return <Loading />;
  }

  return (
    <main className={cls("flex h-screen items-center justify-center pt-14")}>
      <form
        onSubmit={signInHandle}
        className={cls(
          "flex flex-col items-center justify-center space-y-10 border-[0.5px] border-orange-400 p-20 shadow-md shadow-neutral-900"
        )}
      >
        <div>
          <label>
            <label className={"mr-0.5 text-red-700"}>*</label>username :
          </label>
          <input
            type={"text"}
            value={username}
            onChange={handleUsernameChange}
            className={cls("ml-2 border-b border-orange-400 bg-neutral-800")}
          />
        </div>
        <div>
          <label>
            <label className={"mr-0.5 text-red-700"}>*</label>
            password :
          </label>
          <input
            type={"password"}
            value={password}
            onChange={handlePasswordChange}
            className={cls("ml-2 border-b border-orange-400 bg-neutral-800")}
          />
        </div>
        <button
          type={"submit"}
          className={cls(
            "w-full rounded-lg bg-orange-400 p-2 font-semibold text-neutral-900 transition-[transform] duration-300 hover:scale-110"
          )}
        >
          Sign In
        </button>
      </form>
    </main>
  );
}
