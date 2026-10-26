# Mapa de diseño — Apisense

Proyecto: [Apisense Smart Apiary App](https://stitch.withgoogle.com/projects/14657518597972503903). Verificación: **26 de octubre de 2026**.

Los **11 IDs originales están vinculados a sus 11 pares HTML/PNG**. Son cinco familias de pantallas con variantes claro/oscuro y una spec de componentes: no son once pantallas funcionales diferentes. Diez etiquetas del brief inicial asociaban un ID con otra vista. Este mapa corrige la asociación sin renombrar ni modificar los exports.

Los 23 archivos de `design-reference/stitch/exports/` coinciden byte a byte con el ZIP del usuario del 16 de octubre. El cuerpo HTML de cada export coincide exactamente, después de normalizar las adiciones del preview, con el `iframe.srcdoc` del nodo identificado en el proyecto autenticado. La exportación ZIP nueva y Code to Clipboard fallaron; no se afirma haber descargado un ZIP nuevo. Método y límites: [STITCH_PROVENANCE.md](docs/STITCH_PROVENANCE.md), [manifest.json](design-reference/stitch/manifest.json).

## Correspondencia comprobada por ID

| ID original                        | Ruta asignada en el brief inicial | Contenido real / ruta correspondiente                      | Fuentes originales                                                                                                                                                                                    |
| ---------------------------------- | --------------------------------- | ---------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `4ddc4e1cd1d94c95bc9a96bd4506140d` | `/` — onboarding                  | Ajustes oscuro → `/settings`                               | [HTML](design-reference/stitch/exports/ajustes_y_configuraci_n_modo_oscuro_apisense/code.html) · [PNG](design-reference/stitch/exports/ajustes_y_configuraci_n_modo_oscuro_apisense/screen.png)       |
| `0b3c11bfb4874a0bbf758415fde95bc0` | `/login`                          | Acústica IA oscuro → `/monitor`                            | [HTML](design-reference/stitch/exports/ac_stica_ia_modo_oscuro_apisense/code.html) · [PNG](design-reference/stitch/exports/ac_stica_ia_modo_oscuro_apisense/screen.png)                               |
| `81a455bf1b6546dcb69422fb93eb9815` | `/dashboard`                      | Diagnóstico y ciclo oscuro → `/hive/[id]`                  | [HTML](design-reference/stitch/exports/diagn_stico_y_ciclo_modo_oscuro_apisense/code.html) · [PNG](design-reference/stitch/exports/diagn_stico_y_ciclo_modo_oscuro_apisense/screen.png)               |
| `2866b2f10dd941b1b45449c881f2f906` | `/hives` — lista/mapa             | Dashboard oscuro → `/dashboard`                            | [HTML](design-reference/stitch/exports/dashboard_modo_oscuro_apisense/code.html) · [PNG](design-reference/stitch/exports/dashboard_modo_oscuro_apisense/screen.png)                                   |
| `9219c95b429f4b69b120299875a6a659` | `/ui-catalog`                     | Spec de botones y componentes claro/oscuro → `/ui-catalog` | [HTML](design-reference/stitch/exports/spec_de_botones_y_componentes_ui_apisense_figma/code.html) · [PNG](design-reference/stitch/exports/spec_de_botones_y_componentes_ui_apisense_figma/screen.png) |
| `8b522e6fd6c4496c8b4322ffa25359cb` | `/hive/[id]` — detalle + summary  | Ajustes claro → `/settings`                                | [HTML](design-reference/stitch/exports/ajustes_y_configuraci_n_simplificada_apisense/code.html) · [PNG](design-reference/stitch/exports/ajustes_y_configuraci_n_simplificada_apisense/screen.png)     |
| `594626aefe1d4d62be0199116b847dc8` | `/monitor`                        | Login oscuro → `/login`                                    | [HTML](design-reference/stitch/exports/inicio_de_sesi_n_modo_oscuro_apisense/code.html) · [PNG](design-reference/stitch/exports/inicio_de_sesi_n_modo_oscuro_apisense/screen.png)                     |
| `15f5ffbe4079404d9e31504985a22c57` | `/history`                        | Diagnóstico y ciclo claro → `/hive/[id]`                   | [HTML](design-reference/stitch/exports/diagn_stico_y_ciclo_simplificado_apisense/code.html) · [PNG](design-reference/stitch/exports/diagn_stico_y_ciclo_simplificado_apisense/screen.png)             |
| `075860fb08504a389181206213e52cbf` | `/pairing`                        | Acústica IA claro → `/monitor`                             | [HTML](design-reference/stitch/exports/ac_stica_ia_simplificada_apisense/code.html) · [PNG](design-reference/stitch/exports/ac_stica_ia_simplificada_apisense/screen.png)                             |
| `0e200552364542faa7ee9ae0a15069c5` | `/inspection`                     | Dashboard claro → `/dashboard`                             | [HTML](design-reference/stitch/exports/dashboard_simplificado_user_friendly_apisense/code.html) · [PNG](design-reference/stitch/exports/dashboard_simplificado_user_friendly_apisense/screen.png)     |
| `5c34c4004aba4e95b023dbc433532e0a` | `/settings`                       | Login claro → `/login`                                     | [HTML](design-reference/stitch/exports/inicio_de_sesi_n_simplificado_apisense/code.html) · [PNG](design-reference/stitch/exports/inicio_de_sesi_n_simplificado_apisense/screen.png)                   |

## Cobertura de la implementación

| Ruta          | Referencia disponible                                        | Aceptación visual                                          |
| ------------- | ------------------------------------------------------------ | ---------------------------------------------------------- |
| `/login`      | Login claro/oscuro                                           | Pendiente de comparación completa al mismo viewport/estado |
| `/dashboard`  | Dashboard claro/oscuro                                       | Comparación parcial histórica; pendiente de completar      |
| `/hive/[id]`  | Diagnóstico y ciclo claro/oscuro                             | La tarjeta AI Periodic Summary es una adaptación funcional |
| `/monitor`    | Acústica IA claro/oscuro                                     | Pendiente de comparación completa                          |
| `/settings`   | Ajustes claro/oscuro                                         | Pendiente de comparación completa                          |
| `/ui-catalog` | Spec de componentes                                          | Fuente verificada; pendiente de comparación completa       |
| `/`           | Sin fuente independiente entre estos IDs                     | Onboarding adaptado                                        |
| `/hives`      | Sin fuente independiente entre estos IDs                     | Lista/mapa adaptado                                        |
| `/history`    | Sin fuente independiente entre estos IDs                     | Historial adaptado                                         |
| `/pairing`    | Sin fuente independiente entre estos IDs                     | Vinculación adaptada                                       |
| `/inspection` | Bitácora dentro de diagnóstico; sin formulario independiente | Formulario adaptado                                        |

El [Issue #25](https://github.com/Juulren/apisense/issues/25) conserva la aprobación de las adaptaciones y la comparación visual. Verificar las fuentes en #1/#7 no certifica fidelidad ni crea diseños faltantes. Las rutas de la app conservan sus nombres funcionales.

## Lenguaje visual y contenido

Tokens de la spec: primario `#F59E0B`, audio `#B45309`, sync `#92400E`, secundario `#10B981`, terciario `#0284C7`, tinta `#1E293B`, lienzo `#F8FAFC`, borde `#E2E8F0`; oscuro `#0B0F17`/`#162032`. Plus Jakarta Sans para títulos y cuerpo; Inter para etiquetas. Botones primarios 52/48 px y radio 16 px; secundarios 42 px y radio 12 px; navegación con área táctil de 48 px.

Las afirmaciones biológicas de las maquetas son contenido de diseño. La app mantiene la distinción entre hipótesis acústicas experimentales y observaciones de campo verificadas; no incorpora como hechos las temperaturas, probabilidades ni diagnósticos sintéticos del mockup.
