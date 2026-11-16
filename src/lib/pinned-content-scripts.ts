import { filterHostsWithPermission } from "./pinned-host-permissions";
import { isFillableTabUrl } from "./fill-otp-tab";
import {
  getUniquePinnedHosts,
  hostnameToMatchPatterns,
  PINNED_FOCUS_SCRIPT_ID,
} from "./pinned-hosts";
import type { TotpAccounts } from "./totp";

const FOCUS_FILL_SCRIPT = "content/focus-fill-otp.js";

const getMatchPatterns = (hosts: string[]): string[] => [
  ...new Set(hosts.flatMap((host) => hostnameToMatchPatterns(host))),
];

const getHostname = (url: string): string | undefined => {
  try {
    return new URL(url).hostname;
  } catch {
    return undefined;
  }
};

export const injectFocusFillIntoOpenTabs = async (
  hosts: string[],
): Promise<void> => {
  const allowedHosts = new Set(await filterHostsWithPermission(hosts));
  if (allowedHosts.size === 0) {
    return;
  }

  const tabs = await chrome.tabs.query({});
  for (const tab of tabs) {
    if (!tab.id || !tab.url || !isFillableTabUrl(tab.url)) {
      continue;
    }

    const hostname = getHostname(tab.url);
    if (!hostname || !allowedHosts.has(hostname)) {
      continue;
    }

    try {
      await chrome.scripting.executeScript({
        target: { tabId: tab.id, allFrames: true },
        files: [FOCUS_FILL_SCRIPT],
      });
    } catch {
      // Skip tabs that are still loading or block scripting.
    }
  }
};

export const syncPinnedFocusContentScripts = async (
  accounts: TotpAccounts,
): Promise<void> => {
  const pinnedHosts = getUniquePinnedHosts(accounts);
  const hostsWithPermission = await filterHostsWithPermission(pinnedHosts);
  const matches = getMatchPatterns(hostsWithPermission);

  try {
    await chrome.scripting.unregisterContentScripts({
      ids: [PINNED_FOCUS_SCRIPT_ID],
    });
  } catch {
    // Not registered yet.
  }

  if (matches.length > 0) {
    await chrome.scripting.registerContentScripts([
      {
        id: PINNED_FOCUS_SCRIPT_ID,
        js: [FOCUS_FILL_SCRIPT],
        matches,
        runAt: "document_idle",
        allFrames: true,
        persistAcrossSessions: true,
      },
    ]);
  }

  await injectFocusFillIntoOpenTabs(hostsWithPermission);
};

export const loadAccountsFromStorage = async (): Promise<TotpAccounts> => {
  const result = (await chrome.storage.sync.get("totpAccounts")) as {
    totpAccounts?: TotpAccounts;
  };

  return Array.isArray(result.totpAccounts) ? result.totpAccounts : [];
};

export const syncPinnedFocusFromStorage = async (): Promise<void> => {
  const accounts = await loadAccountsFromStorage();
  await syncPinnedFocusContentScripts(accounts);
};