import { Command } from '../Command.js';
import { CommandCategory } from '@/types/index.js';
import type { MessageContext } from '@/types/index.js';
import { serviceManager } from '@/services/system/Servicemanager.js';
import { formatNumber } from '@/utils/helpers.js';

export class PayRandomCommand extends Command {
  name = 'payrandom';
  description = 'Envía una cantidad aleatoria de dinero a un usuario random del grupo (Owner only)';
  category = CommandCategory.ECONOMY;
  aliases = ['payrandom', 'regalo', 'donacion'];
  usage = '!payrandom <cantidad>';
  examples = ['!payrandom 1000000', '!regalo 500000'];
  cooldown = 60000;

  async execute(ctx: MessageContext): Promise<void> {
    const sender = await serviceManager.userService.getUser(ctx.sender.jid);

    if (!sender.isOwner) {
      await ctx.reply('❌ *Solo el Owner puede usar este comando*');
      await ctx.react('❌');
      return;
    }

    const amountStr = ctx.args[0];
    const amount = parseInt(amountStr);

    if (!amountStr || isNaN(amount) || amount <= 0) {
      await ctx.reply(
        '🎁 *PAGO ALEATORIO*\n\n' +
          'Envía dinero aleatorio a un miembro del grupo.\n\n' +
          '💰 *Uso:* !payrandom <cantidad>\n' +
          '💰 *Ejemplo:* !payrandom 1000000\n\n' +
          '⚠️ *Nota:* El dinero se envía a un usuario aleatorio del grupo.',
      );
      return;
    }

    const chatJid = ctx.message.key.remoteJid || '';

    const participants: string[] = [];

    try {
      const groupMetadata = await ctx.sock.groupMetadata(chatJid);
      if (groupMetadata.participants) {
        for (const p of groupMetadata.participants) {
          if (p.id && !p.id.includes('@g.us') && !p.id.includes('@lid')) {
            participants.push(p.id);
          }
        }
      }
    } catch {
      await ctx.reply('❌ No se pudo obtener la lista de participantes del grupo');
      return;
    }

    if (participants.length === 0) {
      await ctx.reply('❌ No hay participantes en el grupo');
      return;
    }

    const randomParticipant = participants[Math.floor(Math.random() * participants.length)];

    await serviceManager.userService.addMoney(randomParticipant, amount);

    const receiver = await serviceManager.userService.getUser(randomParticipant);
    const displayNumber = randomParticipant.split('@')[0];

    await ctx.reply(
      `🎁 *PAGO ALEATORIO REALIZADO* 🎁\n\n` +
        `✨ *$${formatNumber(amount)}* fueron enviados\n\n` +
        `📱 *Destinatario:* @${displayNumber}\n` +
        `👤 *Nombre:* ${receiver.name}\n\n` +
        `💝 *Sorteo completado*`,
    );

    await ctx.react('🎁');
  }
}
