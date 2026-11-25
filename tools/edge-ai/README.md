# Edge AI · fase 0 (grabar y aprender el sonido habitual de cada colmena)

Herramientas para recolectar audio con el ESP32 DevKit V1 + INMP441 que ya tienes y evaluar el método **antes** de llevar nada al ESP32-S3. No dicen por qué una colmena suena diferente: aprenden cómo suena **esa** colmena a cada hora y marcan 0 (habitual) o 1 (diferente).

Protocolo de grabación y criterios: `docs/EDGE_AI_FASE0.md`.

## Contenido
- `firmware/capture_inmp441/capture_inmp441.ino` — transmite audio crudo (16 kHz, 16 bits) por USB en bloques con número y CRC.
- `apisense_audio/framing.py` — formato de los bloques; detecta y cuenta bloques perdidos o dañados.
- `apisense_audio/capture.py` — guarda WAV + JSON (colmena, hora UTC, huecos) cada N minutos.
- `apisense_audio/features.py` — energía por bandas (20 Hz a 8 kHz), RMS, centroide, frecuencia dominante y planitud; ventanas de 60 s. Es FFT simple, portable a C++.
- `apisense_audio/baseline.py` — línea base robusta por colmena y franja horaria, y regla de persistencia (3 de las últimas 4 ventanas).
- `apisense_audio/evaluate.py` — entrena con los primeros días y prueba con los siguientes; falsas alarmas por día y eventos detectados.
- `apisense_audio/analyze.py` — carpeta de grabaciones → informe y línea base en JSON.
- `apisense_audio/datasets.py` y `phase_a.py` — cargan los datasets públicos (Kaggle beehive-sounds, To bee or not to bee, Open Source Beehives), calculan las mismas características y generan el informe de la fase A (`docs/EDGE_AI_FASE_A_RESULTADOS.md`). Solo comprueban las características; no son una puerta de aprobación.
- `firmware/apisense_edge/edge_features.h` — el detector en C++ (características de ventana, puntuación contra la línea base y regla 3 de 4), sin dependencias de Arduino.
- `firmware/parity_test/` y `apisense_audio/parity.py` — la PC manda audio a la placa, la placa calcula con el código real del nodo y se comparan los números con Python. Resultado del 25 nov: **idénticos** en una grabación propia, una de Kaggle y una de To bee or not to bee; 16,7 ms por trama de 32 ms disponibles.
- `apisense_audio/synthetic.py` — audio sintético **solo para pruebas**. Que pase con audio sintético no dice nada sobre colmenas reales.

## Uso
Requiere Python 3.10+ y `numpy`. Para grabar por USB: `pip install pyserial`.

```bash
cd tools/edge-ai
python -m unittest discover -s tests             # pruebas (sin hardware)

# 1) Carga capture_inmp441.ino al ESP32 (ya usa el cableado de tu prueba por WiFi: SCK 14, WS 15, SD 32, canal derecho) y graba:
python -m apisense_audio.capture --port COM4 --hive C-01 --minutes 5 --out data/raw --temperature 28

# 2) Después de varios días, analiza (los días posteriores a --train-days quedan para probar):
python -m apisense_audio.analyze data/raw --hive C-01 --train-days 5 --events data/events.csv --out data/baseline_C-01.json
```

`data/` está fuera del control de versiones: las grabaciones no se suben al repositorio.

## Límites
- La salida del micrófono es nivel relativo, no SPL calibrado.
- Con pocas colmenas y pocos días, los números son orientativos; ver el protocolo.
- Un baseline por colmena no distingue una causa. La app nunca debe afirmar reina, plagas o enjambrazón.
