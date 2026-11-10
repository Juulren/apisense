import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { AppState } from "react-native";
import * as SecureStore from "expo-secure-store";
import { eraseLocalData, openRepository } from "../db/openRepository";
import type { Repository } from "../db/Repository";
import { SyncEngine, type SyncState } from "../db/SyncEngine";
import { SupabaseRemote } from "../db/SupabaseRemote";
import { NetworkGate } from "../db/network";
import type {
  Apiary,
  Hive,
  Microphone,
  AudioSample,
  AiSummary,
  Inspection,
  BroodCycle,
  EdgeVerdict,
} from "../db/types";
import { verdictSince } from "../services/EdgeVerdicts";
import { supabase } from "../services/supabase";
import {
  cleanName,
  newPasswordProblem,
  reconcileName,
  saveName,
  type ProfileRemote,
} from "../services/Profile";
import { AUTH_REDIRECT_URL } from "../services/authCallback";
import { AcousticClassifier } from "../services/ai/Classifier";
import { HiveSummaryEngine } from "../services/ai/HiveSummaryEngine";
import { AudioIngestionService } from "../services/iot/AudioIngestionService";
import { clips } from "../services/iot/ClipStore";
import { MqttTransport } from "../services/iot/MqttTransport";
import { BleTransport } from "../services/iot/BleTransport";
import { DEMO_USER, applyDemoWeatherDefault, seedDemo } from "./demo";
import { onlyLiveHives } from "./selectors";
import { useTheme, type ThemePreference } from "../components/ui/theme";

type Data = {
  apiaries: Apiary[];
  hives: Hive[];
  microphones: Microphone[];
  samples: AudioSample[];
  summaries: AiSummary[];
  inspections: Inspection[];
  cycles: BroodCycle[];
  /** Node verdicts of the last two weeks, newest first. */
  verdicts: EdgeVerdict[];
  pending: number;
  settings: Record<string, string>;
};
const empty: Data = {
  apiaries: [],
  hives: [],
  microphones: [],
  samples: [],
  summaries: [],
  inspections: [],
  cycles: [],
  verdicts: [],
  pending: 0,
  settings: {},
};
type Workspace = {
  userId: string;
  demo: boolean;
  repo: Repository;
  ingestion: AudioIngestionService;
  summaries: HiveSummaryEngine;
  sync: SyncEngine | null;
  gate: NetworkGate;
  mqtt: MqttTransport;
  ble: BleTransport;
  dispose: () => Promise<void>;
};
type State = {
  workspace: Workspace | null;
  data: Data;
  busy: boolean;
  error: string | null;
  syncState: SyncState;
  enterDemo: () => Promise<void>;
  login: (email: string, password: string) => Promise<void>;
  register: (
    email: string,
    password: string,
    name?: string,
  ) => Promise<string>;
  /** Saves the display name locally and on the account's profile. */
  saveName: (name: string) => Promise<{ synced: boolean }>;
  requestPasswordReset: (email: string) => Promise<void>;
  /** Recovery step 1: check the emailed code. */
  verifyRecoveryCode: (email: string, code: string) => Promise<void>;
  /** Recovery step 2: set the new password and open the account. */
  setRecoveredPassword: (newPassword: string, email?: string) => Promise<void>;
  cancelRecovery: () => Promise<void>;
  /** Re-authenticates with the current password before changing it. */
  changePassword: (current: string, next: string) => Promise<void>;
  /** Deletes the account on the server (after re-authenticating) and erases local data. */
  deleteAccount: (password: string) => Promise<void>;
  offlineLogin: () => Promise<void>;
  logout: () => Promise<void>;
  saveSetting: (key: string, value: string) => Promise<void>;
  refresh: () => Promise<void>;
};
const Context = createContext<State | null>(null);
// Set while a password recovery is under way. A recovery session must never
// open the app: the new password has to be set first.
const RECOVERY_KEY = "apisense.recovery_pending";
const clearRecovery = () =>
  SecureStore.deleteItemAsync(RECOVERY_KEY).catch(() => {});
