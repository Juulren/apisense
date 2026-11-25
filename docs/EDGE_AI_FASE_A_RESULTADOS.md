# Fase A: comprobación de las características con datasets públicos

Comprobación de las características, **no una puerta de aprobación**: son grabaciones sueltas, de otros micrófonos y otros climas. No miden falsas alarmas por día.

## Kaggle beehive-sounds (7100 ventanas de 60 s)

Colmenas: hive1 (2843), hive3 (1130), hive4 (2546), hive5 (581)

**¿Se ve la reina en las características?** Entrenado con tres colmenas y probado en la cuarta (AUC 0,5 = azar, 1 = perfecto):

| Colmena de prueba | Ventanas | AUC | Exactitud balanceada |
|---|---|---|---|
| hive1 | 2843 | 0.63 | 0.63 |
| hive3 | 1130 | 0.28 | 0.50 |
| hive4 | 2546 | 0.74 | 0.50 |
| hive5 | 581 | 0.28 | 0.29 |

**Cambio en una misma colmena** (aprende con las primeras ventanas con reina; después, ¿cuántas ventanas marca como «diferente» cuando hay y cuando no hay reina?):

| Colmena | Aprendió con | Probadas con reina | Marcadas | Probadas sin reina | Marcadas |
|---|---|---|---|---|---|
| hive1 | 120 | 2405 | 0% | 318 | 0% |
| hive3 | 120 | 848 | 5% | 162 | 0% |
| hive4 | 120 | 2109 | 0% | 317 | 0% |
| hive5 | 120 | 312 | 0% | 0 | nan% |

**Misma colmena, sin depender del orden en el tiempo** (aprende con el 30 % de las grabaciones con reina, elegidas al azar; compara las demás grabaciones con y sin reina; AUC 0,5 = no las distingue):

| Colmena | Aprendió con | Con reina | Sin reina | AUC de la puntuación | Con reina sobre el umbral | Sin reina sobre el umbral |
|---|---|---|---|---|---|---|
| hive1 | 752 | 1773 | 318 | 0.68 | 0% | 0% |
| hive3 | 288 | 680 | 162 | 0.53 | 0% | 0% |
| hive4 | 669 | 1560 | 317 | 0.68 | 0% | 1% |
| hive5 | 126 | 306 | 149 | 0.57 | 0% | 1% |

Una colmena sin reina marcada con mucha más frecuencia que una con reina indica que las características ven el cambio. Las ventanas «con reina» marcadas miden falsas alarmas **solo de forma orientativa**: los registros no son días seguidos.

## To bee or not to bee (1586 ventanas de 10 s, solo las de una etiqueta)

Abeja / no abeja, una grabación fuera en cada vuelta:

| Grabación fuera | Ventanas | AUC | Exactitud balanceada |
|---|---|---|---|
| Hive1 | 542 | 0.73 | 0.69 |
| Hive3 | 668 | 0.73 | 0.68 |

## Open Source Beehives (405 ventanas de 30 s)

Ventanas por estado: Active (405)


