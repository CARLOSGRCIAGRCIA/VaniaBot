import { 
  CommandCategory, 
  CommandContext,     
  PermissionLevel, 
  BotPermission 
} from '@/types/index.js';
import type { ICommand, MessageContext } from '@/types/index.js';

export abstract class Command implements ICommand {
  abstract name: string;
  abstract description: string;
  abstract category: CommandCategory;
  
  aliases?: string[] = [];
  usage?: string;
  examples?: string[] = [];
  cooldown?: number = 3000;
  
  permissions?: {
    user?: PermissionLevel[];
    bot?: BotPermission[];
  } = {
    user: [PermissionLevel.USER],
    bot: [],
  };
  
  contexts?: CommandContext[] = [CommandContext.BOTH];

  abstract execute(ctx: MessageContext): Promise<void>;

  protected hasPermission(ctx: MessageContext): boolean {
    const requiredPerms = this.permissions?.user || [PermissionLevel.USER];
    
    if (requiredPerms.includes(PermissionLevel.OWNER)) {
      return ctx.sender.isOwner;
    }
    
    if (requiredPerms.includes(PermissionLevel.ADMIN)) {
      return ctx.sender.isAdmin || ctx.sender.isOwner;
    }
    
    return true;
  }

  protected validateContext(ctx: MessageContext): boolean {
    if (!this.contexts || this.contexts.includes(CommandContext.BOTH)) {
      return true;
    }
    
    if (this.contexts.includes(CommandContext.GROUP) && !ctx.chat.isGroup) {
      return false;
    }
    
    if (this.contexts.includes(CommandContext.PRIVATE) && ctx.chat.isGroup) {
      return false;
    }
    
    return true;
  }
}