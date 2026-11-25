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
