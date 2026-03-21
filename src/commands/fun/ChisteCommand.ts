import { Command } from '../Command.js';
import { aiService } from '@/services/external/AIService.js';
import { AI_PROMPTS } from '@/config/ai-prompts.js';
import {
  CommandCategory,
  CommandContext,
  PermissionLevel,
  type MessageContext,
} from '@/types/index.js';

const CHISTES_CORTOS = [
  '¿Qué le dijo un .exe a un .bat?\nEXE-cúsame, pero estoy en otra extensión',
  '¿Cómo se despiden los chemists?\nÁcido mieling',
  '¿Por qué los bookmarks nunca se estresan?\nPorque siempre tienen su lugar marcado',
  'Un optimista dice: El vaso está medio lleno\nUn pesimista dice: El vaso está medio vacío\nEl ingeniero dice: El vaso es el doble de grande de lo necesario',
  '¿Qué hace una abeja en el gym?\nZumba',
  '¿Cómo se dice pañuelo en japonés?\nSaka-moe',
];

export class ChisteCommand extends Command {
  name = 'chiste';
  description = 'Cuenta un chiste random';
  category = CommandCategory.FUN;
  aliases = ['ch', 'joke', 'chistes'];
  cooldown = 8000;
  contexts = [CommandContext.BOTH];
  usage = '!chiste [categoria]';
  examples = ['!chiste', '!chiste largo'];
  permissions = { user: [PermissionLevel.USER], bot: [] };

  async execute(ctx: MessageContext): Promise<void> {
    const args = ctx.args ?? [];
    const tipo = args[0]?.toLowerCase() === 'largo' ? 'largo' : 'corto';

    await ctx.react('😄');

    try {
      const prompt = tipo === 'largo' ? AI_PROMPTS.CHISTE_LARGO : AI_PROMPTS.CHISTE_CORTO;

      const response = await aiService.generate(prompt, 300);

      if (!response.success || !response.text) {
        const fallback = CHISTES_CORTOS[Math.floor(Math.random() * CHISTES_CORTOS.length)];
        await ctx.reply(`😄 *Chiste* 😄\n\n${fallback}`);
        return;
      }

      await ctx.reply(`😄 *Chiste ${tipo}* 😄\n\n${response.text.trim()}`);
      await ctx.react('😂');
    } catch {
      const fallback = CHISTES_CORTOS[Math.floor(Math.random() * CHISTES_CORTOS.length)];
      await ctx.reply(`😄 *Chiste* 😄\n\n${fallback}`);
    }
  }
}
