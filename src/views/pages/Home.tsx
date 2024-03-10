import { API_STAR_CRAWLFT } from "../../utils/ipc/ipc.constant";
import { FormEvent, useRef, useState } from "react";
import { cls } from "../../utils/helpers";
import {
  MarkStatus,
  ScrapInput,
} from "../../utils/ipc/handlers/instagram/interface";
import { useRecoilValue, useSetRecoilState } from "recoil";
import { signedInUserState } from "../../utils/recoil/instagram/atoms";
import { Loading } from "../components/Loding";
import { loadingMessageState } from "../../utils/recoil/loading-message/atoms";

// 입력 필드의 타입 정의
interface InputField {
  id: number;
  feedUri: string;
  dirName?: string;
  mark: MarkStatus;
}
interface InputContainerProps {
  input: InputField;
  onInputChange: (
    id: number,
    field: keyof InputField,
    value: string | MarkStatus
  ) => void;
  onRemove: (id: number) => void;
}
function InputContainer({
  input,
  onInputChange,
  onRemove,
}: InputContainerProps) {
  const handleFieldChange = (
    e: React.ChangeEvent<HTMLInputElement>,
    field: keyof InputField
  ) => {
    onInputChange(input.id, field, e.target.value);
  };

  const getStatusName = (status: MarkStatus) => {
    switch (status) {
      case MarkStatus.AD:
        return "광고";
      case MarkStatus.ORIGIN:
        return "계정";
      case MarkStatus.RE_GRAM:
        return "리그램";
      case MarkStatus.SPONSOR:
        return "협찬";
      case MarkStatus.NONE:
        return "none";
    }
  };

  return (
    <div
      key={input.id}
      className={cls(
        "flex w-[30rem] flex-col space-y-5 rounded-lg bg-neutral-700 p-5 shadow-lg shadow-neutral-900"
      )}
    >
      <div className={"flex"}>
        <label>url :</label>
        <input
          type="text"
          value={input.feedUri}
          className={cls(
            "ml-2 flex-1 border-b border-orange-400 bg-neutral-700"
          )}
          onChange={(e) => handleFieldChange(e, "feedUri")}
        />
      </div>
      <div className={"flex"}>
        <label>dir :</label>
        <input
          type="text"
          value={input.dirName || ""}
          className={cls(
            "ml-2 flex-1 border-b border-orange-400 bg-neutral-700"
          )}
          onChange={(e) => handleFieldChange(e, "dirName")}
        />
      </div>

      <div className={cls("flex justify-around")}>
        {Object.values(MarkStatus).map((status) => (
          <label key={status}>
            <input
              type="radio"
              name={`markStatus-${input.id}`}
              value={status}
              checked={input.mark === status}
              onChange={(e) => handleFieldChange(e, "mark")}
            />
            {getStatusName(status)}
          </label>
        ))}
      </div>
      <button
        type="button"
        className={cls(
          "rounded-lg bg-red-700 font-bold shadow-lg shadow-neutral-900 transition-[transform] duration-300 hover:scale-110"
        )}
        onClick={() => onRemove(input.id)}
      >
        제거
      </button>
    </div>
  );
}

export function Home() {
  const [rootDir, setRootDir] = useState<string>("");
  // 타입스크립트를 사용하여 상태의 타입 지정
  const [inputs, setInputs] = useState<InputField[]>([
    { feedUri: "", dirName: "", id: Date.now(), mark: MarkStatus.NONE },
  ]);
  const [isWorking, setIsWorking] = useState(false);
  const setLodingMessage = useSetRecoilState(loadingMessageState);
  const signedInUser = useRecoilValue(signedInUserState);
  const endOfFormRef = useRef(null);

  const selectRootDirHandle = async () => {
    const selectDir = await window[API_STAR_CRAWLFT].instagramApi.openDialog();
    setRootDir(selectDir);
  };
  const addInput = (): void => {
    const newInput: InputField = {
      id: Date.now(),
      feedUri: "",
      mark: MarkStatus.NONE,
    };
    setInputs([...inputs, newInput]);

    setTimeout(() => {
      endOfFormRef.current?.scrollIntoView({ behavior: "smooth" });
    }, 100);
  };

  const handleInputChange = (
    id: number,
    field: keyof InputField,
    value: string | MarkStatus
  ): void => {
    const updatedInputs = inputs.map((input) => {
      if (input.id === id) {
        return { ...input, [field]: value };
      }
      return input;
    });
    setInputs(updatedInputs);
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (rootDir === "") {
      return;
    }
    // 제출 로직 구현
    setLodingMessage("작업중...");
    setIsWorking(true);
    const feeds = inputs.filter((input) => {
      return input.feedUri !== "";
    });
    const scrapInput: ScrapInput = {
      rootDir,
      feeds,
      signedId: signedInUser.userId,
    };
    await window[API_STAR_CRAWLFT].instagramApi.scrapFeed(scrapInput);
    setIsWorking(false);
  };

  const removeInput = (id: number): void => {
    if (inputs.length === 1) {
      return;
    }
    setInputs(inputs.filter((input) => input.id !== id));
  };

  if (isWorking) {
    return <Loading />;
  }

  return (
    <main
      className={cls(
        "flex h-[100vh] flex-col items-center overflow-x-hidden overflow-y-visible pt-20"
      )}
    >
      <div className={cls("mb-5 flex w-[100vw] justify-center")}>
        <div className={cls("mr-5 w-96 border-b border-orange-400")}>
          <span>{rootDir}</span>
        </div>
        <button
          onClick={selectRootDirHandle}
          className={
            "rounded-lg bg-orange-400 px-5 text-neutral-900 shadow-lg font-bold shadow-neutral-900 hover:scale-110 transition-[transform] duration-300"
          }
        >
          저장 폴더
        </button>
      </div>
      <form
        onSubmit={handleSubmit}
        className={cls(
          "flex flex-col items-center justify-center space-y-5 p-10"
        )}
      >
        {inputs.map((input) => (
          <InputContainer
            key={input.id}
            input={input}
            onInputChange={handleInputChange}
            onRemove={removeInput}
          />
        ))}
        <div ref={endOfFormRef}></div> {/* 스크롤 이동 대상 */}
        <div className={cls("flex w-44 justify-between")}>
          <button
            className={cls(
              "rounded-lg bg-green-800 px-5 py-2 font-bold shadow-lg shadow-neutral-900 transition-[transform] duration-300 hover:scale-110"
            )}
            type="button"
            onClick={addInput}
          >
            추가
          </button>
          <button
            className={cls(
              "rounded-lg bg-blue-700 px-5 py-2 font-bold shadow-lg shadow-neutral-900 transition-[transform] duration-300 hover:scale-110"
            )}
            type="submit"
          >
            시작
          </button>
        </div>
      </form>
    </main>
  );
}
