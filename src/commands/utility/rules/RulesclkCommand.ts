import { Command } from '../../Command.js';
import { CommandCategory } from '@/types/index.js';
import type { MessageContext } from '@/types/index.js';
import { sendAssetImage } from '@/utils/assetHelper.js';

export class RulesCLKCommand extends Command {
  name = 'rules clk';
  description = 'Reglas CLK';
  category = CommandCategory.FREEFIRE;
  aliases = ['rules clk'];
  usage = '!rules clk';
  examples = ['!rules clk'];

  async execute(ctx: MessageContext): Promise<void> {
    await sendAssetImage(ctx, 'clkRules.png', 'No se encontró la imagen de reglas CLK.');
  }
}

export default RulesCLKCommand;
