import { describe, it, expect } from "vitest";
import {
  generateTotpToken,
  validateBase32Secret,
  generateAllTokens,
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

    expect(tokens).toHaveProperty(testSecret);
    expect(tokens[0].token).toHaveLength(6);
    // Since both accounts have the same secret, they will have the same token
    expect(Object.keys(tokens)).toHaveLength(1);
  });

  it("should handle invalid secrets gracefully", () => {
    const invalidSecret = "INVALID_SECRET!@#";
    const accounts = [
      { name: "valid", secret: testSecret },
      { name: "invalid", secret: invalidSecret },
    ];

    const tokens = generateAllTokens(accounts);

    expect(tokens[0].token).toHaveLength(6);
    expect(tokens[0].token).toBe("Error");
  });
});
