import { Command } from '../Command.js';
import { aiService } from '@/services/external/AIService.js';
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
      const prompt =
        tipo === 'largo'
          ? 'Eres un comediante. Genera un chiste muy gracioso y largo, de al menos 3 párrafos. El chiste debe ser original y divertido. SOLO genera el chiste, sin preámbulos.'
          : 'Eres un comediante. Genera un chiste corto y gracioso, de máximo 2 oraciones. El chiste debe ser original y divertido. SOLO genera el chiste, sin preámbulos.';

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

const CHISTES_CORTOS = [
  '¿Qué le dijo un .exe a un .bat?\nEXE-cúsame, pero estoy en otra extensión',
  '¿Cómo se despiden los chemists?\nÁcido mieling',
  '¿Por qué los bookmarks nunca se estresan?\nPorque siempre tienen su lugar marcado',
  'Un optimista dice: El vaso está medio lleno\nUn pesimista dice: El vaso está medio vacío\nEl ingeniero dice: El vaso es el doble de grande de lo necesario',
  '¿Qué hace una abeja en el gym?\nZumba',
  '¿Cómo se dice pañuelo en japonés?\nSaka-moe',
];

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

export class VerdadRetoCommand extends Command {
  name = 'verdad';
  description = 'Juego de verdad o reto';
  category = CommandCategory.FUN;
  aliases = ['verdadoreto', 'vrd', 'reto'];
  cooldown = 15000;
  contexts = [CommandContext.BOTH];
  usage = '!verdad [numero]';
  examples = ['!verdad', '!verdad 5'];
  permissions = { user: [PermissionLevel.USER], bot: [] };

  async execute(ctx: MessageContext): Promise<void> {
    const args = ctx.args ?? [];
    const cantidad = Math.min(parseInt(args[0]) || 1, 5);

    await ctx.react('🎯');

    try {
      const prompt = `Genera exactamente ${cantidad} ${cantidad === 1 ? 'opción' : 'opciones'} de "verdad o reto" intercaladas (una verdad, un reto, etc). 
Formato: alterna entre:
🌟 *VERDAD:* [pregunta peligrosa o divertida]
🎯 *RETO:* [desafío divertido o atrevido]

No numere las opciones, simplemente sepáralas con salto de línea. SOLO genera el contenido, sin preámbulos.`;

      const response = await aiService.generate(prompt, 500);

      if (!response.success || !response.text) {
        await ctx.reply('No pude generar los retos. Intenta de nuevo.');
        return;
      }

      await ctx.reply(
        `🎭 *Verdad o Reto* 🎭\n\n` +
          `${response.text.trim()}\n\n` +
          `_Generado para @${ctx.sender.pushName || 'ti'}_`,
      );

      await ctx.react('🎲');
    } catch {
      await ctx.reply('Ocurrió un error. Intenta de nuevo.');
    }
  }
}

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

export class RandomCommand extends Command {
  name = 'random';
  description = 'Genera un número, emoji o dato aleatorio';
  category = CommandCategory.FUN;
  aliases = ['rng', 'randoms', 'rand', 'azar'];
  cooldown = 3000;
  contexts = [CommandContext.BOTH];
  usage = '!random <num|emoji|dato|coin>';
  examples = ['!random num', '!random emoji', '!random dato'];
  permissions = { user: [PermissionLevel.USER], bot: [] };

