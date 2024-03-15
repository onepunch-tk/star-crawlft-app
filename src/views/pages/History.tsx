import { useRecoilValue } from "recoil";
import { scrapResultState } from "../../utils/recoil/instagram/atoms";

export function History() {
  const histories = useRecoilValue(scrapResultState);
  return (
    <div className="bg-neutral-800 p-4 overflow-x-hidden overflow-y-visible pt-20">
      {histories.map((history, index) => (
        <div key={index} className="border border-orange-400 p-2 mb-4">
          <div className="font-bold text-white mb-2">Date: {history.key}</div>
          {history.result.map((result) => (
            <div key={result.id} className="text-white">
              작업 ID: {result.id}, Status: {result.status}, Message:{" "}
              {result.message}
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
