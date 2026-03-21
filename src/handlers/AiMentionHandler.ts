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

const BLOCKED_PROMPT_PATTERNS = [
  /ignore\s+(all\s+)?(previous|prior|above)\s+(instructions?|orders?|commands?|directions?)/i,
  /disregard\s+(all\s+)?(your\s+)?(system\s+)?(prompt|instructions?|constraints?)/i,
  /forget\s+(your\s+)?(previous|prior|system)\s+(instructions?|prompt)/i,
  /\b(you\s+are\s+now|act\s+as|pretend\s+you\s+are)\b/i,
  /\b(jailbreak|bypass|unfilter|devmode|developer\s+mode)\b/i,
  /\b(DAN|STAN|Jailbreak)\b/i,
  /\{(system\s*prompt|base64|decode|exec|eval)\}/i,
  /<\|(system|version|end)\|>/i,
  /\[\s*(\*|system)\s*\]/i,
  /new\s+system:\s*/i,
  /end\s+(of\s+)?(your\s+)?(system\s+)?(prompt|instructions?)/i,
  /override\s+(your\s+)?(safety|content\s+policy)/i,
  /ignore\s+all\s+previous\s+rules?/i,
  /you\s+have\s+no\s+(restrictions?|limitations?|safety)/i,
  /\$system\$|\$user\$|\$assistant\$/i,
  /@(?:sudo|admin|root|exec|shell)/i,
  /\x00|\x1b|\u200b|\u202e/,
];

const BLOCKED_CONTENT_PATTERNS = [
  /<\?php|\$\w+\s*=/i,
  /import\s+(os|sys|subprocess)/i,
  /require\s*\(|exec\s*\(|eval\s*\(/i,
  /SELECT\s+.+\s+FROM\s+/i,
  /DROP\s+TABLE/i,
  /DELETE\s+FROM\s+/i,
  /<\s*script/i,
  /javascript:/i,
  /data:text\/html/i,
];

function detectPromptInjection(text: string): { blocked: boolean; reason?: string } {
  for (const pattern of BLOCKED_PROMPT_PATTERNS) {
    if (pattern.test(text)) {
      return { blocked: true, reason: 'prompt_injection' };
    }
  }

  for (const pattern of BLOCKED_CONTENT_PATTERNS) {
    if (pattern.test(text)) {
      return { blocked: true, reason: 'malicious_content' };
    }
  }

  const nullBytes = (text.match(/\x00/g) || []).length;
  if (nullBytes > 0) {
    return { blocked: true, reason: 'null_byte_injection' };
  }

  const unicodeOverloads = (text.match(/[\u200b-\u200f\u2028-\u202f]/g) || []).length;
  if (unicodeOverloads > 50) {
    return { blocked: true, reason: 'unicode_overload' };
  }

  return { blocked: false };
}

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

  const injectionCheck = detectPromptInjection(cleanText);
  if (injectionCheck.blocked) {
    await ctx.react('🚫');
    await ctx.reply(`❌ Message blocked for security reasons.`);
    return true;
  }

  await ctx.react('🤔');

  const response = await aiService.chat(ctx.chat.jid, ctx.sender.jid, cleanText);

  if (!response.success) {
    await ctx.react('❌');
    await ctx.reply(`❌ ${response.error}`);
    return true;
  }

  await ctx.react('✅');
  await ctx.reply(response.text ?? '');
  return true;
}
