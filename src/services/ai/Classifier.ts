import { toByteArray } from 'base64-js';
import type { Classification } from '../iot/AudioIngestionService';
import type { TelemetryFrame } from '../iot/protocol';
import { decodeWav } from '../iot/wav';
import { preprocess } from './acoustics';
export interface InferenceModel { predict(mfcc:number[]):Promise<Classification> }
export class AcousticClassifier {
  constructor(private model?:InferenceModel) {}
  classify = async (frame:TelemetryFrame):Promise<Classification> => {
    let frequency=frame.dominant_freq_hz;let flatness:number|undefined;
    if(frame.wav_base64){const wav=decodeWav(toByteArray(frame.wav_base64));const features=preprocess(wav.pcm,wav.sampleRate);frame.mfcc_features=features.mfcc;frequency=features.dominantHz;flatness=features.flatness;}
    if(this.model) return this.model.predict(frame.mfcc_features);
    const version='experimental-rules-v1';
    if(flatness!==undefined && flatness>.15)return {classification:'pest_disturbance',confidence:.45,version};
    if(frequency>=200&&frequency<=300)return {classification:'healthy',confidence:.55,version};
    if(frequency>=350&&frequency<400)return {classification:'swarming',confidence:.4,version};
    if(frequency>550&&frequency<=600)return {classification:'queenless',confidence:.35,version};
    return {classification:'unknown',confidence:0,version};
  };
}
