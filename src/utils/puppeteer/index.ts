import puppeteer from "puppeteer-extra";
import AnonymizeUAPlugin from "puppeteer-extra-plugin-anonymize-ua";
/*electron에서는 adblocker 플러그인이 로드시 에러를 뱉는다. 해결방법으로는 파일을 수동으로 핸들링해서 사용한다.*/
/*resolve vite.main.config 에서 사전에 로드한다. */
import AdBlockerPlugin from "puppeteer-extra-plugin-adblocker";
import BlockResourcePlugin from "puppeteer-extra-plugin-block-resources";
import { Browser, KnownDevices, Page } from "puppeteer";
import { app } from "electron";
import path from "path";
import { BrowserProps } from "./interface";

export const createBrowser = async ({
  blockResources,
  dirPrefix,
  permission,
  username,
}: BrowserProps) => {
  puppeteer.use(AnonymizeUAPlugin({ stripHeadless: true }));
  puppeteer.use(AdBlockerPlugin({ blockTrackers: true }));
  puppeteer.use(
    BlockResourcePlugin({ blockedTypes: new Set([...blockResources]) })
  );

  const args: string[] = [
    "--disable-gpu",
    "--disable-notifications",
    "--start-maximized",
    "--no-sandbox",
    "--disable-setuid-sandbox",
    "--disable-web-security",
    "--disable-popup-blocking",
    "--enable-features=NetworkService,NetworkServiceInProcess",
    "--lang=en",
  ];
  const headless = MAIN_WINDOW_VITE_DEV_SERVER_URL ? false : "shell";
  if (dirPrefix) {
    const dataPath = MAIN_WINDOW_VITE_DEV_SERVER_URL
      ? path.join("src", "__dev__", `${dirPrefix}-${username}`)
      : path.join(app.getPath("userData"), `${dirPrefix}-${username}`);
    const userDataDir = `--user-data-dir=${dataPath}`;
    args.push(userDataDir);
  }

  const browser = await puppeteer.launch({
    headless,
    args,
  });

  if (permission) {
    const { origin, permissions } = permission;
    const context = browser.defaultBrowserContext();
    await context.overridePermissions(origin, permissions);
  }
  return browser;
};

export const createPage = async (browser: Browser, isMobile: boolean) => {
  const MAC_USER_AGENT =
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_14_6) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/85.0.4182.0 Safari/537.36";
  const WINDOWS_USER_AGENT =
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/90.0.4430.212 Safari/537.36";
  const page = await browser.newPage();

  await page.setBypassCSP(true);

  // 브라우저의 User-Agent 문자열 가져오기
  const getUserAgent = await page.evaluate(() => window.navigator.userAgent);
  // User-Agent 문자열에 "Headless" 키워드가 포함되어 있는지 확인

  if (!getUserAgent.includes("Headless")) {
    const iPhone = KnownDevices["iPhone 13 Pro Max"];
    await page.emulate(iPhone);
    // await page.setUserAgent(MAC_USER_AGENT);
    // await page.setViewport({ width: 1920, height: 1080 });
  }
  return page;
};

// export const waitForXPath = async (page: Page) => {
//   page.
//   await page.waitForXPath("//button[contains(., 'Log in')]");
// };

export const isSignForInstagram = async (page: Page) => {
  try {
    return await page.waitForSelector("#loginForm", { timeout: 3000 });
  } catch (e) {
    return undefined;
  }
};

export const waitFor = async (ms: number) => {
  // 3초(3000ms)와 5초(5000ms) 사이에서 랜덤한 시간(밀리초 단위)을 생성
  const randomTime = Math.random() * (2500 - 1500) + 1500;

  // 생성된 랜덤 시간을 기존 시간에 추가
  const totalTime = ms + randomTime;
  return new Promise((resolve) => setTimeout(resolve, totalTime));
};

export const checkDismiss = async (page: Page, url: string) => {
  try {
    const dismissElHandle = await page.waitForSelector(
      "[aria-label^='Dismiss']",
      { timeout: 2000 }
    );
    await dismissElHandle.click();
    await page.waitForNavigation({ waitUntil: "networkidle2" });
    await page.goto(url, { waitUntil: "networkidle2" });
  } catch {}
};
