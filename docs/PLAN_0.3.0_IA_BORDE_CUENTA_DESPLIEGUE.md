# Plan 0.3.0 — IA en el borde, cuenta de usuario y app desplegable

Fecha: 2026-11-09. Estado: **BORRADOR PARA APROBACIÓN. Nada de esto se ejecuta hasta que el dueño lo apruebe.**
Revisado por el asesor (Opus) el 2026-11-09; las correcciones están incorporadas.
Base: rama `claude/multi-model-workflow-setup-e3ecba` (0.2.0 + navbar M3 en progreso).

Fuentes: el tablero FigJam «Proyecto ganadería equipo 2» (leído en solo lectura el 2026-11-09; ids de nodo entre corchetes), el código actual y la guía de Material 3. Donde algo no pudo verificarse se dice. Convención: **«decidido»** = ya lo dijiste tú; **«propuesta»** = necesita tu aprobación.

---

## 1. Qué dice el Figma (resumen fiel)

**Producto.** *Apisense*: sistema móvil offline-first para gestión, inspección y protección preventiva de apiarios. Clienta piloto: Damaris (negocio Damaabeja, con base en Chuburná/Mérida [31:7, 22:74]); **su apiario está entre Tixpéhual y Tixkokob** [347:872] (de ahí dependen la ubicación y el clima de la app). Equipo 2: Julio (diseño/programación) y Saúl (programación/enlace). Duración 07/09/2026–23/04/2027, en dos incrementos: (1) app offline-first, (2) hardware IoT + IA acústica [361:877, 362:1920].

**Problema real.** Plagas (escarabajos) que mata a mano porque no puede usar químicos; terreno sin electricidad ni señal; poco tiempo entre semana [49:74, 347:872]. *(Nota: los resultados de la encuesta del tablero [363:1948] están marcados como valores de referencia por sustituir; no se usan como evidencia.)*

**IA en el borde** [183:731, 183:700, 368:5294-5297]:
- El nodo **despierta cada 10–15 min, graba 5–8 s, procesa y vuelve a dormir** (no procesa audio continuo).
- **No se da audio crudo a la IA**: se extraen **MFCC** (o espectrograma) en el propio microcontrolador.
- **TinyML**: CNN ligera o detector de anomalías, con Edge Impulse o TensorFlow Lite Micro; el tablero estima < 100 KB de flash (estimación, no medida).
- **Salidas**: 0 normal · 1 enjambrazón · 2 huérfana · 3 intrusión/ataque · 4 anomalía no identificada.
- **Transmisión**: mensaje de 5 bytes por LoRaWAN; alternativa documentada [188:779]: **gateway local** en el apiario (BLE/WiFi local al celular, sincroniza a la nube al volver a señal).
- **CU07 «Recibir alerta acústica»** [368:5294-5297, 368:5303]: el sensor envía el código por BLE/MQTT; el sistema registra la alerta y notifica; la apicultora ve **tipo, confianza y «cómo actuar»**; puede **escuchar la muestra** (CU08) o **descartar como falsa alarma (sirve para reentrenar)**; sin conexión el sensor guarda la alerta en un búfer SD y reintenta.
- Enumeraciones del UML [368:5732-5741]: `TipoAlerta` = ZUMBIDO_ATIPICO · PLAGA_PROBABLE · PERDIDA_REINA · ESTRES_CALOR; `EstadoColmena` = TRANQUILA · ATENCION · CRITICA; `TipoConexion` = MQTT · LORAWAN.
- Hardware: **INMP441 (I2S)**, ESP32-S3/XIAO ESP32S3 recomendado [183:700]; panel solar 5 V, TP4056/TP5000, 18650 o LiFePO4 [266:730]. Datasets citados: NU-Hive y Hiveeyes [183:731].
- Avance real (4–5/nov): ESP32 DevKit V1 + INMP441 capturando por I2S con ruido por falta de soldadura; pendiente soldar y guardar WAV en MicroSD [409:2948].
- Pendientes declarados [432:2949]: firmware, UUID reales, cifrado GATT, broker WSS con ACL probada con dos cuentas, calibración SPL, modelo ONNX entrenado, rendimiento en Android real. **La app no confirma reina, plagas ni enjambrazón.**

