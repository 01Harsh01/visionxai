import os, time, uuid, datetime as dt, logging
from dotenv import load_dotenv
load_dotenv()
load_dotenv(os.path.join(os.path.dirname(__file__), "..", "..", ".env"))
import bcrypt, jwt, numpy as np
from fastapi import FastAPI, Depends, HTTPException, UploadFile, File, Form, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from pydantic import BaseModel, EmailStr
from sqlalchemy import create_engine, Column, Integer, String, Float, ForeignKey, DateTime, JSON, func
from sqlalchemy.orm import sessionmaker, declarative_base, Session
from . import ml

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s %(message)s")
log = logging.getLogger("visionx")
SECRET = os.getenv("JWT_SECRET", "change-me")
DB = os.getenv("DATABASE_URL", "sqlite:///./visionx.db")
if DB.startswith("postgres://"):
    DB = DB.replace("postgres://", "postgresql://", 1)
UPLOADS = os.getenv("UPLOAD_DIR", "./uploads"); os.makedirs(UPLOADS, exist_ok=True)
MAX_MB = int(os.getenv("MAX_UPLOAD_MB", 10))
raw_origins = os.getenv("CORS_ORIGINS", "http://localhost:3000,http://localhost:5173,*")
ORIGINS = ["*"] if "*" in raw_origins else [o.strip() for o in raw_origins.split(",") if o.strip()]

engine = create_engine(DB, pool_pre_ping=True)
Session_ = sessionmaker(bind=engine); Base = declarative_base()

class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True); email = Column(String, unique=True, index=True); pw = Column(String)
class Img(Base):
    __tablename__ = "uploaded_images"
    id = Column(Integer, primary_key=True); user_id = Column(ForeignKey("users.id"), index=True)
    name = Column(String); path = Column(String); w = Column(Integer); h = Column(Integer)
    embedding = Column(JSON); created = Column(DateTime, default=dt.datetime.utcnow)
class Analysis(Base):
    __tablename__ = "image_analyses"
    id = Column(Integer, primary_key=True); user_id = Column(ForeignKey("users.id"), index=True)
    image_id = Column(ForeignKey("uploaded_images.id", ondelete="CASCADE"), index=True)
    kind = Column(String, index=True); query = Column(String); result = Column(JSON)
    latency_ms = Column(Float); created = Column(DateTime, default=dt.datetime.utcnow)
Base.metadata.create_all(engine)

app = FastAPI(title="VisionX AI")
app.add_middleware(CORSMiddleware, allow_origins=ORIGINS, allow_methods=["*"], allow_headers=["*"])

def db():
    s = Session_()
    try: yield s
    finally: s.close()

def tok(uid): return jwt.encode({"sub": str(uid), "exp": dt.datetime.utcnow() + dt.timedelta(hours=12)}, SECRET, "HS256")
def user_from(token: str, s: Session) -> User:
    try: uid = int(jwt.decode(token, SECRET, ["HS256"])["sub"])
    except Exception: raise HTTPException(401, "Invalid or expired token")
    u = s.get(User, uid)
    if not u: raise HTTPException(401, "User not found")
    return u
from fastapi import Header
def current(authorization: str = Header(None), token: str = Query(None), s: Session = Depends(db)) -> User:
    t = token or (authorization or "").removeprefix("Bearer ").strip()
    return user_from(t, s)

class Cred(BaseModel):
    email: EmailStr; password: str

@app.get("/health")
def health(): return {"status": "ok", "device": ml.dev}

@app.post("/api/auth/register")
def register(c: Cred, s: Session = Depends(db)):
    if len(c.password) < 8: raise HTTPException(422, "Password must be at least 8 characters")
    if s.query(User).filter_by(email=c.email.lower()).first(): raise HTTPException(409, "Email already registered")
    u = User(email=c.email.lower(), pw=bcrypt.hashpw(c.password.encode(), bcrypt.gensalt()).decode())
    s.add(u); s.commit(); return {"access_token": tok(u.id)}

@app.post("/api/auth/login")
def login(c: Cred, s: Session = Depends(db)):
    u = s.query(User).filter_by(email=c.email.lower()).first()
    if not u or not bcrypt.checkpw(c.password.encode(), u.pw.encode()): raise HTTPException(401, "Invalid credentials")
    return {"access_token": tok(u.id)}

@app.get("/api/users/me")
def profile(u: User = Depends(current)): return {"id": u.id, "email": u.email}

def img_out(i): return {"id": i.id, "name": i.name, "w": i.w, "h": i.h, "created": i.created}

@app.post("/api/images/upload")
def upload(file: UploadFile = File(...), u: User = Depends(current), s: Session = Depends(db)):
    if file.content_type not in ("image/jpeg", "image/png", "image/webp"): raise HTTPException(415, "Only JPG, PNG, WEBP allowed")
    b = file.file.read()
    if len(b) > MAX_MB * 1024 * 1024: raise HTTPException(413, f"Max {MAX_MB}MB")
    try: im = ml.load(b)
    except Exception: raise HTTPException(422, "Corrupt or unreadable image")
    path = os.path.join(UPLOADS, f"{uuid.uuid4().hex}.png"); im.save(path)
    i = Img(user_id=u.id, name=file.filename, path=path, w=im.width, h=im.height, embedding=ml.embed_image(im))
    s.add(i); s.commit(); return img_out(i)

