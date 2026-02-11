import type { WASocket, proto } from '@whiskeysockets/baileys';
import type { MessageContext as IMessageContext } from '@/types/index.js';
import { config } from '@/config/index.js';
import { PermissionService } from '@/services/PermissionService.js';

export class MessageContext implements IMessageContext {
  public text: string;
  public args: string[];
  public command: string;
  
  private _senderPermissions?: {
    isOwner: boolean;
    isAdmin: boolean;
    isSuperAdmin: boolean;
  };
  
  private _botPermissions?: {
    isAdmin: boolean;
    isSuperAdmin: boolean;
  };
  
  constructor(
    public sock: WASocket,
    public message: proto.IWebMessageInfo,
  ) {
    this.text = this.extractText();
    const parsed = this.parseCommand();
    this.command = parsed.command;
    this.args = parsed.args;
  }

  private extractText(): string {
    const msg = this.message.message;
    return (
      msg?.conversation ||
      msg?.extendedTextMessage?.text ||
      msg?.imageMessage?.caption ||
      msg?.videoMessage?.caption ||
      ''
    );
  }

  private parseCommand() {
    if (!this.text.startsWith(config.prefix)) {
      return { command: '', args: [] };
    }

    const args = this.text.slice(config.prefix.length).trim().split(/\s+/);
    const command = args.shift()?.toLowerCase() || '';

    return { command, args };
  }

  get sender() {
    const jid = this.message.key.participant || this.message.key.remoteJid!;
    const pushName = this.message.pushName || 'User';
    const isOwner = PermissionService.isOwner(jid);
    
    return {
      jid,
      pushName,
      isOwner,
      isAdmin: this._senderPermissions?.isAdmin || false,
    };
  }

  get chat() {
    const jid = this.message.key.remoteJid!;
    const isGroup = jid.endsWith('@g.us');
    
    return {
      jid,
      isGroup,
      isBotAdmin: this._botPermissions?.isAdmin || false,
    };
  }

  get quoted(): proto.IMessage | undefined {
    return this.message.message?.extendedTextMessage?.contextInfo?.quotedMessage || undefined;
  }

  async loadSenderPermissions(): Promise<void> {
    const groupJid = this.chat.isGroup ? this.chat.jid : undefined;
    
    this._senderPermissions = await PermissionService.getUserPermissions(
      this.sock,
      groupJid,
      this.sender.jid
    );
  }

  async loadBotPermissions(): Promise<void> {
    if (!this.chat.isGroup) {
      this._botPermissions = { isAdmin: false, isSuperAdmin: false };
      return;
    }
    
    this._botPermissions = await PermissionService.getBotPermissions(
      this.sock,
      this.chat.jid
    );
  }

  getSenderPermissions() {
    return this._senderPermissions || {
      isOwner: this.sender.isOwner,
      isAdmin: false,
      isSuperAdmin: false,
    };
  }

  getBotPermissions() {
    return this._botPermissions || {
      isAdmin: false,
      isSuperAdmin: false,
    };
  }

  async reply(text: string): Promise<void> {
    await this.sock.sendMessage(this.chat.jid, { 
      text 
    }, { 
      quoted: this.message 
    });
  }

  async react(emoji: string): Promise<void> {
    await this.sock.sendMessage(this.chat.jid, {
      react: {
        text: emoji,
        key: this.message.key,
      },
    });
  }

  async sendMessage(content: any): Promise<void> {
    await this.sock.sendMessage(this.chat.jid, content);
  }
}