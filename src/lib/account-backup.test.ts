import { describe, expect, it } from "vitest";
import {
  AccountBackupError,
  applyBackupImport,
  buildBackupFilename,
  createBackupFile,
  formatBackupExportMessage,
  formatBackupImportMessage,
  readBackupText,
} from "./account-backup";
import type { TotpAccount } from "./totp";

const githubSecret = "JBSWY3DPEHPK3PXP";
const mailSecret = "GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ";

const githubAccount: TotpAccount = {
  name: "GitHub",
  secret: githubSecret,
  activePath: "github.com",
  originIndex: 2,
};

describe("account backup", () => {
  it("exports name, secret, and activePath without runtime fields", () => {
    const exportedAt = "2026-11-16T03:18:00.000Z";
    const file = createBackupFile(
      [githubAccount, { name: "Mail", secret: mailSecret, originIndex: 4 }],
      exportedAt,
    );

    expect(file).toEqual({
      version: 1,
      exportedAt,
      accounts: [
        {
          name: "GitHub",
          secret: githubSecret,
          activePath: "github.com",
        },
        {
          name: "Mail",
          secret: mailSecret,
        },
      ],
    });
    expect(JSON.stringify(file)).not.toContain("originIndex");
  });

  it("builds a local timestamp filename", () => {
    expect(buildBackupFilename(new Date(2026, 10, 16, 11, 5))).toBe(
      "totp-backup-20261116-1105.json",
    );
  });

  it("reads a backup and keeps the domain pin", () => {
    const text = JSON.stringify(
      createBackupFile([githubAccount], "2026-11-16T03:18:00.000Z"),
    );

    expect(readBackupText(`\uFEFF${text}`)).toEqual([
      {
        name: "GitHub",
        secret: githubSecret,
        activePath: "github.com",
      },
    ]);
  });

  it("drops runtime fields that were pasted into a backup account", () => {
    expect(
      readBackupText(
        JSON.stringify({
          version: 1,
          accounts: [
            {
              name: " GitHub ",
              secret: ` ${githubSecret} `,
              activePath: " github.com ",
              originIndex: 9,
              token: "123456",
            },
          ],
        }),
      ),
    ).toEqual([
      {
        name: "GitHub",
        secret: githubSecret,
        activePath: "github.com",
      },
    ]);
  });

  it("rejects invalid JSON, empty files, bad secrets, and bad domain pins", () => {
    expect(() => readBackupText("{")).toThrow(AccountBackupError);
    expect(() => readBackupText("{")).toThrow(
      "The backup file is not valid JSON.",
    );
    expect(() => readBackupText("[]")).toThrow(
      "The backup file is not a TOTP backup.",
    );
    expect(() =>
      readBackupText(JSON.stringify({ version: 2, accounts: [] })),
    ).toThrow("This backup uses an unsupported format.");
    expect(() =>
      readBackupText(JSON.stringify({ version: 1, accounts: [] })),
    ).toThrow("The backup file has no accounts.");
    expect(() =>
      readBackupText(
        JSON.stringify({
          version: 1,
          accounts: [{ name: "GitHub", secret: "INVALID_SECRET!@#" }],
        }),
      ),
    ).toThrow("Account 1 needs a name and a valid Base32 secret.");
    expect(() =>
      readBackupText(
        JSON.stringify({
          version: 1,
          accounts: [{ name: "   ", secret: githubSecret }],
        }),
      ),
    ).toThrow("Account 1 needs a name and a valid Base32 secret.");
    expect(() =>
      readBackupText(
        JSON.stringify({
          version: 1,
          accounts: [
            { name: "GitHub", secret: githubSecret, activePath: 12 },
          ],
        }),
      ),
    ).toThrow("Account 1 has an invalid domain pin.");
  });

  it("merges by secret and keeps the saved account unchanged", () => {
    const result = applyBackupImport(
      [githubAccount],
      [
        {
          name: "GitHub renamed",
          secret: githubSecret.toLowerCase(),
          activePath: "example.com",
        },
        {
          name: "Mail",
          secret: mailSecret,
          activePath: "mail.example",
        },
        {
          name: "Mail duplicate",
          secret: `${mailSecret}=`,
          activePath: "other.example",
        },
      ],
      "merge",
    );

    expect(result.importedCount).toBe(1);
    expect(result.skippedCount).toBe(2);
    expect(result.accounts).toEqual([
      githubAccount,
      {
        name: "Mail",
        secret: mailSecret,
        activePath: "mail.example",
      },
    ]);
    expect(formatBackupImportMessage("merge", result)).toBe(
      "Imported 1 account. Skipped 2 duplicate secrets.",
    );
  });

  it("reports a merge where every secret already exists", () => {
    const result = applyBackupImport(
      [githubAccount],
      [{ name: "GitHub", secret: githubSecret, activePath: "github.com" }],
      "merge",
    );

    expect(result.accounts).toEqual([githubAccount]);
    expect(formatBackupImportMessage("merge", result)).toBe(
      "No new accounts. Every secret is already saved.",
    );
  });

  it("replaces the saved accounts and keeps imported domain pins", () => {
    const result = applyBackupImport(
      [githubAccount],
      [
        {
          name: "Mail",
          secret: mailSecret,
          activePath: "mail.example",
        },
        {
          name: "Mail duplicate",
          secret: mailSecret.toLowerCase(),
        },
      ],
      "replace",
    );

    expect(result).toEqual({
      accounts: [
        {
          name: "Mail",
          secret: mailSecret,
          activePath: "mail.example",
        },
      ],
      importedCount: 1,
      skippedCount: 1,
    });
    expect(formatBackupImportMessage("replace", result)).toBe(
      "Replaced your accounts with 1 account.",
    );
  });

  it("warns that an export contains plaintext secrets", () => {
    expect(formatBackupExportMessage(2)).toBe(
      "Exported 2 accounts. The file contains plaintext secrets. Store it securely.",
    );
  });
});
