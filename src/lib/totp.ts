import { TOTP, Secret } from "otpauth";

export interface TotpAccount {
  name: string;
  secret: string;
  // init sort by active hostname
  activePath?: string;

  // save accounts sort index
  originIndex?: number;
}

export interface TotpToken {
  token: string;
  remainingTime: number;
}

export type TotpAccounts = TotpAccount[];

export const DEFAULT_TOTP_PERIOD = 30;
export const TIMER_BOUNDARY_BUFFER_MS = 20;

export function getTotpRemainingTime(
  timestamp: number = Date.now(),
  period: number = DEFAULT_TOTP_PERIOD,
): number {
  return period - (Math.floor(timestamp / 1000) % period);
}

export function getTotpTimeStep(
  timestamp: number = Date.now(),
  period: number = DEFAULT_TOTP_PERIOD,
): number {
  return Math.floor(Math.floor(timestamp / 1000) / period);
}

export function shouldRefreshTotpTokens(
  previousTimeStep: number | undefined,
  timestamp: number = Date.now(),
  period: number = DEFAULT_TOTP_PERIOD,
): boolean {
  return previousTimeStep !== getTotpTimeStep(timestamp, period);
}

export function getNextTotpTimerDelay(
  timestamp: number = Date.now(),
  boundaryBufferMs: number = TIMER_BOUNDARY_BUFFER_MS,
): number {
  const millisecondsIntoSecond = timestamp % 1000;
  const millisecondsUntilNextSecond =
    millisecondsIntoSecond === 0 ? 1000 : 1000 - millisecondsIntoSecond;

  return millisecondsUntilNextSecond + boundaryBufferMs;
}

/**
 * Generate a TOTP token for a given account
 * @param secret The Base32 encoded secret
 * @param period The token period in seconds (default: 30)
 * @param digits The number of digits in the token (default: 6)
 * @param algorithm The hashing algorithm (default: 'SHA1')
 * @returns The generated token and remaining time
 */
export function generateTotpToken(
  secret: string,
  period: number = DEFAULT_TOTP_PERIOD,
  digits: number = 6,
  algorithm: string = "SHA1",
  timestamp: number = Date.now(),
): TotpToken {
  try {
    const totp = new TOTP({
      secret: Secret.fromBase32(secret),
      digits,
      period,
      algorithm,
    });

    const token = totp.generate({ timestamp });
    const remainingTime = getTotpRemainingTime(timestamp, totp.period);

    return { token, remainingTime };
  } catch (error) {
    console.error("Error generating TOTP token:", error);
    return { token: "Error", remainingTime: 0 };
  }
}

/**
 * Validate a Base32 encoded secret
 * @param secret The Base32 encoded secret to validate
 * @returns True if the secret is valid, false otherwise
 */
export function validateBase32Secret(secret: string): boolean {
  if (!secret || secret.length === 0) {
    return false;
  }

  try {
    Secret.fromBase32(secret);
    return true;
  } catch (error) {
    return false;
  }
}

/**
 * Generate tokens for all accounts
 * @param accounts The accounts to generate tokens for
 * @returns An object mapping account secrets to their tokens and remaining times
 */
export function generateAllTokens(
  accounts: TotpAccounts,
  timestamp: number = Date.now(),
): TotpToken[] {
  const tokens: TotpToken[] = [];

  for (const index in accounts) {
    try {
      const totp = new TOTP({
        secret: Secret.fromBase32(accounts[index].secret),
        digits: 6,
        period: 30,
        algorithm: "SHA1",
      });

      const token = totp.generate({ timestamp });
      const remainingTime = getTotpRemainingTime(timestamp, totp.period);

      tokens[index] = { token, remainingTime };
    } catch (error) {
      console.error(
        `Failed to generate token for ${accounts[index].name}:`,
        error
      );
      tokens[index] = { token: "Error", remainingTime: 0 };
    }
  }

  return tokens;
}
