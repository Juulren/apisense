import { connect, type MqttClient } from "mqtt";
import { mqttEndpoint } from "./configuration";
export class MqttTransport {
  private client?: MqttClient;
  start(
    options: {
      url: string;
      userId: string;
      username?: string;
      password?: string;
    },
    onFrame: (frame: unknown) => Promise<unknown>,
    onError: (error: Error) => void,
  ) {
    if (!/^[a-zA-Z0-9-]+$/.test(options.userId))
      throw new Error("MQTT requiere WSS y una identidad válida");
    const url = mqttEndpoint(options.url);
    this.stop();
    const topic = `apisense/${options.userId}/hives/+/telemetry`;
    const client = connect(url, {
      username: options.username,
      password: options.password,
      clean: true,
      reconnectPeriod: 3000,
      connectTimeout: 10_000,
      protocolVersion: 4,
    });
    this.client = client;
    client.on("connect", () => {
      if (this.client !== client) return;
      client.subscribe(topic, { qos: 1 }, (error) => {
        if (error && this.client === client) onError(error);
      });
    });
    client.on("error", (error) => {
      if (this.client === client) onError(error);
    });
    client.on("message", (received, payload) => {
      if (this.client !== client) return;
      try {
        if (payload.length > 1_500_000)
          throw new Error("Paquete MQTT demasiado grande");
        const parts = received.split("/");
        if (
          parts.length !== 5 ||
          parts[0] !== "apisense" ||
          parts[1] !== options.userId ||
          parts[2] !== "hives" ||
          parts[4] !== "telemetry"
        )
          throw new Error("Topic no autorizado");
        const frame = JSON.parse(payload.toString()) as { hive_id?: string };
        if (frame.hive_id !== parts[3])
          throw new Error("Colmena no coincide con el topic");
        void onFrame(frame).catch((error) =>
          onError(error instanceof Error ? error : new Error(String(error))),
        );
      } catch (error) {
        onError(error instanceof Error ? error : new Error(String(error)));
      }
    });
  }
  stop() {
    this.client?.removeAllListeners();
    this.client?.end(true);
    this.client = undefined;
  }
}
