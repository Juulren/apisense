# Plan: rediseño y optimización de Apisense

**Estado (26 nov): plan aprobado por partes; la fase 2 está programada y probada en el emulador con la demo, y falta aprobarla en un teléfono.** Pedido: app fácil, cómoda, rápida y adaptable, con mucho menos texto. La depuración del código va **al final**.

## Reglas para todas las pantallas
1. **Una acción principal** por pantalla.
2. **Cada dato una sola vez.**
3. **Sin párrafos explicativos.** El estado se dice con icono, color y 2–3 palabras (el color nunca es la única señal y cada estado tiene su etiqueta para lectores de pantalla). Lo que necesite explicación va detrás de un «¿Qué significa?».
4. Lo poco usado, plegado o en Ajustes.
5. Botones de al menos 48 dp (52 dp los principales, como hoy), texto grande del teléfono respetado, nada cortado en pantallas angostas.
6. Se conserva, en corto: que «sonido diferente» **no es un diagnóstico**; «Aún no juzga»; la cifra de confianza; el aviso de datos de demostración; el permiso para enviar la ubicación al clima y al buscar un lugar; que hay que tener la sesión iniciada antes de salir sin señal; y las confirmaciones al borrar.

## Pantalla por pantalla
| Pantalla | Hoy | Propuesta |
|---|---|---|
| Barra superior | «Apisense Apiario» y estado en todas | Título de la pantalla; el estado solo si hay problema (sin conexión, error o registros sin enviar) |
| Inicio | La misma alerta aparece en el aviso, en el mosaico y en «0 de 1 con sonido habitual»; además dice «1 colmenas» | Saludo, clima en una línea y colmenas con su estado, las que piden revisión arriba. Un botón: Anotar |
| Diagnóstico y Mis colmenas | Dos pantallas que listan las mismas colmenas | **Una sola**, en la pestaña «Colmenas»: buscar, abrir, añadir; mapa como vista. Se conservan las rutas que abren las notificaciones |
| Colmena | Botón largo, nodo, línea de tiempo, registros, bitácora, vincular y administrar | Estado grande y «Revisar» si hay alerta; línea de tiempo; últimas notas. Renombrar y quitar, en un menú. Vincular el nodo pasa a administración |
| Alertas | **Una tarjeta por cada mensaje** (hubo 20 de una colmena en una prueba de unos 20 minutos), con cuatro botones y una nota cada una | **Una por colmena y episodio** («desde las 22:42 · 20 avisos»). Dos botones: **Confirmada** / **Falsa alarma**, y nota opcional |
| Anotar | Subtítulo, etiqueta y encabezado antes de escribir | Colmena, nota y Guardar; el resto plegado |
| Ajustes | Párrafos, botón de forzar sincronización y catálogo de componentes (pantalla de desarrollo) | Perfil, Apiario, Apariencia, **Sin conexión** (con «N sin enviar» si hay), Cuenta. Sin botón de sincronizar (se desliza para actualizar). El catálogo, solo en la compilación de pruebas |
| Mi apiario | Formulario largo | Nombre y lugar (buscador); coordenadas y calendario en «Avanzado» |
| Temporada | Varios textos de fuentes y advertencias | Una línea (mes y fase); el resto al tocarla |
| Entrada | Pantalla de bienvenida con tarjeta explicativa | En la app normal, ir directo a iniciar sesión, con la demo como enlace. La compilación solo demo conserva su entrada |
| Nodo («Micrófonos IoT») | Bluetooth y calibración de la versión anterior; la pantalla con más texto | Fuera de la vista del cliente: pasa a administración |

**Alertas agrupadas:** un episodio termina tras **2 horas sin avisos de «diferente»** en esa colmena (la misma separación que las notificaciones, que ya son máximo una por colmena cada 2 h). Revisar cubre los avisos hasta ese momento; uno nuevo abre otra tarjeta. Se guarda en una sola operación local; el servidor no necesita migración.

## Rendimiento (en este orden)
1. **No redibujar si nada cambió.** Hoy cada 15 s la sincronización avisa «hubo cambios» aunque no baje nada, y la app repite 10 consultas y 5 ajustes y redibuja todo.
2. Dejar de leer muestras de audio, resúmenes y ciclos de cría (ninguna pantalla los usa) y, mientras no se usen, de descargar las muestras y los resúmenes.
3. Repartir el estado para que cada pantalla se redibuje solo con lo suyo.
4. **Peso:** quitar las dependencias nativas sin uso. `libonnxruntime.so` pesa **36 MB** de los 66 MB de librerías para teléfono, y nada lo importa; `expo-audio` tampoco. Bluetooth y MQTT dependen de la decisión 3.
5. APK para el teléfono solo arm64 (compilación aparte). La compilación automática conserva también x86_64, que usan el emulador y las pruebas.

