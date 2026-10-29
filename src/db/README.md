# Persistencia y sincronización

Una base SQLCipher por cuenta y otra exclusiva para demo, con claves por cuenta y tokens de Auth en SecureStore. `openRepository.ts` es la implementación para Android e iOS: comprueba SQLCipher antes de inicializar el esquema y rechaza la apertura si no está disponible. La verificación del cifrado y del llavero en dispositivos sigue en #15. Los datos de dominio se leen y escriben exclusivamente en Repository. Cada escritura y su entrada en sync_queue se confirman en una transacción; local_revision impide que un ACK antiguo borre una edición nueva. Borrados se representan con deleted_at.

Los clips WAV se codifican como datos dentro de la misma base cifrada mediante `InlineClipStore`; ese módulo también se usa en nativo. Se retiraron IndexedDB, Web Locks y snapshots del navegador en #27. Su evidencia histórica se conserva en [WEB_STORAGE_QA.md](../../docs/WEB_STORAGE_QA.md).

Se suben padres antes de hijos, con claves UUID e idempotencia por id. Un clip se carga en el bucket privado antes del registro que lo referencia. Los errores conservan la cola y aplican backoff de 1s a 5min. El proceso despierta por cambios de red y cada 15s en primer plano. No se promete ejecución en segundo plano con el proceso suspendido.

La descarga ordena updated_at/id, pagina a 200 registros y solo avanza el checkpoint tras todas las tablas. Se usa reloj del servidor y solapamiento de 2min; no sustituye un registro transaccional CDC: una transacción remota que permanezca abierta más de ese margen requiere una resincronización completa (borrar solo el checkpoint). Los datos locales pendientes prevalecen; las escrituras confirmadas usan última escritura en servidor. No hay fusión de campos entre dos dispositivos.

No hay claves de servicio en el cliente. RLS limita apiarios/colmenas a su propietario y el bucket es privado. La migración añade timestamps a micrófonos y muestras para poder hacer pull incremental. Inspecciones es una tabla adicional necesaria para la bitácora. Las migraciones se aplican con Supabase CLI, nunca mediante el cliente móvil.
