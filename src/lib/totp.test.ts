import { describe, it, expect } from 'vitest';
import { generateTotpToken, validateBase32Secret, generateAllTokens } from './totp';

describe('TOTP Utility Functions', () => {
  // Test with a known test vector from RFC 6238
  // Seed: 0x31323334353637383930313234353637383930 (ASCII "12345678901234567890")
  const testSecret = 'GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ'; // Base32 encoding of the above seed
  
  it('should generate a valid TOTP token', () => {
    const result = generateTotpToken(testSecret, 30, 6, 'SHA1');
    expect(result.token).toHaveLength(6);
    expect(typeof result.token).toBe('string');
    expect(result.remainingTime).toBeGreaterThanOrEqual(0);
    expect(result.remainingTime).toBeLessThanOrEqual(30);
  });
  
  it('should validate a correct Base32 secret', () => {
    expect(validateBase32Secret(testSecret)).toBe(true);
  });
  
  it('should reject an invalid Base32 secret', () => {
    expect(validateBase32Secret('INVALID_SECRET!@#')).toBe(false);
    expect(validateBase32Secret('')).toBe(false);
    expect(validateBase32Secret('ABC')).toBe(true); // Padding is optional in otpauth
  });
  
  it('should generate tokens for multiple accounts', () => {
    const accounts = {
      'account1': { secret: testSecret },
      'account2': { secret: testSecret }
    };
    
    const tokens = generateAllTokens(accounts);
    
    expect(tokens).toHaveProperty('account1');
    expect(tokens).toHaveProperty('account2');
    expect(tokens.account1.token).toHaveLength(6);
    expect(tokens.account2.token).toHaveLength(6);
  });
  
  it('should handle invalid secrets gracefully', () => {
    const accounts = {
      'valid': { secret: testSecret },
      'invalid': { secret: 'INVALID_SECRET!@#' }
    };
    
    const tokens = generateAllTokens(accounts);
    
    expect(tokens.valid.token).toHaveLength(6);
    expect(tokens.invalid.token).toBe('Error');
  });
});