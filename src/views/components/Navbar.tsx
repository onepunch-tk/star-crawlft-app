import { cls } from "../../utils/helpers";
import { useLocation, useNavigate } from "react-router-dom";
import { Path } from "../pages/Root";
import { useRecoilValue } from "recoil";
import {
  scrapWorkingState,
  signInWorkState,
} from "../../utils/recoil/instagram/atoms";

interface NavbarProps {
  username?: string;
}
export function Navbar({ username }: NavbarProps) {
  const currentPathName = useLocation().pathname;
  const scrapWorking = useRecoilValue(scrapWorkingState).isWorking;
  const signInWorking = useRecoilValue(signInWorkState);

  const navigate = useNavigate();
  const navigateHandle = (movePath: Path) => {
    if (scrapWorking || signInWorking) {
      return;
    }

    navigate(movePath);
  };
  return (
    <nav
      className={cls(
        "fixed top-0 z-50 flex h-12 w-full items-center justify-between bg-neutral-800 px-5 shadow-md shadow-neutral-900"
      )}
    >
      <div>
        <div className={cls("flex space-x-8 text-xl text-orange-400")}>
          {username ? (
            <div
              onClick={() => navigateHandle(Path.HOME)}
              className={cls(
                "cursor-pointer font-semibold transition-[transform] duration-300 hover:scale-110",
                currentPathName.includes(Path.HOME) &&
                  "border-b border-orange-400"
              )}
            >
              <span>홈</span>
            </div>
          ) : null}
          <div
            onClick={() => navigateHandle(Path.SIGN_IN)}
            className={cls(
              "cursor-pointer font-semibold transition-[transform] duration-300 hover:scale-110",
              currentPathName.includes(Path.SIGN_IN) &&
                "border-b border-orange-400"
            )}
          >
            <span>{username ? "다른 계정 로그인" : "로그인"}</span>
          </div>
          <div
            onClick={() => navigateHandle(Path.HISTORY)}
            className={cls(
              "cursor-pointer font-semibold transition-[transform] duration-300 hover:scale-110",
              currentPathName.includes(Path.HISTORY) &&
                "border-b border-orange-400"
            )}
          >
            <span>작업 결과</span>
          </div>
        </div>
      </div>
      <div>
        <h1>로그인 계정 : {username ? username : "없음"}</h1>
      </div>
    </nav>
  );
}
