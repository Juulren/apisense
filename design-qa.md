# Design QA — Apisense

Resultado actual: revisión Android parcial; pendiente de aceptación visual completa.

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

También se corrigió en código el aviso marrón fijo en oscuro: sobre la tarjeta #162032 daba 3,25:1; el token ámbar de oscuro da 11,32:1. El texto de error usa 6,47:1 en tarjeta clara y 8,60:1 en oscura; ratios calculadas sobre colores opacos, sin certificar todos los estados de la app. Los mensajes dinámicos se marcan como live region polite. La nueva compilación debe comprobar esos cambios y el error de formulario en ambos temas.

El [recorrido 41569107227](https://github.com/Juulren/apisense/actions/runs/41569107227) pasó en ambos temas: 2 casos/0 fallos, 105,859 s claro y 85,089 s oscuro, con el APK `d77106d` y el recorrido `8f5d181`. Los dos controles primarios también pasaron la comprobación de bounds. Su viewport fue 1080×2400 px, densidad 420 (aprox. 411×914 dp). Conservamos [JUnit claro](docs/evidence/issue25/light.xml), [oscuro](docs/evidence/issue25/dark.xml) y [procedencia](docs/evidence/issue25/provenance.json).

La inspección de las capturas de teclado de ese recorrido detectó que el correo podía quedar tapado por el IME. Se añadió KeyboardAvoidingView y desplazamiento al campo enfocado, con suscripción solo en la ruta activa y navegación inferior oculta mientras se escribe. La ruta de acceso y la nota de inspección deben verificarse de nuevo con el APK que incluya este cambio; el resultado anterior no lo acredita. Se usan [las APIs nativas de teclado](https://docs.expo.dev/guides/keyboard-handling/) sin añadir otra dependencia.

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
