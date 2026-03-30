# SAM 2 Auto-Annotator for YOLO Datasets

## Project Overview
This project is a high-performance, interactive auto-annotation tool designed to streamline the creation of large-scale YOLO datasets. It leverages **Segment Anything Model 2 (SAM 2)** to provide precise, point-and-click polygon generation directly in a web interface.

### Key Features
- **SAM 2 Integration:** Uses Ultralytics SAM 2 for state-of-the-art zero-shot segmentation.
- **Hardware-Aware:** Automatically detects CPU/GPU capabilities and VRAM to recommend the optimal SAM 2 model variant (`tiny`, `small`, `base`, or `large`).
- **Interactive UI:** A React-based frontend with a canvas overlay for real-time feedback during point-and-click annotation.
- **YOLO Export:** Saves annotations as normalized polygon coordinates in YOLO format (`.txt` files) in a dedicated `labels/` directory.
- **Resource Efficient:** Implements lazy model loading, explicit memory cleanup, and cache management to prevent system crashes during long annotation sessions.

### Key Technologies
- **Backend:** [FastAPI](https://fastapi.tiangolo.com/) (Python)
- **AI/ML:** [Ultralytics SAM 2](https://docs.ultralytics.com/models/sam-2/), [PyTorch](https://pytorch.org/)
- **Frontend:** [React](https://reactjs.org/) (via CDN), [Babel](https://babeljs.io/)
- **Utilities:** [OpenCV](https://opencv.org/) (image processing), [psutil](https://psutil.readthedocs.io/) (hardware monitoring), [PyYAML](https://pyyaml.org/)

---

## Directory Structure
- `main.py`: Core FastAPI backend handling inference, hardware detection, and label management.
- `static/app.js`: React frontend logic for the interactive annotation interface.
- `templates/index.html`: Main HTML entry point.
- `images/`: Source directory for raw images to be annotated.
- `labels/`: Output directory for YOLO format annotations.
- `models/`: Storage for automatically downloaded SAM 2 model weights.
- `dataset.yaml`: Automatically generated YOLO configuration file.

---

## Building and Running

### Prerequisites
- Python 3.8+
- NVIDIA GPU with CUDA support (highly recommended for performance)

### Steps
1. **Install Dependencies:**
   ```bash
   pip install -r requirements.txt
   ```

2. **Run the Application:**
   ```bash
   uvicorn main:app --reload
   ```

3. **Annotate:**
   - Open [http://127.0.0.1:8000](http://127.0.0.1:8000).
   - Click **"Load Model"** (the app will suggest the best one for your hardware).
   - Select an image from the sidebar.
   - Use **Positive Points** (green) and **Negative Points** (red) to refine the mask.
   - Click **"Save Annotation"** to export the YOLO label.

---

## Implementation Details
- **Inference Strategy:** Points are mapped from display coordinates to original image dimensions for the model, ensuring accuracy regardless of screen size.
- **Stability:** The backend clears the CUDA cache and triggers garbage collection after each segmenting operation to maintain a low VRAM footprint.
- **Polygons:** The app extracts multiple polygons from SAM 2 masks, allowing for complex object shapes with holes or disconnected parts.
