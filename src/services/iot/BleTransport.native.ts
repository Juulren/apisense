import { BleManager, type Subscription } from 'react-native-ble-plx';
import { PermissionsAndroid, Platform } from 'react-native';
import { toByteArray } from 'base64-js';
import { JsonLineFramer } from './protocol';
export interface DiscoveredMic { id:string; name:string }
export class BleTransport {
  private manager=new BleManager(); private monitor?:Subscription; private disconnect?:Subscription; private deviceId?:string; private timer?:ReturnType<typeof setTimeout>;
  private service=process.env.EXPO_PUBLIC_BLE_SERVICE_UUID; private characteristic=process.env.EXPO_PUBLIC_BLE_CHARACTERISTIC_UUID;
  async scan(found:(device:DiscoveredMic)=>void) {
    if(!this.service || !this.characteristic) throw new Error('Configura los UUID BLE del firmware');
    if(Platform.OS==='android') {
      const permissions=Number(Platform.Version)>=31?[PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT]:[PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION];
      const result=await PermissionsAndroid.requestMultiple(permissions); if(permissions.some(p=>result[p]!==PermissionsAndroid.RESULTS.GRANTED)) throw new Error('Permiso Bluetooth denegado');
    }
    if(await this.manager.state()!=='PoweredOn') throw new Error('Activa Bluetooth para buscar micrófonos');
    await new Promise<void>((resolve,reject)=>{this.manager.startDeviceScan([this.service!],null,(error,device)=>{if(error){this.stopScan();reject(error);return;} if(device) found({id:device.id,name:device.localName??device.name??'Micrófono BLE'});}); this.timer=setTimeout(()=>{this.stopScan();resolve();},10_000);});
  }
  stopScan() { this.manager.stopDeviceScan(); clearTimeout(this.timer); }
  async connect(id:string,onFrame:(frame:unknown)=>Promise<unknown>,onError:(error:Error)=>void) {
    if(!this.service || !this.characteristic) throw new Error('Configura los UUID BLE del firmware');
    this.stopScan(); this.monitor?.remove(); this.disconnect?.remove(); if(this.deviceId && this.deviceId!==id) await this.manager.cancelDeviceConnection(this.deviceId).catch(()=>{});
    const device=await this.manager.connectToDevice(id,{timeout:10_000}); await device.discoverAllServicesAndCharacteristics(); this.deviceId=id; const framer=new JsonLineFramer();
    this.disconnect=this.manager.onDeviceDisconnected(id,error=>onError(new Error(error?.message??'Micrófono desconectado')));
    this.monitor=device.monitorCharacteristicForService(this.service,this.characteristic,(error,characteristic)=>{if(error){onError(error);return;} try { if(!characteristic?.value)return; const chunk=Array.from(toByteArray(characteristic.value),byte=>String.fromCharCode(byte)).join(''); for(const frame of framer.push(chunk)) void onFrame(frame).catch(e=>onError(e instanceof Error?e:new Error(String(e)))); } catch(e){onError(e instanceof Error?e:new Error(String(e)));} });
  }
  async stop() { this.stopScan();this.monitor?.remove();this.disconnect?.remove(); if(this.deviceId) await this.manager.cancelDeviceConnection(this.deviceId).catch(()=>{});await this.manager.destroy(); }
}
