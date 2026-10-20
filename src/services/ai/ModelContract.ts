import type { AcousticClass } from '../../db/types';
import type { Classification } from '../iot/AudioIngestionService';
export const modelClasses:AcousticClass[]=['healthy','swarming','queenless','pest_disturbance','unknown'];
export interface ModelManifest { version:string; inputName:string; outputName:string; mean:number[]; std:number[]; minimumScore:number; sha256:string }
export function normalizeMfcc(mfcc:number[],manifest:ModelManifest):Float32Array {
  if(mfcc.length!==13||manifest.mean.length!==13||manifest.std.length!==13||!mfcc.every(Number.isFinite)||!manifest.mean.every(Number.isFinite)||!manifest.std.every(v=>Number.isFinite(v)&&v>0)||!Number.isFinite(manifest.minimumScore)||manifest.minimumScore<0||manifest.minimumScore>1||!manifest.version)throw new Error('Manifiesto o MFCC incompatible');
  return Float32Array.from(mfcc,(v,i)=>(v-(manifest.mean[i]??0))/(manifest.std[i]??1));
}
export function modelResult(output:ArrayLike<number>,manifest:ModelManifest):Classification {
  const values=Array.from(output);const total=values.reduce((a,b)=>a+b,0);
  if(values.length!==5||!values.every(v=>Number.isFinite(v)&&v>=0&&v<=1)||Math.abs(total-1)>.01)throw new Error('El modelo debe emitir cinco probabilidades normalizadas');
  const index=values.indexOf(Math.max(...values)),confidence=values[index]??0;
  return {classification:confidence>=manifest.minimumScore?modelClasses[index]??'unknown':'unknown',confidence,version:`onnx:${manifest.version}`};
}
