import { simpleGit, SimpleGit } from "simple-git";
import path from "path";
import fs from "fs/promises";
import os from "os";

export class GithubService {
  private git: SimpleGit;

  constructor() {
    this.git = simpleGit();
  }

  async cloneRepo(githubUrl: string): Promise<string> {
    const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "repo-mentor-"));
    await this.git.clone(githubUrl, tmpDir, ["--depth", "1"]);
    return tmpDir;
  }

  async cleanup(path: string): Promise<void> {
    await fs.rm(path, { recursive: true, force: true });
  }
}
