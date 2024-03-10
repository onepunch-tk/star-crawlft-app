import { Browser, Page } from "puppeteer";
import {
  checkDismiss,
  createBrowser,
  createPage,
  isSignForInstagram,
  waitFor,
} from "../../../puppeteer";
import {
  MarkStatus,
  ScrapInput,
  SignInInput,
  SignInResponse,
} from "./interface";
import {
  createUser,
  findOrUpsertUser,
  findSignedInUser,
  findUserById,
  findUserByUsername,
  updateUser,
} from "../../../../db/services/user.service";
import { User } from "../../../../db/models/user.model";
import fsPromise from "fs/promises";
import { constants } from "fs";
import path from "path";
import { app } from "electron";
import sharp from "sharp";

const INSTA_LOGIN_URL = "https://instagram.com/accounts/login";
const INSTA_URL = "https://instagram.com/";

export const getSignedInUserById = async (
  e: Electron.IpcMainInvokeEvent,
  userId: number
): Promise<User | null> => await findUserById(userId);

export const getSignedInUser = async (
  e: Electron.IpcMainInvokeEvent
): Promise<User | null> => await findSignedInUser();

export const scrapFeed = async (
  e: Electron.IpcMainInvokeEvent,
  { signedId, feeds, rootDir }: ScrapInput
) => {
  let browser: Browser;
  let page: Page;
  try {
    const { username, password } = await findUserById(signedId);
    browser = await createBrowser({
      blockResources: [],
      dirPrefix: "insta",
      username,
    });
    page = await createPage(browser, false);

    //로그인이 필요한지 체크
    await page.goto(INSTA_LOGIN_URL, { waitUntil: "networkidle2" });
    if (await isSignForInstagram(page)) {
      await signInByAccount({ username, password }, page);
      await waitFor(1000);
    }

    for (const feed of feeds) {
      await waitFor(1000);
      await page.goto(feed.feedUri, { waitUntil: "networkidle2" });
      await checkDismiss(page, INSTA_URL);
      const mediaContents: { isVideo: boolean; src: string }[] = [];
      let imgCount = 0;
      let videoCount = 0;

      const { outputPath, account } = await downloadTextContent(
        page,
        rootDir,
        feed.dirName
      );

      //미디어 게시물 추출
      let worker = true;
      while (worker) {
        const medias = await page.evaluate(() => {
          const videos = Array.from(document.querySelectorAll("video")).map(
            (video) => ({
              isVideo: true,
              src: video.src || video.getAttribute("src"),
            })
          );

          const imgs = Array.from(
            document.querySelectorAll("[role^='presentation'] img")
          )
            .filter((img) => !img.hasAttribute("alt")) // alt 속성이 없는 이미지만 필터링
            .map((img) => ({
              isVideo: false,
              src: (img as HTMLImageElement).src || img.getAttribute("src"),
            }));

          return [...videos, ...imgs];
        });

        // 중복되지 않는 src만 mediaContents 배열에 추가
        medias.forEach((media) => {
          if (!mediaContents.some((item) => item.src === media.src)) {
            mediaContents.push(media);
          }
        });

        try {
          // 다음 버튼 클릭을 시도. (다음 미디어로 이동)
          const nextButton = await page.$("[aria-label^='Next']");
          if (nextButton) {
            await nextButton.click();
            // 페이지 로딩 대기
            await waitFor(1000);
          } else {
            worker = false; // 다음 버튼이 없으면 반복 종료
          }
        } catch (error) {
          console.log(error);
          worker = false; // 오류 발생 시 반복 종료
        }
      }
      await Promise.all(
        mediaContents.map(async (media) => {
          const fileName = media.isVideo
            ? `${++videoCount}.mp4`
            : `${++imgCount}.jpg`;
          let watermarkText: string;
          if (!media.isVideo) {
            switch (feed.mark) {
              case MarkStatus.AD:
                watermarkText = "광고";
                break;
              case MarkStatus.ORIGIN:
                watermarkText = `@${account}`;
                break;
              case MarkStatus.RE_GRAM:
                watermarkText = "리그램";
                break;
              case MarkStatus.SPONSOR:
                watermarkText = "협찬";
                break;
              case MarkStatus.NONE:
              default:
                break;
            }
          }
          await downloadMediaContent(
            media.src,
            outputPath,
            fileName,
            watermarkText
          );
        })
      );
    }

    await page.close();
    await browser.close();
  } catch (e) {
    console.error(e);
    page && (await page.close());
    browser && (await page.close());
  }
};

