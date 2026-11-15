"use client";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { ArrowUpRight, ArrowRight, ArrowLeft, Plus, Bookmark, BookOpen, Settings2, ShieldCheck, Search, Sparkles, Laptop, Printer, Headphones, ChevronDown, Check, X, MapPin, Wallet, Building2, LoaderCircle, Download, Copy, CalendarPlus, Trash2, KeyRound, AlertCircle, Globe2, CornerUpRight, CircleHelp, RotateCcw, Menu, FileText, CheckCircle2 } from "lucide-react";
import { exampleMessages } from "@/lib/examples";
import { continueConversation } from "@/lib/conversation";
import { inputSchema, outputSchema, planCalendar, planMarkdown, safeUrl, withoutCitations } from "@/lib/plan-core";
import type { AgentEvent, AgentStage, ConversationTurn, Plan, PlanInput, Profile, Source, View } from "@/lib/plan-types";
const storageKey = "planb.history.en.v2";
const stages: AgentStage[] = ["understand", "search", "read", "compare", "prepare"];
const stageLabels = ["Understanding your constraints", "Looking for different routes", "Reading sources and restrictions", "Comparing practical options", "Preparing your next step"];
const initialProfile = (): Profile => ({ location: "", budget: null, deadline: "", timeZone: "Europe/Tallinn", deepSearch: false });
function download(name: string, content: string, type = "text/plain;charset=utf-8") {
    const url = URL.createObjectURL(new Blob([content], { type }));
    const link = document.createElement("a");
    link.href = url;
    link.download = name;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function loadHistory(): Plan[] {
    try {
        const data: unknown = JSON.parse(localStorage.getItem(storageKey) || "[]");
        if (!Array.isArray(data))
            return [];
        return data.filter((item): item is Plan => !!item && typeof item.id === "string" && typeof item.createdAt === "string" && inputSchema.safeParse(item.input).success && outputSchema.safeParse(item.output).success && Array.isArray(item.sources) && item.sources.every((s: Source) => typeof s.id === "string" && typeof s.title === "string" && !!safeUrl(s.url)) && Array.isArray(item.grounding) && Array.isArray(item.trace) && Array.isArray(item.warnings) && !!item.metrics).slice(0, 12).map((item) => ({ ...item, input: inputSchema.parse(item.input) }));
    }
    catch {
        return [];
    }
}
function Modal({ title, close, children }: {
    title: string;
    close: () => void;
    children: ReactNode;
}) {
    const ref = useRef<HTMLDivElement>(null), closeRef = useRef(close);
    closeRef.current = close;
    useEffect(() => {
        const previous = document.activeElement as HTMLElement | null;
        const focusable = () => [...(ref.current?.querySelectorAll<HTMLElement>('button, input, select, a[href], textarea, [tabindex="0"]') || [])].filter((item) => !item.hasAttribute("disabled"));
        (ref.current?.querySelector<HTMLElement>("input, select, textarea") || focusable()[0])?.focus();
        function onKey(event: KeyboardEvent) {
            if (event.key === "Escape")
                closeRef.current();
            if (event.key === "Tab") {
                const elements = focusable(), first = elements[0], last = elements.at(-1);
                if (event.shiftKey && document.activeElement === first) {
                    event.preventDefault();
                    last?.focus();
                }
                else if (!event.shiftKey && document.activeElement === last) {
                    event.preventDefault();
                    first?.focus();
                }
            }
        }
        document.addEventListener("keydown", onKey);
        const overflow = document.body.style.overflow;
        document.body.style.overflow = "hidden";
        return () => { document.removeEventListener("keydown", onKey); document.body.style.overflow = overflow; previous?.focus(); };
    }, []);
    return <div className="modal-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget)
        close(); }}><div className="modal" role="dialog" aria-modal="true" aria-label={title} ref={ref}><div className="modal-heading"><h2>{title}</h2><button className="icon-button" onClick={close} aria-label="Close"><X size={20}/></button></div>{children}</div></div>;
}
function CitationText({ text, sources, onSource }: {
    text: string;
    sources: Source[];
    onSource: (id: string) => void;
}) {
    return <>{text.split(/(\[S\d+\])/g).map((part, index) => {
            const id = /^\[(S\d+)\]$/.exec(part)?.[1];
            if (!id)
                return <span key={index}>{part}</span>;
            const source = sources.find((item) => item.id === id);
            return source ? <button type="button" className="citation" title={source.title} onClick={() => onSource(id)} key={index}>{id.slice(1)}</button> : null;
        })}</>;
}
export default function Home() {
    const lang = "en";
    const [view, setView] = useState<View>("new"), [message, setMessage] = useState("");
    const [profile, setProfile] = useState<Profile>(initialProfile);
    const [modal, setModal] = useState<"profile" | "draft" | null>(null);
    const [history, setHistory] = useState<Plan[]>([]), [hydrated, setHydrated] = useState(false);
    const [plan, setPlan] = useState<Plan | null>(null), [busy, setBusy] = useState(false);
    const [stage, setStage] = useState<AgentStage>("understand"), [liveSources, setLiveSources] = useState<Source[]>([]);
    const [error, setError] = useState(""), [toast, setToast] = useState(""), [followup, setFollowup] = useState("");
    const [completed, setCompleted] = useState<number[]>([]), [mobileMenu, setMobileMenu] = useState(false);
    const abort = useRef<AbortController | null>(null), textarea = useRef<HTMLTextAreaElement>(null), resultRef = useRef<HTMLDivElement>(null);
    useEffect(() => {
        setHistory(loadHistory());
        setProfile((old) => ({ ...old, timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone || old.timeZone }));
        setHydrated(true);
        return () => abort.current?.abort();
    }, []);
    useEffect(() => { if (hydrated) {
        try {
            localStorage.setItem(storageKey, JSON.stringify(history));
        }
        catch {
            setToast("Couldn't save history. Download any plan you need.");
        }
    } }, [history, hydrated]);
    useEffect(() => { if (!toast)
        return; const timer = setTimeout(() => setToast(""), 4200); return () => clearTimeout(timer); }, [toast]);
    function navigate(next: View) { setView(next); setMobileMenu(false); window.scrollTo({ top: 0, behavior: "smooth" }); }
    function reset() { abort.current?.abort(); abort.current = null; setBusy(false); setPlan(null); setMessage(""); setError(""); setCompleted([]); navigate("new"); setTimeout(() => textarea.current?.focus(), 100); }
    function selectExample(index: number) {
        setMessage(exampleMessages[index]);
        setError("");
        setProfile((old) => ({ ...old, budget: index === 1 ? 5 : 10, location: "Helsinki" }));
        textarea.current?.focus();
        document.querySelector(".composer")?.scrollIntoView({ behavior: "smooth", block: "center" });
    }
    async function run(messageOverride?: string, conversation: ConversationTurn[] = []) {
        const task = (messageOverride || message).trim();
        if (task.length < 3) {
            setError("Tell us a little more — at least 3 characters.");
            textarea.current?.focus();
            return;
        }
        if (busy)
            return;
        const controller = new AbortController();
        abort.current = controller;
        setBusy(true);
        setError("");
        setStage("understand");
        setLiveSources([]);
        setPlan(null);
        setCompleted([]);
        setView("new");
        setMessage(task);
        setFollowup("");
        let gotResult = false, eventError = false;
        const input: PlanInput = { message: task, profile, conversation };
        try {
            const response = await fetch("/api/plan", { method: "POST", headers: { "Content-Type": "application/json", }, body: JSON.stringify(input), signal: controller.signal });
            if (!response.ok) {
                const data = await response.json() as {
                    error?: string;
                };
                throw new Error(data.error || "Request failed");
            }
            if (!response.body)
                throw new Error("Empty response");
            const reader = response.body.getReader(), decoder = new TextDecoder();
            let buffer = "";
            const receive = (chunk: string) => {
                for (const line of chunk.split("\n")) {
                    if (!line.startsWith("data: "))
                        continue;
                    const event = JSON.parse(line.slice(6)) as AgentEvent;
                    if (event.type === "stage")
                        setStage(event.stage);
                    if (event.type === "sources")
                        setLiveSources(event.sources);
                    if (event.type === "error") {
                        eventError = true;
                        setError(event.message);
                    }
                    if (event.type === "result") {
                        gotResult = true;
                        setPlan(event.plan);
                        setHistory((old) => [event.plan, ...old.filter((item) => item.id !== event.plan.id)].slice(0, 12));
                        setTimeout(() => resultRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 80);
                    }
                }
            };
            while (true) {
                const { value, done } = await reader.read();
                buffer += decoder.decode(value, { stream: !done });
                let boundary;
                while ((boundary = buffer.indexOf("\n\n")) >= 0) {
                    receive(buffer.slice(0, boundary));
                    buffer = buffer.slice(boundary + 2);
                }
                if (done) {
                    if (buffer.trim())
                        receive(buffer);
                    break;
                }
            }
            if (!gotResult && !eventError)
                throw new Error("The connection ended before your plan arrived. Please retry.");
        }
        catch (err) {
            if (!controller.signal.aborted)
                setError(err instanceof Error ? err.message : "Search failed");
        }
        finally {
            if (abort.current === controller) {
                setBusy(false);
                abort.current = null;
            }
        }
    }
    function openPlan(item: Plan) { setPlan(item); setProfile(item.input.profile); setMessage(item.input.message); setCompleted([]); setError(""); navigate("new"); }
    function jumpSource(id: string) { const target = document.getElementById(`source-${id}`); target?.scrollIntoView({ behavior: "smooth", block: "center" }); target?.classList.add("source-highlight"); setTimeout(() => target?.classList.remove("source-highlight"), 1500); }
    async function copyText(text: string) { try {
        await navigator.clipboard.writeText(text);
        setToast("Copied");
    }
    catch {
        download("planb.txt", text);
    } }
    const cited = (text: string) => <CitationText text={text} sources={plan?.sources || []} onSource={jumpSource}/>;
    function sourceCards(sources: Source[]) {
        return <div className="sources-grid">{sources.map((source) => <article className="source-card" id={`source-${source.id}`} key={source.id}>
      <div className="source-top"><span className="source-number">{source.id}</span><span className={source.official ? "source-type official" : "source-type"}>{source.official ? <ShieldCheck size={12}/> : <Globe2 size={12}/>} {source.official ? "Organisation website" : "Web source"}</span></div>
      <h3><a href={safeUrl(source.url) || "#"} target="_blank" rel="noopener noreferrer">{source.title}<ArrowUpRight size={15}/></a></h3><p className="source-domain">{source.domain}</p>{source.excerpt && <blockquote>“{source.excerpt}”</blockquote>}
      <div className="source-bottom"><span><span className={`tiny-dot ${source.contentRead ? "green" : ""}`}/>{source.contentRead ? "Page read" : "Indexed excerpt"}</span>{source.retrievedAt && <time title={new Date(source.retrievedAt).toLocaleString(lang, { timeZone: profile.timeZone })}>{new Date(source.retrievedAt).toLocaleDateString(lang, { timeZone: profile.timeZone })}</time>}</div>
    </article>)}</div>;
    }
    const allSources = plan?.sources.length ? plan.sources : history[0]?.sources || [];
    const navLabels = ["New search", "Search history", "Sources", "How it works"];
    const promise = "Evidence you can review. The final decision stays yours.";
    return <div className="app-shell">
    {mobileMenu && <button className="sidebar-scrim" aria-label="Close menu" onClick={() => setMobileMenu(false)}/>}
    <aside className={`sidebar ${mobileMenu ? "is-open" : ""}`}>
      <button className="brand" onClick={reset} aria-label="Plan B home"><span className="brand-mark"><CornerUpRight size={23} strokeWidth={2.5}/></span><span>plan<span className="brand-b">b</span><small>ASSISTANT</small></span><span className="brand-period">•</span></button>
      <div className="workspace-selector"><div className="workspace-icon"><Building2 size={16}/></div><div><strong>Web workspace</strong><small>{"Search & research"}</small></div><ChevronDown size={14}/></div>
      <nav className="main-nav" aria-label="Main navigation">{([Plus, Bookmark, BookOpen, CircleHelp] as const).map((Icon, index) => { const key = (["new", "saved", "sources", "about"] as View[])[index]; return <button key={key} onClick={() => index === 0 ? reset() : navigate(key)} className={view === key ? "active" : ""}><Icon size={index === 0 ? 19 : 18}/>{navLabels[index]}{index === 0 && <span className="nav-shortcut">↗</span>}{index === 1 && history.length > 0 && <span className="nav-count">{history.length}</span>}</button>; })}</nav>
      <div className="recent-plans"><p className="eyebrow">{"RECENT SEARCHES"}</p>{history.length ? history.slice(0, 3).map((item) => <button key={item.id} onClick={() => openPlan(item)}><span className="recent-dot"/><span>{withoutCitations(item.output.title)}</span></button>) : <p className="recent-empty">{"Your next plan will live here"}</p>}</div>
      <div className="sidebar-bottom"><button className="user-profile" onClick={() => setModal("profile")}><span className="avatar"><Settings2 size={20}/></span><span><strong>Search preferences</strong><small>Make it work for you</small></span><ChevronDown size={16}/></button></div>
    </aside>

    <div className="main-shell"><header className="topbar"><div className="breadcrumb"><button className="mobile-menu icon-button" onClick={() => setMobileMenu(true)} aria-label="Open menu"><Menu size={21}/></button><span className="breadcrumb-home"><Building2 size={15}/>{"Workspace"}</span><span className="breadcrumb-slash">/</span><strong>{navLabels[(["new", "saved", "sources", "about"] as View[]).indexOf(view)]}</strong></div><div className="topbar-actions"><button className="icon-button" onClick={() => setModal("profile")} aria-label="Search preferences"><Settings2 size={18}/></button></div></header>

    <main className={`main-content ${plan || busy ? "has-result" : ""}`}>
      {view === "new" && <>
        {!plan && !busy && <><section className="hero"><div className="hero-copy"><div className="hero-kicker"><span className="sparkle-badge"><Sparkles size={12}/></span>{"FOR BIG QUESTIONS & EVERYDAY TASKS"}</div><h1>{"Big questions."}<br /><span>{"Meet your Plan B."}</span></h1><p>{"Ask a question or describe a task. We’ll search the web, compare sources and bring your next steps together."}</p></div><div className="hero-art" aria-hidden="true"><span className="art-plus plus-one">+</span><span className="art-plus plus-two">✳</span><div className="rescue-ticket"><div className="ticket-top"><span className="ticket-logo"><CornerUpRight size={17}/></span>{"THERE’S ALWAYS ANOTHER WAY"}<span className="ticket-dots">•••</span></div><div className="ticket-before"><Search size={17}/><span>{"Too many open tabs"}</span><span className="ticket-x">×</span></div><div className="ticket-path"><span /><ArrowRight size={22}/><span /></div><div className="ticket-after"><span className="ticket-check"><Check size={16}/></span><strong>{"An answer and a next step"}</strong></div><div className="ticket-bottom">{"Search · Sources · Next steps"}<span>↗</span></div></div><div className="art-sticker"><ShieldCheck size={16}/><span>{"Backed by sources"}</span></div></div></section>

        <form className="composer" onSubmit={(event) => { event.preventDefault(); void run(); }}><div className="composer-top"><span className="composer-spark"><Sparkles size={18}/></span><span>{"What can we help with today?"}</span></div><textarea ref={textarea} value={message} onChange={(event) => setMessage(event.target.value)} placeholder={"What would you like to find out? Find a service, compare options, plan a trip or explore a complex topic…"} aria-label={"Describe your task"} maxLength={4000} rows={3} onKeyDown={(event) => { if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
                event.preventDefault();
                void run();
            } }}/><div className="composer-bottom"><div className="context-chips"><button type="button" className="context-chip" onClick={() => setModal("profile")}><Globe2 size={14}/><span>{"Search across the web"}</span><ChevronDown size={12}/></button>{profile.location && <button type="button" className="context-chip location-chip" onClick={() => setModal("profile")}><MapPin size={14}/><span>{profile.location}</span></button>}{profile.budget !== null && <button type="button" className="budget-chip" onClick={() => setModal("profile")}>€{profile.budget}</button>}</div><button className="primary-button submit-button" type="submit">{"Find an answer"}<ArrowUpRight size={18}/></button></div></form><div className="composer-footnote"><span><ShieldCheck size={14}/>{promise}</span><button onClick={() => setModal("profile")}><Settings2 size={13}/>{"Your constraints"}</button></div>
        
        <section className="examples-section"><div className="section-heading"><h2>{"Where should we start?"}</h2><span>{"Pick a starting point, or make it your own"}</span></div><div className="example-grid">{[Laptop, Printer, Headphones].map((Icon, index) => <button className={`example-card example-${index}`} onClick={() => selectExample(index)} key={index}><div className="example-card-top"><span className="example-icon"><Icon size={21} strokeWidth={1.65}/></span><ArrowUpRight size={17}/></div><span className="example-tag">{["WORK & EVERYDAY LIFE", "EVERYDAY ERRANDS", "SPACES"][index]}</span><h3>{["A desk for a few hours", "Paperwork, meet printer", "A little room for a big call"][index]}</h3><p>{["Find a computer and Wi-Fi nearby.", "Figure out where to print and scan your documents.", "Find a space where you can actually speak."][index]}</p></button>)}</div></section>
        <section className="why-section"><p className="eyebrow">{"LESS SEARCHING. MORE LIVING."}</p><div className="why-grid">{[["Look at the bigger picture", "Explore different ways to reach your goal within your constraints."], ["Read the fine print", "Check access, timing and cost against the sources."], ["Get the next step ready", "Bring together instructions, links and a request you can send."]].map(([title, text], index) => <div className="why-item" key={title}><span className="why-number">0{index + 1}</span><div><h3>{title}</h3><p>{text}</p></div></div>)}</div></section></>}

        {busy && <section className="progress-panel" aria-live="polite"><div className="progress-orbit"><span /><Search size={29}/></div><p className="eyebrow">{"EXA RESEARCH"}</p><h1>{"Putting your Plan B together"}</h1><p className="progress-description">{"Checking the options and the conditions that make them work."}</p><div className="request-preview">“{message}”</div><ol className="progress-list">{stages.map((item, index) => <li className={stages.indexOf(stage) > index ? "done" : item === stage ? "current" : ""} key={item}><span>{stages.indexOf(stage) > index ? <Check size={15}/> : item === stage ? <LoaderCircle size={16} className="spin"/> : index + 1}</span>{stageLabels[index]}</li>)}</ol>{liveSources.length > 0 && <div className="progress-source-count"><BookOpen size={14}/>{liveSources.length} {"sources found"}</div>}<button className="text-button" onClick={() => { abort.current?.abort(); setBusy(false); }}>{"Stop search"}<X size={14}/></button></section>}

        {plan && <div className="result" ref={resultRef}><div className="result-topline"><button className="text-button" onClick={reset}><ArrowLeft size={15}/>{"New task"}</button></div><div className="result-heading"><div className="hero-kicker"><span className="sparkle-badge"><Sparkles size={12}/></span>{"YOUR PLAN B"}</div><h1>{withoutCitations(plan.output.title)}</h1><p className="result-original">{plan.input.message}</p></div>
          <div className="result-columns"><div className="result-main"><section className="recommendation-card"><div className="recommendation-label"><CheckCircle2 size={18}/>{"Suggested option"}</div><p>{cited(plan.output.recommendation)}</p><div className="recommendation-facts"><div><span><Wallet size={14}/>{"Cost"}</span><p>{cited(plan.output.cost)}</p></div><div><span><KeyRound size={14}/>{"Details and requirements"}</span><p>{cited(plan.output.access_conditions)}</p></div></div></section>
          {!!plan.output.steps.length && <section className="steps-section"><div className="section-heading"><h2>{"Your next steps"}</h2><span>{completed.length}/{plan.output.steps.length} {"steps checked"}</span></div><div className="step-list">{plan.output.steps.map((step, index) => <div className={`step-item ${completed.includes(index) ? "completed" : ""}`} key={index}><button className="step-checkbox" onClick={() => setCompleted((old) => old.includes(index) ? old.filter((item) => item !== index) : [...old, index])} aria-label={`${index + 1}. ${withoutCitations(step)}`} aria-pressed={completed.includes(index)}>{completed.includes(index) ? <Check size={15}/> : index + 1}</button><p>{cited(step)}</p></div>)}</div></section>}
          {!!plan.output.alternatives.length && <section className="result-section"><h2><CornerUpRight size={18}/>{"A backup, just in case"}</h2>{plan.output.alternatives.map((item, index) => <p className="alternative-item" key={index}>{cited(item)}</p>)}</section>}{!!plan.output.exclusions.length && <details className="exclusions"><summary><CircleHelp size={16}/>{"Why other options don't fit"}<ChevronDown size={15}/></summary>{plan.output.exclusions.map((item, index) => <p key={index}>{cited(item)}</p>)}</details>}{!!plan.output.questions.length && <section className="questions-box"><h2><CircleHelp size={17}/>{"A few things to clarify"}</h2>{plan.output.questions.map((item, index) => <p key={index}>{cited(item)}</p>)}</section>}</div>
          <aside className="result-aside"><div className="action-card"><div className="action-icon"><ArrowUpRight size={24}/></div><h2>{"Your next step is ready"}</h2><p>{"Check the terms and complete the action with the provider. Nothing has been booked yet."}</p>{safeUrl(plan.output.action_url) && <a className="primary-button" href={safeUrl(plan.output.action_url)!} target="_blank" rel="noopener noreferrer">{"Open service website"}<ArrowUpRight size={17}/></a>}<button className="outline-button" onClick={() => download("planb.md", planMarkdown(plan), "text/markdown;charset=utf-8")}><Download size={16}/>{"Download plan"}</button>{!!plan.output.steps.length && <button className="outline-button" onClick={() => { try {
                if (!profile.deadline) {
                    setModal("profile");
                    setToast("Set a deadline for the calendar reminder.");
                    return;
                }
                download("planb-reminder.ics", planCalendar({ ...plan, input: { ...plan.input, profile } }), "text/calendar;charset=utf-8");
                setToast("A reminder one hour before the deadline, not a reservation.");
            }
            catch {
                setToast("Check the deadline in your constraints.");
            } }}><CalendarPlus size={16}/>{"Add to calendar"}</button>}{plan.output.draft_message && <button className="outline-button" onClick={() => setModal("draft")}><FileText size={16}/>{"A ready-to-review request"}</button>}<button className="text-button copy-plan" onClick={() => void copyText(planMarkdown(plan))}><Copy size={14}/>{"Copy"}</button></div><div className="safety-note"><ShieldCheck size={18}/><p>{promise}</p></div></aside></div>
          {!!plan.warnings.length && <div className="warnings-box"><AlertCircle size={18}/><div><strong>{"Before your next step"}</strong>{plan.warnings.map((warning, index) => <p key={index}>{warning}</p>)}</div></div>}{!!plan.sources.length && <section className="evidence-section"><div className="section-heading"><h2>{"The sources behind your plan"}<span className="count-pill">{plan.sources.length}</span></h2><BookOpen size={18}/></div><p className="section-subtitle">{"Citations link to evidence. A link alone does not guarantee a conclusion is correct."}</p>{sourceCards(plan.sources)}</section>}
          <section className="refine-box"><div><Sparkles size={19}/><h2>{"Something changed?"}</h2></div><p className="memory-hint">Your follow-up keeps recent task context and a summary of the previous answer.</p>{!!plan.input.conversation?.length && <details className="memory-details"><summary>Conversation context ({plan.input.conversation.length} messages)</summary>{plan.input.conversation.map((turn, index) => <div key={index}><strong>{turn.role === "user" ? "You" : "Plan B summary"}</strong><p>{turn.content}</p></div>)}</details>}<form onSubmit={(event) => { event.preventDefault(); if (followup.trim())
                void run(followup.trim(), continueConversation(plan)); }}><input value={followup} onChange={(event) => setFollowup(event.target.value)} placeholder={"For example: another city, a smaller budget, or compare two more options…"} aria-label={"Refine constraints"} maxLength={1000}/><button className="primary-button" disabled={!followup.trim()}>{"Update plan"}<ArrowRight size={16}/></button></form></section>
          <details className="search-details"><summary><Search size={15}/>{"Inside the search"}<span>{plan.metrics.calls} {"Exa requests"}</span><ChevronDown size={14}/></summary><div className="metrics-row"><span>{(plan.metrics.durationMs / 1000).toFixed(1)} {"sec"}</span><span>{plan.metrics.costDollars !== null ? `$${plan.metrics.costDollars.toFixed(4)} Exa` : "API cost not returned"}</span></div>{plan.trace.map((item, index) => <div className="trace-entry" key={index}><code>{item.endpoint}</code><span>{item.durationMs} ms</span>{item.query && <p>{item.query}</p>}{item.requestId && <small>Request: {item.requestId}</small>}</div>)}</details>
        </div>}
        {!!error && <div className="error-box" role="alert"><AlertCircle size={21}/><div><strong>{"Let's give the search another try"}</strong><p>{error}</p><button className="text-button" onClick={() => void run()}><RotateCcw size={14}/>{"Retry"}</button></div></div>}
        {!plan && !busy && !!error && liveSources.length > 0 && <section className="evidence-section"><div className="section-heading"><h2>{"Pages found"}</h2><BookOpen size={18}/></div><p className="section-subtitle">{"The answer could not be assembled, but you can open the retrieved sources directly."}</p>{sourceCards(liveSources)}</section>}
      </>}

      {view === "saved" && <section className="secondary-page"><div className="page-heading"><p className="hero-kicker"><Bookmark size={15}/>YOUR PERSONAL TOOLKIT</p><h1>{navLabels[1]}</h1><p>{"Only in this browser · last 12 plans"}</p></div>{history.length > 0 ? <><div className="history-grid">{history.map((item) => <article className="history-card" key={item.id}><div className="history-card-meta"><span className="saved-label">Saved plan</span><time>{new Date(item.createdAt).toLocaleDateString(lang, { timeZone: profile.timeZone })}</time></div><h2>{withoutCitations(item.output.title)}</h2><p>{item.input.message}</p><div className="history-card-bottom"><button className="text-button" onClick={() => openPlan(item)}>{"Open plan"}<ArrowUpRight size={15}/></button><button className="icon-button" aria-label={"Delete"} onClick={() => setHistory((old) => old.filter((p) => p.id !== item.id))}><Trash2 size={16}/></button></div></article>)}</div><button className="text-button clear-history" onClick={() => setHistory([])}><Trash2 size={14}/>{"Clear history"}</button></> : <div className="empty-state"><Bookmark size={35}/><h2>{"Your first plan is waiting"}</h2><p>{"Your plans are saved only in this browser. Download a copy to keep or share."}</p><button className="primary-button" onClick={reset}>{navLabels[0]}<Plus size={16}/></button></div>}</section>}

      {view === "sources" && <section className="secondary-page"><div className="page-heading"><p className="hero-kicker"><ShieldCheck size={15}/>EVIDENCE, NOT GUESSWORK</p><h1>{"Where the answers come from"}</h1><p>{plan?.sources.length ? "Sources from your last opened plan." : "Every search finds sources for your question. Their links and short excerpts will appear here."}</p></div>{allSources.length ? sourceCards(allSources) : <div className="empty-state"><BookOpen size={35}/><h2>Your evidence starts here</h2><p>Run a search to discover sources for your question.</p><button className="primary-button" onClick={reset}>Start a search<ArrowUpRight size={17}/></button></div>}</section>}

      {view === "about" && <section className="secondary-page about-page"><div className="page-heading"><p className="hero-kicker"><Sparkles size={15}/>A LITTLE HELP GOES A LONG WAY</p><h1>{"From a small crisis to a next step"}</h1><p>{"Plan B researches questions and helps solve tasks using web sources. Add a location, budget or deadline only when relevant."}</p></div><div className="about-flow">{[Search, BookOpen, ArrowUpRight].map((Icon, index) => <article key={index}><span className="about-icon"><Icon size={23}/></span><small>0{index + 1}</small><h2>{["Explore the options", "Check the fine print", "Prepare your next step"][index]}</h2><p>{["Search across the web and compare different sources and options.", "Read pages, compare restrictions and show the sources.", "Prepare steps, official links, a request and a reminder."][index]}</p></article>)}</div><div className="about-notes"><article><ShieldCheck size={22}/><h2>{"What you confirm"}</h2><p>{"The provider confirms available slots, current prices and final bookings. The app does not send emails, make payments or book on your behalf."}</p></article><article><KeyRound size={22}/><h2>{"Your data"}</h2><p>{"Your recent plans stay in this browser. Requests and relevant search context are sent to Exa to research your task. You can clear your history at any time."}</p></article></div><button className="primary-button" onClick={reset}>{navLabels[0]}<ArrowUpRight size={17}/></button></section>}
      <footer className="footer"><span><span className="footer-mark">↱</span>{"For questions, research & everyday tasks"}</span><a href="https://exa.ai" target="_blank" rel="noopener noreferrer">Search & research powered by Exa<ArrowUpRight size={12}/></a></footer>
    </main></div>


    {modal === "profile" && <Modal title={"Search context"} close={() => setModal(null)}><p className="modal-intro">{"Every field is optional. You can search the web by simply asking a question."}</p><div className="profile-fields"><label className="field-label" htmlFor="location">{"Location, if relevant"}</label><input className="text-input" id="location" placeholder={"City or country — leave blank if not relevant"} value={profile.location} maxLength={160} onChange={(event) => setProfile((old) => ({ ...old, location: event.target.value }))}/><div className="field-grid"><div><label className="field-label" htmlFor="budget">{"Budget, if relevant"}, €</label><input className="text-input" id="budget" type="number" min="0" max="1000000000" placeholder={"Not specified"} value={profile.budget ?? ""} onChange={(event) => setProfile((old) => ({ ...old, budget: event.target.value === "" ? null : Number(event.target.value) }))}/></div><div><label className="field-label" htmlFor="deadline">{"Deadline, if relevant"}</label><input className="text-input" id="deadline" type="datetime-local" value={profile.deadline} onChange={(event) => setProfile((old) => ({ ...old, deadline: event.target.value }))}/></div></div>{profile.deadline && <><label className="field-label" htmlFor="time-zone">{"Time zone"}</label><input className="text-input" id="time-zone" value={profile.timeZone} placeholder="Europe/Tallinn" onChange={(event) => setProfile((old) => ({ ...old, timeZone: event.target.value }))}/></>}<label className="check-field deep-field"><input type="checkbox" checked={profile.deepSearch} onChange={(event) => setProfile((old) => ({ ...old, deepSearch: event.target.checked }))}/><span>{"Deep research"}<small>{"Explore more sources and compare the details."}</small></span></label></div><button className="primary-button full-width" onClick={() => setModal(null)}>{"Done"}<Check size={17}/></button></Modal>}

    {modal === "draft" && plan && <Modal title={"A ready-to-review request"} close={() => setModal(null)}><p className="modal-intro">{"Review the text, find the recipient on the official website and send it yourself."}</p><textarea className="draft-textarea" rows={11} value={plan.output.draft_message} onChange={(event) => setPlan((old) => old ? { ...old, output: { ...old.output, draft_message: event.target.value } } : old)} aria-label="Email draft"/><div className="draft-actions"><button className="outline-button" onClick={() => void copyText(plan.output.draft_message)}><Copy size={15}/>{"Copy"}</button><button className="primary-button" onClick={() => download("planb-request.eml", `Subject: Research and service enquiry\r\nMIME-Version: 1.0\r\nContent-Type: text/plain; charset=UTF-8\r\nContent-Transfer-Encoding: 8bit\r\n\r\n${plan.output.draft_message.replace(/\r?\n/g, "\r\n")}`, "message/rfc822")}><Download size={15}/>{"Download email"}</button></div></Modal>}
    {toast && <div className="toast" role="status"><CheckCircle2 size={17}/>{toast}</div>}
  </div>;
}
