# SAM 2 Auto-Annotator for YOLO Datasets

## Project Overview
This project is a high-performance, interactive auto-annotation tool designed to streamline the creation of large-scale YOLO datasets. It leverages **Segment Anything Model 2 (SAM 2)** to provide precise, point-and-click polygon generation with advanced manual fine-tuning capabilities.

### Key Features
- **SAM 2 Integration:** Uses Ultralytics SAM 2 for state-of-the-art zero-shot segmentation.
- **Hardware-Aware Auto-Loading:** Automatically detects GPU/VRAM and loads the optimal SAM 2 model variant (`tiny`, `small`, `base`, or `large`) on startup.
- **Real-Time Interaction:** 
    - **Draggable Points:** Drag positive/negative points to see the mask update instantly.
    - **Vertex-Level Fine-tuning:** Manually drag individual polygon vertices to perfectly align the mask.
- **SAM Assist Toggle:** Switch between automated segmentation and fully manual polygon creation for complex edges.
- **YOLO Export:** Saves annotations as normalized polygon coordinates in YOLO format (`.txt` files).
- **Resource Efficient:** Implements lazy loading and explicit CUDA cache management to maintain system stability.

### Key Technologies
- **Backend:** [FastAPI](https://fastapi.tiangolo.com/) (Python)
- **AI/ML:** [Ultralytics SAM 2](https://docs.ultralytics.com/models/sam-2/), [PyTorch](https://pytorch.org/)
- **Frontend:** [React](https://reactjs.org/) (via CDN)
- **Utilities:** [OpenCV](https://opencv.org/) (polygon simplification), [psutil](https://psutil.readthedocs.io/), [PyYAML](https://pyyaml.org/)

---

## Interactive Controls
- **Left Click:** Add a positive point (green).
- **Right Click:** Add a negative point (red) or remove an existing point/vertex.
- **Drag Point:** Move a SAM point to trigger real-time re-segmentation.
- **Drag Vertex:** Move a white handle to manually adjust the mask shape.
- **Undo/Clear:** Quickly revert points or clear the entire current mask.

---

## Directory Structure
- `main.py`: Backend handling inference, polygon simplification, and label saving.
- `static/app.js`: React logic for the interactive annotation engine and coordinate mapping.
- `images/`: Source directory for raw images.
- `labels/`: Output directory for YOLO format annotations.
- `models/`: Storage for automatically downloaded model weights.

---

## Building and Running

1. **Install Dependencies:**
   ```bash
   pip install -r requirements.txt
   ```

2. **Run the Application:**
   ```bash
   uvicorn main:app --reload
   ```

3. **Annotate:**
   - The app will automatically detect your hardware and load the best model.
   - Use **SAM Assist** for fast initial masks.
   - Use **Vertex Dragging** for pixel-perfect accuracy.
   - Click **"Save Annotation"** to write the YOLO `.txt` file.
