import { fillOtpToken, isOtpLikeInput } from "../lib/otp-field";

const FOCUS_FILL_FLAG = "__totpAuthenticatorFocusFillInstalled";

const isExtensionContextAlive = (): boolean => {
  try {
    if (typeof chrome === "undefined" || !chrome.runtime) {
      return false;
    }

    void chrome.runtime.id;
    return true;
  } catch {
    return false;
  }
};

if ((globalThis as typeof globalThis & Record<string, boolean>)[FOCUS_FILL_FLAG]) {
  // Already active in this frame (registered script + manual inject, or double inject).
} else if (!isExtensionContextAlive()) {
  // Extension was reloaded; this frame still has a stale script until the page refreshes.
} else {
  (globalThis as typeof globalThis & Record<string, boolean>)[FOCUS_FILL_FLAG] = true;
  installFocusFillListeners();
}

function installFocusFillListeners() {
  const REFILL_COOLDOWN_MS = 800;
  const MESSAGE_RETRY_MS = 250;

  let lastFilledTarget: EventTarget | null = null;
  let lastFilledAt = 0;
  let retryTimerId: number | undefined;

  const shouldSkipRefill = (target: EventTarget): boolean =>
    target === lastFilledTarget && Date.now() - lastFilledAt < REFILL_COOLDOWN_MS;

  const fieldLooksFilled = (
    target: HTMLInputElement | HTMLTextAreaElement,
  ): boolean => {
    const digits = target.value.replace(/\D/g, "");
    return digits.length >= 4;
  };

  const teardown = () => {
    if (retryTimerId) {
      window.clearTimeout(retryTimerId);
      retryTimerId = undefined;
    }

    document.removeEventListener("focusin", handleFocusIn, true);
    document.removeEventListener("pointerdown", handlePointerDown, true);
    delete (globalThis as typeof globalThis & Record<string, boolean>)[
      FOCUS_FILL_FLAG
    ];
  };

  const sendTokenRequest = () => {
    if (!isExtensionContextAlive()) {
      teardown();
      return Promise.reject(new Error("context_invalidated"));
    }

    return chrome.runtime.sendMessage({
      action: "totpTokenForHostname",
      hostname: location.hostname,
    });
  };

  const applyTokenToTarget = (
    target: HTMLInputElement | HTMLTextAreaElement,
    response: { success?: boolean; token?: string },
  ) => {
    if (!response?.success || !response.token) {
      return;
    }

    const result = fillOtpToken(response.token);
    if (!result.ok) {
      return;
    }

    lastFilledTarget = target;
    lastFilledAt = Date.now();
  };

  const requestTokenAndFill = (
    target: HTMLInputElement | HTMLTextAreaElement,
    allowRetry = true,
  ) => {
    if (!isExtensionContextAlive()) {
      teardown();
      return;
    }

    if (!isOtpLikeInput(target)) {
      return;
    }

    if (shouldSkipRefill(target)) {
      return;
    }

    if (fieldLooksFilled(target)) {
      return;
    }

    void sendTokenRequest()
      .then((response) => {
        applyTokenToTarget(target, response);
      })
      .catch(() => {
        if (!allowRetry || !isExtensionContextAlive()) {
          teardown();
          return;
        }

        retryTimerId = window.setTimeout(() => {
          retryTimerId = undefined;
          if (!isExtensionContextAlive()) {
            teardown();
            return;
          }

          void sendTokenRequest()
            .then((response) => {
              applyTokenToTarget(target, response);
            })
            .catch(() => {
              teardown();
            });
        }, MESSAGE_RETRY_MS);
      });
  };

  const tryAutofillTarget = (target: EventTarget | null) => {
    if (!isExtensionContextAlive()) {
      teardown();
      return;
    }

    if (
      !(target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement)
    ) {
      return;
    }

    requestTokenAndFill(target);
  };

  const handleFocusIn = (event: FocusEvent) => {
    tryAutofillTarget(event.target);
  };

  const handlePointerDown = (event: PointerEvent) => {
    const target = event.target;
    if (
      !(target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement)
    ) {
      return;
    }

    if (!isOtpLikeInput(target)) {
      return;
    }

    window.setTimeout(() => tryAutofillTarget(target), 0);
  };

  document.addEventListener("focusin", handleFocusIn, true);
  document.addEventListener("pointerdown", handlePointerDown, true);
  tryAutofillTarget(document.activeElement);
}