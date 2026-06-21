import { useState, useRef, useEffect, useCallback } from "react";
import jsPDF from "jspdf";

/**
 * Enterprise AI Research Assistant — Workspace Interface
 *
 * Talks to a backend exposing:
 * POST /upload  (multipart/form-data, field "file") -> { filename, total_chunks }
 * POST /ask     (json { question, history })         -> { answer, sources }
 * POST /summary ()                                   -> { summary }
 */

const API_BASE = "http://127.0.0.1:8000";
const MAX_FILE_MB = 25;

// Premium Studio Theme Palette
const theme = {
  bgBase: "#090B0F",
  glassBg: "rgba(18, 23, 31, 0.65)",
  glassBorder: "rgba(255, 255, 255, 0.08)",
  line: "rgba(255, 255, 255, 0.12)",
  parchment: "#F8F9FA",
  muted: "#94A3B8",
  brassBase: "#E5C07B",
  brassGlow: "rgba(229, 192, 123, 0.3)",
  brassGradient: "linear-gradient(135deg, #FAD980 0%, #D4AF37 100%)",
  moss: "#4ADE80",
  rust: "#EF4444",
  userBubble: "linear-gradient(135deg, #1E293B 0%, #0F172A 100%)",
};

const SUGGESTED_QUESTIONS = [
  "Generate an executive summary",
  "Extract the key metrics",
  "Identify the main characters",
  "What are the core arguments?",
];

