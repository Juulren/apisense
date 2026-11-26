/**
 * Who is signed in on this phone, read from what the auth library saved.
 *
 * `getSession()` cannot answer this in the field: with an expired token and no
 * signal it says there is nobody, although the session is still saved.
 */
export interface StoredAccount {
  id: string;
  email: string | null;
}

/** The key the auth library uses by default, so nobody is signed out. */
export const sessionKey = (url: string) =>
  `sb-${new URL(url).hostname.split(".")[0]}-auth-token`;

export function parseStoredAccount(raw: string | null): StoredAccount | null {
  if (!raw) return null;
  try {
    const saved = JSON.parse(raw) as {
      access_token?: unknown;
      refresh_token?: unknown;
      expires_at?: unknown;
      user?: { id?: unknown; email?: unknown };
    } | null;
    const id = saved?.user?.id;
    // The same three fields the library asks of a session, plus whose it is.
    if (
      typeof id !== "string" ||
      !id ||
      !saved?.access_token ||
      !saved.refresh_token ||
      !saved.expires_at
    )
      return null;
    const email = saved.user?.email;
    return { id, email: typeof email === "string" ? email : null };
  } catch {
    return null;
  }
}

function accessTokenOf(raw: string | null): string | null {
  try {
    const token = (JSON.parse(raw ?? "null") as { access_token?: unknown } | null)
      ?.access_token;
    return typeof token === "string" && token ? token : null;
  } catch {
    return null;
  }
}

/**
 * Leaving the account. The saved session is removed before anything that waits
 * for the network: closing the app during a slow sign-out must not open the
 * account again for whoever holds the phone.
 */
export async function forgetThenSignOut(port: {
  read: () => Promise<string | null>;
  remove: () => Promise<unknown>;
  /** Tells the server, with the token read before it was removed. */
  revoke: (accessToken: string) => Promise<unknown>;
  /** The library's own clean-up and its SIGNED_OUT announcement. */
  signOut: () => Promise<unknown>;
}) {
  const token = accessTokenOf(await port.read().catch(() => null));
  await port.remove();
  // Best effort and not waited for: with no signal it would hang the screen.
  if (token) void port.revoke(token).catch(() => {});
  await port.signOut().catch(() => {});
}

export interface SessionStorage {
  getItem: (key: string) => Promise<string | null>;
  setItem: (key: string, value: string) => Promise<void>;
  removeItem: (key: string) => Promise<void>;
}

/**
 * The auth library's storage, able to leave an account for good. While leaving,
 * writes of the session are dropped: a token refresh already on its way would
 * otherwise save it again and the next start would open the account.
 */
export function guardedSession(inner: SessionStorage, key: string) {
  let leaving = 0;
  let last: Promise<unknown> = Promise.resolve();
  const storage: SessionStorage = {
    getItem: (k) => inner.getItem(k),
    setItem: async (k, value) => {
      if (leaving && k === key) return;
      await inner.setItem(k, value);
    },
    removeItem: (k) => inner.removeItem(k),
  };
  return {
    storage,
    /**
     * Waits for any sign-out still under way. Await it before signing in, or the
     * new session would be dropped with the old one.
     */
    settled: async () => {
      await last;
    },
    /**
     * Returns when it is done, or after `limit` milliseconds: by then the saved
     * session is gone, and the rest goes on behind the screen.
     */
    leave(
      port: {
        revoke: (accessToken: string) => Promise<unknown>;
        signOut: () => Promise<unknown>;
      },
      limit: number,
    ): Promise<void> {
      leaving += 1;
      const run = (async () => {
        await forgetThenSignOut({
          ...port,
          read: () => inner.getItem(key),
          remove: () => inner.removeItem(key),
        });
        // Once more, in case something got through before this began.
        await inner.removeItem(key);
      })().finally(() => {
        leaving -= 1;
      });
      last = Promise.all([last, run.catch(() => {})]);
      let timer: ReturnType<typeof setTimeout> | undefined;
      return Promise.race([
        run,
        new Promise<void>((done) => {
          timer = setTimeout(done, limit);
        }),
      ]).finally(() => clearTimeout(timer));
    },
  };
}