**Datos y funciones del MVP** [152:528-529, 156:745, 368:4965-5104]: RF01 apiarios/colmenas, RF02 inspección, **RF03 hallazgos y tratamientos**, RF04 offline sin duplicados, RF05 historial, **RF06 alertas/recordatorios locales**, RF07 pendientes. Modelo: APIARIO › COLMENA › INSPECCION › HALLAZGO › TRATAMIENTO, CATEGORIA_HALLAZGO, USUARIO, rol Administrador. Auth con **Supabase Auth**, correo+contraseña y modo sin conexión con la última sesión (**CU01 «Iniciar sesión»** [368:4882]; ojo: en la lista de requisitos [152:529] «CU01» es *Registrar inspección*: **el tablero tiene dos numeraciones de casos de uso que conviene alinear**). Wireframes: «¿Olvidaste tu contraseña?» [367:4424], «¿No tienes cuenta? Regístrate» [367:4430], «Notificaciones de alertas» [367:4756], temperatura/humedad/batería en Diagnóstico, y en inspección: estado, «¿Se vio la reina?», «+ Agregar hallazgo» y foto.

**Principios de diseño citados** (NN/g 2025): guía de patrones, heurísticas, menús contextuales [170:656, 170:760, 170:776].

## 2. Diferencias entre el Figma y la app

| Tema | Figma | App hoy | Qué hacer |
|---|---|---|---|
| **Dónde corre la IA** | En el nodo (TFLite Micro), manda un código | ONNX en el teléfono a partir de un vector MFCC de 13 valores | **Híbrido** (§3) |
| **Clases** | normal/enjambrazón/huérfana/intrusión/anomalía (tablero) vs ZUMBIDO_ATIPICO/PLAGA_PROBABLE/PERDIDA_REINA/ESTRES_CALOR (UML) | `audio_samples` ya guarda clase, confianza y versión del clasificador por muestra, con **CHECK fijo de 5 clases** (core.sql) y el orden fijado por el contrato de modelo | **Una sola taxonomía**; cambiarla **no es una migración aditiva**: exige cambiar el CHECK local y remoto y subir la versión del contrato |
| **Stack documentado** | React Native + SQLite + **C# .NET Core + BD relacional**; una nota dice «app de Flutter» | Expo React Native + SQLCipher + **Supabase/Postgres** | **Pregunta para ti**: ¿actualizamos el tablero? |
| **Hallazgos y tratamientos (RF03)** | Sí, con categoría, severidad, foto y seguimiento | No existe | H3 |
| **Recordatorios (RF06)** | Sí | No existe (sin notificaciones) | H2 |
| **«Falsa alarma» → reentrenar** | Sí | No existe | H1 |
| **Temp./humedad/batería del nodo** | En Diagnóstico | Paquete v1 solo trae batería | Ampliar protocolo (H1) |
| **Cuenta** | Registro, «¿Olvidaste?», perfil implícito | Registro e inicio de sesión sí; sin restablecer ni perfil | H4 |
| **Roles** | Administrador hereda de Apicultora | Un solo rol | Diferir |

**Honestidad científica.** El tablero propone detectar **escarabajos** por sonido. La literatura acústica de colmenas se apoya sobre todo en reina ausente y enjambrazón; **no pude confirmar que el escarabajo sea detectable por audio**, y el propio tablero lo plantea como hipótesis con pruebas de campo [347:872]. Los datasets citados **no los verifiqué**, y la afirmación de «miles de horas» etiquetadas [183:731] **debe tratarse como no comprobada** (licencia, etiquetas y condiciones de grabación por revisar).

## 3. IA en el borde: diseño propuesto

