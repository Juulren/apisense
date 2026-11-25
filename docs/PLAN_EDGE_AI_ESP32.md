# Plan de implementación: Edge AI en el ESP32 hasta Supabase

Objetivo: que el nodo (ESP32 + INMP441) decida por sí mismo «sonido habitual / diferente» y mande ese 0 o 1 a la app y a Supabase, sin internet en el apiario.

Estado de partida (25 nov 2026): captura por USB validada (30 s, 0 bloques perdidos, 62,48 bloques/s); herramientas de PC de la fase 0 en `tools/edge-ai`; la app y la Edge Function `lora-uplink` ya reciben veredictos de 8 bytes. Falta el radio LoRa.

Revisado críticamente antes de cerrarlo (ver «Cambios tras la revisión»). Regla del plan: **cada fase tiene una puerta**; si no se cumple, no se pasa a la siguiente.

## Qué dicen los datasets y qué no

| Dataset | Sirve para | No sirve para |
|---|---|---|
| Kaggle `annajyang/beehive-sounds` (3 GB, 1274 registros con fecha, colmena y estado de la reina) | Comprobar las características; ver si cambian con el estado de la reina | Medir falsas alarmas por día (son registros sueltos) |
| Zenodo 1321278 «To bee or not to bee» (CC-BY 4.0) | Abeja / no abeja; con y sin reina | Línea base por colmena |
| Zenodo 321345 Open Source Beehives (CC-BY 4.0) | Estados de colmena por ubicación | Línea base por colmena |

Los datasets son una **comprobación de las características, no una puerta**. Son fragmentos de otros micrófonos y otros climas, sin días seguidos de una misma colmena. Lo que decide si el método sirve son las grabaciones propias (fase 0). Al evaluar, dividir por colmena y por día, nunca por fragmentos de la misma grabación.

## Decisiones de diseño que se fijan antes de portar (Fase B0)

1. **Ventana:** la de `features.py` es de **60 s** (media y dispersión de las características de cada trama). El plan usa esa. Con ventanas de 1 s la regla 3 de 4 se cumpliría en 4 s y las falsas alarmas serían otra cosa.
2. **Ciclo de escucha:** el nodo no escucha sin pausa (baterías). Se define una ventana de 60 s cada N minutos (N = 10 o 15, a fijar con el consumo medido). «3 de 4» significa entonces 3 de las últimas 4 ventanas, es decir, de 30 a 60 minutos de persistencia.
3. **Hora real:** las franjas de 3 h la necesitan. Fuente: `DeviceTimeReq` de LoRaWAN al unirse y periódicamente, o un RTC con pila. Sin hora válida el nodo usa solo la fila global de la línea base, y no una franja inventada.
4. **Aprendizaje por flujo:** el nodo no guarda días de ventanas (serían unos 0,8 MB y no caben en RAM). Se usa un estimador por flujo (histograma por característica y franja, o P² para el cuantil), con memoria fija. Se escribe en NVS pocas veces al día, con un presupuesto de escrituras para no gastar la flash.
5. **Mensaje:** el de 8 bytes de `edgePayload.ts`. La suma de verificación y el contador repiten lo que ya dan FCnt y el MIC de LoRaWAN; se decide si se conservan (la app ya los valida) o se simplifican en un cambio coordinado con la app. «Confianza» no está definida para una regla: se define como la distancia al umbral, normalizada, o se manda 0 hasta tener una definición.
6. **Deriva del micrófono:** la cera, el propóleo y la humedad degradan el micrófono y esa deriva se parece a un cambio real. Se anota como riesgo y se vigila con una medida de ruido de fondo propia.

## Fase A · Comprobar las características con los datasets (PC)

1. Un cargador por dataset al formato interno (16 kHz mono) con sus etiquetas.
2. Calcular con `features.py` las ventanas y revisar si las características separan abeja / no abeja y con / sin reina, con validación cruzada por colmena.
3. En Kaggle, además, mirar por colmena si las características cambian cerca de los cambios de estado de la reina.
4. Informe con lo que se pudo y no se pudo evaluar.

Sin puerta de aprobación. Sirve para detectar problemas gruesos (por ejemplo, una banda sin información) antes de portar.

## Fase B · Portar al ESP32 (C++), después de B0

1. `features` y la regla de decisión en C++, de tamaño fijo, sin librerías pesadas.
2. **Pruebas de paridad:** las mismas grabaciones pasan por Python y por el ESP32. La paridad se mide **en las características** con una tolerancia fijada de antemano (float32 contra float64), y el veredicto se compara con una banda de tolerancia alrededor del umbral. No se exige 100 % de coincidencia exacta del 0/1 cerca del umbral.
3. Presupuesto de memoria, tiempo y consumo.

Puerta B: características dentro de tolerancia en todas las ventanas de prueba; veredicto idéntico fuera de la banda del umbral; una hora de ejecución continua sin reinicios ni desbordes.

## Fase C · Línea base dentro del nodo, con datos propios

