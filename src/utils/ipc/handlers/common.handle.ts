import { dialog } from "electron";

export const openDialog = async () => {
  const result = await dialog.showOpenDialog({
    properties: ["openDirectory", "createDirectory"],
  });
  if (result.canceled) {
    return null; // 사용자가 취소한 경우
  } else {
    return result.filePaths[0]; // 선택된 디렉터리 경로
  }
};
