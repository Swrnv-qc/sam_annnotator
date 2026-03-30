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
    const [pointType, setPointType] = useState(1); // 1: Positive, 0: Negative
    const [classId, setClassId] = useState(0);

    const imgRef = useRef(null);

    useEffect(() => {
        fetch('/api/images').then(r => r.json()).then(setImages);
        fetch('/api/hardware').then(r => r.json()).then(setHardware);
    }, []);

    const loadModel = () => {
        if (!hardware) return;
        setModelLoading(true);
        fetch(`/api/load-model?model_name=${hardware.recommended_model}`, { method: 'POST' })
            .then(r => r.json())
            .then(() => {
                setModelLoaded(true);
                setModelLoading(false);
            });
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

    const handleCanvasClick = (e) => {
        if (!modelLoaded || !selectedImage || segmenting) return;

        const rect = e.target.getBoundingClientRect();
        const x_display = e.clientX - rect.left;
        const y_display = e.clientY - rect.top;

        const x = (x_display / displaySize.w) * imgSize.w;
        const y = (y_display / displaySize.h) * imgSize.h;

        const newPoint = { x, y, label: pointType };
        const newPoints = [...points, newPoint];
        setPoints(newPoints);

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
                        <button 
                            onClick={() => setPointType(1)}
                            style={{background: pointType === 1 ? '#22c55e' : '#94a3b8'}}
                        >
                            + Positive Point
                        </button>
                        <button 
                            onClick={() => setPointType(0)}
                            style={{background: pointType === 0 ? '#ef4444' : '#94a3b8'}}
                        >
                            - Negative Point
                        </button>
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
                                        <polygon 
                                            key={i}
                                            points={poly.map(p => `${(p[0]/imgSize.w)*displaySize.w},${(p[1]/imgSize.h)*displaySize.h}`).join(' ')}
                                            fill="rgba(37, 99, 235, 0.4)"
                                            stroke="rgba(37, 99, 235, 1)"
                                            strokeWidth="2"
                                        />
                                    ))}
                                    {points.map((p, i) => (
                                        <circle 
                                            key={i}
                                            cx={(p.x/imgSize.w)*displaySize.w}
                                            cy={(p.y/imgSize.h)*displaySize.h}
                                            r="5"
                                            fill={p.label === 1 ? '#22c55e' : '#ef4444'}
                                            stroke="white"
                                            strokeWidth="2"
                                        />
                                    ))}
                                </svg>
                            )}
                            <div 
                                className="interaction-layer"
                                style={{width: displaySize.w, height: displaySize.h, position: 'absolute', top: 0, left: 0}}
                                onClick={handleCanvasClick}
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
