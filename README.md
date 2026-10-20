# Apisense Smart Apiary App

Aplicación Expo para iOS, Android y Web. Guarda primero en SQLite, recibe telemetría IoT y genera resúmenes acústicos orientativos en español.

**Estado: implementación local para revisión, sin despliegue de producción.** El bloque actual es el [Issue #4](https://github.com/Juulren/apisense/issues/4). El trabajo se continuará por Issues, con revisión entre bloques. Consulta [IMPLEMENTATION_PLAN.md](IMPLEMENTATION_PLAN.md) para distinguir código implementado, validaciones y pendientes. Los PR son acumulativos y apuntan a `main`; no se han fusionado.

## Ejecutar y verificar

Requiere Node 24 y npm. La demo no necesita credenciales.

```powershell
npm ci
npm run web
```

Abre la URL que imprime Expo y selecciona **Probar modo demo**. Sus ocho colmenas, clips y resúmenes son sintéticos; la demo no sincroniza ni se conecta al hardware. La bitácora y ajustes se conservan en la base de demo al reabrirla.

```powershell
npm run typecheck
npm test
npm run build:web
npm run preview
```

La versión estática se sirve en `http://localhost:4173`. Incluye un service worker para conservar el shell después de la primera carga completa. Los datos reales web requieren una clave local de al menos 16 caracteres, distinta de la contraseña de Supabase. Para abrirlos sin conexión se usa el correo y esa clave. La clave no se envía ni se guarda; perderla impide recuperar los cambios locales que aún no se hayan sincronizado.

Web requiere HTTPS (o loopback en desarrollo), Web Crypto, IndexedDB, Web Locks, workers, WASM y SharedArrayBuffer. Mantén estas cabeceras en el hosting:

```text
Cross-Origin-Opener-Policy: same-origin
Cross-Origin-Embedder-Policy: credentialless
```

`public/_headers` contiene las cabeceras recomendadas para proveedores que soportan ese formato. Configúralas explícitamente en cualquier otro servidor. Ajusta la CSP para un dominio Supabase personalizado. El mapa web usa un iframe sin credenciales y necesita red; las coordenadas y la lista siguen disponibles localmente.

## iOS y Android

Se necesita un **build nativo**, no Expo Go: SQLCipher, BLE y ONNX incluyen módulos nativos.

```powershell
npx expo run:android
# En macOS con Xcode:
npx expo run:ios
```

SQLCipher está activado en `app.json`. La app comprueba `cipher_version` y rechaza abrir una base real sin cifrado. Las claves por cuenta y los tokens nativos usan SecureStore. Los clips permanentes viven dentro de la base cifrada. La exportación de bundles JS/Hermes iOS/Android se verificó en Windows; esto no equivale a compilar y ejecutar APK/IPA. Verificar permisos BLE, SQLCipher y reproducción de audio en dispositivos físicos sigue pendiente (#8 y #15). Android Maps necesita una clave restringida configurada para el paquete del build; las coordenadas y la lista no dependen de esa clave.

## Configuración de Supabase e IoT

Copia `.env.example` a `.env` y configura la URL HTTPS y la clave pública/anon del proyecto. Nunca pongas `service_role`, contraseñas MQTT o secretos cron en variables `EXPO_PUBLIC_*`. Las credenciales MQTT se introducen en memoria durante la sesión; el transporte exige WSS y el broker debe aplicar ACL por usuario.

Cuando se haya elegido un proyecto y revisado el bloque de backend:

```powershell
npx supabase link --project-ref TU_PROJECT_REF
npx supabase db push
npx supabase functions deploy generate-hive-summary
```

Configura `CRON_SECRET` en las variables de la función y el mismo valor de alta entropía en Supabase Vault como `apisense_cron_secret`; añade `apisense_project_url`. Sin estos secretos el cron permanece inactivo. La función valida JWT/RLS para usuarios o el secreto de cron para el proceso servidor. El bucket `hive-audio` es privado; los registros conservan rutas y la reproducción remota usa URLs firmadas de duración corta.

No se eligió todavía un proyecto Supabase ni se desplegaron migraciones, función o cron. Docker está instalado, pero su daemon no está activo: la validación de RLS/Storage y ejecución cloud sigue en #13.

## Rutas y módulos

| Pantalla | Ruta |
|---|---|
| Onboarding y estado local | `/` |
| Login / registro / sesión offline | `/login` |
| Dashboard | `/dashboard` |
| Lista / mapa / alta de apiario y colmena | `/hives` |
| Detalle y resumen de colmena | `/hive/[id]` |
| Monitor, audio y espectrograma | `/monitor` |
| Historial y filtros | `/history` |
| Vinculación / calibración BLE / MQTT | `/pairing` |
| Bitácora manual | `/inspection` |
| Apariencia, intervalos, avisos y sync | `/settings` |
| Catálogo del Design System | `/ui-catalog` |

`src/db/` contiene esquema, migración local, repositorios y SyncEngine; `src/services/iot/` contiene transportes, validación y simulador; `src/services/ai/` contiene FFT/MFCC, ONNX y resúmenes. `supabase/` contiene SQL, función y cron. [DESIGN_MAP.md](DESIGN_MAP.md) registra las referencias y las adaptaciones pendientes de cotejo con los IDs originales.

## Límites de esta entrega

La frecuencia no diagnostica reina, enjambrazón o plagas. No se suministró modelo entrenado ni dataset validado: la app usa reglas experimentales y conserva fuente/versión del clasificador. El runtime ONNX está preparado para un modelo con manifiesto y checksum compatibles. El análisis periódico local se ejecuta en primer plano; el cron cloud requiere configuración y pruebas.

La auditoría pasó de 39 avisos (2 críticos) a 22 entradas high que derivan de dos avisos upstream sin versión corregida publicada al verificar: `braces` y `node-forge`, en rutas de build/CLI. No se declara una versión segura para producción. El seguimiento está en [#16](https://github.com/Juulren/apisense/issues/16), y la arquitectura y validaciones de cifrado en [docs/SECURITY_ARCHITECTURE.md](docs/SECURITY_ARCHITECTURE.md).
