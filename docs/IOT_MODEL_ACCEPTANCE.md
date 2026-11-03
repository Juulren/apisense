# Integración IoT y modelo — #8

Actualizado: 2 de noviembre de 2026. La app Android y sus adaptadores son código de desarrollo. **No se ha suministrado hardware, UUIDs de firmware, broker ni un modelo entrenado**. Este documento define cómo conectar y verificar esos recursos; las pruebas con dobles no acreditan una conexión física ni precisión científica.

## Contrato que implementa el cliente

BLE acepta UUID GATT de 16, 32 o 128 bits, configurados en `EXPO_PUBLIC_BLE_SERVICE_UUID` y `EXPO_PUBLIC_BLE_CHARACTERISTIC_UUID`; no asigna valores de firmware. La característica debe notificar JSON ASCII terminado en LF. La fragmentación entre notificaciones puede cortar cualquier posición de una línea. El cliente limita la trama a 1,5 millones de caracteres y descarta fragmentos incompletos después de diez segundos. [protocol.ts](../src/services/iot/protocol.ts) es el contrato ejecutable.

Cada trama declara versión 1, UUIDs lógicos de muestra/colmena/micrófono, fecha ISO 8601 con zona, duración (0,01–30 s), tasa entera (1000–96000 Hz), frecuencia hasta Nyquist, nivel **dBFS** (-160–0), batería (0–100) y trece MFCC finitos. Un WAV opcional debe ser PCM16 mono, máximo 1 MiB, con duración y tasa coherentes. `mfcc_version` es opcional para conservar compatibilidad con telemetría anterior; un modelo solo acepta características sin WAV cuando declara `apisense-mfcc-v1` y la tasa de su manifiesto coincide.

Vincula el UUID lógico anunciado por el firmware al dispositivo seleccionado y a la colmena. La recepción BLE rechaza tramas que declaren otra identidad, aunque exista en la misma cuenta, antes de escribir clips o muestras. Esto no autentica criptográficamente un emisor: hay que comprobar emparejamiento, cifrado y protección GATT en el firmware real. La búsqueda requiere permisos scan/connect en Android 12+ o ubicación en versiones anteriores; cancelarla resuelve la operación pendiente y descarta eventos tardíos.

MQTT usa WSS, QoS 1 y el topic `apisense/{userId}/hives/{hiveId}/telemetry`. La URL no admite credenciales embebidas ni fragmentos; usuario/contraseña temporales se pasan en memoria desde la pantalla de vinculación. No uses credenciales ni URLs con tokens privados en `EXPO_PUBLIC_*`. La validación cliente de usuario/topic/colmena no reemplaza las ACL del broker. Las sesiones sustituidas no pueden entregar mensajes ni activar suscripciones de la sesión nueva.

Para comprobar un archivo de captura, sin red ni escrituras en SQLite:

```powershell
npm run iot:validate -- C:\ruta\captura.ndjson
```

La herramienta reutiliza el parser y los validadores de la app; revisa JSON, límites, IDs, fechas y coherencia WAV. Aceptar un archivo no prueba que proceda de un micrófono ni que sus MFCC sean correctos.

## Matriz de aceptación física y broker

| Prueba | Resultado que debe conservarse |
| --- | --- |
| Firmware y UUIDs reales | Modelo de placa/micrófono, versión/hash de firmware, servicio, característica, permisos GATT y UUID lógico. |
| Radio y permisos Android | Denegado/concedido, Bluetooth apagado, reconexión y desconexión durante escaneo/recepción; sin operación bloqueada ni duplicación. |
| Fragmentación y pérdida | Captura real en el MTU negociado, corte a mitad de JSON, reanudación y nueva trama después de timeout. |
| Cifrado BLE | Evidencia de la configuración y negociación del firmware; no inferirlo de SQLCipher o HTTPS. |
| TLS del broker | WSS con certificado válido y rechazo de certificado inválido, conexión anónima y credencial caducada/revocada. |
| ACL por cuenta | A puede publicar/leer lo autorizado; A no puede publicar ni suscribirse a B ni usar comodines para acceder a B. Comprobar también desde un cliente independiente. |
| Entrega QoS 1 | Repetir el mismo UUID no duplica la muestra. Reconectar preserva la cola local y no mezcla sesiones. |
| Nivel acústico | dBFS separado de SPL; patrón de referencia, ganancia, distancia y error de calibración documentados. El offset actual es relativo. |

El broker, sus ACL y las claves de dispositivos deben administrarse fuera del cliente. No se desplegó un broker ni se enviaron credenciales a un tercero en este bloque.

## Contrato del modelo nativo

El cargador ONNX exige SHA-256 de los bytes, `contractVersion: 1`, `preprocessing: "apisense-mfcc-v1"`, tasa explícita, nombres de tensores, media/desviación de trece valores y umbral entre 0 y 1. El orden de clases debe ser exactamente `healthy`, `swarming`, `queenless`, `pest_disturbance`, `unknown`. Un orden diferente se rechaza para evitar cambiar el significado de las probabilidades. La normalización rechaza desbordamientos float32.

`apisense-mfcc-v1` corresponde a [acoustics.ts](../src/services/ai/acoustics.ts): FFT 2048/Hann simétrica, espectro de potencia dividido por N², 26 filtros Mel de 0 a Nyquist, log natural con piso 1e-12, DCT-II ortonormal y trece coeficientes (incluido c0). Se promedian como máximo 64 ventanas distribuidas uniformemente en el clip; la cantidad se calcula con salto nominal de 1024. No hay resampling, preénfasis ni normalización de amplitud implícitos. Un clip corto se completa con ceros. La media/desviación del manifiesto se aplica después a ese vector.

Si hay WAV, el cliente recalcula los MFCC. Sin WAV, necesita que el firmware declare el mismo contrato; una declaración no sustituye la comprobación numérica con clips de referencia. Si la tasa o el contrato no coinciden, el clasificador se abstiene (`unknown`, confianza 0) y conserva la muestra. Sin modelo se mantienen reglas experimentales identificadas; sus puntuaciones no son probabilidades calibradas ni diagnósticos.

Antes de añadir un modelo, entregar:

1. Archivo ONNX, manifiesto y hash; verificar inferencia con ONNX Runtime nativo en Android.
2. Procedencia/licencia del dataset, etiquetas verificadas, apiarios/dispositivos/fechas y separación de entrenamiento/validación/prueba sin fuga por colmena o grabación.
3. Exportación exacta del preprocesamiento, vectores de referencia y tolerancias que coincidan con la app.
4. Métricas por clase, matriz de confusión, abstención/calibración, rendimiento por dispositivo y limitaciones en condiciones de campo.
5. Latencia/memoria en Android y revisión de falsas alarmas con criterio apícola. No sustituir estos resultados por tonos sintéticos del simulador.

No se generó ni se declaró entrenado un modelo en este bloque. #8 sigue abierto por estas pruebas y recursos externos.
