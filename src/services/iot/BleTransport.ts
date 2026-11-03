import { BleManager, type Subscription } from "react-native-ble-plx";
import { PermissionsAndroid, Platform } from "react-native";
import { toByteArray } from "base64-js";
import { JsonLineFramer } from "./protocol";
import { requireBleProfile } from "./configuration";
export interface DiscoveredMic {
  id: string;
  name: string;
}
export class BleTransport {
  private instance?: BleManager;
  private get manager() {
    return this.instance ?? (this.instance = new BleManager());
  }
  private monitor?: Subscription;
  private disconnect?: Subscription;
  private deviceId?: string;
  private timer?: ReturnType<typeof setTimeout>;
  private finishScan?: (error?: Error) => void;
  private scanVersion = 0;
  private connectionVersion = 0;
  private service = process.env.EXPO_PUBLIC_BLE_SERVICE_UUID;
  private characteristic = process.env.EXPO_PUBLIC_BLE_CHARACTERISTIC_UUID;
  async scan(found: (device: DiscoveredMic) => void) {
    requireBleProfile(this.service, this.characteristic);
    this.stopScan();
    const scanVersion = this.scanVersion;
    if (Platform.OS === "android") {
      const permissions =
        Number(Platform.Version) >= 31
          ? [
              PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
              PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
            ]
          : [PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION];
      const result = await PermissionsAndroid.requestMultiple(permissions);
      if (scanVersion !== this.scanVersion) return;
      if (
        permissions.some(
          (p) => result[p] !== PermissionsAndroid.RESULTS.GRANTED,
        )
      )
        throw new Error("Permiso Bluetooth denegado");
    }
    const state = await this.manager.state();
    if (scanVersion !== this.scanVersion) return;
    if (state !== "PoweredOn")
      throw new Error("Activa Bluetooth para buscar micrófonos");
    await new Promise<void>((resolve, reject) => {
      const finish = (error?: Error) => {
        if (this.finishScan !== finish) return;
        this.finishScan = undefined;
        clearTimeout(this.timer);
        this.manager.stopDeviceScan();
        if (error) reject(error);
        else resolve();
      };
      this.finishScan = finish;
      this.timer = setTimeout(() => finish(), 10_000);
      try {
        this.manager.startDeviceScan([this.service!], null, (error, device) => {
          if (this.finishScan !== finish) return;
          if (error) return finish(error);
          if (device)
            found({
              id: device.id,
              name: device.localName ?? device.name ?? "Micrófono BLE",
            });
        });
      } catch (error) {
        finish(
          error instanceof Error
            ? error
            : new Error("No se pudo iniciar Bluetooth"),
        );
      }
    });
  }
  stopScan() {
    this.scanVersion++;
    if (this.finishScan) return this.finishScan();
    this.instance?.stopDeviceScan();
    clearTimeout(this.timer);
  }
  async connect(
    id: string,
    onFrame: (frame: unknown) => Promise<unknown>,
    onError: (error: Error) => void,
  ) {
    requireBleProfile(this.service, this.characteristic);
    this.stopScan();
    const connectionVersion = ++this.connectionVersion;
    const manager = this.manager;
    this.monitor?.remove();
    this.disconnect?.remove();
    if (this.deviceId && this.deviceId !== id)
      await manager.cancelDeviceConnection(this.deviceId).catch(() => {});
    const device = await manager.connectToDevice(id, { timeout: 10_000 });
    try {
      if (connectionVersion !== this.connectionVersion)
        throw new Error("Conexión Bluetooth cancelada");
      await device.discoverAllServicesAndCharacteristics();
      if (connectionVersion !== this.connectionVersion)
        throw new Error("Conexión Bluetooth cancelada");
    } catch (error) {
      await manager.cancelDeviceConnection(id).catch(() => {});
      throw error;
    }
    this.deviceId = id;
    const framer = new JsonLineFramer();
    this.disconnect = this.manager.onDeviceDisconnected(id, (error) =>
      onError(new Error(error?.message ?? "Micrófono desconectado")),
    );
    this.monitor = device.monitorCharacteristicForService(
      this.service!,
      this.characteristic!,
      (error, characteristic) => {
        if (error) {
          onError(error);
          return;
        }
        try {
          if (!characteristic?.value) return;
          const chunk = Array.from(toByteArray(characteristic.value), (byte) =>
            String.fromCharCode(byte),
          ).join("");
          for (const frame of framer.push(chunk))
            void onFrame(frame).catch((e) =>
              onError(e instanceof Error ? e : new Error(String(e))),
            );
        } catch (e) {
          onError(e instanceof Error ? e : new Error(String(e)));
        }
      },
    );
  }
  async stop() {
    this.connectionVersion++;
    this.stopScan();
    this.monitor?.remove();
    this.disconnect?.remove();
    if (this.deviceId)
      await this.manager.cancelDeviceConnection(this.deviceId).catch(() => {});
    await this.instance?.destroy();
    this.instance = undefined;
    this.deviceId = undefined;
    this.monitor = undefined;
    this.disconnect = undefined;
  }
}
