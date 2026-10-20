# Validación del bloque de pantallas

Fecha: 20 de octubre de 2026. Los datos de las pruebas de UI pertenecen exclusivamente a la demo.

| Comprobación | Resultado |
|---|---|
| TypeScript estricto (`npx tsc --noEmit`) | Correcto |
| 9 tests con SQLite real | Correctos: transacciones, offline, recovery, orden de audio/dependencias, backoff, ACK concurrente, checkpoint, paginación e identidad |
| 7 tests de protocolo IoT | Correctos: fragmentación/expiración, rangos y cuatro clips WAV reproducibles |
| 7 tests de IA | Correctos: FFT/MFCC, silencio, abstención, contrato ONNX y resúmenes |
| 2 tests de cifrado | Correctos: AES-GCM, IV, identidad, alteración y clave errónea |
| Exportación web | Correcta, con worker SQLite/WASM y shell offline generado |
| Exportación de bundles JS/Hermes iOS y Android | Correcta; no equivale a APK/IPA ejecutados |
| `deno check` de generate-hive-summary | Correcto |
| Prueba de cifrado con SQLite web en navegador | Correcta: escritura, cierre, reapertura y clave errónea; ampliada con bloqueo de sesiones |
| Login/registro Supabase y sincronización real | Pendiente: proyecto sin configurar |
| SQL/RLS/Storage y cron desplegados | Pendiente: daemon Docker inactivo y sin destino cloud |
| BLE/MQTT y modelo entrenado | Pendiente: hardware, broker, protocolo y modelo sin definir |

Recorrido manual en navegador: onboarding → demo → dashboard → detalle → inspección con nota/etiquetas/reina → reapertura y persistencia; monitor con reproducción y simulación de perturbación; historial con filtro y estado vacío; calibración relativa persistida; lista filtrada y mapa OpenStreetMap; cambio de intervalo a 30 minutos, tema y modo sin conexión. ARIA comprobado en los radios y pestañas, incluyendo selección única en `/hives`.

El mapa inicialmente falló bajo aislamiento COEP. Se corrigió con iframe sin credenciales y se verificaron mapa, marcador y atribución. La ruta `/hives` inicialmente coincidía también con el prefijo `/hive`; se corrigió el límite de segmento y se volvió a comprobar la navegación.

Capturas locales detalladas: `.artifacts/qa/` (ignoradas por Git). Una selección de evidencias visuales está en `docs/qa/`. La revisión de fidelidad completa no se declara aprobada: faltan exports originales y una comparación homogénea de las diez pantallas, como registra `design-qa.md` y #7.
