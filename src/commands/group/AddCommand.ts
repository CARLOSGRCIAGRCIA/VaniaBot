import { Command } from '../Command.js';
import { CommandCategory, CommandContext } from '@/types/index.js';
import type { MessageContext } from '@/types/index.js';

export class AddCommand extends Command {
  name = 'add';
  description = 'Añadir un usuario directamente al grupo';
  category = CommandCategory.GROUP;
  aliases = ['agregar', 'añadir'];
  usage = '!add <número>';
  examples = ['!add 5219514639799'];
  cooldown = 30_000;
  contexts = [CommandContext.GROUP];

  async execute(ctx: MessageContext): Promise<void> {
    const number = ctx.args[0]?.replace(/[^0-9]/g, '');

    if (!number) {
      await ctx.reply(
        `˚₊· ͟͟͞͞➳ *necesito un número* ˚₊· ͟͟͞͞➳\n\n` +
          `✿ *!add* <número>\n` +
          `✩ ejemplo: *!add 5219514639799* ✩`,
      );
      return;
    }

    const targetJid = `${number}@s.whatsapp.net`;

    try {
      const groupMeta = await ctx.sock.groupMetadata(ctx.chat.jid);
      const botJid = ctx.sock.user?.id;
      const botIsAdmin = groupMeta.participants.find(p => p.id === botJid)?.admin;

      if (!botIsAdmin) {
        await ctx.reply(
          `˚₊· ͟͟͞͞➳ *ups* ˚₊· ͟͟͞͞➳\n\n` +
            `❌ Necesito ser administrador para añadir usuarios directamente.`,
        );
        return;
      }

      const existsResult = await ctx.sock.onWhatsApp(targetJid);
      const exists = existsResult?.[0];
      if (!exists || !exists.exists) {
        await ctx.reply(
          `˚₊· ͟͟͞͞➳ *ups* ˚₊· ͟͟͞͞➳\n\n` + `❌ El número *${number}* no existe en WhatsApp.`,
        );
        return;
      }

      const participants = groupMeta.participants.map(p => p.id);
      if (participants.includes(targetJid)) {
        await ctx.reply(`˚₊· ͟͟͞͞➳ *ya está* ˚₊· ͟͟͞͞➳\n\n` + `⚠️ El usuario ya está en el grupo.`);
        return;
      }

      await ctx.sock.groupParticipantsUpdate(ctx.chat.jid, [targetJid], 'add');

      await ctx.reply(
        `˚₊· ͟͟͞͞➳ *añadido* ˚₊· ͟͟͞͞➳\n\n` + `✅ *${number}* añadido exitosamente al grupo.`,
      );
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);

      if (errorMessage.includes('403')) {
        await ctx.reply(
          `˚₊· ͟͟͞͞➳ *privacidad* ˚₊· ͟͟͞͞➳\n\n` +
            `🔒 El usuario tiene su privacidad configurada para no ser añadido.`,
        );
        return;
      }

      if (errorMessage.includes('408')) {
        await ctx.reply(`˚₊· ͟͟͞͞➳ *timeout* ˚₊· ͟͟͞͞➳\n\n` + `⏱️ El usuario no respondió a tiempo.`);
        return;
      }

      if (errorMessage.includes('409')) {
        await ctx.reply(`˚₊· ͟͟͞͞➳ *ya está* ˚₊· ͟͟͞͞➳\n\n` + `🚫 El usuario ya está en el grupo.`);
        return;
      }

      console.error('[AddCommand] Error:', error);
      await ctx.reply(
        `˚₊· ͟͟͞͞➳ *ups* ˚₊· ͟͟͞͞➳\n\n` +
          `❌ No pude añadir al usuario. Puede que bloquee mensajes de desconocidos.`,
      );
    }
  }
}
