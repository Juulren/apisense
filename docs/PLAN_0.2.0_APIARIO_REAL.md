# Plan 0.2.0 — Apiario real, editable y menos saturado

Fecha: 2026-11-09. Estado: **aprobado con cambios del asesor (ver última sección)**; en implementación.
Base: rama `claude/multi-model-workflow-setup-e3ecba` (0.1.4, navbar fijo, transiciones, tema).

## Pedido del dueño (resumen fiel)

1. Cada cliente agrega, edita y quita **sus** colmenas según su apiario real.
2. **Ubicación y clima** del dashboard configurables, **sin pedirlos en el registro** (pueden estar mal al registrarse).
3. Cada colmena con **notas** (apartado simple, no agenda diaria): limpio, rápido, directo.
4. App menos abrumadora: solo lo esencial.
5. **Tracker (círculo) funcional y editable con datos reales**: lo observado cada día (con reina, sin reina, reina virgen…) determina el estado de la colmena; el círculo indica según la fecha y la **ubicación** la temporada (enjambre, flujo, escasez). Investigar para que sea correcto.
6. Continuar de forma autónoma; compilar con CI; probar en el teléfono (el equipo es lento).

## Hallazgos del código que condicionan el diseño

- **No existe clima en la app** (ni UI ni datos). El "clima" que recuerda el dueño viene de los mockups de Stitch. Hay que **crearlo**, no editarlo.
- "Apiario Central · Maní" y "Mateo" son solo datos del demo (`src/state/demo.ts`). `apiaries` ya guarda `latitude`/`longitude`; no hay zona horaria ni UI para editar un apiario tras crearlo.
- Colmenas: se crean (`hives.tsx`, `repo.save` directo) pero **no se editan ni se quitan**. `Repository` no tiene borrado: solo tombstone (`deleted_at`) y **no cascada** a hijos.
- `inspections` guarda `notes` (≥10 caracteres), `tags_json`, `queen_seen`; no hay estado de reina/cría. `hives.queen_status` y `health_score` nunca se usan. El estado de la colmena hoy es **solo acústico** (reglas experimentales).
- `brood_cycles` guarda solo la **última** etapa observada; el selector marca "huevo" por defecto (guardar sin elegir registra un huevo: error a corregir).
- Columna nueva = declarar en `columns` (schema.ts), `types.ts`, migración local **y** migración SQL remota; si falta en `columns` se descarta en silencio.
- Detalle de colmena tiene 12 bloques apilados; dashboard repite botones (dos van a `/hives`).

## Biología y estacionalidad (investigación; ver fuentes al final)

- Desarrollo huevo→emergencia: **reina ~16 d, obrera ~21 d, zángano ~24 d** (reina hasta 17–18 d con frío/calor).
- Reina emergente tras quedar sin reina: emergencia ~10–12 d tras iniciar celdas; vuelos de apareamiento ~5–10 d tras emerger; puesta unos días después. Estimación honesta: **3–5 semanas desde el inicio de celdas**, siempre como **rango**.
- Reina presente = reina vista **o** huevos frescos (los huevos son la evidencia más fiable). Sin reina = sin huevos ni larvas jóvenes + celdas reales/desorden. "Reina virgen en espera" = emergió/celda operculada y aún sin huevos; "vencida" si pasan ~4 semanas sin huevos.
- Estacionalidad: **no hay calendario universal**. Latitud da hemisferio; en trópico mandan lluvias/secas y flora local. Para Yucatán solo hay reportes de apicultores/prensa (tajonal ≈ ene–mar; frentes fríos y lluvias lo afectan), **sin calendario técnico verificado**. Diseño: presets **orientativos** (templado N, templado S, tropical, «Península de Yucatán, según reportes de apicultores») + meses **editables por apiario** (flujo principal, escasez, riesgo de enjambre, lluvias, flora local). **Sin “probabilidad de enjambre”.** Recordatorios reales vienen de observaciones (celdas reales, hacinamiento), no del calendario.
- Clima: Open-Meteo (sin clave): `api.open-meteo.com/v1/forecast` (`current=temperature_2m,relative_humidity_2m,precipitation,wind_speed_10m`) y `geocoding-api.open-meteo.com/v1/search`. Plan gratuito **solo no comercial** (límites 600/min, 10 000/día por IP); si la app se vende a clientes probablemente cuenta como comercial → **decisión del dueño antes de lanzar**. Datos CC-BY 4.0 (atribución). Privacidad: se envían coordenadas+IP a un tercero.