### 3.1 Principios
1. **Sin diagnóstico**: salida = «variación acústica» con confianza y opción de abstenerse. La app no confirma reina, plagas ni enjambrazón (regla vigente).
2. **Híbrido**: el nodo emite un **veredicto de borde** (barato, para alertar); el teléfono conserva clip y MFCC para escuchar, verificar y reentrenar. **Regla de desacuerdo**: se muestran ambos; si difieren, el estado es «sin consenso» y nunca se escala sola la alerta; el veredicto del teléfono es segunda opinión, no corrección.
3. **Cada veredicto lleva procedencia** (modelo, versión, mapa de clases, confianza); sin ella no se muestra.
4. **El bucle de datos es parte del producto**.

### 3.2 Contrato de características (hay una decisión técnica real)
El contrato actual `apisense-mfcc-v1` **promedia los cuadros en un solo vector de 13 valores, sin eje de tiempo**. Una CNN como la del tablero necesita entrada 2-D (cuadros × coeficientes). Dos caminos:
- **A. Mantener v1**: clasificador pequeño (MLP/GMM) sobre el vector promedio. Cabe de sobra en un ESP32 y coincide con la app; pierde información temporal (p. ej. el «zumbido lloroso» cambia en el tiempo).
- **B. Contrato v2** con secuencia de MFCC (más expresivo): obliga a versionar contrato, validador, ONNX, firmware y dataset a la vez.
- **Edge Impulse** trae su propio bloque MFCC (pre-énfasis, ventanas propias): **no coincide con el cálculo de la app**; usar un bloque DSP propio o no usarlo.
- Sea cual sea: **una sola tasa de muestreo** fijada para firmware, WAV de la SD, app y entrenamiento (8 kHz o 16 kHz; las abejas tienen armónicos por encima de 500 Hz, así que 8 kHz hay que justificarlo con datos). Si no coinciden, la app se abstiene. **Paridad con vectores de referencia** entre firmware, app y entrenamiento.
- ESP32 DevKit V1 **no tiene PSRAM**: procesar por ventanas mientras se lee, nunca guardar los 5–8 s completos en memoria. INMP441: 24 bits en palabras de 32 → PCM16, quitar DC.

### 3.3 Protocolo y datos en la app
- **Paquete v2** (compatible con v1): `edge: { class, confidence, model_id, model_hash8, class_map_version }` + `temperature_c`, `humidity_pct` opcionales.
- **Entidad `alerts`** (hive_id, sample_id, kind, confidence, model_id, estado nueva/vista/falsa alarma/confirmada, handled_at) con RLS. *(Corrección: `audio_samples` ya guarda clase/confianza/versión; `alerts` añade el **ciclo de vida** y la retroalimentación, no reemplaza esos campos.)*
- **Pantalla Alertas** (wireframe «Notificaciones de alertas»): tipo, confianza, escuchar, falsa alarma, confirmar, programar visita.
- **LoRaWAN**: el mensaje de 5 bytes **no cabe con la procedencia** del §3.1 ni con UUID (usa 1 byte por colmena): requiere su propio códec binario, decodificador autenticado (webhook con secreto) y la banda de 915 MHz correspondiente (**confirmar US915/AU915 con el proveedor del gateway**). La lista de compras del tablero [409:2948, 296:918] **no incluye módulo LoRa ni gateway**.
- **Límite que hay que decir en voz alta**: sin LoRa o celular, las alertas por BLE **solo llegan al teléfono cuando Damaris está en el apiario**. El valor de «saber qué colmena necesita atención antes de ir» [363:2029] **no se cumple hasta tener un enlace de salida**.

### 3.4 Bucle de datos y entrenamiento
- **Etiquetas** desde el registro rápido, con cuidado: «reina no vista» **no** significa huérfana; usar **huevos/larvas jóvenes y celdas reales**. Las etiquetas «falsa alarma/confirmada» solo existen para muestras que alertaron (**sesgo de selección**): no sirven solas para medir el modelo.
- **Ventana de alineación** acotada (a definir; ±24 h arrastra ruido de manejo) y **excluir las muestras cercanas a la propia inspección**, porque abrir la colmena produce ruido que el tablero cuenta como «intrusión».
- Exportar con la herramienta existente (`model:prepare`/`model:evaluate`): licencia/procedencia, separación **por grupos** (apiario/colmena), sin fuga, normalización solo con entrenamiento.
- Entrenar fuera de la app; exportar **TFLite Micro int8** (nodo) y **ONNX** (teléfono) del **mismo** modelo, con manifiesto y vectores de referencia.
- **Aceptación sin cifra arbitraria**: métricas por clase, abstención/cobertura, calibración, resultados por apiario/dispositivo y revisión de errores. Sin «% de exactitud» sin prueba independiente.

