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
| **Dónde corre la IA** | En el nodo (TFLite Micro), manda un código | ONNX en el teléfono a partir de un vector MFCC de 13 valores | **El nodo clasifica; la app recibe, muestra y registra** (§3). El ONNX en el teléfono queda como camino opcional |
| **Clases** | normal/enjambrazón/huérfana/intrusión/anomalía (tablero) vs ZUMBIDO_ATIPICO/PLAGA_PROBABLE/PERDIDA_REINA/ESTRES_CALOR (UML) | `audio_samples` ya guarda clase, confianza y versión del clasificador por muestra, con **CHECK fijo de 5 clases** (core.sql) y el orden fijado por el contrato de modelo | **Una sola taxonomía**; cambiarla **no es una migración aditiva**: exige cambiar el CHECK local y remoto y subir la versión del contrato |
| **Stack documentado** | React Native + SQLite + **C# .NET Core + BD relacional**; una nota dice «app de Flutter» | Expo React Native + SQLCipher + **Supabase/Postgres** | **Pregunta para ti**: ¿actualizamos el tablero? |
| **Hallazgos y tratamientos (RF03)** | Sí, con categoría, severidad, foto y seguimiento | No existe | H3 |
| **Recordatorios (RF06)** | Sí | No existe (sin notificaciones) | H2 |
| **«Falsa alarma» → reentrenar** | Sí | No existe | H1 |
| **Temp./humedad/batería del nodo** | En Diagnóstico | Paquete v1 solo trae batería | Ampliar protocolo (H1) |
| **Cuenta** | Registro, «¿Olvidaste?», perfil implícito | Registro e inicio de sesión sí; sin restablecer ni perfil | H4 |
| **Roles** | Administrador hereda de Apicultora | Un solo rol | Diferir |

**Honestidad científica.** El tablero propone detectar **escarabajos** por sonido. La literatura acústica de colmenas se apoya sobre todo en reina ausente y enjambrazón; **no pude confirmar que el escarabajo sea detectable por audio**, y el propio tablero lo plantea como hipótesis con pruebas de campo [347:872]. Los datasets citados **no los verifiqué**, y la afirmación de «miles de horas» etiquetadas [183:731] **debe tratarse como no comprobada** (licencia, etiquetas y condiciones de grabación por revisar).

## 3. IA en el borde (diseño del equipo, con lo que mostró la investigación)

> Esta sección **reemplaza** la versión anterior («híbrido»). Parte de lo que ya está planeado: **el modelo corre en el ESP32 y por LoRaWAN viaja solo un número**. Evidencia, fuentes y lo no verificado: [INVESTIGACION_AUDIO_ABEJAS.md](INVESTIGACION_AUDIO_ABEJAS.md).

### 3.1 Cómo funciona (en palabras simples)
1. **En el apiario**, el nodo (ESP32 + micrófono INMP441) despierta cada 10–15 min, graba unos segundos, saca características del sonido y **el modelo, dentro del propio ESP32, lo clasifica**.
2. **Por el aire** (LoRaWAN) viaja un mensaje de **8 bytes**: el **código de clase** (0 = sonido habitual, 1 = sonido diferente al habitual), la **confianza**, la **temperatura**, la **batería** y un contador. Nunca viaja audio.
3. **Un gateway** recibe el mensaje y lo sube a la red (TTN). **Una función de Supabase** lo decodifica, busca a qué colmena pertenece el nodo (por su **DevEUI**) y lo guarda.
4. **La app** lo recibe como cualquier otro dato: muestra la alerta, y la apicultora la marca **«confirmada tras inspección»**, **«falsa alarma»** o **«vista»**. Esas respuestas son las **etiquetas reales** para mejorar el modelo.

**Lo que la app NO hace**: no corre el modelo ni lo decide; solo **recibe, muestra y registra**. (La parte de ONNX en el teléfono que ya existía queda como camino opcional para verificar con un clip cuando haya uno; no es necesaria para tu diseño.)

### 3.2 Qué significa el número
- El número es del **mapa de clases versionado** (el mensaje lleva la versión). **Versión 1: 0 = sonido habitual; 1 = sonido diferente al habitual.** El 1 **no dice por qué**: puede ser falta de reina, agitación, ruido, lluvia, calor o frío. La app lo muestra tal cual y pide revisar; **no afirma una causa**.
- Los códigos 2 en adelante están reservados para una versión futura del mapa, cuando haya datos propios que permitan separar causas (la investigación solo sostiene metas modestas: tendencia de preenjambrazón, reina ausente con baja confianza, perturbación fuerte).

### 3.3 Lo que sí es posible y lo que no (según la investigación)
- **Hay muy poco audio público etiquetado** y casi todo es «con reina / sin reina». La afirmación de «miles de horas etiquetadas» **no se sostiene**.
- **Sin evidencia acústica encontrada**: escarabajo de la colmena, pillaje, escasez. **Varroa**: evidencia débil. **Hostigamiento (ataque de avispón)**: existe en la literatura (siseo de banda ancha ~6 kHz) pero solo en otras especies/razas.
- **Frío**: las abejas generan calor con vibración del tórax (medición **térmica**); que eso se oiga como **más sonido** está **contestado**. Por eso **la temperatura es una covariable obligatoria**: sin ella el modelo confundiría clima con estado de la colonia. Esto es general y **no depende de la ubicación**: el nodo mide su propia temperatura en cada lugar.
- Las exactitudes altas publicadas casi siempre usan **las mismas colmenas en entrenamiento y prueba**; dejando una colmena fuera, un benchmark baja de 99 % a 34–84 %.

