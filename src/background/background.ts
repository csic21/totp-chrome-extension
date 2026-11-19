// Background script for the extension
// This script runs in the background and can handle events, manage storage, etc.
import { fillCodeInPage, watchOtpFocus } from "../lib/otp-autofill";
import { generateTotpToken, type TotpAccount } from "../lib/totp";

// Autofill on pinned sites. Tab URLs are only visible for sites the user
// granted access to, so unpermitted sites are skipped automatically.
const findPinnedAccount = async (url?: string) => {
  if (!url) return undefined;

  let hostname: string;
  try {
    hostname = new URL(url).hostname;
  } catch {
    return undefined;
  }

  const { totpAccounts } = (await chrome.storage.sync.get("totpAccounts")) as {
    totpAccounts?: TotpAccount[];
  };
  return Array.isArray(totpAccounts)
    ? totpAccounts.find((account) => account.activePath === hostname)
    : undefined;
};

const watchPinnedTab = async (tab: chrome.tabs.Tab) => {
  if (!tab.id || !(await findPinnedAccount(tab.url))) return;

  await chrome.scripting
    .executeScript({
      target: { tabId: tab.id, allFrames: true },
      func: watchOtpFocus,
    })
    .catch(() => {});
};

const autofillPinnedTab = async ({ tab, frameId }: chrome.runtime.MessageSender) => {
  const account = await findPinnedAccount(tab?.url);
  if (!tab?.id || !account) return;

  await chrome.scripting
    .executeScript({
      target: { tabId: tab.id, frameIds: [frameId ?? 0] },
      func: fillCodeInPage,
      args: [generateTotpToken(account.secret).token, true],
    })
    .catch(() => {});
};

chrome.tabs.onUpdated.addListener((_tabId, { status }, tab) => {
  if (status === "complete") void watchPinnedTab(tab);
});

// Start watching already-open tabs as soon as access is granted.
chrome.permissions.onAdded.addListener(async () => {
  for (const tab of await chrome.tabs.query({})) void watchPinnedTab(tab);
});

// Handle messages from content scripts or popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "autofillOtp") {
    void autofillPinnedTab(sender);
    return false;
  }

  if (request.action === "scanCurrentTab") {
    // Capture visible tab and scan for QR code
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
    // Return true to indicate we will send a response asynchronously
    return true;
  }

  // Return false for unknown messages
  return false;
});

// Function to capture visible tab and scan for QR codes
async function captureAndScanTab(): Promise<string> {
  try {
    // Get the active tab
    const [tab] = await chrome.tabs.query({
      active: true,
      currentWindow: true,
    });

    if (!tab || !tab.id) {
      throw new Error("No active tab found");
    }

    // Capture visible tab
    const dataUrl = await chrome.tabs.captureVisibleTab(tab.windowId, {
      format: "png",
    });

    // Process the captured image to scan for QR codes
    return dataUrl;
  } catch (error: any) {
    console.error("Error capturing tab:", error);
    throw new Error(`Failed to capture tab: ${error.message}`);
  }
}
