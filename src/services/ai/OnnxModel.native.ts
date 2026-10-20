import * as ort from 'onnxruntime-react-native';
import { CryptoDigestAlgorithm,digest } from 'expo-crypto';
import { modelResult,normalizeMfcc,type ModelManifest } from './ModelContract';
import type { InferenceModel } from './Classifier';
export async function loadOnnxModel(bytes:Uint8Array,manifest:ModelManifest,_wasmBaseUrl=''):Promise<InferenceModel> {
  const checksum=Array.from(new Uint8Array(await digest(CryptoDigestAlgorithm.SHA256,Uint8Array.from(bytes))),v=>v.toString(16).padStart(2,'0')).join('');
  if(checksum!==manifest.sha256.toLowerCase())throw new Error('SHA-256 del modelo no coincide');
  normalizeMfcc(new Array(13).fill(0),manifest);
  const session=await ort.InferenceSession.create(bytes);
  return {async predict(mfcc){const results=await session.run({[manifest.inputName]:new ort.Tensor('float32',normalizeMfcc(mfcc,manifest),[1,13])});const output=results[manifest.outputName];if(!output||output.type!=='float32')throw new Error('Tensor de salida incompatible');return modelResult(output.data as Float32Array,manifest);}};
}
