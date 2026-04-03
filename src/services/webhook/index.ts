/**
 * @fileoverview Webhook module barrel export
 *
 * Re-exports the main classes from the webhook subsystem for convenient importing.
 *
 * @module services/webhook
 * @example
 * import { webhookService, panelServer } from '@/services/webhook';
 */

// Re-export WebhookService for external use
export { webhookService, WebhookService } from './WebhookService.js';
export type { WebhookRequest, WebhookResponse, WebhookStatus } from './WebhookService.js';

// Re-export PanelServer for external use
export { panelServer, PanelServer } from './PanelServer.js';
export type { PanelConfig } from './PanelServer.js';
