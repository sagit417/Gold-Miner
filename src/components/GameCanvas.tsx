import React, { useEffect, useRef } from 'react';
import { GameEngine } from '../game/GameEngine';

interface GameCanvasProps {
  engine: GameEngine;
}

const GameCanvas: React.FC<GameCanvasProps> = ({ engine }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const resize = () => {
      canvas.width = container.clientWidth;
      canvas.height = container.clientHeight;
      engine.setDimensions(canvas.width, canvas.height);
    };
    window.addEventListener('resize', resize);
    resize();

    let animationFrameId: number;
    let lastTime = performance.now();

    const drawItem = (ctx: CanvasRenderingContext2D, item: any) => {
      ctx.save();
      ctx.translate(item.x, item.y);
      if (item.type === 'Nugget') {
        // Gold Nugget
        ctx.fillStyle = item.color;
        ctx.shadowColor = '#fff';
        ctx.shadowBlur = 15;
        ctx.beginPath();
        ctx.moveTo(-item.width/2, 0);
        ctx.lineTo(-item.width/4, -item.height/2);
        ctx.lineTo(item.width/4, -item.height/2);
        ctx.lineTo(item.width/2, 0);
        ctx.lineTo(item.width/4, item.height/2);
        ctx.lineTo(-item.width/4, item.height/2);
        ctx.closePath();
        ctx.fill();
        ctx.shadowBlur = 0;
        // Highlight
        ctx.fillStyle = 'rgba(255,255,255,0.4)';
        ctx.beginPath();
        ctx.arc(-item.width/4, -item.height/4, item.width/8, 0, Math.PI * 2);
        ctx.fill();
      } else if (item.type === 'Coin') {
        // Gold Coin
        ctx.fillStyle = item.color;
        ctx.shadowColor = '#ffaa00';
        ctx.shadowBlur = 10;
        ctx.beginPath();
        ctx.arc(0, 0, item.width/2, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#cc9900';
        ctx.beginPath();
        ctx.arc(0, 0, item.width/2 - 2, 0, Math.PI * 2);
        ctx.stroke();
      } else if (item.type === 'Rock') {
        // Gray Rock
        ctx.fillStyle = item.color;
        ctx.beginPath();
        ctx.ellipse(0, 0, item.width/2, item.height/2, Math.PI/4, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#666';
        ctx.beginPath();
        ctx.ellipse(-item.width/6, -item.height/6, item.width/6, item.height/6, 0, 0, Math.PI * 2);
        ctx.fill();
      } else if (item.type === 'Mystery') {
        // Bag
        ctx.fillStyle = item.color;
        ctx.beginPath();
        ctx.moveTo(-item.width/3, -item.height/2);
        ctx.lineTo(item.width/3, -item.height/2);
        ctx.lineTo(item.width/2, item.height/2);
        ctx.lineTo(-item.width/2, item.height/2);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = '#00ff00';
        ctx.font = 'bold 24px Outfit';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('?', 0, 5);
      }
      ctx.restore();
    };

    const render = (time: number) => {
      const dt = time - lastTime;
      lastTime = time;

      engine.update(dt);
      const state = engine.state;

      // Clear canvas
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Draw items
      state.items.forEach(item => {
        if (!item.grabbed) {
          drawItem(ctx, item);
        }
      });

      // Draw hook and line
      ctx.save();
      const mx = state.minerPos.x;
      const my = state.minerPos.y;
      
      const hx = mx + Math.cos(state.hookAngle) * state.hookLength;
      const hy = my + Math.sin(state.hookAngle) * state.hookLength;

      // Draw Line
      ctx.strokeStyle = '#aaaaaa';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(mx, my);
      ctx.lineTo(hx, hy);
      ctx.stroke();

      // Draw Claw
      ctx.translate(hx, hy);
      ctx.rotate(state.hookAngle - Math.PI/2);
      ctx.strokeStyle = '#cccccc';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(-10, -5);
      ctx.lineTo(-15, 10);
      ctx.lineTo(-5, 15);
      ctx.moveTo(10, -5);
      ctx.lineTo(15, 10);
      ctx.lineTo(5, 15);
      ctx.stroke();
      ctx.fillStyle = '#555';
      ctx.fillRect(-10, -5, 20, 10);
      ctx.restore();

      // Draw grabbed item
      if (state.grabbedItem) {
        drawItem(ctx, state.grabbedItem);
      }

      animationFrameId = requestAnimationFrame(render);
    };

    animationFrameId = requestAnimationFrame(render);

    const handleClick = () => {
      engine.fire();
    };
    canvas.addEventListener('mousedown', handleClick);
    canvas.addEventListener('touchstart', (e) => { e.preventDefault(); handleClick(); });

    return () => {
      window.removeEventListener('resize', resize);
      canvas.removeEventListener('mousedown', handleClick);
      cancelAnimationFrame(animationFrameId);
    };
  }, [engine]);

  return (
    <div ref={containerRef} className="play-field-container">
      <canvas ref={canvasRef} />
    </div>
  );
};

export default GameCanvas;
