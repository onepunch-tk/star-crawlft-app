import { API_STAR_CRAWLFT } from "../../utils/ipc/ipc.constant";
import {
  FormEvent,
  MutableRefObject,
  useEffect,
  useRef,
  useState,
} from "react";
import { cls } from "../../utils/helpers";
import {
  MarkStatus,
  ScrapField,
  ScrapInfo,
  ScrapResult,
  ScrapStatus,
} from "../../utils/ipc/handlers/instagram/interface";
import { useRecoilState, useRecoilValue, useSetRecoilState } from "recoil";
import {
  scrapResultState,
  scrapWorkingState,
  signedInUserState,
} from "../../utils/recoil/instagram/atoms";
import { Loading } from "../components/Loding";
import { loadingMessageState } from "../../utils/recoil/loading-message/atoms";
import { initializeScrapFields } from "../../utils/recoil/instagram/effects/scrap-work.effect";

interface InputContainerProps {
  scrapField: ScrapField;
  onInputChange: (
    id: number,
    field: keyof ScrapField,
    value: string | MarkStatus
  ) => void;
}

const getScrapWorkingMessage = ({
  current: { totalCount, successCount, failureCount },
}: MutableRefObject<{
  totalCount: number;
  successCount: number;
  failureCount: number;
}>) =>
  `총 작업 수 : ${totalCount}\r\n성공 : ${successCount}\r\n실패 : ${failureCount}`;

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
function InputContainer({ scrapField, onInputChange }: InputContainerProps) {
  const handleFieldChange = (
    e: React.ChangeEvent<HTMLInputElement>,
    field: keyof ScrapField
  ) => {
    onInputChange(scrapField.id, field, e.target.value);
  };

  return (
    <div
      key={scrapField.id}
      className={cls(
        "relative flex w-[30rem] flex-col space-y-5 rounded-lg bg-neutral-700 p-5 shadow-lg shadow-neutral-900"
      )}
    >
      <div
        className={
          "absolute top-2 left-2 flex rounded-full p-3 justify-center items-center bg-green-800 w-[25px] h-[25px]"
        }
      >
        <label className={"text-xs font-bold"}>{scrapField.id}</label>
      </div>
      <div className={"flex"}>
        <label>url :</label>
        <input
          type="text"
          value={scrapField.feedUri}
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
          value={scrapField.dirName || ""}
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
              name={`markStatus-${scrapField.id}`}
              value={status}
              checked={scrapField.mark === status}
              onChange={(e) => handleFieldChange(e, "mark")}
              className={cls("mr-1.5")}
            />
            {getStatusName(status)}
          </label>
        ))}
      </div>
      {/*<button*/}
      {/*  type="button"*/}
      {/*  className={cls(*/}
      {/*    "rounded-lg bg-red-700 font-bold shadow-lg shadow-neutral-900 transition-[transform] duration-300 hover:scale-105"*/}
      {/*  )}*/}
      {/*  onClick={() => onRemove(scrapField.id)}*/}
      {/*>*/}
      {/*  제거*/}
      {/*</button>*/}
    </div>
  );
}

