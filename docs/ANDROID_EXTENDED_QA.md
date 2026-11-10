# Revisión ampliada Android — #25

Revisión iniciada el 3 de noviembre de 2026; comprobación de actualización y documentación finalizadas el 5 de noviembre. Alcance: estados y listas que no cubría el recorrido anterior, varios cuadros y texto al 200%, más comparación cualitativa con fuentes verificadas. La revisión comenzó con 0.1.2/código 3 y detectó dos defectos de texto grande. La corrección está validada en **0.1.3/código 4**, `com.apisense.app`; datos sintéticos en su espacio aislado, sin cuentas cloud, sensores ni modelo real. La compilación y los siete casos del APK final terminaron correctamente; se revisaron y conservaron sus 57 capturas.

## Comparación con Stitch

Los cinco pares se regeneraron e inspeccionaron con las capturas claras de la versión final en [41701287024](https://github.com/Juulren/apisense/actions/runs/41701287024), siete casos/0 fallos. [Procedencia y hashes de las imágenes](evidence/issue25/extended/comparison/provenance.json). La comparación inicial se hizo sobre una ejecución cancelada; los pares actuales la sustituyen y corresponden al APK entregado.

Cada par muestra fuente verificada a la izquierda y captura Android a la derecha, al mismo **ancho de presentación**, conservando proporciones y dimensiones originales. Los exports tienen anchos 332–706 px y son contenido completo; Android usa viewport 1080×2400/densidad 420 con barras/áreas seguras. Contenido, selección y estado difieren. Es una comparación cualitativa; no equivale a coincidencia de viewport ni prueba de fidelidad píxel a píxel.

| Paso/familia | Evidencia | Observación y decisión pendiente |
| --- | --- | --- |
| 1. Acceso | [Par](evidence/issue25/extended/comparison/login-pair.png) | Marca, títulos, tarjeta y tonos reconocibles. La app añade registro, contraseña explícita y flujo offline real; la acción queda bajo el primer viewport y requiere scroll. Revisar densidad/composición con el propietario; no retirar campos funcionales para igualar una imagen. |
| 2. Dashboard | [Par](evidence/issue25/extended/comparison/dashboard-pair.png) | Mantiene jerarquía de resumen/aviso/lista, con menos tarjetas visibles en el primer viewport. Aviso y controles siguen legibles. Clima/temperaturas de la fuente no se presentan como mediciones; datos sintéticos identificados. Pendiente aprobación de composición y comparación del contenido desplazado. |
| 3. Detalle/ciclo | [Par](evidence/issue25/extended/comparison/hive-pair.png) | La app sitúa observación/reina/lectura antes del ciclo; la fuente prioriza el anillo y contiene vigor/postura no medidos. La posición del ciclo es una diferencia de jerarquía pendiente de decidir. Las estimaciones no se convierten en hechos biológicos para copiar la fuente. |
| 4. Acústica | [Par](evidence/issue25/extended/comparison/monitor-pair.png) | Audio y selección reconocibles. La app expone reglas experimentales y controles de detención; el gráfico calculado está más abajo. No reproduce diagnósticos o probabilidades no validados de la maqueta. Pendiente aprobación de la composición; selección de colmena distinta. |
| 5. Ajustes | [Par](evidence/issue25/extended/comparison/settings-pair.png) | Tema y controles nativos legibles. La app muestra intervalo/avisos/sync de su implementación, sin presentar el hardware, TFLite Micro, LoRa, calibración o clima de la fuente como recursos instalados. Pendiente aprobación de esta adaptación funcional. |

No se detectó un defecto de recorte o legibilidad en estas cinco áreas a escala 1,0 que justificara cambiar su diseño por inferencia. Sí hay diferencias visuales pendientes; no se declaran resueltas por pasar los flujos. Los tamaños y el contenido distintos impiden una puntuación fiable de igualdad de píxeles.

## Defectos encontrados al 200%

La [iteración 41684432185](https://github.com/Juulren/apisense/actions/runs/41684432185) pasó el caso de volumen —siete notas y doce lecturas, 489,938 s— y las aserciones del texto al 200% —46,794 s—. La revisión de sus imágenes **rechazó el resultado visual**: el estado de sincronización cubría parte de Apiario en el encabezado y las opciones estrechas partían Colmena dentro de la palabra. [Ciclo antes](evidence/issue25/extended/font200-before/01-cycle-navigation.png), [opciones/teclado antes](evidence/issue25/extended/font200-before/03-notes-keyboard.png), [acción alcanzable antes](evidence/issue25/extended/font200-before/04-save-reachable.png) y [procedencia](evidence/issue25/extended/font200-before/provenance.json).

Se corrige el encabezado separando marca y estado en filas cuando crece el texto. Las opciones usan dos columnas anchas con texto grande y una en pantallas estrechas. Los cuadros muestran nombre y fecha en líneas separadas y ocupan una fila completa con texto grande, evitando fechas partidas. No se reduce ni oculta el texto. `verify-android-large-text.py` rechaza la superposición en el XML nativo anterior y comprueba límites/estados de navegación y guardado. El control negativo con 0.1.2 falló como se esperaba; el [control positivo final](evidence/issue25/extended/final/large-text-attributes.json) pasó: sin superposición, cuatro destinos de navegación habilitados/clickable/focusable de al menos 48dp, exactamente uno seleccionado y guardado de 58,29dp. Esto verifica atributos y geometría, no los anuncios de TalkBack.

La revisión de la compilación intermedia 0.1.3 encontró además [fechas partidas en los selectores de cuadros](evidence/issue25/extended/cohort-date-before/cohort-dates.png), aunque el encabezado y las colmenas ya estaban corregidos. [Procedencia de esa imagen](evidence/issue25/extended/cohort-date-before/provenance.json). La corrección final separa nombre/fecha visualmente y conserva su etiqueta accesible completa.

Las iteraciones también corrigieron el recorrido: búsqueda hacia arriba después de una confirmación del ciclo, visibilidad completa de controles al final de listas largas y un único reintento ante pérdida ADB probada antes de cualquier acción. Un destino inválido conservaba el scroll del formulario: el guardado ya estaba deshabilitado, pero había que subir para comprobar su etiqueta. No se reintentan aserciones ni errores de la app. [Registro de iteraciones](evidence/issue25/extended/iteration/iterations.json).

## Casos ampliados

> **Nota posterior:** la interfaz de cuadros de cría se retiró del detalle de colmena. Los recorridos actuales ya no cubren ciclo, cuadros ni el caso de texto 150% con día 21 (`hive-large-font.yaml` se eliminó); `hive-cycle.yaml` pasó a «Observaciones y lecturas por colmena» y `extended-font.yaml` a «Formulario con texto al 200 por ciento». Las filas y la sección sobre ciclos/cuadros de abajo son el registro histórico de la ejecución 0.1.3 y no se repiten.

Los recorridos reproducibles están en `.maestro/extended-hives.yaml`, `extended-states.yaml` y `extended-font.yaml`, incorporados a `scripts/test-design-android.sh`. La ejecución final usa Android 15/API 35, viewport 1080×2400 y densidad 420; escalas 1,0/1,5/2,0 según el caso. **Siete casos/0 fallos**; 57 capturas inspeccionadas y conservadas en [final/](evidence/issue25/extended/final/). Los casos anteriores fallidos quedan en el registro de iteraciones, sin contarse como éxitos de esta ejecución.

| Paso/caso | Estado | Segundos | Evidencia |
| --- | --- | --- | --- |
| 1. Claro / once vistas y teclado/error | Correcto | 93.134 | [JUnit](evidence/issue25/extended/final/light.xml) |
| 2. Oscuro / once vistas y teclado/error | Correcto | 91.566 | [JUnit](evidence/issue25/extended/final/dark.xml) |
| 3. Ciclo, observación, lectura/audio y reapertura | Correcto | 176.468 | [JUnit](evidence/issue25/extended/final/functional.xml) |
| 4. Texto 150%, día 21 y cierre manual | Correcto | 71.223 | [JUnit](evidence/issue25/extended/final/large-font.xml) |
| 5. Varios cuadros, siete notas y doce lecturas | Correcto | 533.288 | [JUnit](evidence/issue25/extended/final/extended.xml) |
| 6. Mapa, vacíos y destinos inválidos | Correcto | 102.898 | [JUnit](evidence/issue25/extended/final/states.xml) |
| 7. Texto 200%, fechas, teclado y guardado | Correcto | 54.652 | [JUnit](evidence/issue25/extended/final/font200.xml) |

1. **Selección/ciclo — correcto:** dos cuadros independientes, edición, cancelación y detención con historial conservado; la fecha se presenta en línea separada al 200% ([opciones](evidence/issue25/extended/final/font200/00-cohort-options.png)). El círculo calcula desde la fecha y abre edición; no es una validación biológica.
2. **Observaciones — correcto:** nota extensa con teclado, seis notas más y acceso a la primera mediante observaciones anteriores. [Nota recuperada](evidence/issue25/extended/final/extended/05-older-long-note.png).
3. **Lecturas — correcto:** doce registros, segunda página, lectura 12 concreta y audio histórico en reproducción. [Reproducción](evidence/issue25/extended/final/extended/07-oldest-reading-playing.png).
4. **Vacíos/errores — correcto:** mapa demo ilustrativo, búsqueda vacía recuperable, colmena sin lecturas, nota vacía rechazada y IDs inválidos sin sustitución silenciosa. Guardar/reproducir permanecen deshabilitados cuando corresponde.
5. **Texto grande — corregido y comprobado:** encabezado sin superposición, nombres/fechas legibles, campos/teclado desplazables y guardado alcanzable. [Formulario](evidence/issue25/extended/final/font200/03-hive-options.png), [teclado](evidence/issue25/extended/final/font200/04-notes-keyboard.png), [guardar](evidence/issue25/extended/final/font200/05-save-reachable.png). La comprobación no certifica TalkBack físico.

## APK y actualización

APK **0.1.3/código 4**, paquete `com.apisense.app`, compilado y probado desde `3ce655e8ce60ec2ab70bee3b4853f3a0533de30e`; [procedencia](evidence/issue25/extended/final/provenance.json), [manifiesto](evidence/issue25/extended/final/manifest.xml) y [entrega](evidence/issue25/extended/final/delivery.json). Los commits posteriores solo ajustan una prueba de herramientas y esta documentación/evidencia; no cambian el runtime o los recorridos validados.

Copia local: `dist/development/Apisense-Android-Development-0.1.3.apk`, 165721625 bytes. SHA-256: `6215cdfaf03f78078e9f814602d68eb4485e56f215359b6f60ea480e0a9c00a6`. Hash igual al de CI; ARM64/x86_64 y Android mínimo API 24. No se encontró el valor de servidor configurado en la comprobación exacta del APK descomprimido; no es una auditoría completa de secretos. Firma de desarrollo, sin publicación en tienda.

Se instaló con `adb install -r` sobre 0.1.2/código 3 el 3 de noviembre, sin borrar datos. Tras reanudar la comprobación el 5 de noviembre se confirmó versión/código nuevos, [nota anterior conservada](evidence/issue25/extended/local-update/update013-after-observation.png), [ciclo QA-update-013 conservado con día 18](evidence/issue25/extended/local-update/update013-after-cycle.png) y [audio anterior reproducido](evidence/issue25/extended/local-update/update013-after-audio.png). El inicio del ciclo continúa en 2026-10-19: el día cambia por el tiempo transcurrido desde la captura anterior, sin modificar la fecha guardada. [Registro](evidence/issue25/extended/local-update/update013-after.json). La reentrada explícita a la demo después de cerrar sigue siendo necesaria. No sustituye la actualización física en el S21 Ultra.

TypeScript y **165 pruebas locales** correctas; CI comprueba además bundles Android/iOS y funciones Deno. Esta iteración solo cambia presentación y recorridos; las siete pruebas reales de backend de 0.1.2 se conservan como antecedente, sin presentarlas como repetidas. No cambia tablas, migraciones, dominio o servicios.

## Aceptación física y decisiones

La [guía del S21 Ultra](ANDROID_FIELD_REVIEW.md) y su [plantilla](templates/ANDROID_FIELD_REVIEW_RESULT.md) dejan resultados iniciales como no probado. TalkBack exige escuchar anuncios y recorrer el foco en el teléfono; XML y capturas no lo certifican.

La aprobación de las cinco rutas sin fuente independiente continúa en [DESIGN_MAP.md](../DESIGN_MAP.md): inicio, lista/mapa, historial, vinculación e inspección. Las comparaciones anteriores tampoco constituyen aprobación de las adaptaciones funcionales en las cinco familias con fuente. iOS sigue en espera. #15/#27 no cambian de alcance o estado.
