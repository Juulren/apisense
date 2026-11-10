# Guía de flujo y patrones de UI (ApiSense)

App móvil Android-first (React Native) usada al aire libre por apicultores: guantes, sol, poca señal.
Navegación: barra inferior con 4 pestañas (Inicio, Acústica, Diagnóstico, Ajustes); lista de colmenas -> detalle -> añadir observación; login/registro/recuperar contraseña; ajustes/perfil.

Todo está parafraseado de las fuentes primarias listadas al final. Las reglas marcadas "(adaptación)" son decisiones propias derivadas de la fuente, pensadas para el contexto de campo, y no una cita literal de ella.

## 1. Reglas concretas y comprobables

Cada regla: enunciado verificable, motivo, fuente [n] (ver "Fuentes").

1. **La barra inferior tiene entre 3 y 5 destinos de igual importancia, y se mantiene igual en todas las pantallas de primer nivel.**
   Motivo: es el uso para el que Material define la navigation bar; 4 pestañas cumple. [1]
   Test: contar destinos = 4; la barra no cambia de contenido entre pestañas.

2. **Cada pestaña lleva icono + etiqueta de texto visible, nunca solo icono.**
   Motivo: el reconocimiento es mejor que el recuerdo; con sol y prisa no se descifran iconos. [1][3] (adaptación para campo)
   Test: las 4 pestañas muestran texto siempre, también la no seleccionada.

3. **Hay un destino de inicio fijo (Inicio) y Atrás desde él sale de la app.**
   Motivo: Android define un destino de inicio fijo, y el botón Atrás en él devuelve al launcher. Login/registro no cuentan como inicio, son pantallas condicionales. [2]
   Test: tras iniciar sesión, Atrás desde Inicio sale de la app y no vuelve al login.

4. **Atrás y "Arriba" (flecha de la barra superior) hacen lo mismo dentro de la app; "Arriba" no aparece en el destino de inicio.**
   Motivo: la pila de destinos es el estado de navegación; Up nunca saca de la app. [2]
   Test: lista -> detalle -> observación; Atrás x2 vuelve a la lista sin saltos; la flecha de la barra superior da el mismo resultado.

5. **Cambiar de pestaña conserva el estado de cada una (scroll, colmena abierta, formulario a medias).**
   Motivo: el estado de navegación es una pila que no debe perderse al moverse; ver también control y libertad del usuario. [2][3] (adaptación)
   Test: abrir una colmena, ir a Ajustes, volver a Inicio: sigue en esa colmena.

6. **Toda pantalla es alcanzable desde una pestaña en 2 toques o menos (3 como máximo para flujos de escritura como añadir observación).**
   Motivo: menos pasos y menos oportunidades de error con guantes; mantener lo esencial a la vista. [3][4] (adaptación, el umbral numérico es nuestro)
   Test: tabla pantalla -> nº de toques desde cada pestaña.

7. **Una sola acción primaria por pantalla, visualmente dominante (botón relleno); las secundarias, en peso visual menor.**
   Motivo: lo que aparece primero señala lo importante; el diseño minimalista elimina lo irrelevante. [3][4]
   Test: en una captura, un solo botón relleno; el resto son de texto o contorno.

8. **Objetivos táctiles de al menos 48x48 dp (Android) con separación suficiente entre ellos; en campo, preferir 56 dp o más para acciones frecuentes.**
   Motivo: Android recomienda 48dp como mínimo y "mayor es mejor"; WCAG 2.2 pone 24x24 CSS px solo como mínimo absoluto con excepciones por espaciado. [5][6] (el 56 dp es adaptación para guantes)
   Test: inspector de layout; ningún control interactivo por debajo de 48 dp; usar `hitSlop` si el icono es menor.

9. **Texto con contraste de al menos 4.5:1 (3:1 para texto grande: >=18sp, o >=14sp en negrita); iconos y bordes de controles de al menos 3:1. Probar a pleno sol y en modo claro.**
   Motivo: Android y WCAG dan los mismos umbrales para texto; WCAG trata los símbolos como contenido no textual (criterio 1.4.11, 3:1). [7][5]
   Test: comprobador de contraste sobre cada par texto/fondo, incluidos placeholders y estados deshabilitados activos.

10. **Todo el texto usa unidades escalables (sp o equivalente RN con `allowFontScaling`) y la UI no se rompe ni recorta con la fuente del sistema al máximo.**
    Motivo: Android pide texto legible y adaptable para usuarios con baja visión; el sol agrava el problema. [5][8] (adaptación; la fuente de escalado exacto no se pudo abrir, ver Fuentes)
    Test: ajustes del sistema -> tamaño de fuente máximo; recorrer las 4 pestañas y los formularios sin texto cortado ni botones fuera de pantalla.

