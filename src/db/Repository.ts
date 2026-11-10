import { columns, migrationV1, migrationV2, migrationV3 } from "./schema";
import {
  TABLES,
  type AnyRow,
  type BaseRow,
  type EntityMap,
  type Input,
  type QueueItem,
  type SqlPort,
  type SqlValue,
  type Table,
} from "./types";
const metadata = [
  "id",
  "updated_at",
  "synced_at",
  "deleted_at",
  "local_revision",
];
type Dictionary = Record<string, SqlValue>;
export class Repository {
  private tail: Promise<unknown> = Promise.resolve();
  private listeners = new Set<() => void>();
  constructor(
    readonly sql: SqlPort,
    private uuid: () => string,
    private now: () => Date = () => new Date(),
  ) {}
  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };
  private emit() {
    this.listeners.forEach((listener) => listener());
  }
  private exclusive<T>(action: () => Promise<T>): Promise<T> {
    const result = this.tail.then(action);
    this.tail = result.catch(() => {});
    return result;
  }
  private async transaction<T>(action: () => Promise<T>): Promise<T> {
    return this.exclusive(async () => {
      await this.sql.exec("BEGIN IMMEDIATE");
      try {
        const result = await action();
        await this.sql.exec("COMMIT");
        this.emit();
        return result;
      } catch (error) {
        await this.sql.exec("ROLLBACK");
        throw error;
      }
    });
  }
  async initialize() {
    await this.sql.exec("PRAGMA foreign_keys = ON; PRAGMA journal_mode = WAL;");
    const version =
      (await this.sql.all<{ user_version: number }>("PRAGMA user_version"))[0]
        ?.user_version ?? 0;
    if (version > 3)
      throw new Error(
        "La base local requiere una versión más reciente de Apisense",
      );
    if (version < 1) await this.transaction(() => this.sql.exec(migrationV1));
    if (version < 2) await this.transaction(() => this.sql.exec(migrationV2));
    if (version < 3) await this.transaction(() => this.sql.exec(migrationV3));
  }
  private async insert(table: Table, row: Dictionary) {
    const allowed = new Set<string>([...metadata, ...columns[table]]);
    const keys = Object.keys(row).filter((key) => allowed.has(key));
    await this.sql.run(
      `INSERT INTO ${table} (${keys.join(",")}) VALUES (${keys.map(() => "?").join(",")}) ON CONFLICT(id) DO UPDATE SET ${keys
        .filter((key) => key !== "id")
        .map((key) => `${key}=excluded.${key}`)
        .join(",")}`,
      keys.map((key) => row[key] ?? null),
    );
  }
  async save<K extends Table>(
    table: K,
    input: Input<K>,
  ): Promise<EntityMap[K]> {
    return this.transaction(async () => {
      const id = input.id ?? this.uuid();
      const old = (
        await this.sql.all<BaseRow>(`SELECT * FROM ${table} WHERE id=?`, [id])
      )[0];
      const updated_at = new Date(
        Math.max(
          this.now().getTime(),
          old ? Date.parse(old.updated_at) + 1 : 0,
        ),
      ).toISOString();
      const row = {
        ...input,
        id,
        updated_at,
        synced_at: null,
        deleted_at: input.deleted_at ?? null,
        local_revision: (old?.local_revision ?? 0) + 1,
      } as EntityMap[K];
      await this.insert(table, row as unknown as Dictionary);
      await this.enqueue(table, id, row.local_revision);
      return row;
    });
  }
  private enqueue(table: Table, id: string, revision: number) {
    return this.sql.run(
      "INSERT INTO sync_queue(table_name,record_id,revision,next_retry_at) VALUES (?,?,?,?) ON CONFLICT(table_name,record_id) DO UPDATE SET revision=excluded.revision,attempts=0,next_retry_at=excluded.next_retry_at,last_error=NULL",
      [table, id, revision, this.now().toISOString()],
    );
  }
  private async tombstone(table: Table, row: AnyRow) {
    const stamp = new Date(
      Math.max(this.now().getTime(), Date.parse(row.updated_at) + 1),
    ).toISOString();
    const next = {
      ...row,
      updated_at: stamp,
      deleted_at: stamp,
      synced_at: null,
      local_revision: row.local_revision + 1,
    };
    await this.insert(table, next as unknown as Dictionary);
    await this.enqueue(table, row.id, next.local_revision);
  }
  /**
   * Removes a hive and the records that only make sense with it (microphones,
   * inspections, brood cycles) as tombstones, atomically, so every change syncs.
   * Readings and summaries are intentionally left alone: they are hidden by the
   * hive's absence, which avoids uploading clips of a hive nobody can see.
   * Does not call save(): a nested transaction would wait on itself.
   */
  async removeHive(hiveId: string): Promise<void> {
    await this.transaction(async () => {
      const hive = (
        await this.sql.all<EntityMap["hives"]>(
          "SELECT * FROM hives WHERE id=?",
          [hiveId],
        )
      )[0];
      if (!hive || hive.deleted_at)
        throw new Error("La colmena ya no está disponible");
      for (const table of [
        "iot_microphones",
        "inspections",
        "brood_cycles",
      ] as const) {
        const rows = await this.sql.all<AnyRow>(
          `SELECT * FROM ${table} WHERE hive_id=? AND deleted_at IS NULL`,
          [hiveId],
        );
        for (const row of rows) await this.tombstone(table, row);
      }
      await this.tombstone("hives", hive);
    });
  }
  async list<K extends Table>(
    table: K,
    includeDeleted = false,
  ): Promise<EntityMap[K][]> {
    return this.exclusive(() =>
      this.sql.all<EntityMap[K]>(
        `SELECT * FROM ${table}${includeDeleted ? "" : " WHERE deleted_at IS NULL"} ORDER BY id`,
      ),
    );
  }
  async get<K extends Table>(
    table: K,
    id: string,
  ): Promise<EntityMap[K] | undefined> {
    return this.exclusive(
      async () =>
        (
          await this.sql.all<EntityMap[K]>(
            `SELECT * FROM ${table} WHERE id=?`,
            [id],
          )
        )[0],
    );
  }
  async setting(key: string): Promise<string | undefined> {
    return this.exclusive(
      async () =>
        (
          await this.sql.all<{ value: string }>(
            "SELECT value FROM app_settings WHERE key=?",
            [key],
          )
        )[0]?.value,
    );
  }
  async setSetting(key: string, value: string) {
    await this.transaction(() =>
      this.sql.run(
        "INSERT INTO app_settings VALUES (?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value",
        [key, value],
      ),
    );
  }
  async checkpoint(): Promise<string | null> {
    return this.exclusive(
      async () =>
        (
          await this.sql.all<{ value: string }>(
            "SELECT value FROM sync_meta WHERE key='lastPulledAt'",
          )
        )[0]?.value ?? null,
    );
  }
  async setCheckpoint(value: string) {
    await this.transaction(() =>
      this.sql.run(
        "INSERT INTO sync_meta VALUES ('lastPulledAt',?) ON CONFLICT(key) DO UPDATE SET value=excluded.value",
        [value],
      ),
    );
  }
  async pending(now: string): Promise<QueueItem[]> {
    return this.exclusive(async () => {
      const queue = await this.sql.all<Omit<QueueItem, "row">>(
        "SELECT * FROM sync_queue WHERE next_retry_at <= ?",
        [now],
      );
      const rows: QueueItem[] = [];
      for (const item of queue) {
        const row = (
          await this.sql.all<AnyRow>(
            `SELECT * FROM ${item.table_name} WHERE id=?`,
            [item.record_id],
          )
        )[0];
        if (row) rows.push({ ...item, row });
      }
      return rows.sort(
        (a, b) => TABLES.indexOf(a.table_name) - TABLES.indexOf(b.table_name),
      );
    });
  }
  async pendingCount() {
    return this.exclusive(
      async () =>
        (
          await this.sql.all<{ count: number }>(
            "SELECT COUNT(*) AS count FROM sync_queue",
          )
        )[0]?.count ?? 0,
    );
  }
  async acknowledge(item: QueueItem, storagePath?: string) {
    await this.transaction(async () => {
      const extra =
        storagePath && item.table_name === "audio_samples"
          ? ",audio_file_url=?"
          : "";
      const args: SqlValue[] = [item.row.updated_at];
      if (extra) args.push(storagePath!);
      args.push(item.record_id, item.revision);
      await this.sql.run(
        `UPDATE ${item.table_name} SET synced_at=?${extra} WHERE id=? AND local_revision=?`,
        args,
      );
      await this.sql.run(
        "DELETE FROM sync_queue WHERE table_name=? AND record_id=? AND revision=?",
        [item.table_name, item.record_id, item.revision],
      );
    });
  }
  async failed(item: QueueItem, error: unknown, now: Date) {
    const delay = Math.min(300_000, 1000 * 2 ** Math.min(item.attempts, 8));
    await this.transaction(() =>
      this.sql.run(
        "UPDATE sync_queue SET attempts=attempts+1,next_retry_at=?,last_error=? WHERE table_name=? AND record_id=? AND revision=?",
        [
          new Date(now.getTime() + delay).toISOString(),
          String(error).slice(0, 300),
          item.table_name,
          item.record_id,
          item.revision,
        ],
      ),
    );
  }
  async applyRemote<K extends Table>(table: K, rows: EntityMap[K][]) {
    await this.transaction(async () => {
      for (const remote of rows) {
        const local = (
          await this.sql.all<EntityMap[K]>(
            `SELECT * FROM ${table} WHERE id=?`,
            [remote.id],
          )
        )[0];
        if (
          local &&
          (local.synced_at === null ||
            local.updated_at > local.synced_at ||
            local.updated_at > remote.updated_at)
        )
          continue;
        const row = {
          ...remote,
          synced_at: remote.updated_at,
          local_revision: local?.local_revision ?? 0,
        } as unknown as Dictionary;
        if (table === "audio_samples")
          row.local_audio_uri =
            (local as EntityMap["audio_samples"] | undefined)
              ?.local_audio_uri ?? null;
        await this.insert(table, row);
      }
    });
  }
  async recoverQueue() {
    await this.transaction(async () => {
      for (const table of TABLES)
        await this.sql.run(
          `INSERT INTO sync_queue(table_name,record_id,revision,next_retry_at) SELECT ?,id,local_revision,updated_at FROM ${table} WHERE synced_at IS NULL OR updated_at > synced_at ON CONFLICT(table_name,record_id) DO NOTHING`,
          [table],
        );
    });
  }
  async close() {
    await this.exclusive(() => this.sql.close());
    this.listeners.clear();
  }
}
