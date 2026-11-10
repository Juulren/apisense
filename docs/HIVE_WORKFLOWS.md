# Observaciones, lecturas y ciclo de cada colmena

El detalle de una colmena reúne tres funciones de campo. La app de desarrollo usa la cuenta del apicultor; el espacio de demostración se identifica como sintético y no envía registros a Supabase.

## Anotar y consultar observaciones

1. Abre una colmena desde Inicio o la lista.
2. Pulsa **Anotar observación de esta colmena**.
3. Elige lo que quieras registrar (actividad, reservas, población; en «Más detalles» reina, huevos y celdas reales) y/o escribe una nota de al menos tres caracteres. Todo es opcional, pero hace falta al menos algo; puedes añadir etiquetas.
4. Pulsa **Guardar observación**. La nota se conserva localmente, aparece en la bitácora de esa colmena y entra en la cola de sincronización si es una cuenta real.

**Ver observaciones anteriores** amplía la lista cuando hay más de tres. Una URL con una colmena inválida no guarda la nota en otra colmena por defecto. El modo offline y las claves por cuenta siguen usando el repositorio existente.

## Lecturas individuales

**Ver lecturas guardadas** despliega únicamente muestras de la colmena actual, con fecha, origen, duración, frecuencia, nivel digital y micrófono. **Abrir lectura N** abre esa muestra concreta en Monitoreo: su audio disponible, gráfica calculada cuando existe un clip local y telemetría; no sustituye silenciosamente el registro por el más reciente. **Mostrar última lectura** vuelve explícitamente al estado actual. Cambiar de colmena detiene el audio anterior.

La lista amplía de diez en diez. En una colmena real vacía se muestra que faltan lecturas; no se generan datos. El nivel digital es dBFS, no SPL calibrado. Las reglas acústicas siguen siendo experimentales; hardware, calibración y modelo entrenado mantienen el seguimiento de #8.

## Círculo funcional del ciclo de cría

1. En **Ciclo de cría**, identifica el cuadro o lote e introduce su fecha estimada de puesta, `AAAA-MM-DD`.
2. **Iniciar seguimiento de cría** guarda el registro. El anillo, día, etapa estimada, días restantes y fecha aproximada se calculan con esa fecha; se actualizan al volver a la app y al cambiar el día.
3. Toca el círculo o **Editar fecha o cuadro** para corregir el registro activo. Las fechas imposibles o futuras se rechazan antes de escribir.
4. Selecciona lo que viste y pulsa **Guardar etapa observada**. La observación manual se presenta separada de la etapa estimada.
5. Al llegar al día 21 el calendario pide verificar; no confirma nacimiento, no se reinicia ni cierra automáticamente. Solo **Confirmar emergencia observada** cierra con ese resultado. **Detener seguimiento** conserva el historial y no afirma muerte o emergencia.
6. **Iniciar otro cuadro o lote** conserva los anteriores. Puedes seleccionar cada registro; los ciclos cerrados muestran el progreso a la fecha de cierre.