11. **Nunca solo color para comunicar estado (sana/enferma, conectado/offline): añadir icono y texto.**
    Motivo: Android pide indicadores distintos del color (forma, texto, patrón). [8]
    Test: pasar la captura a escala de grises; el estado sigue siendo legible.

12. **Las acciones destructivas (borrar colmena, borrar cuenta, cerrar sesión con datos sin sincronizar) piden confirmación en un diálogo, con botón de confirmar nombrando la acción ("Borrar colmena") y separado del botón de cancelar; donde sea posible, ofrecer Deshacer en snackbar en vez de diálogo.**
    Motivo: el diálogo es un componente interruptivo pensado para confirmar acciones como borrar; el snackbar ofrece Deshacer sin interrumpir. [9][10][3]
    Test: ninguna acción irreversible se ejecuta con un solo toque; los botones del diálogo no están pegados.

13. **Feedback de operaciones con snackbar breve (guardado, error de red, "sin conexión"); si el mensaje es clave, no desaparecer solo (duración indefinida con acción).**
    Motivo: el snackbar es feedback no interruptivo y puede ser indefinido con acción; en campo el apicultor puede no mirar la pantalla en 4 s. [10][3]
    Test: guardar una observación muestra confirmación visible; un error de envío ofrece "Reintentar".

14. **Formularios: etiqueta visible persistente por campo (no solo placeholder), teclado adecuado al dato (`keyboardType`), acción del teclado (Siguiente/Hecho), y el contenido escrito se conserva siempre tras un error.**
    Motivo: Android recomienda etiqueta descriptiva además del placeholder y configura teclado e IME action; un error debe describir el problema y sugerir la solución. [11][3]
    Test: provocar un error de validación o de red; ningún campo se vacía; el mensaje de error nombra el campo y la corrección.

15. **Divulgación progresiva con como máximo 2 niveles: lo frecuente a la vista, lo avanzado tras un control claramente rotulado (p. ej. "Más detalles").**
    Motivo: reduce errores y foco disperso; con 3 o más niveles los usuarios se pierden. [4]
    Test: ningún detalle de colmena exige más de un despliegue para llegar a un dato; los controles de expandir dicen qué contienen.

16. **Jerarquía de pirámide invertida en cada pantalla: primero el estado/veredicto de la colmena (qué hacer), después los datos de soporte, al final el histórico.**
    Motivo: quien solo lee la primera línea debe llevarse lo esencial. [12]
    Test: tapando todo salvo los primeros ~25% de la pantalla, se sabe cuál es el estado y qué toca hacer.

17. **Estado del sistema siempre visible: qué se está cargando, qué está sin sincronizar, si hay o no conexión. Un indicador persistente (no solo un toast) para "sin conexión" y "pendiente de enviar".**
    Motivo: visibilidad del estado del sistema es la heurística nº 1; los snackbars de red son efímeros. [3][10]
    Test: modo avión: la app lo dice sin que el usuario lo busque; los datos guardados localmente muestran "pendiente" y pasan a "enviado" al recuperar señal.

18. **Misma etiqueta para la misma acción y la misma palabra para el mismo concepto en toda la app ("Colmena", "Observación", "Guardar", "Cancelar", "Cerrar sesión").**
    Motivo: consistencia y estándares; además los lectores de pantalla necesitan etiquetas únicas y claras por elemento. [3][8]
    Test: `grep` de cadenas de UI: un sinónimo por concepto; botones de acción con la etiqueta de la lista central de textos.

## 2. Checklist para auditar un flujo

Marcar cada punto por flujo (login, registro, recuperar contraseña, lista -> detalle -> observación, ajustes/perfil).

- [ ] Toda pantalla se alcanza desde una pestaña en <= 2 toques (<= 3 si es escritura).
- [ ] Las 4 pestañas tienen icono + texto; la activa está claramente marcada (no solo por color).
- [ ] Atrás funciona igual que la flecha de la barra superior; desde Inicio sale de la app; nunca vuelve a login tras autenticarse.
- [ ] Hay una única acción primaria por pantalla y se distingue a simple vista.
- [ ] Las acciones destructivas pasan por confirmación (o Deshacer), con el botón peligroso nombrado y alejado del de cancelar.
- [ ] La misma acción tiene la misma etiqueta en todas las pantallas.
- [ ] El estado se muestra, no se esconde: cargando, guardado, pendiente, sin conexión, error.
- [ ] Los formularios conservan lo escrito tras un error; el error explica qué y cómo arreglarlo.
- [ ] Teclado correcto por campo; Siguiente/Hecho encadenan los campos; "Hecho" envía o cierra sin tocar otro botón pequeño.
- [ ] Estados sin conexión explícitos: qué funciona offline, qué no, y qué se enviará después.
- [ ] Estados vacíos (sin colmenas, sin observaciones) explican qué es esto y ofrecen la acción de crear (una sola).
- [ ] Todos los objetivos >= 48 dp, con espacio entre ellos; los de uso frecuente más grandes.
- [ ] Contraste >= 4.5:1 en texto normal, probado a pleno sol (brillo de la pantalla alto, modo claro).
- [ ] Con la fuente del sistema al máximo no hay recortes ni botones inalcanzables.
- [ ] Ningún significado depende solo del color.
- [ ] Lo avanzado está tras un solo nivel de despliegue, con título descriptivo.
- [ ] Se puede abandonar el flujo (Cancelar/Atrás) sin perder datos sin avisar.
- [ ] Lectores de pantalla: cada control tiene una etiqueta única y corta; los iconos decorativos se ocultan.

