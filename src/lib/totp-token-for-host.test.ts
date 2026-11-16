import { describe, expect, it } from "vitest";
import { resolveTotpTokenForHost } from "./totp-token-for-host";

const githubSecret = "JBSWY3DPEHPK3PXP";

describe("resolveTotpTokenForHost", () => {
  it("returns a token when one account matches the host", () => {
    const result = resolveTotpTokenForHost(
      [{ name: "GitHub", secret: githubSecret, activePath: "github.com" }],
      "github.com",
    );

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.token).toMatch(/^\d{6}$/);
    }
  });

  it("rejects when no host matches", () => {
    expect(
      resolveTotpTokenForHost(
        [{ name: "GitHub", secret: githubSecret, activePath: "github.com" }],
        "example.com",
      ),
    ).toEqual({ success: false, reason: "none" });
  });

  it("rejects when multiple accounts share a host", () => {
    expect(
      resolveTotpTokenForHost(
        [
          { name: "Work", secret: githubSecret, activePath: "example.com" },
          { name: "Personal", secret: githubSecret, activePath: "example.com" },
        ],
        "example.com",
      ),
    ).toEqual({ success: false, reason: "ambiguous" });
  });
});