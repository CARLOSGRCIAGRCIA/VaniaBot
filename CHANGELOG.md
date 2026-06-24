# Bug Fixes - Carga de comandos y alias

## PluginLoader.getCommand() — alias lookup roto

**Archivo:** `src/core/PluginLoader.ts:197`

Cuando se buscaba un comando por su alias (`!play` → `play`), el lazy loading cargaba el archivo correctamente pero luego retornaba `this.loadedCommands.get(name)` donde `name` era el alias. `loadedCommands` solo almacena el nombre primario (`ytmp3`), así que devolvía `null`. El fallback loop que sí revisaba aliases era dead code porque el `return` salía antes.

**Fix:** Cambiado a `this.loadedCommands.get(name) ?? this.lazyCache.get(name) ?? null`. `lazyCache` sí guarda entradas por alias tras el lazy load.

**Método nuevo:** `PluginLoader.getAllCommands()` — itera los `commandFiles` pendientes, los carga, y los almacena en `loadedCommands`.

---

## SubBotMessageHandler — lazy loading faltante

**Archivo:** `src/services/subbot/SubBotMessageHandler.ts:123-127`

Los sub-bots solo revisaban `commandRegistry.get()` sin caer a `pluginLoader.getCommand()`. Todos los comandos lazy-loaded fallaban en sub-bots (incluyendo `media/`, `anime/`, etc.).

**Fix:** Agregado el mismo patrón de `MainMessagePipeline.ts` — si `commandRegistry.get()` no encuentra el comando, intenta `pluginLoader.getCommand()` y si lo encuentra, lo registra en el registry.

---

## HelpCommand — comandos invisibles en menú

**Archivo:** `src/commands/utility/system/HelpCommand.ts`

`commandRegistry.getAll()` solo devolvía comandos precargados (categorías `admin`, `owner`, `utility`, `creative`). El resto (~75% de los comandos) nunca aparecía en `!help`.

**Fix:** Antes de construir el menú, `showFullMenu()` verifica si hay comandos lazy pendientes. Si los hay, llama a `pluginLoader.getAllCommands()` que carga todos los comandos lazy en `loadedCommands`, y luego los registra en `commandRegistry`.

---

## Testing
- **578 tests pasan**, 4 skipped (sin cambios)
- **TypeScript**: Compila limpio con `npx tsc --noEmit`
- **ESLint**: 0 warnings, 0 errors
