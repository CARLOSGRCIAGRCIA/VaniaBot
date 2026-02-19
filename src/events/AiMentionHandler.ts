import { aiService } from "@/services/external/AIService.js";

export async function handleMention(
  ctx: any,
  botJid: string,
): Promise<boolean> {
  const text: string = ctx.text?.toLowerCase() ?? "";
  const message = ctx.message.message;

  const mentionedJids: string[] =
    message?.extendedTextMessage?.contextInfo?.mentionedJid ?? [];

  const botNumber = botJid.split("@")[0].split(":")[0];

  const botMentioned =
    mentionedJids.some((jid: string) => jid.startsWith(botNumber)) ||
    text.includes("@vania") ||
    text.includes("vania,") ||
    /^vania\s/.test(text);

  if (!botMentioned) return false;

  const cleanText = ctx.text
    .replace(/@\d+/g, "")
    .replace(/@vania/gi, "")
    .replace(/^vania[,\s]*/i, "")
    .trim();

  if (!cleanText) {
    await ctx.reply(
      `¿Me llamaste? 👀 Dime qué necesitas o usa *!ai <mensaje>* para chatear.`,
    );
    return true;
  }

  await ctx.react("🤔");

  const response = await aiService.chat(
    ctx.chat.jid,
    ctx.sender.jid,
    cleanText,
  );

  if (!response.success) {
    await ctx.react("❌");
    await ctx.reply(`❌ ${response.error}`);
    return true;
  }

  await ctx.react("✅");
  await ctx.reply(response.text!);

  return true;
}
