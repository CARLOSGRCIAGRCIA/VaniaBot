import { Command } from "../Command.js";
import { CommandCategory } from "@/types/index.js";
import type { MessageContext } from "@/types/index.js";
import fs from "fs";
import path from "path";

const charset: Record<string, string> = {
  a: "ᴀ",
  b: "ʙ",
  c: "ᴄ",
  d: "ᴅ",
  e: "ᴇ",
  f: "ꜰ",
  g: "ɢ",
  h: "ʜ",
  i: "ɪ",
  j: "ᴊ",
  k: "ᴋ",
  l: "ʟ",
  m: "ᴍ",
  n: "ɴ",
  o: "ᴏ",
  p: "ᴘ",
  q: "ǫ",
  r: "ʀ",
  s: "ꜱ",
  t: "ᴛ",
  u: "ᴜ",
  v: "ᴠ",
  w: "ᴡ",
  x: "x",
  y: "ʏ",
  z: "ᴢ",
};

const toSmallCaps = (text: string): string =>
  text.toLowerCase().replace(/[a-z]/g, (c) => charset[c] || c);

export class DevCommand extends Command {
  name = "dev";
  description = "Creador del bot";
  category = CommandCategory.UTILITY;
  aliases = ["creador", "developer"];
  usage = "!dev";
  examples = ["!dev", "!creador"];

  async execute(ctx: MessageContext): Promise<void> {
    try {
      await ctx.react("👑");
    } catch {}

    const readmore = String.fromCharCode(8206).repeat(4001);

    let devText = `⧼⋆꙳• *CREADOR* ⋆꙳•⧽\n\n`;
    devText += `👑 ${toSmallCaps("nombre")}\n`;
    devText += `   » Carlos G\n\n`;
    devText += `💻 ${toSmallCaps("github")}\n`;
    devText += `   » CARLOSGRCIAGRCIA\n\n`;
    devText += `📷 ${toSmallCaps("instagram")}\n`;
    devText += `   » carlos.gxv\n\n`;
    devText += `🎵 ${toSmallCaps("tiktok")}\n`;
    devText += `   » carlos.grcia0\n\n`;
    devText += `🎥 ${toSmallCaps("youtube")}\n`;
    devText += `   » carlos.dev01\n\n`;
    devText += `📱 ${toSmallCaps("whatsapp")}\n`;
    devText += `   » +52 951 652 6675\n`;
    devText += `${readmore}\n\n`;
    devText += `⧼⋆꙳• *ENLACES* ⋆꙳•⧽\n\n`;
    devText += `💝 https://github.com/CARLOSGRCIAGRCIA \n\n`;
    devText += `💝 https://www.instagram.com/carlos.gxv \n\n`;
    devText += `💝 https://www.tiktok.com/@carlos.grcia0 \n\n`;
    devText += `💝 https://www.youtube.com/@carlos.dev01 \n\n`;
    devText += `⌬ 𝗩𝗔𝗡𝗜𝗔 𝗕𝗢𝗧 💝`;

    const logoPath = path.join(process.cwd(), "data", "assets", "logo.png");

    try {
      if (fs.existsSync(logoPath)) {
        const imageBuffer = fs.readFileSync(logoPath);

        await ctx.sock.sendMessage(
          ctx.chat.jid,
          {
            image: imageBuffer,
            caption: devText,
          },
          { quoted: ctx.message },
        );
      } else {
        await ctx.sock.sendMessage(
          ctx.chat.jid,
          { text: devText },
          { quoted: ctx.message },
        );
      }
    } catch (error) {
      await ctx.sock.sendMessage(
        ctx.chat.jid,
        { text: devText },
        { quoted: ctx.message },
      );
    }
  }
}

export default DevCommand;
