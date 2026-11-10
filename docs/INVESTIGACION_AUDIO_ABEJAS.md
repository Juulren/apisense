# Investigación: sonido de colmenas, datos públicos, IA en el borde y LoRaWAN

Fecha: 2026-11-09. Cuatro investigaciones independientes con acceso a la web; cada cifra lleva su fuente. **«No verificado»** significa que no pude abrir la fuente primaria (PDF binario, 403, página que exige JavaScript). Nada de esto es un resultado propio del proyecto: es el estado de la literatura y de los datos públicos.

## 1. Conclusión en cinco líneas
1. **Hay poco audio público etiquetado y casi todo se limita a «con reina / sin reina».** La afirmación del tablero de «miles de horas etiquetadas de normal/queenless/estrés» **no se sostiene** (§2).
2. **No existe un corpus público de audio de preenjambre ni de colmena «hostigada por manejo»**; lo más cercano es un conjunto de 150 MB de abejas africanizadas bajo ataque de hormigas, hecho en laboratorio.
3. Los modelos publicados con exactitud > 90 % casi siempre **se evalúan con las mismas colmenas en entrenamiento y prueba**; al evaluar con colmenas nuevas caen mucho (99 % → 34–84 % en un benchmark).
4. **Escarabajo de la colmena, pillaje y estacionalidad: sin evidencia acústica encontrada. Varroa: evidencia débil.** La app no debe prometerlos.
5. Lo defendible para empezar: **desviación respecto a la propia línea base de cada colmena**, con **temperatura y hora** como covariables, y metas modestas (tendencia de preenjambrazón, reina ausente con baja confianza, perturbación fuerte).

## 2. Bases de datos públicas de audio de colmenas

Verificadas abriendo la página del repositorio salvo donde se indica.

| Conjunto | Enlace | Licencia | Tamaño | Etiquetas | Notas y límites |
|---|---|---|---|---|---|
| **NU-Hive** (parte pública) | https://zenodo.org/records/2667806 · 10.5281/zenodo.2667806 | CC BY 4.0 | 23,1 GB (4 .rar + `state_labels.csv`) | con reina / sin reina | Pocas colmenas (fechas de 2017–2018); **la etiqueta está confundida con colmena y fecha**; sin temperatura ni humedad publicadas; tasa de muestreo no verificada en la página |
| **To bee or not to bee** | https://zenodo.org/records/1321278 · 10.5281/zenodo.1321278 | CC BY 4.0 | 3,7 GB, ~12 h | abeja / no-abeja por segmentos | Útil como detector de **ruido / no-abeja**, no de estado de colonia; etiquetas de voluntarios |
| **OSBH Audio Database** | https://zenodo.org/records/321345 · 10.5281/zenodo.321345 | CC BY 4.0 | 504,5 MB | carpetas por estado | Hardware y ubicación heterogéneos; pocas colmenas |
| **UrBAN** | https://doi.org/10.20383/103.0972 · código https://github.com/MuSAELab/UrBAN | CC BY 4.0 (según la página) | > 2000 h (las cifras del paper son inconsistentes) | reina vista/no, población, miel, varroa (2022) | 10 colmenas en **una azotea de Montréal**, audio 48→16 kHz cada 30 min **con temperatura y humedad internas**; **descarga bloqueada al consultar** («No files uploaded») |
| **MSPB** | https://zenodo.org/records/8371700 | **CC BY-NC 4.0** | 414,6 MB | población, cría, varroa, defensividad… | **Solo características de audio, no audio crudo**; 53 colmenas en Québec; con temperatura/humedad; **no comercial** |
| **Queen loss, africanizadas** | https://data.mendeley.com/datasets/j97khfj656 | CC BY 4.0 | 5400 filas × 23 características | queen / sin reina | **Una sola colmena**, 6 días; sin reina solo el último día: **estado confundido con el día**; tabular |
| **Defensividad africanizada (ataque de hormigas)** | https://zenodo.org/records/20422561 | CC BY 4.0 | 150,4 MB | ataque / alerta / control | Laboratorio, no colmena abierta; lugar y hardware no indicados |
| **Tetragonisca fiebrigi** | https://zenodo.org/records/13898841 | CC BY 4.0 | 19,9 GB | sin etiquetas | **No es *Apis mellifera***; con temperatura y humedad |
| **Bee Audio Dataset** | https://zenodo.org/records/7052981 | CC BY 4.0 | 712 MB, 10 000 clips de 8,2 s, 8 kHz | ninguna | Solo sin supervisión |
| **Bee / drone** | https://zenodo.org/records/10359686 | CC BY 4.0 | 600 MB | abeja / zángano | No sirve para estado de colonia |
| **Smart Bee Colony Monitor** (Kaggle) | https://www.kaggle.com/datasets/annajyang/beehive-sounds | **no verificado** | las cifras de los papers no coinciden | reina presente/ausente/rechazada/aceptada | 4 colmenas en California; con temperatura/humedad según papers; **la página de Kaggle exige JavaScript: solo verifiqué el título** |
| **BeeTogether** | paper https://www.mdpi.com/1424-8220/24/18/6067 | no verificado | 395 836 clips de 2 s, 8 kHz | con / sin reina | Mezcla de los anteriores; reporta **99,2 % con partición aleatoria y 34–84 % dejando una colmena fuera** |
| **Piping (IEEE DataPort)** | https://ieee-dataport.org/documents/identification-beehive-piping-audio-signals | no verificado | 44 clips de YouTube | tooting / quacking | Diminuto |
| **BUZZ1/2/3** | referencia antigua (Box); paper Applied Sciences 2021 | no verificado | BUZZ1 ≈ 10 260 clips | abeja / grillo / ruido | Acceso actual **no confirmado** |

