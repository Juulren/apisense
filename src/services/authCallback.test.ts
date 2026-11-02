import { describe, expect, it, vi } from "vitest";
import {
  AUTH_REDIRECT_URL,
  authCallbackCode,
  createAuthCallbackHandler,
} from "./authCallback";

describe("Native PKCE callback", () => {
  it("accepts exactly the native callback with one code", () => {
    expect(authCallbackCode(`${AUTH_REDIRECT_URL}?code=one-use-code`)).toBe(
      "one-use-code",
    );
  });
  it.each([
    "https://auth/callback?code=x",
    "apisense-demo://auth/callback?code=x",
    "apisense://evil/callback?code=x",
    "apisense://auth/elsewhere?code=x",
    "apisense://user@auth/callback?code=x",
    "apisense://auth:42/callback?code=x",
    "apisense://auth/callback",
    "apisense://auth/callback?code=",
    "apisense://auth/callback?code=x&code=y",
    "apisense://auth/callback?code=x#access_token=secret",
    "apisense://auth/callback?code=x&access_token=secret",
    "apisense://auth/callback?code=x&refresh_token=secret",
  ])("rejects untrusted callback %s without exchanging", async (raw) => {
    const exchange = vi.fn();
    expect(() => createAuthCallbackHandler(exchange)(raw)).toThrow(
      "Enlace de confirmación inválido",
    );
    expect(exchange).not.toHaveBeenCalled();
  });
  it("does not reflect remote error details or credentials", () => {
    expect(() =>
      authCallbackCode(
        `${AUTH_REDIRECT_URL}?error=denied&error_description=sensitive`,
      ),
    ).toThrow("La confirmación caducó o fue rechazada");
  });
  it("exchanges duplicate deliveries once, including after successful completion", async () => {
    const exchange = vi.fn().mockResolvedValue(undefined);
    const handle = createAuthCallbackHandler(exchange);
    const url = `${AUTH_REDIRECT_URL}?code=same`;
    await Promise.all([handle(url), handle(url)]);
    await handle(url);
    expect(exchange).toHaveBeenCalledExactlyOnceWith("same");
  });
  it("allows retry after a failed exchange", async () => {
    const exchange = vi
      .fn()
      .mockRejectedValueOnce(new Error("offline"))
      .mockResolvedValueOnce(undefined);
    const handle = createAuthCallbackHandler(exchange);
    const url = `${AUTH_REDIRECT_URL}?code=retry`;
    await expect(handle(url)).rejects.toThrow("offline");
    await handle(url);
    expect(exchange).toHaveBeenCalledTimes(2);
  });
});
