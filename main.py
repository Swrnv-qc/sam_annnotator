from fastapi import FastAPI, Request, HTTPException
from fastapi.responses import HTMLResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from pydantic import BaseModel
from typing import List, Optional
import os
import torch
import psutil
import gc
from ultralytics import SAM
import cv2
import numpy as np
import yaml

app = FastAPI()

# Create directories if they don't exist
os.makedirs("static", exist_ok=True)
os.makedirs("templates", exist_ok=True)
os.makedirs("images", exist_ok=True)
os.makedirs("models", exist_ok=True)
os.makedirs("labels", exist_ok=True)

app.mount("/static", StaticFiles(directory="static"), name="static")
app.mount("/images", StaticFiles(directory="images"), name="images")

templates = Jinja2Templates(directory="templates")

# Global model variable for lazy loading
sam_model = None
current_model_path = None

class Point(BaseModel):
    x: float
    y: float
    label: int  # 1 for positive, 0 for negative

class SegmentRequest(BaseModel):
    image_name: str
    points: List[Point]
    box: Optional[List[float]] = None  # [x1, y1, x2, y2]

@app.get("/", response_class=HTMLResponse)
async def read_item(request: Request):
    return templates.TemplateResponse(
        request=request, name="index.html", context={}
    )

@app.get("/api/images")
async def list_images():
    image_extensions = {".jpg", ".jpeg", ".png", ".gif", ".webp"}
    images = [
        f for f in os.listdir("images") 
        if os.path.splitext(f)[1].lower() in image_extensions
    ]
    return sorted(images)

@app.get("/api/hardware")
async def get_hardware():
    gpu_available = torch.cuda.is_available()
    vram_total = 0
    gpu_name = "CPU"
    
    if gpu_available:
        vram_total = torch.cuda.get_device_properties(0).total_memory / (1024**3) # GB
        gpu_name = torch.cuda.get_device_name(0)
    
    ram_total = psutil.virtual_memory().total / (1024**3) # GB
    
    # Recommendation
    if gpu_available:
        if vram_total > 8:
            rec = "sam2_l.pt"
        elif vram_total > 4:
            rec = "sam2_b.pt"
        else:
            rec = "sam2_s.pt"
    else:
        rec = "sam2_t.pt"
        
    return {
        "gpu_available": gpu_available,
        "gpu_name": gpu_name,
        "vram_gb": round(vram_total, 2),
        "ram_gb": round(ram_total, 2),
        "recommended_model": rec
    }

@app.post("/api/load-model")
async def load_model(model_name: str):
    global sam_model, current_model_path
    
    if sam_model is not None and current_model_path == model_name:
        return {"status": "already_loaded", "model": model_name}
    
    # Clear memory
    if sam_model is not None:
        del sam_model
        if torch.cuda.is_available():
            torch.cuda.empty_cache()
        gc.collect()
    
    try:
        device = "cuda" if torch.cuda.is_available() else "cpu"
        # Download to models dir
        sam_model = SAM(model_name)
        current_model_path = model_name
        return {"status": "success", "model": model_name, "device": device}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/segment")
async def segment(req: SegmentRequest):
    global sam_model
    if sam_model is None:
        raise HTTPException(status_code=400, detail="Model not loaded")
    
    if not req.points and not req.box:
        return {"polygons": [], "box": None}

    img_path = os.path.join("images", req.image_name)
    if not os.path.exists(img_path):
        raise HTTPException(status_code=404, detail="Image not found")
    
    # Process points
    points = [[p.x, p.y] for p in req.points] if req.points else None
    labels = [p.label for p in req.points] if req.points else None
    
    try:
        # Inference
        results = sam_model.predict(
            img_path, 
            points=points, 
            labels=labels, 
            bboxes=req.box,
            device=sam_model.device,
            conf=0.25,
            verbose=False
        )
        
        # Extract masks
        result = results[0]
        if result.masks is not None:
            polygons = []
            for poly in result.masks.xy:
                polygons.append(poly.tolist())
            
            return {
                "polygons": polygons,
                "box": result.boxes.xyxy[0].tolist() if result.boxes is not None else None
            }
        else:
            return {"polygons": [], "box": None}
            
    except Exception as e:
        print(f"Inference error: {e}")
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        if torch.cuda.is_available():
            torch.cuda.empty_cache()

@app.post("/api/save-label")
async def save_label(image_name: str, class_id: int, polygons: List[List[float]]):
    label_path = os.path.join("labels", os.path.splitext(image_name)[0] + ".txt")
    
    img = cv2.imread(os.path.join("images", image_name))
    if img is None:
        raise HTTPException(status_code=404, detail="Image read error")
    h, w = img.shape[:2]
    
    with open(label_path, "a") as f:
        normalized = []
        for pt in polygons:
            normalized.append(f"{pt[0]/w} {pt[1]/h}")
        f.write(f"{class_id} {' '.join(normalized)}\n")
                
    return {"status": "success", "path": label_path}

@app.post("/api/generate-yaml")
async def generate_yaml(classes: List[str]):
    data = {
        "path": os.getcwd(),
        "train": "images",
        "val": "images",
        "names": {i: name for i, name in enumerate(classes)}
    }
    with open("dataset.yaml", "w") as f:
        yaml.dump(data, f)
    return {"status": "success", "path": "dataset.yaml"}