## 3. Qué NO hacer

- No poner más de 5 destinos en la barra inferior ni mezclar destinos de distinta importancia (p. ej. una acción como "Añadir" como pestaña). [1]
- No cambiar los destinos de la barra según la pantalla. [1]
- No usar solo iconos en la barra ni en acciones importantes.
- No tratar login/registro como pantalla de inicio de la pila: Atrás no debe devolver a ellos tras entrar. [2]
- No usar gestos como único camino (deslizar para borrar, pulsación larga) sin un botón equivalente y una acción accesible para lectores de pantalla. [8]
- No ejecutar acciones destructivas con un toque, ni confirmar con un botón genérico "Aceptar"/"OK" que no nombra la acción. [9][3]
- No vaciar los campos del formulario tras un error de validación o de red. [3]
- No mostrar errores con códigos técnicos ni mensajes tipo "Error 500"; decir el problema y la salida. [3]
- No depender solo de toasts efímeros para estados críticos (sin conexión, pendiente de sincronizar). [10][3]
- No anidar contenido en 3 o más niveles de despliegue. [4]
- No enterrar el veredicto o dato clave al final de una pantalla larga. [12]
- No usar texto gris claro sobre fondo claro ni confiar en que "se verá bien en el simulador": el sol baja el contraste efectivo. [7]
- No fijar alturas en píxeles que recorten texto al escalar la fuente.
- No indicar estado solo con color (verde/rojo). [8]
- No dos botones primarios en la misma pantalla ni dos nombres para la misma acción. [3]
- No bloquear la app con pantallas de carga sin indicar qué pasa ni cómo salir.

## Fuentes

Abiertas y leídas con éxito (primarias):

1. Android Developers, Navigation bar (Compose): https://developer.android.com/develop/ui/compose/components/navigation-bar (cita las pautas M3: 3 a 5 destinos de igual importancia, ventanas compactas, destinos consistentes; etiqueta e icono opcionales en la API).
2. Android Developers, Principles of navigation: https://developer.android.com/guide/navigation/principles
3. Nielsen Norman Group, 10 Usability Heuristics: https://www.nngroup.com/articles/ten-usability-heuristics/
4. Nielsen Norman Group, Progressive Disclosure: https://www.nngroup.com/articles/progressive-disclosure/
5. W3C, WCAG 2.2 Understanding 2.5.8 Target Size (Minimum): https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html
6. Android Developers, Make apps more accessible (objetivo táctil 48dp): https://developer.android.com/guide/topics/ui/accessibility/apps
7. W3C, WCAG 2.2 Understanding 1.4.3 Contrast (Minimum): https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html
8. Android Developers, Principles for improving app accessibility: https://developer.android.com/guide/topics/ui/accessibility/principles
9. Android Developers, Dialog (Compose): https://developer.android.com/develop/ui/compose/components/dialog
10. Android Developers, Snackbar (Compose): https://developer.android.com/develop/ui/compose/components/snackbar
11. Android Developers, Text fields (Compose): https://developer.android.com/develop/ui/compose/text/user-input
12. Nielsen Norman Group, Inverted Pyramid: https://www.nngroup.com/articles/inverted-pyramid/

Limitaciones honestas:

- Las páginas de m3.material.io (navigation bar, dialogs, snackbar, foundations) cargan con JavaScript y la herramienta de lectura devolvió solo el título; no pude leer su texto directamente. Lo que se atribuye a Material sobre barra de navegación y snackbars proviene de las páginas de Android Developers listadas arriba, que citan y resumen esas pautas. Contenido de Material sobre estados vacíos, tarjetas/listas y detalle de diálogos destructivos no se pudo verificar en la fuente: no se incluyen reglas que dependan de él salvo como adaptación propia.
- Las páginas de Android sobre tamaño de objetivo en Compose (`touch-target-size`), escalado de texto (`text-scaling`) y NN/g sobre jerarquía móvil devolvieron 404; la regla 10 (escalado de fuente) se apoya en los principios generales de accesibilidad de [5][8] y es una adaptación, no una cita.
- Apple HIG no se consultó (no era necesario para aclarar ningún patrón).
- Los umbrales numéricos propios (<= 2 toques, 56 dp para acciones frecuentes, 25% superior) son decisiones de equipo para el contexto de campo, no valores de las fuentes.