## Qué significa (con las limitaciones de la comprobación)
- **Lo que NO se puede concluir:** estas tablas no dicen que el detector «vea» o «no vea» la reina. Hay confusiones que no se controlaron: en la prueba «misma colmena», las grabaciones con reina de prueba comparten días con las de entrenamiento y las sin reina vienen de otros días, así que un AUC de 0,53 a 0,68 puede reflejar fecha o clima y no la reina. Se usó una sola semilla, las ventanas de una misma grabación están correlacionadas y no hay intervalos de confianza: 0,53 es indistinguible del azar.
- **Entre colmenas:** los AUC de 0,28 (hive3 y hive5) son una inversión sistemática, señal de un factor que se confunde con la etiqueta (cada colmena suena distinta y el estado de la reina cambia con la fecha), no de azar. En hive4 el AUC 0,74 con exactitud balanceada 0,50 viene de predecir una sola clase. Conclusión práctica: un clasificador general de «reina» con estas características **no sirve**, y el proyecto no promete detectar reina; compara cada colmena con su propio sonido habitual.
- **Sensibilidad del umbral:** con y sin reina el detector marca casi lo mismo (0 a 1 %; en hive3 incluso 5 % con reina y 0 % sin reina, al revés de lo esperado). El umbral actual (cuantil 0,995 por 1,25) es muy conservador y no ve estos cambios. No es una medida de falsas alarmas por día (los registros no son días seguidos).
- **Abeja / no abeja** (To bee or not to bee, solo dos grupos): AUC 0,73, modesto; es la única evidencia, y débil, de que las características llevan información del sonido de abejas.
- **Open Source Beehives:** el zip casi solo trae audio «Active» en WAV; los demás estados son un MP3 suelto cada uno. No sirve para comparar estados.
- **Lo pendiente:** la sensibilidad real solo se conocerá con las grabaciones propias y los eventos controlados (puerta C). Es probable que haga falta ajustar umbral y bandas o añadir características (ruido de fondo, estabilidad del zumbido). Para estados de reina con más rigor haría falta separar por días y repetir con varias semillas.
- **Notas de las tablas:** en la tabla de orden temporal hive5 aparece con 0 ventanas sin reina porque las que había son anteriores al periodo de aprendizaje; en la otra tabla se usan todas (149). «Grabación fuera» en To bee or not to bee es en realidad la colmena (2 grupos).
- **Reproducir:** `python -m apisense_audio.phase_a extract|report` (ver `tools/edge-ai/README.md`).

## Reproducción en la placa (25 nov)

Se pasaron las características de Kaggle por la lógica real del nodo en el ESP32 (`apisense_audio/replay.py` con el banco `firmware/learn_test`): cada colmena aprendió con el primer 75 % de su periodo inicial (estado de reina 0) y juzgó en orden de fecha todo lo posterior, con la deriva con tope activada. De los estados, en el repositorio solo consta que 1 = sin reina; 0, 2 y 3 son periodos con reina.

| Colmena | Periodo | Ventanas | Días | Sobre el umbral | En alarma | Episodios de alarma | Puntaje mediano |
|---|---|---|---|---|---|---|---|
| hive1 | periodo inicial no visto | 115 | 2 | 0.0% | 0.0% | 0 | 1.13 |
| hive1 | sin reina | 318 | 3 | 0.0% | 0.0% | 0 | 0.62 |
| hive1 | estado 2 | 432 | 4 | 0.0% | 0.0% | 0 | 0.80 |
| hive1 | estado 3 | 1634 | 14 | 0.0% | 0.0% | 0 | 0.61 |
| hive3 | periodo inicial no visto | 99 | 2 | 0.0% | 0.0% | 0 | 0.60 |
| hive3 | sin reina | 162 | 2 | 1.2% | 0.0% | 0 | 0.94 |
| hive3 | estado 2 | 575 | 5 | 7.3% | 5.9% | 2 | 0.78 |
| hive4 | periodo inicial no visto | 44 | 1 | 0.0% | 0.0% | 0 | 0.77 |
| hive4 | sin reina | 317 | 3 | 1.3% | 0.0% | 0 | 0.76 |
| hive4 | estado 2 | 276 | 3 | 0.0% | 0.0% | 0 | 0.80 |
| hive4 | estado 3 | 1779 | 16 | 0.0% | 0.0% | 0 | 0.65 |

- hive1: aprendió con 344 ventanas de 4 días (la placa guardó 344), umbral 5.76; después incorporó 2499 de 2499.
  - Separación frente al periodo normal no visto (AUC, 0,5 = ninguna): sin reina 0.22, estado 2 0.32, estado 3 0.21.
- hive3: aprendió con 294 ventanas de 3 días (la placa guardó 294), umbral 3.35; después incorporó 766 de 836.
  - Separación frente al periodo normal no visto (AUC, 0,5 = ninguna): sin reina 0.77, estado 2 0.70.
