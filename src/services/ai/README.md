# Bioacústica

acoustics.ts implementa FFT radix-2 con ventana Hann (2048), 26 filtros Mel y DCT de 13 MFCC promediados en hasta 64 ventanas distribuidas del clip, RMS dBFS y planitud espectral. La representación es una especificación concreta: un modelo entrenado con otro preprocesamiento no es compatible sin adaptación.

OnnxModel usa ONNX Runtime web/WASM o nativo. Verifica SHA-256, normaliza con mean/std de su manifiesto y exige tensor float32 [1,13] de entrada y cinco probabilidades de salida (healthy, swarming, queenless, pest_disturbance, unknown). Para web se debe servir el directorio WASM de la misma versión instalada y pasar su URL base. El modelo no se descarga implícitamente ni se inventa. Sin modelo, AcousticClassifier usa reglas experimentales y se abstiene en el solapamiento 400–550Hz. Estas puntuaciones no son probabilidades calibradas.

No se proporcionó modelo entrenado, dataset de abejas etiquetado ni su manifiesto. La app arranca con reglas claramente identificadas. No puede confirmar reina, plagas ni enjambrazón. #8 mantiene abierta la validación científica y en hardware.

HiveSummaryEngine genera resúmenes en español sin red, con IDs deterministas según colmena/período/versión; ejecuciones repetidas con las mismas muestras son idempotentes. runDue respeta check_interval_minutes en primer plano. Los resúmenes de demo conservan SIMULACIÓN y no se suben.

La Edge Function valida el JWT del usuario y utiliza RLS, o acepta un secreto de cron de alta entropía que se compara por hash. verify_jwt=false es intencional: la autorización se comprueba dentro de la función para admitir cron y usuarios. El secreto solo vive en Supabase Functions y Vault, nunca en Expo. Cron dispara cada minuto; cada apiario mantiene su intervalo. Límite inicial: 500 colmenas por ejecución y 1000 muestras más recientes por ventana; ampliar con colas y paginación antes de escalar. Una etiqueta crítica requiere tres muestras de modelo con score >=0.8 y mayoría en la ventana; las reglas experimentales no disparan estado crítico.

Despliegue: aplicar migraciones y desplegar función; configurar CRON_SECRET y secretos Vault apisense_project_url/apisense_cron_secret con el mismo valor. No se desplegó en esta sesión por falta de proyecto/credenciales. Tampoco se ejecutó Supabase local: Docker está instalado, pero el daemon no está activo.
