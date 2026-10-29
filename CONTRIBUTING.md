# Colaborar en Apisense

`main` es la base compartida y ejecutable. El [tablero](https://github.com/users/Juulren/projects/2) es la referencia del trabajo activo; los [Issues](https://github.com/Juulren/apisense/issues) contienen alcance, responsable y criterios de aceptación. [IMPLEMENTATION_PLAN.md](IMPLEMENTATION_PLAN.md) resume hitos y pendientes de producto.

El producto tiene dos destinos: **Android nativo e iOS nativo**. La versión web queda fuera del alcance confirmado por el usuario. Conserva los exports HTML de Stitch como fuentes de diseño, sin tratarlos como una plataforma de entrega.

## Una tarea por entrega

1. Crea o elige un Issue pequeño. Define el resultado comprobable y asigna un responsable antes de empezar. Mueve su tarjeta a **En curso**.
2. Actualiza `main` y crea una rama temporal. Cada colaborador usa su propia rama; las revisiones del mismo cambio se suben a esa rama.

   ```bash
   git switch main
   git pull --ff-only
   git switch -c feat/NUMERO-descripcion
   ```

   Codex usa el prefijo `codex/`, por ejemplo `codex/22-colaboracion`. Los colaboradores pueden usar `feat/`, `fix/`, `docs/` o `chore/` con el número del Issue.

3. Implementa solo ese alcance, usa Conventional Commits y abre un PR hacia `main` con `Closes #NUMERO`. El tablero mueve el Issue enlazado a **En revisión**. Indica qué cambió, cómo se comprobó y sus límites.
4. Revisa el resultado y espera los checks de `Validate / app`. Resuelve los comentarios antes de integrar. La aprobación del responsable del proyecto puede quedar en GitHub o en la conversación de trabajo; no se exige una aprobación adicional en GitHub que bloquee el trabajo realizado con la misma cuenta.
5. Integra el PR aprobado, normalmente con squash para conservar una entrega por Issue. GitHub cierra el Issue enlazado y elimina la rama remota. El tablero mueve los Issues cerrados a **Terminado**.

Antes de una tarea que dependa de otra, integra primero su PR. Las tareas independientes pueden avanzar en paralelo desde `main`, con responsables distintos. Si ambos cambios afectan los mismos archivos, acuerden la separación en los Issues antes de editar. Mantén una tarea en curso por persona.

## Comprobaciones

```bash
npm ci
npm run check
npm run check:bundles
```

La CI comprueba referencias de diseño, tipos, pruebas locales, auditoría, bundles JavaScript/Hermes para Android e iOS y Deno. Los bundles no compilan ni ejecutan APK/AAB o una app iOS; los cambios de comportamiento móvil necesitan validación nativa en simulador/emulador y dispositivo según su alcance. Ejecuta una vez por PR; nuevas subidas cancelan la ejecución anterior. También verifica cada actualización de `main`. No despliega servicios ni ejecuta las pruebas live automáticamente.

`npm run test:backend:live` necesita el proyecto y las credenciales locales descritas en [docs/SUPABASE.md](docs/SUPABASE.md). Ejecuta pruebas con datos temporales y es un paso explícito cuando cambia la integración real.

## Estados y responsabilidades

| Estado      | Significado                                                              |
| ----------- | ------------------------------------------------------------------------ |
| Pendiente   | Tarea definida, aún sin iniciar; puede indicar dependencias en el Issue. |
| En curso    | Tiene responsable y rama activa.                                         |
| En revisión | Hay un PR con evidencia; falta revisar o integrar.                       |
| Terminado   | Se cumplieron los criterios y se integró el cambio.                      |

GitHub Projects incorpora automáticamente los Issues del repositorio, los mueve a En revisión al enlazar un PR y actualiza el estado al cerrarlos o reabrirlos. El responsable solo necesita mover la tarjeta a En curso cuando empieza; no se mantienen etiquetas paralelas de estado. El tablero permite ver quién trabaja en qué sin recorrer ramas.

El usuario elige el próximo Issue y revisa la entrega. Codex puede preparar código, commits, pruebas, PR y documentación; al entregar un bloque se detiene. La integración requiere autorización del usuario o del responsable del proyecto. Un merge no autoriza iniciar otra tarea ni publicar la app.

## Configuración local y base compartida

Cada persona clona el repositorio una sola vez y mantiene su propio `.env`, usando `.env.example` como referencia. No se comparten contraseñas, claves del servidor ni archivos `.env` en commits, Issues o PR. Las migraciones SQL sí se versionan; coordina su aplicación al proyecto compartido en el Issue correspondiente.

Después de integrar tu trabajo:

```bash
git switch main
git pull --ff-only
git fetch --prune
```

Puedes eliminar tu rama local cuando hayas comprobado que no conserva trabajo pendiente. No borres ramas de otra persona sin confirmar que sus commits están integrados.

## Consolidación inicial

El 21 de octubre de 2026 se integró el [PR #21](https://github.com/Juulren/apisense/pull/21) con merge para preservar el historial de las ramas acumulativas. GitHub marcó como integrados los PR #9, #10, #11, #12, #14 y #19. Los nuevos cambios empiezan desde `main`; no hay que volver a integrar esos PR ni usar sus ramas antiguas.
