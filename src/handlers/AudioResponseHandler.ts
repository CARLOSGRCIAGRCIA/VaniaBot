/**
 * AudioResponseHandler.ts
 *
 * Handles automatic audio responses based on keyword triggers.
 * This handler listens for specific words/phrases and responds with audio.
 *
 * @author **Carlos G**
 * @github CARLOSGRCIAGRCIA
 * @created 2026-04-04
 */

import type { WASocket, proto } from 'baileys';
import { logError } from '@/utils/logger.js';
import { serviceManager } from '@/services/system/Servicemanager.js';

interface AudioTrigger {
  pattern: RegExp;
  audioUrl: string;
}

const AUDIO_TRIGGERS: AudioTrigger[] = [
  { pattern: /buenos dias|buenos días|buenos dias/i, audioUrl: 'https://qu.ax/wLUF.mp3' },
  { pattern: /buenas noches/i, audioUrl: 'https://qu.ax/TTfs.mp3' },
  { pattern: /hola|ola|hi|hello/i, audioUrl: 'https://qu.ax/eGdW.mp3' },
  { pattern: /bienvenido|🥳|🤗/gi, audioUrl: 'https://qu.ax/cUYg.mp3' },
  { pattern: /blackpink in your area/i, audioUrl: 'https://qu.ax/pavq.mp3' },
  { pattern: /ara ara/i, audioUrl: 'https://qu.ax/PPgt.mp3' },
  { pattern: /fbi|FBI|picus|PICUS/i, audioUrl: 'https://qu.ax/wFbD.mp3' },
  { pattern: /te amo|teamo/i, audioUrl: 'https://qu.ax/rGdn.mp3' },
  { pattern: /siu|siiuu|siuuu|siiiiuuuuu/i, audioUrl: 'https://qu.ax/bfC.mp3' },
  { pattern: /uwu|uwU|Uwu|UWU/i, audioUrl: 'https://qu.ax/hfyX.mp3' },
  { pattern: /:c|:c/gi, audioUrl: 'https://qu.ax/XMHj.mp3' },
  { pattern: /joder/i, audioUrl: 'https://qu.ax/lSgD.mp3' },
  { pattern: /bruno/i, audioUrl: 'https://qu.ax/frSi.mp3' },
  { pattern: /wtf|WTF|wataf/i, audioUrl: 'https://qu.ax/aPtM.mp3' },
  { pattern: /Sus|sus|among us|Among us/i, audioUrl: 'https://qu.ax/Mnrz.mp3' },
  { pattern: /Yamete|yamete/i, audioUrl: 'https://qu.ax/thgS.mp3' },
  { pattern: /oni-chan|onichan|o-onichan/i, audioUrl: 'https://qu.ax/sEFj.mp3' },
  { pattern: /pokemon|Pokemon|Pikachu|pikachu/i, audioUrl: 'https://qu.ax/kWLh.mp3' },
  { pattern: /pika|Pika/i, audioUrl: 'https://qu.ax/wbAf.mp3' },
  { pattern: /feliz navidad|merry christmas/i, audioUrl: 'https://qu.ax/XYyY.m4a' },
  { pattern: /jesucristo|jesús|Auronplay/i, audioUrl: 'https://qu.ax/AWdx.mp3' },
  { pattern: /el pepe|El Pepe/i, audioUrl: 'https://qu.ax/Efdb.mp3' },
  { pattern: /noche de paz|Noche de paz/i, audioUrl: 'https://qu.ax/SgrV.mp3' },
  { pattern: /OMAIGA|omg|omaiga/i, audioUrl: 'https://qu.ax/PfuN.mp3' },
  { pattern: /Ohayo|ohayo|Ojayo/i, audioUrl: 'https://qu.ax/PFxn.mp3' },
  { pattern: /Nyapasu|nyapasu|nya pasu/i, audioUrl: 'https://qu.ax/ZgFZ.mp3' },
  { pattern: /niconico|NICONICO/i, audioUrl: 'https://qu.ax/YdVq.mp3' },
  { pattern: /YOSHI|Yoshi/i, audioUrl: 'https://qu.ax/ZgKT.mp3' },
  { pattern: /nadie te pregunto|Nadie te pregunto/i, audioUrl: 'https://qu.ax/MrGg.mp3' },
  { pattern: /hablame|Hablame|háblame/i, audioUrl: 'https://qu.ax/uQqA.mp3' },
  { pattern: /rawr|Rawr|raawwr/i, audioUrl: 'https://qu.ax/YnoG.mp3' },
  { pattern: /orale|Orale/i, audioUrl: 'https://qu.ax/Epen.mp3' },
  { pattern: /Q onda|que onda/i, audioUrl: 'https://qu.ax/YpsR.mp3' },
  { pattern: /Hey|Hei|hey|HEY/i, audioUrl: 'https://qu.ax/AaBt.mp3' },
  { pattern: /Oye|🐔|Chiste/i, audioUrl: 'https://qu.ax/MSiQ.mp3' },
  { pattern: /vivan|vivan los novios/i, audioUrl: 'https://qu.ax/vHX.mp3' },
  { pattern: /verdad que|verdad que te engañe/i, audioUrl: 'https://qu.ax/yTid.mp3' },
  { pattern: /Moshi moshi|Shinobu|mundo/i, audioUrl: 'https://qu.ax/JAyd.mp3' },
  { pattern: /mmm|Mmm|MmM/gi, audioUrl: 'https://qu.ax/gxFs.mp3' },
  { pattern: /mmm|Mmm|MmM/gi, audioUrl: 'https://qu.ax/gxFs.mp3' },
  { pattern: /corte|pelea|pelear|golpe/i, audioUrl: 'https://qu.ax/hRuU.mp3' },
  { pattern: /tunometecabrasaramambiche/i, audioUrl: 'https://qu.ax/LAAB.mp3' },
  { pattern: /me voy|me fui|Chao|adios|Adios/i, audioUrl: 'https://qu.ax/iOky.mp3' },
  { pattern: /Fino señores|fino senores/i, audioUrl: 'https://qu.ax/hapR.mp3' },
  { pattern: /fiesta del admin|fiesta en casa/i, audioUrl: 'https://qu.ax/MpnG.mp3' },
  { pattern: /feliz cumpleaños/i, audioUrl: 'https://qu.ax/UtmZ.mp3' },
  { pattern: /esto va ser épico|esto va a hacer/i, audioUrl: 'https://qu.ax/pjTx.mp3' },
  { pattern: /Entrada|Entrada|Ingresa|INGRESA/i, audioUrl: 'https://qu.ax/UpAC.mp3' },
  { pattern: /Enojado|ENOJADO|enojado|Molesto/i, audioUrl: 'https://qu.ax/jqTX.mp3' },
  { pattern: /bañate|Bañat/i, audioUrl: 'https://qu.ax/JsYa.mp3' },
  { pattern: /Bueno si|bueno si|bueno sí/i, audioUrl: 'https://qu.ax/DqBM.mp3' },
  { pattern: /Cada|Basado|Basada|basado/i, audioUrl: 'https://qu.ax/jDAl.mp3' },
  { pattern: /diagnosticadocongay|diagnosticado con gay/i, audioUrl: 'https://qu.ax/cUl.mp3' },
  { pattern: /Me olvide|me olvide|Me olvidé/i, audioUrl: 'https://qu.ax/SbX.mp3' },
  { pattern: /libre|la biblia|oremos|rezemos/i, audioUrl: 'https://qu.ax/GeeA.mp3' },
  { pattern: /freefire|FreeFire/i, audioUrl: 'https://qu.ax/Dwqp.mp3' },
  { pattern: /Aguanta|aguanta/i, audioUrl: 'https://qu.ax/Qmz.mp3' },
  { pattern: /es viernes|Viernes|viernes fiesta/i, audioUrl: 'https://qu.ax/LcdD.mp3' },
  { pattern: /:D|d:d/gi, audioUrl: 'https://qu.ax/cxDg.mp3' },
  { pattern: /banco|BANCO|banco2/i, audioUrl: 'https://qu.ax/fwek.mp3' },
  { pattern: /lloro|porqué estás tite|😭/gi, audioUrl: 'https://qu.ax/VrjA.mp3' },
  { pattern: /Zzzz|zzz|💩|👽/gi, audioUrl: 'https://qu.ax/KkSZ.mp3' },
  { pattern: /Eres Fuerte|god|🤜|🤛/gi, audioUrl: 'https://qu.ax/lhzq.mp3' },
  { pattern: /Cambiate a Movistar|movistar/i, audioUrl: 'https://qu.ax/RxJC.mp3' },
  { pattern: /ElToxico|El tóxico|Toxico|tóxico/i, audioUrl: 'https://qu.ax/WzBd.mp3' },
  { pattern: /Todo bien|😇|😄/gi, audioUrl: 'https://qu.ax/EDUC.mp3' },
  { pattern: /vete a la verga|vetealavrg/i, audioUrl: 'https://qu.ax/pXts.mp3' },
];

