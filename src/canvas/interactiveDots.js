/**
 * Pocket Frames — Interactive Canvas Dot Grid
 * Liquid interactive dots that flow and illuminate under mouse movement in Dark Mode on Web screens.
 * Automatically disabled on Mobile and Light Mode for optimal performance and battery life.
 */

export class InteractiveDots {
  constructor(canvasElement, containerElement) {
    this.canvas = canvasElement;
    this.container = containerElement;
    this.ctx = this.canvas?.getContext('2d');
    
    this.dots = [];
    this.spacing = 22; // Matches 22px 22px CSS grid
    this.mouse = { x: -9999, y: -9999, active: false };
    this.animId = null;
    this.isRunning = false;
    this.width = 0;
    this.height = 0;
    this.dpr = 1;

    this.idleTimer = null;
    this.isIdle = false;

    // Configuration
    this.hoverRadius = 115; // Interaction distance from cursor
    this.restingRadius = 1.15;
    this.maxRadius = 2.75;
    this.maxRepel = 4.5;
    this.springStrength = 0.14;
    this.damping = 0.28;

    if (this.canvas && this.container) {
      this.init();
    }
  }

  isEligible() {
    // Only Dark Mode & Desktop / Fine Pointer screens (width > 1000px)
    const isDark = document.documentElement.getAttribute('data-theme') !== 'light';
    const isDesktop = window.innerWidth > 1000 && window.matchMedia('(hover: hover) and (pointer: fine)').matches;
    return isDark && isDesktop;
  }

