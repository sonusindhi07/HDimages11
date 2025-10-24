import React, { useRef, useState, useCallback } from "react";

const QUALITY_LABELS = {
  good: "WhatsApp HD / Original · Good Quality Photo",
  medium: "WhatsApp SD · Medium Quality Photo",
  low: "WhatsApp · Low Quality Photo",
  other: "Other · Unknown/Blank",
};
const MIN_GOOD_WIDTH = 1920;
const MIN_GOOD_HEIGHT = 1080;
const MIN_GOOD_MP = 2;
const MIN_IMAGE_PX = 1600;

function getTargetSize(width, height) {
  let scaleW = MIN_GOOD_WIDTH / width;
  let scaleH = MIN_GOOD_HEIGHT / height;
  let scaleMinW = MIN_IMAGE_PX / width;
  let scaleMinH = MIN_IMAGE_PX / height;
  let scaleMP = Math.sqrt((MIN_GOOD_MP * 1_000_000) / (width * height));
  const scale = Math.max(scaleW, scaleH, scaleMinW, scaleMinH, scaleMP, 1);
  return {
    width: Math.round(width * scale),
    height: Math.round(height * scale),
  };
}

function getHdFileName(originalName) {
  const lastDot = originalName.lastIndexOf(".");
  if (lastDot > 0) {
    return (
      originalName.substring(0, lastDot) +
      "-hd" +
      originalName.substring(lastDot)
    );
  } else {
    return originalName + "-hd.jpg";
  }
}

function resizeImageToGoodQuality(img, cb, fileName) {
  const { width: targetW, height: targetH } = getTargetSize(
    img.width,
    img.height
  );
  if (!img.width || !img.height) {
    cb(null, 0, 0);
    return;
  }
  const canvas = document.createElement("canvas");
  canvas.width = targetW;
  canvas.height = targetH;
  const ctx = canvas.getContext("2d");
  ctx.drawImage(img, 0, 0, targetW, targetH);
  canvas.toBlob(
    (blob) => {
      cb(blob, targetW, targetH, getHdFileName(fileName));
    },
    "image/jpeg",
    0.95
  );
}

