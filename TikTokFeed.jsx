import { useState, useRef, useEffect } from 'react';

export default function TikTokFeed({ items, onAddToCart }) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const containerRef = useRef(null);
  const videoRefs = useRef({});

  // Handle scroll to track which slide is visible
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleScroll = () => {
      const slideHeight = container.clientHeight;
      const scrollY = container.scrollTop;
      const newIndex = Math.round(scrollY / slideHeight);
      
      if (newIndex !== currentIndex && newIndex >= 0 && newIndex < items.length) {
        setCurrentIndex(newIndex);
      }
    };

    container.addEventListener('scroll', handleScroll, { passive: true });
    return () => container.removeEventListener('scroll', handleScroll);
  }, [currentIndex, items.length]);

  // Autoplay/pause videos based on visibility
  useEffect(() => {
    Object.entries(videoRefs.current).forEach(([idxStr, video]) => {
      if (!video) return;
      const idx = parseInt(idxStr, 10);
      
      if (idx === currentIndex) {
        // Try to play current video
        const playPromise = video.play();
        if (playPromise !== undefined) {
          playPromise.catch(() => {
            // Auto-play was prevented (often happens before user interaction)
            // We can optionally show an unmute button, but for now we'll just let it fail silently
          });
        }
      } else {
        // Pause other videos
        video.pause();
        video.currentTime = 0;
      }
    });
  }, [currentIndex]);

  const handleVideoRef = (idx) => (el) => {
    videoRefs.current[idx] = el;
  };

  if (!items || items.length === 0) {
    return (
      <div className="empty-state" style={{ height: '100vh', justifyContent: 'center' }}>
        <p>Menu indisponible</p>
      </div>
    );
  }

  return (
    <div className="tiktok-container">
      <div className="tiktok-slides" ref={containerRef}>
        {items.map((item, idx) => (
          <div key={item.id} className="tiktok-slide">
            
            {/* Background Media */}
            {item.video_url ? (
              <video
                ref={handleVideoRef(idx)}
                src={item.video_url}
                className="tiktok-media"
                loop
                muted
                playsInline
                autoPlay={idx === 0}
              />
            ) : item.photo_url ? (
              <img
                src={item.photo_url}
                alt={item.name}
                className="tiktok-media"
                loading={idx === 0 ? "eager" : "lazy"}
              />
            ) : (
              <div className="tiktok-media flex items-center justify-center bg-secondary">
                <span style={{ fontSize: '4rem' }}>🍽️</span>
              </div>
            )}

            {/* Overlay Info */}
            <div className="tiktok-overlay">
              {item.category?.name && (
                <div className="badge badge-accent mb-sm inline-block">
                  {item.category.name}
                </div>
              )}
              <h2 className="tiktok-dish-name">{item.name}</h2>
              <div className="tiktok-dish-price">{item.price.toFixed(2)} FCFA</div>
              {item.description && (
                <p className="tiktok-dish-desc">{item.description}</p>
              )}
            </div>

            {/* Actions (Right Side) */}
            <div className="tiktok-actions">
              <button 
                className="tiktok-action-btn"
                onClick={() => onAddToCart(item)}
              >
                <div style={{ 
                  background: 'var(--accent)', 
                  borderRadius: '50%', 
                  padding: '12px',
                  boxShadow: '0 4px 12px rgba(139,140,62,0.5)'
                }}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" width="24" height="24">
                    <line x1="12" y1="5" x2="12" y2="19" />
                    <line x1="5" y1="12" x2="19" y2="12" />
                  </svg>
                </div>
                <span className="mt-xs font-bold text-sm">Ajouter</span>
              </button>
            </div>

          </div>
        ))}
      </div>
      
      {/* Swipe up indicator (only shown initially) */}
      {currentIndex === 0 && items.length > 1 && (
        <div style={{
          position: 'absolute',
          bottom: '120px',
          left: '50%',
          transform: 'translateX(-50%)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          color: 'white',
          opacity: 0.7,
          animation: 'pulse 2s infinite',
          pointerEvents: 'none',
          zIndex: 4
        }}>
          <span className="text-sm mb-xs">Glisser vers le haut</span>
          <svg viewBox="0 0 24 24" width="24" height="24" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="18 15 12 9 6 15"></polyline>
          </svg>
        </div>
      )}
    </div>
  );
}
