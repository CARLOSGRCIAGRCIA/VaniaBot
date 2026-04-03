/**
 * WebhookService.ts
 *
 * Handles subbot requests from external panels.
 * Manages pairing code generation and delivery.
 *
 * @author **Carlos G** ⭐
 * @github CARLOSGRCIAGRCIA
 * @created 2026-04-03
 */

import { subBotDatabase } from '@/services/subbot/SubBotDatabase.js';
import { subBotManager } from '@/services/subbot/SubBotManager.js';
import { logger, logError } from '@/utils/logger.js';

export interface WebhookRequest {
  requestToken: string;
  phoneNumber: string;
  subbotName?: string;
  ownerName?: string;
  ownerJid?: string;
}

export interface WebhookResponse {
  success: boolean;
  requestToken?: string;
  pairingCode?: string;
  message?: string;
  slot?: number;
  subbotId?: string;
}

export interface WebhookStatus {
  requestToken: string;
  status: 'pending' | 'generating' | 'ready' | 'expired' | 'cancelled';
  phoneNumber: string;
  subbotName?: string;
  ownerName?: string;
  ownerJid?: string;
  createdAt: number;
  expiresAt: number;
  pairingCode?: string;
  slot?: number;
  subbotId?: string;
}

export class WebhookService {
  private static instance: WebhookService;
  private pendingRequests = new Map<string, WebhookStatus>();
  private readonly REQUEST_EXPIRY_MS = 5 * 60 * 1000;
  private readonly CALLBACK_TIMEOUT_MS = 3 * 60 * 1000;

  private constructor() {}

  static getInstance(): WebhookService {
    if (!WebhookService.instance) {
      WebhookService.instance = new WebhookService();
    }
    return WebhookService.instance;
  }

