import { useEffect, useRef } from "react";

interface Star {
  age: number;
  depth: number;
  hueShift: number;
  life: number;
  speed: number;
  vx: number;
  vy: number;
  x: number;
  y: number;
}

const STAR_COUNT = 220;

export function WarpStarfield() {
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
    const stars = createStars(window.innerWidth, window.innerHeight);
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
    }

    function animate(timestamp: number) {
      const width = window.innerWidth;
      const height = window.innerHeight;
      const deltaSeconds = Math.min(0.05, (timestamp - lastTimestamp) / 1000);
      const driftX = width * 0.06;
      const driftY = height * 0.01;

      lastTimestamp = timestamp;
      context.clearRect(0, 0, width, height);
      context.fillStyle = "rgba(4, 9, 17, 0.16)";
      context.fillRect(0, 0, width, height);

      for (const star of stars) {
        star.age += deltaSeconds;
        star.x += (star.vx + driftX * (0.35 + star.depth)) * deltaSeconds;
        star.y += (star.vy + driftY * (0.35 + star.depth)) * deltaSeconds;

        if (
          star.x < -140 ||
          star.x > width + 140 ||
          star.y < -140 ||
          star.y > height + 140 ||
          star.age > star.life
        ) {
          recycleStar(star, width, height);
        }

        const fade = Math.min(1, star.age / 0.55);
        const alpha = Math.min(0.95, (0.14 + star.depth * 0.82) * fade);
        const tail = 10 + star.depth * 110;
        const length = Math.hypot(star.vx, star.vy) || 1;
        const previousX = star.x - (star.vx / length) * tail;
        const previousY = star.y - (star.vy / length) * tail;
        const stroke = context.createLinearGradient(previousX, previousY, star.x, star.y);

        stroke.addColorStop(0, "rgba(255,255,255,0)");
        stroke.addColorStop(0.45, `hsla(${200 + star.hueShift}, 95%, 74%, ${alpha * 0.42})`);
        stroke.addColorStop(1, `rgba(255,255,255,${alpha})`);

        context.beginPath();
        context.strokeStyle = stroke;
        context.lineWidth = 0.6 + star.depth * 2.4;
        context.moveTo(previousX, previousY);
        context.lineTo(star.x, star.y);
        context.stroke();

        context.beginPath();
        context.fillStyle = `rgba(255,255,255,${Math.min(1, alpha + 0.08)})`;
        context.arc(star.x, star.y, 0.5 + star.depth * 1.8, 0, Math.PI * 2);
        context.fill();
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

  return <canvas aria-hidden="true" className="warp-starfield" ref={canvasRef} />;
}

function createStars(width: number, height: number) {
  return Array.from({ length: STAR_COUNT }, () => createStar(width, height));
}

function createStar(width: number, height: number): Star {
  const depth = 0.2 + Math.random() * 0.8;
  const angle = -0.28 + Math.random() * 0.56;
  const speed = 50 + depth * 220;

  return {
    age: Math.random() * 0.7,
    depth,
    hueShift: Math.random() > 0.82 ? 28 : Math.random() > 0.55 ? 0 : -12,
    life: 4 + Math.random() * 3.5,
    speed,
    vx: Math.cos(angle) * speed,
    vy: Math.sin(angle) * speed * 0.35,
    x: Math.random() * width,
    y: Math.random() * height,
  };
}

function recycleStar(star: Star, width: number, height: number) {
  const depth = 0.16 + Math.random() * 0.84;
  const angle = -0.3 + Math.random() * 0.6;
  const speed = 50 + depth * 220;
  const edge = Math.floor(Math.random() * 4);

  star.age = 0;
  star.depth = depth;
  star.hueShift = Math.random() > 0.82 ? 28 : Math.random() > 0.55 ? 0 : -12;
  star.life = 4 + Math.random() * 3.5;
  star.speed = speed;
  star.vx = Math.cos(angle) * speed;
  star.vy = Math.sin(angle) * speed * 0.35;

  if (edge === 0) {
    star.x = -80;
    star.y = Math.random() * height;
    return;
  }

  if (edge === 1) {
    star.x = Math.random() * width;
    star.y = -60;
    return;
  }

  if (edge === 2) {
    star.x = Math.random() * width;
    star.y = height + 60;
    return;
  }

  star.x = Math.random() * width;
  star.y = Math.random() * height;
}
