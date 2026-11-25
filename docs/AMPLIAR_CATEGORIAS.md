# Cómo añadir una categoría al nodo

Hoy el nodo solo dice **0, sonido habitual** o **1, diferente al habitual** (más la bandera «aún no juzga»). Se dejó espacio para ampliar: el mensaje de 8 bytes lleva un código de 0 a 255 y una versión del mapa de categorías, y la app decide con una sola tabla cuáles son alerta.

## 0. Antes de tocar código: la categoría tiene que haberse demostrado
- Audio **propio** de la colmena, con lo observado anotado en el momento, de **varios días y varias colmenas**, y con ejemplos normales grabados con el mismo micrófono y montaje.
- Evaluación con **colmenas y días que no se usaron para entrenar** (con una sola grabación por clase, un modelo «acierta» reconociendo la grabación; ver `EDGE_AI_FASE_A_RESULTADOS.md`).
- Acordar de antemano cuánto acierto y cuántas falsas alarmas se aceptan.
- Sin eso, no se añade: la app presentaría como diagnóstico algo que no se sabe.

## 1. La tabla (`supabase/functions/_shared/edgePayload.ts`, `edgeClassMaps`)
Crear una **versión nueva** del mapa (por ejemplo 2) que copie las entradas de la anterior y añada la nueva con `label` y `alert`. El 0 significa «sonido habitual» en todas las versiones. `alert: true` la muestra como alerta pendiente de revisar; `alert: false` solo la nombra (no cuenta como «sonido habitual»). Un código que la app no conozca **se trata como alerta**.

De la tabla ya salen solos: la etiqueta, qué es alerta, la tarjeta de la colmena y las consultas locales (`quietClassSql`).

## 2. Lo que hay que revisar a mano
| Dónde | Por qué |
|---|---|
| Disparador de avisos del servidor (`alert_on_different_verdict`, última versión en `202611250001`) | Avisa con cualquier `class_code <> 0` y el texto dice «sonido diferente». Una categoría sin alerta, o con otro texto, necesita una **migración nueva** |
| Limpieza a 30 días (`prune_edge_verdicts` en el servidor y `pruneVerdicts` en la app) | Solo borra los «habitual» (código 0). Decidir si la categoría nueva también caduca |
| Línea de tiempo (`verdictDays`, `VerdictTimeline`) | Un día con solo categorías sin alerta se pinta como «sonido habitual». Si importa, añadir su estado y color |
| Textos que dicen «sonido diferente»: `NodeStatus.ts` (tarjeta de colmena y resumen de la línea de tiempo), `dashboard.tsx`, `alerts.tsx` y `VerdictTimeline.tsx` | Revisarlos si hay más de un tipo de alerta |
| Firmware (`edge_payload.h`) | Añadir la constante, cambiar la versión del mapa en el byte 0 (hoy fijo en `0x11`) y la lógica que decide el código (`uplinkFor`). Hoy `EdgeNode` solo produce habitual o diferente: un clasificador nuevo es trabajo aparte. Si cambian las características, subir `FEATURE_VERSION` |
| `uplink_sim.py` (tiene también el byte 0 fijo en `0x11`), `bridge.py` (nombres) y las pruebas del contrato (`node_uplinks.json`) | Regenerar el fixture desde la placa |
| La bandera «aún no juzga» (valor 8, el bit 3 del grupo de banderas) | Los 4 bits de banderas ya están **todos usados**; para más banderas hace falta otro formato (el nibble alto del byte 0) |

## 3. Orden de despliegue
1. Publicar la app nueva (y la migración, si la hay).
2. Cargar el firmware después. Las apps antiguas muestran un código desconocido como «Código N (mapa vM, sin descripción en esta versión)» y **como alerta**; las anteriores a la 0.3.2 no entienden «aún no juzga».

`lora-uplink` no necesita volver a desplegarse para códigos nuevos: guarda el código y la versión tal como llegan.

## Si hiciera falta enviar más datos
El mensaje no tiene bytes libres. Un formato 2 más largo es posible (el decodificador rechaza formatos que no conoce), pero en 915 MHz el tiempo máximo por transmisión limita el tamaño al mayor alcance: comprobarlo con la región y el factor de dispersión reales antes de diseñarlo.
