# Persistencia y sincronización

Una base SQLite por cuenta y otra exclusiva para demo; Auth se conserva en SecureStore nativo y almacenamiento de sesión web. Los datos de dominio se leen y escriben exclusivamente en Repository. Cada escritura y su entrada en sync_queue se confirman en una transacción; local_revision impide que un ACK antiguo borre una edición nueva. Borrados se representan con deleted_at.

Se suben padres antes de hijos, con claves UUID e idempotencia por id. Un clip se carga en el bucket privado antes del registro que lo referencia. Los errores conservan la cola y aplican backoff de 1s a 5min. El proceso despierta por cambios de red y cada 15s en primer plano. No se promete ejecución en segundo plano con el proceso suspendido.

La descarga ordena updated_at/id, pagina a 200 registros y solo avanza el checkpoint tras todas las tablas. Se usa reloj del servidor y solapamiento de 2min; no sustituye un registro transaccional CDC: una transacción remota que permanezca abierta más de ese margen requiere una resincronización completa (borrar solo el checkpoint). Los datos locales pendientes prevalecen; las escrituras confirmadas usan última escritura en servidor. No hay fusión de campos entre dos dispositivos.

No hay claves de servicio en el cliente. RLS limita apiarios/colmenas a su propietario y el bucket es privado. La migración añade timestamps a micrófonos y muestras para poder hacer pull incremental. Inspecciones es una tabla adicional necesaria para la bitácora. Las migraciones se aplican con Supabase CLI, nunca mediante el cliente móvil.
