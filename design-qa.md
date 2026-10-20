# Design QA — Apisense

final result: blocked

## Fuentes y normalización

Fuente: `design-reference/stitch/exports/dashboard_simplificado_user_friendly_apisense/screen.png` (466×1600) y HTML de la spec de componentes. Implementación: `docs/qa/dashboard-light.png`, con captura de navegador a 466×1060, modo claro y demo con ocho colmenas. El navegador in-app limita la altura efectiva a 1060 aunque se solicitó 1600; no se afirma una comparación completa al mismo viewport.

Comparación parcial conjunta: `docs/qa/dashboard-comparison.png`, fuente recortada al área superior y captura de implementación a escala 1:1. No sustituye una validación completa de las diez pantallas.

## Superficies revisadas

- Tipografía: Jakarta/Inter empaquetadas; jerarquía, pesos y etiquetas legibles en claro/oscuro. No se certifican todos los saltos de línea contra las fuentes faltantes.
- Espaciado/layout: márgenes móviles, tarjetas redondeadas y navegación persistente comprobados. El layout adapta formularios reales, estado demo y clave de cifrado, ausentes de parte de las maquetas.
- Tokens: miel, verde, azul y superficies claras/oscuras derivados de la spec. Se corrigió texto verde de bajo contraste en tema oscuro.
- Recursos: marca raster extraída del PNG original; iconos Material. Espectrograma y FFT representan el clip real, en lugar de reutilizar un dibujo sin relación con la muestra.
- Contenido: se sustituyeron afirmaciones no verificables de reina/salud por patrones orientativos; valores de Hz/batería proceden de SQLite. No se inventaron temperatura ni clima.

## Historial de correcciones

1. [P2, corregido] Selección ARIA ausente en web: se añadieron atributos explícitos y se comprobó `aria-checked`/`aria-selected` en UI.
2. [P2, corregido] Dos pestañas seleccionadas en `/hives`: se delimitó el segmento del prefijo; la captura del mapa muestra solo Inicio activo.
3. [P1, corregido] Mapa incrustado bloqueado: iframe sin credenciales; se verificaron mapa, marcador y atribución después de remontarlo.
4. [P2, corregido] Contraste de texto verde en modo oscuro: utiliza token semántico del tema.

## Bloqueos restantes

- #7: los exports actuales son variantes de seis vistas y no acreditan los 11 IDs originales. Las pantallas adaptadas no pueden certificarse fieles a una fuente ausente.
- Comparación completa al mismo viewport/estado para todas las pantallas pendiente. La evidencia capturada valida uso y revisión parcial, no aceptación visual integral.
- Builds nativos físicos pendientes en #8/#15.

El PR se entrega como implementación local para revisión, sin afirmar aceptación visual final ni producción lista.
