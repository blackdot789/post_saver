import { describe, expect, it } from "vitest";
import { authErrorMessage } from "./errors.ts";

describe("authErrorMessage", () => {
  it("explains known errors in plain words", () => {
    expect(authErrorMessage({ code: "auth/invalid-credential" })).toMatch(/don't match/);
    expect(authErrorMessage({ code: "auth/email-already-in-use" })).toMatch(/Sign in instead/);
    expect(authErrorMessage({ code: "auth/network-request-failed" })).toMatch(/offline/);
  });

  it("stays quiet when the user just closed the sign-in window", () => {
    expect(authErrorMessage({ code: "auth/popup-closed-by-user" })).toBeNull();
    expect(authErrorMessage({ code: "auth/cancelled-popup-request" })).toBeNull();
  });

  it("falls back to a generic message that names the code, for support", () => {
    expect(authErrorMessage({ code: "auth/something-new" })).toBe("Something went wrong. Please try again. (auth/something-new)");
    expect(authErrorMessage(new Error("boom"))).toBe("Something went wrong. Please try again.");
    expect(authErrorMessage({ code: "constructor" })).toBe("Something went wrong. Please try again. (constructor)");
  });
});
