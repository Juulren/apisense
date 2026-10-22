// Expo 57.0.4 eagerly claims OPFS handles even for :memory: databases.
// Keep encrypted vaults independent across tabs; retain OPFS for the demo.
// Remove this workaround after validating an upstream lazy-VFS implementation.
import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";

const root = new URL("../node_modules/expo-sqlite/", import.meta.url);
const pkg = JSON.parse(await readFile(new URL("package.json", root), "utf8"));
if (pkg.version !== "57.0.4")
  throw new Error(
    "Review the SQLite web VFS workaround before upgrading expo-sqlite.",
  );
const path = new URL("web/worker.ts", root);
const source = (await readFile(path, "utf8")).replaceAll("\r\n", "\n");
const marker = "// Apisense: initialize OPFS only for persistent databases.";
const patchedHash =
  "8638c6ce683c01e63a2b33a576bc98cf62d4876f6bd5cc4da53e15aa5a1d3a31";
const hash = createHash("sha256").update(source).digest("hex");
if (hash === patchedHash) {
  console.log("SQLite web lazy VFS workaround already applied.");
  process.exit(0);
}
if (hash !== "5294dff8ab8489b336f7757d011cbcde2c845b592df0c1924da468a416937cd0")
  throw new Error("Unexpected SQLite worker source; refusing to modify it.");

let patched = source.replace(
  "let _sqlite3: SQLiteAPI | null = null;\nlet _vfs: AccessHandlePoolVFS | null = null;\nlet _vfsMemory: MemoryVFS | null = null;",
  "let initialization: ReturnType<typeof initializeMemoryRuntime> | undefined;\nlet persistentInitialization: Promise<AccessHandlePoolVFS> | undefined;",
);
patched = patched.replace(
  "  const { vfs } = await maybeInitAsync();\n  if (databasePath !== ':memory:') {",
  "  if (databasePath !== ':memory:') {\n    const { vfs } = await maybeInitPersistentAsync();",
);
patched = patched.replace(
  "const { sqlite3, vfs } = await maybeInitAsync();",
  "const { sqlite3, vfs } = await maybeInitPersistentAsync();",
);
patched = patched.replace(
  "    const flags = SQLITE_OPEN_READWRITE | SQLITE_OPEN_CREATE;\n    const vfsName",
  "    if (databasePath !== ':memory:') await maybeInitPersistentAsync();\n    const flags = SQLITE_OPEN_READWRITE | SQLITE_OPEN_CREATE;\n    const vfsName",
);
const start = patched.indexOf("async function maybeInitAsync():");
const end = patched.indexOf("//#endregion Internal helpers", start);
patched =
  patched.slice(0, start) +
  `${marker}
async function initializeMemoryRuntime() {
  const module = await WaSQLiteFactory({ locateFile: () => wasmModule });
  const sqlite3 = SQLite.Factory(module) as SQLiteAPI;
  if (!sqlite3) throw new Error('Failed to initialize wa-sqlite');
  const vfsMemory = await MemoryVFS.create(VFS_NAME_MEMORY, module);
  if (!vfsMemory) throw new Error('Failed to initialize MemoryVFS');
  sqlite3.vfs_register(vfsMemory, true);
  return {
    sqlite3,
    vfsMemory,
    createPersistent: async () => {
      const vfs = await AccessHandlePoolVFS.create(VFS_NAME_PERSISTENT, module);
      if (!vfs) throw new Error('Failed to initialize AccessHandlePoolVFS');
      sqlite3.vfs_register(vfs, true);
      return vfs;
    },
  };
}

async function maybeInitAsync() {
  return initialization ??= initializeMemoryRuntime().catch((error) => {
    initialization = undefined;
    throw error;
  });
}

async function maybeInitPersistentAsync() {
  const runtime = await maybeInitAsync();
  const vfs = await (persistentInitialization ??= runtime.createPersistent().catch((error) => {
    persistentInitialization = undefined;
    throw error;
  }));
  return { sqlite3: runtime.sqlite3, vfs };
}

` +
  patched.slice(end);
if (createHash("sha256").update(patched).digest("hex") !== patchedHash)
  throw new Error(
    "SQLite worker patch verification failed; source left unchanged.",
  );
await writeFile(path, patched);
console.log("Applied SQLite web lazy VFS workaround (expo-sqlite 57.0.4).");
