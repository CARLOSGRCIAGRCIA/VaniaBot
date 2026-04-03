/**
 * @fileoverview UpdateCommand.ts - Update the bot from git
 *
 * Pulls latest changes from git and rebuilds.
 *
 * @module commands/owner/system/UpdateCommand
 */

import { Command } from '../../Command.js';
import {
  CommandCategory,
  PermissionLevel,
  CommandContext,
  type MessageContext,
} from '@/types/index.js';
import { exec } from 'child_process';
import { promisify } from 'util';
import { logger } from '@/utils/logger.js';

const execAsync = promisify(exec);

export class UpdateCommand extends Command {
  name = 'update';
  description = 'Actualiza el bot desde git';
  category = CommandCategory.OWNER;
  aliases = ['actualizar', 'gitpull'];
  usage = '!update';
  examples = ['!update'];
  permission = PermissionLevel.OWNER;
  contexts = [CommandContext.BOTH];

  async execute(ctx: MessageContext): Promise<void> {
    await ctx.react('📥');
    await ctx.reply(`📥 *Actualizando bot...*\n\nObteniendo cambios de git...`);

    try {
      const { stdout: status } = await execAsync('git status --short');
      if (status.trim()) {
        await ctx.reply(
          `⚠️ *Hay cambios sin guardar*\n\nPor favor guarda o stash tus cambios antes de actualizar.`,
        );
        return;
      }

      await ctx.reply(`📥 Ejecutando git pull...`);

      const { stdout: pull } = await execAsync('git pull origin main', { timeout: 60000 });

      if (pull.includes('Already up to date')) {
        await ctx.reply(`✅ *El bot ya está actualizado*`);
        return;
      }

      await ctx.reply(`📦 Ejecutando npm install...`);

      await execAsync('npm install', { timeout: 120000 });

      await ctx.reply(`🔨 Compilando TypeScript...`);

      await execAsync('npm run build', { timeout: 120000 });

      logger.info('Update completed, restarting...');
      await ctx.reply(`✅ *Actualización completada*\n\n🔄 Reiniciando bot...`);

      setTimeout(() => {
        process.exit(0);
      }, 3000);
    } catch (error) {
      console.error('UpdateCommand error:', error);
      await ctx.reply(`❌ *Error al actualizar*\n\n${error}`);
    }
  }
}
