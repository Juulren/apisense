# Issue #15 — cifrado y preparación de Android

Actualizado: 2 de noviembre de 2026. El usuario confirmó que la demo funciona en un **Samsung Galaxy S21 Ultra con Android 15**. Se prioriza Android; iOS queda en espera por indicación del usuario. La compatibilidad y evidencia iOS anteriores se conservan, sin nuevas compilaciones ni firma Apple en este bloque.

## Entrega de desarrollo: app de campo

Por aclaración del usuario, la entrega activa es **la app real de Android**, conectada a Supabase: `com.apisense.app`, con demo y QA desactivadas. El trabajo de cifrado aislado descrito más abajo es una herramienta interna de comprobación y no sustituye la aceptación de esta app.

Con `.env` público configurado y SDK/JDK disponibles, `npm run field:android` genera e instala la app de campo Release con JS incluido y sin Metro. `npm run android` conserva el ciclo de desarrollo con Metro. El comando de campo fija ambos flags en `0` y valida HTTPS/clave pública antes de compilar; nunca carga `.env.backend`.

El workflow **Android development** construye la app de campo y revisa su manifiesto. Mientras se integra por primera vez, se invoca a través del workflow existente **Native validation**:

```powershell
gh workflow run native-demo.yml --ref TU_RAMA -f field_app=true -f live_checks=true -f platform=android
```

Las variables de repositorio `APISENSE_SUPABASE_URL` y `APISENSE_SUPABASE_PUBLIC_KEY` contienen exclusivamente configuración pública del cliente. Los cuatro secretos `APISENSE_NATIVE_QA_{A,B}_{EMAIL,PASSWORD}` solo se usan al ejecutar Maestro, no al compilar el APK. No contienen claves administrativas. Para las pruebas live se preparan dos cuentas desechables con `scripts/native-field-fixtures.mjs`, ejecutado localmente con `.env.backend`. El script marca las cuentas, conserva sus IDs en un archivo ignorado y permite verificar y limpiar exclusivamente los recursos de esa ejecución. No envía correos.

El recorrido nativo entra por **Comenzar**, inicia sesión A, descarga y reproduce un WAV del bucket privado, guarda una inspección con la sincronización desactivada, corta Wi-Fi/datos, mata y reabre el proceso, comprueba la nota local, reconecta y sincroniza. Finalmente cambia a B y comprueba que muestra su propia colmena. Una consulta al servidor verifica que la nota del APK llegó una sola vez y sigue aislada de B. Los reportes de texto se limpian de credenciales temporales antes de subirlos como artefactos.

