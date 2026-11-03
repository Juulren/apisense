import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { EventEmitter } from "node:events";
import { mqttEndpoint, requireBleProfile } from "./configuration";
import { MqttTransport } from "./MqttTransport";
import { BleTransport } from "./BleTransport";

const mocks = vi.hoisted(() => ({
  connect: vi.fn(),
  manager: vi.fn(),
  request: vi.fn(),
  platform: { OS: "android", Version: 35 },
}));
vi.mock("mqtt", () => ({ connect: mocks.connect }));
vi.mock("react-native-ble-plx", () => ({
  BleManager: class {
    constructor() {
      return mocks.manager();
    }
  },
}));
vi.mock("react-native", () => ({
  Platform: mocks.platform,
  PermissionsAndroid: {
    requestMultiple: mocks.request,
    RESULTS: { GRANTED: "granted" },
    PERMISSIONS: {
      BLUETOOTH_SCAN: "scan",
      BLUETOOTH_CONNECT: "connect",
      ACCESS_FINE_LOCATION: "location",
    },
  },
}));

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
});
beforeEach(() => {
  vi.clearAllMocks();
});

describe("Transport configuration", () => {
  it.each([
    "wss://user:pass@broker.test/mqtt",
    "ws://broker.test",
    "mqtt://broker.test",
    "wss://broker.test/#secret",
    "invalid",
  ])("rejects unsafe/malformed MQTT endpoint %s", (url) => {
    expect(() => mqttEndpoint(url)).toThrow();
  });
  it("keeps WSS path and query and accepts standard/128-bit GATT UUIDs", () => {
    expect(mqttEndpoint("WSS://broker.test:443/mqtt?client=apisense")).toBe(
      "wss://broker.test/mqtt?client=apisense",
    );
    expect(() => requireBleProfile("180D", "2A37")).not.toThrow();
    expect(() =>
      requireBleProfile("0000180d-0000-1000-8000-00805f9b34fb", "00002a37"),
    ).not.toThrow();
    expect(() => requireBleProfile("typo", "2A37")).toThrow("formato");
    expect(() => requireBleProfile(undefined, undefined)).toThrow("Configura");
  });
});

describe("MQTT lifecycle and topic ownership", () => {
  function client() {
    return Object.assign(new EventEmitter(), {
      subscribe: vi.fn(),
      end: vi.fn(),
    });
  }
  it("subscribes with QoS1, rejects foreign/mismatched topics and drops stale callbacks", async () => {
    const a = client(),
      b = client();
    mocks.connect.mockReturnValueOnce(a).mockReturnValueOnce(b);
    const transport = new MqttTransport(),
      frame = vi.fn().mockResolvedValue(undefined),
      error = vi.fn();
    transport.start(
      {
        url: "wss://broker.test/mqtt",
        userId: "owner-a",
        username: "test",
        password: "synthetic",
      },
      frame,
      error,
    );
    a.emit("connect");
    expect(a.subscribe).toHaveBeenCalledWith(
      "apisense/owner-a/hives/+/telemetry",
      { qos: 1 },
      expect.any(Function),
    );
    const send = (topic: string, hive_id = "hive-a") =>
      a.emit("message", topic, Buffer.from(JSON.stringify({ hive_id })));
    send("apisense/owner-b/hives/hive-a/telemetry");
    send("apisense/owner-a/hives/hive-a/telemetry", "hive-b");
    expect(error).toHaveBeenCalledTimes(2);
    expect(frame).not.toHaveBeenCalled();
    send("apisense/owner-a/hives/hive-a/telemetry");
    expect(frame).toHaveBeenCalledWith({ hive_id: "hive-a" });
    const staleConnect = a.listeners("connect")[0]!,
      staleMessage = a.listeners("message")[0]!;
    transport.start(
      { url: "wss://broker.test/mqtt", userId: "owner-b" },
      frame,
      error,
    );
    staleConnect();
    staleMessage(
      "apisense/owner-a/hives/hive-a/telemetry",
      Buffer.from('{"hive_id":"hive-a"}'),
    );
    expect(b.subscribe).not.toHaveBeenCalled();
    expect(frame).toHaveBeenCalledTimes(1);
    expect(a.end).toHaveBeenCalledWith(true);
    transport.stop();
    expect(b.end).toHaveBeenCalledWith(true);
  });
});

