import { useState } from "react";
import { Github, Send, Loader2, MessageSquare, Activity, Filter, ChevronRight, Code2 } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { useChat } from "./hooks/useChat.ts";
import { FileTree } from "./components/FileTree.tsx";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export default function App() {
  const [githubUrl, setGithubUrl] = useState("");
  const [repoId, setRepoId] = useState<string | null>(null);
  const [isIndexing, setIsIndexing] = useState(false);
  const [isTreeLoading, setIsTreeLoading] = useState(false);
  const [hasStructure, setHasStructure] = useState(false);
  const [files, setFiles] = useState<string[]>([]);
  const [selectedPaths, setSelectedPaths] = useState<string[]>([]);
  const [question, setQuestion] = useState("");
  const { messages, isLoading, sendMessage, setMessages } = useChat();

  const handleHome = () => {
    setRepoId(null);
    setHasStructure(false);
    setGithubUrl("");
    setFiles([]);
    setSelectedPaths([]);
    setMessages([]);
  };

  const fetchStructure = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!githubUrl) return;
    setIsTreeLoading(true);
    try {
      const res = await fetch("/api/repo-structure", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ githubUrl }),
      });
      const data = await res.json();
      if (data.files) {
        setFiles(data.files);
        setHasStructure(true);
      } else {
        alert(data.error || "Failed to fetch structure");
      }
    } catch (err) {
      alert("Connection error");
    } finally {
      setIsTreeLoading(false);
    }
  };

  const handleIndex = async () => {
    if (!githubUrl) return;
    setIsIndexing(true);
    try {
      const res = await fetch("/api/index-repo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ githubUrl, selectedPaths }),
      });
      const data = await res.json();
      if (data.repoId) {
        setRepoId(data.repoId);
        setFiles(data.files || []);
        setSelectedPaths([]); // Reset selection on new index
      } else {
        alert(data.error || "Indexing failed");
      }
    } catch (err) {
      alert("Failed to connect to backend");
    } finally {
      setIsIndexing(false);
    }
  };

  const handleTogglePath = (path: string) => {
    setSelectedPaths(prev => {
      // If it's a file, simple toggle
      const isFile = files.includes(path);
      
      if (isFile) {
        if (prev.includes(path)) {
          return prev.filter(p => p !== path);
        } else {
          return [...prev, path];
        }
      } else {
        // It's a folder (implied by not being in 'files' list which only has leaf nodes - actually files list has all indexed paths)
        // Let's assume files list contains all file paths.
        // For a folder, we find all files that start with this path.
        const childFiles = files.filter(f => f.startsWith(path + "/") || f === path);
        const allSelected = childFiles.every(f => prev.includes(f));

        if (allSelected) {
          // Deselect folder and all its files
          return prev.filter(p => !childFiles.includes(p) && p !== path);
        } else {
          // Select folder and all its files
          const newSelection = [...new Set([...prev, ...childFiles, path])];
          return newSelection;
        }
      }
    });
  };

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!question || !repoId || isLoading) return;
    
    // Expand folders to files for database search
    const expandedFiles = selectedPaths.length > 0 
      ? files.filter(f => selectedPaths.some(sp => f === sp || f.startsWith(sp + "/")))
      : undefined;

    sendMessage(question, repoId, expandedFiles, selectedPaths);
    setQuestion("");
  };

  return (
    <div className="flex flex-col h-screen bg-slate-50 text-slate-900 font-sans overflow-hidden">
      {/* Top Header */}
      <header className="h-14 shrink-0 bg-white border-b flex items-center px-6 z-50">
        <button 
          onClick={handleHome}
          className="flex items-center gap-2 group transition-all"
        >
          <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center text-white shadow-md shadow-indigo-100 group-hover:scale-105 transition-transform">
            <Code2 className="w-4 h-4" />
          </div>
          <span className="font-bold text-slate-900 tracking-tight group-hover:text-indigo-600 transition-colors">GitCut</span>
        </button>
      </header>

      <div className="flex flex-1 overflow-hidden">
        <AnimatePresence mode="wait">
          {!repoId ? (
            <motion.main
              key="landing"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="flex-1 flex flex-col items-center justify-center p-8 bg-white"
            >
              <div className="max-w-2xl w-full text-center space-y-12">
                <div className="space-y-4">
                  <h1 className="text-6xl font-extrabold tracking-tight text-slate-900">
                    Your codebase.<br/>
                    <span className="text-indigo-600">Perfectly explained.</span>
                  </h1>
                  <p className="text-xl text-slate-500 font-medium">
                    Connect your GitHub and chat an AI that actually understands your work.
                  </p>
                </div>

                {!hasStructure ? (
                  <form onSubmit={fetchStructure} className="relative max-w-xl mx-auto group">
                    <div className="absolute -inset-1 bg-indigo-500/10 rounded-2xl blur-xl opacity-0 group-hover:opacity-100 transition duration-500"></div>
                    <div className="relative flex items-center p-2 bg-white border-2 border-slate-200 rounded-2xl shadow-xl focus-within:border-indigo-500 transition-all">
                      <Github className="w-6 h-6 text-slate-400 ml-4 shrink-0" />
                      <input
                        type="url"
                        placeholder="Paste GitHub URL..."
                        className="flex-1 bg-transparent px-4 py-4 outline-none text-slate-900 font-medium"
                        value={githubUrl}
                        onChange={(e) => setGithubUrl(e.target.value)}
                        disabled={isTreeLoading}
                      />
                      <button
                        disabled={isTreeLoading || !githubUrl}
                        className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 px-8 rounded-xl transition-all shadow-lg shadow-indigo-200 disabled:opacity-50 disabled:grayscale flex items-center gap-2"
                      >
                        {isTreeLoading ? (
                          <>
                            <Loader2 className="w-5 h-5 animate-spin" />
                            <span className="uppercase tracking-widest text-xs">Reading...</span>
                          </>
                        ) : (
                          <span className="uppercase tracking-widest text-xs">Fetch Structure</span>
                        )}
                      </button>
                    </div>
                  </form>
                ) : (
                  <motion.div 
                    initial={{ opacity: 0, scale: 0.98 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="max-w-xl mx-auto bg-white border-2 border-slate-200 rounded-3xl shadow-2xl overflow-hidden"
                  >
                    <div className="p-6 border-b bg-slate-50 flex items-center justify-between">
                      <div className="text-left">
                        <h3 className="font-bold text-slate-800">Structure Detected</h3>
                        <p className="text-xs text-slate-500 font-medium">Select parts to index</p>
                      </div>
                      <button 
                        onClick={() => setHasStructure(false)}
                        className="text-[10px] uppercase font-bold text-slate-400 hover:text-slate-600 tracking-wider"
                      >
                        Cancel
                      </button>
                    </div>
                    
                    <div className="h-80 overflow-y-auto p-4 text-left border-b bg-white scrollbar-thin scrollbar-thumb-slate-200">
                      <FileTree files={files} selectedPaths={selectedPaths} onToggle={handleTogglePath} />
                    </div>

                    <div className="p-6 bg-slate-50 flex items-center justify-between">
                       <div className="text-left">
                          <p className="text-[10px] font-bold text-slate-400 uppercase">Selected</p>
                          <p className="text-sm font-bold text-indigo-600">{selectedPaths.length || "Full Repo"}</p>
                       </div>
                       <button
                        onClick={handleIndex}
                        disabled={isIndexing}
                        className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3 px-10 rounded-xl transition-all shadow-lg shadow-emerald-100 disabled:opacity-50 flex items-center gap-2"
                      >
                        {isIndexing ? (
                          <>
                            <Loader2 className="w-5 h-5 animate-spin" />
                            <span className="uppercase tracking-widest text-xs">Embedding...</span>
                          </>
                        ) : (
                          <span className="uppercase tracking-widest text-xs">Index Selected</span>
                        )}
                      </button>
                    </div>
                  </motion.div>
                )}
              </div>
            </motion.main>
          ) : (
            <>
              {/* Left Sidebar: Explorer */}
              <aside className="w-72 border-r bg-white hidden lg:flex flex-col shrink-0">
                <div className="p-4 border-b">
                  <h2 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3">Repository Context</h2>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-bold truncate text-slate-700 max-w-[140px]">{githubUrl.split("/").slice(-2).join("/")}</span>
                    <span className="text-[9px] text-emerald-600 font-bold bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-100 uppercase">Indexed</span>
                  </div>
                  <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                    <div className="h-full bg-emerald-500 w-full animate-pulse transition-all"></div>
                  </div>
                  <p className="text-[10px] text-slate-400 mt-2 font-medium tracking-wide">READY FOR CONSULTATION</p>
                </div>
                
                <div className="p-4 bg-indigo-50/50 border-b">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <Filter className={cn("w-3.5 h-3.5", selectedPaths.length > 0 ? "text-indigo-600" : "text-slate-400")} />
                      <h3 className="text-xs font-bold text-slate-700">Path Selection</h3>
                    </div>
                    {selectedPaths.length > 0 && (
                      <button 
                        onClick={() => setSelectedPaths([])}
                        className="text-[10px] font-bold text-indigo-600 hover:underline"
                      >
                        Clear
                      </button>
                    )}
                  </div>
                  <p className="text-[10px] text-slate-500 leading-tight mb-2">
                    {selectedPaths.length > 0 
                      ? `${selectedPaths.length} items selected. AI will only search within these paths.` 
                      : "Search entire codebase (default). Select files below to narrow context."}
                  </p>
                </div>

                <div className="flex-1 overflow-y-auto p-2 scrollbar-thin scrollbar-thumb-slate-200">
                  {files.length > 0 ? (
                    <FileTree files={files} selectedPaths={selectedPaths} onToggle={handleTogglePath} />
                  ) : (
                    <div className="p-4 text-center">
                      <Loader2 className="w-5 h-5 animate-spin mx-auto text-slate-300 mb-2" />
                      <p className="text-[10px] text-slate-400">Loading file structure...</p>
                    </div>
                  )}
                </div>

                <div className="p-4 border-t bg-slate-50">
                  <div className="flex items-center justify-between text-[11px] font-bold text-slate-500">
                    <span className="uppercase tracking-widest">Model</span>
                    <span className="text-indigo-600">GPT-4o</span>
                  </div>
                </div>
              </aside>

              {/* Main Content: Chat */}
              <main className="flex-1 flex flex-col bg-white relative">
                <div className="flex-1 p-6 space-y-8 overflow-y-auto overflow-x-hidden">
                  {messages.length === 0 && (
                    <div className="h-full flex flex-col items-center justify-center text-center space-y-6 max-w-md mx-auto">
                      <div className="w-16 h-16 bg-indigo-50 rounded-2xl flex items-center justify-center text-indigo-600 animate-pulse">
                        <MessageSquare className="w-8 h-8" />
                      </div>
                      <div className="space-y-2">
                        <h3 className="text-xl font-bold text-slate-800">Hello, Engineer.</h3>
                        <p className="text-sm text-slate-500 leading-relaxed font-medium">
                          I've processed this repository. Ask me about architectural patterns, performance bottlenecks, or specific logic implementations.
                        </p>
                      </div>
                      <div className="grid grid-cols-1 gap-2 w-full pt-4">
                        {[
                          "Explain the main logic flow",
                          "Find potential bugs",
                          "Suggest security improvements"
                        ].map((q) => (
                          <button 
                            key={q}
                            onClick={() => { setQuestion(q); }}
                            className="p-3 text-xs font-bold text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50 hover:border-indigo-500/30 text-left transition-all flex justify-between items-center group"
                          >
                            {q}
                            <ChevronRight className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                  {messages.map((m, i) => (
                    <motion.div
                      key={i}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className={cn("flex gap-5", m.role === "user" ? "justify-end" : "justify-start")}
                    >
                      {m.role === "assistant" && (
                        <div className="w-9 h-9 rounded-lg bg-indigo-600 shrink-0 flex items-center justify-center text-white shadow-lg shadow-indigo-100">
                          <Activity className="w-5 h-5" />
                        </div>
                      )}
                      <div className={cn(
                        "max-w-[85%] space-y-2",
                        m.role === "user" ? "text-right" : "text-left"
                      )}>
                        <div className={cn(
                          "px-5 py-4 rounded-2xl text-[14px] leading-7 shadow-sm",
                          m.role === "user" 
                            ? "bg-slate-100 text-slate-900 border border-slate-200 italic rounded-tr-none" 
                            : "bg-white text-slate-700 border border-slate-200 rounded-tl-none markdown-body"
                        )}>
                          <p className="whitespace-pre-wrap">{m.content}</p>
                          {i === messages.length - 1 && isLoading && m.role === "assistant" && (
                            <div className="mt-2 flex gap-1">
                               <div className="w-1.5 h-1.5 bg-indigo-500 rounded-full animate-bounce [animation-delay:-0.3s]"></div>
                               <div className="w-1.5 h-1.5 bg-indigo-500 rounded-full animate-bounce [animation-delay:-0.15s]"></div>
                               <div className="w-1.5 h-1.5 bg-indigo-500 rounded-full animate-bounce"></div>
                            </div>
                          )}
                        </div>
                        {m.role === "assistant" && m.content && (
                           <div className="flex items-center gap-3 px-1">
                              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Sources Verified</span>
                              <div className="h-px bg-slate-100 flex-1"></div>
                           </div>
                        )}
                      </div>
                      {m.role === "user" && (
                        <div className="w-9 h-9 rounded-lg bg-slate-200 shrink-0 flex items-center justify-center text-slate-600 border border-slate-300">
                           <Github className="w-5 h-5" />
                        </div>
                      )}
                    </motion.div>
                  ))}
                </div>

                {/* Floating Input area */}
                <div className="p-6 border-t bg-white">
                  <form onSubmit={handleSend} className="relative flex items-center">
                    <textarea
                      placeholder="Ask a question about this codebase..."
                      className="w-full resize-none bg-slate-50 border border-slate-300 rounded-xl py-4 pl-5 pr-14 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50 min-h-[56px] h-14 transition-all"
                      value={question}
                      onChange={(e) => setQuestion(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && !e.shiftKey) {
                          e.preventDefault();
                          handleSend(e as any);
                        }
                      }}
                      disabled={isLoading}
                    />
                    <div className="absolute right-3">
                      <button
                        type="submit"
                        disabled={isLoading || !question}
                        className="w-10 h-10 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-lg flex items-center justify-center shadow-lg shadow-indigo-100 transition-all font-bold"
                      >
                         {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
                      </button>
                    </div>
                  </form>
                  <div className="flex justify-between mt-3 px-1">
                    <div className="flex gap-6 items-center">
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-indigo-500 shadow-[0_0_8px_rgba(99,102,241,0.5)]"></div>
                        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Agent: ACTIVE</span>
                      </div>
                      {selectedPaths.length > 0 && (
                        <div className="flex items-center gap-2 px-2 py-0.5 bg-indigo-50 border border-indigo-100 rounded flex-shrink-0 animate-in fade-in slide-in-from-left-2 transition-all">
                           <Filter className="w-3 h-3 text-indigo-600" />
                           <span className="text-[10px] font-bold text-indigo-600 uppercase tracking-widest">Filtering: {selectedPaths.length} items</span>
                        </div>
                      )}
                    </div>
                    <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Press <kbd className="px-1.5 py-0.5 bg-slate-100 border border-slate-200 rounded uppercase text-[9px]">Enter</kbd> to submit</span>
                  </div>
                </div>
              </main>

            </>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