- hive4: aprendió con 130 ventanas de 2 días (la placa guardó 130), umbral 4.06; después incorporó 2402 de 2416.
  - Separación frente al periodo normal no visto (AUC, 0,5 = ninguna): sin reina 0.50, estado 2 0.57, estado 3 0.41.
- hive5: no se evaluó; solo 12 ventanas del periodo inicial.

### Con la línea base fija (en la PC, sin adaptación)

Las AUC de la placa en hive1 (0,22 y 0,21) **están sesgadas**: la línea base incorporó casi todas las ventanas posteriores y por eso los periodos tardíos puntúan más bajo. Con la línea base fija, la AUC de «sin reina» frente al periodo inicial no visto es: hive1 0,48, hive3 0,78 y hive4 0,53.

| Colmena | Umbral (percentil 95 del entrenamiento) | Normal no visto | Sin reina | Estado 2 | Estado 3 |
|---|---|---|---|---|---|
| hive1 | 1,87 | 8 % | 6 % | 3 % | 4 % |
| hive3 | 0,92 | 11 % | 51 % | 55 % | — |
| hive4 | 1,95 | 2 % | 13 % | 14 % | 8 % |

(Porcentaje de ventanas sobre el umbral; no es la regla 3 de 4.)

### Qué se puede concluir

- **Tal como está configurado** (umbral = percentil 99,5 × 1,25 y deriva lenta), el nodo **no avisa de la falta de reina** en estos datos: ninguna alarma en los periodos sin reina de las tres colmenas. Las únicas alarmas fueron 2 episodios en hive3 durante el estado 2.
- El umbral es muy alto: con 130 a 344 ventanas de entrenamiento lo deciden una o dos ventanas atípicas (en hive1 es unas 9 veces la mediana).
- En hive1 y hive4 bajar el umbral no basta: «sin reina» no se distingue claramente de los periodos con reina. En hive3 hay una separación moderada, pero el estado 2 sube igual que «sin reina», no hay estado 3 como control y el normal no visto son solo 2 días: **no se puede separar del paso del tiempo**.
- **No** se concluye que la falta de reina sea indetectable por sonido, ni que el nodo sirva o no para cambios bruscos: eso no se probó.
- Otras limitaciones: cada grabación aporta unas 6 ventanas seguidas con la misma hora (la regla 3 de 4 actúa casi dentro de una sola grabación); no se normaliza el nivel, así que las características en dB también recogen la ganancia del grabador (el normal no visto de hive4 sale 3,4 dB más fuerte que su entrenamiento); son tres colmenas.
- Lo aprendido con estas colmenas **no se carga en la tuya**: cada colmena aprende su propio sonido.

No se cambió el umbral a partir de estos datos: ajustarlo con ellos no tiene validez para otras colmenas. Se decidirá con grabaciones propias y eventos controlados.

## Modelo inicial con los datasets, cargado en el ESP32 (25 nov)

A petición del usuario se entrenó en la placa una línea base con 512 ventanas de audio etiquetado como normal (`apisense_audio/pretrain.py`): 256 de Kaggle «con reina», 192 «abeja» de To bee or not to bee (sin las grabaciones marcadas «Missing Queen») y 64 «Active» de Open Source Beehives, repartidas al azar entre las franjas horarias. En la placa dio el mismo centro, escala y umbral (4,21) que en Python, y sobrevive a un reinicio. El firmware `apisense_node` en modo rápido la usa sin borrarla. (Una primera versión incluía ventanas de una colmena sin reina y no mezclaba las franjas como se decía; la revisión de Opus lo detectó. Al corregirlo, la conclusión no cambió.)

| Entrada (en la PC, mismo modelo, franja de las 12 a las 15 h) | Puntaje | Sobre el umbral |
|---|---|---|
| Grabación propia del usuario (9 ventanas de 60 s) | 3,45–4,52 | 5 de 9 |
| Control: casi silencio | 3,24 | no |
| Control: ruido blanco | 2,99 | no |
| Control: tono de 1 kHz | 4,45 | sí |
| Control: tono de 3 kHz fuerte | 4,62 | sí |

