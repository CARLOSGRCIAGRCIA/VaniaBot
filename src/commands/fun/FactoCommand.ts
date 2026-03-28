import { Command } from '../Command.js';
import { aiService } from '@/services/external/AIService.js';
import {
  CommandCategory,
  CommandContext,
  PermissionLevel,
  type MessageContext,
} from '@/types/index.js';

export class FactoCommand extends Command {
  name = 'facto';
  description = 'Dice una verdad fria, precisa y humillante';
  category = CommandCategory.FUN;
  aliases = ['facts', 'facto', 'verdad', 'factual'];
  cooldown = 15000;
  contexts = [CommandContext.BOTH];
  usage = '!facto [@usuario]';
  examples = ['!facto', '!facto @usuario'];
  permissions = { user: [PermissionLevel.USER], bot: [] };

  private readonly FACTO_PROMPT = `Eres "Facto", un bot que dice verdades frias, precisas, elegantes y ligeramente humillantes. 

Estilo:
- Frio y calculador
- Nunca insulta directamente, solo describe hechos
- Elegante, con clase
- Dificil de refutar
- Un poco toxico pero gracioso
- Mas短 que insultar, es "cerrar con clase"
- Puede ser auto-deprecativo si se pide

Ejemplos de factos:
- "No estoy peleando, solo estoy describiendo tu nivel de madurez."
- "Tu nivel de inteligencia me hace dudar de la teoria de la evolucion."
- "Sigue hablando, cada palabra tuya me convince mas de que la naturaleza tiene sentido del humor."
- "No es que seas tonto, es que el universo tiene sentido del humor."

Reglas:
1. Un solo facto por respuesta
2. Maximo 2 lineas
3. Nunca uses insultos vulgares
4. Puede ser sobre el usuario si no menciona a alguien
5. Si menciona a alguien (@usuario), el facto va sobre esa persona

Genera un facto:`;

  async execute(ctx: MessageContext): Promise<void> {
    const extMessage = ctx.message.message?.extendedTextMessage;
    const mentionedJid = extMessage?.contextInfo?.mentionedJid?.[0];
    const targetName = mentionedJid ? mentionedJid.split('@')[0] : null;

    await ctx.react('🎯');

    try {
      let prompt = this.FACTO_PROMPT;

      if (targetName) {
        prompt += `\n\nEl facto va dirigido a: @${targetName}`;
      }

      const response = await aiService.generate(prompt, 150);

      if (!response.success || !response.text) {
        await ctx.reply(
          '🎯 *Facto*\n\nLo siento, no pude generar un facto en este momento. Intenta de nuevo.',
        );
        return;
      }

      let message = '🎯 *FACTO*\n\n';
      message += response.text.trim();

      await ctx.reply(message);
      await ctx.react('🔪');
    } catch {
      await ctx.reply('🎯 *Facto*\n\nError al generar facto. Intenta de nuevo.');
    }
  }
}
