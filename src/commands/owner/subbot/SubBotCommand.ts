/**
 * SubBotCommand.ts
 *
 * Commands for managing subbot registration and control.
 * Includes: register, delete, status, and reconnect subbots.
 * Implements cooldown system to prevent rapid re-registration.
 *
 * @author **Carlos G** ⭐
 * @github CARLOSGRCIAGRCIA
 * @tiktok carlos.grcia0
 * @instagram carlos.gxv
 * @created 2026-03-16
 */

import { Command } from '../../Command.js';
import {
  CommandCategory,
  CommandContext,
  PermissionLevel,
  type MessageContext,
} from '@/types/index.js';
import { subBotManager } from '@/services/subbot/SubBotManager.js';
import { subBotDatabase } from '@/services/subbot/SubBotDatabase.js';
import { logger } from '@/utils/logger.js';

/**
 * Cooldown period in milliseconds between subbot registration attempts
 */
const SUBBOT_COOLDOWN_MS = 60000;

/**
 * Map to track last registration attempt time per user
 */
const userLastAttempt = new Map<string, number>();

/**
 * Checks if a user can register a subbot based on cooldown period.
 *
 * @param userJid - The user's JID
 * @returns Object with 'allowed' boolean and 'remaining' seconds
 *
 * @example
 * ```typescript
 * const result = canRegisterSubBot('user@jid');
 * if (!result.allowed) {
 *   console.log(`Wait ${result.remaining} seconds`);
 * }
 * ```
 */
function canRegisterSubBot(userJid: string): { allowed: boolean; remaining: number } {
  const lastAttempt = userLastAttempt.get(userJid) ?? 0;
  const now = Date.now();
  const remaining = Math.ceil((lastAttempt + SUBBOT_COOLDOWN_MS - now) / 1000);

  if (now - lastAttempt >= SUBBOT_COOLDOWN_MS) {
    return { allowed: true, remaining: 0 };
  }
  return { allowed: false, remaining };
}

export class SubBotCommand extends Command {
  name = 'serbot';
  description = 'Register your number as a VaniaBot subbot';
  category = CommandCategory.SUBBOT;
  aliases = ['subbot', 'addbot'];
  usage = '.serbot <number>';
  examples = ['.serbot +529514639799'];
  contexts = [CommandContext.BOTH];
  permissions = { user: [PermissionLevel.USER] };