@app.get("/api/images")
def images(u: User = Depends(current), s: Session = Depends(db)):
    return [img_out(i) for i in s.query(Img).filter_by(user_id=u.id).order_by(Img.id.desc())]

def owned(s, u, iid):
    i = s.get(Img, iid)
    if not i or i.user_id != u.id: raise HTTPException(404, "Image not found")
    return i

@app.get("/api/images/{iid}/file")
def file(iid: int, u: User = Depends(current), s: Session = Depends(db)): return FileResponse(owned(s, u, iid).path)

@app.delete("/api/images/{iid}")
def del_img(iid: int, u: User = Depends(current), s: Session = Depends(db)):
    i = owned(s, u, iid); s.query(Analysis).filter_by(image_id=iid).delete()
    try: os.remove(i.path)
    except OSError: pass
    s.delete(i); s.commit(); return {"ok": True}

class Req(BaseModel):
    image_id: int; question: str | None = None; confidence: float = 0.25

@app.post("/api/analyze/{kind}")
def analyze(kind: str, r: Req, u: User = Depends(current), s: Session = Depends(db)):
    i = owned(s, u, r.image_id)
    from PIL import Image
    im = Image.open(i.path).convert("RGB"); t = time.perf_counter()
    try:
        if kind == "detect": res = ml.detect(im, r.confidence)
        elif kind == "caption": res = ml.caption(im)
        elif kind == "ocr": res = ml.ocr(im)
        elif kind == "vqa":
            if not r.question: raise HTTPException(422, "question required")
            res = ml.vqa(im, r.question)
        else: raise HTTPException(404, "Unknown analysis")
    except HTTPException: raise
    except Exception as e:
        log.exception("inference failed"); raise HTTPException(500, f"Model error: {e}")
    ms = round((time.perf_counter() - t) * 1000, 1)
    a = Analysis(user_id=u.id, image_id=i.id, kind=kind, query=r.question, result={"data": res}, latency_ms=ms)
    s.add(a); s.commit(); return {"id": a.id, "kind": kind, "result": res, "latency_ms": ms}

class SearchReq(BaseModel):
    query: str; top_k: int = 12

@app.post("/api/search/semantic")
def search(r: SearchReq, u: User = Depends(current), s: Session = Depends(db)):
    rows = s.query(Img).filter_by(user_id=u.id).all()
    if not rows: return []
    q = np.array(ml.embed_text(r.query)); M = np.array([i.embedding for i in rows])
    sc = M @ q
    return [{**img_out(rows[k]), "score": round(float(sc[k]), 4)} for k in np.argsort(-sc)[: r.top_k]]

@app.get("/api/history")
def history(kind: str | None = None, u: User = Depends(current), s: Session = Depends(db)):
    q = s.query(Analysis).filter_by(user_id=u.id)
    if kind: q = q.filter_by(kind=kind)
    return [{"id": a.id, "image_id": a.image_id, "kind": a.kind, "query": a.query, "result": a.result["data"],
             "latency_ms": a.latency_ms, "created": a.created} for a in q.order_by(Analysis.id.desc()).limit(200)]

@app.delete("/api/history/{aid}")
def del_hist(aid: int, u: User = Depends(current), s: Session = Depends(db)):
    a = s.get(Analysis, aid)
    if not a or a.user_id != u.id: raise HTTPException(404, "Not found")
    s.delete(a); s.commit(); return {"ok": True}

@app.get("/api/stats")
def stats(u: User = Depends(current), s: Session = Depends(db)):
    by = dict(s.query(Analysis.kind, func.count()).filter_by(user_id=u.id).group_by(Analysis.kind).all())
    return {"images": s.query(Img).filter_by(user_id=u.id).count(), "by_kind": by,
            "avg_latency": {k: round(v, 1) for k, v in s.query(Analysis.kind, func.avg(Analysis.latency_ms)).filter_by(user_id=u.id).group_by(Analysis.kind).all()}}

# Serve built frontend in unified deployment mode (e.g. Hugging Face Spaces)
static_dir = os.path.join(os.path.dirname(__file__), "..", "static")
if not os.path.exists(static_dir):
    static_dir = os.path.join(os.path.dirname(__file__), "..", "..", "frontend", "dist")

if os.path.exists(static_dir):
    from fastapi.staticfiles import StaticFiles
    assets_dir = os.path.join(static_dir, "assets")
    if os.path.exists(assets_dir):
        app.mount("/assets", StaticFiles(directory=assets_dir), name="assets")

    @app.get("/{full_path:path}")
    async def serve_frontend(full_path: str):
        file_path = os.path.join(static_dir, full_path)
        if full_path and os.path.isfile(file_path):
            return FileResponse(file_path)
        return FileResponse(os.path.join(static_dir, "index.html"))