  async handleSubBotRequest(
    request: WebhookRequest,
    callbackUrl?: string,
  ): Promise<WebhookResponse> {
    const { requestToken, phoneNumber, subbotName, ownerName, ownerJid } = request;

    if (!requestToken || !phoneNumber) {
      return {
        success: false,
        message: 'Missing requestToken or phoneNumber',
      };
    }

    if (this.pendingRequests.has(requestToken)) {
      const existing = this.pendingRequests.get(requestToken);
      if (!existing) {
        return { success: false, message: 'Request not found' };
      }
      if (existing.status === 'ready' && existing.pairingCode) {
        return {
          success: true,
          requestToken,
          pairingCode: existing.pairingCode,
          slot: existing.slot,
          message: 'Pairing code already generated',
        };
      }
      if (existing.status === 'pending' || existing.status === 'generating') {
        return {
          success: false,
          message: 'Request already in progress',
        };
      }
    }

    if (!subBotDatabase.isPublicRequestsEnabled()) {
      return {
        success: false,
        message: 'Public requests are disabled',
      };
    }

    const freeSlot = subBotDatabase.getFreeSlot();
    if (!freeSlot) {
      return {
        success: false,
        message: 'No available slots',
      };
    }

    const status: WebhookStatus = {
      requestToken,
      status: 'pending',
      phoneNumber,
      subbotName: subbotName || `VaniaBot-${freeSlot.slot}`,
      ownerName: ownerName || 'Panel User',
      ownerJid: ownerJid || `${phoneNumber}@s.whatsapp.net`,
      createdAt: Date.now(),
      expiresAt: Date.now() + this.REQUEST_EXPIRY_MS,
    };

    this.pendingRequests.set(requestToken, status);
    this.scheduleExpiry(requestToken);

    logger.info(`Webhook: subbot request received for ${phoneNumber}, slot ${freeSlot.slot}`);

    try {
      const result = await subBotManager.requestSubBot(
        status.ownerJid || '',
        status.ownerName || '',
        phoneNumber,
        freeSlot.slot,
        true,
      );

      const instance = subBotManager['instances']?.get(result.subConfig?.id || '');
      if (instance) {
        instance.once('pairingCode', async (code: string) => {
          status.status = 'ready';
          status.pairingCode = code;
          status.slot = freeSlot.slot;
          status.subbotId = result.subConfig?.id;

          logger.info(`Webhook: pairing code generated for ${requestToken}: ${code}`);

          if (callbackUrl) {
            await this.sendCallback(callbackUrl, status);
          }
        });
      }

      setTimeout(async () => {
        if (status.status === 'pending') {
          const subConfig = result.subConfig;
          if (subConfig) {
            const instance = subBotManager['instances']?.get(subConfig.id);
            if (instance?.pairingCode) {
              status.status = 'ready';
              status.pairingCode = instance.pairingCode;
              status.slot = freeSlot.slot;
              status.subbotId = subConfig.id;

              if (callbackUrl) {
                await this.sendCallback(callbackUrl, status);
              }
            }
          }
        }
      }, 10000);

      return {
        success: true,
        requestToken,
        slot: freeSlot.slot,
        message: 'Subbot request accepted, generating pairing code',
      };
    } catch (error) {
      logError('WebhookService.handleSubBotRequest', error);
      this.pendingRequests.delete(requestToken);
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Failed to process request',
      };
    }
  }

  getStatus(requestToken: string): WebhookStatus | null {
    return this.pendingRequests.get(requestToken) || null;
  }

  async cancelRequest(requestToken: string): Promise<boolean> {
    const status = this.pendingRequests.get(requestToken);
    if (!status) return false;

    if (status.status === 'ready' && status.subbotId) {
      try {
        await subBotManager.deleteSubBot(status.ownerJid || '', status.slot);
      } catch {}
    }

    status.status = 'cancelled';
    this.pendingRequests.delete(requestToken);
    return true;
  }

  getAllPending(): WebhookStatus[] {
    return Array.from(this.pendingRequests.values()).filter(
      s => s.status === 'pending' || s.status === 'generating' || s.status === 'ready',
    );
  }

  getStats(): {
    pending: number;
    ready: number;
    total: number;
    availableSlots: number;
    usedSlots: number;
  } {
    const requests = this.getAllPending();
    return {
      pending: requests.filter(r => r.status === 'pending' || r.status === 'generating').length,
      ready: requests.filter(r => r.status === 'ready').length,
      total: requests.length,
      availableSlots: subBotDatabase.getMaxSlots() - subBotDatabase.getUsedSlotCount(),
      usedSlots: subBotDatabase.getUsedSlotCount(),
    };
  }

  private scheduleExpiry(requestToken: string): void {
    setTimeout(() => {
      const status = this.pendingRequests.get(requestToken);
      if (status && status.status !== 'ready' && status.status !== 'cancelled') {
        status.status = 'expired';
        this.pendingRequests.delete(requestToken);
        logger.info(`Webhook: request ${requestToken} expired`);
      }
    }, this.REQUEST_EXPIRY_MS);
  }

  private async sendCallback(callbackUrl: string, status: WebhookStatus): Promise<void> {
    try {
      const response = await fetch(callbackUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'VaniaBot-Webhook/1.0',
        },
        body: JSON.stringify({
          event: 'pairingCodeReady',
          requestToken: status.requestToken,
          phoneNumber: status.phoneNumber,
          pairingCode: status.pairingCode,
          slot: status.slot,
          subbotId: status.subbotId,
          expiresAt: status.expiresAt,
        }),
      });

      if (!response.ok) {
        logger.warn(`Webhook callback failed: ${response.status}`);
      }
    } catch (error) {
      logger.warn(`Webhook callback error: ${error}`);
    }
  }

  cleanup(): void {
    for (const [token, status] of this.pendingRequests) {
      if (status.status === 'expired' || status.status === 'cancelled') {
        this.pendingRequests.delete(token);
      }
    }
  }
}

export const webhookService = WebhookService.getInstance();
