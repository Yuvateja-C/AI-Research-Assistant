import { useState, useRef, useEffect, useCallback } from "react";
import jsPDF from "jspdf";

/**
 * PRODUCTION-GRADE RESEARCH AI WORKSPACE (CLAUDE-MAX ARCHITECTURE)
 */

const API_URL = import.meta.env.VITE_API_URL;
const MAX_FILE_MB = 10;

function uid() {
  return `msg_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

// --- High-Fidelity Minimalist SVGs ---
const IconSparkles = ({ size = 16, className = "" }) => (
  <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364-6.364l-.707.707M6.343 17.657l-.707.707m0-12.728l.707.707m11.314 11.314l.707-.707M12 7a5 5 0 1 0 0 10 5 5 0 0 0 0-10z" />
  </svg>
);

const IconPaperclip = ({ size = 20, className = "" }) => (
  <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" />
  </svg>
);

const IconArrowUp = ({ size = 18, className = "" }) => (
  <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <line x1="12" y1="19" x2="12" y2="5" />
    <polyline points="5 12 12 5 19 12" />
  </svg>
);

const IconFileText = ({ size = 16, className = "" }) => (
  <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
    <polyline points="14 2 14 8 20 8" />
    <line x1="16" y1="13" x2="8" y2="13" />
    <line x1="16" y1="17" x2="8" y2="17" />
  </svg>
);

const IconClose = ({ size = 14, className = "" }) => (
  <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <line x1="18" y1="6" x2="6" y2="18" />
    <line x1="6" y1="6" x2="18" y2="18" />
  </svg>
);

const IconCompass = ({ size = 18, className = "" }) => (
  <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <circle cx="12" cy="12" r="10" />
    <polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76" />
  </svg>
);

const TypingIndicator = () => (
  <div className="flex items-center gap-1 py-3">
    <div className="w-1.5 h-1.5 bg-neutral-400 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
    <div className="w-1.5 h-1.5 bg-neutral-400 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
    <div className="w-1.5 h-1.5 bg-neutral-400 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
  </div>
);

export default function HomeGPT() {
  const [fileInfo, setFileInfo] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState(null);

  const [question, setQuestion] = useState("");
  const [isAsking, setIsAsking] = useState(false);
  const [askError, setAskError] = useState(null);
  
  const [messages, setMessages] = useState([
    {
      id: uid(),
      role: "assistant",
      content: "Hello. I am ready to assist with your document processing and analysis. Attach a source PDF below to initialize the workspace context.",
    },
  ]);

  const fileInputRef = useRef(null);
  const inputRef = useRef(null);
  const messagesEndRef = useRef(null);
  const uploadAbortRef = useRef(null);
  const askAbortRef = useRef(null);

  // Smooth pinning to viewport bottom when text streams
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isAsking]);

  useEffect(() => {
    return () => {
      uploadAbortRef.current?.abort();
      askAbortRef.current?.abort();
    };
  }, []);

  const adjustTextareaHeight = useCallback(() => {
    const textarea = inputRef.current;
    if (textarea) {
      textarea.style.height = "auto";
      textarea.style.height = `${Math.min(textarea.scrollHeight, 200)}px`;
    }
  }, []);

  useEffect(() => {
    adjustTextareaHeight();
  }, [question, adjustTextareaHeight]);

  const handleUpload = async (e) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    if (selectedFile.type !== "application/pdf" && !selectedFile.name.toLowerCase().endsWith(".pdf")) {
      setUploadError("Unsupported format. Please upload a valid PDF document.");
      return;
    }
    if (selectedFile.size > MAX_FILE_MB * 1024 * 1024) {
      setUploadError(`File constraints broken. Maximum allowed size is ${MAX_FILE_MB}MB.`);
      return;
    }

    setUploadError(null);
    setIsUploading(true);

    const formData = new FormData();
    formData.append("file", selectedFile);

    const controller = new AbortController();
    uploadAbortRef.current = controller;

    try {
      const res = await fetch(`${API_URL}/upload`, { 
        method: "POST", 
        body: formData, 
        signal: controller.signal 
      });
      if (!res.ok) throw new Error("Synchronization failure. Verify that your backend server is active.");
      
      const data = await res.json();
      setFileInfo({ filename: data.filename, chunks: data.total_chunks });
      setMessages((prev) => [
        ...prev, 
        { id: uid(), role: "assistant", content: `Context established successfully. I have processed and vectorized "${data.filename}" into ${data.total_chunks} structured semantic segments.` }
      ]);
    } catch (error) {
      if (error.name === "AbortError") return;
      setUploadError(error.message || "An unhandled error occurred during file ingestion.");
    } finally {
      setIsUploading(false);
      uploadAbortRef.current = null;
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleAsk = async () => {
    const trimmed = question.trim();
    if (!trimmed || isAsking) return;

    // Capture the history before updating the UI
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

    // THIS DEFINES THE CONTROLLER
    const controller = new AbortController();
    askAbortRef.current = controller;
    setIsAsking(true);

    try {
      const res = await fetch(`${API_BASE}/ask`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          question: trimmed,
          history: chatHistory,
          filename: fileInfo?.filename // <--- Added this to fix the 422 error
        }),
        signal: controller.signal, // <--- Uses the controller properly
      });
      
      if (!res.ok) {
        // This will print the exact backend error to your console if it fails
        const errorBody = await res.json().catch(() => null);
        console.error("ASK REJECTION DETAILS:", errorBody); 
        throw new Error(errorBody?.detail || `Analysis failed (${res.status}).`);
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
    
    // THIS DEFINES THE CONTROLLER
    const controller = new AbortController();
    summaryAbortRef.current = controller;
    setIsGeneratingSummary(true);
    setAskError(null);

    try {
      const res = await fetch(`${API_BASE}/summary`, { 
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ filename: fileInfo?.filename }), // <--- Added this to fix 422
        signal: controller.signal 
      });
      
      if (!res.ok) {
        // This will print the exact backend error to your console if it fails
        const errorBody = await res.json().catch(() => null);
        console.error("SUMMARY REJECTION DETAILS:", errorBody);
        throw new Error("Failed to compile document summary.");
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

  const exportSummaryPDF = (summaryText) => {
    const doc = new jsPDF();
    doc.setFont("Helvetica", "bold");
    doc.setFontSize(18);
    doc.text("EXECUTIVE ANALYSIS REPORT", 20, 25);
    
    doc.setLineWidth(0.5);
    doc.line(20, 30, 190, 30);
    
    doc.setFont("Helvetica", "normal");
    doc.setFontSize(11);
    const lines = doc.splitTextToSize(summaryText, 170);
    doc.text(lines, 20, 42);
    doc.save(`Analysis_Report_${Date.now().toString().slice(-6)}.pdf`);
  };

  const handleInputKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleAsk();
    }
  };

  const clearWorkspace = () => {
    setMessages([{ id: uid(), role: "assistant", content: "Workspace cleared. System initialized for new operations." }]);
    setFileInfo(null);
    setAskError(null);
    setUploadError(null);
    setQuestion("");
  };

  return (
    <div className="flex h-screen w-full bg-[#FCFBFA] text-[#191919] font-sans antialiased selection:bg-[#EADECE]/60 overflow-hidden relative">
      
      {/* Structural Minimalist Sidebar (Left Hand Context) */}
      <aside className="hidden md:flex flex-col w-[260px] h-full bg-[#F3F2EE] border-r border-[#E5E4E0] px-4 py-6 justify-between shrink-0">
        <div className="space-y-6">
          <div className="flex items-center gap-2.5 px-2">
            <div className="w-5 h-5 rounded bg-[#191919] flex items-center justify-center text-[#FCFBFA] text-xs font-bold tracking-tighter">Ω</div>
            <span className="text-sm font-semibold tracking-tight text-[#191919]">Workspace Control</span>
          </div>
          
          <button 
            onClick={clearWorkspace} 
            className="w-full text-left px-3 py-2 text-xs font-medium text-[#66645E] hover:text-black hover:bg-[#EAE9E4] rounded-lg transition-all"
          >
            + Reset Active Instance
          </button>
        </div>

        <div className="px-2 pt-4 border-t border-[#E5E4E0] text-[11px] font-mono text-[#8C8A82]">
          Network: <span className="text-emerald-700 font-bold">Connected</span>
        </div>
      </aside>

      {/* Main Operational Container */}
      <div className="flex-1 flex flex-col h-full min-w-0 bg-[#FCFBFA] relative">
        
        {/* Subtle Top Status Bar */}
        <header className="w-full h-14 border-b border-[#E5E4E0]/60 flex items-center justify-between px-6 bg-[#FCFBFA]/80 backdrop-blur-md z-10 shrink-0">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold uppercase tracking-widest text-[#8C8A82]">Current Notebook</span>
            {fileInfo && (
              <span className="text-xs bg-[#EADECE]/40 px-2 py-0.5 rounded text-[#5C5146] font-medium max-w-[150px] truncate">
                {fileInfo.filename}
              </span>
            )}
          </div>
          <button onClick={clearWorkspace} className="md:hidden text-xs font-medium text-[#8C8A82] hover:text-black transition-colors">
            Reset
          </button>
        </header>

        {/* Beautiful Scrollable Content Canvas */}
        <div className="flex-1 overflow-y-auto scrollbar-none px-4 md:px-8 pt-6 pb-44">
          <div className="max-w-2xl mx-auto flex flex-col gap-10">
            
            {messages.map((msg) => (
              <div key={msg.id} className="flex gap-6 animate-in fade-in duration-300">
                {/* Minimalist Column Indicator */}
                <div className="shrink-0 pt-0.5">
                  {msg.role === "user" ? (
                    <div className="w-6 h-6 rounded-full bg-[#EADECE] text-[#5C5146] flex items-center justify-center text-[10px] font-bold">U</div>
                  ) : (
                    <div className="w-6 h-6 rounded-full bg-[#191919] text-[#FCFBFA] flex items-center justify-center text-[10px] font-mono">AI</div>
                  )}
                </div>
                
                {/* Streamlined Document-style Copy Block */}
                <div className="flex-1 min-w-0">
                  <div className="text-[15px] leading-relaxed text-[#191919] font-normal tracking-wide whitespace-pre-wrap">
                    {msg.content}
                  </div>

                  {/* Grounded Source Readout */}
                  {msg.sources && msg.sources.length > 0 && (
                    <div className="mt-4 flex flex-wrap items-center gap-1.5 border-t border-[#E5E4E0]/40 pt-3">
                      <span className="text-[10px] font-semibold text-[#8C8A82] uppercase tracking-wider mr-1">Context Anchors:</span>
                      {msg.sources.map((source, idx) => (
                        <span key={idx} className="bg-[#F3F2EE] border border-[#E5E4E0] px-1.5 py-0.5 rounded font-mono text-[10px] text-[#66645E]">
                          Segment {source.split("_chunk_")[1] || source}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Clean PDF Download Trigger */}
                  {msg.isSummary && (
                    <button 
                      onClick={() => exportSummaryPDF(msg.content)}
                      className="mt-4 inline-flex items-center gap-2 px-3 py-1.5 bg-[#191919] hover:bg-[#33322E] text-[#FCFBFA] text-xs font-semibold rounded-lg shadow-sm transition-colors"
                    >
                      <IconFileText size={12} /> Compile PDF Report
                    </button>
                  )}
                </div>
              </div>
            ))}

            {/* Dynamic Loading Matrix */}
            {isAsking && (
              <div className="flex gap-6 animate-in fade-in">
                <div className="shrink-0 pt-0.5">
                  <div className="w-6 h-6 rounded-full bg-[#191919] text-[#FCFBFA] flex items-center justify-center text-[10px] font-mono animate-pulse">AI</div>
                </div>
                <div className="flex-1">
                  <TypingIndicator />
                </div>
              </div>
            )}

            <div ref={messagesEndRef} className="h-2" />
          </div>
        </div>

        {/* Absolute Base-Anchored Control Dock (Zero-Scroll Form Factor) */}
        <footer className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-[#FCFBFA] via-[#FCFBFA] to-transparent pt-8 pb-6 px-4 z-20 pointer-events-none">
          <div className="max-w-2xl mx-auto pointer-events-auto">
            
            {/* Integrated Error Handling Notification Panel */}
            {(askError || uploadError) && (
              <div className="mb-4 px-4 py-3 bg-[#FFF5F5] border border-[#FCA5A5] text-[#991B1B] rounded-xl text-xs font-medium flex justify-between items-center shadow-sm animate-in slide-in-from-bottom-2">
                <span>{askError || uploadError}</span>
                <button onClick={() => { setAskError(null); setUploadError(null); }} className="hover:opacity-60 transition-opacity p-1">
                  <IconClose size={14}/>
                </button>
              </div>
            )}

            {/* Active Attachment Capsule Layer */}
            {(fileInfo || isUploading) && (
              <div className="mb-3.5 flex items-center gap-2 animate-in fade-in slide-in-from-bottom-1">
                <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-[#F3F2EE] border border-[#E5E4E0] rounded-xl shadow-sm text-xs font-medium text-[#5C5146]">
                  {isUploading ? (
                    <span className="w-3 h-3 border-2 border-[#8C8A82] border-t-black rounded-full animate-spin" />
                  ) : (
                    <IconFileText size={13} className="text-[#8C8A82]" />
                  )}
                  <span className="truncate max-w-[180px] font-mono">{fileInfo?.filename || "Analyzing Data System..."}</span>
                </div>

                {/* Instant Executive Summary Action */}
                {fileInfo && !isAsking && (
                  <button 
                    onClick={handleSummary}
                    className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider px-3 py-1.5 bg-white border border-[#E5E4E0] text-[#66645E] hover:text-black hover:border-neutral-400 rounded-xl shadow-sm transition-all"
                  >
                    <IconSparkles size={11} /> Extract Summary
                  </button>
                )}
              </div>
            )}

            {/* Premium Console Ingestion Architecture */}
            <div className="relative flex items-end gap-2 bg-[#F3F2EE] rounded-2xl p-2.5 transition-all border border-[#E5E4E0] focus-within:border-neutral-400 focus-within:bg-white shadow-sm focus-within:shadow-md">
              
              <input ref={fileInputRef} type="file" accept="application/pdf,.pdf" className="hidden" onChange={handleUpload} />
              
              {/* Paperclip Action */}
              <button 
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploading || isAsking}
                className="shrink-0 w-9 h-9 flex items-center justify-center text-[#8C8A82] hover:text-black disabled:opacity-40 transition-colors mb-0.5 rounded-xl hover:bg-[#EAE9E4]"
                title="Inject PDF Document"
              >
                <IconPaperclip size={18} />
              </button>

              {/* Seamless Dynamic Sizing Input Canvas */}
              <textarea
                ref={inputRef}
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                onKeyDown={handleInputKeyDown}
                placeholder={fileInfo ? "Inquire about document parameters..." : "Ask a question or initialize a dataset..."}
                disabled={isAsking}
                rows={1}
                className="flex-1 bg-transparent border-none outline-none text-[15px] px-1 py-2.5 resize-none text-[#191919] placeholder-[#8C8A82] disabled:opacity-50 min-h-[40px] max-h-[180px] overflow-y-auto leading-relaxed"
              />
              
              {/* Submission Node */}
              <button
                onClick={handleAsk}
                disabled={isAsking || (!question.trim() && !fileInfo)}
                className="shrink-0 w-9 h-9 flex items-center justify-center bg-[#191919] text-[#FCFBFA] rounded-xl hover:bg-[#33322E] disabled:bg-neutral-200 disabled:text-neutral-400 transition-colors mb-0.5"
                aria-label="Dispatch Query"
              >
                <IconArrowUp size={16} />
              </button>
            </div>
            
            <div className="text-center mt-2.5">
              <p className="text-[10px] text-[#8C8A82] font-medium tracking-wide">System processing running over semantic indexing models.</p>
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
}
