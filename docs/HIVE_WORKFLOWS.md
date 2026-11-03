# Observaciones, lecturas y ciclo de cada colmena

El detalle de una colmena reúne tres funciones de campo. La app de desarrollo usa la cuenta del apicultor; el espacio de demostración se identifica como sintético y no envía registros a Supabase.

## Anotar y consultar observaciones

1. Abre una colmena desde Inicio o la lista.
2. Pulsa **Anotar observación de esta colmena** o **Anotar inspección** en la bitácora.
3. Escribe al menos diez caracteres; puedes añadir etiquetas y marcar si viste directamente a la reina.
4. Pulsa **Guardar inspección**. La nota se conserva localmente, aparece en la bitácora de esa colmena y entra en la cola de sincronización si es una cuenta real.

**Ver observaciones anteriores** amplía la lista cuando hay más de cinco. Una URL con una colmena inválida no guarda la nota en otra colmena por defecto. El modo offline y las claves por cuenta siguen usando el repositorio existente.

## Lecturas individuales

**Ver lecturas guardadas** despliega únicamente muestras de la colmena actual, con fecha, origen, duración, frecuencia, nivel digital y micrófono. **Abrir lectura N** abre esa muestra concreta en Monitoreo: su audio, gráfica y telemetría; no sustituye silenciosamente el registro por el más reciente. **Mostrar última lectura** vuelve explícitamente al estado actual. Cambiar de colmena detiene el audio anterior.

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

El recorrido Android de este bloque debe verificar guardado/reapertura, audio de una lectura concreta, aislamiento entre colmenas, fechas rechazadas, día 16→21, cierre manual y texto al 150%. Se registrarán capturas y resultados en `design-qa.md`. Esto no sustituye TalkBack y aceptación física; iOS continúa en espera. #15/#27 no se intervienen en este bloque.
