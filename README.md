# Apisense Smart Apiary App

Apisense es una aplicación multiplataforma para el seguimiento de apiarios y colmenas, desarrollada con **Expo, React Native y TypeScript para Web, Android e iOS**. Reúne telemetría de sensores, grabaciones acústicas y observaciones del apicultor en una misma bitácora.

Su enfoque es **offline-first**: guarda los cambios en SQLite y prepara su sincronización con Supabase cuando hay conexión. Los adaptadores BLE y MQTT permiten integrar micrófonos IoT; el análisis acústico genera resúmenes orientativos en español. Las reglas actuales son experimentales y no constituyen un diagnóstico de la colmena.

## Estado del proyecto

La implementación está consolidada en **`main`** mediante el [PR #21](https://github.com/Juulren/apisense/pull/21). Incluye las pantallas y el backend de Supabase, instalado y probado en el proyecto de desarrollo. **La app todavía no está publicada en producción.**

El trabajo se organiza en el [tablero de Apisense](https://github.com/users/Juulren/projects/2): **Pendiente → En curso → En revisión → Terminado**. Cada tarea parte de `main`, usa una rama temporal y se integra tras revisión y checks. Consulta [cómo colaborar](CONTRIBUTING.md) y el [plan de implementación](IMPLEMENTATION_PLAN.md) para ver los avances y pendientes.

La app incluye onboarding y acceso, dashboard, lista y mapa de colmenas, detalle y bitácora, monitor acústico, historial, vinculación de dispositivos, inspecciones manuales y ajustes. El modo demo contiene ocho colmenas y datos sintéticos para recorrer estos flujos sin servicios externos.

Los 11 IDs originales de Stitch están identificados en el [mapa de diseño](DESIGN_MAP.md), con [contexto del producto](docs/DESIGN_CONTEXT.md) y [procedencia reproducible](docs/STITCH_PROVENANCE.md). Corresponden a cinco familias claro/oscuro y una spec; varias etiquetas del brief inicial eran incorrectas. La aceptación visual de las vistas adaptadas sigue en el [Issue #25](https://github.com/Juulren/apisense/issues/25). Con Python 3 puedes verificar las referencias mediante `python scripts/verify_stitch_references.py`; Python no se necesita para ejecutar la app.

## Requisitos

- **Node.js 24** y npm.
- Git para descargar el repositorio.
- Para Android: Android Studio, Android SDK, JDK y un emulador o dispositivo configurados para compilar con Expo.
- Para iOS: macOS, Xcode y un simulador o dispositivo configurado para desarrollo.

La demo no necesita credenciales de Supabase, broker MQTT, dispositivos BLE ni un modelo de IA.

## Descargar y ejecutar en Web

```bash
git clone https://github.com/Juulren/apisense.git
cd apisense
git switch main
npm ci
npm run web
```

Abre la URL que indique Expo y selecciona **Probar modo demo**. Si ya tienes el repositorio descargado, guarda tus cambios antes de cambiar de rama y ejecuta `git fetch origin` para actualizar las referencias.

Para comprobar la versión web exportada, con el servidor local que configura las cabeceras necesarias para SQLite:

```bash
npm run build:web
npm run preview
```

Abre [http://localhost:4173](http://localhost:4173). Después de la primera carga, el service worker permite abrir la interfaz sin conexión; los mapas externos siguen necesitando red.

## Ejecutar en Android e iOS

Después de descargar la rama e instalar las dependencias, ejecuta el comando de tu plataforma:

```bash
# Android
npm run android

# iOS: requiere macOS y Xcode
npm run ios
```

Estos comandos generan y ejecutan la compilación nativa de desarrollo. **Expo Go no es compatible con los módulos nativos utilizados**, entre ellos SQLCipher, BLE y ONNX Runtime.

Las exportaciones JavaScript de ambas plataformas se han verificado; la compilación y ejecución de APK/IPA y las pruebas en dispositivos físicos siguen pendientes en el [Issue #15](https://github.com/Juulren/apisense/issues/15).

## Configuración de servicios reales

Para probar cuentas y servicios propios, copia `.env.example` como `.env` en la raíz de la rama de implementación y completa los valores que correspondan:

```dotenv
EXPO_PUBLIC_SUPABASE_URL=https://TU_PROYECTO.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=TU_CLAVE_PUBLICA_PUBLISHABLE_O_ANON
EXPO_PUBLIC_MQTT_URL=wss://TU_BROKER
EXPO_PUBLIC_BLE_SERVICE_UUID=TU_UUID_DE_SERVICIO
EXPO_PUBLIC_BLE_CHARACTERISTIC_UUID=TU_UUID_DE_CARACTERISTICA
```

Reinicia Expo después de cambiar la configuración. Los valores `EXPO_PUBLIC_*` se incluyen en el cliente: utiliza únicamente la clave pública de Supabase y no coloques contraseñas, claves `service_role` ni secretos del servidor en estas variables. Las credenciales MQTT se introducen en el flujo de conexión y se mantienen en memoria.

La URL y la clave pública se obtienen desde **Connect** en el proyecto de Supabase. Aunque la variable se llama `ANON_KEY`, acepta la clave Publishable actual. `.env` está excluido de Git; no subas sus valores.

En el proyecto de desarrollo ya se aplicaron las migraciones, RLS en las seis tablas, el bucket privado y la función con cron. Para otro proyecto, sigue [la guía de backend](docs/SUPABASE.md). Puedes comprobar tu configuración sin mostrar las claves con:

```bash
npm run backend:check
```

El cron procesa una cola con lotes de diez colmenas, reservas temporales y reintentos. Las muestras se recorren por páginas de 200, sin el anterior corte de 1000 clips. Las solicitudes manuales sin `hive_id` devuelven hasta 50 colmenas y un `next_hive_id` para continuar con `after_hive_id`.

Los UUIDs BLE y el broker deben corresponder al firmware y a las políticas de acceso del dispositivo, pendientes en el [Issue #8](https://github.com/Juulren/apisense/issues/8).

### Cifrado y acceso offline

En las cuentas reales, la implementación nativa utiliza SQLCipher y SecureStore. La versión web cifra las copias locales con AES-GCM y solicita una clave local de al menos 16 caracteres, distinta de la contraseña de Supabase. Esa clave no se guarda: perderla impide recuperar los datos locales sin sincronizar.

El acceso web real requiere HTTPS o localhost y un navegador con Web Crypto, IndexedDB y Web Locks. El hosting debe servir las cabeceras de aislamiento incluidas en `public/_headers`; el servidor `npm run preview` ya las configura. La demo utiliza un almacén separado de datos sintéticos.

`npm ci` aplica una corrección local del worker de `expo-sqlite` 57.0.4 para que las bases en memoria no retengan handles del almacenamiento persistente entre pestañas. Si omites los scripts de instalación, ejecuta `node scripts/patch-expo-sqlite.mjs` antes de compilar. Al actualizar Expo se debe revisar esta corrección; consulta la [prueba del almacén entre pestañas](docs/WEB_STORAGE_QA.md).

La integración cloud se comprobó con dos cuentas temporales: aislamiento de las seis tablas, rechazo de escrituras ajenas, audio privado y resúmenes idempotentes. Las conexiones de la app con Supabase usan HTTPS y el secreto cron está en Vault y en los secretos de la función. El backend autorizado necesita leer los clips para analizarlos; este diseño no proporciona cifrado de extremo a extremo frente al servidor.

La validación del cifrado en dispositivos y la revisión de dependencias siguen abiertas. Consulta la [arquitectura de seguridad](docs/SECURITY_ARCHITECTURE.md) y el [plan](IMPLEMENTATION_PLAN.md) antes de preparar una publicación.

## Comprobar el proyecto

En la rama de implementación:

```bash
npm run typecheck
npm test
npm run build:web
```

El [reporte de validación](docs/VALIDATION.md) y la [evidencia del backend](docs/SUPABASE.md) documentan las comprobaciones y sus límites. `npm test` ejecuta pruebas locales sin credenciales; `npm run test:backend:live` requiere configuración de servidor local y crea y elimina cuentas y datos temporales en Supabase. La integración física BLE/MQTT y un modelo acústico entrenado y validado todavía requieren recursos y pruebas adicionales.

## Organización del código

| Ruta                | Contenido                                               |
| ------------------- | ------------------------------------------------------- |
| `src/app/`          | Pantallas y navegación con Expo Router                  |
| `src/components/`   | Componentes de interfaz                                 |
| `src/db/`           | SQLite, almacenamiento local y sincronización           |
| `src/services/iot/` | BLE, MQTT y simulación de audio                         |
| `src/services/ai/`  | Extracción acústica, reglas y adaptadores de inferencia |
| `supabase/`         | Migraciones, políticas y funciones del backend          |
| `design-reference/` | Referencias visuales del diseño                         |

Estas carpetas están disponibles en `main`. Para contribuir, sigue [CONTRIBUTING.md](CONTRIBUTING.md).
