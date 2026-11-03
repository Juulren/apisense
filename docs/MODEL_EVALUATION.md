# Preparación y evaluación del modelo — #8

3 de noviembre de 2026. Herramientas offline para preparar grabaciones y evaluar **predicciones suministradas**. No entrenan, descargan ni ejecutan ONNX; no cambian la app ni envían audio a servicios externos. La ejecución Android y la aceptación científica siguen pendientes.

## Comprobar el proceso

Con Node.js 24 y `npm ci`, desde la raíz:

```powershell
New-Item -ItemType Directory .artifacts -Force
npm run model:fixture -- .artifacts/model-fixture
npm run model:prepare -- .artifacts/model-fixture/dataset.json .artifacts/model-fixture/prepared.json
npm run model:evaluate -- .artifacts/model-fixture/prepared.json .artifacts/model-fixture/predictions.test.ndjson .artifacts/model-fixture/model.synthetic.json .artifacts/model-fixture/report.json
```

El directorio de fixture debe ser nuevo. Los archivos de salida no se sobrescriben: usa otro nombre por experimento. La fixture crea quince tonos, etiquetas asignadas y predicciones fabricadas. Su manifiesto dice `NO-MODEL` y contiene un hash ficticio; no existe ONNX asociado. El reporte devuelve `synthetic-tooling-check-only`. Sus métricas no describen abejas ni un modelo entrenado. Las regresiones ejecutan los comandos completos.

## Dataset real

JSON con WAV relativos a su directorio o subdirectorios. Reemplaza los valores del ejemplo por recursos propios:

```json
{
  "schemaVersion": 1,
  "name": "campania-identificador",
  "license": "licencia o autorización documentada",
  "provenance": "origen y protocolo de captura/anotación",
  "synthetic": false,
  "sampleRateHz": 16000,
  "seed": "campania-v1-congelada",
  "groupBy": "apiary",
  "clips": [{
    "id": "clip-001",
    "recordingId": "grabacion-original-001",
    "apiaryId": "apiario-001",
    "hiveId": "colmena-001",
    "deviceId": "microfono-modelo-y-unidad-001",
    "recordedAt": "2026-11-03T10:00:00-06:00",
    "label": "unknown",
    "verifiedBy": "identificador del anotador",
    "annotationMethod": "inspección y criterio documentado",
    "wav": "clips/clip-001.wav",
    "sha256": "REEMPLAZAR_POR_HASH_REAL_DE_64_HEX"
  }]
}
```

Se requieren al menos tres grupos independientes. Las ventanas de una grabación conservan su `recordingId`. Solo se admiten las cinco clases del contrato de la app. La procedencia/licencia/anotación son obligatorias, pero una cadena no prueba su veracidad: debe revisarla el responsable científico. `unknown` tampoco sustituye un protocolo de anotación.

WAV: PCM16 mono, 0,01–30 s, máximo 1 MiB y tasa igual a la declarada. Se valida SHA-256 y se rechazan rutas absolutas/escapes/enlaces fuera del dataset, copias exactas, IDs duplicados, una colmena en dos apiarios y grabaciones compartidas entre grupos. No hay resampling. Los MFCC se recalculan con **el mismo módulo de la app**, después de decodificar PCM16; no se aceptan características arbitrarias como entrada.

## Separación y normalización

`model:prepare` ordena hashes de semilla/ID y asigna grupos completos. Reserva `max(1, floor(grupos × 0,2))` grupos a test y otros tantos a validación; el resto a entrenamiento. Es reproducible e independiente del orden de clips. Los porcentajes son de grupos, no de clips; no garantiza equilibrio de clases. No cambies semilla para escoger un test favorable.

Usa `groupBy: apiary` para separar apiarios. `hive` produce un aviso: no acredita generalización entre apiarios. Los IDs deben reflejar el origen real. Un recorte/recodificación cambia el hash; la trazabilidad de la grabación original sigue siendo necesaria.