  init() {
    this.resize();

    // Mouse tracking on container
    this.onMouseMove = this.handleMouseMove.bind(this);
    this.onMouseLeave = this.handleMouseLeave.bind(this);
    this.container.addEventListener('pointermove', this.onMouseMove, { passive: true });
    this.container.addEventListener('pointerleave', this.onMouseLeave, { passive: true });

    // Resize observer
    this.resizeObserver = new ResizeObserver(() => {
      this.resize();
    });
    this.resizeObserver.observe(this.container);

    // Watch for theme and viewport changes
    this.themeObserver = new MutationObserver(() => {
      this.evaluateState();
    });
    this.themeObserver.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-theme']
    });

    window.addEventListener('resize', () => {
      this.evaluateState();
    }, { passive: true });

    this.evaluateState();
  }

  resize() {
    if (!this.container || !this.canvas) return;
    const rect = this.container.getBoundingClientRect();
    this.width = rect.width;
    this.height = rect.height;
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);

    this.canvas.width = Math.round(this.width * this.dpr);
    this.canvas.height = Math.round(this.height * this.dpr);

    this.buildGrid();
    this.wakeUp();
  }

  buildGrid() {
    this.dots = [];
    if (this.width <= 0 || this.height <= 0) return;

    const cols = Math.ceil(this.width / this.spacing) + 1;
    const rows = Math.ceil(this.height / this.spacing) + 1;

    // Center the grid coordinates
    const offsetX = (this.width - (cols - 1) * this.spacing) / 2;
    const offsetY = (this.height - (rows - 1) * this.spacing) / 2;

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const baseX = offsetX + c * this.spacing;
        const baseY = offsetY + r * this.spacing;

        this.dots.push({
          baseX,
          baseY,
          x: baseX,
          y: baseY,
          vx: 0,
          vy: 0,
          currentRadius: this.restingRadius,
          targetRadius: this.restingRadius,
          glowIntensity: 0, // 0 = resting, 1 = peak illumination
          targetGlow: 0
        });
      }
    }
  }

  handleMouseMove(e) {
    const rect = this.container.getBoundingClientRect();
    this.mouse.x = e.clientX - rect.left;
    this.mouse.y = e.clientY - rect.top;
    this.mouse.active = true;
    this.wakeUp();
  }

  handleMouseLeave() {
    this.mouse.active = false;
    this.mouse.x = -9999;
    this.mouse.y = -9999;
    this.wakeUp();
  }

  wakeUp() {
    this.isIdle = false;
    clearTimeout(this.idleTimer);
    this.idleTimer = setTimeout(() => {
      if (!this.mouse.active) {
        this.isIdle = true;
      }
    }, 2800);

    if (!this.isRunning && this.isEligible()) {
      this.start();
    }
  }

  evaluateState() {
    if (this.isEligible()) {
      this.canvas.style.display = 'block';
      this.wakeUp();
    } else {
      this.stop();
      if (this.ctx) {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
      }
      this.canvas.style.display = 'none';
    }
  }

  start() {
    if (this.isRunning) return;
    this.isRunning = true;
    const loop = () => {
      if (!this.isRunning) return;
      this.updateAndDraw();

      // Pause loop if completely idle to conserve CPU/battery
      if (this.isIdle && this.areAllDotsSettled()) {
        this.isRunning = false;
        return;
      }

      this.animId = requestAnimationFrame(loop);
    };
    this.animId = requestAnimationFrame(loop);
  }

  stop() {
    this.isRunning = false;
    if (this.animId) {
      cancelAnimationFrame(this.animId);
      this.animId = null;
    }
  }

  areAllDotsSettled() {
    for (let i = 0; i < this.dots.length; i++) {
      const d = this.dots[i];
      if (Math.abs(d.vx) > 0.02 || Math.abs(d.vy) > 0.02 || d.glowIntensity > 0.01) {
        return false;
      }
    }
    return true;
  }

  updateAndDraw() {
    if (!this.ctx) return;
    const ctx = this.ctx;
    const dpr = this.dpr;

    ctx.save();
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, this.width, this.height);

    const mx = this.mouse.x;
    const my = this.mouse.y;
    const hoverR = this.hoverRadius;
    const hoverRSq = hoverR * hoverR;

    for (let i = 0; i < this.dots.length; i++) {
      const dot = this.dots[i];

      // Mouse influence
      const dx = dot.x - mx;
      const dy = dot.y - my;
      const distSq = dx * dx + dy * dy;

      if (distSq < hoverRSq) {
        const dist = Math.sqrt(distSq);
        const factor = Math.max(0, 1 - dist / hoverR);
        const smoothFactor = factor * factor * (3 - 2 * factor); // smoothstep

        // Fluid repulsion away from mouse
        const angle = Math.atan2(dy, dx);
        const repelForce = smoothFactor * this.maxRepel;
        const targetX = dot.baseX + Math.cos(angle) * repelForce;
        const targetY = dot.baseY + Math.sin(angle) * repelForce;

        dot.targetRadius = this.restingRadius + (this.maxRadius - this.restingRadius) * smoothFactor;
        dot.targetGlow = smoothFactor;

        // Spring toward displaced target
        const ax = (targetX - dot.x) * this.springStrength - dot.vx * this.damping;
        const ay = (targetY - dot.y) * this.springStrength - dot.vy * this.damping;
        dot.vx += ax;
        dot.vy += ay;
      } else {
        dot.targetRadius = this.restingRadius;
        dot.targetGlow = 0;

        // Spring toward base position
        const ax = (dot.baseX - dot.x) * this.springStrength - dot.vx * this.damping;
        const ay = (dot.baseY - dot.y) * this.springStrength - dot.vy * this.damping;
        dot.vx += ax;
        dot.vy += ay;
      }

      dot.x += dot.vx;
      dot.y += dot.vy;

      // Lerp visual properties
      dot.currentRadius += (dot.targetRadius - dot.currentRadius) * 0.18;
      dot.glowIntensity += (dot.targetGlow - dot.glowIntensity) * 0.16;

      // Draw dot
      ctx.beginPath();
      ctx.arc(dot.x, dot.y, dot.currentRadius, 0, Math.PI * 2);

      if (dot.glowIntensity > 0.02) {
        // Glowing Amber / Light highlight on interactive dots
        const g = dot.glowIntensity;
        // Subtle aura for dots close to the cursor
        if (g > 0.4) {
          ctx.shadowColor = 'rgba(226, 164, 104, 0.45)';
          ctx.shadowBlur = 6 * g;
        } else {
          ctx.shadowBlur = 0;
        }

        const r = Math.round(42 + (226 - 42) * g);
        const green = Math.round(44 + (164 - 44) * g);
        const b = Math.round(49 + (104 - 49) * g);
        const alpha = (0.28 + 0.72 * g).toFixed(3);
        ctx.fillStyle = `rgba(${r}, ${green}, ${b}, ${alpha})`;
        ctx.fill();
        ctx.shadowBlur = 0;
      } else {
        // Resting subtle border dot
        ctx.fillStyle = 'rgba(255, 255, 255, 0.10)';
        ctx.fill();
      }
    }

    ctx.restore();
  }

  destroy() {
    this.stop();
    if (this.container) {
      this.container.removeEventListener('pointermove', this.onMouseMove);
      this.container.removeEventListener('pointerleave', this.onMouseLeave);
    }
    if (this.resizeObserver) this.resizeObserver.disconnect();
    if (this.themeObserver) this.themeObserver.disconnect();
  }
}
