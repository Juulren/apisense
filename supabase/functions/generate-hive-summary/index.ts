import { createClient } from 'npm:@supabase/supabase-js@2';
import { summarize,summaryWindow,summaryIdentity,uuidFromDigest } from '../_shared/summary.ts';
const cors={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'authorization, apikey, content-type, x-cron-secret','Access-Control-Allow-Methods':'POST, OPTIONS'};
const json=(data:unknown,status=200)=>new Response(JSON.stringify(data),{status,headers:{...cors,'Content-Type':'application/json'}});
const env=(key:string)=>{const value=Deno.env.get(key);if(!value)throw new Error(`Missing ${key}`);return value;};
async function equalSecret(left:string,right:string) {const hash=async(v:string)=>new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(v)));const [a,b]=await Promise.all([hash(left),hash(right)]);let diff=0;for(let i=0;i<a.length;i++)diff|=a[i]^b[i];return diff===0;}
Deno.serve(async request=>{
  if(request.method==='OPTIONS')return new Response(null,{headers:cors});
  if(request.method!=='POST')return json({error:'Method not allowed'},405);
  try {
    if(Number(request.headers.get('content-length')??0)>4096)return json({error:'Request too large'},413);
    const raw=await request.text();if(raw.length>4096)return json({error:'Request too large'},413);
    const body=raw?JSON.parse(raw):{};const hiveId=body.hive_id;
    if(hiveId!==undefined&&(typeof hiveId!=='string'||!/^[0-9a-f-]{36}$/i.test(hiveId)))return json({error:'Invalid hive_id'},400);
    const configuredSecret=Deno.env.get('CRON_SECRET'),suppliedSecret=request.headers.get('x-cron-secret');
    const cron=!!configuredSecret&&!!suppliedSecret&&await equalSecret(suppliedSecret,configuredSecret);
    let client;
    if(cron)client=createClient(env('SUPABASE_URL'),env('SUPABASE_SERVICE_ROLE_KEY'),{auth:{persistSession:false}});
    else {
      const authorization=request.headers.get('authorization');if(!authorization?.startsWith('Bearer '))return json({error:'Unauthorized'},401);
      client=createClient(env('SUPABASE_URL'),env('SUPABASE_ANON_KEY'),{global:{headers:{Authorization:authorization}},auth:{persistSession:false}});
      const {data,error}=await client.auth.getUser(authorization.slice(7));if(error||!data.user)return json({error:'Unauthorized'},401);
    }
    let query=client.from('hives').select('id,apiary_id,apiaries!inner(check_interval_minutes)').is('deleted_at',null).order('id');
    if(hiveId)query=query.eq('id',hiveId);
    const {data:hives,error}=await query.limit(500);if(error)throw error;
    const now=new Date(),results:unknown[]=[];
    for(const hive of hives??[]) {
      const relation=hive.apiaries as unknown as {check_interval_minutes:number};const interval=relation.check_interval_minutes;
      if(!hiveId){const {data:last,error:lastError}=await client.from('ai_summaries').select('created_at').eq('hive_id',hive.id).is('deleted_at',null).order('created_at',{ascending:false}).limit(1);if(lastError)throw lastError;if(last?.[0]&&now.getTime()-Date.parse(last[0].created_at)<interval*60000)continue;}
      const {data:samples,error:sampleError}=await client.from('audio_samples').select('recorded_at,acoustic_classification,confidence_score,classifier_version,source,dominant_freq_hz').eq('hive_id',hive.id).neq('source','simulator').is('deleted_at',null).gte('recorded_at',new Date(now.getTime()-interval*60000).toISOString()).lte('recorded_at',now.toISOString()).order('recorded_at',{ascending:false}).limit(1000);
      if(sampleError)throw sampleError;if(!samples?.length)continue;
      const window=summaryWindow(samples,interval);const hash=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(summaryIdentity(hive.id,window.period_start,window.period_end)));const id=uuidFromDigest(Array.from(new Uint8Array(hash),v=>v.toString(16).padStart(2,'0')).join(''));
      const summary={id,hive_id:hive.id,...window,...summarize(samples),created_at:now.toISOString()};
      const {error:writeError}=await client.from('ai_summaries').upsert(summary,{onConflict:'id',ignoreDuplicates:true});if(writeError)throw writeError;results.push({id,hive_id:hive.id,status:summary.overall_status});
    }
    return json({summaries:results,hives_considered:hives?.length??0,limit:500});
  } catch(error) { console.error('generate-hive-summary failed',error instanceof Error?error.name:'unknown');return json({error:'Summary generation failed'},500); }
});
