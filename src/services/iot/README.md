# Contrato IoT v1

BLE nativo usa UUIDs configurados por entorno y notificaciones con JSON ASCII terminado en LF, fragmentado libremente por MTU. JsonLineFramer limita memoria y descarta tramas incompletas tras 10s. Se requieren builds de desarrollo: react-native-ble-plx no funciona en Expo Go ni en web. Android solicita permisos de scan/connect; iOS utiliza la descripción de permisos del plugin. La app nunca asume un UUID o MAC de firmware real.

MQTT usa MQTT.js sobre WSS, QoS 1 y reconexión de 3s. Topic `apisense/{userId}/hives/{hiveId}/telemetry`; validar que el broker impone ACL por usuario (el filtro cliente no es un control de acceso del broker). Credenciales de sesión se suministran en memoria, nunca en variables EXPO_PUBLIC. Configurar TLS y autenticación en el broker antes de usar datos reales.

TelemetryFrame en protocol.ts es la fuente del contrato: UUIDs de muestra/dispositivo/colmena, fecha ISO, Hz, dBFS, batería, duración, tasa de muestreo y 13 MFCC. WAV opcional PCM16 mono, máximo 1MiB. En BLE el audio completo exige firmware con fragmentación NDJSON compatible; se admiten paquetes de características sin clip. El offset de calibración es relativo, no un SPL certificado.

Simulator produce WAVs reproducibles y cuatro patrones solicitados. Las familias de frecuencias se solapan: no son diagnóstico biológico. MFCC iniciales del simulador son sintéticos; el motor de IA puede recalcularlos desde el PCM. Toda muestra conserva source=simulator/ble/mqtt y classifier_version para no mezclar evidencias. `InlineClipStore`, utilizado por Android e iOS, conserva clips base64 dentro de la base SQLCipher; no escribe WAV permanentes sin cifrar en documentos de la app. Las muestras repetidas por UUID se deduplican.

Pendiente #8: protocolo real del ESP32/micrófono, permisos y desconexiones en dispositivos físicos, ACL de broker y validación de calibre. No se afirma integración probada en hardware.
