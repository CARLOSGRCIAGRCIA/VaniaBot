import type { WASocket, proto } from "@whiskeysockets/baileys";
import type { MessageContext as IMessageContext } from "@/types/index.js";
import { config } from "@/config/index.js";
import { PermissionService } from "@/services/PermissionService.js";
import { cacheManager } from "@/core/CacheManager.js";

export class MessageContext implements IMessageContext {
  public text: string;
  public args: string[];
  public command: string;

  private _senderPermissions?: {
    isAdmin: boolean;
    isOwner: boolean;
  };

  private _botPermissions?: {
    isAdmin: boolean;
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
      ""
    );
  }

  private parseCommand() {
    if (!this.text.startsWith(config.prefix)) {
      return { command: "", args: [] };
    }

    const args = this.text.slice(config.prefix.length).trim().split(/\s+/);
    const command = args.shift()?.toLowerCase() || "";

    return { command, args };
  }

  get sender() {
    const jid = this.message.key.participant || this.message.key.remoteJid!;
    const pushName = this.message.pushName || "User";
    const isOwner = PermissionService.isOwner(jid);

    return {
      jid,
      pushName,
      isOwner,
      isAdmin: this._senderPermissions?.isAdmin ?? false,
    };
  }

  get chat() {
    const jid = this.message.key.remoteJid!;
    const isGroup = jid.endsWith("@g.us");

    return {
      jid,
      isGroup,
      isBotAdmin: this._botPermissions?.isAdmin ?? false,
    };
  }

  async loadSenderPermissions(): Promise<void> {
    const groupJid = this.chat.isGroup ? this.chat.jid : undefined;

    if (groupJid) {
      const cached = cacheManager.getPermissions(groupJid, this.sender.jid);
      if (cached) {
        this._senderPermissions = {
          isAdmin: cached.isAdmin,
          isOwner: this.sender.isOwner,
        };
        return;
      }
    }

    const perms = await PermissionService.getUserPermissions(
      this.sock,
      groupJid,
      this.sender.jid,
    );

    this._senderPermissions = {
      isAdmin: perms.isAdmin,
      isOwner: this.sender.isOwner,
    };

    if (groupJid) {
      cacheManager.setPermissions(groupJid, this.sender.jid, perms);
    }
  }

  async loadBotPermissions(): Promise<void> {
    if (!this.chat.isGroup) {
      this._botPermissions = { isAdmin: false };
      return;
    }

    const botJid = this.sock.user?.id.split(":")[0] + "@s.whatsapp.net";

    const cached = cacheManager.getPermissions(this.chat.jid, botJid);
    if (cached) {
      this._botPermissions = { isAdmin: cached.isAdmin };
      return;
    }

    const perms = await PermissionService.getBotPermissions(
      this.sock,
      this.chat.jid,
    );

    this._botPermissions = { isAdmin: perms.isAdmin };

    cacheManager.setPermissions(this.chat.jid, botJid, perms);
  }

  get quoted(): proto.IMessage | undefined {
    return (
      this.message.message?.extendedTextMessage?.contextInfo?.quotedMessage ||
      undefined
    );
  }

  async reply(text: string): Promise<void> {
    await this.sock.sendMessage(
      this.chat.jid,
      { text },
      { quoted: this.message },
    );
  }

  async react(emoji: string): Promise<void> {
    await this.sock.sendMessage(this.chat.jid, {
      react: { text: emoji, key: this.message.key },
    });
  }

  async sendMessage(content: any): Promise<void> {
    await this.sock.sendMessage(this.chat.jid, content);
  }

  getSenderPermissions() {
    return (
      this._senderPermissions || {
        isOwner: this.sender.isOwner,
        isAdmin: false,
      }
    );
  }

  getBotPermissions() {
    return (
      this._botPermissions || {
        isAdmin: false,
      }
    );
  }
}
