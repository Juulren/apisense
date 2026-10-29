# Protección de datos — estado de implementación

Este documento describe controles implementados y validaciones pendientes; no certifica seguridad de producción.

Alcance confirmado el 26 de octubre de 2026: Android nativo e iOS nativo. Los apartados sobre web conservan el historial del código previo y no son requisitos ni evidencia de validación del producto móvil.

## Almacenamiento local

En builds nativos, SQLite usa SQLCipher con una clave aleatoria de 256 bits por cuenta guardada en SecureStore, accesible con el dispositivo desbloqueado y no migrable por copia de la clave. La app comprueba `PRAGMA cipher_version` y falla sin SQLCipher. Android desactiva backup de aplicación. Debe probarse en builds físicos antes de declarar cifrado nativo verificado.

En web, las cuentas reales abren SQLite solo en memoria. Tras cada transacción se serializa y cifra la base con AES-GCM de 256 bits antes de confirmar la persistencia en IndexedDB. La clave no extraíble se deriva de una frase local con PBKDF2-SHA256 (600000 iteraciones y sal aleatoria de 16 bytes); cada snapshot usa IV aleatorio de 12 bytes y autentica el principal como datos adicionales. Un fallo al persistir restaura el estado anterior en memoria. Web Locks impide dos sesiones que sobrescriban snapshots de la misma cuenta.

Se conservan en claro únicamente metadatos necesarios para localizar el almacén: UUID de cuenta y un hash del correo. La frase, la clave derivada y los tokens web no se persisten. Perder la frase hace irrecuperables los datos locales no sincronizados. El cifrado protege datos cerrados; una sesión desbloqueada necesita acceso al contenido para mostrarlo.

Los WAV permanentes se guardan en la base cifrada como datos, también en nativo. La demo usa una base independiente con datos públicos sintéticos y no requiere una clave secreta. No se sincroniza. No almacenar información real en ella.

## Comunicación y backend

El cliente acepta Supabase por HTTPS; HTTP se admite solo para loopback en desarrollo. MQTT exige WSS y deja las credenciales del broker en memoria. BLE depende del emparejamiento/seguridad GATT del firmware; no se inventa una garantía de cifrado de radio sin probar el dispositivo. Este punto está abierto en #8.

Supabase aplica RLS por propietario de apiario/colmena y conserva clips en un bucket privado con políticas por usuario. La app solicita URLs firmadas breves para reproducción. Claves de servicio y secreto cron no se incluyen en la app; se usan en servidor/Vault y, para pruebas administrativas, en un archivo local ignorado `.env.backend`. La función valida el JWT del usuario con Auth o el secreto cron dentro del handler. El backend autorizado necesita leer muestras para generar resúmenes: no hay cifrado de extremo a extremo frente al servidor. La política de backups/restauración y el acceso administrativo directo requieren revisión antes de producción.

El cron usa una cola en un esquema privado. Solo `service_role` puede ejecutar sus RPC; cada trabajo tiene token y caducidad, y los reintentos conservan la ventana original. Las llamadas de usuario mantienen RLS y recorren colmenas por cursor. Las muestras se acumulan por páginas sin publicar resultados parciales si alguna falla.

## Evidencia y límites

Dos tests automáticos verifican AES-GCM, IV distintos, apertura, clave errónea, identidad incorrecta y manipulación de ciphertext. La prueba del catálogo en navegador verifica SQLite → snapshot cifrado → reapertura y rechazo de otra clave. La ampliación también comprueba exclusión mutua de sesiones.

El 21 de octubre de 2026 se aplicaron las migraciones y se desplegaron función y cron en el proyecto configurado. Seis pruebas live verificaron sincronización con SQLite/WAV, RLS con dos usuarios, Storage privado/URLs firmadas, JWT/cron, idempotencia y 1257 muestras paginadas; las cuentas y datos de prueba se eliminaron. Se observaron respuestas cron HTTP 200. Ver [evidencia](SUPABASE.md). La ejecución nativa, broker/ACL y firmware siguen sin validar.

La auditoría inicial detectó 39 entradas, con 2 críticas. Se actualizó Vitest 5 y se fijaron dependencias transitivas corregidas (`decode-uri-component`, `postcss-selector-parser`, `uuid`), repitiendo tests y exportación. Quedan 22 entradas high derivadas de dos avisos raíz sin paquete corregido publicado al comprobar: [braces](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm) y [node-forge](https://github.com/advisories/GHSA-86w9-cpqp-85rv). Sus rutas son de compilación/CLI; no se declara riesgo nulo. #16 mantiene el bloqueo de una afirmación de release seguro. CI falla con avisos críticos y reporta los restantes.

No se han puesto secretos reales en el repositorio ni publicado una aplicación. El backend de desarrollo está instalado; el siguiente bloque se seleccionará según IMPLEMENTATION_PLAN.md.
