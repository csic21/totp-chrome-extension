import {
  validateBase32Secret,
  type TotpAccount,
  type TotpAccounts,
} from "./totp";

export const BACKUP_VERSION = 1;

export interface TotpBackupAccount {
  name: string;
  secret: string;
  activePath?: string;
}

export interface TotpBackupFile {
  version: number;
  exportedAt: string;
  accounts: TotpBackupAccount[];
}

export type ImportMode = "merge" | "replace";

export interface BackupImportResult {
  accounts: TotpAccounts;
  importedCount: number;
  skippedCount: number;
}

export class AccountBackupError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AccountBackupError";
  }
}

const accountLabel = (count: number) =>
  `${count} account${count === 1 ? "" : "s"}`;

export const secretIdentity = (secret: string) =>
  secret.trim().replace(/=+$/g, "").toUpperCase();

const toBackupAccount = (account: TotpAccount): TotpBackupAccount => {
  const backupAccount: TotpBackupAccount = {
    name: account.name,
    secret: account.secret,
  };

  if (account.activePath) {
    backupAccount.activePath = account.activePath;
  }

  return backupAccount;
};

const toStoredAccount = (account: TotpBackupAccount): TotpAccount => {
  const storedAccount: TotpAccount = {
    name: account.name,
    secret: account.secret,
  };

  if (account.activePath) {
    storedAccount.activePath = account.activePath;
  }

  return storedAccount;
};

const copyStoredAccount = (account: TotpAccount): TotpAccount => {
  const storedAccount: TotpAccount = {
    name: account.name,
    secret: account.secret,
  };

  if (account.activePath) {
    storedAccount.activePath = account.activePath;
  }

  if (typeof account.originIndex === "number") {
    storedAccount.originIndex = account.originIndex;
  }

  return storedAccount;
};

export const createBackupFile = (
  accounts: TotpAccounts,
  exportedAt: string = new Date().toISOString(),
): TotpBackupFile => ({
  version: BACKUP_VERSION,
  exportedAt,
  accounts: accounts.map(toBackupAccount),
});

export const buildBackupFilename = (date: Date = new Date()) => {
  const pad = (value: number) => String(value).padStart(2, "0");

  return `totp-backup-${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}-${pad(date.getHours())}${pad(date.getMinutes())}.json`;
};

const parseBackupAccount = (item: unknown, index: number): TotpBackupAccount => {
  const label = `Account ${index + 1}`;

  if (!item || typeof item !== "object" || Array.isArray(item)) {
    throw new AccountBackupError(`${label} is not a valid account.`);
  }

  const record = item as Record<string, unknown>;
  const name = typeof record.name === "string" ? record.name.trim() : "";
  const secret = typeof record.secret === "string" ? record.secret.trim() : "";

  if (!name || !validateBase32Secret(secret)) {
    throw new AccountBackupError(
      `${label} needs a name and a valid Base32 secret.`,
    );
  }

  const account: TotpBackupAccount = { name, secret };

  if (record.activePath !== undefined && record.activePath !== null) {
    if (typeof record.activePath !== "string") {
      throw new AccountBackupError(`${label} has an invalid domain pin.`);
    }

    const activePath = record.activePath.trim();
    if (activePath) {
      account.activePath = activePath;
    }
  }

  return account;
};

export const parseBackupAccounts = (data: unknown): TotpBackupAccount[] => {
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    throw new AccountBackupError("The backup file is not a TOTP backup.");
  }

  const record = data as Record<string, unknown>;

  if (record.version !== BACKUP_VERSION) {
    throw new AccountBackupError("This backup uses an unsupported format.");
  }

  if (!Array.isArray(record.accounts)) {
    throw new AccountBackupError("The backup file does not contain an account list.");
  }

  if (record.accounts.length === 0) {
    throw new AccountBackupError("The backup file has no accounts.");
  }

  return record.accounts.map(parseBackupAccount);
};

export const readBackupText = (text: string): TotpBackupAccount[] => {
  let data: unknown;

  try {
    data = JSON.parse(text.replace(/^\uFEFF/, ""));
  } catch {
    throw new AccountBackupError("The backup file is not valid JSON.");
  }

  return parseBackupAccounts(data);
};

const dedupeIncoming = (accounts: TotpBackupAccount[]) => {
  const seen = new Set<string>();
  const unique: TotpBackupAccount[] = [];

  for (const account of accounts) {
    const identity = secretIdentity(account.secret);
    if (seen.has(identity)) {
      continue;
    }

    seen.add(identity);
    unique.push(account);
  }

  return unique;
};

export const applyBackupImport = (
  existing: TotpAccounts,
  incoming: TotpBackupAccount[],
  mode: ImportMode,
): BackupImportResult => {
  const uniqueIncoming = dedupeIncoming(incoming);
  const duplicateCount = incoming.length - uniqueIncoming.length;

  if (mode === "replace") {
    return {
      accounts: uniqueIncoming.map(toStoredAccount),
      importedCount: uniqueIncoming.length,
      skippedCount: duplicateCount,
    };
  }

  const seen = new Set(existing.map((account) => secretIdentity(account.secret)));
  const accounts = existing.map(copyStoredAccount);
  let importedCount = 0;
  let skippedCount = duplicateCount;

  for (const account of uniqueIncoming) {
    const identity = secretIdentity(account.secret);
    if (seen.has(identity)) {
      skippedCount += 1;
      continue;
    }

    seen.add(identity);
    accounts.push(toStoredAccount(account));
    importedCount += 1;
  }

  return { accounts, importedCount, skippedCount };
};

export const formatBackupExportMessage = (count: number) =>
  `Exported ${accountLabel(count)}. The file contains plaintext secrets. Store it securely.`;

export const formatBackupImportMessage = (
  mode: ImportMode,
  result: Pick<BackupImportResult, "importedCount" | "skippedCount">,
) => {
  if (mode === "replace") {
    return `Replaced your accounts with ${accountLabel(result.importedCount)}.`;
  }

  if (result.importedCount === 0) {
    return "No new accounts. Every secret is already saved.";
  }

  if (result.skippedCount > 0) {
    const duplicateLabel = `${result.skippedCount} duplicate secret${
      result.skippedCount === 1 ? "" : "s"
    }`;
    return `Imported ${accountLabel(result.importedCount)}. Skipped ${duplicateLabel}.`;
  }

  return `Imported ${accountLabel(result.importedCount)}.`;
};