**Enjambre.** No hay un corpus público de **audio** con licencia clara. El trabajo de referencia (Ramsey et al., *Scientific Reports* 2020, https://pmc.ncbi.nlm.nih.gov/articles/PMC7298004/) usó **acelerómetros** (vibración) en 24–25 colmenas; no encontré enlace a sus datos.

**Para el proyecto** (uso personal no comercial: todo lo CC BY y CC BY-NC sirve; comercial: CC BY sí, MSPB no; Kaggle y BUZZ por revisar):
- *Reina / sin reina*: NU-Hive + OSBH + (cuando se pueda) UrBAN; **solo sirven para arrancar y comparar**, nunca como prueba final.
- *Ruido*: To bee or not to bee.
- *Hostigada*: el conjunto africanizado de 150 MB, entendiendo que es de laboratorio.
- *Enjambre, perturbación por manejo, estado «hostigado» en campo*: **hay que grabarlo uno mismo** con inspecciones fechadas como etiqueta.

## 3. Qué dice la literatura sobre la señal acústica

| Estado | Señal | Evidencia | Confianza |
|---|---|---|---|
| Colonia normal | Zumbido base ~125 Hz con armónico ~250 Hz (acelerómetro) | Ramsey 2020 (texto abierto) | media |
| Sin reina | «Warble» 225–285 Hz las primeras horas y luego «rugido» ~180 Hz; amplitud en dB **no verificada** | Revisión secundaria; los clasificadores con MFCC separan clases pero con pocas colmenas (Nolasco 2019, https://arxiv.org/abs/1811.06330) | baja–media |
| Preenjambrazón / piping | *Tooting* ~400 Hz (200–550), *quacking* ~350 Hz; el tooting precede al quacking | Ramsey 2020, acelerómetros en 25 colmenas | alta (existencia), media (dinámica) |
| Preenjambrazón (espectro) | Información más fuerte cerca de **~20 Hz**; poco por encima de ~700 Hz; mejor ventana: madrugada sin forrajeo; error 6,3 % y 1,9 % según estrategia, con fallos de 3/18 y 5/18 enjambres | Ramsey 2020; una sola serie (Francia/Reino Unido) | media |
| Colmena **hostigada**, atacada por avispón | *A. m. cypria* vs *Vespa orientalis*: siseo de banda ancha con dominante ~6 kHz; *A. cerana* vs *Vespa soror*: ruido ~8 veces mayor | Apidologie 2008, Mattila 2021 (resúmenes) | media (existe), baja (extrapolar a otras razas) |
| **Frío (racimo)** | Calentamiento por vibración torácica; cifras «70–100 Hz» y «210–330 Hz» de fuentes débiles; **contradicho en parte** por grabaciones a −10 °C | CORDIS (débil), Ramsey 2017, arXiv:2408.14430 | **baja** |
| Calor (abanicado) | ~100–140 Hz | una sola fuente débil | baja |
| Calentamiento de cría | Abejas calentadoras a 40,6 °C en celdas vacías | Kleinhenz 2003 (**medición térmica, no acústica**) | alta (térmica) |
| Varroa | Dos estudios con exactitud alta (89,7 % y > 98 %) | Sin control de colmena/hora/temperatura visible, sin replicación independiente | **baja** |
| Escarabajo de la colmena, pillaje, escasez/estacionalidad | **Sin evidencia acústica encontrada** | — | sin evidencia |

**Sobre tu hipótesis del frío** («cuando hay frío las colmenas producen más sonido porque se aclimatan»): el mecanismo (las abejas generan calor con vibración del tórax) está bien establecido por **mediciones térmicas**; que eso aparezca como **más sonido captable** está **contestado** en la literatura que revisé. Por eso la temperatura entra al diseño como **covariable obligatoria**: un modelo sin ella confundirá clima con estado de la colonia.

**Lo que NO se puede afirmar:** que las bandas de Hz de sin reina sean universales; que el piping indique por sí solo enjambrazón o ausencia de reina (aparece también en colonias con reina); que haya firma verificada para pillaje, escarabajo o escasez; que Varroa sea detectable de forma confiable; que los resultados de *A. cerana* o *A. m. cypria* valgan para razas europeas o africanizadas; que una exactitud > 90 % se mantenga en colmenas, apiarios o años nuevos.

## 4. Diseño que se desprende (IA en el ESP32)
1. **Línea base por colmena**: semanas de datos propios y aviso por **desviación**, no un clasificador global (la generalización entre colmenas es el punto débil documentado).
2. **Covariables**: temperatura interna/externa y **hora del día** en cada muestra; las ventanas de **madrugada (0–5 h)** son las más limpias para tendencia.
3. **Muestreo 16 kHz / 16 bit**: lo útil está bajo ~1 kHz, pero el siseo de ataque (~6 kHz) exige > 12 kHz. A 16 kHz, 3 s son ~96 kB: **no cabe un clip completo en la RAM de un ESP32 clásico** (el proyecto HappyBees abandonó el ESP32 por un buffer de 192 kB). Procesar por ventanas, o usar **ESP32-S3 con PSRAM**.
4. **Características**: energía en bandas fijas (≈ 20–30 Hz, 100–200, 200–350, 350–600, 600–1000 Hz y sus razones) más baratas que MFCC; si se usan MFCC, 13 coeficientes con deltas. Los parámetros de ventana no están establecidos: se deciden con datos propios.
5. **Paridad firmware ↔ entrenamiento**: el error típico es que el procesamiento de señal del firmware no coincida con el del entrenamiento (tasa, ventana, escala int16/float, quitar DC). Se exige **un WAV de referencia y vectores de características** con tolerancia, **versionados junto con el mapa de clases**.
6. **Validación**: partición **por colmena y por fecha, nunca por segmento**; probar en **otro apiario** antes de afirmar rendimiento.
7. **Metas viables**: tendencia de preenjambrazón; «sonido diferente» con baja confianza (puede incluir reina ausente o perturbación); perturbación fuerte por energía. **No prometer** escarabajo, pillaje ni Varroa.
8. **INMP441**: 24 bits en palabras de 32; convertir a PCM16 por desplazamiento aritmético y **verificar con grabaciones** (silencio ≈ 0, una palmada sin saturar); L/R a GND o VDD, **nunca flotante**; quitar el DC igual en entrenamiento y firmware; evitar los pines de arranque (0, 2, 12, 15) y los solo-entrada (34–39) para BCLK/WS; WAV de 16 bits en la SD.
9. **Consumo**: ESP32-S3 en *deep sleep* ≈ 7–8 µA (placas de desarrollo: 5–15 mA por regulador y USB-serie: **usar módulo desnudo o regulador de baja corriente**); el consumo con micrófono y radio **no está verificado, hay que medirlo**. Cargador de batería **con sensor de temperatura** (los TP4056 suelen venir con el NTC desactivado).

## 5. LoRaWAN para el nodo (diseño del equipo: el ESP32 clasifica y manda un número)

- **Plan de frecuencias**: el índice de TTN asocia México a **US902-928, subbanda 2** (lectura de un resumidor: **confirmar** en https://raw.githubusercontent.com/TheThingsNetwork/lorawan-frequency-plans/master/frequency-plans.yml; no usar AU915 salvo confirmación). Los dispositivos de corto alcance en 902–928 MHz requieren **homologación del IFT** (NOM-208-SCFI-2016; fuente secundaria: confirmar con el IFT).
- **Cobertura**: existe la comunidad TTN Mérida (Fab Lab Yucatán, 2019). **No encontré gateways activos ni mapa**; revisar ttnmapper.org o poner gateway propio.
- **Límites (US915)**: dwell ≤ 400 ms; DR2–DR3 dan 125–222 B de carga; un mensaje de ~8 B ocupa ~60–100 ms en SF7–SF8.
- **Carga útil propuesta (8 bytes, formato v1)**:

| Byte | Contenido |
|---|---|
| 0 | versión del formato (4 bits altos) · versión del mapa de clases (4 bits bajos) |
| 1 | código de clase (**0 = sonido habitual; 1 = sonido diferente**; más códigos reservados para mapas futuros) |
| 2 | confianza 0–255 (→ 0–1) |
| 3–4 | temperatura, int16 en centésimas de °C (`0x8000` = sin sensor) |
| 5 | batería: 2,00 V + 10 mV × valor (`0xFF` = desconocida) |
| 6 | contador de medición (4 bits bajos) y banderas (4 bits altos: SD llena, falla de micrófono, batería baja) |
| 7 | CRC-8 (polinomio 0x07) de los bytes 0–6 |

  El identificador de colmena **no va en la carga**: el DevEUI identifica el nodo y el servidor lo asocia a una colmena (si se reasigna el nodo se cambia una fila, no el firmware). El formato y el mapa de clases se versionan por separado.
- **Seguridad**: OTAA con AppKey única por nodo; contadores de trama guardados para que un reinicio no los repita (sin nuevo *join* se rechazan).
- **Backend**: TTN entrega por MQTT o webhook JSON (`dev_eui`, `f_cnt`, `f_port`, `frm_payload`, `received_at`…); reintenta si el destino falla. En Supabase, una función de borde con **secreto compartido**, **idempotencia por (dev_eui, f_cnt)** y **carga cruda guardada** para poder reprocesar si cambia el mapa de clases. *(No verifiqué si el webhook de TTN permite una cabecera de secreto propia; si no, usar autenticación básica o un secreto en la ruta.)*
- **Radio recomendada**: ESP32-S3 + SX1262 (p. ej. Heltec WiFi LoRa 32 V3, ~18–27 USD fuera de México). Precios de micrófono, gateway y envío: **no verificados**.

## 6. Contexto climático por ubicación (para que el calendario no sea fijo)
- Open-Meteo, histórico ERA5: `https://archive-api.open-meteo.com/v1/archive?latitude=…&longitude=…&start_date=…&end_date=…&daily=temperature_2m_mean,precipitation_sum&timezone=auto` (verificado con una llamada real; `timezone` es obligatorio con `daily`; resolución ~25 km).
- 10 años en **una** petición por ubicación, agregados a 12 medias mensuales en el dispositivo y guardados un año. El peso exacto de esa petición frente al límite gratuito **no está verificado** (el límite es 10 000 llamadas por día; se pide una vez por ubicación y año).
- Lo que el clima **sí** dice: meses relativamente lluviosos/secos/frescos/cálidos **respecto al propio lugar**. Lo que **no** dice: cuándo florece nada ni cuándo empieza un flujo de néctar. Por eso la app muestra «clima aquí» junto al calendario y **no inventa fechas de floración**.
- Calendarios regionales (**solo con fuente citable**): la revisión de flora melífera de la península de Yucatán (2024, 935 taxones, DOI 10.1186/s13002-024-00681-0) es la base natural para Yucatán, Campeche y Quintana Roo; para otras regiones hay estudios académicos sueltos y **ningún calendario oficial de SADER/SIAP/INIFAP**. Las licencias no están verificadas: transcribir con cita, no copiar.

## 7. Lo que sigue sin verificar
Licencia y tamaño reales de los conjuntos de Kaggle; BUZZ2/BUZZ3; contenido de la documentación de NU-Hive (tasa de muestreo, hardware, ubicación del micrófono); si la descarga de UrBAN ya funciona; si hay copia pública de los datos de Ramsey; tamaños y exactitudes de los trabajos de TinyML en microcontroladores (PDF bloqueados); plan de frecuencias y ciclo de trabajo oficiales para México; gateways activos en Mérida; precios en pesos; consumo real del nodo completo.
