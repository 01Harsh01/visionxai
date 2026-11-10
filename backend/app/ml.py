"""Lazy-loaded, cached model services. GPU if available, else CPU."""
import io, numpy as np, torch
from PIL import Image

dev = "cuda" if torch.cuda.is_available() else "cpu"
_c: dict = {}
def _get(k, f):
    if k not in _c: _c[k] = f()
    return _c[k]

def load(b: bytes) -> Image.Image:
    Image.open(io.BytesIO(b)).verify()          # raises on corrupt files
    return Image.open(io.BytesIO(b)).convert("RGB")

def caption(im):
    from transformers import BlipProcessor, BlipForConditionalGeneration as M
    n = "Salesforce/blip-image-captioning-base"
    p, m = _get("cap", lambda: (BlipProcessor.from_pretrained(n), M.from_pretrained(n).to(dev).eval()))
    with torch.no_grad(): o = m.generate(**p(im, return_tensors="pt").to(dev), max_new_tokens=40)
    return p.decode(o[0], skip_special_tokens=True)

def vqa(im, q):
    from transformers import BlipProcessor, BlipForQuestionAnswering as M
    n = "Salesforce/blip-vqa-base"
    p, m = _get("vqa", lambda: (BlipProcessor.from_pretrained(n), M.from_pretrained(n).to(dev).eval()))
    with torch.no_grad(): o = m.generate(**p(im, q, return_tensors="pt").to(dev), max_new_tokens=30)
    return p.decode(o[0], skip_special_tokens=True)

def detect(im, conf=0.25):
    from ultralytics import YOLO
    y = _get("yolo", lambda: YOLO("yolov8n.pt"))
    r = y(im, conf=conf, verbose=False)[0]
    return [{"label": r.names[int(b.cls)], "confidence": round(float(b.conf), 3),
             "box": [round(float(v), 1) for v in b.xyxy[0]]} for b in r.boxes]

def ocr(im):
    import easyocr
    rd = _get("ocr", lambda: easyocr.Reader(["en"], gpu=dev == "cuda"))
    return [{"text": t, "confidence": round(float(c), 3)} for _, t, c in rd.readtext(np.array(im))]

def _clip():
    from transformers import CLIPModel, CLIPProcessor
    n = "openai/clip-vit-base-patch32"
    return CLIPProcessor.from_pretrained(n), CLIPModel.from_pretrained(n).to(dev).eval()

def _norm(t):
    if hasattr(t, "pooler_output"):
        t = t.pooler_output
    elif hasattr(t, "last_hidden_state"):
        t = t.last_hidden_state
    return (t / t.norm(dim=-1, keepdim=True))[0].cpu().tolist()

def embed_image(im):
    p, m = _get("clip", _clip)
    with torch.no_grad(): return _norm(m.get_image_features(**p(images=im, return_tensors="pt").to(dev)))

def embed_text(t):
    p, m = _get("clip", _clip)
    with torch.no_grad(): return _norm(m.get_text_features(**p(text=[t], return_tensors="pt", padding=True).to(dev)))
