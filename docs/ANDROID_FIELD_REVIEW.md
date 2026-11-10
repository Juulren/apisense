# Revisión de campo Android — observaciones, lecturas y ciclo

Preparada el 3 de noviembre de 2026 y actualizada al APK 0.1.3 el 5 de noviembre para el Galaxy S21 Ultra / Android 15 indicado por el usuario. Tiempo aproximado: 15–20 minutos, más el recorrido con TalkBack. Esta guía prepara la aceptación del #25; no cambia el alcance ni el estado de #15/#27. iOS sigue en espera.

## Antes de comenzar

Usa Apisense de desarrollo **0.1.3 / código 4**, paquete `com.apisense.app`. La [entrega validada](https://github.com/Juulren/apisense/actions/runs/41701287024) contiene el APK; en el workspace está en `dist/development/Apisense-Android-Development-0.1.3.apk`. SHA-256: `6215cdfaf03f78078e9f814602d68eb4485e56f215359b6f60ea480e0a9c00a6`.

Instala como actualización. Si Android rechaza la firma, conserva los datos y registra el error; no desinstales ni borres datos pendientes. No publiques capturas con correos, ubicaciones o información privada. Usa primero **Explorar demo local**, que se identifica como sintética y no sincroniza. En una cuenta propia usa colmenas de prueba claramente identificadas y anota el espacio empleado en el resultado. No interpretes el simulador como hardware real.

## Recorrido

| Paso | Acción | Resultado esperado |
| --- | --- | --- |
| 1 | Abre lista y mapa; busca un código inexistente y borra la búsqueda. | Estado vacío comprensible y recuperación de la lista. El mapa de demo dice que es ilustrativo. |
| 2 | Entra a Colmena 01 > Anotar observación de esta colmena. Intenta guardar vacía. | La pantalla identifica la colmena y pide una nota de al menos tres caracteres o elegir cómo la ves. |
| 3 | Escribe una nota de varias líneas, guarda y vuelve al detalle. | El teclado permite escribir/desplazar; la nota aparece en su bitácora. |
| 4 | Guarda seis notas más y pulsa Ver observaciones anteriores. | Puedes consultar la primera; no desaparece por superar cinco entradas. |
| 5 | Abre Ver lecturas guardadas > Abrir lectura 1. Escucha y detén el audio. | Registro identificado, estado de reproducción correcto y botón Detener. Audio sintético en demo. Sin audio disponible se informa el límite; no se inventa una grabación. |
| 6 | En Ciclo de cría escribe un cuadro/lote y fecha de hace quince días. | Día 16, etapa estimada y fecha aproximada. Tocar el círculo abre edición. |
| 7 | Intenta una fecha futura, cancela, luego cambia nombre/fecha válidos y guarda. | Error explícito sin alterar el dato guardado; la edición válida recalcula el círculo. |
| 8 | Crea otro cuadro/lote y alterna entre los dos. Abre otra colmena. | Los registros se seleccionan de forma independiente y no se mezclan entre colmenas. |
| 9 | Registra la etapa vista; cambia la fecha a hace veinte días. | Día 21 pide verificar. No confirma emergencia ni reinicia el ciclo automáticamente. |
| 10 | Confirma emergencia en un lote de prueba. En otro, prueba Volver y después Detener seguimiento. | Cierre manual, cancelación sin cambios y registro detenido conservado; no se afirma muerte de la cría. |
| 11 | Cierra y abre la app; vuelve a entrar al mismo espacio. | Notas/ciclos/lecturas conservados. La demo requiere reentrada explícita tras cerrar. |
| 12 | Repite las pantallas relevantes en claro/oscuro y tamaño de fuente grande/máximo. | Acciones alcanzables con scroll, sin texto oculto o letras aisladas; teclado no tapa el campo activo. Registra el tamaño exacto. |

El ciclo es un calendario aproximado de obreras; una estimación no reemplaza la inspección. Las lecturas muestran dBFS, no SPL calibrado. [Guía funcional y límites](HIVE_WORKFLOWS.md).

## TalkBack y foco — prueba física pendiente

Activa TalkBack desde Accesibilidad de Android. Recorre con gestos la lista, el círculo, sus opciones, la fecha y el formulario de observación. Comprueba que se anuncian nombre/rol/selección/estado deshabilitado, que el foco avanza de forma comprensible, que puedes abrir/editar/guardar y que los mensajes de error y confirmación se anuncian. Comprueba que cerrar teclado o diálogo devuelve el foco a una posición útil. Anota literalmente los anuncios erróneos o ausentes. Desactiva TalkBack al terminar si no lo utilizas normalmente.

Las etiquetas y estados del XML o las capturas no certifican estos anuncios. Si una acción no puede completarse, registra el paso y evita modificar datos reales para repetirlo.

## Registrar resultados

Copia [la plantilla](templates/ANDROID_FIELD_REVIEW_RESULT.md) a un archivo propio o al Issue #25. Marca cada paso como correcto, fallo o no probado. Incluye pasos de reproducción, resultado esperado/obtenido, tema, tamaño de texto, red y captura sin datos privados. Deja los pasos no ejecutados como **no probado**; instalar o abrir el APK no aprueba por sí solo todo el recorrido.

Los registros se revisan antes de marcar aceptación física. Este documento no acredita una prueba ya realizada en el S21 Ultra, ni sensores, broker, modelo entrenado, firma de distribución o recuperación de backups.
