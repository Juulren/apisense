import { Directory, File, Paths } from 'expo-file-system';
export interface ClipStore { write(id:string,bytes:Uint8Array):Promise<string>; read(uri:string):Promise<ArrayBuffer> }
export const clips: ClipStore = {
  async write(id,bytes) { if(!/^[a-zA-Z0-9-]+$/.test(id)) throw new Error('ID de audio inválido'); const directory=new Directory(Paths.document,'audio'); directory.create({idempotent:true,intermediates:true}); const file=new File(directory,`${id}.wav`); file.write(bytes); return file.uri; },
  async read(uri) { const file=new File(uri); if(!file.exists) throw new Error('El clip no se encuentra en este dispositivo'); return file.arrayBuffer(); },
};
