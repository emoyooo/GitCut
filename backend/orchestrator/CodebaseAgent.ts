import { LLMMessage, LLMProvider } from "../ai/LLMProvider.ts";
import { VectorStoreService } from "../services/vectorStoreService.ts";
import { EmbeddingService } from "../services/embeddingService.ts";

export class CodebaseAgent {
  constructor(
    private llm: LLMProvider,
    private vectorStore: VectorStoreService,
    private embeddingService: EmbeddingService
  ) {}

  async *ask(repoId: string, question: string, filePaths?: string[], selection?: string[]): AsyncGenerator<string> {
    // 1. Search for relevant context
    // We use filePaths for surgical search if provided
    const searchLimit = filePaths && filePaths.length > 0 ? 15 : 10;
    const questionEmbedding = await this.embeddingService.generateEmbedding(question);
    const relevantChunks = await this.vectorStore.searchChunks(repoId, questionEmbedding, searchLimit, filePaths);

    // 2. Build context
    const context = relevantChunks
      .map((c) => `--- FILE: ${c.filePath} (Lines ${c.startLine}-${c.endLine}) ---\n${c.content}`)
      .join("\n\n");

    const selectionNotice = selection && selection.length > 0
      ? `\nNOTE: The user has explicitly selected the following scope for this query: ${selection.join(", ")}. 
Focus your analysis primarily on these files and how they interact.`
      : (filePaths && filePaths.length > 0 ? `\nNOTE: The user has scoped this query to ${filePaths.length} specific files.` : "");

    const systemPrompt = `You are a world-class Senior Software Architect and Codebase Mentor.
Your task is to analyze the provided code context and provide a deep, technical, yet accessible explanation to the user.
${selectionNotice}

Key Instructions:
1. Use the provided context to answer. If specific logic flow is requested, trace it through the files provided.
2. If context snippets are provided, they are the most relevant parts of the code found based on the user's question and selection.
3. Be proactive. If the user's selected scope doesn't contain the full answer, explain what YOU CAN see and infer what might be missing.
4. Always mention the exact file names you are referencing.
5. If you see potential bugs or architectural weaknesses in the context, point them out politely.

CONTEXT FROM REPOSITORY:
${context || "No specific code chunks found. Provide a general high-level answer if possible, but clarify that specific code was not retrieved."}`;

    const messages: LLMMessage[] = [
      { role: "system", content: systemPrompt },
      { role: "user", content: question },
    ];

    // 3. Stream response
    for await (const chunk of this.llm.stream(messages)) {
      yield chunk;
    }
  }
}