## Decisiones de diseño (propuestas)

D1. **Clima opt-in** por apiario, con coordenadas redondeadas a 2 decimales, caché local con hora ("hace X min") y fallback sin red; **nunca bloquea** guardar nada. En demo no hay llamadas (el demo dice "sin envío a nube"). Interfaz `WeatherProvider` para cambiar a un proxy propio sin tocar pantallas. Atribución visible.
D2. **Búsqueda de lugar** (geocoding) para quien no conoce latitud/longitud, además de entrada manual. Sin GPS del teléfono (no se agregan permisos de ubicación).
D3. **Quitar colmena = tombstone con cascada** (inspecciones, ciclos, micrófonos, lecturas) en **una transacción**, con confirmación explícita y texto de que desaparece de la app (el servidor conserva el tombstone). Quitar apiario solo si no tiene colmenas activas. Sin hard delete.
D4. **Una sola entrada “Anotar”** (reutiliza `inspections`, sin tabla nueva): texto + sección plegable “Estado observado” (reina: vista/no vista/virgen/celdas reales; huevos; cría; temperamento). Regla: texto ≥3 caracteres **o** algún campo estructurado (cambia la regla anterior de ≥10; actualizar `HIVE_WORKFLOWS.md` y pruebas).
D5. **Estado de la colmena derivado de observaciones del apicultor, nunca del audio**: reglas arriba, mostrando siempre la fecha de la evidencia ("según observación del 6 nov"); sin observaciones en 21 d → "Sin datos recientes". Orientativo, sin diagnóstico ni tratamientos. El estado acústico existente sigue separado y etiquetado.
D6. **Tracker con tipo de cuadro**: obrera 21 d, reina 16 d, zángano 24 d (umbrales de etapa por tipo, orientativos). Tras emergencia de **reina** (confirmada a mano) se muestra la **ventana esperada de apareamiento/puesta** como rango de fechas y se invita a registrar "huevos vistos" (que resuelve el estado). Se corrige el valor por defecto "huevo" (hay que elegir).
D7. **Temporada** visible (dashboard y detalle): periodo actual según el calendario del apiario + aviso "orientativo, ajústalo a tu zona".
D8. **Menos saturación**: Dashboard = saludo/apiario (+ clima compacto) → estado general compacto → aviso solo si existe → colmenas (un solo acceso a gestionar). Detalle = cabecera + “Anotar” → Estado de la colmena → Tracker → Notas; **lecturas acústicas, resumen y métricas plegadas** por defecto.
D9. Ajustes gana sección “Apiario” (nombre, lugar/coordenadas, temporadas, clima opt-in).

## Hitos (un commit por hito; PR al final; versión 0.2.0 / código 6)

- **H1 Datos y migraciones**: esquema local v3 (`apiaries`: preset de zona, `seasons_json`, `weather_enabled`; `inspections`: `queen_state`, `eggs_seen`, `brood_state`; `brood_cycles`: `kind`), `types.ts`, migración SQL remota nueva, pruebas PGlite y migración v2→v3.
- **H2 Colmenas y apiarios**: editar/quitar (servicio con cascada transaccional + pruebas), pantalla de edición.
- **H3 Notas/Anotar** unificadas (D4) + lista de notas en el detalle.
- **H4 Estado y tracker**: servicio de estado derivado (D5), tipos de cuadro y ventana de reina (D6), corrección del valor por defecto, pruebas unitarias exhaustivas de límites de fecha.
- **H5 Apiario, lugar y clima**: edición en Ajustes, geocoding, clima con caché, temporadas y presets (D1, D2, D7, D9).
- **H6 Menos saturación** (D8) y revisión visual.
- **H7 Verificación**: typecheck, `npm test`, bundle Android, CI (APK arm64+x86_64), instalación en el S21 Ultra por USB, actualización de docs/plan/README.

## Riesgos y decisiones que dependen del dueño

1. **Migración remota**: columnas nuevas fallan en `upsert` hasta aplicar la migración al Supabase de desarrollo. Se escribe y prueba con PGlite; **aplicarla requiere autorización explícita** (no se hace sola). Hasta entonces el APK 0.2.0 no debe usarse con cuenta real.
2. **Open-Meteo comercial**: confirmar plan/licencia antes de distribuir a clientes.
3. Calendario de Yucatán sin fuente técnica: se presenta como orientativo y editable; conviene validarlo con un apicultor local.
4. Cambiar la regla de ≥10 caracteres de notas (D4) altera criterios aceptados antes.

