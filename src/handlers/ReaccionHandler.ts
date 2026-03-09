import type { WASocket, proto } from "@whiskeysockets/baileys";
import { listaManager } from "@/services/ListaManager.js";
import { normalizeJid } from "@/services/PermissionService.js";
import { logger, logError } from "@/utils/logger.js";

export async function handleReaccion(
  sock: WASocket,
  message: proto.IWebMessageInfo,
): Promise<void> {
  try {
    const reaccionMsg = message.message?.reactionMessage;
    if (!reaccionMsg) {
      return;
    }

    const targetKey = reaccionMsg.key;
    if (!targetKey?.id) {
      return;
    }

    const messageId = targetKey.id;
    const chatJid = message.key.remoteJid!;
    const senderRaw = message.key.participant || message.key.remoteJid!;
    const senderJid = normalizeJid(senderRaw);
    const senderNombre = message.pushName || "Usuario";
    const emoji = reaccionMsg.text ?? "";
    await listaManager.onReaccion(sock, {
      chatJid,
      messageId,
      senderJid,
      senderNombre,
      emoji,
    });
  } catch (error) {
    logError("[REACCION ERROR]", error);
  }
}
