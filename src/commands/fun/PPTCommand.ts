import { Command } from '../Command.js';
import {
  CommandCategory,
  CommandContext,
  PermissionLevel,
  type MessageContext,
} from '@/types/index.js';

export class PPTCommand extends Command {
  name = 'ppt';
  description = 'Piedra, papel o tijera';
  category = CommandCategory.FUN;
  aliases = ['piedra', 'ppt'];
  cooldown = 5000;
  contexts = [CommandContext.BOTH];
  usage = '!ppt <piedra|papel|tijera>';
  examples = ['!ppt piedra', '!ppt papel'];
  permissions = { user: [PermissionLevel.USER], bot: [] };

  async execute(ctx: MessageContext): Promise<void> {
    const opciones = ['piedra', 'papel', 'tijera'];
    const eleccion = ctx.args?.[0]?.toLowerCase();

    if (!eleccion || !opciones.includes(eleccion)) {
      await ctx.reply(
        '❌ *Elige una opción:*\n\n' +
          '🪨 piedra\n' +
          '📄 papel\n' +
          '✂️ tijera\n\n' +
          `Ejemplo: !ppt piedra`,
      );
      return;
    }

    const eleccionBot = opciones[Math.floor(Math.random() * 3)];
    const eleccionEmoji: Record<string, string> = {
      piedra: '🪨',
      papel: '📄',
      tijera: '✂️',
    };

    let resultado: string;
    let emoji: string;

    if (eleccion === eleccionBot) {
      resultado = '¡Empate! 🤝';
      emoji = '🤝';
    } else if (
      (eleccion === 'piedra' && eleccionBot === 'tijera') ||
      (eleccion === 'papel' && eleccionBot === 'piedra') ||
      (eleccion === 'tijera' && eleccionBot === 'papel')
    ) {
      resultado = '¡Ganaste! 🎉';
      emoji = '🏆';
    } else {
      resultado = '¡Perdiste! 😢';
      emoji = '💔';
    }

    await ctx.reply(
      `🎮 *Piedra, Papel o Tijera* 🎮\n\n` +
        `Tu: ${eleccionEmoji[eleccion]} *${eleccion}*\n` +
        `Bot: ${eleccionEmoji[eleccionBot]} *${eleccionBot}*\n\n` +
        `*${resultado}*`,
    );

    await ctx.react(emoji);
  }
}
