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

    logger.info(`📂 Buscando comandos en: ${commandsPath}`);

    try {
      await this.loadFromDirectory(commandsPath, commands);
      logger.info(`📦 ${commands.length} comandos cargados exitosamente`);

      if (commands.length > 0) {
        logger.info(`✅ Comandos: ${commands.map((c) => c.name).join(", ")}`);
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

          // Buscar el comando con múltiples estrategias
          let CommandClass = this.findCommandClass(module, file);

          if (CommandClass && typeof CommandClass === "function") {
            const commandInstance = new (CommandClass as any)();

            if (commandInstance.name && commandInstance.execute) {
              commands.push(commandInstance);
              logger.info(
                `✅ Comando cargado: ${commandInstance.name} (${file})`,
              );
            } else {
              logger.warn(
                `❌ Comando inválido en ${file}: ${!commandInstance.name ? "falta 'name'" : ""} ${!commandInstance.execute ? "falta 'execute'" : ""}`,
              );
            }
          } else {
            logger.warn(`❌ No se encontró clase de comando en ${file}`);
          }
        } catch (error) {
          const pluginError = new PluginLoadError(filePath, error);
          logError("PluginLoader.loadFromDirectory", pluginError);
          logger.warn(`⚠️  Comando omitido: ${file}`);
        }
      }
    }
  }

  /**
   * Busca la clase del comando en el módulo usando múltiples estrategias
   */
  private static findCommandClass(module: any, filename: string): any {
    // Estrategia 1: export default
    if (module.default) {
      logger.debug(`  → Encontrado como export default`);
      return module.default;
    }

    // Estrategia 2: export nombrado que coincida con el nombre del archivo
    // Por ejemplo: HelpCommand.ts → export { HelpCommand }
    const expectedName = filename.replace(/\.(ts|js)$/, "");
    if (module[expectedName]) {
      logger.debug(`  → Encontrado como export nombrado: ${expectedName}`);
      return module[expectedName];
    }

    // Estrategia 3: Buscar cualquier export que sea una clase con execute
    const exports = Object.values(module);
    const commandClass = exports.find(
      (exp: any) =>
        typeof exp === "function" &&
        exp.prototype &&
        "execute" in exp.prototype,
    );

    if (commandClass) {
      logger.debug(`  → Encontrado en exports: ${(commandClass as any).name}`);
    } else {
      logger.debug(`  → No se encontró clase de comando`);
    }

    return commandClass;
  }
}
