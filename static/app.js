const { useState, useEffect, useRef, useMemo } = React;

function App() {
    const [images, setImages] = useState([]);
    const [selectedImage, setSelectedImage] = useState(null);
    const [hardware, setHardware] = useState(null);
    const [modelLoading, setModelLoading] = useState(false);
    const [modelLoaded, setModelLoaded] = useState(false);
    const [points, setPoints] = useState([]);
    const [polygons, setPolygons] = useState([]);
    const [imgSize, setImgSize] = useState({ w: 0, h: 0 });
    const [displaySize, setDisplaySize] = useState({ w: 0, h: 0 });
    const [classId, setClassId] = useState(0);

    const imgRef = useRef(null);

    useEffect(() => {
        fetch('/api/images').then(r => r.json()).then(setImages);
        fetch('/api/hardware')
            .then(r => r.json())
            .then(data => {
                setHardware(data);
                // Auto-load recommended model
                if (data.recommended_model) {
                    autoLoadModel(data.recommended_model);
                }
            });
    }, []);

    const autoLoadModel = (modelName) => {
        setModelLoading(true);
        fetch(`/api/load-model?model_name=${modelName}`, { method: 'POST' })
            .then(r => r.json())
            .then(() => {
                setModelLoaded(true);
                setModelLoading(false);
            })
            .catch(() => setModelLoading(false));
    };

    const loadModel = () => {
        if (!hardware) return;
        autoLoadModel(hardware.recommended_model);
    };

    const handleImageSelect = (name) => {
        setSelectedImage(name);
        setPoints([]);
        setPolygons([]);
    };

    const handleImgLoad = (e) => {
        const { naturalWidth, naturalHeight, width, height } = e.target;
        setImgSize({ w: naturalWidth, h: naturalHeight });
        setDisplaySize({ w: width, h: height });
    };

    const [segmenting, setSegmenting] = useState(false);
    const [draggingPointIndex, setDraggingPointIndex] = useState(null);
    const [draggingVertex, setDraggingVertex] = useState(null); // {polyIndex, vertexIndex}

    const updateSegmentation = (newPoints) => {
        if (newPoints.length === 0) {
            setPolygons([]);
            return;
        }

        setSegmenting(true);
        fetch('/api/segment', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                image_name: selectedImage,
                points: newPoints
            })
        })
        .then(r => r.json())
        .then(data => {
            if (data.polygons) setPolygons(data.polygons);
            setSegmenting(false);
        })
        .catch(() => setSegmenting(false));
    };

    const handleCanvasMouseDown = (e, label = 1) => {
        if (!modelLoaded || !selectedImage || segmenting) return;
        e.preventDefault();

        const rect = e.target.getBoundingClientRect();
        const x_display = e.clientX - rect.left;
        const y_display = e.clientY - rect.top;

        // Check if we are clicking near a polygon vertex (highest priority)
        const vThreshold = 15;
        for (let i = 0; i < polygons.length; i++) {
            for (let j = 0; j < polygons[i].length; j++) {
                const pt = polygons[i][j];
                const vx_display = (pt[0] / imgSize.w) * displaySize.w;
                const vy_display = (pt[1] / imgSize.h) * displaySize.h;
                const dist = Math.sqrt(Math.pow(x_display - vx_display, 2) + Math.pow(y_display - vy_display, 2));
                if (dist < vThreshold) {
                    if (e.button === 2) {
                        // Right click: Remove vertex
                        const newPolygons = [...polygons];
                        newPolygons[i] = newPolygons[i].filter((_, idx) => idx !== j);
                        setPolygons(newPolygons);
                        return;
                    }
                    // Left click: Start dragging vertex
                    setDraggingVertex({ polyIndex: i, vertexIndex: j });
                    return;
                }
            }
        }

        // Check if we are clicking near a SAM point (second priority)
        const threshold = 18;
        const pointIndex = points.findIndex(p => {
            const px_display = (p.x / imgSize.w) * displaySize.w;
            const py_display = (p.y / imgSize.h) * displaySize.h;
            const dist = Math.sqrt(Math.pow(x_display - px_display, 2) + Math.pow(y_display - py_display, 2));
            return dist < threshold;
        });

        if (pointIndex !== -1) {
            if (e.button === 2) {
                const newPoints = points.filter((_, i) => i !== pointIndex);
                setPoints(newPoints);
                updateSegmentation(newPoints);
            } else {
                setDraggingPointIndex(pointIndex);
            }
        } else {
            const x = (x_display / displaySize.w) * imgSize.w;
            const y = (y_display / displaySize.h) * imgSize.h;
            const actualLabel = e.button === 2 ? 0 : 1;
            const newPoint = { x, y, label: actualLabel };
            const newPoints = [...points, newPoint];
            setPoints(newPoints);
            updateSegmentation(newPoints);
        }
    };

    const handleCanvasMouseMove = (e) => {
        if (draggingPointIndex === null && draggingVertex === null) return;

        const rect = e.target.getBoundingClientRect();
        const x_display = Math.max(0, Math.min(displaySize.w, e.clientX - rect.left));
        const y_display = Math.max(0, Math.min(displaySize.h, e.clientY - rect.top));

        const x = (x_display / displaySize.w) * imgSize.w;
        const y = (y_display / displaySize.h) * imgSize.h;

        if (draggingPointIndex !== null) {
            const newPoints = [...points];
            newPoints[draggingPointIndex] = { ...newPoints[draggingPointIndex], x, y };
            setPoints(newPoints);
        } else if (draggingVertex !== null) {
            const { polyIndex, vertexIndex } = draggingVertex;
            const newPolygons = [...polygons];
            newPolygons[polyIndex] = [...newPolygons[polyIndex]];
            newPolygons[polyIndex][vertexIndex] = [x, y];
            setPolygons(newPolygons);
        }
    };

    const handleCanvasMouseUp = () => {
        if (draggingPointIndex !== null) {
            updateSegmentation(points);
            setDraggingPointIndex(null);
        }
        setDraggingVertex(null);
    };

    const saveAnnotation = () => {
        if (!selectedImage || polygons.length === 0) return;
        
        // Save each generated polygon for this object
        const promises = polygons.map(poly => 
            fetch(`/api/save-label?image_name=${selectedImage}&class_id=${classId}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(poly)
            })
        );

        Promise.all(promises).then(() => {
            alert('Saved current object!');
            setPoints([]);
            setPolygons([]);
        });
    };

    const undoPoint = () => {
        const newPoints = points.slice(0, -1);
        setPoints(newPoints);
        if (newPoints.length === 0) {
            setPolygons([]);
            return;
        }
        
        setSegmenting(true);
        fetch('/api/segment', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                image_name: selectedImage,
                points: newPoints
            })
        })
        .then(r => r.json())
        .then(data => {
            if (data.polygons) setPolygons(data.polygons);
            setSegmenting(false);
        })
        .catch(() => setSegmenting(false));
    };

    const clearPoints = () => {
        setPoints([]);
        setPolygons([]);
    };

    return (
        <React.Fragment>
            <div className="sidebar">
                <div className="hardware-panel">
                    {hardware ? (
                        <div>
                            <b>{hardware.gpu_name}</b> ({hardware.vram_gb}GB VRAM)<br/>
                            Recommended: {hardware.recommended_model}<br/>
                            <button 
                                onClick={loadModel} 
                                disabled={modelLoading || modelLoaded}
                                style={{marginTop: '0.5rem', width: '100%'}}
                            >
                                {modelLoading ? 'Loading Model...' : modelLoaded ? 'Model Ready' : 'Load Model'}
                            </button>
                        </div>
                    ) : 'Detecting hardware...'}
                </div>
                <div style={{padding: '1rem', borderBottom: '1px solid #eee'}}>
                    <b>Images ({images.length})</b>
                </div>
                {images.map(img => (
                    <div 
                        key={img} 
                        className={`img-item ${selectedImage === img ? 'active' : ''}`}
                        onClick={() => handleImageSelect(img)}
                    >
                        {img}
                    </div>
                ))}
            </div>

            <div className="main-content">
                <div className="toolbar">
                    <div className="controls">
                        <span style={{color: '#64748b', fontSize: '0.875rem'}}>
                            <b>Left click</b>: Positive point | <b>Right click</b>: Negative point
                        </span>
                    </div>
                    <div style={{marginLeft: 'auto', display: 'flex', gap: '1rem', alignItems: 'center'}}>
                        {segmenting && <span style={{color: '#d97706', fontSize: '0.875rem', fontWeight: 'bold'}}>Segmenting...</span>}
                        <span>Class: <input type="number" value={classId} onChange={e => setClassId(parseInt(e.target.value))} style={{width: '40px'}} /></span>
                        <button onClick={undoPoint} disabled={points.length === 0} style={{background: '#64748b'}}>Undo</button>
                        <button onClick={clearPoints} style={{background: '#64748b'}}>Clear</button>
                        <button onClick={saveAnnotation} disabled={polygons.length === 0 || segmenting}>Save Annotation (YOLO)</button>
                    </div>
                </div>

                <div className="image-container">
                    {selectedImage ? (
                        <div className="canvas-wrapper">
                            <img 
                                ref={imgRef}
                                src={`/images/${selectedImage}`} 
                                onLoad={handleImgLoad}
                                style={{maxHeight: '80vh', maxWidth: '100%', display: 'block'}}
                            />
                            {imgSize.w > 0 && (
                                <svg 
                                    className="svg-overlay"
                                    width={displaySize.w} 
                                    height={displaySize.h}
                                    style={{position: 'absolute', top: 0, left: 0}}
                                >
                                    {polygons.map((poly, i) => (
                                        <React.Fragment key={i}>
                                            <polygon 
                                                points={poly.map(p => `${(p[0]/imgSize.w)*displaySize.w},${(p[1]/imgSize.h)*displaySize.h}`).join(' ')}
                                                fill="rgba(37, 99, 235, 0.4)"
                                                stroke="rgba(37, 99, 235, 1)"
                                                strokeWidth="2"
                                            />
                                            {poly.map((p, j) => (
                                                <circle 
                                                    key={`${i}-${j}`}
                                                    cx={(p[0]/imgSize.w)*displaySize.w}
                                                    cy={(p[1]/imgSize.h)*displaySize.h}
                                                    r="4"
                                                    fill="white"
                                                    stroke="#2563eb"
                                                    strokeWidth="1.5"
                                                    style={{ cursor: 'move' }}
                                                />
                                            ))}
                                        </React.Fragment>
                                    ))}
                                    {points.map((p, i) => (
                                        <circle 
                                            key={i}
                                            cx={(p.x/imgSize.w)*displaySize.w}
                                            cy={(p.y/imgSize.h)*displaySize.h}
                                            r="7"
                                            fill={p.label === 1 ? '#22c55e' : '#ef4444'}
                                            stroke="white"
                                            strokeWidth="2"
                                            style={{ cursor: 'move', filter: 'drop-shadow(0 2px 3px rgba(0,0,0,0.4))' }}
                                        />
                                    ))}
                                </svg>
                            )}
                            <div 
                                className="interaction-layer"
                                style={{width: displaySize.w, height: displaySize.h, position: 'absolute', top: 0, left: 0}}
                                onMouseDown={(e) => handleCanvasMouseDown(e)}
                                onMouseMove={handleCanvasMouseMove}
                                onMouseUp={handleCanvasMouseUp}
                                onContextMenu={(e) => e.preventDefault()}
                            ></div>
                        </div>
                    ) : (
                        <div style={{color: '#64748b', textAlign: 'center'}}>
                            <h2>Select an image to start annotating</h2>
                            <p>Use SAM 2 to automatically generate polygons by clicking.</p>
                        </div>
                    )}
                </div>
            </div>
        </React.Fragment>
    );
}

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<App />);