### 3.4 Decisiones de diseño que se desprenden
1. **Línea base por colmena**: semanas de datos propios y aviso por **desviación** respecto a esa colmena, no un clasificador global.
2. **Covariables**: temperatura y **hora del día** en cada muestra; **ventanas de madrugada** para tendencias.
3. **Muestreo 16 kHz / 16 bit** (el siseo de ataque exige > 12 kHz). Un clip de 3 s son ~96 kB: **no cabe completo en la RAM de un ESP32 clásico**; procesar por ventanas o usar **ESP32-S3 con PSRAM**.
4. **Paridad firmware ↔ entrenamiento** con un WAV de referencia y vectores de características, versionados junto con el mapa de clases.
5. **Validación por colmena y por fecha**, nunca por segmento, y **en otro apiario** antes de afirmar rendimiento.
6. **Cuidados de hardware**: INMP441 (24 bits en 32; verificar con grabaciones; L/R nunca flotante; evitar pines de arranque), cargador de batería **con sensor de temperatura**, medir el consumo real.

### 3.5 Enlace de salida (LoRaWAN) y backend
- **México = plan US915, subbanda 2** (confirmar; AU915 solo si se confirma) y **homologación del IFT** para el nodo. **Cobertura cerca de Mérida: desconocida** (existe la comunidad TTN Mérida; no hay gateways verificados): hará falta **gateway propio** o confirmar uno.
- El nodo se identifica por **DevEUI**; el servidor lo asocia a una colmena (cambiar de colmena = cambiar una fila). Seguridad LoRaWAN: OTAA, AppKey única por nodo, contadores de trama conservados.
- **Función `lora-uplink`**: exige un **secreto compartido**, decodifica y valida el mensaje (suma de verificación incluida), es **idempotente** por (DevEUI, contador) porque TTN reintenta, responde 200 a lo que un reintento no arregla y 5xx a lo que sí, y **guarda el mensaje crudo** para poder reprocesar si cambia el mapa de clases.
- **Sin enlace de salida**, las alertas solo llegan cuando estás en el apiario; el valor de «saber qué colmena necesita atención antes de ir» exige LoRaWAN (o celular).

### 3.6 Estado de la implementación (0.2.1)
**Hecho en la app y el servidor (sin hardware):** decodificador del mensaje de 8 bytes con CRC y pruebas; tabla `edge_verdicts` (local v5 + migración remota **sin aplicar**) con RLS e idempotencia; `dev_eui` en los nodos; función `lora-uplink` con pruebas; pantalla **Alertas del nodo** (revisar: vista / falsa alarma / confirmada, con nota); tarjeta del nodo en cada colmena y alerta en el panel; vincular el DevEUI desde «Micrófonos IoT»; simulador para probar en el demo.
**Falta (depende de hardware, datos o de ti):** firmware del nodo; modelo entrenado con datos propios; gateway y TTN; aplicar la migración y desplegar la función con `LORA_UPLINK_SECRET`; exportar etiquetas para entrenar; más códigos de clase.

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

## 9. Decisiones
**Ya decididas por ti:** la IA corre en el ESP32 y por LoRa viaja solo un número (0 = habitual, 1 = diferente); el calendario y el clima se ajustan a la ubicación del usuario (Yucatán es un caso, no un valor fijo); el clima por ubicación va activo.
**Siguen abiertas:**
1. **Placa**: la investigación recomienda **ESP32-S3 con PSRAM** (un proyecto parecido abandonó el ESP32 clásico por RAM). ¿Cuál tienes o compras?
2. **Gateway LoRaWAN**: ¿propio, o ya hay cobertura (TTN Mérida)? ¿Presupuesto para módulo LoRa y gateway?
3. **Pausa de #15/#27**: ¿la levantas para planear firma, privacidad y publicación? (Google Play exige una URL pública de política de privacidad y un enlace web para eliminar la cuenta; chocan con «sin sitio web».)
4. **Tablero**: ¿lo actualizamos (Supabase en vez de C#/.NET; quitar Flutter; alinear las dos numeraciones de casos de uso)?
5. **Datos de entrenamiento**: la investigación indica que casi todo hay que **grabarlo uno mismo con inspecciones fechadas**. ¿Puedes dedicar tiempo de campo con Damaris?
6. Orden de hitos y qué entra en la próxima versión.

## 10. Fuera de alcance por ahora
iOS (en espera), sitio web (salvo lo que decidas en la pregunta 6), publicación en tienda sin tu aprobación, resúmenes con IA (indicaste hoy «de momento nada»), modelos entrenados con datos sin licencia clara.
