import OpenAI from "openai";
import { LLMMessage, LLMOptions, LLMProvider } from "./LLMProvider.ts";

export class OpenAIProvider implements LLMProvider {
  name = "OpenAI";
  private client: OpenAI;

  constructor(apiKey: string) {
    if (!apiKey) {
      throw new Error("OpenAI API Key is required");
    }
    this.client = new OpenAI({ apiKey });
  }

  async generate(messages: LLMMessage[], options?: LLMOptions): Promise<string> {
    const response = await this.client.chat.completions.create({
      model: options?.model || "gpt-4o",
      messages,
      temperature: options?.temperature ?? 0.7,
      max_tokens: options?.maxTokens,
    });

    return response.choices[0].message.content || "";
  }

  async *stream(messages: LLMMessage[], options?: LLMOptions): AsyncGenerator<string> {
    const stream = await this.client.chat.completions.create({
      model: options?.model || "gpt-4o",
      messages,
      temperature: options?.temperature ?? 0.7,
      max_tokens: options?.maxTokens,
      stream: true,
    });

    for await (const chunk of stream) {
      const content = chunk.choices[0]?.delta?.content || "";
      if (content) {
        yield content;
      }
    }
  }
}
