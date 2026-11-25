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
- `firmware/parity_test/` y `apisense_audio/parity.py` — la PC manda audio a la placa, la placa calcula con el código real del nodo y se comparan los números con Python. Resultado del 25 nov: **idénticos** en una grabación propia, una de Kaggle y una de To bee or not to bee; calcular cuesta unos 3,7 ms por trama de 32 ms disponibles (medido en el firmware del nodo; el dato anterior de 16,7 ms incluía la espera del puerto USB y estaba inflado).
- `firmware/apisense_edge/edge_learn.h`, `edge_node.h`, `edge_storage.h` — fase C: el nodo aprende solo su línea base (guarda las últimas 64 ventanas de cada franja de 3 h, ~49 KB, y calcula mediana/MAD exactas), espera 7 días con datos, aplica la regla de deriva con tope (solo entran ventanas habituales, sin alarma, y el umbral no se mueve), tiene estado «sin reloj» y comando de reinicio. `edge_storage.h` lo guarda en flash (Preferences + LittleFS) con CRC.
- `firmware/learn_test/` y `apisense_audio/learn_parity.py` — banco de pruebas de la fase C en la placa: la línea base aprendida es igual a `HiveBaseline.fit`, y se comprueba la deriva, la línea de tiempo de 7 días, la recuperación tras un corte de energía y el reinicio. Corre con `python -m apisense_audio.learn_parity --port COM3` (cargar `learn_test` primero; vuelve a cargar el sketch de captura después).
- `firmware/apisense_edge/edge_payload.h` y `apisense_audio/uplink_sim.py` — fase D sin radio: el mensaje de 8 bytes del nodo (con la bandera «aún no juzga») y un emisor simulado que hace de gateway hacia `lora-uplink`. `python -m apisense_audio.uplink_sim check --port COM3 --fixture ../../supabase/tests/fixtures/node_uplinks.json` compara la placa con un codificador independiente y regenera el fixture que usan los tests de la app (requiere `learn_test` cargado). `send` manda uplinks de prueba a un proyecto propio (secreto en la variable de entorno `UPLINK_SECRET`).
- `firmware/apisense_node/` y `apisense_audio/bridge.py` — **el firmware del nodo**: escucha con el INMP441 (mismo procesamiento que el sketch de captura), aprende, juzga y arma el mensaje de 8 bytes. Sin radio todavía: lo imprime por USB y el puente le da la hora, lo muestra y, si se pide, lo reenvía a `lora-uplink`. Compilación de campo: ventana de 60 s cada 10 min y 7 días de aprendizaje. Compilación de banco (`--build-property "compiler.cpp.extra_flags=-DAPISENSE_BENCH"`): ventanas de 5 s seguidas y unos 3 minutos de aprendizaje, **solo para comprobar la cadena**. Cambiar de compilación borra lo aprendido.
- `apisense_audio/replay.py` — pasa colmenas reales (características de Kaggle) por la lógica del nodo en la placa (`learn_test`) y resume las alarmas por estado de reina. Resultados y límites en `docs/EDGE_AI_FASE_A_RESULTADOS.md`. No escribe en la flash.
- `apisense_audio/pretrain.py` — entrena en la placa un modelo inicial con las ventanas normales de los datasets y lo guarda en la flash (cargar antes `learn_test`; después `apisense_node` con `-DAPISENSE_QUICK`). **No sirve para vigilar una colmena** (ver los resultados); solo demuestra la cadena.
- `apisense_node` tiene además el modo rápido `-DAPISENSE_QUICK`: ventanas de 60 s seguidas, listo tras 30 (unos 31 min).
- `conectar_nodo.cmd` — **doble clic para usar el ESP32 por USB como si ya hubiera radio**: encuentra la placa sola (espera si no está y vuelve a conectar al enchufarla) y sube sus veredictos a `lora-uplink`; no guarda ni sube audio. Lee `data/nodo.cmd` (fuera de git) con `UPLINK_URL` y `DEV_EUI`, y pide el secreto sin mostrarlo ni guardarlo (o usa la variable `UPLINK_SECRET` si existe). La ventana y la PC tienen que seguir abiertas. Es lo mismo que `bridge --port auto`.
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
