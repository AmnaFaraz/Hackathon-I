import React, { useState, useRef, useEffect } from "react";

interface Message {
  role: "user" | "bot";
  content: string;
  sources?: string[];
  loading?: boolean;
}

const BACKEND_URL = "https://hackathon-i-backend.onrender.com";

export default function ChatBot(): JSX.Element {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "bot",
      content: "Hi! I'm your AI Engineer tutor. Ask me anything about building production AI systems.",
    },
  ]);
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open && inputRef.current) {
      setTimeout(() => inputRef.current?.focus(), 300);
    }
  }, [open]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const clearChat = () => {
    setMessages([{
      role: "bot",
      content: "Chat cleared! How can I help you now?",
    }]);
  };

  const sendMessage = async (presetText?: string) => {
    const question = (presetText || input).trim();
    if (!question || loading) return;

    if (!presetText) setInput("");
    setMessages((prev) => [...prev, { role: "user", content: question }]);
    setLoading(true);
    setMessages((prev) => [
      ...prev,
      { role: "bot", content: "", loading: true },
    ]);

    try {
      const res = await fetch(`${BACKEND_URL}/api/chat/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question }),
      });

      if (!res.ok) {
        if (res.status === 503 || res.status === 502 || res.status === 504) {
          throw new Error("Waking up AI... please wait 30 seconds");
        }
        throw new Error(`Server error: ${res.status}`);
      }

      const data = await res.json();
      setMessages((prev) => {
        const updated = [...prev];
        updated[updated.length - 1] = {
          role: "bot",
          content: data.answer,
          sources: data.sources || [],
          loading: false,
        };
        return updated;
      });
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : "Connection error.";
      setMessages((prev) => {
        const updated = [...prev];
        updated[updated.length - 1] = {
          role: "bot",
          content: `Error: ${errorMsg}`,
          loading: false,
        };
        return updated;
      });
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  return (
    <>
      {/* Toggle Button */}
      <button
        id="chatbot-toggle"
        onClick={() => setOpen((o) => !o)}
        aria-label={open ? "Close AI tutor" : "Open AI tutor"}
        title="AI Tutor"
        style={{
          position: "fixed",
          bottom: 24,
          right: 24,
          zIndex: 9999,
          width: 56,
          height: 56,
          borderRadius: "16px",
          background: "var(--ifm-color-primary)",
          color: "#080b14",
          border: "none",
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 24,
          boxShadow: "0 8px 32px rgba(0,212,255,0.3)",
          transition: "all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275)",
        }}
      >
        {open ? "✕" : "🤖"}
      </button>

      {/* Chat Panel */}
      <div
        role="dialog"
        aria-label="AI Tutor Chat"
        style={{
          position: "fixed",
          bottom: open ? 96 : -600,
          right: 24,
          width: 360,
          height: 580,
          background: "var(--ifm-background-surface-color)",
          border: "1px solid var(--ifm-border-color)",
          borderRadius: 20,
          zIndex: 9998,
          display: "flex",
          flexDirection: "column",
          boxShadow: "0 24px 80px rgba(0,0,0,0.4)",
          overflow: "hidden",
          transition: "all 0.4s cubic-bezier(0.22, 1, 0.36, 1)",
          visibility: open ? "visible" : "hidden",
          opacity: open ? 1 : 0,
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: "16px 20px",
            borderBottom: "1px solid var(--ifm-border-color)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            background: "var(--ifm-background-color)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ fontSize: 20 }}>🤖</span>
            <div>
              <div style={{ fontWeight: 700, fontSize: 14 }}>
                AI Tutor <span style={{ color: "#00ff88", fontSize: 18, verticalAlign: 'middle' }}>•</span>
              </div>
              <div style={{ color: "var(--ifm-color-content)", opacity: 0.6, fontSize: 11 }}>
                Powered by Groq & RAG
              </div>
            </div>
          </div>
          <button 
            onClick={clearChat}
            style={{ 
              background: 'transparent', 
              border: 'none', 
              color: 'var(--ifm-color-primary)', 
              fontSize: 11, 
              cursor: 'pointer',
              textTransform: 'uppercase',
              fontWeight: 600,
              letterSpacing: 0.5
            }}
          >
            Clear
          </button>
        </div>

        {/* Messages */}
        <div
          style={{
            flex: 1,
            overflowY: "auto",
            padding: "20px",
            display: "flex",
            flexDirection: "column",
            gap: 16,
          }}
        >
          {messages.map((msg, i) => (
            <div
              key={i}
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: msg.role === "user" ? "flex-end" : "flex-start",
              }}
            >
              <div
                style={{
                  maxWidth: "90%",
                  padding: "12px 16px",
                  borderRadius: msg.role === "user" ? "16px 16px 2px 16px" : "16px 16px 16px 4px",
                  background: msg.role === "user" ? "var(--ifm-color-primary)" : "var(--ifm-background-color)",
                  color: msg.role === "user" ? "#080b14" : "var(--ifm-color-content)",
                  fontSize: 14,
                  lineHeight: 1.5,
                  border: msg.role === "bot" ? "1px solid var(--ifm-border-color)" : "none",
                  boxShadow: msg.role === "user" ? "0 4px 12px rgba(0,212,255,0.2)" : "none",
                }}
              >
                {msg.loading ? (
                  <div style={{ display: 'flex', gap: 4 }}>
                    <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#8b949e', animation: 'pulse 1s infinite' }} />
                    <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#8b949e', animation: 'pulse 1s infinite 0.2s' }} />
                    <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#8b949e', animation: 'pulse 1s infinite 0.4s' }} />
                  </div>
                ) : (
                  msg.content
                )}
              </div>
              {msg.sources && msg.sources.length > 0 && (
                <div style={{ marginTop: 6, display: "flex", flexWrap: "wrap", gap: 6 }}>
                  {msg.sources.map((src, si) => (
                    <span
                      key={si}
                      style={{
                        fontSize: 10,
                        padding: "3px 8px",
                        borderRadius: 6,
                        background: "rgba(0,212,255,0.08)",
                        color: "var(--ifm-color-primary)",
                        border: "1px solid rgba(0,212,255,0.15)",
                        fontFamily: "var(--ifm-font-family-monospace)",
                      }}
                    >
                      {src.split("/").pop()?.replace(".md", "")}
                    </span>
                  ))}
                </div>
              )}
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div style={{ padding: "16px 20px", background: "var(--ifm-background-color)", borderTop: "1px solid var(--ifm-border-color)" }}>
          <div style={{ display: "flex", gap: 8 }}>
            <input
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask me anything about AI engineering..."
              disabled={loading}
              style={{
                flex: 1,
                background: "var(--ifm-background-surface-color)",
                border: "1px solid var(--ifm-border-color)",
                borderRadius: 12,
                padding: "10px 14px",
                color: "var(--ifm-color-content)",
                fontSize: 14,
                outline: "none",
              }}
            />
            <button
              onClick={() => sendMessage()}
              disabled={loading || !input.trim()}
              style={{
                width: 40,
                height: 40,
                borderRadius: 12,
                background: input.trim() && !loading ? "var(--ifm-color-primary)" : "var(--ifm-background-surface-color)",
                color: "#080b14",
                border: "none",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 18,
                transition: "all 0.2s",
              }}
            >
              ➤
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
