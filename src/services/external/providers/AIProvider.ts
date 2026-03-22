export interface AIMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export interface AIResponse {
  success: boolean;
  text?: string;
  error?: string;
}

export interface AIProvider {
  name: string;
  priority: number;
  isAvailable(): Promise<boolean>;
  chat(messages: AIMessage[]): Promise<AIResponse>;
  chatFast?(messages: AIMessage[]): Promise<AIResponse>;
  transcribe?(audioBuffer: Buffer, extension?: string): Promise<AIResponse>;
}
