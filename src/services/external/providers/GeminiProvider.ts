import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } from '@google/generative-ai';
import type { AIMessage, AIProvider, AIResponse } from './AIProvider.js';
import { left, right } from '@/utils/either.js';
import { logger } from '@/utils/logger.js';

export class GeminiProvider implements AIProvider {
  name = 'Gemini';
  priority = 2;
  private client: GoogleGenerativeAI | null = null;
  private apiKey: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
    if (apiKey) {
      this.client = new GoogleGenerativeAI(apiKey);
    }
  }

  async isAvailable(): Promise<boolean> {
    return this.client !== null && !!this.apiKey;
  }

  async chat(messages: AIMessage[]): Promise<AIResponse> {
    if (!this.client) {
      return left({ message: 'Gemini not configured' });
    }

    try {
      const model = this.client.getGenerativeModel({
        model: 'gemini-1.5-flash',
        safetySettings: [
          {
            category: HarmCategory.HARM_CATEGORY_HARASSMENT,
            threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
          },
          {
            category: HarmCategory.HARM_CATEGORY_HATE_SPEECH,
            threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
          },
          {
            category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT,
            threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
          },
          {
            category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
            threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
          },
        ],
      });

      const systemMessage = messages.find(m => m.role === 'system');
      const conversationMessages = messages.filter(m => m.role !== 'system');

      const contents = conversationMessages.map(m => ({
        role: m.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: m.content }],
      }));

      const result = await model.generateContent({
        contents,
        systemInstruction: systemMessage ? systemMessage.content : undefined,
      });

      const response = result.response;
      const text = response.text();

      return right({ text: text.trim() });
    } catch (error) {
      const err = error as { message?: string };
      logger.error('[GeminiProvider] Error:', err.message);
      return left({ message: err.message || 'Gemini error' });
    }
  }

  async chatFast(messages: AIMessage[]): Promise<AIResponse> {
    return this.chat(messages);
  }
}
