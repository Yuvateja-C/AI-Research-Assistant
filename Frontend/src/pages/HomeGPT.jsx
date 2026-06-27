import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import jsPDF from "jspdf";

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
/*  CONSTANTS & HELPERS                         */
/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
const API = (import.meta.env.VITE_API_URL || "http://127.0.0.1:8000").replace(/\/+$/, "");

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
  const [paymentMethod, setPaymentMethod] = useState("upi"); // upi, card
  const [upiProvider, setUpiProvider] = useState("gpay"); // gpay, phonepe, paytm, qr
  const [upiId, setUpiId] = useState("");
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);
  const [editingChatId, setEditingChatId] = useState(null);
  const [editTitleValue, setEditTitleValue] = useState("");

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
        await fetchChats(currentTkn);
      } else {
        handleLogoutAction();
      }
    } catch {
      handleLogoutAction();
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
        if (data.length > 0 && !activeId) {
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
      const d = await r.json();
      if (!r.ok) {
        setAuthError(d.detail || "Registration failed");
        return;
      }
      const loginRes = await fetch(`${API}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username_or_email: email, password })
      });
      const loginData = await loginRes.json();
      localStorage.setItem("session_token", loginData.token);
      setToken(loginData.token);
    } catch {
      setAuthError("Registration failed. Verify fields.");
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
            alert("🎉 Simulated subscription activated! Your account is upgraded to Research Pro.");
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
              alert("🎉 Subscription activated successfully! Thank you for upgrading to Research Pro.");
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
    setLoadingAuth(true);
    setTimeout(() => {
      const mockToken = "mock_social_" + Math.random().toString(36).substring(7);
      localStorage.setItem("session_token", mockToken);
      setToken(mockToken);
      setLoadingAuth(false);
    }, 1200);
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

      {/* Free Trial / Upgrade status alert in Sidebar */}
      {user && user.tier === "free" && (
        <div style={{ padding:"10px 12px", margin:"8px 12px 0", background:"rgba(245,158,11,0.08)", border:"1px solid rgba(245,158,11,0.15)", borderRadius:10, display:"flex", flexDirection:"column", gap:6 }}>
          <div style={{ fontSize:10, color:"var(--gold)", fontWeight:700, textTransform:"uppercase", letterSpacing:"0.05em" }}>⏳ Trial Status</div>
          <div style={{ fontSize:11, color:"var(--text-2)", lineHeight:1.4 }}>{trialDaysRemaining} days remaining ({Math.max(0, 3 - chats.filter(c => c.file_info).length)} uploads left)</div>
          <button onClick={() => setUpgradeModalOpen(true)} style={{ padding:"6px", background:"var(--gold)", border:"none", borderRadius:6, color:"#fff", fontSize:11, fontWeight:700, cursor:"pointer", marginTop:4, display:"flex", alignItems:"center", justifyContent:"center", gap:4 }}>🛡️ Upgrade to Pro</button>
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
            color:"var(--text-2)", fontSize:11, outline:"none", cursor:"pointer"
          }}>
            {allAvailableTags.map(t => (
              <option key={t} value={t}>{t}</option>
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
                      background: isActive ? "var(--bg-active)" : "transparent",
                      borderLeft: isActive ? "2px solid var(--accent)" : "2px solid transparent",
                      cursor:"pointer", display:"flex", alignItems:"center", gap:10, transition:"all 0.15s"
                    }}
                  >
                    <div style={{ width:28, height:28, borderRadius:8, background: isActive ? "var(--accent)15" : "var(--bg-surface)", display:"flex", alignItems:"center", justifyContent:"center", color: isActive ? "var(--accent)" : "var(--text-3)", flexShrink:0 }}>
                      {icon(c.file_info ? I.File : I.Doc, 13)}
                    </div>
                    <div style={{ flex:1, overflow:"hidden" }}>
                      {editingChatId === c.id ? (
                        <input
                          autoFocus
                          value={editTitleValue}
                          onChange={e => setEditTitleValue(e.target.value)}
                          onBlur={() => handleRenameChat(c.id, editTitleValue)}
                          onKeyDown={e => { if (e.key === "Enter") handleRenameChat(c.id, editTitleValue); }}
                          style={{ background:"var(--bg-root)", border:"1px solid var(--accent)", color:"#fff", fontSize:12, padding:"2px 6px", borderRadius:4, width:"95%" }}
                          onClick={e => e.stopPropagation()}
                        />
                      ) : (
                        <div style={{ display:"flex", alignItems:"center", gap:6 }}>
                          <span style={{ fontSize:13, fontWeight: isActive ? 600 : 500, color: isActive ? "var(--text)" : "var(--text-2)", whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>
                            {c.title}
                          </span>
                          {isFav && <span style={{ color:"var(--gold)", fontSize:10 }}>★</span>}
                          {isArchived && <span style={{ color:"var(--text-3)", fontSize:9, background:"var(--bg-surface)", padding:"1px 4px", borderRadius:3 }}>Archived</span>}
                        </div>
                      )}
                      
                      {/* Tags row */}
                      {c.tags && c.tags.length > 0 && (
                        <div style={{ display:"flex", flexWrap:"wrap", gap:3, marginTop:4 }}>
                          {c.tags.map(t => t && (
                            <span key={t} style={{ fontSize:9, background:"rgba(124,91,245,0.08)", border:"1px solid rgba(124,91,245,0.15)", color:"var(--accent)", padding:"0px 5px", borderRadius:4, display:"flex", alignItems:"center", gap:2 }}>
                              {t}
                              <span onClick={(e) => { e.stopPropagation(); handleRemoveTag(c.id, t); }} style={{ color:"var(--red)", fontWeight:"bold", cursor:"pointer", marginLeft:2 }}>×</span>
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                    
                    <div style={{ display:"flex", flexDirection:"column", alignItems:"flex-end", gap:4, flexShrink:0 }}>
                      <span style={{ fontSize:10, color:"var(--text-3)" }}>{relativeTime(c.updatedAt || c.createdAt)}</span>
                      
                      {/* Options */}
                      <div style={{ display:"flex", gap:3 }}>
                        <span onClick={(e) => { e.stopPropagation(); setEditingChatId(c.id); setEditTitleValue(c.title); }} title="Rename" style={{ color:"var(--text-3)", cursor:"pointer", padding:2 }}>
                          {icon(I.Edit, 10)}
                        </span>
                        <span onClick={(e) => { e.stopPropagation(); toggleFavorite(c); }} title={isFav ? "Unfavorite" : "Favorite"} style={{ color: isFav ? "var(--gold)" : "var(--text-3)", cursor:"pointer", padding:2 }}>
                          {icon(I.StarOutline, 10)}
                        </span>
                        <span onClick={(e) => { e.stopPropagation(); toggleArchive(c); }} title={isArchived ? "Unarchive" : "Archive"} style={{ color:"var(--text-3)", cursor:"pointer", padding:2 }}>
                          {icon(I.Archive, 10)}
                        </span>
                        <span onClick={(e) => handleDeleteChat(c.id, e)} title="Delete" style={{ color:"var(--red)", cursor:"pointer", padding:2 }}>
                          {icon(I.Trash, 10)}
                        </span>
                      </div>
                    </div>
                  </button>
                  
                  {/* Inline Tag Adder */}
                  <div style={{ padding:"0 8px 4px 38px" }}>
                    {addingTagId === c.id ? (
                      <div style={{ display:"flex", gap:4, alignItems:"center" }}>
                        <input value={newTagVal} onChange={e => setNewTagVal(e.target.value)} placeholder="Add tag..."
                          style={{ background:"var(--bg-root)", border:"1px solid var(--border)", color:"#fff", fontSize:10, padding:"2px 5px", borderRadius:4, width:80 }}
                        />
                        <button onClick={() => handleAddTag(c.id)} style={{ padding:"2px 6px", fontSize:9, background:"var(--accent)", color:"#fff", border:"none", borderRadius:3, cursor:"pointer" }}>+</button>
                        <button onClick={() => setAddingTagId(null)} style={{ padding:"2px 6px", fontSize:9, background:"var(--bg-hover)", color:"var(--text-3)", border:"none", borderRadius:3, cursor:"pointer" }}>×</button>
                      </div>
                    ) : (
                      <span onClick={() => { setAddingTagId(c.id); setNewTagVal(""); }} style={{ fontSize:10, color:"var(--text-3)", cursor:"pointer", textDecoration:"underline" }}>+ add tag</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ))}
      </div>

      {/* Footer */}
      <div style={{ padding:"12px 16px", borderTop:"1px solid var(--border)", display:"flex", alignItems:"center", justifyContent:"space-between" }}>
        <div style={{ display:"flex", alignItems:"center", gap:7 }}>
          <div style={{ width:7, height:7, borderRadius:"50%", background:"var(--green)", animation:"pulseGlow 2s ease-in-out infinite" }}/>
          <span style={{ fontSize:11, color:"var(--text-3)", fontWeight:500 }}>Online</span>
        </div>
        <span style={{ fontSize:9, color:"var(--text-3)", fontFamily:"'JetBrains Mono',monospace" }}>v3.0</span>
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
            <div style={{ padding:"10px 14px", borderRadius:10, background:"rgba(239,68,68,0.1)", border:"1px solid rgba(239,68,68,0.2)", color:"var(--red)", fontSize:12, marginBottom:16 }}>
              {authError}
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

  return (
    <div style={{ display:"flex", height:"100vh", height:"100dvh", width:"100vw", background:"var(--bg-root)", position:"relative", overflow:"hidden" }}>
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
          background:"rgba(11,11,16,0.7)", backdropFilter:"blur(12px)", borderBottom:"1px solid var(--border)", minHeight:54,
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
              <h1 onClick={() => setActivePage("workspace")} style={{ fontSize:15, fontWeight:700, color:"var(--text)", letterSpacing:"-0.01em", lineHeight:1.2, cursor:"pointer" }}>
                {activePage === "workspace" ? (activeChat ? activeChat.title : "Workspace") : activePage === "privacy" ? "Privacy Policy" : "Terms of Service"}
              </h1>
              {activePage === "workspace" && activeChat?.file_info && (
                <div style={{ fontSize:11, color:"var(--text-3)" }}>
                  📄 {activeChat.file_info.filename} · {activeChat.file_info.chunks} vector chunks
                </div>
              )}
            </div>
          </div>

          {/* Action buttons */}
          <div style={{ display:"flex", gap:6 }}>
            {activePage === "workspace" && activeChat?.file_info && (
              <>
                <button onClick={handleSummary} disabled={isGeneratingSummary} style={{
                  padding:"7px 14px", borderRadius:9, background:"var(--grad-subtle)", border:"1px solid var(--border-active)",
                  color:"#c4b5fd", fontSize:12, fontWeight:600, cursor:"pointer", display:"flex", alignItems:"center", gap:5
                }}>
                  {icon(I.Zap, 13)} <span>Summary</span>
                </button>
                <button onClick={exportPDF} style={{
                  padding:"7px 14px", borderRadius:9, background:"var(--bg-surface)", border:"1px solid var(--border)",
                  color:"var(--text-2)", fontSize:12, fontWeight:600, cursor:"pointer", display:"flex", alignItems:"center", gap:5
                }}>
                  {icon(I.Down, 13)} <span>Export</span>
                </button>
              </>
            )}
          </div>
        </header>

        {/* ── Page Content Toggle ── */}
        <div style={{ flex:1, overflowY:"auto", padding:"12px 0", display:"flex", flexDirection:"column" }}>
          <div style={{ maxWidth:800, margin:"0 auto", padding:"0 16px", display:"flex", flexDirection:"column", minHeight:"100%", width:"100%" }}>
            
            {activePage === "workspace" && (
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

          </div>
        </div>

        {/* Suggestions chips */}
        {activePage === "workspace" && activeChat?.file_info && (activeChat.messages || []).length <= 3 && (
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
        {activePage === "workspace" && uploadError && (
          <div style={{ margin:"0 16px 8px", maxWidth:800, marginLeft:"auto", marginRight:"auto", padding:"10px 14px", borderRadius:10, background:"rgba(239,68,68,0.08)", border:"1px solid rgba(239,68,68,0.15)", fontSize:12, color:"var(--red)", display:"flex", alignItems:"center", justifyContent:"space-between" }}>
            {uploadError}
            <button onClick={() => setUploadError(null)} style={{ background:"none", border:"none", color:"var(--red)", cursor:"pointer" }}>{icon(I.X, 12)}</button>
          </div>
        )}

        {activePage === "workspace" && isUploading && (
          <div style={{ margin:"0 16px 8px", maxWidth:800, marginLeft:"auto", marginRight:"auto" }}>
            <div style={{ height:3, borderRadius:3, background:"var(--bg-surface)", overflow:"hidden" }}>
              <div style={{ height:"100%", width:`${uploadProgress}%`, background:"var(--grad)", borderRadius:3, transition:"width 0.3s" }}/>
            </div>
            <div style={{ fontSize:11, color:"var(--text-3)", textAlign:"center", marginTop:4 }}>Processing file stream page-by-page... {Math.round(uploadProgress)}%</div>
          </div>
        )}

        {/* Input / Footer Area */}
        <div style={{ padding:"8px 16px 16px", paddingBottom: isMobile ? "max(16px, env(safe-area-inset-bottom))" : 16 }}>
          {activePage === "workspace" && (
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
                background: "rgba(255,255,255,0.03)", border: "1px solid var(--border)", color: "var(--text-2)",
                fontSize: 11, padding: "0 6px", borderRadius: 10, outline: "none", cursor: "pointer",
                marginRight: 4, height: 36, fontFamily: "inherit", maxWidth: isMobile ? 80 : 160
              }} aria-label="Select AI persona prompt context">
                <option value="default" style={{ background:"var(--bg-surface)" }}>🤖 Default</option>
                <option value="critique" style={{ background:"var(--bg-surface)" }}>🔬 Critique</option>
                <option value="summary" style={{ background:"var(--bg-surface)" }}>📊 Summary</option>
                <option value="statistics" style={{ background:"var(--bg-surface)" }}>📈 Stats</option>
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

      {/* Hidden file input */}
      <input ref={fileRef} type="file" accept=".pdf,.txt,.md,.csv" id="pdf-uploader" style={{ display:"none" }}
        onChange={e => { const f = e.target.files?.[0]; if (f) handleUpload(f); e.target.value = ""; }}
      />
    </div>
  );
}