En vivo en la placa, 5 ventanas con el micrófono del usuario dieron 1,40–4,36: 1 sobre el umbral y ninguna alarma (la regla pide 3 de las últimas 4).

**Este modelo no sirve para vigilar una colmena:** considera habitual el casi silencio y el ruido blanco, y en la grabación propia cruza el umbral varias veces sin que se conozca ningún problema. Causas probables (revisión de Opus): los datasets difieren unos 30 dB de nivel, así que el nivel absoluto casi no cuenta, y el puntaje lo deciden las variaciones dentro de la ventana, que con el micrófono del usuario son mayores que en los datasets. La deriva lenta tampoco lo adapta a la colmena propia: solo aprende ventanas bajo el umbral y con un tope pequeño. Sirve para demostrar que la cadena funciona dentro del ESP32. Una posible mejora, no probada: características que no dependan de la ganancia del micrófono. Lo recomendado sigue siendo que cada nodo aprenda su colmena (comando `RESET`, unos 31 min en modo rápido para una primera línea base).

Ojo: el firmware borra lo aprendido si la compilación anterior en esa placa era otra (de campo o de banco) o si la placa es nueva; en ese caso hay que cargar una vez el modo rápido antes de `pretrain`.

## Dataset de defensa ante hormigas (Zenodo 20422561), revisado el 25 nov

Pedido: saber si las abejas se sienten atacadas o solo zumban para generar calor. Se descargó `audio-classes.zip` (150 MB, CC BY 4.0, md5 verificado; queda fuera de git).

**Contenido real: 6 grabaciones de unos 3 a 4 minutos (44,1 kHz).** Una de «ataque» (SARACA1A, 260 s), **una** de «alerta» (ATTA1A, 201 s) y cuatro de «control», que según la ficha son un **tubo de ensayo vacío**. No hay abejas en calma ni nada sobre generar calor o ventilar.

| Grabación | Nivel (dBFS) |
|---|---|
| Alerta | −43,1 |
| Ataque | −39,2 |
| Controles (tubo vacío) | −47,3 a −33,0 (uno saturado) |

Las dos grabaciones con abejas suenan más fuerte que los tres controles sin saturar (−47,3 a −44,7 dBFS); solo el control saturado las supera. El 68 % de abajo es una cifra aproximada: unas 10 ventanas de prueba por clase, de una sola grabación cada una.

**Control de validez** (clasificador sencillo sobre nuestras 24 características, ventanas de 10 s; entrena con la primera mitad de dos grabaciones y prueba con la segunda):

| Qué separa | Acierto equilibrado |
|---|---|
| Ataque contra alerta | 68 % |
| Tubo vacío contra tubo vacío (5 de los 6 pares) | 100 % |
| Tubo vacío contra tubo vacío (1A contra 2A) | 50 % |

**Conclusión:** con una sola grabación por clase no se puede separar el comportamiento de la propia grabación, y las diferencias entre grabaciones sin abejas bastan para que el clasificador «acierte» el 100 %. **No se entrenó ningún modelo para el ESP32 con este dataset.** No dice nada sobre la utilidad de la señal de vibración (otro archivo, no descargado) ni sobre si el comportamiento defensivo se puede reconocer con más y mejores grabaciones.

**Para tener esas categorías** harían falta, con el mismo micrófono montado en la colmena: muchas grabaciones de días y colmenas distintos, de ratos de calma y de episodios observados (anotados en el momento), sin provocar daño a las abejas; y para el calor o la ventilación, temperatura dentro y fuera de la colmena y observación de la piquera.

## Búsqueda de más datasets sobre ataque, enjambrazón y calor (25 nov)

En lo revisado **no se encontró un audio abierto que permita separar abejas en calma de abejas atacadas, ni zumbido de calor o ventilación.** No es una búsqueda exhaustiva.