const profileRemote = (): ProfileRemote | null => {
  const client = supabase;
  if (!client) return null;
  return {
    fetchName: async (id) => {
      const { data, error } = await client
        .from("profiles")
        .select("display_name")
        .eq("id", id)
        .maybeSingle();
      if (error) throw error;
      return (data?.display_name as string | null | undefined) ?? null;
    },
    pushName: async (id, name) => {
      const { data, error } = await client
        .from("profiles")
        .update({ display_name: name })
        .eq("id", id)
        .select("id");
      if (error) throw error;
      if (!data?.length) throw new Error("Perfil no encontrado");
    },
  };
};
/** The Edge Function answers { error } in Spanish; fall back to a generic text. */
async function functionError(error: unknown) {
  const context = (error as { context?: Response })?.context;
  try {
    const body = (await context?.json()) as { error?: string } | undefined;
    if (body?.error) return new Error(body.error);
  } catch {
    // not JSON
  }
  return new Error("No se pudo completar la operación. Revisa tu conexión.");
}
export function AppProvider({ children }: { children: ReactNode }) {
  const [workspace, setWorkspace] = useState<Workspace | null>(null),
    [data, setData] = useState<Data>(empty),
    [busy, setBusy] = useState(true),
    [error, setError] = useState<string | null>(null),
    [syncState, setSyncState] = useState<SyncState>({
      status: "offline",
      error: null,
      lastSyncedAt: null,
    });
  const current = useRef<Workspace | null>(null),
    epoch = useRef(0),
    desired = useRef<string | null>(null),
    activation = useRef<Promise<void> | null>(null),
    recovering = useRef(false);
  const { setPreference } = useTheme();
  const refresh = useCallback(async () => {
    const w = current.current;
    if (!w) return;
    const [
      apiaries,
      hives,
      microphones,
      samples,
      summaries,
      inspections,
      cycles,
      verdicts,
      pending,
    ] = await Promise.all([
      w.repo.list("apiaries"),
      w.repo.list("hives"),
      w.repo.list("iot_microphones"),
      w.repo.list("audio_samples"),
      w.repo.list("ai_summaries"),
      w.repo.list("inspections"),
      w.repo.list("brood_cycles"),
      w.repo.recentVerdicts(verdictSince()),
      w.repo.pendingCount(),
    ]);
    if (current.current !== w) return;
    const settings: Record<string, string> = {};
    for (const key of [
      "name",
      "theme",
      "offline",
      "alerts",
      "dismissed_alert",
    ]) {
      const value = await w.repo.setting(key);
      if (value !== undefined) settings[key] = value;
    }
    // Records of a removed hive stay in the database (and in sync) but are not
    // shown: readings and summaries are not tombstoned with the hive.
    const ofLive = <T extends { hive_id: string }>(rows: T[]) =>
      onlyLiveHives(hives, rows);
    if (current.current === w)
      setData({
        apiaries,
        hives,
        microphones: ofLive(microphones),
        samples: ofLive(samples),
        summaries: ofLive(summaries),
        inspections: ofLive(inspections),
        cycles: ofLive(cycles),
        verdicts: ofLive(verdicts),
        pending,
        settings,
      });
  }, []);
  const activate = useCallback(
    (userId: string, demo: boolean, forceOffline = false): Promise<void> => {
      const key = `${demo ? "demo" : "user"}:${userId}`;
      if (desired.current === key)
        return activation.current ?? Promise.resolve();
      desired.current = key;
      const sequence = ++epoch.current;
      const task = (async () => {
        setBusy(true);
        setError(null);
        const old = current.current;
        current.current = null;
        setWorkspace(null);
        setData(empty);
        await old?.dispose();
        let repo: Repository | undefined;
        try {
          repo = await openRepository(userId);
          const classifier = new AcousticClassifier();
          const ingestion = new AudioIngestionService(
              repo,
              clips,
              classifier.classify,
            ),
            summaries = new HiveSummaryEngine(repo, demo);
          if (demo) {
            await seedDemo(repo, ingestion, summaries);
            await applyDemoWeatherDefault(repo);
          }
          // Housekeeping: old, already-synced "usual sound" verdicts (30 days).
          await repo.pruneVerdicts(
            new Date(Date.now() - 30 * 86_400_000).toISOString(),
          );
          const savedTheme = await repo.setting("theme");
          setPreference(
            savedTheme === "light" || savedTheme === "dark"
              ? savedTheme
              : "system",
          );
          if (forceOffline) await repo.setSetting("offline", "1");
          const gate = new NetworkGate(
            forceOffline || (await repo.setting("offline")) === "1",
          );
          const sync =
            !demo && supabase
              ? new SyncEngine(
                  repo,
                  new SupabaseRemote(supabase, clips.read),
                  userId,
                  gate,
                )
              : null;
          const mqtt = new MqttTransport(),
            ble = new BleTransport();
          let scheduled: ReturnType<typeof setTimeout> | undefined;
          const repoSubscription = repo.subscribe(() => {
            clearTimeout(scheduled);
            scheduled = setTimeout(() => {
              void refresh().catch((e) => setError(String(e)));
            }, 25);
          });
          const syncSubscription = sync?.subscribe(() => {
            if (current.current?.repo === repo) setSyncState(sync.snapshot());
          });
          const timer = setInterval(() => {
            void summaries.runDue().catch((e) => setError(String(e)));
          }, 60_000);
          const w: Workspace = {
            userId,
            demo,
            repo,
            ingestion,
            summaries,
            sync,
            gate,
            mqtt,
            ble,
            dispose: async () => {
              clearInterval(timer);
              clearTimeout(scheduled);
              repoSubscription();
              syncSubscription?.();
              mqtt.stop();
              await ble.stop();
              await sync?.stop();
              await repo!.close();
            },
          };
          if (sequence !== epoch.current) {
            await w.dispose();
            return;
          }
          current.current = w;
          setWorkspace(w);
          setSyncState(
            sync?.snapshot() ?? {
              status: "offline",
              error: null,
              lastSyncedAt: null,
            },
          );
          await refresh();
          sync?.start();
          const remote = profileRemote();
          if (!demo && remote && !gate.isOffline())
            void reconcileName(repo, remote, userId)
              .then(async () => {
                // The name given at sign-up also sits in the auth metadata (and
                // in every token); the profile is its home, so drop that copy.
                const user = (await supabase?.auth.getUser())?.data.user;
                if (user?.user_metadata?.display_name)
                  await supabase?.auth.updateUser({
                    data: { display_name: null },
                  });
                if (current.current === w) await refresh();
              })
              .catch(() => {});
          void summaries.runDue().catch((e) => setError(String(e)));
        } catch (e) {
          if (sequence === epoch.current) {
            desired.current = null;
            setError(e instanceof Error ? e.message : String(e));
          }
          if (repo && current.current?.repo !== repo) await repo.close();
          throw e;
        } finally {
          if (sequence === epoch.current) setBusy(false);
        }
      })();
      activation.current = task;
      return task;
    },
    [refresh, setPreference],
  );
  useEffect(() => {
    let mounted = true;
    if (supabase) {
      void supabase.auth
        .getSession()
        .then(async ({ data, error: authError }) => {
          if (!mounted) return;
          if (authError) setError(authError.message);
          if (data.session) {
            // An interrupted recovery left a session without a new password.
            if ((await SecureStore.getItemAsync(RECOVERY_KEY)) === "1") {
              await supabase?.auth.signOut({ scope: "local" });
              await clearRecovery();
              setBusy(false);
              return;
            }
            return activate(data.session.user.id, false);
          }
          setBusy(false);
        })
        .catch((e) => {
          setError(String(e));
          setBusy(false);
        });
      const {
        data: { subscription },
      } = supabase.auth.onAuthStateChange((event, session) => {
        if (!mounted) return;
        if (event === "SIGNED_OUT") {
          const sequence = ++epoch.current;
          desired.current = null;
          const old = current.current;
          current.current = null;
          setWorkspace(null);
          setData(empty);
          setBusy(true);
          setSyncState({ status: "offline", error: null, lastSyncedAt: null });
          void Promise.resolve()
            .then(() => old?.dispose())
            .catch((e) => {
              if (mounted) setError(String(e));
            })
            .finally(() => {
              if (mounted && sequence === epoch.current) setBusy(false);
            });
        }
        if (event === "SIGNED_IN" && session && !recovering.current)
          void activate(session.user.id, false).catch((e) =>
            setError(String(e)),
          );
      });
      return () => {
        mounted = false;
        subscription.unsubscribe();
        ++epoch.current;
        void current.current?.dispose();
        current.current = null;
      };
    }
    setBusy(false);
    return () => {
      mounted = false;
      ++epoch.current;
      void current.current?.dispose();
      current.current = null;
    };
  }, [activate]);
  useEffect(() => {
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") {
        supabase?.auth.startAutoRefresh();
        void current.current?.sync?.sync().catch(() => {});
        void current.current?.summaries
          .runDue()
          .catch((e) => setError(String(e)));
      } else {
        supabase?.auth.stopAutoRefresh();
      }
    });
    return () => sub.remove();
  }, []);
  const login = async (email: string, password: string) => {
    if (!supabase)
      throw new Error(
        "Configura Supabase en .env para iniciar sesión. Puedes explorar la demo local.",
      );
    const { data, error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });
    if (error) throw error;
    if (!data.user) throw new Error("No se pudo iniciar sesión");
    await activate(data.user.id, false);
  };
  const register = async (email: string, password: string, name = "") => {
    if (!supabase) throw new Error("Configura Supabase en .env");
    const displayName = cleanName(name);
    const { data, error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: {
        emailRedirectTo: AUTH_REDIRECT_URL,
        data: displayName ? { display_name: displayName } : {},
      },
    });
    if (error) throw error;
    if (data.session && data.user) {
      await activate(data.user.id, false);
      return "Cuenta creada";
    }
    return "Revisa tu correo para confirmar la cuenta y después inicia sesión.";
  };
  const offlineLogin = async () => {
    if (!supabase)
      throw new Error(
        "Primero inicia sesión en línea en este dispositivo o usa la demo",
      );
    const { data } = await supabase.auth.getSession();
    if (!data.session)
      throw new Error("No hay una sesión guardada en este dispositivo");
    await activate(data.session.user.id, false, true);
    current.current?.gate.setOffline(true);
    await current.current?.repo.setSetting("offline", "1");
    await refresh();
  };
  const logout = async () => {
    const sequence = ++epoch.current;
    desired.current = null;
    setBusy(true);
    setError(null);
    const w = current.current;
    current.current = null;
    setWorkspace(null);
    setData(empty);
    setSyncState({ status: "offline", error: null, lastSyncedAt: null });
    try {
      try {
        await w?.dispose();
      } finally {
        if (supabase) {
          const { error } = await supabase.auth.signOut({ scope: "local" });
          if (error) setError(error.message);
        }
      }
    } finally {
      if (sequence === epoch.current) setBusy(false);
    }
  };
  const saveProfileName = async (name: string) => {
    const w = current.current;
    if (!w) throw new Error("Abre una sesión local");
    const result = await saveName(
      w.repo,
      w.demo || w.gate.isOffline() ? null : profileRemote(),
      w.userId,
      name,
    );
    // Offline or demo: the change is local; flag it so it is sent later.
    if (!w.demo && !result.synced) await w.repo.setSetting("name_pending", "1");
    await refresh();
    return result;
  };
  const requestPasswordReset = async (email: string) => {
    if (!supabase) throw new Error("Configura Supabase en .env");
    // GoTrue answers the same for known and unknown addresses.
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim());
    if (error)
      throw new Error(
        "No se pudo enviar el código. Inténtalo de nuevo en un momento.",
      );
  };
  /** Step 1: the code opens a recovery session that cannot enter the app yet. */
  const verifyRecoveryCode = async (email: string, code: string) => {
    if (!supabase) throw new Error("Configura Supabase en .env");
    recovering.current = true;
    await SecureStore.setItemAsync(RECOVERY_KEY, "1");
    const { error } = await supabase.auth.verifyOtp({
      email: email.trim(),
      token: code.trim(),
      type: "recovery",
    });
    if (error) {
      recovering.current = false;
      await clearRecovery();
      throw new Error("El código no es válido o ya venció");
    }
  };
  /** Step 2: set the new password; only then does the account open. */
  const setRecoveredPassword = async (newPassword: string, email = "") => {
    if (!supabase || !recovering.current)
      throw new Error("Pide un código nuevo para continuar");
    const problem = newPasswordProblem(newPassword, email);
    if (problem) throw new Error(problem);
    const update = await supabase.auth.updateUser({ password: newPassword });
    if (update.error) {
      // Keep the recovery session so another password can be tried.
      const same = /different from the old/i.test(update.error.message);
      throw new Error(
        same
          ? "Elige una contraseña distinta de la anterior"
          : /weak|pwned|compromised|easy to guess/i.test(update.error.message)
            ? "Esa contraseña es demasiado débil o apareció en filtraciones; elige otra"
            : "No se pudo cambiar la contraseña. Inténtalo de nuevo.",
      );
    }
    recovering.current = false;
    await clearRecovery();
    await activate(update.data.user.id, false);
  };
  /** Leaves a recovery that the user abandoned. */
  const cancelRecovery = async () => {
    if (!recovering.current) return;
    recovering.current = false;
    await clearRecovery();
    await supabase?.auth.signOut({ scope: "local" });
  };
  const changePassword = async (currentPassword: string, next: string) => {
    if (!supabase) throw new Error("Configura Supabase en .env");
    const user = (await supabase.auth.getUser()).data.user;
    if (!user?.email) throw new Error("Inicia sesión en línea para cambiarla");
    const problem = newPasswordProblem(next, user.email);
    if (problem) throw new Error(problem);
    const check = await supabase.auth.signInWithPassword({
      email: user.email,
      password: currentPassword,
    });
    if (check.error) throw new Error("La contraseña actual no es correcta");
    const { error } = await supabase.auth.updateUser({ password: next });
    if (error) throw error;
  };
  const deleteAccount = async (password: string) => {
    const w = current.current;
    if (!supabase || !w || w.demo) throw new Error("No hay una cuenta que borrar");
    // Nothing may be pushed while the server copy is being removed.
    w.gate.setOffline(true);
    await w.sync?.stop();
    let confirmed = false;
    try {
      const { error } = await supabase.functions.invoke("delete-account", {
        body: { password },
      });
      if (!error) confirmed = true;
      else {
        // The reply may have been lost after the server finished: if the
        // account no longer exists, the deletion did happen.
        const gone = await supabase.auth.getUser();
        if (gone.error && /not exist|user_not_found/i.test(
          `${gone.error.code ?? ""} ${gone.error.message}`,
        ))
          confirmed = true;
        else throw await functionError(error);
      }
    } catch (e) {
      if (!confirmed) {
        // Back to how it was: sync resumes unless field mode was chosen.
        w.gate.setOffline((await w.repo.setting("offline")) === "1");
        w.sync?.start();
        throw e;
      }
    }
    // The server confirmed: now the local copy and its key can go.
    try {
      await logout();
    } finally {
      await eraseLocalData(w.userId);
    }
  };
  const saveSetting = async (key: string, value: string) => {
    const w = current.current;
    if (!w) throw new Error("Abre una sesión local");
    await w.repo.setSetting(key, value);
    if (key === "offline") w.gate.setOffline(value === "1");
    if (key === "theme") setPreference(value as ThemePreference);
    await refresh();
  };
  return (
    <Context.Provider
      value={{
        workspace,
        data,
        busy,
        error,
        syncState,
        refresh,
        enterDemo: () => activate(DEMO_USER, true),
        login,
        register,
        saveName: saveProfileName,
        requestPasswordReset,
        verifyRecoveryCode,
        setRecoveredPassword,
        cancelRecovery,
        changePassword,
        deleteAccount,
        offlineLogin,
        logout,
        saveSetting,
      }}
    >
      {children}
    </Context.Provider>
  );
}
export function useApp() {
  const value = useContext(Context);
  if (!value) throw new Error("AppProvider missing");
  return value;
}
