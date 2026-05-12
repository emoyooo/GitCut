import React, { useMemo } from "react";
import { Folder, File, ChevronRight, ChevronDown, CheckSquare, Square } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

interface FileNode {
  name: string;
  path: string;
  type: "file" | "folder";
  children?: FileNode[];
}

interface FileTreeProps {
  files: string[];
  selectedPaths: string[];
  onToggle: (path: string) => void;
}

export function FileTree({ files, selectedPaths, onToggle }: FileTreeProps) {
  const tree = useMemo(() => {
    const root: FileNode[] = [];
    files.forEach((filePath) => {
      const parts = filePath.split("/");
      let current = root;
      let fullPath = "";
      parts.forEach((part, index) => {
        fullPath = fullPath ? `${fullPath}/${part}` : part;
        const isLast = index === parts.length - 1;
        let node = current.find((n) => n.name === part);
        if (!node) {
          node = {
            name: part,
            path: fullPath,
            type: isLast ? "file" : "folder",
            children: isLast ? undefined : [],
          };
          current.push(node);
        }
        if (node.children) {
          current = node.children;
        }
      });
    });
    
    // Sort: folders first, then files
    const sortNodes = (nodes: FileNode[]) => {
      nodes.sort((a, b) => {
        if (a.type !== b.type) return a.type === "folder" ? -1 : 1;
        return a.name.localeCompare(b.name);
      });
      nodes.forEach(n => {
        if (n.children) sortNodes(n.children);
      });
    };
    sortNodes(root);
    return root;
  }, [files]);

  return (
    <div className="space-y-1">
      {tree.map((node) => (
        <TreeNode key={node.path} node={node} selectedPaths={selectedPaths} onToggle={onToggle} depth={0} />
      ))}
    </div>
  );
}

function TreeNode({ node, selectedPaths, onToggle, depth }: { node: FileNode; selectedPaths: string[]; onToggle: (path: string) => void; depth: number }) {
  const [isOpen, setIsOpen] = React.useState(depth < 1); // Expand first level by default
  const isSelected = selectedPaths.includes(node.path);

  const handleToggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    onToggle(node.path);
  };

  return (
    <div className="select-none">
      <div 
        className="flex items-center gap-1 p-1 hover:bg-slate-100 rounded group cursor-pointer"
        style={{ paddingLeft: `${depth * 12 + 4}px` }}
        onClick={() => node.type === "folder" && setIsOpen(!isOpen)}
      >
        <button 
          onClick={handleToggle}
          className="p-0.5 hover:bg-slate-200 rounded transition-colors"
        >
          {isSelected ? (
            <CheckSquare className="w-3.5 h-3.5 text-indigo-600 fill-indigo-50" />
          ) : (
            <Square className="w-3.5 h-3.5 text-slate-300" />
          )}
        </button>
        
        {node.type === "folder" ? (
          isOpen ? <ChevronDown className="w-3.5 h-3.5 text-slate-400" /> : <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
        ) : (
          <div className="w-3.5 h-3.5" />
        )}
        
        {node.type === "folder" ? (
          <Folder className="w-3.5 h-3.5 text-indigo-400 fill-indigo-50" />
        ) : (
          <File className="w-3.5 h-3.5 text-slate-400" />
        )}
        
        <span className="text-xs truncate font-medium text-slate-600 group-hover:text-slate-900">
          {node.name}
        </span>
      </div>

      <AnimatePresence>
        {isOpen && node.children && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            {node.children.map((child) => (
              <TreeNode key={child.path} node={child} selectedPaths={selectedPaths} onToggle={onToggle} depth={depth + 1} />
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