  async execute(ctx: MessageContext): Promise<void> {
    const tipo = ctx.args?.[0]?.toLowerCase() || 'num';

    await ctx.react('🎲');

    switch (tipo) {
      case 'num': {
        const min = 1;
        const max = 100;
        const num = Math.floor(Math.random() * (max - min + 1)) + min;
        await ctx.reply(`🎲 *Número Aleatorio*\n\n🧾 Del ${min} al ${max}: *${num}*`);
        break;
      }

      case 'emoji': {
        const emojis = [
          '😀',
          '😍',
          '🥳',
          '🤩',
          '😎',
          '🥰',
          '😜',
          '🤗',
          '😇',
          '🤠',
          '🧐',
          '😺',
          '🌟',
          '🔥',
          '💯',
          '✨',
        ];
        const emoji = emojis[Math.floor(Math.random() * emojis.length)];
        await ctx.reply(`🎭 *Emoji Aleatorio*\n\n${emoji} ${emoji} ${emoji}\n\nRandom: ${emoji}`);
        break;
      }

      case 'dato': {
        const datos = [
          'Los delfines duermen con un ojo abierto',
          'Las hormigas no duermen nunca',
          'Un rayo es 5 veces más caliente que la superficie del sol',
          'Los pulpos tienen 3 corazones',
          'La miel nunca caduca',
          'Los oxos nacen sin rodillas',
          'El corazón de una ballena azul es del tamaño de un auto pequeño',
          'Las vacas tienen mejores amigos',
          'Los pingüinos se proponen con piedras',
          'Las nutrias se dan las manos para no separarse al dormir',
        ];
        const dato = datos[Math.floor(Math.random() * datos.length)];
        await ctx.reply(`📚 *Dato Random* 📚\n\n💡 ${dato}`);
        break;
      }

      case 'coin': {
        const cara = Math.random() > 0.5;
        await ctx.reply(`🪙 *Lanzamiento de Moneda*\n\n${cara ? '🏆 *¡Cara!*' : '🔄 *¡Sello!*'}`);
        break;
      }

      case 'color': {
        const colores = [
          '🔴 Rojo',
          '🟠 Naranja',
          '🟡 Amarillo',
          '🟢 Verde',
          '🔵 Azul',
          '🟣 Morado',
          '⚫ Negro',
          '⚪ Blanco',
          '🩷 Rosa',
          '🩵 Cyan',
        ];
        const color = colores[Math.floor(Math.random() * colores.length)];
        await ctx.reply(`🎨 *Color Aleatorio*\n\n${color}`);
        break;
      }

      default:
        await ctx.reply(
          '❌ *Tipo no válido*\n\n' +
            '📌 *Tipos disponibles:*\n\n' +
            '🎲 num - Número del 1 al 100\n' +
            '🎭 emoji - Emoji random\n' +
            '📚 dato - Dato curioso\n' +
            '🪙 coin - Cara o sello\n' +
            '🎨 color - Color random',
        );
    }
  }
}

export class ConsejoCommand extends Command {
  name = 'consejo';
  description = 'Da un consejo random';
  category = CommandCategory.FUN;
  aliases = ['tips', 'tip', 'consejos'];
  cooldown = 10000;
  contexts = [CommandContext.BOTH];
  usage = '!consejo';
  examples = ['!consejo'];
  permissions = { user: [PermissionLevel.USER], bot: [] };

  async execute(ctx: MessageContext): Promise<void> {
    await ctx.react('💡');

    try {
      const prompt =
        'Eres un sabio mentor. Dame un consejo corto, útil y motivacional. Máximo 2 oraciones. Puede ser sobre vida, salud, trabajo, relaciones o productividad. SOLO genera el consejo, sin preámbulos.';

      const response = await aiService.generate(prompt, 150);

      if (!response.success || !response.text) {
        const fallback = CONSEJOS[Math.floor(Math.random() * CONSEJOS.length)];
        await ctx.reply(`💡 *Consejo del día* 💡\n\n${fallback}`);
        return;
      }

      await ctx.reply(`💡 *Consejo del día* 💡\n\n${response.text.trim()}`);
      await ctx.react('✨');
    } catch {
      const fallback = CONSEJOS[Math.floor(Math.random() * CONSEJOS.length)];
      await ctx.reply(`💡 *Consejo del día* 💡\n\n${fallback}`);
    }
  }
}

