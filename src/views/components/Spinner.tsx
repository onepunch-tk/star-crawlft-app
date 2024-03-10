import { cls } from "../../utils/helpers";

export function Spinner() {
  return (
    <div
      className={cls(
        "inline-block size-20 animate-spin rounded-full border-4 border-solid border-teal-600 border-r-transparent align-[-0.125em] motion-reduce:animate-[spin_1.5s_linear_infinite]"
      )}
    ></div>
  );
}
