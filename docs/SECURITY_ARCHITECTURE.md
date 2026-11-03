# Protección de datos — estado de implementación

Este documento describe controles implementados y validaciones pendientes; no certifica seguridad de producción.

Alcance confirmado el 26 de octubre de 2026: Android nativo e iOS nativo. #27 retira la persistencia y los adaptadores exclusivos de navegador. El historial web se conserva en [WEB_STORAGE_QA.md](WEB_STORAGE_QA.md) y no acredita la seguridad del producto móvil.

## Almacenamiento local

En builds nativos, SQLite usa SQLCipher con una clave aleatoria de 256 bits por cuenta guardada en SecureStore. Keychain aplica `WHEN_UNLOCKED_THIS_DEVICE_ONLY` en iOS; Android utiliza almacenamiento cifrado con Keystore. Esa opción no exige biometría por operación en Android ni elimina claves de RAM al bloquear. La app comprueba `PRAGMA cipher_version` y falla sin SQLCipher. Android desactiva backup de aplicación. Se verificó con módulos nativos reales en Android Emulator/API 35; la aceptación física del S21 Ultra sigue pendiente.

Los WAV permanentes se guardan en la base cifrada como datos mediante `InlineClipStore`. La demo usa otra base SQLCipher con su propia clave de SecureStore y datos públicos sintéticos: no solicita una frase al usuario ni se sincroniza. También requiere una compilación con SQLCipher. No almacenar información real en ella.

