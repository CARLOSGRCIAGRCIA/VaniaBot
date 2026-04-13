import type { MessageContext } from '@/types/index.js';

export class ImageHelper {
  static async getProfileImage(ctx: MessageContext): Promise<string | null> {
    const msg = ctx.message.message;
    const mentionedJid = msg?.extendedTextMessage?.contextInfo?.mentionedJid?.[0];
    const targetJid = mentionedJid || ctx.sender.jid;

    try {
      const profileUrl = await ctx.sock.profilePictureUrl(targetJid, 'image');
      return profileUrl || null;
    } catch {
      return null;
    }
  }

  static async getTwoProfileImages(ctx: MessageContext): Promise<[string | null, string | null]> {
    const msg = ctx.message.message;
    const mentionedJid = msg?.extendedTextMessage?.contextInfo?.mentionedJid?.[0];

    let image1: string | null = null;
    let image2: string | null = null;

    try {
      const url1 = await ctx.sock.profilePictureUrl(ctx.sender.jid, 'image');
      image1 = url1 || null;
    } catch {
      image1 = null;
    }

    if (mentionedJid) {
      try {
        const url2 = await ctx.sock.profilePictureUrl(mentionedJid, 'image');
        image2 = url2 || null;
      } catch {
        image2 = null;
      }
    }

    if (!image2 && image1) {
      image2 = image1;
    }

    return [image1, image2];
  }

  static async getImageOrProfile(ctx: MessageContext): Promise<string | null> {
    const msg = ctx.message.message;
    const directImage = msg?.imageMessage;
    const quotedMsg = msg?.extendedTextMessage?.contextInfo?.quotedMessage;
    const quotedImage = quotedMsg?.imageMessage;
    const mentionedJid = msg?.extendedTextMessage?.contextInfo?.mentionedJid?.[0];
    const quotedSender = msg?.extendedTextMessage?.contextInfo?.quotedMessage
      ? msg.extendedTextMessage.contextInfo.participant
      : null;

    if (directImage?.url) {
      return directImage.url;
    }

    if (quotedImage?.url) {
      return quotedImage.url;
    }

    const targetJid = mentionedJid || quotedSender || ctx.sender.jid;
    try {
      const profileUrl = await ctx.sock.profilePictureUrl(targetJid, 'image');
      return profileUrl || null;
    } catch {
      return null;
    }
  }
}
