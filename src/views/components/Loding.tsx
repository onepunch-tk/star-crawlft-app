import { cls } from "../../utils/helpers";
import { useRecoilValue } from "recoil";
import { loadingMessageState } from "../../utils/recoil/loading-message/atoms";
import { Spinner } from "./Spinner";

export function Loading() {
  const message = useRecoilValue(loadingMessageState);
  return (
    <main className="fixed flex justify-center items-center top-0 w-full h-full bg-opacity-60">
      <section
        className={cls(
          "shadow-box flex min-w-[350px] max-w-fit flex-col items-center justify-center gap-y-6 rounded-xl bg-neutral-400 p-10"
        )}
      >
        <Spinner />
        <span className="loading-message text-neutral-900 font-bold">
          {message}
        </span>
      </section>
    </main>
  );
}
