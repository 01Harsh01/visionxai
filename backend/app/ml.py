"""Lazy-loaded, cached model services with memory and resolution optimization for free tier hosting. GPU if available, else CPU."""
import io, os, gc, numpy as np, torch
from PIL import Image

dev = "cuda" if torch.cuda.is_available() else "cpu"
_c: dict = {}

def _free_others(keep_key: str):
    """Evict other models from memory to avoid hitting the 512MB RAM limit on Render."""
    for k in list(_c.keys()):
        if k != keep_key:
            del _c[k]
    gc.collect()
    if torch.cuda.is_available():
        torch.cuda.empty_cache()

def _get(k, f):
    if k not in _c:
        _free_others(k)
        _c[k] = f()
    return _c[k]

def load(b: bytes) -> Image.Image:
    Image.open(io.BytesIO(b)).verify()          # raises on corrupt files
    return Image.open(io.BytesIO(b)).convert("RGB")

def _yolo_model():
    from ultralytics import YOLO
    candidates = [
        os.path.join(os.path.dirname(__file__), "yolov8n.pt"),
        os.path.join(os.getcwd(), "yolov8n.pt"),
        "yolov8n.pt",
    ]
    for c in candidates:
        if os.path.exists(c):
            return YOLO(c)
    return YOLO("yolov8n.pt")

def detect(im: Image.Image, conf=0.25):
    w, h = im.size
    max_dim = 1024
    scale = 1.0
    im_infer = im
    if max(w, h) > max_dim:
        scale = max_dim / max(w, h)
        im_infer = im.resize((int(w * scale), int(h * scale)), Image.Resampling.LANCZOS)
    
    y = _get("yolo", _yolo_model)
    r = y(im_infer, conf=conf, verbose=False)[0]
    boxes = []
    for b in r.boxes:
        xyxy = [round(float(v) / scale, 1) for v in b.xyxy[0]]
        boxes.append({
            "label": r.names[int(b.cls)],
            "confidence": round(float(b.conf), 3),
            "box": xyxy,
        })
    return boxes

def caption(im: Image.Image):
    from transformers import BlipProcessor, BlipForConditionalGeneration as M
    n = "Salesforce/blip-image-captioning-base"
    p, m = _get("cap", lambda: (
        BlipProcessor.from_pretrained(n),
        M.from_pretrained(n, low_cpu_mem_usage=True).to(dev).eval()
    ))
    w, h = im.size
    if max(w, h) > 768:
        scale = 768 / max(w, h)
        im = im.resize((int(w * scale), int(h * scale)), Image.Resampling.LANCZOS)
    with torch.no_grad():
        inputs = p(im, return_tensors="pt").to(dev)
        o = m.generate(**inputs, max_new_tokens=40)
    return p.decode(o[0], skip_special_tokens=True)

def vqa(im: Image.Image, q: str):
    from transformers import BlipProcessor, BlipForQuestionAnswering as M
    n = "Salesforce/blip-vqa-base"
    p, m = _get("vqa", lambda: (
        BlipProcessor.from_pretrained(n),
        M.from_pretrained(n, low_cpu_mem_usage=True).to(dev).eval()
    ))
    w, h = im.size
    if max(w, h) > 768:
        scale = 768 / max(w, h)
        im = im.resize((int(w * scale), int(h * scale)), Image.Resampling.LANCZOS)
    with torch.no_grad():
        inputs = p(im, q, return_tensors="pt").to(dev)
        o = m.generate(**inputs, max_new_tokens=30)
    return p.decode(o[0], skip_special_tokens=True)

def ocr(im: Image.Image):
    import easyocr
    w, h = im.size
    max_dim = 1200
    if max(w, h) > max_dim:
        scale = max_dim / max(w, h)
        im = im.resize((int(w * scale), int(h * scale)), Image.Resampling.LANCZOS)
    rd = _get("ocr", lambda: easyocr.Reader(["en"], gpu=dev == "cuda"))
    return [{"text": t, "confidence": round(float(c), 3)} for _, t, c in rd.readtext(np.array(im))]

def _clip():
    from transformers import CLIPModel, CLIPProcessor
    n = "openai/clip-vit-base-patch32"
    p = CLIPProcessor.from_pretrained(n)
    m = CLIPModel.from_pretrained(n, low_cpu_mem_usage=True).to(dev).eval()
    return p, m

def _norm(t):
    if hasattr(t, "pooler_output"):
        t = t.pooler_output
    elif hasattr(t, "last_hidden_state"):
        t = t.last_hidden_state
    return (t / t.norm(dim=-1, keepdim=True))[0].cpu().tolist()

def embed_image(im: Image.Image):
    p, m = _get("clip", _clip)
    w, h = im.size
    if max(w, h) > 512:
        scale = 512 / max(w, h)
        im = im.resize((int(w * scale), int(h * scale)), Image.Resampling.LANCZOS)
    with torch.no_grad():
        return _norm(m.get_image_features(**p(images=im, return_tensors="pt").to(dev)))

def embed_text(t: str):
    p, m = _get("clip", _clip)
    with torch.no_grad():
        return _norm(m.get_text_features(**p(text=[t], return_tensors="pt", padding=True).to(dev)))
