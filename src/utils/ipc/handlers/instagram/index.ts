import { Browser, Page } from "puppeteer";
import {
  checkDismiss,
  createBrowser,
  createPage,
  isSignInButton,
  waitFor,
} from "../../../puppeteer";
import {
  MarkImgCount,
  MarkStatus,
  ScrapInfo,
  ScrapResult,
  ScrapStatus,
  SignInInput,
  SignInResponse,
  TextStatus,
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
      blockResources: ["image"],
      dirPrefix: "insta",
      username,
    });
    page = await createPage(browser, false);

    //로그인이 필요한지 체크
    await page.goto(INSTA_LOGIN_URL, { waitUntil: "networkidle2" });
    const signInButton = await isSignInButton(page);
    if (signInButton) {
      console.log("isSignInButton");
      await signInButton.click();
      await signInByAccount({ username, password }, page);
      await waitFor(1000);
    }
    // else if (await isSignForInstagram(page)) {
    //   await signInByAccount({ username, password }, page);
    //   await waitFor(1000);
    // }

    for (const scrapField of scrapFields) {
      const scrapResult: ScrapResult = {
        id: scrapField.id,
        key,
        status: ScrapStatus.SUCCESS,
        message: "",
      };

      try {
        console.log(scrapField.feedUri);
        await page.goto(scrapField.feedUri);
      } catch (e) {
        console.log(e)
        scrapResult.message = `잘못된 게시물 주소 : ${e.message}`;
        scrapResult.status = ScrapStatus.FAILURE;
        mainWindow.webContents.send(
          CHANNEL_INSTAGRAM_SCRAP_RESULT,
          scrapResult
        );
        continue;
      }
      await checkDismiss(page, INSTA_URL);

      const mediaContents: { isVideo: boolean; src: string }[] = [];
      let imgCount = 0;
      let videoCount = 0;
      let account = "";
      let downloadPath = "";

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
        await downloadTextContent(
          page,
          scrapField.textStatus,
          account,
          downloadPath
        );
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
            tempMedias = await mediaEvaluate(page, scrapField.feedUri, 1);
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
      if (mediaContents.length === 0) {
        scrapResult.message = "미디어 컨텐츠 찾을수 없음";
        scrapResult.status = ScrapStatus.FAILURE;
        mainWindow.webContents.send(
          CHANNEL_INSTAGRAM_SCRAP_RESULT,
          scrapResult
        );
        continue;
      }
      try {
        const filterImgs = mediaContents.filter((media) => !media.isVideo);
        const filterVideos = mediaContents.filter((media) => media.isVideo);
        await Promise.all(
          filterImgs.map(async (img, index) => {
            const fileName = `${++imgCount}.jpg`;
            let watermarkText: string;
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

            if (scrapField.useText) {
              watermarkText = scrapField.useText;
            }

            if (imgCount > 1 && scrapField.markCount === MarkImgCount.FIRST) {
              watermarkText = "";
            }

            await downloadMediaContent(
              img.src,
              downloadPath,
              fileName,
                {watermarkText, cardTextTop:scrapField.cardTextTop, cardTextBottom:scrapField.cardTextBottom, imgCount}
            );
          })
        );
        await Promise.all(
          filterVideos.map(async (video) => {
            const fileName = `${++videoCount}.mp4`;
            await downloadMediaContent(video.src, downloadPath, fileName);
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
    const signInButton = await isSignInButton(page);
    if (signInButton) {
      console.log("isSignInButton");
      await signInButton.click();
      // await signInByAccount({ username, password }, page);
      const { userId, error } = await signInByAccount(
        { username, password },
        page
      );

      //기존 아이디 로그아웃 처리
      if (!error && currentUserId) {
        await updateUser(currentUserId, { status: "signOut" });
      }
      console.log(userId);
      return {
        userId,
        ok: !error,
        error,
      };
    }
    // else if (await isSignForInstagram(page)) {
    //   await signInByAccount({ username, password }, page);
    //   const { userId, error } = await signInByAccount(
    //       { username, password },
    //       page
    //   );
    //
    //   //기존 아이디 로그아웃 처리
    //   if (!error && currentUserId) {
    //     await updateUser(currentUserId, { status: "signOut" });
    //   }
    //
    //   return {
    //     userId,
    //     ok: !error,
    //     error,
    //   };
    // }
    else {
      //로그인 폼이 없을 경우
      // const userDataDir = MAIN_WINDOW_VITE_DEV_SERVER_URL
      //   ? path.join("src", "__dev__", `insta-${username}`)
      //   : path.join(app.getPath("userData"), `insta-${username}`);
      // console.log("userDataDir:",userDataDir);
      // const exists = await checkExistsAsync(userDataDir);
      // //로그인하려는 아이디의 user data dir가 존재하는 경우
      // if (exists) {
      //
      // }

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
    }
  } catch (e) {
    console.error(e);
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
  textStatus: TextStatus,
  account: string,
  downloadPath: string
) => {
  //게시물의 소유 계정과 텍스트 컨테츠 추출
  let inText: string;
  switch (textStatus) {
    case TextStatus.ACCOUNT:
      inText = `@${account}`;
      break;
    case TextStatus.RE_GRAM:
      inText = "(리그램)";
      break;
    case TextStatus.RE_GRAM_AND_ACCOUNT:
      inText = `(리그램) @${account}`;
      break;
    case TextStatus.NONE:
      inText = "";
      break;
  }

  const { textContent } = await page.evaluate(async (inText) => {
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
      textContent = `${inText}\r\n${(
        textContentEl as HTMLHeadElement
      ).innerText.normalize("NFC")}`;
    } else {
      textContent = `${inText}\r\n`;
    }
    return {
      textContent,
    };
  }, inText);

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
  imgTextObj?:{watermarkText?:string, cardTextTop?:string, cardTextBottom?:string, imgCount:number}
) => {
  const response = await fetch(url);
  if (!response.ok)
    throw new Error(`Failed to fetch ${url}: ${response.statusText}`);
  const arrayBuffer = await response.arrayBuffer();
  const finalDownloadPath = path.join(outputPath, fileName);
  if (imgTextObj) {
    const image = sharp(Buffer.from(arrayBuffer));
    const metadata = await image.metadata();

    const cardTextY = metadata.height - 50;
    const cardTextFontSize = calculateDynamicFontSize(metadata.width, 65);

    let imgText:string = "";

    if(imgTextObj.watermarkText) {
      const waterMarkFontSize = calculateDynamicFontSize(metadata.width, 25);
      imgText += `<text x="5" y="${
          waterMarkFontSize + 10
      }" font-size="${waterMarkFontSize}" fill="white" stroke="black" stroke-width="1" font-weight="bold" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif">${imgTextObj.watermarkText}</text>`
    }

    if(imgTextObj.cardTextBottom && imgTextObj.imgCount === 1) {
      console.log(imgTextObj.cardTextBottom)

      imgText += `<text x="${ metadata.width /2}" y="${
          cardTextY
      }" font-size="${cardTextFontSize}" fill="white" stroke="white"  stroke-width="${
          cardTextFontSize * 0.2
      }" font-weight="bold" text-anchor="middle" font-family="휴먼매직체, 휴먼편지체, 휴먼둥근헤드라인, Segoe UI, sans-serif">${imgTextObj.cardTextBottom}</text>
     <text x="${ metadata.width /2}" y="${
          cardTextY
      }"  font-size="${cardTextFontSize}" fill="black" font-weight="bold" text-anchor="middle" font-family="휴먼매직체, 휴먼편지체, 휴먼둥근헤드라인, Segoe UI, sans-serif">${imgTextObj.cardTextBottom}</text>`
    }

    if(imgTextObj.cardTextTop && imgTextObj.imgCount === 1) {
      console.log(imgTextObj.cardTextTop)
      imgText += `<text x="${
          metadata.width /2
      }" y="${imgTextObj.cardTextBottom ? cardTextY - cardTextFontSize : cardTextY}" font-size="${cardTextFontSize}" fill="white" stroke="white"  stroke-width="${
          cardTextFontSize * 0.2
      }" font-weight="bold" text-anchor="middle" font-family="휴먼매직체, 휴먼편지체, 휴먼둥근헤드라인, Segoe UI, sans-serif">${imgTextObj.cardTextTop}</text>
       <text x="${
          metadata.width /2
      }" y="${imgTextObj.cardTextBottom ? cardTextY - cardTextFontSize : cardTextY}" font-size="${cardTextFontSize}" fill="black" font-weight="bold" text-anchor="middle" font-family="휴먼매직체, 휴먼편지체, 휴먼둥근헤드라인, Segoe UI, sans-serif">${imgTextObj.cardTextTop}</text>`
    }

    const svgWatermark = Buffer.from(`<svg width="${metadata.width}" height="${
      metadata.height
    }">
        ${imgText}
    </svg>`);

    await image
      .composite([
        {
          input: svgWatermark,
          gravity: "northeast",
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

const mediaEvaluate = async (page: Page, uri: string, retryCount: number) => {
  const RETRY_MAX_COUNT = 5;
  const mediaList = await page.evaluate(() => {
    const videos = Array.from(document.querySelectorAll("video")).map(
      (video) => ({
        isVideo: true,
        src: video.src || video.getAttribute("src"),
      })
    );
    const imgs = Array.from(document.querySelectorAll("img"))
      .filter((img) => img.src.includes("scontent") || img.src.includes("cdninstagram.com")) // alt 속성이 없고, src에 특정 문자열이 포함된 이미지만 필터링
      .map((img) => ({
        isVideo: false, // 여기서는 모든 이미지를 비디오가 아니라고 가정합니다.
        src: img.src || img.getAttribute("src"), // HTMLImageElement의 타입 어설션을 사용하지 않고 src 값을 가져옵니다.
      }));
    return [...videos, ...imgs];
  });
  if (mediaList.length < 1 && retryCount <= RETRY_MAX_COUNT) {
    await waitFor(1000);
    await page.goto(uri, { waitUntil: "networkidle0" });
    await mediaEvaluate(page, uri, retryCount + 1);
  }

  return mediaList;
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
      console.log(res.url());
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

const calculateDynamicFontSize = (
  imageWidth: number,
  baseFontSize: number
): number => {
  const baseWidth = 675; // 기준 너비

  if (imageWidth <= baseWidth) {
    return baseFontSize; // 이미지 너비가 기준보다 작거나 같다면, 기준 폰트 사이즈 반환
  } else {
    // 이미지 너비가 기준 너비보다 클 때, 너비 비율에 따라 폰트 사이즈 증가
    return (imageWidth / baseWidth) * baseFontSize;
  }
};
