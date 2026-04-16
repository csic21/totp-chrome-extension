import base32Encode from "base32-encode";
import { MigrationPayload } from "./google-migration";

export type ScanImportSource = "qr" | "migration";

export type ScannedAccount = {
  name: string;
  secret: string;
};

export const parseGoogleMigrationPayload = (data: string): ScannedAccount[] => {
  const buffer = Uint8Array.from(atob(data), (char) => char.charCodeAt(0));
  const payload = MigrationPayload.deserializeBinary(buffer);

  return (
    payload
      .toObject()
      .otp_parameters?.flatMap((item) => {
        if (!item.secret || item.secret.length === 0) {
          return [];
        }

        const secret = base32Encode(item.secret as Uint8Array, "RFC4648", {
          padding: false,
        });
        const accountName = item.name || "Imported account";
        const name = item.issuer
          ? `${item.issuer}: ${accountName}`
          : accountName;

        return [{ name, secret }];
      }) || []
  );
};

export const parseQrImportData = (
  data: string,
): { accounts: ScannedAccount[]; source: ScanImportSource } | null => {
  const url = new URL(data);

  if (url.protocol === "otpauth:" && url.hostname === "totp") {
    const issuerAndAccount = url.pathname.substring(1);
    const params = new URLSearchParams(url.search);
    const secret = params.get("secret");

    if (!secret) {
      return null;
    }

    let issuer = "";
    let account = issuerAndAccount;

    if (issuerAndAccount.includes(":")) {
      [issuer, account] = issuerAndAccount.split(":", 2);
    }

    if (params.get("issuer")) {
      issuer = params.get("issuer") || "";
    }

    const name = issuer ? `${issuer}: ${account}` : account;

    return {
      accounts: [{ name, secret }],
      source: "qr",
    };
  }

  if (url.protocol === "otpauth-migration:") {
    return {
      accounts: parseGoogleMigrationPayload(url.searchParams.get("data") || ""),
      source: "migration",
    };
  }

  return null;
};

export const formatImportToastMessage = (
  accounts: ScannedAccount[],
  source: ScanImportSource,
) => {
  const isBatchImport = source === "migration" || accounts.length > 1;

  return isBatchImport
    ? `Imported ${accounts.length} account${accounts.length > 1 ? "s" : ""}`
    : `Imported ${accounts[0].name}`;
};
