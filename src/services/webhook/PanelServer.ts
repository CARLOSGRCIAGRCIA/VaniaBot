/**
 * PanelServer.ts
 *
 * Express server for VaniaBot Panel.
 * Provides REST API for subbot management and serves the web panel.
 *
 * @author **Carlos G** ⭐
 * @github CARLOSGRCIAGRCIA
 * @created 2026-04-03
 */

import express from 'express';
import type { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import os from 'os';
import { webhookService } from './WebhookService.js';
import { subBotDatabase } from '@/services/subbot/SubBotDatabase.js';
import { subBotManager } from '@/services/subbot/SubBotManager.js';
import { serviceManager } from '@/services/system/Servicemanager.js';
import { healthCheckService } from '@/services/system/HealthCheckService.js';
import { cacheManager } from '@/core/CacheManager.js';
import type { WhatsAppClient } from '@/core/Client.js';
import { logger } from '@/utils/logger.js';

export interface PanelConfig {
  port: number;
  host: string;
  webhookToken: string;
  allowedOrigins: string[];
  panelPath: string;
  callbackSecret?: string;
}

const DEFAULT_CONFIG: PanelConfig = {
  port: process.env.PANEL_PORT ? parseInt(process.env.PANEL_PORT) : 3000,
  host: process.env.PANEL_HOST || '0.0.0.0',
  webhookToken: process.env.PANEL_WEBHOOK_TOKEN || '',
  allowedOrigins: process.env.PANEL_ALLOWED_ORIGINS?.split(',') || ['*'],
  panelPath: process.env.PANEL_PATH || './panel',
  callbackSecret: process.env.PANEL_CALLBACK_SECRET,
};

function loadPanelConfig(): PanelConfig {
  const configPath = './data/panel-config.json';
  if (existsSync(configPath)) {
    try {
      const loaded = JSON.parse(readFileSync(configPath, 'utf-8'));
      return { ...DEFAULT_CONFIG, ...loaded };
    } catch {}
  }
  return DEFAULT_CONFIG;
}

export class PanelServer {
  private static instance: PanelServer;
  private app: express.Application;
  private server: ReturnType<express.Application['listen']> | null = null;
  private config: PanelConfig;

  private constructor() {
    this.config = loadPanelConfig();
    this.app = express();
    this.setupMiddleware();
    this.setupRoutes();
    this.setupErrorHandling();
  }

  static getInstance(): PanelServer {
    if (!PanelServer.instance) {
      PanelServer.instance = new PanelServer();
    }
    return PanelServer.instance;
  }

  private setupMiddleware(): void {
    this.app.use(
      helmet({
        contentSecurityPolicy: false,
        crossOriginEmbedderPolicy: false,
      }),
    );

    this.app.use(
      cors({
        origin: (origin, callback) => {
          if (
            !origin ||
            this.config.allowedOrigins.includes('*') ||
            this.config.allowedOrigins.includes(origin)
          ) {
            callback(null, true);
          } else {
            callback(new Error('Not allowed by CORS'));
          }
        },
        credentials: true,
      }),
    );

    this.app.use(express.json({ limit: '1mb' }));
    this.app.use(express.urlencoded({ extended: true }));

    const apiLimiter = rateLimit({
      windowMs: 15 * 60 * 1000,
      max: 100,
      message: { error: 'Too many requests, please try again later' },
      standardHeaders: true,
      legacyHeaders: false,
    });

    this.app.use('/api/', apiLimiter);
  }

  private setupRoutes(): void {
    this.app.use(express.static(this.config.panelPath));

    this.app.get('/', (_req: Request, res: Response) => {
      const indexPath = join(this.config.panelPath, 'index.html');
      if (existsSync(indexPath)) {
        res.sendFile(indexPath);
      } else {
        res.send(this.getWelcomePage());
      }
    });

    this.app.get('/api/health', (_req: Request, res: Response) => {
      res.json({
        status: 'ok',
        timestamp: Date.now(),
        uptime: process.uptime(),
      });
    });

    this.app.get('/api/stats', (_req: Request, res: Response) => {
      const slots = subBotDatabase.getAllSlots();
      const webhookStats = webhookService.getStats();

      const mainBotConnected =
        (global as { client?: WhatsAppClient }).client?.isClientReady() ?? false;
      const memory = process.memoryUsage();
      const totalMem = os.totalmem();
      const freeMem = os.freemem();

      const client = (global as { client?: WhatsAppClient }).client;
      const clientStats = client?.getStats();

      const bots = [
        {
          id: 'main',
          name: 'VaniaBot',
          connected: mainBotConnected,
          uptime: process.uptime(),
        },
      ];

      res.json({
        bots,
        memory: { rss: memory.rss, heapTotal: memory.heapTotal, heapUsed: memory.heapUsed },
        memorySystem: {
          total: totalMem,
          used: totalMem - freeMem,
          free: freeMem,
          percentage: totalMem > 0 ? Math.round(((totalMem - freeMem) / totalMem) * 100) : 0,
        },
        uptime: process.uptime(),
        slots: {
          total: subBotDatabase.getMaxSlots(),
          used: subBotDatabase.getUsedSlotCount(),
          available: subBotDatabase.getMaxSlots() - subBotDatabase.getUsedSlotCount(),
          details: slots.map(s => ({
            slot: s.slot,
            status: s.status,
            owner: s.ownerName || null,
            phone: s.phoneNumber
              ? `+${s.phoneNumber.slice(0, 6)}****${s.phoneNumber.slice(-4)}`
              : null,
            connectedAt: s.connectedAt,
          })),
        },
        webhook: webhookStats,
        publicRequests: subBotDatabase.isPublicRequestsEnabled(),
        stats: clientStats
          ? {
              messagesReceived: clientStats.messagesReceived,
              messagesProcessed: clientStats.messagesProcessed,
              commandsExecuted: clientStats.commandsExecuted,
              errorsCount: clientStats.errorsCount,
              spamBlocked: clientStats.spamBlocked,
              avgProcessingTime: clientStats.avgProcessingTime,
            }
          : null,
        averages: { messages: 0, commands: 0, errors: 0 },
      });
    });

    this.app.post('/api/webhook/request', async (req: Request, res: Response) => {
      const token = req.headers['x-bot-webhook-token'] as string;

      if (this.config.webhookToken && token !== this.config.webhookToken) {
        res.status(401).json({ success: false, message: 'Invalid webhook token' });
        return;
      }

      const { requestToken, phoneNumber, subbotName, ownerName, callbackUrl } = req.body;

      if (!requestToken || !phoneNumber) {
        res.status(400).json({ success: false, message: 'Missing requestToken or phoneNumber' });
        return;
      }

      try {
        const result = await webhookService.handleSubBotRequest(
          { requestToken, phoneNumber, subbotName, ownerName },
          callbackUrl,
        );

        if (result.success) {
          res.json(result);
        } else {
          res.status(400).json(result);
        }
      } catch (error) {
        logger.error('Webhook request error:', error);
        res.status(500).json({ success: false, message: 'Internal server error' });
      }
    });

    this.app.get('/api/webhook/status/:requestToken', (req: Request, res: Response) => {
      const token = req.headers['x-bot-webhook-token'] as string;

      if (this.config.webhookToken && token !== this.config.webhookToken) {
        res.status(401).json({ success: false, message: 'Invalid webhook token' });
        return;
      }

      const requestToken = req.params.requestToken as string;
      const status = webhookService.getStatus(requestToken);

      if (!status) {
        res.status(404).json({ success: false, message: 'Request not found' });
        return;
      }

      res.json({
        success: true,
        status: {
          requestToken: status.requestToken,
          status: status.status,
          phoneNumber: status.phoneNumber,
          pairingCode: status.pairingCode,
          slot: status.slot,
          expiresAt: status.expiresAt,
        },
      });
    });

    this.app.post('/api/webhook/cancel/:requestToken', async (req: Request, res: Response) => {
      const token = req.headers['x-bot-webhook-token'] as string;

      if (this.config.webhookToken && token !== this.config.webhookToken) {
        res.status(401).json({ success: false, message: 'Invalid webhook token' });
        return;
      }

      const requestToken = req.params.requestToken as string;
      const cancelled = await webhookService.cancelRequest(requestToken);

      if (cancelled) {
        res.json({ success: true, message: 'Request cancelled' });
      } else {
        res.status(404).json({ success: false, message: 'Request not found' });
      }
    });

    this.app.get('/api/slots', (_req: Request, res: Response) => {
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

    this.app.get('/api/slot/:slot', (req: Request, res: Response) => {
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

    this.app.post('/api/slot/:slot/reconnect', async (req: Request, res: Response) => {
      const token = req.headers['x-api-token'] as string;

      if (!this.validateApiToken(token)) {
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

    this.app.post('/api/slot/:slot/release', async (req: Request, res: Response) => {
      const token = req.headers['x-api-token'] as string;

      if (!this.validateApiToken(token)) {
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

    this.app.get('/api/settings', (_req: Request, res: Response) => {
      res.json({
        publicRequests: subBotDatabase.isPublicRequestsEnabled(),
        maxSlots: subBotDatabase.getMaxSlots(),
      });
    });

    this.app.post('/api/settings', (req: Request, res: Response) => {
      const token = req.headers['x-api-token'] as string;

      if (!this.validateApiToken(token)) {
        res.status(401).json({ success: false, message: 'Invalid API token' });
        return;
      }

      const { publicRequests, maxSlots } = req.body;

      if (typeof publicRequests === 'boolean') {
        subBotDatabase.setPublicRequests(publicRequests);
      }

      if (typeof maxSlots === 'number' && maxSlots > 0 && maxSlots <= 50) {
        subBotDatabase.setMaxSlots(maxSlots);
      }

      res.json({
        success: true,
        publicRequests: subBotDatabase.isPublicRequestsEnabled(),
        maxSlots: subBotDatabase.getMaxSlots(),
      });
    });

    this.app.get('/api/bots', (_req: Request, res: Response) => {
      const bots: Array<{ id: string; name: string; connected: boolean; uptime?: number }> = [];
      const mainBotConnected =
        (global as { client?: WhatsAppClient }).client?.isClientReady() ?? false;
      bots.push({
        id: 'main',
        name: 'VaniaBot',
        connected: mainBotConnected,
        uptime: process.uptime(),
      });
      res.json(bots);
    });

    this.app.get('/api/health/detailed', async (_req: Request, res: Response) => {
      try {
        const memory = process.memoryUsage();
        const health = await healthCheckService.performHealthCheck();
        const totalMem = os.totalmem();
        res.json({
          ...health,
          system: {
            platform: os.platform(),
            arch: os.arch(),
            cpuCount: os.cpus().length,
            cpuModel: os.cpus()[0]?.model || 'Unknown',
            totalMemory: totalMem,
            freeMemory: os.freemem(),
            uptime: os.uptime(),
          },
          process: {
            pid: process.pid,
            nodeVersion: process.version,
            memory: {
              rss: memory.rss,
              heapTotal: memory.heapTotal,
              heapUsed: memory.heapUsed,
              external: memory.external,
            },
          },
        });
      } catch (error) {
        res.status(500).json({ error: String(error) });
      }
    });

    this.app.get('/api/commands/metrics', (_req: Request, res: Response) => {
      const client = (global as { client?: WhatsAppClient }).client;
      const metrics = client?.getStats()?.commandMetrics || new Map();
      const commands: Array<{
        name: string;
        count: number;
        totalTime: number;
        errors: number;
        avgTime: number;
      }> = [];
      (metrics as Map<string, { count: number; totalTime: number; errors: number }>).forEach(
        (data, name) => {
          commands.push({
            name,
            count: data.count,
            totalTime: data.totalTime,
            errors: data.errors,
            avgTime: data.count > 0 ? Math.round(data.totalTime / data.count) : 0,
          });
        },
      );
      commands.sort((a, b) => b.count - a.count);
      const clientStats = client?.getStats();
      res.json({
        commands: commands.slice(0, 50),
        topCommands: commands.slice(0, 10),
        totalCommands: commands.reduce((sum, c) => sum + c.count, 0),
        totalErrors: commands.reduce((sum, c) => sum + c.errors, 0),
        stats: clientStats
          ? {
              messagesReceived: clientStats.messagesReceived,
              messagesProcessed: clientStats.messagesProcessed,
              commandsExecuted: clientStats.commandsExecuted,
              errorsCount: clientStats.errorsCount,
              spamBlocked: clientStats.spamBlocked,
              avgProcessingTime: clientStats.avgProcessingTime,
            }
          : null,
      });
    });

    this.app.get('/api/moderation/bans', async (_req: Request, res: Response) => {
      try {
        const db = serviceManager.db;
        if (!db) {
          res.status(501).json({ error: 'Database not available' });
          return;
        }
        const allBans = await db.getAll<{
          userId: string;
          userName: string;
          reason: string;
          timestamp: number;
        }>('bans');
        res.json({ total: allBans.length, bans: allBans.slice(0, 100) });
      } catch (error) {
        res.status(500).json({ error: String(error) });
      }
    });

    this.app.get('/api/moderation/mutes', async (_req: Request, res: Response) => {
      try {
        const db = serviceManager.db;
        if (!db) {
          res.status(501).json({ error: 'Database not available' });
          return;
        }
        const allMutes = await db.getAll<{ expiresAt: number; userId: string; userName: string }>(
          'mutes',
        );
        const activeMutes = allMutes.filter(m => m.expiresAt > Date.now());
        res.json({
          total: allMutes.length,
          active: activeMutes.length,
          mutes: activeMutes.slice(0, 100),
        });
      } catch (error) {
        res.status(500).json({ error: String(error) });
      }
    });

    this.app.get('/api/moderation/actions', async (req: Request, res: Response) => {
      try {
        const db = serviceManager.db;
        if (!db) {
          res.status(501).json({ error: 'Database not available' });
          return;
        }
        const limit = Math.min(parseInt(String(req.query.limit || '50'), 10), 100);
        const result = await db.getPaginated('moderation_logs', {
          page: 1,
          limit,
          sortBy: 'timestamp',
          sortOrder: 'desc',
        });
        res.json({ total: result.total, actions: result.items });
      } catch (error) {
        res.status(500).json({ error: String(error) });
      }
    });

    this.app.get('/api/groups', async (_req: Request, res: Response) => {
      try {
        if (!serviceManager.groupService) {
          res.status(501).json({ error: 'Service not available' });
          return;
        }
        const groups = await serviceManager.groupService.getAllGroups();
        const groupsWithStats = groups.map(g => ({
          jid: g.jid,
          name: g.name,
          isActive: g.isActive,
          onlyAdmin: g.onlyAdmin,
          welcome: g.welcome.enabled,
          goodbye: g.goodbye.enabled,
          antiLink: g.antiLink.enabled,
          antiSpam: g.antiSpam.enabled,
          stats: g.stats,
        }));
        res.json({
          total: groups.length,
          active: groups.filter(g => g.isActive).length,
          groups: groupsWithStats,
        });
      } catch (error) {
        res.status(500).json({ error: String(error) });
      }
    });

    this.app.get('/api/groups/:jid', async (req: Request, res: Response) => {
      try {
        if (!serviceManager.groupService) {
          res.status(501).json({ error: 'Service not available' });
          return;
        }
        const jid = String(req.params.jid);
        const group = await serviceManager.groupService.getGroup(jid);
        if (!group) {
          res.status(404).json({ error: 'Group not found' });
          return;
        }
        res.json(group);
      } catch (error) {
        res.status(500).json({ error: String(error) });
      }
    });

    this.app.get('/api/cache/stats', (_req: Request, res: Response) => {
      const stats = cacheManager.getStats?.() || { hits: 0, misses: 0 };
      res.json(stats);
    });
  }

  private setupErrorHandling(): void {
    this.app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
      logger.error('Panel server error:', err);
      res.status(500).json({
        success: false,
        message: process.env.NODE_ENV === 'production' ? 'Internal server error' : err.message,
      });
    });
  }

  private validateApiToken(token: string | undefined): boolean {
    if (!this.config.webhookToken) return false;
    return token === this.config.webhookToken;
  }

  private getWelcomePage(): string {
    return `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>VaniaBot Panel</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .container {
      background: white;
      padding: 3rem;
      border-radius: 20px;
      box-shadow: 0 20px 60px rgba(0,0,0,0.3);
      text-align: center;
      max-width: 500px;
    }
    h1 { color: #333; margin-bottom: 1rem; font-size: 2rem; }
    p { color: #666; margin-bottom: 1.5rem; line-height: 1.6; }
    .emoji { font-size: 4rem; margin-bottom: 1rem; }
    a { color: #667eea; text-decoration: none; font-weight: 600; }
    code {
      background: #f4f4f4;
      padding: 0.2rem 0.5rem;
      border-radius: 4px;
      font-size: 0.9em;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="emoji">🌸</div>
    <h1>VaniaBot Panel</h1>
    <p>
      El servidor del panel está funcionando correctamente.<br><br>
      API endpoints disponibles:<br>
      <code>/api/stats</code><br>
      <code>/api/webhook/request</code><br>
      <code>/api/slots</code>
    </p>
  </div>
</body>
</html>
    `;
  }

  async start(): Promise<void> {
    const http = await import('http');

    return new Promise(resolve => {
      this.server = http.createServer(this.app);

      this.server.listen(this.config.port, this.config.host, () => {
        logger.info(`🌸 VaniaBot Panel running at http://${this.config.host}:${this.config.port}`);
        logger.info(`📊 API: http://${this.config.host}:${this.config.port}/api/stats`);
        resolve();
      });

      this.server.on('error', (error: NodeJS.ErrnoException) => {
        if (error.code === 'EADDRINUSE') {
          logger.warn(`⚠️ Panel port ${this.config.port} in use, trying ${this.config.port + 1}`);
          this.server?.close();
          this.server = http.createServer(this.app);
          this.server.listen(this.config.port + 1, this.config.host, () => {
            logger.info(
              `🌸 VaniaBot Panel running at http://${this.config.host}:${this.config.port + 1}`,
            );
            resolve();
          });
        } else {
          logger.error('Panel server error:', error);
        }
      });
    });
  }

  async stop(): Promise<void> {
    return new Promise(resolve => {
      if (this.server) {
        this.server.close(() => {
          logger.info('🌸 VaniaBot Panel stopped');
          resolve();
        });
      } else {
        resolve();
      }
    });
  }

  getConfig(): PanelConfig {
    return { ...this.config };
  }
}

export const panelServer = PanelServer.getInstance();
