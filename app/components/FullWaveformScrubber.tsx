'use client';

import { useEffect, useRef, useState } from 'react';

interface FullWaveformScrubberProps {
  buffer: AudioBuffer;
  duration: number;
  position: number;
  bpm?: number;
  onScrub: (seconds: number) => void;
}

const FullWaveformScrubber: React.FC<FullWaveformScrubberProps> = ({
  buffer,
  duration,
  position,
  bpm = 120,
  onScrub,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [dragging, setDragging] = useState(false);
  const [dragX, setDragX] = useState<number | null>(null);

  const displayWidth = 640;
  const height = 80;

  const hasValidBpm = bpm && !isNaN(bpm) && bpm > 0;
  const totalBars = hasValidBpm ? Math.floor((duration * bpm) / 60) : 32;
  const barWidth = displayWidth / totalBars;

  const drawWaveform = () => {
    const canvas = canvasRef.current;
    if (!canvas || !buffer) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width = displayWidth;
    canvas.height = height;

    const data = buffer.getChannelData(0);
    const step = Math.max(1, Math.floor(data.length / displayWidth));
    const amp = height / 2;

    ctx.clearRect(0, 0, displayWidth, height);

    // waveform
    ctx.fillStyle = '#ccc';
    for (let i = 0; i < displayWidth; i++) {
      let min = 1.0;
      let max = -1.0;
      for (let j = 0; j < step; j++) {
        const val = data[i * step + j];
        if (val < min) min = val;
        if (val > max) max = val;
      }
      ctx.fillRect(i, (1 + min) * amp, 1, Math.max(1, (max - min) * amp));
    }

    // bar lines
    if (hasValidBpm) {
      ctx.strokeStyle = '#eee';
      for (let i = 0; i < totalBars; i++) {
        const x = i * barWidth;
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
        ctx.stroke();
      }
    }

    // drag preview
    if (dragX !== null) {
      ctx.fillStyle = 'rgba(255, 0, 0, 0.25)';
      ctx.fillRect(dragX, 0, barWidth, height);

      ctx.strokeStyle = 'red';
      ctx.lineWidth = 2;
      ctx.strokeRect(dragX, 0, barWidth, height);
    }

    // playhead
    const playheadX = (position / duration) * displayWidth;
    ctx.strokeStyle = 'black';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(playheadX, 0);
    ctx.lineTo(playheadX, height);
    ctx.stroke();
  };

  useEffect(() => {
    drawWaveform();
  }, [buffer, dragX, position]);

  const handleMouseDown = (e: React.MouseEvent) => {
    setDragging(true);
    updateDragX(e.nativeEvent.offsetX);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (dragging) updateDragX(e.nativeEvent.offsetX);
  };

  const handleMouseUp = () => {
    if (dragX !== null) {
      const percent = dragX / displayWidth;
      const newTime = percent * duration;
      onScrub(newTime);
    }
    setDragging(false);
    setDragX(null);
  };

  const updateDragX = (x: number) => {
    const snapped = hasValidBpm
      ? Math.floor(x / barWidth) * barWidth
      : x;
    setDragX(snapped);
  };

  return (
    <div style={{ width: displayWidth, margin: '0 auto', paddingBottom: '8px' }}>
      <canvas
        ref={canvasRef}
        style={{
          width: displayWidth,
          height,
          cursor: 'pointer',
          background: '#f9f9f9',
          borderBottom: '1px solid #ccc',
        }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      />
    </div>
  );
};

export default FullWaveformScrubber;
