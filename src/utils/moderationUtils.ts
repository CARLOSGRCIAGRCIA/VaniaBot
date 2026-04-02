import type { MessageContext } from '@/types/index.js';

interface TargetUserResult {
  jid: string;
  fromQuoted: boolean;
}

export function getTargetUser(ctx: MessageContext): TargetUserResult | null {
  const mentionedJid = ctx.message.message?.extendedTextMessage?.contextInfo?.mentionedJid?.[0];
  const quotedJid = ctx.message.message?.extendedTextMessage?.contextInfo?.participant;

  if (mentionedJid) {
    return { jid: mentionedJid, fromQuoted: false };
  }

  if (quotedJid) {
    return { jid: quotedJid, fromQuoted: true };
  }

  return null;
}

export function getErrorMessage(operation: string): string {
  return `❌ Debes mencionar un usuario o responder a su mensaje para ${operation}`;
}