export const instagramSignIn = async (
  e: Electron.IpcMainInvokeEvent,
  { username, password, currentUserId }: SignInInput
): Promise<SignInResponse> => {
  let browser: Browser;
  let page: Page;
  try {
    const findUser = await findUserByUsername(username);
    if (currentUserId && findUser.id === currentUserId) {
      return {
        userId: currentUserId,
        ok: false,
        error: "이미 로그인된 아이디 입니다.",
      };
    }
    browser = await createBrowser({
      blockResources: [],
      dirPrefix: "insta",
      username,
    });
    page = await createPage(browser, false);

    await page.goto(INSTA_LOGIN_URL, { waitUntil: "networkidle2" });

    //login form이 있을 경우 로그인 시도.
    if (await isSignForInstagram(page)) {
      const { userId, error } = await signInByAccount(
        { username, password },
        page
      );

      //기존 아이디 로그아웃 처리
      if (!error && currentUserId) {
        await updateUser(currentUserId, { status: "signOut" });
      }

      return {
        userId,
        ok: !error,
        error,
      };
    } else {
      //로그인 폼이 없을 경우
      const userDataDir = MAIN_WINDOW_VITE_DEV_SERVER_URL
        ? path.join("src", "__dev__", `insta-${username}`)
        : path.join(app.getPath("userData"), `insta-${username}`);

      const exists = await checkExistsAsync(userDataDir);
      //로그인하려는 아이디의 user data dir가 존재하는 경우
      if (exists) {
        //db에서 아이디 조회

        let userId: number;
        if (findUser) {
          await updateUser(findUser.id, { status: "signIn" });
          userId = findUser.id;
        } else {
          const createdUser = await createUser({
            username,
            password,
            status: "signIn",
          });
          userId = createdUser.id;
        }

        //기존 아이디 로그아웃
        if (currentUserId) {
          await updateUser(currentUserId, { status: "signOut" });
        }

        await checkDismiss(page, INSTA_URL);
        return {
          userId,
          ok: true,
        };
      } else {
        throw new Error("Not found login form.");
      }
    }
  } catch (e) {
    return {
      ok: false,
      error: e.message,
    };
  } finally {
    console.log("finally");
    page && (await page.close());
    browser && (await browser.close());
  }
};

//다운로드 컨텐츠
const downloadTextContent = async (
  page: Page,
  rootPath: string,
  dirName?: string
) => {
  //게시물의 소유 계정과 텍스트 컨테츠 추출
  const { account, textContent } = await page.evaluate(async () => {
    const spans = document.querySelectorAll("main span");
    const moreEl = Array.from(spans).find(
      (span) => (span as HTMLSpanElement).innerText === "more"
    );
    if (moreEl) {
      (moreEl as HTMLSpanElement).click();
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
    const accountEl = document.querySelector("main span a");
    const textContentEl = document.querySelector("main span h1");
    return {
      account: accountEl ? accountEl.textContent : "",
      textContent: textContentEl
        ? (textContentEl as HTMLHeadElement).innerText
        : "",
    };
  });

  const finalDownloadPath = dirName
    ? path.join(rootPath, dirName)
    : path.join(rootPath, `${account}-${Date.now()}`);
  await fsPromise.mkdir(finalDownloadPath, { recursive: true });

  await fsPromise.writeFile(
    path.join(finalDownloadPath, "textContent.txt"),
    textContent,
    "utf-8"
  );

  return {
    account,
    outputPath: finalDownloadPath,
  };
};
const downloadMediaContent = async (
  url: string,
  outputPath: string,
  fileName: string,
  watermarkText?: string
) => {
  const response = await fetch(url);
  if (!response.ok)
    throw new Error(`Failed to fetch ${url}: ${response.statusText}`);
  const arrayBuffer = await response.arrayBuffer();
  const finalDownloadPath = path.join(outputPath, fileName);
  if (watermarkText) {
    await sharp(Buffer.from(arrayBuffer))
      .composite([
        {
          input: Buffer.from(`<svg width="1000" height="800">
            <text x="50" y="80" font-size="42" fill="white" font-weight="bold" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif">${watermarkText}</text>
          </svg>`),
          gravity: "northwest",
        },
      ])
      .toFile(finalDownloadPath);
  } else {
    await fsPromise.writeFile(finalDownloadPath, Buffer.from(arrayBuffer));
  }
  console.log(`MediaContent downloaded to ${finalDownloadPath}`);
};

const checkExistsAsync = async (path: string) => {
  try {
    await fsPromise.access(path, constants.F_OK);
    return true;
  } catch {
    return false;
  }
};

const signInByAccount = async (
  { username, password }: { username: string; password: string },
  page: Page
): Promise<{ userId: number; error?: string }> => {
  try {
    await page.type("input[name='username']", username, { delay: 50 });
    await page.type("input[name='password']", password, { delay: 50 });
    await waitFor(500);
    await page.click("button[type='submit']");

    const finalResponse = await page.waitForResponse(async (res) => {
      return (
        res.url() ===
          "https://www.instagram.com/api/v1/web/accounts/login/ajax/" &&
        res.status() === 200
      );
    });
    const { authenticated } = await finalResponse.json();
    const { userId, error } = await findOrUpsertUser(
      new User({
        username,
        password,
        status: authenticated ? "signIn" : "unauthorized",
      })
    );

    return {
      userId,
      error,
    };
  } catch (e) {
    return {
      userId: 0,
      error: e.message,
    };
  }
};
