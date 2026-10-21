# Supabase — instalación y evidencia del Issue #13

Fecha: 21 de octubre de 2026. Backend instalado en el proyecto de desarrollo indicado por el `.env` local. Las credenciales y referencias locales del proyecto no forman parte del repositorio. La aplicación aún no tiene una publicación de producción.

## Configuración de la app

Copia `.env.example` como `.env` y configura `EXPO_PUBLIC_SUPABASE_URL` y `EXPO_PUBLIC_SUPABASE_ANON_KEY`. La segunda acepta una clave Publishable o una clave pública `anon` heredada. Los nombres `NEXT_PUBLIC_*` pertenecen a Next.js y no son leídos por esta app Expo.

```powershell
npm ci
npm run backend:check
npm run web
```

El preflight solo realiza lecturas y una invocación sin sesión que debe ser rechazada. No imprime valores de configuración ni sustituye la prueba de aislamiento. Si cambias `.env`, reinicia Expo. El modo demo sigue separado y no sincroniza.

## Instalar en otro proyecto

La CLI está fijada en las dependencias de desarrollo. Después de iniciar sesión, usa la referencia del proyecto que corresponda a la URL del `.env`:

```powershell
npx supabase login
npx supabase link --project-ref TU_PROJECT_REF
npx supabase db push --dry-run
npx supabase db push
npx supabase config diff
npx supabase config push
npx supabase functions deploy generate-hive-summary --use-api
npx supabase db lint --linked --level warning
```

Las migraciones crean seis tablas con RLS, funciones de propiedad, Storage privado, pg_cron/pg_net y la cola privada de resúmenes. No ejecutes un reset sobre un proyecto con datos. Revisa el diff antes de aplicar la configuración: las URLs de Auth actuales son para desarrollo local, con confirmación de correo habilitada y redirecciones para localhost:8081, localhost:4173 y `apisense://login`. Antes de publicar, configura el dominio HTTPS y los enlaces nativos definitivos.

Para habilitar el cron, genera un secreto aleatorio y guárdalo como `CRON_SECRET` en los secretos de la función. Guarda **el mismo valor** en Supabase Vault con nombre `apisense_cron_secret`, y la URL HTTPS del proyecto con nombre `apisense_project_url`. Usa el dashboard o una sesión administrativa; no pegues valores reales en SQL versionado, argumentos de terminal ni variables `EXPO_PUBLIC_*`. El job queda sin llamadas útiles mientras esos dos secretos de Vault no existan.

La función tiene `verify_jwt = false` porque valida dentro del handler el JWT del usuario mediante Auth o el secreto cron. Una clave pública por sí sola no autoriza la ejecución. El cliente de usuario conserva su JWT y RLS; solo el cron autenticado utiliza la clave del servidor. Se admiten las claves de runtime actuales y las variables heredadas que suministra Supabase.

## Cola y paginación

- La cola vive en `apisense_private`, fuera de los esquemas de API. Sus RPC solo admiten `service_role`.
- Cada invocación cron reserva diez colmenas, con límite administrativo de 25. `FOR UPDATE SKIP LOCKED` evita reservar dos veces el mismo trabajo mientras la reserva esté vigente.
- Las reservas caducan en cinco minutos. Los fallos conservan la ventana y se reintentan con espera creciente; completar un trabajo exige su token vigente.
- Las colmenas activas se incorporan sin el corte anterior de 500. El orden por disponibilidad permite atender las siguientes en invocaciones sucesivas.
- Los clips de una ventana fija se recorren por `(recorded_at,id)` en páginas de 200. Se acumulan contadores sin retener todos los clips en memoria. Un fallo de página impide publicar un resumen parcial.
- La identidad del resumen mantiene el contrato local: colmena, inicio, fin y versión. Repetir la misma evidencia no crea otra fila.
- La invocación de usuario acepta `hive_id` o devuelve hasta 50 colmenas. Cuando existe `next_hive_id`, se continúa enviando ese valor como `after_hive_id`.

Diez trabajos por minuto no equivalen a capacidad ilimitada. Las reservas y reintentos permiten recuperar workers interrumpidos; el rendimiento y los límites de ejecución del plan contratado requieren medición con la carga real.

