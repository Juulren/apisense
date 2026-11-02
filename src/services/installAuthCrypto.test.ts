import { describe, expect, it, vi } from "vitest";

const native = vi.hoisted(() => ({
  getRandomValues: vi.fn(),
  digest: vi.fn(),
}));
vi.mock("expo-crypto", () => ({
  getRandomValues: native.getRandomValues,
  digest: native.digest,
  CryptoDigestAlgorithm: { SHA256: "SHA-256" },
}));
import { installAuthCrypto } from "./installAuthCrypto";

describe("Native crypto primitives for PKCE", () => {
  it("uses native entropy and hashing on a host without WebCrypto", async () => {
    const host: { crypto?: Crypto } = {};
    installAuthCrypto(host);
    const bytes = new Uint8Array([97, 98, 99]);
    host.crypto!.getRandomValues(bytes);
    expect(native.getRandomValues).toHaveBeenCalledWith(bytes);
    native.digest.mockResolvedValueOnce(new Uint8Array([1]).buffer);
    await host.crypto!.subtle.digest("SHA-256", bytes);
    expect(native.digest).toHaveBeenCalledWith("SHA-256", bytes);
    await expect(host.crypto!.subtle.digest("SHA-512", bytes)).rejects.toThrow(
      "solo admite SHA-256",
    );
  });
  it("preserves existing native WebCrypto implementations and is idempotent", () => {
    const random = vi.fn(),
      digest = vi.fn();
    const host = { crypto: { getRandomValues: random, subtle: { digest } } };
    installAuthCrypto(host);
    installAuthCrypto(host);
    expect(host.crypto.getRandomValues).toBe(random);
    expect(host.crypto.subtle.digest).toBe(digest);
  });
});