## Fuera de alcance

iOS (en espera), #15 y #27 (pausados), modelo acústico real (#8), sitio web, publicación en tienda.

## Fuentes (de la investigación; varias son resúmenes, verificar antes de citar como técnicas)

- Ciclos de vida: latiendadelapicultor.com (blog "honey bee life cycle"), beeprofessor.com/lifecycle-of-a-honey-bee, UC ANR.
- Yucatán (prensa regional, no técnica): poresto.com 2026-01-23 (tajonal), 2026-01-29 (frentes fríos), yucatan.com.mx 2026-06-18 (enjambres Tizimín).
- Open-Meteo: open-meteo.com/en/docs, /en/docs/geocoding-api, /en/terms.

## Revisión del asesor (Opus, 2026-11-09): decisiones adoptadas

El plan queda **aprobado con estos cambios, que prevalecen sobre las secciones anteriores**:

**Datos y sincronización**
- La versión local pasa a 3: subir el guard `version > 2` de `Repository.initialize` y añadir `migrationV3`; prueba abriendo una base v2 **con datos**.
- Migración **solo aditiva** (columnas nulables o con default; `kind` con default `'worker'` y CHECK, igual en local y remoto). Hasta aplicar la migración remota, `upsert` falla con columna desconocida y reintenta (no se pierde nada, pero parece roto): **no instalar 0.2.0 con cuenta real antes de autorizar y aplicar la migración**. Un dispositivo 0.1.4 que edite filas no borra las columnas nuevas del servidor (se prueba).
- Quitar colmena: **un método único en `Repository`** con `BEGIN IMMEDIATE` que usa `insert` y la cola directamente (llamar a `save()` anidado provoca bloqueo). Se marcan tombstone la colmena, sus micrófonos, inspecciones y ciclos. **Lecturas (`audio_samples`) y `ai_summaries` no se marcan**: se ocultan por estado de la colmena al leer (evita subir WAV de lecturas borradas y miles de upserts). La ingesta (BLE/MQTT) rechaza colmenas borradas.
- Los servicios de edición **rechazan padres con tombstone** (hoy `save()` pone `deleted_at: null` si no se indica y reviviría el registro).
- `kind` entra en la lista blanca de campos (`BroodCycle.ts` `input()`); el tope de 21 y el límite de larva pasan a valores por tipo.
- Quitar apiario: **diferido** (en la práctica un apiario por usuario).

**Biología (suavizada)**
- Etapas por tipo, siempre «± 1–2 días»: obrera larva 4–9, operculada ≈9–21; reina operculada ≈8, emerge ≈16; zángano operculada ≈10, emerge ≈24.
- Opción «huevos múltiples / obreras ponedoras» (varios huevos por celda no indican reina). Huevos solo evidencian puesta de los últimos ~3 días.
- No se afirma «sin reina»: se muestra **«Posible falta de reina: revisar»**. Celda operculada ≠ reina virgen. «Vencida» se sustituye por «sin puesta tras ~3–4 semanas desde la emergencia: revisar».
- El estado de la colmena es **derivado**, no se escribe en `hives.queen_status`; la evidencia de reina caduca a los **7–10 días**.
- Calendario de temporada: **sin preset por defecto**; el de Yucatán se etiqueta «según reportes de apicultores». El clima se rotula «pronóstico/modelo, no medido en el apiario».
- Corregir el valor por defecto «huevo» respetando el CHECK local `observed_stage = unknown ⇔ observed_at`.

**Alcance y orden**
- Orden: H1 (local) → H2 → H3 → H4 → H6, luego H5.
- **H5 se parte**: (a) coordenadas manuales y temporadas editables; (b) clima y búsqueda de lugar con Open-Meteo, **opcionales y desactivados por defecto**, detrás de `WeatherProvider`, hasta que el dueño confirme la licencia y acepte enviar coordenadas a un tercero. Nada se envía en el demo.
- Requieren **OK explícito del dueño**: aplicar la migración remota, activar llamadas a terceros en la distribución, y el cambio de la regla de notas (≥3 caracteres o campo estructurado; actualizar `inspection.tsx`, `.maestro/extended-states.yaml`, `HIVE_WORKFLOWS.md` y pruebas juntos).

