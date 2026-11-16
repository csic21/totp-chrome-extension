import type { FillOtpResult } from "./otp-field";

export type FillOtpTabResult = FillOtpResult & {
  frameId?: number;
};

const RESTRICTED_URL_PREFIXES = [
  "chrome://",
  "chrome-extension://",
  "edge://",
  "about:",
  "devtools://",
];

export function isFillableTabUrl(url: string | undefined): boolean {
  if (!url) {
    return false;
  }

  return !RESTRICTED_URL_PREFIXES.some((prefix) => url.startsWith(prefix));
}

const FILL_SCRIPT_PATH = "content/fill-otp.js";

function aggregateFrameResults(
  results: chrome.scripting.InjectionResult<FillOtpResult | undefined>[],
): FillOtpTabResult {
  for (const entry of results) {
    const value = entry.result;
    if (value?.ok) {
      return { ...value, frameId: entry.frameId };
    }
  }

  const first = results.find((entry) => entry.result)?.result;
  if (first) {
    return first;
  }

  return { ok: false, reason: "no_input" };
}

export async function fillOtpInTab(
  tabId: number,
  token: string,
): Promise<FillOtpTabResult> {
  const target: chrome.scripting.InjectionTarget = {
    tabId,
    allFrames: true,
  };

  await chrome.scripting.executeScript({
    target,
    files: [FILL_SCRIPT_PATH],
  });

  const results = await chrome.scripting.executeScript({
    target,
    func: (code: string) => {
      const fill = window.__totpAuthenticatorFill;
      if (!fill) {
        return { ok: false as const, reason: "no_input" as const };
      }
      return fill(code);
    },
    args: [token],
  });

  return aggregateFrameResults(results);
}