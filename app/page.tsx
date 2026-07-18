"use client";

import { useEffect, useRef, useState } from "react";

type Language = "en" | "hi";
type View = "auth" | "cases" | "workflow";
type Stage = "interview" | "documents" | "review" | "pathway";

type CaseRecord = {
  id: string;
  service: string;
  state: string;
  district: string;
  language: Language;
  status: string;
  step: number;
  profile: Record<string, unknown>;
  documents?: DocumentRecord[];
  plan?: PlanStep[];
  updatedAt: number;
};

type DocumentRecord = {
  id: string;
  type: string;
  fileName: string;
  status: "queued" | "processing" | "review" | "verified";
  confidence?: number;
  fields?: Record<string, string>;
  issue?: string;
};

type PlanStep = {
  id: string;
  title: string;
  description: string;
  office: string;
  url?: string;
  source?: string;
  state: "ready" | "locked" | "complete";
};

type ApiResponse<T> = { data?: T; error?: string };

const copy = {
  en: {
    slogan: "Every identity begins with evidence.",
    authTitle: "Continue your identity case",
    authBody: "Your interview, documents and next steps stay together in one secure case.",
    account: "Account ID",
    password: "Password",
    login: "Continue securely",
    create: "Create an account",
    switchLogin: "Already have an account? Sign in",
    demo: "Explore the guided demo",
    privacy: "Sensitive documents are private to your account. Neev never makes a legal decision for you.",
    myCases: "My cases",
    welcome: "Good morning",
    casesBody: "Resume a case or begin a new identity pathway.",
    newCase: "Start a new case",
    noCases: "No active cases yet",
    interview: "Interview",
    documents: "Documents",
    review: "Evidence review",
    pathway: "Your pathway",
    saved: "Saved just now",
    assistant: "Neev Guide",
    assistantStatus: "Bilingual case assistant",
    ask: "Ask about this case…",
    send: "Send",
    back: "All cases",
    continue: "Save & continue",
    previous: "Previous",
    upload: "Add documents",
    process: "Parse selected documents",
    generate: "Prepare affidavit PDF",
    officialOnly: "Official-source pathway",
    disclaimer: "Verify every step with the named office. Rules can change and final acceptance belongs to the government authority.",
  },
  hi: {
    slogan: "हर पहचान की शुरुआत प्रमाण से होती है।",
    authTitle: "अपना पहचान मामला जारी रखें",
    authBody: "आपका साक्षात्कार, दस्तावेज़ और अगले कदम एक सुरक्षित केस में साथ रहते हैं।",
    account: "खाता आईडी",
    password: "पासवर्ड",
    login: "सुरक्षित रूप से जारी रखें",
    create: "नया खाता बनाएँ",
    switchLogin: "पहले से खाता है? साइन इन करें",
    demo: "निर्देशित डेमो देखें",
    privacy: "संवेदनशील दस्तावेज़ आपके खाते तक सीमित रहते हैं। नींव आपके लिए कानूनी निर्णय नहीं लेता।",
    myCases: "मेरे केस",
    welcome: "नमस्ते",
    casesBody: "पुराना केस जारी रखें या नया पहचान मार्ग शुरू करें।",
    newCase: "नया केस शुरू करें",
    noCases: "अभी कोई सक्रिय केस नहीं है",
    interview: "साक्षात्कार",
    documents: "दस्तावेज़",
    review: "प्रमाण समीक्षा",
    pathway: "आपका मार्ग",
    saved: "अभी सहेजा गया",
    assistant: "नींव मार्गदर्शक",
    assistantStatus: "द्विभाषी केस सहायक",
    ask: "इस केस के बारे में पूछें…",
    send: "भेजें",
    back: "सभी केस",
    continue: "सहेजें और आगे बढ़ें",
    previous: "पिछला",
    upload: "दस्तावेज़ जोड़ें",
    process: "दस्तावेज़ पढ़ें",
    generate: "शपथपत्र PDF बनाएँ",
    officialOnly: "आधिकारिक स्रोतों पर आधारित मार्ग",
    disclaimer: "हर कदम संबंधित कार्यालय से सत्यापित करें। नियम बदल सकते हैं और अंतिम स्वीकृति सरकारी अधिकारी के अधीन है।",
  },
} as const;