**Faltantes añadidos**: prueba de pull de colmena con tombstone y hijos vivos desde otro dispositivo; fixtures del demo para columnas nuevas (separados de datos reales); `versionCode` 6 y prueba de actualización 0.1.4→0.2.0 sin borrar datos.

## Cambio de rumbo del dueño (2026-11-09, tarde) — prevalece sobre todo lo anterior

1. **Real, no demo.** Lo de Stitch/demo no se toma como referencia funcional; se construye la app real.
2. **Open-Meteo aprobado** por el dueño: proyecto personal, sin comercialización por ahora. El clima se activa por apiario (se puede apagar); no se usa en el demo. Si el proyecto se comercializa, hay que revisar la licencia entonces.
3. **El tracker es un tracker de TEMPORADA tipo app de ciclo**, no de biología de reina: un círculo que muestra en qué fase del año está el apiario según su ubicación (flujo, escasez, recuperación…), con **registro opcional diario o semanal** que lo vuelve más preciso; **en blanco** muestra información general de la temporada. El dueño no pide investigar la biología de la abeja, sino qué le pasa a la **colmena** por temporada (se van, desaparecen, escasez…).
4. **Adaptado a la ubicación**: primer destino Yucatán (Mérida y estado). Fuera de Yucatán no hay calendario verificado: se ofrece calendario **personalizado** (vacío, editable mes a mes).
5. **Pruebas solo en emulador** (el dueño no tiene el teléfono Android por ahora): CI → APK → emulador, como hasta ahora.

### Qué se descarta
Tipo de cuadro reina/zángano y ventana de apareamiento (D6), estado derivado «de reina» como veredicto. `brood_cycles.kind` **eliminado** del esquema v3 (aún no publicado). El seguimiento de cuadros de cría de 21 días **se conserva** (ya está aceptado en 0.1.2) pero pasa a sección opcional plegada.

### Nuevo diseño del tracker
- **Anillo anual** (12 segmentos coloreados por fase, marcador de hoy). Centro: fase actual + mes. Debajo: cuándo cambia la fase y qué suelen vigilar los apicultores (descriptivo, sin dosis ni tratamientos).
- **Registro rápido** (≤30 s, todo opcional): actividad (baja/normal/alta), población (baja/estable/sube), reservas (bajas/medias/altas), reina vista/no vista/virgen, huevos (ninguno/frescos/varios por celda), celdas reales, nota libre. Frecuencia por apiario: diario, semanal o sin registro. Tira de los últimos 14 días con puntos donde hay registro.
- **Señales** (sin veredictos): combinan fase + últimos registros, p. ej. «Reservas bajas en época de escasez: revisa la colmena», «Población bajando en 2 registros seguidos», «Celdas reales vistas: confirma si es enjambrazón o reemplazo», «Sin registros recientes: mostrando información general».
- Apiario: ubicación y calendario editables en Ajustes; clima actual (temperatura, humedad, viento, lluvia) con hora del dato y «pronóstico/modelo, no medido en el apiario»; sin red, último dato guardado.

### Calendario de Yucatán (síntesis de la investigación; **orientativo**)
Fuentes técnicas: CONABIO (Ciencias 118-119), INIFAP/ITC (Tucuch-Haas et al. 2020), Ecofronteras 2022. Fuentes de prensa/productores (Por Esto, Diario de Yucatán, BM Editores) para frentes fríos, enjambres 2026 y pre-cosechas. **No hay calendario mensual técnico publicado**; no hay datos medidos de enjambrazón ni abandono por mes; las normales climáticas CONAGUA/SMN no se obtuvieron (se usó WeatherSpark, confianza baja-media).

