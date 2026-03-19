/**
 * AiMentionHandler.ts
 *
 * Handles AI chat when the bot is mentioned in a message.
 * Processes mentions and routes them to the AI service for contextual responses.
 * Includes logic for solo-admin mode and permission checking.
 *
 * @author **Carlos G** ⭐
 * @github CARLOSGRCIAGRCIA
 * @tiktok carlos.grcia0
 * @instagram carlos.gxv
 * @created 2026-03-16
 */

import { aiService } from '@/services/external/AIService.js';
import type { MessageContext } from '@/types/index.js';
import { serviceManager } from '@/services/system/Servicemanager.js';
import { PermissionService } from '@/services/PermissionService.js';
import { logError } from '@/utils/logger.js';

/**
 * Handles mention events for AI chat.
 * Checks if the bot was mentioned and routes to AI service if valid.
 *
 * @param ctx - The message context
 * @param botJid - The bot's JID to check against
 * @returns true if mention was handled, false otherwise
 *
 * @example
 * ```typescript
 * const botJid = sock.user?.id ?? '';
 * await handleMention(ctx, botJid);
 * ```
 */
export async function handleMention(ctx: MessageContext, botJid: string): Promise<boolean> {
  const rawText: string = ctx.text ?? '';
  const message = ctx.message.message;

  const mentionedJids: string[] = message?.extendedTextMessage?.contextInfo?.mentionedJid ?? [];

  const sockUser = ctx.sock.user as { id?: string; lid?: string } | undefined;
  const botLid: string | undefined = sockUser?.lid;
  const botNumber = botJid.split('@')[0].split(':')[0];

  const mentionedByJid = mentionedJids.some((jid: string) => {
    const jidClean = jid.split('@')[0].split(':')[0];
    if (jidClean === botNumber) return true;
    if (botLid) {
      const lidClean = botLid.split('@')[0].split(':')[0];
      if (jidClean === lidClean) return true;
    }
    return false;
  });

  if (!mentionedByJid) return false;

  if (ctx.chat.isGroup) {
    const onlyAdmin = await serviceManager.groupService.getOnlyAdmin(ctx.chat.jid);

    if (onlyAdmin) {
      const isOwner = PermissionService.isOwner(ctx.sender.jid);

      if (!isOwner) {
        await ctx.loadSenderPermissions();
        if (!ctx.sender.isAdmin) {
          return false;
        }
      }
    }
  }

  const cleanText = rawText
    .replace(/@\d+/g, '')
    .replace(/@vania/gi, '')
    .replace(/\bvania\b/gi, '')
    .replace(/[,:\s]+$/, '')
    .trim();

  if (!cleanText) {
    await ctx.reply(`Did you call me? Tell me what you need or use *!ai <message>* to chat.`);
    return true;
  }

  await ctx.react('🤔');

  let response;
  try {
    response = await aiService.chat(ctx.chat.jid, ctx.sender.jid, cleanText);
  } catch (error) {
    logError('AiMentionHandler.aiService.chat', error);
    await ctx.react('❌');
    await ctx.reply('❌ Ocurrió un error al procesar tu mensaje.');
    return true;
  }

  if (!response.success) {
    await ctx.react('❌');
    await ctx.reply(`❌ ${response.error}`);
    return true;
  }

  await ctx.react('✅');
  await ctx.reply(response.text ?? '');
  return true;
}
