const gattUuid =
  /^(?:[0-9a-f]{4}|[0-9a-f]{8}|[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/i;

export function requireBleProfile(service?: string, characteristic?: string) {
  if (!service || !characteristic)
    throw new Error("Configura los UUID BLE del firmware");
  if (!gattUuid.test(service) || !gattUuid.test(characteristic))
    throw new Error("Los UUID BLE del firmware no tienen un formato válido");
}

export function mqttEndpoint(input: string): string {
  let url: URL;
  try {
    url = new URL(input);
  } catch {
    throw new Error("Configura una URL MQTT válida con WSS");
  }
  if (
    url.protocol !== "wss:" ||
    !url.hostname ||
    url.username ||
    url.password ||
    url.hash
  )
    throw new Error(
      "MQTT requiere WSS, sin credenciales ni fragmentos en la URL",
    );
  return url.toString();
}
