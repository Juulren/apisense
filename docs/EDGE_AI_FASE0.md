# Edge AI · Fase 0: recolección y evaluación (protocolo)

Objetivo: saber, con datos reales, si "desviación respecto al sonido habitual de cada colmena" funciona **antes** de escribir una línea de firmware de IA. Herramientas: `tools/edge-ai/`. Contexto: `docs/PLAN_0.3.1_ALERTAS_RESPALDO_Y_EDGE_AI.md` §4 y `docs/INVESTIGACION_AUDIO_ABEJAS.md`.

## 1. Qué se afirma y qué no
- El nodo dirá **0 habitual / 1 diferente**. Nunca la causa.
- No hay evidencia acústica sólida para plaga, escarabajo, pillaje ni estacionalidad. El piping y el "sin reina" no son confiables como señales únicas. No se promete ninguno.
- Los resultados con audio sintético (`synthetic.py`) solo prueban que el programa funciona. **Solo los datos reales cuentan.**

## 2. Material
- ESP32 DevKit V1 + INMP441 (ya los tienen), cable USB, una laptop que se quede cerca.
- Caja o protección contra lluvia y sol; el micrófono dentro de la colmena, en el mismo lugar cada vez (anotar cuál).
- Para grabar días seguidos: alimentación estable (la laptop o un cargador), no la batería del nodo final.

## 3. Cómo grabar
1. Cargar `firmware/capture_inmp441/capture_inmp441.ino` (ajustar los pines).
2. `python -m apisense_audio.capture --port COMx --hive C-01 --minutes 5 --out data/raw --temperature <°C>`.
3. Dejar grabando **al menos 7 días seguidos por colmena**; mejor 14. El día se corta en hora local de Mérida (UTC-6).
4. Revisar cada día los JSON: `lost_percent` y `bad_crc` deben ser casi cero y `host.blocks_per_second` debe estar cerca de 62.5. Si no, revisar cable, puerto y alimentación.

## 4. Qué anotar (es lo que vuelve útil el audio)
- **En la app**, cada visita: usa "Anotar observación" con la hora real (queda con fecha). Esas notas son la etiqueta de contexto.
- **Eventos controlados**, para medir detección: cuando abras la tapa, uses humo, revises cuadros, muevas la caja o veas algo raro, apunta inicio y fin en `data/events.csv`:

```
start,end,notes
2026-11-21T15:02:00-06:00,2026-11-21T15:09:00-06:00,abrí la tapa y revisé cuadros
```
- Un evento en los días de entrenamiento no rompe el análisis: sus ventanas se excluyen de la línea base y no cuentan para la detección. Aun así, los primeros días deben ser vida normal.
- Si la placa se reinicia, se desconecta el cable o la laptop duerme, el archivo se cierra y el siguiente empieza con la hora de la computadora: no se inventa audio. Los huecos chicos (hasta 10 s) se rellenan con silencio y quedan listados en el JSON; las ventanas que los tocan no se entrenan ni se evalúan.

## 5. Evaluación
`python -m apisense_audio.analyze data/raw --hive C-01 --train-days 5 --events data/events.csv --out data/baseline_C-01.json`

Se entrena con los primeros días y se prueba con los últimos. **Nunca** se mezclan ventanas del mismo día entre entrenamiento y prueba (la literatura reporta 99 % con partición aleatoria que cae a 34-84 % con colmenas nuevas).

### Criterios de éxito para pasar a la fase 1 de hardware
| Criterio | Meta |
|---|---|
| Falsas alarmas por día en días normales de prueba | ≤ 1 por colmena |
| Eventos controlados detectados (dentro de 3 ventanas) | ≥ 80 %, con **al menos 10 eventos** (con menos es solo orientativo) |
| Colmenas distintas con resultados parecidos | al menos 2 |
| Datos perdidos (`lost_percent` en cada JSON) | < 1 % |

Si no se cumplen, **no se pasa al firmware**: se ajustan bandas, ventanas y umbrales, o se concluye que el método no alcanza.

## 6. Qué sigue si funciona
1. Portar `features.py` y la regla de decisión al ESP32-S3 (mismas bandas, mismos números) con pruebas en la PC que comparen la salida del nodo con la de Python.
2. Exportar `baseline.json` como arreglos constantes; que la línea base se aprenda en el propio nodo durante los primeros días.
3. Integración LoRa: el mensaje de 8 bytes (clase 0/1) ya lo recibe la app.

## 7. Privacidad y datos
- Las grabaciones no se suben al repositorio (`tools/edge-ai/data/` está ignorado).
- Si el micrófono capta voces o ruido del entorno, evitar conversaciones cerca durante las grabaciones y borrar tramos con voz.
