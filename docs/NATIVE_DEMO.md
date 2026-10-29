# Demo Android/iOS independiente de Metro

La demo usa datos sintéticos, SQLCipher y SecureStore. No necesita Supabase, un broker, Bluetooth, claves de mapas ni un modelo entrenado. Su identificador nativo es `com.apisense.demo`, separado de la app de campo `com.apisense.app`.

## Estado y límites

Integrada en `main` mediante el [PR #30](https://github.com/Juulren/apisense/pull/30), después de #26 y #29, con autorización del usuario el 28 de octubre de 2026. **La demo pasó el recorrido completo en Android Emulator e iOS Simulator el 27 de octubre de 2026.** Ambos verificaron entrada, reproducción y parada de audio, mapa local, guardado de inspección, cierre/reapertura con inspección persistente y salida.

| Plataforma | Compilación Release | Prueba nativa final | Artefacto validado |
| --- | --- | --- | --- |
| Android | [40372388813, app `bdceeca`](https://github.com/Juulren/apisense/actions/runs/40372388813) | [Maestro correcto, sin red](https://github.com/Juulren/apisense/actions/runs/40532601817/job/122289569881) | [APK, capturas, JUnit y logs](https://github.com/Juulren/apisense/actions/runs/40532601817/artifacts/12747660284) |
| iOS Simulator | [40522176345, `f2fa9a9`, identidad incorporada por Xcode](https://github.com/Juulren/apisense/actions/runs/40522176345) | [Maestro correcto](https://github.com/Juulren/apisense/actions/runs/40532601817/job/122289569631) | [App, capturas, JUnit y logs](https://github.com/Juulren/apisense/actions/runs/40532601817/artifacts/12747646325) |

La comprobación final del flujo `7cc9a80` reutilizó esos binarios: los cambios posteriores a sus compilaciones afectan a CI, pruebas y documentación. El APK también se instaló y abrió en el emulador Android local de Windows; su dashboard quedó verificado visualmente. TypeScript y las 49 pruebas locales/CI son correctos. El 28 de octubre el usuario confirmó que el APK funciona en Android; no se aportaron modelo, versión del sistema ni resultados de un protocolo físico completo. La aceptación de dispositivos físicos, cuentas reales y producción mantiene los criterios restantes de #15/#8/#25.

La primera ejecución detectó que ONNX 1.24.3 usaba `VersionNumber`, retirado en Gradle 9, y que el Xcode seleccionado por defecto tenía Swift 6.1 mientras Expo requería 6.2. `npm ci` aplica ahora un parche nativo acotado a esa versión de ONNX, que reutiliza su comparación numérica existente; no es el antiguo parche de SQLite web. La compilación iOS usa Xcode 26.2.

El diagnóstico iOS del [mismo binario](https://github.com/Juulren/apisense/actions/runs/40517775737) confirmó `errSecMissingEntitlement` (`-34018`): desactivar la firma en `xcodebuild` omitía la identidad que exige Keychain. El workflow prepara `application-identifier` y `keychain-access-groups` en el proyecto generado de demo y permite que Xcode los incorpore al enlazar para iOS Simulator. No usa una cuenta Apple ni habilita distribución a dispositivos físicos. Conserva el acceso mediante SecureStore y SQLCipher, sin alternativa de almacenamiento en texto plano. Apple documenta cómo [la identidad de la app determina su acceso al Keychain](https://developer.apple.com/documentation/security/sharing-access-to-keychain-items-among-a-collection-of-apps).

La preparación de cada prueba instala o reinicia únicamente `com.apisense.demo`. En iOS se desinstala e instala el binario mediante `simctl`, sin `clearState` de Maestro: ese comando [reinstala una copia de la app](https://docs.maestro.dev/reference/commands-available/clearstate), que no conservaba correctamente la firma del simulador en la prueba. El recorrido conserva la comprobación de persistencia entre cierres y reaperturas, sin reiniciar datos en ese punto.

El APK Android de demo y el archivo `.app` para iOS Simulator incluyen el JavaScript y los recursos locales en configuración Release. No requieren un servidor Metro ni Expo Go. El APK usa la firma de desarrollo del template, apropiada para esta demo; no es una publicación de producción. La app iOS de simulador no se instala en un iPhone físico: esa entrega requiere firma y aprovisionamiento de Apple.

## Obtener e instalar

En GitHub abre la ejecución de **Native demo** y revisa el resultado de la plataforma antes de descargar sus artefactos (requiere iniciar sesión para descargar):

- `apisense-demo-android`: contiene `app-release.apk`, logs y resultados Android. Instala el APK en Android, autorizando la instalación desde ese origen, o usa `adb install -r app-release.apk`.
- `apisense-demo-ios-simulator`: contiene `ApisenseDemo-simulator.zip`, logs y resultados iOS. En un Mac, descomprime y arrastra `ApisenseDemo.app` a un simulador abierto de Xcode. También puedes usar `xcrun simctl install booted ApisenseDemo.app`.

Los artefactos se conservan 14 días. No son releases en las tiendas. Su disponibilidad depende de que termine correctamente la compilación correspondiente.

### APK Android entregado

La copia local está en `dist/demo/Apisense-Demo-0.1.0.apk`, junto con `LEEME.txt` y su archivo `.sha256`. Se obtuvo del [artefacto Android validado](https://github.com/Juulren/apisense/actions/runs/40372388813/artifacts/12675097696). Requiere Android 7.0 o posterior (API 24) y arquitectura ARM64 o x86_64; no incluye ARM de 32 bits. Pesa 165607637 bytes. Su SHA-256 es:

```text
ec17d140637df088a60a8dcbe353a7d0041419cfe18f403cb4711d1309b6b601
```

Transfiere el APK al teléfono, ábrelo y autoriza la instalación desde ese origen cuando Android lo solicite. Abre **Apisense Demo → Entrar a la demo**. No se necesitan credenciales, Expo Go ni un servidor local. Los binarios y las herramientas locales están excluidos de Git.


### iOS Simulator entregado

La copia local está en `dist/demo/Apisense-Demo-iOS-Simulator.zip`, junto con `LEEME-iOS-Simulator.txt` y su checksum. Descomprime el archivo en un Mac y arrastra `ApisenseDemo.app` a un simulador abierto. El ZIP pesa 51508427 bytes; su SHA-256 es:

```text
812604115681e5066f5d28529dd56f1239367fa1e379dc62916e59a2a4cea08e
```

No es una IPA para iPhone físico. La identidad de simulador se limita al proyecto generado en CI y no sustituye el aprovisionamiento de Apple para dispositivos.

## Compilar en tu equipo

Con Node 24 y las herramientas nativas de la plataforma instaladas:

```bash
npm ci
npm run demo:android

# En macOS con Xcode y CocoaPods:
npm run demo:ios
```

Estos comandos generan el proyecto con el identificador de demo y compilan Release sin iniciar Metro. Pueden solicitar seleccionar un emulador/simulador o dispositivo. El comando iOS solo puede ejecutarse en macOS; para un iPhone físico también se necesita configurar la firma.

El wrapper usa `EXPO_PUBLIC_DEMO_ONLY=1`, desactiva la carga de `.env` y elimina los valores de conexión de servicios del entorno de compilación. La app no crea un cliente Supabase ni ofrece acceso de cuentas reales. El modo normal de desarrollo sigue usando `npm run android`/`npm run ios`. Si cambias de demo a la app de campo, regenera antes su proyecto nativo con `npx expo prebuild --platform android` o `npx expo prebuild --platform ios`, respectivamente, para recuperar su identificador.

## Recorrido de aceptación

1. Abre **Apisense Demo** y pulsa **Entrar a la demo**.
2. Comprueba las ocho colmenas, micrófonos, muestras y resúmenes sintéticos.
3. En **Acústica**, reproduce y detén un WAV. La etiqueta de reproducción refleja el estado del reproductor nativo; no indica un diagnóstico biológico.
4. En **Inicio → Ver lista / mapa → Mapa**, revisa el esquema local del apiario. Es ilustrativo, no cartografía descargada.
5. Abre una colmena, anota una inspección y vuelve a su bitácora.
6. Cierra completamente y vuelve a abrir la app, entra a la demo y comprueba que la inspección permanece.
7. En **Ajustes**, cambia tema o intervalo. **Salir de la demo** vuelve a la portada y conserva los datos locales para la siguiente entrada.

El simulador de la pantalla Acústica permite generar más patrones WAV. Los datos permanecen en la base de demo y no sincronizan. La reproducción no solicita permiso de micrófono: esta app escucha clips recibidos o sintéticos y no graba el micrófono del teléfono. BLE/MQTT reales siguen fuera de la demo.

`.maestro/demo.yaml` automatiza entrada, navegación, reproducción, mapa, inspección, reapertura y salida en Android Emulator e iOS Simulator. En Android, la prueba desactiva Wi-Fi y datos del emulador antes de abrir la app. Las capturas de dispositivos virtuales, los resultados JUnit y los logs se conservan junto con los binarios. Las pruebas físicas, tiendas, hardware, cuentas reales y validación científica mantienen sus pendientes en #15/#8/#25.