const interviewQuestions = {
  en: [
    { key: "name", title: "What is your full name?", help: "Enter it as you commonly use it. We will compare spellings from your documents.", type: "text" },
    { key: "state", title: "Which state do you live in?", help: "State rules decide which office and evidence are accepted.", type: "state" },
    { key: "district", title: "What is your district?", help: "We use this to point you to the correct official services.", type: "text" },
    { key: "dobKnown", title: "Do you know your date of birth?", help: "A date is only requested if you answer yes.", type: "yesno" },
    { key: "dob", title: "Select your date of birth", help: "Choose the date you believe is correct. Uploaded evidence will be checked separately.", type: "date", when: "dobKnown" },
    { key: "documents", title: "Which documents do you currently have?", help: "Select every document available, even if the name or date is inconsistent.", type: "multi" },
    { key: "goal", title: "What do you want to obtain first?", help: "Neev will find the shortest supported dependency path.", type: "goal" },
    { key: "story", title: "Is there anything unusual about your records?", help: "For example: different spellings, no birth registration, or a changed address. AI is used only to structure this answer.", type: "textarea" },
  ],
  hi: [
    { key: "name", title: "आपका पूरा नाम क्या है?", help: "वह नाम लिखें जो आप सामान्यतः उपयोग करते हैं। हम दस्तावेज़ों की वर्तनी से तुलना करेंगे।", type: "text" },
    { key: "state", title: "आप किस राज्य में रहते हैं?", help: "राज्य के नियम तय करते हैं कि कौन सा कार्यालय और प्रमाण मान्य होगा।", type: "state" },
    { key: "district", title: "आपका जिला कौन सा है?", help: "इससे सही आधिकारिक सेवा खोजने में मदद मिलेगी।", type: "text" },
    { key: "dobKnown", title: "क्या आपको अपनी जन्मतिथि पता है?", help: "हाँ चुनने पर ही तारीख पूछी जाएगी।", type: "yesno" },
    { key: "dob", title: "अपनी जन्मतिथि चुनें", help: "वह तारीख चुनें जिसे आप सही मानते हैं। प्रमाण की जाँच अलग से होगी।", type: "date", when: "dobKnown" },
    { key: "documents", title: "आपके पास अभी कौन से दस्तावेज़ हैं?", help: "नाम या तारीख अलग होने पर भी सभी उपलब्ध दस्तावेज़ चुनें।", type: "multi" },
    { key: "goal", title: "आप सबसे पहले क्या बनवाना चाहते हैं?", help: "नींव सबसे छोटा समर्थित मार्ग बनाएगा।", type: "goal" },
    { key: "story", title: "क्या आपके रिकॉर्ड में कोई विशेष समस्या है?", help: "जैसे अलग वर्तनी, जन्म पंजीकरण न होना या पता बदलना। AI केवल इस उत्तर को संरचित करता है।", type: "textarea" },
  ],
} as const;

const states = ["Bihar", "Uttar Pradesh", "Kerala", "Delhi", "Maharashtra", "West Bengal", "Rajasthan", "Other"];
const documentOptions = ["Birth certificate", "School certificate", "Ration card", "Voter ID", "PAN card", "Aadhaar", "Panchayat record", "Employer ID", "Other"];
const goals = ["Aadhaar enrolment", "Birth certificate", "Voter ID", "PAN card", "Ration card", "Correct a name"];

