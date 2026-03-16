/**
 * mocks.ts
 *
 * Mock utilities for command testing.
 * Provides mocks for MessageContext, services, and database.
 *
 * @author **Carlos G** ⭐
 */

import { vi, type Mock } from 'vitest';
import type { WASocket, proto } from '@whiskeysockets/baileys';
import type { MessageContext } from '../../src/types/index.js';
import type { User } from '../../src/services/database/UserService.js';
import type { IDatabase } from '../../src/services/database/Database.js';

export const createMockUser = (overrides: Partial<User> = {}): User => ({
  jid: 'user@test.com',
  name: 'Test User',
  isOwner: false,
  isBanned: false,
  level: 1,
  xp: 0,
  money: 1000,
  lastDaily: undefined,
  lastWeekly: undefined,
  lastMonthly: undefined,
  weeklyStreak: 0,
  totalCommands: 0,
  warnings: 0,
  inventory: [],
  achievements: [],
  createdAt: Date.now(),
  updatedAt: Date.now(),
  ...overrides,
});

export const createMockMessageContext = (
  overrides: Partial<MessageContext> = {},
): MessageContext => {
  const mockReply = vi.fn().mockResolvedValue(undefined);
  const mockReact = vi.fn().mockResolvedValue(undefined);
  const mockSendMessage = vi.fn().mockResolvedValue(undefined);
  const mockLoadSenderPermissions = vi.fn().mockResolvedValue(undefined);
  const mockLoadBotPermissions = vi.fn().mockResolvedValue(undefined);

  return {
    command: '',
    args: [],
    text: '',
    message: {
      key: {
        id: 'test-message-id',
        remoteJid: 'group@test.g.us',
        fromMe: false,
        participant: 'user@test.com',
      },
      message: {},
    } as unknown as proto.IWebMessageInfo,
    sock: {} as WASocket,
    chat: {
      jid: 'group@test.g.us',
      isGroup: true,
      isBotAdmin: false,
    },
    sender: {
      jid: 'user@test.com',
      pushName: 'Test User',
      isOwner: false,
      isAdmin: false,
    },
    reply: mockReply,
    react: mockReact,
    sendMessage: mockSendMessage,
    loadSenderPermissions: mockLoadSenderPermissions,
    loadBotPermissions: mockLoadBotPermissions,
    ...overrides,
  } as MessageContext;
};

export const createMockDatabase = (): IDatabase => ({
  connect: vi.fn().mockResolvedValue(undefined),
  disconnect: vi.fn().mockResolvedValue(undefined),
  isConnected: vi.fn().mockReturnValue(true),
  get: vi.fn().mockResolvedValue(null),
  set: vi.fn().mockResolvedValue(undefined),
  delete: vi.fn().mockResolvedValue(false),
  has: vi.fn().mockResolvedValue(false),
  find: vi.fn().mockResolvedValue([]),
  findOne: vi.fn().mockResolvedValue(null),
  update: vi.fn().mockResolvedValue(undefined),
  getAll: vi.fn().mockResolvedValue([]),
  clear: vi.fn().mockResolvedValue(undefined),
});

export interface MockServices {
  userService: {
    getUser: Mock;
    addMoney: Mock;
    removeMoney: Mock;
    updateUser: Mock;
  };
  levelService: {
    addXP: Mock;
  };
}

export const createMockServices = (user?: User): MockServices => {
  const mockUser = user || createMockUser();

  return {
    userService: {
      getUser: vi.fn().mockResolvedValue(mockUser),
      addMoney: vi.fn().mockResolvedValue(undefined),
      removeMoney: vi.fn().mockResolvedValue(true),
      updateUser: vi.fn().mockResolvedValue(undefined),
    },
    levelService: {
      addXP: vi.fn().mockResolvedValue({ ...mockUser, xp: mockUser.xp + 50 }),
    },
  };
};

export const mockServiceManager = (services: MockServices): void => {
  vi.mock('../../src/services/system/Servicemanager.js', () => ({
    serviceManager: {
      userService: services.userService,
      levelService: services.levelService,
      groupService: {
        getGroup: vi.fn().mockResolvedValue({
          antiSpam: { enabled: true, maxMessages: 5, timeWindow: 60 },
        }),
      },
    },
  }));
};