describe("BLE permissions, cancellation and discovery failures", () => {
  const service = "0000180d-0000-1000-8000-00805f9b34fb";
  let manager: {
    state: ReturnType<typeof vi.fn>;
    startDeviceScan: ReturnType<typeof vi.fn>;
    stopDeviceScan: ReturnType<typeof vi.fn>;
    cancelDeviceConnection: ReturnType<typeof vi.fn>;
    connectToDevice: ReturnType<typeof vi.fn>;
    destroy: ReturnType<typeof vi.fn>;
  };
  beforeEach(() => {
    vi.useFakeTimers();
    vi.stubEnv("EXPO_PUBLIC_BLE_SERVICE_UUID", service);
    vi.stubEnv("EXPO_PUBLIC_BLE_CHARACTERISTIC_UUID", "2A37");
    mocks.platform.Version = 35;
    mocks.request.mockResolvedValue({
      scan: "granted",
      connect: "granted",
      location: "granted",
    });
    manager = {
      state: vi.fn().mockResolvedValue("PoweredOn"),
      startDeviceScan: vi.fn(),
      stopDeviceScan: vi.fn(),
      cancelDeviceConnection: vi.fn().mockResolvedValue(undefined),
      connectToDevice: vi.fn(),
      destroy: vi.fn(),
    };
    mocks.manager.mockReturnValue(manager);
  });
  it("rejects denied Android permissions before creating a BLE manager", async () => {
    mocks.request.mockResolvedValue({ scan: "denied", connect: "granted" });
    await expect(new BleTransport().scan(vi.fn())).rejects.toThrow("denegado");
    expect(mocks.manager).not.toHaveBeenCalled();
  });
  it("cancels active scanning without leaving its promise pending", async () => {
    const ble = new BleTransport(),
      found = vi.fn();
    const scanning = ble.scan(found);
    await vi.advanceTimersByTimeAsync(0);
    const callback = manager.startDeviceScan.mock.calls[0]![2];
    callback(null, { id: "physical-id", localName: "Mic" });
    expect(found).toHaveBeenCalledWith({ id: "physical-id", name: "Mic" });
    ble.stopScan();
    await expect(scanning).resolves.toBeUndefined();
    callback(null, { id: "late" });
    expect(found).toHaveBeenCalledTimes(1);
    expect(vi.getTimerCount()).toBe(0);
  });
  it("does not create a manager after a pending permission request is cancelled", async () => {
    let resolve!: (value: unknown) => void;
    mocks.request.mockReturnValue(
      new Promise((r) => {
        resolve = r;
      }),
    );
    const ble = new BleTransport(),
      scanning = ble.scan(vi.fn());
    await ble.stop();
    resolve({ scan: "granted", connect: "granted" });
    await scanning;
    expect(mocks.manager).not.toHaveBeenCalled();
  });
  it("propagates synchronous native scan errors and clears its timer", async () => {
    manager.startDeviceScan.mockImplementation((_s, _o, callback) =>
      callback(new Error("native scan failure")),
    );
    await expect(new BleTransport().scan(vi.fn())).rejects.toThrow(
      "native scan failure",
    );
    expect(vi.getTimerCount()).toBe(0);
  });
  it("uses location on Android 11 and completes the bounded scan", async () => {
    mocks.platform.Version = 30;
    const scanning = new BleTransport().scan(vi.fn());
    await vi.advanceTimersByTimeAsync(10000);
    await scanning;
    expect(mocks.request).toHaveBeenCalledWith(["location"]);
  });
  it("disconnects when service discovery fails", async () => {
    manager.connectToDevice.mockResolvedValue({
      discoverAllServicesAndCharacteristics: vi
        .fn()
        .mockRejectedValue(new Error("discovery failed")),
    });
    await expect(
      new BleTransport().connect("physical-id", vi.fn(), vi.fn()),
    ).rejects.toThrow("discovery failed");
    expect(manager.cancelDeviceConnection).toHaveBeenCalledWith("physical-id");
  });
});
