import type { Either } from '@/utils/either.js';

export interface AIMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export interface AIResponseSuccess {
  text: string;
}

export type AIResponseError = { message: string };
export type AIResponse = Either<AIResponseError, AIResponseSuccess>;

export interface AIProvider {
  name: string;
  priority: number;
  isAvailable(): Promise<boolean>;
  chat(messages: AIMessage[]): Promise<AIResponse>;
  chatFast?(messages: AIMessage[]): Promise<AIResponse>;
  transcribe?(audioBuffer: Buffer, extension?: string): Promise<AIResponse>;
}
