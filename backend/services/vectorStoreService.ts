import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { CodeChunk, Repository, SearchResult } from "../types/index.ts";

export class VectorStoreService {
  private client: SupabaseClient;

  constructor(url: string, key: string) {
    this.client = createClient(url, key);
  }

  async createRepository(repo: Omit<Repository, "id" | "lastIndexedAt">): Promise<Repository> {
    const { data, error } = await this.client
      .from("repositories")
      .upsert(
        { github_url: repo.githubUrl, name: repo.name, branch: repo.branch },
        { onConflict: "github_url" }
      )
      .select()
      .single();

    if (error) throw error;
    return data as Repository;
  }

  async storeChunks(chunks: Omit<CodeChunk, "id">[]): Promise<void> {
    const { error } = await this.client.from("code_chunks").insert(
      chunks.map((c) => ({
        repo_id: c.repoId,
        file_path: c.filePath,
        content: c.content,
        start_line: c.startLine,
        end_line: c.endLine,
        embedding: c.embedding,
        metadata: c.metadata,
      }))
    );

    if (error) throw error;
  }

  async searchChunks(repoId: string, embedding: number[], limit = 5, filePaths?: string[]): Promise<SearchResult[]> {
    try {
      const { data, error } = await this.client.rpc("match_code_chunks", {
        query_embedding: embedding,
        match_threshold: 0.3,
        match_count: limit,
        p_repo_id: repoId,
        p_file_paths: filePaths || null,
      });

      if (error) {
        // Fallback for older function signature if p_file_paths fails
        if (error.code === "PGRST202" || error.message.includes("p_file_paths")) {
          console.warn("Supabase function 'match_code_chunks' missing p_file_paths parameter. Falling back to manual filtering.");
          const { data: legacyData, error: legacyError } = await this.client.rpc("match_code_chunks", {
            query_embedding: embedding,
            match_threshold: 0.3,
            match_count: filePaths ? 50 : limit, // Get more if we need to filter
            p_repo_id: repoId,
          });

          if (legacyError) throw legacyError;
          
          let results = legacyData as SearchResult[];
          if (filePaths && filePaths.length > 0) {
            results = results.filter(r => filePaths.includes(r.filePath));
          }
          return results.slice(0, limit);
        }
        throw error;
      }
      return data as SearchResult[];
    } catch (e) {
      console.error("Vector search failed:", e);
      throw e;
    }
  }

  async getFiles(repoId: string): Promise<string[]> {
    const { data, error } = await this.client
      .from("code_chunks")
      .select("file_path")
      .eq("repo_id", repoId);

    if (error) throw error;
    const paths = data.map((d: any) => d.file_path);
    return [...new Set(paths)];
  }

  async getRepository(repoId: string): Promise<Repository | null> {
    const { data, error } = await this.client.from("repositories").select().eq("id", repoId).single();
    if (error) return null;
    return data as Repository;
  }
}
