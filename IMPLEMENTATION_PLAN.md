# Plan de implementación por bloques

Actualizado: 21 de octubre de 2026. La base de la app está consolidada en **`main`**. El usuario autorizó integrar el PR #21 y aplicar el flujo de colaboración en el [Issue #22](https://github.com/Juulren/apisense/issues/22). No se ha iniciado otro bloque de producto ni publicado una app de producción.

El [tablero de Apisense](https://github.com/users/Juulren/projects/2) muestra el trabajo activo. Los Issues contienen responsables, criterios y evidencia; este archivo conserva el resumen de hitos. Consulta [CONTRIBUTING.md](CONTRIBUTING.md) para trabajar desde `main` sin acumular ramas dependientes.

## Trabajo integrado

El [PR #21](https://github.com/Juulren/apisense/pull/21) se fusionó conservando el historial. GitHub marcó también como integrados los PR #9, #10, #11, #12, #14 y #19. El PR #20 de README ya estaba fusionado.

| Issue                                                | Implementación integrada                                                                               | Evidencia y límites                                                                                                                      |
| ---------------------------------------------------- | ------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------- |
| [#1](https://github.com/Juulren/apisense/issues/1)   | Base Expo, Router, TypeScript, NativeWind y referencias PNG/HTML locales                               | [PR #9](https://github.com/Juulren/apisense/pull/9). El Issue permanece abierto por los exports originales sin verificar; depende de #7. |
| [#2](https://github.com/Juulren/apisense/issues/2)   | Design System, temas y catálogo                                                                        | [PR #10](https://github.com/Juulren/apisense/pull/10). Issue cerrado por integración.                                                    |
| [#3](https://github.com/Juulren/apisense/issues/3)   | SQLite, cola transaccional, revisión/ACK, retries y sincronización                                     | [PR #11](https://github.com/Juulren/apisense/pull/11), 9 pruebas SQLite e integración real en #13. Issue cerrado.                        |
| [#4](https://github.com/Juulren/apisense/issues/4)   | Diez pantallas, demo aislada, bitácora, monitor, ajustes y acceso cifrado                              | [PR #19](https://github.com/Juulren/apisense/pull/19), [validación](docs/VALIDATION.md). Issue cerrado; fidelidad pendiente en #7.       |
| [#5](https://github.com/Juulren/apisense/issues/5)   | BLE/MQTT configurables, protocolo y simulador WAV                                                      | [PR #12](https://github.com/Juulren/apisense/pull/12), 7 pruebas IoT. Issue de implementación cerrado; hardware pendiente en #8.         |
| [#6](https://github.com/Juulren/apisense/issues/6)   | FFT/MFCC, reglas con abstención, adaptadores ONNX y resúmenes                                          | [PR #14](https://github.com/Juulren/apisense/pull/14), 7 pruebas IA. Issue de implementación cerrado; modelo científico pendiente en #8. |
| [#13](https://github.com/Juulren/apisense/issues/13) | Supabase real, seis tablas con RLS, audio privado, función, Vault/cron, cola con reservas y paginación | [PR #21](https://github.com/Juulren/apisense/pull/21), [evidencia](docs/SUPABASE.md). Issue cerrado.                                     |
| Documentación                                        | Contexto multiplataforma y ejecución                                                                   | [PR #20](https://github.com/Juulren/apisense/pull/20), integrado en `main`.                                                              |

## Validación del último bloque de producto

- [x] 43 pruebas locales, TypeScript, Deno y exportación web correctos.
- [x] 6 pruebas contra Supabase real: SQLite/WAV/pull, dos cuentas aisladas, Storage privado, JWT/cron e idempotencia.
- [x] 1257 muestras contabilizadas y descargadas mediante paginación real.
- [x] Tres migraciones aplicadas; lint remoto sin errores; cron activo con respuestas HTTP 200.
- [x] Cuentas, apiarios y clips temporales eliminados; credenciales excluidas de Git y secretos de servidor ausentes de la exportación cliente.
- [x] Checks de GitHub correctos para el PR #21.

La prueba SQL con 503 colmenas valida la cola; no es un benchmark cloud. No se verificaron correos reales, dispositivos físicos, un modelo entrenado ni restauraciones de backups. El backend autorizado puede leer el audio para analizarlo; no hay cifrado de extremo a extremo frente al servidor.

## Organización de la colaboración — Issue #22

- Consolidar la base en `main` y resolver los PR acumulativos preservando el historial.
- Usar una rama temporal por Issue y una tarea en curso por persona.
- Mantener un tablero con Pendiente, En curso, En revisión y Terminado.
- Exigir PR y checks para `main`, y eliminar automáticamente las ramas integradas.
- Usar plantillas breves de tarea/PR y registrar validación y pendientes.
- Evitar duplicar CI en push de rama y PR; cancelar ejecuciones anteriores del mismo PR.

El Issue #22 se cierra al integrar el PR de estas instrucciones y su configuración. Esta autorización corresponde a la consolidación y al flujo de trabajo; no inicia automáticamente la siguiente tarea de producto.

## Pendientes de producto

| Issue                                                                                                  | Trabajo restante                                                                  | Criterio de aceptación                                                                                                                                                                 |
| ------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [#1](https://github.com/Juulren/apisense/issues/1), [#7](https://github.com/Juulren/apisense/issues/7) | Verificar los 11 exports originales de Stitch; algunas pantallas son adaptaciones | Obtener las fuentes originales, actualizar DESIGN_MAP y cotejar las pantallas al mismo viewport.                                                                                       |
| [#15](https://github.com/Juulren/apisense/issues/15)                                                   | Cifrado en dispositivos y preparación del despliegue                              | Ejecutar builds nativos con SQLCipher/SecureStore y probar cierre/apertura, bloqueo y audio. Revisar hosting, redirecciones definitivas, backups/restauración y acceso administrativo. |
| [#8](https://github.com/Juulren/apisense/issues/8)                                                     | Firmware, UUIDs, broker/ACL, calibración y modelo entrenado                       | Pruebas físicas y dataset etiquetado con métricas, manifiesto, checksum y preprocesamiento compatibles.                                                                                |
| [#16](https://github.com/Juulren/apisense/issues/16)                                                   | Avisos upstream de dependencias                                                   | Revaluar las versiones corregidas y su impacto con pruebas; resolver o evaluar explícitamente antes de release.                                                                        |
| [#17](https://github.com/Juulren/apisense/issues/17)                                                   | Cerrar la revisión de accesibilidad del cambio ya integrado                       | Estados ARIA comprobados en DOM; completar la comprobación de navegación por teclado antes de cerrar el Issue.                                                                         |
| [#18](https://github.com/Juulren/apisense/issues/18)                                                   | Cerrar la validación de exclusión mutua web del cambio ya integrado               | Web Locks y rechazo simultáneo incluidos en el catálogo; ampliar la comprobación entre pestañas reales antes de cerrar.                                                                |

## Flujo siguiente

1. El usuario elige un Issue; se delimita el alcance y se asigna un responsable.
2. Se crea una rama desde `main` actualizado y se implementa solo ese bloque.
3. Se abre un PR pequeño con criterios cumplidos, evidencia y `Closes #NUMERO`.
4. Se revisa y, con autorización y checks correctos, se integra; después se elige el siguiente Issue.

No hay un próximo bloque seleccionado. Los Issues pendientes conservan su alcance; organizar el repositorio no los marca como resueltos.
