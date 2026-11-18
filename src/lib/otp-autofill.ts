// Both functions are injected into pages with chrome.scripting.executeScript,
// so each one must stay self-contained: no imports, no outer variables.

/**
 * Fills a TOTP code into the page. With `onlyFocusedField`, it only fills
 * when the focused field is empty and looks like a verification code field.
 */
export const fillCodeInPage = (
  rawToken: string,
  onlyFocusedField = false,
): boolean => {
  type Field = HTMLInputElement | HTMLTextAreaElement;
  const TEXT_TYPES = ["text", "tel", "number", "password", "search"];
  const OTP_HINT =
    /otp|2fa|mfa|totp|verify|verification|one[-_]?time|auth(?:entication)?[-_]?code|security[-_]?code|passcode/i;

  const token = rawToken.replace(/\s/g, "");
  if (!/^\d{4,10}$/.test(token)) return false;

  const isEditable = (el: Element | null): el is Field =>
    (el instanceof HTMLTextAreaElement ||
      (el instanceof HTMLInputElement && TEXT_TYPES.includes(el.type))) &&
    !el.disabled &&
    !el.readOnly;

  const isDigitBox = (el: Element | null): el is HTMLInputElement =>
    isEditable(el) &&
    el instanceof HTMLInputElement &&
    el.maxLength > 0 &&
    el.maxLength <= 2;

  const isOneTimeCode = (el: Field) =>
    el instanceof HTMLInputElement && el.autocomplete === "one-time-code";

  const looksLikeOtp = (el: Field) =>
    isOneTimeCode(el) ||
    OTP_HINT.test(
      ["name", "id", "aria-label", "placeholder"]
        .map((attr) => el.getAttribute(attr) ?? "")
        .join(" "),
    ) ||
    (el instanceof HTMLInputElement && el.maxLength >= 4 && el.maxLength <= 10);

  const setValue = (el: Field, value: string) => {
    const proto =
      el instanceof HTMLTextAreaElement
        ? HTMLTextAreaElement.prototype
        : HTMLInputElement.prototype;
    const setter = Object.getOwnPropertyDescriptor(proto, "value")?.set;
    el.focus();
    if (setter) setter.call(el, value);
    else el.value = value;
    el.dispatchEvent(new Event("input", { bubbles: true }));
    el.dispatchEvent(new Event("change", { bubbles: true }));
  };

  // First group of one-digit boxes that can hold the whole code.
  const findDigitBoxes = () => {
    for (const box of Array.from(document.querySelectorAll("input"))) {
      if (!isDigitBox(box)) continue;
      const container = box.closest("form, [role='group'], div");
      const group = Array.from(
        container?.querySelectorAll("input") ?? [],
      ).filter(isDigitBox);
      if (group.length >= token.length) return group;
    }
    return [];
  };

  try {
    const active = document.activeElement;
    if (
      onlyFocusedField &&
      !(
        isEditable(active) &&
        !active.value &&
        (isDigitBox(active) || looksLikeOtp(active))
      )
    ) {
      return false;
    }

    const boxes = findDigitBoxes();
    if (boxes.length > 0 && (!isEditable(active) || isDigitBox(active))) {
      boxes
        .slice(0, token.length)
        .forEach((box, index) => setValue(box, token[index]));
      return true;
    }

    const fields = Array.from(
      document.querySelectorAll("input, textarea"),
    ).filter(isEditable);
    const target = isEditable(active)
      ? active
      : (fields.find(isOneTimeCode) ?? fields.find(looksLikeOtp));
    if (!target) return false;

    setValue(target, token);
    return true;
  } catch {
    return false;
  }
};

/**
 * Asks the background to autofill whenever an empty input gains focus.
 * The page never sees the secret; the background decides whether to fill.
 */
export const watchOtpFocus = () => {
  const scope = window as unknown as Record<string, boolean>;
  if (scope.__totpAutofill) return;
  scope.__totpAutofill = true;

  document.addEventListener(
    "focusin",
    ({ target }) => {
      if (!(target instanceof HTMLInputElement) || target.value) return;
      try {
        void chrome.runtime
          .sendMessage({ action: "autofillOtp" })
          .catch(() => {});
      } catch {
        // The extension was reloaded; this listener is stale until refresh.
      }
    },
    true,
  );
};
