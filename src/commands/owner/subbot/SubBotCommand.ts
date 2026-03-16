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
        `╔═══════════════════════════╗\n` +
          `║  🌸 *VaniaBot — SubBot*     ║\n` +
          `╚═══════════════════════════╝\n\n` +
          `*Link your number as a subbot!* 💝\n\n` +
          `📋 *Usage:* \`.serbot <number>\`\n` +
          `📌 *Example:* \`.serbot +529514639799\`\n\n` +
          `⚠️ Include country code:\n` +
          `🇲🇽 Mexico: \`+52\`\n` +
          `🇺🇸 USA/Canada: \`+1\`\n\n` +
          `ℹ️ Your subbot will have all VaniaBot\n` +
          `commands available 🦋\n\n` +
          `_— VaniaBot 🌸_`,
      );
      return;
    }

    const cooldownCheck = canRegisterSubBot(ctx.sender.jid);
    if (!cooldownCheck.allowed) {
      await ctx.reply(
        `╔═══════════════════════════╗\n` +
          `║  🌸 *VaniaBot — SubBot*     ║\n` +
          `╚═══════════════════════════╝\n\n` +
          `⏳ *Please wait...*\n\n` +
          `You must wait *${cooldownCheck.remaining} seconds* before\n` +
          `trying to register a subbot again.\n\n` +
          `This prevents errors from too rapid requests.\n` +
          `_— VaniaBot 🌸_`,
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
        `╔═══════════════════════════╗\n` +
          `║  🌸 *VaniaBot — SubBot*     ║\n` +
          `╚═══════════════════════════╝\n\n` +
          `⚠️ *You already have a registered subbot*\n\n` +
          `📞 Number: *+${status?.phoneNumber}*\n` +
          `${status?.status === 'connected' ? '✅' : '❌'} Status: *${status?.status}*\n\n` +
          `Available commands:\n` +
          `• *.statusbot* — View status\n` +
          `• *.reconbot* — Reconnect\n` +
          `• *.delbot* — Delete\n\n` +
          `_— VaniaBot 🌸_`,
      );
      return;
    }

    await ctx.react('⏳');

    try {
      logger.info(`🌸 SubBot: registering for ${ctx.sender.jid} with number ${cleaned}`);
      userLastAttempt.set(ctx.sender.jid, Date.now());
      await subBotManager.registerSubBot(ctx.sender.jid, ctx.sender.pushName, cleaned);
      await ctx.reply(
        `╔═══════════════════════════╗\n` +
          `║  🌸 *VaniaBot — SubBot*     ║\n` +
          `╚═══════════════════════════╝\n\n` +
          `✅ *Subbot registered successfully!* 💝\n\n` +
          `📞 Number: *${cleaned}*\n` +
          `⏳ Generating pairing code...\n\n` +
          `📲 I will send it here in a few seconds.\n` +
          `_Wait for the code and follow instructions_ 🦋\n\n` +
          `_— VaniaBot 🌸_`,
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
        `╔═══════════════════════════╗\n` +
          `║  🌸 *VaniaBot — SubBot*     ║\n` +
          `╚═══════════════════════════╝\n\n` +
          `🗑️ *Subbot deleted successfully* 💝\n\n` +
          `The session has been completely erased.\n` +
          `Use *.serbot <number>* to create a new one 🦋\n\n` +
          `_— VaniaBot 🌸_`,
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
      `╔═══════════════════════════╗\n` +
        `║  🌸 *VaniaBot — SubBot*     ║\n` +
        `╚═══════════════════════════╝\n\n` +
        `🏷️ *Name:* ${status.name}\n` +
        `📞 *Number:* +${status.phoneNumber}\n` +
        `${statusEmoji[status.status] ?? '❓'} *Status:* ${statusLabel[status.status] ?? status.status}` +
        `${connectedSince}\n` +
        `🆔 *ID:* \`${status.id}\`\n\n` +
        `_Available commands:_\n` +
        `• *.serbot* — Create subbot\n` +
        `• *.delbot* — Delete subbot\n` +
        `• *.reconbot* — Reconnect subbot\n\n` +
        `_— VaniaBot 🌸_`,
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
        `╔═══════════════════════════╗\n` +
          `║  🌸 *VaniaBot — SubBot*     ║\n` +
          `╚═══════════════════════════╝\n\n` +
          `🔄 *Reconnecting your subbot...* 💝\n\n` +
          `⏳ You will receive the pairing code\n` +
          `in this chat in a few seconds.\n\n` +
          `_Follow the instructions when it arrives_ 🦋\n\n` +
          `_— VaniaBot 🌸_`,
      );
      await ctx.react('✅');
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Unknown error';
      await ctx.reply(`❌ *Error:* ${msg}`);
      await ctx.react('❌');
    }
  }
}
