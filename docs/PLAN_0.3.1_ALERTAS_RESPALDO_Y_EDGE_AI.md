# Plan 0.3.1 · Alertas, respaldo y puerta de entrada a la IA en el borde

Estado: para aprobación parcial. Primero se construyen las cuatro piezas de la app (sección 2); después empieza la IA en el borde (sección 4).

## 1. Por qué estas cuatro piezas antes de la IA

Cuando el nodo exista, su único producto es **un número por LoRa** (0 usual, 1 diferente). Ese número solo sirve si:

1. **llega a la persona** aunque la app esté cerrada (push);
2. **se nota cuando el nodo deja de hablar** (nodo sin reportar), porque el silencio se confunde con "todo está tranquilo";
3. **se puede ver la historia** del nodo por colmena (línea de tiempo), que es también la evidencia para ajustar el umbral;
4. **un teléfono perdido o un cambio de equipo no deja la cuenta atascada** (recuperación de la base local).

## 2. Piezas de la app

| # | Pieza | Qué entrega | Depende de |
|---|---|---|---|
| A | Línea de tiempo de veredictos por colmena | Tira de 14 días por colmena (verde: habitual, ámbar: diferente, gris: sin datos) y lista del día al tocar | Nada externo |
| B | Aviso de nodo sin reportar | Estado "sin reportar" si pasan más de 3 h sin mensaje (el nodo envía cada 10-15 min); aviso en Inicio y en la colmena; en el servidor, un evento de alerta una vez al día por nodo | Nada externo para la app; el push, de C |
| C | Notificaciones push | La app registra el token del teléfono; el servidor convierte alertas del nodo y nodos sin reportar en eventos y los envía por FCM | **Cuenta de Firebase** (proyecto, `google-services.json`, clave de servicio) y una compilación nueva |
| D | Recuperación de la base local | Si falta la llave de la base cifrada, la app ofrece "Restaurar desde la nube": borra la copia local y vuelve a descargar todo | Nada externo |

Aclaración sobre D: la sincronización **ya es el respaldo** de una cuenta real (todo lo sincronizado vive en Supabase y un teléfono nuevo lo vuelve a bajar). Lo que faltaba era la salida cuando la llave del teléfono se pierde: hoy la app se bloquea con un mensaje. Lo que no se pueda recuperar son los cambios que aún no se habían sincronizado, y la pantalla lo advierte.

### Diseño del servidor (B y C)

- Tabla `alert_events` (usuario, colmena, tipo: `verdict` o `node_silent`, título, texto, creado, enviado). RLS: cada quien lee solo los suyos.
- Tabla `push_tokens` (usuario, token, plataforma, última vez visto). RLS: cada quien administra solo los suyos.
- Disparador: un veredicto diferente de `lora` crea un evento `verdict`.
- Tarea `pg_cron` cada 10 minutos: detecta nodos sin mensaje en 3 h y crea un evento `node_silent` como máximo una vez cada 24 h por nodo.
- Función `send-push`: invocada cada minuto por `pg_cron` (mismo patrón que el resumen de colmenas), lee eventos sin enviar y los manda por FCM HTTP v1; borra tokens inválidos.
- Los textos nunca dicen la causa del sonido: "Sonido diferente al habitual en Colmena 03. Revísala." y "Colmena 03 no reporta desde hace N horas."

### Activación de push (acciones del dueño)

1. Crear un proyecto en Firebase y agregar la app Android `com.apisense.app`.
2. Guardar `google-services.json` como secreto de CI (nunca en el repositorio).
3. Crear una clave de servicio y guardarla como secreto de la función `send-push`.
4. Compilar de nuevo el APK.

Nombres exactos: secreto de GitHub `GOOGLE_SERVICES_JSON_B64` (el archivo `google-services.json` en base64; el flujo lo activa solo si existe) y secreto de la función `FCM_SERVICE_ACCOUNT` (el JSON de la clave de servicio). La función también necesita `CRON_SECRET` y los secretos de Vault `apisense_project_url` y `apisense_cron_secret`, los mismos del resumen de colmenas.

Sin esos pasos la app funciona igual: el registro del token queda desactivado y las alertas siguen viéndose dentro de la app.

## 3. Criterios de aceptación

