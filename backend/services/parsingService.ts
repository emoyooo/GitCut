import fs from "fs/promises";
import path from "path";
import { CodeChunk } from "../types/index.ts";

export class ParsingService {
  private static IGNORE_DIRS = new Set([
    "node_modules",
    ".git",
    "dist",
    "build",
    "coverage",
    ".next",
    ".vscode",
  ]);
  private static ALLOWED_EXTENSIONS = new Set([
    ".ts",
    ".tsx",
    ".js",
    ".jsx",
    ".py",
    ".go",
    ".rs",
    ".java",
    ".cpp",
    ".h",
    ".c",
    ".sql",
    ".md",
  ]);

  async getFileList(repoPath: string): Promise<string[]> {
    const files: string[] = [];
    await this.walk(repoPath, async (filePath) => {
      files.push(path.relative(repoPath, filePath));
    });
    return files;
  }

  async walkAndParse(repoPath: string, repoId: string, filterPaths?: string[]): Promise<Omit<CodeChunk, "id">[]> {
    const chunks: Omit<CodeChunk, "id">[] = [];
    const filterSet = filterPaths ? new Set(filterPaths) : null;

    await this.walk(repoPath, async (filePath) => {
      const relativePath = path.relative(repoPath, filePath);
      
      // If filtering is active, only proceed if the file itself or any of its parent directories are in the selection
      if (filterSet) {
        let isSelected = false;
        // Check if the file itself is selected
        if (filterSet.has(relativePath)) {
          isSelected = true;
        } else {
          // Check if any parent directory is selected
          const parts = relativePath.split("/");
          let currentPath = "";
          for (let i = 0; i < parts.length - 1; i++) {
            currentPath = currentPath ? `${currentPath}/${parts[i]}` : parts[i];
            if (filterSet.has(currentPath)) {
              isSelected = true;
              break;
            }
          }
        }
        if (!isSelected) return;
      }

      const content = await fs.readFile(filePath, "utf-8");
      const fileChunks = this.chunkFile(content, relativePath, repoId);
      chunks.push(...fileChunks);
    });
    return chunks;
  }

  private async walk(dir: string, callback: (filePath: string) => Promise<void>): Promise<void> {
    const files = await fs.readdir(dir, { withFileTypes: true });
    for (const file of files) {
      const res = path.resolve(dir, file.name);
      if (file.isDirectory()) {
        if (!ParsingService.IGNORE_DIRS.has(file.name)) {
          await this.walk(res, callback);
        }
      } else {
        if (ParsingService.ALLOWED_EXTENSIONS.has(path.extname(file.name))) {
          await callback(res);
        }
      }
    }
  }

  private chunkFile(content: string, filePath: string, repoId: string): Omit<CodeChunk, "id">[] {
    const lines = content.split("\n");
    const maxChars = 6000; // Very safe margin for tokens (approx 1500-2000 tokens)
    const fileChunks: Omit<CodeChunk, "id">[] = [];

    let currentChunkLines: string[] = [];
    let currentChars = 0;
    let startLine = 1;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      // Hard truncate extremely long lines to prevent single-line chunks from exceeding limits
      const safeLine = line.length > maxChars ? line.substring(0, maxChars) + "..." : line;

      if (currentChars + safeLine.length > maxChars && currentChunkLines.length > 0) {
        // Save current chunk
        const chunkContent = `File: ${filePath}\n\n${currentChunkLines.join("\n")}`;
        fileChunks.push({
          repoId,
          filePath,
          content: chunkContent,
          startLine,
          endLine: i,
          metadata: { extension: path.extname(filePath) },
        });

        // Start new chunk with overlap (last 5 lines if possible)
        const overlapCount = Math.min(5, currentChunkLines.length);
        currentChunkLines = currentChunkLines.slice(-overlapCount);
        currentChars = currentChunkLines.join("\n").length;
        startLine = i - overlapCount + 1;
      }

      currentChunkLines.push(safeLine);
      currentChars += safeLine.length + 1; // +1 for newline
    }

    // Add last chunk
    if (currentChunkLines.length > 0) {
      const chunkContent = `File: ${filePath}\n\n${currentChunkLines.join("\n")}`;
      fileChunks.push({
        repoId,
        filePath,
        content: chunkContent,
        startLine,
        endLine: lines.length,
        metadata: { extension: path.extname(filePath) },
      });
    }

    return fileChunks;
  }
}
