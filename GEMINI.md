# GEMINI.md - Project Context

## Project Overview
**FastAPI React Image Viewer** is a lightweight web application designed to browse and view images stored in a local directory. Despite the initial `README.md` labeling it a "Counter App," the implementation is a functional image gallery.

### Key Technologies
- **Backend:** [FastAPI](https://fastapi.tiangolo.com/) (Python)
- **Frontend:** [React](https://reactjs.org/) (via CDN), [Babel](https://babeljs.io/) (for in-browser JSX transformation)
- **Styling:** Vanilla CSS (embedded in `index.html`)
- **Templating:** [Jinja2](https://palletsprojects.com/p/jinja/)

### Architecture
- `main.py`: The entry point and API server. It defines routes for serving the UI and listing images.
- `templates/index.html`: The main HTML structure, including CSS and React/Babel CDN scripts.
- `static/app.js`: Contains the React frontend logic, including state management for image navigation and periodic polling of the image directory.
- `images/`: The source directory for images. The app supports `.jpg`, `.jpeg`, `.png`, `.gif`, and `.webp` formats.

---

## Building and Running

### Prerequisites
- Python 3.7+
- Virtual environment (recommended)

### Steps
1. **Install Dependencies:**
   ```bash
   pip install -r requirements.txt
   ```

2. **Run the Application:**
   ```bash
   uvicorn main:app --reload
   ```

3. **Access the App:**
   Open [http://127.0.0.1:8000](http://127.0.0.1:8000) in your browser.

---

## Development Conventions

### Backend (Python/FastAPI)
- Routes are defined in `main.py`.
- Static files are served from `/static` and `/images`.
- The `/api/images` endpoint returns a sorted list of image filenames.

### Frontend (React/JavaScript)
- The UI is built using React components (in `static/app.js`).
- **State Management:** Uses `useState` for image lists and navigation index.
- **Data Fetching:** The app polls the backend every 2 seconds using `setInterval` within a `useEffect` hook to dynamically detect new images added to the `images/` folder.
- **Styling:** CSS is kept in the `<style>` tag of `index.html` for simplicity in this prototype.

### File Organization
- `main.py`: Server logic and routing.
- `static/`: Client-side JavaScript.
- `templates/`: HTML templates (Jinja2).
- `images/`: Local image storage.
