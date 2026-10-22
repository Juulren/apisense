import { afterEach, describe, expect, it, vi } from "vitest";
import { acquireWebDatabaseLock } from "./webLock";

const releases: (() => Promise<void>)[] = [];
afterEach(async () => {
  for (const release of releases.splice(0)) await release();
  vi.unstubAllGlobals();
});
const acquire = async (principal: string) => {
  const release = await acquireWebDatabaseLock(principal);
  releases.push(release);
  return release;
};

describe("Web database ownership with the real Web Locks API", () => {
  it("rejects a second owner and permits a successor only after release", async () => {
    const principal = crypto.randomUUID();
    const release = await acquire(principal);
    await expect(acquire(principal)).rejects.toThrow("otra pestaña");
    expect(
      (await navigator.locks.query()).held?.some(
        (lock) => lock.name === `apisense-database-${principal}`,
      ),
    ).toBe(true);
    await release();
    const successor = await acquire(principal);
    await successor();
    expect(
      (await navigator.locks.query()).held?.some(
        (lock) => lock.name === `apisense-database-${principal}`,
      ),
    ).toBe(false);
  });
  it("allows independent principals to remain open together", async () => {
    const first = crypto.randomUUID(),
      second = crypto.randomUUID();
    await acquire(first);
    await acquire(second);
    const names = (await navigator.locks.query()).held?.map(
      (lock) => lock.name,
    );
    expect(names).toContain(`apisense-database-${first}`);
    expect(names).toContain(`apisense-database-${second}`);
  });
  it("chooses exactly one owner when opening concurrently", async () => {
    const principal = crypto.randomUUID();
    const results = await Promise.allSettled([
      acquire(principal),
      acquire(principal),
    ]);
    expect(
      results.filter((result) => result.status === "fulfilled"),
    ).toHaveLength(1);
    expect(
      results.filter((result) => result.status === "rejected"),
    ).toHaveLength(1);
    expect((await navigator.locks.query()).pending).toHaveLength(0);
  });
  it("fails closed when Web Locks is unavailable", async () => {
    vi.stubGlobal("navigator", {});
    await expect(acquireWebDatabaseLock(crypto.randomUUID())).rejects.toThrow(
      "bloqueo seguro",
    );
  });
});
