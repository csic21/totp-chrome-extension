// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { fillOtpToken, isOtpLikeInput, setNativeInputValue } from "./otp-field";

afterEach(() => {
  document.body.innerHTML = "";
  if (document.activeElement instanceof HTMLElement) {
    document.activeElement.blur();
  }
  document.body.focus();
});

describe("isOtpLikeInput", () => {
  it("detects autocomplete=one-time-code", () => {
    const input = document.createElement("input");
    input.autocomplete = "one-time-code";
    expect(isOtpLikeInput(input)).toBe(true);
  });

  it("detects otp hints in name", () => {
    const input = document.createElement("input");
    input.name = "otp_code";
    expect(isOtpLikeInput(input)).toBe(true);
  });
});

describe("fillOtpToken", () => {
  it("fills a focused otp input", () => {
    const input = document.createElement("input");
    input.name = "otp";
    input.maxLength = 6;
    document.body.appendChild(input);
    input.focus();

    const result = fillOtpToken("123456");

    expect(result).toEqual({ ok: true, mode: "focused" });
    expect(input.value).toBe("123456");
  });

  it("fills a single candidate input", () => {
    const input = document.createElement("input");
    input.autocomplete = "one-time-code";
    document.body.appendChild(input);

    const result = fillOtpToken("654321", document);

    expect(result).toEqual({ ok: true, mode: "single" });
    expect(input.value).toBe("654321");
  });

  it("fills split digit inputs", () => {
    const wrapper = document.createElement("div");
    for (let index = 0; index < 6; index += 1) {
      const input = document.createElement("input");
      input.type = "tel";
      input.maxLength = 1;
      wrapper.appendChild(input);
    }
    document.body.appendChild(wrapper);

    const result = fillOtpToken("112233");

    expect(result).toEqual({ ok: true, mode: "split" });
    const values = Array.from(wrapper.querySelectorAll("input")).map(
      (node) => (node as HTMLInputElement).value,
    );
    expect(values.join("")).toBe("112233");
  });

  it("returns no_input when nothing matches", () => {
    expect(fillOtpToken("123456")).toEqual({ ok: false, reason: "no_input" });
  });
});

describe("setNativeInputValue", () => {
  it("updates value and dispatches events", () => {
    const input = document.createElement("input");
    let inputEvents = 0;
    input.addEventListener("input", () => {
      inputEvents += 1;
    });
    setNativeInputValue(input, "999888");
    expect(input.value).toBe("999888");
    expect(inputEvents).toBe(1);
  });
});