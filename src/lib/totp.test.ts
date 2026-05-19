import { describe, it, expect, vi, afterEach } from "vitest";
import {
  generateTotpToken,
  validateBase32Secret,
  generateAllTokens,
  getTotpRemainingTime,
  getTotpTimeStep,
  getNextTotpTimerDelay,
  shouldRefreshTotpTokens,
} from "./totp";

describe("TOTP Utility Functions", () => {
  // Test with a known test vector from RFC 6238
  // Seed: 0x31323334353637383930313234353637383930 (ASCII "12345678901234567890")
  const testSecret = "GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ"; // Base32 encoding of the above seed

  it("should generate a valid TOTP token", () => {
    const result = generateTotpToken(testSecret, 30, 6, "SHA1");
    expect(result.token).toHaveLength(6);
    expect(typeof result.token).toBe("string");
    expect(result.remainingTime).toBeGreaterThanOrEqual(0);
    expect(result.remainingTime).toBeLessThanOrEqual(30);
  });

  it("should validate a correct Base32 secret", () => {
    expect(validateBase32Secret(testSecret)).toBe(true);
  });

  it("should reject an invalid Base32 secret", () => {
    expect(validateBase32Secret("INVALID_SECRET!@#")).toBe(false);
    expect(validateBase32Secret("")).toBe(false);
    expect(validateBase32Secret("ABC")).toBe(true); // Padding is optional in otpauth
  });

  it("should generate tokens for multiple accounts", () => {
    const accounts = [
      { name: "account1", secret: testSecret },
      { name: "account2", secret: testSecret },
    ];

    const tokens = generateAllTokens(accounts);

    expect(tokens).toHaveLength(2);
    expect(tokens[0].token).toHaveLength(6);
    expect(tokens[1].token).toHaveLength(6);
    // Since both accounts have the same secret, they will have the same token
    expect(tokens[0].token).toBe(tokens[1].token);
  });

  it("should handle invalid secrets gracefully", () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);

    const invalidSecret = "INVALID_SECRET!@#";
    const accounts = [
      { name: "valid", secret: testSecret },
      { name: "invalid", secret: invalidSecret },
    ];

    const tokens = generateAllTokens(accounts);

    expect(tokens[0].token).toHaveLength(6);
    expect(tokens[1].token).toBe("Error");
  });

  it("should refresh generated tokens only when the TOTP time step changes", () => {
    const twelveSeconds = 12_000;
    const twentyNineSeconds = 29_000;
    const thirtySeconds = 30_000;

    expect(getTotpTimeStep(twelveSeconds)).toBe(0);
    expect(getTotpTimeStep(twentyNineSeconds)).toBe(0);
    expect(getTotpTimeStep(thirtySeconds)).toBe(1);

    expect(getTotpRemainingTime(twelveSeconds)).toBe(18);
    expect(getTotpRemainingTime(twentyNineSeconds)).toBe(1);
    expect(getTotpRemainingTime(thirtySeconds)).toBe(30);

    expect(shouldRefreshTotpTokens(0, twentyNineSeconds)).toBe(false);
    expect(shouldRefreshTotpTokens(0, thirtySeconds)).toBe(true);
    expect(shouldRefreshTotpTokens(undefined, twelveSeconds)).toBe(true);
  });

  it("should schedule timer ticks just after the next second boundary", () => {
    expect(getNextTotpTimerDelay(29_900)).toBe(120);
    expect(getNextTotpTimerDelay(30_000)).toBe(1020);
    expect(getNextTotpTimerDelay(30_999)).toBe(21);
  });
});
  afterEach(() => {
    vi.restoreAllMocks();
  });
