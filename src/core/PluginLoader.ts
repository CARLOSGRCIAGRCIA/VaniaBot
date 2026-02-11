import { readdirSync, statSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import type { ICommand } from "@/types/index.js";
import { logger, logError } from "@/utils/logger.js";
import { PluginLoadError } from "@/utils/errors.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

export class PluginLoader {
  static async loadCommands(): Promise<ICommand[]> {
    const commands: ICommand[] = [];
    const commandsPath = join(__dirname, "../commands");

    try {
      await this.loadFromDirectory(commandsPath, commands);
      logger.info(`📦 ${commands.length} comandos cargados exitosamente`);
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
          const fileUrl = `file://${filePath.replace(/\\/g, "/")}`;
          const module = await import(fileUrl);

          const CommandClass =
            module.default ||
            Object.values(module).find(
              (exp: any) =>
                typeof exp === "function" &&
                exp.prototype &&
                "execute" in exp.prototype,
            );

          if (CommandClass && typeof CommandClass === "function") {
            const commandInstance = new (CommandClass as any)();

            if (commandInstance.name && commandInstance.execute) {
              commands.push(commandInstance);
              logger.debug(
                `Comando cargado: ${commandInstance.name} (${file})`,
              );
            } else {
              logger.warn(
                `Comando inválido en ${file}: falta 'name' o 'execute'`,
              );
            }
          }
        } catch (error) {
          const pluginError = new PluginLoadError(filePath, error);
          logError("PluginLoader.loadFromDirectory", pluginError);
          logger.warn(`Comando omitido: ${file}`);
        }
      }
    }
  }
}