El preparado conserva particiones, hashes, metadata, MFCC crudos, cobertura por clase y avisos. **Media y desviación poblacional se ajustan solo con train.** Coeficientes constantes usan desviación 1 con aviso. El entrenamiento externo debe aplicar esa transformación. Selecciona arquitectura, umbral y calibración con train/validation; reserva test para evaluación final. El CLI no impide experimentos externos que incumplan el protocolo.

Estas decisiones siguen las guías de scikit-learn sobre [grupos](https://scikit-learn.org/stable/modules/cross_validation.html#cross-validation-iterators-for-grouped-data) y [fuga de datos](https://scikit-learn.org/stable/common_pitfalls.html#data-leakage); la implementación es propia y no añade esa dependencia.

## Predicciones

Exporta una línea por clip de la partición, usando el preprocesamiento y normalización del manifiesto:

```json
{"id":"clip-001","modelSha256":"HASH_REAL_ONNX_EN_MINUSCULAS","probabilities":[0.1,0.1,0.1,0.1,0.6]}
```

```powershell
npm run model:prepare -- ruta/dataset.json .artifacts/prepared-v1.json
npm run model:evaluate -- .artifacts/prepared-v1.json ruta/predictions.ndjson ruta/model-manifest.json .artifacts/report-v1.json test
```

Para seleccionar parámetros usa `validation` como último argumento. No evalúa train. El manifiesto cumple `ModelContract.ts`, con tasa/clases/nombres/versión/normalización/umbral/hash. Se aplica **la misma función `modelResult` de la app**, con su tolerancia de suma, sin renormalizar ni recalibrar salidas. Se rechazan predicciones duplicadas, faltantes, ajenas a la partición, con hash declarado distinto o probabilidades inválidas; también particiones alteradas y normalización incompatible.

Se registran hashes de los tres archivos de entrada. El hash ONNX es **declarado**: este CLI no lee sus bytes ni demuestra qué modelo produjo las predicciones. Conserva la exportación/comando externo y valida después inferencia nativa y vectores de referencia. El cargador Android sí verifica los bytes al cargar un modelo. Un reporte real queda `unreviewed-offline-evaluation`, nunca aprobado automáticamente.

## Métricas y límites

- Matriz: filas = anotación, columnas = salida tras umbral; orden `healthy, swarming, queenless, pest_disturbance, unknown`.
- Precision/recall/F1 y soporte por clase. Sin soporte, recall/F1 son `null`; sin predicciones, precision es `null`. `macroF1Supported` promedia clases presentes y no acredita las ausentes.
- Exactitud sobre todos los clips. `coverage` excluye todas las salidas unknown; `unknownRate` incluye clase explícita y abstención. `selectiveAccuracy` usa solo salidas distintas de unknown y es `null` si no hay ninguna. Unknown conserva su fila/columna y cuenta en la exactitud total.
- Log loss con piso 1e-15; Brier multiclase como **suma** de errores cuadrados por muestra; diez bins uniformes y ECE ponderado de la confianza del máximo original, antes del umbral.
- Las mismas métricas por `deviceId`, con soporte visible. Pocas muestras no acreditan generalización.

Consulta las [definiciones de métricas](https://scikit-learn.org/stable/modules/model_evaluation.html#classification-metrics) y [calibración](https://scikit-learn.org/stable/modules/calibration.html). No se fija precisión mínima sin datos ni criterio apícola. Tamaño de muestra, incertidumbre, prevalencias, falsas alarmas y criterios por clase requieren revisión científica. ECE/log loss/Brier no certifican por sí solos calibración en campo.

Pendientes: dataset autorizado y anotaciones verificadas; entrenamiento/exportación ONNX externa; paridad numérica y probabilidades en Android; evaluación independiente por apiario/dispositivo; latencia/memoria, calibración de captura y revisión apícola de errores. No se incorpora un modelo sintético al APK ni se modifica backend, hardware, broker o credenciales. #8 sigue abierto; #15/#27 e iOS continúan en pausa.

Conserva grabaciones y resultados privados en `.artifacts/` o un almacén autorizado fuera del repositorio; no subas audio ni identidades de campo sin autorización.
