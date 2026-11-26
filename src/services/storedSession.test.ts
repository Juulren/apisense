import { describe, expect, it } from "vitest";
import { createClient } from "@supabase/supabase-js";
import {
  forgetThenSignOut,
  guardedSession,
  parseStoredAccount,
  sessionKey,
} from "./storedSession";

const saved = {
  access_token: "a.b.c",
  refresh_token: "r",
  expires_at: 1,
  user: { id: "u1", email: "prueba@ejemplo.test" },
};

describe("parseStoredAccount", () => {
  it("finds the account even when its token expired long ago", () => {
    expect(parseStoredAccount(JSON.stringify(saved))).toEqual({
      id: "u1",
      email: "prueba@ejemplo.test",
    });
  });
  it("does not need an email", () => {
    expect(
      parseStoredAccount(JSON.stringify({ ...saved, user: { id: "u1" } })),
    ).toEqual({ id: "u1", email: null });
  });
  it("opens nothing for a missing, broken or incomplete session", () => {
    for (const raw of [
      null,
      "",
      "no es json",
      "null",
      "{}",
      JSON.stringify({ ...saved, user: undefined }),
      JSON.stringify({ ...saved, user: { id: "" } }),
      JSON.stringify({ ...saved, refresh_token: "" }),
      JSON.stringify({ ...saved, access_token: undefined }),
      JSON.stringify({ ...saved, expires_at: undefined }),
    ])
      expect(parseStoredAccount(raw)).toBeNull();
  });
});

describe("sessionKey", () => {
  // If a library update changes its default, saved sessions would be missed.
  it("is the library's own default", () => {
    const url = "https://abcdefgh.supabase.co";
    const client = createClient(url, "clave-inventada", {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    expect(sessionKey(url)).toBe(
      (client.auth as unknown as { storageKey: string }).storageKey,
    );
  });
});

describe("forgetThenSignOut", () => {
  const port = (over: Partial<Parameters<typeof forgetThenSignOut>[0]> = {}) => {
    const calls: string[] = [];
    return {
      calls,
      port: {
        read: async () => JSON.stringify(saved),
        remove: async () => void calls.push("remove"),
        revoke: async (token: string) => void calls.push(`revoke ${token}`),
        signOut: async () => void calls.push("signOut"),
        ...over,
      },
    };
  };
  it("removes the saved session before asking anything of the network", async () => {
    const { calls, port: p } = port();
    await forgetThenSignOut(p);
    expect(calls).toEqual(["remove", "revoke a.b.c", "signOut"]);
  });
  it("is gone even while the server never answers", async () => {
    const { calls, port: p } = port({
      revoke: () => new Promise(() => {}),
      signOut: () => new Promise(() => {}),
    });
    void forgetThenSignOut(p);
    await new Promise((done) => setTimeout(done, 0));
    expect(calls).toEqual(["remove"]);
  });
  it("still removes it with no signal or an unreadable session", async () => {
    const failing = async () => {
      throw new Error("sin red");
    };
    const offline = port({ revoke: failing, signOut: failing });
    await forgetThenSignOut(offline.port);
    expect(offline.calls).toEqual(["remove"]);
    const broken = port({ read: failing });
    await forgetThenSignOut(broken.port);
    expect(broken.calls).toEqual(["remove", "signOut"]);
  });
});

describe("guardedSession", () => {
  const tick = () => new Promise((done) => setTimeout(done, 0));
  const setup = () => {
    const saved_ = new Map([["k", JSON.stringify(saved)]]);
    const session = guardedSession(
      {
        getItem: async (k) => saved_.get(k) ?? null,
        setItem: async (k, v) => void saved_.set(k, v),
        removeItem: async (k) => void saved_.delete(k),
      },
      "k",
    );
    let finish = () => {};
    const stuck = new Promise<void>((done) => {
      finish = done;
    });
    return { saved_, session, finish: () => finish(), stuck };
  };
  it("a refresh that ends during sign-out cannot save the session again", async () => {
    const { saved_, session, finish, stuck } = setup();
    const left = session.leave(
      { revoke: async () => {}, signOut: () => stuck },
      60_000,
    );
    await tick();
    await session.storage.setItem("k", "renovada");
    await session.storage.setItem("otra-clave", "sí se guarda");
    expect(saved_.has("k")).toBe(false);
    expect(saved_.get("otra-clave")).toBe("sí se guarda");
    finish();
    await left;
    await session.storage.setItem("k", "nueva");
    expect(saved_.get("k")).toBe("nueva");
  });
  it("stops waiting after the limit, and signing in waits for the rest", async () => {
    const { saved_, session, finish, stuck } = setup();
    await session.leave({ revoke: async () => {}, signOut: () => stuck }, 5);
    expect(saved_.has("k")).toBe(false);
    let ready = false;
    const waiting = session.settled().then(() => {
      ready = true;
    });
    await tick();
    expect(ready).toBe(false);
    finish();
    await waiting;
    await session.storage.setItem("k", "nueva");
    expect(saved_.get("k")).toBe("nueva");
  });
});