## Pruebas reproducibles

```powershell
# Sin servicios ni credenciales: SQL Postgres/PGlite, RLS, cola y handler
npm run test:backend

# Toda la suite local y tipos
npm run check

# Contra el proyecto configurado: usa cuentas y datos sintéticos temporales
npm run test:backend:live
```

La suite live lee `.env` y, opcionalmente, `.env.backend`. Este último archivo está ignorado por Git y contiene `SUPABASE_TEST_SECRET_KEY` (clave secreta de servidor o `service_role`) y `CRON_SECRET`. Nunca uses esas variables en la app ni en una compilación cliente. En esta ejecución se obtuvieron mediante la CLI autenticada sin imprimir sus valores; el token de administración de la CLI se mantiene en su propio almacén.

La suite crea dos cuentas con marcador `apisense_test_run`, genera WAV de prueba, sincroniza desde SQLite, comprueba políticas y elimina sus clips, filas y cuentas al finalizar. Solo limpia los UUID que creó. Si se interrumpe el proceso antes de su limpieza, revisa esas cuentas marcadas y sus datos antes de repetirlo.

Resultado de esta entrega: **43 pruebas locales y 6 pruebas live correctas**, TypeScript, Deno y exportación web correctos. El dry run final no mostró migraciones pendientes y se comprobaron cero cuentas de prueba, apiarios temporales y clips restantes en el bucket.

| Comprobación del 21/10/2026                                                     | Resultado                                                      |
| ------------------------------------------------------------------------------- | -------------------------------------------------------------- |
| URL y clave pública locales; Auth disponible                                    | Correcto                                                       |
| Tres migraciones aplicadas y lint del esquema remoto                            | Correcto; sin errores de esquema                               |
| RLS habilitado en las seis tablas y bucket `hive-audio` privado                 | Correcto, consultado en el servidor                            |
| SQLite → subida WAV → registro cloud → pull del resumen                         | Correcto                                                       |
| Dos cuentas: lecturas aisladas y escritura en apiario ajeno rechazada           | Correcto                                                       |
| Audio propio descargable y URL firmada; otra cuenta y acceso público rechazados | Correcto                                                       |
| JWT inválido, ausencia de sesión y secreto cron incorrecto                      | HTTP 401                                                       |
| Resumen propio repetido y solicitud sobre colmena de otra cuenta                | Una fila idempotente; ningún resumen ajeno devuelto            |
| Ventana de 1257 muestras a través de PostgREST y función desplegada             | Se contabilizan y descargan las 1257                           |
| Secreto cron válido y RPC de cola desplegados                                   | Correcto                                                       |
| Job cron activo; respuestas observadas de pg_net                                | HTTP 200, sin timeout                                          |
| Cola con 503 colmenas, recuperación de reservas y tokens obsoletos              | Correcto en PostgreSQL/PGlite; no es una prueba de carga cloud |

Las pruebas locales usan el SQL real de las migraciones de tablas y cola, con scaffolding de Auth/Storage. No ejecutan pg_cron, pg_net, GoTrue ni el servicio Storage; esos componentes se comprobaron por separado en el proyecto real. Los correos de prueba se confirmaron administrativamente y no se enviaron mensajes. El envío y recepción de correos reales, las compilaciones nativas y hardware/modelos siguen fuera de este bloque.

Las APIs de la app usan HTTPS. Los datos en el servidor deben ser accesibles a la función autorizada; no hay cifrado de extremo a extremo frente a Supabase. La política de backups/restauración, el acceso directo de administradores a PostgreSQL, el hosting y el cifrado en dispositivos requieren revisión antes de un release.

Referencias: [claves públicas y secretas](https://supabase.com/docs/guides/getting-started/api-keys), [autorización de funciones](https://supabase.com/docs/guides/functions/auth), [cron con Vault](https://supabase.com/docs/guides/functions/schedule-functions), [Vault](https://supabase.com/docs/guides/database/vault), [TLS y SSL de PostgreSQL](https://supabase.com/docs/guides/platform/ssl-enforcement).