  /**
   * Executes the subbot registration command.
   * Validates phone number, checks cooldown, and initiates registration.
   *
   * @param ctx - The message context
   * @returns Promise<void>
   */
  async execute(ctx: MessageContext): Promise<void> {
    const phone = ctx.args[0];

    if (!phone) {
      await ctx.reply(
        `╭━━━ 🌸 *VaniaBot* ━━━╮\n` +
          `   *Conectar SubBot*\n` +
          `\n` +
          `💝 Vincula tu número\n` +
          `   para crear tu propia\n` +
          `   *SubBot*.\n` +
          `\n` +
          `*Uso*\n` +
          `• \`.serbot <numero>\`\n` +
          `\n` +
          `*Ejemplo*\n` +
          `• \`.serbot +529514639799\`\n` +
          `\n` +
          `🌍 Incluye el código\n` +
          `   de país:\n` +
          `🇲🇽 México: \`+52\`\n` +
          `🇺🇸 USA / Canadá: \`+1\`\n` +
          `\n` +
          `✨ Tu SubBot tendrá\n` +
          `   todos mis comandos\n` +
          `   disponibles 🦋\n` +
          `\n` +
          `   Estaré lista para ayudarte 💗\n` +
          `╰━━━━━━━━━━━━━━━━━━━━╯`,
      );
      return;
    }

    const cooldownCheck = canRegisterSubBot(ctx.sender.jid);
    if (!cooldownCheck.allowed) {
      await ctx.reply(
        `╭━━━ 🌸 *VaniaBot* ━━━╮\n` +
          `   *Registro de SubBot*\n` +
          `\n` +
          `⏳ Un pequeño momento...\n` +
          `\n` +
          `💗 Necesitas esperar\n` +
          `   *${cooldownCheck.remaining} segundos*\n` +
          `   antes de intentar\n` +
          `   registrar otra SubBot.\n` +
          `\n` +
          `✨ Esto ayuda a evitar\n` +
          `   errores por intentos\n` +
          `   demasiado rápidos.\n` +
          `\n` +
          `   Gracias por tu paciencia 🌸\n` +
          `╰━━━━━━━━━━━━━━━━━━━━╯`,
      );
      return;
    }

    const cleaned = phone.replace(/[\s\-\(\)]/g, '');
    if (!/^\+?\d{10,15}$/.test(cleaned)) {
      await ctx.reply(
        `❌ *Invalid number*\n\n` +
          `Correct format: \`+529514639799\`\n` +
          `• Include \`+\` and country code\n` +
          `• No spaces or dashes`,
      );
      return;
    }

    if (subBotDatabase.existsByOwner(ctx.sender.jid)) {
      const status = subBotManager.getStatus(ctx.sender.jid);
      await ctx.reply(
        `╭━━━ 🌸 *VaniaBot* ━━━╮\n` +
          `   *Tu SubBot*\n` +
          `\n` +
          `💗 Ya tienes una SubBot\n` +
          `   registrada.\n` +
          `\n` +
          `Número:\n` +
          `   *+${status?.phoneNumber}*\n` +
          `\n` +
          `${status?.status === 'connected' ? '✅' : '❌'} Estado:\n` +
          `   *${status?.status}*\n` +
          `\n` +
          `✨ *Opciones disponibles*\n` +
          `• *.statusbot* — Ver estado\n` +
          `• *.reconbot* — Reconectar\n` +
          `• *.delbot* — Eliminar\n` +
          `\n` +
          `   Estoy aquí para ayudarte 🌸\n` +
          `╰━━━━━━━━━━━━━━━━━━━━╯`,
      );
      return;
    }

    await ctx.react('⏳');

    try {
      logger.info(`🌸 SubBot: registering for ${ctx.sender.jid} with number ${cleaned}`);
      userLastAttempt.set(ctx.sender.jid, Date.now());
      await subBotManager.registerSubBot(ctx.sender.jid, ctx.sender.pushName, cleaned);
      await ctx.reply(
        `╭━━━ 🌸 *VaniaBot* ━━━╮\n` +
          `   *SubBot creada*\n` +
          `\n` +
          `💝 Tu SubBot fue\n` +
          `   registrada con éxito.\n` +
          `\n` +
          `Número:\n` +
          `   *${cleaned}*\n` +
          `\n` +
          `Estoy generando\n` +
          `   tu *pairing code*...\n` +
          `\n` +
          `En unos segundos\n` +
          `   lo enviaré aquí.\n` +
          `\n` +
          `🦋 Espera el código\n` +
          `   y sigue las\n` +
          `   instrucciones.\n` +
          `\n` +
          `   ¡Estoy lista para ayudarte! 💗\n` +
          `╰━━━━━━━━━━━━━━━━━━━━╯`,
      );
      await ctx.react('✅');
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Unknown error';
      logger.error(`❌ SubBot: registration error: ${msg}`);
      await ctx.reply(`❌ *Error:* ${msg}`);
      await ctx.react('❌');
    }
  }
}

export class DelBotCommand extends Command {
  name = 'delbot';
  description = 'Delete your VaniaBot subbot';
  category = CommandCategory.SUBBOT;
  aliases = ['removebot', 'unserbot'];
  usage = '.delbot';
  examples = ['.delbot'];
  contexts = [CommandContext.BOTH];
  permissions = { user: [PermissionLevel.USER] };

  async execute(ctx: MessageContext): Promise<void> {
    if (!subBotDatabase.existsByOwner(ctx.sender.jid)) {
      await ctx.reply(
        `❌ *You don't have a registered subbot*\n\n` + `Use *.serbot <number>* to create one 🦋`,
      );
      return;
    }

    await ctx.react('⏳');
    try {
      await subBotManager.deleteSubBot(ctx.sender.jid);
      await ctx.reply(
        `╭━━━ 🌸 *VaniaBot* ━━━╮\n` +
          `   *SubBot eliminada*\n` +
          `\n` +
          `Tu SubBot fue\n` +
          `   eliminada con éxito.\n` +
          `\n` +
          `La sesión ha sido\n` +
          `   borrada completamente.\n` +
          `\n` +
          `🦋 Si deseas crear\n` +
          `   una nueva SubBot,\n` +
          `   usa:\n` +
          `\n` +
          `   *.serbot <numero>*\n` +
          `\n` +
          `   Estoy aquí para ayudarte 💗\n` +
          `╰━━━━━━━━━━━━━━━━━━━━╯`,
      );
      await ctx.react('✅');
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Unknown error';
      logger.error(`❌ SubBot: deletion error: ${msg}`);
      await ctx.reply(`❌ *Error:* ${msg}`);
      await ctx.react('❌');
    }
  }
}

