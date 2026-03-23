/**
 * ReaccionHandler.ts
 *
 * Handles emoji reactions to messages in group lists/games.
 * Routes reactions to the ListaManager for game logic processing.
 * This handler is always active regardless of admin-only mode.
 *
 * @author **Carlos G** ⭐
 * @github CARLOSGRCIAGRCIA
 * @tiktok carlos.grcia0
 * @instagram carlos.gxv
 * @created 2026-03-16
 */

import type { WASocket, proto } from '@whiskeysockets/baileys';
import { logger } from '@/utils/logger.js';
import { listaManager } from '@/services/game/ListaManager.js';
import { normalizeJid } from '@/services/PermissionService.js';
import { logError } from '@/utils/logger.js';

/**
 * Handles reaction messages for list games.
 * Processes emoji reactions and forwards them to ListaManager.
 * Always enabled regardless of admin-only mode.
 *
 * @param sock - The Baileys socket
 * @param message - The message containing the reaction
 * @returns Promise<void>
 *
 * @example
 * ```typescript
 * // Called when a reaction message is received
 * await handleReaccion(sock, message);
 * ```
 */
export async function handleReaccion(
  sock: WASocket,
  message: proto.IWebMessageInfo,
): Promise<void> {
  try {
    const reaccionMsg = message.message?.reactionMessage;
    if (!reaccionMsg) return;

    const targetKey = reaccionMsg.key;
    if (!targetKey?.id) return;

    const messageId = targetKey.id;
    const chatJid = message.key.remoteJid ?? '';
    const senderRaw = message.key.participant ?? message.key.remoteJid ?? '';
    const senderJid = normalizeJid(senderRaw);
    const senderNombre = message.pushName || 'User';
    const emoji = reaccionMsg.text ?? '';

    logger.debug(
      `[REACCION DEBUG] messageId=${messageId} chatJid=${chatJid} sender=${senderJid} emoji="${emoji}" sockUser=${sock.user?.id}`,
    );

    const managerAny = listaManager as unknown as { listas: Map<string, unknown> };
    logger.debug(
      `[REACCION DEBUG] listas en memoria: [${Array.from(managerAny.listas.keys()).join(', ')}]`,
    );

    if (!chatJid || !senderJid) return;

    const result = await listaManager.onReaccion(sock, {
      chatJid,
      messageId,
      senderJid,
      senderNombre,
      emoji,
    });

    if (!result.success) {
      let feedback = '';
      switch (result.reason) {
        case 'no_existe':
          feedback = '❌ Esta lista ya no existe o expiró';
          break;
        case 'inactiva':
          feedback = '❌ Esta lista ya está cerrada';
          break;
        case 'lista_llena':
          feedback = '⚠️ La lista está llena, intenta como suplente';
          break;
        case 'no_en_lista':
          feedback = '⚠️ No estás en la lista';
          break;
        default:
          feedback = '⚠️ No se pudo procesar tu reacción';
      }
      await sock.sendMessage(chatJid, { text: feedback }).catch(() => {});
    }
  } catch (error) {
    logError('[REACCION ERROR]', error);
  }
}
