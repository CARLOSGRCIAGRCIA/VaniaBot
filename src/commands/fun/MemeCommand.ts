import { Command } from '../Command.js';
import {
  CommandCategory,
  CommandContext,
  PermissionLevel,
  type MessageContext,
} from '@/types/index.js';

const MEMES = [
  '¿Por qué los programs se sienta al lado de la pantalla? Porque están en modo DEBUG',
  'Un programador fue al psychiatrist. Dice: "Doctor, cada vez que escribo código, la gente me ignora". El doctor respondió: "¿Desde cuándo te pasa esto?" El programador: "No me acuerdo, creo que desde que nació JavaScript"',
  '¿Cuántos programadores se necesitan para cambiar una bombilla? Ninguno, eso es un problema de hardware',
  '¿Por qué C++ y Java se llevaron mal? Porque no tienen nada en COMÚN',
  'Un programador novato pregunta a un senior: "¿Cómo depuro esto?" El senior responde: "¿Ya intentaste cerrarlo y volverlo a abrir?"',
  '¿Qué le dijo un BIT a otro? "Nos vemos en el próximo BYTE"',
  'El polimorfismo es cuando puedes tocar a tu abuela y a tu madre de la misma manera',
  'Un programador en el desierto: "Por fin encontré el NULL"',
  '¿Por qué los programadores siempre tienen frío? Porque están cerca de WINDOWS',
  'El código funciona... No me preguntes por qué',
];

export class MemeCommand extends Command {
  name = 'meme';
  description = 'Muestra un meme o chiste de programador';
  category = CommandCategory.FUN;
  aliases = ['memes', 'chistesprogramador'];
  cooldown = 10000;
  contexts = [CommandContext.BOTH];
  usage = '!meme';
  examples = ['!meme'];
  permissions = { user: [PermissionLevel.USER], bot: [] };

  async execute(ctx: MessageContext): Promise<void> {
    await ctx.react('😂');

    const meme = MEMES[Math.floor(Math.random() * MEMES.length)];

    await ctx.reply(`🤪 *Meme del día* 🤪\n\n${meme}`);
    await ctx.react('🔥');
  }
}
