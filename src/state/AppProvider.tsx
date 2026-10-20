import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { AppState, Platform } from "react-native";
import { findWebPrincipal, rememberWebPrincipal } from "../db/webVault";
import { openRepository } from "../db/openRepository";
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
} from "../db/types";
import { supabase } from "../services/supabase";
import { AcousticClassifier } from "../services/ai/Classifier";
import { HiveSummaryEngine } from "../services/ai/HiveSummaryEngine";
import { AudioIngestionService } from "../services/iot/AudioIngestionService";
import { clips } from "../services/iot/ClipStore";
import { MqttTransport } from "../services/iot/MqttTransport";
import { BleTransport } from "../services/iot/BleTransport";
import { DEMO_USER, seedDemo } from "./demo";
import { useTheme, type ThemePreference } from "../components/ui/theme";

type Data = {
  apiaries: Apiary[];
  hives: Hive[];
  microphones: Microphone[];
  samples: AudioSample[];
  summaries: AiSummary[];
  inspections: Inspection[];
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
  login: (
    email: string,
    password: string,
    passphrase?: string,
  ) => Promise<void>;
  register: (
    email: string,
    password: string,
    passphrase?: string,
  ) => Promise<string>;
  offlineLogin: (email?: string, passphrase?: string) => Promise<void>;
  logout: () => Promise<void>;
  saveSetting: (key: string, value: string) => Promise<void>;
  refresh: () => Promise<void>;
};
const Context = createContext<State | null>(null);
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
    activation = useRef<Promise<void> | null>(null);
  const { setPreference } = useTheme();
  const webKey = useRef<string | undefined>(undefined);
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
      pending,
    ] = await Promise.all([
      w.repo.list("apiaries"),
      w.repo.list("hives"),
      w.repo.list("iot_microphones"),
      w.repo.list("audio_samples"),
      w.repo.list("ai_summaries"),
      w.repo.list("inspections"),
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
    if (current.current === w)
      setData({
        apiaries,
        hives,
        microphones,
        samples,
        summaries,
        inspections,
        pending,
        settings,
      });
  }, []);
  const activate = useCallback(
    (
      userId: string,
      demo: boolean,
      passphrase?: string,
      forceOffline = false,
    ): Promise<void> => {
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
          repo = await openRepository(userId, passphrase);
          const classifier = new AcousticClassifier();
          const ingestion = new AudioIngestionService(
              repo,
              clips,
              classifier.classify,
            ),
            summaries = new HiveSummaryEngine(repo, demo);
          if (demo) await seedDemo(repo, ingestion, summaries);
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
        .then(({ data, error: authError }) => {
          if (!mounted) return;
          if (authError) setError(authError.message);
          if (data.session && Platform.OS !== "web")
            return activate(data.session.user.id, false);
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
        if (
          event === "SIGNED_IN" &&
          session &&
          (Platform.OS !== "web" || webKey.current)
        )
          void activate(session.user.id, false, webKey.current).catch((e) =>
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
  const login = async (
    email: string,
    password: string,
    passphrase?: string,
  ) => {
    if (!supabase)
      throw new Error(
        "Configura Supabase en .env para iniciar sesión. Puedes explorar la demo local.",
      );
    if (Platform.OS === "web" && (!passphrase || passphrase.length < 16))
      throw new Error(
        "Introduce una clave local de al menos 16 caracteres para cifrar tus datos",
      );
    webKey.current = passphrase;
    const { data, error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });
    if (error) throw error;
    if (!data.user) throw new Error("No se pudo iniciar sesión");
    await activate(data.user.id, false, passphrase);
    if (Platform.OS === "web") await rememberWebPrincipal(email, data.user.id);
  };
  const register = async (
    email: string,
    password: string,
    passphrase?: string,
  ) => {
    if (!supabase) throw new Error("Configura Supabase en .env");
    if (Platform.OS === "web" && (!passphrase || passphrase.length < 16))
      throw new Error("Introduce una clave local de al menos 16 caracteres");
    webKey.current = passphrase;
    const { data, error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
    });
    if (error) throw error;
    if (data.session && data.user) {
      await activate(data.user.id, false, passphrase);
      if (Platform.OS === "web")
        await rememberWebPrincipal(email, data.user.id);
      return "Cuenta creada";
    }
    return "Revisa tu correo para confirmar la cuenta y después inicia sesión.";
  };
  const offlineLogin = async (email?: string, passphrase?: string) => {
    if (Platform.OS === "web") {
      if (!email?.trim())
        throw new Error(
          "Introduce el correo de la cuenta que guardaste en este navegador",
        );
      const id = await findWebPrincipal(email);
      if (!id)
        throw new Error(
          "No hay datos guardados de esa cuenta en este navegador",
        );
      await activate(id, false, passphrase, true);
    } else {
      if (!supabase)
        throw new Error(
          "Primero inicia sesión en línea en este dispositivo o usa la demo",
        );
      const { data } = await supabase.auth.getSession();
      if (!data.session)
        throw new Error("No hay una sesión guardada en este dispositivo");
      await activate(data.session.user.id, false, undefined, true);
    }
    current.current?.gate.setOffline(true);
    await current.current?.repo.setSetting("offline", "1");
    await refresh();
  };
  const logout = async () => {
    ++epoch.current;
    desired.current = null;
    webKey.current = undefined;
    const w = current.current;
    current.current = null;
    setWorkspace(null);
    setData(empty);
    await w?.dispose();
    if (supabase) {
      const { error } = await supabase.auth.signOut({ scope: "local" });
      if (error) setError(error.message);
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
