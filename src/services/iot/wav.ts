export function encodeWav(pcm: Float32Array, sampleRate: number): Uint8Array {
  const bytes=new Uint8Array(44+pcm.length*2); const view=new DataView(bytes.buffer);
  const text=(offset:number,value:string)=>{for(let i=0;i<value.length;i++) view.setUint8(offset+i,value.charCodeAt(i));};
  text(0,'RIFF');view.setUint32(4,36+pcm.length*2,true);text(8,'WAVE');text(12,'fmt ');view.setUint32(16,16,true);view.setUint16(20,1,true);view.setUint16(22,1,true);view.setUint32(24,sampleRate,true);view.setUint32(28,sampleRate*2,true);view.setUint16(32,2,true);view.setUint16(34,16,true);text(36,'data');view.setUint32(40,pcm.length*2,true);
  pcm.forEach((value,index)=>view.setInt16(44+index*2,Math.round(Math.max(-1,Math.min(1,value))*32767),true)); return bytes;
}
export function decodeWav(bytes: Uint8Array): { pcm: Float32Array; sampleRate: number } {
  if (bytes.length < 44 || bytes.length > 1_048_576) throw new Error('WAV vacío o demasiado grande');
  const view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);
  const text=(offset:number,length:number)=>String.fromCharCode(...bytes.subarray(offset,offset+length));
  if(text(0,4)!=='RIFF'||text(8,4)!=='WAVE'||view.getUint32(4,true)+8>bytes.length) throw new Error('Se requiere RIFF/WAVE');
  let rate=0, data:Uint8Array|undefined;
  for(let offset=12;offset+8<=bytes.length;) {
    const tag=text(offset,4), length=view.getUint32(offset+4,true); if(offset+8+length>bytes.length) throw new Error('WAV truncado');
    if(tag==='fmt ') { if(length<16 || view.getUint16(offset+8,true)!==1 || view.getUint16(offset+10,true)!==1 || view.getUint16(offset+22,true)!==16) throw new Error('Se requiere PCM16 mono'); rate=view.getUint32(offset+12,true); }
    if(tag==='data') data=bytes.subarray(offset+8,offset+8+length);
    offset+=8+length+(length%2);
  }
  if(!data || !data.length || data.length%2 || rate<1000 || rate>96000) throw new Error('Formato PCM inválido');
  const pcm=new Float32Array(data.length/2); const pcmView=new DataView(data.buffer,data.byteOffset,data.byteLength);
  for(let i=0;i<pcm.length;i++) pcm[i]=pcmView.getInt16(i*2,true)/32768;
  return {pcm,sampleRate:rate};
}
