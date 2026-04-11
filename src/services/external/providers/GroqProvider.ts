import Groq from 'groq-sdk';
import type { AIMessage, AIProvider, AIResponse } from './AIProvider.js';
import { left, right } from '@/utils/either.js';
import { logger } from '@/utils/logger.js';

export class GroqProvider implements AIProvider {
  name = 'Groq';
  priority = 1;
  private client: Groq;

  constructor(apiKey: string) {
    this.client = new Groq({ apiKey });
  }

  async isAvailable(): Promise<boolean> {
    try {
      return !!this.client;
    } catch {
      return false;
    }
  }

  async chat(messages: AIMessage[]): Promise<AIResponse> {
    try {
      const completion = await this.client.chat.completions.create({
        model: 'llama-3.3-70b-versatile',
        messages,
        max_tokens: 1024,
        temperature: 0.7,
      });

      const text = completion.choices[0]?.message?.content?.trim() ?? '';
      return right({ text });
    } catch (error) {
      const err = error as { message?: string; status?: number };
      logger.error('[GroqProvider] Error:', err.message);
      return left({ message: err.message || 'Groq error' });
    }
  }

  async chatFast(messages: AIMessage[]): Promise<AIResponse> {
    try {
      const completion = await this.client.chat.completions.create({
        model: 'llama-3.1-8b-instant',
        messages,
        max_tokens: 512,
        temperature: 0.7,
      });

      const text = completion.choices[0]?.message?.content?.trim() ?? '';
      return right({ text });
    } catch (error) {
      const err = error as { message?: string; status?: number };
      logger.error('[GroqProvider] Fast error:', err.message);
      return left({ message: err.message || 'Groq error' });
    }
  }

  async transcribe(audioBuffer: Buffer, extension: string = 'ogg'): Promise<AIResponse> {
    try {
      const fs = await import('fs');
      const path = await import('path');
      const os = await import('os');
      const tmpDir = os.tmpdir();
      const tmpPath = path.join(tmpDir, `voice_${Date.now()}.${extension}`);

      fs.writeFileSync(tmpPath, audioBuffer);

      const transcription = await this.client.audio.transcriptions.create({
        file: fs.createReadStream(tmpPath),
        model: 'whisper-large-v3-turbo',
        response_format: 'text',
      });

      fs.unlinkSync(tmpPath);

      return right({ text: String(transcription).trim() });
    } catch (error) {
      const err = error as { message?: string };
      logger.error('[GroqProvider] Transcribe error:', err.message);
      return left({ message: err.message || 'Transcription error' });
    }
  }
}
