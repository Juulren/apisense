import { digestStringAsync,CryptoDigestAlgorithm } from 'expo-crypto';
import type { Repository } from '../../db/Repository';
import { summarize,summaryWindow,summaryIdentity,uuidFromDigest } from '../../../supabase/functions/_shared/summary';
export class HiveSummaryEngine {
  private tail:Promise<unknown>=Promise.resolve();
  constructor(private local:Repository,private demo=false,private now=()=>new Date()) {}
  generate(hiveId:string) { const result=this.tail.then(()=>this.create(hiveId));this.tail=result.catch(()=>{});return result; }
  private async create(hiveId:string) {
    const hive=await this.local.get('hives',hiveId);if(!hive||hive.deleted_at)throw new Error('Colmena no disponible');
    const apiary=await this.local.get('apiaries',hive.apiary_id);if(!apiary||apiary.deleted_at)throw new Error('Apiario no disponible');
    const start=this.now().getTime()-apiary.check_interval_minutes*60000;
    const samples=(await this.local.list('audio_samples')).filter(s=>s.hive_id===hiveId&&Date.parse(s.recorded_at)>=start&&Date.parse(s.recorded_at)<=this.now().getTime()&&(this.demo||s.source!=='simulator'));
    const window=summaryWindow(samples,apiary.check_interval_minutes);
    const id=uuidFromDigest(await digestStringAsync(CryptoDigestAlgorithm.SHA256,summaryIdentity(hiveId,window.period_start,window.period_end)));
    const existing=await this.local.get('ai_summaries',id);if(existing)return existing;
    return this.local.save('ai_summaries',{id,hive_id:hiveId,...window,...summarize(samples),created_at:this.now().toISOString()});
  }
  async runDue() {
    const summaries=await this.local.list('ai_summaries'),apiaries=await this.local.list('apiaries');
    for(const hive of await this.local.list('hives')) {
      const apiary=apiaries.find(a=>a.id===hive.apiary_id);if(!apiary)continue;
      const latest=summaries.filter(s=>s.hive_id===hive.id).sort((a,b)=>b.created_at.localeCompare(a.created_at))[0];
      if(latest&&this.now().getTime()-Date.parse(latest.created_at)<apiary.check_interval_minutes*60000)continue;
      const samples=(await this.local.list('audio_samples')).some(s=>s.hive_id===hive.id&&Date.parse(s.recorded_at)>=this.now().getTime()-apiary.check_interval_minutes*60000&&(this.demo||s.source!=='simulator'));
      if(samples)await this.generate(hive.id);
    }
  }
}
