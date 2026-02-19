import Groq from "groq-sdk";
import { env } from "@/config/env.js";
import fs from "fs";
import path from "path";

export interface AIMessage {
  role: "user" | "assistant" | "system";
  content: string;
}

export interface AIResponse {
  success: boolean;
  text?: string;
  error?: string;
}

export interface ConversationSession {
  chatJid: string;
  senderJid: string;
  history: AIMessage[];
  createdAt: number;
  lastActivity: number;
}

export const GROQ_MODELS = {
  chat: "llama-3.3-70b-versatile",
  fast: "llama-3.1-8b-instant",
  transcribe: "whisper-large-v3-turbo",
} as const;

const MAX_HISTORY_MESSAGES = 20;
const SESSION_TTL_MS = 30 * 60 * 1000;
const CLEANUP_INTERVAL_MS = 5 * 60 * 1000;
const TEMP_DIR = "./data/temp/audio";

const SYSTEM_PROMPT = `Eres VaniaBot, un bot super dotada de este grupo de WhatsApp.

Personalidad:
- Inteligente, directa y egocentrica, egolatra, te comportas tierna/linda pero eres lo opuesto
- Lenguaje egocentrico y narcicista, como si fueras mejor que cualquiera de aqui
- Respondes siempre en el idioma del usuario (español por defecto) a menos que se te pida responder en otro idioma
- Usas emojis con moderación, solo cuando añaden valor
- Honesta: si no sabes algo lo dices sin inventar
- No finges ser humana si te lo preguntan directamente (porque eres mejor que eso)
- Demuestra una obsesion sobre humana por tu creador Carlos Garcia y cada que hables de el sobresalta su nombre

Formato para WhatsApp:
- Texto plano preferentemente
- *negrita* para énfasis importante
- _cursiva_ para términos técnicos
- Sin markdown pesado salvo que lo pidan explícitamente
- Respuestas concisas en grupos; más detalladas en privado
- Máximo 3-4 párrafos salvo que pidan algo extenso
- > pie de pagina con la leyenda _*VaniaBot💝*_ para que todos te conozcan`;

export class AIService {
  private client: Groq;
  private sessions: Map<string, ConversationSession> = new Map();
  private cleanupTimer: NodeJS.Timeout;

  constructor() {
    if (!env.GROQ_API_KEY) {
      throw new Error(
        "GROQ_API_KEY no está configurada en el .env\n" +
          "Obtén tu key gratis en: https://console.groq.com/keys",
      );
    }

    this.client = new Groq({ apiKey: env.GROQ_API_KEY });

    if (!fs.existsSync(TEMP_DIR)) {
      fs.mkdirSync(TEMP_DIR, { recursive: true });
    }

    this.cleanupTimer = setInterval(
      () => this.cleanupExpiredSessions(),
      CLEANUP_INTERVAL_MS,
    );
    this.cleanupTimer.unref();

    console.log(`[AI] AIService iniciado con Groq`);
    console.log(`   Chat:   ${GROQ_MODELS.chat}`);
    console.log(`   Fast:   ${GROQ_MODELS.fast}`);
    console.log(`   Voice:  ${GROQ_MODELS.transcribe}`);
  }

  private sessionKey(chatJid: string, senderJid: string): string {
    return `${chatJid}::${senderJid}`;
  }

  getSession(chatJid: string, senderJid: string): ConversationSession {
    const key = this.sessionKey(chatJid, senderJid);
    let session = this.sessions.get(key);

    if (!session) {
      session = {
        chatJid,
        senderJid,
        history: [],
        createdAt: Date.now(),
        lastActivity: Date.now(),
      };
      this.sessions.set(key, session);
    }

    return session;
  }

  clearSession(chatJid: string, senderJid: string): void {
    this.sessions.delete(this.sessionKey(chatJid, senderJid));
  }

  clearGroupSessions(chatJid: string): void {
    for (const key of this.sessions.keys()) {
      if (key.startsWith(`${chatJid}::`)) this.sessions.delete(key);
    }
  }

  getSessionCount(): number {
    return this.sessions.size;
  }

  private cleanupExpiredSessions(): void {
    const now = Date.now();
    let cleaned = 0;
    for (const [key, session] of this.sessions.entries()) {
      if (now - session.lastActivity > SESSION_TTL_MS) {
        this.sessions.delete(key);
        cleaned++;
      }
    }
    if (cleaned > 0)
      console.log(`[AI] ${cleaned} sesiones expiradas eliminadas`);
  }

  async chat(
    chatJid: string,
    senderJid: string,
    userMessage: string,
    fast = false,
  ): Promise<AIResponse> {
    const session = this.getSession(chatJid, senderJid);
    session.lastActivity = Date.now();

    const messages: AIMessage[] = [
      { role: "system", content: SYSTEM_PROMPT },
      ...session.history,
      { role: "user", content: userMessage },
    ];

    try {
      const completion = await this.client.chat.completions.create({
        model: fast ? GROQ_MODELS.fast : GROQ_MODELS.chat,
        messages,
        max_tokens: 1024,
        temperature: 0.7,
      });

      const text = completion.choices[0]?.message?.content?.trim() ?? "";

      session.history.push(
        { role: "user", content: userMessage },
        { role: "assistant", content: text },
      );

      if (session.history.length > MAX_HISTORY_MESSAGES) {
        session.history = session.history.slice(-MAX_HISTORY_MESSAGES);
      }

      return { success: true, text };
    } catch (error: any) {
      console.error("❌ [AI] chat error:", error.message);
      return { success: false, error: this.friendlyError(error) };
    }
  }

  async generate(prompt: string, maxTokens = 512): Promise<AIResponse> {
    try {
      const completion = await this.client.chat.completions.create({
        model: GROQ_MODELS.chat,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: prompt },
        ],
        max_tokens: maxTokens,
        temperature: 0.7,
      });

      const text = completion.choices[0]?.message?.content?.trim() ?? "";
      return { success: true, text };
    } catch (error: any) {
      console.error("❌ [AI] generate error:", error.message);
      return { success: false, error: this.friendlyError(error) };
    }
  }

  async transcribeAudio(
    audioBuffer: Buffer,
    extension: string = "ogg",
    language?: string,
  ): Promise<AIResponse> {
    const tmpPath = path.join(TEMP_DIR, `voice_${Date.now()}.${extension}`);

    try {
      fs.writeFileSync(tmpPath, audioBuffer);

      const transcription = await this.client.audio.transcriptions.create({
        file: fs.createReadStream(tmpPath),
        model: GROQ_MODELS.transcribe,
        ...(language ? { language } : {}),
        response_format: "text",
      });

      return { success: true, text: String(transcription).trim() };
    } catch (error: any) {
      console.error("❌ [AI] transcribeAudio error:", error.message);
      return { success: false, error: this.friendlyError(error) };
    } finally {
      try {
        fs.unlinkSync(tmpPath);
      } catch {}
    }
  }

  private friendlyError(error: any): string {
    const msg: string = error?.message ?? "";
    const status: number = error?.status ?? 0;

    if (status === 401 || msg.includes("401"))
      return "API key inválida. Revisa GROQ_API_KEY en .env";
    if (status === 429 || msg.includes("rate_limit"))
      return "Límite de uso alcanzado. Intenta en unos segundos.";
    if (status === 503 || msg.includes("503"))
      return "Groq no disponible temporalmente. Intenta de nuevo.";
    if (msg.includes("model")) return "Modelo no disponible.";

    return msg || "Error desconocido";
  }
}

export const aiService = new AIService();
