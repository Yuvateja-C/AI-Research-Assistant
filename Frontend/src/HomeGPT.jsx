import { useState, useRef, useEffect, useCallback } from "react";
import jsPDF from "jspdf";

const API_URL = (import.meta.env.VITE_API_URL || "http://127.0.0.1:8000").replace(/\/+$/, "");
const MAX_FILE_MB = 100;

function uid() {
  return `msg_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

/* ━━━ SVG ICON LIBRARY ━━━ */
const Icon = {
  Brain: ({ size = 20 }) => (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2a5 5 0 0 1 5 5c0 1.5-.5 2.5-1.5 3.5L12 14l-3.5-3.5C7.5 9.5 7 8.5 7 7a5 5 0 0 1 5-5z"/>
      <path d="M12 14v8"/><path d="M8 18h8"/>
      <circle cx="9" cy="7" r="1" fill="currentColor" stroke="none"/>
      <circle cx="15" cy="7" r="1" fill="currentColor" stroke="none"/>
    </svg>
  ),
  Send: ({ size = 18 }) => (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 2L11 13"/><path d="M22 2l-7 20-4-9-9-4 20-7z"/>
    </svg>
  ),
  Upload: ({ size = 22 }) => (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/>
      <polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>
    </svg>
  ),
  File: ({ size = 16 }) => (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/>
      <polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/>
    </svg>
  ),
  Sparkle: ({ size = 16 }) => (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="currentColor">
      <path d="M12 1l2.5 7.5L22 12l-7.5 2.5L12 22l-2.5-7.5L2 12l7.5-2.5z"/>
    </svg>
  ),
  Download: ({ size = 16 }) => (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
    </svg>
  ),
  Refresh: ({ size = 16 }) => (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 11-2.12-9.36L23 10"/>
    </svg>
  ),
  Clip: ({ size = 18 }) => (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21.44 11.05l-9.19 9.19a6 6 0 01-8.49-8.49l9.19-9.19a4 4 0 015.66 5.66l-9.2 9.19a2 2 0 01-2.83-2.83l8.49-8.48"/>
    </svg>
  ),
  X: ({ size = 14 }) => (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
      <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
    </svg>
  ),
  Layers: ({ size = 18 }) => (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/>
    </svg>
  ),
  Zap: ({ size = 16 }) => (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="currentColor">
      <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
    </svg>
  ),
};

/* ━━━ TYPING INDICATOR ━━━ */
const TypingIndicator = () => (
  <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "12px 0" }}>
    {[0, 1, 2].map(i => (
      <div key={i} style={{
        width: 7, height: 7,
        borderRadius: "50%",
        background: "linear-gradient(135deg, #00b4d8, #8b5cf6)",
        animation: `typing-dot 1.4s ease-in-out ${i * 0.15}s infinite`,
      }} />
    ))}
    <span style={{ marginLeft: 8, fontSize: 12, color: "#64748b", fontStyle: "italic" }}>analyzing...</span>
  </div>
);

/* ━━━ ANIMATED BACKGROUND ORBS ━━━ */
const BackgroundOrbs = () => (
  <div style={{ position: "fixed", inset: 0, overflow: "hidden", pointerEvents: "none", zIndex: 0 }}>
    <div style={{
      position: "absolute", width: 500, height: 500, borderRadius: "50%",
      background: "radial-gradient(circle, rgba(139,92,246,0.12) 0%, transparent 70%)",
      top: "-10%", right: "-5%",
      animation: "float-orb 20s ease-in-out infinite",
    }} />
    <div style={{
      position: "absolute", width: 600, height: 600, borderRadius: "50%",
      background: "radial-gradient(circle, rgba(0,180,216,0.08) 0%, transparent 70%)",
      bottom: "-15%", left: "-10%",
      animation: "float-orb-2 25s ease-in-out infinite",
    }} />
    <div style={{
      position: "absolute", width: 400, height: 400, borderRadius: "50%",
      background: "radial-gradient(circle, rgba(251,191,36,0.06) 0%, transparent 70%)",
      top: "40%", left: "50%",
      animation: "float-orb-3 30s ease-in-out infinite",
    }} />
    {/* Grid overlay */}
    <div style={{
      position: "absolute", inset: 0,
      backgroundImage: `
        linear-gradient(rgba(139,92,246,0.03) 1px, transparent 1px),
        linear-gradient(90deg, rgba(139,92,246,0.03) 1px, transparent 1px)
      `,
      backgroundSize: "60px 60px",
    }} />
  </div>
);

/* ━━━ MESSAGE COMPONENT ━━━ */
const MessageBubble = ({ msg, index }) => {
  const isUser = msg.role === "user";
  
  return (
    <div
      className="animate-slide-up"
      style={{
        display: "flex",
        gap: 14,
        padding: "16px 20px",
        alignItems: "flex-start",
        animationDelay: `${index * 0.05}s`,
        flexDirection: isUser ? "row-reverse" : "row",
      }}
    >
      {/* Avatar */}
      <div style={{
        width: 36, height: 36, borderRadius: 12, flexShrink: 0,
        display: "flex", alignItems: "center", justifyContent: "center",
        background: isUser
          ? "linear-gradient(135deg, #1e293b, #334155)"
          : "linear-gradient(135deg, #8b5cf6, #06b6d4)",
        boxShadow: isUser ? "none" : "0 0 20px rgba(139,92,246,0.2)",
        fontSize: 14, fontWeight: 700, color: "#fff",
      }}>
        {isUser ? "Y" : <Icon.Sparkle size={16} />}
      </div>

      {/* Content */}
      <div style={{
        maxWidth: "75%",
        padding: "14px 18px",
        borderRadius: isUser ? "18px 18px 4px 18px" : "18px 18px 18px 4px",
        background: isUser
          ? "linear-gradient(135deg, rgba(139,92,246,0.15), rgba(139,92,246,0.08))"
          : "rgba(255,255,255,0.03)",
        border: `1px solid ${isUser ? "rgba(139,92,246,0.2)" : "rgba(255,255,255,0.06)"}`,
        fontSize: 14,
        lineHeight: 1.7,
        color: "#e2e8f0",
        wordBreak: "break-word",
        whiteSpace: "pre-wrap",
      }}>
        {msg.content}
        {msg.sources && msg.sources.length > 0 && (
          <div style={{
            marginTop: 12, paddingTop: 10,
            borderTop: "1px solid rgba(255,255,255,0.06)",
            display: "flex", flexWrap: "wrap", gap: 6,
          }}>
            {msg.sources.map((s, i) => (
              <span key={i} style={{
                fontSize: 11, padding: "3px 10px", borderRadius: 20,
                background: "rgba(0,180,216,0.1)", border: "1px solid rgba(0,180,216,0.2)",
                color: "#00b4d8", fontFamily: "'JetBrains Mono', monospace",
              }}>
                Chunk {s.chunk_index ?? i + 1} · {(s.score * 100).toFixed(0)}%
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

/* ━━━ SUGGESTED QUERY CHIPS ━━━ */
const SUGGESTIONS = [
  { icon: "📊", text: "Generate executive summary", color: "#8b5cf6" },
  { icon: "🔬", text: "Extract key metrics & data", color: "#00b4d8" },
  { icon: "🧠", text: "Identify core arguments", color: "#f59e0b" },
  { icon: "📋", text: "List main findings", color: "#34d399" },
];

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
/* ━━━   MAIN APPLICATION        ━━━ */
/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
export default function HomeGPT() {
  const [fileInfo, setFileInfo] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [summary, setSummary] = useState("");
  const [isGeneratingSummary, setIsGeneratingSummary] = useState(false);
  const [question, setQuestion] = useState("");
  const [isAsking, setIsAsking] = useState(false);
  const [askError, setAskError] = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [isDragOver, setIsDragOver] = useState(false);

  const [messages, setMessages] = useState([
    {
      id: uid(),
      role: "assistant",
      content: "Welcome to ResearchAI. I'm your intelligent document analysis engine.\n\nUpload a PDF to begin — I'll process, vectorize, and prepare it for deep analysis. Ask me anything about your documents.",
    },
  ]);

  const fileInputRef = useRef(null);
  const inputRef = useRef(null);
  const messagesEndRef = useRef(null);
  const uploadAbortRef = useRef(null);
  const askAbortRef = useRef(null);
  const summaryAbortRef = useRef(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isAsking]);

  useEffect(() => {
    return () => {
      uploadAbortRef.current?.abort();
      askAbortRef.current?.abort();
      summaryAbortRef.current?.abort();
    };
  }, []);

  const adjustTextarea = useCallback(() => {
    const ta = inputRef.current;
    if (ta) { ta.style.height = "auto"; ta.style.height = `${Math.min(ta.scrollHeight, 180)}px`; }
  }, []);

  useEffect(() => { adjustTextarea(); }, [question, adjustTextarea]);

  /* ── Upload Handler ── */
  const handleUpload = async (file) => {
    if (!file) return;
    if (!file.name.toLowerCase().endsWith(".pdf")) {
      setUploadError("Only PDF files are supported.");
      return;
    }
    if (file.size > MAX_FILE_MB * 1024 * 1024) {
      setUploadError(`File too large. Max ${MAX_FILE_MB}MB.`);
      return;
    }

    setUploadError(null);
    setIsUploading(true);
    setUploadProgress(0);

    // Simulate progress
    const progressInterval = setInterval(() => {
      setUploadProgress(p => Math.min(p + Math.random() * 15, 90));
    }, 300);

    const formData = new FormData();
    formData.append("file", file);
    const controller = new AbortController();
    uploadAbortRef.current = controller;

    try {
      const res = await fetch(`${API_URL}/upload`, {
        method: "POST", body: formData, signal: controller.signal,
      });
      if (!res.ok) throw new Error("Upload failed. Check backend connection.");
      const data = await res.json();
      
      clearInterval(progressInterval);
      setUploadProgress(100);
      
      setFileInfo({ filename: data.filename, chunks: data.total_chunks });
      setMessages(prev => [...prev, {
        id: uid(), role: "assistant",
        content: `✅ Document processed successfully!\n\n📄 **${data.filename}**\n📦 ${data.total_chunks} semantic chunks created\n\nYour document is ready for analysis. Ask me anything about it, or use the suggested queries below.`,
      }]);
    } catch (error) {
      clearInterval(progressInterval);
      if (error.name === "AbortError") return;
      setUploadError(error.message);
    } finally {
      setIsUploading(false);
      setTimeout(() => setUploadProgress(0), 1000);
    }
  };

  const handleFileInput = (e) => {
    const file = e.target.files?.[0];
    if (file) handleUpload(file);
    e.target.value = "";
  };

  /* ── Drag & Drop ── */
  const handleDragOver = (e) => { e.preventDefault(); setIsDragOver(true); };
  const handleDragLeave = () => setIsDragOver(false);
  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleUpload(file);
  };

  /* ── Ask Handler ── */
  const handleAsk = async () => {
    const q = question.trim();
    if (!q || isAsking) return;

    setQuestion("");
    setAskError(null);

    const userMsg = { id: uid(), role: "user", content: q };
    setMessages(prev => [...prev, userMsg]);
    setIsAsking(true);

    const controller = new AbortController();
    askAbortRef.current = controller;

    try {
      const history = messages.filter(m => m.role !== "system").slice(-10).map(m => ({
        role: m.role, content: m.content,
      }));

      const res = await fetch(`${API_URL}/ask`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: q, history }),
        signal: controller.signal,
      });
      if (!res.ok) throw new Error("Request failed.");
      const data = await res.json();
      setMessages(prev => [...prev, {
        id: uid(), role: "assistant", content: data.answer, sources: data.sources,
      }]);
    } catch (error) {
      if (error.name === "AbortError") return;
      setAskError(error.message);
      setMessages(prev => [...prev, {
        id: uid(), role: "assistant",
        content: "⚠️ I couldn't process that request. Please check your connection and try again.",
      }]);
    } finally {
      setIsAsking(false);
    }
  };

  /* ── Summary Handler ── */
  const handleSummary = async () => {
    if (isGeneratingSummary) return;
    setIsGeneratingSummary(true);
    
    setMessages(prev => [...prev, {
      id: uid(), role: "user", content: "Generate an executive summary of the document.",
    }]);

    const controller = new AbortController();
    summaryAbortRef.current = controller;

    try {
      const res = await fetch(`${API_URL}/summary`, {
        method: "POST", signal: controller.signal,
      });
      if (!res.ok) throw new Error("Summary generation failed.");
      const data = await res.json();
      setSummary(data.summary);
      setMessages(prev => [...prev, {
        id: uid(), role: "assistant", content: data.summary,
      }]);
    } catch (error) {
      if (error.name === "AbortError") return;
      setMessages(prev => [...prev, {
        id: uid(), role: "assistant",
        content: "⚠️ Could not generate summary. Please try again.",
      }]);
    } finally {
      setIsGeneratingSummary(false);
    }
  };

  /* ── Export PDF ── */
  const exportPDF = () => {
    const text = summary || messages.filter(m => m.role === "assistant").map(m => m.content).join("\n\n---\n\n");
    const doc = new jsPDF();
    doc.setFont("Helvetica", "bold");
    doc.setFontSize(20);
    doc.setTextColor(139, 92, 246);
    doc.text("ResearchAI — Analysis Report", 20, 25);
    doc.setDrawColor(139, 92, 246);
    doc.setLineWidth(0.5);
    doc.line(20, 30, 190, 30);
    doc.setFont("Helvetica", "normal");
    doc.setFontSize(11);
    doc.setTextColor(30, 30, 30);
    const lines = doc.splitTextToSize(text, 170);
    doc.text(lines, 20, 42);
    doc.save(`ResearchAI_Report_${Date.now().toString().slice(-6)}.pdf`);
  };

  /* ── Clear Session ── */
  const clearSession = () => {
    setMessages([{
      id: uid(), role: "assistant",
      content: "Session cleared. Ready for a new analysis.\n\nUpload a document to get started.",
    }]);
    setFileInfo(null);
    setAskError(null);
    setUploadError(null);
    setQuestion("");
    setSummary("");
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleAsk(); }
  };

  /* ━━━ RENDER ━━━ */
  return (
    <div style={{
      display: "flex", height: "100vh", width: "100vw",
      background: "#06080d", position: "relative", overflow: "hidden",
    }}>
      <BackgroundOrbs />

      {/* ═══ SIDEBAR ═══ */}
      <aside
        style={{
          width: sidebarOpen ? 300 : 0,
          minWidth: sidebarOpen ? 300 : 0,
          height: "100vh",
          display: "flex", flexDirection: "column",
          background: "rgba(12, 15, 24, 0.8)",
          backdropFilter: "blur(24px)",
          borderRight: "1px solid rgba(255,255,255,0.06)",
          transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
          overflow: "hidden",
          position: "relative",
          zIndex: 10,
        }}
      >
        {/* Sidebar Top Glow */}
        <div style={{
          position: "absolute", top: 0, left: 0, right: 0, height: 120,
          background: "linear-gradient(180deg, rgba(139,92,246,0.08) 0%, transparent 100%)",
          pointerEvents: "none",
        }} />

        {/* Brand */}
        <div style={{
          padding: "24px 20px 16px",
          borderBottom: "1px solid rgba(255,255,255,0.06)",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{
              width: 40, height: 40, borderRadius: 12,
              background: "linear-gradient(135deg, #8b5cf6, #06b6d4)",
              display: "flex", alignItems: "center", justifyContent: "center",
              boxShadow: "0 0 24px rgba(139,92,246,0.3)",
            }}>
              <Icon.Layers size={20} />
            </div>
            <div>
              <div style={{
                fontSize: 16, fontWeight: 800, letterSpacing: "-0.02em",
                background: "linear-gradient(135deg, #e2e8f0, #94a3b8)",
                WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
              }}>
                ResearchAI
              </div>
              <div style={{ fontSize: 10, color: "#64748b", letterSpacing: "0.1em", textTransform: "uppercase" }}>
                Quantum Analysis Engine
              </div>
            </div>
          </div>
        </div>

        {/* New Session Button */}
        <div style={{ padding: "16px 16px 8px" }}>
          <button
            onClick={clearSession}
            style={{
              width: "100%", padding: "10px 16px",
              background: "linear-gradient(135deg, rgba(139,92,246,0.15), rgba(6,182,212,0.1))",
              border: "1px solid rgba(139,92,246,0.25)",
              borderRadius: 12, color: "#e2e8f0",
              fontSize: 13, fontWeight: 600, cursor: "pointer",
              display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
              transition: "all 0.2s",
            }}
            onMouseEnter={e => {
              e.target.style.background = "linear-gradient(135deg, rgba(139,92,246,0.25), rgba(6,182,212,0.2))";
              e.target.style.boxShadow = "0 0 20px rgba(139,92,246,0.15)";
            }}
            onMouseLeave={e => {
              e.target.style.background = "linear-gradient(135deg, rgba(139,92,246,0.15), rgba(6,182,212,0.1))";
              e.target.style.boxShadow = "none";
            }}
          >
            <Icon.Refresh size={14} />
            New Analysis Session
          </button>
        </div>

        {/* Upload Section */}
        <div style={{ padding: "12px 16px", flex: 1 }}>
          <div style={{
            fontSize: 10, color: "#64748b", fontWeight: 600,
            letterSpacing: "0.12em", textTransform: "uppercase",
            marginBottom: 12, paddingLeft: 4,
          }}>
            Document Pipeline
          </div>

          {/* Upload Zone */}
          <div
            onClick={() => !isUploading && fileInputRef.current?.click()}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            style={{
              padding: "28px 16px",
              borderRadius: 16,
              border: `2px dashed ${isDragOver ? "#8b5cf6" : "rgba(255,255,255,0.08)"}`,
              background: isDragOver ? "rgba(139,92,246,0.08)" : "rgba(255,255,255,0.02)",
              cursor: isUploading ? "wait" : "pointer",
              transition: "all 0.3s",
              textAlign: "center",
              position: "relative",
              overflow: "hidden",
            }}
          >
            {/* Upload Progress Bar */}
            {isUploading && (
              <div style={{
                position: "absolute", bottom: 0, left: 0,
                height: 3,
                width: `${uploadProgress}%`,
                background: "linear-gradient(90deg, #8b5cf6, #06b6d4)",
                borderRadius: 3,
                transition: "width 0.3s",
              }} />
            )}

            <div style={{
              width: 48, height: 48, borderRadius: 14, margin: "0 auto 12px",
              background: "linear-gradient(135deg, rgba(139,92,246,0.15), rgba(6,182,212,0.1))",
              display: "flex", alignItems: "center", justifyContent: "center",
              color: isDragOver ? "#8b5cf6" : "#64748b",
              transition: "all 0.3s",
            }}>
              <Icon.Upload size={22} />
            </div>
            <div style={{ fontSize: 13, fontWeight: 600, color: "#e2e8f0", marginBottom: 4 }}>
              {isUploading ? "Processing document..." : "Drop PDF here"}
            </div>
            <div style={{ fontSize: 11, color: "#64748b" }}>
              {isUploading ? `${Math.round(uploadProgress)}% complete` : "or click to browse"}
            </div>
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf"
            onChange={handleFileInput}
            style={{ display: "none" }}
          />

          {/* Upload Error */}
          {uploadError && (
            <div className="animate-slide-up" style={{
              marginTop: 10, padding: "10px 12px", borderRadius: 10,
              background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.2)",
              fontSize: 12, color: "#fb7185",
            }}>
              {uploadError}
            </div>
          )}

          {/* Active Document */}
          {fileInfo && (
            <div className="animate-slide-up" style={{
              marginTop: 14, padding: "14px 14px", borderRadius: 14,
              background: "rgba(139,92,246,0.06)",
              border: "1px solid rgba(139,92,246,0.15)",
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
                <div style={{
                  width: 32, height: 32, borderRadius: 8,
                  background: "linear-gradient(135deg, #8b5cf6, #06b6d4)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}>
                  <Icon.File size={14} />
                </div>
                <div style={{ flex: 1, overflow: "hidden" }}>
                  <div style={{
                    fontSize: 12, fontWeight: 600, color: "#e2e8f0",
                    textOverflow: "ellipsis", overflow: "hidden", whiteSpace: "nowrap",
                  }}>
                    {fileInfo.filename}
                  </div>
                  <div style={{ fontSize: 10, color: "#64748b" }}>
                    {fileInfo.chunks} chunks indexed
                  </div>
                </div>
              </div>
              <div style={{
                width: "100%", height: 3, borderRadius: 3,
                background: "rgba(255,255,255,0.06)",
                overflow: "hidden",
              }}>
                <div style={{
                  width: "100%", height: "100%", borderRadius: 3,
                  background: "linear-gradient(90deg, #8b5cf6, #06b6d4)",
                }} />
              </div>
            </div>
          )}
        </div>

        {/* Sidebar Footer */}
        <div style={{
          padding: "16px 20px",
          borderTop: "1px solid rgba(255,255,255,0.06)",
          display: "flex", alignItems: "center", justifyContent: "space-between",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{
              width: 8, height: 8, borderRadius: "50%",
              background: "#34d399",
              boxShadow: "0 0 8px rgba(52,211,153,0.5)",
              animation: "glow-pulse 2s ease-in-out infinite",
            }} />
            <span style={{ fontSize: 11, color: "#64748b", fontWeight: 500 }}>System Online</span>
          </div>
          <span style={{
            fontSize: 9, color: "#334155",
            fontFamily: "'JetBrains Mono', monospace",
            letterSpacing: "0.05em",
          }}>
            v3.0
          </span>
        </div>
      </aside>

      {/* ═══ MAIN CONTENT ═══ */}
      <main style={{
        flex: 1, display: "flex", flexDirection: "column",
        height: "100vh", position: "relative", zIndex: 5,
        overflow: "hidden",
      }}>
        {/* ── Top Header ── */}
        <header style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "14px 24px",
          background: "rgba(12,15,24,0.6)",
          backdropFilter: "blur(16px)",
          borderBottom: "1px solid rgba(255,255,255,0.04)",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            {/* Sidebar Toggle */}
            <button
              onClick={() => setSidebarOpen(p => !p)}
              style={{
                width: 36, height: 36, borderRadius: 10,
                background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)",
                color: "#94a3b8", cursor: "pointer",
                display: "flex", alignItems: "center", justifyContent: "center",
                transition: "all 0.2s",
              }}
              onMouseEnter={e => e.target.style.background = "rgba(255,255,255,0.08)"}
              onMouseLeave={e => e.target.style.background = "rgba(255,255,255,0.04)"}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/>
              </svg>
            </button>

            <div>
              <h1 style={{
                fontSize: 15, fontWeight: 700, color: "#e2e8f0",
                letterSpacing: "-0.01em",
              }}>
                Analysis Workspace
              </h1>
              <div style={{ fontSize: 11, color: "#475569" }}>
                {fileInfo ? `Analyzing: ${fileInfo.filename}` : "Ready for document upload"}
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div style={{ display: "flex", gap: 8 }}>
            {fileInfo && (
              <>
                <button
                  onClick={handleSummary}
                  disabled={isGeneratingSummary}
                  style={{
                    padding: "8px 16px", borderRadius: 10,
                    background: "linear-gradient(135deg, rgba(139,92,246,0.15), rgba(6,182,212,0.1))",
                    border: "1px solid rgba(139,92,246,0.2)",
                    color: "#c4b5fd", fontSize: 12, fontWeight: 600,
                    cursor: isGeneratingSummary ? "wait" : "pointer",
                    display: "flex", alignItems: "center", gap: 6,
                    transition: "all 0.2s",
                    opacity: isGeneratingSummary ? 0.5 : 1,
                  }}
                  onMouseEnter={e => { if (!isGeneratingSummary) e.target.style.boxShadow = "0 0 16px rgba(139,92,246,0.2)"; }}
                  onMouseLeave={e => e.target.style.boxShadow = "none"}
                >
                  <Icon.Sparkle size={13} />
                  {isGeneratingSummary ? "Generating..." : "Summary"}
                </button>
                <button
                  onClick={exportPDF}
                  style={{
                    padding: "8px 16px", borderRadius: 10,
                    background: "rgba(255,255,255,0.04)",
                    border: "1px solid rgba(255,255,255,0.08)",
                    color: "#94a3b8", fontSize: 12, fontWeight: 600,
                    cursor: "pointer", display: "flex", alignItems: "center", gap: 6,
                    transition: "all 0.2s",
                  }}
                  onMouseEnter={e => e.target.style.background = "rgba(255,255,255,0.08)"}
                  onMouseLeave={e => e.target.style.background = "rgba(255,255,255,0.04)"}
                >
                  <Icon.Download size={13} />
                  Export
                </button>
              </>
            )}
          </div>
        </header>

        {/* ── Messages Area ── */}
        <div style={{
          flex: 1, overflowY: "auto", padding: "16px 0",
          scrollBehavior: "smooth",
        }}>
          <div style={{ maxWidth: 900, margin: "0 auto" }}>
            {messages.map((msg, i) => (
              <MessageBubble key={msg.id} msg={msg} index={i} />
            ))}

            {isAsking && (
              <div style={{ padding: "8px 20px", display: "flex", gap: 14, alignItems: "flex-start" }}>
                <div style={{
                  width: 36, height: 36, borderRadius: 12, flexShrink: 0,
                  background: "linear-gradient(135deg, #8b5cf6, #06b6d4)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  boxShadow: "0 0 20px rgba(139,92,246,0.2)",
                }}>
                  <Icon.Sparkle size={16} />
                </div>
                <TypingIndicator />
              </div>
            )}

            {askError && (
              <div className="animate-slide-up" style={{
                margin: "8px 20px", padding: "10px 14px", borderRadius: 10,
                background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.15)",
                fontSize: 12, color: "#fb7185",
              }}>
                {askError}
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>
        </div>

        {/* ── Suggestion Chips ── */}
        {fileInfo && messages.length <= 3 && (
          <div style={{
            display: "flex", justifyContent: "center", gap: 8,
            padding: "0 24px 12px", flexWrap: "wrap",
          }}>
            {SUGGESTIONS.map((s, i) => (
              <button
                key={i}
                onClick={() => { setQuestion(s.text); setTimeout(handleAsk, 50); }}
                className="animate-fade-in"
                style={{
                  padding: "8px 16px", borderRadius: 20,
                  background: "rgba(255,255,255,0.03)",
                  border: "1px solid rgba(255,255,255,0.08)",
                  color: "#94a3b8", fontSize: 12, cursor: "pointer",
                  display: "flex", alignItems: "center", gap: 6,
                  transition: "all 0.2s",
                  animationDelay: `${i * 0.1}s`,
                }}
                onMouseEnter={e => {
                  e.target.style.background = `${s.color}15`;
                  e.target.style.borderColor = `${s.color}40`;
                  e.target.style.color = s.color;
                }}
                onMouseLeave={e => {
                  e.target.style.background = "rgba(255,255,255,0.03)";
                  e.target.style.borderColor = "rgba(255,255,255,0.08)";
                  e.target.style.color = "#94a3b8";
                }}
              >
                <span>{s.icon}</span>
                {s.text}
              </button>
            ))}
          </div>
        )}

        {/* ── Input Area ── */}
        <div style={{
          padding: "12px 24px 20px",
          background: "linear-gradient(180deg, transparent 0%, rgba(6,8,13,0.8) 30%)",
        }}>
          <div style={{
            maxWidth: 900, margin: "0 auto",
            display: "flex", alignItems: "flex-end", gap: 10,
            background: "rgba(17,24,39,0.6)",
            backdropFilter: "blur(20px)",
            border: "1px solid rgba(255,255,255,0.08)",
            borderRadius: 18, padding: "6px 8px 6px 16px",
            transition: "all 0.3s",
            boxShadow: "0 4px 24px rgba(0,0,0,0.3)",
          }}>
            {/* Attach Button */}
            <button
              onClick={() => fileInputRef.current?.click()}
              style={{
                width: 38, height: 38, borderRadius: 12, border: "none",
                background: "transparent", color: "#64748b",
                cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
                transition: "all 0.2s", flexShrink: 0,
              }}
              onMouseEnter={e => e.target.style.color = "#8b5cf6"}
              onMouseLeave={e => e.target.style.color = "#64748b"}
            >
              <Icon.Clip size={18} />
            </button>

            {/* Text Input */}
            <textarea
              ref={inputRef}
              value={question}
              onChange={e => setQuestion(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={fileInfo ? "Ask anything about your document..." : "Upload a PDF to start analyzing..."}
              rows={1}
              style={{
                flex: 1, resize: "none", border: "none", outline: "none",
                background: "transparent", color: "#e2e8f0",
                fontSize: 14, lineHeight: 1.6,
                fontFamily: "'Inter', sans-serif",
                maxHeight: 180, padding: "8px 0",
              }}
            />

            {/* Send Button */}
            <button
              onClick={handleAsk}
              disabled={!question.trim() || isAsking}
              style={{
                width: 40, height: 40, borderRadius: 12, border: "none",
                background: question.trim() && !isAsking
                  ? "linear-gradient(135deg, #8b5cf6, #06b6d4)"
                  : "rgba(255,255,255,0.05)",
                color: question.trim() && !isAsking ? "#fff" : "#334155",
                cursor: question.trim() && !isAsking ? "pointer" : "default",
                display: "flex", alignItems: "center", justifyContent: "center",
                transition: "all 0.3s", flexShrink: 0,
                boxShadow: question.trim() && !isAsking ? "0 0 20px rgba(139,92,246,0.3)" : "none",
              }}
            >
              <Icon.Send size={16} />
            </button>
          </div>

          {/* Footer */}
          <div style={{
            textAlign: "center", marginTop: 10,
            fontSize: 10, color: "#334155",
            fontFamily: "'JetBrains Mono', monospace",
            letterSpacing: "0.08em",
          }}>
            RESEARCHAI ENGINE V3.0 · POWERED BY QUANTUM SEMANTIC INDEXING
          </div>
        </div>
      </main>
    </div>
  );
}
