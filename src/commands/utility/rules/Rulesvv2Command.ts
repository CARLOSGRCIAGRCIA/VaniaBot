import { Command } from '../../Command.js';
import { CommandCategory } from '@/types/index.js';
import type { MessageContext } from '@/types/index.js';
import fs from 'fs';
import path from 'path';

export class RulesVV2Command extends Command {
  name = 'rules vv2';
  description = 'Reglas VV2';
  category = CommandCategory.UTILITY;
  aliases = ['rules vv2'];
  usage = '!rules vv2';
  examples = ['!rules vv2'];

  async execute(ctx: MessageContext): Promise<void> {
    const imagePath = path.join(process.cwd(), 'data', 'assets', 'vv2Rules.png');
    const imageBuffer = fs.readFileSync(imagePath);

    await ctx.sock.sendMessage(ctx.chat.jid, { image: imageBuffer }, { quoted: ctx.message });
  }
}

export default RulesVV2Command;
