"use client";

import { useState, useRef, useEffect } from "react";
import { MessageCircle, X, Send, Loader2, Bot, User, Minimize2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

interface Message {
  role: "user" | "assistant";
  content: string;
}

export default function AiChatWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "assistant",
      content: "Merhaba! Ben Bonair AI Asistanı. Uçuş operasyonları, SHGM mevzuatı, SMS veya FDM konularında size yardımcı olabilirim.",
    },
  ]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const sendMessage = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage: Message = { role: "user", content: input.trim() };
    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setIsLoading(true);

    try {
      const res = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: [...messages, userMessage],
        }),
      });
      const data = (await res.json()) as {
        content?: string;
        error?: string;
      };
      const reply =
        res.ok && typeof data.content === "string"
          ? data.content
          : typeof data.error === "string"
            ? data.error
            : `Bir hata oluştu (${res.status}).`;
      setMessages((prev) => [...prev, { role: "assistant", content: reply }]);
    } catch {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: "Bağlantı hatası. Lütfen tekrar deneyin." },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end gap-3">
      {isOpen && !isMinimized && (
        <div className="w-[380px] h-[520px] bg-white border border-gray-200 rounded-2xl shadow-2xl flex flex-col overflow-hidden">
          {/* Header */}
          <div className="bg-black text-white px-4 py-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-red-600 rounded-full flex items-center justify-center">
                <Bot size={16} />
              </div>
              <div>
                <p className="text-sm font-semibold">Bonair AI</p>
                <p className="text-xs text-gray-300">Havacılık Asistanı</p>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setIsMinimized(true)}
                className="p-1 hover:bg-white/10 rounded transition-colors"
              >
                <Minimize2 size={16} />
              </button>
              <button
                onClick={() => setIsOpen(false)}
                className="p-1 hover:bg-white/10 rounded transition-colors"
              >
                <X size={16} />
              </button>
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {messages.map((msg, i) => (
              <div
                key={i}
                className={`flex gap-2 ${msg.role === "user" ? "flex-row-reverse" : "flex-row"}`}
              >
                <div
                  className={`w-7 h-7 rounded-full flex-shrink-0 flex items-center justify-center text-white ${
                    msg.role === "user" ? "bg-red-600" : "bg-black"
                  }`}
                >
                  {msg.role === "user" ? <User size={14} /> : <Bot size={14} />}
                </div>
                <div
                  className={`max-w-[75%] px-3 py-2 rounded-xl text-sm leading-relaxed ${
                    msg.role === "user"
                      ? "bg-black text-white rounded-tr-sm"
                      : "bg-gray-100 text-gray-800 rounded-tl-sm"
                  }`}
                >
                  {msg.content}
                </div>
              </div>
            ))}
            {isLoading && (
              <div className="flex gap-2">
                <div className="w-7 h-7 rounded-full bg-black flex items-center justify-center text-white">
                  <Bot size={14} />
                </div>
                <div className="bg-gray-100 px-3 py-2 rounded-xl rounded-tl-sm">
                  <Loader2 size={16} className="animate-spin text-gray-500" />
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          {/* Input */}
          <div className="border-t border-gray-100 p-3 flex gap-2 items-end">
            <Textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Soru sorun... (Enter ile gönderin)"
              className="resize-none text-sm min-h-[40px] max-h-[100px]"
              rows={1}
            />
            <Button
              onClick={sendMessage}
              disabled={isLoading || !input.trim()}
              size="icon"
              className="bg-black hover:bg-gray-800 text-white flex-shrink-0"
            >
              <Send size={16} />
            </Button>
          </div>
        </div>
      )}

      {/* Minimized */}
      {isOpen && isMinimized && (
        <div
          className="bg-black text-white px-4 py-2 rounded-full flex items-center gap-2 cursor-pointer shadow-lg"
          onClick={() => setIsMinimized(false)}
        >
          <Bot size={16} />
          <span className="text-sm font-medium">Bonair AI</span>
        </div>
      )}

      {/* FAB Button */}
      <button
        onClick={() => { setIsOpen((prev) => !prev); setIsMinimized(false); }}
        className="w-14 h-14 bg-black hover:bg-gray-800 text-white rounded-full shadow-xl flex items-center justify-center transition-all hover:scale-110"
      >
        {isOpen ? <X size={22} /> : <MessageCircle size={22} />}
      </button>
    </div>
  );
}