La nueva [compilación y prueba de campo](https://github.com/Juulren/apisense/actions/runs/41516671485) está en curso. La ejecución aislada anterior se canceló al priorizar esta entrega: no se acredita una prueba criptográfica completa por una ejecución cancelada. Al terminar se eliminarán las dos cuentas, sus datos y los secretos temporales de CI. El APK de desarrollo usa firma de prueba y no contiene una sesión ni contraseña embebidas; cada instalación inicia sesión con su propia cuenta.

## Resultado del bloque

La apertura del repositorio conserva la base existente si falta su clave: no genera otra, no reinicia SQLite y muestra una indicación de recuperación. SQLite y clips inline siguen usando SQLCipher con una clave aleatoria de 256 bits por identidad en SecureStore. No existe una alternativa de guardado en texto plano.

El build QA añade una comprobación reproducible con los módulos nativos reales, dos identidades sintéticas aleatorias y archivos propios. No crea cuentas de Supabase, no utiliza las identidades del usuario y no toca la base de la demo. Al terminar elimina únicamente sus bases y claves temporales.

| Comprobación | Cómo se verifica |
| --- | --- |
| PKCE nativo | Aleatoriedad nativa y SHA-256/UTF-8/base64url comparados con el vector conocido `abc` |
| SQLCipher presente | `PRAGMA cipher_version` en el repositorio real |
| Notas y clips en disco | Busca un marcador y el prefijo del WAV inline en DB/WAL; rechaza cabecera SQLite sin cifrar |
| Lectura no autorizada | Consultar el esquema sin clave y con clave errónea debe fallar |
| Clave perdida | Retira temporalmente su propia clave QA, exige rechazo sin sustitución y la restaura |
| Separación local | Identidades A/B usan claves distintas y B no ve el marcador ni los clips de A |
| Reapertura | Recupera la nota y compara byte por byte el WAV después de cerrar y abrir |
| Recorrido de uso | Maestro repite audio, mapa, inspección, cierre del proceso, reapertura y salida de la demo |
| Política empaquetada | Inspecciona el manifiesto del APK: backup y tráfico HTTP desactivados, no depurable, sin permisos de grabación ni almacenamiento externo |

Estas pruebas no certifican resistencia ante un dispositivo comprometido. Las dos identidades son almacenes locales, no dos sesiones cloud. La comprobación de bytes refuerza la evidencia junto al rechazo de lectura y SQLCipher; por sí sola no es un análisis criptográfico.

## Ejecutar la prueba nativa

El workflow **Native validation** admite `security_checks=true` y requiere una compilación nueva; no permite reutilizar un APK antiguo para acreditar código nuevo. Android 15/API 35 es el destino automatizado. El flujo usa datos sintéticos y red desactivada.

```powershell
gh workflow run native-demo.yml --ref TU_RAMA -f field_app=false -f platform=android -f security_checks=true
```

Para generar e instalar el build QA local con JDK/SDK configurados:

```powershell
$env:EXPO_PUBLIC_SECURITY_QA = "1"
npm run demo:android
Remove-Item Env:EXPO_PUBLIC_SECURITY_QA
```

En el inicio aparece **Verificar cifrado nativo**. Ejecuta **Comprobar cifrado** y espera **Validación de cifrado completada**. La opción está desactivada en builds normales; la configuración impide habilitarla en una app de campo. El APK QA usa el mismo identificador que la demo (`com.apisense.demo`): es una actualización de prueba, no la app real de campo (`com.apisense.app`). No desinstales una app con cambios pendientes para sustituirla.

## Confirmación de cuenta

El registro solicita `apisense://auth/callback` y usa PKCE S256. El adaptador de autenticación conecta aleatoriedad y SHA-256 de Expo Crypto cuando Hermes no ofrece esas funciones WebCrypto; no usa la alternativa `Math.random`/challenge plano del SDK. Las implementaciones WebCrypto existentes se conservan. El código se intercambia mediante el verificador conservado en SecureStore en el dispositivo que inició el registro. La ruta rechaza otros esquemas/destinos, códigos duplicados y tokens de sesión importados por URL; no registra códigos ni refleja el detalle de errores remotos. Las entregas simultáneas del mismo enlace comparten un intercambio.

La configuración local y el proyecto Supabase de desarrollo usan exclusivamente esa redirección nativa. Se revisó el diff antes de aplicar dos propiedades de Auth; siete ajustes remotos no declarados, incluidos MFA y límites de correo, se conservaron. No se desplegaron migraciones ni funciones. La prueba de correo real y retorno a un dispositivo siguen pendientes; no se enviaron correos durante las pruebas. El callback está preparado en esta rama y estará disponible para los usuarios tras integrar y compilar la app de campo.

El enlace debe abrirse en el dispositivo donde se creó la cuenta; si se borra la app/verificador o se abre en otro dispositivo, vuelve a iniciar sesión con la cuenta confirmada o repite el registro según el resultado del servidor. El esquema personalizado no acredita propiedad exclusiva del dominio; PKCE evita canjear el código sin el verificador. Una publicación futura puede adoptar App Links con un dominio propio, sin implementar una página web del producto.

Referencias: [enlaces nativos](https://supabase.com/docs/guides/auth/native-mobile-deep-linking), [PKCE](https://supabase.com/docs/guides/auth/sessions/pkce-flow) y [SecureStore](https://docs.expo.dev/versions/latest/sdk/securestore/).

## Firma y distribución

`eas.json` prepara **preview** (APK de campo para pruebas internas) y **production** (AAB Android). Ambos desactivan demo y QA. El hook `eas-build-pre-install` rechaza flags incorrectos, URL sin HTTPS y claves secretas/`service_role` en la variable pública antes de instalar o compilar. No se inició un build remoto EAS, no se generaron credenciales de distribución y no se publicó en ninguna tienda.

1. Vincula la cuenta/proyecto de Expo al repositorio e indica únicamente las variables públicas de Supabase en el entorno de build correspondiente. `.easignore` excluye `.env`, `.env.backend`, binarios, SDK, datos QA y credenciales locales del archivo que se sube a EAS.
2. Configura y custodia el keystore de Android mediante el gestor de credenciales de EAS o el sistema privado elegido. Conserva una copia con acceso restringido y recuperación comprobada. No uses la clave debug de la demo para distribuir la app de campo.
3. Genera el APK interno con `eas build --platform android --profile preview` y completa la matriz física de abajo.
4. Tras la aceptación, genera el AAB con `eas build --platform android --profile production`. La publicación y la configuración de Play App Signing requieren un bloque autorizado y una cuenta de distribución; este archivo no envía nada a Play.

Las claves públicas de Supabase quedan incluidas en el cliente y dependen de RLS. Nunca añadas `service_role`, secreto cron, contraseña del broker ni claves de firma a `EXPO_PUBLIC_*`. La demo y el build QA conservan firma de prueba y no prueban la firma de producción.

## Backups, bloqueo y recuperación

Android Release desactiva `allowBackup`; SecureStore protege sus valores con Android Keystore. Las opciones `WHEN_UNLOCKED_THIS_DEVICE_ONLY` son restricciones de Keychain en iOS: no equivalen a exigir biometría o bloqueo por operación en Android. La app no implementa un bloqueo biométrico independiente ni garantiza borrar de RAM una clave al bloquear el teléfono.

La cola local puede contener cambios sin sincronizar. Desinstalar, borrar datos o perder la clave puede hacerlos irrecuperables: no se recuperan generando una clave nueva. Ante un error de clave, conserva la instalación y consulta la recuperación antes de borrar nada. Una nueva instalación puede descargar los registros ya sincronizados tras iniciar sesión; no recupera cambios que nunca llegaron al backend.

La política de backups de PostgreSQL y la del bucket de audio deben verificarse por separado, junto al plan de Supabase, responsables, retención y restauración en un proyecto aislado. No se hizo una restauración del proyecto compartido. El acceso administrativo debe limitarse a los responsables y protegerse con MFA; RLS no impide la lectura de un administrador ni del backend autorizado. Falta validar accesos efectivos y recuperación antes de producción.

## Evidencia y aceptación pendiente

- TypeScript y **76 pruebas locales** correctos, incluidos rechazo por pérdida de clave y callbacks PKCE.
- Bundles Android/iOS correctos; el de iOS es solo compatibilidad compartida, sin nueva aceptación nativa Apple.
- **6 pruebas live** de Supabase correctas el 2 de noviembre: dos cuentas temporales, SQLite/WAV/sincronización, aislamiento, audio privado, JWT/cron e idempotencia. La suite elimina sus datos temporales. No prueba una sesión dentro del APK.
- Auditoría npm del 2 de noviembre: **0 críticas, 6 high, 9 moderadas y 2 low**. Raíces notificadas: decode-uri-component, deepmerge, glob, minimatch, node-forge y zod. La evaluación de actualizaciones continúa en #16; no se declara aptitud para producción por ausencia de críticas.
- Compilación y pruebas de campo nuevas: [ejecución Android del bloque](https://github.com/Juulren/apisense/actions/runs/41516671485), resultado pendiente de registrar al finalizar. La prueba aislada anterior fue cancelada al priorizar la app real.

| Aceptación física Android | Estado |
| --- | --- |
| Demo abre en Samsung Galaxy S21 Ultra / Android 15 | Confirmado por el usuario el 2 de noviembre |
| Ejecutar nueva comprobación de cifrado QA en ese teléfono | Pendiente |
| Cuenta real: confirmar correo, iniciar sesión, cerrar/reabrir, modo sin red y cambio de cuenta | Pendiente |
| Sincronizar una inspección y reproducir su audio privado desde la app de campo | Pendiente |
| Bloquear/desbloquear y revisar comportamiento de sesión/permisos en el teléfono | Pendiente |
| BLE denegado/concedido y dispositivo real | Pendiente; UUIDs/firmware y emparejamiento en #8 |
| Keystore de distribución, APK interno/AAB y restauración de backups | Preparación incluida; ejecución pendiente de recursos y aceptación |
| Nueva aceptación y distribución Apple | En espera por decisión del usuario |

#15 permanece abierto hasta completar sus criterios Android o acordar explícitamente su separación. La confirmación del APK de demo no cierra los criterios de cuentas reales, firma, recuperación ni hardware. Este bloque no inicia #8, #16 ni #25.
