import { describe, expect, it } from "vitest";
import {
  cleanName,
  isEmail,
  isRecoveryCode,
  newPasswordProblem,
  reconcileName,
  saveName,
  type ProfileRemote,
} from "./Profile";

function fake(serverName: string | null = null, offline = false) {
  const settings = new Map<string, string>();
  const repo = {
    setting: async (k: string) => settings.get(k),
    setSetting: async (k: string, v: string) => void settings.set(k, v),
  };
  const state = { server: serverName, pushes: 0 };
  const remote: ProfileRemote = {
    fetchName: async () => {
      if (offline) throw new Error("sin red");
      return state.server;
    },
    pushName: async (_id, name) => {
      if (offline) throw new Error("sin red");
      state.pushes++;
      state.server = name;
    },
  };
  return { repo, remote, settings, state };
}

describe("name rules", () => {
  it("trims, allows empty, and rejects long or control-character names", () => {
    expect(cleanName("  Damaris  ")).toBe("Damaris");
    expect(cleanName("   ")).toBe("");
    expect(() => cleanName("x".repeat(51))).toThrow("máximo 50");
    expect(() => cleanName("a\u0007b")).toThrow("no válidos");
    expect(cleanName("x".repeat(50))).toHaveLength(50);
  });
});

describe("password and input rules", () => {
  it("asks for 10+ characters, not the email, not one repeated character", () => {
    expect(newPasswordProblem("corta123")).toContain("10");
    expect(newPasswordProblem("a@b.co", "a@b.co")).toContain("10");
    expect(newPasswordProblem("Mi@Correo.com", "mi@correo.com")).toContain("correo");
    expect(newPasswordProblem("aaaaaaaaaaaa")).toContain("repetitiva");
    expect(newPasswordProblem("abejas-y-miel-42")).toBeNull();
  });
  it("recognises emails and six-digit codes", () => {
    expect(isEmail(" a@b.co ")).toBe(true);
    expect(isEmail("a@b")).toBe(false);
    expect(isRecoveryCode(" 123456 ")).toBe(true);
    expect(isRecoveryCode("12345")).toBe(false);
    expect(isRecoveryCode("12345a")).toBe(false);
  });
});

describe("saving the name", () => {
  it("stores it locally and on the profile, clearing the pending flag", async () => {
    const { repo, remote, settings, state } = fake();
    expect(await saveName(repo, remote, "u", " Ana ")).toEqual({ synced: true });
    expect(settings.get("name")).toBe("Ana");
    expect(settings.get("name_pending")).toBe("0");
    expect(state.server).toBe("Ana");
  });
  it("keeps the local name and flags it when the network fails", async () => {
    const { repo, remote, settings } = fake(null, true);
    expect(await saveName(repo, remote, "u", "Ana")).toEqual({ synced: false });
    expect(settings.get("name")).toBe("Ana");
    expect(settings.get("name_pending")).toBe("1");
  });
  it("works without a remote (demo) and sends null for an empty name", async () => {
    const demo = fake();
    expect(await saveName(demo.repo, null, "u", "Mateo")).toEqual({ synced: false });
    expect(demo.settings.has("name_pending")).toBe(false);
    const real = fake("Ana");
    await saveName(real.repo, real.remote, "u", "");
    expect(real.state.server).toBeNull();
  });
  it("rejects an invalid name before touching anything", async () => {
    const { repo, remote, settings } = fake();
    await expect(saveName(repo, remote, "u", "x".repeat(60))).rejects.toThrow();
    expect(settings.size).toBe(0);
  });
});

describe("reconciling on sign-in", () => {
  it("adopts the profile's name, e.g. the one given at registration", async () => {
    const { repo, remote, settings } = fake("Damaris");
    await reconcileName(repo, remote, "u");
    expect(settings.get("name")).toBe("Damaris");
  });
  it("sends a pending offline change instead of overwriting it", async () => {
    const { repo, remote, settings, state } = fake("Viejo");
    settings.set("name", "Nuevo");
    settings.set("name_pending", "1");
    await reconcileName(repo, remote, "u");
    expect(state.server).toBe("Nuevo");
    expect(settings.get("name")).toBe("Nuevo");
    expect(settings.get("name_pending")).toBe("0");
  });
  it("keeps the flag when the pending change still cannot be sent", async () => {
    const { repo, remote, settings } = fake(null, true);
    settings.set("name", "Nuevo");
    settings.set("name_pending", "1");
    await expect(reconcileName(repo, remote, "u")).rejects.toThrow();
    expect(settings.get("name_pending")).toBe("1");
  });
  it("does not overwrite a name saved while the profile was being fetched", async () => {
    const { repo, remote, settings } = fake("Viejo");
    const fetchName = remote.fetchName;
    remote.fetchName = async (id) => {
      const value = await fetchName(id);
      settings.set("name", "Nuevo");
      settings.set("name_pending", "1");
      return value;
    };
    await reconcileName(repo, remote, "u");
    expect(settings.get("name")).toBe("Nuevo");
  });
  it("uploads a local name when the profile has none", async () => {
    const { repo, remote, settings, state } = fake(null);
    settings.set("name", "Mateo");
    await reconcileName(repo, remote, "u");
    expect(state.server).toBe("Mateo");
  });
});
