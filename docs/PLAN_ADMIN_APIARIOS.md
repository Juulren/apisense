# Plan: administración de apiarios y colmenas (solo administradores)

**Estado: guardado, sin implementar** (pedido el 25 nov 2026; primero se termina el Edge AI).

## Lo que se pidió
- La configuración de la colmena con el micrófono o nodo pasa a ser **solo para administradores**.
- Un administrador puede **ver todos los apiarios registrados**, editarlos y eliminarlos, y lo mismo con **sus colmenas**.
- Desde cada colmena el administrador configura su micrófono o nodo.

## Cómo está hoy
- No existe ningún rol de administrador.
- La seguridad de la base (RLS) deja a cada usuario ver y cambiar solo lo suyo.
- **La sincronización de la app descarga todas las filas que RLS le permite ver** (`select *` filtrado solo por fecha).
- La pantalla de vinculación (`/pairing`) la abre cualquier usuario desde su colmena. Para vincular un nodo necesita el código de vinculación; los nodos se registran a mano en `lora_nodes` con SQL.
- El disparador `guard_dev_eui` solo permite poner un DevEUI en un micrófono si **ese mismo usuario** reclamó el nodo.

## Decisiones de diseño
1. **El rol vive en el servidor.** Tabla `app_admins (user_id)` con RLS activada y **ninguna política**, y sin permisos para la app; los administradores se dan de alta **y de baja** desde el panel de Supabase (la baja surte efecto en la siguiente llamada, porque cada función vuelve a comprobarlo). Una función `is_admin()` (`security definer`, `stable`, `search_path` vacío) es la única fuente. Ocultar botones en la app es comodidad, no seguridad.
2. **No se añaden políticas RLS de «el admin ve todo»** a `apiaries`, `hives` ni las demás tablas: como la sincronización descarga todo lo visible, el teléfono del admin se llenaría con los datos de todos los usuarios en su base local. El admin usa **funciones del servidor** (RPC `security definer` que comprueban `is_admin()`, con `search_path` vacío y permisos revocados a `anon`).
3. **La administración funciona solo en línea** y no guarda datos ajenos en el teléfono. La app de campo de cada apicultor sigue funcionando sin conexión.
4. **Eliminar = marcar como eliminado** (`deleted_at`), para que el teléfono del dueño lo reciba al sincronizar y se pueda recuperar desde el servidor. **Hoy la cascada la hace el teléfono** (`removeHive`), no el servidor: la función del admin tiene que hacerla completa y en una sola transacción, y decidir tabla por tabla (colmenas, micrófonos, observaciones, seguimientos, veredictos, avisos pendientes, cola de resúmenes y archivos guardados). Para liberar el DevEUI hay que quitar `dev_eui` del micrófono **y** poner `lora_nodes.owner` en nulo.
5. **Que un teléfono sin conexión no reviva lo borrado:** la app sube la fila entera con `upsert` por `id`, incluido `deleted_at` vacío, así que una edición hecha sin conexión por el dueño devolvería a la vida una colmena borrada por el admin. Hace falta un disparador en el servidor que impida vaciar `deleted_at` salvo a un admin, y comprobar cómo lo recibe la cola de sincronización (que no se quede atascada). Se prueba el caso «el admin borra una colmena que el dueño editó sin conexión».
6. **Registro de auditoría** `admin_actions` (quién, qué, cuándo, valores anteriores), escrito por las propias funciones; la app no puede modificarlo.
7. **Datos mínimos:** las listas muestran apiario, colmenas y dueño (nombre; el correo solo si hace falta para distinguirlos). Las observaciones y bitácoras de un usuario no se muestran en la administración.
8. **Nodos:** el admin puede registrar un nodo (DevEUI y código, guardando solo el hash) y vincularlo o desvincularlo en la colmena de cualquier usuario mediante una función propia, que mantiene la regla de un nodo por colmena y transfiere el dueño en `lora_nodes`. El código de vinculación deja de pedirse al apicultor. Al mover un nodo, primero se quita su DevEUI del micrófono anterior (el índice es único) y después se pone en el nuevo; los veredictos y avisos antiguos se quedan en la colmena donde ocurrieron.

## Fases
| Fase | Contenido | Listo cuando |
|---|---|---|
| 1 | Migración: `app_admins`, `is_admin()`, `admin_actions` y funciones de lectura (apiarios, colmenas, nodo y último veredicto), paginadas | Pruebas: un usuario normal y un anónimo reciben rechazo en todas |
| 2 | Funciones de edición y eliminación, y de registrar, vincular y desvincular nodos | Pruebas de permisos, cascada, DevEUI liberado y auditoría |
| 3 | Pantallas de administración (lista de apiarios → apiario → colmena → nodo), visibles solo si `is_admin()`, con confirmación antes de eliminar | Probado en el emulador con una cuenta admin y una normal |
| 4 | La vinculación y la configuración del micrófono salen de la app del apicultor y quedan solo en administración | Un usuario normal no puede vincular ni por la app ni llamando a la API: `claim_lora_node` queda restringida y, en `iot_microphones`, un no administrador no puede escribir `dev_eui` (tampoco vaciarlo) **ni cambiar `hive_id`** de una fila con nodo (hoy `guard_dev_eui` solo revisa cuando se pone o cambia el DevEUI). La sincronización normal del dueño debe seguir funcionando |

## Por confirmar antes de la fase 3
- ¿Quiénes serán administradores?
- ¿El apicultor puede seguir creando, renombrando y quitando sus propios apiarios y colmenas? (Se asume que **sí**; solo la configuración del micrófono y nodo pasa a ser del admin.)
- Respondido el 26 nov: Bluetooth y MQTT **se quitan**; con el nodo LoRaWAN basta el DevEUI. Todo lo técnico queda en administración y el cliente no lo ve. Falta confirmar si la calibración del micrófono antiguo se quita con ellos (venía de la sección de audio ya retirada).

## Nota sobre el estado intermedio
Hasta implementar la fase 4, **cualquier usuario sigue pudiendo abrir la pantalla de vinculación**, ahora con un botón visible en cada colmena («Vincular nodo de la colmena»). Esa pantalla todavía se titula «Micrófonos IoT» e incluye la búsqueda BLE, la calibración y MQTT, que servían al monitor retirado: las lecturas que crearan ya no se muestran en ningún sitio. En la fase 3 se rehace como configuración del nodo.

## Consecuencias de haber retirado la sección de audio
- La **demo** ya no tiene nada del nodo que mostrar (las colmenas salen «Sin nodo»): sembraba lecturas de audio, no veredictos. Falta decidir si la demo debe incluir un nodo de ejemplo, teniendo en cuenta que antes se pidió quitar las simulaciones.
- La app deja de generar resúmenes acústicos periódicos; las tablas, los datos guardados y la tarea del servidor se conservan.
