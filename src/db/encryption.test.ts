import { describe, expect, it } from "vitest";
import { deriveLocalKey, sealSnapshot, unsealSnapshot } from "./encryption";
describe("Encrypted web persistence", () => {
  it("encrypts with fresh IVs and authenticates the principal and ciphertext", async () => {
    const salt = crypto.getRandomValues(new Uint8Array(16)),
      key = await deriveLocalKey("una clave local de prueba extensa", salt),
      plain = new TextEncoder().encode("SQLite datos privados");
    const first = await sealSnapshot(plain, key, salt, "alice"),
      second = await sealSnapshot(plain, key, salt, "alice");
    expect(first.iv).not.toEqual(second.iv);
    expect(new Uint8Array(first.ciphertext)).not.toEqual(plain);
    expect(await unsealSnapshot(first, key, "alice")).toEqual(plain);
    await expect(unsealSnapshot(first, key, "bob")).rejects.toThrow(
      "incorrecta",
    );
    const corrupt = { ...first, ciphertext: first.ciphertext.slice(0) };
    const bytes = new Uint8Array(corrupt.ciphertext);
    bytes[0] = (bytes[0] ?? 0) ^ 1;
    await expect(unsealSnapshot(corrupt, key, "alice")).rejects.toThrow(
      "dañados",
    );
  });
  it("rejects wrong and short keys", async () => {
    const salt = crypto.getRandomValues(new Uint8Array(16)),
      key = await deriveLocalKey("una clave local de prueba extensa", salt),
      wrong = await deriveLocalKey("otra clave local de prueba extensa", salt);
    const encrypted = await sealSnapshot(
      new Uint8Array([1, 2, 3]),
      key,
      salt,
      "alice",
    );
    await expect(unsealSnapshot(encrypted, wrong, "alice")).rejects.toThrow();
    await expect(deriveLocalKey("short", salt)).rejects.toThrow("16");
  });
});
