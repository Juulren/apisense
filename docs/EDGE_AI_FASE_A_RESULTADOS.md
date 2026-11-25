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
