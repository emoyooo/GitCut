export interface Repository {
  id: string;
  githubUrl: string;
  name: string;
  branch?: string;
  lastIndexedAt: string;
}

export interface CodeChunk {
  id: string;
  repoId: string;
  filePath: string;
  content: string;
  startLine: number;
  endLine: number;
  embedding?: number[];
  metadata: Record<string, any>;
}

export interface SearchResult {
  id: string;
  content: string;
  filePath: string;
  similarity: number;
}