- A: con veredictos de varios días, la tira marca cada día por el peor veredicto; sin datos, gris; la lista del día coincide con la tira.
- B: un nodo vinculado sin mensaje en 3 h aparece "sin reportar" en Inicio y en su colmena; al llegar un mensaje, desaparece. El servidor crea un solo evento por 24 h.
- C: con Firebase configurado, un veredicto diferente genera una notificación en el teléfono con la app cerrada; tocar la notificación abre las alertas. Sin Firebase, nada se rompe.
- D: con la llave borrada, la app ofrece restaurar; tras restaurar, las colmenas y observaciones sincronizadas vuelven; muestra cuántos cambios sin sincronizar se pierden cuando se puede saber.
- Todas: pruebas automáticas, revisión y sin tocar datos de otras cuentas.

## 4. Puerta de entrada a la IA en el borde

### ¿Hay que "inyectar" la IA en la placa? ¿Puede vivir en la base de datos en línea?

**El nodo no tiene internet.** LoRaWAN no es internet: es un enlace de muy bajo ancho de banda hacia una puerta de enlace, con mensajes de unas decenas de bytes y límites de tiempo de emisión. Un clip de 5 s a 16 kHz pesa unos 160 KB; por LoRa serían miles de mensajes, inviable. Por eso el nodo solo puede mandar el resultado, y para tener un resultado **el análisis debe ocurrir en el propio nodo**. Eso es lo que significa "IA en el borde": un modelo pequeño dentro del ESP32-S3.

Lo que sí se puede hacer **sin la placa y sin inyectar nada**, y es el camino recomendado para arrancar:

1. **Fase 0 · Datos y evaluación fuera del nodo.** Grabar audio de referencia (con el ESP32 DevKit V1 y el INMP441 que ya tienes), subirlo al servidor o analizarlo en la PC, y desarrollar y evaluar el método ahí. El modelo vive en la nube/PC solo durante el desarrollo.
2. **Fase 1 · Método simple por colmena.** Aprender el sonido habitual de cada colmena (línea base) y marcar "diferente" cuando se aleja, con la hora y la temperatura como contexto. No requiere clases etiquetadas.
3. **Fase 2 · Llevarlo al nodo.** Cuando el método funciona con datos reales, se exporta a un modelo pequeño o a reglas y se incluye en el firmware del ESP32-S3. "Inyectarlo" es solo cargar un archivo en el firmware (y luego actualizarlo por aire si hay medio).
4. **Alternativa para pruebas:** si el nodo tiene Wi-Fi o Bluetooth cerca del teléfono, puede entregar clips cortos a la app, que ya los sube al servidor. No sirve para vigilar 24 horas, pero sí para recolectar datos y validar.

El ESP32-S3 es una buena elección: tiene más memoria y soporta instrucciones vectoriales útiles para modelos pequeños. Conviene la versión con PSRAM.

### Fases de la IA (detalle en `docs/PLAN_0.3.0_IA_BORDE_CUENTA_DESPLIEGUE.md`)

- Fase 0: recolección y evaluación (nodo de prueba actual).
- Fase 1: línea base por colmena en la PC; métricas de falsas alarmas.
- Fase 2: extracción de características y modelo en firmware, con las mismas pruebas que la PC.
- Fase 3: integración LoRa de punta a punta (mensaje de 8 bytes ya definido y recibido por la app).

## 5. Orden de trabajo

1. Documentar issues (este plan).
2. A, B (app) y D, con pruebas.
3. Servidor de B/C y cliente de C (protegido por configuración).
4. Revisión, commit; aplicar la migración nueva a Supabase solo con tu visto bueno.
5. Empezar la Fase 0 de la IA.

## 6. Estado de la revisión (0.3.0)

La revisión de Opus encontró y se corrigió: la línea de tiempo contaba solo los mensajes cargados (ahora cuenta en SQL por día); `INVALID_ARGUMENT` ya no borra tokens salvo que señale el token; la restauración exige la sesión de esa cuenta y aparta la base (`.orphaned-<fecha>`) en lugar de borrarla; el token se libera solo cuando el servidor lo confirma; límite de 5 teléfonos por cuenta sin escritura directa; arrendamiento de eventos para no enviar dos veces; "sin reportar" solo para mensajes LoRa de nodos con DevEUI y no cuando el teléfono lleva horas sin sincronizar; apiarios borrados no generan avisos; un toque de notificación con la app cerrada abre la pantalla correcta.

Pendiente: el aviso solo se activa con Firebase; los textos del teléfono (las notificaciones) las muestra el sistema aunque no haya sesión, por lo que un teléfono prestado conviene cerrarlo con "Cerrar sesión".
