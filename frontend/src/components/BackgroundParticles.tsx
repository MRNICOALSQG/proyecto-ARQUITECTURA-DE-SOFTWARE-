import { useEffect, useRef } from "react";
import { usePreferencesStore } from "../stores/preferencesStore";

export function BackgroundParticles() {
  const { preferences } = usePreferencesStore();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const type = preferences.particles_type || "none";
  const colorName = preferences.particles_color || "white";
  const speedMultiplier = preferences.particles_speed || 1;
  const opacity = preferences.particles_opacity || 0.5;

  const colorMap: Record<string, string> = {
    white: "#ffffff",
    red: "#ef4444",
    violet: "#a855f7",
    pink: "#ec4899",
    green: "#22c55e",
    yellow: "#eab308",
    blue: "#3b82f6",
    orange: "#f97316",
  };

  const colorHex = colorMap[colorName] || "#ffffff";

  useEffect(() => {
    if (type === "none") return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animationFrameId: number;
    let width = (canvas.width = window.innerWidth);
    let height = (canvas.height = window.innerHeight);

    const handleResize = () => {
      if (!canvas) return;
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
    };
    window.addEventListener("resize", handleResize);

    // Particle class definition
    class Particle {
      x: number;
      y: number;
      vx: number;
      vy: number;
      size: number;
      drift: number;

      constructor() {
        this.x = Math.random() * width;
        this.y = Math.random() * height;
        this.size = Math.random() * 3 + 1;
        this.drift = Math.random() * 0.5 - 0.25;

        // Base velocity
        if (type === "snow") {
          this.vx = Math.random() * 0.5 - 0.25;
          this.vy = Math.random() * 1 + 0.5;
        } else {
          this.vx = Math.random() * 1 - 0.5;
          this.vy = Math.random() * 1 - 0.5;
        }
      }

      update() {
        this.x += this.vx * speedMultiplier;
        this.y += this.vy * speedMultiplier;

        if (type === "snow") {
          this.x += Math.sin(this.y / 30) * 0.3 * speedMultiplier; // swaying drift
        }

        // Boundary checks
        if (this.x < 0) this.x = width;
        if (this.x > width) this.x = 0;
        if (this.y < 0) this.y = height;
        if (this.y > height) this.y = 0;
      }

      draw() {
        if (!ctx) return;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
        ctx.fillStyle = colorHex;
        ctx.fill();

        // Add optional soft glow for neon feel
        if (type === "particles" || type === "dots") {
          ctx.shadowBlur = 8;
          ctx.shadowColor = colorHex;
        } else {
          ctx.shadowBlur = 0;
        }
      }
    }

    const particleCount = type === "lines" ? 60 : 100;
    const particles: Particle[] = Array.from({ length: particleCount }, () => new Particle());

    const drawLines = () => {
      if (!ctx || type !== "lines") return;
      for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
          const dx = particles[i].x - particles[j].x;
          const dy = particles[i].y - particles[j].y;
          const dist = Math.sqrt(dx * dx + dy * dy);

          if (dist < 120) {
            ctx.beginPath();
            ctx.moveTo(particles[i].x, particles[i].y);
            ctx.lineTo(particles[j].x, particles[j].y);
            // Dynamic opacity based on proximity
            const lineOpacity = (1 - dist / 120) * opacity * 0.6;
            ctx.strokeStyle = colorHex;
            ctx.lineWidth = 0.8;
            ctx.globalAlpha = lineOpacity;
            ctx.stroke();
            ctx.globalAlpha = 1.0;
          }
        }
      }
    };

    const render = () => {
      ctx.clearRect(0, 0, width, height);

      // Disable shadow blur for clean background unless drawing particles
      ctx.shadowBlur = 0;

      // Draw lines first (underneath particles)
      if (type === "lines") {
        drawLines();
      }

      // Draw particles
      ctx.globalAlpha = opacity;
      particles.forEach((p) => {
        p.update();
        p.draw();
      });
      ctx.globalAlpha = 1.0;

      animationFrameId = requestAnimationFrame(render);
    };

    render();

    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener("resize", handleResize);
    };
  }, [type, colorName, speedMultiplier, opacity]);

  if (type === "none") return null;

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 w-full h-full pointer-events-none"
    />
  );
}
