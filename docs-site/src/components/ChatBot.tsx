import React, { useState, useRef, useEffect } from "react";

interface Message {
  role: "user" | "bot";
  content: string;
  sources?: string[];
  loading?: boolean;
}

const BACKEND_URL =
  process.env.NEXT_PUBLIC_API_URL ||
  (typeof window !== "undefined"
    ? (window as any).__BACKEND_URL__ || "http://localhost:8000"
    : "http://localhost:8000");

export default function ChatBot(): JSX.Element {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "bot",
      content:
        "Hi! I'm your Physical AI tutor. Ask me anything about this textbook.",
    },
  ]);
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open && inputRef.current) inputRef.current.focus();
  }, [open]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const sendMessage = async () => {
    const question = input.trim();
    if (!question || loading) return;

    setInput("");
    setMessages((prev) => [...prev, { role: "user", content: question }]);
    setLoading(true);
    setMessages((prev) => [
      ...prev,
      { role: "bot", content: "", loading: true },
    ]);

    try {
      const res = await fetch(`${BACKEND_URL}/api/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question }),
      });

      if (!res.ok) throw new Error(`Server error: ${res.status}`);

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
      const errorMsg =
        err instanceof Error ? err.message : "Connection error.";
      setMessages((prev) => {
        const updated = [...prev];
        updated[updated.length - 1] = {
          role: "bot",
          content: `Error: ${errorMsg} Please try again.`,
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
          width: 52,
          height: 52,
          borderRadius: "50%",
          background: "#00d4ff",
          color: "#080b14",
          border: "none",
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 22,
          boxShadow: "0 4px 20px rgba(0,212,255,0.4)",
          transition: "all 0.2s ease",
        }}
      >
        {open ? "✕" : "🤖"}
      </button>

      {/* Chat Panel */}
      {open && (
        <div
          role="dialog"
          aria-label="AI Tutor Chat"
          style={{
            position: "fixed",
            bottom: 88,
            right: 24,
            width: 340,
            height: 520,
            background: "#0d1117",
            border: "1px solid #21262d",
            borderRadius: 16,
            zIndex: 9998,
            display: "flex",
            flexDirection: "column",
            boxShadow: "0 20px 60px rgba(0,0,0,0.6)",
            overflow: "hidden",
          }}
        >
          {/* Header */}
          <div
            style={{
              padding: "12px 16px",
              borderBottom: "1px solid #21262d",
              display: "flex",
              alignItems: "center",
              gap: 8,
              background: "#080b14",
            }}
          >
            <span style={{ fontSize: 18 }}>🤖</span>
            <div>
              <div
                style={{
                  color: "#e6edf3",
                  fontWeight: 600,
                  fontSize: 13,
                  fontFamily: "monospace",
                }}
              >
                Physical AI Tutor
              </div>
              <div style={{ color: "#8b949e", fontSize: 11 }}>
                Answers from this textbook only
              </div>
            </div>
            <div
              style={{
                marginLeft: "auto",
                width: 8,
                height: 8,
                borderRadius: "50%",
                background: "#00ff88",
                animation: "pulse 2s infinite",
              }}
            />
          </div>

          {/* Messages */}
          <div
            style={{
              flex: 1,
              overflowY: "auto",
              padding: "12px 16px",
              display: "flex",
              flexDirection: "column",
              gap: 12,
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
                    maxWidth: "88%",
                    padding: "8px 12px",
                    borderRadius:
                      msg.role === "user" ? "12px 12px 2px 12px" : "12px 12px 12px 2px",
                    background:
                      msg.role === "user"
                        ? "#00d4ff"
                        : "#161b22",
                    color:
                      msg.role === "user" ? "#080b14" : "#e6edf3",
                    fontSize: 13,
                    lineHeight: 1.5,
                    border:
                      msg.role === "bot" ? "1px solid #21262d" : "none",
                  }}
                >
                  {msg.loading ? (
                    <span style={{ color: "#8b949e" }}>
                      Thinking
                      <span
                        style={{
                          animation: "ellipsis 1.4s infinite",
                          display: "inline-block",
                        }}
                      >
                        ...
                      </span>
                    </span>
                  ) : (
                    msg.content
                  )}
                </div>

                {/* Sources */}
                {msg.sources && msg.sources.length > 0 && (
                  <div
                    style={{
                      marginTop: 4,
                      display: "flex",
                      flexWrap: "wrap",
                      gap: 4,
                    }}
                  >
                    {msg.sources.map((src, si) => (
                      <span
                        key={si}
                        style={{
                          fontSize: 10,
                          padding: "2px 6px",
                          borderRadius: 4,
                          background: "rgba(0,212,255,0.1)",
                          color: "#00d4ff",
                          border: "1px solid rgba(0,212,255,0.2)",
                          fontFamily: "monospace",
                        }}
                      >
                        📄 {src.split("/").pop()?.replace(".md", "") || src}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div
            style={{
              padding: "12px 16px",
              borderTop: "1px solid #21262d",
              display: "flex",
              gap: 8,
            }}
          >
            <input
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask about any chapter..."
              disabled={loading}
              aria-label="Ask a question"
              style={{
                flex: 1,
                background: "#161b22",
                border: "1px solid #21262d",
                borderRadius: 8,
                padding: "8px 12px",
                color: "#e6edf3",
                fontSize: 13,
                outline: "none",
              }}
            />
            <button
              onClick={sendMessage}
              disabled={loading || !input.trim()}
              aria-label="Send message"
              style={{
                width: 36,
                height: 36,
                borderRadius: 8,
                background: input.trim() && !loading ? "#00d4ff" : "#21262d",
                color: "#080b14",
                border: "none",
                cursor: input.trim() && !loading ? "pointer" : "default",
                fontSize: 16,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                transition: "all 0.2s",
              }}
            >
              ➤
            </button>
          </div>
        </div>
      )}
    </>
  );
}
