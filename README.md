# Apisense Smart Apiary App

Apisense es una aplicación multiplataforma para el seguimiento de apiarios y colmenas, desarrollada con **Expo, React Native y TypeScript para Web, Android e iOS**. Reúne telemetría de sensores, grabaciones acústicas y observaciones del apicultor en una misma bitácora.

Su enfoque es **offline-first**: guarda los cambios en SQLite y prepara su sincronización con Supabase cuando hay conexión. Los adaptadores BLE y MQTT permiten integrar micrófonos IoT; el análisis acústico genera resúmenes orientativos en español. Las reglas actuales son experimentales y no constituyen un diagnóstico de la colmena.

## Estado del proyecto

La implementación local está en la rama [`feat/screens-implementation`](https://github.com/Juulren/apisense/tree/feat/screens-implementation), disponible para revisión en el [PR #19](https://github.com/Juulren/apisense/pull/19). **Todavía no está integrada en `main` ni desplegada en producción.** Para ejecutar la app, utiliza esa rama como se indica abajo.

El trabajo se organiza por Issues y se revisa por bloques. El [plan de implementación](https://github.com/Juulren/apisense/blob/feat/screens-implementation/IMPLEMENTATION_PLAN.md) registra lo implementado, las verificaciones realizadas y los pendientes.

La app incluye onboarding y acceso, dashboard, lista y mapa de colmenas, detalle y bitácora, monitor acústico, historial, vinculación de dispositivos, inspecciones manuales y ajustes. El modo demo contiene ocho colmenas y datos sintéticos para recorrer estos flujos sin servicios externos.

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
git switch feat/screens-implementation
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
EXPO_PUBLIC_SUPABASE_ANON_KEY=TU_CLAVE_PUBLICA_ANON
EXPO_PUBLIC_MQTT_URL=wss://TU_BROKER
EXPO_PUBLIC_BLE_SERVICE_UUID=TU_UUID_DE_SERVICIO
EXPO_PUBLIC_BLE_CHARACTERISTIC_UUID=TU_UUID_DE_CARACTERISTICA
```

Reinicia Expo después de cambiar la configuración. Los valores `EXPO_PUBLIC_*` se incluyen en el cliente: utiliza únicamente la clave pública de Supabase y no coloques contraseñas, claves `service_role` ni secretos del servidor en estas variables. Las credenciales MQTT se introducen en el flujo de conexión y se mantienen en memoria.

La conexión con Supabase requiere aplicar las migraciones, políticas RLS, bucket privado y funciones de la carpeta `supabase/`. Elegir y validar ese backend es un bloque pendiente en el [Issue #13](https://github.com/Juulren/apisense/issues/13); rellenar `.env` por sí solo no configura el servidor. Los UUIDs BLE y el broker deben corresponder al firmware y a las políticas de acceso del dispositivo, pendientes en el [Issue #8](https://github.com/Juulren/apisense/issues/8).

### Cifrado y acceso offline

En las cuentas reales, la implementación nativa utiliza SQLCipher y SecureStore. La versión web cifra las copias locales con AES-GCM y solicita una clave local de al menos 16 caracteres, distinta de la contraseña de Supabase. Esa clave no se guarda: perderla impide recuperar los datos locales sin sincronizar.

El acceso web real requiere HTTPS o localhost y un navegador con Web Crypto, IndexedDB y Web Locks. El hosting debe servir las cabeceras de aislamiento incluidas en `public/_headers`; el servidor `npm run preview` ya las configura. La demo utiliza un almacén separado de datos sintéticos.

La validación del cifrado en dispositivos, la integración cloud y la revisión de dependencias siguen abiertas. Consulta la [arquitectura de seguridad](https://github.com/Juulren/apisense/blob/feat/screens-implementation/docs/SECURITY_ARCHITECTURE.md) y el [plan](https://github.com/Juulren/apisense/blob/feat/screens-implementation/IMPLEMENTATION_PLAN.md) antes de usar datos reales o preparar una publicación.

## Comprobar el proyecto

En la rama de implementación:

```bash
npm run typecheck
npm test
npm run build:web
```

El [reporte de validación](https://github.com/Juulren/apisense/blob/feat/screens-implementation/docs/VALIDATION.md) documenta las comprobaciones realizadas y sus límites. La integración física BLE/MQTT y un modelo acústico entrenado y validado todavía requieren recursos y pruebas adicionales.

## Organización del código

| Ruta | Contenido |
| --- | --- |
| `src/app/` | Pantallas y navegación con Expo Router |
| `src/components/` | Componentes de interfaz |
| `src/db/` | SQLite, almacenamiento local y sincronización |
| `src/services/iot/` | BLE, MQTT y simulación de audio |
| `src/services/ai/` | Extracción acústica, reglas y adaptadores de inferencia |
| `supabase/` | Migraciones, políticas y funciones del backend |
| `design-reference/` | Referencias visuales del diseño |

Estas carpetas están disponibles en la rama de implementación; `main` incorpora el código conforme se revisan e integran los PR.
