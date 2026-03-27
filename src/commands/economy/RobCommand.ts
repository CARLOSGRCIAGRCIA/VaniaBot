import { Command } from '../Command.js';
import { CommandCategory, type MessageContext } from '@/types/index.js';
import { robberyService } from '@/services/economy/RobberyService.js';
import { serviceManager } from '@/services/system/Servicemanager.js';

export class RobCommand extends Command {
  name = 'robar';
  description = 'Intenta robar a un usuario del grupo';
  category = CommandCategory.ECONOMY;
  aliases = ['robar', 'rob', 'steal'];
  usage = '!robar [@usuario]';
  examples = ['!robar', '!robar @usuario'];
  cooldown = 300000;

  async execute(ctx: MessageContext): Promise<void> {
    const mentionedJid = ctx.message.message?.extendedTextMessage?.contextInfo?.mentionedJid?.[0];
    const chatJid = ctx.message.key.remoteJid || '';

    if (mentionedJid) {
      const result = await robberyService.attemptRobbery(ctx.sender.jid, mentionedJid);

      if (!result.success) {
        await ctx.reply(result.message);
        await ctx.react('❌');
        return;
      }

      await ctx.reply(result.message);
      await ctx.react(result.success ? '🎉' : '🚨');
      return;
    }

    const sender = await serviceManager.userService.getUser(ctx.sender.jid);

    if (sender.isOwner) {
      await ctx.reply(
        '🚨 *ROBAR* 🚨\n\n' +
          '✦ *Uso:* !robar @usuario\n\n' +
          '📊 *Información:*\n' +
          '• Solo efectivo en mano\n' +
          '• Banco está protegido\n' +
          '• Cooldown: 5-30 minutos\n' +
          '• Multa si te atrapan\n\n' +
          '⚠️ *No puedes robar a owners*',
      );
      return;
    }

    const participants: string[] = [];

    try {
      const groupMetadata = await ctx.sock.groupMetadata(chatJid);
      if (groupMetadata.participants) {
        for (const p of groupMetadata.participants) {
          const pid = p.id;
          if (pid && !pid.includes('@g.us') && !pid.includes('@lid') && pid !== ctx.sender.jid) {
            const user = await serviceManager.userService.getUser(pid);
            if (!user.isOwner && !user.isBanned && user.money > 1000) {
              participants.push(pid);
            }
          }
        }
      }
    } catch {
      await ctx.reply('❌ No se pudo obtener la lista de participantes');
      return;
    }

    if (participants.length === 0) {
      await ctx.reply(
        '💔 *No hay víctimas disponibles*\n\n' +
          'Nadie tiene suficiente dinero\n' +
          'para ser robado en el grupo.',
      );
      return;
    }

    const randomVictim = participants[Math.floor(Math.random() * participants.length)];

    const result = await robberyService.attemptRobbery(ctx.sender.jid, randomVictim);

    if (!result.success) {
      await ctx.reply(result.message);
      await ctx.react('❌');
      return;
    }

    await ctx.reply(result.message);
    await ctx.react('🎉');
  }
}
