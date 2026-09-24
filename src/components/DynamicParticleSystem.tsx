import React, { useEffect, useRef } from 'react';
import { GameMode } from '../types';

interface DynamicParticleSystemProps {
  gameMode: GameMode;
  isCorrect: boolean | null;
  gameWon?: boolean;
  gameOver?: boolean;
  combo?: number;
  raceProgress?: number;
  shopCartTotal?: number;
  questionIndex?: number;
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  maxSize: number;
  color: string;
  alpha: number;
  decay: number;
  life: number;
  maxLife: number;
  rotation: number;
  rotationSpeed: number;
  type: 'dust' | 'spark' | 'star' | 'coin' | 'shockwave' | 'ember' | 'confetti';
  gravity: number;
  drag: number;
  extra?: {
    aspect?: number;
    color2?: string;
    radius?: number;
    maxRadius?: number;
  };
}

export const DynamicParticleSystem: React.FC<DynamicParticleSystemProps> = ({
  gameMode,
  isCorrect,
  gameWon = false,
  gameOver = false,
  combo = 0,
  raceProgress = 0,
  shopCartTotal = 0,
  questionIndex = 0,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const particlesRef = useRef<Particle[]>([]);
  const animFrameRef = useRef<number | null>(null);
  const lastTimeRef = useRef<number>(performance.now());
  const prevIsCorrectRef = useRef<boolean | null>(null);
  const prevGameWonRef = useRef<boolean>(false);
  const prevQuestionIndexRef = useRef<number>(questionIndex);

  // Helper to spawn a particle
  const addParticle = (p: Particle) => {
    if (particlesRef.current.length < 450) {
      particlesRef.current.push(p);
    }
  };

  // 1. DUST PUFF EMITTER (Running & Step impacts)
  const spawnDustPuff = (x: number, y: number, intensity: number = 1.0, direction: number = 1) => {
    const count = Math.floor(6 * intensity);
    for (let i = 0; i < count; i++) {
      const angle = Math.PI + (Math.random() - 0.5) * 0.9 + (direction > 0 ? 0.3 : -0.3);
      const speed = (1.5 + Math.random() * 3.5) * intensity;
      const gray = Math.floor(180 + Math.random() * 45);
      const color = Math.random() > 0.4 
        ? `rgba(${gray}, ${gray - 20}, ${gray - 45}, `
        : `rgba(214, 180, 140, `; // sandy dirt

      addParticle({
        x: x + (Math.random() - 0.5) * 24,
        y: y + (Math.random() - 0.5) * 12,
        vx: Math.cos(angle) * speed,
        vy: -Math.abs(Math.sin(angle) * speed) * 0.7 - Math.random() * 1.2,
        size: 5 + Math.random() * 9,
        maxSize: 18 + Math.random() * 22 * intensity,
        color,
        alpha: 0.65,
        decay: 0.018 + Math.random() * 0.015,
        life: 1.0,
        maxLife: 1.0,
        rotation: Math.random() * Math.PI * 2,
        rotationSpeed: (Math.random() - 0.5) * 0.06,
        type: 'dust',
        gravity: -0.015, // slight billow upward
        drag: 0.94,
      });
    }
  };

  // 2. SHOP SPARK EMITTER (Gold coin glints & trade stars)
  const spawnShopSparks = (x: number, y: number, count: number = 12) => {
    const goldTones = ['#fbbf24', '#f59e0b', '#fef08a', '#d97706', '#ffffff'];
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 2.0 + Math.random() * 6.0;
      const color = goldTones[Math.floor(Math.random() * goldTones.length)];

      addParticle({
        x: x + (Math.random() - 0.5) * 40,
        y: y + (Math.random() - 0.5) * 30,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 1.8,
        size: 2 + Math.random() * 4,
        maxSize: 6,
        color,
        alpha: 1.0,
        decay: 0.022 + Math.random() * 0.02,
        life: 1.0,
        maxLife: 1.0,
        rotation: Math.random() * Math.PI,
        rotationSpeed: (Math.random() - 0.5) * 0.2,
        type: Math.random() > 0.4 ? 'spark' : 'star',
        gravity: 0.12,
        drag: 0.96,
      });
    }

    // Golden Shockwave Ring
    addParticle({
      x,
      y,
      vx: 0,
      vy: 0,
      size: 4,
      maxSize: 70,
      color: '#f59e0b',
      alpha: 0.9,
      decay: 0.035,
      life: 1.0,
      maxLife: 1.0,
      rotation: 0,
      rotationSpeed: 0,
      type: 'shockwave',
      gravity: 0,
      drag: 1,
      extra: { radius: 10, maxRadius: 85 },
    });
  };

  // 3. COMBAT CLASH IMPACT (Sword strike & boulder impact)
  const spawnCombatImpact = (x: number, y: number, isHeroStrike: boolean) => {
    const sparkCount = isHeroStrike ? 35 : 28;
    const colors = isHeroStrike 
      ? ['#38bdf8', '#0284c7', '#ffffff', '#e0f2fe', '#facc15'] // Plasma slash
      : ['#ea580c', '#f97316', '#78350f', '#451a03', '#facc15']; // Magma rock

    // High velocity sparks with directional spray
    for (let i = 0; i < sparkCount; i++) {
      const spread = isHeroStrike ? 1.6 : Math.PI * 2;
      const baseAngle = isHeroStrike ? -0.2 : 0;
      const angle = baseAngle + (Math.random() - 0.5) * spread;
      const speed = 4.5 + Math.random() * 9.5;
      const color = colors[Math.floor(Math.random() * colors.length)];

      addParticle({
        x: x + (Math.random() - 0.5) * 20,
        y: y + (Math.random() - 0.5) * 20,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 1.5,
        size: 2 + Math.random() * 4,
        maxSize: 6,
        color,
        alpha: 1.0,
        decay: 0.028 + Math.random() * 0.025,
        life: 1.0,
        maxLife: 1.0,
        rotation: angle,
        rotationSpeed: 0,
        type: 'spark',
        gravity: 0.22,
        drag: 0.94,
      });
    }

    // Impact Shockwave
    addParticle({
      x,
      y,
      vx: 0,
      vy: 0,
      size: 4,
      maxSize: 110,
      color: isHeroStrike ? '#38bdf8' : '#f97316',
      alpha: 1.0,
      decay: 0.045,
      life: 1.0,
      maxLife: 1.0,
      rotation: 0,
      rotationSpeed: 0,
      type: 'shockwave',
      gravity: 0,
      drag: 1,
      extra: { radius: 15, maxRadius: 120 },
    });
  };

  // 4. VICTORY EXPLOSION (Multi-stage fireworks, confetti bursts, side cannons, falling star rain)
  const spawnVictoryExplosion = (w: number, h: number) => {
    const burstCenters = [
      { x: w * 0.28, y: h * 0.38 },
      { x: w * 0.72, y: h * 0.38 },
      { x: w * 0.5, y: h * 0.28 },
      { x: w * 0.38, y: h * 0.5 },
      { x: w * 0.62, y: h * 0.5 },
    ];

    const partyColors = ['#fbbf24', '#38bdf8', '#ec4899', '#22c55e', '#a855f7', '#f97316', '#ffffff', '#facc15'];

    // Radial explosive firework bursts
    burstCenters.forEach((center, idx) => {
      setTimeout(() => {
        // Shockwave
        addParticle({
          x: center.x,
          y: center.y,
          vx: 0,
          vy: 0,
          size: 8,
          maxSize: 220,
          color: partyColors[idx % partyColors.length],
          alpha: 1.0,
          decay: 0.022,
          life: 1.0,
          maxLife: 1.0,
          rotation: 0,
          rotationSpeed: 0,
          type: 'shockwave',
          gravity: 0,
          drag: 1,
          extra: { radius: 25, maxRadius: 220 },
        });

        // 80 radiant sparkles, golden stars and confetti
        for (let i = 0; i < 80; i++) {
          const angle = Math.random() * Math.PI * 2;
          const speed = 5.0 + Math.random() * 12.0;
          const color = partyColors[Math.floor(Math.random() * partyColors.length)];

          addParticle({
            x: center.x,
            y: center.y,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed - 3.2,
            size: 4 + Math.random() * 7,
            maxSize: 12,
            color,
            alpha: 1.0,
            decay: 0.012 + Math.random() * 0.01,
            life: 1.0,
            maxLife: 1.0,
            rotation: Math.random() * Math.PI * 2,
            rotationSpeed: (Math.random() - 0.5) * 0.3,
            type: Math.random() > 0.4 ? 'confetti' : 'star',
            gravity: 0.15,
            drag: 0.97,
            extra: { aspect: 0.35 + Math.random() * 0.65 },
          });
        }
      }, idx * 220);
    });

    // Upward side mortar cannons shooting celebratory flares
    [0.08, 0.92].forEach((xRatio, cIdx) => {
      setTimeout(() => {
        for (let p = 0; p < 45; p++) {
          const angle = (xRatio < 0.5 ? -Math.PI * 0.32 : -Math.PI * 0.68) + (Math.random() - 0.5) * 0.45;
          const speed = 8.0 + Math.random() * 9.0;
          addParticle({
            x: w * xRatio,
            y: h * 0.92,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed,
            size: 4 + Math.random() * 5,
            maxSize: 10,
            color: partyColors[Math.floor(Math.random() * partyColors.length)],
            alpha: 1.0,
            decay: 0.015,
            life: 1.0,
            maxLife: 1.0,
            rotation: Math.random() * Math.PI * 2,
            rotationSpeed: (Math.random() - 0.5) * 0.2,
            type: 'confetti',
            gravity: 0.18,
            drag: 0.98,
            extra: { aspect: 0.4 },
          });
        }
      }, cIdx * 150 + 100);
    });

    // Cascading confetti rain from top of screen across full width
    for (let r = 0; r < 55; r++) {
      setTimeout(() => {
        addParticle({
          x: Math.random() * w,
          y: -10,
          vx: (Math.random() - 0.5) * 2.5,
          vy: 2.2 + Math.random() * 3.5,
          size: 5 + Math.random() * 6,
          maxSize: 12,
          color: partyColors[Math.floor(Math.random() * partyColors.length)],
          alpha: 1.0,
          decay: 0.008,
          life: 1.0,
          maxLife: 1.0,
          rotation: Math.random() * Math.PI * 2,
          rotationSpeed: (Math.random() - 0.5) * 0.25,
          type: Math.random() > 0.3 ? 'confetti' : 'star',
          gravity: 0.08,
          drag: 0.985,
          extra: { aspect: 0.35 + Math.random() * 0.6 },
        });
      }, r * 35);
    }
  };

  // React to Game Events
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const w = canvas.width;
    const h = canvas.height;

    // Victory triggered
    if (gameWon && !prevGameWonRef.current) {
      spawnVictoryExplosion(w, h);
    }
    prevGameWonRef.current = gameWon;

    // isCorrect state change
    if (isCorrect !== null && isCorrect !== prevIsCorrectRef.current) {
      if (gameMode === 'race') {
        // High-velocity dust burst behind runner
        const runnerX = w * 0.5;
        const runnerY = h * 0.72;
        spawnDustPuff(runnerX, runnerY, isCorrect ? 3.5 : 1.8, 1);
        if (isCorrect) {
          // Speed streak sparks
          for (let s = 0; s < 18; s++) {
            addParticle({
              x: runnerX + (Math.random() - 0.5) * 60,
              y: runnerY - Math.random() * 40,
              vx: (Math.random() - 0.5) * 8,
              vy: -2 - Math.random() * 6,
              size: 2 + Math.random() * 3,
              maxSize: 5,
              color: '#38bdf8',
              alpha: 1,
              decay: 0.03,
              life: 1,
              maxLife: 1,
              rotation: 0,
              rotationSpeed: 0,
              type: 'spark',
              gravity: 0.1,
              drag: 0.95,
            });
          }
        }
      } else if (gameMode === 'shop') {
        const counterX = w * 0.5;
        const counterY = h * 0.58;
        spawnShopSparks(counterX, counterY, isCorrect ? 30 : 10);
      } else if (gameMode === 'battle') {
        const clashX = isCorrect ? w * 0.62 : w * 0.38;
        const clashY = h * 0.56;
        spawnCombatImpact(clashX, clashY, isCorrect);
      } else if (gameMode === 'bridge') {
        // Wood chips & golden bridge energy
        const bx = w * 0.5;
        const by = h * 0.68;
        for (let i = 0; i < 22; i++) {
          const angle = Math.random() * Math.PI * 2;
          const speed = 2 + Math.random() * 5;
          addParticle({
            x: bx + (Math.random() - 0.5) * 80,
            y: by,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed - 1.5,
            size: 3 + Math.random() * 4,
            maxSize: 7,
            color: Math.random() > 0.5 ? '#f59e0b' : '#92400e',
            alpha: 1,
            decay: 0.025,
            life: 1,
            maxLife: 1,
            rotation: Math.random() * Math.PI,
            rotationSpeed: 0.1,
            type: 'spark',
            gravity: 0.18,
            drag: 0.95,
          });
        }
      } else if (gameMode === 'detective') {
        // Holographic rune decipher sparks
        const dx = w * 0.55;
        const dy = h * 0.5;
        for (let i = 0; i < 24; i++) {
          const angle = Math.random() * Math.PI * 2;
          const speed = 2 + Math.random() * 4;
          addParticle({
            x: dx + (Math.random() - 0.5) * 50,
            y: dy + (Math.random() - 0.5) * 50,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed - 1,
            size: 3 + Math.random() * 4,
            maxSize: 6,
            color: '#a855f7',
            alpha: 1,
            decay: 0.02,
            life: 1,
            maxLife: 1,
            rotation: Math.random() * Math.PI,
            rotationSpeed: 0.08,
            type: 'star',
            gravity: 0.02,
            drag: 0.98,
          });
        }
      }
    }
    prevIsCorrectRef.current = isCorrect;
  }, [isCorrect, gameWon, gameMode]);

  // Main Canvas Render & Continuous Ambient Emission Loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let running = true;
    let stepTimer = 0;

    const resize = () => {
      if (!canvas.parentElement) return;
      const rect = canvas.parentElement.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      ctx.scale(dpr, dpr);
    };

    resize();
    window.addEventListener('resize', resize);

    const renderLoop = (now: number) => {
      if (!running) return;
      const dt = Math.min(0.05, (now - lastTimeRef.current) / 1000);
      lastTimeRef.current = now;

      const w = canvas.width / (window.devicePixelRatio || 1);
      const h = canvas.height / (window.devicePixelRatio || 1);

      ctx.clearRect(0, 0, w, h);

      // Continuous ambient emissions per game mode:
      stepTimer += dt;
      if (gameMode === 'race' && !gameOver && !gameWon) {
        // Continuous footstep dust puff every 0.16s
        if (stepTimer > 0.16) {
          stepTimer = 0;
          const footOffset = (Math.sin(now * 0.015) > 0 ? 1 : -1) * 14;
          spawnDustPuff(w * 0.5 + footOffset, h * 0.72, 0.75, footOffset > 0 ? 1 : -1);
        }
      } else if (gameMode === 'shop' && !gameOver && !gameWon) {
        // Floating golden trade specks around counter
        if (stepTimer > 0.28) {
          stepTimer = 0;
          addParticle({
            x: w * 0.5 + (Math.random() - 0.5) * 160,
            y: h * 0.55 + Math.random() * 40,
            vx: (Math.random() - 0.5) * 0.6,
            vy: -0.6 - Math.random() * 0.8,
            size: 2 + Math.random() * 3,
            maxSize: 5,
            color: '#fbbf24',
            alpha: 0.85,
            decay: 0.016,
            life: 1.0,
            maxLife: 1.0,
            rotation: Math.random() * Math.PI,
            rotationSpeed: 0.05,
            type: 'star',
            gravity: -0.01, // floating gently up
            drag: 0.99,
          });
        }
      } else if (combo >= 2 && !gameOver && !gameWon) {
        // High Combo Heat Embers
        if (stepTimer > 0.18) {
          stepTimer = 0;
          addParticle({
            x: w * (0.2 + Math.random() * 0.6),
            y: h * 0.92,
            vx: (Math.random() - 0.5) * 1.5,
            vy: -2.0 - Math.random() * 3.0,
            size: 3 + Math.random() * 4,
            maxSize: 7,
            color: combo >= 4 ? '#ef4444' : '#f59e0b',
            alpha: 0.85,
            decay: 0.02,
            life: 1.0,
            maxLife: 1.0,
            rotation: 0,
            rotationSpeed: 0,
            type: 'ember',
            gravity: -0.04,
            drag: 0.98,
          });
        }
      }

      // Update & Render Particles
      const alive: Particle[] = [];
      const len = particlesRef.current.length;

      for (let i = 0; i < len; i++) {
        const p = particlesRef.current[i];
        p.life -= p.decay;
        if (p.life <= 0) continue;

        // Physics integration
        p.vx *= p.drag;
        p.vy = (p.vy + p.gravity) * p.drag;
        p.x += p.vx;
        p.y += p.vy;
        p.rotation += p.rotationSpeed;

        const currentAlpha = p.alpha * Math.max(0, p.life);

        // Render based on particle type
        ctx.save();
        ctx.globalAlpha = currentAlpha;

        if (p.type === 'dust') {
          // Soft billowy radial dust puff
          const currentSize = p.size + (p.maxSize - p.size) * (1 - p.life);
          ctx.beginPath();
          ctx.arc(p.x, p.y, currentSize, 0, Math.PI * 2);
          ctx.fillStyle = `${p.color}${currentAlpha * 0.55})`;
          ctx.fill();
        } else if (p.type === 'spark') {
          // Stretched streak in direction of velocity (motion blur)
          const angle = Math.atan2(p.vy, p.vx);
          const speed = Math.hypot(p.vx, p.vy);
          const length = Math.max(p.size, speed * 2.2);

          ctx.translate(p.x, p.y);
          ctx.rotate(angle);
          ctx.fillStyle = p.color;
          ctx.fillRect(-length * 0.5, -p.size * 0.5, length, p.size);
        } else if (p.type === 'star') {
          // Twinkling 4-point star
          ctx.translate(p.x, p.y);
          ctx.rotate(p.rotation);
          ctx.fillStyle = p.color;
          const s = p.size * (0.8 + 0.3 * Math.sin(now * 0.02 + p.x));
          ctx.beginPath();
          ctx.moveTo(0, -s * 1.8);
          ctx.quadraticCurveTo(0, 0, s * 1.8, 0);
          ctx.quadraticCurveTo(0, 0, 0, s * 1.8);
          ctx.quadraticCurveTo(0, 0, -s * 1.8, 0);
          ctx.quadraticCurveTo(0, 0, 0, -s * 1.8);
          ctx.fill();
        } else if (p.type === 'shockwave') {
          // Expanding glowing circular shockwave ring
          const progress = 1 - p.life;
          const r = (p.extra?.radius || 10) + ((p.extra?.maxRadius || 80) - (p.extra?.radius || 10)) * progress;
          ctx.beginPath();
          ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
          ctx.strokeStyle = p.color;
          ctx.lineWidth = Math.max(1, p.size * (1 - progress));
          ctx.stroke();
        } else if (p.type === 'confetti') {
          // 3D tumbling paper ribbon
          ctx.translate(p.x, p.y);
          ctx.rotate(p.rotation);
          const aspect = Math.cos(p.rotation * 2);
          ctx.fillStyle = p.color;
          ctx.fillRect(-p.size * 0.7, -p.size * aspect * 0.4, p.size * 1.4, p.size * Math.abs(aspect) * 0.8);
        } else if (p.type === 'ember') {
          // Fiery glowing orb
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
          ctx.fillStyle = p.color;
          ctx.shadowColor = p.color;
          ctx.shadowBlur = 8;
          ctx.fill();
        }

        ctx.restore();
        alive.push(p);
      }

      particlesRef.current = alive;
      animFrameRef.current = requestAnimationFrame(renderLoop);
    };

    animFrameRef.current = requestAnimationFrame(renderLoop);

    return () => {
      running = false;
      window.removeEventListener('resize', resize);
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, [gameMode, gameOver, gameWon, combo]);

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 w-full h-full pointer-events-none z-20"
      style={{ mixBlendMode: 'screen' }}
    />
  );
};
