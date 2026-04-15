import { Middleware } from './Middleware.js';
import type { MessageContext } from '@/types/index.js';
import type { CommandRegistry } from '@/core/CommandRegistry.js';
import { pinVerificationService } from '@/services/system/PinVerificationService.js';
import { logger } from '@/utils/logger.js';

export const PIN_COMMANDS = ['eval', 'exec', 'grant', 'setowner', 'restart'];

export class PinVerificationMiddleware extends Middleware {
  name = 'pin-verification';

  constructor(private registry: CommandRegistry) {
    super();
  }

  async execute(ctx: MessageContext, next: () => Promise<void>): Promise<void> {
    if (!ctx.chat.isGroup && ctx.sender.isOwner) {
      const messageText = ctx.args.join(' ').trim();

      if (/^\d{6}$/.test(messageText)) {
        const result = await pinVerificationService.verifyPin(ctx.sender.jid, messageText);

        if (result.valid && result.command && result.args) {
          await ctx.react('✅');

          const command = this.registry.get(result.command);
          if (command) {
            ctx.args = result.args.split(' ').filter(arg => arg.length > 0);
            try {
              await command.execute(ctx);
            } catch (error) {
              logger.error(`[PinVerification] Error executing command ${result.command}`, {
                error: error instanceof Error ? error.message : 'Unknown',
              });
              await ctx.reply(
                `❌ Error al ejecutar el comando: ${error instanceof Error ? error.message : 'Unknown'}`,
              );
            }
            return;
          }
        } else {
          await ctx.react('❌');
          await ctx.reply('⚠️ PIN inválido o expirado. Necesitas ejecutar el comando de nuevo.');
          return;
        }
      }
    }

    await next();
  }
}