Es un calendario aproximado de **obreras**, con día 1 en la fecha registrada; no representa todas las cohortes de la colonia ni una medición automática por audio. Se conserva la convención de la referencia Stitch: días 1–3 huevos, 4–8 larvas, 9–20 cría operculada y día 21 emergencia aproximada. Los límites varían; la [Universidad de Arizona](https://extension.arizona.edu/publication/honeybee-series-honeybee-basic-biology) describe eclosión desde el día 4, operculado hacia el 9–10 y emergencia hacia el 21. No se deducen temperatura, salud, vigor de reina ni postura diaria de este calendario.

## Persistencia y aceptación

La migración local v1→v2 conserva las observaciones y lecturas existentes y añade `brood_cycles`. La migración `202611020001_brood_cycles.sql` añade la tabla remota con RLS por propietario de la colmena, timestamps e índices. Se integra en la misma cola y descarga por cuenta; se aplicó en el Supabase de desarrollo tras verificar que coincidía con el proyecto del cliente. Pasaron 139 pruebas locales/TypeScript y siete pruebas reales de backend, con sincronización y rechazo de escrituras de otra cuenta; las cuentas y datos temporales se limpiaron.

El [recorrido Android validado](https://github.com/Juulren/apisense/actions/runs/41584654869) pasó cuatro casos sin fallos: claro/oscuro y las funciones de guardado/reapertura, audio de una lectura concreta, aislamiento entre colmenas, fechas rechazadas, día 16→21, cierre manual y texto al 150%. La actualización local 0.1.1→0.1.2 conservó una nota y su audio. Capturas y procedencia en [design-qa.md](../design-qa.md). Esto no sustituye TalkBack y aceptación física; iOS continúa en espera. #15/#27 no se intervienen en este bloque.

## Temporada, registro rápido, colmenas y clima (0.2.0)

Plan completo y revisiones del asesor: [PLAN_0.2.0_APIARIO_REAL.md](PLAN_0.2.0_APIARIO_REAL.md).

### Gestionar colmenas
- **Añadir:** Inicio > Ver lista / mapa. El nombre admite hasta 40 caracteres y no puede repetirse (sin distinguir mayúsculas) dentro del apiario.
- **Editar y quitar:** abre la colmena y baja a **Administrar colmena**. **Guardar nombre** cambia el código. **Quitar colmena** pide confirmación y marca como quitados, en una sola operación, la colmena, sus micrófonos, inspecciones y cuadros de cría; el cambio se sincroniza. Las lecturas de audio y los resúmenes **no se borran**, solo dejan de mostrarse porque la colmena ya no aparece. Una colmena quitada no recibe registros nuevos ni se puede editar.

### Mi apiario (Ajustes)
Nombre, ubicación (latitud y longitud; la búsqueda por nombre de lugar envía solo el texto escrito y necesita conexión), calendario de temporadas, recordatorio de registro (diario, semanal o sin recordatorio) e interruptor del clima. Se puede cambiar en cualquier momento, no se pide al registrarse. En el demo no hay búsqueda ni clima. Si dos dispositivos editan el mismo apiario, **gana la última escritura por registro**.

### Tracker de temporada
- Anillo anual con la **fase típica** del mes según el calendario del apiario: *Flujo (habitual)*, *Época difícil / poca floración*, *Reactivación* o *Transición*. Es una guía, no una promesa.
- **Calendario de Yucatán:** síntesis de pocas fuentes técnicas (CONABIO, INIFAP) y reportes de apicultores; cada mes muestra su confianza y «fuente única» cuando corresponde; la referencia es el centro-norte del estado. No existe un calendario mensual técnico publicado, ni datos medidos de enjambrazón o abandono por mes. Fuera de Yucatán el calendario empieza **vacío** y se completa mes a mes.
- **Registro rápido** (todo opcional, nada pre-llenado): actividad, reservas y población; en «Más detalles», reina, huevos y celdas reales; nota y etiquetas. Basta una nota de **3 caracteres o más**, o elegir algún estado. Sin registros, el tracker muestra solo información general de la temporada.
- **Señales** (máximo dos) que repiten lo que anotaste junto a la fase típica, p. ej. «Anotaste reservas bajas; en esta época suele haber poca floración. Considera revisarla.» No son diagnóstico, no miden tendencias, no aconsejan alimentación ni tratamientos y desaparecen si el último registro tiene más de 14 días. Si tus registros contradicen el calendario, mandan tus registros.
- El recordatorio no culpa: la tira de 14 días solo marca los días con registro.

### Clima
Open-Meteo (sin clave). Solo se envían latitud y longitud **redondeadas a 2 decimales** (≈1 km) por HTTPS, y únicamente si activaste el clima para ese apiario. Se guarda el último dato con su hora y se refresca como máximo cada 60 minutos; sin red se muestra el último guardado. Tiempo límite de 8 segundos, nunca bloquea guardar nada. Es pronóstico/modelo, no una medición en el apiario. Uso aprobado para un proyecto personal sin comercialización; hay que revisar la licencia si eso cambia.

### Datos y sincronización
Esquema local v3 (aditivo) y migración remota `202611090001_apiary_profile_observations.sql`. **Hay que aplicar la migración remota antes de usar la 0.2.0 con una cuenta real**: sin ella la sincronización de apiarios, inspecciones y ciclos falla y reintenta. El cuadro de cría de 21 días se conserva como sección opcional.

## Clima y calendario por ubicación, nodo y alertas (0.2.1)

### Clima por ubicación
Está **activo por defecto** en los apiarios nuevos con ubicación y en el demo (con su ubicación ficticia); en cuentas que ya existían se enciende en Ajustes > Mi apiario, y se puede apagar en cualquier momento. Solo se envían a Open-Meteo coordenadas redondeadas. La app también obtiene **una vez al año por ubicación** el clima típico de los últimos 10 años (ERA5) para mostrar si el mes actual es más lluvioso, seco, cálido o fresco **respecto a ese lugar**. El clima describe el lugar: **no indica cuándo florece nada**.

### Calendario no fijo
Los calendarios regionales son datos con zona y fuente (hoy: Yucatán). En cualquier otro lugar el calendario empieza vacío y se completa mes a mes, con el clima de cada mes a la vista.

### Nodo de colmena y alertas
El nodo (ESP32 con micrófono) clasifica el sonido **dentro del propio dispositivo** y por LoRaWAN manda un mensaje de 8 bytes: código de clase (0 = sonido habitual, 1 = sonido diferente al habitual), confianza, temperatura, batería y contador. La app **recibe, muestra y registra**; no decide.
1. **Vincular**: Micrófonos IoT > «Nodo LoRaWAN» > DevEUI (16 caracteres de la etiqueta) y, en cuentas reales, el **código de vinculación** que vino con el nodo (se comprueba en el servidor; hace falta conexión la primera vez).
2. **Ver**: el panel avisa de las alertas sin revisar; cada colmena muestra el último mensaje de su nodo (confianza, temperatura, batería, hora y avisos del nodo).
3. **Revisar** (Alertas del nodo): *Confirmada tras inspección*, *Falsa alarma* o *Marcar como vista*, con una nota opcional. Esas respuestas son las etiquetas reales para mejorar el modelo.
4. **Probar sin hardware**: en el demo, «Simular sonido diferente / habitual» genera veredictos con el mismo formato que el nodo.

«Sonido diferente» **solo significa que se oye distinto de lo habitual en esa colmena; el nodo no sabe por qué**. Los mensajes de las últimas dos semanas se guardan en el teléfono; los de «sonido habitual» más antiguos de 30 días se descartan (las alertas y lo revisado se conservan).

### Para activar el servidor (acciones tuyas, no hechas)
Aplicar las migraciones `202611090001` y `202611100001`; desplegar la función `lora-uplink` con el secreto `LORA_UPLINK_SECRET`; registrar cada nodo en `lora_nodes` con su DevEUI y el SHA-256 de su código de vinculación; en TTN, un webhook a la función con ese secreto (cabecera `x-uplink-secret` o autenticación básica). Detalle y fuentes: [PLAN_0.3.0](PLAN_0.3.0_IA_BORDE_CUENTA_DESPLIEGUE.md) §3 e [INVESTIGACION_AUDIO_ABEJAS](INVESTIGACION_AUDIO_ABEJAS.md).
