import { describe, expect, it } from "vitest";
import {
  formatImportToastMessage,
  parseGoogleMigrationPayload,
  parseQrImportData,
} from "./qr-import";
import { MigrationPayload } from "./google-migration";

describe("QR import helpers", () => {
  it("parses a standard otpauth TOTP URI", () => {
    const result = parseQrImportData(
      "otpauth://totp/demo@example.com?secret=JBSWY3DPEHPK3PXP&issuer=Vault",
    );

    expect(result).toEqual({
      accounts: [
        {
          name: "Vault: demo@example.com",
          secret: "JBSWY3DPEHPK3PXP",
        },
      ],
      source: "qr",
    });
  });

  it("parses Google Authenticator migration exports into multiple accounts", () => {
    const payload = new MigrationPayload({
      otp_parameters: [
        new MigrationPayload.OtpParameters({
          secret: new Uint8Array([72, 101, 108, 108, 111]),
          name: "alice@example.com",
          issuer: "Example",
          type: MigrationPayload.OtpType.OTP_TOTP,
          algorithm: MigrationPayload.Algorithm.ALGO_SHA1,
        }),
        new MigrationPayload.OtpParameters({
          secret: new Uint8Array([87, 111, 114, 108, 100]),
          type: MigrationPayload.OtpType.OTP_TOTP,
          algorithm: MigrationPayload.Algorithm.ALGO_SHA1,
        }),
      ],
    });
    const data = btoa(String.fromCharCode(...payload.serializeBinary()));

    const result = parseQrImportData(`otpauth-migration://offline?data=${data}`);

    expect(result).toEqual({
      accounts: [
        {
          name: "Example: alice@example.com",
          secret: "JBSWY3DP",
        },
        {
          name: "Imported account",
          secret: "K5XXE3DE",
        },
      ],
      source: "migration",
    });
  });

  it("returns all valid migration accounts and skips entries without secrets", () => {
    const payload = new MigrationPayload({
      otp_parameters: [
        new MigrationPayload.OtpParameters({
          name: "missing-secret",
        }),
        new MigrationPayload.OtpParameters({
          secret: new Uint8Array([65, 66, 67]),
          name: "abc",
        }),
      ],
    });
    const data = btoa(String.fromCharCode(...payload.serializeBinary()));

    expect(parseGoogleMigrationPayload(data)).toEqual([
      {
        name: "abc",
        secret: "IFBEG",
      },
    ]);
  });

  it("formats singular and batch import toast messages", () => {
    expect(
      formatImportToastMessage(
        [{ name: "Vault: demo@example.com", secret: "JBSWY3DPEHPK3PXP" }],
        "qr",
      ),
    ).toBe("Imported Vault: demo@example.com");

    expect(
      formatImportToastMessage(
        [
          { name: "one", secret: "A" },
          { name: "two", secret: "B" },
        ],
        "migration",
      ),
    ).toBe("Imported 2 accounts");
  });
});
