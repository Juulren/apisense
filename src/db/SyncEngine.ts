import { Repository } from './Repository';
import { TABLES, type AnyRow, type AudioSample, type EntityMap, type Table } from './types';
export interface RemotePort {
  identity(): Promise<string | null>;
  clock(): Promise<string>;
  uploadAudio(sample: AudioSample, owner: string): Promise<string>;
  upsert(table: Table, row: AnyRow): Promise<void>;
  page<K extends Table>(table: K, since: string | null, until: string, offset: number): Promise<EntityMap[K][]>;
}
export interface NetworkPort { subscribe(listener: (online: boolean) => void): () => void }
export type SyncState = { status: 'idle' | 'syncing' | 'offline' | 'error'; error: string | null; lastSyncedAt: string | null };
export class SyncEngine {
  private running: Promise<void> | null = null;
  private unsubscribe?: () => void;
  private timer?: ReturnType<typeof setInterval>;
  private online = false;
  private stopped = false;
  private listeners = new Set<() => void>();
  private state: SyncState = { status: 'idle', error: null, lastSyncedAt: null };
  constructor(private local: Repository, private remote: RemotePort, private owner: string, private network: NetworkPort, private now = () => new Date()) {}
  snapshot = () => this.state;
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
  private update(patch: Partial<SyncState>) { this.state = { ...this.state, ...patch }; this.listeners.forEach(listener => listener()); }
  start() {
    if (this.unsubscribe) return;
    this.stopped = false;
    this.unsubscribe = this.network.subscribe(online => { this.online = online; if (online) void this.sync().catch(() => {}); else this.update({ status: 'offline' }); });
    this.timer = setInterval(() => { if (this.online) void this.sync().catch(() => {}); }, 15_000);
  }
  async stop() { this.stopped = true; this.unsubscribe?.(); this.unsubscribe = undefined; clearInterval(this.timer); await this.running?.catch(() => {}); }
  sync(): Promise<void> { if (this.running) return this.running; this.running = this.run().finally(() => { this.running = null; }); return this.running; }
  private async run() {
    if (!this.online || this.stopped) { this.update({ status: 'offline' }); return; }
    this.update({ status: 'syncing', error: null });
    try {
      if (await this.remote.identity() !== this.owner) throw new Error('Inicia sesión con la cuenta de esta base local');
      await this.local.recoverQueue();
      const failures = await this.pushLocalChanges();
      if (this.stopped || !this.online) { this.update({ status: 'offline' }); return; }
      await this.pullRemoteChanges(await this.local.checkpoint());
      if (failures) throw new Error(`${failures} registros pendientes; se reintentará automáticamente`);
      this.update({ status: 'idle', lastSyncedAt: this.now().toISOString() });
    } catch (error) { this.update({ status: 'error', error: error instanceof Error ? error.message : 'Error de sincronización' }); throw error; }
  }
  async pushLocalChanges() {
    let failures = 0;
    for (const item of await this.local.pending(this.now().toISOString())) {
      if (this.stopped || !this.online) break;
      try {
        let row = item.row; let path: string | undefined;
        if (item.table_name === 'apiaries' && (row as EntityMap['apiaries']).user_id !== this.owner) throw new Error('Propietario de apiario inválido');
        if (item.table_name === 'audio_samples') {
          const sample = row as AudioSample;
          if (sample.local_audio_uri && !sample.audio_file_url) { path = await this.remote.uploadAudio(sample,this.owner); row = { ...sample,audio_file_url:path }; }
        }
        await this.remote.upsert(item.table_name,row);
        await this.local.acknowledge(item,path);
      } catch (error) { failures++; await this.local.failed(item,error,this.now()); }
    }
    return failures;
  }
  async pullRemoteChanges(lastPulledAt: string | null) {
    const until = await this.remote.clock();
    const since = lastPulledAt ? new Date(Date.parse(lastPulledAt) - 120_000).toISOString() : null;
    for (const table of TABLES) {
      for (let offset=0;;) {
        if (this.stopped || !this.online) throw new Error('Conexión interrumpida durante descarga');
        const rows = await this.remote.page(table,since,until,offset);
        await this.local.applyRemote(table,rows);
        if (rows.length < 200) break;
        offset += rows.length;
      }
    }
    await this.local.setCheckpoint(until);
  }
}
