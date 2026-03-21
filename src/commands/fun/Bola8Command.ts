import { Command } from '../Command.js';
import {
  CommandCategory,
  CommandContext,
  PermissionLevel,
  type MessageContext,
} from '@/types/index.js';

export class Bola8Command extends Command {
  name = '8ball';
  description = 'Pregunta a la bola 8 mágica';
  category = CommandCategory.FUN;
  aliases = ['bola8', 'bola', 'magic8'];
  cooldown = 5000;
  contexts = [CommandContext.BOTH];
  usage = '!8ball <pregunta>';
  examples = ['!8ball ¿Me quiere?', '!bola8 ¿Voy a ser rico?'];
  permissions = { user: [PermissionLevel.USER], bot: [] };

  async execute(ctx: MessageContext): Promise<void> {
    const pregunta = ctx.args?.join(' ') || 'la vida';

    const respuestas: Record<string, string[]> = {
      si: ['¡Sí! 🔥', '¡Obvio! 💯', '¡Sin duda! ✨', '¡Claro que sí! 🎯'],
      no: ['No 😢', 'Nunca 💔', 'Imposible 🚫', 'Ni lo sueñes 😤'],
      talvez: ['Tal vez... 🤔', 'Quizás 🤷', 'No estoy seguro 🤷', 'Pregunta de nuevo 🔄'],
    };

    const tipo = Object.keys(respuestas)[Math.floor(Math.random() * 3)] as keyof typeof respuestas;
    const respuesta = respuestas[tipo][Math.floor(Math.random() * respuestas[tipo].length)];

    await ctx.react('🎱');

    await ctx.reply(
      `🎱 *Bola 8 Mágica* 🎱\n\n` +
        `❓ *Pregunta:* ${pregunta}\n\n` +
        `✨ *Respuesta:* ${respuesta}`,
    );

    await ctx.react('🔮');
  }
}