const CONSEJOS = [
  'No te compares con otros, compara tu hoy con tu ayer',
  'El éxito es la suma de pequeños esfuerzos repetidos día tras día',
  'Duerme bien, es la mejor inversión que puedes hacer',
  'Aprende a decir que no sin sentir culpa',
  'El dinero no compra la felicidad, pero sí tranquilidad',
];

export class HoroscopoCommand extends Command {
  name = 'horoscopo';
  description = 'Muestra el horóscopo del día';
  category = CommandCategory.FUN;
  aliases = ['horo', 'signo', 'zodiaco'];
  cooldown = 15000;
  contexts = [CommandContext.BOTH];
  usage = '!horoscopo [signo]';
  examples = ['!horoscopo acuario', '!horo geminis'];
  permissions = { user: [PermissionLevel.USER], bot: [] };

  async execute(ctx: MessageContext): Promise<void> {
    const signos: Record<string, string> = {
      aries: '♈ Aries (Mar 21 - Abr 19)',
      tauro: '♉ Tauro (Abr 20 - May 20)',
      geminis: '♊ Géminis (May 21 - Jun 20)',
      cancer: '♋ Cáncer (Jun 21 - Jul 22)',
      leo: '♌ Leo (Jul 23 - Ago 22)',
      virgo: '♍ Virgo (Ago 23 - Sep 22)',
      libra: '♎ Libra (Sep 23 - Oct 22)',
      escorpio: '♏ Escorpio (Oct 23 - Nov 21)',
      sagitario: '♐ Sagitario (Nov 22 - Dic 21)',
      capricornio: '♑ Capricornio (Dic 22 - Ene 19)',
      acuario: '♒ Acuario (Ene 20 - Feb 18)',
      piscis: '♓ Piscis (Feb 19 - Mar 20)',
    };

    const signoIngresado = ctx.args?.[0]?.toLowerCase();
    let signo = signoIngresado;
    let esRandom = false;

    if (!signoIngresado || !signos[signoIngresado]) {
      const keys = Object.keys(signos);
      signo = keys[Math.floor(Math.random() * keys.length)];
      esRandom = true;
    }

    await ctx.react('🔮');

    try {
      const prompt = `Eres un astrólogo experto. Da una predicción breve y positiva del horóscopo para ${signo} hoy. Máximo 3 oraciones. Incluye amor, trabajo y suerte. SOLO genera la predicción, sin preámbulos.`;

      const response = await aiService.generate(prompt, 200);

      if (!response.success || !response.text) {
        await ctx.reply('No pude generar el horóscopo. Intenta de nuevo.');
        return;
      }

      const mensaje = esRandom
        ? `🔮 *Horóscopo Random* 🔮\n\n${signos[signo]}\n\n${response.text.trim()}`
        : `🔮 *Horóscopo de ${signo}* 🔮\n\n${signos[signo]}\n\n${response.text.trim()}`;

      await ctx.reply(mensaje);
      await ctx.react('✨');
    } catch {
      await ctx.reply('Ocurrió un error. Intenta de nuevo.');
    }
  }
}

export class PeliculaCommand extends Command {
  name = 'pelicula';
  description = 'Recomienda una película';
  category = CommandCategory.FUN;
  aliases = ['pelirecomend', 'pelis', 'cine', 'movie'];
  cooldown = 15000;
  contexts = [CommandContext.BOTH];
  usage = '!pelicula [género]';
  examples = ['!pelicula', '!pelicula acción', '!pelicula comedia'];
  permissions = { user: [PermissionLevel.USER], bot: [] };

