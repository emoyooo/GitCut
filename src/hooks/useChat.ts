import { useState, useCallback } from "react";

export function useChat() {
  const [messages, setMessages] = useState<{ role: "user" | "assistant"; content: string }[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const sendMessage = useCallback(async (question: string, repoId: string, filePaths?: string[], selection?: string[]) => {
    setIsLoading(true);
    setMessages((prev) => [...prev, { role: "user", content: question }]);

    let assistantMessage = "";
    setMessages((prev) => [...prev, { role: "assistant", content: "" }]);

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question, repoId, filePaths, selection }),
      });

      if (!response.body) throw new Error("No response body");

      const reader = response.body.getReader();
      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split("\n");

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            const dataStr = line.slice(6).trim();
            if (dataStr === "[DONE]") break;

            try {
              const data = JSON.parse(dataStr);
              if (data.content) {
                assistantMessage += data.content;
                setMessages((prev) => {
                  const updated = [...prev];
                  updated[updated.length - 1].content = assistantMessage;
                  return updated;
                });
              }
              if (data.error) {
                throw new Error(data.error);
              }
            } catch (e) {
              console.error("Error parsing chunk", e);
            }
          }
        }
      }
    } catch (error) {
      console.error("Chat error:", error);
      setMessages((prev) => {
        const updated = [...prev];
        updated[updated.length - 1].content = "Error: Failed to fetch response.";
        return updated;
      });
    } finally {
      setIsLoading(false);
    }
  }, []);

  return { messages, isLoading, sendMessage, setMessages };
}