export class StatusBotCommand extends Command {
  name = 'statusbot';
  description = 'View your subbot status';
  category = CommandCategory.SUBBOT;
  aliases = ['mibot', 'mybot'];
  usage = '.statusbot';
  examples = ['.statusbot'];
  contexts = [CommandContext.BOTH];
  permissions = { user: [PermissionLevel.USER] };

  async execute(ctx: MessageContext): Promise<void> {
    const status = subBotManager.getStatus(ctx.sender.jid);

    if (!status) {
      await ctx.reply(
        `ℹ️ *You don't have a registered subbot*\n\n` + `Use *.serbot <number>* to create one 🦋`,
      );
      return;
    }

    const statusEmoji: Record<string, string> = {
      pending: '⏳',
      connecting: '🔄',
      connected: '✅',
      disconnected: '❌',
      error: '⚠️',
    };
    const statusLabel: Record<string, string> = {
      pending: 'Pending',
      connecting: 'Connecting',
      connected: 'Connected',
      disconnected: 'Disconnected',
      error: 'Error',
    };

    const connectedSince = status.connectedAt
      ? `\n🕐 *Active since:* ${new Date(status.connectedAt).toLocaleString('en-US')}`
      : '';

    await ctx.reply(
      `╭━━━ 🌸 *VaniaBot* ━━━╮\n` +
        `   *Estado de tu SubBot*\n` +
        `\n` +
        `Nombre:\n` +
        `   *${status.name}*\n` +
        `\n` +
        `Número:\n` +
        `   *+${status.phoneNumber}*\n` +
        `\n` +
        `${statusEmoji[status.status] ?? '❓'} Estado:\n` +
        `   *${statusLabel[status.status] ?? status.status}*` +
        `${connectedSince}\n` +
        `\n` +
        `ID:\n` +
        `   \`${status.id}\`\n` +
        `\n` +
        `*Opciones disponibles*\n` +
        `• *.serbot* — Crear SubBot\n` +
        `• *.delbot* — Eliminar\n` +
        `• *.reconbot* — Reconectar\n` +
        `\n` +
        `   Estoy aquí para ayudarte 🌸\n` +
        `╰━━━━━━━━━━━━━━━━━━━━╯`,
    );
  }
}

export class ReconBotCommand extends Command {
  name = 'reconbot';
  description = 'Reconnect your subbot';
  category = CommandCategory.SUBBOT;
  aliases = ['restartbot', 'resetbot'];
  usage = '.reconbot';
  examples = ['.reconbot'];
  contexts = [CommandContext.BOTH];
  permissions = { user: [PermissionLevel.USER] };

  async execute(ctx: MessageContext): Promise<void> {
    if (!subBotDatabase.existsByOwner(ctx.sender.jid)) {
      await ctx.reply(
        `❌ *You don't have a registered subbot*\n\n` + `Use *.serbot <number>* to create one 🦋`,
      );
      return;
    }

    await ctx.react('⏳');
    try {
      await subBotManager.reconnectSubBot(ctx.sender.jid);
      await ctx.reply(
        `╭━━━ 🌸 *VaniaBot* ━━━╮\n` +
          `   *Reconectando SubBot*\n` +
          `\n` +
          `Estoy reconectando\n` +
          `   tu SubBot...\n` +
          `\n` +
          `En unos segundos\n` +
          `   recibirás aquí\n` +
          `   tu *pairing code*.\n` +
          `\n` +
          `🦋 Cuando llegue,\n` +
          `   solo sigue las\n` +
          `   instrucciones.\n` +
          `\n` +
          `   Estoy contigo 💗\n` +
          `╰━━━━━━━━━━━━━━━━━━━━╯`,
      );
      await ctx.react('✅');
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Unknown error';
      await ctx.reply(`❌ *Error:* ${msg}`);
      await ctx.react('❌');
    }
  }
}
