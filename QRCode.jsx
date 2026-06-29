import { useState, useRef, useEffect } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { useAuth } from '../contexts/AuthContext';

export default function QRCodePage() {
  const { restaurant } = useAuth();
  const [qrUrl, setQrUrl] = useState('');
  const qrRef = useRef(null);

  useEffect(() => {
    if (restaurant?.code) {
      // Create URL pointing to the customer menu route
      const url = `${window.location.origin}/menu/${restaurant.code}`;
      setQrUrl(url);
    }
  }, [restaurant]);

  function handleDownload() {
    if (!qrRef.current) return;
    
    // We need to convert SVG to canvas to download as PNG
    const svg = qrRef.current.querySelector('svg');
    const svgData = new XMLSerializer().serializeToString(svg);
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const img = new Image();
    
    // Create a white background for the PNG
    canvas.width = 1000;
    canvas.height = 1000;
    
    img.onload = () => {
      ctx.fillStyle = 'white';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      // Draw QR centered
      ctx.drawImage(img, 100, 100, 800, 800);
      
      const pngFile = canvas.toDataURL('image/png');
      const downloadLink = document.createElement('a');
      downloadLink.download = `QR_${restaurant?.name || 'Cadence'}.png`;
      downloadLink.href = `${pngFile}`;
      downloadLink.click();
    };
    
    img.src = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svgData)));
  }

  function handlePrint() {
    window.print();
  }

  if (!restaurant) return null;

  return (
    <div className="animate-fade-in qr-container">
      <div className="page-header text-center" style={{ width: '100%' }}>
        <h1 className="page-title">Votre QR Code</h1>
        <p className="page-subtitle">À afficher sur vos tables</p>
      </div>

      <div className="qr-card" ref={qrRef}>
        {qrUrl && (
          <QRCodeSVG 
            value={qrUrl}
            size={250}
            level="H"
            includeMargin={true}
            imageSettings={{
              src: "/icons/icon-192.png",
              x: undefined,
              y: undefined,
              height: 50,
              width: 50,
              excavate: true,
            }}
          />
        )}
        <h2 className="qr-restaurant-name">{restaurant.name}</h2>
        <p className="qr-instructions">Scannez ce code pour voir notre menu et commander</p>
      </div>

      <div className="flex gap-md mt-lg" style={{ width: '100%', maxWidth: '300px' }}>
        <button className="btn btn-primary btn-full" onClick={handleDownload}>
          Télécharger PNG
        </button>
        <button className="btn btn-secondary btn-full" onClick={handlePrint}>
          Imprimer
        </button>
      </div>

      <style>{`
        @media print {
          body * { visibility: hidden; }
          .qr-container, .qr-container * { visibility: visible; }
          .qr-container { position: absolute; left: 0; top: 0; width: 100%; padding: 0; }
          .btn { display: none; }
          .page-header { display: none; }
          .qr-card { box-shadow: none; margin: 0 auto; padding-top: 50px; }
        }
      `}</style>
    </div>
  );
}