| Fuente | Cómo se comprobó | Resultado |
|---|---|---|
| Defensa ante hormigas, Zenodo 20422561 | descargado y analizado | 1 ataque, 1 alerta, 4 tubos vacíos: no sirve para entrenar (arriba) |
| Enjambrazón en To bee or not to bee, Zenodo 1321278 (ya descargado) | ficha, lista de archivos y anotaciones | De los dos clips de colmena enjambrando solo están las anotaciones abeja / no abeja; **el audio no está en el registro** |
| «Piping» de reinas, IEEE DataPort 10.21227/53mq-g936 | ficha | 205 s en total (36 «tooting», 8 «quacking») sacados de YouTube; por derechos solo publican transformadas y descriptores en `.mat`; pide iniciar sesión |
| Defensa en abejorros, Dryad 10.5061/dryad.jh9w0vtq8 | ficha | Otra especie (*Bombus*); la lista tiene video y tablas de características, no archivos de audio |
| Zenodo 10359686 y Mendeley ggdyfh78d7 | fichas | Abejas contra zánganos; vuelo contra vibración floral. No tratan el tema |
| Kaggle beehive-sounds (nuestra copia) | columnas del CSV | Reina (presencia y aceptación), temperatura, humedad y clima. **No** tiene «healthy / distressed / empty», aunque un resumen web lo decía |
| MSPB 2.0, Zenodo 21499431 | ficha | Audio con temperatura; la ficha no menciona etiquetas de comportamiento |
| UrBAN y MSPB (artículos) | solo resumen de búsqueda | Audio con temperatura e inspecciones; sin etiquetas de ventilación descritas |
| We4Bee (Würzburg) | solo resumen de búsqueda | Habla de clases de pre-enjambrazón y enjambrazón; **no se encontró descarga ni licencia**. Habría que escribir a los autores |
| Avispones, Mattila et al., Royal Society Open Science | solo resumen de búsqueda (la página respondió 403) | Otra especie (*Apis cerana*); no se comprobó el audio |

### Segunda ronda: consulta directa a los catálogos de Zenodo y Hugging Face (25 nov)

Revisadas las fichas y listas de archivos por la API de cada catálogo; **no se descargó ningún archivo de estos**.

| Registro | Contenido | Utilidad |
|---|---|---|
| Zenodo 20771223, tratamiento contra varroa (Formic Pro), CC BY 4.0, 343 MB | 12 grabaciones WAV con espectrogramas de la respuesta de **una colmena**: 1 de calma antes de abrir, 1 de perturbación al volver a poner la tapa y el resto en distintos momentos tras el tratamiento (algunas descritas por el autor como ventilación). Del mismo autor hay más registros (hasta 3,75 GB) | Es lo único visto con una «calma» y una perturbación de abejas. Pero según los nombres hay **una grabación por momento**, de una sola colmena y sin colmena de control: cada estado queda confundido con su grabación y la hora. Las etiquetas son interpretaciones del autor. No sirve para entrenar categorías; como mucho, para escuchar y explorar |
| Zenodo 5106361, «piping» de reinas, CC BY 4.0, 7 MB | Audio WAV de 44–48 kHz: 36 «tooting» y 8 «quacking» (205 s) sacados de videos de YouTube. Es la versión con audio y sin registro de lo visto en IEEE DataPort | Señal de reinas relacionada con la enjambrazón, no de ataque. Sin ejemplos negativos grabados en las mismas condiciones: un modelo podría aprender «audio de YouTube» |
| Zenodo 19739013, «Bee Acoustic Dataset with Environmental Parameters», 9 MB | Según su descripción, 680 lecturas de temperatura y humedad, sin etiquetas | Pese al nombre, no describe audio |
| Zenodo 20399470, apiario UFC (Brasil), 4 MB | CSV de temperatura, humedad, peso y lluvia | Sin audio. Es del grupo del dataset de hormigas |
| Zenodo 7052981 (10 000 audios), 10359686 (abeja/zángano), 17459379 (abeja sin aguijón) | Sin etiquetas de comportamiento descritas, u otra tarea o especie | No |
| Hugging Face (búsqueda «beehive») y Kaggle (búsqueda web) | Los que se vieron reempaquetan NU-Hive / To bee or not to bee (con reina, sin reina, no abeja) | No añaden situaciones nuevas |
