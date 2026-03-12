import { aiService } from "@/services/external/AIService.js";

export async function handleMention(
  ctx: any,
  botJid: string,
): Promise<boolean> {
  const rawText: string = ctx.text ?? "";
  const textLower: string = rawText.toLowerCase().trim();
  const message = ctx.message.message;

  const mentionedJids: string[] =
    message?.extendedTextMessage?.contextInfo?.mentionedJid ?? [];

  const botLid: string | undefined = (ctx.sock ?? ctx._sock)?.user?.lid;
  const botNumber = botJid.split("@")[0].split(":")[0];

  const mentionedByJid = mentionedJids.some((jid: string) => {
    const jidClean = jid.split("@")[0].split(":")[0];
    if (jidClean === botNumber) return true;
    if (botLid) {
      const lidClean = botLid.split("@")[0].split(":")[0];
      if (jidClean === lidClean) return true;
    }
    return false;
  });

  const mentionedByText =
    textLower.includes("@vania") || /\bvania\b/.test(textLower);
  const isPureMention =
    mentionedJids.length === 1 && /^@\d+$/.test(rawText.trim());

  const botMentioned = mentionedByJid || mentionedByText || isPureMention;

  if (!botMentioned) return false;

  const cleanText = rawText
    .replace(/@\d+/g, "")
    .replace(/@vania/gi, "")
    .replace(/\bvania\b/gi, "")
    .replace(/[,:\s]+$/, "")
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
