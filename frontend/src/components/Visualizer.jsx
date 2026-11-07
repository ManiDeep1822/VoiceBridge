import React, { useEffect, useRef } from 'react';

export default function Visualizer({ isActive, color = 'cyan', isIncoming = false }) {
  const canvasRef = useRef(null);
  const animationFrameRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    let phase = 0;
    const barsCount = 28;

    const render = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      const width = canvas.width;
      const height = canvas.height;
      const barWidth = 3;
      const spacing = (width - barsCount * barWidth) / (barsCount - 1);

      phase += isActive ? 0.12 : 0.02;

      for (let i = 0; i < barsCount; i++) {
        const x = i * (barWidth + spacing);
        const centerDistance = Math.abs(i - barsCount / 2) / (barsCount / 2);
        const bellCurve = Math.cos(centerDistance * (Math.PI / 2));

        let amplitude;
        if (isActive) {
          // Energetic dynamic sine combination
          amplitude = (Math.sin(phase + i * 0.45) * 0.5 + 0.5) * 
                      (Math.cos(phase * 0.7 + i * 0.2) * 0.4 + 0.6) * 
                      (height * 0.75) * bellCurve + 6;
        } else {
          // Subtle idle breathing
          amplitude = Math.sin(phase + i * 0.2) * 3 + 5;
        }

        const y = (height - amplitude) / 2;

        const gradient = ctx.createLinearGradient(0, y, 0, y + amplitude);
        if (isIncoming) {
          // Violet to Pink for Incoming Translated voice
          gradient.addColorStop(0, '#f43f5e');
          gradient.addColorStop(0.5, '#a855f7');
          gradient.addColorStop(1, '#6366f1');
        } else {
          // Cyan to Blue for Local Spoken voice
          gradient.addColorStop(0, '#00f2fe');
          gradient.addColorStop(0.5, '#38bdf8');
          gradient.addColorStop(1, '#0284c7');
        }

        ctx.fillStyle = gradient;
        ctx.beginPath();
        if (typeof ctx.roundRect === 'function') {
          ctx.roundRect(x, y, barWidth, Math.max(amplitude, 3), [2]);
        } else {
          ctx.rect(x, y, barWidth, Math.max(amplitude, 3));
        }
        ctx.fill();
      }

      animationFrameRef.current = requestAnimationFrame(render);
    };

    render();

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [isActive, color, isIncoming]);

  return (
    <canvas
      ref={canvasRef}
      width={160}
      height={48}
      className="w-40 h-12 rounded-lg opacity-90"
    />
  );
}