  async execute(ctx: MessageContext): Promise<void> {
    const genero = ctx.args?.join(' ') || '';

    await ctx.react('🎬');

    try {
      const prompt = genero
        ? `Eres un experto en cine. Recomiéndame UNA sola película de ${genero}. Incluye: título, año, y una razón breve de por qué verla (1 oración). SOLO genera la recomendación, sin preámbulos.`
        : `Eres un experto en cine. Recomiéndame UNA sola película popular. Incluye: título, año, y una razón breve de por qué verla (1 oración). SOLO genera la recomendación, sin preámbulos.`;

      const response = await aiService.generate(prompt, 200);

      if (!response.success || !response.text) {
        const fallback = PELICULAS[Math.floor(Math.random() * PELICULAS.length)];
        await ctx.reply(`🎬 *Recomendación Random* 🎬\n\n${fallback}`);
        return;
      }

      await ctx.reply(`🎬 *Recomendación de Película* 🎬\n\n${response.text.trim()}`);
      await ctx.react('🍿');
    } catch {
      const fallback = PELICULAS[Math.floor(Math.random() * PELICULAS.length)];
      await ctx.reply(`🎬 *Recomendación Random* 🎬\n\n${fallback}`);
    }
  }
}

const PELICULAS = [
  '*The Shawshank Redemption* (1994)\n📝 Una historia de esperanza y amistad en prisión',
  '*Inception* (2010)\n📝 Un robo dentro de sueños dentro de sueños',
  '*The Dark Knight* (2008)\n📝 Batman enfrenta su mayor desafío moral',
  '*Spirited Away* (2001)\n📝 Una aventura mágica en el mundo de los espíritus',
  '*Pulp Fiction* (1994)\n📝 Varias historias se cruzan de forma inolvidable',
];

export class AnimeCommand extends Command {
  name = 'anime';
  description = 'Recomienda un anime';
  category = CommandCategory.FUN;
  aliases = ['animerec', 'animes', 'animu'];
  cooldown = 15000;
  contexts = [CommandContext.BOTH];
  usage = '!anime [género]';
  examples = ['!anime', '!anime acción', '!anime romance'];
  permissions = { user: [PermissionLevel.USER], bot: [] };

  async execute(ctx: MessageContext): Promise<void> {
    const genero = ctx.args?.join(' ') || '';

    await ctx.react('🎌');

    try {
      const prompt = genero
        ? `Eres un experto en anime. Recomiéndame UN solo anime de ${genero}. Incluye: título, año/episodios, y una razón breve de por qué verlo (1 oración). SOLO genera la recomendación, sin preámbulos.`
        : `Eres un experto en anime. Recomiéndame UN solo anime popular. Incluye: título, año/episodios, y una razón breve de por qué verlo (1 oración). SOLO genera la recomendación, sin preámbulos.`;

      const response = await aiService.generate(prompt, 200);

      if (!response.success || !response.text) {
        const fallback = ANIMES[Math.floor(Math.random() * ANIMES.length)];
        await ctx.reply(`🎌 *Recomendación Random* 🎌\n\n${fallback}`);
        return;
      }

      await ctx.reply(`🎌 *Recomendación de Anime* 🎌\n\n${response.text.trim()}`);
      await ctx.react('✨');
    } catch {
      const fallback = ANIMES[Math.floor(Math.random() * ANIMES.length)];
      await ctx.reply(`🎌 *Recomendación Random* 🎌\n\n${fallback}`);
    }
  }
}

const ANIMES = [
  '*Attack on Titan*\n📺 87+ episodios\n📝 Una humanidad lucha por sobrevivir contra titanes',
  '*Death Note*\n📺 37 episodios\n📝 Un estudiante encuentra un cuaderno mortal',
  '*Naruto*\n📺 220 episodios\n📝 La historia del ninja más persistente',
  '*One Piece*\n📺 1000+ episodios\n📝 Una tripulación busca el tesoro definitivo',
  '*Demon Slayer*\n📺 44+ episodios\n📝 Un joven combate demonios para salvar a su hermana',
];

export class StickerRandomCommand extends Command {
  name = 'stickerrandom';
  description = 'Genera un sticker meme aleatorio';
  category = CommandCategory.FUN;
  aliases = ['stickerandom', 'randsticker', 'randsticker', 'memesticker'];
  cooldown = 15000;
  contexts = [CommandContext.BOTH];
  usage = '!stickerrandom';
  examples = ['!stickerrandom'];
  permissions = { user: [PermissionLevel.USER], bot: [] };

