import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import type { MessageContext } from '@/types/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Busca un archivo en múltiples rutas posibles
 * @param filename - Nombre del archivo (ej: 'clkRules.png')
 * @returns Buffer del archivo o null si no se encuentra
 */
export function findAssetFile(filename: string): Buffer | null {
  const possiblePaths = [
    path.join('/app', 'data', 'assets', filename),
    path.join(process.cwd(), 'data', 'assets', filename),
    path.join(__dirname, '..', '..', 'data', 'assets', filename),
    process.env.ASSETS_DIR ? path.join(process.env.ASSETS_DIR, filename) : null,
    path.join(process.cwd(), 'static', 'assets', filename),
    path.join('/app', 'static', 'assets', filename),
  ].filter(Boolean) as string[];

  for (const imagePath of possiblePaths) {
    if (fs.existsSync(imagePath)) {
      try {
        console.log(`Found asset: ${imagePath}`);
        return fs.readFileSync(imagePath);
      } catch (error) {
        console.error(`Error reading file ${imagePath}:`, error);
      }
    }
  }

  console.error(`Asset not found: ${filename}. Searched paths:`, possiblePaths);
  return null;
}

/**
 * Envía una imagen de asset con manejo de errores
 * @param ctx - MessageContext
 * @param filename - Nombre del archivo
 * @param errorMessage - Mensaje de error personalizado
 * @returns Promise<boolean> - true si se envió correctamente, false si falló
 */
export async function sendAssetImage(
  ctx: MessageContext,
  filename: string,
  errorMessage: string = '❌ No se encontró la imagen solicitada.',
): Promise<boolean> {
  try {
    const imageBuffer = findAssetFile(filename);

    if (!imageBuffer) {
      await ctx.reply(errorMessage);
      return false;
    }

    await ctx.sock.sendMessage(ctx.chat.jid, { image: imageBuffer }, { quoted: ctx.message });
    return true;
  } catch (error) {
    console.error(`Error sending asset image ${filename}:`, error);
    await ctx.reply('❌ Error al enviar la imagen.');
    return false;
  }
}