1. Aprendizaje: el nodo solo aprende durante el periodo definido por la fase 0 (**7 a 14 días**, no 3). Acorta el tiempo solo si los datos reales lo permiten.
2. Después compara cada ventana con la línea base y aplica la persistencia.
3. Casos a tratar: corte de energía (la línea base se conserva en NVS), reloj sin hora, deriva lenta (actualización lenta con tope para que un problema sostenido no se vuelva «habitual»), y comando para reiniciar el aprendizaje.
**Estado (25 nov): código hecho y probado en la placa; falta la puerta con datos propios.**
- Código: `edge_learn.h`, `edge_node.h`, `edge_storage.h`; banco de pruebas `firmware/learn_test` + `apisense_audio/learn_parity.py` (10 grupos de comprobaciones, todas pasan): la línea base aprendida en la placa es igual a `HiveBaseline.fit` de Python (también con franjas desbordadas, escasas o vacías), 7 días con ≥ 12 ventanas cada uno, sin reloj no hace nada, recupera el estado tras reiniciar y el reinicio de aprendizaje borra todo.
- Diseño: se guardan las últimas 64 ventanas por franja de 3 h (~49 KB de RAM) en lugar de un estimador en flujo: las medianas son exactas y «aprender despacio» es que el anillo olvida lo más viejo. En flash: línea base de referencia (NVS, 1,5 KB) y un archivo de 6 KB por franja.
- Regla de deriva con tope (revisada por Opus): solo entran ventanas bajo el umbral y sin ninguna de las últimas 4 por encima; el umbral no se mueve; el centro no se aleja más de 3 escalas de la referencia y la escala no baja de 0,8 de ella. Un cambio duradero real (reina nueva, colmena movida) exige el comando de reinicio.
- Un reinicio a mitad del día no cuenta el día dos veces (se guarda el último día contado).
- **No cubierto todavía:** un corte de energía real en medio de una escritura a flash; registros dañados (CRC) en meta y franjas; la marca de altura de pila (`uxTaskGetStackHighWaterMark`); el desborde real de `millis()` a los 49 días (el banco usa su propio reloj); días de funcionamiento continuo.
- **Riesgo para la fase D:** tras un corte de energía el nodo no juzga nada hasta recibir la hora (estado «sin reloj»). El nodo debe pedir la hora al arrancar (DeviceTimeReq) y enviar ese estado en el mensaje, para que la app avise de que la colmena no se está vigilando.

4. Puerta C = **puerta de la fase 0 con grabaciones propias:** al menos 7 días, 2 colmenas, ≥ 10 eventos controlados detectados en ≥ 80 %, ≤ 1 falsa alarma por colmena y día, datos perdidos < 1 %. Con un fin de semana de grabaciones no se llega a 10 eventos; hacen falta más días o eventos provocados.

## Fase D · Enviar a la app y a Supabase

La app y `lora-uplink` ya existen; faltan el radio y la red.

1. **Radio:** módulo LoRa (SX1262 o SX1276, 915 MHz) con LoRaWAN por OTAA. El NRF24L01 comprado no es LoRa y no sirve para esto.
2. **Red:** gateway LoRaWAN de interior en el módem doméstico (por Ethernet), registrado en The Things Stack, con una integración que reenvía a `lora-uplink` con su secreto compartido.
3. **Vinculación:** el DevEUI se registra en la app con el código de reclamo.
4. **Límites de emisión:** en 915 MHz no hay duty cycle; el límite real es el tiempo máximo por transmisión (dwell time de 400 ms) y el uso justo de TTN (unos 30 s de aire al día). Un mensaje cada 10–15 min cabe; se espacian los latidos.
5. **Alcance:** los 13 km con un gateway de interior no son creíbles; se mide en campo y, si no alcanza, se sube el gateway de altura o se mueve.
6. Prueba punta a punta: nodo, TTN, `lora-uplink`, app (veredicto, aviso de nodo sin reportar, línea de tiempo). Esta parte puede probarse antes con un emisor simulado en la PC.

Puerta D: veredictos recibidos en la app durante 48 h seguidas, con la pérdida medida y registrada.

## Orden y dependencias

| Fase | Depende de | Hardware |
|---|---|---|
| A · Comprobar características | descarga de datasets (hecha) | ninguno |
| B0 · Decisiones de diseño | A y la medición de consumo | ninguno |
| B · Port al ESP32 | B0 | DevKit V1 + INMP441 |
| C · Línea base en el nodo | B y grabaciones propias (≥ 7 días, 2 colmenas) | DevKit + micrófono en colmena |
| D · Envío a Supabase | C (el mensaje se prueba antes con datos fijos) | módulo LoRa + gateway |

## Cambios tras la revisión
- La ventana pasó de «1 s» a **60 s** (la de `features.py`), y se define el ciclo de escucha.
- La línea base aprende por flujo, con memoria fija y escrituras limitadas en NVS.
- La hora real se obtiene por LoRaWAN o RTC; sin hora se usa solo la fila global.
- Los datasets pasaron a ser una comprobación sin puerta; la puerta real es la fase 0 con datos propios (≥ 7 días, 2 colmenas, ≥ 10 eventos).
- La paridad se mide en las características y con tolerancia en el umbral.
- Se corrigió el límite de emisión (dwell time y uso justo, no duty cycle) y se retiró la promesa de 13 km.
- Nuevo riesgo: deriva del micrófono por cera, propóleo y humedad.

## Fuera de alcance
- Subir audio a la nube.
- El ESP32-S3 final: se decide después de la puerta C con el consumo medido.
- Notificaciones push reales e iOS (siguen como puntos aparte).

## Riesgos conocidos
- Los datasets públicos pueden no representar el sonido de Yucatán ni el INMP441.
- Sin etiquetas propias, «diferente» solo significa distinto de lo habitual en esa colmena.
- El consumo y las baterías del nodo final no están medidos.
