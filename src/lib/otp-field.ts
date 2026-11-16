export type FillOtpResult =
  | { ok: true; mode: "focused" | "single" | "split" }
  | { ok: false; reason: "invalid_token" | "no_input" | "fill_failed" };

const OTP_NAME_HINT =
  /(?:otp|2fa|mfa|totp|verify|verification|one[-_]?time|auth(?:entication)?[-_]?code|security[-_]?code|passcode)/i;

const isTextLikeInput = (element: Element): element is HTMLInputElement | HTMLTextAreaElement => {
  if (element instanceof HTMLTextAreaElement) {
    return !element.disabled && !element.readOnly;
  }

  if (!(element instanceof HTMLInputElement)) {
    return false;
  }

  if (element.disabled || element.readOnly) {
    return false;
  }

  const type = (element.type || "text").toLowerCase();
  return (
    type === "text" ||
    type === "tel" ||
    type === "number" ||
    type === "password" ||
    type === "search" ||
    type === ""
  );
};

export const isOtpLikeInput = (element: Element): boolean => {
  if (!isTextLikeInput(element)) {
    return false;
  }

  if (element.autocomplete === "one-time-code") {
    return true;
  }

  const attrs = [
    element.getAttribute("name") ?? "",
    element.getAttribute("id") ?? "",
    element.getAttribute("aria-label") ?? "",
    element.getAttribute("placeholder") ?? "",
    element.getAttribute("inputmode") ?? "",
  ].join(" ");

  if (OTP_NAME_HINT.test(attrs)) {
    return true;
  }

  const maxLength = element.maxLength;
  if (maxLength >= 4 && maxLength <= 10) {
    return true;
  }

  const pattern = element.getAttribute("pattern");
  if (pattern && /\\d|\[0-9\]|\d\{/.test(pattern)) {
    return true;
  }

  return false;
};

export const setNativeInputValue = (
  element: HTMLInputElement | HTMLTextAreaElement,
  value: string,
): void => {
  const prototype =
    element instanceof HTMLTextAreaElement
      ? HTMLTextAreaElement.prototype
      : HTMLInputElement.prototype;

  const descriptor = Object.getOwnPropertyDescriptor(prototype, "value");
  const setter = descriptor?.set;

  if (setter) {
    setter.call(element, value);
  } else {
    element.value = value;
  }

  element.dispatchEvent(new Event("input", { bubbles: true }));
  element.dispatchEvent(new Event("change", { bubbles: true }));
};

const getSplitDigitInputs = (root: Document): HTMLInputElement[] => {
  const candidates = Array.from(
    root.querySelectorAll<HTMLInputElement>("input"),
  ).filter((input) => {
    if (!isTextLikeInput(input)) {
      return false;
    }
    if (!input.maxLength || input.maxLength > 2) {
      return false;
    }

    const parent = input.closest("form, [role='group'], div");
    const siblings = parent
      ? Array.from(parent.querySelectorAll<HTMLInputElement>("input")).filter(
          (node) => isTextLikeInput(node) && node.maxLength > 0 && node.maxLength <= 2,
        )
      : [];
    return siblings.length >= 4;
  });

  if (candidates.length === 0) {
    return [];
  }

  const group = candidates[0].closest("form, [role='group'], div");
  if (!group) {
    return [];
  }

  return Array.from(group.querySelectorAll<HTMLInputElement>("input")).filter(
    (input) => isTextLikeInput(input) && input.maxLength > 0 && input.maxLength <= 2,
  );
};

const findBestSingleInput = (root: Document): HTMLInputElement | null => {
  const active = root.activeElement;
  if (active && isOtpLikeInput(active)) {
    return active as HTMLInputElement;
  }

  const matches = Array.from(
    root.querySelectorAll<HTMLInputElement>("input, textarea"),
  ).filter(isOtpLikeInput);

  if (matches.length === 0) {
    return null;
  }

  const autocompleteMatches = matches.filter(
    (input) => input.autocomplete === "one-time-code",
  );
  if (autocompleteMatches.length === 1) {
    return autocompleteMatches[0];
  }

  return matches[0];
};

const fillSplitInputs = (inputs: HTMLInputElement[], token: string): boolean => {
  const digits = token.split("");
  const count = Math.min(inputs.length, digits.length);

  for (let index = 0; index < count; index += 1) {
    const input = inputs[index];
    input.focus();
    setNativeInputValue(input, digits[index]);
  }

  inputs[Math.min(count, inputs.length) - 1]?.focus();
  return count > 0;
};

/**
 * Write a TOTP code into the active document (page or iframe).
 */
export function fillOtpToken(
  token: string,
  root: Document = document,
): FillOtpResult {
  const normalized = token.replace(/\s/g, "");
  if (!/^\d{4,10}$/.test(normalized)) {
    return { ok: false, reason: "invalid_token" };
  }

  const active = root.activeElement;
  if (active && isOtpLikeInput(active)) {
    try {
      setNativeInputValue(active as HTMLInputElement, normalized);
      return { ok: true, mode: "focused" };
    } catch {
      return { ok: false, reason: "fill_failed" };
    }
  }

  const splitInputs = getSplitDigitInputs(root);
  if (splitInputs.length >= normalized.length) {
    try {
      const filled = fillSplitInputs(splitInputs, normalized);
      return filled ? { ok: true, mode: "split" } : { ok: false, reason: "fill_failed" };
    } catch {
      return { ok: false, reason: "fill_failed" };
    }
  }

  const single = findBestSingleInput(root);
  if (!single) {
    return { ok: false, reason: "no_input" };
  }

  try {
    single.focus();
    setNativeInputValue(single, normalized);
    return { ok: true, mode: "single" };
  } catch {
    return { ok: false, reason: "fill_failed" };
  }
}