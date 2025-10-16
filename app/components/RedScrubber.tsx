'use client';

import { useRef, useState } from 'react';

interface RedScrubberProps {
  duration: number; // seconds
  position: number; // seconds
  onScrub: (seconds: number) => void;
  onScrubStart?: (seconds: number) => void;
  onScrubMove?: (seconds: number) => void;
  onScrubEnd?: (seconds: number) => void;
  onPauseDuringDrag?: () => void;
  onResumeAfterDrag?: () => void;
}

export default function RedScrubber({ duration, position, onScrub, onScrubStart, onScrubMove, onScrubEnd, onPauseDuringDrag, onResumeAfterDrag }: RedScrubberProps) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [dragging, setDragging] = useState(false);
  const lastScrubSecRef = useRef<number>(0);
  const [liveScrubSeconds, setLiveScrubSeconds] = useState<number | null>(null);
  const dragStartXRef = useRef<number>(0);
  const dragStartSecondsRef = useRef<number>(0);
  const hasMovedRef = useRef<boolean>(false);

  const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));

  const posToSeconds = (clientX: number) => {
    const el = trackRef.current;
    if (!el || duration <= 0) return 0;
    
    // Get the exact bounds of the track element
    const rect = el.getBoundingClientRect();
    
    // Calculate position relative to the track's left edge
    const relativeX = clientX - rect.left;
    
    // Clamp to track bounds
    const clampedX = clamp(relativeX, 0, rect.width);
    
    // Convert to percentage
    const percentage = rect.width > 0 ? clampedX / rect.width : 0;
    
    // Convert to seconds
    const seconds = clamp(percentage * duration, 0, duration);
    
    return seconds;
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    const target = trackRef.current;
    if (target && target.setPointerCapture) {
      try { target.setPointerCapture(e.pointerId); } catch {}
    }
    setDragging(true);
    hasMovedRef.current = false;
    const secs = posToSeconds(e.clientX);
    console.log(`🎯 CLICK: clientX=${e.clientX}, calculated seconds=${secs.toFixed(2)}`);
    setLiveScrubSeconds(secs);
    onScrubStart && onScrubStart(secs);
    onScrub(secs);
    lastScrubSecRef.current = secs;
    dragStartXRef.current = e.clientX;
    dragStartSecondsRef.current = secs;
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragging) return;
    
    // First movement beyond small threshold -> treat as drag and pause playback
    if (!hasMovedRef.current && Math.abs(e.clientX - dragStartXRef.current) > 3) {
      hasMovedRef.current = true;
      onPauseDuringDrag && onPauseDuringDrag();
    }

    // Always use absolute positioning for simplicity and accuracy
    const secs = posToSeconds(e.clientX);
    setLiveScrubSeconds(secs);
    // During drag, do NOT send seeks to engine to avoid fighting playback
    onScrubMove && onScrubMove(secs);
    lastScrubSecRef.current = secs;
  };

  const endDrag = () => {
    if (dragging) {
      onScrubEnd && onScrubEnd(lastScrubSecRef.current);
      onResumeAfterDrag && onResumeAfterDrag();
    }
    setDragging(false);
    setLiveScrubSeconds(null);
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    const target = trackRef.current;
    if (target && target.releasePointerCapture) {
      try { target.releasePointerCapture(e.pointerId); } catch {}
    }
    endDrag();
  };

  const effectiveSeconds = dragging && liveScrubSeconds !== null
    ? clamp(liveScrubSeconds, 0, duration)
    : clamp(position, 0, duration);
  const percentage = duration > 0 ? effectiveSeconds / duration : 0;

  return (
    <div style={{ width: '100%' }}>
      <div
        ref={trackRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={endDrag}
        style={{
          position: 'relative',
          height: 28,
          borderRadius: 10,
          background: '#F5D7DC',
          cursor: 'pointer',
          userSelect: 'none',
          touchAction: 'none',
          width: '100%',
          maxWidth: '800px',
          margin: '0 auto',
        }}
      >
        <div
          style={{
            position: 'absolute',
            left: 0,
            top: 0,
            bottom: 0,
            width: `${percentage * 100}%`,
            borderRadius: 10,
            background: '#B8001F',
            transition: dragging ? 'none' : 'width 40ms linear',
          }}
        />
        <div
          style={{
            position: 'absolute',
            top: -6,
            left: `calc(${percentage * 100}% - 6px)`,
            width: 12,
            height: 40,
            borderRadius: 6,
            background: '#B8001F',
            boxShadow: '0 1px 2px rgba(0,0,0,0.2)',
            pointerEvents: 'none',
          }}
        />
      </div>
    </div>
  );
}