  private readonly MEME_IMAGES = [
    'https://i.imgflip.com/1bij.jpg',
    'https://i.imgflip.com/30b1gx.jpg',
    'https://i.imgflip.com/1g8my4.jpg',
    'https://i.imgflip.com/9ehk.jpg',
    'https://i.imgflip.com/26am.jpg',
    'https://i.imgflip.com/4t0m5.jpg',
    'https://i.imgflip.com/1otk96.jpg',
    'https://i.imgflip.com/1bhw.jpg',
    'https://i.imgflip.com/3lmzyx.jpg',
    'https://i.imgflip.com/2fm6x.jpg',
    'https://i.imgflip.com/1ur9b0.jpg',
    'https://i.imgflip.com/1bik.jpg',
    'https://i.imgflip.com/49z3c.jpg',
    'https://i.imgflip.com/1h5a3.jpg',
    'https://i.imgflip.com/3oevdk.jpg',
    'https://i.imgflip.com/2h1s1h.jpg',
    'https://i.imgflip.com/2a9u1e.jpg',
    'https://i.imgflip.com/1c1uej.jpg',
    'https://i.imgflip.com/9v2k7t.jpg',
    'https://i.imgflip.com/1yy0o.jpg',
    'https://i.imgflip.com/4a3x1q.jpg',
    'https://i.imgflip.com/5nm1.jpg',
    'https://i.imgflip.com/6rckg.jpg',
    'https://i.imgflip.com/7bw86.jpg',
    'https://i.imgflip.com/9ehk.jpg',
    'https://i.imgflip.com/3p3j9a.jpg',
    'https://i.imgflip.com/4t.jpg',
    'https://i.imgflip.com/xj43a.jpg',
    'https://i.imgflip.com/1ooa1h.jpg',
    'https://i.imgflip.com/7s7mu.jpg',
  ];

  async execute(ctx: MessageContext): Promise<void> {
    await ctx.react('🎨');

    try {
      let imageUrl: string | null = null;

      try {
        const apiResponse = await fetch('https://api.imgflip.com/get_memes');
        if (apiResponse.ok) {
          const data = (await apiResponse.json()) as {
            success: boolean;
            data?: { memes: Array<{ url: string }> };
          };
          if (data.success && data.data?.memes) {
            const memes = data.data.memes;
            const randomMeme = memes[Math.floor(Math.random() * Math.min(memes.length, 100))];
            imageUrl = randomMeme?.url || null;
          }
        }
      } catch {
        // Fallback to hardcoded URLs
      }

      if (!imageUrl) {
        imageUrl = this.MEME_IMAGES[Math.floor(Math.random() * this.MEME_IMAGES.length)];
      }

      const response = await fetch(imageUrl);
      if (!response.ok) {
        await ctx.reply('No pude descargar la imagen. Intenta de nuevo.');
        return;
      }

      const arrayBuffer = await response.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);

      const { Jimp } = await import('jimp');
      const image = await Jimp.read(buffer);
      image.resize({ w: 512, h: 512 });

      const finalBuffer = await image.getBuffer('image/png');

      const { Sticker, StickerTypes } = await import('wa-sticker-formatter');
      const sticker = new Sticker(finalBuffer, {
        pack: '🎲 Random Sticker',
        author: 'VaniaBot',
        type: StickerTypes.DEFAULT,
      });

      const stickerBuffer = await sticker.toBuffer();

      await ctx.sock.sendMessage(ctx.chat.jid, { sticker: stickerBuffer });
      await ctx.react('✅');
    } catch (error) {
      console.error('StickerRandom error:', error);
      await ctx.reply('Ocurrió un error generando el sticker. Intenta de nuevo.');
    }
  }
}
