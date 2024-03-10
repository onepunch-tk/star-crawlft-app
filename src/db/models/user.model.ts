import {
  CreationOptional,
  DataTypes,
  InferAttributes,
  InferCreationAttributes,
  Model,
} from "sequelize";
import sequelize from "../index";

// status 필드의 가능한 값들을 별도의 타입으로 정의
export type UserStatus = "signIn" | "signOut" | "unauthorized";

// User 모델에 대한 인터페이스 정의
interface UserAttributes {
  id: CreationOptional<number>; // Sequelize가 자동으로 생성
  username: string;
  password: string;
  status: UserStatus; // 별도로 정의한 타입 사용
}

// Sequelize 모델을 확장하여 타입 안전성 확보
export class User
  extends Model<InferAttributes<User>, InferCreationAttributes<User>>
  implements UserAttributes
{
  declare id: CreationOptional<number>;
  declare username: string;
  declare password: string;
  declare status: UserStatus; // 별도로 정의한 타입 사용
}

export const userInit = () => {
  // 모델 정의
  User.init(
    {
      id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true,
      },
      username: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true,
      },
      password: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      status: {
        type: DataTypes.ENUM("signIn", "signOut", "unauthorized"),
        defaultValue: "signOut",
      },
    },
    {
      sequelize, // sequelize 인스턴스
      modelName: "User",
      createdAt: false,
      updatedAt: false,
    }
  );
};