const processedMessages = new Set<string>();

export async function handleAudioResponse(
  sock: WASocket,
  message: proto.IWebMessageInfo,
): Promise<void> {
  try {
    const msgText =
      message.message?.conversation ||
      message.message?.extendedTextMessage?.text ||
      message.message?.imageMessage?.caption ||
      '';

    if (!msgText) return;

    if (!message.key?.remoteJid) return;

    const chatJid = message.key.remoteJid;
    if (!chatJid.endsWith('@g.us')) return;

    let groupSettings;
    try {
      groupSettings = await serviceManager.groupService.getGroup(chatJid);
    } catch {
      return;
    }

    if (!groupSettings.audios) return;

    if (!message.key.id) return;

    const msgId = message.key.id;
    if (processedMessages.has(msgId)) return;

    if (processedMessages.size > 1000) {
      processedMessages.clear();
    }

    for (const trigger of AUDIO_TRIGGERS) {
      if (trigger.pattern.test(msgText)) {
        processedMessages.add(msgId);

        try {
          await sock.sendPresenceUpdate('recording', chatJid);

          await sock.sendMessage(chatJid, {
            audio: { url: trigger.audioUrl },
            mimetype: 'audio/mp4',
            ptt: true,
          });
        } catch (error) {
          logError('[AudioResponse] Error sending audio:', error);
        }

        return;
      }
    }
  } catch (error) {
    logError('[AudioResponse] Error:', error);
  }
}
