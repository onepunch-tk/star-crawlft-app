import React, { useEffect } from "react";
import { createHashRouter, Outlet, useNavigate } from "react-router-dom";
import { signedInUserState } from "../../utils/recoil/instagram/atoms";
import { useRecoilValue } from "recoil";
import { SignIn } from "./SignIn";
import { Home } from "./Home";
import { Navbar } from "../components/Navbar";
import { History } from "./History";

export enum Path {
  SIGN_IN = "sign-in",
  HOME = "home",
  HISTORY = "history",
}
export const router = createHashRouter([
  {
    path: "",
    element: <Root />,
    children: [
      {
        path: Path.SIGN_IN,
        element: <SignIn />,
      },
      {
        path: Path.HOME,
        element: <Home />,
      },
      {
        path: Path.HISTORY,
        element: <History />,
      },
    ],
  },
]);

export function Root() {
  const signedInUser = useRecoilValue(signedInUserState);
  const navigate = useNavigate();

  useEffect(() => {
    // 사용자가 로그인했으면 홈으로, 아니면 로그인 페이지로 리다이렉트
    console.log(signedInUser);
    if (signedInUser) {
      navigate(Path.HOME);
    } else {
      navigate(Path.SIGN_IN);
    }
  }, [signedInUser]);

  return (
    <React.Fragment>
      <Navbar username={signedInUser ? signedInUser.username : ""} />
      <Outlet />
    </React.Fragment>
  );
}
