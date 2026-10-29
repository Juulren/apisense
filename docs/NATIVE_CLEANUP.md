# Retirada del soporte web — Issue #27

El producto se entrega en Android e iOS con Expo/React Native. La configuración y las fuentes del PR #26 y esta limpieza del PR #29 están integradas en `main`, junto con la demo del PR #30.

## Inventario y resultado

| Elementos anteriores                                                                                | Resultado                                                                                                                                                                          |
| --------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| IndexedDB, snapshots AES-GCM, PBKDF2 y Web Locks; pruebas y controles del catálogo                  | Retirados junto con la frase local exclusiva de navegador.                                                                                                                         |
| `openRepository.native.ts`, `BleTransport.native.ts`, `ApiaryMap.native.tsx`, `OnnxModel.native.ts` | Conservados como implementación principal con sus nombres sin `.native`; se retiran los fallbacks web. SQLCipher/SecureStore, BLE, Maps y ONNX nativo mantienen su comportamiento. |
| `ClipStore.native.ts`                                                                               | Retirado el reexport duplicado. `ClipStore.ts` sigue usando `InlineClipStore`, necesario en nativo para conservar audio dentro de SQLCipher.                                       |
| ONNX web/WASM, mapa iframe y registro de service worker                                             | Retirados. El mapa de campo usa `react-native-maps`; la demo del PR #30 usa un esquema SVG offline y reglas acústicas sin modelo externo.                                                                                  |
| Scripts de preview, shell/cache offline y parche de SQLite web; `public/_headers`                   | Retirados junto con las cabeceras COOP/COEP y el asset WASM añadido en Metro.                                                                                                      |
| `onnxruntime-web`, `react-native-web`, `react-dom` directos                                         | Retirados; el lockfile elimina 33 paquetes sin actualizar versiones de los restantes.                                                                                              |
| `react-dom` transitivo y `@expo/metro-runtime`                                                      | Conservados porque Expo Router/Radix aún los requieren. Su presencia transitiva no habilita un producto web. No se fuerza su exclusión.                                            |
| NativeWind/CSS, Supabase, MQTT/WSS, clips inline, referencias HTML/PNG de Stitch                    | Conservados: sirven a los clientes nativos, al backend o al diseño.                                                                                                                |
| Evidencias de navegador de entregas anteriores                                                      | Conservadas y marcadas como históricas; los enlaces al código retirado apuntan al commit original.                                                                                 |

Los tokens de Auth se guardan exclusivamente en SecureStore y `detectSessionInUrl` queda desactivado. El acceso offline utiliza la sesión del dispositivo. La app conserva el arranque, el modo demo, las inspecciones, la cola y la sincronización compartidos. No se cambian migraciones, servicios remotos ni credenciales.

La CI se ejecuta también para PR con base distinta de `main`, de modo que esta entrega dependiente pueda tener el mismo check `app` antes de integrar su base.

## Evidencia y aceptación

- TypeScript estricto y 49 pruebas locales: 41 conservadas, 6 exclusivas de web retiradas y 8 nuevas que comprueban el contrato de almacenamiento nativo y la demo.
- La prueba de demo crea ocho colmenas, micrófonos, clips y resúmenes sin red, decodifica un WAV y verifica una inspección tras reabrir SQLite sin duplicar las muestras.
- Las pruebas del punto de entrada nativo comprueban el rechazo si falta SQLCipher y la gestión de claves con dobles de las APIs nativas. No prueban cifrado real.
- Bundles JavaScript/Hermes Android e iOS correctos. No equivalen a compilaciones Gradle/Xcode ni ejecución en dispositivos.
- Auditoría del 26 de octubre: 0 críticas y 5 entradas high (node-forge y zod como avisos raíz). Es una observación actual, no una corrección de seguridad atribuida a esta limpieza; #16 conserva su evaluación.
- Referencias de Stitch verificables offline; los originales permanecen intactos.

### Pendiente antes de cerrar #27

Las compilaciones Release y los recorridos completos de demo Android Emulator/iOS Simulator pasaron en [Native demo](https://github.com/Juulren/apisense/actions/runs/40532601817). El APK se instaló y abrió en el emulador Windows con SDK/adb; el usuario confirmó también que funciona en Android. iOS se compiló y ejecutó en un runner macOS. La [guía de demo](NATIVE_DEMO.md) conserva artefactos, checksums y límites.

#27 sigue abierto por las pruebas de acceso/cifrado, permisos y sincronización con cuentas reales y dispositivos físicos, coordinadas con #15/#8. La firma/distribución de producción, hardware y modelo siguen pendientes. La revisión e integración de la limpieza ya están completadas.

Las redirecciones históricas del backend de desarrollo siguen registradas en `supabase/config.toml`. #15 debe definir y probar confirmación/retorno a enlaces nativos antes de cambiar esa configuración remota. Esta limpieza no despliega Supabase ni prepara hosting frontend.
