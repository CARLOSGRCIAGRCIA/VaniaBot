# Changelog

## Architecture & Core

### Eliminación de archivos monstruo y consolidación
- **Anime commands**: Eliminados ~75 archivos individuales en `src/commands/anime/` (delirius/, nsfw/, safe/) → Consolidados en un solo `AnimeCommand.ts` con array de configuraciones y una factoría `createAnimeCommand()`. Reducción: ~2,550 líneas.
- **Interaction commands**: Eliminados `src/commands/fun/CryCommand.ts`, `HugCommand.ts`, `ReirseCommand.ts` y `src/commands/nsfw/AgarrarNalgasCommand.ts`, `ChuparPataCommand.ts`, `FollarCommand.ts`, `GrabBoobsCommand.ts` → Consolidados en `src/commands/interaction/InteractionCommand.ts` con factoría `createInteractionCommand()`. Reducción: ~424 líneas.
- **Client.ts**: Simplificado de ~735 líneas a ~298. Eliminada lógica redundante de middlewares, warmup, stats.
- **PluginLoader.ts**: Reducido de ~91 líneas.
- **ItemRegistry.ts**: Reducido de ~740 líneas.
- **PanelServer.ts**: Reducido de ~740 líneas.
- **SubBotManager.ts**: Reducido de ~1,010 a ~274 líneas.
- **AIService.ts**: Reducido de ~630 líneas.
- **ErrorHandler.ts**: Reducido de ~94 líneas.
- **vania.ts**: Reducido de ~69 líneas.
- **Total**: ~6,824 líneas eliminadas, ~865 añadidas en 177 archivos.

### Extracción de helpers compartidos
- `getContactName()` extraído de 5 archivos → `ContactsCache.getContactName()`
- `escapeXml` / `wrapText` extraídos de 3 archivos cada uno → `helpers.ts`
- `uploadToTmpfiles` extraído de 2 archivos → `helpers.ts`
- `formatTime*` / `formatDuration` unificados de 5 implementaciones → 2 shared helpers (`formatTime`, `formatTimeRemaining`)
- Creado `src/utils/helpers.ts` con 84 líneas de utilidades compartidas

### Configuración
- Creada constante `VANIA_TOGGLE_COMMANDS` en `src/config/index.ts` para eliminar magic strings (`vaniaon`/`vaniaoff`/`vaniastatus`)

### Constantes
- Unificados conflictos de constantes de reconexión: `AuthManager.ts` (20), `constants.ts` (15), `SubBotInstance.ts` (50) → fuente única en `src/utils/constants.ts` con `MAX_RECONNECT_ATTEMPTS = 20`

## Logging

### Eliminación de console.*
- Migrados ~150 `console.*` calls → `logger` / `logError` en 30+ archivos
- Solo queda console.* intencional para output visible al usuario: QR en `qr.ts`, banner en `cli.ts`, error handler global en `index.ts`

### Manejo de errores
- Fix de ~150 bloques catch vacíos (`.catch(() => {})` / `catch(_e) {}`) con `logError` en 50+ archivos

## Async & Performance

### Migración a paralelo
- 11 bucles `for-await` seriales convertidos a `Promise.all` / `Promise.allSettled`

### Inmutabilidad
- Reemplazado `ctx.args.shift()` (mutante) → `ctx.args.slice(1)` (inmutable) en `MainMessagePipeline.ts` y `SubBotMessageHandler.ts`

## Bug Fixes

### DatabaseQueryOptimizer.ts (alta severidad)
- `flushBatch()` nunca ejecutaba `queryFn` para claves no cacheadas — las rechazaba con `"Query not found"`. Ahora ejecuta `queryFn` una vez por clave única, cachea el resultado y resuelve todos los waiters.
- Cálculo incorrecto de `uncachedKeys` por index mapping defectuoso (`filter().map((_, i) => ...)` usaba índice del arreglo filtrado). Reemplazado con agrupación por Map.

## ESLint & Quality

### ESLint — 0 warnings, 0 errors
- **AnimeCommand.ts**: Reemplazados 66 `find()!` con `Map<string, AnimeCommandDef>.get()` mediante helper `getAnimeCommand()` — O(1) en vez de O(n), throw en vez de crash con `!`
- **InteractionCommand.ts**: Reemplazados 7 `find()!` con `Map.get()` mediante helper `getInteractionCommand()`
- **Client.ts**: Reemplazado `import()` type annotation con import `type IMiddleware`
- **BratCommand.ts**: Eliminado import no usado de `logError`
- **AudioResponseHandler.ts**: Eliminado import no usado de `logger`
- **YouTubeDownloader.ts**: Eliminado import no usado de `logError`
- **AIPrompts.ts**: Eliminado import no usado de `env`
- **AIService.ts**: Eliminado import no usado de `UserTier`
- **AISessionStore.ts**: Eliminado import no usado de `MAX_HISTORY_MESSAGES`
- **AITypes.ts**: Eliminado import no usado de `NetworkError`
- **SubBotManager.ts**: Eliminado import no usado de `proto`

## Otros
- Eliminado `global.client` muerto de `index.ts`
- Fix de `async/await` faltantes y manejo de promesas
- Actualizaciones menores en tests y mocks
- Actualizaciones en servicios de base de datos, subbot, sistema

## Testing
- **578 tests pasan**, 4 skipped (sin cambios)
- **TypeScript**: Compila limpio con `npx tsc --noEmit`
- **ESLint**: 0 warnings, 0 errors
