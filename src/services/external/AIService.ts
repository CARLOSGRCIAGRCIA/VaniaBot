/**
 * @fileoverview AI Service for VaniaBot — powered by Groq SDK.
 *
 * Handles conversational AI with per-user session history,
 * one-shot text generation, and audio transcription.
 *
 * @module AIService
 * @author Carlos Garcia
 * @see {@link https://github.com/CARLOSGRCIAGRCIA} GitHub
 * @see {@link https://www.tiktok.com/@carlos.grcia0} TikTok
 */

import Groq from 'groq-sdk';
import { env } from '@/config/env.js';
import fs from 'fs';
import path from 'path';

/**
 * Represents a single message in an AI conversation.
 */
export interface AIMessage {
  /** The role of the message author. */
  role: 'user' | 'assistant' | 'system';
  content: string;
}

/**
 * Unified response object returned by all AI operations.
 */
export interface AIResponse {
  success: boolean;
  text?: string;
  error?: string;
}

/**
 * Represents an active conversation session scoped to a
 * (chat, sender) pair. Sessions expire after {@link SESSION_TTL_MS}
 * of inactivity and are cleaned up by an internal timer.
 */
export interface ConversationSession {
  chatJid: string;
  senderJid: string;
  history: AIMessage[];
  createdAt: number;
  lastActivity: number;
}

/**
 * Available Groq model identifiers used by the service.
 *
 * - `chat` — Full-size model for deep reasoning and longer responses.
 * - `fast` — Lightweight model for quick, low-latency replies.
 * - `transcribe` — Whisper model for audio-to-text transcription.
 */
export const GROQ_MODELS = {
  chat: 'llama-3.3-70b-versatile',
  fast: 'llama-3.1-8b-instant',
  transcribe: 'whisper-large-v3-turbo',
} as const;

/** Maximum number of messages retained per session history. */
const MAX_HISTORY_MESSAGES = 20;

/** Session inactivity TTL — 30 minutes. */
const SESSION_TTL_MS = 30 * 60 * 1000;

/** How often the cleanup sweep runs — every 5 minutes. */
const CLEANUP_INTERVAL_MS = 5 * 60 * 1000;

/** Temporary directory for audio files before transcription. */
const TEMP_DIR = './data/temp/audio';

/**
 * System prompt that defines VaniaBot's personality and response format.
 * Injected as the first message in every chat completion request.
 */
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

interface GroqError {
  message?: string;
  status?: number;
  error?: {
    message?: string;
    code?: string;
  };
}

/**
 * Singleton service that manages all AI interactions for VaniaBot.
 *
 * Responsibilities:
 * - Maintaining per-user conversation sessions with automatic expiry.
 * - Sending chat completions to Groq with full conversation history.
 * - Generating one-shot responses without session context.
 * - Transcribing WhatsApp voice notes via Whisper.
 *
 * @example
 * ```ts
 * // Chat with history
 * const response = await aiService.chat(chatJid, senderJid, "Hola!");
 * if (response.success) console.log(response.text);
 *
 * // Transcribe a voice note buffer
 * const transcription = await aiService.transcribeAudio(buffer, "ogg");
 * ```
 *
 * @author Carlos Garcia
 * @see {@link https://github.com/CARLOSGRCIAGRCIA} GitHub
 * @see {@link https://www.tiktok.com/@carlos.grcia0} TikTok
 */
export class AIService {
  /** Groq SDK client instance. */
  private client: Groq;

  /**
   * In-memory session store.
   * Key format: `"chatJid::senderJid"`
   */
  private sessions: Map<string, ConversationSession> = new Map();

  /** Reference to the session cleanup interval timer. */
  private cleanupTimer: NodeJS.Timeout;

  /**
   * Creates and initializes the AIService.
   *
   * @throws {Error} If `GROQ_API_KEY` is not set in the environment.
   */
  constructor() {
    if (!env.GROQ_API_KEY) {
      throw new Error(
        'GROQ_API_KEY no está configurada en el .env\n' +
          'Obtén tu key gratis en: https://console.groq.com/keys',
      );
    }

    this.client = new Groq({ apiKey: env.GROQ_API_KEY });

    if (!fs.existsSync(TEMP_DIR)) {
      fs.mkdirSync(TEMP_DIR, { recursive: true });
    }

    this.cleanupTimer = setInterval(() => this.cleanupExpiredSessions(), CLEANUP_INTERVAL_MS);
    this.cleanupTimer.unref();

    console.log(`[AI] AIService iniciado con Groq`);
    console.log(`   Chat:   ${GROQ_MODELS.chat}`);
    console.log(`   Fast:   ${GROQ_MODELS.fast}`);
    console.log(`   Voice:  ${GROQ_MODELS.transcribe}`);
  }

