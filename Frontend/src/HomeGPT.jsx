import { useState, useRef, useEffect, useCallback } from "react";
import jsPDF from "jspdf";

/**
 * Enterprise AI Research Assistant — Executive Workspace
 */

const API_URL = import.meta.env.VITE_API_URL;
const MAX_FILE_MB = 10000000;

// Premium Minimalist Light Theme Palette
const theme = {
  bgApp: "#F7F7F8",
  bgSidebar: "#FFFFFF",
  bgCanvas: "#FFFFFF",
  border: "#E5E5E5",
  textMain: "#171717",
  textMuted: "#737373",
  accent: "#000000",
  accentHover: "#262626",
  userBubble: "#F4F4F5",
  botBubble: "#FFFFFF",
  errorBg: "#FEF2F2",
  errorText: "#991B1B",
  errorBorder: "#FCA5A5",
};

const SUGGESTED_QUESTIONS = [
  "Generate an executive summary",
  "Extract the key metrics",
  "Identify the main characters",
  "What are the core arguments?",
];

function uid() {
  return `msg_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

// --- Ultra-Clean SVG Icons ---
const IconBot = ({ size = 18, className = "" }) => (
  <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <rect x="3" y="11" width="18" height="10" rx="2" />
    <circle cx="12" cy="5" r="2" />
    <path d="M12 7v4" />
    <line x1="8" y1="16" x2="8" y2="16.01" />
    <line x1="16" y1="16" x2="16" y2="16.01" />
  </svg>
);

const IconUser = ({ size = 18, className = "" }) => (
  <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
    <circle cx="12" cy="7" r="4" />
  </svg>
);

const IconUpload = ({ size = 20, className = "" }) => (
  <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
    <polyline points="17 8 12 3 7 8" />
    <line x1="12" y1="3" x2="12" y2="15" />
  </svg>
);

const IconSend = ({ size = 16, className = "" }) => (
  <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <line x1="22" y1="2" x2="11" y2="13" />
    <polygon points="22 2 15 22 11 13 2 9 22 2" />
  </svg>
);

const IconClose = ({ size = 16, className = "" }) => (
  <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <line x1="18" y1="6" x2="6" y2="18" />
    <line x1="6" y1="6" x2="18" y2="18" />
  </svg>
);

const IconMenu = ({ size = 20, className = "" }) => (
  <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <line x1="3" y1="12" x2="21" y2="12" />
    <line x1="3" y1="6" x2="21" y2="6" />
    <line x1="3" y1="18" x2="21" y2="18" />
  </svg>
);

const IconFile = ({ size = 16, className = "" }) => (
  <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
    <polyline points="14 2 14 8 20 8" />
    <line x1="16" y1="13" x2="8" y2="13" />
    <line x1="16" y1="17" x2="8" y2="17" />
    <polyline points="10 9 9 9 8 9" />
  </svg>
);

const TypingIndicator = () => (
  <div className="flex items-center gap-1.5 px-2 py-1">
    <div className="w-1.5 h-1.5 bg-neutral-400 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
    <div className="w-1.5 h-1.5 bg-neutral-400 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
    <div className="w-1.5 h-1.5 bg-neutral-400 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
  </div>
);

const ErrorBanner = ({ message, onDismiss }) => {
  if (!message) return null;
  return (
    <div className="flex items-start gap-3 text-sm rounded-lg px-4 py-3 border shadow-sm animate-in fade-in slide-in-from-top-2" style={{ backgroundColor: theme.errorBg, borderColor: theme.errorBorder, color: theme.errorText }} role="alert">
      <span className="flex-1 font-medium leading-relaxed">{message}</span>
      <button onClick={onDismiss} aria-label="Dismiss error" className="shrink-0 p-1 hover:opacity-70 transition-opacity">
        <IconClose size={14} />
      </button>
    </div>
  );
};

export default function HomeGPT() {
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
      content: "Welcome to the workspace. Please upload a PDF document to begin the analysis.",
    },
  ]);
  
  const [questionsAsked, setQuestionsAsked] = useState(0);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const fileInputRef = useRef(null);
  const inputRef = useRef(null);
  const messagesEndRef = useRef(null);
  const uploadAbortRef = useRef(null);
  const askAbortRef = useRef(null);
  const summaryAbortRef = useRef(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, isAsking, summary]);

  useEffect(() => {
    return () => {
      uploadAbortRef.current?.abort();
      askAbortRef.current?.abort();
      summaryAbortRef.current?.abort();
    };
  }, []);

  const adjustTextareaHeight = useCallback(() => {
    const textarea = inputRef.current;
    if (textarea) {
      textarea.style.height = "auto";
      textarea.style.height = `${Math.min(textarea.scrollHeight, 150)}px`;
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
      const res = await fetch(`${API_URL}/upload`, { method: "POST", body: formData, signal: controller.signal });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.detail || `Server synchronization failed (${res.status}).`);
      }
      const data = await res.json();
      setFileInfo({ filename: data.filename, chunks: data.total_chunks, status: "Indexed" });
      setMessages((prev) => [...prev, { id: uid(), role: "assistant", content: `Document "${data.filename}" has been securely indexed. You may now begin your queries.` }]);
      setFile(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
    } catch (error) {
      if (error.name === "AbortError") return;
      setUploadError(error.message || "Upload failed. Please verify your server connection.");
    } finally {
      setIsUploading(false);
      uploadAbortRef.current = null;
    }
  };

  const handleAsk = async () => {
    const trimmed = question.trim();
    if (!trimmed || isAsking) return;

    const chatHistory = messages.map((msg) => ({
      role: msg.role,
      content: msg.content,
    }));

    setMessages((prev) => [...prev, { id: uid(), role: "user", content: trimmed }]);
    setQuestionsAsked((prev) => prev + 1);
    setQuestion("");
    setAskError(null);

    if (inputRef.current) inputRef.current.style.height = "auto";

    const controller = new AbortController();
    askAbortRef.current = controller;
    setIsAsking(true);

    try {
      const res = await fetch(`${API_URL}/ask`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: trimmed, history: chatHistory }),
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
    // Ensures the filename is present before calling the backend
    if (isGeneratingSummary || !fileInfo || !fileInfo.filename) return;
    
    const controller = new AbortController();
    summaryAbortRef.current = controller;
    setIsGeneratingSummary(true);
    setAskError(null);

    try {
      const res = await fetch(`${API_URL}/summary`, { 
        method: "POST", 
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ filename: fileInfo.filename }),
        signal: controller.signal 
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.detail || `Failed to compile document summary.`);
      }
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

  const exportSummaryPDF = () => {
    if (!summary) return;
    const doc = new jsPDF();
    doc.setFontSize(16);
    doc.text("Executive Summary Report", 20, 20);
    doc.setFontSize(11);
    const lines = doc.splitTextToSize(summary, 170);
    doc.text(lines, 20, 35);
    doc.save("Executive_Summary.pdf");
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
    setMessages([{ id: uid(), role: "assistant", content: "Welcome to the workspace. Please upload a PDF document to begin the analysis." }]);
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
    <div className="flex h-screen w-full overflow-hidden antialiased selection:bg-neutral-200" style={{ backgroundColor: theme.bgApp, color: theme.textMain, fontFamily: "'Inter', system-ui, sans-serif" }}>
      
      {/* Mobile Sidebar Backdrop */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-40 bg-black/20 backdrop-blur-sm lg:hidden transition-opacity" onClick={() => setSidebarOpen(false)} />
      )}

      {/* Sidebar Panel */}
      <aside
        className={`fixed lg:relative z-50 w-[320px] h-full flex flex-col transition-transform duration-300 ease-in-out border-r shadow-[4px_0_24px_rgba(0,0,0,0.02)] ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        } lg:translate-x-0 overflow-y-auto`}
        style={{ backgroundColor: theme.bgSidebar, borderColor: theme.border }}
      >
        <div className="p-6 flex flex-col h-full">
          {/* Header */}
          <div className="flex items-center justify-between mb-8">
            <div>
              <h1 className="text-xl font-bold tracking-tight">Research UI</h1>
              <p className="text-xs font-medium tracking-widest uppercase mt-1" style={{ color: theme.textMuted }}>Executive Hub</p>
            </div>
            <button className="lg:hidden p-2 rounded-md hover:bg-neutral-100 transition-colors" onClick={() => setSidebarOpen(false)}>
              <IconClose size={20} />
            </button>
          </div>

          <button
            onClick={handleNewSession}
            className="w-full text-sm font-semibold py-2.5 px-4 rounded-lg border shadow-sm hover:shadow transition-all active:scale-[0.98] flex items-center justify-center gap-2"
            style={{ borderColor: theme.border, backgroundColor: theme.bgCanvas }}
          >
            <span className="text-lg leading-none mb-0.5">+</span> New Workspace
          </button>

          {/* Upload Section */}
          <div className="mt-8 flex-1 flex flex-col">
            <p className="text-xs font-semibold tracking-wider uppercase mb-3" style={{ color: theme.textMuted }}>Data Source</p>

            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              className={`relative rounded-xl p-5 border-2 border-dashed transition-all duration-200 ${
                isDragging ? "border-black bg-neutral-50 scale-[1.02]" : "border-neutral-200 bg-neutral-50/50 hover:bg-neutral-50 hover:border-neutral-300"
              }`}
            >
              {fileInfo ? (
                <div className="animate-in fade-in zoom-in-95 duration-300">
                  <div className="flex items-start justify-between mb-4">
                    <div className="w-[75%]">
                      <p className="text-[11px] font-medium mb-1 uppercase tracking-wider" style={{ color: theme.textMuted }}>Active File</p>
                      <p className="text-sm font-semibold truncate" title={fileInfo.filename}>{fileInfo.filename}</p>
                    </div>
                    <div className="bg-emerald-100 text-emerald-700 border border-emerald-200 text-[10px] uppercase font-bold px-2 py-1 rounded flex items-center gap-1.5 shrink-0">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span> Ready
                    </div>
                  </div>
                  
                  <div className="space-y-3 pt-4 border-t border-neutral-200">
                    <div className="flex justify-between items-center text-xs">
                      <span className="font-medium" style={{ color: theme.textMuted }}>Document Nodes</span>
                      <span className="font-mono bg-white border border-neutral-200 px-2 py-0.5 rounded shadow-sm">{fileInfo.chunks}</span>
                    </div>
                    <div className="flex justify-between items-center text-xs">
                      <span className="font-medium" style={{ color: theme.textMuted }}>Queries Run</span>
                      <span className="font-mono bg-white border border-neutral-200 px-2 py-0.5 rounded shadow-sm">{questionsAsked}</span>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-center py-4">
                  <div className="w-12 h-12 rounded-full bg-white shadow-sm flex items-center justify-center mx-auto mb-3 border border-neutral-100 text-neutral-600">
                    <IconUpload size={20} />
                  </div>
                  <p className="text-sm font-semibold mb-1">Upload Document</p>
                  <p className="text-xs mb-4" style={{ color: theme.textMuted }}>Drag & drop your PDF here</p>

                  <input ref={fileInputRef} type="file" accept="application/pdf,.pdf" className="hidden" id="hra-file" onChange={(e) => handleFileSelect(e.target.files?.[0])} />
                  <label htmlFor="hra-file" className="inline-block text-xs font-semibold px-4 py-2 rounded-md bg-white border border-neutral-200 shadow-sm hover:bg-neutral-50 cursor-pointer transition-colors">
                    Browse Files
                  </label>

                  {file && (
                    <div className="mt-5 flex items-center justify-between gap-3 bg-white rounded-md p-2.5 border shadow-sm animate-in fade-in">
                      <IconFile size={14} className="text-neutral-400 shrink-0" />
                      <span className="text-xs truncate font-medium flex-1 text-left">{file.name}</span>
                      <button onClick={() => setFile(null)} className="p-1 hover:bg-neutral-100 rounded text-neutral-400 hover:text-black transition-colors" aria-label="Remove">
                        <IconClose size={14}/>
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
                  className="w-full text-sm font-bold py-3 rounded-lg flex justify-center items-center gap-2 shadow-md transition-transform active:scale-[0.98] disabled:opacity-50 disabled:active:scale-100 text-white"
                  style={{ backgroundColor: theme.accent }}
                >
                  {isUploading ? (
                    <><span className="inline-block w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin"/> Processing...</>
                  ) : "Index Document"}
                </button>
              </div>
            )}

            <div className="mt-4">
              <ErrorBanner message={uploadError} onDismiss={() => setUploadError(null)} />
            </div>
          </div>
          
          <div className="mt-auto pt-6 text-center border-t" style={{ borderColor: theme.border }}>
            <p className="text-[10px] uppercase tracking-widest font-semibold flex items-center justify-center gap-2" style={{ color: theme.textMuted }}>
              Secured Connection
            </p>
          </div>
        </div>
      </aside>

      {/* Main Workspace Area */}
      <div className="flex-1 flex flex-col min-w-0 relative bg-white">
        
        {/* Top Navigation Bar */}
        <header className="absolute top-0 w-full z-20 px-6 py-4 flex items-center justify-between bg-white/80 backdrop-blur-md border-b" style={{ borderColor: theme.border }}>
          <div className="flex items-center gap-3">
            <button className="lg:hidden p-2 -ml-2 rounded-md hover:bg-neutral-100 transition-colors" onClick={() => setSidebarOpen(true)}>
              <IconMenu size={20} />
            </button>
            <h2 className="text-sm font-bold tracking-tight">Analysis Canvas</h2>
          </div>
          
          <button
            onClick={handleSummary}
            disabled={!fileInfo || isGeneratingSummary}
            className="px-4 py-2 rounded-md text-xs font-bold transition-all flex items-center gap-2 disabled:opacity-40 border shadow-sm hover:shadow hover:bg-neutral-50 disabled:hover:bg-white disabled:hover:shadow-sm"
            style={{ borderColor: theme.border }}
          >
            {isGeneratingSummary ? (
              <span className="inline-block w-3.5 h-3.5 border-2 border-black/20 border-t-black rounded-full animate-spin" />
            ) : "Extract Summary"}
          </button>
        </header>

        {/* Chat Conversation Scroll Area */}
        <div className="flex-1 overflow-y-auto px-4 sm:px-8 pt-24 pb-48 scroll-smooth">
          <div className="max-w-3xl mx-auto flex flex-col gap-8">
            
            {messages.map((msg) => (
              <div key={msg.id} className={`flex gap-4 animate-in fade-in slide-in-from-bottom-2 duration-300 ${msg.role === "user" ? "flex-row-reverse" : ""}`}>
                
                {/* Avatar */}
                <div
                  className="shrink-0 w-8 h-8 rounded-full flex items-center justify-center shadow-sm border"
                  style={{
                    backgroundColor: msg.role === "user" ? theme.accent : theme.botBubble,
                    borderColor: msg.role === "user" ? theme.accent : theme.border,
                    color: msg.role === "user" ? "#FFFFFF" : theme.textMain,
                  }}
                >
                  {msg.role === "user" ? <IconUser size={16} /> : <IconBot size={16} />}
                </div>
                
                {/* Message Bubble */}
                <div
                  className={`max-w-[85%] sm:max-w-[75%] px-5 py-3.5 text-[15px] leading-relaxed whitespace-pre-wrap shadow-sm border ${
                    msg.role === "user" ? "rounded-2xl rounded-tr-sm" : "rounded-2xl rounded-tl-sm"
                  }`}
                  style={{
                    backgroundColor: msg.role === "user" ? theme.userBubble : theme.botBubble,
                    borderColor: msg.isError ? theme.errorBorder : theme.border,
                    color: msg.role === "user" ? theme.textMain : theme.textMain,
                  }}
                >
                  <div className={msg.role === "user" ? "font-medium" : ""}>{msg.content}</div>

                  {/* Sources Tag */}
                  {msg.sources && msg.sources.length > 0 && (
                    <div className="mt-3 pt-3 border-t flex flex-wrap gap-2" style={{ borderColor: theme.border }}>
                      <span className="text-[10px] font-bold tracking-widest uppercase mt-0.5" style={{ color: theme.textMuted }}>Sources:</span>
                      {msg.sources.map((source, idx) => {
                        const chunkId = source.split("_chunk_")[1] || source;
                        return (
                          <span key={idx} className="bg-neutral-100 border border-neutral-200 px-1.5 py-0.5 rounded text-[10px] font-mono text-neutral-600">
                            Node {chunkId}
                          </span>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            ))}

            {/* Typing Indicator */}
            {isAsking && (
              <div className="flex gap-4 animate-in fade-in">
                <div className="shrink-0 w-8 h-8 rounded-full flex items-center justify-center shadow-sm border" style={{ backgroundColor: theme.botBubble, borderColor: theme.border }}>
                  <IconBot size={16} />
                </div>
                <div className="px-5 py-4 rounded-2xl rounded-tl-sm border shadow-sm flex items-center" style={{ backgroundColor: theme.botBubble, borderColor: theme.border }}>
                  <TypingIndicator />
                </div>
              </div>
            )}

            {/* Suggested Questions (Empty State) */}
            {!fileInfo && messages.length <= 1 && (
              <div className="mt-6 pt-6 border-t animate-in fade-in delay-150 duration-500" style={{ borderColor: theme.border }}>
                <p className="text-xs font-bold uppercase tracking-widest mb-4" style={{ color: theme.textMuted }}>Suggested Actions</p>
                <div className="flex flex-wrap gap-2">
                  {SUGGESTED_QUESTIONS.map((q) => (
                    <button
                      key={q}
                      onClick={() => { setQuestion(q); inputRef.current?.focus(); }}
                      className="text-sm px-4 py-2 rounded-full border bg-white shadow-sm hover:shadow hover:border-neutral-300 transition-all text-neutral-600 hover:text-black active:scale-[0.98]"
                      style={{ borderColor: theme.border }}
                    >
                      {q}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Summary Report Card */}
            {summary && (
              <div className="mt-4 p-6 pt-8 rounded-2xl border shadow-lg bg-white relative overflow-hidden animate-in slide-in-from-bottom-4 duration-500" style={{ borderColor: theme.border }}>
                <div className="absolute top-0 left-0 w-full h-1 bg-black"></div>
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
                  <h3 className="text-lg font-bold flex items-center gap-2">
                    Executive Summary
                  </h3>
                  <button
                    onClick={exportSummaryPDF}
                    className="px-3 py-1.5 rounded-md text-xs font-bold flex items-center justify-center gap-1.5 border shadow-sm hover:bg-neutral-50 transition-colors"
                    style={{ borderColor: theme.border }}
                  >
                    ⬇ Download PDF
                  </button>
                </div>
                <div className="whitespace-pre-wrap text-[15px] leading-relaxed text-neutral-800">
                  {summary}
                </div>
              </div>
            )}

            <div ref={messagesEndRef} className="h-4" />
          </div>
        </div>

        {/* Floating Input Controller */}
        <div className="absolute bottom-0 w-full p-4 sm:p-6 bg-gradient-to-t from-white via-white/90 to-transparent pointer-events-none z-30">
          <div className="max-w-3xl mx-auto pointer-events-auto">
            
            <div className="mb-3">
              <ErrorBanner message={askError} onDismiss={() => setAskError(null)} />
            </div>
            
            <div className="flex items-end gap-2 rounded-2xl p-2 shadow-[0_8px_30px_rgb(0,0,0,0.08)] border bg-white focus-within:border-black focus-within:ring-4 focus-within:ring-black/5 transition-all" style={{ borderColor: theme.border }}>
              <textarea
                ref={inputRef}
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                onKeyDown={handleInputKeyDown}
                placeholder={fileInfo ? "Ask a question about the document..." : "Upload a file to begin..."}
                disabled={isAsking}
                rows={1}
                className="flex-1 bg-transparent outline-none text-[15px] px-3 py-2.5 resize-none text-black placeholder-neutral-400 disabled:opacity-50 font-medium scroll-smooth leading-relaxed"
              />
              <button
                onClick={handleAsk}
                disabled={isAsking || !question.trim()}
                aria-label="Submit Query"
                className="shrink-0 w-10 h-10 rounded-xl flex items-center justify-center transition-transform active:scale-95 disabled:opacity-30 disabled:active:scale-100 text-white"
                style={{ backgroundColor: theme.accent }}
              >
                {isAsking ? (
                  <span className="inline-block w-4 h-4 border-[2px] border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <IconSend size={18} className="transform translate-x-[1px]" />
                )}
              </button>
            </div>
            <div className="text-center mt-3">
              <span className="text-[10px] text-neutral-400 font-medium">AI can make mistakes. Consider verifying critical information.</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
