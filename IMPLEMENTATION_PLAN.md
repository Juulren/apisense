# Plan de implementación por bloques

Actualizado: 26 de octubre de 2026. La base de la app, el flujo de colaboración y el [PR #24](https://github.com/Juulren/apisense/pull/24) están integrados en **`main`**; #18 está cerrado. El bloque actual es exclusivamente la recuperación y verificación de fuentes de los Issues [#1](https://github.com/Juulren/apisense/issues/1) y [#7](https://github.com/Juulren/apisense/issues/7). No se ha publicado una app de producción.

El [tablero de Apisense](https://github.com/users/Juulren/projects/2) muestra el trabajo activo. Los Issues contienen responsables, criterios y evidencia; este archivo conserva el resumen de hitos. Consulta [CONTRIBUTING.md](CONTRIBUTING.md) para trabajar desde `main` sin acumular ramas dependientes.

## Alcance confirmado — Android e iOS nativos

El 26 de octubre el usuario excluyó la página web del producto. Expo/React Native se configura únicamente para Android e iOS; el README y los comandos principales siguen ese alcance. La CI comprueba bundles JavaScript/Hermes de ambas plataformas, además de tipos, pruebas, referencias, auditoría y Deno. Los bundles no generan ni prueban APK/AAB o una app iOS.

La aceptación móvil requiere compilar y ejecutar en emulador/simulador y dispositivo, verificar SQLCipher/SecureStore, permisos, clips, BLE y sincronización, y preparar firma/distribución. #15 y #8 conservan esos pendientes. La comparación visual de #25 debe hacerse en las apps nativas.

Los resultados web de secciones anteriores son históricos y no acreditan el producto móvil. #27 registra la retirada del código y las dependencias exclusivas de web después de validar la base nativa; no se ejecuta esa limpieza completa dentro de #1/#7.

## Trabajo integrado

El [PR #21](https://github.com/Juulren/apisense/pull/21) se fusionó conservando el historial. GitHub marcó también como integrados los PR #9, #10, #11, #12, #14 y #19. El PR #20 de README ya estaba fusionado.

| Issue                                                | Implementación integrada                                                                               | Evidencia y límites                                                                                                                                      |
| ---------------------------------------------------- | ------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [#1](https://github.com/Juulren/apisense/issues/1)   | Base Expo, Router, TypeScript, NativeWind y referencias PNG/HTML locales                               | [PR #9](https://github.com/Juulren/apisense/pull/9). Procedencia de los 11 IDs comprobada en el bloque actual #1/#7; cierre pendiente de integrar su PR. |
| [#2](https://github.com/Juulren/apisense/issues/2)   | Design System, temas y catálogo                                                                        | [PR #10](https://github.com/Juulren/apisense/pull/10). Issue cerrado por integración.                                                                    |
| [#3](https://github.com/Juulren/apisense/issues/3)   | SQLite, cola transaccional, revisión/ACK, retries y sincronización                                     | [PR #11](https://github.com/Juulren/apisense/pull/11), 9 pruebas SQLite e integración real en #13. Issue cerrado.                                        |
| [#4](https://github.com/Juulren/apisense/issues/4)   | Diez pantallas, demo aislada, bitácora, monitor, ajustes y acceso cifrado                              | [PR #19](https://github.com/Juulren/apisense/pull/19), [validación](docs/VALIDATION.md). Issue cerrado; aceptación visual pendiente en #25.              |
| [#5](https://github.com/Juulren/apisense/issues/5)   | BLE/MQTT configurables, protocolo y simulador WAV                                                      | [PR #12](https://github.com/Juulren/apisense/pull/12), 7 pruebas IoT. Issue de implementación cerrado; hardware pendiente en #8.                         |
| [#6](https://github.com/Juulren/apisense/issues/6)   | FFT/MFCC, reglas con abstención, adaptadores ONNX y resúmenes                                          | [PR #14](https://github.com/Juulren/apisense/pull/14), 7 pruebas IA. Issue de implementación cerrado; modelo científico pendiente en #8.                 |
| [#13](https://github.com/Juulren/apisense/issues/13) | Supabase real, seis tablas con RLS, audio privado, función, Vault/cron, cola con reservas y paginación | [PR #21](https://github.com/Juulren/apisense/pull/21), [evidencia](docs/SUPABASE.md). Issue cerrado.                                                     |
| [#18](https://github.com/Juulren/apisense/issues/18) | Exclusión por cuenta y apertura del almacén cifrado entre pestañas; inicialización diferida de OPFS    | [PR #24](https://github.com/Juulren/apisense/pull/24), 47 pruebas y [validación entre pestañas](docs/WEB_STORAGE_QA.md).                                 |
| Documentación                                        | Contexto multiplataforma y ejecución                                                                   | [PR #20](https://github.com/Juulren/apisense/pull/20), integrado en `main`.                                                                              |

## Validación del bloque Supabase — Issue #13

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

El [PR #23](https://github.com/Juulren/apisense/pull/23) integró estas instrucciones y su configuración; el Issue #22 está cerrado.

## Almacén cifrado — Issue #18, integrado

- [x] Catálogo de desarrollo con sesiones sintéticas para probar el almacén cifrado en dos pestañas reales.
- [x] Cuatro pruebas nuevas con Web Locks real; 47 pruebas locales y TypeScript correctos.
- [x] Corregida la inicialización ansiosa del VFS de Expo, que impedía abrir el worker desde otra pestaña incluso después de liberar el bloqueo.
- [x] Dos pestañas: rechazo simultáneo, transferencia A → B → A con la última marca, sesiones independientes y recuperación tras cerrar directamente la pestaña propietaria.
- [x] Instalación limpia con parche reproducible y exportación web correctas.
- [x] Procedimiento, resultados y capturas en [WEB_STORAGE_QA.md](docs/WEB_STORAGE_QA.md).
- [x] [PR #24](https://github.com/Juulren/apisense/pull/24) integrado en `main` el 26 de octubre, después de recuperar la CI y con autorización del usuario. #18 cerrado.

El parche está limitado a `expo-sqlite` 57.0.4 y verifica el hash del worker. Revisarlo al actualizar Expo y retirarlo cuando una solución upstream pase la misma prueba. La validación corresponde al navegador Chromium integrado; no certifica otros navegadores ni builds nativos.

## Bloque actual — Issues #1 y #7

- [x] Localizados los 11 IDs en el proyecto autenticado de Stitch.
- [x] Vinculados uno a uno con los 11 HTML/PNG originales; 23 archivos idénticos al ZIP del usuario.
- [x] Corregidas diez asociaciones ID/pantalla erróneas en el brief inicial; los originales son cinco familias claro/oscuro y una spec.
- [x] Conservada evidencia DOM normalizada y hashes; verificador reproducible incluido en CI.
- [x] Verificador correcto, cuatro casos negativos rechazados, TypeScript, 47 pruebas y bundles Android/iOS correctos.
- [x] Contexto de producto, mapeo y procedencia en [DESIGN_CONTEXT.md](docs/DESIGN_CONTEXT.md), [DESIGN_MAP.md](DESIGN_MAP.md) y [STITCH_PROVENANCE.md](docs/STITCH_PROVENANCE.md).
- [x] Registrada en [#25](https://github.com/Juulren/apisense/issues/25) la aceptación de adaptaciones y comparación visual pendiente. No se inicia esa implementación en este bloque.
- [ ] Revisión e integración autorizada del PR de #1/#7; solo entonces cerrar ambos Issues.

La coincidencia exacta se refiere al cuerpo HTML normalizado, no a píxeles o cabeceras. ZIP y Code to Clipboard no entregaron una exportación nueva; la entrega acredita los originales ya conservados con el lienzo actual. No altera los flujos de la app ni certifica su aceptación visual completa. La configuración y la CI se alinean con Android/iOS por indicación del usuario.

## Pendientes de producto

| Issue                                                                                                  | Trabajo restante                                                                 | Criterio de aceptación                                                                                                                                                                                |
| ------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [#1](https://github.com/Juulren/apisense/issues/1), [#7](https://github.com/Juulren/apisense/issues/7) | Fuentes y procedencia verificadas; pendiente revisar e integrar el bloque actual | Validar el PR con evidencia de los 11 IDs y cerrar al integrarlo.                                                                                                                                     |
| [#25](https://github.com/Juulren/apisense/issues/25)                                                   | Aprobar adaptaciones y completar la comparación visual por ruta                  | Decidir sobre las cinco vistas sin fuente independiente y comparar las apps Android/iOS con fuentes aprobadas al mismo viewport, tema y estado.                                                       |
| [#15](https://github.com/Juulren/apisense/issues/15)                                                   | Cifrado en dispositivos y preparación de la distribución móvil                   | Compilar y ejecutar Android/iOS con SQLCipher/SecureStore; probar cierre/apertura, bloqueo, permisos y audio. Revisar firma, enlaces de autenticación, distribución, backups y acceso administrativo. |
| [#8](https://github.com/Juulren/apisense/issues/8)                                                     | Firmware, UUIDs, broker/ACL, calibración y modelo entrenado                      | Pruebas físicas y dataset etiquetado con métricas, manifiesto, checksum y preprocesamiento compatibles.                                                                                               |
| [#16](https://github.com/Juulren/apisense/issues/16)                                                   | Avisos upstream de dependencias                                                  | Revaluar las versiones corregidas y su impacto con pruebas; resolver o evaluar explícitamente antes de release.                                                                                       |
| [#17](https://github.com/Juulren/apisense/issues/17)                                                   | Reclasificar la validación ARIA web heredada, fuera del alcance móvil            | Conservar el historial web y revisar su seguimiento; la accesibilidad nativa se comprueba en #25 con TalkBack/VoiceOver.                                                                              |
| [#27](https://github.com/Juulren/apisense/issues/27)                                                   | Retirar soporte web heredado después de validar las apps nativas                 | Retirar únicamente módulos, pruebas, dependencias y scripts exclusivos de web sin afectar al producto móvil ni al backend.                                                                            |

## Flujo siguiente

1. El usuario elige un Issue; se delimita el alcance y se asigna un responsable.
2. Se crea una rama desde `main` actualizado y se implementa solo ese bloque.
3. Se abre un PR pequeño con criterios cumplidos, evidencia y `Closes #NUMERO`.
4. Se revisa y, con autorización y checks correctos, se integra; después se elige el siguiente Issue.

El bloque seleccionado es #1/#7. Se entrega para revisión y no se integra ni se inicia #25 automáticamente. Los demás pendientes conservan su alcance.
