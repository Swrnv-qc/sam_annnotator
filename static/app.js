const { useState, useEffect, useRef, useMemo } = React;

function App() {
    const [images, setImages] = useState([]);
    const [selectedImage, setSelectedImage] = useState(null);
    const [hardware, setHardware] = useState(null);
    const [modelLoading, setModelLoading] = useState(false);
    const [modelLoaded, setModelLoaded] = useState(false);
    const [points, setPoints] = useState([]);
    const [polygons, setPolygons] = useState([]); // Array of {class_id, polygon: [[x,y],...]}
    const [imgSize, setImgSize] = useState({ w: 0, h: 0 });
    const [displaySize, setDisplaySize] = useState({ w: 0, h: 0 });
    const [classId, setClassId] = useState(0);
    const [classes, setClasses] = useState({0: "default"});
    const [samAssist, setSamAssist] = useState(true);
    const [zoom, setZoom] = useState(1);
    const [offset, setOffset] = useState({ x: 0, y: 0 });
    const [isPanning, setIsPanning] = useState(false);
    const [darkMode, setDarkMode] = useState(() => {
        return localStorage.getItem('darkMode') === 'true';
    });
    const lastMousePos = useRef({ x: 0, y: 0 });
    const containerRef = useRef(null);
    const imgRef = useRef(null);

    const handleFileUpload = (e) => {
        const files = e.target.files;
        if (!files || files.length === 0) return;
        const formData = new FormData();
        for (let file of files) formData.append('files', file);
        fetch('/api/upload', { method: 'POST', body: formData })
            .then(r => r.json())
            .then(() => fetch('/api/images').then(r => r.json()).then(setImages));
    };

    const handleImgLoad = (e) => {
        const { naturalWidth, naturalHeight } = e.target;
        setImgSize({ w: naturalWidth, h: naturalHeight });
        if (containerRef.current) {
            const cw = containerRef.current.clientWidth;
            const ch = containerRef.current.clientHeight;
            const scale = Math.min((cw - 60) / naturalWidth, (ch - 60) / naturalHeight, 1.0);
            setZoom(scale);
            setDisplaySize({ w: naturalWidth, h: naturalHeight });
            setOffset({ x: (cw - naturalWidth * scale) / 2, y: (ch - naturalHeight * scale) / 2 });
        }
    };

    const [segmenting, setSegmenting] = useState(false);
    const [draggingPointIndex, setDraggingPointIndex] = useState(null);
    const [draggingVertex, setDraggingVertex] = useState(null); // {polyIndex, vertexIndex}
    const [selectionBox, setSelectionBox] = useState(null);
    const [selectedItems, setSelectedItems] = useState({ points: [], vertices: [] });
    const [helpVisible, setHelpVisible] = useState(false);
    const hasMoved = useRef(false);

    const deleteSelected = () => {
        if (selectedItems.points.length > 0) {
            setPoints(points.filter((_, idx) => !selectedItems.points.includes(idx)));
        }

        if (selectedItems.vertices.length > 0) {
            const newPolygons = polygons.map((pObj, pIdx) => ({
                ...pObj,
                polygon: pObj.polygon.filter((_, vIdx) => 
                    !selectedItems.vertices.some(sv => sv.polyIndex === pIdx && sv.vertexIndex === vIdx)
                )
            })).filter(pObj => pObj.polygon.length > 2);
            setPolygons(newPolygons);
        }
        setSelectedItems({ points: [], vertices: [] });
    };

    const updateSegmentation = (newPoints, customBox = null) => {
        if (newPoints.length === 0 && !customBox) return;

        setSegmenting(true);
        fetch('/api/segment', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                image_name: selectedImage,
                points: newPoints,
                box: customBox
            })
        })
        .then(r => r.json())
        .then(data => {
            if (data.polygons) {
                // Add new polygons to the list
                const newOnes = data.polygons.map(p => ({ class_id: classId, polygon: p }));
                // For now, SAM prediction replaces the *current* unsaved object's mask
                // We'll keep existing objects and just update/add the new ones
                setPolygons(prev => {
                    // Filter out any existing 'temporary' masks if needed, or just append
                    return [...prev, ...newOnes];
                });
            }
            setSegmenting(false);
        })
        .catch(() => setSegmenting(false));
    };

    const runSAM = () => {
        if (samAssist && modelLoaded && points.length > 0) {
            updateSegmentation(points);
        }
    };

    useEffect(() => {
        const handleKeyDown = (e) => {
            if (e.key === 'Delete' || e.key === 'Backspace') {
                if (selectedItems.points.length > 0 || selectedItems.vertices.length > 0) deleteSelected();
            } else if (e.key === 'Enter') runSAM();
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [selectedItems, points, polygons, samAssist, modelLoaded]);

    const handleMouseDown = (e) => {
        if (e.button === 1 || (e.button === 0 && e.altKey)) {
            setIsPanning(true);
            lastMousePos.current = { x: e.clientX, y: e.clientY };
            return;
        }
        handleCanvasMouseDown(e);
    };

    const handleCanvasMouseDown = (e) => {
        if (!selectedImage || segmenting) return;
        if (samAssist && !modelLoaded) return;
        e.preventDefault();
        hasMoved.current = false;

        const rect = imgRef.current.getBoundingClientRect();
        const x_display = (e.clientX - rect.left) / zoom;
        const y_display = (e.clientY - rect.top) / zoom;

        if (e.shiftKey) {
            const containerRect = e.currentTarget.getBoundingClientRect();
            const sx = e.clientX - containerRect.left;
            const sy = e.clientY - containerRect.top;
            setSelectionBox({ x1: sx, y1: sy, x2: sx, y2: sy });
            return;
        }

        setSelectedItems({ points: [], vertices: [] });

        // Check for vertex
        const vThreshold = 15 / zoom;
        for (let i = 0; i < polygons.length; i++) {
            for (let j = 0; j < polygons[i].polygon.length; j++) {
                const pt = polygons[i].polygon[j];
                const vx_display = (pt[0] / imgSize.w) * displaySize.w;
                const vy_display = (pt[1] / imgSize.h) * displaySize.h;
                const dist = Math.sqrt(Math.pow(x_display - vx_display, 2) + Math.pow(y_display - vy_display, 2));
                if (dist < vThreshold) {
                    if (e.button === 2) {
                        const newPolygons = [...polygons];
                        newPolygons[i].polygon = newPolygons[i].polygon.filter((_, idx) => idx !== j);
                        setPolygons(newPolygons);
                        return;
                    }
                    setDraggingVertex({ polyIndex: i, vertexIndex: j });
                    return;
                }
            }
        }

        const x = (x_display / displaySize.w) * imgSize.w;
        const y = (y_display / displaySize.h) * imgSize.h;

        if (samAssist) {
            const threshold = 18 / zoom;
            const pointIndex = points.findIndex(p => {
                const px_display = (p.x / imgSize.w) * displaySize.w;
                const py_display = (p.y / imgSize.h) * displaySize.h;
                const dist = Math.sqrt(Math.pow(x_display - px_display, 2) + Math.pow(y_display - py_display, 2));
                return dist < threshold;
            });

            if (pointIndex !== -1) {
                if (e.button === 2) setPoints(points.filter((_, i) => i !== pointIndex));
                else setDraggingPointIndex(pointIndex);
            } else {
                const actualLabel = e.button === 2 ? 0 : 1;
                setPoints([...points, { x, y, label: actualLabel }]);
            }
        } else {
            // Manual mode
            if (polygons.length === 0 || polygons[polygons.length-1].polygon.length > 50) {
                setPolygons([...polygons, { class_id: classId, polygon: [[x, y]] }]);
            } else {
                const newPolygons = [...polygons];
                newPolygons[newPolygons.length-1].polygon.push([x, y]);
                setPolygons(newPolygons);
            }
        }
    };

    const handleMouseMove = (e) => {
        if (isPanning) {
            const dx = e.clientX - lastMousePos.current.x;
            const dy = e.clientY - lastMousePos.current.y;
            setOffset(prev => ({ x: prev.x + dx, y: prev.y + dy }));
            lastMousePos.current = { x: e.clientX, y: e.clientY };
            return;
        }

        if (selectionBox) {
            const containerRect = e.currentTarget.getBoundingClientRect();
            const mx = e.clientX - containerRect.left;
            const my = e.clientY - containerRect.top;
            const newBox = { ...selectionBox, x2: mx, y2: my };
            setSelectionBox(newBox);
            
            const minX_s = Math.min(newBox.x1, newBox.x2);
            const maxX_s = Math.max(newBox.x1, newBox.x2);
            const minY_s = Math.min(newBox.y1, newBox.y2);
            const maxY_s = Math.max(newBox.y1, newBox.y2);

            const rect = imgRef.current.getBoundingClientRect();
            const selPoints = [];
            points.forEach((p, idx) => {
                const px_screen = ((p.x / imgSize.w) * displaySize.w * zoom) + rect.left - containerRect.left;
                const py_screen = ((p.y / imgSize.h) * displaySize.h * zoom) + rect.top - containerRect.top;
                if (px_screen >= minX_s && px_screen <= maxX_s && py_screen >= minY_s && py_screen <= maxY_s) selPoints.push(idx);
            });

            const selVertices = [];
            polygons.forEach((pObj, pIdx) => {
                pObj.polygon.forEach((pt, vIdx) => {
                    const vx_screen = ((pt[0] / imgSize.w) * displaySize.w * zoom) + rect.left - containerRect.left;
                    const vy_screen = ((pt[1] / imgSize.h) * displaySize.h * zoom) + rect.top - containerRect.top;
                    if (vx_screen >= minX_s && vx_screen <= maxX_s && vy_screen >= minY_s && vy_screen <= maxY_s) {
                        selVertices.push({ polyIndex: pIdx, vertexIndex: vIdx });
                    }
                });
            });
            setSelectedItems({ points: selPoints, vertices: selVertices });
            return;
        }

        if (draggingPointIndex === null && draggingVertex === null) return;
        hasMoved.current = true;

        const rect = imgRef.current.getBoundingClientRect();
        const x_display = (e.clientX - rect.left) / zoom;
        const y_display = (e.clientY - rect.top) / zoom;
        const x = (x_display / displaySize.w) * imgSize.w;
        const y = (y_display / displaySize.h) * imgSize.h;

        if (draggingPointIndex !== null) {
            const newPoints = [...points];
            newPoints[draggingPointIndex] = { ...newPoints[draggingPointIndex], x, y };
            setPoints(newPoints);
        } else if (draggingVertex !== null) {
            const { polyIndex, vertexIndex } = draggingVertex;
            const newPolygons = [...polygons];
            newPolygons[polyIndex].polygon[vertexIndex] = [x, y];
            setPolygons(newPolygons);
        }
    };

    const handleMouseUpGlobal = () => {
        setIsPanning(false);
        setSelectionBox(null);
        setDraggingPointIndex(null);
        setDraggingVertex(null);
    };

    const saveAnnotation = () => {
        if (!selectedImage || polygons.length === 0) return;
        
        fetch(`/api/save-label?image_name=${selectedImage}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(polygons)
        }).then(() => {
            alert('Labels saved successfully!');
        });
    };

    return (
        <React.Fragment>
            <div className="sidebar">
                <div className="hardware-panel">
                    <div className="theme-toggle" onClick={() => setDarkMode(!darkMode)}>
                        <span className="material-icons" style={{fontSize: '18px'}}>{darkMode ? 'light_mode' : 'dark_mode'}</span>
                        <span>{darkMode ? 'Light Mode' : 'Dark Mode'}</span>
                    </div>
                    {hardware ? (
                        <div>
                            <b>{hardware.gpu_name}</b> ({hardware.vram_gb}GB VRAM)<br/>
                            <button onClick={loadModel} disabled={modelLoading || modelLoaded} style={{marginTop: '0.5rem', width: '100%'}}>
                                {modelLoading ? 'Loading...' : modelLoaded ? 'Model Ready' : 'Load Model'}
                            </button>
                        </div>
                    ) : 'Detecting...'}
                </div>
                <div style={{padding: '1rem', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
                    <b>Images ({images.length})</b>
                    <label style={{cursor: 'pointer', background: 'var(--primary)', color: 'white', padding: '2px 8px', borderRadius: '4px', fontSize: '0.75rem'}}>
                        Add Images
                        <input type="file" multiple accept="image/*" style={{display: 'none'}} onChange={handleFileUpload} />
                    </label>
                </div>
                <div style={{flex: 1, overflowY: 'auto'}}>
                    {images.map(img => (
                        <div key={img} className={`img-item ${selectedImage === img ? 'active' : ''}`} onClick={() => handleImageSelect(img)}>
                            {img}
                        </div>
                    ))}
                </div>

                <div className="help-section">
                    <div className="help-toggle" onClick={() => setHelpVisible(!helpVisible)}>
                        <span>Interactive Help</span>
                        <span className="material-icons" style={{fontSize: '18px'}}>{helpVisible ? 'expand_less' : 'expand_more'}</span>
                    </div>
                    {helpVisible && (
                        <div className="help-content visible">
                            <p><b>Mouse:</b> L-Click: Point/Vertex | R-Click: Neg-Point/Remove | Drag: Move | Shift+Drag: Select | Mid-Click: Pan | Wheel: Zoom</p>
                            <p><b>Keys:</b> Enter: Run SAM | Del: Remove Selected</p>
                        </div>
                    )}
                </div>
            </div>

            <div className="main-content">
                <div className="toolbar">
                    <div className="controls">
                        <button onClick={() => setSamAssist(!samAssist)} style={{background: samAssist ? 'var(--primary)' : 'var(--text-muted)'}}>
                            {samAssist ? 'SAM Assist: ON' : 'SAM Assist: OFF'}
                        </button>
                        <button onClick={runSAM} disabled={!modelLoaded || points.length === 0} style={{background: '#d97706'}}>Run SAM (Enter)</button>
                        <select value={classId} onChange={e => setClassId(parseInt(e.target.value))} style={{padding: '0.5rem', borderRadius: '4px', background: 'var(--toolbar-bg)', color: 'var(--text-main)', border: '1px solid var(--border-color)'}}>
                            {Object.entries(classes).map(([id, name]) => (
                                <option key={id} value={id}>{id}: {name}</option>
                            ))}
                        </select>
                    </div>
                    <div style={{marginLeft: 'auto', display: 'flex', gap: '1rem', alignItems: 'center'}}>
                        {segmenting && <span style={{color: '#d97706', fontSize: '0.875rem', fontWeight: 'bold'}}>Segmenting...</span>}
                        <button onClick={() => {setPoints([]); setPolygons([]);}} style={{background: 'var(--text-muted)'}}>Clear</button>
                        <button onClick={saveAnnotation} disabled={polygons.length === 0 || segmenting}>Save All Labels</button>
                    </div>
                </div>

                <div 
                    ref={containerRef}
                    className="image-container" 
                    onWheel={handleWheel}
                    onMouseMove={handleMouseMove}
                    onMouseDown={handleMouseDown}
                    onMouseUp={handleMouseUpGlobal}
                    onContextMenu={e => e.preventDefault()}
                >

                    {selectedImage ? (
                        <div className="canvas-wrapper" style={{ transform: `translate(${offset.x}px, ${offset.y}px) scale(${zoom})`, transformOrigin: '0 0' }}>
                            <img ref={imgRef} src={`/images/${selectedImage}`} onLoad={handleImgLoad} style={{maxHeight: 'none', maxWidth: 'none', display: 'block'}} />
                            {imgSize.w > 0 && (
                                <svg className="svg-overlay" width={displaySize.w} height={displaySize.h} style={{position: 'absolute', top: 0, left: 0}}>
                                    {polygons.map((pObj, i) => (
                                        <React.Fragment key={i}>
                                            <polygon points={pObj.polygon.map(p => `${(p[0]/imgSize.w)*displaySize.w},${(p[1]/imgSize.h)*displaySize.h}`).join(' ')} fill="rgba(37, 99, 235, 0.4)" stroke="rgba(37, 99, 235, 1)" strokeWidth={2 / zoom} />
                                            {pObj.polygon.map((p, j) => {
                                                const isSelected = selectedItems.vertices.some(sv => sv.polyIndex === i && sv.vertexIndex === j);
                                                return <circle key={`${i}-${j}`} cx={(p[0]/imgSize.w)*displaySize.w} cy={(p[1]/imgSize.h)*displaySize.h} r={(isSelected ? 6 : 4) / zoom} fill={isSelected ? "#fbbf24" : "white"} stroke={isSelected ? "#d97706" : "#2563eb"} strokeWidth={1.5 / zoom} style={{ cursor: 'move' }} />;
                                            })}
                                        </React.Fragment>
                                    ))}
                                    {points.map((p, i) => {
                                        const isSelected = selectedItems.points.includes(i);
                                        return <circle key={i} cx={(p.x/imgSize.w)*displaySize.w} cy={(p.y/imgSize.h)*displaySize.h} r={(isSelected ? 10 : 7) / zoom} fill={isSelected ? "#fbbf24" : (p.label === 1 ? '#22c55e' : '#ef4444')} stroke="white" strokeWidth={2 / zoom} style={{ cursor: 'move', filter: 'drop-shadow(0 2px 3px rgba(0,0,0,0.4))' }} />;
                                    })}
                                </svg>
                            )}
                        </div>
                    ) : <div style={{color: 'var(--text-muted)', textAlign: 'center'}}><h2>Select an image to start</h2></div>}
                    {selectionBox && (
                        <svg style={{position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', pointerEvents: 'none'}}>
                            <rect x={Math.min(selectionBox.x1, selectionBox.x2)} y={Math.min(selectionBox.y1, selectionBox.y2)} width={Math.abs(selectionBox.x2 - selectionBox.x1)} height={Math.abs(selectionBox.y2 - selectionBox.y1)} fill="rgba(37, 99, 235, 0.1)" stroke="#2563eb" strokeDasharray="4" />
                        </svg>
                    )}
                </div>
            </div>
        </React.Fragment>
    );
}

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<App />);