  /**
   * Builds the internal map key for a (chat, sender) pair.
   *
   * @param chatJid - WhatsApp JID of the chat.
   * @param senderJid - WhatsApp JID of the sender.
   * @returns Composite string key used in {@link sessions}.
   */
  private sessionKey(chatJid: string, senderJid: string): string {
    return `${chatJid}::${senderJid}`;
  }

  /**
   * Retrieves an existing session or creates a new one if none exists.
   *
   * @param chatJid - WhatsApp JID of the chat.
   * @param senderJid - WhatsApp JID of the sender.
   * @returns The active {@link ConversationSession} for this pair.
   */
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

  /**
   * Deletes the conversation history for a specific (chat, sender) pair.
   * Typically triggered by the `!aiclear` command.
   *
   * @param chatJid - WhatsApp JID of the chat.
   * @param senderJid - WhatsApp JID of the sender.
   */
  clearSession(chatJid: string, senderJid: string): void {
    this.sessions.delete(this.sessionKey(chatJid, senderJid));
  }

  /**
   * Deletes all sessions belonging to a specific group chat.
   * Useful when the bot leaves a group or an admin resets the AI.
   *
   * @param chatJid - WhatsApp JID of the group.
   */
  clearGroupSessions(chatJid: string): void {
    for (const key of this.sessions.keys()) {
      if (key.startsWith(`${chatJid}::`)) this.sessions.delete(key);
    }
  }

  /**
   * Returns the total number of active sessions currently in memory.
   *
   * @returns Count of stored {@link ConversationSession} entries.
   */
  getSessionCount(): number {
    return this.sessions.size;
  }

  /**
   * Iterates all sessions and removes those that have exceeded
   * the inactivity TTL ({@link SESSION_TTL_MS}).
   * Called automatically on the {@link cleanupTimer} interval.
   */
  private cleanupExpiredSessions(): void {
    const now = Date.now();
    let cleaned = 0;
    for (const [key, session] of this.sessions.entries()) {
      if (now - session.lastActivity > SESSION_TTL_MS) {
        this.sessions.delete(key);
        cleaned++;
      }
    }
    if (cleaned > 0) console.log(`[AI] ${cleaned} sesiones expiradas eliminadas`);
  }

  /**
   * Sends a user message to the AI and returns a response,
   * maintaining full conversation history for the session.
   *
   * History is automatically trimmed to the last {@link MAX_HISTORY_MESSAGES}
   * entries to stay within token limits.
   *
   * @param chatJid - WhatsApp JID of the chat (used for session scoping).
   * @param senderJid - WhatsApp JID of the sender (used for session scoping).
   * @param userMessage - The user's input text.
   * @param fast - If `true`, uses the faster {@link GROQ_MODELS.fast} model
   *               instead of the default {@link GROQ_MODELS.chat}. Defaults to `false`.
   * @returns A promise resolving to an {@link AIResponse}.
   *
   * @example
   * ```ts
   * const res = await aiService.chat(chatJid, senderJid, "¿Qué es TypeScript?");
   * if (res.success) await ctx.reply(res.text!);
   * ```
   */
  async chat(
    chatJid: string,
    senderJid: string,
    userMessage: string,
    fast = false,
  ): Promise<AIResponse> {
    const session = this.getSession(chatJid, senderJid);
    session.lastActivity = Date.now();

    const messages: AIMessage[] = [
      { role: 'system', content: SYSTEM_PROMPT },
      ...session.history,
      { role: 'user', content: userMessage },
    ];

    try {
      const completion = await this.client.chat.completions.create({
        model: fast ? GROQ_MODELS.fast : GROQ_MODELS.chat,
        messages,
        max_tokens: 1024,
        temperature: 0.7,
      });

      const text = completion.choices[0]?.message?.content?.trim() ?? '';

      session.history.push(
        { role: 'user', content: userMessage },
        { role: 'assistant', content: text },
      );

      if (session.history.length > MAX_HISTORY_MESSAGES) {
        session.history = session.history.slice(-MAX_HISTORY_MESSAGES);
      }

      return { success: true, text };
    } catch (error) {
      const groqError = error as GroqError;
      console.error('❌ [AI] chat error:', groqError.message);
      return { success: false, error: this.friendlyError(groqError) };
    }
  }

