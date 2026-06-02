import { describe, expect, it } from "vitest";
import {
  formatImportToastMessage,
  parseGoogleMigrationPayload,
  parseQrImportData,
} from "./qr-import";

const WIRE_TYPE_VARINT = 0;
const WIRE_TYPE_LENGTH_DELIMITED = 2;
const GOOGLE_MIGRATION_FIXTURE =
  "CicKBUhlbGxvEhFhbGljZUBleGFtcGxlLmNvbRoHRXhhbXBsZSABMAIKCwoFV29ybGQgATAC";
const textEncoder = new TextEncoder();

type TestOtpParameter = {
  secret?: Uint8Array;
  name?: string;
  issuer?: string;
  algorithm?: number;
  digits?: number;
  type?: number;
  counter?: number;
};

const encodeVarint = (value: number | bigint): number[] => {
  let nextValue = BigInt(value);
  const bytes: number[] = [];

  do {
    let byte = Number(nextValue & 0x7fn);
    nextValue >>= 7n;

    if (nextValue > 0n) {
      byte |= 0x80;
    }

    bytes.push(byte);
  } while (nextValue > 0n);

  return bytes;
};

const encodeTag = (fieldNumber: number, wireType: number) =>
  encodeVarint((fieldNumber << 3) | wireType);

const encodeLengthDelimitedField = (
  fieldNumber: number,
  value: Uint8Array,
) => [
  ...encodeTag(fieldNumber, WIRE_TYPE_LENGTH_DELIMITED),
  ...encodeVarint(value.length),
  ...value,
];

const encodeStringField = (fieldNumber: number, value: string) =>
  encodeLengthDelimitedField(fieldNumber, textEncoder.encode(value));

const encodeVarintField = (fieldNumber: number, value: number) => [
  ...encodeTag(fieldNumber, WIRE_TYPE_VARINT),
  ...encodeVarint(value),
];

const encodeOtpParameter = (parameter: TestOtpParameter) => {
  const bytes: number[] = [];

  if (parameter.secret) {
    bytes.push(...encodeLengthDelimitedField(1, parameter.secret));
  }
  if (parameter.name !== undefined) {
    bytes.push(...encodeStringField(2, parameter.name));
  }
  if (parameter.issuer !== undefined) {
    bytes.push(...encodeStringField(3, parameter.issuer));
  }
  if (parameter.algorithm !== undefined) {
    bytes.push(...encodeVarintField(4, parameter.algorithm));
  }
  if (parameter.digits !== undefined) {
    bytes.push(...encodeVarintField(5, parameter.digits));
  }
  if (parameter.type !== undefined) {
    bytes.push(...encodeVarintField(6, parameter.type));
  }
  if (parameter.counter !== undefined) {
    bytes.push(...encodeVarintField(7, parameter.counter));
  }

  return new Uint8Array(bytes);
};

const encodeMigrationPayload = (parameters: TestOtpParameter[]) => {
  const bytes = parameters.flatMap((parameter) =>
    encodeLengthDelimitedField(1, encodeOtpParameter(parameter)),
  );

  return btoa(String.fromCharCode(...bytes));
};

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
    const result = parseQrImportData(
      `otpauth-migration://offline?data=${GOOGLE_MIGRATION_FIXTURE}`,
    );

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
    const data = encodeMigrationPayload([
      {
        name: "missing-secret",
      },
      {
        secret: new Uint8Array([65, 66, 67]),
        name: "abc",
      },
    ]);

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
