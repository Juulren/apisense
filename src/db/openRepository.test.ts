import { beforeEach, describe, expect, it, vi } from "vitest";

const native = vi.hoisted(() => ({
  keys: new Map<string, string>(),
  getItemAsync: vi.fn(),
  setItemAsync: vi.fn(),
  getRandomBytesAsync: vi.fn(),
  openDatabaseAsync: vi.fn(),
  db: {
    execAsync: vi.fn(),
    getFirstAsync: vi.fn(),
    getAllAsync: vi.fn(),
    runAsync: vi.fn(),
    closeAsync: vi.fn(),
  },
}));

vi.mock("expo-sqlite", () => ({
  openDatabaseAsync: native.openDatabaseAsync,
}));
vi.mock("expo-crypto", () => ({
  getRandomBytesAsync: native.getRandomBytesAsync,
  randomUUID: () => "00000000-0000-4000-8000-000000000002",
}));
vi.mock("expo-secure-store", () => ({
  getItemAsync: native.getItemAsync,
  setItemAsync: native.setItemAsync,
  WHEN_UNLOCKED_THIS_DEVICE_ONLY: "when-unlocked-this-device-only",
}));

// Exercise the production entry point after removing platform-specific fallbacks.
// Mocks check the native boundary; these tests do not run SQLCipher or a keychain.
import { openRepository } from "./openRepository";

beforeEach(() => {
  vi.resetAllMocks();
  native.keys.clear();
  native.getItemAsync.mockImplementation(
    async (name: string) => native.keys.get(name) ?? null,
  );
  native.setItemAsync.mockImplementation(async (name: string, key: string) => {
    native.keys.set(name, key);
  });
  native.getRandomBytesAsync.mockResolvedValue(new Uint8Array(32).fill(0xab));
  native.openDatabaseAsync.mockResolvedValue(native.db);
  native.db.getFirstAsync.mockResolvedValue({ cipher_version: "test-fixture" });
  native.db.getAllAsync.mockResolvedValue([{ user_version: 1 }]);
});

describe("Native encrypted repository entry point", () => {
  it("persists a device-only key before opening SQLite and reuses it on reopen", async () => {
    const first = await openRepository("alice");
    const key = "ab".repeat(32);
    expect(native.setItemAsync).toHaveBeenCalledWith(
      "apisense.db-key.alice",
      key,
      { keychainAccessible: "when-unlocked-this-device-only" },
    );
    expect(native.setItemAsync.mock.invocationCallOrder[0]).toBeLessThan(
      native.openDatabaseAsync.mock.invocationCallOrder[0]!,
    );
    expect(native.openDatabaseAsync).toHaveBeenCalledWith(
      "apisense-encrypted-v1-alice.db",
      { useNewConnection: true },
    );
    expect(native.db.execAsync).toHaveBeenNthCalledWith(
      1,
      `PRAGMA key = "x'${key}'";`,
    );
    expect(native.db.getFirstAsync.mock.invocationCallOrder[0]).toBeLessThan(
      native.db.getAllAsync.mock.invocationCallOrder[0]!,
    );
    await first.close();
    const reopened = await openRepository("alice");
    expect(native.getRandomBytesAsync).toHaveBeenCalledTimes(1);
    expect(native.setItemAsync).toHaveBeenCalledTimes(1);
    await reopened.close();
    expect(native.db.closeAsync).toHaveBeenCalledTimes(2);
  });

  it("keeps the demo database and key separate from a real account", async () => {
    const user = await openRepository("alice");
    await user.close();
    const demoId = "00000000-0000-4000-8000-000000000001";
    const demo = await openRepository(demoId);
    expect([...native.keys.keys()]).toEqual([
      "apisense.db-key.alice",
      `apisense.db-key.${demoId}`,
    ]);
    expect(native.openDatabaseAsync.mock.calls.map(([name]) => name)).toEqual([
      "apisense-encrypted-v1-alice.db",
      `apisense-encrypted-v1-${demoId}.db`,
    ]);
    await demo.close();
  });

  it("rejects invalid identities before touching native storage", async () => {
    await expect(openRepository("../alice")).rejects.toThrow("Identidad");
    expect(native.getItemAsync).not.toHaveBeenCalled();
    expect(native.openDatabaseAsync).not.toHaveBeenCalled();
  });

  it("rejects a damaged saved key without opening a plaintext database", async () => {
    native.keys.set("apisense.db-key.alice", "damaged");
    await expect(openRepository("alice")).rejects.toThrow("Clave local dañada");
    expect(native.openDatabaseAsync).not.toHaveBeenCalled();
  });

  it("does not open SQLite when the key cannot be saved", async () => {
    native.setItemAsync.mockRejectedValueOnce(
      new Error("keychain unavailable"),
    );
    await expect(openRepository("alice")).rejects.toThrow(
      "keychain unavailable",
    );
    expect(native.openDatabaseAsync).not.toHaveBeenCalled();
  });

  it("closes and rejects when SQLCipher is absent, before reading domain data", async () => {
    native.db.getFirstAsync.mockResolvedValueOnce(null);
    await expect(openRepository("alice")).rejects.toThrow("SQLCipher");
    expect(native.db.getAllAsync).not.toHaveBeenCalled();
    expect(native.db.runAsync).not.toHaveBeenCalled();
    expect(native.db.closeAsync).toHaveBeenCalledTimes(1);
  });

  it("closes the connection if encrypted initialization fails", async () => {
    native.db.getAllAsync.mockRejectedValueOnce(
      new Error("encrypted database unreadable"),
    );
    await expect(openRepository("alice")).rejects.toThrow(
      "encrypted database unreadable",
    );
    expect(native.db.closeAsync).toHaveBeenCalledTimes(1);
  });
});