// Secure unique ID generation for message mapping
function uid() {
  return `msg_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

// --- High-Fidelity SVG Icons ---
const IconBot = ({ size = 16, className = "" }) => (
  <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <rect x="4" y="8" width="16" height="11" rx="2.5" />
    <path d="M12 8V4" />
    <circle cx="12" cy="3" r="1.2" fill="currentColor" stroke="none" />
    <circle cx="9" cy="13.5" r="1.1" fill="currentColor" stroke="none" />
    <circle cx="15" cy="13.5" r="1.1" fill="currentColor" stroke="none" />
    <path d="M9 17h6" />
  </svg>
);

const IconUser = ({ size = 16, className = "" }) => (
  <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <circle cx="12" cy="8" r="3.5" />
    <path d="M5 20c1.2-3.6 4-5.5 7-5.5s5.8 1.9 7 5.5" />
  </svg>
);

const IconUpload = ({ size = 18, className = "" }) => (
  <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="M12 16V4" />
    <path d="M7 9l5-5 5 5" />
    <path d="M4 16v3a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-3" />
  </svg>
);

const IconSend = ({ size = 15, className = "" }) => (
  <svg viewBox="0 0 24 24" width={size} height={size} fill="currentColor" className={className}>
    <path d="M3.4 20.6 21 12 3.4 3.4 3 10l12 2-12 2 .4 6.6Z" />
  </svg>
);

const IconClose = ({ size = 14, className = "" }) => (
  <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" className={className}>
    <path d="M6 6l12 12M18 6 6 18" />
  </svg>
);

const IconMenu = ({ size = 18, className = "" }) => (
  <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" className={className}>
    <path d="M4 7h16M4 12h16M4 17h16" />
  </svg>
);

const TypingDots = () => (
  <span className="hra-typing">
    <span /><span /><span />
  </span>
);

const ErrorBanner = ({ message, onDismiss }) => {
  if (!message) return null;
  return (
    <div className="flex items-start gap-3 text-[13px] rounded-xl px-4 py-3 border hra-glass-panel animate-in fade-in slide-in-from-top-2" style={{ borderColor: theme.rust, color: theme.rust }} role="alert">
      <span className="flex-1 leading-relaxed font-medium mt-0.5">{message}</span>
      <button onClick={onDismiss} aria-label="Dismiss error" className="shrink-0 leading-none text-lg hover:opacity-70 transition-opacity p-1 -mr-2 -mt-1">×</button>
    </div>
  );
};

export default function HomeGPT() {
  // Application State
  const [file, setFile] = useState(null);
  const [fileInfo, setFileInfo] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState(null);
  const [isDragging, setIsDragging] = useState(false);

  const [summary, setSummary] = useState("");
  const [isGeneratingSummary, setIsGeneratingSummary] = useState(false);

  const [question, setQuestion] = useState("");
  const [isAsking, setIsAsking] = useState(false);
  const [askError, setAskError] = useState(null);
  const [messages, setMessages] = useState([
    {
      id: uid(),
      role: "assistant",
      content: "Welcome to your Intelligence Workspace. Upload a document to initialize the analysis.",
    },
  ]);
  
  const [questionsAsked, setQuestionsAsked] = useState(0);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Refs for DOM manipulation and AbortControllers
  const fileInputRef = useRef(null);
  const inputRef = useRef(null);
  const messagesEndRef = useRef(null);
  const uploadAbortRef = useRef(null);
  const askAbortRef = useRef(null);
  const summaryAbortRef = useRef(null);

  // Auto-scroll to bottom of chat
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, isAsking, summary]);

  // Clean up network requests on unmount to prevent memory leaks
  useEffect(() => {
    return () => {
      uploadAbortRef.current?.abort();
      askAbortRef.current?.abort();
      summaryAbortRef.current?.abort();
    };
  }, []);

  // Dynamic textarea resizing
  const adjustTextareaHeight = useCallback(() => {
    const textarea = inputRef.current;
    if (textarea) {
      textarea.style.height = "auto";
      textarea.style.height = `${Math.min(textarea.scrollHeight, 120)}px`;
    }
  }, []);

  useEffect(() => {
    adjustTextareaHeight();
  }, [question, adjustTextareaHeight]);

  const validateFile = (f) => {
    if (!f) return "Please select a valid file.";
    const looksLikePdf = f.type === "application/pdf" || f.name.toLowerCase().endsWith(".pdf");
    if (!looksLikePdf) return "Invalid format. Only PDF documents are supported.";
    if (f.size > MAX_FILE_MB * 1024 * 1024) return `File exceeds the ${MAX_FILE_MB}MB limit.`;
    return null;
  };

  const handleFileSelect = (selected) => {
    const err = validateFile(selected);
    if (err) {
      setUploadError(err);
      return;
    }
    setUploadError(null);
    setFile(selected);
  };

  // Drag & Drop Handlers
  const handleDragOver = (e) => { e.preventDefault(); if (!isDragging) setIsDragging(true); };
  const handleDragLeave = () => setIsDragging(false);
  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    const dropped = e.dataTransfer.files?.[0];
    if (dropped) handleFileSelect(dropped);
  };

  const handleUpload = async () => {
    const err = validateFile(file);
    if (err) return setUploadError(err);
    if (isUploading) return;

    const formData = new FormData();
    formData.append("file", file);

    const controller = new AbortController();
    uploadAbortRef.current = controller;

    setIsUploading(true);
    setUploadError(null);

    try {
      const res = await fetch(`${API_BASE}/upload`, { method: "POST", body: formData, signal: controller.signal });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.detail || `Server synchronization failed (${res.status}).`);
      }
      const data = await res.json();
      setFileInfo({ filename: data.filename, chunks: data.total_chunks, status: "Indexed" });
      setMessages((prev) => [...prev, { id: uid(), role: "assistant", content: `Document "${data.filename}" successfully indexed. The workspace is ready for your queries.` }]);
      setFile(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
    } catch (error) {
      if (error.name === "AbortError") return;
      setUploadError(error.message || "Upload failed. Please verify your connection to the intelligence server.");
    } finally {
      setIsUploading(false);
      uploadAbortRef.current = null;
    }
  };

  const handleAsk = async () => {
    const trimmed = question.trim();
    if (!trimmed || isAsking) return;

    // Capture the history before updating the UI with the new message
    const chatHistory = messages.map((msg) => ({
      role: msg.role,
      content: msg.content,
    }));

    setMessages((prev) => [...prev, { id: uid(), role: "user", content: trimmed }]);
    setQuestionsAsked((prev) => prev + 1);
    setQuestion("");
    setAskError(null);

    if (inputRef.current) {
      inputRef.current.style.height = "auto";
    }

    const controller = new AbortController();
    askAbortRef.current = controller;
    setIsAsking(true);

    try {
      const res = await fetch(`${API_BASE}/ask`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          question: trimmed,
          history: chatHistory
        }),
        signal: controller.signal,
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.detail || `Analysis failed (${res.status}).`);
      }
      const data = await res.json();
      setMessages((prev) => [...prev, { id: uid(), role: "assistant", content: data.answer || "No insights were returned.", sources: data.sources || [] }]);
    } catch (error) {
      if (error.name === "AbortError") return;
      const message = error.message || "Failed to process query. Check server status.";
      setAskError(message);
      setMessages((prev) => [...prev, { id: uid(), role: "assistant", content: message, isError: true }]);
    } finally {
      setIsAsking(false);
      askAbortRef.current = null;
      inputRef.current?.focus();
    }
  };

  const handleSummary = async () => {
    if (isGeneratingSummary) return;
    
    const controller = new AbortController();
    summaryAbortRef.current = controller;
    setIsGeneratingSummary(true);
    setAskError(null);

    try {
      const res = await fetch(`${API_BASE}/summary`, { method: "POST", signal: controller.signal });
      if (!res.ok) throw new Error("Failed to compile document summary.");
      const data = await res.json();
      setSummary(data.summary || "Summary generation returned empty.");
    } catch (error) {
      if (error.name === "AbortError") return;
      setAskError(error.message || "Failed to generate summary.");
    } finally {
      setIsGeneratingSummary(false);
      summaryAbortRef.current = null;
    }
  };

  // --- Export Function ---
  const exportSummaryPDF = () => {
    if (!summary) return;

    const doc = new jsPDF();
    doc.setFontSize(18);
    doc.text("AI Research Assistant Report", 20, 20);
    doc.setFontSize(12);

    const lines = doc.splitTextToSize(summary, 170);
    doc.text(lines, 20, 40);

    doc.save("AI_Research_Report.pdf");
  };

  const handleInputKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleAsk();
    }
  };

  const handleNewSession = () => {
    uploadAbortRef.current?.abort();
    askAbortRef.current?.abort();
    summaryAbortRef.current?.abort();
    setMessages([{ id: uid(), role: "assistant", content: "Welcome to your Intelligence Workspace. Upload a document to initialize the analysis." }]);
    setFileInfo(null);
    setFile(null);
    setSummary("");
    setUploadError(null);
    setAskError(null);
    setQuestion("");
    setQuestionsAsked(0);
    if (fileInputRef.current) fileInputRef.current.value = "";
    setSidebarOpen(false);
  };

  return (
    <div className="hra-root flex h-screen w-full overflow-hidden text-white" style={{ backgroundColor: theme.bgBase }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600&family=Space+Grotesk:wght@500;600;700&family=JetBrains+Mono:wght@400;500&display=swap');

        .hra-root {
          font-family: 'Outfit', system-ui, -apple-system, sans-serif;
          background: radial-gradient(circle at 50% 0%, rgba(20, 30, 45, 1) 0%, ${theme.bgBase} 70%);
        }
        
        h1, h2, h3, .hra-font-display { font-family: 'Space Grotesk', sans-serif; }
        .hra-font-mono { font-family: 'JetBrains Mono', monospace; }

        .hra-glass-panel {
          background: ${theme.glassBg};
          backdrop-filter: blur(20px);
          -webkit-backdrop-filter: blur(20px);
          border: 1px solid ${theme.glassBorder};
          box-shadow: 0 10px 40px rgba(0, 0, 0, 0.5);
        }

        .hra-scroll::-webkit-scrollbar { width: 6px; }
        .hra-scroll::-webkit-scrollbar-track { background: transparent; }
        .hra-scroll::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 10px; }
        .hra-scroll::-webkit-scrollbar-thumb:hover { background: rgba(255,255,255,0.25); }

        .hra-text-gradient {
          background: ${theme.brassGradient};
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
        }

        .hra-btn-primary {
          background: ${theme.brassGradient};
          color: #000;
          transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
        }
        .hra-btn-primary:hover:not(:disabled) {
          box-shadow: 0 0 24px ${theme.brassGlow};
          transform: translateY(-2px);
        }
        .hra-btn-primary:active:not(:disabled) {
          transform: translateY(0);
        }

        .hra-input-dock {
          background: rgba(15, 20, 28, 0.75);
          backdrop-filter: blur(16px);
          border: 1px solid rgba(255,255,255,0.1);
          transition: all 0.3s ease;
        }
        .hra-input-dock:focus-within {
          border-color: rgba(229, 192, 123, 0.4);
          box-shadow: 0 0 30px rgba(229, 192, 123, 0.1);
        }

        @keyframes hra-fade-up {
          0% { opacity: 0; transform: translateY(12px) scale(0.99); }
          100% { opacity: 1; transform: translateY(0) scale(1); }
        }
        .hra-msg-in { animation: hra-fade-up 0.45s cubic-bezier(0.2, 0.8, 0.2, 1) forwards; }

        @keyframes pulse-ring {
          0% { box-shadow: 0 0 0 0 rgba(74, 222, 128, 0.5); }
          70% { box-shadow: 0 0 0 8px rgba(74, 222, 128, 0); }
          100% { box-shadow: 0 0 0 0 rgba(74, 222, 128, 0); }
        }
        .hra-status-dot {
          display: inline-block;
          width: 8px; height: 8px;
          border-radius: 50%;
          background: ${theme.moss};
          animation: pulse-ring 2s infinite cubic-bezier(0.4, 0, 0.6, 1);
        }

        @keyframes hra-dot {
          0%, 60%, 100% { opacity: 0.3; transform: translateY(0); }
          30% { opacity: 1; transform: translateY(-4px); }
        }
        .hra-typing span {
          display: inline-block; width: 6px; height: 6px;
          border-radius: 50%; background: ${theme.parchment};
          margin: 0 2px; animation: hra-dot 1.2s infinite ease-in-out;
        }
        .hra-typing span:nth-child(2) { animation-delay: 0.15s; }
        .hra-typing span:nth-child(3) { animation-delay: 0.3s; }
      `}</style>

      {/* Mobile Sidebar Backdrop */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-40 bg-black/80 backdrop-blur-md lg:hidden transition-opacity duration-300" onClick={() => setSidebarOpen(false)} aria-hidden="true" />
      )}

      {/* Sidebar Panel */}
      <aside
        className={`fixed lg:relative z-50 w-[340px] h-[calc(100%-2rem)] m-4 rounded-3xl flex flex-col p-6 transition-transform duration-500 ease-out hra-glass-panel ${
          sidebarOpen ? "translate-x-0" : "-translate-x-[120%]"
        } lg:translate-x-0 overflow-y-auto hra-scroll`}
      >
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold tracking-tight hra-text-gradient">Research AI</h1>
            <p className="text-[11px] font-medium tracking-[0.2em] uppercase mt-1 text-white/50">Intelligence Hub</p>
          </div>
          <button className="lg:hidden p-2 text-white/50 hover:text-white transition-colors rounded-lg hover:bg-white/5" onClick={() => setSidebarOpen(false)} aria-label="Close Sidebar">
            <IconClose size={20} />
          </button>
        </div>

        <button
          onClick={handleNewSession}
          className="w-full text-sm font-semibold py-3.5 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 active:scale-[0.98] transition-all text-white/90 shadow-sm"
        >
          + Initialize New Session
        </button>

        {/* Upload & Analytics Section */}
        <div className="mt-8 flex-1 flex flex-col">
          <p className="text-[10px] font-semibold tracking-[0.15em] uppercase mb-3 text-white/40">Data Source Pipeline</p>

          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            className={`relative rounded-2xl p-5 border-2 transition-all duration-300 flex-shrink-0 ${
              isDragging ? "bg-white/10 border-yellow-500/50 scale-[1.02] shadow-xl" : "bg-black/20 border-white/5 hover:border-white/10"
            }`}
          >
            {fileInfo ? (
              <div className="animate-in fade-in slide-in-from-bottom-2">
                <div className="flex items-start justify-between mb-4">
                  <div className="w-[75%]">
                    <p className="text-xs font-medium text-white/50 mb-1">Active Document</p>
                    <p className="text-sm font-semibold truncate text-white/90" title={fileInfo.filename}>{fileInfo.filename}</p>
                  </div>
                  <div className="bg-green-500/10 border border-green-500/20 text-green-400 text-[10px] uppercase font-bold px-2 py-1 rounded shadow-[0_0_10px_rgba(74,222,128,0.1)] flex items-center gap-1.5 shrink-0">
                    <span className="hra-status-dot"></span> Ready
                  </div>
                </div>
                
                <div className="space-y-2.5 pt-4 border-t border-white/5">
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-white/50 font-medium">Data Chunks</span>
                    <span className="font-mono text-white/90 bg-white/5 px-2 py-0.5 rounded">{fileInfo.chunks}</span>
                  </div>
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-white/50 font-medium">Queries Executed</span>
                    <span className="font-mono text-white/90 bg-white/5 px-2 py-0.5 rounded">{questionsAsked}</span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-center py-5">
                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-white/10 to-transparent flex items-center justify-center mx-auto mb-4 text-white/50 border border-white/5 shadow-inner">
                  <IconUpload size={22} />
                </div>
                <p className="text-sm font-medium text-white/90 mb-1">Drop document here</p>
                <p className="text-xs text-white/40 mb-5">Standard PDF document</p>

                <input ref={fileInputRef} type="file" accept="application/pdf,.pdf" className="hidden" id="hra-file" onChange={(e) => handleFileSelect(e.target.files?.[0])} />
                <label htmlFor="hra-file" tabIndex={0} className="inline-block text-xs font-semibold px-5 py-2.5 rounded-lg bg-white/5 hover:bg-white/10 cursor-pointer transition-all border border-white/10 shadow-sm focus:outline-none focus:ring-2 focus:ring-yellow-500/50">
                  Browse Device
                </label>

                {file && (
                  <div className="mt-5 flex items-center justify-between gap-3 bg-black/40 rounded-lg p-2.5 border border-white/5 animate-in fade-in">
                    <span className="text-xs truncate text-white/80 pl-1 font-medium">{file.name}</span>
                    <button onClick={() => setFile(null)} className="p-1.5 bg-white/5 hover:bg-white/10 rounded-md text-white/50 hover:text-white transition-colors" aria-label="Remove file">
                      <IconClose size={12}/>
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          {file && !fileInfo && (
            <div className="mt-4 animate-in slide-in-from-top-2">
              <button
                onClick={handleUpload}
                disabled={isUploading}
                className="hra-btn-primary w-full text-sm font-bold py-3.5 rounded-xl flex justify-center items-center gap-2 shadow-lg"
              >
                {isUploading ? (
                  <><span className="inline-block w-4 h-4 border-2 border-black/20 border-t-black rounded-full animate-spin"/> Indexing Vault...</>
                ) : "Upload & Secure Index"}
              </button>
            </div>
          )}

          {uploadError && <div className="mt-4"><ErrorBanner message={uploadError} onDismiss={() => setUploadError(null)} /></div>}
        </div>
        
        <div className="mt-auto pt-6 text-center">
          <p className="text-[10px] uppercase tracking-widest text-white/20 font-semibold flex items-center justify-center gap-2">
            <span className="w-2 h-2 rounded-full bg-green-500/50"></span> System Online
          </p>
        </div>
      </aside>

      {/* Main Workspace Area */}
      <div className="flex-1 flex flex-col min-w-0 relative h-full">
        
        {/* Top Navigation Bar */}
        <header className="absolute top-0 w-full z-20 px-6 py-4 flex items-center justify-between hra-glass-panel border-x-0 border-t-0 border-b border-white/5 rounded-none shadow-sm">
          <div className="flex items-center gap-4">
            <button className="lg:hidden p-2 -ml-2 text-white/60 hover:text-white hover:bg-white/5 rounded-lg transition-colors" onClick={() => setSidebarOpen(true)} aria-label="Open Menu">
              <IconMenu size={22} />
            </button>
            <div>
              <h2 className="text-lg font-bold text-white/90 tracking-tight">Analysis Canvas</h2>
              <p className="text-xs text-white/40 hidden sm:block font-medium mt-0.5">End-to-end encrypted session</p>
            </div>
          </div>
          
          <button
            onClick={handleSummary}
            disabled={!fileInfo || isGeneratingSummary}
            className="px-4 py-2 rounded-lg text-sm font-semibold transition-all flex items-center gap-2 disabled:opacity-30 border border-white/10 hover:bg-white/5 disabled:hover:bg-transparent"
            style={{ color: theme.brassBase }}
          >
            {isGeneratingSummary ? (
              <span className="inline-block w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
            ) : "✨ Execute Summary"}
          </button>
        </header>

        {/* Chat Conversation Scroll Area */}
        <div className="flex-1 overflow-y-auto px-4 sm:px-8 pt-28 pb-40 hra-scroll">
          <div className="max-w-3xl mx-auto flex flex-col gap-6">
            
            {messages.map((msg) => (
              <div key={msg.id} className={`hra-msg-in flex gap-4 ${msg.role === "user" ? "flex-row-reverse" : ""}`}>
                <div
                  className="shrink-0 w-9 h-9 sm:w-10 sm:h-10 rounded-full flex items-center justify-center shadow-lg"
                  style={{
                    background: msg.role === "user" ? theme.brassGradient : theme.glassBg,
                    border: msg.role === "assistant" ? `1px solid ${theme.glassBorder}` : 'none',
                    color: msg.role === "user" ? '#000' : theme.parchment,
                  }}
                >
                  {msg.role === "user" ? <IconUser size={18} /> : <IconBot size={18} />}
                </div>
                
                <div
                  className={`max-w-[85%] sm:max-w-[75%] px-5 py-4 text-[15px] leading-relaxed whitespace-pre-wrap shadow-xl ${
                    msg.role === "user" ? "rounded-2xl rounded-tr-sm text-white/95 font-medium" : "rounded-2xl rounded-tl-sm hra-glass-panel"
                  }`}
                  style={{
                    background: msg.role === "user" ? theme.userBubble : undefined,
                    border: msg.isError ? `1px solid ${theme.rust}` : msg.role === "user" ? "1px solid rgba(255,255,255,0.05)" : undefined,
                  }}
                >
                  <div>{msg.content}</div>

                  {msg.sources && msg.sources.length > 0 && (
                    <div className="mt-4 pt-3 border-t border-white/5 text-[11px]">
                      <div className="mb-2 font-semibold tracking-wider text-white/30 uppercase">Attributed Sources</div>
                      <div className="flex flex-wrap gap-2">
                        {msg.sources.map((source, idx) => {
                          const chunkId = source.split("_chunk_")[1] || source;
                          return (
                            <span key={idx} className="bg-black/40 border border-white/10 px-2 py-1 rounded text-white/60 font-mono shadow-inner">
                              Node {chunkId}
                            </span>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ))}

            {isAsking && (
              <div className="hra-msg-in flex gap-4">
                <div className="shrink-0 w-9 h-9 sm:w-10 sm:h-10 rounded-full flex items-center justify-center hra-glass-panel shadow-lg border border-white/10">
                  <IconBot size={18} className="text-white/80" />
                </div>
                <div className="px-6 py-5 rounded-2xl rounded-tl-sm hra-glass-panel shadow-xl flex items-center border border-white/5">
                  <TypingDots />
                </div>
              </div>
            )}

            {!fileInfo && messages.length <= 1 && (
              <div className="mt-8 pt-8 border-t border-white/5 animate-in fade-in delay-200 duration-700 fill-mode-both">
                <p className="text-[11px] font-semibold uppercase tracking-widest text-white/30 mb-4 ml-1">Suggested Protocols</p>
                <div className="flex flex-wrap gap-3">
                  {SUGGESTED_QUESTIONS.map((q) => (
                    <button
                      key={q}
                      onClick={() => { setQuestion(q); inputRef.current?.focus(); }}
                      className="text-sm px-4 py-2.5 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 transition-all text-white/70 hover:text-white hover:border-white/20 active:scale-[0.98]"
                    >
                      {q}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {summary && (
              <div className="mt-6 p-6 rounded-2xl border hra-glass-panel shadow-2xl relative overflow-hidden animate-in slide-in-from-bottom-4">
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-yellow-500/50 to-transparent"></div>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-bold flex items-center gap-2" style={{ color: theme.brassBase }}>
                    ✨ Executive Summary Report
                  </h3>
                  <button
                    onClick={exportSummaryPDF}
                    className="hra-btn-primary px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 shadow-md border border-black/10"
                  >
                    ⬇ Export PDF
                  </button>
                </div>
                <div className="whitespace-pre-wrap text-[15px] leading-relaxed text-white/80">
                  {summary}
                </div>
              </div>
            )}

            <div ref={messagesEndRef} className="h-4" />
          </div>
        </div>

        {/* Floating Input Controller */}
        <div className="absolute bottom-0 w-full p-4 sm:p-6 bg-gradient-to-t from-[#090B0F] via-[#090B0F]/90 to-transparent pointer-events-none z-30">
          <div className="max-w-3xl mx-auto pointer-events-auto">
            {askError && (
              <div className="mb-3 transform translate-y-2">
                <ErrorBanner message={askError} onDismiss={() => setAskError(null)} />
              </div>
            )}
            
            <div className="hra-input-dock flex items-end gap-3 rounded-2xl p-2 sm:p-3 shadow-2xl relative">
              <textarea
                ref={inputRef}
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                onKeyDown={handleInputKeyDown}
                placeholder={fileInfo ? "Draft your query here..." : "Awaiting document upload..."}
                disabled={isAsking}
                rows={1}
                className="flex-1 bg-transparent outline-none text-[15px] px-3 py-2 sm:py-2.5 resize-none text-white/90 placeholder-white/30 disabled:opacity-50 font-medium hra-scroll leading-relaxed"
              />
              <button
                onClick={handleAsk}
                disabled={isAsking || !question.trim()}
                aria-label="Submit Query"
                className="shrink-0 w-10 h-10 sm:w-12 sm:h-12 rounded-xl flex items-center justify-center transition-all disabled:opacity-30 disabled:cursor-not-allowed hra-btn-primary mb-0.5"
              >
                {isAsking ? (
                  <span className="inline-block w-5 h-5 border-[2.5px] border-black/20 border-t-black rounded-full animate-spin" />
                ) : (
                  <IconSend size={18} className="transform translate-x-[1px] translate-y-[-1px]" />
                )}
              </button>
            </div>
            <div className="text-center mt-4">
              <span className="text-[10px] text-white/20 uppercase tracking-[0.2em] font-semibold">Research AI Engine v2.0 • Secured Workspace</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}