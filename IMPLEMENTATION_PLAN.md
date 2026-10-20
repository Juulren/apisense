# Plan de implementación por bloques

Actualizado: 20 de octubre de 2026. **Punto de parada: Issue #4 entregado para revisión. No iniciar otro Issue hasta que el usuario indique continuar.**

La solicitud inicial produjo trabajo de las fases 0–5 antes de acordar este flujo por partes. Este registro conserva lo hecho y distingue implementación de validación real. Ningún PR se ha fusionado; `main` solo contiene el commit inicial. Los PR apuntan a `main` y son acumulativos: revisar/integrar en orden, o rebasar cada rama después del merge anterior.

## Bloque actual — Issue #4

Rama: `feat/screens-implementation`. Alcance: conectar las diez pantallas operativas y el catálogo a la base local y servicios ya preparados.

- [x] Onboarding, login/registro y acceso offline; demo separada de cuentas reales.
- [x] Dashboard con estados derivados de muestras y resúmenes locales.
- [x] Lista, búsqueda y mapa del apiario; altas locales de apiario/colmena.
- [x] Detalle de colmena, resumen y bitácora.
- [x] Monitor con reproducción de WAV, FFT/espectrograma y simulador.
- [x] Historial con filtros de colmena y estado, incluido estado vacío.
- [x] Vinculación BLE/MQTT configurable y calibración persistida; conexión real pendiente de hardware.
- [x] Registro manual con notas, etiquetas y observación explícita de reina.
- [x] Ajustes de tema, intervalos, avisos y modo offline.
- [x] Estados ARIA y corrección de selección única de pestaña `/hive` frente a `/hives`.
- [x] Guardado y reapertura de bitácora comprobados en navegador.
- [x] TypeScript, pruebas unitarias y exportaciones JS web/iOS/Android verificadas.
- [ ] Revisar el PR del bloque y aceptar su alcance local.
- [ ] Fusionar el PR cuando se apruebe; su descripción enlaza el cierre de #4.

La fidelidad exacta de las pantallas sin export original queda en #7. Login cloud, broker y dispositivos reales no se han probado y no se presentan como terminados.

## Registro de lo implementado

| Issue | Trabajo realizado | Evidencia / PR | Estado real |
|---|---|---|---|
| [#1](https://github.com/Juulren/apisense/issues/1) | Expo SDK 57, Router, TypeScript, NativeWind; 11 pares PNG/HTML locales y DESIGN.md preservados con SHA-256 | [PR #9](https://github.com/Juulren/apisense/pull/9), DESIGN_MAP.md | Base implementada. Correspondencia de los 11 IDs originales pendiente en #7 |
| [#2](https://github.com/Juulren/apisense/issues/2) | Tokens, tipografías, variantes, formularios, temas y catálogo UI | [PR #10](https://github.com/Juulren/apisense/pull/10) | Implementado, pendiente revisión/integración |
| [#3](https://github.com/Juulren/apisense/issues/3) | SQLite, cola transaccional, revisiones, ACK condicional, retries, upload de audio antes del registro y pull paginado; SQL/RLS/Storage | [PR #11](https://github.com/Juulren/apisense/pull/11), 9 tests SQLite | Local validado. Backend real pendiente en #13 |
| [#5](https://github.com/Juulren/apisense/issues/5) | Transportes BLE/MQTT, validación y fragmentación, deduplicación y cuatro patrones WAV | [PR #12](https://github.com/Juulren/apisense/pull/12), 7 tests IoT | Código implementado. Firmware/broker/hardware pendiente en #8 |
| [#6](https://github.com/Juulren/apisense/issues/6) | FFT/MFCC, reglas con abstención, adaptadores ONNX, resúmenes locales y función/cron cloud | [PR #14](https://github.com/Juulren/apisense/pull/14), 7 tests IA; Deno check | Experimental validado en software. Modelo científico y cron desplegado pendientes |
| [#4](https://github.com/Juulren/apisense/issues/4) | Diez pantallas conectadas y catálogo, flujos demo, cifrado integrado al acceso | Rama actual y reporte docs/VALIDATION.md | Implementación local lista para revisión; detenerse al entregar el PR |

## Pendientes que requieren bloques separados

| Issue | Qué falta | Criterio para cerrarlo |
|---|---|---|
| [#7](https://github.com/Juulren/apisense/issues/7) | Verificar exports de los 11 IDs: el proyecto actual contiene variantes de seis vistas; hay pantallas adaptadas | Obtener los exports originales, actualizar DESIGN_MAP y comparar las pantallas correspondientes al mismo viewport |
| [#15](https://github.com/Juulren/apisense/issues/15) | Cifrado real en dispositivos y revisión de la configuración de despliegue | Ejecutar development builds con SQLCipher/SecureStore, probar apertura/cierre, bloqueo y audio; confirmar cabeceras/CSP y políticas del hosting. AES-GCM web, claves incorrectas, alteración e identidad ya se probaron |
| [#13](https://github.com/Juulren/apisense/issues/13) | Elegir proyecto Supabase; aplicar SQL; probar Auth/RLS multiusuario, bucket, función y cron | Pruebas con dos cuentas y audio real, secretos en Vault, resúmenes idempotentes y recepción de cambios. Escalar límites de 500 colmenas/1000 muestras por ventana si hace falta |
| [#8](https://github.com/Juulren/apisense/issues/8) | Firmware, UUIDs GATT, broker/ACL, calibración y modelo ONNX entrenado | Pruebas físicas BLE/MQTT y dataset etiquetado; métricas de validación, manifiesto, checksum y preprocesamiento compatibles. No promover reglas experimentales a diagnóstico |
| [#16](https://github.com/Juulren/apisense/issues/16) | Avisos upstream `braces` y `node-forge` sin corrección publicada | Revaluar versiones corregidas y actualizar con pruebas; mantener bloqueo de release hasta resolución/evaluación explícita |
| [#17](https://github.com/Juulren/apisense/issues/17) | Revisar corrección ARIA incluida en el bloque de pantallas | Cambio implementado y comprobado en DOM; pendiente integrar el PR |
| [#18](https://github.com/Juulren/apisense/issues/18) | Revisar exclusión mutua de snapshots web | Web Locks implementado y comprobación incluida en catálogo de desarrollo; pendiente integrar el PR y ampliar pruebas entre pestañas reales |

## Flujo acordado para lo siguiente

1. El usuario elige un Issue y se delimita su criterio de aceptación.
2. Se trabaja solo ese bloque en una rama; los hallazgos ajenos se registran como pendientes.
3. Se ejecutan sus verificaciones, se hace commit/push y se entrega un PR con evidencia y límites.
4. Se actualiza este plan y se detiene el trabajo para revisión. No fusionar, desplegar ni comenzar el siguiente bloque automáticamente.

Próxima decisión, sin ejecución automática: revisar el PR del Issue #4 y elegir entre referencias de diseño (#7), cifrado nativo (#15) o backend (#13). Hardware y modelo dependen de recursos aún no definidos (#8).
