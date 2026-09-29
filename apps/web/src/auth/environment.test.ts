import { describe, expect, it } from "vitest";
import { detectBrowser, googleFlow, openInBrowserHref, type InAppBrowser, type Os } from "./environment.ts";

// Real user-agent shapes from each app's built-in browser (version numbers vary).
const ANDROID_WV = "Mozilla/5.0 (Linux; Android 14; CPH2621 Build/UP1A.231005.007; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/129.0.6668.100 Mobile Safari/537.36";
const IOS_WK = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148";

const cases: Array<[string, string, Os, InAppBrowser | null]> = [
  ["Instagram, Android", `${ANDROID_WV} Instagram 350.0.0.37.109 Android (34/14; 450dpi; 1080x2412; OnePlus; CPH2621; OP5D0DL1; qcom; en_IN; 650346489)`, "android", "instagram"],
  ["Instagram, iOS", `${IOS_WK} Instagram 339.0.3.12.91 (iPhone15,3; iOS 17_5; en_US; en; scale=3.00; 1290x2796; 618022315)`, "ios", "instagram"],
  ["Threads, iOS", `${IOS_WK} Barcelona 339.0.0.12.91 (iPhone15,3; iOS 17_5; en_US; en; scale=3.00; 1290x2796; 618022316)`, "ios", "threads"],
  ["Facebook, Android", `${ANDROID_WV} [FB_IAB/FB4A;FBAV/475.0.0.43.109;]`, "android", "facebook"],
  ["Facebook, iOS", `${IOS_WK} [FBAN/FBIOS;FBAV/470.0.0.35.103;FBBV/617043890;FBDV/iPhone15,3;FBMD/iPhone;FBSN/iOS;FBSV/17.5;FBSS/3;FBID/phone;FBLC/en_US;FBOP/5;FBRV/0]`, "ios", "facebook"],
  ["Messenger, Android", `${ANDROID_WV} [FB_IAB/MESSENGER;FBAV/465.0.0.48.109;]`, "android", "messenger"],
  ["Messenger, iOS", `${IOS_WK} [FBAN/MessengerForiOS;FBAV/465.0.0.39.108;FBBV/609383434;FBDV/iPhone15,3;FBMD/iPhone;FBSN/iOS;FBSV/17.5]`, "ios", "messenger"],
  ["TikTok, Android", `${ANDROID_WV} trill_2023501030 JsSdk/1.0 NetType/WIFI Channel/googleplay AppName/musical_ly app_version/35.1.3 ByteLocale/en BytedanceWebview/d8a21c6`, "android", "tiktok"],
  ["TikTok, iOS", `${IOS_WK} musical_ly_35.1.0 JsSdk/2.0 NetType/WIFI Channel/App Store ByteLocale/en Region/US`, "ios", "tiktok"],
  ["LinkedIn, iOS", `${IOS_WK} [LinkedInApp]/9.30.1`, "ios", "linkedin"],
  ["Snapchat, iOS", `${IOS_WK} Snapchat/13.10.0.36 (iPhone15,3; iOS 17.5; gzip)`, "ios", "snapchat"],
  ["Pinterest, iOS", `${IOS_WK} [Pinterest/iOS]`, "ios", "pinterest"],
  ["LINE, Android", `${ANDROID_WV} Line/14.10.1`, "android", "line"],
  ["WeChat, Android", `${ANDROID_WV} MMWEBID/1234 MicroMessenger/8.0.49.2600(0x28003133) WeChat/arm64`, "android", "wechat"],
  ["Another app's webview, Android", ANDROID_WV, "android", "webview"],
  ["Another app's webview, iOS", IOS_WK, "ios", "webview"],
  ["Chrome on Android (also Custom Tabs from X/Reddit)", "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Mobile Safari/537.36", "android", null],
  ["Safari on iPhone", "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1", "ios", null],
  ["Chrome on iPhone", "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/129.0.6668.69 Mobile/15E148 Safari/604.1", "ios", null],
  ["Chrome on a Mac", "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36", "other", null],
];

describe("detectBrowser", () => {
  it.each(cases)("%s", (_name, ua, os, inApp) => {
    expect(detectBrowser(ua, false)).toEqual({ os, inApp, standalone: false });
  });

  it("doesn't mistake an iPhone home-screen app for a webview", () => {
    expect(detectBrowser(IOS_WK, true)).toEqual({ os: "ios", inApp: null, standalone: true });
  });
});

describe("googleFlow", () => {
  it("uses a popup in browsers, a redirect in the installed app, and nothing in in-app browsers", () => {
    expect(googleFlow({ os: "other", inApp: null, standalone: false })).toBe("popup");
    expect(googleFlow({ os: "android", inApp: null, standalone: true })).toBe("redirect");
    expect(googleFlow({ os: "android", inApp: "instagram", standalone: false })).toBe("blocked");
  });
});

describe("openInBrowserHref", () => {
  const url = "https://example.com/login/?next=%2Fapp%2F";
  it("sends Android to Chrome, falling back to the same page", () => {
    expect(openInBrowserHref(url, "android")).toBe(
      "intent://example.com/login/?next=%2Fapp%2F#Intent;scheme=https;package=com.android.chrome;" +
        "S.browser_fallback_url=https%3A%2F%2Fexample.com%2Flogin%2F%3Fnext%3D%252Fapp%252F;end",
    );
  });
  it("sends iOS to Safari", () => {
    expect(openInBrowserHref(url, "ios")).toBe(`x-safari-${url}`);
  });
  it("has nothing for other systems", () => {
    expect(openInBrowserHref(url, "other")).toBeNull();
  });
});