### 3.5 Estación y ubicación
El sonido cambia con la temporada. Registrar **fase del calendario y temperatura** junto a cada muestra para poder analizarlo; no inventar una fase. **`ESTRES_CALOR` del UML importa en Yucatán**: la taxonomía debe conservarlo (como clase o como contexto de temperatura), no descartarlo.

### 3.6 Energía y campo
LiFePO4 mejor que LiPo por el calor; **muchos módulos TP4056 vienen sin el corte por temperatura (NTC) activado** y seguirían cargando Li-ion por encima de 45 °C dentro de la caja: usar cargador con sensor de temperatura. Carcasa con malla anti-propóleo y protección de lluvia/viento. Una colmena piloto (~1130–1400 MXN según el tablero), **sin contar** LoRa ni gateway.

### 3.7 Riesgos y lo que NO se afirma
Escarabajo por audio sin evidencia; falsas alarmas por lluvia, viento, aves, personas; dBFS ≠ SPL; cifrado BLE depende del firmware; datasets sin verificar; el mundo real difiere del banco (subespecie, caja, micrófono). Ninguna cifra de exactitud sin prueba independiente.

## 4. Cuenta y perfil (Supabase Auth + Postgres)

**Hoy**: `signUp` y `signInWithPassword` con PKCE; sesión en SecureStore. **Falta**: nombre, restablecer contraseña, cambio de datos, eliminar cuenta.

**Diseño (propuesta)**
- **Registro con *nombre***. **El nombre vive solo en la tabla `profiles`** (`id = auth.uid()`, `display_name`, timestamps), **no en `user_metadata`** (el usuario puede editarlo). Creada por *trigger* `security definer` con `search_path = ''`, **que nunca debe fallar** (un trigger que falla bloquea los registros); restricción de longitud/caracteres del nombre; **sin política de INSERT para el cliente** y UPDATE permitido solo sobre `display_name`; RLS: cada usuario lee/edita únicamente su fila.
- **Saludo** con `display_name`. «Perfil de campo» pasa a **«Mi perfil»**: nombre editable; correo visible; cambiar correo/contraseña **con reautenticación**.
- **Restablecer contraseña con código de 6 dígitos por correo** (`verifyOtp`, tipo `recovery`) y forzar la nueva contraseña antes de entrar: **evita el enlace profundo**, que otras apps pueden interceptar en esquemas personalizados, que exige App Links verificados (un `assetlinks.json` hospedado: choca con «sin sitio web») y que **falla con PKCE si el correo se abre en otro dispositivo**. Mensaje neutro para no revelar qué correos existen.
- **Verificación de correo**: es un **ajuste del proyecto de Supabase**, no código.
- **Cerrar sesión en todos los dispositivos**: los JWT siguen válidos hasta que expiran y los datos locales de un dispositivo sin red **no se borran solos**; se documenta.
- **Eliminar cuenta**: `apiaries.user_id` referencia `auth.users` **sin `ON DELETE`**, así que borrar el usuario falla. La función de borde debe: verificar el JWT, **exigir reautenticación reciente**, borrar los objetos de `hive-audio`, borrar filas **de hijos a padres**, y entonces el usuario de Auth. El dispositivo debe **borrar la base SQLCipher y su llave** y avisar que lo no sincronizado se pierde.
- **Offline**: perfil guardado cifrado localmente; ediciones sin red quedan en la cola.
- **Pruebas**: RLS entre dos cuentas (un usuario no lee el perfil de otro), trigger que no bloquea registros, borrado en cascada.
- **Requiere tu acción en el panel de Supabase** (SMTP/plantillas en español, política de contraseñas y protección contra contraseñas filtradas, límites de intentos, URLs de redirección): no se hace sin tu autorización. MFA: **pregunta**, no decisión.

