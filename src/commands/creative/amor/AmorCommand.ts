import { Command } from '../../Command.js';
import { aiService } from '@/services/external/AIService.js';
import {
  CommandCategory,
  CommandContext,
  PermissionLevel,
  type MessageContext,
} from '@/types/index.js';

const AMOR_TIPOS = ['mensaje', 'carta', 'poesia', 'piropo', 'dedicatoria'] as const;
type AmorTipo = (typeof AMOR_TIPOS)[number];

const EMOJIS: Record<AmorTipo, string> = {
  mensaje: '💕',
  carta: '💌',
  poesia: '🌹',
  piropo: '😏',
  dedicatoria: '🎵',
};

export class AmorCommand extends Command {
  name = 'amor';
  description = 'Genera mensajes de amor románticos';
  category = CommandCategory.FUN;
  aliases = ['love', 'romance', 'romantico', 'enamorar'];
  cooldown = 8000;
  contexts = [CommandContext.BOTH];
  usage = '!amor [tipo] [para:nombre]';
  examples = ['!amor', '!amor mensaje', '!amor carta para:María', '!amor piropo'];
  permissions = { user: [PermissionLevel.USER], bot: [] };

  async execute(ctx: MessageContext): Promise<void> {
    const args = ctx.args ?? [];
    let tipo: AmorTipo = 'mensaje';

    const tipoArg = args[0]?.toLowerCase();
    if (tipoArg && AMOR_TIPOS.includes(tipoArg as AmorTipo)) {
      tipo = tipoArg as AmorTipo;
    }

    const paraMatch = args.find((arg: string) => arg.startsWith('para:'));
    let paraNombre = '';
    if (paraMatch) {
      paraNombre = paraMatch.replace('para:', '').trim();
    }

    const tema = args.filter((arg: string) => !arg.startsWith('para:')).join(' ') || 'amor';

    await ctx.react(EMOJIS[tipo]);

    try {
      const prompt = this.buildPrompt(tipo, tema, paraNombre);
      const response = await aiService.chat(prompt, ctx.sender.jid, ctx.chat.jid);

      if (!response.success || !response.text) {
        await ctx.react('❌');
        await ctx.reply('No pude generar el mensaje. Intenta de nuevo.');
        return;
      }

      const header = paraNombre ? `💕 *Para: ${paraNombre}* 💕\n\n` : '💕 *Mensaje de Amor* 💕\n\n';

      await ctx.reply(header + response.text.trim());
      await ctx.react('💝');
    } catch {
      await ctx.react('❌');
      await ctx.reply('Ocurrió un error generando el mensaje. Intenta de nuevo.');
    }
  }

  private buildPrompt(tipo: AmorTipo, tema: string, para: string): string {
    const paraStr = para ? ` para ${para}` : '';

    switch (tipo) {
      case 'mensaje':
        return `Genera un mensaje de amor${paraStr} corto y dulce sobre "${tema}". 
        Debe ser romántico pero no cursi. Máximo 2-3 oraciones.`;

      case 'carta':
        return `Escribe una carta de amor${paraStr} breve y emotiva sobre "${tema}".
        Debe sonar auténtica y profunda. 1 párrafo.`;

      case 'poesia':
        return `Escribe un poema corto de amor${paraStr} sobre "${tema}".
        Puede tener rima o verso libre. 4-8 versos.`;

      case 'piropo':
        return `Genera un piropo${paraStr} originale y gracioso sobre "${tema}".
        Debe ser encantador y divertido. 1-2 oraciones.`;

      case 'dedicatoria':
        return `Escribe una dedicatoria de canción${paraStr} sobre "${tema}".
        Debe ser romántica y emotiva.`;

      default:
        return `Genera un mensaje de amor${paraStr} sobre "${tema}".`;
    }
  }
}

export class ShipCommand extends Command {
  name = 'ship';
  description = 'Calcula la compatibilidad amorosa entre dos personas';
  category = CommandCategory.FUN;
  aliases = ['compatibilidad', 'match'];
  cooldown = 10000;
  contexts = [CommandContext.BOTH];
  usage = '!ship @persona1 @persona2';
  examples = ['!ship @usuario1 @usuario2'];
  permissions = { user: [PermissionLevel.USER], bot: [] };

  async execute(ctx: MessageContext): Promise<void> {
    const mentioned = ctx.message.message?.extendedTextMessage?.contextInfo?.mentionedJid;

    if (!mentioned || mentioned.length < 2) {
      await ctx.reply(
        `˚₊· ͟͟͞͞➳ *shippeo* ˚₊· ͟͟͞͞➳\n\n` +
          `Menciona a dos personas y veo qué tan bien se llevan ✿\n\n` +
          `✩ ejemplo ✩\n` +
          `${ctx.args?.[0] || '!ship'} @persona1 @persona2`,
      );
      return;
    }

    const nombre1 = mentioned[0].split('@')[0];
    const nombre2 = mentioned[1].split('@')[0];

    await ctx.react('💕');

    const compatibility = this.calculateShip(nombre1, nombre2);

    const hearts = this.getHearts(compatibility);
    const message = this.getShipMessage(compatibility, nombre1, nombre2);

    await ctx.reply(hearts + '\n\n' + message);
    await ctx.react('💝');
  }

  private calculateShip(name1: string, name2: string): number {
    const combined = (name1 + name2).toLowerCase();
    let hash = 0;
    for (let i = 0; i < combined.length; i++) {
      hash = ((hash << 5) - hash + combined.charCodeAt(i)) | 0;
    }
    return Math.abs(hash % 101);
  }

  private getHearts(percentage: number): string {
    if (percentage >= 90) return '💘💘💘💘💘';
    if (percentage >= 70) return '💘💘💘💘';
    if (percentage >= 50) return '💘💘💘';
    if (percentage >= 30) return '💘💘';
    return '💘';
  }

  private getShipMessage(percentage: number, name1: string, name2: string): string {
    if (percentage >= 90) {
      return (
        `*¡${name1} y ${name2} son almas gemelas!* 💕\n\n` +
        `Compatibilidad: ${percentage}%\n\n` +
        '¡El amor verdadero! Son perfectos el uno para el otro. 🔥'
      );
    }
    if (percentage >= 70) {
      return (
        `*¡${name1} y ${name2} hacen una pareja increíble!* 💖\n\n` +
        `Compatibilidad: ${percentage}%\n\n` +
        'Hay mucha química entre ustedes. ¡Dale una oportunidad! 🌟'
      );
    }
    if (percentage >= 50) {
      return (
        `*${name1} y ${name2} tienen potencial.* 💝\n\n` +
        `Compatibilidad: ${percentage}%\n\n` +
        'El amor está en el aire. ¡Tudo pode acontecer! ✨'
      );
    }
    if (percentage >= 30) {
      return (
        `*Amor no correspondido...* 💔\n\n` +
        `Compatibilidad: ${percentage}%\n\n` +
        'Hay más amigos que algo más. ¡Pero el amor puede surgir! 🌱'
      );
    }
    return (
      `*${name1} y ${name2}...* 💔\n\n` +
      `Compatibilidad: ${percentage}%\n\n` +
      'Mejor quedarse como amigos. ¡Hay muchos más peces en el mar! 🐟'
    );
  }
}
