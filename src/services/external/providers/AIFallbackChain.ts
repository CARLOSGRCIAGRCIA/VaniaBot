import type { AIMessage, AIProvider, AIResponse } from './AIProvider.js';
import { isRight, left } from '@/utils/either.js';
import { GroqProvider } from './GroqProvider.js';
import { GeminiProvider } from './GeminiProvider.js';
import { OllamaProvider } from './OllamaProvider.js';
import { env } from '@/config/env.js';
import { logger } from '@/utils/logger.js';

export class AIFallbackChain {
  private providers: AIProvider[] = [];

  constructor() {
    this.initializeProviders();
  }

  private initializeProviders(): void {
    if (env.GROQ_API_KEY) {
      this.providers.push(new GroqProvider(env.GROQ_API_KEY));
      logger.info('[AI Chain] Groq provider registered');
    }

    const geminiKey = process.env.GEMINI_API_KEY;
    if (geminiKey) {
      this.providers.push(new GeminiProvider(geminiKey));
      logger.info('[AI Chain] Gemini provider registered');
    }

    this.providers.push(new OllamaProvider());
    logger.info('[AI Chain] Ollama provider registered (fallback)');

    this.providers.sort((a, b) => a.priority - b.priority);
    logger.info(`[AI Chain] Chain initialized with ${this.providers.length} providers`);
  }

  async chat(messages: AIMessage[], useFast = false): Promise<AIResponse> {
    for (const provider of this.providers) {
      if (!(await provider.isAvailable())) {
        logger.debug(`[AI Chain] ${provider.name} not available, trying next...`);
        continue;
      }

      try {
        logger.debug(`[AI Chain] Using ${provider.name}`);
        let result: AIResponse;

        if (useFast && 'chatFast' in provider && provider.chatFast) {
          result = await provider.chatFast(messages);
        } else {
          result = await provider.chat(messages);
        }

        if (isRight(result)) {
          logger.debug(`[AI Chain] ${provider.name} succeeded`);
          return result;
        }

        logger.warn(`[AI Chain] ${provider.name} failed: ${result.left.message}`);
      } catch (error) {
        const err = error as Error;
        logger.warn(`[AI Chain] ${provider.name} error: ${err.message}`);
      }
    }

    return left({ message: 'All AI providers failed. Please try again later.' });
  }

  async transcribe(audioBuffer: Buffer, extension: string = 'ogg'): Promise<AIResponse> {
    const groqProvider = this.providers.find(p => p.name === 'Groq') as GroqProvider | undefined;

    if (groqProvider && (await groqProvider.isAvailable())) {
      try {
        return await groqProvider.transcribe(audioBuffer, extension);
      } catch (error) {
        const err = error as Error;
        logger.error('[AI Chain] Transcription error:', err.message);
      }
    }

    return left({ message: 'Transcription service unavailable.' });
  }

  getProviders(): string[] {
    return this.providers.map(p => p.name);
  }

  async getProviderStatus(): Promise<Array<{ name: string; available: boolean }>> {
    const status: Array<{ name: string; available: boolean }> = [];

    for (const provider of this.providers) {
      const available = await provider.isAvailable();
      status.push({ name: provider.name, available });
    }

    return status;
  }
}

export const aiFallbackChain = new AIFallbackChain();
