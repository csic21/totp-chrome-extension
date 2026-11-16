import { generateTotpToken } from "./totp";
import type { TotpAccounts } from "./totp";

export type TotpTokenForHostResult =
  | { success: true; token: string }
  | {
      success: false;
      reason: "none" | "ambiguous" | "invalid_secret" | "no_accounts";
    };

export const resolveTotpTokenForHost = (
  accounts: TotpAccounts,
  hostname: string,
): TotpTokenForHostResult => {
  if (!Array.isArray(accounts) || accounts.length === 0) {
    return { success: false, reason: "no_accounts" };
  }

  const matches = accounts.filter(
    (account) => account.activePath?.trim() === hostname,
  );

  if (matches.length === 0) {
    return { success: false, reason: "none" };
  }

  if (matches.length > 1) {
    return { success: false, reason: "ambiguous" };
  }

  const token = generateTotpToken(matches[0].secret);
  if (token.token === "Error") {
    return { success: false, reason: "invalid_secret" };
  }

  return { success: true, token: token.token };
};