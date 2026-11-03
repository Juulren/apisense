# Design QA — Apisense

Resultado actual: Android 0.1.2 correcto en ambos temas y en observaciones, lecturas y ciclo, incluido texto al 150%. Pendiente de aceptación visual completa y TalkBack físico.

## Entrega Android 0.1.2 — funciones de colmena, 2 de noviembre de 2026

La [validación 41584654869](https://github.com/Juulren/apisense/actions/runs/41584654869) terminó con **cuatro casos y cero fallos**: claro 104,443 s, oscuro 88,827 s, funciones por colmena 171,070 s y texto al 150%/cierre manual 72,829 s. Se revisaron las 38 capturas conservadas. Android 15/API 35, 1080×2400 px y densidad 420; escala 1,0 en las suites generales y 1,5 en la última. Los controles primarios >=52dp y la política del APK empaquetado pasaron. Esto acredita las áreas y estados recorridos, sin certificar toda la app.

1. **Crear ciclo — correcto:** [día 16](docs/evidence/issue25/cycle/final/functional/01-cycle-day16.png) calculado desde la fecha guardada del cuadro/lote, con etapa y días restantes. El círculo abre la edición.
2. **Validar fecha — correcto:** [fecha futura rechazada](docs/evidence/issue25/cycle/final/functional/02-cycle-invalid-date.png) antes de escribir, conservando el ciclo existente.
3. **Anotar observación — correcto:** [nota guardada](docs/evidence/issue25/cycle/final/functional/03-observation-saved.png) en la colmena seleccionada y confirmación visible.
4. **Leer y escuchar — correcto:** [muestra concreta con audio en reproducción](docs/evidence/issue25/cycle/final/functional/04-selected-reading-audio.png), sin sustituirla por la última lectura. La gráfica requiere clip local; sin él se informa que solo hay telemetría.
5. **Separar colmenas — correcto:** [otra colmena sin ciclo](docs/evidence/issue25/cycle/final/functional/05-other-hive-no-cycle.png), sin heredar el registro anterior.
6. **Reabrir ciclo — correcto:** [registro conservado](docs/evidence/issue25/cycle/final/functional/06-cycle-after-reopen.png) tras cerrar y abrir, entrando explícitamente al espacio sintético.
7. **Reabrir observación — correcto:** [misma nota conservada](docs/evidence/issue25/cycle/final/functional/07-observation-after-reopen.png) en su bitácora.
8. **Texto al 150% — corregido y comprobado:** [día 16 y navegación legible](docs/evidence/issue25/cycle/final/large-font/01-cycle-text150.png). El [estado anterior](docs/evidence/issue25/cycle/before-text150.png) dejaba una letra aislada de Diagnóstico; ahora la navegación usa dos columnas conservando el escalado.
9. **Llegar al día 21 — correcto:** [emergencia por verificar](docs/evidence/issue25/cycle/final/large-font/02-day21-not-auto-closed.png); el calendario no confirma nacimientos ni reinicia el registro.
10. **Confirmar emergencia — correcto:** [cierre manual explícito](docs/evidence/issue25/cycle/final/large-font/03-manual-emergence.png) y registro conservado en el historial.

Las once vistas generales y los estados de teclado/error se volvieron a capturar en [claro](docs/evidence/issue25/cycle/final/light/01-welcome.png) y [oscuro](docs/evidence/issue25/cycle/final/dark/01-welcome.png); cada tema conserva la numeración de la tabla histórica 0.1.1. Evidencia: [JUnit claro](docs/evidence/issue25/cycle/final/light.xml), [oscuro](docs/evidence/issue25/cycle/final/dark.xml), [funciones](docs/evidence/issue25/cycle/final/functional.xml), [texto grande](docs/evidence/issue25/cycle/final/large-font.xml), [bounds claro](docs/evidence/issue25/cycle/final/light-controls.xml), [oscuro](docs/evidence/issue25/cycle/final/dark-controls.xml), [texto grande](docs/evidence/issue25/cycle/final/large-font-controls.xml), [viewport](docs/evidence/issue25/cycle/final/viewport.txt) y [escala](docs/evidence/issue25/cycle/final/font-scale.txt).

APK **0.1.2/código 3**, `com.apisense.app`, compilado desde `8649126d9edfdc78c3f574c92db8146b61e4e6cc` en [41581048991](https://github.com/Juulren/apisense/actions/runs/41581048991). La primera prueba funcional encontró el botón de audio recortado a 13px que Maestro consideraba visible: el recorrido ahora centra el control antes de pulsarlo y conserva la comprobación de reproducción real. La repetición final usa el mismo APK, con hash idéntico, y recorridos de `20acc5348128af1dee7011d5c03db91d6af9ee71`; el código de la app no cambió. [Procedencia](docs/evidence/issue25/cycle/final/provenance.json), [manifiesto](docs/evidence/issue25/cycle/final/manifest.xml) y [entrega](docs/evidence/issue25/cycle/final/delivery.json).

La copia local `dist/development/Apisense-Android-Development-0.1.2.apk` pesa 165721285 bytes; SHA-256 `b8e858dfd231be9f3ad3a97dfcc619157c4b95ea61532c42734a3b476a4646c5`. Se comprobó el hash y la ausencia de los dos secretos de servidor configurados en sus entradas descomprimidas, sin imprimir sus valores; no es una auditoría completa de secretos. Firma de desarrollo, sin publicación en tienda.

También se instaló con `adb install -r` sobre 0.1.1/código 2 en el emulador local, **sin borrar datos**. La migración SQLCipher v1→v2 conservó una [nota creada antes de actualizar](docs/evidence/issue25/cycle/migration-before-log.png), visible [después](docs/evidence/issue25/cycle/migration-after-log.png), y permitió [reproducir el audio anterior](docs/evidence/issue25/cycle/migration-after-audio.png). [Registro](docs/evidence/issue25/cycle/migration-local.json). Esto no sustituye una actualización física en el S21 Ultra.

Las pruebas de UI usan el espacio sintético aislado de la app de campo. Por separado pasaron **139 pruebas locales, TypeScript y siete pruebas reales de backend**, incluida sincronización del ciclo y rechazo de acceso cruzado; las cuentas y datos temporales se eliminaron. [Uso, migraciones y límites del calendario](docs/HIVE_WORKFLOWS.md). No se acreditan sensores, broker ni modelo entrenado.

**Pendiente en #25:** aprobación de las cinco adaptaciones, comparación con fuentes aprobadas al mismo viewport/estado, zonas y estados no recorridos, escalado fuera de los casos probados y TalkBack/aceptación física. Los atributos accesibles no acreditan el anuncio y orden reales. iOS sigue en espera; #15/#27 no se modifican. #25 permanece abierto.

## Revisión Android — 2 de noviembre de 2026, #25

La app de campo (`com.apisense.app`) se abrió en Android 15/API 35, con datos sintéticos dentro de su espacio local aislado. La captura inicial se realizó a 466×1600 px/densidad 160. Se rechazó una primera captura con un aviso de Android System UI; las capturas aceptadas muestran la app cargada. No se usaron capturas web como evidencia nueva.

1. **Inicio — corregido en código:** la acción Comenzar mostraba icono y texto apilados, sin fondo ni área de 52dp. NativeWind interceptaba el callback inline de Pressable. El botón compartido conserva ahora su callback nativo mediante `cssInterop={false}`; no utiliza clases de NativeWind.
2. **Acceso — corregido en código:** el mismo fallo afectaba Entrar al Apiario. Se conservan sus estados busy/disabled, se amplía Mostrar contraseña a 48dp y se permite encoger/centrar etiquetas largas.
3. **Dashboard — revisión parcial:** navegación y tarjetas están presentes; la barra Android usaba iconos blancos sobre una superficie clara. El tema configura ahora StatusBar para cada contraste. Se amplían los controles Volver/estado a 48dp, se añaden encabezados/grupos de radio accesibles y cierre de teclado al desplazar.

El recorrido de PR #34 abre las diez pantallas y el catálogo en claro/oscuro, prueba el teclado de acceso/inspección y conserva capturas/JUnit/viewport. El verificador lee bounds nativos: exige una acción primaria visible, habilitada y clickable con altura >=52dp. Solo puede reiniciar datos en un emulador desechable de CI; rechaza teléfonos y ejecución local. El corpus es sintético, no se inicia sesión cloud ni se empareja hardware.

Las cinco adaptaciones sin fuente independiente (inicio, lista/mapa, historial, vinculación e inspección) se conservan como base de desarrollo usando el sistema existente. Esto no se presenta como aprobación visual nueva del propietario. Se mantienen diferencias funcionales deliberadas: datos reales/sintéticos identificados, ausencia de clima inventado, observaciones acústicas orientativas y gráficos calculados a partir del audio; no se copian diagnósticos biológicos sin evidencia.

La evidencia de recorrido no constituye una comparación píxel a píxel ni una auditoría TalkBack completa. Los PNG de Stitch tienen anchos distintos (298–721 px) y son exports de contenido; las capturas Android incluyen barras/áreas seguras y viewport del dispositivo. La aceptación al mismo viewport, estado y contenido, la revisión de todas las zonas desplazables, el escalado de texto y TalkBack físico permanecen explícitos. iOS continúa en espera por decisión del usuario. #25 no se cierra solo por corregir estos controles.

### Evidencia local revisada

| Paso | Antes | Después | Resultado observado |
| --- | --- | --- | --- |
| 1. Inicio | [Captura](docs/evidence/issue25/before-welcome.png) | [Captura](docs/evidence/issue25/after-welcome.png) | Comenzar vuelve a tener fondo miel, icono/texto centrados y 52dp. Barra de estado legible. |
| 2. Acceso | [Captura](docs/evidence/issue25/before-login.png) | [Captura](docs/evidence/issue25/after-login.png) | Se recupera la acción primaria; control de contraseña de 48dp. Registro y acceso offline conservados. |
| 3. Dashboard | [Captura](docs/evidence/issue25/before-dashboard.png) | [Captura](docs/evidence/issue25/after-dashboard.png) | CTA visible, navegación única y barras seguras. El nombre de algunas tarjetas aún se partía; corregido después asignando ancho flexible, pendiente de nueva captura. |

Las seis capturas anteriores se inspeccionaron en este bloque, a 466×1600/densidad 160. Antes: APK de campo `29b1f13`; después: APK `d77106d` compilado en [41566409708](https://github.com/Juulren/apisense/actions/runs/41566409708). Este binario comprueba el arreglo principal, pero todavía no incluye el ajuste posterior de nombres/colores. El [XML anterior](docs/evidence/issue25/before-controls.xml) mide 41dp para Entrar al Apiario del catálogo; el [posterior](docs/evidence/issue25/after-controls.xml) mide 52dp y sigue habilitado/clickable. El verificador nativo rechaza el anterior y acepta el posterior. Los RadioButton exponen su estado checked; esto no acredita el orden o anuncio real de TalkBack.

También se corrigió en código el aviso marrón fijo en oscuro: sobre la tarjeta #162032 daba 3,25:1; el token ámbar de oscuro da 11,32:1. El texto de error usa 6,47:1 en tarjeta clara y 8,60:1 en oscura; ratios calculadas sobre colores opacos, sin certificar todos los estados de la app. Los mensajes dinámicos se marcan como live region polite. La entrega 0.1.1, documentada a continuación, comprueba esos cambios y el error de formulario en ambos temas.

El [recorrido 41569107227](https://github.com/Juulren/apisense/actions/runs/41569107227) pasó en ambos temas: 2 casos/0 fallos, 105,859 s claro y 85,089 s oscuro, con el APK `d77106d` y el recorrido `8f5d181`. Los dos controles primarios también pasaron la comprobación de bounds. Su viewport fue 1080×2400 px, densidad 420 (aprox. 411×914 dp). Conservamos [JUnit claro](docs/evidence/issue25/light.xml), [oscuro](docs/evidence/issue25/dark.xml) y [procedencia](docs/evidence/issue25/provenance.json).

La inspección de las capturas de teclado de ese recorrido detectó que el correo podía quedar tapado por el IME. Se añadió KeyboardAvoidingView y desplazamiento al campo enfocado, con suscripción solo en la ruta activa y navegación inferior oculta mientras se escribe. La ruta de acceso y la nota de inspección se volvieron a verificar con 0.1.1; el resultado anterior no acreditaba ese cambio. Se usan [las APIs nativas de teclado](https://docs.expo.dev/guides/keyboard-handling/) sin añadir otra dependencia.

### Entrega Android 0.1.1 — revisión final de este bloque

La [ejecución 41570910637](https://github.com/Juulren/apisense/actions/runs/41570910637) compiló un APK nuevo con las correcciones posteriores de teclado, títulos, colores y etiquetas. APK y recorrido proceden del mismo commit `3a6e27698d9d9a57152c14718fb9d6f32d679cd1`; no se reutilizó el binario anterior. Versión **0.1.1/código 2**, paquete `com.apisense.app`, Android 15/API 35, 1080×2400 px/densidad 420. Modo de campo con configuración pública de Supabase; el recorrido activa explícitamente el espacio local sintético y no inicia sesión cloud.

**2 casos/0 fallos:** claro 95,610 s y oscuro 77,648 s. La política empaquetada y los controles primarios >=52dp, habilitados/clickable, pasaron en ambos temas. Evidencia: [JUnit claro](docs/evidence/issue25/final/light.xml), [oscuro](docs/evidence/issue25/final/dark.xml), [bounds claro](docs/evidence/issue25/final/light-controls.xml), [oscuro](docs/evidence/issue25/final/dark-controls.xml), [viewport](docs/evidence/issue25/final/viewport.txt), [procedencia](docs/evidence/issue25/final/provenance.json) y [manifiesto](docs/evidence/issue25/final/manifest.xml).

Se revisaron las 28 capturas conservadas. La tabla describe el área visible y los estados recorridos; no certifica todos los contenidos desplazables ni equivalencia exacta con Stitch.

| Paso | Claro | Oscuro | Estado observado |
| --- | --- | --- | --- |
| 1. Inicio | [PNG](docs/evidence/issue25/final/light/01-welcome.png) | [PNG](docs/evidence/issue25/final/dark/01-welcome.png) | Correcto en el área visible: acción primaria y barra del sistema legibles. Adaptación pendiente de aprobación. |
| 2. Acceso | [PNG](docs/evidence/issue25/final/light/02-login.png) | [PNG](docs/evidence/issue25/final/dark/02-login.png) | Correcto: campos y selección de modo; acción inferior alcanzada mediante scroll durante el recorrido. |
| 3. Dashboard | [PNG](docs/evidence/issue25/final/light/03-dashboard.png) | [PNG](docs/evidence/issue25/final/dark/03-dashboard.png) | Correcto: aviso, acción y navegación activa legibles; datos sintéticos identificados. |
| 4. Colmenas | [PNG](docs/evidence/issue25/final/light/04-hives.png) | [PNG](docs/evidence/issue25/final/dark/04-hives.png) | Correcto: nombres y tarjetas sin la partición arbitraria anterior. Adaptación pendiente. El mapa no está cubierto por estas capturas. |
| 5. Detalle | [PNG](docs/evidence/issue25/final/light/05-hive.png) | [PNG](docs/evidence/issue25/final/dark/05-hive.png) | Correcto: mediciones y observaciones diferenciadas, sin afirmar verificación biológica. |
| 6. Monitoreo | [PNG](docs/evidence/issue25/final/light/06-monitor.png) | [PNG](docs/evidence/issue25/final/dark/06-monitor.png) | Correcto: selección y acciones de audio presentes. Esta suite no valida micrófonos ni un modelo real. |
| 7. Historial | [PNG](docs/evidence/issue25/final/light/07-history.png) | [PNG](docs/evidence/issue25/final/dark/07-history.png) | Correcto: filtros sin palabra partida y resumen legible. Adaptación pendiente. |
| 8. Vinculación | [PNG](docs/evidence/issue25/final/light/08-pairing.png) | [PNG](docs/evidence/issue25/final/dark/08-pairing.png) | Correcto: sensor simulado identificado y búsqueda deshabilitada sin UUID real. Adaptación y hardware pendientes. |
| 9. Inspección | [PNG](docs/evidence/issue25/final/light/09-inspection.png) | [PNG](docs/evidence/issue25/final/dark/09-inspection.png) | Correcto: campos, etiquetas y guardado local identificado. Adaptación pendiente. |
| 10. Ajustes | [PNG](docs/evidence/issue25/final/light/10-settings.png) | [PNG](docs/evidence/issue25/final/dark/10-settings.png) | Correcto: tema activo, preferencias y aviso experimental legibles. |
| 11. Catálogo | [PNG](docs/evidence/issue25/final/light/11-catalog.png) | [PNG](docs/evidence/issue25/final/dark/11-catalog.png) | Correcto: variantes de botón, estados busy/disabled y control primario de 52dp recuperados. |

El correo escrito queda visible sobre el IME en [claro](docs/evidence/issue25/final/light/02-login-keyboard.png) y [oscuro](docs/evidence/issue25/final/dark/02-login-keyboard.png), a diferencia del recorrido anterior. Las notas permanecen visibles al escribir en [claro](docs/evidence/issue25/final/light/09-inspection-keyboard.png) y [oscuro](docs/evidence/issue25/final/dark/09-inspection-keyboard.png); la navegación inferior se oculta mientras está el teclado. El error de contraseña mínima se muestra sin iniciar sesión y es legible en [claro](docs/evidence/issue25/final/light/02-login-validation.png) y [oscuro](docs/evidence/issue25/final/dark/02-login-validation.png). Esto confirma los cambios que el APK `d77106d` no contenía.

La entrega local `dist/development/Apisense-Android-Development-0.1.1.apk` tiene 165697589 bytes y SHA-256 `7a32ea9828eaad9ee1f83a31eea9ca4004b1496f71c6cbc77157a105f127ede6`. Se comparó con el hash de CI y no se encontraron los dos secretos de servidor configurados localmente en las entradas descomprimidas del APK; esta comprobación puntual no es una auditoría completa de secretos. [Metadatos de entrega](docs/evidence/issue25/final/delivery.json). Firma de desarrollo; no es distribución en tienda.

También se instaló con `adb install -r` sobre la versión anterior del emulador local, sin borrar datos. Android confirmó versión 0.1.1/código 2; después de entrar explícitamente al espacio sintético, se abrió el dashboard existente a 466×1600/densidad 160: [captura revisada](docs/evidence/issue25/final/local-update-dashboard.png) y [registro](docs/evidence/issue25/final/local-update.json). El modo sintético exige reentrada tras cerrar la app; no se interpretó esa pantalla de acceso como pérdida de datos. Esto no sustituye una prueba de actualización en el S21 Ultra.

**Pendiente en #25:** aprobación de las cinco adaptaciones, comparación con fuentes aprobadas al mismo viewport/estado, contenido fuera del área capturada, escalado de texto, TalkBack y aceptación física. Las capturas comprueban legibilidad observada; los roles/live regions requieren escuchar y recorrer la app en un dispositivo para certificar su anuncio. iOS sigue en espera. #25 permanece abierto.

## Historial anterior — navegador, fuera de la entrega móvil

Alcance confirmado el 26 de octubre: Android nativo e iOS nativo. La evidencia de navegador descrita aquí es histórica y parcial; #25 requiere comparar y recorrer las apps en emulador/simulador y dispositivo, incluyendo áreas seguras, navegación, teclado y permisos de cada plataforma.

Actualización del 26 de octubre de 2026: **procedencia de fuentes verificada** para los 11 IDs de #1/#7; ver [DESIGN_MAP.md](DESIGN_MAP.md) y [STITCH_PROVENANCE.md](docs/STITCH_PROVENANCE.md). Diez etiquetas iniciales de ID/pantalla eran incorrectas. El resultado visual de la app sigue pendiente por las adaptaciones y la comparación incompleta, ahora registradas en [#25](https://github.com/Juulren/apisense/issues/25).

## Fuentes y normalización

Fuente: `design-reference/stitch/exports/dashboard_simplificado_user_friendly_apisense/screen.png` (466×1600) y HTML de la spec de componentes. Implementación: `docs/qa/dashboard-light.png`, con captura de navegador a 466×1060, modo claro y demo con ocho colmenas. El navegador in-app limita la altura efectiva a 1060 aunque se solicitó 1600; no se afirma una comparación completa al mismo viewport.

Comparación parcial conjunta: `docs/qa/dashboard-comparison.png`, fuente recortada al área superior y captura de implementación a escala 1:1. No sustituye una validación completa de las diez pantallas.

## Superficies revisadas

- Tipografía: Jakarta/Inter empaquetadas; jerarquía, pesos y etiquetas legibles en claro/oscuro. No se certifican todos los saltos de línea de las adaptaciones ni de las comparaciones incompletas.
- Espaciado/layout: márgenes móviles, tarjetas redondeadas y navegación persistente comprobados. El layout adapta formularios reales, estado demo y clave de cifrado, ausentes de parte de las maquetas.
- Tokens: miel, verde, azul y superficies claras/oscuras derivados de la spec. Se corrigió texto verde de bajo contraste en tema oscuro.
- Recursos: marca raster extraída del PNG original; iconos Material. Espectrograma y FFT representan el clip real, en lugar de reutilizar un dibujo sin relación con la muestra.
- Contenido: se sustituyeron afirmaciones no verificables de reina/salud por patrones orientativos; valores de Hz/batería proceden de SQLite. No se inventaron temperatura ni clima.

## Historial de correcciones

1. [P2, corregido] Selección ARIA ausente en web: se añadieron atributos explícitos y se comprobó `aria-checked`/`aria-selected` en UI.
2. [P2, corregido] Dos pestañas seleccionadas en `/hives`: se delimitó el segmento del prefijo; la captura del mapa muestra solo Inicio activo.
3. [P1, corregido] Mapa incrustado bloqueado: iframe sin credenciales; se verificaron mapa, marcador y atribución después de remontarlo.
4. [P2, corregido] Contraste de texto verde en modo oscuro: utiliza token semántico del tema.

## Bloqueos restantes

- #25: los 11 IDs ya están acreditados, pero corresponden a cinco familias claro/oscuro y una spec. Onboarding, lista/mapa, historial, vinculación y formulario de inspección no tienen una fuente independiente entre ellos; falta aprobar sus adaptaciones o aportar diseños adicionales.
- Comparación completa al mismo viewport/estado para todas las pantallas pendiente. La evidencia capturada valida uso y revisión parcial, no aceptación visual integral.
- Builds nativos físicos pendientes en #8/#15.

El PR se entrega como implementación local para revisión, sin afirmar aceptación visual final ni producción lista.
