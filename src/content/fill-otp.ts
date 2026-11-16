import { fillOtpToken, type FillOtpResult } from "../lib/otp-field";

declare global {
  interface Window {
    __totpAuthenticatorFill?: (token: string) => FillOtpResult;
  }
}

window.__totpAuthenticatorFill = (token: string) => fillOtpToken(token);