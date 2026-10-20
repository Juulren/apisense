import { toByteArray } from 'base64-js';
import type { Repository } from '../../db/Repository';
import type { AcousticClass, AudioSample } from '../../db/types';
import type { ClipStore } from './ClipStore';
import { validateFrame, type TelemetryFrame } from './protocol';
import { decodeWav } from './wav';
export type Classification = { classification:AcousticClass; confidence:number; version:string };
export class AudioIngestionService {
  private tail:Promise<unknown>=Promise.resolve();
  constructor(private local:Repository,private clips:ClipStore,private classify:(frame:TelemetryFrame)=>Classification|Promise<Classification> = () => ({classification:'unknown',confidence:0,version:'unclassified'})) {}
  ingest(input:unknown,source:AudioSample['source']):Promise<AudioSample> { const result=this.tail.then(()=>this.receive(input,source)); this.tail=result.catch(()=>{}); return result; }
  private async receive(input:unknown,source:AudioSample['source']) {
    const frame=validateFrame(input); const existing=await this.local.get('audio_samples',frame.id); if(existing) return existing;
    const mic=await this.local.get('iot_microphones',frame.device_id); const hive=await this.local.get('hives',frame.hive_id);
    if(!mic || mic.deleted_at || !hive || hive.deleted_at || mic.hive_id!==frame.hive_id) throw new Error('Micrófono no vinculado a esta colmena');
    let local_audio_uri:string|null=null;
    if(frame.wav_base64) {
      const bytes=toByteArray(frame.wav_base64); const wav=decodeWav(bytes);
      if(wav.sampleRate!==frame.sampling_rate_hz || Math.abs(wav.pcm.length/wav.sampleRate-frame.duration_seconds)>.05) throw new Error('Clip y telemetría no coinciden');
      local_audio_uri=await this.clips.write(frame.id,bytes);
    }
    const classification=await this.classify(frame);
    if(!Number.isFinite(classification.confidence) || classification.confidence<0 || classification.confidence>1) throw new Error('Puntuación del clasificador inválida');
    const sample=await this.local.save('audio_samples',{id:frame.id,hive_id:frame.hive_id,device_id:frame.device_id,recorded_at:frame.recorded_at,duration_seconds:frame.duration_seconds,dominant_freq_hz:frame.dominant_freq_hz,amplitude_db:frame.amplitude_db,mfcc_features_json:JSON.stringify(frame.mfcc_features),audio_file_url:null,local_audio_uri,acoustic_classification:classification.classification,confidence_score:classification.confidence,source,classifier_version:classification.version});
    if(!hive.last_audio_check_at || hive.last_audio_check_at<frame.recorded_at) await this.local.save('hives',{...hive,last_audio_check_at:frame.recorded_at});
    if(!mic.last_seen_at || mic.last_seen_at<=frame.recorded_at) await this.local.save('iot_microphones',{...mic,battery_level:frame.battery_level,sampling_rate_hz:frame.sampling_rate_hz,is_online:1,last_seen_at:frame.recorded_at});
    return sample;
  }
}
