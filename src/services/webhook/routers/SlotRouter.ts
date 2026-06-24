import { Router } from 'express';
import type { Request, Response } from 'express';
import { subBotDatabase } from '@/services/subbot/SubBotDatabase.js';
import { subBotManager } from '@/services/subbot/SubBotManager.js';

function validateApiToken(token: string | undefined, webhookToken: string): boolean {
  if (!webhookToken) return false;
  return token === webhookToken;
}

export function createSlotRouter(webhookToken: string): Router {
  const router = Router();

  router.get('/', (_req: Request, res: Response) => {
    const slots = subBotDatabase.getAllSlots();
    res.json({
      maxSlots: subBotDatabase.getMaxSlots(),
      slots: slots.map(s => ({
        slot: s.slot,
        status: s.status,
        ownerName: s.ownerName,
        ownerJid: s.ownerJid,
        phoneNumber: s.phoneNumber,
        name: s.name,
        connectedAt: s.connectedAt,
      })),
    });
  });

  router.get('/:slot', (req: Request, res: Response) => {
    const slotNumber = parseInt(req.params.slot as string);
    const slot = subBotDatabase.getSlot(slotNumber);

    if (!slot) {
      res.status(404).json({ success: false, message: 'Slot not found' });
      return;
    }

    res.json({
      success: true,
      slot: {
        slot: slot.slot,
        status: slot.status,
        ownerName: slot.ownerName,
        ownerJid: slot.ownerJid,
        phoneNumber: slot.phoneNumber,
        name: slot.name,
        bio: slot.bio,
        connectedAt: slot.connectedAt,
        requestedAt: slot.requestedAt,
      },
    });
  });

  router.post('/:slot/reconnect', async (req: Request, res: Response) => {
    const token = req.headers['x-api-token'] as string;
    if (!validateApiToken(token, webhookToken)) {
      res.status(401).json({ success: false, message: 'Invalid API token' });
      return;
    }

    const slotNumber = parseInt(req.params.slot as string);
    const slot = subBotDatabase.getSlot(slotNumber);

    if (!slot || !slot.ownerJid) {
      res.status(404).json({ success: false, message: 'Slot not found or empty' });
      return;
    }

    try {
      await subBotManager.reconnectByOwner(slot.ownerJid, slotNumber);
      res.json({ success: true, message: 'Reconnection initiated' });
    } catch (error) {
      res
        .status(500)
        .json({ success: false, message: error instanceof Error ? error.message : 'Error' });
    }
  });

  router.post('/:slot/release', async (req: Request, res: Response) => {
    const token = req.headers['x-api-token'] as string;
    if (!validateApiToken(token, webhookToken)) {
      res.status(401).json({ success: false, message: 'Invalid API token' });
      return;
    }

    const slotNumber = parseInt(req.params.slot as string);
    const slot = subBotDatabase.getSlot(slotNumber);

    if (!slot || !slot.ownerJid) {
      res.status(404).json({ success: false, message: 'Slot not found or empty' });
      return;
    }

    try {
      await subBotManager.deleteSubBot(slot.ownerJid, slotNumber);
      res.json({ success: true, message: 'Slot released' });
    } catch (error) {
      res
        .status(500)
        .json({ success: false, message: error instanceof Error ? error.message : 'Error' });
    }
  });

  return router;
}