## 5. Interfaz: guías reales, responsividad y accesibilidad

**Navbar (en progreso)**: reescrito según **Material 3 Navigation bar** (fuentes oficiales): destino completo como área táctil (~80 dp, ≥ 48 dp), indicador **64×32 dp**, icono 24 dp, etiqueta 12 sp de una línea, estado de pulsado dibujado **sobre la píldora** (no un ripple cuadrado). Verificado por tipos, 222 pruebas y empaquetado; **aún sin verlo en emulador ni teléfono**.

**Propuesta**
1. **Sistema de diseño documentado** (los tokens ya existen): escala tipográfica, espaciado 4/8, radios, tonos para claro/oscuro, estados de cada componente. Basado en M3 y en las heurísticas/patrones de NN/g que cita el tablero.
2. **Responsividad pensada para teléfono**: ancho máximo y márgenes por clase de tamaño (compacta < 600 dp, media 600–839, expandida ≥ 840), horizontal, y fuente grande. **Riel de navegación y dos paneles quedan diferidos** (tablets): hoy el uso es en teléfono.
3. **Estados vacío/carga/error/reintento** en cada lista y formulario; validación junto al campo; conservar lo escrito tras un error. La lista de colmenas del dashboard usa mosaicos muy altos: pasar a una lista virtualizada más compacta.
4. **Accesibilidad**: contraste 4.5:1 / 3:1, texto hasta 200 %, etiquetas/roles/estados, no depender solo del color, **TalkBack real** (pendiente desde #25).
5. **Vocabulario único** (hoy «inspección/observación/registro») y actualizar los flujos Maestro que dependen de los textos.
6. **Ajustes por grupos**: Mi perfil · Mi apiario · Apariencia · Sincronización · Sensores · Avanzado.

## 6. Despliegue

> **El alcance de firma, copias de seguridad y publicación está pausado por ti (#15 y #27).** Esta sección es solo propuesta; ejecutarla exige levantar esa pausa. El «respaldo» y la exportación también quedan aquí.

- Entornos **desarrollo / pruebas / producción** (proyectos de Supabase distintos; variables por perfil de EAS). **Los proyectos gratuitos de Supabase se pausan por inactividad.**
- **Firma** con keystore propio fuera del repositorio; **pista interna de Google Play**. *(Verificar la política vigente: las cuentas personales nuevas han exigido una prueba cerrada con varios probadores durante ~14 días antes de producción.)*
- **Privacidad (a corregir respecto del borrador)**: la app **sincroniza a Supabase las coordenadas exactas del apiario y el audio**; a Open-Meteo solo van coordenadas redondeadas. Google Play pide **URL pública de política de privacidad y un enlace web para eliminar la cuenta**: **ambos chocan con «sin sitio web»** y requieren decisión tuya.
- CI con puertas (tipos, pruebas, empaquetado, Maestro, auditoría); reporte de fallos **sin audio ni ubicación exacta**; copia/restauración **probadas**.
- Licencias: Open-Meteo (uso personal aprobado; revisar si se comercializa), datasets, atribuciones. Ficha de tienda en español; Android mínimo API 24.

## 7. Sugerencias: qué cambiar, quitar y agregar

**Quitar o esconder**
- «Estado acústico general» con porcentaje y tarjeta de aviso mientras no haya modelo validado: dan apariencia de diagnóstico. Dejarlos como **«Variación acústica (experimental)»** o plegarlos.
- `ui-catalog` y datos de demostración **fuera de los builds de distribución**.
- Columnas sin uso (`hives.queen_status`, `hives.health_score`): decidir si se usan o se retiran.

**Cambiar**
- Saludo por hora del día y con el nombre del perfil (hoy siempre «Buenos días»; los flujos Maestro asumen ese texto).
- Mosaicos de colmena más compactos y con **estado del nodo** (batería, última lectura).
- Vocabulario único; revisar microcopy.

**Agregar (por valor para la usuaria)**
1. **Hallazgos y tratamientos con foto** (RF03): categoría, severidad, acción y seguimiento; para Damaris, **control manual de escarabajos** (no puede usar químicos); la app **no recomienda pesticidas**. **Las fotos exigen permiso de cámara y almacenamiento cifrado como el de los clips (InlineClipStore)**: sin eso se rompe la regla de base cifrada.
2. **Recordatorios locales** (RF06): en Android 13+ pide permiso de notificaciones; usar alarmas inexactas, reprogramar tras reinicio y probar contra los límites de batería de Samsung.
3. **Alertas** del nodo con escuchar / falsa alarma / confirmar (cuando exista el nodo).
4. **Asistente de primer uso**: apiario, ubicación, calendario, frecuencia de registro.
5. **Búsqueda y filtros** del historial (fecha, tipo, colmena).
6. Calendario de floración editable con fuentes (ya hay base).
7. Exportar bitácora (CSV/PDF): **escribe archivos sin cifrar; requiere advertencia explícita** y va con el alcance pausado (#15/#27).
8. Roles de administrador **solo si** hay más de un usuario por apiario.

## 8. Hitos propuestos (orden recomendado por el asesor)

| Orden | Hito | Contenido | Depende de | Acción del dueño |
|---|---|---|---|---|
| 1 | **H0** | Navbar M3 (en progreso), sistema de diseño, vocabulario único | — | Aprobar |
| 2 | **H4** | Cuenta: nombre, perfil, restablecer por código, cambio de datos, eliminar cuenta | — | Configurar Supabase; aprobar migración |
| 3 | **H3** | Hallazgos/tratamientos con foto cifrada y seguimiento | H0 | Confirmar categorías con Damaris |
| 4 | **H2** | Recordatorios locales y estado del nodo | H0 | — |
| 5 | **H5** | Estados vacío/error, accesibilidad, Ajustes reordenado, responsividad de teléfono | H0 | — |
| 6 | **H1** | Taxonomía única, paquete v2, `alerts`, pantalla Alertas, retroalimentación, exportación de etiquetas | **Firmware/nodo existente** | Elegir taxonomía; aprobar migración (cambia un CHECK) |
| 7 | **H6** | IA de borde real: firmware, dataset propio, entrenamiento, paridad, prueba de campo, **enlace de salida (LoRa/celular)** | Hardware soldado y probado | Placa, datos, tiempo de campo, presupuesto LoRa |
| 8 | **H7** | Despliegue, firma, pista interna, privacidad | **Levantar pausa #15/#27** | Keystore, cuenta de Play, política de privacidad |

Cada hito cierra con pruebas, empaquetado, build en CI, revisión en emulador, documentación y actualización de este plan.

## 9. Preguntas para ti (nada de esto está decidido)
1. ¿Apruebas el enfoque **híbrido** y la regla de desacuerdo («sin consenso»)?
2. **Contrato de características**: ¿A (vector promedio actual, más simple) o B (secuencia de MFCC, más expresivo)? Y la **tasa de muestreo** única.
3. **Taxonomía**: propuesta = normal · enjambrazón posible · reina ausente posible · estrés por calor (o temperatura como contexto) · intrusión/perturbación · no identificada; «plaga» solo si hay datos.
4. **Placa**: ESP32-S3 (recomendada) o seguir con DevKit V1.
5. **Enlace de salida** para alertas lejos del apiario: ¿LoRaWAN (módulo + gateway), celular, o solo BLE al visitar?
6. ¿**Levantas la pausa de #15/#27** para planear firma, privacidad y publicación? ¿Aceptas la política de privacidad y el enlace de borrado de cuenta que exige Google Play (implican una página web mínima)?
7. ¿Actualizamos el **tablero** (Supabase en vez de C#/.NET; quitar Flutter) y alineamos las dos numeraciones de CU?
8. ¿MFA, roles y diseño en tablet entran o se difieren?
9. Orden de hitos y qué entra en la próxima versión.

## 10. Fuera de alcance por ahora
iOS (en espera), sitio web (salvo lo que decidas en la pregunta 6), publicación en tienda sin tu aprobación, resúmenes con IA (indicaste hoy «de momento nada»), modelos entrenados con datos sin licencia clara.