El 2 de noviembre, [la prueba nativa](https://github.com/Juulren/apisense/actions/runs/41522494229) rechazó lecturas sin clave/con clave errónea, conservó la base ante pérdida de clave y verificó separación, DB/WAL y WAV al reabrir. También comprobó las primitivas PKCE S256. [La app real de campo](https://github.com/Juulren/apisense/actions/runs/41526370065) pasó acceso con dos cuentas temporales, audio privado, inspección, reapertura sin red, sincronización y cierre de sesión. La inspección se confirmó una sola vez en Supabase y se eliminaron los recursos/secretos temporales; ver [procedimiento y límites](ANDROID_SECURITY_QA.md).

## Comunicación y backend

El cliente acepta Supabase por HTTPS; HTTP se admite solo para loopback en desarrollo. MQTT exige WSS y deja las credenciales del broker en memoria. BLE depende del emparejamiento/seguridad GATT del firmware; no se inventa una garantía de cifrado de radio sin probar el dispositivo. Este punto está abierto en #8.

Supabase aplica RLS por propietario de apiario/colmena y conserva clips en un bucket privado con políticas por usuario. La app solicita URLs firmadas breves para reproducción. Claves de servicio y secreto cron no se incluyen en la app; se usan en servidor/Vault y, para pruebas administrativas, en un archivo local ignorado `.env.backend`. La función valida el JWT del usuario con Auth o el secreto cron dentro del handler. El backend autorizado necesita leer muestras para generar resúmenes: no hay cifrado de extremo a extremo frente al servidor. La política de backups/restauración y el acceso administrativo directo requieren revisión antes de producción.

El cron usa una cola en un esquema privado. Solo `service_role` puede ejecutar sus RPC; cada trabajo tiene token y caducidad, y los reintentos conservan la ventana original. Las llamadas de usuario mantienen RLS y recorren colmenas por cursor. Las muestras se acumulan por páginas sin publicar resultados parciales si alguna falla.

## Evidencia y límites

Nueve pruebas del punto de entrada nativo usan dobles de Expo SQLite/SecureStore: verifican la conversión de rutas SQLite Android a URI de FileSystem, clave por cuenta, reutilización, separación de demo, rechazo de identidad/clave dañadas y conservación del archivo al perder la clave, fallo al guardar la clave, rechazo sin SQLCipher y cierre tras inicialización fallida. No ejecutan SQLCipher ni el llavero real. Una prueba de demo usa SQLite real de Node, clips WAV y resúmenes; conserva una inspección tras reabrir y no realiza peticiones de red. No sustituye la ejecución de la app en Android/iOS.

El 21 de octubre de 2026 se aplicaron las migraciones y se desplegaron función y cron en el proyecto configurado. Seis pruebas live verificaron sincronización con SQLite/WAV, RLS con dos usuarios, Storage privado/URLs firmadas, JWT/cron, idempotencia y 1257 muestras paginadas; las cuentas y datos de prueba se eliminaron. Se observaron respuestas cron HTTP 200. Ver [evidencia](SUPABASE.md). La demo pasó recorridos nativos Android/iOS; broker/ACL y firmware siguen sin validar. El bloque #15 prioriza Android y conserva pendiente la cuenta real dentro del APK.

La auditoría inicial detectó 39 entradas, con 2 críticas. Se actualizó Vitest 5 y se fijaron dependencias transitivas corregidas (`decode-uri-component`, `postcss-selector-parser`, `uuid`), repitiendo tests y exportación. En aquella comprobación quedaron 22 entradas high derivadas de [braces](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm) y [node-forge](https://github.com/advisories/GHSA-86w9-cpqp-85rv). La auditoría histórica del 26 de octubre tras #27 informa 0 críticas y 5 high, con node-forge y zod como avisos raíz. No se atribuye la diferencia solo a la retirada de dependencias: el registro de avisos también cambia con el tiempo. #16 conserva la evaluación antes de release; no se declara riesgo nulo ni se aplican cambios incompatibles automáticamente. CI falla con avisos críticos y reporta los restantes. El 2 de noviembre se repitió: 0 críticas, 6 high, 9 moderadas y 2 low; detalle y límites en [la evidencia Android](ANDROID_SECURITY_QA.md).

No se han puesto secretos reales en el repositorio ni publicado una aplicación. El backend de desarrollo está instalado. El bloque #15 añade callback PKCE, política del APK y comprobaciones nativas sintéticas; ver [evidencia actual y pendientes Android](ANDROID_SECURITY_QA.md). iOS queda en espera por decisión del usuario el 2 de noviembre.

## Reevaluación de dependencias — #16, 2 de noviembre de 2026

Se corrigieron dos raíces sin cambiar Expo 57, React Native ni ONNX:

- `decode-uri-component` 0.5.0 → **0.5.1**, fijado mediante override. La entrada con 16 000 secuencias distintas y un escape inválido tardó 5146 ms antes y 79 ms después en esta máquina. Se conserva una regresión acotada con margen de 1500 ms. [Aviso y corrección upstream](https://github.com/advisories/GHSA-qr28-fpjm-wq7f).
- `node-forge` 1.4.0 → **1.4.2**, compatible con los consumidores de Expo. Dos firmas sintéticas con campos adicionales dentro de `DigestAlgorithm` eran aceptadas antes; ahora se rechazan. Las firmas válidas, PEM como Buffer y la generación/validación real de certificados de Expo siguen funcionando. [Cambios upstream](https://github.com/digitalbazaar/forge/blob/v1.4.2/CHANGELOG.md).

El override anterior del decodificador ya era ESM y rompía `query-string` 7.1.3, que lo importaba como una función CommonJS. El postinstall normaliza exclusivamente ese import, verifica versión y SHA-256 del archivo original y admite su ejecución repetida. Actualizar `query-string` a 9.x cambiaría sus exports y rompería los imports de Expo Router; se conserva su API. Las pruebas cubren Unicode, arrays, escapes malformados, serialización y el caso de coste cuadrático. La ruta principal de Expo usa URLSearchParams, pero su alternativa de React Navigation aún importa este parser.

`npm ci`, TypeScript y las regresiones locales pasan. La auditoría baja de **17 entradas (6 high, 9 moderadas, 2 low)** a **13 (2 high, 9 moderadas, 2 low)**, sin críticas. Las entradas incluyen propagación por paquetes consumidores; no equivalen a 13 vulnerabilidades independientes.

| Raíz pendiente | Consumidor observado | Decisión de compatibilidad |
| --- | --- | --- |
| deepmerge 4.3.1 | Configuración/plugins de Expo, durante compilación | [Sin versión corregida publicada](https://github.com/advisories/GHSA-gcqx-w48m-w2h4); no procesar configuraciones de fuentes no confiables. |
| glob 13.0.6 | CLI, configuración, Metro y fingerprint | [Corrección desde 14.0.2](https://github.com/advisories/GHSA-3g3m-2fjr-6pw4), fuera del rango `^13` de Expo. Requiere migración y pruebas de compilación. |
| minimatch 10.2.6 | glob y fingerprint | [Corrección desde 11.0.1](https://github.com/advisories/GHSA-g3hv-75wg-m249), fuera del rango de fingerprint. No se fuerza otro major. |
| zod 3.25.76 | Validación de plugins DevTools de la CLI de Expo | [Corrección desde 4.6.6](https://github.com/advisories/GHSA-mrhx-c7xc-m3w5), fuera de `^3.25.76`; no sustituir la API de la CLI sin migración. |

Estas cuatro rutas observadas pertenecen a herramientas de desarrollo/compilación; no se identificaron imports desde `src/`. Esto no convierte sus avisos en falsos positivos ni garantiza ausencia en toda variante del build. #16 conserva el seguimiento de estas cuatro raíces antes de producción. `npm audit --audit-level=critical` sigue reportando los avisos y no acredita que los high estén resueltos. No se usa `audit fix --force` ni se declara aptitud para producción.
