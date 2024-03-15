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
  ScrapInfo,
  ScrapResult,
  ScrapStatus,
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
import { mainWindow } from "../../../../main";
import { CHANNEL_INSTAGRAM_SCRAP_RESULT } from "../../ipc.constant";

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
  { signedId, scrapFields, rootDir, key }: ScrapInfo
) => {
  let browser: Browser;
  let page: Page;
  try {
    const { username, password } = await findUserById(signedId);
    browser = await createBrowser({
      blockResources: ["media", "image"],
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

    for (const scrapField of scrapFields) {
      await page.goto(scrapField.feedUri, { waitUntil: "networkidle2" });
      await checkDismiss(page, INSTA_URL);

      const mediaContents: { isVideo: boolean; src: string }[] = [];
      let imgCount = 0;
      let videoCount = 0;
      let account = "";
      let downloadPath = "";

      const scrapResult: ScrapResult = {
        id: scrapField.id,
        key,
        status: ScrapStatus.SUCCESS,
        message: "",
      };

      try {
        account = await page.evaluate(() => {
          const accountEl = document.querySelector("main span a");
          return accountEl ? (accountEl as HTMLAnchorElement).textContent : "";
        });
      } catch (e) {
        scrapResult.message = `계정 추출 실패 : ${e.message}`;
        scrapResult.status = ScrapStatus.FAILURE;
        mainWindow.webContents.send(
          CHANNEL_INSTAGRAM_SCRAP_RESULT,
          scrapResult
        );
        continue;
      }

      try {
        downloadPath = scrapField.dirName
          ? path.join(rootDir, `(${scrapField.id}) ${scrapField.dirName}`)
          : path.join(rootDir, `(${scrapField.id}) ${account}`);

        await fsPromise.mkdir(downloadPath, { recursive: true });
      } catch (e) {
        scrapResult.message = `디렉터리 생성 실패 : ${e.message}`;
        scrapResult.status = ScrapStatus.FAILURE;
        mainWindow.webContents.send(
          CHANNEL_INSTAGRAM_SCRAP_RESULT,
          scrapResult
        );
        continue;
      }

      try {
        await downloadTextContent(page, account, downloadPath);
      } catch (e) {
        scrapResult.message = `텍스트 컨텐츠 다운로드 실패 : ${e.message}`;
        scrapResult.status = ScrapStatus.FAILURE;
        mainWindow.webContents.send(
          CHANNEL_INSTAGRAM_SCRAP_RESULT,
          scrapResult
        );
        continue;
      }

      //미디어 게시물 추출
      let worker = true;
      try {
        while (worker) {
          let tempMedias: { isVideo: boolean; src: string }[] = [];
          try {
            tempMedias = await page.evaluate(() => {
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
          } catch (e) {
            worker = false;
            throw new Error(`미디어 컨텐츠 추출 실패 : ${e.message}`);
          }
          console.log("tempMedia:", tempMedias);
          // 중복되지 않는 src만 mediaContents 배열에 추가
          tempMedias.forEach((media) => {
            if (!mediaContents.some((item) => item.src === media.src)) {
              mediaContents.push(media);
            }
          });
          console.log("mediaContents:", mediaContents);

          try {
            // 다음 버튼 클릭을 시도. (다음 미디어로 이동)
            const nextButton = await page.$("[aria-label^='Next']");
            if (nextButton) {
              await nextButton.click();
              // 페이지 로딩 대기
              await waitFor(1000);
            } else {
              worker = false;
              break; // 다음 버튼이 없으면 반복 종료
            }
          } catch (error) {
            worker = false;
            break; // 오류 발생 시 반복 종료
          }
        }
      } catch (e) {
        worker = false;
        scrapResult.message = e.message;
        scrapResult.status = ScrapStatus.FAILURE;
        mainWindow.webContents.send(
          CHANNEL_INSTAGRAM_SCRAP_RESULT,
          scrapResult
        );
        continue;
      }

      try {
        await Promise.all(
          mediaContents.map(async (media) => {
            const fileName = media.isVideo
              ? `${++videoCount}.mp4`
              : `${++imgCount}.jpg`;
            let watermarkText: string;
            if (!media.isVideo) {
              switch (scrapField.mark) {
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
              downloadPath,
              fileName,
              watermarkText
            );
          })
        );
      } catch (e) {
        scrapResult.message = `미디 컨텐츠 다운로드 실패 : ${e.message}`;
        scrapResult.status = ScrapStatus.FAILURE;
        mainWindow.webContents.send(
          CHANNEL_INSTAGRAM_SCRAP_RESULT,
          scrapResult
        );
        continue;
      }

      scrapResult.message = "컨텐츠 저장 성공.";
      mainWindow.webContents.send(CHANNEL_INSTAGRAM_SCRAP_RESULT, scrapResult);
      await waitFor(1500);
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
    if (currentUserId) {
      if (findUser && findUser.dataValues.id === currentUserId) {
        return {
          userId: currentUserId,
          ok: false,
          error: "이미 로그인된 아이디 입니다.",
        };
      }
    }
    //"C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe"

    browser = await createBrowser({
      blockResources: [],
      dirPrefix: "insta",
      username,
    });

    if (!browser) {
      throw new Error("Browser 생성 실패");
    }

    page = await createPage(browser, false);
    if (!page) {
      throw new Error("page 생성 실패");
    }
    await page.goto(INSTA_LOGIN_URL, {
      waitUntil: "networkidle2",
      timeout: 10000,
    });

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
    page && (await page.close());
    browser && (await browser.close());
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
  account: string,
  downloadPath: string
) => {
  //게시물의 소유 계정과 텍스트 컨테츠 추출
  const { textContent } = await page.evaluate(async (account) => {
    const spans = document.querySelectorAll("main span");
    const moreEl = Array.from(spans).find(
      (span) => (span as HTMLSpanElement).innerText === "more"
    );
    if (moreEl) {
      (moreEl as HTMLSpanElement).click();
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
    const textContentEl = document.querySelector("main span h1");
    let textContent: string;
    if (textContentEl) {
      textContent = `@${account}\r\n${(
        textContentEl as HTMLHeadElement
      ).innerText.normalize("NFC")}`;
    } else {
      textContent = `@${account}\r\n`;
    }
    return {
      textContent,
    };
  }, account);

  await fsPromise.writeFile(
    path.join(downloadPath, "textContent.txt"),
    textContent,
    "utf-8"
  );
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
