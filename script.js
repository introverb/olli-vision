// Manifestations list now renders in source order — auto-sort removed
// so the catalog can be curated by hand (specific entries at specific
// positions rather than mechanically by % or date). Edit the order
// directly in index.html.

// HUD: live NYC local clock for the Identity panel (only piece of live data).
(() => {
  function updateClock() {
    const hm = new Intl.DateTimeFormat("en-US", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
      timeZone: "America/New_York",
    }).format(new Date());
    const text = hm.replace(/^24:/, "00:");
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

// Hero cloud particles — mobile only, decorative. SVG + CSS animation.
// Generates 260 SVG circles inside a group once at load. Positions are
// in viewBox coordinates (0..200), so the SVG renderer handles scaling
// to whatever CSS size the grid cell provides — no resize handling, no
// redraw on scroll. Breathing motion is a CSS animation on the group
// (see style.css `@keyframes hero-breathe`).
(() => {
  const mq = window.matchMedia("(max-width: 720px)");
  if (!mq.matches) return;

  const group = document.querySelector(".hero-particles__group");
  if (!group) return;

  const svgNS = "http://www.w3.org/2000/svg";
  // Cluster is offset to the upper portion of the viewBox so it aligns with
  // the original hero-row placement; the CSS transform-origin (50% 25%)
  // matches this so the expand animation radiates out from the cluster.
  const cx = 100;
  const cy = 75;
  const sigma = 30;

  const PARTICLE_COUNT = 260;
  for (let i = 0; i < PARTICLE_COUNT; i++) {
    const u = Math.max(Math.random(), 1e-9);
    const v = Math.random();
    const r = Math.sqrt(-2 * Math.log(u)) * sigma;
    const theta = 2 * Math.PI * v;
    const circle = document.createElementNS(svgNS, "circle");
    circle.setAttribute("cx", (cx + r * Math.cos(theta)).toFixed(2));
    circle.setAttribute("cy", (cy + r * Math.sin(theta)).toFixed(2));
    circle.setAttribute("r", (0.15 + Math.random() * 0.25).toFixed(2));
    circle.setAttribute("fill", "rgb(244, 240, 232)");
    circle.setAttribute("opacity", (0.22 + Math.random() * 0.35).toFixed(2));
    group.appendChild(circle);
  }
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

  // Per-panel cluster parameters. Spread (sx, sy) in pixels so clusters
  // look circular regardless of panel aspect ratio. Each panel has its
  // own size, aspect, and rotation so the clusters feel distinct.
  const panelClusters = [
    { cx: 0.5,  cy: 0.5,  sx: 75, sy: 75, angle: 0 },           // Intro
    { cx: 0.3,  cy: 0.32, sx: 95, sy: 60, angle: 0 },           // Past
    { cx: 0.7,  cy: 0.55, sx: 65, sy: 65, angle: 0 },           // Current
    { cx: 0.45, cy: 0.72, sx: 95, sy: 55, angle: Math.PI / 10 },// Future
    { cx: 0.78, cy: 0.5,  sx: 55, sy: 85, angle: 0 },           // Signal
  ];

  // Sample one point from the cluster's 2D gaussian, returned in pixel coords.
  function sampleCluster(rect, c) {
    const u = Math.max(Math.random(), 1e-9);
    const v = Math.random();
    const r = Math.sqrt(-2 * Math.log(u));
    const theta = 2 * Math.PI * v;
    const ox = r * c.sx * Math.cos(theta);
    const oy = r * c.sy * Math.sin(theta);
    const cos = Math.cos(c.angle);
    const sin = Math.sin(c.angle);
    return [
      rect.left + c.cx * rect.width + (ox * cos - oy * sin),
      rect.top + c.cy * rect.height + (ox * sin + oy * cos),
    ];
  }

  const allPanels = Array.from(document.querySelectorAll(".panel"));

  // Particle pool — absolute viewport coords, wrapped to active panel rect
  const particles = [];
  const PARTICLE_COUNT = 330;
  function spawnIn(rect, panel) {
    particles.length = 0;
    const idx = allPanels.indexOf(panel);
    const cluster = panelClusters[idx] || panelClusters[0];
    for (let i = 0; i < PARTICLE_COUNT; i++) {
      const [px, py] = sampleCluster(rect, cluster);
      particles.push({
        x: px,
        y: py,
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

      // slight damping + wisp of brownian motion — no recall force, so
      // once scattered by the cursor, they stay scattered until the next hover
      p.vx = p.vx * 0.97 + (Math.random() - 0.5) * 0.004;
      p.vy = p.vy * 0.97 + (Math.random() - 0.5) * 0.004;
      p.x += p.vx;
      p.y += p.vy;

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
