import { Request, Response } from "express";
import { GithubService } from "../services/githubService.ts";
import { ParsingService } from "../services/parsingService.ts";
import { EmbeddingService } from "../services/embeddingService.ts";
import { VectorStoreService } from "../services/vectorStoreService.ts";
import { CodebaseAgent } from "../orchestrator/CodebaseAgent.ts";
import { OpenAIProvider } from "../ai/OpenAIProvider.ts";

const githubService = new GithubService();
const parsingService = new ParsingService();

const getServices = () => {
  const openAiKey = process.env.OPENAI_API_KEY;
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!openAiKey || !supabaseUrl || !supabaseKey) {
    throw new Error(
      `Missing required environment variables: ${
        !openAiKey ? "OPENAI_API_KEY " : ""
      }${!supabaseUrl ? "SUPABASE_URL " : ""}${
        !supabaseKey ? "SUPABASE_SERVICE_ROLE_KEY" : ""
      }`
    );
  }

  const es = new EmbeddingService(openAiKey);
  const vs = new VectorStoreService(supabaseUrl, supabaseKey);
  const provider = new OpenAIProvider(openAiKey);
  const codebaseAgent = new CodebaseAgent(provider, vs, es);

  return { githubService, parsingService, embeddingService: es, vectorStoreService: vs, agent: codebaseAgent };
};

export const getRepoStructure = async (req: Request, res: Response) => {
  try {
    const { githubUrl } = req.body;
    if (!githubUrl) return res.status(400).json({ error: "githubUrl is required" });

    console.log(`Fetching structure for ${githubUrl}...`);
    const repoPath = await githubService.cloneRepo(githubUrl);
    const files = await parsingService.getFileList(repoPath);
    await githubService.cleanup(repoPath);

    res.json({ files });
  } catch (error: any) {
    console.error("Structure fetch failed:", error);
    res.status(500).json({ error: error.message });
  }
};

export const indexRepo = async (req: Request, res: Response) => {
  try {
    const { githubUrl, selectedPaths } = req.body;
    if (!githubUrl) return res.status(400).json({ error: "githubUrl is required" });

    const { embeddingService, vectorStoreService } = getServices();

    // 1. Clone
    console.log(`Cloning ${githubUrl} for indexing...`);
    const repoPath = await githubService.cloneRepo(githubUrl);
    const repoName = githubUrl.split("/").pop() || "unknown-repo";

    // 2. Create entry in DB
    const repo = await vectorStoreService.createRepository({
      githubUrl,
      name: repoName,
      branch: "main",
    });

    // 3. Parse and chunk only selected paths
    console.log(`Parsing selected paths in ${repoPath}...`);
    const chunks = await parsingService.walkAndParse(repoPath, repo.id, selectedPaths);

    if (chunks.length === 0) {
      throw new Error("No files found to index in selected paths.");
    }

    // 4. Update embeddings
    console.log(`Embedding ${chunks.length} chunks...`);
    // Process in batches to avoid rate limits
    const batchSize = 25;
    for (let i = 0; i < chunks.length; i += batchSize) {
      const batch = chunks.slice(i, i + batchSize);
      const texts = batch.map((c) => c.content);
      
      // Log large chunks for visibility if they approach the limits
      texts.forEach((text, idx) => {
        if (text.length > 10000) {
          console.warn(`Large chunk detected in batch ${i/batchSize}: ${text.length} chars. File: ${batch[idx].filePath}`);
        }
      });

      const embeddings = await embeddingService.generateEmbeddings(texts);
      batch.forEach((chunk, idx) => {
        chunk.embedding = embeddings[idx];
      });
    }

    // 5. Store in vector DB
    console.log(`Storing ${chunks.length} chunks in vector database...`);
    await vectorStoreService.storeChunks(chunks);

    // 6. Cleanup
    await githubService.cleanup(repoPath);

    const files = await vectorStoreService.getFiles(repo.id);

    res.json({ message: "Indexing complete", repoId: repo.id, files });
  } catch (error: any) {
    console.error("Indexing failed:", error);
    const message = error instanceof Error 
      ? error.message 
      : (typeof error === 'object' ? JSON.stringify(error, Object.getOwnPropertyNames(error)) : String(error));
    res.status(500).json({ error: message });
  }
};

export const getRepoFiles = async (req: Request, res: Response) => {
  try {
    const { repoId } = req.params;
    const { vectorStoreService } = getServices();
    const files = await vectorStoreService.getFiles(repoId);
    res.json({ files });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const chat = async (req: Request, res: Response) => {
  try {
    const { question, repoId, selectedPaths } = req.body;
    if (!question || !repoId) {
      return res.status(400).json({ error: "question and repoId are required" });
    }

    const { agent } = getServices();

    // SSE headers
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");

    const stream = agent.ask(repoId, question, selectedPaths);

    for await (const chunk of stream) {
      res.write(`data: ${JSON.stringify({ content: chunk })}\n\n`);
    }

    res.write("data: [DONE]\n\n");
    res.end();
  } catch (error: any) {
    console.error("Chat failed:", error);
    const message = error instanceof Error 
      ? error.message 
      : (typeof error === 'object' ? JSON.stringify(error, Object.getOwnPropertyNames(error)) : String(error));
    res.write(`data: ${JSON.stringify({ error: message })}\n\n`);
    res.end();
  }
};
