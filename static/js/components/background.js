/**
 * Git-Spectre Telemetry Grid Background
 * Interactive canvas with orthogonal Git DAG branch traces, procedural GitHub heatmap waves,
 * mouse ripple ignition, and HUD telemetry ticks.
 */

import { getTheme } from '../state.js';

export function initBackground() {
  const canvas = document.getElementById('spectre-telemetry');
  if (!canvas) return;

  const ctx = canvas.getContext('2d', { alpha: true });
  if (!ctx) return;

  let width = 0;
  let height = 0;
  let cols = 0;
  let rows = 0;

  const CELL_SIZE = 24;
  const CELL_GAP = 4;
  const BOX_SIZE = CELL_SIZE - CELL_GAP;

  let mouse = { x: -1000, y: -1000, vx: 0, vy: 0 };
  let lastMouse = { x: -1000, y: -1000 };
  let branches = [];
  const cellRipples = new Map();
  let time = 0;
  let animId = null;

  function getPalette() {
    const isDark = getTheme() === 'dark';
    return {
      isDark,
      purple: isDark ? [123, 97, 255] : [109, 40, 217],
      lime: isDark ? [196, 248, 42] : [77, 124, 15],
      crosshair: isDark ? 0.07 : 0.04,
      hudTick: isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.06)'
    };
  }

  window.addEventListener('mousemove', (e) => {
    mouse.vx = e.clientX - lastMouse.x;
    mouse.vy = e.clientY - lastMouse.y;
    mouse.x = e.clientX;
    mouse.y = e.clientY;
    lastMouse.x = e.clientX;
    lastMouse.y = e.clientY;

    const col = Math.floor(mouse.x / CELL_SIZE);
    const row = Math.floor(mouse.y / CELL_SIZE);

    for (let i = -2; i <= 2; i++) {
      for (let j = -2; j <= 2; j++) {
        if (Math.random() > 0.45) continue;
        const c = col + i;
        const r = row + j;
        const key = `${c},${r}`;
        const dist = Math.hypot(i, j);
        if (dist <= 2.5) {
          cellRipples.set(key, {
            c, r,
            intensity: Math.min(1, (1 - dist / 3) * 0.8),
            isLime: Math.random() > 0.65
          });
        }
      }
    }
  }, { passive: true });

  function resize() {
    const dpr = window.devicePixelRatio || 1;
    width = window.innerWidth;
    height = window.innerHeight;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.scale(dpr, dpr);

    cols = Math.ceil(width / CELL_SIZE);
    rows = Math.ceil(height / CELL_SIZE);
  }

  window.addEventListener('resize', resize, { passive: true });
  resize();

  function waveNoise(x, y, t) {
    const v1 = Math.sin(x * 0.08 + t);
    const v2 = Math.cos(y * 0.08 - t * 0.7);
    const v3 = Math.sin((x + y) * 0.05 + t * 0.5);
    return (v1 + v2 + v3) / 3;
  }

  function getCenterMask(x, y) {
    const cx = width * 0.5;
    const cy = height * 0.5;
    const dx = (x - cx) / 420;
    const dy = (y - cy) / 280;
    const dist = Math.sqrt(dx * dx + dy * dy);
    return Math.min(1, Math.max(0.04, Math.pow(dist, 2.2) - 0.15));
  }

  class GitTrace {
    constructor() {
      this.reset();
    }

    reset() {
      const side = Math.random() > 0.5 ? 0 : 1;
      this.c = side === 0
        ? Math.floor(Math.random() * (cols * 0.35))
        : Math.floor(cols * 0.65 + Math.random() * (cols * 0.35));
      this.r = Math.floor(Math.random() * rows);

      this.dir = Math.floor(Math.random() * 4);
      this.history = [{ c: this.c, r: this.r, isCommit: true }];
      this.maxLength = Math.floor(Math.random() * 14) + 8;
      this.speed = Math.random() * 0.18 + 0.08;
      this.progress = 0;
      this.isLime = Math.random() > 0.45;
      this.alpha = Math.random() * 0.45 + 0.2;
      this.life = 0;
      this.maxLife = Math.floor(Math.random() * 40) + 25;
    }

    update() {
      this.progress += this.speed;
      if (this.progress >= 1) {
        this.progress = 0;
        this.life++;

        if (this.life < this.maxLife) {
          let isCommit = false;
          if (Math.random() < 0.25) {
            this.dir = (this.dir + (Math.random() > 0.5 ? 1 : 3)) % 4;
            isCommit = true;
          }

          if (this.dir === 0) this.r--;
          else if (this.dir === 1) this.c++;
          else if (this.dir === 2) this.r++;
          else if (this.dir === 3) this.c--;

          this.history.push({ c: this.c, r: this.r, isCommit });
          if (this.history.length > this.maxLength) {
            this.history.shift();
          }
        } else {
          this.history.shift();
          if (this.history.length === 0) {
            this.reset();
          }
        }
      }
    }

    draw(palette) {
      if (this.history.length < 2) return;

      const color = this.isLime ? palette.lime : palette.purple;
      const head = this.history[this.history.length - 1];
      const px = head.c * CELL_SIZE + CELL_SIZE / 2;
      const py = head.r * CELL_SIZE + CELL_SIZE / 2;
      const mask = getCenterMask(px, py);

      ctx.strokeStyle = `rgba(${color[0]}, ${color[1]}, ${color[2]}, ${this.alpha * mask})`;
      ctx.lineWidth = 1.5;
      ctx.beginPath();

      for (let i = 0; i < this.history.length; i++) {
        const pt = this.history[i];
        const x = pt.c * CELL_SIZE + CELL_SIZE / 2;
        const y = pt.r * CELL_SIZE + CELL_SIZE / 2;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();

      for (let i = 0; i < this.history.length; i++) {
        const pt = this.history[i];
        if (pt.isCommit || i === this.history.length - 1) {
          const x = pt.c * CELL_SIZE + CELL_SIZE / 2;
          const y = pt.r * CELL_SIZE + CELL_SIZE / 2;
          const fade = (i / this.history.length) * this.alpha * mask;

          ctx.fillStyle = palette.isDark ? '#08080a' : '#ffffff';
          ctx.beginPath();
          ctx.arc(x, y, 3, 0, Math.PI * 2);
          ctx.fill();

          ctx.strokeStyle = `rgba(${color[0]}, ${color[1]}, ${color[2]}, ${fade * 1.6})`;
          ctx.lineWidth = 1.5;
          ctx.stroke();
        }
      }
    }
  }

  branches = [];
  for (let i = 0; i < 12; i++) {
    branches.push(new GitTrace());
  }

  function draw() {
    time += 0.008;
    const palette = getPalette();

    ctx.clearRect(0, 0, width, height);

    // 1. Subtle Structural Crosshairs & Ambient Heatmap Cells
    for (let c = 0; c < cols; c++) {
      for (let r = 0; r < rows; r++) {
        const x = c * CELL_SIZE;
        const y = r * CELL_SIZE;
        const mask = getCenterMask(x + CELL_SIZE / 2, y + CELL_SIZE / 2);

        // Subtle crosshairs
        if (c % 4 === 0 && r % 4 === 0) {
          ctx.fillStyle = palette.isDark
            ? `rgba(255, 255, 255, ${palette.crosshair * mask})`
            : `rgba(0, 0, 0, ${palette.crosshair * mask})`;
          ctx.fillRect(x + CELL_SIZE / 2 - 2, y + CELL_SIZE / 2, 5, 1);
          ctx.fillRect(x + CELL_SIZE / 2, y + CELL_SIZE / 2 - 2, 1, 5);
        }

        // Ambient procedural heatmap wave
        const n = waveNoise(c, r, time);
        if (n > 0.48) {
          const rawIntensity = (n - 0.48) / 0.52;
          const level = Math.ceil(rawIntensity * 3) / 3;
          const isLimeCluster = Math.sin(c * 0.15 - r * 0.1 + time * 0.3) > 0.55;
          const colArr = isLimeCluster ? palette.lime : palette.purple;
          const alpha = level * 0.14 * mask;

          ctx.fillStyle = `rgba(${colArr[0]}, ${colArr[1]}, ${colArr[2]}, ${alpha})`;
          ctx.beginPath();
          if (ctx.roundRect) {
            ctx.roundRect(x + 2, y + 2, BOX_SIZE, BOX_SIZE, 3);
          } else {
            ctx.rect(x + 2, y + 2, BOX_SIZE, BOX_SIZE);
          }
          ctx.fill();
        }
      }
    }

    // 2. Interactive Mouse Heatmap Ripples
    cellRipples.forEach((cell, key) => {
      cell.intensity -= 0.018;
      if (cell.intensity <= 0) {
        cellRipples.delete(key);
        return;
      }

      const x = cell.c * CELL_SIZE;
      const y = cell.r * CELL_SIZE;
      const mask = getCenterMask(x, y);
      const colArr = cell.isLime ? palette.lime : palette.purple;

      ctx.fillStyle = `rgba(${colArr[0]}, ${colArr[1]}, ${colArr[2]}, ${cell.intensity * 0.35 * mask})`;
      ctx.strokeStyle = `rgba(${colArr[0]}, ${colArr[1]}, ${colArr[2]}, ${cell.intensity * 0.6 * mask})`;
      ctx.lineWidth = 1;

      ctx.beginPath();
      if (ctx.roundRect) {
        ctx.roundRect(x + 2, y + 2, BOX_SIZE, BOX_SIZE, 3);
      } else {
        ctx.rect(x + 2, y + 2, BOX_SIZE, BOX_SIZE);
      }
      ctx.fill();
      ctx.stroke();
    });

    // 3. Update & Draw Orthogonal Git Branch Traces
    for (let i = 0; i < branches.length; i++) {
      branches[i].update();
      branches[i].draw(palette);
    }

    // 4. Peripheral HUD Telemetry Ticks (Left & Right Viewport Borders)
    ctx.fillStyle = palette.hudTick;
    for (let y = 60; y < height - 60; y += 24) {
      const len = (y % 96 === 0) ? 10 : 4;
      ctx.fillRect(16, y, len, 1);
      ctx.fillRect(width - 16 - len, y, len, 1);
    }

    animId = requestAnimationFrame(draw);
  }

  draw();

  return () => {
    if (animId) cancelAnimationFrame(animId);
  };
}
