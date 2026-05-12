import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

import { indexRepo, chat, getRepoFiles, getRepoStructure } from "./backend/controllers/apiController.ts";

async function startServer() {
  console.log("Starting server function...");
  const app = express();
  const PORT = 3000;

  // Simple health check for the platform proxy
  app.get("/health", (req, res) => res.status(200).send("OK"));
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok", message: "AI Codebase Mentor API is active" });
  });

  app.use(express.json());

  // API Routes
  console.log("Setting up API routes...");

  app.post("/api/index-repo", indexRepo);
  app.post("/api/chat", chat);
  app.post("/api/repo-structure", getRepoStructure);
  app.get("/api/files/:repoId", getRepoFiles);

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });

  console.log("Checking environment...");
  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    console.log("Development mode detected. Initializing Vite...");
    try {
      const vite = await createViteServer({
        server: { middlewareMode: true },
        appType: "spa",
      });
      console.log("Vite server created, mounting middleware...");
      app.use(vite.middlewares);
    } catch (viteError) {
      console.error("Vite failed to start:", viteError);
    }
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }
}

startServer().catch((err) => {
  console.error("Failed to start server:", err);
  process.exit(1);
});
