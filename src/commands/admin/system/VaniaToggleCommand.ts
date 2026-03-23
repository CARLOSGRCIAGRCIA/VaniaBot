import { Command } from '../../Command.js';
import {
  CommandCategory,
  CommandContext,
  PermissionLevel,
  type MessageContext,
} from '@/types/index.js';
import { logError } from '@/utils/logger.js';
import { serviceManager } from '@/services/system/Servicemanager.js';

export class VaniaOffCommand extends Command {
  name = 'vaniaoff';
  description = 'Desactiva a Vania en este grupo';
  category = CommandCategory.ADMIN;
  aliases = ['vaniaoff', 'botoff', 'apagar'];
  cooldown = 3000;
  contexts = [CommandContext.GROUP];
  usage = '!vaniaoff';
  examples = ['!vaniaoff'];
  permissions = { user: [PermissionLevel.ADMIN], bot: [] };

  async execute(ctx: MessageContext): Promise<void> {
    try {
      const isEnabled = await serviceManager.vaniaToggleService.isEnabled(ctx.chat.jid);

      if (!isEnabled) {
        await ctx.reply('🔴 *Vania ya está desactivada* en este grupo.');
        return;
      }

      await serviceManager.vaniaToggleService.disable(ctx.chat.jid, ctx.sender.jid);

      await ctx.react('🔴');
      await ctx.reply(
        `˚₊· ͟͟͞͞➳ *Vania está descansando* ˚₊· ͟͟͞͞➳\n\n` +
          `No voy a responder hasta que me activen con *!vaniaon*.\n\n` +
          `_Me apagó @${ctx.sender.pushName || 'admin'}_ ✿`,
      );
    } catch (error) {
      logError('[VaniaOff] Error', error);
      await ctx.reply('❌ Ocurrió un error. Intenta de nuevo.');
    }
  }
}

export class VaniaOnCommand extends Command {
  name = 'vaniaon';
  description = 'Activa a Vania en este grupo';
  category = CommandCategory.ADMIN;
  aliases = ['vaniaon', 'boton', 'encender'];
  cooldown = 3000;
  contexts = [CommandContext.GROUP];
  usage = '!vaniaon';
  examples = ['!vaniaon'];
  permissions = { user: [PermissionLevel.ADMIN], bot: [] };

  async execute(ctx: MessageContext): Promise<void> {
    try {
      const isEnabled = await serviceManager.vaniaToggleService.isEnabled(ctx.chat.jid);

      if (isEnabled) {
        await ctx.reply('🟢 *Vania ya está activada* en este grupo.');
        return;
      }

      await serviceManager.vaniaToggleService.enable(ctx.chat.jid, ctx.sender.jid);

      await ctx.react('🟢');
      await ctx.reply(
        `˚₊· ͟͟͞͞➳ *Vania ya está aquí* ˚₊· ͟͟͞͞➳\n\n` +
          `¡Listo, ya puedo funcionar! ✿\n\n` +
          `_Me encendió @${ctx.sender.pushName || 'admin'}_ ✩`,
      );
    } catch (error) {
      logError('[VaniaOn] Error', error);
      await ctx.reply('❌ Ocurrió un error. Intenta de nuevo.');
    }
  }
}

export class VaniaStatusCommand extends Command {
  name = 'vaniastatus';
  description = 'Muestra el estado de Vania en este grupo';
  category = CommandCategory.ADMIN;
  aliases = ['vaniastatus', 'botstatus'];
  cooldown = 3000;
  contexts = [CommandContext.GROUP];
  usage = '!vaniastatus';
  examples = ['!vaniastatus'];
  permissions = { user: [PermissionLevel.USER], bot: [] };

  async execute(ctx: MessageContext): Promise<void> {
    try {
      const { enabled, record } = await serviceManager.vaniaToggleService.getStatus(ctx.chat.jid);

      const status = enabled ? '🟢 *Activada*' : '🔴 *Desactivada*';

      let info = `📊 *Estado de Vania*\n\n${status}`;

      if (record) {
        if (!enabled && record.disabledBy) {
          info += `\n\n🔴 Desactivada por: @${record.disabledBy.split('@')[0]}`;
          info += `\n⏰ Hora: ${new Date(record.disabledAt).toLocaleString()}`;
        } else if (enabled && record.enabledBy) {
          info += `\n\n🟢 Activada por: @${record.enabledBy.split('@')[0]}`;
          info += `\n⏰ Hora: ${new Date(record.enabledAt).toLocaleString()}`;
        }
      }

      await ctx.reply(info);
    } catch (error) {
      logError('[VaniaStatus] Error', error);
      await ctx.reply('❌ Ocurrió un error. Intenta de nuevo.');
    }
  }
}
