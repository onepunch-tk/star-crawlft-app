import { User, UserStatus } from "../models/user.model";

interface CreateOrUpdateResponse {
  userId: number;
  error?: string;
}

interface CreateUserInput {
  username: string;
  password: string;
  status: UserStatus;
}

interface UpdateUserInput {
  status?: UserStatus;
  password?: string;
}

export const initializeUserIfNeed = async (
  username: string,
  password: string
) => {
  const [user, created] = await User.findOrCreate({
    where: { username },
    defaults: { username, password, status: "signOut" },
  });
  if (created) {
    console.log("새로운 사용자가 생성되었습니다:", user.username);
  } else {
    console.log("기존 사용자가 발견되었습니다:", user.username);
  }
};

export const findSignedInUser = async () => {
  try {
    return await User.findOne({ where: { status: "signIn" } });
  } catch {
    return null;
  }
};

export const findUserByUsername = async (username: string) => {
  try {
    return await User.findOne({ where: { username } });
  } catch (e) {
    return null;
  }
};

export const findUserById = async (userId: number) => {
  try {
    return await User.findByPk(userId);
  } catch (e) {
    return null;
  }
};

export const updateUser = async (
  userId: number,
  updateInput: UpdateUserInput
) => {
  try {
    return await User.update(updateInput, { where: { id: userId } });
  } catch (e) {
    console.error(e);
  }
};

export const createUser = async (userInput: CreateUserInput) =>
  await User.create(userInput);

export const findOrUpsertUser = async (
  userInput: User
): Promise<CreateOrUpdateResponse> => {
  try {
    const [user, created] = await User.findOrCreate({
      where: { username: userInput.username },
      defaults: { ...userInput.dataValues },
    });

    if (created) {
      await User.update(
        { status: userInput.status },
        {
          where: {
            id: user.id,
          },
        }
      );
    }

    return {
      userId: user.id,
    };
  } catch (e) {
    console.error(e);
    return {
      userId: 0,
      error: e.message,
    };
  }
};
