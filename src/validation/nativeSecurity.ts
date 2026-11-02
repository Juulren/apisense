import { randomUUID } from "expo-crypto";
import { deleteDatabaseAsync, openDatabaseAsync } from "expo-sqlite";
import * as SecureStore from "expo-secure-store";
import { openRepository, repositoryStorage } from "../db/openRepository";
import type { Repository } from "../db/Repository";
import { SECURITY_QA } from "../config/runtime";
import { clips } from "../services/iot/ClipStore";
import { AudioIngestionService } from "../services/iot/AudioIngestionService";
import { AcousticClassifier } from "../services/ai/Classifier";
import { HiveSummaryEngine } from "../services/ai/HiveSummaryEngine";
import { seedDemo } from "../state/demo";

function assert(value: unknown, message: string): asserts value {
  if (!value) throw new Error(message);
}
async function rejected(action: () => Promise<unknown>) {
  try {
    await action();
  } catch {
    return;
  }
  throw new Error("Se aceptó un acceso que debía rechazarse");
}
function contains(bytes: Uint8Array, text: string) {
  const needle = Array.from(text, (c) => c.charCodeAt(0));
  return bytes.some((_, i) => needle.every((c, j) => bytes[i + j] === c));
}

// No service client and no real account IDs. Every test owns its random files
// and keys, so cleanup cannot target a user's workspace or the public demo.
export async function runNativeSecurityChecks(
  report: (result: string) => void,
) {
  if (!SECURITY_QA)
    throw new Error("Comprobación disponible solo en el build QA");
  const identities = [0, 1].map(() => `qa-15-${randomUUID()}`);
  let repo: Repository | undefined;
  try {
    const alice = identities[0]!,
      bob = identities[1]!;
    const marker = `nota-privada-${randomUUID()}`;
    repo = await openRepository(alice);
    const cipher = (
      await repo.sql.all<{ cipher_version: string }>("PRAGMA cipher_version")
    )[0];
    assert(cipher?.cipher_version, "SQLCipher no disponible");
    await repo.setSetting("qa-marker", marker);
    const ingestion = new AudioIngestionService(
      repo,
      clips,
      new AcousticClassifier().classify,
    );
    await seedDemo(repo, ingestion, new HiveSummaryEngine(repo, true));
    const sample = (await repo.list("audio_samples"))[0];
    assert(sample?.local_audio_uri, "Falta el clip permanente");
    const originalClip = new Uint8Array(
      await clips.read(sample.local_audio_uri),
    );
    assert(originalClip.length > 44, "WAV incompleto");
    // Inspect committed database AND WAL while the WAL actually exists.
    const location = repositoryStorage(alice);
    const { File } = await import("expo-file-system");
    for (const file of [location.file, new File(`${location.file.uri}-wal`)]) {
      if (!file.exists) continue;
      const bytes = await file.bytes();
      assert(!contains(bytes, marker), "Nota visible en disco");
      assert(
        !contains(bytes, sample.local_audio_uri.slice(0, 80)),
        "Clip visible en disco",
      );
    }
    await repo.close();
    repo = undefined;
    const encrypted = await location.file.bytes();
    assert(encrypted.length > 16, "Base vacía");
    assert(
      !contains(encrypted.subarray(0, 16), "SQLite format 3"),
      "Cabecera SQLite sin cifrar",
    );
    report("SQLCipher y archivos DB/WAL cifrados: OK");

    for (const key of [undefined, "00".repeat(32)]) {
      const raw = await openDatabaseAsync(location.databaseName, {
        useNewConnection: true,
      });
      try {
        if (key) await raw.execAsync(`PRAGMA key = "x'${key}'";`);
        await rejected(() => raw.getAllAsync("SELECT name FROM sqlite_master"));
      } finally {
        await raw.closeAsync();
      }
    }
    report("Lectura sin clave y con clave incorrecta: rechazada");

    const saved = await SecureStore.getItemAsync(location.keyName);
    assert(saved, "Clave ausente tras cierre");
    await SecureStore.deleteItemAsync(location.keyName);
    try {
      await rejected(() => openRepository(alice));
      assert(
        (await SecureStore.getItemAsync(location.keyName)) === null,
        "Se sustituyó una clave perdida",
      );
    } finally {
      await SecureStore.setItemAsync(location.keyName, saved, {
        keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
      });
    }
    report("Clave perdida: datos conservados sin reemplazo");

    repo = await openRepository(bob);
    assert(
      (await repo.setting("qa-marker")) === undefined,
      "Cuenta B leyó la cuenta A",
    );
    const bobKey = await SecureStore.getItemAsync(
      repositoryStorage(bob).keyName,
    );
    assert(bobKey && bobKey !== saved, "Las cuentas comparten clave");
    assert(
      (await repo.list("audio_samples")).length === 0,
      "Se compartieron clips entre cuentas",
    );
    await repo.close();
    repo = undefined;
    report("Dos identidades locales con claves y datos separados: OK");

    repo = await openRepository(alice);
    assert(
      (await repo.setting("qa-marker")) === marker,
      "Se perdió la nota al reabrir",
    );
    const reopenedSample = await repo.get("audio_samples", sample.id);
    assert(reopenedSample?.local_audio_uri, "Se perdió el clip al reabrir");
    const reopenedClip = new Uint8Array(
      await clips.read(reopenedSample.local_audio_uri),
    );
    assert(
      originalClip.length === reopenedClip.length &&
        originalClip.every((b, i) => reopenedClip[i] === b),
      "El clip cambió al reabrir",
    );
    report("Reapertura con SecureStore y WAV idéntico: OK");
  } finally {
    await repo?.close();
    for (const id of identities) {
      const storage = repositoryStorage(id);
      if (storage.file.exists) await deleteDatabaseAsync(storage.databaseName);
      await SecureStore.deleteItemAsync(storage.keyName);
    }
  }
  report("Datos temporales y claves QA eliminados: OK");
}
