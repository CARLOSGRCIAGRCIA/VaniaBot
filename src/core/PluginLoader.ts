import { readdirSync, statSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import type { ICommand } from "@/types/index.js";
import { logger, logError } from "@/utils/logger.js";
import { PluginLoadError } from "@/utils/errors.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

function isValidCommand(cmd: unknown): cmd is ICommand {
  return (
    typeof cmd === "object" &&
    cmd !== null &&
    typeof (cmd as any).name === "string" &&
    (cmd as any).name.length > 0 &&
    typeof (cmd as any).execute === "function"
  );
}

export class PluginLoader {
  static async loadCommands(): Promise<ICommand[]> {
    const commands: ICommand[] = [];
    const commandsPath = join(__dirname, "../commands");

    logger.info(`Buscando comandos en: ${commandsPath}`);

    try {
      await this.loadFromDirectory(commandsPath, commands);

      if (commands.length > 0) {
        logger.info(` Comandos: ${commands.map((c) => c.name).join(", ")}`);
      }
    } catch (error) {
      logError("PluginLoader.loadCommands", error);
    }

    return commands;
  }

  private static async loadFromDirectory(
    dir: string,
    commands: ICommand[],
  ): Promise<void> {
    const files = readdirSync(dir);

    for (const file of files) {
      const filePath = join(dir, file);
      const stat = statSync(filePath);

      if (stat.isDirectory()) {
        await this.loadFromDirectory(filePath, commands);
      } else if (file.endsWith("Command.ts") || file.endsWith("Command.js")) {
        try {
          logger.debug(`🔍 Intentando cargar: ${file}`);

          const fileUrl = `file://${filePath.replace(/\\/g, "/")}`;
          const module = await import(fileUrl);

          const loaded = this.extractCommands(module, file);

          if (loaded.length === 0) {
            logger.warn(`No se encontró clase de comando en ${file}`);
            continue;
          }

          for (const cmd of loaded) {
            commands.push(cmd);
          }
        } catch (error) {
          const pluginError = new PluginLoadError(filePath, error);
          logError("PluginLoader.loadFromDirectory", pluginError);
          logger.warn(`Comando omitido: ${file}`);
        }
      }
    }
  }

  private static extractCommands(module: any, filename: string): ICommand[] {
    const results: ICommand[] = [];

    for (const [key, value] of Object.entries(module)) {
      if (!value) continue;

      if (typeof value === "object" && isValidCommand(value)) {
        logger.debug(`  → Instancia encontrada: ${key}`);
        results.push(value);
        continue;
      }

      if (
        typeof value === "function" &&
        (value as any).prototype &&
        typeof (value as any).prototype.execute === "function"
      ) {
        try {
          const instance = new (value as any)();
          if (isValidCommand(instance)) {
            logger.debug(`  → Clase instanciada: ${key}`);
            results.push(instance);
          } else {
            logger.warn(
              `Comando inválido en ${filename}: ${!(instance as any).name ? "falta 'name'" : ""} ${!(instance as any).execute ? "falta 'execute'" : ""}`,
            );
          }
        } catch (_) {
          logger.debug(`  → Clase ${key} requiere argumentos, omitida`);
        }
        continue;
      }
    }

    return results;
  }
}
