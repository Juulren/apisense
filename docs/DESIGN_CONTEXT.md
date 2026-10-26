# Contexto de diseño — Apisense

Brief reconstruido el 26 de octubre de 2026 a partir de la solicitud del usuario, el repositorio y el proyecto autenticado de Stitch.

## Producto y objetivo

Apisense es una aplicación de campo para un apicultor que necesita consultar sus colmenas a distancia y trabajar en el apiario sin conexión. Reúne patrones acústicos orientativos, lecturas disponibles, inspecciones manuales e historial. Debe ayudar a decidir qué colmena revisar y conservar el trabajo local hasta poder sincronizarlo.

La implementación existente usa Expo/React Native para Web, Android e iOS. Este bloque, Issues #1 y #7, recupera y verifica fuentes; no inicia un prototipo alternativo ni cambia la interfaz, el acceso, la sincronización o el backend.

## Fuentes y dirección existente

Fuente principal: [Stitch 14657518597972503903](https://stitch.withgoogle.com/projects/14657518597972503903). Los 11 IDs acreditados corresponden a Login, Dashboard, Acústica IA, Diagnóstico y ciclo y Ajustes, cada una con versión clara/oscura, más la spec de botones. El [mapa](../DESIGN_MAP.md) corrige las etiquetas iniciales equivocadas.

La dirección conservada combina ámbar/miel, verde y azul, superficies claras o grafito, Plus Jakarta Sans e Inter. Se continúa con los tokens y componentes existentes en `src/components/ui/`; la spec `9219c95b429f4b69b120299875a6a659` sigue siendo la referencia de controles.

## Criterios del producto

- Lenguaje en español, lectura clara y acciones reconocibles durante el trabajo de campo.
- Navegación consistente entre Inicio, Acústica, Diagnóstico y Ajustes.
- Estado local/sincronización comprensible y conservación de cambios sin señal.
- Temas claro, oscuro y del sistema; controles táctiles derivados de la spec.
- Separación de datos reales, demo, observaciones manuales e hipótesis acústicas experimentales. Las afirmaciones científicas y cifras ficticias del diseño no son observaciones de campo.

## Decisiones abiertas

Onboarding, lista/mapa, historial, vinculación y formulario de inspección no tienen una fuente independiente entre estos IDs. La tarjeta de resumen periódico también es una adaptación funcional. Su aprobación o la creación de fuentes adicionales se registra en [#25](https://github.com/Juulren/apisense/issues/25).

La aceptación visual requiere comparar fuente e implementación al mismo viewport, tema y estado. Este bloque resuelve la procedencia; la comparación y las decisiones de diseño posteriores constituyen otro bloque de trabajo.
