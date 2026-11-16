import { describe, expect, it } from "vitest";
import {
  getUniquePinnedHosts,
  hostnameToMatchPatterns,
  hostnameToPermissionOrigins,
  matchPatternsToOrigins,
} from "./pinned-hosts";

describe("pinned hosts", () => {
  it("collects unique hostnames", () => {
    expect(
      getUniquePinnedHosts([
        { name: "A", secret: "JBSWY3DPEHPK3PXP", activePath: "github.com" },
        { name: "B", secret: "JBSWY3DPEHPK3PXP", activePath: "github.com" },
        { name: "C", secret: "JBSWY3DPEHPK3PXP", activePath: "example.com" },
      ]),
    ).toEqual(["github.com", "example.com"]);
  });

  it("builds match patterns and permission origins", () => {
    expect(hostnameToMatchPatterns("login.example.com")).toEqual([
      "*://login.example.com/*",
    ]);
    expect(hostnameToPermissionOrigins("login.example.com")).toEqual([
      "https://login.example.com/*",
      "http://login.example.com/*",
    ]);
    expect(matchPatternsToOrigins(["*://github.com/*"])).toEqual([
      "https://github.com/*",
      "http://github.com/*",
    ]);
  });
});