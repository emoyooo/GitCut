export interface LLMMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface LLMOptions {
  temperature?: number;
  maxTokens?: number;
  stream?: boolean;
  model?: string;
}

export interface LLMProvider {
  name: string;
  generate(messages: LLMMessage[], options?: LLMOptions): Promise<string>;
  stream(messages: LLMMessage[], options?: LLMOptions): AsyncGenerator<string>;
}
