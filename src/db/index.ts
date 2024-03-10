import { Sequelize } from "sequelize";
import path from "path";
import { app } from "electron";
import sqlite3 from "sqlite3";
import { userInit } from "./models/user.model";

// 환경에 따라 데이터베이스 경로 설정
const dbPath = MAIN_WINDOW_VITE_DEV_SERVER_URL
  ? path.join("src", "__dev__", "sqlite.db")
  : path.join(app.getPath("userData"), "sqlite.db");

const sequelize = new Sequelize({
  dialect: "sqlite",
  dialectModule: sqlite3,
  storage: dbPath,
});

export const initializeDatabase = async () => {
  try {
    await sequelize.authenticate();
    userInit();
    console.log("데이터베이스 연결 성공");

    // 모델 동기화
    //await User.sync({ alter: import.meta.env.VITE_NODE_ENV === "develop" });
    await sequelize.sync();
    console.log("모델 동기화 완료");
  } catch (error) {
    console.error("데이터베이스 연결 실패:", error);
  }
};

export default sequelize;