| Mes | Fase | Notas (confianza) |
|---|---|---|
| Ene | Flujo | Tajonal inicia (media-alta); nortes intensos; frío <12 °C frena pecoreo y puede marchitar la flor (media) |
| Feb | Flujo | Tajonal y ts'its'ilché (media); cosecha (T1) |
| Mar | Flujo | Ts'its'ilché y jabín (alta jabín) |
| Abr | Flujo | Ts'its'ilché y jabín; mes más caluroso |
| May | Flujo → transición | Final del flujo seco; inicio de lluvias ≈ fin de mayo |
| Jun | Escasez | Mínimo de néctar y polen en Mocochá (alta, zona norte-centro); inicia temporada de huracanes |
| Jul | Escasez | Crisis asociada a lluvias (alta, T1) |
| Ago | Escasez | Idem; mayor actividad ciclónica ago–oct (general, a verificar con SMN) |
| Sep | Escasez | Máximo de lluvia (baja-media) |
| Oct | Recuperación | Enredaderas y anuales fortalecen colonias (alta T1); primeros frentes fríos; pre-cosechas (una fuente) |
| Nov | Recuperación | Enredaderas, xtabentún (media); fin de temporada de huracanes (30-nov) |
| Dic | Recuperación | Pre-flujo del tajonal; nortes; alimentar si fallan las enredaderas (una fuente) |

Avisos obligatorios en la app: el calendario es una guía y **no una promesa**; las floraciones se mueven entre años (p. ej. ts'its'ilché en nov-dic, feb-mar o may-jul según el año en Mocochá); sequías, ciclones y frentes fríos desplazan o cancelan flujos; hay un gradiente de lluvia de ~400 mm (norte) a ~2000 mm (sur) y no se cuantificó cuánto cambia el calendario entre costa norte, oriente y sur. No se afirma relación con El Niño (sin fuentes).

### Hitos revisados
H1 esquema v3 (hecho; ajustado) → **H2 colmenas** (hecho; en verificación) → H3 registro rápido (pantalla de anotar ampliada; regla de nota ≥3 caracteres **o** algún campo) → H4 servicio de temporadas + anillo + tracker de colmena + señales (pruebas de límites de mes/fecha) → H5 ubicación, clima Open-Meteo con caché y búsqueda de lugar, calendario editable, frecuencia de registro → H6 menos saturación → H7 verificación (typecheck, pruebas, bundle, CI, emulador, docs).

### Adendo tras la segunda revisión de Opus (tracker de temporada) — adoptado

- **Nombres de fase más prudentes**: «Flujo (habitual)», «Época difícil / poca floración», «Reactivación», «Transición». El centro del anillo dice **«Fase típica: …»**, nunca «actual». Si los registros del usuario contradicen el calendario (p. ej. reservas altas en julio), **mandan los registros** y la pantalla lo dice.
- Cada mes muestra su **confianza** (alta/media/baja) y «fuente única» donde aplique; etiqueta fija «referencia: centro-norte de Yucatán» (los datos de Mocochá no se aplican en silencio al sur u oriente).
- **Señales** describen lo que el usuario anotó, no una tendencia medida («Anotaste reservas bajas; en esta época suele haber poca floración. Considera revisarla.»; «Anotaste población baja en tus 2 últimos registros»; «Celdas reales anotadas: puede ser enjambrazón o reemplazo; no se puede saber desde la app»). **Sin señal si el último registro tiene más de ~14 días.** Sin consejos de alimentación, tratamientos ni dosis; lo de alimentar solo como «algunos apicultores reportan…». Huracanes solo como contexto oficial, no predicción.
- **Registro rápido**: por defecto solo 3 toques (actividad, reservas, población); reina, huevos, celdas reales y nota quedan en «Más detalles»; nada pre-llenado. La frecuencia **solo recuerda** (sin puntos rojos ni culpa). Bloques en pantalla: anillo, registro, hasta 2 señales, clima. Historial: tira de 14 días, sin gráficas.
- **Calendario personalizado vacío** muestra «sin calendario» y no inventa nada. `region_preset` solo admite `yucatan` y `custom` (se quitaron los presets sin datos verificados).
- **`seasons_json`**: límite 4096 (CHECK local y remoto), parser estricto en la app (exactamente 12 entradas, fase del enum, notas ≤200 caracteres); si falla, «sin calendario» sin caerse.
- Ediciones desde dos dispositivos: **última escritura gana por fila** (documentar).
- **Clima**: coordenadas redondeadas a 2 decimales, solo latitud/longitud y variables pedidas, HTTPS; caché por apiario con hora, refresco máximo cada 60 min, sin red muestra el último dato; timeout 8 s con AbortController, nunca bloquea; sin llamadas en demo, con el interruptor apagado o sin coordenadas; búsqueda de lugar solo envía el texto, con retraso ≥500 ms y mínimo 3 caracteres; rótulo «pronóstico/modelo, no medido en el apiario».
