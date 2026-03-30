const { useState, useEffect } = React;

function ImageViewer() {
    const [images, setImages] = useState([]);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchImages = () => {
            // Add a timestamp parameter for cache busting
            fetch(`/api/images?t=${new Date().getTime()}`)
                .then(res => res.json())
                .then(data => {
                    setImages(prevImages => {
                        // Compare the actual content to avoid unnecessary state updates
                        const hasChanged = prevImages.length !== data.length || 
                                          prevImages.some((img, idx) => img !== data[idx]);
                        
                        if (hasChanged) {
                            return data;
                        }
                        return prevImages;
                    });
                    setLoading(false);
                })
                .catch(err => {
                    console.error("Error fetching images:", err);
                    setLoading(false);
                });
        };

        fetchImages();
        const interval = setInterval(fetchImages, 2000); // Poll every 2 seconds

        return () => clearInterval(interval);
    }, []);

    const nextImage = () => {
        if (currentIndex < images.length - 1) {
            setCurrentIndex(currentIndex + 1);
        }
    };

    const prevImage = () => {
        if (currentIndex > 0) {
            setCurrentIndex(currentIndex - 1);
        }
    };

    if (loading) {
        return <div className="container"><h1>Loading...</h1></div>;
    }

    if (images.length === 0) {
        return (
            <div className="container">
                <h1>React Image Viewer</h1>
                <div className="viewer-container">
                    <div className="empty-state">
                        No images found in /images folder.<br/>
                        Add some JPG/PNG files to see them here!
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="container">
            <h1>React Image Viewer</h1>
            <div className="viewer-container">
                <img 
                    src={`/images/${images[currentIndex]}`} 
                    alt={images[currentIndex]} 
                />
            </div>
            
            <div className="btn-group">
                <button 
                    onClick={prevImage} 
                    disabled={currentIndex === 0}
                >
                    Previous
                </button>
                <span>{currentIndex + 1} / {images.length}</span>
                <button 
                    onClick={nextImage} 
                    disabled={currentIndex === images.length - 1}
                >
                    Next
                </button>
            </div>
            
            <div className="file-info">
                Viewing: <strong>{images[currentIndex]}</strong>
            </div>
        </div>
    );
}

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<ImageViewer />);
