import OpenAI from "openai";

export class EmbeddingService {
  private client: OpenAI;

  constructor(apiKey: string) {
    this.client = new OpenAI({ apiKey });
  }

  private truncate(text: string): string {
    // 8192 tokens is roughly 32768 chars. Let's be very safe with 12,000.
    const maxChars = 12000;
    if (text.length > maxChars) {
      return text.substring(0, maxChars);
    }
    return text;
  }

  async generateEmbedding(text: string): Promise<number[]> {
    const response = await this.client.embeddings.create({
      model: "text-embedding-3-small",
      input: this.truncate(text.replace(/\n/g, " ")),
    });

    return response.data[0].embedding;
  }

  async generateEmbeddings(texts: string[]): Promise<number[][]> {
    const response = await this.client.embeddings.create({
      model: "text-embedding-3-small",
      input: texts.map((t) => this.truncate(t.replace(/\n/g, " "))),
    });

    return response.data.map((d) => d.embedding);
  }
}
