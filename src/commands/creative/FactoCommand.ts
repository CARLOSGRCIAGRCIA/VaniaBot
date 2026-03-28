import { Command } from '../Command.js';
import { aiService } from '@/services/external/AIService.js';
import {
  CommandCategory,
  CommandContext,
  PermissionLevel,
  type MessageContext,
} from '@/types/index.js';

const FACTOS_PREDEFINED = [
  'La persona que dice "no me gusta drama" usually es la que lo crea.',
  'Si alguien te dice "soy honesto" sin que lo pidan, probablemente miente sobre otras cosas también.',
  'La mayoría de las personas que critican a los demás lo hacen porque no tienen nada mejor que ofrecer.',
  'Decir "no soy celoso" cuando no tienes a nadie es como decir "no me gasto el dinero" cuando estás bankrupt.',
  'Los que siempre dicen "tengo los卵 grandes" usualmente tienen las rodillas débiles.',
  'La persona que pregunta "¿por qué no me hablas?" fue la que te bloqueó primero.',
  'Si alguien dice que no le importa el dinero, es porque nunca ha tenido que preocuparse por него.',
  'La gente que presume de no dormir tiene 2 cosas: insomnio o nada que hacer.',
  'Decir "no tengo favoritos" cuando tienes 3 hijos es literalmente imposible.',
  'Los que siempre dicen "yo soy diferente" son los más predecibles del grupo.',
];

export class FactoCommand extends Command {
  name = 'facto';
  description = 'Envía una verdad incómoda y elegante';
  category = CommandCategory.FUN;
  aliases = ['facts', 'facto', 'verdad', 'coldtruth'];
  cooldown = 15000;
  contexts = [CommandContext.BOTH];
  usage = '!facto [tema]';
  examples = ['!facto', '!facto amigos', '!facto trabajo'];
  permissions = { user: [PermissionLevel.USER], bot: [] };

  async execute(ctx: MessageContext): Promise<void> {
    const args = ctx.args ?? [];
    const topic = args.join(' ');

    await ctx.react('🤔');

    try {
      let facto: string;

      if (topic) {
        const prompt = `Eres Vania, una bot fascinante. Genera UN SOLO "facto" - una verdad incómoda, fría, precisa y elegante sobre el tema: "${topic}".

Un facto es:
- Una verdad incómoda pero precisa
- Con un toque de veneno elegante
- Difícil de refutar
- Sofisticado, no grosero
- Debe hacer que la persona piense

Ejemplos de estilo:
- "inventar peleas es una táctica primitiva y carente de imaginación. Si alguien quiere dejar un clan, debería tener el *coraje* de hacerlo de manera directa y honesta, en lugar de recurrir a tácticas infantiles. Pero, supongo, eso requiere un nivel de *madurez* y *autoconocimiento* que no todos poseen."

- "La persona que dice 'no me gusta drama' usually es la que lo crea."

- "Presumir de no necesitar a nadie cuando estás solo es como presumir de no fumar cuando simplemente no has encontrado un cigarrillo."

Genera solo el facto, sin introducción, sin explicación. Sé creativo y diferente cada vez.`;

        const result = await aiService.chat(ctx.chat.jid, ctx.sender.jid, prompt, true);

        if (result.success && result.text) {
          facto = result.text.trim();
        } else {
          facto = this.getRandomFacto();
        }
      } else {
        facto = this.getRandomFacto();
      }

      const message = `📢 *FACTO*\n\n${facto}`;

      await ctx.reply(message);
      await ctx.react('💉');
    } catch {
      const facto = this.getRandomFacto();
      await ctx.reply(`📢 *FACTO*\n\n${facto}`);
    }
  }

  private getRandomFacto(): string {
    return FACTOS_PREDEFINED[Math.floor(Math.random() * FACTOS_PREDEFINED.length)];
  }
}
