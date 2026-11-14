import { useEffect, useRef, useState } from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { LayoutDashboard, ScanSearch, MessageSquare, Search, History, Menu, LogOut, Upload, Trash2, X } from "lucide-react";
import { api, errMsg, getToken, imgUrl, setToken, Img } from "./api";

function Auth({ done }: { done: () => void }) {
  const [reg, setReg] = useState(false);
  const [email, setE] = useState("");
  const [pw, setP] = useState("");
  const [err, setErr] = useState("");
  const [busy, setB] = useState(false);

  const go = async () => {
    if (!email.trim() || !pw.trim()) {
      setErr("Please enter both email and password.");
      return;
    }
    setB(true);
    setErr("");
    try {
      const r = await api.post(`/auth/${reg ? "register" : "login"}`, { email: email.trim(), password: pw });
      if (r.data?.access_token) {
        setToken(r.data.access_token);
        done();
      } else {
        setErr("No token received from server");
      }
    } catch (e) {
      setErr(errMsg(e));
    }
    setB(false);
  };

  return (
    <div className="min-h-screen grid place-items-center p-4">
      <div className="card w-full max-w-sm space-y-3">
        <h1 className="text-2xl font-bold">Vision<span className="text-brand">X</span> AI</h1>
        <input className="inp" placeholder="Email" value={email} onChange={(e) => setE(e.target.value)} />
        <input className="inp" type="password" placeholder="Password (8+ chars)" value={pw} onChange={(e) => setP(e.target.value)} onKeyDown={(e) => e.key === "Enter" && go()} />
        {err && <p className="text-red-400 text-sm leading-relaxed">{err}</p>}
        <button className="btn btn-p w-full" disabled={busy} onClick={go}>
          {busy ? "Please wait…" : reg ? "Create account" : "Sign in"}
        </button>
        <button className="text-sm text-slate-400 w-full" onClick={() => { setReg(!reg); setErr(""); }}>
          {reg ? "Have an account? Sign in" : "New here? Register"}
        </button>
      </div>
    </div>
  );
}

