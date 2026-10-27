# Plan de implementación por bloques

Actualizado: 27 de octubre de 2026. La base de la app, el flujo de colaboración y el [PR #24](https://github.com/Juulren/apisense/pull/24) están integrados en **`main`**; #18 está cerrado. El [PR #28](https://github.com/Juulren/apisense/pull/28) ya actualizó el README de `main` para Android/iOS exclusivamente. La demo nativa del [PR #30](https://github.com/Juulren/apisense/pull/30) está comprobada en Android/iOS Simulator y preparada para revisión. La limpieza [#27](https://github.com/Juulren/apisense/pull/29) y las fuentes [#1/#7](https://github.com/Juulren/apisense/pull/26) están implementadas y pendientes de validación/revisión e integración según su alcance. No se ha publicado una app de producción.

El [tablero de Apisense](https://github.com/users/Juulren/projects/2) muestra el trabajo activo. Los Issues contienen responsables, criterios y evidencia; este archivo conserva el resumen de hitos. Consulta [CONTRIBUTING.md](CONTRIBUTING.md) para trabajar desde `main` sin acumular ramas dependientes.

## Alcance confirmado — Android e iOS nativos

El 26 de octubre el usuario excluyó la página web del producto. Expo/React Native se configura únicamente para Android e iOS; el README y los comandos principales siguen ese alcance. La CI comprueba bundles JavaScript/Hermes de ambas plataformas, además de tipos, pruebas, referencias, auditoría y Deno. Los bundles no generan ni prueban APK/AAB o una app iOS.

La aceptación móvil requiere compilar y ejecutar en emulador/simulador y dispositivo, verificar SQLCipher/SecureStore, permisos, clips, BLE y sincronización, y preparar firma/distribución. #15 y #8 conservan esos pendientes. La comparación visual de #25 debe hacerse en las apps nativas.

Los resultados web de secciones anteriores son históricos y no acreditan el producto móvil. La limpieza cliente de #27 está implementada en una rama dependiente del PR #26. Su cierre exige compilaciones y recorridos nativos coordinados con #15; los bundles y las pruebas con dobles no completan ese criterio.

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

## Limpieza implementada — Issue #27

- [x] Inventariados y retirados almacén, mapa, ONNX/WASM, herramientas QA, hosting y scripts exclusivos de navegador.
- [x] Conservados SQLCipher/SecureStore, Maps, BLE, ONNX nativo, clips inline y módulos compartidos con Supabase/MQTT.
- [x] Eliminadas tres dependencias directas de web y 33 paquetes del lockfile sin actualizar las versiones restantes; dependencias transitivas requeridas por Expo Router conservadas.
- [x] Demo comprobada con SQLite real: ocho colmenas, WAVs, resúmenes e inspección persistente, sin red ni duplicación al reabrir.
- [x] TypeScript y 49 pruebas; bundles Android/iOS correctos. Inventario, evidencia y límites en [NATIVE_CLEANUP.md](docs/NATIVE_CLEANUP.md).
- [x] README de `main` sin instrucciones de página web, integrado por separado en PR #28 a petición del usuario.
- [ ] Compilaciones y recorridos Android/iOS con SQLCipher/SecureStore, permisos, acceso, demo, inspección, audio y sincronización; depende de #15/#8.
- [ ] Revisión e integración de la limpieza después de su base #26. #27 continúa abierto hasta completar los criterios.

## Demo nativa implementada — Android/iOS

- [x] Perfil de demo con identificador propio, sin cliente Supabase y con recursos locales incluidos en Release.
- [x] Comandos de compilación de demo para Android e iOS; mapa SVG ilustrativo sin claves ni red y estado nativo de reproducción.
- [x] Corrección acotada de ONNX 1.24.3 para Gradle 9; Xcode 26.2/Swift 6.2 e identidad de simulador para Keychain.
- [x] Flujo Maestro para entrada, audio, mapa, inspección persistente, reapertura y salida; conservación de logs y capturas.
- [x] Ambos binarios Release compilados e instalados en emulador Android/simulador iOS en Actions.
- [x] Recorrido Maestro Android sin red correcto; APK entregado con checksum e instrucciones.
- [x] Recorrido completo iOS Simulator correcto, incluida inspección persistente tras cerrar y reabrir.
- [x] Demo instalada, abierta y dashboard verificado visualmente en el emulador Android local solicitado por el usuario.
- [x] Binarios, checksums, instrucciones y evidencia final en [NATIVE_DEMO.md](docs/NATIVE_DEMO.md); PR #30 preparado para revisión.
- [ ] Revisión e integración autorizada del PR #30 tras sus bases #26/#29; no se fusiona automáticamente.

Las pruebas locales de la base de demo permanecen correctas. La aceptación nativa se registra en [NATIVE_DEMO.md](docs/NATIVE_DEMO.md), que distingue APK, simulador iOS y firma para iPhone físico.

## Pendientes de producto

| Issue                                                                                                  | Trabajo restante                                                                    | Criterio de aceptación                                                                                                                                                                                |
| ------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [#1](https://github.com/Juulren/apisense/issues/1), [#7](https://github.com/Juulren/apisense/issues/7) | Fuentes y procedencia verificadas; pendiente revisar e integrar el bloque actual    | Validar el PR con evidencia de los 11 IDs y cerrar al integrarlo.                                                                                                                                     |
| [#25](https://github.com/Juulren/apisense/issues/25)                                                   | Aprobar adaptaciones y completar la comparación visual por ruta                     | Decidir sobre las cinco vistas sin fuente independiente y comparar las apps Android/iOS con fuentes aprobadas al mismo viewport, tema y estado.                                                       |
| [#15](https://github.com/Juulren/apisense/issues/15)                                                   | Cifrado en dispositivos y preparación de la distribución móvil                      | Compilar y ejecutar Android/iOS con SQLCipher/SecureStore; probar cierre/apertura, bloqueo, permisos y audio. Revisar firma, enlaces de autenticación, distribución, backups y acceso administrativo. |
| [#8](https://github.com/Juulren/apisense/issues/8)                                                     | Firmware, UUIDs, broker/ACL, calibración y modelo entrenado                         | Pruebas físicas y dataset etiquetado con métricas, manifiesto, checksum y preprocesamiento compatibles.                                                                                               |
| [#16](https://github.com/Juulren/apisense/issues/16)                                                   | Avisos upstream de dependencias                                                     | Revaluar las versiones corregidas y su impacto con pruebas; resolver o evaluar explícitamente antes de release.                                                                                       |
| [#17](https://github.com/Juulren/apisense/issues/17)                                                   | Reclasificar la validación ARIA web heredada, fuera del alcance móvil               | Conservar el historial web y revisar su seguimiento; la accesibilidad nativa se comprueba en #25 con TalkBack/VoiceOver.                                                                              |
| [#27](https://github.com/Juulren/apisense/issues/27)                                                   | Limpieza cliente implementada; pendientes validación nativa, revisión e integración | Código exclusivo de web retirado; demostrar compilaciones y recorridos móviles coordinados con #15 antes del cierre.                                                                                  |

## Flujo siguiente

1. El usuario elige un Issue; se delimita el alcance y se asigna un responsable.
2. Se crea una rama desde `main` actualizado y se implementa solo ese bloque. Excepción actual: #27 depende de #26, que permanece abierto sin autorización de integración; la base del PR refleja esa dependencia.
3. Se abre un PR pequeño con evidencia y criterios pendientes explícitos. Se usa `Closes #NUMERO` solo cuando se cumplen todos los criterios; de lo contrario se enlaza con `Refs #NUMERO`.
4. Se revisa y, con autorización y checks correctos, se integra; después se elige el siguiente Issue.

El usuario pidió después completar la demo Android/iOS. El bloque activo se limita ahora a esa demo nativa en [PR #30](https://github.com/Juulren/apisense/pull/30), sobre #29/#26, sin integrar automáticamente esas ramas. Añade builds Release, aislamiento de servicios, mapa local y prueba Maestro; la ejecución de Gradle/Xcode y de los dispositivos virtuales se registra en [NATIVE_DEMO.md](docs/NATIVE_DEMO.md). No cierra todo #15/#27: cuentas reales, firma/distribución, dispositivos físicos y hardware conservan sus criterios. Solo la actualización documental de `main` del PR #28 fue autorizada e integrada por separado.
