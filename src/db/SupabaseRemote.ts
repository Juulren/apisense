import type { SupabaseClient } from '@supabase/supabase-js';
import type { RemotePort } from './SyncEngine';
import type { AnyRow, AudioSample, EntityMap, Table } from './types';
export class SupabaseRemote implements RemotePort {
  constructor(private client: SupabaseClient, private readAudio: (uri: string) => Promise<ArrayBuffer>) {}
  async identity() { const { data, error } = await this.client.auth.getUser(); if (error) throw error; return data.user?.id ?? null; }
  async clock() { const { data,error } = await this.client.rpc('sync_clock'); if (error) throw error; if (typeof data !== 'string' || !Number.isFinite(Date.parse(data))) throw new Error('Reloj remoto inválido'); return new Date(data).toISOString(); }
  async uploadAudio(sample: AudioSample, owner: string) {
    if (!sample.local_audio_uri) throw new Error('Clip local no disponible');
    const path = `${owner}/${sample.hive_id}/${sample.id}.wav`;
    const { error } = await this.client.storage.from('hive-audio').upload(path,await this.readAudio(sample.local_audio_uri),{contentType:'audio/wav',upsert:true});
    if (error) throw error;
    return path;
  }
  async upsert(table: Table, row: AnyRow) {
    const { local_revision: _revision, synced_at: _synced, ...payload } = row;
    if ('local_audio_uri' in payload) delete (payload as Partial<AudioSample>).local_audio_uri;
    const { error } = await this.client.from(table).upsert(payload as Record<string, unknown>,{ onConflict:'id' });
    if (error) throw error;
  }
  async page<K extends Table>(table: K, since: string | null, until: string, offset: number): Promise<EntityMap[K][]> {
    let query = this.client.from(table).select('*').lte('updated_at',until).order('updated_at').order('id').range(offset,offset+199);
    if (since) query = query.gte('updated_at',since);
    const { data,error } = await query;
    if (error) throw error;
    return (data ?? []).map(row => ({...row,updated_at:new Date(row.updated_at).toISOString(),deleted_at:row.deleted_at ? new Date(row.deleted_at).toISOString() : null,local_revision:0,synced_at:row.updated_at})) as EntityMap[K][];
  }
}
