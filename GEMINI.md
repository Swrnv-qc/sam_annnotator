# SAM 2 Auto-Annotator for YOLO Datasets

## Project Overview
This project is a high-performance, interactive auto-annotation tool designed to streamline the creation of large-scale YOLO datasets. It leverages **Segment Anything Model 2 (SAM 2)** to provide precise, point-and-click polygon generation with advanced manual fine-tuning and professional dataset management capabilities.

### Key Features
- **SAM 2 Integration:** Uses Ultralytics SAM 2 for state-of-the-art zero-shot segmentation.
- **Hardware-Aware Auto-Loading:** Automatically detects GPU/VRAM and loads the optimal SAM 2 model variant on startup.
- **Professional Viewport:**
    - **Infinite Zoom & Pan:** Scroll wheel to zoom, middle-click to pan. Essential for high-res images.
    - **Marquee Selection:** Shift + Drag to select multiple points or vertices for bulk deletion.
- **Hybrid Annotation Engine:**
    - **SAM Assist Toggle:** Switch between AI-assisted segmentation and fully manual polygon creation.
    - **Manual SAM Trigger:** AI only runs when you press **Enter** or click "Run SAM". Your manual edits are never overridden.
    - **Persistent Fine-tuning:** Manually drag any vertex. Changes are saved and loaded back when you revisit an image.
- **Dataset Management:**
    - **Label Browser:** Automatically loads existing YOLO `.txt` labels from the `labels/` folder for editing.
    - **Class Management:** Supports named classes (defined in `dataset.yaml`). Select the active class from a dropdown.
    - **Dark Mode:** A dedicated toggle to reduce eye strain during long labeling sessions.
- **YOLO Export:** Saves and overwrites annotations as normalized polygon coordinates in standard YOLO format.

### Key Technologies
- **Backend:** [FastAPI](https://fastapi.tiangolo.com/) (Python)
- **AI/ML:** [Ultralytics SAM 2](https://docs.ultralytics.com/models/sam-2/), [PyTorch](https://pytorch.org/)
- **Frontend:** [React](https://reactjs.org/) (via CDN)
- **Utilities:** [OpenCV](https://opencv.org/), [psutil](https://psutil.readthedocs.io/), [PyYAML](https://pyyaml.org/)

---

## Interactive Controls
- **Left Click:** Add positive point (green) or manual vertex.
- **Right Click:** 
    - On empty space: Add negative point (red).
    - On existing point/vertex: Remove it instantly.
- **Drag Point/Vertex:** Move items to refine your annotation.
- **Shift + Drag:** Create a selection box to select multiple items.
- **Middle Click / Alt + Left Click:** Pan the image.
- **Scroll Wheel:** Zoom in and out (centered at cursor).
- **Enter:** Run SAM inference manually.
- **Delete / Backspace:** Delete all selected items.
- **Undo:** Revert the last point addition.

---

## Getting Started
1. **Install:** `pip install -r requirements.txt`
2. **Run:** `uvicorn main:app --reload`
3. **Configure:** Define your classes in `dataset.yaml`.
4. **Annotate:** Load the model, select an image, and start clicking!