export function Home() {
  const [rootDir, setRootDir] = useState<string>("");
  const [totalMarkStatus, setTotalMarkStatus] = useState<MarkStatus>(
    MarkStatus.NONE
  );
  const setScrapResults = useSetRecoilState(scrapResultState);
  const workingCountRef = useRef<{
    totalCount: number;
    successCount: number;
    failureCount: number;
  }>({ totalCount: 0, successCount: 0, failureCount: 0 });
  // 타입스크립트를 사용하여 상태의 타입 지정
  const [scrapWorkInfo, setScrapWorkInfo] = useRecoilState(scrapWorkingState);
  const setLoadingMessage = useSetRecoilState(loadingMessageState);
  const signedInUser = useRecoilValue(signedInUserState);

  useEffect(() => {
    // 이벤트 리스너 설정
    const onScrapResult = (scrapResult: ScrapResult) => {
      const { status } = scrapResult;
      workingCountRef.current = {
        ...workingCountRef.current,
        ...(status === ScrapStatus.SUCCESS && {
          successCount: ++workingCountRef.current.successCount,
        }),
        ...(status === ScrapStatus.FAILURE && {
          failureCount: ++workingCountRef.current.failureCount,
        }),
      };

      setLoadingMessage(getScrapWorkingMessage(workingCountRef));
      addScrapResult(scrapResult);
    };
    if (scrapWorkInfo.isWorking) {
      window[API_STAR_CRAWLFT].instagramApi.onScrapResult(onScrapResult);
    } else {
      window[API_STAR_CRAWLFT].instagramApi.removeOnScrapResult();
    }

    // Clean-up 함수
    return () => {
      // 여기서 이벤트 리스너를 제거합니다. API 문서를 참조하여 적절한 메서드를 사용하세요.
      console.log("clean up");
      window[API_STAR_CRAWLFT].instagramApi.removeOnScrapResult();
    };
  }, [scrapWorkInfo.isWorking]);

  const addScrapResult = (newScrapResult: ScrapResult) => {
    setScrapResults((oldScrapResults) => {
      const historyIndex = oldScrapResults.findIndex(
        (history) => history.key === newScrapResult.key
      );
      if (historyIndex !== -1) {
        // key가 일치하는 항목을 찾았다면, 해당 result 배열에 새로운 결과 추가
        const updatedHistory = [...oldScrapResults];
        updatedHistory[historyIndex] = {
          ...updatedHistory[historyIndex],
          result: [newScrapResult, ...updatedHistory[historyIndex].result],
        };
        return updatedHistory;
      } else {
        // 일치하는 key가 없다면, 새로운 항목 추가
        return [
          { key: newScrapResult.key, result: [newScrapResult] },
          ...oldScrapResults,
        ];
      }
    });
  };
  const handleSelectRootDir = async () => {
    const selectDir = await window[API_STAR_CRAWLFT].instagramApi.openDialog();
    setScrapResults((prev) => {
      const findHistory = prev.find((h) => h.key === "test");
      console.log(findHistory);
      return [...prev];
    });
    setRootDir(selectDir);
  };
  const addInput = (addCount = 1): void => {
    const newFields: ScrapField[] = [];
    let lastId = scrapWorkInfo.scrapWorkList.length;
    for (let i = 0; i < addCount; i++) {
      const newField: ScrapField = {
        id: ++lastId,
        feedUri: "",
        mark: totalMarkStatus,
      };
      newFields.push(newField);
    }
    setScrapWorkInfo((prev) => ({
      ...prev,
      scrapWorkList: [...prev.scrapWorkList, ...newFields],
    }));
  };

  const removeInput = (removeCount = 1): void => {
    let newLength = scrapWorkInfo.scrapWorkList.length - removeCount;
    if (newLength < 10) {
      newLength = 10;
    }

    setScrapWorkInfo((prev) => {
      return {
        ...prev,
        scrapWorkList: prev.scrapWorkList.slice(0, newLength),
      };
    });
  };

  const fieldRestHandle = () => {
    setRootDir("");
    setTotalMarkStatus(MarkStatus.NONE);
    setScrapWorkInfo({
      isWorking: false,
      scrapWorkList: initializeScrapFields(),
    });
  };

  const handleInputChange = (
    id: number,
    field: keyof ScrapField,
    value: string | MarkStatus
  ): void => {
    const updatedInputs = scrapWorkInfo.scrapWorkList.map((input) => {
      if (input.id === id) {
        return { ...input, [field]: value };
      }
      return input;
    });
    setScrapWorkInfo((prev) => ({
      ...prev,
      scrapWorkList: updatedInputs,
    }));
  };

  const handleTotalMarkChange = () => {
    const updatedInputs = scrapWorkInfo.scrapWorkList.map((input) => {
      return { ...input, mark: totalMarkStatus };
    });

    setScrapWorkInfo((prev) => ({
      ...prev,
      scrapWorkList: updatedInputs,
    }));
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (rootDir === "") {
      return;
    }

    // 현재 날짜와 시간을 한국 시간대(UTC+9)로 설정
    const koreaTime = new Date().toLocaleString("en-US", {
      timeZone: "Asia/Seoul",
    });

    // Date 객체 생성
    const date = new Date(koreaTime);

    // 한국 시간을 '년-월-일-시간:분:초' 형식으로 포매팅
    const formattedKey =
      date.getFullYear() +
      "-" +
      String(date.getMonth() + 1).padStart(2, "0") + // 월은 0부터 시작하므로 1을 더함
      "-" +
      String(date.getDate()).padStart(2, "0") +
      "-" +
      String(date.getHours()).padStart(2, "0") +
      ":" +
      String(date.getMinutes()).padStart(2, "0") +
      ":" +
      String(date.getSeconds()).padStart(2, "0");

    const workingScrapFields = scrapWorkInfo.scrapWorkList.filter((input) => {
      return input.feedUri !== "";
    });
    const scrapInput: ScrapInfo = {
      rootDir,
      key: formattedKey,
      scrapFields: workingScrapFields,
      signedId: signedInUser.userId,
    };
    workingCountRef.current = {
      totalCount: scrapInput.scrapFields.length,
      successCount: 0,
      failureCount: 0,
    };
    setLoadingMessage(getScrapWorkingMessage(workingCountRef));
    setScrapWorkInfo((prev) => ({ ...prev, isWorking: true }));

    await window[API_STAR_CRAWLFT].instagramApi.scrapFeed(scrapInput);
    setScrapWorkInfo((prev) => ({ ...prev, isWorking: false }));
  };

  if (scrapWorkInfo.isWorking) {
    return <Loading />;
  }

  return (
    <main
      className={cls(
        "flex h-[100vh] flex-col items-center overflow-x-hidden overflow-y-visible pt-20"
      )}
    >
      <div
        className={cls(
          "mb-5 flex w-[100vw] flex-col items-center justify-center space-y-3 px-12"
        )}
      >
        <div className={cls("flex justify-center")}>
          <div className={cls("mr-5 w-96 border-b border-orange-400")}>
            <span>{rootDir}</span>
          </div>
          <button
            onClick={handleSelectRootDir}
            className={
              "rounded-lg bg-orange-400 px-5 text-neutral-900 shadow-lg font-bold shadow-neutral-900 hover:scale-110 transition-[transform] duration-300"
            }
          >
            저장 폴더
          </button>
          <button
            className={cls(
              "ml-3 rounded-lg bg-blue-700 px-5 py-2 font-bold shadow-lg shadow-neutral-900 ",
              rootDir
                ? "cursor-pointer opacity-100 transition-[transform] duration-300 hover:scale-110"
                : "cursor-not-allowed opacity-60"
            )}
            type="submit"
            form={"scrapForm"}
          >
            시작
          </button>
        </div>
        <div
          className={cls(
            "relative flex flex-col justify-center space-y-5 border border-orange-400 p-5"
          )}
        >
          <div
            className={cls("absolute left-5 top-[-12px] bg-neutral-800 px-2")}
          >
            <span>생성된 필드 : {scrapWorkInfo.scrapWorkList.length}</span>
          </div>
          <div className={cls("space-x-3")}>
            <button
              className={cls(
                "rounded-lg bg-green-800 px-5 py-2 font-bold shadow-lg shadow-neutral-900 transition-[transform] duration-300 hover:scale-110"
              )}
              type="button"
              onClick={() => addInput(10)}
            >
              10개 추가
            </button>
            <button
              className={cls(
                "rounded-lg bg-green-800 px-5 py-2 font-bold shadow-lg shadow-neutral-900 transition-[transform] duration-300 hover:scale-110"
              )}
              type="button"
              onClick={() => addInput()}
            >
              단일 추가
            </button>
          </div>
          <div className={cls("space-x-3")}>
            <button
              className={cls(
                "rounded-lg bg-red-700 px-5 py-2 font-bold shadow-lg shadow-neutral-900 transition-[transform] duration-300 hover:scale-110"
              )}
              type="button"
              onClick={() => removeInput(10)}
            >
              10개 제거
            </button>
            <button
              className={cls(
                "rounded-lg bg-red-700 px-5 py-2 font-bold shadow-lg shadow-neutral-900 transition-[transform] duration-300 hover:scale-110"
              )}
              type="button"
              onClick={() => removeInput()}
            >
              단일 제거
            </button>
            <button
              className={cls(
                "rounded-lg bg-red-700 px-5 py-2 font-bold shadow-lg shadow-neutral-900 transition-[transform] duration-300 hover:scale-110"
              )}
              type="button"
              onClick={fieldRestHandle}
            >
              필드 리셋
            </button>
          </div>
          <div className={cls("flex items-center")}>
            <div className={cls("space-x-3")}>
              {Object.values(MarkStatus).map((status) => (
                <label key={status}>
                  <input
                    type="radio"
                    value={status}
                    checked={totalMarkStatus === status}
                    onChange={() => setTotalMarkStatus(status)}
                    className={cls("mr-1.5")}
                  />
                  {getStatusName(status)}
                </label>
              ))}
            </div>
            <button
              className={cls(
                "ml-5 rounded-lg bg-green-800 px-5 py-2 font-bold shadow-lg shadow-neutral-900 transition-[transform] duration-300 hover:scale-110"
              )}
              type="button"
              onClick={handleTotalMarkChange}
            >
              전체 적용
            </button>
          </div>
        </div>
      </div>
      <form
        id={"scrapForm"}
        onSubmit={handleSubmit}
        className={cls("grid grid-cols-2 items-center justify-center gap-5")}
      >
        {scrapWorkInfo.scrapWorkList.map((scrapField) => (
          <InputContainer
            key={scrapField.id}
            scrapField={scrapField}
            onInputChange={handleInputChange}
          />
        ))}
      </form>
    </main>
  );
}
