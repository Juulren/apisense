# Protección de datos — estado de implementación

Este documento describe controles implementados y validaciones pendientes; no certifica seguridad de producción.

Alcance confirmado el 26 de octubre de 2026: Android nativo e iOS nativo. #27 retira la persistencia y los adaptadores exclusivos de navegador. El historial web se conserva en [WEB_STORAGE_QA.md](WEB_STORAGE_QA.md) y no acredita la seguridad del producto móvil.

## Almacenamiento local

En builds nativos, SQLite usa SQLCipher con una clave aleatoria de 256 bits por cuenta guardada en SecureStore, accesible con el dispositivo desbloqueado y no migrable por copia de la clave. La app comprueba `PRAGMA cipher_version` y falla sin SQLCipher. Android desactiva backup de aplicación. Debe probarse en builds físicos antes de declarar cifrado nativo verificado.

Los WAV permanentes se guardan en la base cifrada como datos mediante `InlineClipStore`. La demo usa otra base SQLCipher con su propia clave de SecureStore y datos públicos sintéticos: no solicita una frase al usuario ni se sincroniza. También requiere una compilación con SQLCipher. No almacenar información real en ella.

## Comunicación y backend

El cliente acepta Supabase por HTTPS; HTTP se admite solo para loopback en desarrollo. MQTT exige WSS y deja las credenciales del broker en memoria. BLE depende del emparejamiento/seguridad GATT del firmware; no se inventa una garantía de cifrado de radio sin probar el dispositivo. Este punto está abierto en #8.

Supabase aplica RLS por propietario de apiario/colmena y conserva clips en un bucket privado con políticas por usuario. La app solicita URLs firmadas breves para reproducción. Claves de servicio y secreto cron no se incluyen en la app; se usan en servidor/Vault y, para pruebas administrativas, en un archivo local ignorado `.env.backend`. La función valida el JWT del usuario con Auth o el secreto cron dentro del handler. El backend autorizado necesita leer muestras para generar resúmenes: no hay cifrado de extremo a extremo frente al servidor. La política de backups/restauración y el acceso administrativo directo requieren revisión antes de producción.

El cron usa una cola en un esquema privado. Solo `service_role` puede ejecutar sus RPC; cada trabajo tiene token y caducidad, y los reintentos conservan la ventana original. Las llamadas de usuario mantienen RLS y recorren colmenas por cursor. Las muestras se acumulan por páginas sin publicar resultados parciales si alguna falla.

## Evidencia y límites

Siete pruebas del punto de entrada nativo usan dobles de Expo SQLite/SecureStore: verifican clave por cuenta, reutilización, separación de demo, rechazo de identidad/clave dañadas, fallo al guardar la clave, rechazo sin SQLCipher y cierre tras inicialización fallida. No ejecutan SQLCipher ni el llavero real. Una prueba de demo usa SQLite real de Node, clips WAV y resúmenes; conserva una inspección tras reabrir y no realiza peticiones de red. No sustituye la ejecución de la app en Android/iOS.

El 21 de octubre de 2026 se aplicaron las migraciones y se desplegaron función y cron en el proyecto configurado. Seis pruebas live verificaron sincronización con SQLite/WAV, RLS con dos usuarios, Storage privado/URLs firmadas, JWT/cron, idempotencia y 1257 muestras paginadas; las cuentas y datos de prueba se eliminaron. Se observaron respuestas cron HTTP 200. Ver [evidencia](SUPABASE.md). La ejecución nativa, broker/ACL y firmware siguen sin validar.

La auditoría inicial detectó 39 entradas, con 2 críticas. Se actualizó Vitest 5 y se fijaron dependencias transitivas corregidas (`decode-uri-component`, `postcss-selector-parser`, `uuid`), repitiendo tests y exportación. En aquella comprobación quedaron 22 entradas high derivadas de [braces](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm) y [node-forge](https://github.com/advisories/GHSA-86w9-cpqp-85rv). La auditoría actual del 26 de octubre tras #27 informa 0 críticas y 5 high, con node-forge y zod como avisos raíz. No se atribuye la diferencia solo a la retirada de dependencias: el registro de avisos también cambia con el tiempo. #16 conserva la evaluación antes de release; no se declara riesgo nulo ni se aplican cambios incompatibles automáticamente. CI falla con avisos críticos y reporta los restantes.

No se han puesto secretos reales en el repositorio ni publicado una aplicación. El backend de desarrollo está instalado; el siguiente bloque se seleccionará según IMPLEMENTATION_PLAN.md.
