import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import jsPDF from "jspdf";

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
/*  CONSTANTS & HELPERS                         */
/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
const API = (import.meta.env.VITE_API_URL || "https://api-research-assistant-bseo.onrender.com").replace(/\/+$/, "");
const uid = () => Math.random().toString(36).substring(2, 11);

const relativeTime = (ts) => {
  if (!ts) return "";
  const diff = Date.now() - ts;
  const m = Math.floor(diff / 60000);
  if (m < 1) return "now";
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d`;
  return new Date(ts).toLocaleDateString("en", { month: "short", day: "numeric" });
};

const dateGroup = (ts) => {
  if (!ts) return "Today";
  const now = new Date();
  const d = new Date(ts);
  const diff = Math.floor((now.setHours(0,0,0,0) - new Date(d).setHours(0,0,0,0)) / 86400000);
  if (diff === 0) return "Today";
  if (diff === 1) return "Yesterday";
  if (diff < 7) return "Previous 7 Days";
  if (diff < 30) return "This Month";
  return "Older";
};

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
/*  SVG ICONS                                   */
/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
const I = {
  Menu: (p) => <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="3" y1="7" x2="21" y2="7"/><line x1="3" y1="12" x2="16" y2="12"/><line x1="3" y1="17" x2="12" y2="17"/></svg>,
  Plus: (p) => <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>,
  Send: (p) => <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 2L11 13"/><path d="M22 2l-7 20-4-9-9-4 20-7z"/></svg>,
  Upload: (p) => <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>,
  File: (p) => <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>,
  Star: (p) => <svg {...p} viewBox="0 0 24 24" fill="currentColor"><path d="M12 1l2.5 7.5L22 12l-7.5 2.5L12 22l-2.5-7.5L2 12l7.5-2.5z"/></svg>,
  StarOutline: (p) => <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>,
  Down: (p) => <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>,
  Trash: (p) => <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/></svg>,
  Search: (p) => <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>,
  Clip: (p) => <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21.44 11.05l-9.19 9.19a6 6 0 01-8.49-8.49l9.19-9.19a4 4 0 015.66 5.66l-9.2 9.19a2 2 0 01-2.83-2.83l8.49-8.48"/></svg>,
  X: (p) => <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>,
  Zap: (p) => <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>,
  Brain: (p) => <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2C8.13 2 5 5.13 5 9c0 2.38 1.19 4.47 3 5.74V17c0 .55.45 1 1 1h6c.55 0 1-.45 1-1v-2.26c1.81-1.27 3-3.36 3-5.74 0-3.87-3.13-7-7-7z"/><line x1="9" y1="21" x2="15" y2="21"/><line x1="10" y1="24" x2="14" y2="24"/></svg>,
  Doc: (p) => <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>,
  Chart: (p) => <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>,
  Shield: (p) => <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>,
  Sidebar: (p) => <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="9" y1="3" x2="9" y2="21"/></svg>,
  Edit: (p) => <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 113 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>,
  Archive: (p) => <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="21 8 21 21 3 21 3 8"/><rect x="1" y="3" width="22" height="5"/><line x1="10" y1="12" x2="14" y2="12"/></svg>,
  Lock: (p) => <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg>,
  User: (p) => <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>,
  Sun: (p) => <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>,
  Moon: (p) => <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z"/></svg>,
  Settings: (p) => <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 11-2.83 2.83l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 11-2.83-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 112.83-2.83l.06.06a1.65 1.65 0 001.82.33H9a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 112.83 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z"/></svg>,
  Support: (p) => <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 015.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>,
};
const icon = (Comp, s = 16) => <Comp width={s} height={s} style={{ flexShrink: 0 }} />;

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
/*  SUB-COMPONENTS                              */
/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
const Orbs = () => (
  <div style={{ position:"fixed", inset:0, pointerEvents:"none", zIndex:0, overflow:"hidden" }}>
    <div style={{ position:"absolute", width:550, height:550, borderRadius:"50%", background:"radial-gradient(circle, rgba(124,91,245,0.08) 0%, transparent 70%)", top:"-8%", right:"-6%" }}/>
    <div style={{ position:"absolute", width:650, height:650, borderRadius:"50%", background:"radial-gradient(circle, rgba(59,130,246,0.06) 0%, transparent 70%)", bottom:"-12%", left:"-8%" }}/>
  </div>
);

const Typing = () => (
  <div style={{ display:"flex", alignItems:"center", gap:5, padding:"14px 0" }}>
    {[0,1,2].map(i => <div key={i} style={{ width:6, height:6, borderRadius:"50%", background:"var(--accent)", animation:`typingDot 1.4s ${i*0.16}s infinite ease-in-out` }}/>)}
    <span style={{ marginLeft:8, fontSize:12, color:"var(--text-3)", fontStyle:"italic" }}>thinking...</span>
  </div>
);

const Msg = ({ m }) => {
  const u = m.role === "user";
  return (
    <div className="anim-slideUp" style={{ display:"flex", gap:12, padding:"10px 0", flexDirection: u ? "row-reverse" : "row", alignItems:"flex-start" }}>
      <div style={{
        width:32, height:32, borderRadius:10, flexShrink:0, display:"flex", alignItems:"center", justifyContent:"center", fontSize:13, fontWeight:700, color:"#fff",
        background: u ? "var(--bg-hover)" : "var(--grad)",
        boxShadow: u ? "none" : "0 0 16px var(--accent-glow)",
      }}>
        {u ? "Y" : icon(I.Star, 14)}
      </div>
      <div style={{
        maxWidth:"78%", padding:"12px 16px", borderRadius: u ? "16px 16px 4px 16px" : "16px 16px 16px 4px",
        background: u ? "rgba(124,91,245,0.08)" : "var(--bg-surface)", border: `1px solid ${u ? "rgba(124,91,245,0.15)" : "var(--border)"}`,
        fontSize:14, lineHeight:1.75, color:"var(--text)", whiteSpace:"pre-wrap", wordBreak:"break-word",
      }}>
        {m.content}
        {m.sources?.length > 0 && (
          <div style={{ marginTop:10, paddingTop:8, borderTop:"1px solid var(--border)", display:"flex", flexWrap:"wrap", gap:5 }}>
            {m.sources.map((s,i) => (
              <span key={i} style={{ fontSize:10, padding:"2px 8px", borderRadius:12, background:"rgba(59,130,246,0.1)", border:"1px solid rgba(59,130,246,0.2)", color:"var(--accent-2)", fontFamily:"'JetBrains Mono',monospace" }}>
                Source {s.chunk_index ?? i+1}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

const FEATS = [
  { icon: I.Upload, title: "10 GB Upload Capacity", desc: "Process massive PDF books, code bases, and research archives dynamically.", color: "#7c5bf5" },
  { icon: I.Brain, title: "Contextual RAG Retrieval", desc: "Interact using natural language with source references extracted in real-time.", color: "#3b82f6" },
  { icon: I.Chart, title: "Categorization Tags", desc: "Organize document context workspaces by filterable research tags.", color: "#f59e0b" },
  { icon: I.Shield, title: "Secure Session Controls", desc: "Data processed locally on execution and encrypted on storage.", color: "#22c55e" },
];

const TESTIMONIALS = [
  { quote: "ResearchAI reduced my literature review cycle by days. I can ask questions directly across full-text textbooks.", author: "Dr. Sarah J.", role: "Lead Academic Researcher" },
  { quote: "Being able to upload large 500MB technical manuals and query them with instant responses is a game changer.", author: "Marcus K.", role: "Systems Engineer" },
  { quote: "Perfect interface! The tagging structure keeps my clinical studies organized, and sifting through them is seamless.", author: "Elena R.", role: "Medical Analyst" },
];

const SUGGESTIONS = [
  { emoji: "📊", text: "Generate executive summary" },
  { emoji: "🔬", text: "Extract key metrics" },
  { emoji: "🧠", text: "Identify core arguments" },
  { emoji: "📋", text: "List all findings" },
];

const Welcome = ({ onUpload, fileRef }) => (
  <div className="anim-fadeIn" style={{ display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", flex:1, padding:"40px 20px", textAlign:"center" }}>
    <div style={{ width:56, height:56, borderRadius:16, background:"var(--grad)", display:"flex", alignItems:"center", justifyContent:"center", marginBottom:20, boxShadow:"0 0 30px var(--accent-glow)" }}>
      {icon(I.Star, 24)}
    </div>

    {/* Outcome-focused Headlines */}
    <h2 style={{ fontSize:28, fontWeight:800, background:"linear-gradient(135deg, var(--text), var(--text-2))", WebkitBackgroundClip:"text", WebkitTextFillColor:"transparent", marginBottom:8, letterSpacing:"-0.03em" }}>
      Stop reading. Start asking.
    </h2>
    <p style={{ fontSize:15, color:"var(--text-2)", maxWidth:490, marginBottom:36, lineHeight:1.7 }}>
      Upload your PDF documents and ask questions. Extract insights, statistics, and summaries in seconds.
    </p>

    {/* Trust stats indicator */}
    <div style={{ display:"flex", gap:20, justifyContent:"center", marginBottom:32, flexWrap:"wrap" }}>
      <span style={{ fontSize:11, color:"var(--text-3)", background:"var(--bg-surface)", padding:"4px 10px", borderRadius:20, border:"1px solid var(--border)" }}>🔥 10,000+ documents analyzed</span>
      <span style={{ fontSize:11, color:"var(--text-3)", background:"var(--bg-surface)", padding:"4px 10px", borderRadius:20, border:"1px solid var(--border)" }}>👥 Trusted by 500+ researchers</span>
    </div>

    {/* 3-Step Flow */}
    <div style={{ display:"flex", justifyContent:"center", gap:20, flexWrap:"wrap", marginBottom:40, maxWidth:720 }}>
      <div style={{ flex:1, minWidth:180, background:"rgba(255,255,255,0.01)", padding:16, borderRadius:12, border:"1px solid var(--border)" }}>
        <div style={{ fontSize:20, fontWeight:"bold", color:"var(--accent)", marginBottom:6 }}>1</div>
        <div style={{ fontSize:13, fontWeight:700, color:"var(--text)" }}>Upload Document</div>
        <div style={{ fontSize:11, color:"var(--text-3)", marginTop:4 }}>Upload PDFs up to 10 GB.</div>
      </div>
      <div style={{ flex:1, minWidth:180, background:"rgba(255,255,255,0.01)", padding:16, borderRadius:12, border:"1px solid var(--border)" }}>
        <div style={{ fontSize:20, fontWeight:"bold", color:"var(--accent-2)", marginBottom:6 }}>2</div>
        <div style={{ fontSize:13, fontWeight:700, color:"var(--text)" }}>AI Vector indexing</div>
        <div style={{ fontSize:11, color:"var(--text-3)", marginTop:4 }}>Semantic chunks are compiled.</div>
      </div>
      <div style={{ flex:1, minWidth:180, background:"rgba(255,255,255,0.01)", padding:16, borderRadius:12, border:"1px solid var(--border)" }}>
        <div style={{ fontSize:20, fontWeight:"bold", color:"var(--gold)", marginBottom:6 }}>3</div>
        <div style={{ fontSize:13, fontWeight:700, color:"var(--text)" }}>Query Workspace</div>
        <div style={{ fontSize:11, color:"var(--text-3)", marginTop:4 }}>Ask questions and get summaries.</div>
      </div>
    </div>

    {/* Feature Grid */}
    <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit, minmax(200px, 1fr))", gap:12, maxWidth:680, width:"100%", marginBottom:40 }}>
      {FEATS.map((f, i) => (
        <div key={i} style={{ padding:"20px 16px", borderRadius:16, background:"var(--bg-surface)", border:"1px solid var(--border)", textAlign:"left" }}>
          <div style={{ width:36, height:36, borderRadius:10, background:`${f.color}15`, display:"flex", alignItems:"center", justifyContent:"center", color:f.color, marginBottom:12 }}>
            {icon(f.icon, 18)}
          </div>
          <div style={{ fontSize:14, fontWeight:700, color:"var(--text)", marginBottom:4 }}>{f.title}</div>
          <div style={{ fontSize:12, color:"var(--text-2)", lineHeight:1.6 }}>{f.desc}</div>
        </div>
      ))}
    </div>

    {/* Testimonials */}
    <div style={{ maxWidth:680, width:"100%", marginBottom:40, textAlign:"left" }}>
      <h3 style={{ fontSize:15, fontWeight:700, color:"var(--text)", marginBottom:16, textTransform:"uppercase", letterSpacing:"0.05em" }}>User Reviews</h3>
      <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit, minmax(200px, 1fr))", gap:12 }}>
        {TESTIMONIALS.map((t, idx) => (
          <div key={idx} style={{ padding:14, borderRadius:12, background:"rgba(255,255,255,0.01)", border:"1px solid var(--border)", display:"flex", flexDirection:"column", justifyContent:"between" }}>
            <p style={{ fontSize:12.5, color:"var(--text-2)", fontStyle:"italic", lineHeight:1.6 }}>"{t.quote}"</p>
            <div style={{ marginTop:12 }}>
              <div style={{ fontSize:11, fontWeight:700, color:"var(--text)" }}>{t.author}</div>
              <div style={{ fontSize:10, color:"var(--text-3)" }}>{t.role}</div>
            </div>
          </div>
        ))}
      </div>
    </div>

    {/* Upload CTA with Security Info */}
    <div style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:12 }}>
      <button onClick={() => fileRef.current?.click()} style={{
        padding:"14px 32px", borderRadius:14, border:"none", background:"var(--grad)", color:"#fff",
        fontSize:15, fontWeight:700, cursor:"pointer", display:"flex", alignItems:"center", gap:10,
        boxShadow:"0 4px 20px var(--accent-glow)", transition:"all 0.3s",
      }}>
        {icon(I.Upload, 18)} Analyze a document in seconds
      </button>
      <div style={{ display:"flex", alignItems:"center", gap:6, color:"var(--text-3)", fontSize:11 }}>
        🔒 <i>Your documents are processed securely and never stored permanently. Data is deleted after analysis.</i>
      </div>
    </div>
  </div>
);

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
/*  MAIN APP WORKSPACE                          */
/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
export default function HomeGPT() {
  const sidebarW = 310;
  const RAZORPAY_KEY_ID = import.meta.env.VITE_RAZORPAY_KEY_ID || "rzp_test_T6fcPFjRPRx3FQ";
  /* Page view routing */
  const [activePage, setActivePage] = useState("workspace"); // workspace, privacy, terms
  const [persona, setPersona] = useState("default");

  /* Auth State */
  const [token, setToken] = useState(() => localStorage.getItem("session_token") || "");
  const [user, setUser] = useState(null);
  const [loadingAuth, setLoadingAuth] = useState(!!localStorage.getItem("session_token"));
  const [connectionError, setConnectionError] = useState(false);
  const [authView, setAuthView] = useState("login"); // login, register, recover, reset_password, setup_2fa, verify_2fa
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [code2fa, setCode2fa] = useState("");
  const [authError, setAuthError] = useState("");
  const [requires2fa, setRequires2fa] = useState(false);
  const [recoverySent, setRecoverySent] = useState(false);
  const [recoveryLink, setRecoveryLink] = useState("");
  const [resetToken, setResetToken] = useState("");
  const [socialModalOpen, setSocialModalOpen] = useState(false);
  const [socialProvider, setSocialProvider] = useState("");
  const [socialEmail, setSocialEmail] = useState("");

  /* App State */
  const [chats, setChats] = useState([]);
  const [activeId, setActiveId] = useState("");
  const [sidebarOpen, setSidebarOpen] = useState(window.innerWidth > 768);
  const [search, setSearch] = useState("");
  const [question, setQuestion] = useState("");
  const [isAsking, setIsAsking] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isGeneratingSummary, setIsGeneratingSummary] = useState(false);
  const [uploadError, setUploadError] = useState(null);
  const [upgradeModalOpen, setUpgradeModalOpen] = useState(false);
  const [isUpgrading, setIsUpgrading] = useState(false);
  const [cardNum, setCardNum] = useState("");
  const [cardExp, setCardExp] = useState("");
  const [cardCvc, setCardCvc] = useState("");
  const [cardName, setCardName] = useState("");
  const [upgradeError, setUpgradeError] = useState("");
  const [selectedPlan, setSelectedPlan] = useState("1_month");
  const [activeInvoice, setActiveInvoice] = useState(null);
  const [paymentMethod, setPaymentMethod] = useState("upi"); // upi, card
  const [upiProvider, setUpiProvider] = useState("gpay"); // gpay, phonepe, paytm, qr
  const [upiId, setUpiId] = useState("");
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);
  const [permissionsGranted, setPermissionsGranted] = useState(() => localStorage.getItem("permissions_granted") || "prompt");
  const [editingChatId, setEditingChatId] = useState(null);
  const [editTitleValue, setEditTitleValue] = useState("");

  /* SaaS Platform Expanded State */
  const [activeTab, setActiveTab] = useState("workspace"); // workspace, dashboard, reports, billing, settings, support, admin
  const [theme, setTheme] = useState(() => localStorage.getItem("theme") || "dark");
  const [reports, setReports] = useState([]);
  const [activeReport, setActiveReport] = useState(null);
  const [generatingReport, setGeneratingReport] = useState(false);
  const [reportTitle, setReportTitle] = useState("");
  const [reportSearch, setReportSearch] = useState("");
  const [reportFavoriteFilter, setReportFavoriteFilter] = useState(false);
  const [adminStats, setAdminStats] = useState(null);
  const [adminUsers, setAdminUsers] = useState([]);
  const [adminSearch, setAdminSearch] = useState("");
  const [contactName, setContactName] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [contactMessage, setContactMessage] = useState("");
  const [contactSuccess, setContactSuccess] = useState(false);
  const [contactLoading, setContactLoading] = useState(false);
  const [profileName, setProfileName] = useState("");
  const [profileEmail, setProfileEmail] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [profileMessage, setProfileMessage] = useState("");
  const [profileError, setProfileError] = useState("");
  const [notificationOptIn, setNotificationOptIn] = useState(true);
  const [toasts, setToasts] = useState([]);

  const showToast = useCallback((message, type = "success") => {
    const id = Math.random().toString(36).substring(7);
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 4000);
  }, []);

  /* Tag & Filter state */
  const [selectedTagFilter, setSelectedTagFilter] = useState("All Tags");
  const [selectedStatusFilter, setSelectedStatusFilter] = useState("all"); // all, active, archived, favorite
  const [addingTagId, setAddingTagId] = useState(null);
  const [newTagVal, setNewTagVal] = useState("");

  const fileRef = useRef(null);
  const inputRef = useRef(null);
  const endRef = useRef(null);
  const abortRefs = useRef({ upload: null, ask: null, summary: null });

  const activeChat = useMemo(() => chats.find(c => c.id === activeId) || null, [chats, activeId]);

  /* Verify Auth */
  const checkAuth = useCallback(async (currentTkn) => {
    if (!currentTkn) {
      setLoadingAuth(false);
      return;
    }
    try {
      const r = await fetch(`${API}/auth/me`, {
        headers: { "Authorization": `Bearer ${currentTkn}` }
      });
      if (r.ok) {
        const d = await r.json();
        setUser(d.user);
        setConnectionError(false);
        await fetchChats(currentTkn);
      } else if (r.status === 401 || r.status === 403) {
        setConnectionError(false);
        handleLogoutAction();
      } else {
        console.warn("Auth check failed with server error:", r.status);
        setConnectionError(true);
      }
    } catch (err) {
      console.error("Auth check failed due to network error:", err);
      setConnectionError(true);
    } finally {
      setLoadingAuth(false);
    }
  }, []);

  useEffect(() => {
    if (token) {
      checkAuth(token);
    } else {
      setLoadingAuth(false);
    }
  }, [token, checkAuth]);

  /* Fetch Chats */
  const fetchChats = async (tkn) => {
    try {
      const r = await fetch(`${API}/chats`, {
        headers: { "Authorization": `Bearer ${tkn}` }
      });
      if (r.ok) {
        const data = await r.json();
        setChats(data);
        if (data.length === 0) {
          const createRes = await fetch(`${API}/chats`, {
            method: "POST",
            headers: { "Authorization": `Bearer ${tkn}` }
          });
          if (createRes.ok) {
            const newChat = await createRes.json();
            const fresh = {
              id: newChat.id,
              title: newChat.title,
              file_info: null,
              summary: "",
              status: "active",
              tags: [],
              messages: []
            };
            setChats([fresh]);
            setActiveId(newChat.id);
          }
        } else if (data.length > 0 && !activeId) {
          setActiveId(data[0].id);
          fetchMessages(data[0].id, tkn);
        }
      }
    } catch (e) {
      console.error(e);
    }
  };

  const fetchMessages = async (chatId, tkn) => {
    try {
      const r = await fetch(`${API}/chats/${chatId}/messages`, {
        headers: { "Authorization": `Bearer ${tkn}` }
      });
      if (r.ok) {
        const msgs = await r.json();
        setChats(prev => prev.map(c => c.id === chatId ? { ...c, messages: msgs } : c));
      }
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    const h = () => { setIsMobile(window.innerWidth <= 768); if (window.innerWidth > 768) setSidebarOpen(true); };
    window.addEventListener("resize", h); return () => window.removeEventListener("resize", h);
  }, []);

  useEffect(() => {
    const ta = inputRef.current;
    if (ta) { ta.style.height = "auto"; ta.style.height = `${Math.min(ta.scrollHeight, 160)}px`; }
  }, [question]);

  /* Auth Handlers */
  const handleLogin = async (e) => {
    e.preventDefault();
    setAuthError("");
    try {
      const r = await fetch(`${API}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username_or_email: email, password, code_2fa: code2fa })
      });
      const d = await r.json();
      if (!r.ok) {
        setAuthError(d.detail || "Login failed");
        return;
      }
      if (d.requires_2fa) {
        setRequires2fa(true);
        setAuthError("Please input your 2FA authentication code.");
        return;
      }
      localStorage.setItem("session_token", d.token);
      setToken(d.token);
      setRequires2fa(false);
      setCode2fa("");
    } catch {
      setAuthError("Network connection failure");
    }
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    setAuthError("");
    try {
      const r = await fetch(`${API}/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, username, password })
      });
      
      let d = {};
      try {
        d = await r.json();
      } catch {
        d = { detail: `Server error (${r.status}). Please try again later.` };
      }

      if (!r.ok) {
        setAuthError(d.detail || "Registration failed");
        return;
      }
      
      // Navigate to verification confirmation screen instead of auto logging in
      if (d.verification_token) {
        setRecoveryLink(`${API}/auth/verify-email?token=${d.verification_token}`);
        setAuthView("verify_email_sent");
        return;
      }

      const loginRes = await fetch(`${API}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username_or_email: email, password })
      });
      
      let loginData = {};
      try {
        loginData = await loginRes.json();
      } catch {
        loginData = { detail: "Automatic login failed. Please sign in manually." };
      }

      if (!loginRes.ok) {
        setAuthError(loginData.detail || "Automatic login failed");
        return;
      }

      localStorage.setItem("session_token", loginData.token);
      setToken(loginData.token);
    } catch (err) {
      setAuthError("Registration failed: " + (err.message || "Connection error"));
    }
  };

  const handleRecovery = async (e) => {
    e.preventDefault();
    setAuthError("");
    try {
      const r = await fetch(`${API}/auth/recover`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email })
      });
      const d = await r.json();
      if (r.ok) {
        setRecoverySent(true);
        if (d.recovery_link) {
          setRecoveryLink(d.recovery_link);
        }
      } else {
        setAuthError(d.detail || "Recovery failed");
      }
    } catch {
      setAuthError("Network error");
    }
  };

  const handleResetPassword = async (e) => {
    e.preventDefault();
    setAuthError("");
    try {
      const r = await fetch(`${API}/auth/reset-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: resetToken, new_password: password })
      });
      if (r.ok) {
        setAuthView("login");
        setAuthError("Password successfully reset! You can now log in.");
      } else {
        const d = await r.json();
        setAuthError(d.detail || "Reset failed");
      }
    } catch {
      setAuthError("Error resetting password");
    }
  };

  const handleLogoutAction = () => {
    localStorage.removeItem("session_token");
    setToken("");
    setUser(null);
    setChats([]);
    setActiveId("");
    setLoadingAuth(false);
  };

  const handleLogout = async () => {
    try {
      await fetch(`${API}/auth/logout`, {
        method: "POST",
        headers: { "Authorization": `Bearer ${token}` }
      });
    } catch {}
    handleLogoutAction();
  };

  const trialDaysRemaining = useMemo(() => {
    if (!user || !user.trial_starts_at) return 0;
    const elapsed = Date.now() - user.trial_starts_at;
    const remaining = 7 - Math.floor(elapsed / 86400000);
    return Math.max(0, remaining);
  }, [user]);

  const downloadInvoicePDF = (paymentId, amount, plan) => {
    const doc = new jsPDF();
    doc.setFont("Helvetica", "bold"); doc.setFontSize(20); doc.setTextColor(124, 91, 245);
    doc.text("ResearchAI Invoice Receipt", 20, 25);
    doc.setFontSize(10); doc.setTextColor(100, 100, 100);
    doc.text(`Receipt ID: ${paymentId}`, 20, 35);
    doc.text(`Date: ${new Date().toLocaleDateString()}`, 20, 42);
    doc.line(20, 48, 190, 48);
    
    doc.setFont("Helvetica", "normal"); doc.setFontSize(12); doc.setTextColor(50, 50, 50);
    doc.text("Plan Purchased:", 20, 58);
    doc.setFont("Helvetica", "bold");
    doc.text(plan === "1_month" ? "1 Month Premium Subscription" : plan === "5_months" ? "5 Months Premium Subscription" : "12 Months Premium Subscription", 60, 58);
    
    doc.setFont("Helvetica", "normal");
    doc.text("Amount Paid:", 20, 68);
    doc.setFont("Helvetica", "bold");
    doc.text(`${amount}`, 60, 68);
    
    doc.setFont("Helvetica", "normal");
    doc.text("Billing Status:", 20, 78);
    doc.text("Paid via UPI / Card (Razorpay)", 60, 78);
    
    doc.line(20, 85, 190, 85);
    doc.setFontSize(10); doc.setFont("Helvetica", "italic"); doc.setTextColor(150, 150, 150);
    doc.text("Thank you for supporting ResearchAI! Email: ai.researchassistant00@gmail.com", 20, 95);
    
    doc.save(`Invoice_${paymentId}.pdf`);
  };

  const handleDownloadDocx = (report) => {
    const content = `
      <html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
      <head>
        <title>${report.title}</title>
        <style>
          body { font-family: 'Arial', sans-serif; padding: 20px; color: #333; line-height: 1.6; }
          h1 { color: #7c5bf5; font-size: 24px; border-bottom: 2px solid #7c5bf5; padding-bottom: 5px; }
          h2 { color: #3b82f6; font-size: 18px; margin-top: 20px; }
          p { font-size: 12px; margin-bottom: 10px; }
        </style>
      </head>
      <body>
        <h1>${report.title}</h1>
        <p><strong>Unique Report ID:</strong> ${report.id}</p>
        <p><strong>Created:</strong> ${new Date(report.created_at).toLocaleDateString()}</p>
        <p><strong>Confidence Score:</strong> ${(report.confidence_score * 100).toFixed(0)}%</p>
        <hr/>
        
        <h2>1. Executive Summary</h2>
        <p>${report.executive_summary.replace(/\n/g, '<br/>')}</p>
        
        <h2>2. Research Overview</h2>
        <p>${report.research_overview.replace(/\n/g, '<br/>')}</p>
        
        <h2>3. Detailed Analysis</h2>
        <p>${report.detailed_analysis.replace(/\n/g, '<br/>')}</p>
        
        <h2>4. Key Findings</h2>
        <p>${report.key_findings.replace(/\n/g, '<br/>')}</p>
        
        <h2>5. AI Insights</h2>
        <p>${report.ai_insights.replace(/\n/g, '<br/>')}</p>
        
        <h2>6. Recommendations</h2>
        <p>${report.recommendations.replace(/\n/g, '<br/>')}</p>
        
        <h2>7. Conclusion</h2>
        <p>${report.conclusion.replace(/\n/g, '<br/>')}</p>
      </body>
      </html>
    `;
    const blob = new Blob(['\ufeff' + content], { type: 'application/msword' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${report.title.replace(/\s+/g, '_')}_Report.doc`;
    a.click();
    showToast("DOCX report downloaded successfully");
  };

  const handleDownloadReportPDF = (report) => {
    const doc = new jsPDF();
    doc.setFont("Helvetica", "bold");
    doc.setFontSize(22);
    doc.setTextColor(124, 91, 245);
    doc.text("ResearchAI Analytical Report", 20, 25);
    
    doc.setFontSize(14);
    doc.setTextColor(50, 50, 50);
    doc.text(report.title, 20, 35);
    
    doc.setFontSize(10);
    doc.text(`ID: ${report.id}`, 20, 42);
    doc.text(`Created: ${new Date(report.created_at).toLocaleDateString()}`, 20, 48);
    doc.line(20, 54, 190, 54);
    
    let y = 62;
    
    const addSection = (title, content) => {
      if (y > 260) {
        doc.addPage();
        y = 25;
      }
      doc.setFont("Helvetica", "bold");
      doc.setFontSize(12);
      doc.setTextColor(124, 91, 245);
      doc.text(title, 20, y);
      y += 7;
      
      doc.setFont("Helvetica", "normal");
      doc.setFontSize(10);
      doc.setTextColor(80, 80, 80);
      const lines = doc.splitTextToSize(content, 170);
      for (let line of lines) {
        if (y > 270) {
          doc.addPage();
          y = 25;
        }
        doc.text(line, 20, y);
        y += 6;
      }
      y += 10;
    };
    
    addSection("EXECUTIVE SUMMARY", report.executive_summary);
    addSection("RESEARCH OVERVIEW", report.research_overview);
    addSection("DETAILED ANALYSIS", report.detailed_analysis);
    addSection("KEY FINDINGS", report.key_findings);
    addSection("AI INSIGHTS", report.ai_insights);
    addSection("RECOMMENDATIONS", report.recommendations);
    addSection("CONCLUSION", report.conclusion);
    
    doc.save(`${report.title.replace(/\s+/g, '_')}_Report.pdf`);
    showToast("PDF report downloaded successfully");
  };

  /* ----------------------------
     SaaS API Handlers
     ---------------------------- */
  const fetchReports = useCallback(async (tkn) => {
    try {
      const queryParams = new URLSearchParams();
      if (reportSearch) queryParams.append("search", reportSearch);
      if (reportFavoriteFilter) queryParams.append("favorite", "true");
      const r = await fetch(`${API}/reports?${queryParams.toString()}`, {
        headers: { "Authorization": `Bearer ${tkn}` }
      });
      if (r.ok) {
        const d = await r.json();
        setReports(d);
      }
    } catch (err) {
      console.error("Failed to fetch reports:", err);
    }
  }, [reportSearch, reportFavoriteFilter]);

  const handleCreateReport = async () => {
    if (!activeId) return;
    setGeneratingReport(true);
    showToast("Generating comprehensive analytical report...", "info");
    try {
      const r = await fetch(`${API}/reports`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({ chat_id: activeId, title: reportTitle || undefined })
      });
      const d = await r.json();
      if (r.ok) {
        showToast("Report generated successfully!");
        setReports(prev => [d, ...prev]);
        setActiveReport(d);
        setActiveTab("reports");
        setReportTitle("");
      } else {
        showToast(d.detail || "Failed to generate report", "error");
      }
    } catch (err) {
      showToast("Network error generating report", "error");
    } finally {
      setGeneratingReport(false);
    }
  };

  const handleToggleReportFavorite = async (report) => {
    try {
      const newFav = !report.is_favorite;
      const r = await fetch(`${API}/reports/${report.id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({ is_favorite: newFav })
      });
      if (r.ok) {
        setReports(prev => prev.map(rep => rep.id === report.id ? { ...rep, is_favorite: newFav } : rep));
        if (activeReport?.id === report.id) {
          setActiveReport(prev => ({ ...prev, is_favorite: newFav }));
        }
        showToast(newFav ? "Added to favorites" : "Removed from favorites");
      }
    } catch (err) {
      showToast("Error updating report", "error");
    }
  };

  const handleRenameReport = async (reportId, newTitle) => {
    try {
      const r = await fetch(`${API}/reports/${reportId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({ title: newTitle })
      });
      if (r.ok) {
        setReports(prev => prev.map(rep => rep.id === reportId ? { ...rep, title: newTitle } : rep));
        if (activeReport?.id === reportId) {
          setActiveReport(prev => ({ ...prev, title: newTitle }));
        }
        showToast("Report renamed successfully");
      }
    } catch (err) {
      showToast("Error renaming report", "error");
    }
  };

  const handleDeleteReport = async (reportId) => {
    if (!confirm("Are you sure you want to delete this report?")) return;
    try {
      const r = await fetch(`${API}/reports/${reportId}`, {
        method: "DELETE",
        headers: { "Authorization": `Bearer ${token}` }
      });
      if (r.ok) {
        setReports(prev => prev.filter(rep => rep.id !== reportId));
        if (activeReport?.id === reportId) setActiveReport(null);
        showToast("Report deleted successfully");
      }
    } catch (err) {
      showToast("Error deleting report", "error");
    }
  };

  const handleDuplicateReport = async (reportId) => {
    try {
      const r = await fetch(`${API}/reports/${reportId}/duplicate`, {
        method: "POST",
        headers: { "Authorization": `Bearer ${token}` }
      });
      const d = await r.json();
      if (r.ok) {
        showToast("Report duplicated successfully");
        fetchReports(token);
      }
    } catch (err) {
      showToast("Error duplicating report", "error");
    }
  };

  const fetchAdminStats = useCallback(async () => {
    try {
      const r = await fetch(`${API}/admin/stats`, {
        headers: { "Authorization": `Bearer ${token}` }
      });
      if (r.ok) {
        const d = await r.json();
        setAdminStats(d);
      }
    } catch (err) {
      console.error("Failed to fetch admin stats:", err);
    }
  }, [token]);

  const fetchAdminUsers = useCallback(async () => {
    try {
      const r = await fetch(`${API}/admin/users`, {
        headers: { "Authorization": `Bearer ${token}` }
      });
      if (r.ok) {
        const d = await r.json();
        setAdminUsers(d);
      }
    } catch (err) {
      console.error("Failed to fetch admin users:", err);
    }
  }, [token]);

  const handleToggleUserStatus = async (targetUser) => {
    const newStatus = targetUser.status === "active" ? "suspended" : "active";
    try {
      const r = await fetch(`${API}/admin/users/${targetUser.id}/status`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({ status: newStatus })
      });
      if (r.ok) {
        showToast(`User status set to ${newStatus}`);
        setAdminUsers(prev => prev.map(u => u.id === targetUser.id ? { ...u, status: newStatus } : u));
      }
    } catch (err) {
      showToast("Error updating user status", "error");
    }
  };

  const handleDeleteUser = async (userId) => {
    if (!confirm("Are you sure you want to permanently delete this user account?")) return;
    try {
      const r = await fetch(`${API}/admin/users/${userId}`, {
        method: "DELETE",
        headers: { "Authorization": `Bearer ${token}` }
      });
      if (r.ok) {
        showToast("User account permanently deleted");
        setAdminUsers(prev => prev.filter(u => u.id !== userId));
      }
    } catch (err) {
      showToast("Error deleting user", "error");
    }
  };

  const handleContactSubmit = async (e) => {
    e.preventDefault();
    setContactLoading(true);
    try {
      const r = await fetch(`${API}/contact`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: contactName, email: contactEmail, message: contactMessage })
      });
      if (r.ok) {
        setContactSuccess(true);
        setContactMessage("");
        showToast("Support request submitted!");
      }
    } catch (err) {
      showToast("Error submitting contact request", "error");
    } finally {
      setContactLoading(false);
    }
  };

  const handleProfileUpdate = async (e) => {
    e.preventDefault();
    setProfileMessage("");
    setProfileError("");
    try {
      const r = await fetch(`${API}/profile/update`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({ name: profileName || undefined, email: profileEmail || undefined })
      });
      const d = await r.json();
      if (r.ok) {
        setProfileMessage("Profile updated successfully!");
        showToast("Profile details updated");
        setUser(prev => ({ ...prev, name: profileName || prev.name, email: profileEmail || prev.email }));
      } else {
        setProfileError(d.detail || "Update failed");
      }
    } catch (err) {
      setProfileError("Network error updating profile");
    }
  };

  const handlePasswordChange = async (e) => {
    e.preventDefault();
    setProfileMessage("");
    setProfileError("");
    try {
      const r = await fetch(`${API}/profile/change-password`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({ current_password: currentPassword, new_password: newPassword })
      });
      const d = await r.json();
      if (r.ok) {
        setProfileMessage("Password changed successfully!");
        showToast("Password updated");
        setCurrentPassword("");
        setNewPassword("");
      } else {
        setProfileError(d.detail || "Failed to change password");
      }
    } catch (err) {
      setProfileError("Network error changing password");
    }
  };

  const handleAccountDelete = async () => {
    if (!confirm("CRITICAL WARNING: This will permanently delete your account, chats, and reports. This cannot be undone. Are you sure?")) return;
    try {
      const r = await fetch(`${API}/profile/delete-account`, {
        method: "DELETE",
        headers: { "Authorization": `Bearer ${token}` }
      });
      if (r.ok) {
        showToast("Account deleted");
        handleLogoutAction();
      }
    } catch (err) {
      showToast("Error deleting account", "error");
    }
  };

  // Run initial state triggers when user updates
  useEffect(() => {
    if (token && user) {
      setProfileName(user.name || "");
      setProfileEmail(user.email || "");
      fetchReports(token);
      if (user.role === "admin") {
        fetchAdminStats();
        fetchAdminUsers();
      }
    }
  }, [token, user, fetchReports, fetchAdminStats, fetchAdminUsers]);

  // Refetch reports on search update
  useEffect(() => {
    if (token) {
      fetchReports(token);
    }
  }, [reportSearch, reportFavoriteFilter, token, fetchReports]);

  const handleUpgradePayment = async (e) => {
    if (e) e.preventDefault();
    setUpgradeError("");
    setIsUpgrading(true);

    try {
      // 1. Create order on the backend
      const r = await fetch(`${API}/auth/razorpay/create-order`, {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}` 
        },
        body: JSON.stringify({ plan: selectedPlan })
      });
      
      if (!r.ok) {
        const errData = await r.json();
        throw new Error(errData.detail || "Failed to initiate payment");
      }
      
      const order = await r.json();
      
      // If backend says it is simulated (fallback when keys are missing)
      if (order.simulated) {
        setTimeout(() => {
          fetch(`${API}/auth/razorpay/verify`, {
            method: "POST",
            headers: { 
              "Content-Type": "application/json",
              "Authorization": `Bearer ${token}` 
            },
            body: JSON.stringify({
              razorpay_order_id: order.order_id,
              razorpay_payment_id: "pay_mock_123456",
              razorpay_signature: "sig_mock_123456",
              plan: selectedPlan
            })
          }).then(res => res.json()).then(data => {
            setUser(prev => prev ? { ...prev, tier: "pro", subscription_expires_at: data.subscription_expires_at } : null);
            setUpgradeModalOpen(false);
            setActiveInvoice({
              payment_id: "PAY_MOCK_" + Math.random().toString(36).substring(7).toUpperCase(),
              amount: selectedPlan === "1_month" ? "₹49" : selectedPlan === "5_months" ? "₹249" : "₹499",
              plan: selectedPlan,
              date: new Date().toLocaleDateString()
            });
            setCardNum(""); setCardExp(""); setCardCvc(""); setCardName(""); setUpiId("");
            setIsUpgrading(false);
          });
        }, 1500);
        return;
      }

      // Real Razorpay integration
      const options = {
        key: RAZORPAY_KEY_ID,
        amount: order.amount,
        currency: order.currency,
        name: "ResearchAI",
        description: `Research Pro - ${selectedPlan === "1_month" ? "1 Month" : selectedPlan === "5_months" ? "5 Months" : "1 Year"}`,
        image: "/favicon.svg",
        order_id: order.order_id,
        handler: async function (response) {
          try {
            setIsUpgrading(true);
            const verifyRes = await fetch(`${API}/auth/razorpay/verify`, {
              method: "POST",
              headers: { 
                "Content-Type": "application/json",
                "Authorization": `Bearer ${token}` 
              },
              body: JSON.stringify({
                razorpay_order_id: response.razorpay_order_id,
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_signature: response.razorpay_signature,
                plan: selectedPlan
              })
            });
            
            if (verifyRes.ok) {
              const data = await verifyRes.json();
              setUser(prev => prev ? { ...prev, tier: "pro", subscription_expires_at: data.subscription_expires_at } : null);
              setUpgradeModalOpen(false);
              setActiveInvoice({
                payment_id: response.razorpay_payment_id,
                amount: selectedPlan === "1_month" ? "₹49" : selectedPlan === "5_months" ? "₹249" : "₹499",
                plan: selectedPlan,
                date: new Date().toLocaleDateString()
              });
            } else {
              setUpgradeError("Payment signature verification failed.");
            }
          } catch (err) {
            setUpgradeError("Failed to verify payment response.");
          } finally {
            setIsUpgrading(false);
          }
        },
        prefill: {
          name: user?.username || "",
          email: user?.email || ""
        },
        theme: {
          color: "#7c5bf5"
        },
        modal: {
          ondismiss: function() {
            setIsUpgrading(false);
            alert("Payment cancelled.");
          }
        }
      };

      const rzp = new window.Razorpay(options);
      rzp.on('payment.failed', function (response) {
        alert(`Payment failed: ${response.error.description}`);
        setIsUpgrading(false);
      });
      rzp.open();
    } catch (err) {
      setUpgradeError(err.message || "Failed to initialize payment process.");
      setIsUpgrading(false);
    }
  };

  const handleSocialLoginSim = (provider) => {
    setAuthError("");
    const savedEmail = localStorage.getItem("last_social_email");
    if (savedEmail) {
      setLoadingAuth(true);
      setTimeout(() => {
        const mockToken = `mock_social:${savedEmail}:${Math.random().toString(36).substring(7)}`;
        localStorage.setItem("session_token", mockToken);
        setToken(mockToken);
        setLoadingAuth(false);
      }, 1000);
    } else {
      setSocialProvider(provider);
      setSocialEmail("");
      setSocialModalOpen(true);
    }
  };

  const handleSocialSubmit = (e) => {
    e.preventDefault();
    if (!socialEmail.trim()) return;
    const emailLower = socialEmail.trim().toLowerCase();
    setSocialModalOpen(false);
    setLoadingAuth(true);
    setTimeout(() => {
      const mockToken = `mock_social:${emailLower}:${Math.random().toString(36).substring(7)}`;
      localStorage.setItem("session_token", mockToken);
      localStorage.setItem("last_social_email", emailLower);
      setToken(mockToken);
      setLoadingAuth(false);
    }, 1000);
  };

  /* Chat Actions */
  const handleCreateChat = async () => {
    try {
      const r = await fetch(`${API}/chats`, {
        method: "POST",
        headers: { "Authorization": `Bearer ${token}` }
      });
      if (r.ok) {
        const data = await r.json();
        const fresh = {
          id: data.id,
          title: data.title,
          file_info: null,
          summary: "",
          status: "active",
          tags: [],
          messages: []
        };
        setChats(prev => [fresh, ...prev]);
        setActiveId(data.id);
        if (isMobile) setSidebarOpen(false);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleRenameChat = async (chatId, title) => {
    if (!title.trim()) return;
    try {
      const r = await fetch(`${API}/chats/${chatId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({ title })
      });
      if (r.ok) {
        setChats(prev => prev.map(c => c.id === chatId ? { ...c, title } : c));
        setEditingChatId(null);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const toggleFavorite = async (c) => {
    const nextStatus = c.status === "favorite" ? "active" : "favorite";
    try {
      const r = await fetch(`${API}/chats/${c.id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({ status: nextStatus })
      });
      if (r.ok) {
        setChats(prev => prev.map(ch => ch.id === c.id ? { ...ch, status: nextStatus } : ch));
      }
    } catch (e) {
      console.error(e);
    }
  };

  const toggleArchive = async (c) => {
    const nextStatus = c.status === "archived" ? "active" : "archived";
    try {
      const r = await fetch(`${API}/chats/${c.id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({ status: nextStatus })
      });
      if (r.ok) {
        setChats(prev => prev.map(ch => ch.id === c.id ? { ...ch, status: nextStatus } : ch));
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleDeleteChat = async (chatId, e) => {
    e.stopPropagation();
    try {
      const r = await fetch(`${API}/chats/${chatId}`, {
        method: "DELETE",
        headers: { "Authorization": `Bearer ${token}` }
      });
      if (r.ok) {
        setChats(prev => {
          const next = prev.filter(c => c.id !== chatId);
          if (activeId === chatId) {
            if (next.length > 0) {
              setActiveId(next[0].id);
              fetchMessages(next[0].id, token);
            } else {
              setActiveId("");
            }
          }
          return next;
        });
      }
    } catch (e) {
      console.error(e);
    }
  };

  /* Tags */
  const handleAddTag = async (chatId) => {
    const tag = newTagVal.trim();
    if (!tag) return;
    const target = chats.find(c => c.id === chatId);
    if (!target) return;
    const nextTags = [...new Set([...target.tags, tag])].join(",");
    try {
      const r = await fetch(`${API}/chats/${chatId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({ tags: nextTags })
      });
      if (r.ok) {
        setChats(prev => prev.map(c => c.id === chatId ? { ...c, tags: nextTags.split(",") } : c));
        setNewTagVal("");
        setAddingTagId(null);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleRemoveTag = async (chatId, tagToRemove) => {
    const target = chats.find(c => c.id === chatId);
    if (!target) return;
    const nextTags = target.tags.filter(t => t !== tagToRemove).join(",");
    try {
      const r = await fetch(`${API}/chats/${chatId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({ tags: nextTags })
      });
      if (r.ok) {
        setChats(prev => prev.map(c => c.id === chatId ? { ...c, tags: nextTags ? nextTags.split(",") : [] } : c));
      }
    } catch (e) {
      console.error(e);
    }
  };

  /* Upload (XMLHttpRequest for real progress tracking 0-100%) */
  const handleUpload = (file) => {
    const ext = file.name.split('.').pop().toLowerCase();
    if (!['pdf', 'txt', 'md', 'csv'].includes(ext)) { setUploadError("Supported file formats: PDF, TXT, MD, CSV."); return; }
    if (!activeId) { setUploadError("Please select or create a research chat session first."); return; }

    const uploadedCount = chats.filter(c => c.file_info).length;
    if (user?.tier === "free" && uploadedCount >= 3) {
      setUploadError("Free trial upload limit reached (max 3 documents). Please upgrade to Research Pro.");
      setUpgradeModalOpen(true);
      return;
    }

    setUploadError(null); setIsUploading(true); setUploadProgress(0);

    const xhr = new XMLHttpRequest();
    xhr.open("POST", `${API}/upload?filename=${encodeURIComponent(file.name)}&chat_id=${activeId}`);
    xhr.setRequestHeader("Authorization", `Bearer ${token}`);

    xhr.upload.addEventListener("progress", (event) => {
      if (event.lengthComputable) {
        const percent = Math.round((event.loaded / event.total) * 100);
        // Reserve final 5% for vector processing progress indication
        setUploadProgress(percent * 0.95);
      }
    });

    xhr.addEventListener("load", () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        setUploadProgress(100);
        const data = JSON.parse(xhr.responseText);
        setChats(prev => prev.map(c => c.id === activeId ? {
          ...c,
          file_info: { filename: data.filename, chunks: data.total_chunks },
          messages: [...(c.messages || []), {
            id: uid(), role: "assistant",
            content: `📄 **${data.filename}** uploaded successfully.\n📦 ${data.total_chunks} vector chunks indexed for search.\n\nAsk questions about the document below.`
          }]
        } : c));
        if (activeChat?.title === "New Research") {
          handleRenameChat(activeId, data.filename.substring(0, data.filename.lastIndexOf('.')) || data.filename);
        }
      } else {
        setUploadError(`Upload failed with status: ${xhr.status}`);
      }
      setIsUploading(false);
      setTimeout(() => setUploadProgress(0), 1000);
    });

    xhr.addEventListener("error", () => {
      setUploadError("Upload failed. Verify network connection.");
      setIsUploading(false);
    });

    xhr.send(file);
  };

  /* Ask (Streaming AI response) */
  const handleAsk = async () => {
    const q = question.trim(); if (!q || isAsking || !activeId) return;
    setQuestion("");
    
    // Add user message locally
    setChats(prev => prev.map(c => c.id === activeId ? { ...c, messages: [...(c.messages || []), { id: uid(), role: "user", content: q }] } : c));
    setIsAsking(true);

    // Create placeholder assistant message bubble
    const assistantMsgId = uid();
    setChats(prev => prev.map(c => c.id === activeId ? {
      ...c,
      messages: [...(c.messages || []), { id: assistantMsgId, role: "assistant", content: "", sources: [] }]
    } : c));

    try {
      const hist = (activeChat?.messages || []).slice(-10).map(m => ({ role: m.role, content: m.content }));
      const response = await fetch(`${API}/chats/${activeId}/ask`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
        body: JSON.stringify({ question: q, history: hist, persona: persona })
      });

      if (!response.ok) throw new Error("RAG request failed");

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let partialLine = "";
      let assistantContent = "";
      let assistantSources = [];

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        const text = decoder.decode(value, { stream: true });
        const lines = (partialLine + text).split("\n");
        partialLine = lines.pop();

        for (const line of lines) {
          const cleanLine = line.trim();
          if (cleanLine.startsWith("data: ")) {
            const dataStr = cleanLine.slice(6);
            if (dataStr === "[DONE]") break;
            try {
              const parsed = JSON.parse(dataStr);
              if (parsed.sources) {
                assistantSources = parsed.sources;
              } else if (parsed.text) {
                assistantContent += parsed.text;
                // Live update stream text in the chat bubble
                setChats(prev => prev.map(c => c.id === activeId ? {
                  ...c,
                  messages: c.messages.map(m => m.id === assistantMsgId ? { ...m, content: assistantContent, sources: assistantSources } : m)
                } : c));
              }
            } catch (err) {
              console.error(err);
            }
          }
        }
      }
      
      if (activeChat?.title === "New Research") {
        handleRenameChat(activeId, q.slice(0, 35));
      }
    } catch (e) {
      setChats(prev => prev.map(c => c.id === activeId ? {
        ...c,
        messages: c.messages.map(m => m.id === assistantMsgId ? { ...m, content: "⚠️ Request failed. Reconnect to backend." } : m)
      } : c));
    } finally {
      setIsAsking(false);
    }
  };

  /* Summary (Streaming Summary response) */
  const handleSummary = async () => {
    if (isGeneratingSummary || !activeId) return;
    setIsGeneratingSummary(true);

    // User prompt
    setChats(prev => prev.map(c => c.id === activeId ? { ...c, messages: [...(c.messages || []), { id: uid(), role: "user", content: "Generate an executive summary." }] } : c));

    // Assistant placeholder
    const assistantMsgId = uid();
    setChats(prev => prev.map(c => c.id === activeId ? {
      ...c,
      messages: [...(c.messages || []), { id: assistantMsgId, role: "assistant", content: "" }]
    } : c));

    try {
      const response = await fetch(`${API}/chats/${activeId}/summary`, {
        method: "POST",
        headers: { "Authorization": `Bearer ${token}` }
      });

      if (!response.ok) throw new Error("Summary request failed");

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let partialLine = "";
      let assistantContent = "";

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        const text = decoder.decode(value, { stream: true });
        const lines = (partialLine + text).split("\n");
        partialLine = lines.pop();

        for (const line of lines) {
          const cleanLine = line.trim();
          if (cleanLine.startsWith("data: ")) {
            const dataStr = cleanLine.slice(6);
            if (dataStr === "[DONE]") break;
            try {
              const parsed = JSON.parse(dataStr);
              if (parsed.text) {
                assistantContent += parsed.text;
                // Live update stream text for summary
                setChats(prev => prev.map(c => c.id === activeId ? {
                  ...c,
                  summary: assistantContent,
                  messages: c.messages.map(m => m.id === assistantMsgId ? { ...m, content: assistantContent } : m)
                } : c));
              }
            } catch (err) {
              console.error(err);
            }
          }
        }
      }
    } catch (e) {
      setChats(prev => prev.map(c => c.id === activeId ? {
        ...c,
        messages: c.messages.map(m => m.id === assistantMsgId ? { ...m, content: "⚠️ Could not generate summary." } : m)
      } : c));
    } finally {
      setIsGeneratingSummary(false);
    }
  };

  /* Export */
  const exportPDF = () => {
    if (!activeChat) return;
    const text = activeChat.summary || (activeChat.messages || []).filter(m => m.role === "assistant").map(m => m.content).join("\n\n---\n\n");
    const doc = new jsPDF();
    doc.setFont("Helvetica", "bold"); doc.setFontSize(18); doc.setTextColor(124, 91, 245);
    doc.text("ResearchAI Report", 20, 22);
    doc.setDrawColor(124, 91, 245); doc.setLineWidth(0.5); doc.line(20, 27, 190, 27);
    doc.setFont("Helvetica", "normal"); doc.setFontSize(11); doc.setTextColor(30, 30, 30);
    doc.text(doc.splitTextToSize(text, 170), 20, 37);
    doc.save(`Research_${activeChat.title.replace(/\s+/g, "_")}.pdf`);
  };

  /* Filter Chats */
  const filteredChats = useMemo(() => {
    return chats.filter(c => {
      const matchesSearch = c.title.toLowerCase().includes(search.toLowerCase());
      let matchesStatus = true;
      if (selectedStatusFilter === "archived") matchesStatus = c.status === "archived";
      else if (selectedStatusFilter === "favorite") matchesStatus = c.status === "favorite";
      else matchesStatus = c.status !== "archived";
      
      let matchesTag = true;
      if (selectedTagFilter !== "All Tags") {
        matchesTag = c.tags && c.tags.includes(selectedTagFilter);
      }
      return matchesSearch && matchesStatus && matchesTag;
    });
  }, [chats, search, selectedStatusFilter, selectedTagFilter]);

  const allAvailableTags = useMemo(() => {
    const set = new Set();
    chats.forEach(c => c.tags && c.tags.forEach(t => t && set.add(t)));
    return ["All Tags", ...set];
  }, [chats]);

  const grouped = useMemo(() => {
    const groups = {};
    filteredChats.forEach(c => {
      const g = dateGroup(c.updatedAt || c.createdAt);
      (groups[g] ||= []).push(c);
    });
    return groups;
  }, [filteredChats]);

  /* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
  /*  RENDER AUTH SCREEN                          */
  /* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
  const SidebarContent = (
    <div style={{ display:"flex", flexDirection:"column", height:"100%", background:"var(--bg-sidebar)", position:"relative" }}>
      {/* Top glow */}
      <div style={{ position:"absolute", top:0, left:0, right:0, height:100, background:"linear-gradient(180deg, rgba(124,91,245,0.06) 0%, transparent 100%)", pointerEvents:"none" }}/>

      {/* Header */}
      <div style={{ padding:"18px 16px 14px", borderBottom:"1px solid var(--border)", display:"flex", alignItems:"center", justifyContent:"space-between", position:"relative", zIndex:1 }}>
        <div style={{ display:"flex", alignItems:"center", gap:10 }}>
          <div style={{ width:34, height:34, borderRadius:10, background:"var(--grad)", display:"flex", alignItems:"center", justifyContent:"center", boxShadow:"0 0 18px var(--accent-glow)" }}>
            {icon(I.Star, 16)}
          </div>
          <div>
            <div style={{ fontSize:15, fontWeight:800, color:"var(--text)", letterSpacing:"-0.02em" }}>ResearchAI</div>
            <div style={{ fontSize:9, color:"var(--text-3)", letterSpacing:"0.08em", textTransform:"uppercase" }}>Intelligence Engine</div>
          </div>
        </div>
        
        {/* Theme Switcher Button */}
        <button onClick={() => setTheme(prev => prev === "dark" ? "light" : "dark")} title="Switch Theme" style={{ width:30, height:30, borderRadius:8, background:"var(--bg-hover)", border:"none", color:"var(--text-2)", cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center" }}>
          {theme === "dark" ? icon(I.Sun, 14) : icon(I.Moon, 14)}
        </button>

        {isMobile && (
          <button onClick={() => setSidebarOpen(false)} style={{ width:32, height:32, borderRadius:8, background:"var(--bg-hover)", border:"none", color:"var(--text-2)", cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center" }}>
            {icon(I.X, 16)}
          </button>
        )}
      </div>

      {/* User Information */}
      {user && (
        <div style={{ padding:"8px 12px", borderBottom:"1px solid var(--border)", display:"flex", alignItems:"center", gap:8 }}>
          <div style={{ width:26, height:26, borderRadius:"50%", background:"var(--bg-hover)", display:"flex", alignItems:"center", justifyContent:"center", color:"var(--accent)" }}>
            {icon(I.User, 12)}
          </div>
          <div style={{ flex:1, overflow:"hidden" }}>
            <div style={{ fontSize:12, fontWeight:600, color:"var(--text)", textOverflow:"ellipsis", overflow:"hidden" }}>@{user.username}</div>
          </div>
          <button onClick={handleLogout} title="Log Out" style={{ width:22, height:22, borderRadius:6, background:"rgba(239,68,68,0.1)", border:"none", color:"var(--red)", cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center" }}>
            {icon(I.X, 11)}
          </button>
        </div>
      )}

      {/* SaaS Navigation Tabs */}
      <div style={{ padding:"8px 12px", display:"flex", flexDirection:"column", gap:2, borderBottom:"1px solid var(--border)" }}>
        <button className={`tab-btn ${activeTab === 'dashboard' ? 'active' : ''}`} onClick={() => { setActiveTab('dashboard'); if (isMobile) setSidebarOpen(false); }}>
          📊 Dashboard
        </button>
        <button className={`tab-btn ${activeTab === 'workspace' ? 'active' : ''}`} onClick={() => { setActiveTab('workspace'); if (isMobile) setSidebarOpen(false); }}>
          🧠 Workspace
        </button>
        <button className={`tab-btn ${activeTab === 'reports' ? 'active' : ''}`} onClick={() => { setActiveTab('reports'); if (isMobile) setSidebarOpen(false); }}>
          📄 My Reports
        </button>
        <button className={`tab-btn ${activeTab === 'billing' ? 'active' : ''}`} onClick={() => { setActiveTab('billing'); if (isMobile) setSidebarOpen(false); }}>
          💎 SaaS Billing
        </button>
        <button className={`tab-btn ${activeTab === 'settings' ? 'active' : ''}`} onClick={() => { setActiveTab('settings'); if (isMobile) setSidebarOpen(false); }}>
          ⚙️ Settings & Profile
        </button>
        <button className={`tab-btn ${activeTab === 'support' ? 'active' : ''}`} onClick={() => { setActiveTab('support'); if (isMobile) setSidebarOpen(false); }}>
          💬 Help Support
        </button>
        {user && user.role === "admin" && (
          <button className={`tab-btn ${activeTab === 'admin' ? 'active' : ''}`} onClick={() => { setActiveTab('admin'); if (isMobile) setSidebarOpen(false); }} style={{ color: "var(--gold)" }}>
            👑 Admin Panel
          </button>
        )}
      </div>

      {/* Dynamic Sub-Area: Shows Chat List and Filters if Workspace active */}
      {activeTab === 'workspace' && (
        <>
          {/* Free Trial Status alert */}
          {user && user.tier === "free" && (
            <div style={{ padding:"10px 12px", margin:"8px 12px 0", background:"rgba(245,158,11,0.08)", border:"1px solid rgba(245,158,11,0.15)", borderRadius:10, display:"flex", flexDirection:"column", gap:6 }}>
              <div style={{ fontSize:10, color:"var(--gold)", fontWeight:700, textTransform:"uppercase", letterSpacing:"0.05em" }}>⏳ Trial Status</div>
              <div style={{ fontSize:11, color:"var(--text-2)", lineHeight:1.4 }}>{trialDaysRemaining} days remaining ({Math.max(0, 3 - chats.filter(c => c.file_info).length)} uploads left)</div>
              <button onClick={() => { setActiveTab('billing'); }} style={{ padding:"6px", background:"var(--gold)", border:"none", borderRadius:6, color:"#fff", fontSize:11, fontWeight:700, cursor:"pointer", marginTop:4, display:"flex", alignItems:"center", justifyContent:"center", gap:4 }}>🛡️ Upgrade to Pro</button>
            </div>
          )}

          {user && user.tier === "pro" && (
            <div style={{ padding:"10px 12px", margin:"8px 12px 0", background:"rgba(34,197,94,0.08)", border:"1px solid rgba(34,197,94,0.15)", borderRadius:10, display:"flex", flexDirection:"column", gap:4 }}>
              <div style={{ fontSize:10, color:"var(--green)", fontWeight:700, textTransform:"uppercase", letterSpacing:"0.05em" }}>💎 Research Pro Active</div>
              <div style={{ fontSize:11, color:"var(--text-2)", lineHeight:1.4 }}>
                Expires: {user.subscription_expires_at ? new Date(user.subscription_expires_at).toLocaleDateString() : "Lifetime"}
              </div>
            </div>
          )}

          {/* New Chat */}
          <div style={{ padding:"12px 12px 4px" }}>
            <button onClick={handleCreateChat} style={{
              width:"100%", padding:"10px 14px", borderRadius:12, border:"1px dashed rgba(124,91,245,0.3)",
              background:"var(--grad-subtle)", color:"var(--text)", fontSize:13, fontWeight:600,
              cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", gap:8, transition:"all 0.2s",
            }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = "var(--accent)"; e.currentTarget.style.boxShadow = "0 0 12px var(--accent-glow)"; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = "rgba(124,91,245,0.3)"; e.currentTarget.style.boxShadow = "none"; }}
            >
              {icon(I.Plus, 15)} New Research
            </button>
          </div>

          {/* Filter Options */}
          <div style={{ padding:"6px 12px", display:"flex", flexDirection:"column", gap:6 }}>
            {/* Status filters */}
            <div style={{ display:"flex", background:"var(--bg-surface)", padding:2, borderRadius:8, border:"1px solid var(--border)" }}>
              {["all", "favorite", "archived"].map(st => (
                <button key={st} onClick={() => setSelectedStatusFilter(st)} style={{
                  flex:1, padding:"4px 6px", fontSize:11, textTransform:"capitalize", border:"none", borderRadius:6, cursor:"pointer",
                  background: selectedStatusFilter === st ? "var(--bg-hover)" : "transparent",
                  color: selectedStatusFilter === st ? "var(--text)" : "var(--text-3)",
                  fontWeight: selectedStatusFilter === st ? 600 : 500
                }}>
                  {st}
                </button>
              ))}
            </div>

            {/* Tag Filters */}
            <div style={{ display:"flex", alignItems:"center", gap:6 }}>
              <select value={selectedTagFilter} onChange={e => setSelectedTagFilter(e.target.value)} style={{
                width:"100%", padding:"6px 10px", borderRadius:8, background:"var(--bg-surface)", border:"1px solid var(--border)",
                color:"var(--text)", fontSize:11, outline:"none", cursor:"pointer"
              }}>
                {allAvailableTags.map(t => (
                  <option key={t} value={t} style={{ background: "var(--bg-surface)", color: "var(--text)" }}>{t}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Search */}
          <div style={{ padding:"8px 12px" }}>
            <div style={{ display:"flex", alignItems:"center", gap:8, padding:"8px 12px", borderRadius:10, background:"var(--bg-surface)", border:"1px solid var(--border)" }}>
              <div style={{ color:"var(--text-3)", flexShrink:0 }}>{icon(I.Search, 14)}</div>
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search chats..."
                style={{ flex:1, background:"transparent", border:"none", outline:"none", color:"var(--text)", fontSize:13, fontFamily:"inherit" }}
              />
            </div>
          </div>

          {/* Chat List */}
          <div style={{ flex:1, overflowY:"auto", padding:"4px 8px 8px" }}>
            {Object.entries(grouped).map(([group, items]) => (
              <div key={group}>
                <div style={{ fontSize:10, fontWeight:700, color:"var(--text-3)", letterSpacing:"0.1em", textTransform:"uppercase", padding:"12px 8px 6px" }}>{group}</div>
                {items.map(c => {
                  const isActive = c.id === activeId;
                  const isFav = c.status === "favorite";
                  const isArchived = c.status === "archived";
                  
                  return (
                    <div key={c.id} style={{ position:"relative", marginBottom:2 }}>
                      <button onClick={() => { setActiveId(c.id); fetchMessages(c.id, token); if (isMobile) setSidebarOpen(false); }}
                        style={{
                          width:"100%", padding:"10px 10px", borderRadius:10, border:"none", textAlign:"left",
                          background: isActive ? "var(--bg-hover)" : "transparent",
                          color: isActive ? "var(--text)" : "var(--text-2)",
                          fontSize:12.5, fontWeight: isActive ? 600 : 500, cursor:"pointer",
                          display:"flex", alignItems:"center", gap:8, textOverflow:"ellipsis", overflow:"hidden", whiteSpace:"nowrap"
                        }}>
                        {icon(I.Doc, 13)}
                        <span style={{ flex:1, textOverflow:"ellipsis", overflow:"hidden", whiteSpace:"nowrap" }}>{c.title}</span>
                        {isFav && <span style={{ color:"var(--gold)" }}>★</span>}
                      </button>
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </>
      )}

      {activeTab === 'reports' && (
        <div style={{ padding:"12px", display:"flex", flexDirection:"column", gap:10, flex:1 }}>
          <div style={{ fontSize:11, fontWeight:700, color:"var(--text-3)", textTransform:"uppercase", letterSpacing:"0.05em" }}>Filters & Folders</div>
          <div style={{ display:"flex", alignItems:"center", gap:8, padding:"8px 12px", borderRadius:10, background:"var(--bg-surface)", border:"1px solid var(--border)" }}>
            <div style={{ color:"var(--text-3)" }}>{icon(I.Search, 14)}</div>
            <input value={reportSearch} onChange={e => setReportSearch(e.target.value)} placeholder="Search reports..."
              style={{ flex:1, background:"transparent", border:"none", outline:"none", color:"var(--text)", fontSize:12, fontFamily:"inherit" }}
            />
          </div>
          <label style={{ display:"flex", alignItems:"center", gap:8, fontSize:12, color:"var(--text-2)", cursor:"pointer", padding:"4px 0" }}>
            <input type="checkbox" checked={reportFavoriteFilter} onChange={e => setReportFavoriteFilter(e.target.checked)} style={{ accentColor:"var(--accent)" }} />
            Show Favorites Only
          </label>
        </div>
      )}

      {/* Footer */}
      <div style={{ padding:"12px 16px", borderTop:"1px solid var(--border)", display:"flex", alignItems:"center", justifyContent:"space-between" }}>
        <div style={{ display:"flex", alignItems:"center", gap:7 }}>
          <div style={{ width:7, height:7, borderRadius:"50%", background:"var(--green)", animation:"pulseGlow 2s ease-in-out infinite" }}/>
          <span style={{ fontSize:11, color:"var(--text-3)", fontWeight:500 }}>Online</span>
        </div>
        <span style={{ fontSize:9, color:"var(--text-3)", fontFamily:"'JetBrains Mono',monospace" }}>v4.0</span>
      </div>
    </div>
  );

  if (loadingAuth) {
    return (
      <div style={{ display:"flex", minHeight:"100vh", background:"#0b0b10", alignItems:"center", justifyContent:"center", position:"relative" }}>
        <Orbs />
        <div style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:14, zIndex:10 }}>
          <div style={{ width:40, height:40, borderRadius:12, background:"var(--grad)", display:"flex", alignItems:"center", justifyContent:"center", animation:"spin 2s linear infinite" }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round"><circle cx="12" cy="12" r="10" strokeDasharray="30" strokeDashoffset="10"/></svg>
          </div>
          <span style={{ fontSize:13, color:"var(--text-2)", fontWeight:500, letterSpacing:"0.05em" }}>Verifying session...</span>
        </div>
      </div>
    );
  }

  if (connectionError) {
    return (
      <div style={{ display:"flex", minHeight:"100vh", background:"#0b0b10", alignItems:"center", justifyContent:"center", padding:20, position:"relative" }}>
        <Orbs />
        <div className="anim-scaleIn" style={{
          width:"100%", maxWidth:420, padding:32, borderRadius:24, background:"rgba(20,20,28,0.75)",
          backdropFilter:"blur(24px)", border:"1px solid var(--border)", zIndex:10, boxShadow:"0 10px 40px rgba(0,0,0,0.4)",
          textAlign: "center"
        }}>
          <div style={{ display:"flex", flexDirection:"column", alignItems:"center", marginBottom:24 }}>
            <div style={{ width:48, height:48, borderRadius:12, background:"rgba(239,68,68,0.1)", border:"1px solid rgba(239,68,68,0.2)", display:"flex", alignItems:"center", justifyContent:"center", marginBottom:14 }}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
            </div>
            <h2 style={{ fontSize:20, fontWeight:800, color:"#fff" }}>Connection Error</h2>
            <p style={{ fontSize:13, color:"var(--text-2)", marginTop:8, lineHeight:1.5 }}>
              The secure research workspace server is warming up or temporarily unreachable. We are maintaining your session.
            </p>
          </div>
          <button 
            onClick={() => {
              setConnectionError(false);
              setLoadingAuth(true);
              checkAuth(token);
            }} 
            style={{
              width:"100%", padding:"12px 24px", borderRadius:12, border:"none", background:"var(--grad)", color:"#fff",
              fontSize:14, fontWeight:700, cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", gap:8,
              boxShadow:"0 4px 15px var(--accent-glow)", transition:"all 0.3s"
            }}
          >
            Retry Connection
          </button>
          <div style={{ marginTop:16 }}>
            <button 
              onClick={() => {
                setConnectionError(false);
                handleLogoutAction();
              }}
              style={{
                background:"none", border:"none", color:"var(--text-3)", fontSize:12, cursor:"pointer", textDecoration:"underline"
              }}
            >
              Sign out and log in again
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div style={{ display:"flex", minHeight:"100vh", background:"#0b0b10", alignItems:"center", justifyContent:"center", padding:20, position:"relative" }}>
        <Orbs />
        <div className="anim-scaleIn" style={{
          width:"100%", maxWidth:420, padding:32, borderRadius:24, background:"rgba(20,20,28,0.75)",
          backdropFilter:"blur(24px)", border:"1px solid var(--border)", zIndex:10, boxShadow:"0 10px 40px rgba(0,0,0,0.4)"
        }}>
          <div style={{ display:"flex", flexDirection:"column", alignItems:"center", marginBottom:28 }}>
            <div style={{ width:48, height:48, borderRadius:12, background:"var(--grad)", display:"flex", alignItems:"center", justifyContent:"center", marginBottom:14, boxShadow:"0 0 20px var(--accent-glow)" }}>
              {icon(I.Lock, 20)}
            </div>
            <h2 style={{ fontSize:22, fontWeight:800, color:"#fff", letterSpacing:"-0.02em" }}>ResearchAI Hub</h2>
            <p style={{ fontSize:13, color:"var(--text-2)", marginTop:4 }}>Secure research workspace portal</p>
          </div>

          {authError && (
            <div style={{ padding:"10px 14px", borderRadius:10, background:"rgba(239,68,68,0.1)", border:"1px solid rgba(239,68,68,0.2)", color:"var(--red)", fontSize:12, marginBottom:16, display:"flex", flexDirection:"column", gap:8 }}>
              <div>{authError}</div>
              {authError.includes("verify your email") && (
                <button type="button" onClick={async () => {
                  try {
                    const r = await fetch(`${API}/auth/verify-email-by-email`, {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ email: email })
                    });
                    if (r.ok) {
                      setAuthError("Email verified successfully! You can now log in.");
                    } else {
                      const errData = await r.json();
                      setAuthError(errData.detail || "Verification failed");
                    }
                  } catch {
                    setAuthError("Verification request failed. Reconnect server.");
                  }
                }} style={{
                  alignSelf: "flex-start", padding: "6px 10px", borderRadius: 6, background: "var(--grad)",
                  color: "#fff", border: "none", fontSize: 10, fontWeight: 700, cursor: "pointer", marginTop: 2
                }}>
                  👉 Dev Shortcut: Instantly Verify Account
                </button>
              )}
            </div>
          )}

          {authView === "login" && (
            <form onSubmit={handleLogin} style={{ display:"flex", flexDirection:"column", gap:14 }}>
              <div>
                <label htmlFor="username" style={{ fontSize:11, fontWeight:600, color:"var(--text-2)", textTransform:"uppercase", display:"block", marginBottom:6 }}>Username or Email</label>
                <input required id="username" type="text" value={email} onChange={e => setEmail(e.target.value)} placeholder="name@domain.com"
                  style={{ width:"100%", padding:"10px 14px", borderRadius:10, background:"var(--bg-surface)", border:"1px solid var(--border)", color:"#fff", outline:"none", fontSize:14 }}
                />
              </div>
              <div>
                <label htmlFor="password" style={{ fontSize:11, fontWeight:600, color:"var(--text-2)", textTransform:"uppercase", display:"block", marginBottom:6 }}>Password</label>
                <input required id="password" type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••"
                  style={{ width:"100%", padding:"10px 14px", borderRadius:10, background:"var(--bg-surface)", border:"1px solid var(--border)", color:"#fff", outline:"none", fontSize:14 }}
                />
              </div>
              {requires2fa && (
                <div className="anim-slideUp">
                  <label htmlFor="code2fa" style={{ fontSize:11, fontWeight:600, color:"var(--accent)", textTransform:"uppercase", display:"block", marginBottom:6 }}>2FA Code (Default demo: 123456)</label>
                  <input required id="code2fa" type="text" value={code2fa} onChange={e => setCode2fa(e.target.value)} placeholder="123456"
                    style={{ width:"100%", padding:"10px 14px", borderRadius:10, background:"var(--bg-surface)", border:"1px solid var(--accent-glow)", color:"#fff", outline:"none", fontSize:14, fontWeight:"bold", letterSpacing:"0.4em", textAlign:"center" }}
                  />
                </div>
              )}
              <button type="submit" style={{ width:"100%", padding:"12px", borderRadius:12, background:"var(--grad)", color:"#fff", border:"none", fontSize:14, fontWeight:700, cursor:"pointer", boxShadow:"0 4px 16px var(--accent-glow)", marginTop:8 }}>
                Authorize Access
              </button>

              <div style={{ display:"flex", alignItems:"center", gap:10, margin:"10px 0 2px" }}>
                <div style={{ flex:1, height:1, background:"var(--border)" }}/>
                <span style={{ fontSize:10, color:"var(--text-3)", textTransform:"uppercase", letterSpacing:"0.05em" }}>or connect with</span>
                <div style={{ flex:1, height:1, background:"var(--border)" }}/>
              </div>

              <div style={{ display:"flex", gap:8 }}>
                <button type="button" onClick={() => handleSocialLoginSim("google")} style={{
                  flex:1, padding:"10px", borderRadius:10, background:"var(--bg-surface)", border:"1px solid var(--border)",
                  color:"var(--text)", fontSize:12, fontWeight:600, cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", gap:6
                }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" fill="#FBBC05"/>
                    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                  </svg>
                  <span>Google</span>
                </button>
                <button type="button" onClick={() => handleSocialLoginSim("microsoft")} style={{
                  flex:1, padding:"10px", borderRadius:10, background:"var(--bg-surface)", border:"1px solid var(--border)",
                  color:"var(--text)", fontSize:12, fontWeight:600, cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", gap:6
                }}>
                  <svg width="14" height="14" viewBox="0 0 23 23" fill="currentColor">
                    <rect x="0" y="0" width="11" height="11" fill="#F25022"/>
                    <rect x="12" y="0" width="11" height="11" fill="#7FBA00"/>
                    <rect x="0" y="12" width="11" height="11" fill="#00A4EF"/>
                    <rect x="12" y="12" width="11" height="11" fill="#FFB900"/>
                  </svg>
                  <span>Microsoft</span>
                </button>
              </div>

              <div style={{ display:"flex", justifyContent:"space-between", fontSize:12, marginTop:10 }}>
                <span onClick={() => { setAuthView("register"); setAuthError(""); }} style={{ color:"var(--accent)", cursor:"pointer" }}>Create account</span>
                <span onClick={() => { setAuthView("recover"); setAuthError(""); }} style={{ color:"var(--text-2)", cursor:"pointer" }}>Forgot password?</span>
              </div>
            </form>
          )}

          {authView === "register" && (
            <form onSubmit={handleRegister} style={{ display:"flex", flexDirection:"column", gap:14 }}>
              <div>
                <label htmlFor="reg-email" style={{ fontSize:11, fontWeight:600, color:"var(--text-2)", textTransform:"uppercase", display:"block", marginBottom:6 }}>Email Address</label>
                <input required id="reg-email" type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="name@domain.com"
                  style={{ width:"100%", padding:"10px 14px", borderRadius:10, background:"var(--bg-surface)", border:"1px solid var(--border)", color:"#fff", outline:"none", fontSize:14 }}
                />
              </div>
              <div>
                <label htmlFor="reg-username" style={{ fontSize:11, fontWeight:600, color:"var(--text-2)", textTransform:"uppercase", display:"block", marginBottom:6 }}>Username</label>
                <input required id="reg-username" type="text" value={username} onChange={e => setUsername(e.target.value)} placeholder="myresearcher"
                  style={{ width:"100%", padding:"10px 14px", borderRadius:10, background:"var(--bg-surface)", border:"1px solid var(--border)", color:"#fff", outline:"none", fontSize:14 }}
                />
              </div>
              <div>
                <label htmlFor="reg-password" style={{ fontSize:11, fontWeight:600, color:"var(--text-2)", textTransform:"uppercase", display:"block", marginBottom:6 }}>Password (Strong: min 8 char, digits & letters)</label>
                <input required id="reg-password" type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••"
                  style={{
                    width:"100%", padding:"10px 14px", borderRadius:10, background:"var(--bg-surface)",
                    border: password.length >= 8 && /\d/.test(password) && /[a-zA-Z]/.test(password) ? "1px solid var(--green)" : "1px solid var(--border)",
                    color:"#fff", outline:"none", fontSize:14
                  }}
                />
              </div>
              <button type="submit" style={{ width:"100%", padding:"12px", borderRadius:12, background:"var(--grad)", color:"#fff", border:"none", fontSize:14, fontWeight:700, cursor:"pointer", marginTop:8 }}>
                Register Account
              </button>
              <div style={{ textAlign:"center", fontSize:12, marginTop:10 }}>
                <span onClick={() => { setAuthView("login"); setAuthError(""); }} style={{ color:"var(--accent)", cursor:"pointer" }}>Already have an account? Sign in</span>
              </div>
            </form>
          )}

          {authView === "verify_email_sent" && (
            <div style={{ textAlign:"center" }}>
              <p style={{ fontSize:14, color:"var(--green)", fontWeight:"bold", marginBottom:12 }}>Verification Email Triggered!</p>
              <p style={{ fontSize:13, color:"var(--text-2)", lineHeight:1.5, marginBottom:20 }}>
                We have logged a mock verification email. For development purposes, click the button below to instantly verify and proceed:
              </p>
              {recoveryLink && (
                <button
                  onClick={async () => {
                    const tokenParam = recoveryLink.split("token=")[1];
                    try {
                      const r = await fetch(`${API}/auth/verify-email?token=${tokenParam}`);
                      if (r.ok) {
                        setAuthView("login");
                        setAuthError("Email verified successfully! You can now log in.");
                      } else {
                        setAuthError("Verification failed.");
                      }
                    } catch (e) {
                      setAuthError("Connection error.");
                    }
                  }}
                  style={{ width:"100%", padding:"12px", borderRadius:12, background:"var(--grad)", color:"#fff", border:"none", fontSize:14, fontWeight:700, cursor:"pointer" }}
                >
                  Instantly Verify Account
                </button>
              )}
              <div style={{ textAlign:"center", fontSize:12, marginTop:20 }}>
                <span onClick={() => { setAuthView("login"); setAuthError(""); }} style={{ color:"var(--accent)", cursor:"pointer" }}>Back to Login</span>
              </div>
            </div>
          )}

          {authView === "recover" && (
            <form onSubmit={handleRecovery} style={{ display:"flex", flexDirection:"column", gap:14 }}>
              {!recoverySent ? (
                <>
                  <p style={{ fontSize:13, color:"var(--text-2)", marginBottom:6 }}>Input your registered email. We will generate a recovery link below.</p>
                  <div>
                    <label htmlFor="rec-email" style={{ fontSize:11, fontWeight:600, color:"var(--text-2)", textTransform:"uppercase", display:"block", marginBottom:6 }}>Email Address</label>
                    <input required id="rec-email" type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="name@domain.com"
                      style={{ width:"100%", padding:"10px 14px", borderRadius:10, background:"var(--bg-surface)", border:"1px solid var(--border)", color:"#fff", outline:"none", fontSize:14 }}
                    />
                  </div>
                  <button type="submit" style={{ width:"100%", padding:"12px", borderRadius:12, background:"var(--grad)", color:"#fff", border:"none", fontSize:14, fontWeight:700, cursor:"pointer", marginTop:8 }}>
                    Generate Recovery Link
                  </button>
                </>
              ) : (
                <div style={{ textAlign:"center" }}>
                  <p style={{ fontSize:13, color:"var(--green)", marginBottom:16 }}>Recovery Token Successfully Generated!</p>
                  {recoveryLink && (
                    <div style={{ padding:10, background:"var(--bg-surface)", border:"1px solid var(--border)", borderRadius:8, fontSize:12, wordBreak:"break-all", marginBottom:14 }}>
                      <span style={{ color:"var(--accent)", cursor:"pointer", fontWeight:"bold" }} onClick={() => {
                        const tokenParam = recoveryLink.split("token=")[1];
                        setResetToken(tokenParam);
                        setAuthView("reset_password");
                        setAuthError("");
                      }}>
                        👉 Click here to reset your password (token: {recoveryLink.split("token=")[1]})
                      </span>
                    </div>
                  )}
                </div>
              )}
              <div style={{ textAlign:"center", fontSize:12, marginTop:10 }}>
                <span onClick={() => { setAuthView("login"); setAuthError(""); setRecoverySent(false); }} style={{ color:"var(--accent)", cursor:"pointer" }}>Back to Login</span>
              </div>
            </form>
          )}

          {authView === "reset_password" && (
            <form onSubmit={handleResetPassword} style={{ display:"flex", flexDirection:"column", gap:14 }}>
              <div>
                <label htmlFor="new-password" style={{ fontSize:11, fontWeight:600, color:"var(--text-2)", textTransform:"uppercase", display:"block", marginBottom:6 }}>New Password</label>
                <input required id="new-password" type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••"
                  style={{ width:"100%", padding:"10px 14px", borderRadius:10, background:"var(--bg-surface)", border:"1px solid var(--border)", color:"#fff", outline:"none", fontSize:14 }}
                />
              </div>
              <button type="submit" style={{ width:"100%", padding:"12px", borderRadius:12, background:"var(--grad)", color:"#fff", border:"none", fontSize:14, fontWeight:700, cursor:"pointer", marginTop:8 }}>
                Save New Password
              </button>
            </form>
          )}
        </div>
      </div>
    );
  }

  const renderDashboardView = () => {
    const recentReports = reports.slice(0, 2);
    return (
      <div className="anim-scaleIn" style={{ padding: "16px 0", color: "var(--text)" }}>
        <div style={{
          padding: 24, borderRadius: 16, background: "var(--grad)",
          boxShadow: "0 8px 30px var(--accent-glow)", marginBottom: 24
        }}>
          <h2 style={{ fontSize: 22, fontWeight: 800, color: "#fff", marginBottom: 6 }}>
            Welcome back, {user?.name || user?.username}! 👋
          </h2>
          <p style={{ fontSize: 13, color: "rgba(255,255,255,0.8)", lineHeight: 1.5 }}>
            Ready to unlock hidden research insights? Check your analytics or initiate a document analysis session below.
          </p>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 16, marginBottom: 24 }}>
          <div style={{ padding: 20, borderRadius: 16, background: "var(--bg-surface)", border: "1px solid var(--border)" }}>
            <div style={{ fontSize: 11, color: "var(--text-3)", fontWeight: 700, textTransform: "uppercase", marginBottom: 6 }}>Reports Generated</div>
            <div style={{ fontSize: 24, fontWeight: 800, color: "var(--text)" }}>{reports.length}</div>
            <div style={{ fontSize: 11, color: "var(--accent)", marginTop: 6, fontWeight: 600 }}>Active formal PDFs & Word docs</div>
          </div>
          <div style={{ padding: 20, borderRadius: 16, background: "var(--bg-surface)", border: "1px solid var(--border)" }}>
            <div style={{ fontSize: 11, color: "var(--text-3)", fontWeight: 700, textTransform: "uppercase", marginBottom: 6 }}>Research Workspaces</div>
            <div style={{ fontSize: 24, fontWeight: 800, color: "var(--text)" }}>{chats.length}</div>
            <div style={{ fontSize: 11, color: "var(--accent-2)", marginTop: 6, fontWeight: 600 }}>Vector indices compiled</div>
          </div>
          <div style={{ padding: 20, borderRadius: 16, background: "var(--bg-surface)", border: "1px solid var(--border)" }}>
            <div style={{ fontSize: 11, color: "var(--text-3)", fontWeight: 700, textTransform: "uppercase", marginBottom: 6 }}>Subscription Plan</div>
            <div style={{ fontSize: 18, fontWeight: 800, color: user?.tier === "pro" ? "var(--green)" : "var(--gold)", display:"flex", alignItems:"center", gap:6, marginTop:4 }}>
              {user?.tier === "pro" ? "💎 Pro Premium" : "⏳ Free Trial"}
            </div>
            <div style={{ fontSize: 11, color: "var(--text-3)", marginTop: 8 }}>
              {user?.tier === "pro" ? "Unlimited processing active" : `${Math.max(0, 3 - chats.filter(c => c.file_info).length)} uploads remaining`}
            </div>
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 16, marginBottom: 24 }}>
          <div style={{ padding: 20, borderRadius: 16, background: "var(--bg-surface)", border: "1px solid var(--border)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign:"center" }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text)", marginBottom: 12 }}>Trial Usage Credits</div>
            <div style={{ position: "relative", width: 100, height: 100, marginBottom: 12 }}>
              <svg width="100" height="100" viewBox="0 0 36 36" style={{ transform: "rotate(-90deg)" }}>
                <path d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="var(--border)" strokeWidth="3" />
                <path d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="var(--accent)" strokeWidth="3"
                  strokeDasharray={`${(chats.filter(c => c.file_info).length / 3) * 100}, 100`}
                />
              </svg>
              <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, fontWeight: 800, color: "var(--text)" }}>
                {chats.filter(c => c.file_info).length}/3
              </div>
            </div>
            <div style={{ fontSize: 11, color: "var(--text-3)", lineHeight: 1.4 }}>
              Uploaded {chats.filter(c => c.file_info).length} out of 3 maximum free document workspaces. Upgrade to Pro for unlimited files.
            </div>
          </div>

          <div style={{ padding: 20, borderRadius: 16, background: "var(--bg-surface)", border: "1px solid var(--border)" }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text)", marginBottom: 12 }}>Recent Reports</div>
            {recentReports.length === 0 ? (
              <div style={{ fontSize: 12, color: "var(--text-3)", fontStyle: "italic", padding: "20px 0", textAlign:"center" }}>
                No reports generated yet. Go to Workspace to compile your first document report.
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {recentReports.map(rep => (
                  <div key={rep.id} onClick={() => { setActiveReport(rep); setActiveTab("reports"); }} style={{
                    padding: 12, borderRadius: 10, background: "var(--bg-hover)", border: "1px solid var(--border)",
                    cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "space-between"
                  }}>
                    <div style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1, marginRight: 10 }}>
                      <div style={{ fontSize: 12.5, fontWeight: 700, color: "var(--text)" }}>{rep.title}</div>
                      <div style={{ fontSize: 10, color: "var(--text-3)", marginTop: 2 }}>{new Date(rep.created_at).toLocaleDateString()}</div>
                    </div>
                    <span style={{ fontSize: 12, color: "var(--accent)" }}>View Report →</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div style={{ padding: 20, borderRadius: 16, background: "var(--bg-surface)", border: "1px solid var(--border)", display:"flex", alignItems:"center", justifyContent:"space-between", flexWrap:"wrap", gap:16 }}>
          <div style={{ flex: 1, minWidth: 240 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: "#fff", marginBottom: 4 }}>Launch Workspace</div>
            <div style={{ fontSize: 12, color: "var(--text-3)" }}>Upload files, chat with PDFs, and generate intelligence insights.</div>
          </div>
          <button onClick={() => setActiveTab("workspace")} style={{
            padding: "10px 20px", borderRadius: 10, background: "var(--grad)", color: "#fff", border: "none",
            fontSize: 13, fontWeight: 700, cursor: "pointer", boxShadow: "0 2px 10px var(--accent-glow)"
          }}>
            Open Workspace
          </button>
        </div>
      </div>
    );
  };

  const renderReportsView = () => {
    if (activeReport) {
      return (
        <div className="anim-scaleIn" style={{ padding: "8px 0", color: "var(--text)" }}>
          <div style={{
            display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between",
            padding: "12px 16px", background: "var(--bg-surface)", borderRadius: 12, border: "1px solid var(--border)",
            marginBottom: 20, gap: 10
          }}>
            <button onClick={() => setActiveReport(null)} style={{
              background: "none", border: "none", color: "var(--text-2)", fontSize: 12, cursor: "pointer", fontWeight: 600,
              display: "flex", alignItems: "center", gap: 4
            }}>
              ← Back to list
            </button>
            
            <div style={{ display: "flex", gap: 6 }}>
              <button onClick={() => handleToggleReportFavorite(activeReport)} style={{
                padding: "6px 12px", borderRadius: 8, background: "var(--bg-hover)", border: "1px solid var(--border)",
                color: activeReport.is_favorite ? "var(--gold)" : "var(--text-2)", fontSize: 11, fontWeight: 600, cursor: "pointer"
              }}>
                {activeReport.is_favorite ? "★ Favorited" : "☆ Favorite"}
              </button>
              <button onClick={() => handleDownloadReportPDF(activeReport)} style={{
                padding: "6px 12px", borderRadius: 8, background: "var(--bg-hover)", border: "1px solid var(--border)",
                color: "var(--text-2)", fontSize: 11, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", gap: 4
              }}>
                ⬇️ PDF
              </button>
              <button onClick={() => handleDownloadDocx(activeReport)} style={{
                padding: "6px 12px", borderRadius: 8, background: "var(--bg-hover)", border: "1px solid var(--border)",
                color: "var(--text-2)", fontSize: 11, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", gap: 4
              }}>
                ⬇️ Word
              </button>
              <button onClick={() => {
                navigator.clipboard.writeText(JSON.stringify(activeReport, null, 2));
                showToast("Copied JSON structure to clipboard");
              }} style={{
                padding: "6px 12px", borderRadius: 8, background: "var(--bg-hover)", border: "1px solid var(--border)",
                color: "var(--text-2)", fontSize: 11, fontWeight: 600, cursor: "pointer"
              }}>
                📋 Copy JSON
              </button>
              <button onClick={() => handleDeleteReport(activeReport.id)} style={{
                padding: "6px 12px", borderRadius: 8, background: "rgba(239,68,68,0.1)", border: "none",
                color: "var(--red)", fontSize: 11, fontWeight: 600, cursor: "pointer"
              }}>
                🗑️ Delete
              </button>
            </div>
          </div>

          <div style={{
            padding: 32, borderRadius: 16, background: "var(--bg-surface)", border: "1px solid var(--border)",
            boxShadow: "0 4px 20px rgba(0,0,0,0.2)", lineHeight: 1.8, fontSize: 14.5
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", borderBottom: "1px solid var(--border)", paddingBottom: 16, marginBottom: 24 }}>
              <div>
                <h2 style={{ fontSize: 22, fontWeight: 800, color: "var(--text)", marginBottom: 6 }}>{activeReport.title}</h2>
                <div style={{ fontSize: 11, color: "var(--text-3)" }}>
                  Report ID: {activeReport.id} · Generated: {new Date(activeReport.created_at).toLocaleDateString()}
                </div>
              </div>
              <div style={{
                padding: "6px 12px", borderRadius: 20, background: "linear-gradient(135deg, rgba(34,197,94,0.1) 0%, rgba(59,130,246,0.1) 100%)",
                border: "1px solid rgba(34,197,94,0.2)", display: "flex", alignItems: "center", gap: 6
              }}>
                <span style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--green)" }}/>
                <span style={{ fontSize: 11, fontWeight: 700, color: "var(--green)", textTransform: "uppercase" }}>
                  Confidence: {(activeReport.confidence_score * 100).toFixed(0)}%
                </span>
              </div>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
              <div>
                <h3 style={{ fontSize: 15, fontWeight: 800, color: "var(--accent)", marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.05em" }}>1. Executive Summary</h3>
                <p style={{ color: "var(--text-2)", whiteSpace: "pre-wrap" }}>{activeReport.executive_summary}</p>
              </div>

              <div>
                <h3 style={{ fontSize: 15, fontWeight: 800, color: "var(--accent)", marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.05em" }}>2. Research Overview</h3>
                <p style={{ color: "var(--text-2)", whiteSpace: "pre-wrap" }}>{activeReport.research_overview}</p>
              </div>

              <div>
                <h3 style={{ fontSize: 15, fontWeight: 800, color: "var(--accent)", marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.05em" }}>3. Detailed Analysis</h3>
                <p style={{ color: "var(--text-2)", whiteSpace: "pre-wrap" }}>{activeReport.detailed_analysis}</p>
              </div>

              <div>
                <h3 style={{ fontSize: 15, fontWeight: 800, color: "var(--accent)", marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.05em" }}>4. Key Findings</h3>
                <p style={{ color: "var(--text-2)", whiteSpace: "pre-wrap" }}>{activeReport.key_findings}</p>
              </div>

              <div>
                <h3 style={{ fontSize: 15, fontWeight: 800, color: "var(--accent)", marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.05em" }}>5. AI Insights</h3>
                <p style={{ color: "var(--text-2)", whiteSpace: "pre-wrap" }}>{activeReport.ai_insights}</p>
              </div>

              <div>
                <h3 style={{ fontSize: 15, fontWeight: 800, color: "var(--accent)", marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.05em" }}>6. Recommendations</h3>
                <p style={{ color: "var(--text-2)", whiteSpace: "pre-wrap" }}>{activeReport.recommendations}</p>
              </div>

              <div>
                <h3 style={{ fontSize: 15, fontWeight: 800, color: "var(--accent)", marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.05em" }}>7. Conclusion</h3>
                <p style={{ color: "var(--text-2)", whiteSpace: "pre-wrap" }}>{activeReport.conclusion}</p>
              </div>
            </div>
          </div>
        </div>
      );
    }

    return (
      <div className="anim-scaleIn" style={{ padding: "8px 0" }}>
        <h2 style={{ fontSize: 18, fontWeight: 800, color: "var(--text)", marginBottom: 16 }}>Report History</h2>
        
        {reports.length === 0 ? (
          <div style={{
            padding: 40, background: "var(--bg-surface)", border: "1px solid var(--border)", borderRadius: 16,
            textAlign: "center", color: "var(--text-3)", fontStyle: "italic"
          }}>
            No reports generated yet. Navigate to Workspace, select a research chat with an uploaded document, and click "Generate Report".
          </div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 16 }}>
            {reports.map(rep => (
              <div key={rep.id} style={{
                padding: 20, borderRadius: 16, background: "var(--bg-surface)", border: "1px solid var(--border)",
                display: "flex", flexDirection: "column", justifyContent: "space-between", position: "relative"
              }}>
                <div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
                    <h3 style={{ fontSize: 14, fontWeight: 700, color: "#fff", cursor: "pointer", overflow: "hidden", textOverflow: "ellipsis", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", lineHeight: 1.4 }} onClick={() => setActiveReport(rep)}>
                      {rep.title}
                    </h3>
                    <span onClick={() => handleToggleReportFavorite(rep)} style={{ cursor: "pointer", color: rep.is_favorite ? "var(--gold)" : "var(--text-3)" }}>
                      {rep.is_favorite ? "★" : "☆"}
                    </span>
                  </div>
                  <p style={{ fontSize: 12, color: "var(--text-2)", lineHeight: 1.5, overflow: "hidden", textOverflow: "ellipsis", display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical", marginBottom: 12 }}>
                    {rep.executive_summary}
                  </p>
                </div>
                
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderTop: "1px solid var(--border)", paddingTop: 10, marginTop: 4 }}>
                  <span style={{ fontSize: 10, color: "var(--text-3)" }}>{new Date(rep.created_at).toLocaleDateString()}</span>
                  <div style={{ display: "flex", gap: 8 }}>
                    <button onClick={() => handleDuplicateReport(rep.id)} title="Duplicate" style={{ background:"none", border:"none", color:"var(--text-3)", cursor:"pointer" }}>
                      Copy
                    </button>
                    <button onClick={() => setActiveReport(rep)} style={{ background:"none", border:"none", color:"var(--accent)", fontWeight: 700, cursor:"pointer", fontSize: 12 }}>
                      Open →
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  const renderBillingView = () => {
    return (
      <div className="anim-scaleIn" style={{ padding: "8px 0", color: "var(--text)" }}>
        <h2 style={{ fontSize: 18, fontWeight: 800, color: "var(--text)", marginBottom: 6 }}>Upgrade Your Plan</h2>
        <p style={{ fontSize: 13, color: "var(--text-2)", marginBottom: 24 }}>Select a plan that matches your research intensity. Unlock unlimited indexing today.</p>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 20, marginBottom: 32 }}>
          <div style={{
            padding: 24, borderRadius: 16, background: "var(--bg-surface)", border: "1px solid var(--border)",
            display: "flex", flexDirection: "column", justifyContent: "space-between"
          }}>
            <div>
              <div style={{ fontSize: 16, fontWeight: 800, color: "var(--text)" }}>Free Sandbox</div>
              <div style={{ fontSize: 11, color: "var(--text-3)", marginTop: 2, textTransform: "uppercase" }}>Starter Package</div>
              <div style={{ fontSize: 28, fontWeight: 800, margin: "20px 0" }}>₹0 <span style={{ fontSize: 12, fontWeight: 500, color: "var(--text-3)" }}>/ forever</span></div>
              <ul style={{ paddingLeft: 16, fontSize: 12.5, color: "var(--text-2)", display: "flex", flexDirection: "column", gap: 8, marginBottom: 20 }}>
                <li>Limit: 3 document uploads</li>
                <li>Standard speed RAG</li>
                <li>Limit: 3 generated reports</li>
                <li>Basic search parameters</li>
              </ul>
            </div>
            <button disabled style={{
              width: "100%", padding: 12, borderRadius: 10, background: "var(--bg-hover)", border: "none",
              color: "var(--text-3)", fontSize: 12, fontWeight: 700
            }}>
              Current Active Plan
            </button>
          </div>

          <div style={{
            padding: 24, borderRadius: 16, background: "rgba(124, 91, 245, 0.04)", border: "2px solid var(--accent)",
            boxShadow: "0 0 20px var(--accent-glow)", display: "flex", flexDirection: "column", justifyContent: "space-between",
            position: "relative"
          }}>
            <div style={{
              position: "absolute", top: -12, right: 20, padding: "3px 10px", borderRadius: 20, background: "var(--grad)",
              color: "#fff", fontSize: 9, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.05em"
            }}>
              Popular
            </div>
            <div>
              <div style={{ fontSize: 16, fontWeight: 800, color: "var(--text)" }}>Research Pro</div>
              <div style={{ fontSize: 11, color: "var(--accent)", marginTop: 2, textTransform: "uppercase", fontWeight:700 }}>Unlimited Insights</div>
              
              <div style={{ display: "flex", background: "var(--bg-surface)", padding: 2, borderRadius: 8, border: "1px solid var(--border)", margin: "16px 0" }}>
                <button onClick={() => setSelectedPlan("1_month")} style={{
                  flex: 1, padding: "4px 8px", fontSize: 11, border: "none", borderRadius: 6, cursor: "pointer",
                  background: selectedPlan === "1_month" ? "var(--bg-hover)" : "transparent",
                  color: selectedPlan === "1_month" ? "var(--text)" : "var(--text-3)",
                  fontWeight: selectedPlan === "1_month" ? 700 : 500
                }}>
                  Monthly
                </button>
                <button onClick={() => setSelectedPlan("12_months")} style={{
                  flex: 1, padding: "4px 8px", fontSize: 11, border: "none", borderRadius: 6, cursor: "pointer",
                  background: selectedPlan === "12_months" ? "var(--bg-hover)" : "transparent",
                  color: selectedPlan === "12_months" ? "var(--text)" : "var(--text-3)",
                  fontWeight: selectedPlan === "12_months" ? 700 : 500
                }}>
                  Yearly (Save 20%)
                </button>
              </div>

              <div style={{ fontSize: 28, fontWeight: 800, marginBottom: 20 }}>
                {selectedPlan === "1_month" ? "₹49" : "₹499"}
                <span style={{ fontSize: 12, fontWeight: 500, color: "var(--text-3)" }}>
                  {selectedPlan === "1_month" ? " / month" : " / year"}
                </span>
              </div>
              <ul style={{ paddingLeft: 16, fontSize: 12.5, color: "var(--text-2)", display: "flex", flexDirection: "column", gap: 8, marginBottom: 20 }}>
                <li><strong>Unlimited</strong> document uploads</li>
                <li>Priority speed semantic RAG</li>
                <li><strong>Unlimited</strong> generated reports</li>
                <li>All search parameters and export logs</li>
                <li>24/7 Priority support tickets</li>
              </ul>
            </div>
            <button onClick={handleUpgradePayment} disabled={isUpgrading || user?.tier === "pro"} style={{
              width: "100%", padding: 12, borderRadius: 10, background: "var(--grad)", border: "none",
              color: "#fff", fontSize: 12, fontWeight: 700, cursor: "pointer", boxShadow: "0 4px 15px var(--accent-glow)"
            }}>
              {user?.tier === "pro" ? "✓ Pro Plan Active" : isUpgrading ? "🔄 Initiating Payment..." : "Upgrade Now"}
            </button>
          </div>
        </div>

        {activeInvoice && (
          <div style={{
            padding: 20, borderRadius: 16, background: "var(--bg-surface)", border: "1px solid var(--border)",
            marginBottom: 24, animation: "slideInUp 0.3s ease"
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <div style={{ fontSize: 14, fontWeight: 700 }}>Order Invoice Generated</div>
              <button onClick={() => setActiveInvoice(null)} style={{ background: "none", border: "none", color: "var(--text-3)", cursor: "pointer", fontSize: 14 }}>×</button>
            </div>
            <div style={{ fontSize: 12, color: "var(--text-2)", lineHeight: 1.6, marginBottom: 14 }}>
              Payment Captured: <strong>{activeInvoice.razorpay_payment_id}</strong><br/>
              Plan Selected: {activeInvoice.plan === "1_month" ? "1 Month Pro" : "12 Months Pro"}<br/>
              Billing Total: {activeInvoice.plan === "1_month" ? "₹49" : "₹499"}<br/>
            </div>
            <button onClick={() => downloadInvoicePDF(activeInvoice.razorpay_payment_id, activeInvoice.plan === "1_month" ? "₹49" : "₹499", activeInvoice.plan)} style={{
              padding: "8px 16px", borderRadius: 8, background: "var(--grad-subtle)", border: "1px solid var(--border)",
              color: "var(--accent)", fontSize: 11, fontWeight: 700, cursor: "pointer"
            }}>
              ⬇️ Download Receipt PDF
            </button>
          </div>
        )}
      </div>
    );
  };

  const renderSettingsView = () => {
    return (
      <div className="anim-scaleIn" style={{ padding: "8px 0", color: "var(--text)" }}>
        <h2 style={{ fontSize: 18, fontWeight: 800, color: "var(--text)", marginBottom: 6 }}>Account Settings</h2>
        <p style={{ fontSize: 13, color: "var(--text-2)", marginBottom: 24 }}>Manage your profile parameters, security, and notification settings.</p>

        {profileMessage && <div style={{ padding: "10px 14px", background: "rgba(34,197,94,0.08)", border: "1px solid var(--green)", borderRadius: 8, color: "var(--green)", fontSize: 12.5, marginBottom: 16 }}>{profileMessage}</div>}
        {profileError && <div style={{ padding: "10px 14px", background: "rgba(239,68,68,0.08)", border: "1px solid var(--red)", borderRadius: 8, color: "var(--red)", fontSize: 12.5, marginBottom: 16 }}>{profileError}</div>}

        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          <form onSubmit={handleProfileUpdate} style={{ padding: 20, borderRadius: 16, background: "var(--bg-surface)", border: "1px solid var(--border)" }}>
            <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 14 }}>Profile Information</h3>
            <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 16 }}>
              <div>
                <label style={{ fontSize: 11, fontWeight: 700, color: "var(--text-3)", textTransform: "uppercase", display: "block", marginBottom: 6 }}>Display Name</label>
                <input type="text" value={profileName} onChange={e => setProfileName(e.target.value)}
                  style={{ width: "100%", padding: "10px 12px", borderRadius: 8, background: "var(--bg-root)", border: "1px solid var(--border)", color: "#fff", outline: "none", fontSize: 13 }}
                />
              </div>
              <div>
                <label style={{ fontSize: 11, fontWeight: 700, color: "var(--text-3)", textTransform: "uppercase", display: "block", marginBottom: 6 }}>Email Address</label>
                <input type="email" value={profileEmail} onChange={e => setProfileEmail(e.target.value)}
                  style={{ width: "100%", padding: "10px 12px", borderRadius: 8, background: "var(--bg-root)", border: "1px solid var(--border)", color: "#fff", outline: "none", fontSize: 13 }}
                />
              </div>
            </div>
            <button type="submit" style={{ padding: "8px 16px", borderRadius: 8, background: "var(--grad)", color: "#fff", border: "none", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
              Save Changes
            </button>
          </form>

          <form onSubmit={handlePasswordChange} style={{ padding: 20, borderRadius: 16, background: "var(--bg-surface)", border: "1px solid var(--border)" }}>
            <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 14 }}>Security & Password</h3>
            <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 16 }}>
              <div>
                <label style={{ fontSize: 11, fontWeight: 700, color: "var(--text-3)", textTransform: "uppercase", display: "block", marginBottom: 6 }}>Current Password</label>
                <input type="password" value={currentPassword} onChange={e => setCurrentPassword(e.target.value)} required
                  style={{ width: "100%", padding: "10px 12px", borderRadius: 8, background: "var(--bg-root)", border: "1px solid var(--border)", color: "#fff", outline: "none", fontSize: 13 }}
                />
              </div>
              <div>
                <label style={{ fontSize: 11, fontWeight: 700, color: "var(--text-3)", textTransform: "uppercase", display: "block", marginBottom: 6 }}>New Password</label>
                <input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} required
                  style={{ width: "100%", padding: "10px 12px", borderRadius: 8, background: "var(--bg-root)", border: "1px solid var(--border)", color: "#fff", outline: "none", fontSize: 13 }}
                />
              </div>
            </div>
            <button type="submit" style={{ padding: "8px 16px", borderRadius: 8, background: "var(--grad)", color: "#fff", border: "none", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
              Change Password
            </button>
          </form>

          <div style={{ padding: 20, borderRadius: 16, background: "var(--bg-surface)", border: "1px solid var(--border)", display: "flex", flexDirection: "column", gap: 14 }}>
            <h3 style={{ fontSize: 14, fontWeight: 700 }}>System Options</h3>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <div style={{ fontSize: 12.5, fontWeight: 700 }}>Theme Mode</div>
                <div style={{ fontSize: 11, color: "var(--text-3)" }}>Toggle between light and dark display theme</div>
              </div>
              <button type="button" onClick={() => setTheme(prev => prev === "dark" ? "light" : "dark")} style={{
                padding: "6px 12px", borderRadius: 8, background: "var(--bg-hover)", border: "1px solid var(--border)",
                color: "var(--text)", fontSize: 11, fontWeight: 600, cursor: "pointer"
              }}>
                {theme === "dark" ? "☀️ Light Mode" : "🌙 Dark Mode"}
              </button>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <div style={{ fontSize: 12.5, fontWeight: 700 }}>Email notifications</div>
                <div style={{ fontSize: 11, color: "var(--text-3)" }}>Receive invoices and system updates</div>
              </div>
              <input type="checkbox" checked={notificationOptIn} onChange={e => setNotificationOptIn(e.target.checked)} style={{ accentColor:"var(--accent)" }} />
            </div>
          </div>

          <div style={{ padding: 20, borderRadius: 16, background: "var(--bg-surface)", border: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
            <div>
              <div style={{ fontSize: 12.5, fontWeight: 700, color: "var(--red)" }}>Delete Account</div>
              <div style={{ fontSize: 11, color: "var(--text-3)", marginTop: 2 }}>Permanently erase your data, chats, and subscription settings.</div>
            </div>
            <button onClick={handleAccountDelete} style={{
              padding: "10px 20px", borderRadius: 10, background: "rgba(239,68,68,0.1)", border: "none",
              color: "var(--red)", fontSize: 12, fontWeight: 700, cursor: "pointer"
            }}>
              Delete Account
            </button>
          </div>
        </div>
      </div>
    );
  };

  const renderSupportView = () => {
    return (
      <div className="anim-scaleIn" style={{ padding: "8px 0", color: "var(--text)" }}>
        <h2 style={{ fontSize: 18, fontWeight: 800, color: "var(--text)", marginBottom: 6 }}>Help & Support Desk</h2>
        <p style={{ fontSize: 13, color: "var(--text-2)", marginBottom: 24 }}>Browse FAQ options or contact our lead systems engineers for priority aid.</p>

        <div style={{ padding: 20, borderRadius: 16, background: "var(--bg-surface)", border: "1px solid var(--border)", marginBottom: 24 }}>
          <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 14 }}>Frequently Asked Questions</h3>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <details style={{ cursor: "pointer", padding: "6px 0", borderBottom: "1px solid var(--border)" }}>
              <summary style={{ fontSize: 13, fontWeight: 700, color: "#fff", marginBottom: 6 }}>How does ResearchAI analyze files?</summary>
              <p style={{ fontSize: 12, color: "var(--text-2)", lineHeight: 1.6, paddingLeft: 10 }}>
                We parse your files page-by-page, split them into sliding contextual windows of 1,000 characters, vectorize them, and index them in ChromaDB. Asking queries runs a semantic retrieval search to supply real context to our LLM.
              </p>
            </details>
            <details style={{ cursor: "pointer", padding: "6px 0", borderBottom: "1px solid var(--border)" }}>
              <summary style={{ fontSize: 13, fontWeight: 700, color: "#fff", marginBottom: 6 }}>What document formats are supported?</summary>
              <p style={{ fontSize: 12, color: "var(--text-2)", lineHeight: 1.6, paddingLeft: 10 }}>
                We support PDF files, text files (.txt, .md, .csv), and Office formats (.docx, .xlsx, .pptx).
              </p>
            </details>
            <details style={{ cursor: "pointer", padding: "6px 0", borderBottom: "1px solid var(--border)" }}>
              <summary style={{ fontSize: 13, fontWeight: 700, color: "#fff", marginBottom: 6 }}>Is my research data secure?</summary>
              <p style={{ fontSize: 12, color: "var(--text-2)", lineHeight: 1.6, paddingLeft: 10 }}>
                Yes. All document chunks and vector indices are isolated per user session. Data is encrypted at rest and files are immediately erased from server memory after indexing.
              </p>
            </details>
          </div>
        </div>

        {contactSuccess ? (
          <div style={{ padding: 24, borderRadius: 16, background: "rgba(34,197,94,0.08)", border: "1px solid var(--green)", color: "var(--green)", textAlign:"center" }}>
            <h3 style={{ fontWeight: 800, marginBottom: 6 }}>Support Inquiry Logged!</h3>
            <p style={{ fontSize: 12.5, lineHeight: 1.5 }}>
              Thank you. A confirmation receipt has been simulated to your email. Our team will review and reply within 24 hours.
            </p>
            <button onClick={() => setContactSuccess(false)} style={{
              marginTop: 14, padding: "6px 16px", borderRadius: 8, background: "var(--green)", border: "none", color: "#fff", fontSize: 11, fontWeight: 700, cursor: "pointer"
            }}>
              Log Another Inquiry
            </button>
          </div>
        ) : (
          <form onSubmit={handleContactSubmit} style={{ padding: 20, borderRadius: 16, background: "var(--bg-surface)", border: "1px solid var(--border)" }}>
            <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 14 }}>Contact Technical Support</h3>
            <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 16 }}>
              <div>
                <label style={{ fontSize: 11, fontWeight: 700, color: "var(--text-3)", textTransform: "uppercase", display: "block", marginBottom: 6 }}>Full Name</label>
                <input type="text" value={contactName} onChange={e => setContactName(e.target.value)} required placeholder="John Doe"
                  style={{ width: "100%", padding: "10px 12px", borderRadius: 8, background: "var(--bg-root)", border: "1px solid var(--border)", color: "#fff", outline: "none", fontSize: 13 }}
                />
              </div>
              <div>
                <label style={{ fontSize: 11, fontWeight: 700, color: "var(--text-3)", textTransform: "uppercase", display: "block", marginBottom: 6 }}>Support Email</label>
                <input type="email" value={contactEmail} onChange={e => setContactEmail(e.target.value)} required placeholder="name@domain.com"
                  style={{ width: "100%", padding: "10px 12px", borderRadius: 8, background: "var(--bg-root)", border: "1px solid var(--border)", color: "#fff", outline: "none", fontSize: 13 }}
                />
              </div>
              <div>
                <label style={{ fontSize: 11, fontWeight: 700, color: "var(--text-3)", textTransform: "uppercase", display: "block", marginBottom: 6 }}>Detailed Message</label>
                <textarea value={contactMessage} onChange={e => setContactMessage(e.target.value)} required placeholder="Explain your issue..." rows="4"
                  style={{ width: "100%", padding: "10px 12px", borderRadius: 8, background: "var(--bg-root)", border: "1px solid var(--border)", color: "#fff", outline: "none", fontSize: 13, resize: "none" }}
                />
              </div>
            </div>
            <button type="submit" disabled={contactLoading} style={{
              width: "100%", padding: 12, borderRadius: 10, background: "var(--grad)", color: "#fff", border: "none",
              fontSize: 12, fontWeight: 700, cursor: "pointer", boxShadow: "0 4px 15px var(--accent-glow)"
            }}>
              {contactLoading ? "🔄 Sending inquiry..." : "Submit Inquiry"}
            </button>
          </form>
        )}
      </div>
    );
  };

  const renderAdminView = () => {
    const filteredUsers = adminUsers.filter(u =>
      u.username.toLowerCase().includes(adminSearch.toLowerCase()) ||
      u.email.toLowerCase().includes(adminSearch.toLowerCase())
    );

    return (
      <div className="anim-scaleIn" style={{ padding: "8px 0", color: "var(--text)" }}>
        <h2 style={{ fontSize: 18, fontWeight: 800, color: "var(--text)", marginBottom: 6 }}>SaaS Analytics & Administration</h2>
        <p style={{ fontSize: 13, color: "var(--text-2)", marginBottom: 24 }}>Verify users list, revenue estimates, and active premium subscriptions.</p>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12, marginBottom: 24 }}>
          <div style={{ padding: 14, borderRadius: 12, background: "var(--bg-surface)", border: "1px solid var(--border)" }}>
            <div style={{ fontSize: 10, color: "var(--text-3)", fontWeight: 700, textTransform: "uppercase", marginBottom: 4 }}>Total Platform Users</div>
            <div style={{ fontSize: 20, fontWeight: 800 }}>{adminStats?.total_users ?? 0}</div>
          </div>
          <div style={{ padding: 14, borderRadius: 12, background: "var(--bg-surface)", border: "1px solid var(--border)" }}>
            <div style={{ fontSize: 10, color: "var(--text-3)", fontWeight: 700, textTransform: "uppercase", marginBottom: 4 }}>Active Pro Accounts</div>
            <div style={{ fontSize: 20, fontWeight: 800, color: "var(--green)" }}>{adminStats?.active_subscriptions ?? 0}</div>
          </div>
          <div style={{ padding: 14, borderRadius: 12, background: "var(--bg-surface)", border: "1px solid var(--border)" }}>
            <div style={{ fontSize: 10, color: "var(--text-3)", fontWeight: 700, textTransform: "uppercase", marginBottom: 4 }}>Monthly Revenue Est.</div>
            <div style={{ fontSize: 20, fontWeight: 800, color: "var(--accent)" }}>₹{(adminStats?.total_revenue ?? 0).toFixed(2)}</div>
          </div>
          <div style={{ padding: 14, borderRadius: 12, background: "var(--bg-surface)", border: "1px solid var(--border)" }}>
            <div style={{ fontSize: 10, color: "var(--text-3)", fontWeight: 700, textTransform: "uppercase", marginBottom: 4 }}>Monthly Growth (30d)</div>
            <div style={{ fontSize: 20, fontWeight: 800, color: "var(--accent-2)" }}>+{adminStats?.users_growth ?? 0} users</div>
          </div>
        </div>

        <div style={{ padding: 20, borderRadius: 16, background: "var(--bg-surface)", border: "1px solid var(--border)" }}>
          <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", alignItems: "center", marginBottom: 14, gap: 10 }}>
            <h3 style={{ fontSize: 14, fontWeight: 700 }}>User Management</h3>
            <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 12px", borderRadius: 8, background: "var(--bg-root)", border: "1px solid var(--border)" }}>
              {icon(I.Search, 12)}
              <input value={adminSearch} onChange={e => setAdminSearch(e.target.value)} placeholder="Search users..."
                style={{ background: "transparent", border: "none", outline:"none", color: "var(--text)", fontSize: 12, fontFamily: "inherit" }}
              />
            </div>
          </div>

          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5, textAlign: "left" }}>
              <thead>
                <tr style={{ borderBottom: "1px solid var(--border)", color: "var(--text-3)" }}>
                  <th style={{ padding: "8px 10px" }}>Username</th>
                  <th style={{ padding: "8px 10px" }}>Email</th>
                  <th style={{ padding: "8px 10px" }}>Tier</th>
                  <th style={{ padding: "8px 10px" }}>Status</th>
                  <th style={{ padding: "8px 10px" }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredUsers.map(u => (
                  <tr key={u.id} style={{ borderBottom: "1px solid var(--border)" }}>
                    <td style={{ padding: "10px", fontWeight: 700 }}>@{u.username}</td>
                    <td style={{ padding: "10px", color: "var(--text-2)" }}>{u.email}</td>
                    <td style={{ padding: "10px" }}>
                      <span style={{
                        padding: "2px 6px", borderRadius: 4, fontSize: 10, fontWeight: 700,
                        background: u.tier === "pro" ? "rgba(34,197,94,0.1)" : "rgba(113,113,122,0.1)",
                        color: u.tier === "pro" ? "var(--green)" : "var(--text-3)"
                      }}>
                        {u.tier.toUpperCase()}
                      </span>
                    </td>
                    <td style={{ padding: "10px" }}>
                      <span style={{
                        padding: "2px 6px", borderRadius: 4, fontSize: 10, fontWeight: 700,
                        background: u.status === "active" ? "rgba(34,197,94,0.1)" : "rgba(239,68,68,0.1)",
                        color: u.status === "active" ? "var(--green)" : "var(--red)"
                      }}>
                        {u.status.toUpperCase()}
                      </span>
                    </td>
                    <td style={{ padding: "10px" }}>
                      <div style={{ display: "flex", gap: 8 }}>
                        <button onClick={() => handleToggleUserStatus(u)} style={{
                          padding: "4px 8px", borderRadius: 6, background: "var(--bg-root)", border: "1px solid var(--border)",
                          color: "var(--text-2)", fontSize: 11, fontWeight: 600, cursor: "pointer"
                        }}>
                          {u.status === "active" ? "Suspend" : "Unsuspend"}
                        </button>
                        <button onClick={() => handleDeleteUser(u.id)} style={{
                          padding: "4px 8px", borderRadius: 6, background: "rgba(239,68,68,0.08)", border: "none",
                          color: "var(--red)", fontSize: 11, fontWeight: 600, cursor: "pointer"
                        }}>
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div style={{ display:"flex", height:"100vh", height:"100dvh", width:"100vw", background:"var(--bg-root)", position:"relative", overflow:"hidden" }}>
      {/* ═══ PERMISSIONS REQUEST BAR ═══ */}
      {permissionsGranted === "prompt" && (
        <div style={{
          position: "fixed", top: 0, left: 0, right: 0, zIndex: 10000,
          background: "rgba(11,11,16,0.95)", backdropFilter: "blur(12px)",
          borderBottom: "1px solid var(--border)", padding: "12px 24px",
          display: "flex", alignItems: "center", justifyContent: "space-between",
          flexWrap: "wrap", gap: 12, boxShadow: "0 4px 30px rgba(0,0,0,0.5)",
          animation: "slideDown 0.3s ease"
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ fontSize: 18 }}>🔒</span>
            <span style={{ fontSize: 13, color: "var(--text-2)", lineHeight: 1.4 }}>
              ResearchAI requests permissions to: <strong>📁 Local Storage Access</strong> (for session persistence), <strong>📄 Document Vector Processing</strong> (for PDF uploads), and <strong>🔔 Desktop Notifications</strong>.
            </span>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={() => { localStorage.setItem("permissions_granted", "granted"); setPermissionsGranted("granted"); }} style={{
              padding: "8px 16px", borderRadius: 8, background: "var(--grad)", color: "#fff", border: "none", fontSize: 12, fontWeight: 700, cursor: "pointer"
            }}>
              Allow Access
            </button>
            <button onClick={() => { localStorage.setItem("permissions_granted", "blocked"); setPermissionsGranted("blocked"); }} style={{
              padding: "8px 16px", borderRadius: 8, background: "var(--bg-surface)", border: "1px solid var(--border)", color: "var(--text-3)", fontSize: 12, fontWeight: 700, cursor: "pointer"
            }}>
              Block
            </button>
          </div>
        </div>
      )}

      <Orbs />

      {/* ═══ SIDEBAR — Desktop ═══ */}
      <aside className="sidebar-desktop" style={{
        width: sidebarOpen ? sidebarW : 0, minWidth: sidebarOpen ? sidebarW : 0,
        height:"100%", borderRight: sidebarOpen ? "1px solid var(--border)" : "none",
        transition:"all 0.3s cubic-bezier(0.4,0,0.2,1)", overflow:"hidden", position:"relative", zIndex:20,
      }}>
        {SidebarContent}
      </aside>

      {/* ═══ SIDEBAR — Mobile Overlay ═══ */}
      {isMobile && sidebarOpen && (
        <>
          <div className="sidebar-mobile-overlay" onClick={() => setSidebarOpen(false)}
            style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.6)", backdropFilter:"blur(4px)", zIndex:90, animation:"fadeIn 0.2s ease" }}
          />
          <aside className="anim-fadeSlideRight" style={{
            position:"fixed", top:0, left:0, bottom:0, width: Math.min(sidebarW, window.innerWidth - 40),
            zIndex:100, boxShadow:"4px 0 24px rgba(0,0,0,0.4)",
          }}>
            {SidebarContent}
          </aside>
        </>
      )}

      {/* ═══ MAIN WORKSPACE / VIEWS ═══ */}
      <main role="main" style={{ flex:1, display:"flex", flexDirection:"column", height:"100%", position:"relative", zIndex:5, overflow:"hidden" }}>

        {/* Top Header */}
        <header role="banner" style={{
          display:"flex", alignItems:"center", justifyContent:"space-between", padding:"10px 16px",
          background:"var(--bg-surface)", borderBottom:"1px solid var(--border)", minHeight:54,
        }}>
          <div style={{ display:"flex", alignItems:"center", gap:12 }}>
            {isMobile && (
              <button onClick={() => setSidebarOpen(true)} aria-label="Toggle sidebar navigation" style={{ width:36, height:36, borderRadius:10, background:"var(--bg-surface)", border:"1px solid var(--border)", color:"var(--text-2)", cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center" }}>
                {icon(I.Menu, 18)}
              </button>
            )}
            {!isMobile && (
              <button onClick={() => { setSidebarOpen(p => !p); setActivePage("workspace"); }} aria-label="Toggle sidebar layout" style={{ width:34, height:34, borderRadius:9, background:"var(--bg-surface)", border:"1px solid var(--border)", color:"var(--text-2)", cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center" }}>
                {icon(I.Sidebar, 15)}
              </button>
            )}
            <div>
              <h1 onClick={() => { setActivePage("workspace"); setActiveTab("workspace"); }} style={{ fontSize:15, fontWeight:700, color:"var(--text)", letterSpacing:"-0.01em", lineHeight:1.2, cursor:"pointer" }}>
                {activePage === "workspace" ? (
                  activeTab === "workspace" ? (activeChat ? activeChat.title : "Workspace") :
                  activeTab === "dashboard" ? "Dashboard" :
                  activeTab === "reports" ? "My Reports" :
                  activeTab === "billing" ? "Pricing & Subscription" :
                  activeTab === "settings" ? "Settings" :
                  activeTab === "support" ? "Support" : "Admin Panel"
                ) : (
                  activePage === "privacy" ? "Privacy Policy" :
                  activePage === "terms" ? "Terms of Service" :
                  activePage === "refund" ? "Cancellation & Refund Policy" : "Contact Us"
                )}
              </h1>
              {activePage === "workspace" && activeTab === "workspace" && activeChat?.file_info && (
                <div style={{ fontSize:11, color:"var(--text-3)" }}>
                  📄 {activeChat.file_info.filename} · {activeChat.file_info.chunks} vector chunks
                </div>
              )}
            </div>
          </div>

          {/* Action buttons */}
          <div style={{ display:"flex", gap:6 }}>
            {activePage === "workspace" && activeTab === "workspace" && activeChat?.file_info && (
              <>
                <button onClick={handleCreateReport} disabled={generatingReport} style={{
                  padding:"7px 14px", borderRadius:9, background:"var(--grad)", border:"none",
                  color:"#fff", fontSize:12, fontWeight:700, cursor:"pointer", display:"flex", alignItems:"center", gap:5,
                  boxShadow:"0 2px 8px var(--accent-glow)"
                }}>
                  {generatingReport ? (
                    <>⏳ Generating...</>
                  ) : (
                    <>{icon(I.Star, 13)} Generate Report</>
                  )}
                </button>
                <button onClick={handleSummary} disabled={isGeneratingSummary} style={{
                  padding:"7px 14px", borderRadius:9, background:"var(--grad-subtle)", border:"1px solid var(--border)",
                  color:"var(--accent)", fontSize:12, fontWeight:600, cursor:"pointer", display:"flex", alignItems:"center", gap:5
                }}>
                  {icon(I.Zap, 13)} <span>Summary</span>
                </button>
                <button onClick={exportPDF} style={{
                  padding:"7px 14px", borderRadius:9, background:"var(--bg-surface)", border:"1px solid var(--border)",
                  color:"var(--text-2)", fontSize:12, fontWeight:600, cursor:"pointer", display:"flex", alignItems:"center", gap:5
                }}>
                  {icon(I.Down, 13)} <span>Export Chat</span>
                </button>
              </>
            )}
          </div>
        </header>

        {/* ── Page Content Toggle ── */}
        <div style={{ flex:1, overflowY:"auto", padding:"12px 0", display:"flex", flexDirection:"column" }}>
          <div style={{ maxWidth:800, margin:"0 auto", padding:"0 16px", display:"flex", flexDirection:"column", minHeight:"100%", width:"100%" }}>
            
            {activePage === "workspace" && activeTab === "workspace" && (
              <>
                {!activeChat || ((activeChat.messages || []).length === 0 && !activeChat.file_info) ? (
                  <Welcome fileRef={fileRef} />
                ) : (
                  <>
                    {(activeChat.messages || []).map(m => <Msg key={m.id} m={m} />)}
                    {isAsking && (
                      <div style={{ display:"flex", gap:12, padding:"10px 0", alignItems:"flex-start" }}>
                        <div style={{ width:32, height:32, borderRadius:10, background:"var(--grad)", display:"flex", alignItems:"center", justifyContent:"center" }}>
                          {icon(I.Star, 14)}
                        </div>
                        <Typing />
                      </div>
                    )}
                  </>
                )}
                <div ref={endRef} />
              </>
            )}

            {activePage === "workspace" && activeTab === "dashboard" && renderDashboardView()}
            {activePage === "workspace" && activeTab === "reports" && renderReportsView()}
            {activePage === "workspace" && activeTab === "billing" && renderBillingView()}
            {activePage === "workspace" && activeTab === "settings" && renderSettingsView()}
            {activePage === "workspace" && activeTab === "support" && renderSupportView()}
            {activePage === "workspace" && activeTab === "admin" && renderAdminView()}

            {activePage === "privacy" && (
              <div className="anim-scaleIn" style={{ padding:"24px 0", color:"var(--text-2)" }}>
                <h2 style={{ color:"var(--text)", marginBottom:16 }}>Privacy Policy</h2>
                <p style={{ marginBottom:14 }}>Effective Date: June 27, 2026</p>
                <p style={{ marginBottom:14 }}>ResearchAI handles your research document analysis. We prioritize your data safety above all else.</p>
                <h3 style={{ color:"var(--text)", marginTop:20, marginBottom:8 }}>1. Data Collection</h3>
                <p style={{ marginBottom:14 }}>We process documents you explicitly upload. These documents are parsed page-by-page and vectorized for local contextual retrieval.</p>
                <h3 style={{ color:"var(--text)", marginTop:20, marginBottom:8 }}>2. Data Retention</h3>
                <p style={{ marginBottom:14 }}>Your uploaded files are processed immediately and are not stored permanently. We delete document vectors automatically or upon chat session deletion.</p>
                <h3 style={{ color:"var(--text)", marginTop:20, marginBottom:8 }}>3. Security</h3>
                <p style={{ marginBottom:14 }}>Sessions are authenticated using secure cryptographically random tokens stored locally on http-only cookies.</p>
                <button onClick={() => setActivePage("workspace")} style={{ padding:"10px 20px", marginTop:24, borderRadius:8, background:"var(--grad)", border:"none", color:"#fff", fontWeight:"bold", cursor:"pointer" }}>Back to Workspace</button>
              </div>
            )}

            {activePage === "terms" && (
              <div className="anim-scaleIn" style={{ padding:"24px 0", color:"var(--text-2)" }}>
                <h2 style={{ color:"var(--text)", marginBottom:16 }}>Terms of Service</h2>
                <p style={{ marginBottom:14 }}>Effective Date: June 27, 2026</p>
                <h3 style={{ color:"var(--text)", marginTop:20, marginBottom:8 }}>1. Acceptable Use</h3>
                <p style={{ marginBottom:14 }}>You agree to upload only research materials, PDFs, and textbooks that you hold appropriate permissions to study and analyze.</p>
                <h3 style={{ color:"var(--text)", marginTop:20, marginBottom:8 }}>2. Accuracy of AI Output</h3>
                <p style={{ marginBottom:14 }}>ResearchAI provides retrieval-augmented summaries. AI outputs can occasionally hallucinate or contain inaccuracies. Verify all primary source materials directly.</p>
                <h3 style={{ color:"var(--text)", marginTop:20, marginBottom:8 }}>3. Limitation of Liability</h3>
                <p style={{ marginBottom:14 }}>ResearchAI is provided "as is" with no warranty or guarantee of permanent database retention.</p>
                <button onClick={() => setActivePage("workspace")} style={{ padding:"10px 20px", marginTop:24, borderRadius:8, background:"var(--grad)", border:"none", color:"#fff", fontWeight:"bold", cursor:"pointer" }}>Back to Workspace</button>
              </div>
            )}

            {activePage === "refund" && (
              <div className="anim-scaleIn" style={{ padding:"24px 0", color:"var(--text-2)" }}>
                <h2 style={{ color:"var(--text)", marginBottom:16 }}>Cancellation & Refund Policy</h2>
                <p style={{ marginBottom:14 }}>Effective Date: June 27, 2026</p>
                <p style={{ marginBottom:14 }}>Thank you for choosing ResearchAI. We want you to be completely satisfied with your premium experience.</p>
                <h3 style={{ color:"var(--text)", marginTop:20, marginBottom:8 }}>1. Trial Period & Cancellations</h3>
                <p style={{ marginBottom:14 }}>You can cancel your subscription at any time directly through your billing portal. Your Pro features will remain active until the end of your billing cycle.</p>
                <h3 style={{ color:"var(--text)", marginTop:20, marginBottom:8 }}>2. Refunds Eligibility</h3>
                <p style={{ marginBottom:14 }}>Due to API consumption costs, we generally do not offer refunds once the vector database and Groq LLM processing services have been actively queried. However, if you experience technical issues, contact our support team within 48 hours for review.</p>
                <button onClick={() => setActivePage("workspace")} style={{ padding:"10px 20px", marginTop:24, borderRadius:8, background:"var(--grad)", border:"none", color:"#fff", fontWeight:"bold", cursor:"pointer" }}>Back to Workspace</button>
              </div>
            )}

            {activePage === "contact" && (
              <div className="anim-scaleIn" style={{ padding:"24px 0", color:"var(--text-2)" }}>
                <h2 style={{ color:"var(--text)", marginBottom:16 }}>Contact Us</h2>
                <p style={{ marginBottom:14 }}>Have questions or need technical support? We are here to help you.</p>
                <div style={{ background:"rgba(255,255,255,0.02)", padding:18, borderRadius:12, border:"1px solid var(--border)", display:"flex", flexDirection:"column", gap:12 }}>
                  <div>
                    <strong style={{ color:"#fff" }}>📧 Email Support:</strong>
                    <div style={{ color:"var(--accent)", marginTop:4 }}>ai.researchassistant00@gmail.com</div>
                  </div>
                  <div>
                    <strong style={{ color:"#fff" }}>📍 Office Address:</strong>
                    <div style={{ marginTop:4 }}>Chittoor, Andhra Pradesh, 517001, India</div>
                  </div>
                  <div>
                    <strong style={{ color:"#fff" }}>📞 Business Hours:</strong>
                    <div style={{ marginTop:4 }}>Monday - Friday: 9:00 AM - 6:00 PM IST</div>
                  </div>
                </div>
                <button onClick={() => setActivePage("workspace")} style={{ padding:"10px 20px", marginTop:24, borderRadius:8, background:"var(--grad)", border:"none", color:"#fff", fontWeight:"bold", cursor:"pointer" }}>Back to Workspace</button>
              </div>
            )}

          </div>
        </div>

        {/* Suggestions chips */}
        {activePage === "workspace" && activeTab === "workspace" && activeChat?.file_info && (activeChat.messages || []).length <= 3 && (
          <div style={{ display:"flex", justifyContent:"center", gap:6, padding:"0 16px 8px", flexWrap:"wrap" }}>
            {SUGGESTIONS.map((s, i) => (
              <button key={i} onClick={() => { setQuestion(s.text); }} style={{
                padding:"7px 14px", borderRadius:20, background:"var(--bg-surface)", border:"1px solid var(--border)",
                color:"var(--text-2)", fontSize:12, cursor:"pointer", display:"flex", alignItems:"center", gap:5
              }}>
                {s.emoji} {s.text}
              </button>
            ))}
          </div>
        )}

        {/* Errors & Upload alerts */}
        {activePage === "workspace" && activeTab === "workspace" && uploadError && (
          <div style={{ margin:"0 16px 8px", maxWidth:800, marginLeft:"auto", marginRight:"auto", padding:"10px 14px", borderRadius:10, background:"rgba(239,68,68,0.08)", border:"1px solid rgba(239,68,68,0.15)", fontSize:12, color:"var(--red)", display:"flex", alignItems:"center", justifyContent:"space-between" }}>
            {uploadError}
            <button onClick={() => setUploadError(null)} style={{ background:"none", border:"none", color:"var(--red)", cursor:"pointer" }}>{icon(I.X, 12)}</button>
          </div>
        )}

        {/* Errors & Report Generation alerts */}
        {activePage === "workspace" && reportError && (
          <div style={{ margin:"0 16px 8px", maxWidth:800, marginLeft:"auto", marginRight:"auto", padding:"10px 14px", borderRadius:10, background:"rgba(239,68,68,0.08)", border:"1px solid rgba(239,68,68,0.15)", fontSize:12, color:"var(--red)", display:"flex", alignItems:"center", justifyContent:"space-between" }}>
            {reportError}
            <button onClick={() => setReportError(null)} style={{ background:"none", border:"none", color:"var(--red)", cursor:"pointer" }}>{icon(I.X, 12)}</button>
          </div>
        )}

        {activePage === "workspace" && activeTab === "workspace" && isUploading && (
          <div style={{ margin:"0 16px 8px", maxWidth:800, marginLeft:"auto", marginRight:"auto" }}>
            <div style={{ height:3, borderRadius:3, background:"var(--bg-surface)", overflow:"hidden" }}>
              <div style={{ height:"100%", width:`${uploadProgress}%`, background:"var(--grad)", borderRadius:3, transition:"width 0.3s" }}/>
            </div>
            <div style={{ fontSize:11, color:"var(--text-3)", textAlign:"center", marginTop:4 }}>Processing file stream page-by-page... {Math.round(uploadProgress)}%</div>
          </div>
        )}

        {/* Report progress animations overlay */}
        {activePage === "workspace" && generatingReport && (
          <div style={{ margin:"0 16px 8px", maxWidth:800, marginLeft:"auto", marginRight:"auto", background:"var(--bg-surface)", border:"1px solid var(--border)", borderRadius:16, padding:20, display:"flex", flexDirection:"column", gap:12, animation:"pulseGlow 2s ease-in-out infinite" }}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
              <div style={{ fontSize:13, fontWeight:800, color:"var(--accent)" }}>🔬 AI Research Intelligence Report Compiler</div>
              <div style={{ fontSize:11, color:"var(--text-3)", fontFamily:"'JetBrains Mono',monospace" }}>Chunking vector datasets...</div>
            </div>
            <div style={{ height:4, borderRadius:2, background:"var(--border)", overflow:"hidden" }}>
              <div style={{ height:"100%", width:"75%", background:"var(--grad)", borderRadius:2, animation:"pulse 1.5s infinite" }}/>
            </div>
            <div style={{ fontSize:11, color:"var(--text-2)", lineHeight:1.4 }}>
              Parsing ChromaDB contexts and structuring formal Markdown report with confidence scores. Do not navigate away.
            </div>
          </div>
        )}

        {/* Input / Footer Area */}
        <div style={{ padding:"8px 16px 16px", paddingBottom: isMobile ? "max(16px, env(safe-area-inset-bottom))" : 16 }}>
          {activePage === "workspace" && activeTab === "workspace" && (
            <div style={{
              maxWidth:800, margin:"0 auto", display:"flex", alignItems:"flex-end", gap:8,
              background:"rgba(20,20,28,0.7)", backdropFilter:"blur(16px)", border:"1px solid var(--border)",
              borderRadius:16, padding:"5px 6px 5px 14px", boxShadow:"0 4px 20px rgba(0,0,0,0.25)",
            }}>
              <button onClick={() => fileRef.current?.click()} disabled={isUploading || !activeId} style={{
                width:36, height:36, borderRadius:10, border:"none", background:"transparent",
                color: activeId ? "var(--text-3)" : "rgba(255,255,255,0.05)", cursor: activeId ? "pointer" : "default", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0,
              }} aria-label="Attach PDF document">
                {icon(I.Clip, 18)}
              </button>

              <select value={persona} onChange={e => setPersona(e.target.value)} style={{
                background: "rgba(255,255,255,0.03)", border: "1px solid var(--border)", color: "#ffffff",
                fontSize: 11, padding: "0 6px", borderRadius: 10, outline: "none", cursor: "pointer",
                marginRight: 4, height: 36, fontFamily: "inherit", maxWidth: isMobile ? 80 : 160
              }} aria-label="Select AI persona prompt context">
                <option value="default" style={{ background: "#1a1a24", color: "#ffffff" }}>🤖 Default</option>
                <option value="critique" style={{ background: "#1a1a24", color: "#ffffff" }}>🔬 Critique</option>
                <option value="summary" style={{ background: "#1a1a24", color: "#ffffff" }}>📊 Summary</option>
                <option value="statistics" style={{ background: "#1a1a24", color: "#ffffff" }}>📈 Stats</option>
              </select>

              <textarea ref={inputRef} value={question} onChange={e => setQuestion(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleAsk(); } }}
                placeholder={activeChat?.file_info ? "Ask anything about your document..." : activeId ? "Upload a PDF document to start analyzing..." : "Please create a Chat Session first."}
                rows={1} style={{
                  flex:1, resize:"none", border:"none", outline:"none", background:"transparent",
                  color:"var(--text)", fontSize:14, lineHeight:1.6, fontFamily:"'Inter',sans-serif",
                  maxHeight:160, padding:"8px 0", minHeight:36,
                }}
                disabled={!activeId}
                aria-label="Ask questions about the document"
              />

              <button onClick={handleAsk} disabled={!question.trim() || isAsking || !activeId} style={{
                width:38, height:38, borderRadius:11, border:"none", flexShrink:0,
                background: question.trim() && !isAsking && activeId ? "var(--grad)" : "var(--bg-surface)",
                color: question.trim() && !isAsking && activeId ? "#fff" : "var(--text-3)",
                cursor: question.trim() && !isAsking && activeId ? "pointer" : "default",
                display:"flex", alignItems:"center", justifyContent:"center",
                boxShadow: question.trim() && !isAsking && activeId ? "0 0 16px var(--accent-glow)" : "none",
              }} aria-label="Send query">
                {icon(I.Send, 15)}
              </button>
            </div>
          )}

          {/* Accessible Footer with Links */}
          <footer role="contentinfo" style={{ display:"flex", gap:14, justifyContent:"center", alignItems:"center", marginTop:12, flexWrap:"wrap" }}>
            <span style={{ fontSize:10, color:"var(--text-3)", fontFamily:"'JetBrains Mono',monospace", letterSpacing:"0.06em" }}>
              © 2026 ResearchAI. All rights reserved.
            </span>
            <span style={{ color:"var(--text-3)" }}>·</span>
            <span onClick={() => setActivePage("privacy")} style={{ fontSize:11, color:"var(--accent)", cursor:"pointer", textDecoration:"underline" }}>Privacy Policy</span>
            <span style={{ color:"var(--text-3)" }}>·</span>
            <span onClick={() => setActivePage("terms")} style={{ fontSize:11, color:"var(--accent)", cursor:"pointer", textDecoration:"underline" }}>Terms of Service</span>
            <span style={{ color:"var(--text-3)" }}>·</span>
            <span onClick={() => setActivePage("refund")} style={{ fontSize:11, color:"var(--accent)", cursor:"pointer", textDecoration:"underline" }}>Refund Policy</span>
            <span style={{ color:"var(--text-3)" }}>·</span>
            <span onClick={() => setActivePage("contact")} style={{ fontSize:11, color:"var(--accent)", cursor:"pointer", textDecoration:"underline" }}>Contact Us</span>
          </footer>
        </div>
      </main>

      {/* Stripe/UPI Rupees Simulated Upgrade Checkout Modal */}
      {upgradeModalOpen && (
        <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.7)", backdropFilter:"blur(6px)", zIndex:999, display:"flex", alignItems:"center", justifyContent:"center", padding:20 }}>
          <div className="anim-scaleIn" style={{ width:"100%", maxWidth:420, background:"var(--bg-surface)", border:"1px solid var(--border)", borderRadius:20, padding:24, boxShadow:"0 10px 40px rgba(0,0,0,0.5)", position:"relative" }}>
            <button onClick={() => setUpgradeModalOpen(false)} style={{ position:"absolute", top:16, right:16, background:"none", border:"none", color:"var(--text-3)", cursor:"pointer" }} aria-label="Close checkout modal">
              {icon(I.X, 18)}
            </button>
            
            <div style={{ textAlign:"center", marginBottom:16 }}>
              <div style={{ width:40, height:40, borderRadius:10, background:"var(--grad)", display:"flex", alignItems:"center", justifyContent:"center", margin:"0 auto 12px", color:"#fff", fontSize:18 }}>
                💎
              </div>
              <h3 style={{ fontSize:18, fontWeight:800, color:"#fff", margin:0 }}>Upgrade to Research Pro</h3>
              <p style={{ fontSize:12, color:"var(--text-2)", marginTop:6, lineHeight:1.5 }}>Unlock unlimited document uploads, 10 GB file support, and premium AI personas.</p>
            </div>

            {upgradeError && (
              <div style={{ padding:"10px", borderRadius:8, background:"rgba(239,68,68,0.1)", border:"1px solid rgba(239,68,68,0.2)", color:"var(--red)", fontSize:12, marginBottom:12 }}>
                {upgradeError}
              </div>
            )}

            {/* Plan Selector */}
            <div style={{ display:"flex", flexDirection:"column", gap:8, marginBottom:16 }}>
              <label style={{ fontSize:10, fontWeight:700, color:"var(--text-2)", textTransform:"uppercase" }}>Select Pricing Plan</label>
              {[
                { id: "1_month", label: "1 Month Premium", price: "₹49" },
                { id: "5_months", label: "5 Months Premium (Save 15%)", price: "₹249" },
                { id: "12_months", label: "12 Months Premium (Save 20%)", price: "₹499" }
              ].map(plan => (
                <div key={plan.id} onClick={() => setSelectedPlan(plan.id)} style={{
                  padding:12, borderRadius:10, border: selectedPlan === plan.id ? "2px solid var(--accent)" : "1px solid var(--border)",
                  background: selectedPlan === plan.id ? "var(--grad-subtle)" : "rgba(255,255,255,0.02)",
                  display:"flex", justifyContent:"space-between", alignItems:"center", cursor:"pointer", transition:"all 0.2s"
                }}>
                  <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                    <input type="radio" checked={selectedPlan === plan.id} onChange={() => {}} style={{ cursor:"pointer" }} />
                    <span style={{ fontSize:13, fontWeight:600, color:"#fff" }}>{plan.label}</span>
                  </div>
                  <span style={{ fontSize:14, fontWeight:700, color:"var(--accent)" }}>{plan.price}</span>
                </div>
              ))}
            </div>

            {/* Payment Method Tabs */}
            <div style={{ display:"flex", background:"var(--bg-root)", padding:2, borderRadius:8, border:"1px solid var(--border)", marginBottom:16 }}>
              <button onClick={() => setPaymentMethod("upi")} style={{
                flex:1, padding:"6px", fontSize:12, border:"none", borderRadius:6, cursor:"pointer",
                background: paymentMethod === "upi" ? "var(--bg-hover)" : "transparent",
                color: paymentMethod === "upi" ? "#fff" : "var(--text-3)", fontWeight:600
              }}>
                UPI Auto-Pay
              </button>
              <button onClick={() => setPaymentMethod("card")} style={{
                flex:1, padding:"6px", fontSize:12, border:"none", borderRadius:6, cursor:"pointer",
                background: paymentMethod === "card" ? "var(--bg-hover)" : "transparent",
                color: paymentMethod === "card" ? "#fff" : "var(--text-3)", fontWeight:600
              }}>
                Credit Card
              </button>
            </div>

            <form onSubmit={handleUpgradePayment} style={{ display:"flex", flexDirection:"column", gap:12 }}>
              {paymentMethod === "upi" ? (
                <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
                  <div style={{ display:"flex", gap:6, justifyContent:"space-between" }}>
                    {[
                      { id: "gpay", name: "Google Pay" },
                      { id: "phonepe", name: "PhonePe" },
                      { id: "paytm", name: "Paytm" },
                      { id: "qr", name: "Scan QR" }
                    ].map(p => (
                      <button type="button" key={p.id} onClick={() => setUpiProvider(p.id)} style={{
                        flex:1, padding:"6px 4px", fontSize:10, fontWeight:700, borderRadius:8, border: upiProvider === p.id ? "1px solid var(--accent)" : "1px solid var(--border)",
                        background: upiProvider === p.id ? "rgba(124,91,245,0.1)" : "rgba(255,255,255,0.01)", color: upiProvider === p.id ? "var(--accent)" : "var(--text-2)", cursor:"pointer"
                      }}>
                        {p.name}
                      </button>
                    ))}
                  </div>

                  {upiProvider === "qr" ? (
                    <div style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:8, padding:10, background:"rgba(255,255,255,0.02)", border:"1px dashed var(--border)", borderRadius:10 }}>
                      <div style={{ width:120, height:120, background:"#fff", padding:6, borderRadius:8, display:"flex", alignItems:"center", justifyContent:"center" }}>
                        {/* Realistic Mock QR Code */}
                        <svg width="108" height="108" viewBox="0 0 29 29" fill="none" stroke="#000" strokeWidth="1" strokeLinecap="square">
                          <path d="M0 0h7v7H0zm2 2v3h3V2zm0 8h2v2H2zm11 0h1v2h-1zm-4 4h3v2H9zm7-4h1v1h-1zm-2 2h3v1h-3zm4 2h1v1h-1zm1 3v2h2v-2zm-5 1h2v2h-2zm-4 3h3v1H9zm13-17h7v7h-7zm2 2v3h3V2zm-2 8h1v1h-1zm3 2h2v1h-2zm-3 2h1v1h-1zm-13 8h7v7H0zm2 2v3h3v-3zm18 3h2v2h-2zm1-5h2v2h-2z" fill="#000"/>
                        </svg>
                      </div>
                      <span style={{ fontSize:10, color:"var(--text-3)", textAlign:"center" }}>Scan this UPI QR code using BHIM, GPay, PhonePe, or Paytm app to complete ₹{selectedPlan === "1_month" ? "49" : selectedPlan === "5_months" ? "249" : "499"} auto-pay setup.</span>
                    </div>
                  ) : (
                    <div>
                      <label htmlFor="upi-id" style={{ fontSize:10, fontWeight:700, color:"var(--text-2)", textTransform:"uppercase", display:"block", marginBottom:4 }}>Enter UPI ID / VPA</label>
                      <input required id="upi-id" placeholder="username@upi" value={upiId} onChange={e => setUpiId(e.target.value)}
                        style={{ width:"100%", padding:"10px", borderRadius:8, background:"var(--bg-root)", border:"1px solid var(--border)", color:"#fff", fontSize:13 }}
                      />
                      <span style={{ fontSize:9, color:"var(--text-3)", display:"block", marginTop:4 }}>A payment request will be sent to your UPI app for auto-pay authorization.</span>
                    </div>
                  )}
                </div>
              ) : (
                <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
                  <div>
                    <label htmlFor="card-num" style={{ fontSize:10, fontWeight:700, color:"var(--text-2)", textTransform:"uppercase", display:"block", marginBottom:4 }}>Card Number</label>
                    <input required id="card-num" placeholder="4242 4242 4242 4242" value={cardNum} onChange={e => setCardNum(e.target.value)}
                      style={{ width:"100%", padding:"10px", borderRadius:8, background:"var(--bg-root)", border:"1px solid var(--border)", color:"#fff", fontSize:13 }}
                    />
                  </div>
                  <div style={{ display:"flex", gap:10 }}>
                    <div style={{ flex:1 }}>
                      <label htmlFor="card-exp" style={{ fontSize:10, fontWeight:700, color:"var(--text-2)", textTransform:"uppercase", display:"block", marginBottom:4 }}>Expiration</label>
                      <input required id="card-exp" placeholder="MM/YY" value={cardExp} onChange={e => setCardExp(e.target.value)}
                        style={{ width:"100%", padding:"10px", borderRadius:8, background:"var(--bg-root)", border:"1px solid var(--border)", color:"#fff", fontSize:13 }}
                      />
                    </div>
                    <div style={{ flex:1 }}>
                      <label htmlFor="card-cvc" style={{ fontSize:10, fontWeight:700, color:"var(--text-2)", textTransform:"uppercase", display:"block", marginBottom:4 }}>CVC</label>
                      <input required id="card-cvc" placeholder="123" value={cardCvc} onChange={e => setCardCvc(e.target.value)}
                        style={{ width:"100%", padding:"10px", borderRadius:8, background:"var(--bg-root)", border:"1px solid var(--border)", color:"#fff", fontSize:13 }}
                      />
                    </div>
                  </div>
                  <div>
                    <label htmlFor="card-name" style={{ fontSize:10, fontWeight:700, color:"var(--text-2)", textTransform:"uppercase", display:"block", marginBottom:4 }}>Cardholder Name</label>
                    <input required id="card-name" placeholder="Jane Doe" value={cardName} onChange={e => setCardName(e.target.value)}
                      style={{ width:"100%", padding:"10px", borderRadius:8, background:"var(--bg-root)", border:"1px solid var(--border)", color:"#fff", fontSize:13 }}
                    />
                  </div>
                </div>
              )}

              <button type="submit" disabled={isUpgrading} style={{
                width:"100%", padding:"12px", borderRadius:12, background:"var(--grad)", color:"#fff", border:"none", fontSize:13, fontWeight:700, cursor:"pointer",
                boxShadow:"0 4px 16px var(--accent-glow)", marginTop:10, display:"flex", alignItems:"center", justifyContent:"center", gap:6
              }}>
                {isUpgrading ? "Authorizing Auto-Pay..." : `Pay ${selectedPlan === "1_month" ? "₹49" : selectedPlan === "5_months" ? "₹249" : "₹499"} Now`}
              </button>
              
              <div style={{ fontSize:10, color:"var(--text-3)", textAlign:"center", marginTop:4 }}>
                🔒 Payments secured by Razorpay & UPI 2.0 Auto-Pay protocols.
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Invoice Receipt Modal */}
      {activeInvoice && (
        <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.7)", backdropFilter:"blur(6px)", zIndex:999, display:"flex", alignItems:"center", justifyContent:"center", padding:20 }}>
          <div className="anim-scaleIn" style={{ width:"100%", maxWidth:400, background:"var(--bg-surface)", border:"1px solid var(--border)", borderRadius:20, padding:24, boxShadow:"0 10px 40px rgba(0,0,0,0.5)", position:"relative", textAlign:"center" }}>
            <button onClick={() => setActiveInvoice(null)} style={{ position:"absolute", top:16, right:16, background:"none", border:"none", color:"var(--text-3)", cursor:"pointer" }} aria-label="Close invoice modal">
              {icon(I.X, 18)}
            </button>
            
            <div style={{ width:48, height:48, borderRadius:"50%", background:"rgba(34,197,94,0.1)", color:"var(--green)", display:"flex", alignItems:"center", justifyContent:"center", margin:"0 auto 16px", fontSize:22 }}>
              ✓
            </div>
            <h3 style={{ fontSize:18, fontWeight:800, color:"#fff", margin:0 }}>Payment Successful!</h3>
            <p style={{ fontSize:12, color:"var(--text-2)", marginTop:6, lineHeight:1.5 }}>
              Your account has been upgraded to Research Pro. A copy of this receipt was sent to <strong>{user?.email || "your registered email"}</strong>.
            </p>

            <div style={{ background:"var(--bg-root)", border:"1px solid var(--border)", borderRadius:12, padding:14, margin:"16px 0", textAlign:"left", fontSize:12, display:"flex", flexDirection:"column", gap:8 }}>
              <div style={{ display:"flex", justifyContent:"space-between" }}>
                <span style={{ color:"var(--text-3)" }}>Receipt ID:</span>
                <span style={{ color:"#fff", fontFamily:"monospace" }}>{activeInvoice.payment_id}</span>
              </div>
              <div style={{ display:"flex", justifyContent:"space-between" }}>
                <span style={{ color:"var(--text-3)" }}>Plan:</span>
                <span style={{ color:"#fff", fontWeight:600 }}>{activeInvoice.plan === "1_month" ? "1 Month Premium" : activeInvoice.plan === "5_months" ? "5 Months Premium" : "12 Months Premium"}</span>
              </div>
              <div style={{ display:"flex", justifyContent:"space-between" }}>
                <span style={{ color:"var(--text-3)" }}>Amount Paid:</span>
                <span style={{ color:"var(--accent)", fontWeight:700 }}>{activeInvoice.amount}</span>
              </div>
              <div style={{ display:"flex", justifyContent:"space-between" }}>
                <span style={{ color:"var(--text-3)" }}>Date:</span>
                <span style={{ color:"#fff" }}>{activeInvoice.date}</span>
              </div>
            </div>

            <div style={{ display:"flex", gap:10 }}>
              <button onClick={() => downloadInvoicePDF(activeInvoice.payment_id, activeInvoice.amount, activeInvoice.plan)} style={{
                flex:1, padding:"10px 14px", borderRadius:10, background:"var(--grad)", color:"#fff", border:"none", fontSize:12, fontWeight:700, cursor:"pointer"
              }}>
                📥 Download Receipt PDF
              </button>
              <button onClick={() => setActiveInvoice(null)} style={{
                flex:1, padding:"10px 14px", borderRadius:10, background:"var(--bg-surface)", border:"1px solid var(--border)", color:"var(--text-2)", fontSize:12, fontWeight:700, cursor:"pointer"
              }}>
                Dismiss
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Dynamic Social Login Modal */}
      {socialModalOpen && (
        <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.7)", backdropFilter:"blur(6px)", zIndex:999, display:"flex", alignItems:"center", justifyContent:"center", padding:20 }}>
          <div className="anim-scaleIn" style={{ width:"100%", maxWidth:400, background:"var(--bg-surface)", border:"1px solid var(--border)", borderRadius:20, padding:24, boxShadow:"0 10px 40px rgba(0,0,0,0.5)", position:"relative" }}>
            <button onClick={() => setSocialModalOpen(false)} style={{ position:"absolute", top:16, right:16, background:"none", border:"none", color:"var(--text-3)", cursor:"pointer" }} aria-label="Close social login modal">
              {icon(I.X, 18)}
            </button>
            
            <div style={{ textAlign:"center", marginBottom:20 }}>
              <div style={{ width:48, height:48, borderRadius:12, background:"var(--bg-surface)", border:"1px solid var(--border)", display:"flex", alignItems:"center", justifyContent:"center", margin:"0 auto 12px" }}>
                {socialProvider === "google" ? (
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" fill="#FBBC05"/>
                    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                  </svg>
                ) : (
                  <svg width="20" height="20" viewBox="0 0 23 23" fill="currentColor">
                    <rect x="0" y="0" width="11" height="11" fill="#F25022"/>
                    <rect x="12" y="0" width="11" height="11" fill="#7FBA00"/>
                    <rect x="0" y="12" width="11" height="11" fill="#00A4EF"/>
                    <rect x="12" y="12" width="11" height="11" fill="#FFB900"/>
                  </svg>
                )}
              </div>
              <h3 style={{ fontSize:18, fontWeight:800, color:"#fff", margin:0, textTransform:"capitalize" }}>
                Connect {socialProvider} Account
              </h3>
              <p style={{ fontSize:12, color:"var(--text-2)", marginTop:6, lineHeight:1.5 }}>
                Enter your {socialProvider} email to authenticate and access your secure ResearchAI Hub workspace.
              </p>
            </div>

            <form onSubmit={handleSocialSubmit} style={{ display:"flex", flexDirection:"column", gap:14 }}>
              <div>
                <label htmlFor="social-email" style={{ fontSize:11, fontWeight:600, color:"var(--text-2)", textTransform:"uppercase", display:"block", marginBottom:6 }}>
                  Email Address
                </label>
                <input 
                  required 
                  id="social-email" 
                  type="email" 
                  value={socialEmail} 
                  onChange={e => setSocialEmail(e.target.value)} 
                  placeholder={socialProvider === "google" ? "username@gmail.com" : "username@outlook.com"}
                  style={{ width:"100%", padding:"10px 14px", borderRadius:10, background:"var(--bg-root)", border:"1px solid var(--border)", color:"#fff", outline:"none", fontSize:14 }}
                />
              </div>

              <button type="submit" style={{ width:"100%", padding:"12px", borderRadius:12, background:"var(--grad)", color:"#fff", border:"none", fontSize:14, fontWeight:700, cursor:"pointer", boxShadow:"0 4px 16px var(--accent-glow)", marginTop:8 }}>
                Continue to Workspace
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Hidden file input */}
      <input ref={fileRef} type="file" accept=".pdf,.txt,.md,.csv,.docx,.xlsx,.pptx" id="pdf-uploader" style={{ display:"none" }}
        onChange={e => { const f = e.target.files?.[0]; if (f) handleUpload(f); e.target.value = ""; }}
      />
    </div>
  );
}
