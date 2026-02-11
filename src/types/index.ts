import type { WASocket, proto } from '@whiskeysockets/baileys';

export interface ICommand {
    name: string;
    description: string;
    aliases?: string[];
    category: CommandCategory;
    usage?: string;
    examples?: string[];
    cooldown?: number;
    permissions?: {
        user?: PermissionLevel[];
        bot?: BotPermission[];
    };
    contexts?: CommandContext[];
    execute(ctx: MessageContext): Promise<void>;
}

export enum CommandCategory {
    ADMIN = 'admin',
    FUN = 'fun',
    UTILITY = 'utility',
    MEDIA = 'media',
    GAME = 'game',
    RPG = 'rpg',
    OWNER = 'owner'
}

export enum PermissionLevel {
    USER = 'user',
    ADMIN = 'admin',
    OWNER = 'owner'
}

export enum BotPermission {
    ADMIN = 'admin',
    SEND_MESSAGES = 'send_messages',
    DELETE_MESSAGES = 'delete_messages'
}

export enum CommandContext {
    GROUP = 'group',
    PRIVATE = 'private',
    BOTH = 'both'
}

export interface MessageContext {
    sock: WASocket;
    message: proto.IWebMessageInfo;
    text: string;
    args: string[];
    command: string;
    sender: {
        jid: string;
        pushName: string;
        isOwner: boolean;
        isAdmin: boolean;
    };
    chat: {
        jid: string;
        isGroup: boolean;
        isBotAdmin: boolean;
    };
    quoted?: proto.IMessage;
    media?: Buffer;
    reply(text: string): Promise<void>;
    react(emoji: string): Promise<void>;
    sendMessage(content: any): Promise<void>;
}

export interface IMiddleware {
    name: string;
    execute(ctx: MessageContext, next: () => Promise<void>): Promise<void>;
}

export interface DatabaseConfig {
    type: 'json' | 'mongodb';
    uri?: string;
    path?: string;
}

export interface BotConfig {
    name: string;
    prefix: string;
    owners: string[];
    sessionPath: string;

    auth: {
        usePairingCode: boolean;
        phoneNumber?: string;
    };
    
    features: {
        antiSpam: boolean;
        autoRead: boolean;
        selfReply: boolean;
    };
    limits: {
        maxCommandsPerMinute: number;
        maxMediaSize: number;
    };
    database: DatabaseConfig;
}