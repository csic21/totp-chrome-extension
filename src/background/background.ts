import { fillOtpInTab, isFillableTabUrl } from "../lib/fill-otp-tab";
import {
  loadAccountsFromStorage,
  syncPinnedFocusFromStorage,
} from "../lib/pinned-content-scripts";
import { resolveTotpTokenForHost } from "../lib/totp-token-for-host";

chrome.runtime.onInstalled.addListener(() => {
  void syncPinnedFocusFromStorage();
});

chrome.runtime.onStartup.addListener(() => {
  void syncPinnedFocusFromStorage();
});

chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName !== "sync" || !changes.totpAccounts) {
    return;
  }

  void syncPinnedFocusFromStorage();
});

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "scanCurrentTab") {
    captureAndScanTab()
      .then((result) => {
        sendResponse({
          success: true,
          data: result,
        });
      })
      .catch((error) => {
        console.error("Error scanning current tab:", error);
        sendResponse({ success: false, error: error.message });
      });
    return true;
  }

  if (request.action === "fillOtp") {
    handleFillOtp(request.token, request.tabId)
      .then((result) => {
        sendResponse({ success: true, result });
      })
      .catch((error: Error) => {
        console.error("Error filling OTP:", error);
        sendResponse({ success: false, error: error.message });
      });
    return true;
  }

  if (request.action === "totpTokenForHostname") {
    void handleTotpTokenForHostname(request.hostname, sender).then(sendResponse);
    return true;
  }

  if (request.action === "syncPinnedScripts") {
    void syncPinnedFocusFromStorage()
      .then(() => {
        sendResponse({ success: true });
      })
      .catch((error: Error) => {
        console.error("Error syncing pinned scripts:", error);
        sendResponse({ success: false, error: error.message });
      });
    return true;
  }

  return false;
});

async function handleTotpTokenForHostname(
  hostname: unknown,
  sender: chrome.runtime.MessageSender,
) {
  if (typeof hostname !== "string" || !hostname) {
    return { success: false, reason: "invalid_hostname" };
  }

  if (!sender.tab?.url) {
    return { success: false, reason: "missing_tab" };
  }

  let tabHostname: string;
  try {
    tabHostname = new URL(sender.tab.url).hostname;
  } catch {
    return { success: false, reason: "invalid_tab_url" };
  }

  if (tabHostname !== hostname) {
    return { success: false, reason: "hostname_mismatch" };
  }

  if (!isFillableTabUrl(sender.tab.url)) {
    return { success: false, reason: "restricted_page" };
  }

  const accounts = await loadAccountsFromStorage();
  const result = resolveTotpTokenForHost(accounts, hostname);
  if (!result.success) {
    return result;
  }

  return { success: true, token: result.token };
}

async function handleFillOtp(token: unknown, tabId?: number) {
  if (typeof token !== "string" || !token) {
    throw new Error("Invalid token");
  }

  const resolvedTabId =
    typeof tabId === "number"
      ? tabId
      : (await chrome.tabs.query({ active: true, currentWindow: true }))[0]?.id;

  if (!resolvedTabId) {
    throw new Error("No active tab found");
  }

  const tab = await chrome.tabs.get(resolvedTabId);
  if (!isFillableTabUrl(tab.url)) {
    throw new Error("This page cannot be filled automatically");
  }

  return fillOtpInTab(resolvedTabId, token);
}

async function captureAndScanTab(): Promise<string> {
  try {
    const [tab] = await chrome.tabs.query({
      active: true,
      currentWindow: true,
    });

    if (!tab || !tab.id) {
      throw new Error("No active tab found");
    }

    const dataUrl = await chrome.tabs.captureVisibleTab(tab.windowId, {
      format: "png",
    });

    return dataUrl;
  } catch (error: unknown) {
    console.error("Error capturing tab:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    throw new Error(`Failed to capture tab: ${message}`);
  }
}