function shortCaseId() {
  return `NEEV-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
}

async function api<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(url, { ...options, headers: { ...(options?.body instanceof FormData ? {} : { "Content-Type": "application/json" }), ...options?.headers } });
  const json = (await response.json()) as ApiResponse<T>;
  if (!response.ok || json.error) throw new Error(json.error || "Request failed");
  return json.data as T;
}

export default function Home() {
  const [language, setLanguage] = useState<Language>("en");
  const [view, setView] = useState<View>("auth");
  const [registering, setRegistering] = useState(false);
  const [credentials, setCredentials] = useState({ accountId: "", password: "" });
  const [cases, setCases] = useState<CaseRecord[]>([]);
  const [activeCase, setActiveCase] = useState<CaseRecord | null>(null);
  const [stage, setStage] = useState<Stage>("interview");
  const [questionIndex, setQuestionIndex] = useState(0);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [chatOpen, setChatOpen] = useState(true);
  const [messages, setMessages] = useState<{ from: "agent" | "user"; text: string }[]>([
    { from: "agent", text: "Namaste. I’ll explain each step and never unlock a later action before its evidence is ready." },
  ]);
  const [chatInput, setChatInput] = useState("");

  useEffect(() => {
    api<{ cases: CaseRecord[] }>("/api/cases")
      .then(({ cases: rows }) => { setCases(rows); setView("cases"); })
      .catch(() => undefined);
  }, []);

  async function authenticate(demo = false) {
    setBusy(true); setNotice("");
    try {
      if (demo) {
        const demoCase: CaseRecord = {
          id: "NEEV-DEMO24", service: "Aadhaar enrolment", state: "Bihar", district: "Gaya", language,
          status: "Interview in progress", step: 2, profile: { name: "Shiva Kumar", state: "Bihar", district: "Gaya" }, updatedAt: Date.now(),
        };
        setCases([demoCase]); setView("cases"); return;
      }
      const result = await api<{ cases: CaseRecord[] }>(registering ? "/api/auth/register" : "/api/auth/login", {
        method: "POST", body: JSON.stringify(credentials),
      });
      setCases(result.cases); setView("cases");
    } catch (error) { setNotice(error instanceof Error ? error.message : "Unable to continue"); }
    finally { setBusy(false); }
  }

  function openCase(record: CaseRecord) {
    setLanguage(record.language); setActiveCase(record); setQuestionIndex(record.step || 0);
    setStage(record.documents?.length ? "review" : record.step >= interviewQuestions[record.language].length ? "documents" : "interview");
    setView("workflow");
  }

  async function createCase() {
    const record: CaseRecord = {
      id: shortCaseId(), service: "Identity reconstruction", state: "", district: "", language,
      status: "Interview started", step: 0, profile: {}, updatedAt: Date.now(),
    };
    try {
      const saved = await api<CaseRecord>("/api/cases", { method: "POST", body: JSON.stringify(record) });
      setCases((current) => [saved, ...current]); openCase(saved);
    } catch { setCases((current) => [record, ...current]); openCase(record); }
  }

  async function saveCase(next: CaseRecord) {
    setActiveCase(next); setCases((rows) => rows.map((row) => row.id === next.id ? next : row));
    try { await api<CaseRecord>("/api/cases", { method: "PATCH", body: JSON.stringify(next) }); } catch { /* demo mode stays local */ }
  }

  if (view === "auth") return <AuthScreen language={language} setLanguage={setLanguage} registering={registering} setRegistering={setRegistering} credentials={credentials} setCredentials={setCredentials} busy={busy} notice={notice} authenticate={authenticate} />;
  if (view === "cases") return <CaseDashboard language={language} setLanguage={setLanguage} cases={cases} onCreate={createCase} onOpen={openCase} onLogout={() => { setView("auth"); setCases([]); api("/api/auth/logout", { method: "POST" }).catch(() => undefined); }} />;
  if (!activeCase) return null;

  return (
    <main className="app-shell">
      <Header language={language} setLanguage={setLanguage} compact onLogo={() => setView("cases")} />
      <div className="workspace-grid">
        <WorkflowRail stage={stage} caseRecord={activeCase} language={language} onBack={() => setView("cases")} />
        <section className="work-canvas">
          {stage === "interview" && <Interview caseRecord={activeCase} language={language} questionIndex={questionIndex} setQuestionIndex={setQuestionIndex} onSave={saveCase} onComplete={() => setStage("documents")} />}
          {stage === "documents" && <DocumentUpload caseRecord={activeCase} language={language} onSave={saveCase} onBack={() => setStage("interview")} onComplete={() => setStage("review")} />}
          {stage === "review" && <EvidenceReview caseRecord={activeCase} language={language} onSave={saveCase} onBack={() => setStage("documents")} onComplete={() => setStage("pathway")} />}
          {stage === "pathway" && <Pathway caseRecord={activeCase} language={language} onSave={saveCase} onBack={() => setStage("review")} />}
        </section>
        <CaseAssistant open={chatOpen} setOpen={setChatOpen} language={language} messages={messages} setMessages={setMessages} value={chatInput} setValue={setChatInput} caseRecord={activeCase} />
      </div>
    </main>
  );
}

function Header({ language, setLanguage, compact = false, onLogo }: { language: Language; setLanguage: (l: Language) => void; compact?: boolean; onLogo?: () => void }) {
  return <header className={`site-header ${compact ? "compact" : ""}`}>
    <button className="brand" onClick={onLogo} aria-label="Neev home"><span className="brand-mark">न</span><span><strong>NEEV</strong><small>Identity reconstruction</small></span></button>
    <div className="header-actions"><span className="trust-chip"><i /> Official sources first</span><div className="language-toggle" aria-label="Language"><button className={language === "en" ? "active" : ""} onClick={() => setLanguage("en")}>EN</button><button className={language === "hi" ? "active" : ""} onClick={() => setLanguage("hi")}>हि</button></div></div>
  </header>;
}

function AuthScreen({ language, setLanguage, registering, setRegistering, credentials, setCredentials, busy, notice, authenticate }: {
  language: Language; setLanguage: (l: Language) => void; registering: boolean; setRegistering: (v: boolean) => void;
  credentials: { accountId: string; password: string }; setCredentials: (v: { accountId: string; password: string }) => void;
  busy: boolean; notice: string; authenticate: (demo?: boolean) => void;
}) {
  const t = copy[language];
  return <main className="auth-page"><Header language={language} setLanguage={setLanguage} />
    <section className="auth-layout">
      <div className="auth-story"><span className="eyebrow">AGENTIC IDENTITY SUPPORT</span><h1>{t.slogan}</h1><p>{language === "en" ? "Neev reconstructs a clear, evidence-backed path from the documents you already have—one verified step at a time." : "नींव आपके उपलब्ध दस्तावेज़ों से प्रमाण-आधारित स्पष्ट मार्ग बनाता है—एक समय में एक सत्यापित कदम।"}</p>
        <div className="story-flow"><div><b>01</b><span>{language === "en" ? "Tell your story" : "अपनी बात बताएँ"}</span></div><div><b>02</b><span>{language === "en" ? "Read your evidence" : "प्रमाण पढ़ें"}</span></div><div><b>03</b><span>{language === "en" ? "Follow one clear path" : "एक स्पष्ट मार्ग पाएँ"}</span></div></div>
      </div>
      <div className="auth-card"><div className="secure-icon">⌁</div><p className="kicker">{registering ? (language === "en" ? "NEW ACCOUNT" : "नया खाता") : (language === "en" ? "WELCOME BACK" : "पुनः स्वागत")}</p><h2>{t.authTitle}</h2><p className="muted">{t.authBody}</p>
        <label>{t.account}<input value={credentials.accountId} onChange={(e) => setCredentials({ ...credentials, accountId: e.target.value })} placeholder="atulya-r" autoComplete="username" /></label>
        <label>{t.password}<input type="password" value={credentials.password} onChange={(e) => setCredentials({ ...credentials, password: e.target.value })} placeholder="At least 8 characters" autoComplete={registering ? "new-password" : "current-password"} /></label>
        {notice && <p className="error-note">{notice}</p>}
        <button className="primary-button full" disabled={busy} onClick={() => authenticate()}>{busy ? "…" : registering ? t.create : t.login}<span>→</span></button>
        <button className="text-button" onClick={() => setRegistering(!registering)}>{registering ? t.switchLogin : t.create}</button>
        <div className="or"><span>{language === "en" ? "or" : "या"}</span></div><button className="secondary-button full" onClick={() => authenticate(true)}>{t.demo}</button>
        <p className="privacy-note">◈ {t.privacy}</p>
      </div>
    </section>
  </main>;
}

function CaseDashboard({ language, setLanguage, cases, onCreate, onOpen, onLogout }: { language: Language; setLanguage: (l: Language) => void; cases: CaseRecord[]; onCreate: () => void; onOpen: (c: CaseRecord) => void; onLogout: () => void }) {
  const t = copy[language];
  return <main className="dashboard-page"><Header language={language} setLanguage={setLanguage} />
    <section className="dashboard-wrap"><div className="dashboard-heading"><div><p className="eyebrow">{t.welcome}, ATULYA</p><h1>{t.myCases}</h1><p>{t.casesBody}</p></div><div className="dashboard-actions"><button className="text-button" onClick={onLogout}>Sign out</button><button className="primary-button" onClick={onCreate}>＋ {t.newCase}</button></div></div>
      <div className="case-grid">{cases.map((record) => <button className="case-card" key={record.id} onClick={() => onOpen(record)}><div className="case-card-top"><span className="case-icon">⌘</span><span className="status-dot">{record.status}</span></div><h2>{record.profile?.name as string || (language === "en" ? "New identity case" : "नया पहचान केस")}</h2><p>{record.service}</p><div className="case-meta"><span>{record.id}</span><span>{record.district || "District pending"}{record.state ? `, ${record.state}` : ""}</span></div><div className="progress-line"><i style={{ width: `${Math.max(12, (record.step / 8) * 100)}%` }} /></div><span className="resume-link">{language === "en" ? "Resume case" : "केस जारी रखें"} →</span></button>)}
        <button className="new-case-card" onClick={onCreate}><span>＋</span><strong>{t.newCase}</strong><small>{language === "en" ? "A unique case ID is created automatically" : "एक अलग केस आईडी अपने आप बनेगी"}</small></button>
      </div>
    </section>
  </main>;
}

function WorkflowRail({ stage, caseRecord, language, onBack }: { stage: Stage; caseRecord: CaseRecord; language: Language; onBack: () => void }) {
  const t = copy[language]; const order: { key: Stage; label: string; number: string }[] = [{ key: "interview", label: t.interview, number: "01" }, { key: "documents", label: t.documents, number: "02" }, { key: "review", label: t.review, number: "03" }, { key: "pathway", label: t.pathway, number: "04" }]; const current = order.findIndex((item) => item.key === stage);
  return <aside className="workflow-rail"><button className="back-link" onClick={onBack}>← {t.back}</button><p className="case-label">CASE ID</p><strong className="case-id">{caseRecord.id}</strong><div className="rail-steps">{order.map((item, index) => <div className={`${index === current ? "current" : ""} ${index < current ? "done" : ""}`} key={item.key}><span>{index < current ? "✓" : item.number}</span><p>{item.label}<small>{index < current ? (language === "en" ? "Completed" : "पूर्ण") : index === current ? (language === "en" ? "In progress" : "जारी") : (language === "en" ? "Locked" : "लॉक")}</small></p></div>)}</div><div className="rail-help"><span>?</span><p><strong>{language === "en" ? "Need help?" : "मदद चाहिए?"}</strong><small>{language === "en" ? "Ask Neev in your own words." : "नींव से अपनी भाषा में पूछें।"}</small></p></div></aside>;
}

function Interview({ caseRecord, language, questionIndex, setQuestionIndex, onSave, onComplete }: { caseRecord: CaseRecord; language: Language; questionIndex: number; setQuestionIndex: (n: number) => void; onSave: (c: CaseRecord) => void; onComplete: () => void }) {
  const t = copy[language]; const questions = interviewQuestions[language]; const rawQuestion = questions[Math.min(questionIndex, questions.length - 1)];
  const question = rawQuestion?.when && !caseRecord.profile[rawQuestion.when] ? questions[questionIndex + 1] : rawQuestion;
  const actualIndex = question === rawQuestion ? questionIndex : questionIndex + 1; const value = caseRecord.profile[question.key];
  function setValue(next: unknown) { onSave({ ...caseRecord, state: question.key === "state" ? String(next) : caseRecord.state, district: question.key === "district" ? String(next) : caseRecord.district, service: question.key === "goal" ? String(next) : caseRecord.service, profile: { ...caseRecord.profile, [question.key]: next }, updatedAt: Date.now() }); }
  async function next() { const nextIndex = actualIndex + 1; const nextCase = { ...caseRecord, step: nextIndex, status: nextIndex >= questions.length ? "Documents needed" : "Interview in progress", updatedAt: Date.now() }; await onSave(nextCase); if (nextIndex >= questions.length) onComplete(); else setQuestionIndex(nextIndex); }
  const answered = Array.isArray(value) ? value.length > 0 : Boolean(value) || (question.type === "yesno" && value === false);
  return <div className="stage-card"><StageHeader eyebrow={language === "en" ? "ADAPTIVE INTERVIEW" : "अनुकूल साक्षात्कार"} title={question.title} help={question.help} language={language} speakText={question.title} />
    <div className="question-progress"><span>{language === "en" ? "QUESTION" : "प्रश्न"} {actualIndex + 1} / {questions.length}</span><div>{questions.map((_, i) => <i key={i} className={i <= actualIndex ? "filled" : ""} />)}</div></div>
    <div className="answer-area"><QuestionInput type={question.type} value={value} onChange={setValue} language={language} /></div>
    <div className="stage-actions"><button className="secondary-button" disabled={actualIndex === 0} onClick={() => setQuestionIndex(Math.max(0, actualIndex - 1))}>← {t.previous}</button><span className="autosave">✓ {t.saved}</span><button className="primary-button" disabled={!answered} onClick={next}>{t.continue} →</button></div>
  </div>;
}

function QuestionInput({ type, value, onChange, language }: { type: string; value: unknown; onChange: (v: unknown) => void; language: Language }) {
  const voiceTarget = useRef<HTMLInputElement | HTMLTextAreaElement>(null);
  if (type === "yesno") return <div className="choice-grid two"><button className={value === true ? "selected" : ""} onClick={() => onChange(true)}><span>✓</span><strong>{language === "en" ? "Yes, I know it" : "हाँ, पता है"}</strong></button><button className={value === false ? "selected" : ""} onClick={() => onChange(false)}><span>—</span><strong>{language === "en" ? "No, I’m not sure" : "नहीं / निश्चित नहीं"}</strong></button></div>;
  if (type === "state") return <div className="choice-grid states">{states.map((item) => <button key={item} className={value === item ? "selected" : ""} onClick={() => onChange(item)}>{item}</button>)}</div>;
  if (type === "goal") return <div className="choice-grid goals">{goals.map((item) => <button key={item} className={value === item ? "selected" : ""} onClick={() => onChange(item)}><span>◫</span>{item}</button>)}</div>;
  if (type === "multi") { const selected = (value as string[]) || []; return <div className="choice-grid documents">{documentOptions.map((item) => <button key={item} className={selected.includes(item) ? "selected" : ""} onClick={() => onChange(selected.includes(item) ? selected.filter((v) => v !== item) : [...selected, item])}><span>{selected.includes(item) ? "✓" : "＋"}</span>{item}</button>)}</div>; }
  if (type === "date") return <input className="large-input" type="date" max={new Date().toISOString().slice(0, 10)} value={String(value || "")} onChange={(e) => onChange(e.target.value)} />;
  if (type === "textarea") return <div className="voice-field"><textarea ref={voiceTarget as React.RefObject<HTMLTextAreaElement>} rows={5} value={String(value || "")} onChange={(e) => onChange(e.target.value)} placeholder={language === "en" ? "Tell us what happened…" : "बताएँ कि क्या हुआ…"} /><VoiceButton language={language} onResult={onChange} /></div>;
  return <div className="voice-field"><input ref={voiceTarget as React.RefObject<HTMLInputElement>} className="large-input" value={String(value || "")} onChange={(e) => onChange(e.target.value)} placeholder={language === "en" ? "Type your answer" : "अपना उत्तर लिखें"} /><VoiceButton language={language} onResult={onChange} /></div>;
}

function VoiceButton({ language, onResult }: { language: Language; onResult: (text: string) => void }) {
  const [listening, setListening] = useState(false);
  function listen() {
    const Recognition = (window as unknown as { webkitSpeechRecognition?: new () => { lang: string; start: () => void; onresult: (event: { results: { 0: { 0: { transcript: string } } }[] }) => void; onend: () => void } }).webkitSpeechRecognition;
    if (!Recognition) { alert(language === "en" ? "Voice input is not supported in this browser. Please type your answer." : "इस ब्राउज़र में आवाज़ इनपुट उपलब्ध नहीं है। कृपया उत्तर लिखें।"); return; }
    const recognition = new Recognition(); recognition.lang = language === "hi" ? "hi-IN" : "en-IN"; setListening(true); recognition.onresult = (event) => onResult(event.results[0][0].transcript); recognition.onend = () => setListening(false); recognition.start();
  }
  return <button className={`voice-button ${listening ? "listening" : ""}`} onClick={listen} aria-label="Voice answer">{listening ? "◉" : "●"}<span>{language === "en" ? (listening ? "Listening…" : "Speak") : (listening ? "सुन रहा है…" : "बोलें")}</span></button>;
}

function StageHeader({ eyebrow, title, help, language, speakText }: { eyebrow: string; title: string; help: string; language: Language; speakText: string }) {
  function speak() { speechSynthesis.cancel(); const utterance = new SpeechSynthesisUtterance(speakText); utterance.lang = language === "hi" ? "hi-IN" : "en-IN"; speechSynthesis.speak(utterance); }
  return <header className="stage-header"><div><p className="eyebrow">{eyebrow}</p><h1>{title}</h1><p>{help}</p></div><button className="listen-button" onClick={speak}>◖ {language === "en" ? "Listen" : "सुनें"}</button></header>;
}

function DocumentUpload({ caseRecord, language, onSave, onBack, onComplete }: { caseRecord: CaseRecord; language: Language; onSave: (c: CaseRecord) => void; onBack: () => void; onComplete: () => void }) {
  const t = copy[language]; const [files, setFiles] = useState<File[]>([]); const [docType, setDocType] = useState("School certificate"); const [busy, setBusy] = useState(false); const [error, setError] = useState("");
  async function process() { setBusy(true); setError(""); const parsed: DocumentRecord[] = [];
    for (const file of files) { const form = new FormData(); form.append("file", file); form.append("caseId", caseRecord.id); form.append("type", docType); form.append("language", language); try { parsed.push(await api<DocumentRecord>("/api/documents", { method: "POST", body: form })); } catch { parsed.push({ id: crypto.randomUUID(), type: docType, fileName: file.name, status: "review", confidence: 0.82, fields: { name: String(caseRecord.profile.name || "Not detected"), document_type: docType }, issue: "Demo extraction—connect an AI key for live parsing." }); } }
    const next = { ...caseRecord, documents: [...(caseRecord.documents || []), ...parsed], status: "Evidence review", updatedAt: Date.now() }; await onSave(next); setBusy(false); onComplete(); }
  return <div className="stage-card"><StageHeader eyebrow={language === "en" ? "DOCUMENT INTAKE" : "दस्तावेज़ अपलोड"} title={language === "en" ? "Add every document you have" : "आपके पास मौजूद सभी दस्तावेज़ जोड़ें"} help={language === "en" ? "Clear photos or PDFs work best. Neev extracts text and fields, then asks you to verify—never silently accepting an AI guess." : "साफ़ फोटो या PDF सबसे अच्छे हैं। नींव टेक्स्ट निकालकर आपसे पुष्टि करवाता है।"} language={language} speakText={language === "en" ? "Add every document you have" : "आपके पास मौजूद सभी दस्तावेज़ जोड़ें"} />
    <div className="upload-layout"><div className="upload-controls"><label>{language === "en" ? "Document type" : "दस्तावेज़ प्रकार"}<select value={docType} onChange={(e) => setDocType(e.target.value)}>{documentOptions.map((item) => <option key={item}>{item}</option>)}</select></label><label className="drop-zone"><input type="file" multiple accept="image/jpeg,image/png,image/webp,application/pdf" onChange={(e) => setFiles(Array.from(e.target.files || []))} /><span className="upload-icon">⇧</span><strong>{t.upload}</strong><small>PDF, JPG, PNG or WEBP · max 8 MB each</small></label></div>
      <div className="upload-list"><h3>{language === "en" ? "Selected files" : "चुनी गई फ़ाइलें"} <span>{files.length}</span></h3>{files.length === 0 ? <div className="empty-state">{language === "en" ? "Your selected documents will appear here." : "चुने गए दस्तावेज़ यहाँ दिखेंगे।"}</div> : files.map((file) => <div className="file-row" key={file.name}><span>▤</span><p><strong>{file.name}</strong><small>{(file.size / 1024 / 1024).toFixed(1)} MB · {docType}</small></p><button onClick={() => setFiles((rows) => rows.filter((f) => f !== file))}>×</button></div>)}</div></div>
    {error && <p className="error-note">{error}</p>}<div className="stage-actions"><button className="secondary-button" onClick={onBack}>← {t.previous}</button><span className="autosave">◈ {language === "en" ? "Encrypted storage" : "सुरक्षित संग्रह"}</span><button className="primary-button" disabled={!files.length || busy} onClick={process}>{busy ? (language === "en" ? "Reading evidence…" : "प्रमाण पढ़ रहा है…") : t.process} →</button></div>
  </div>;
}

function EvidenceReview({ caseRecord, language, onSave, onBack, onComplete }: { caseRecord: CaseRecord; language: Language; onSave: (c: CaseRecord) => void; onBack: () => void; onComplete: () => void }) {
  const t = copy[language]; const docs = caseRecord.documents || []; const [confirmed, setConfirmed] = useState<string[]>([]); const allConfirmed = docs.length > 0 && confirmed.length === docs.length;
  async function continueToPlan() { const next = { ...caseRecord, documents: docs.map((d) => ({ ...d, status: "verified" as const })), status: "Pathway ready", updatedAt: Date.now() }; await onSave(next); onComplete(); }
  return <div className="stage-card wide"><StageHeader eyebrow={language === "en" ? "EVIDENCE RESOLUTION" : "प्रमाण समाधान"} title={language === "en" ? "Confirm what Neev found" : "नींव द्वारा मिली जानकारी की पुष्टि करें"} help={language === "en" ? "Fields are compared across documents using spelling similarity and shared identity facts. Low-confidence values stay flagged." : "दस्तावेज़ों में वर्तनी और पहचान तथ्यों की तुलना की जाती है। कम भरोसे वाली जानकारी चिन्हित रहती है।"} language={language} speakText={language === "en" ? "Confirm what Neev found" : "मिली जानकारी की पुष्टि करें"} />
    <div className="confidence-banner"><div className="confidence-ring">{Math.round((docs.reduce((sum, d) => sum + (d.confidence || 0), 0) / Math.max(1, docs.length)) * 100)}<small>%</small></div><p><strong>{language === "en" ? "Cross-document confidence" : "दस्तावेज़ संयुक्त भरोसा"}</strong><span>{language === "en" ? "Advisory score, not government verification" : "यह सलाहकारी स्कोर है, सरकारी सत्यापन नहीं"}</span></p><div className="evidence-links"><span>● Person</span><i /><span>● {docs.length} document{docs.length === 1 ? "" : "s"}</span><i /><span>● {caseRecord.district || "Address"}</span></div></div>
    <div className="review-grid">{docs.map((doc) => <article className="review-card" key={doc.id}><header><span>▤</span><div><strong>{doc.type}</strong><small>{doc.fileName}</small></div><em>{Math.round((doc.confidence || 0) * 100)}% confidence</em></header><div className="field-table">{Object.entries(doc.fields || {}).map(([key, value]) => <div key={key}><span>{key.replaceAll("_", " ")}</span><strong>{value}</strong></div>)}</div>{doc.issue && <p className="issue-note">△ {doc.issue}</p>}<label className="confirm-check"><input type="checkbox" checked={confirmed.includes(doc.id)} onChange={() => setConfirmed((rows) => rows.includes(doc.id) ? rows.filter((id) => id !== doc.id) : [...rows, doc.id])} />{language === "en" ? "I confirm these extracted fields" : "मैं निकाली गई जानकारी की पुष्टि करता/करती हूँ"}</label></article>)}</div>
    <div className="stage-actions"><button className="secondary-button" onClick={onBack}>← {t.previous}</button><span className="autosave">{confirmed.length}/{docs.length} {language === "en" ? "confirmed" : "पुष्टि"}</span><button className="primary-button" disabled={!allConfirmed} onClick={continueToPlan}>{language === "en" ? "Build my pathway" : "मेरा मार्ग बनाएँ"} →</button></div>
  </div>;
}

function Pathway({ caseRecord, language, onSave, onBack }: { caseRecord: CaseRecord; language: Language; onSave: (c: CaseRecord) => void; onBack: () => void }) {
  const t = copy[language]; const [busy, setBusy] = useState(!caseRecord.plan); const [plan, setPlan] = useState<PlanStep[]>(caseRecord.plan || []); const [notice, setNotice] = useState("");
  useEffect(() => { if (plan.length) return; api<{ steps: PlanStep[] }>("/api/plan", { method: "POST", body: JSON.stringify({ caseRecord }) }).then(({ steps }) => { setPlan(steps); onSave({ ...caseRecord, plan: steps, updatedAt: Date.now() }); }).catch(() => { const fallback = buildFallbackPlan(caseRecord, language); setPlan(fallback); onSave({ ...caseRecord, plan: fallback, updatedAt: Date.now() }); }).finally(() => setBusy(false)); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  function complete(id: string) { const index = plan.findIndex((s) => s.id === id); const next = plan.map((step, i) => i === index ? { ...step, state: "complete" as const } : i === index + 1 ? { ...step, state: "ready" as const } : step); setPlan(next); onSave({ ...caseRecord, plan: next, updatedAt: caseRecord.updatedAt }); }
  async function affidavit() { setNotice(""); try { const response = await fetch("/api/affidavit", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ caseRecord, language }) }); if (!response.ok) throw new Error(); const blob = await response.blob(); const url = URL.createObjectURL(blob); const anchor = document.createElement("a"); anchor.href = url; anchor.download = `${caseRecord.id}-draft-affidavit.pdf`; anchor.click(); URL.revokeObjectURL(url); } catch { setNotice(language === "en" ? "PDF generation is unavailable in demo mode. Create an account to generate a case-linked draft." : "डेमो में PDF उपलब्ध नहीं है। केस से जुड़ा मसौदा बनाने के लिए खाता बनाएँ।"); } }
  return <div className="stage-card wide"><StageHeader eyebrow={t.officialOnly} title={language === "en" ? `Shortest supported path to ${caseRecord.service}` : `${caseRecord.service} तक सबसे छोटा समर्थित मार्ग`} help={language === "en" ? `Built from your verified evidence, ${caseRecord.state || "state"} rules and official government sources. Only the current actionable step is unlocked.` : "आपके प्रमाण, राज्य नियम और आधिकारिक सरकारी स्रोतों से तैयार। केवल वर्तमान कदम खुला है।"} language={language} speakText={language === "en" ? "Your supported pathway is ready" : "आपका मार्ग तैयार है"} />
    {busy ? <div className="planner-loading"><span /><p>{language === "en" ? "Rule agent is checking evidence dependencies…" : "नियम एजेंट प्रमाण निर्भरता जाँच रहा है…"}</p></div> : <><div className="path-summary"><div><span>⌘</span><p><strong>{plan.filter((s) => s.state === "complete").length}/{plan.length}</strong><small>{language === "en" ? "steps completed" : "कदम पूर्ण"}</small></p></div><div><span>◷</span><p><strong>{Math.max(1, plan.length - plan.filter((s) => s.state === "complete").length)}</strong><small>{language === "en" ? "actions remaining" : "कार्य बाकी"}</small></p></div><div><span>◈</span><p><strong>{caseRecord.documents?.length || 0}</strong><small>{language === "en" ? "evidence items" : "प्रमाण"}</small></p></div></div>
      <div className="plan-list">{plan.map((step, index) => <article className={`plan-step ${step.state}`} key={step.id}><div className="step-number">{step.state === "complete" ? "✓" : step.state === "locked" ? "◇" : index + 1}</div><div className="step-content"><header><div><p>STEP {index + 1} · {step.state.toUpperCase()}</p><h3>{step.title}</h3></div><span className="office-chip">⌖ {step.office}</span></header><p>{step.description}</p>{step.source && <a href={step.source} target="_blank" rel="noreferrer">↗ {language === "en" ? "Check official source" : "आधिकारिक स्रोत देखें"}</a>}<div className="step-buttons">{step.url && <a className="secondary-button" href={step.url} target="_blank" rel="noreferrer">{language === "en" ? "Open service" : "सेवा खोलें"} ↗</a>}{step.state === "ready" && <button className="primary-button" onClick={() => complete(step.id)}>{language === "en" ? "I completed this step" : "मैंने यह कदम पूरा किया"} ✓</button>}</div></div></article>)}</div>
      <div className="agent-actions"><button className="secondary-button" onClick={affidavit}>▤ {t.generate}</button><button className="secondary-button" onClick={() => window.open("https://bhuvan.nrsc.gov.in/", "_blank")}>⌖ {language === "en" ? "Find Aadhaar centre" : "आधार केंद्र खोजें"}</button><span>{language === "en" ? "Appointment booking is not supported; Neev provides the official locator instead." : "अपॉइंटमेंट बुकिंग उपलब्ध नहीं; आधिकारिक केंद्र खोज लिंक दिया गया है।"}</span></div></>}
    {notice && <p className="error-note">{notice}</p>}<p className="legal-disclaimer">⚠ {t.disclaimer}</p><div className="stage-actions"><button className="secondary-button" onClick={onBack}>← {t.previous}</button></div>
  </div>;
}

function buildFallbackPlan(caseRecord: CaseRecord, language: Language): PlanStep[] {
  const hasPoi = (caseRecord.profile.documents as string[] || []).some((d) => ["Voter ID", "PAN card", "Aadhaar"].includes(d)); const source = "https://uidai.gov.in/images/commdoc/List_of_Supporting_Document_for_Aadhaar_Enrolment_and_Update.pdf";
  if (caseRecord.service === "Aadhaar enrolment" && !hasPoi) return [
    { id: "residence", title: language === "en" ? "Apply for a residence certificate" : "आवासीय प्रमाणपत्र के लिए आवेदन करें", description: language === "en" ? `Use the official ${caseRecord.state || "state"} service portal or visit the competent revenue/local authority in ${caseRecord.district || "your district"}. Confirm the authority and required local evidence before filing.` : "आधिकारिक राज्य सेवा पोर्टल से आवेदन करें या संबंधित राजस्व/स्थानीय कार्यालय जाएँ।", office: caseRecord.state === "Bihar" ? "Bihar ServicePlus / RTPS" : "Local revenue office", url: caseRecord.state === "Bihar" ? "https://serviceonline.bihar.gov.in/" : undefined, source: caseRecord.state === "Bihar" ? "https://serviceonline.bihar.gov.in/" : source, state: "ready" },
    { id: "identity", title: language === "en" ? "Obtain an accepted identity/address certificate" : "मान्य पहचान/पता प्रमाणपत्र लें", description: language === "en" ? "Ask the designated competent authority to issue the current UIDAI standard certificate, if applicable. Do not assume that any locally issued letter will be accepted." : "यदि लागू हो तो सक्षम अधिकारी से वर्तमान UIDAI मानक प्रारूप में प्रमाणपत्र लें।", office: "Designated UIDAI certifier", source, state: "locked" },
    { id: "enrol", title: language === "en" ? "Visit an Aadhaar enrolment centre" : "आधार नामांकन केंद्र जाएँ", description: language === "en" ? "Carry original accepted documents. The operator verifies documents and records demographics and biometrics; final acceptance remains with UIDAI." : "मूल मान्य दस्तावेज़ ले जाएँ। अंतिम स्वीकृति UIDAI के अधीन है।", office: "Aadhaar enrolment centre", url: "https://bhuvan.nrsc.gov.in/", source, state: "locked" },
  ];
  return [{ id: "verify", title: language === "en" ? "Verify your accepted documents" : "मान्य दस्तावेज़ जाँचें", description: language === "en" ? "Compare your evidence with the current official document list before visiting the service centre." : "सेवा केंद्र जाने से पहले आधिकारिक सूची से दस्तावेज़ मिलाएँ।", office: "Official service portal", source, state: "ready" }, { id: "submit", title: language === "en" ? "Submit at the official centre" : "आधिकारिक केंद्र पर जमा करें", description: language === "en" ? "Carry originals and the checklist generated from this case." : "मूल दस्तावेज़ और केस की चेकलिस्ट साथ ले जाएँ।", office: "Government service centre", source, state: "locked" }];
}

function CaseAssistant({ open, setOpen, language, messages, setMessages, value, setValue, caseRecord }: { open: boolean; setOpen: (v: boolean) => void; language: Language; messages: { from: "agent" | "user"; text: string }[]; setMessages: (m: { from: "agent" | "user"; text: string }[]) => void; value: string; setValue: (v: string) => void; caseRecord: CaseRecord }) {
  const t = copy[language]; const [busy, setBusy] = useState(false);
  async function send() { const text = value.trim(); if (!text || busy) return; const next = [...messages, { from: "user" as const, text }]; setMessages(next); setValue(""); setBusy(true); try { const result = await api<{ answer: string }>("/api/ai", { method: "POST", body: JSON.stringify({ task: "chat", language, text, caseRecord }) }); setMessages([...next, { from: "agent", text: result.answer }]); } catch { setMessages([...next, { from: "agent", text: language === "en" ? "I can explain the visible step. For a new legal claim, please use the official source link or connect a Gemini/Groq key." : "मैं दिख रहे कदम को समझा सकता हूँ। नए कानूनी दावे के लिए आधिकारिक स्रोत देखें या AI कुंजी जोड़ें।" }]); } finally { setBusy(false); } }
  if (!open) return <button className="chat-fab" onClick={() => setOpen(true)}>✦</button>;
  return <aside className="assistant-panel"><header><span className="agent-avatar">न</span><p><strong>{t.assistant}</strong><small><i /> {t.assistantStatus}</small></p><button onClick={() => setOpen(false)}>×</button></header><div className="assistant-scope">◈ {language === "en" ? "Answers stay grounded in this case" : "उत्तर इसी केस पर आधारित हैं"}</div><div className="messages">{messages.map((message, i) => <div className={message.from} key={i}>{message.text}</div>)}{busy && <div className="agent typing">•••</div>}</div><div className="quick-prompts"><button onClick={() => setValue(language === "en" ? "Why is the next step locked?" : "अगला कदम लॉक क्यों है?")}>{language === "en" ? "Why is this locked?" : "यह लॉक क्यों है?"}</button><button onClick={() => setValue(language === "en" ? "Explain this in simple words" : "सरल शब्दों में समझाएँ")}>{language === "en" ? "Explain simply" : "सरल समझाएँ"}</button></div><div className="chat-input"><textarea rows={2} value={value} onChange={(e) => setValue(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }} placeholder={t.ask} /><button onClick={send}>↑</button></div><small className="ai-note">AI may make mistakes. Verify official links.</small></aside>;
}
