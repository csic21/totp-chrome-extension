import type { TotpAccounts } from "./totp";

export const PINNED_FOCUS_SCRIPT_ID = "totp-pinned-focus-fill";

export const getUniquePinnedHosts = (accounts: TotpAccounts): string[] => [
  ...new Set(
    accounts
      .map((account) => account.activePath?.trim())
      .filter((host): host is string => Boolean(host)),
  ),
];

export const hostnameToMatchPatterns = (hostname: string): string[] => [
  `*://${hostname}/*`,
];

export const hostnameToPermissionOrigins = (hostname: string): string[] => [
  `https://${hostname}/*`,
  `http://${hostname}/*`,
];

export const matchPatternsToOrigins = (patterns: string[]): string[] => {
  const origins = new Set<string>();
  for (const pattern of patterns) {
    const match = pattern.match(/^\*:\/\/([^/]+)\/\*$/);
    if (!match) {
      continue;
    }
    const host = match[1];
    origins.add(`https://${host}/*`);
    origins.add(`http://${host}/*`);
  }
  return [...origins];
};