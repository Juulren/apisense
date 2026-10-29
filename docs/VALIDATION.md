# Validación del bloque de pantallas

Alcance confirmado por el usuario el 26 de octubre de 2026: **Android nativo e iOS nativo**. Las comprobaciones de navegador y exportación web descritas aquí son históricas. No sustituyen compilaciones nativas ni recorridos en emulador, simulador o dispositivo, pendientes en #15/#8.

Fecha: 20 de octubre de 2026. Los datos de las pruebas de UI pertenecen exclusivamente a la demo.

Actualización del 21 de octubre: el backend real del Issue #13 ya se instaló y verificó; ver [SUPABASE.md](SUPABASE.md). Este documento conserva la evidencia del bloque de pantallas.

Actualización del 22 de octubre: el Issue #18 añade la prueba con dos pestañas reales, corrige la inicialización del VFS web de Expo y eleva la suite local a 47 pruebas. Procedimiento, límites y capturas en [WEB_STORAGE_QA.md](WEB_STORAGE_QA.md).

Actualización del 26 de octubre: procedencia de los 11 IDs de Stitch acreditada con el lienzo autenticado y el ZIP original. El mapeo corregido y sus límites están en [STITCH_PROVENANCE.md](STITCH_PROVENANCE.md). Esto no amplía la revisión visual parcial descrita aquí; la aceptación completa sigue en #25.

Actualización de #27: se retira el soporte cliente exclusivo de web y sus seis pruebas. Pasan 49 pruebas (41 conservadas y ocho nuevas), TypeScript y bundles Android/iOS. La demo se comprueba con SQLite real de Node, ocho colmenas, audio, resúmenes y reapertura con inspección persistente sin red. Los siete tests del almacenamiento nativo usan dobles de Expo y no ejecutan SQLCipher/SecureStore reales. Ver [inventario y aceptación pendiente](NATIVE_CLEANUP.md). La tabla y los recorridos de navegador siguientes son evidencia histórica, no resultados de la rama actual ni validación móvil.

| Comprobación                                   | Resultado                                                                                                                              |
| ---------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| TypeScript estricto (`npx tsc --noEmit`)       | Correcto                                                                                                                               |
| 9 tests con SQLite real                        | Correctos: transacciones, offline, recovery, orden de audio/dependencias, backoff, ACK concurrente, checkpoint, paginación e identidad |
| 7 tests de protocolo IoT                       | Correctos: fragmentación/expiración, rangos y cuatro clips WAV reproducibles                                                           |
| 7 tests de IA                                  | Correctos: FFT/MFCC, silencio, abstención, contrato ONNX y resúmenes                                                                   |
| 2 tests de cifrado                             | Correctos: AES-GCM, IV, identidad, alteración y clave errónea                                                                          |
| Exportación web                                | Correcta, con worker SQLite/WASM y shell offline generado                                                                              |
| Exportación de bundles JS/Hermes iOS y Android | Correcta; no equivale a APK/IPA ejecutados                                                                                             |
| `deno check` de generate-hive-summary          | Correcto                                                                                                                               |
| Prueba de cifrado con SQLite web en navegador  | Correcta: escritura, cierre, reapertura y clave errónea; ampliada con bloqueo de sesiones                                              |
| Acceso Supabase y sincronización real          | Validado después en #13 con dos cuentas temporales. Registro con correo real aún sin probar                                            |
| SQL/RLS/Storage y cron desplegados             | Validados el 21 de octubre en el proyecto configurado; ver SUPABASE.md                                                                 |
| BLE/MQTT y modelo entrenado                    | Pendiente: hardware, broker, protocolo y modelo sin definir                                                                            |

Recorrido manual en navegador: onboarding → demo → dashboard → detalle → inspección con nota/etiquetas/reina → reapertura y persistencia; monitor con reproducción y simulación de perturbación; historial con filtro y estado vacío; calibración relativa persistida; lista filtrada y mapa OpenStreetMap; cambio de intervalo a 30 minutos, tema y modo sin conexión. ARIA comprobado en los radios y pestañas, incluyendo selección única en `/hives`.

El mapa inicialmente falló bajo aislamiento COEP. Se corrigió con iframe sin credenciales y se verificaron mapa, marcador y atribución. La ruta `/hives` inicialmente coincidía también con el prefijo `/hive`; se corrigió el límite de segmento y se volvió a comprobar la navegación.

Capturas locales detalladas: `.artifacts/qa/` (ignoradas por Git). Una selección de evidencias visuales está en `docs/qa/`. La revisión de fidelidad completa no se declara aprobada: faltan exports originales y una comparación homogénea de las diez pantallas, como registra `design-qa.md` y #7.