**Lo que no se quita sin más:** el código de audio en TypeScript lo usan todavía la demo, la prueba de seguridad, la sincronización de clips y varios scripts. Las tablas y los valores antiguos de la base de datos se conservan. Al quitar paquetes hay que cambiar a la vez el `postinstall` (hoy falla sin ONNX), `app.json` y `verify-native-policy.py` (exige permisos de Bluetooth).

## Fases
0. **Medir:** peso del APK, tiempo de arranque, cambio de pestaña y palabras visibles por pantalla.
1. **Maqueta** de Inicio, Colmena y Alertas para aprobarla antes de programar.
2. Componentes base y esas tres pantallas.
3. El resto.
4. Rendimiento y peso; volver a medir contra la fase 0.
5. **Depuración del código** (al final).

En cada fase que cambie textos o rutas se actualizan **en el mismo paso** los flujos Maestro y los scripts `verify-android-*.py`, que buscan los textos de hoy. Cada fase termina con un APK probado y se aprueba antes de seguir. Meta orientativa: unas **40 palabras visibles** como máximo en Inicio y en Colmenas sin desplegar nada.

## Medidas (fase 0 y fase 2)
Palabras visibles sin desplazar ni desplegar, en el emulador. «Antes» es la app con tu cuenta (1 colmena con alertas); «después», la demo (8 colmenas), así que solo son comparables a grandes rasgos.

| Pantalla | Antes | Después, sin datos del nodo | Después, con alertas de prueba |
|---|---|---|---|
| Inicio | 69 | 22 | 25 |
| Colmenas (antes Diagnóstico) | 52 | 35 | |
| Una colmena | 53 | 11 | 32 |
| Alertas | 92 | | 58 con 2 tarjetas (antes, 50 tarjetas) |

Arranque en frío antes del rediseño, demo en el emulador: **mediana 673 ms** en 5 intentos (uno de 3 717 ms). El peso se comparará en la fase 4.

**Fase 2 hecha:** barra superior, Inicio, Colmenas, detalle de colmena y alertas por episodio. También se actualizaron los flujos Maestro y `verify-android-large-text.py`, **sin ejecutarlos**. Los avisos de prueba para verlo en la demo fueron código temporal que no se guardó. No se probó con texto grande, en pantallas angostas ni con TalkBack.

## Decisiones
**Tomadas (26 nov):**
- La **temporada** se queda en **una línea**; el resto, al tocarla.
- Se quitan **Bluetooth y MQTT** (se conserva el código TypeScript que aún se usa).
- **El cliente no ve nada técnico:** la vinculación y la configuración del nodo y del micrófono van en la parte de administración (`PLAN_ADMIN_APIARIOS.md`). La pantalla actual se le oculta cuando exista la de administración, para no quedarse sin forma de vincular un nodo.
- **Alertas** agrupadas por episodio, que se cierra tras 2 horas sin avisos.

- **Aprobado:** unir las pantallas **Diagnóstico** y **Mis colmenas** en una sola, «Colmenas», según la maqueta. Se supone que el cliente sigue pudiendo crear, renombrar y quitar sus colmenas.

- **Aprobada (26 nov)** la maqueta de Inicio, Colmena y Alertas, con un cambio respecto a la tabla de arriba: como «Colmenas» ya lista todas, **Inicio mostraría solo las que necesitan atención** (por revisar o sin reportar). Cuando no haya ninguna, lo dirá sin dar por «sanas» las que no tienen nodo, aún no juzgan o no se han sincronizado.

**Qué se mueve al unirlas:**
| Hoy | En «Colmenas» |
|---|---|
| La lista de colmenas, en las dos pantallas | Una sola lista |
| Botón «Añadir o administrar colmenas» | Se quita: todo está en la misma pantalla |
| Tarjeta de temporada y «Ver temporada completa» | Una línea; al tocarla, el detalle |
| Buscar y Lista/Mapa (en Mis colmenas) | Arriba de la lista |
| Formulario «Añadir colmena», siempre a la vista | Botón «Añadir colmena» que lo abre |
| «Nuevo apiario» | Menú de la esquina |
| Selector de apiario (si hay varios) | Se queda arriba |
| «Ver lista / mapa» en Inicio | Abre «Colmenas» |
| Pestaña «Diagnóstico» | Se llama «Colmenas» |

Abrir una colmena sigue llevando a su detalle.

## Ya corregido (25 nov, fuera de este plan, aún sin commit)
El teclado que devolvía la pantalla hacia arriba, y deslizar para actualizar (probados en el emulador con la demo; sin servidor, no se probó que bajen datos nuevos). El botón **regresar** no se reprodujo en el emulador (Android 15): falta saber teléfono, versión de Android y pantalla.
