import type { AIMessage, AIProvider, AIResponse } from './AIProvider.js';
import { left, right } from '@/utils/either.js';
import { logger } from '@/utils/logger.js';

export class OllamaProvider implements AIProvider {
  name = 'Ollama';
  priority = 3;
  private baseUrl: string;

  constructor(baseUrl: string = 'http://localhost:11434') {
    this.baseUrl = baseUrl;
  }

  async isAvailable(): Promise<boolean> {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 3000);

      const response = await fetch(`${this.baseUrl}/api/tags`, {
        signal: controller.signal,
      });

      clearTimeout(timeout);
      return response.ok;
    } catch {
      return false;
    }
  }

  async chat(messages: AIMessage[]): Promise<AIResponse> {
    try {
      const systemMessage = messages.find(m => m.role === 'system');
      const conversationMessages = messages.filter(m => m.role !== 'system');

      const ollamaMessages = [
        ...(systemMessage ? [{ role: 'system', content: systemMessage.content }] : []),
        ...conversationMessages.map(m => ({ role: m.role, content: m.content })),
      ];

      const response = await fetch(`${this.baseUrl}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'llama3.2',
          messages: ollamaMessages,
          stream: false,
        }),
      });

      if (!response.ok) {
        throw new Error(`Ollama error: ${response.status}`);
      }

      const data = (await response.json()) as { message?: { content?: string } };
      const text = data.message?.content?.trim() || '';

      return right({ text });
    } catch (error) {
      const err = error as { message?: string };
      logger.error('[OllamaProvider] Error:', err.message);
      return left({ message: err.message || 'Ollama error' });
    }
  }

  async chatFast(messages: AIMessage[]): Promise<AIResponse> {
    return this.chat(messages);
  }
}
