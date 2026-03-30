# SAM 2 Auto-Annotator for YOLO Datasets

## Project Overview
This project is a high-performance, interactive auto-annotation tool designed to streamline the creation of large-scale YOLO datasets. It leverages **Segment Anything Model 2 (SAM 2)** to provide precise, point-and-click polygon generation with advanced manual fine-tuning and hybrid assistance capabilities.

### Key Features
- **SAM 2 Integration:** Uses Ultralytics SAM 2 for state-of-the-art zero-shot segmentation.
- **Hardware-Aware Auto-Loading:** Automatically detects GPU/VRAM and loads the optimal SAM 2 model variant (`tiny`, `small`, `base`, or `large`) on startup.
- **Hybrid Interaction:**
    - **SAM Assist Toggle:** Seamlessly switch between AI-assisted segmentation and manual polygon creation.
    - **Persistent Vertex Fine-tuning:** After SAM provides the initial mask, manually drag individual polygon vertices for pixel-perfect accuracy. These manual edits are fully persistent and never overridden by the model.
    - **Draggable SAM Points:** SAM points are used to trigger the initial mask. Once placed, they can be moved for visual reference, but the model will not re-predict unless a new point is added or an existing one is removed.
- **YOLO Export:** Saves annotations as normalized polygon coordinates in YOLO format (`.txt` files).
- **One-Click Management:** Click any point or vertex without dragging to remove it instantly.
- **Dataset Configuration:** Ability to generate a `dataset.yaml` file for immediate use in YOLO training.

### Key Technologies
- **Backend:** [FastAPI](https://fastapi.tiangolo.com/) (Python)
- **AI/ML:** [Ultralytics SAM 2](https://docs.ultralytics.com/models/sam-2/), [PyTorch](https://pytorch.org/)
- **Frontend:** [React](https://reactjs.org/) (via CDN)
- **Utilities:** [OpenCV](https://opencv.org/) (polygon simplification/approx), [psutil](https://psutil.readthedocs.io/), [PyYAML](https://pyyaml.org/)

---

## Interactive Controls
- **Left Click:** 
    - (SAM Assist ON): Add a positive point (green).
    - (SAM Assist OFF): Add a vertex to a manual polygon.
- **Right Click:** 
    - On empty space: Add a negative point (red).
    - On existing point/vertex: Remove it instantly.
- **Drag Point:** Move a SAM point for real-time model re-segmentation.
- **Drag Vertex:** Move a polygon vertex. In SAM Assist mode, this triggers a box-guided re-prediction for a tighter fit.
- **Class Input:** Specify the YOLO class ID for the current annotation.
- **Undo/Clear:** Revert recent points or clear the entire current mask.

---

## Implementation Details
- **Smart Re-prediction:** When a vertex is moved, the system calculates a new bounding box encompassing the entire polygon. This box is sent to SAM 2 as a constraint, forcing the AI to focus its prediction within the user's defined boundaries.
- **Polygon Simplification:** SAM's dense output is automatically simplified using `cv2.approxPolyDP` (epsilon = 0.002) to ensure vertices are manageable for human editing while preserving shape integrity.
- **Resource Management:** Includes explicit CUDA cache clearing and garbage collection to ensure stability on consumer-grade hardware.
