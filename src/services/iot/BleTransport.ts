export interface DiscoveredMic { id:string; name:string }
export class BleTransport {
  async scan(_found:(device:DiscoveredMic)=>void):Promise<void> { throw new Error('BLE requiere una compilación nativa de desarrollo para iOS o Android'); }
  stopScan() {}
  async connect(_id:string,_onFrame:(frame:unknown)=>Promise<unknown>,_onError:(error:Error)=>void):Promise<void> { throw new Error('BLE no está disponible en esta plataforma'); }
  async stop() {}
}