  /**
   * Generates a one-shot AI response without session context.
   * Useful for internal bot operations that need AI output
   * but don't belong to a user conversation.
   *
   * @param prompt - The input prompt to send to the model.
   * @param maxTokens - Maximum tokens in the response. Defaults to `512`.
   * @returns A promise resolving to an {@link AIResponse}.
   *
   * @example
   * ```ts
   * const res = await aiService.generate("Resume este texto: ...", 256);
   * ```
   */
  async generate(prompt: string, maxTokens = 512): Promise<AIResponse> {
    try {
      const completion = await this.client.chat.completions.create({
        model: GROQ_MODELS.chat,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: prompt },
        ],
        max_tokens: maxTokens,
        temperature: 0.7,
      });

      const text = completion.choices[0]?.message?.content?.trim() ?? '';
      return { success: true, text };
    } catch (error) {
      const groqError = error as GroqError;
      console.error('❌ [AI] generate error:', groqError.message);
      return { success: false, error: this.friendlyError(groqError) };
    }
  }

  /**
   * Transcribes a WhatsApp voice note buffer to plain text using Whisper.
   *
   * The audio buffer is written to a temporary file under {@link TEMP_DIR},
   * sent to the Groq transcription API, and the temp file is deleted
   * immediately after regardless of success or failure.
   *
   * @param audioBuffer - Raw audio data as a Node.js `Buffer`.
   * @param extension - File extension indicating the audio format (e.g. `"ogg"`, `"mp3"`).
   *                    Defaults to `"ogg"` (WhatsApp voice note format).
   * @param language - Optional BCP-47 language hint (e.g. `"es"`, `"en"`) to
   *                   improve transcription accuracy. Auto-detected if omitted.
   * @returns A promise resolving to an {@link AIResponse} with the transcribed text.
   *
   * @example
   * ```ts
   * const buffer = await downloadMediaMessage(msg, "buffer", {});
   * const res = await aiService.transcribeAudio(buffer as Buffer, "ogg", "es");
   * if (res.success) await ctx.reply(`📝 ${res.text}`);
   * ```
   */
  async transcribeAudio(
    audioBuffer: Buffer,
    extension: string = 'ogg',
    language?: string,
  ): Promise<AIResponse> {
    const tmpPath = path.join(TEMP_DIR, `voice_${Date.now()}.${extension}`);

    try {
      fs.writeFileSync(tmpPath, audioBuffer);

      const transcription = await this.client.audio.transcriptions.create({
        file: fs.createReadStream(tmpPath),
        model: GROQ_MODELS.transcribe,
        ...(language ? { language } : {}),
        response_format: 'text',
      });

      return { success: true, text: String(transcription).trim() };
    } catch (error) {
      const groqError = error as GroqError;
      console.error('❌ [AI] transcribeAudio error:', groqError.message);
      return { success: false, error: this.friendlyError(groqError) };
    } finally {
      try {
        fs.unlinkSync(tmpPath);
      } catch {
        // Ignorar errores de limpieza
      }
    }
  }

  /**
   * Maps Groq API errors to human-readable Spanish messages
   * suitable for sending directly to WhatsApp users.
   *
   * @param error - The raw error thrown by the Groq SDK or fetch layer.
   * @returns A user-friendly error string.
   */
  private friendlyError(error: GroqError): string {
    const msg: string = error?.message ?? '';
    const status: number = error?.status ?? 0;

    if (status === 401 || msg.includes('401'))
      return 'API key inválida. Revisa GROQ_API_KEY en .env';
    if (status === 429 || msg.includes('rate_limit'))
      return 'Límite de uso alcanzado. Intenta en unos segundos.';
    if (status === 503 || msg.includes('503'))
      return 'Groq no disponible temporalmente. Intenta de nuevo.';
    if (msg.includes('model')) return 'Modelo no disponible.';

    return msg || 'Error desconocido';
  }
}

/**
 * Shared singleton instance of {@link AIService}.
 * Import this directly instead of instantiating a new service.
 *
 * @example
 * ```ts
 * import { aiService } from "@/services/external/AIService.js";
 * const response = await aiService.chat(chatJid, senderJid, "Hola");
 * ```
 */
export const aiService = new AIService();
