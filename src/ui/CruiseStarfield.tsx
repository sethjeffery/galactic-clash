import { useEffect, useRef } from "react";

interface CruiseStar {
  drift: number;
  glow: number;
  phase: number;
  radius: number;
  twinkle: number;
  x: number;
  y: number;
}

const STAR_COUNT = 180;

export function CruiseStarfield() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvasElement = canvasRef.current;

    if (!canvasElement) {
      return;
    }

    const context2d = canvasElement.getContext("2d");

    if (!context2d) {
      return;
    }

    const canvas = canvasElement;
    const context = context2d;
    let stars = createStars(window.innerWidth, window.innerHeight);
    let animationFrame = 0;
    let lastTimestamp = performance.now();

    function resize() {
      const ratio = window.devicePixelRatio || 1;
      const width = window.innerWidth;
      const height = window.innerHeight;

      canvas.width = width * ratio;
      canvas.height = height * ratio;
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      context.setTransform(ratio, 0, 0, ratio, 0, 0);
      stars = createStars(width, height);
    }

    function animate(timestamp: number) {
      const width = window.innerWidth;
      const height = window.innerHeight;
      const deltaSeconds = Math.min(0.05, (timestamp - lastTimestamp) / 1000);

      lastTimestamp = timestamp;
      context.clearRect(0, 0, width, height);

      for (const star of stars) {
        star.phase += deltaSeconds * star.twinkle;
        star.x -= deltaSeconds * star.drift;
        star.y += deltaSeconds * star.drift * 0.03;

        if (star.x < -24) {
          recycleStar(star, width, height, true);
        }

        if (star.y > height + 24) {
          star.y = -16;
        }

        const pulse = 0.72 + Math.sin(star.phase) * 0.28;
        const alpha = (0.18 + star.glow * 0.46) * pulse;

        context.beginPath();
        context.fillStyle = `rgba(255,255,255,${alpha})`;
        context.arc(star.x, star.y, star.radius, 0, Math.PI * 2);
        context.fill();

        if (star.glow > 0.58) {
          const haze = context.createRadialGradient(star.x, star.y, 0, star.x, star.y, star.radius * 10);

          haze.addColorStop(0, `rgba(121,211,255,${alpha * 0.18})`);
          haze.addColorStop(1, "rgba(121,211,255,0)");

          context.beginPath();
          context.fillStyle = haze;
          context.arc(star.x, star.y, star.radius * 10, 0, Math.PI * 2);
          context.fill();
        }
      }

      animationFrame = window.requestAnimationFrame(animate);
    }

    resize();
    window.addEventListener("resize", resize);
    animationFrame = window.requestAnimationFrame(animate);

    return () => {
      window.cancelAnimationFrame(animationFrame);
      window.removeEventListener("resize", resize);
    };
  }, []);

  return <canvas aria-hidden="true" className="cruise-starfield" ref={canvasRef} />;
}

function createStars(width: number, height: number) {
  return Array.from({ length: STAR_COUNT }, () => createStar(width, height));
}

function createStar(width: number, height: number): CruiseStar {
  return {
    drift: 4 + Math.random() * 18,
    glow: Math.random(),
    phase: Math.random() * Math.PI * 2,
    radius: 0.4 + Math.random() * 1.7,
    twinkle: 0.35 + Math.random() * 0.9,
    x: Math.random() * width,
    y: Math.random() * height,
  };
}

function recycleStar(star: CruiseStar, width: number, height: number, fromRight = false) {
  star.drift = 4 + Math.random() * 18;
  star.glow = Math.random();
  star.phase = Math.random() * Math.PI * 2;
  star.radius = 0.4 + Math.random() * 1.7;
  star.twinkle = 0.35 + Math.random() * 0.9;
  star.x = fromRight ? width + 24 : Math.random() * width;
  star.y = Math.random() * height;
}
