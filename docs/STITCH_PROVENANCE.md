# Procedencia de las fuentes de Stitch — Issues #1 y #7

Comprobación del **26 de octubre de 2026**, proyecto [14657518597972503903](https://stitch.withgoogle.com/projects/14657518597972503903).

## Resultado

Los 11 IDs existen en el lienzo autenticado y cada uno coincide con un único HTML archivado. Los 11 pares HTML/PNG y `DESIGN.md` coinciden byte a byte con el ZIP original del usuario: 23 archivos intactos. Diez asociaciones ID/pantalla del brief eran incorrectas; el [mapa corregido](../DESIGN_MAP.md) conserva la asignación inicial y documenta el contenido real.

Las fuentes son cinco familias claro/oscuro y una spec. Las cinco rutas adicionales siguen siendo adaptaciones. Su aceptación y la comparación visual de la app se conservan en [#25](https://github.com/Juulren/apisense/issues/25).

El producto se entrega exclusivamente como app Android e iOS nativa, según la aclaración del usuario del 26 de octubre. Estos HTML acreditan las fuentes de diseño de Stitch; no definen una versión web del producto.

## Adquisición y comparación

1. Se abrió el proyecto con la sesión autenticada existente del navegador integrado. No se generaron ni editaron pantallas.
2. Se leyeron los atributos `data-id` de los nodos del lienzo y el `srcdoc` de sus iframes de preview. Se conservaron únicamente los 11 IDs solicitados. El JSON comprimido registra la estructura del cuerpo normalizada y el hash del preview observado; omite la cabecera y el runtime de edición de Stitch. La app no lo importa ni ejecuta.
3. Se intentaron los controles oficiales ZIP y Code to Clipboard. El primero no produjo un archivo descargable y el segundo mostró `Failed to copy HTML`. Los originales proceden del ZIP del 16 de octubre; la captura del día 26 acredita su correspondencia con los IDs actuales. No es un ZIP nuevo ni un export oficial por ID.
4. Se comparó el cuerpo HTML como secuencia de etiquetas, atributos y texto. Se quitaron subárboles `data-stitch-injected`, se revirtió la sustitución de clases registrada en `data-stitch-vh`, se ordenaron atributos y se normalizaron entidades, comentarios y espacios. Se conservaron las clases, enlaces, recursos, atributos y contenido restantes.
5. Cada secuencia coincide exactamente con un único HTML archivado. Se registraron su SHA-256 normalizado, ID, familia/tema, ruta y dimensiones PNG. No se aceptó similitud aproximada como criterio de correspondencia.
6. Se verificaron los 23 archivos contra los miembros del ZIP original sin extraer ni modificar sus contenidos. Sus hashes binarios permanecen intactos.

Archivo original: `stitch_apisense_smart_apiary_app.zip`.

SHA-256 del ZIP: `41761a50daf9361c222fd4c321474972cec3cd7e7fdf38200184a9ada39423f7`.

## Evidencia reproducible

- [Manifiesto y mapeo por ID](../design-reference/stitch/manifest.json).
- [Registro de los 11 cuerpos DOM normalizados, JSON comprimido](../design-reference/stitch/provenance/2026-10-26/canvas-capture.json.gz).
- [Verificador sin dependencias externas](../scripts/verify_stitch_references.py).
- [Resumen visual de los PNG originales](qa/stitch-source-index.jpg): imágenes reducidas conservando proporciones y rotuladas con su ID; no son nuevos exports.

Con Python 3, desde la raíz del repositorio:

```bash
python scripts/verify_stitch_references.py
```

Opcionalmente, comprueba también tu copia del ZIP original:

```powershell
python scripts/verify_stitch_references.py --archive "C:\ruta\stitch_apisense_smart_apiary_app.zip"
```

El verificador comprueba cobertura exacta de IDs, correspondencia uno a uno, integridad de la captura, igualdad de cuerpos HTML normalizados, hashes binarios y dimensiones PNG. La CI ejecuta la variante offline; no necesita Google ni el ZIP local. Python solo se necesita para esta comprobación de referencias, no para ejecutar la app.

## Límites

Validación local del bloque: TypeScript y 47 pruebas de la app correctos; bundles JavaScript/Hermes para Android e iOS correctos, sin certificar todavía binarios nativos. El verificador pasó con y sin el ZIP y rechazó HTML alterado, un ID duplicado, asociaciones intercambiadas y una captura modificada en copias temporales. Los 23 originales permanecieron intactos durante esas comprobaciones.

La igualdad del cuerpo normalizado acredita la identidad de la vista; no prueba igualdad binaria del preview y el export, ni igualdad de sus cabeceras, CSS remoto, fuentes descargadas o píxeles renderizados. La captura DOM es un registro local de la sesión, no una firma de Google ni una consulta online durante cada ejecución de CI.

Los PNG originales tienen distintos anchos y altura 1600 px; sus dimensiones no equivalen al viewport de la app. Esta entrega no certifica fidelidad de toda la implementación, temas, breakpoints, builds nativos o contenido científico. La revisión parcial anterior y sus límites permanecen en [design-qa.md](../design-qa.md).
