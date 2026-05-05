import React, { useRef, useState } from "react";
import { Play, Pause, Volume2, VolumeX, Maximize2, RotateCcw } from "lucide-react";

interface VideoPlayerProps {
  src: string;
  title?: string;
  poster?: string;
  /** If provided, renders caption text overlaid on the video for live preview */
  captionOverlay?: {
    text: string;
    fontFamily: string;
    fontSize: number;
    color: string;
    outlineColor: string;
    position: "top" | "center" | "bottom";
    bold: boolean;
  };
  maxHeight?: number;
}

export default function VideoPlayer({ src, title, poster, captionOverlay, maxHeight = 500 }: VideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [showControls, setShowControls] = useState(true);

  const togglePlay = () => {
    if (!videoRef.current) return;
    if (isPlaying) videoRef.current.pause();
    else videoRef.current.play();
    setIsPlaying(!isPlaying);
  };

  const toggleMute = () => {
    if (!videoRef.current) return;
    videoRef.current.muted = !isMuted;
    setIsMuted(!isMuted);
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!videoRef.current) return;
    const t = Number(e.target.value);
    videoRef.current.currentTime = t;
    setCurrentTime(t);
  };

  const handleFullscreen = () => {
    videoRef.current?.requestFullscreen?.();
  };

  const restart = () => {
    if (!videoRef.current) return;
    videoRef.current.currentTime = 0;
    videoRef.current.play();
    setIsPlaying(true);
  };

  const fmt = (t: number) => {
    const m = Math.floor(t / 60);
    const s = Math.floor(t % 60);
    return `${m}:${String(s).padStart(2, "0")}`;
  };

  const captionPositionStyle: React.CSSProperties = captionOverlay ? {
    position: "absolute",
    left: "50%",
    transform: "translateX(-50%)",
    ...(captionOverlay.position === "top" ? { top: 40 } : {}),
    ...(captionOverlay.position === "center" ? { top: "50%", transform: "translate(-50%, -50%)" } : {}),
    ...(captionOverlay.position === "bottom" ? { bottom: 60 } : {}),
    fontFamily: captionOverlay.fontFamily,
    fontSize: captionOverlay.fontSize,
    fontWeight: captionOverlay.bold ? 800 : 400,
    color: captionOverlay.color,
    textShadow: `0 0 4px ${captionOverlay.outlineColor}, 2px 2px 4px ${captionOverlay.outlineColor}, -2px -2px 4px ${captionOverlay.outlineColor}`,
    textAlign: "center",
    maxWidth: "85%",
    lineHeight: 1.3,
    pointerEvents: "none",
    zIndex: 10,
    userSelect: "none",
    letterSpacing: 0.5,
  } : {};

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <div
      style={{
        position: "relative",
        background: "#000",
        borderRadius: 14,
        overflow: "hidden",
        maxHeight,
        border: "1px solid rgba(255,255,255,0.08)",
      }}
      onMouseEnter={() => setShowControls(true)}
      onMouseLeave={() => setShowControls(!isPlaying)}
    >
      {/* Title bar */}
      {title && (
        <div style={{
          position: "absolute", top: 0, left: 0, right: 0, zIndex: 20,
          padding: "12px 16px",
          background: "linear-gradient(to bottom, rgba(0,0,0,0.7), transparent)",
          fontSize: 12, fontWeight: 600, color: "rgba(255,255,255,0.8)",
          fontFamily: "'DM Sans',sans-serif",
          opacity: showControls ? 1 : 0, transition: "opacity 0.3s",
          pointerEvents: "none",
        }}>
          {title}
        </div>
      )}

      {/* Video element */}
      <video
        ref={videoRef}
        src={src}
        poster={poster}
        onClick={togglePlay}
        onTimeUpdate={() => setCurrentTime(videoRef.current?.currentTime || 0)}
        onLoadedMetadata={() => setDuration(videoRef.current?.duration || 0)}
        onEnded={() => setIsPlaying(false)}
        style={{ display: "block", width: "100%", maxHeight, objectFit: "contain", cursor: "pointer" }}
      />

      {/* Caption overlay for live preview */}
      {captionOverlay && (
        <div style={captionPositionStyle}>
          {captionOverlay.text}
        </div>
      )}

      {/* Play button overlay (when paused) */}
      {!isPlaying && (
        <div onClick={togglePlay} style={{
          position: "absolute", top: "50%", left: "50%", transform: "translate(-50%, -50%)",
          width: 60, height: 60, borderRadius: "50%",
          background: "rgba(124,92,252,0.85)", backdropFilter: "blur(8px)",
          display: "flex", alignItems: "center", justifyContent: "center",
          cursor: "pointer", zIndex: 15,
          boxShadow: "0 4px 20px rgba(124,92,252,0.4)",
          transition: "transform 0.15s",
        }}>
          <Play size={24} color="white" fill="white" style={{ marginLeft: 3 }} />
        </div>
      )}

      {/* Bottom controls */}
      <div style={{
        position: "absolute", bottom: 0, left: 0, right: 0, zIndex: 20,
        background: "linear-gradient(to top, rgba(0,0,0,0.8), transparent)",
        padding: "20px 14px 10px",
        opacity: showControls || !isPlaying ? 1 : 0, transition: "opacity 0.3s",
      }}>
        {/* Progress bar */}
        <div style={{ position: "relative", height: 4, background: "rgba(255,255,255,0.1)", borderRadius: 4, marginBottom: 8, cursor: "pointer" }}>
          <div style={{ position: "absolute", top: 0, left: 0, height: "100%", width: `${progress}%`, background: "linear-gradient(90deg, #7C5CFC, #9B7EFF)", borderRadius: 4 }} />
          <input type="range" min={0} max={duration || 0} step={0.1} value={currentTime}
            onChange={handleSeek}
            style={{
              position: "absolute", top: -4, left: 0, width: "100%", height: 12,
              opacity: 0, cursor: "pointer", margin: 0,
            }}
          />
        </div>

        {/* Control buttons */}
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <button onClick={togglePlay} style={ctrlBtn}>
            {isPlaying ? <Pause size={14} /> : <Play size={14} fill="white" />}
          </button>
          <button onClick={restart} style={ctrlBtn}>
            <RotateCcw size={13} />
          </button>
          <button onClick={toggleMute} style={ctrlBtn}>
            {isMuted ? <VolumeX size={14} /> : <Volume2 size={14} />}
          </button>
          <span style={{ fontSize: 11, color: "rgba(255,255,255,0.5)", fontFamily: "'DM Sans',monospace", marginLeft: 4 }}>
            {fmt(currentTime)} / {fmt(duration)}
          </span>
          <button onClick={handleFullscreen} style={{ ...ctrlBtn, marginLeft: "auto" }}>
            <Maximize2 size={13} />
          </button>
        </div>
      </div>
    </div>
  );
}

const ctrlBtn: React.CSSProperties = {
  background: "none", border: "none", color: "white", cursor: "pointer",
  padding: 4, display: "flex", alignItems: "center", justifyContent: "center",
  opacity: 0.8,
};
