import { Command } from '../Command.js';
import { CommandCategory, CommandContext, PermissionLevel } from '@/types/index.js';
import type { MessageContext } from '@/types/index.js';
import type { GroupParticipant } from '@whiskeysockets/baileys';

export class GroupCommand extends Command {
  name = 'group';
  description = 'Administrar configuración del grupo';
  category = CommandCategory.ADMIN;
  aliases = ['grupo', 'chat'];
  usage = '.group [lock/unlock/info/settings]';
  examples = ['.group lock', '.group unlock', '.group info', '.group settings'];
  contexts = [CommandContext.GROUP];
  permissions = {
    user: [PermissionLevel.ADMIN],
  };

  async execute(ctx: MessageContext): Promise<void> {
    const action = ctx.args[0]?.toLowerCase();

    if (!action) {
      await this.showHelp(ctx);
      return;
    }

    switch (action) {
      case 'lock':
      case 'cerrar':
        await this.lockGroup(ctx);
        break;
      case 'unlock':
      case 'abrir':
        await this.unlockGroup(ctx);
        break;
      case 'info':
        await this.groupInfo(ctx);
        break;
      case 'settings':
      case 'config':
        await this.groupSettings(ctx);
        break;
      default:
        await ctx.reply(`Acción desconocida: ${action}\nAcciones: lock, unlock, info, settings`);
    }
  }

  private async lockGroup(ctx: MessageContext): Promise<void> {
    try {
      await ctx.sock.groupSettingUpdate(ctx.chat.jid, 'locked');
      await ctx.reply('🔒 *Grupo cerrado*\nAhora solo los administradores pueden escribir.');
    } catch {
      await ctx.reply('❌ Error al cerrar el grupo');
    }
  }

  private async unlockGroup(ctx: MessageContext): Promise<void> {
    try {
      await ctx.sock.groupSettingUpdate(ctx.chat.jid, 'unlocked');
      await ctx.reply('🔓 *Grupo abierto*\nTodos los miembros pueden escribir.');
    } catch {
      await ctx.reply('❌ Error al abrir el grupo');
    }
  }

  private async groupInfo(ctx: MessageContext): Promise<void> {
    try {
      const metadata = await ctx.sock.groupMetadata(ctx.chat.jid);

      const creationDate = metadata.creation
        ? new Date(metadata.creation * 1000).toLocaleDateString()
        : 'Desconocida';
      const owner = metadata.owner?.split('@')[0] || 'Desconocido';
      const memberCount = metadata.participants.length;
      const adminCount = metadata.participants.filter((p: GroupParticipant) => p.admin).length;

      let message = `*📋 Información del Grupo*\n\n`;
      message += `*Nombre:* ${metadata.subject}\n`;
      message += `*Descripción:* ${metadata.desc || 'Sin descripción'}\n`;
      message += `*Creado:* ${creationDate}\n`;
      message += `*Dueño:* @${owner}\n`;
      message += `*Miembros:* ${memberCount}\n`;
      message += `*Admins:* ${adminCount}\n`;
      message += `*Código:* ${metadata.id.split('@')[0]}`;

      await ctx.reply(message);
    } catch {
      await ctx.reply('❌ Error al obtener información del grupo');
    }
  }

  private async groupSettings(ctx: MessageContext): Promise<void> {
    try {
      const metadata = await ctx.sock.groupMetadata(ctx.chat.jid);

      let message = `*⚙️ Configuración del Grupo*\n\n`;
      message += `*Nombre:* ${metadata.subject}\n`;
      message += `*Miembros:* ${metadata.participants.length}\n`;
      message += `*Código:* ${metadata.id.split('@')[0]}\n\n`;
      message += `_Usa .group lock/unlock para cambiar el estado_`;

      await ctx.reply(message);
    } catch {
      await ctx.reply('❌ Error al obtener configuración');
    }
  }

  private async showHelp(ctx: MessageContext): Promise<void> {
    let message = `*⚙️ Comandos de Grupo*\n\n`;
    message += `*• .group lock* - Cerrar grupo (solo admins escriben)\n`;
    message += `*• .group unlock* - Abrir grupo\n`;
    message += `*• .group info* - Ver información del grupo\n`;
    message += `*• .group settings* - Ver configuración actual\n`;

    await ctx.reply(message);
  }
}

export class LinkCommand extends Command {
  name = 'link';
  description = 'Obtener enlace de invitación del grupo';
  category = CommandCategory.ADMIN;
  aliases = ['invitelink', 'grouplink'];
  contexts = [CommandContext.GROUP];
  permissions = {
    user: [PermissionLevel.ADMIN],
  };

  async execute(ctx: MessageContext): Promise<void> {
    try {
      const inviteCode = await ctx.sock.groupInviteCode(ctx.chat.jid);
      const link = `https://chat.whatsapp.com/${inviteCode}`;

      await ctx.reply(`*🔗 Enlace del grupo:*\n\n${link}`);
    } catch {
      await ctx.reply('❌ Error al obtener enlace. Verifica que soy admin.');
    }
  }
}

export class RevokeCommand extends Command {
  name = 'revoke';
  description = 'Revocar enlace de invitación actual';
  category = CommandCategory.ADMIN;
  contexts = [CommandContext.GROUP];
  permissions = {
    user: [PermissionLevel.ADMIN],
  };

  async execute(ctx: MessageContext): Promise<void> {
    try {
      await ctx.sock.groupInviteCode(ctx.chat.jid);
      await ctx.reply('❌ No puedo revocar el enlace. Esta función está limitada por WhatsApp.');
    } catch {
      await ctx.reply('❌ Error al procesar solicitud');
    }
  }
}

export class TagadminCommand extends Command {
  name = 'tagadmin';
  description = 'Mencionar solo a los administradores';
  category = CommandCategory.ADMIN;
  aliases = ['admins', 'admin'];
  contexts = [CommandContext.GROUP];

  async execute(ctx: MessageContext): Promise<void> {
    try {
      const metadata = await ctx.sock.groupMetadata(ctx.chat.jid);
      const admins = metadata.participants.filter((p: GroupParticipant) => p.admin);

      if (admins.length === 0) {
        await ctx.reply('No hay administradores en el grupo.');
        return;
      }

      const adminMentions = admins
        .map((a: GroupParticipant) => `@${a.id.split('@')[0]}`)
        .join(', ');
      const message = ctx.args.join(' ') || `📢 ¡Administradores!: ${adminMentions}`;

      await ctx.reply(message);
    } catch {
      await ctx.reply('❌ Error al obtener administradores');
    }
  }
}
