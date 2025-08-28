import { TOTP, Secret } from 'otpauth';

export interface TotpAccount {
  name: string;
  secret: string;
}

export interface TotpToken {
  token: string;
  remainingTime: number;
}

export interface TotpAccounts {
  [key: string]: {
    secret: string;
  };
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
  period: number = 30,
  digits: number = 6,
  algorithm: string = 'SHA1'
): TotpToken {
  try {
    const totp = new TOTP({
      secret: Secret.fromBase32(secret),
      digits,
      period,
      algorithm,
    });
    
    const now = Date.now();
    const token = totp.generate();
    const remainingTime = totp.period - (Math.floor(now / 1000) % totp.period);
    
    return { token, remainingTime };
  } catch (error) {
    console.error('Error generating TOTP token:', error);
    return { token: 'Error', remainingTime: 0 };
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
 * @returns An object mapping account names to their tokens and remaining times
 */
export function generateAllTokens(accounts: TotpAccounts): { 
  [key: string]: TotpToken 
} {
  const tokens: { [key: string]: TotpToken } = {};
  const now = Date.now();
  
  for (const [name, account] of Object.entries(accounts)) {
    try {
      const totp = new TOTP({
        secret: Secret.fromBase32(account.secret),
        digits: 6,
        period: 30,
        algorithm: 'SHA1',
      });
      
      const token = totp.generate();
      const remainingTime = totp.period - (Math.floor(now / 1000) % totp.period);
      
      tokens[name] = { token, remainingTime };
    } catch (error) {
      console.error(`Failed to generate token for ${name}:`, error);
      tokens[name] = { token: 'Error', remainingTime: 0 };
    }
  }
  
  return tokens;
}