export default function ImageUpscaler() {
  const [images, setImages] = useState([]);
  const [converted, setConverted] = useState({});
  const [processing, setProcessing] = useState(false);
  const [isDragging, setIsDragging] = useState(false); // New state for drag-and-drop visual feedback
  const inputRef = useRef();

  // Only show upload button at first
  const [hasUploaded, setHasUploaded] = useState(false);

  // The core function to process a list of files (from input or drop)
  const handleFiles = useCallback((fileList) => {
    // Filter to only include image files
    const imageFiles = Array.from(fileList).filter(file => file.type.startsWith('image/'));
    
    if (imageFiles.length === 0) return;

    setImages([]);
    setConverted({});
    setProcessing(true);
    setHasUploaded(true);
    
    let loaded = 0;
    let imageInfos = [];
    imageFiles.forEach((file, idx) => {
      const img = new window.Image();
      img.onload = () => {
        const width = img.width;
        const height = img.height;
        // Unique ID for the image
        const id = `${file.name}_${file.size}_${file.lastModified}`;
        const src = URL.createObjectURL(file);
        const { width: newWidth, height: newHeight } = getTargetSize(
          width,
          height
        );

        imageInfos[idx] = {
          file,
          src,
          width,
          height,
          id,
          newWidth,
          newHeight,
          fileName: file.name,
        };

        const autoImg = new window.Image();
        autoImg.onload = () => {
          resizeImageToGoodQuality(
            autoImg,
            (blob, w, h, hdName) => {
              setConverted((prev) => ({
                ...prev,
                [id]: {
                  src: URL.createObjectURL(blob),
                  width: w,
                  height: h,
                  blob,
                  name: hdName,
                },
              }));
              
              // After conversion, check if all files have been loaded and processed
              loaded += 1;
              if (loaded === imageFiles.length) {
                setImages(imageInfos.filter(info => !info.error)); // Only show successful loads
                setProcessing(false);
              }
            },
            file.name
          );
        };
        autoImg.onerror = () => {
          // If the conversion Image load fails
          imageInfos[idx] = {
            error: "Failed to load image for processing.",
            file,
            id: `${file.name}_${file.size}_${file.lastModified}`,
          };
          loaded += 1;
          if (loaded === imageFiles.length) {
            setImages(imageInfos.filter(info => !info.error));
            setProcessing(false);
          }
        };
        autoImg.src = src;

        // The image object for dimension reading is already loaded, no need to wait again
      };
      img.onerror = () => {
        imageInfos[idx] = {
          error: "Failed to load image.",
          file,
          id: `${file.name}_${file.size}_${file.lastModified}`,
        };
        loaded += 1;
        if (loaded === imageFiles.length) {
          setImages(imageInfos.filter(info => !info.error));
          setProcessing(false);
        }
      };
      img.src = URL.createObjectURL(file);
    });
  }, []);
  
  // --- New Drag-and-Drop Handlers ---
  const handleDragEnter = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.dataTransfer.items && e.dataTransfer.items.length > 0) {
      setIsDragging(true);
    }
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (!isDragging) setIsDragging(true); // Ensure drag state is true during the drag
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFiles(e.dataTransfer.files);
      e.dataTransfer.clearData();
    }
  };
  // ------------------------------------

  const handleDownloadAllConverted = () => {
    images.forEach((img) => {
      const conv = converted[img.id];
      if (!conv || !conv.src) return;
      const a = document.createElement("a");
      a.href = conv.src;
      a.download = conv.name;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    });
  };

  const handleNewImageClick = () => {
    setImages([]);
    setConverted({});
    setHasUploaded(false);
    // Important: Reset the file input value so that selecting the same file(s) again triggers onChange
    if (inputRef.current) {
        inputRef.current.value = '';
    }
  };

  // Define the base style and the drag-over style
  const baseStyle = {
    margin: "40px auto",
    fontFamily: "Inter,Segoe UI,Arial,sans-serif",
    background: "#fff",
    borderRadius: 16,
    boxShadow: "0 8px 32px #0001, 0 1.5px 7px #1976d211",
    padding: "32px 22px 40px 22px",
    transition: "box-shadow 0.3s, border 0.3s",
    border: '3px dashed transparent', // Base border
  };

  const dragOverStyle = {
    border: '3px dashed #1976d2', // Drag-over visual feedback
    boxShadow: "0 8px 32px #1976d222, 0 1.5px 7px #1976d211",
  };
  
  return (
    <div
      style={{ ...baseStyle, ...(isDragging ? dragOverStyle : {}) }}
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      <div style={{ textAlign: "center", color: "#607d8b" }}>
        Drop files anywhere in this box or use the button below.
      </div>

      {/* Only show upload button at first */}
      {!hasUploaded && (
        <div style={{ marginBottom: 28, textAlign: "center", marginTop: 10 }}>
          <button
            style={{
              padding: "13px 32px",
              background: "#1976d2",
              color: "#fff",
              border: "none",
              borderRadius: 7,
              fontWeight: 600,
              fontSize: 18,
              boxShadow: "0 1.5px 8px #1976d222",
              cursor: "pointer",
              marginRight: 14,
            }}
            onClick={() => inputRef.current && inputRef.current.click()}
          >
            Upload Images
          </button>
          {/* Key change: 'multiple' attribute is present, making multi-selection possible on all devices */}
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            multiple
            style={{ display: "none" }}
            onChange={(e) => handleFiles(e.target.files)}
          />
        </div>
      )}
      {hasUploaded && (
        <>
          <div
            style={{
              marginTop: 12,
              marginBottom: 16,
              display: "flex",
              gap: 10,
              flexWrap: "wrap",
            }}
          >
            <button
              style={{
                padding: "10px 22px",
                background: "#388e3c",
                color: "#fff",
                border: "none",
                borderRadius: 6,
                fontWeight: "bold",
                fontSize: 17,
                boxShadow: "0 1.5px 8px #388e3c22",
                cursor: images.length === 0 || processing ? "not-allowed" : "pointer",
                opacity: images.length === 0 || processing ? 0.7 : 1,
              }}
              onClick={handleDownloadAllConverted}
              disabled={images.length === 0 || processing}
            >
              Download All Images
            </button>
            <button
              style={{
                padding: "10px 22px",
                background: "#1976d2",
                color: "#fff",
                border: "none",
                borderRadius: 6,
                fontWeight: "bold",
                fontSize: 17,
                boxShadow: "0 1.5px 8px #1976d222",
                cursor: "pointer",
              }}
              onClick={handleNewImageClick}
            >
              New Image
            </button>
            <button
            style={{
                padding: "10px 22px",
                background: "#607d8b",
                color: "#fff",
                border: "none",
                borderRadius: 6,
                fontWeight: "bold",
                fontSize: 17,
                boxShadow: "0 1.5px 8px #607d8b22",
                cursor: "pointer",
            }}
            onClick={() => inputRef.current && inputRef.current.click()}
            >
            Add More
            </button>
            <input
              ref={inputRef}
              type="file"
              accept="image/*"
              multiple
              style={{ display: "none" }}
              onChange={(e) => handleFiles(e.target.files)}
            />
          </div>
          {processing && (
            <div
              style={{
                color: "#1976d2",
                fontWeight: 600,
                fontSize: 18,
                margin: "36px 0 10px 0",
              }}
            >
              Processing images...
            </div>
          )}
          <div style={{ display: "flex", flexWrap: "wrap", gap: 24 }}>
            {images.map((img, idx) => (
              <div
                key={img.id}
                style={{
                  width: 270,
                  border: "1.5px solid #e3e6ea",
                  borderRadius: 10,
                  boxShadow: "0 3px 8px #1976d211",
                  padding: 18,
                  marginBottom: 28,
                  background: "#f9fbfc",
                  transition: "box-shadow 0.12s",
                  position: "relative",
                }}
              >
                {img.error ? (
                  <div style={{ color: "red" }}>{img.error}</div>
                ) : (
                  <>
                    <img
                      src={img.src}
                      alt="preview"
                      style={{
                        maxWidth: 220,
                        maxHeight: 170,
                        display: "block",
                        margin: "0 auto 12px auto",
                        border: "1.5px solid #cfd8dc",
                        background: "#f8f8f8",
                        borderRadius: 5,
                        boxShadow: "0 1px 4px #1976d211",
                      }}
                    />
                    <div
                      style={{
                        marginBottom: 4,
                        fontSize: 14,
                        color: "#37474f",
                      }}
                    >
                      <b>Current Resolution:</b> {img.width} × {img.height}
                    </div>
                    <div
                      style={{
                        marginBottom: 4,
                        fontSize: 14,
                        color: "#37474f",
                      }}
                    >
                      <b>New Resolution:</b> {img.newWidth} × {img.newHeight}
                    </div>
                    {converted[img.id] && (
                        <a
                            href={converted[img.id].src}
                            download={converted[img.id].name}
                            style={{
                                display: 'block',
                                textAlign: 'center',
                                marginTop: 10,
                                padding: '8px 16px',
                                background: '#388e3c',
                                color: '#fff',
                                textDecoration: 'none',
                                borderRadius: 5,
                                fontWeight: 500,
                                fontSize: 15,
                            }}
                        >
                            Download {converted[img.id].name}
                        </a>
                    )}
                  </>
                )}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
