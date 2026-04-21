// HUD: live NYC local clock for the Identity panel (only piece of live data).
(() => {
  function updateClock() {
    const hm = new Intl.DateTimeFormat("en-US", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
      timeZone: "America/New_York",
    }).format(new Date());
    const text = `LOCAL ${hm.replace(/^24:/, "00:")}`;
    document.querySelectorAll("[data-clock]").forEach((el) => {
      el.textContent = text;
    });
  }
  updateClock();
  setInterval(updateClock, 10000);
})();

// Mobile: tap-to-toggle panel accordion (only applies when not hover-capable
// or below the desktop breakpoint).
(() => {
  const isDesktop = () =>
    window.matchMedia("(hover: hover) and (min-width: 721px)").matches;

  document.querySelectorAll(".panel").forEach((panel) => {
    panel.addEventListener("click", (e) => {
      if (isDesktop()) return;
      // Don't toggle when tapping a link inside the panel
      if (e.target.closest("a")) return;
      panel.classList.toggle("is-active");
    });
  });
})();

// Tiny dust/sand particles that only appear inside an expanded panel.
// Particles fade in when a panel is hovered, stay bounded inside its rect,
// repel gently from the cursor, and fade out on hover leave.
// Skipped on mobile/touch — the hover mechanic doesn't apply and it's a perf hit.

(() => {
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  if (!window.matchMedia("(hover: hover) and (min-width: 721px)").matches)
    return;

  const canvas = document.createElement("canvas");
  canvas.className = "particles";
  canvas.setAttribute("aria-hidden", "true");
  document.body.prepend(canvas);
  const ctx = canvas.getContext("2d");

  let w = 0;
  let h = 0;
  let dpr = 1;

  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    w = window.innerWidth;
    h = window.innerHeight;
    canvas.width = Math.floor(w * dpr);
    canvas.height = Math.floor(h * dpr);
    canvas.style.width = w + "px";
    canvas.style.height = h + "px";
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  resize();
  window.addEventListener("resize", resize);

  // Track which panel is hovered
  let hoveredPanel = null;
  let lastPanel = null;
  document.querySelectorAll(".panel").forEach((p) => {
    p.addEventListener("mouseenter", () => {
      hoveredPanel = p;
    });
    p.addEventListener("mouseleave", () => {
      if (hoveredPanel === p) hoveredPanel = null;
    });
  });

  // Cursor (in viewport coords)
  let mx = -1e4;
  let my = -1e4;
  window.addEventListener("mousemove", (e) => {
    mx = e.clientX;
    my = e.clientY;
  });

  // Each panel starts with a tight gaussian cluster at a distinct anchor.
  // Particles drift outward naturally; different starting blobs make each
  // panel feel like its own space rather than a shared dust pattern.
  // Returns normalized [x, y] in 0..1 for the panel rect.
  function gaussianAt(cx, cy, spread) {
    return () => {
      const u = Math.max(Math.random(), 1e-9);
      const v = Math.random();
      const r = Math.sqrt(-2 * Math.log(u)) * spread;
      const theta = 2 * Math.PI * v;
      return [
        Math.max(0.02, Math.min(0.98, cx + r * Math.cos(theta))),
        Math.max(0.02, Math.min(0.98, cy + r * Math.sin(theta))),
      ];
    };
  }

  const panelPatterns = [
    gaussianAt(0.5, 0.5, 0.13), // 0 Intro: center
    gaussianAt(0.28, 0.28, 0.13), // 1 Past: upper-left
    gaussianAt(0.68, 0.58, 0.13), // 2 Current: middle-right
    gaussianAt(0.45, 0.75, 0.13), // 3 Future: lower-center
    gaussianAt(0.78, 0.5, 0.13), // 4 Signal: right-side
  ];

  const allPanels = Array.from(document.querySelectorAll(".panel"));

  // Particle pool — absolute viewport coords, wrapped to active panel rect
  const particles = [];
  const PARTICLE_COUNT = 220;
  function spawnIn(rect, panel) {
    particles.length = 0;
    const idx = allPanels.indexOf(panel);
    const pattern = panelPatterns[idx] || panelPatterns[0];
    for (let i = 0; i < PARTICLE_COUNT; i++) {
      const [nx, ny] = pattern();
      particles.push({
        x: rect.left + nx * rect.width,
        y: rect.top + ny * rect.height,
        vx: (Math.random() - 0.5) * 0.18,
        vy: (Math.random() - 0.5) * 0.18,
        r: 0.15 + Math.random() * 0.35, // finer grains: 0.15–0.5 px
        a: 0.28 + Math.random() * 0.5,
      });
    }
  }

  let activity = 0; // 0 = invisible, 1 = fully visible
  const cursorRadius = 55;

  function tick() {
    ctx.clearRect(0, 0, w, h);

    // Smooth fade toward target
    const target = hoveredPanel ? 1 : 0;
    activity += (target - activity) * 0.08;

    // When a new panel becomes hovered, respawn particles inside its rect
    // with its panel-specific spatial pattern.
    if (hoveredPanel && hoveredPanel !== lastPanel) {
      spawnIn(hoveredPanel.getBoundingClientRect(), hoveredPanel);
      lastPanel = hoveredPanel;
    }

    // Fully faded out and no hover — reset and skip drawing
    if (activity < 0.01 && !hoveredPanel) {
      lastPanel = null;
      particles.length = 0;
      requestAnimationFrame(tick);
      return;
    }

    const panel = hoveredPanel || lastPanel;
    if (!panel) {
      requestAnimationFrame(tick);
      return;
    }

    const rect = panel.getBoundingClientRect();

    ctx.fillStyle = "rgb(244, 240, 232)";
    for (const p of particles) {
      // cursor repel
      const dx = p.x - mx;
      const dy = p.y - my;
      const d2 = dx * dx + dy * dy;
      if (d2 < cursorRadius * cursorRadius) {
        const d = Math.sqrt(d2) || 1;
        const force = (1 - d / cursorRadius) * 0.2;
        p.vx += (dx / d) * force;
        p.vy += (dy / d) * force;
      }

      // slight damping + wisp of brownian motion
      p.vx = p.vx * 0.97 + (Math.random() - 0.5) * 0.004;
      p.vy = p.vy * 0.97 + (Math.random() - 0.5) * 0.004;
      p.x += p.vx;
      p.y += p.vy;

      // wrap inside the active panel's rect (keeps them contained)
      if (p.x < rect.left) p.x = rect.right;
      else if (p.x > rect.right) p.x = rect.left;
      if (p.y < rect.top) p.y = rect.bottom;
      else if (p.y > rect.bottom) p.y = rect.top;

      ctx.globalAlpha = p.a * activity;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    requestAnimationFrame(tick);
  }
  tick();
})();