function Picker({ sel, setSel }: { sel?: Img; setSel: (i?: Img) => void }) {
  const [list, setList] = useState<Img[]>([]);
  const [err, setErr] = useState("");
  const [busy, setB] = useState(false);
  const ref = useRef<HTMLInputElement>(null);

  const load = () =>
    api.get("/images")
      .then((r) => {
        if (Array.isArray(r.data)) {
          setList(r.data);
          if (!sel && r.data[0]) setSel(r.data[0]);
        }
      })
      .catch((e) => setErr(errMsg(e)));

  useEffect(() => { load(); }, []);

  const up = async (f?: File) => {
    if (!f) return;
    setB(true);
    setErr("");
    const fd = new FormData();
    fd.append("file", f);
    try {
      const r = await api.post("/images/upload", fd);
      await load();
      setSel(r.data);
    } catch (e) {
      setErr(errMsg(e));
    }
    setB(false);
  };

  const rm = async (i: Img) => {
    try {
      await api.delete(`/images/${i.id}`);
      if (sel?.id === i.id) setSel(undefined);
      load();
    } catch (e) {
      setErr(errMsg(e));
    }
  };

  return (
    <div className="space-y-3">
      <div
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => { e.preventDefault(); up(e.dataTransfer.files[0]); }}
        onClick={() => ref.current?.click()}
        className="border-2 border-dashed border-slate-600 rounded-xl p-6 text-center cursor-pointer hover:border-brand"
      >
        <Upload className="mx-auto mb-2" />
        {busy ? "Uploading & embedding…" : "Drop an image or tap to upload (JPG/PNG/WEBP)"}
        <input ref={ref} type="file" hidden accept="image/jpeg,image/png,image/webp" onChange={(e) => up(e.target.files?.[0])} />
      </div>
      {err && <p className="text-red-400 text-sm">{err}</p>}
      <div className="flex gap-2 overflow-x-auto pb-1">
        {list.map((i) => (
          <div key={i.id} className="relative shrink-0">
            <img
              src={imgUrl(i.id)}
              onClick={() => setSel(i)}
              className={`h-16 w-16 object-cover rounded-lg cursor-pointer ${sel?.id === i.id ? "ring-2 ring-brand" : ""}`}
            />
            <button onClick={() => rm(i)} className="absolute -top-1 -right-1 bg-red-500 rounded-full p-0.5">
              <X size={12} />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

function Dashboard() {
  const [s, setS] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  useEffect(() => {
    let active = true;
    api.get("/stats")
      .then((r) => {
        if (!active) return;
        if (r.data && typeof r.data === "object" && !r.data.detail) {
          setS(r.data);
        } else {
          setErr("Unable to load statistics.");
        }
      })
      .catch((e) => {
        if (!active) return;
        setErr(errMsg(e));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, []);

  if (loading) return <p className="text-slate-400">Loading statistics…</p>;

  if (err) {
    return (
      <div className="card space-y-2">
        <h2 className="font-semibold text-red-400">Dashboard status</h2>
        <p className="text-slate-300 text-sm">{err}</p>
      </div>
    );
  }

  const byKind = (s && typeof s.by_kind === "object" && s.by_kind) ? s.by_kind : {};
  const avgLat = (s && typeof s.avg_latency === "object" && s.avg_latency) ? s.avg_latency : {};
  const data = Object.entries(byKind).map(([k, v]) => ({ k, count: Number(v) || 0, ms: (avgLat as any)[k] ?? 0 }));

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <div className="card">
        <h2 className="font-semibold mb-2">Totals</h2>
        <p className="text-4xl font-bold">{s?.images ?? 0}</p>
        <p className="text-slate-400 text-sm">images uploaded</p>
      </div>
      <div className="card">
        <h2 className="font-semibold mb-2">Analyses by model</h2>
        {data.length ? (
          <div className="h-48 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data}>
                <XAxis dataKey="k" stroke="#94a3b8" />
                <YAxis stroke="#94a3b8" />
                <Tooltip />
                <Bar dataKey="count" fill="#5b7cff" radius={6} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <p className="text-slate-400 text-sm">No analyses yet.</p>
        )}
      </div>
      <div className="card md:col-span-2">
        <h2 className="font-semibold mb-2">Average latency (ms)</h2>
        {data.map((d) => (
          <p key={d.k} className="text-sm">{d.k}: <b>{d.ms}</b></p>
        ))}
      </div>
    </div>
  );
}

function Analyze() {
  const [sel, setSel] = useState<Img>();
  const [out, setOut] = useState<any>();
  const [busy, setB] = useState("");
  const [err, setErr] = useState("");

  const run = async (kind: string) => {
    if (!sel) return;
    setB(kind);
    setErr("");
    try {
      const r = await api.post(`/analyze/${kind}`, { image_id: sel.id });
      setOut(r.data);
    } catch (e) {
      setErr(errMsg(e));
    }
    setB("");
  };

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <div className="card space-y-3">
        <Picker sel={sel} setSel={setSel} />
        <div className="flex flex-wrap gap-2">
          {["detect", "caption", "ocr"].map((k) => (
            <button key={k} disabled={!sel || !!busy} className="btn btn-p" onClick={() => run(k)}>
              {busy === k ? "Running…" : k === "detect" ? "Detect objects" : k === "caption" ? "Caption" : "Extract text"}
            </button>
          ))}
        </div>
        {sel && (
          <div className="relative">
            <img src={imgUrl(sel.id)} className="w-full rounded-xl" />
            {out?.kind === "detect" && Array.isArray(out.result) && out.result.map((d: any, n: number) => (
              <div
                key={n}
                className="absolute border-2 border-fuchsia-400 text-[10px]"
                style={{
                  left: `${(d.box[0] / sel.w) * 100}%`,
                  top: `${(d.box[1] / sel.h) * 100}%`,
                  width: `${((d.box[2] - d.box[0]) / sel.w) * 100}%`,
                  height: `${((d.box[3] - d.box[1]) / sel.h) * 100}%`,
                }}
              >
                <span className="bg-fuchsia-500 px-1">{d.label} {(d.confidence * 100) | 0}%</span>
              </div>
            ))}
          </div>
        )}
      </div>
      <div className="card">
        <h2 className="font-semibold mb-2">Results</h2>
        {busy && (
          <div className="p-3 bg-slate-800/80 rounded-xl mb-3 flex items-center gap-2 text-sm text-indigo-300">
            <span className="inline-block animate-spin mr-1">⚙️</span>
            <span>Running {busy === "detect" ? "YOLOv8 Detection" : busy === "caption" ? "BLIP Caption" : "EasyOCR Text Extractor"}… please wait…</span>
          </div>
        )}
        {err && <p className="text-red-400 text-sm leading-relaxed mb-2">{err}</p>}
        {!out && !err && !busy && <p className="text-slate-400 text-sm">Select an image and run an analysis.</p>}
        {out && (
          <>
            <p className="text-xs text-slate-400 mb-2">{out.latency_ms} ms</p>
            {out.kind === "caption" && <p>{out.result}</p>}
            {out.kind === "detect" && (
              <ul className="text-sm space-y-1">
                {Array.isArray(out.result) && out.result.map((d: any, n: number) => (
                  <li key={n}>{d.label} — {(d.confidence * 100).toFixed(1)}%</li>
                ))}
                {(!out.result || !out.result.length) && <li>No objects found.</li>}
              </ul>
            )}
            {out.kind === "ocr" && (
              <>
                <pre className="whitespace-pre-wrap text-sm">
                  {Array.isArray(out.result) ? out.result.map((r: any) => r.text).join("\n") || "No text found." : "No text found."}
                </pre>
                <button
                  className="btn mt-2"
                  onClick={() => navigator.clipboard.writeText(Array.isArray(out.result) ? out.result.map((r: any) => r.text).join("\n") : "")}
                >
                  Copy
                </button>
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function Chat() {
  const [sel, setSel] = useState<Img>();
  const [q, setQ] = useState("");
  const [msgs, setM] = useState<{ r: string; t: string }[]>([]);
  const [busy, setB] = useState(false);

  const ask = async () => {
    if (!sel || !q.trim()) return;
    const text = q.trim();
    setQ("");
    setM((m) => [...m, { r: "u", t: text }]);
    setB(true);
    try {
      const r = await api.post("/analyze/vqa", { image_id: sel.id, question: text });
      setM((m) => [...m, { r: "a", t: r.data?.result || "No answer received" }]);
    } catch (e) {
      setM((m) => [...m, { r: "a", t: "Error: " + errMsg(e) }]);
    }
    setB(false);
  };

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <div className="card">
        <Picker sel={sel} setSel={setSel} />
        {sel && <img src={imgUrl(sel.id)} className="w-full rounded-xl mt-3" />}
      </div>
      <div className="card flex flex-col min-h-[320px]">
        <div className="flex-1 space-y-2 overflow-y-auto max-h-[60vh]">
          {msgs.map((m, i) => (
            <p key={i} className={`rounded-xl px-3 py-2 text-sm max-w-[85%] ${m.r === "u" ? "bg-brand ml-auto" : "bg-slate-700"}`}>
              {m.t}
            </p>
          ))}
          {busy && <p className="text-slate-400 text-sm">Thinking…</p>}
        </div>
        <div className="flex gap-2 mt-3">
          <input className="inp" value={q} placeholder="Ask about the image…" onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.key === "Enter" && ask()} />
          <button className="btn btn-p" disabled={!sel || busy} onClick={ask}>Ask</button>
        </div>
      </div>
    </div>
  );
}

function SearchPage() {
  const [q, setQ] = useState("");
  const [res, setR] = useState<Img[]>();
  const [busy, setB] = useState(false);

  const go = async () => {
    if (!q.trim()) return;
    setB(true);
    try {
      const r = await api.post("/search/semantic", { query: q.trim() });
      setR(Array.isArray(r.data) ? r.data : []);
    } catch (e) {
      setR([]);
    }
    setB(false);
  };

  return (
    <div className="space-y-4">
      <div className="card flex gap-2">
        <input className="inp" placeholder="A person riding a bicycle near a mountain" value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.key === "Enter" && go()} />
        <button className="btn btn-p" onClick={go} disabled={busy || !q.trim()}>Search</button>
      </div>
      {res && !res.length && <p className="text-slate-700">No images matched your query. Upload images first.</p>}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {res?.map((i) => (
          <div key={i.id} className="card !p-2">
            <img src={imgUrl(i.id)} className="rounded-lg aspect-square object-cover w-full" />
            <p className="text-xs mt-1">Similarity {i.score?.toFixed(3)}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function Hist() {
  const [rows, setR] = useState<any[]>([]);
  const [k, setK] = useState("");

  const load = () => {
    api.get("/history", { params: k ? { kind: k } : {} })
      .then((r) => {
        if (Array.isArray(r.data)) setR(r.data);
      })
      .catch(() => {});
  };

  useEffect(() => { load(); }, [k]);

  return (
    <div className="space-y-3">
      <select className="inp max-w-xs" value={k} onChange={(e) => setK(e.target.value)}>
        <option value="">All types</option>
        {["detect", "caption", "ocr", "vqa"].map((x) => <option key={x} value={x}>{x}</option>)}
      </select>
      {rows.map((r) => (
        <div key={r.id} className="card flex gap-3 items-start">
          <img src={imgUrl(r.image_id)} className="h-16 w-16 rounded-lg object-cover" />
          <div className="flex-1 min-w-0 text-sm">
            <b>{r.kind}</b> · {r.latency_ms} ms {r.query && <i>"{r.query}"</i>}
            <p className="truncate text-slate-300">{JSON.stringify(r.result)}</p>
          </div>
          <button onClick={async () => { await api.delete(`/history/${r.id}`); load(); }}>
            <Trash2 size={18} />
          </button>
        </div>
      ))}
      {!rows.length && <p className="text-slate-700">No history yet.</p>}
    </div>
  );
}

const NAV = [
  ["Dashboard", LayoutDashboard, Dashboard],
  ["Analyze", ScanSearch, Analyze],
  ["Visual Chat", MessageSquare, Chat],
  ["Search", Search, SearchPage],
  ["History", History, Hist],
] as const;

export default function App() {
  const [authed, setA] = useState(!!getToken());
  const [page, setP] = useState(0);
  const [open, setO] = useState(false);

  useEffect(() => {
    if (!getToken() && authed) {
      setA(false);
    }
  }, [authed]);

  if (!authed) return <Auth done={() => setA(true)} />;

  const Page = NAV[page][2];

  return (
    <div className="min-h-screen flex">
      <aside className={`fixed lg:static z-20 inset-y-0 left-0 w-60 bg-lav/95 lg:bg-transparent text-slate-900 p-4 space-y-1 transition-transform ${open ? "" : "-translate-x-full lg:translate-x-0"} shadow-xl lg:shadow-none`}>
        <h1 className="text-xl font-bold mb-4">Vision<span className="text-brand">X</span> AI</h1>
        {NAV.map(([n, Icon], i) => (
          <button
            key={n}
            onClick={() => { setP(i); setO(false); }}
            className={`flex items-center gap-3 w-full px-3 py-3 rounded-xl text-left ${page === i ? "bg-brand text-white" : "hover:bg-white/40"}`}
          >
            <Icon size={18} />
            {n}
          </button>
        ))}
        <button
          onClick={() => {
            setToken(null);
            setA(false);
          }}
          className="flex items-center gap-3 w-full px-3 py-3 rounded-xl hover:bg-white/40"
        >
          <LogOut size={18} />
          Logout
        </button>
      </aside>
      <main className="flex-1 min-w-0 p-3 sm:p-6 text-slate-900">
        <button className="lg:hidden mb-3 btn !bg-navy text-white" onClick={() => setO(!open)}>
          <Menu size={18} />
        </button>
        <h2 className="text-2xl font-bold mb-4">{NAV[page][0]}</h2>
        <div className="text-slate-100">
          <Page />
        </div>
      </main>
    </div>
  );
}
