(() => {
  "use strict";

  /** @type {HTMLCanvasElement} */
  const canvas = document.getElementById("game");
  /** @type {CanvasRenderingContext2D} */
  const ctx = canvas.getContext("2d", { alpha: true });

  const scoreEl = document.getElementById("score");
  const healthEl = document.getElementById("health");
  const overlayEl = document.getElementById("overlay");
  const overlayTitleEl = document.getElementById("overlayTitle");
  const overlaySubtitleEl = document.getElementById("overlaySubtitle");
  const restartBtn = document.getElementById("restartBtn");

  const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
  const rand = (min, max) => min + Math.random() * (max - min);

  function fitCanvasToCssSize() {
    const dpr = Math.max(1, Math.min(2, window.devicePixelRatio || 1));
    const rect = canvas.getBoundingClientRect();
    const w = Math.max(320, Math.floor(rect.width));
    const h = Math.max(180, Math.floor(rect.height));
    const nextW = Math.floor(w * dpr);
    const nextH = Math.floor(h * dpr);
    if (canvas.width !== nextW || canvas.height !== nextH) {
      canvas.width = nextW;
      canvas.height = nextH;
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    return { w, h, dpr };
  }

  const keys = new Set();
  let spaceHeld = false;
  window.addEventListener("keydown", (e) => {
    const k = e.key.toLowerCase();
    if (["arrowup", "arrowdown", "arrowleft", "arrowright", " ", "w", "a", "s", "d"].includes(k)) {
      e.preventDefault();
    }
    keys.add(k);
    if (k === " ") spaceHeld = true;
  });
  window.addEventListener("keyup", (e) => {
    const k = e.key.toLowerCase();
    keys.delete(k);
    if (k === " ") spaceHeld = false;
  });

  function isDown(name) {
    return keys.has(name);
  }

  function circleHit(ax, ay, ar, bx, by, br) {
    const dx = ax - bx;
    const dy = ay - by;
    const rr = ar + br;
    return dx * dx + dy * dy <= rr * rr;
  }

  function drawRocket(x, y, r, tilt) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(tilt);

    // glow
    ctx.shadowColor = "rgba(98,213,255,.45)";
    ctx.shadowBlur = 18;

    // body
    ctx.beginPath();
    ctx.moveTo(0, -r * 1.3);
    ctx.quadraticCurveTo(r * 0.9, -r * 0.2, r * 0.55, r * 0.95);
    ctx.quadraticCurveTo(0, r * 1.15, -r * 0.55, r * 0.95);
    ctx.quadraticCurveTo(-r * 0.9, -r * 0.2, 0, -r * 1.3);
    ctx.closePath();
    const bodyGrad = ctx.createLinearGradient(0, -r * 1.4, 0, r * 1.2);
    bodyGrad.addColorStop(0, "rgba(255,255,255,.95)");
    bodyGrad.addColorStop(1, "rgba(175,190,255,.55)");
    ctx.fillStyle = bodyGrad;
    ctx.fill();

    // window
    ctx.shadowBlur = 0;
    ctx.beginPath();
    ctx.ellipse(0, -r * 0.22, r * 0.28, r * 0.40, 0, 0, Math.PI * 2);
    const glass = ctx.createRadialGradient(0, -r * 0.30, 1, 0, -r * 0.24, r * 0.55);
    glass.addColorStop(0, "rgba(98,213,255,.92)");
    glass.addColorStop(1, "rgba(98,213,255,.20)");
    ctx.fillStyle = glass;
    ctx.fill();

    // fins
    ctx.beginPath();
    ctx.moveTo(-r * 0.55, r * 0.82);
    ctx.lineTo(-r * 1.06, r * 1.20);
    ctx.lineTo(-r * 0.22, r * 1.08);
    ctx.closePath();
    ctx.fillStyle = "rgba(255,77,125,.70)";
    ctx.fill();

    ctx.beginPath();
    ctx.moveTo(r * 0.55, r * 0.82);
    ctx.lineTo(r * 1.06, r * 1.20);
    ctx.lineTo(r * 0.22, r * 1.08);
    ctx.closePath();
    ctx.fillStyle = "rgba(255,77,125,.70)";
    ctx.fill();

    // flame
    ctx.beginPath();
    ctx.moveTo(0, r * 1.18);
    ctx.quadraticCurveTo(r * 0.28, r * 1.62, 0, r * 2.05);
    ctx.quadraticCurveTo(-r * 0.28, r * 1.62, 0, r * 1.18);
    const flame = ctx.createRadialGradient(0, r * 1.7, 2, 0, r * 1.7, r * 0.9);
    flame.addColorStop(0, "rgba(255,215,120,.95)");
    flame.addColorStop(0.55, "rgba(255,77,125,.75)");
    flame.addColorStop(1, "rgba(255,77,125,0)");
    ctx.fillStyle = flame;
    ctx.fill();

    ctx.restore();
  }

  function drawMeteor(m) {
    ctx.save();
    ctx.translate(m.x, m.y);
    ctx.rotate(m.rot);

    ctx.shadowColor = "rgba(0,0,0,.55)";
    ctx.shadowBlur = 16;

    const g = ctx.createRadialGradient(-m.r * 0.25, -m.r * 0.25, m.r * 0.4, 0, 0, m.r * 1.35);
    g.addColorStop(0, "rgba(255,235,215,.78)");
    g.addColorStop(0.45, "rgba(170,130,105,.92)");
    g.addColorStop(1, "rgba(65,45,35,.96)");

    ctx.beginPath();
    const spikes = m.points.length;
    for (let i = 0; i < spikes; i++) {
      const a = (i / spikes) * Math.PI * 2;
      const rr = m.r * m.points[i];
      const px = Math.cos(a) * rr;
      const py = Math.sin(a) * rr;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fillStyle = g;
    ctx.fill();

    ctx.shadowBlur = 0;
    ctx.strokeStyle = "rgba(255,255,255,.10)";
    ctx.lineWidth = 1;
    ctx.stroke();

    ctx.restore();
  }

  function makeStars(count, w, h) {
    const stars = [];
    for (let i = 0; i < count; i++) {
      stars.push({
        x: Math.random() * w,
        y: Math.random() * h,
        r: rand(0.6, 1.8),
        s: rand(12, 55), // px/sec
        a: rand(0.25, 0.95),
        tw: rand(0.6, 1.7),
      });
    }
    return stars;
  }

  function resizeWorld(world) {
    const { w, h } = fitCanvasToCssSize();
    world.w = w;
    world.h = h;
    const target = Math.floor((w * h) / 5200);
    const desired = clamp(target, 90, 220);
    if (!world.stars || world.stars.length !== desired) {
      world.stars = makeStars(desired, w, h);
    } else {
      // keep stars in bounds
      for (const s of world.stars) {
        s.x = (s.x / Math.max(1, world.prevW)) * w;
        s.y = (s.y / Math.max(1, world.prevH)) * h;
      }
    }
    world.prevW = w;
    world.prevH = h;
  }

  function newGameState() {
    const state = {
      w: 960,
      h: 540,
      prevW: 960,
      prevH: 540,
      stars: [],

      running: true,
      score: 0,
      health: 100,

      player: {
        x: 0,
        y: 0,
        r: 16,
        speed: 360, // px/sec
        invulnMs: 0,
      },

      bullets: [],
      meteors: [],
      pops: [],

      spawnMs: 900,
      spawnTimer: 0,
      difficultyTimer: 0,
      fireCooldownMs: 140,
      fireTimer: 0,
    };
    resizeWorld(state);
    state.player.x = state.w * 0.5;
    state.player.y = state.h * 0.80;
    return state;
  }

  function spawnMeteor(state) {
    const r = rand(16, 44);
    const x = rand(r + 12, state.w - r - 12);
    const y = -r - 10;
    const speed = rand(110, 220) + (1 - state.spawnMs / 900) * 120;
    const drift = rand(-20, 20);
    const rotSpd = rand(-1.8, 1.8);
    const points = Array.from({ length: Math.floor(rand(7, 11)) }, () => rand(0.72, 1.25));
    state.meteors.push({
      x,
      y,
      r,
      vx: drift,
      vy: speed,
      rot: rand(0, Math.PI * 2),
      rotSpd,
      points,
      hp: Math.max(1, Math.round(r / 18)),
    });
  }

  function spawnPop(state, x, y, rgb) {
    const n = Math.floor(rand(10, 18));
    for (let i = 0; i < n; i++) {
      const a = rand(0, Math.PI * 2);
      const sp = rand(70, 260);
      state.pops.push({
        x,
        y,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp,
        r: rand(1.2, 2.8),
        life: rand(260, 520),
        t: 0,
        rgb,
      });
    }
  }

  function updateHud(state) {
    scoreEl.textContent = String(state.score);
    healthEl.textContent = String(Math.max(0, Math.ceil(state.health)));
  }

  function showOverlay(title, subtitle) {
    overlayTitleEl.textContent = title;
    overlaySubtitleEl.textContent = subtitle;
    overlayEl.classList.remove("overlay--hidden");
  }

  function hideOverlay() {
    overlayEl.classList.add("overlay--hidden");
  }

  let state = newGameState();
  updateHud(state);
  showOverlay("Space Shooter", "Press Restart to begin.");

  restartBtn.addEventListener("click", () => {
    state = newGameState();
    updateHud(state);
    hideOverlay();
  });

  let last = performance.now();
  function frame(now) {
    const dtMs = Math.min(34, now - last);
    const dt = dtMs / 1000;
    last = now;

    if (state.running) {
      tick(state, dtMs, dt);
      render(state, now / 1000);
    } else {
      render(state, now / 1000);
    }
    requestAnimationFrame(frame);
  }

  function tick(state, dtMs, dt) {
    // Resize
    resizeWorld(state);

    // Difficulty ramps: spawn faster over time
    state.difficultyTimer += dtMs;
    if (state.difficultyTimer >= 1300) {
      state.difficultyTimer = 0;
      state.spawnMs = Math.max(260, state.spawnMs - 22);
    }

    // Spawn meteors
    state.spawnTimer += dtMs;
    while (state.spawnTimer >= state.spawnMs) {
      state.spawnTimer -= state.spawnMs;
      spawnMeteor(state);
    }

    // Stars drift
    for (const s of state.stars) {
      s.y += s.s * dt;
      if (s.y > state.h + 6) {
        s.y = -6;
        s.x = Math.random() * state.w;
      }
    }

    // Player movement
    const up = isDown("arrowup") || isDown("w");
    const down = isDown("arrowdown") || isDown("s");
    const left = isDown("arrowleft") || isDown("a");
    const right = isDown("arrowright") || isDown("d");

    let mx = 0;
    let my = 0;
    if (left) mx -= 1;
    if (right) mx += 1;
    if (up) my -= 1;
    if (down) my += 1;
    const mlen = Math.hypot(mx, my) || 1;
    mx /= mlen;
    my /= mlen;

    const p = state.player;
    p.x += mx * p.speed * dt;
    p.y += my * p.speed * dt;
    p.x = clamp(p.x, p.r + 14, state.w - p.r - 14);
    p.y = clamp(p.y, p.r + 14, state.h - p.r - 14);

    if (p.invulnMs > 0) p.invulnMs = Math.max(0, p.invulnMs - dtMs);

    // Shooting
    state.fireTimer = Math.max(0, state.fireTimer - dtMs);
    if (spaceHeld && state.fireTimer === 0) {
      state.fireTimer = state.fireCooldownMs;
      const bulletSpeed = 720;
      state.bullets.push({
        x: p.x,
        y: p.y - p.r * 1.2,
        vx: 0,
        vy: -bulletSpeed,
        r: 3.2,
      });
      spawnPop(state, p.x, p.y + p.r * 1.1, { r: 98, g: 213, b: 255 });
    }

    // Bullets update
    for (const b of state.bullets) {
      b.x += b.vx * dt;
      b.y += b.vy * dt;
    }
    state.bullets = state.bullets.filter((b) => b.y > -40);

    // Meteors update
    for (const m of state.meteors) {
      m.x += m.vx * dt;
      m.y += m.vy * dt;
      m.rot += m.rotSpd * dt;
    }
    state.meteors = state.meteors.filter((m) => m.y < state.h + m.r + 60);

    // Pops update
    for (const pop of state.pops) {
      pop.t += dtMs;
      pop.x += pop.vx * dt;
      pop.y += pop.vy * dt;
      pop.vx *= 0.985;
      pop.vy *= 0.985;
    }
    state.pops = state.pops.filter((p) => p.t < p.life);

    // Bullet-meteor collisions
    for (let i = state.meteors.length - 1; i >= 0; i--) {
      const m = state.meteors[i];
      for (let j = state.bullets.length - 1; j >= 0; j--) {
        const b = state.bullets[j];
        if (circleHit(m.x, m.y, m.r * 0.95, b.x, b.y, b.r)) {
          state.bullets.splice(j, 1);
          m.hp -= 1;
          spawnPop(state, b.x, b.y, { r: 255, g: 215, b: 120 });
          if (m.hp <= 0) {
            state.meteors.splice(i, 1);
            state.score += Math.round(10 + m.r * 0.6);
            spawnPop(state, m.x, m.y, { r: 255, g: 77, b: 125 });
          } else {
            state.score += 2;
          }
          break;
        }
      }
    }

    // Meteor-player collisions
    if (p.invulnMs === 0) {
      for (let i = state.meteors.length - 1; i >= 0; i--) {
        const m = state.meteors[i];
        if (circleHit(p.x, p.y, p.r * 0.95, m.x, m.y, m.r * 0.88)) {
          state.meteors.splice(i, 1);
          const dmg = clamp(Math.round(18 + m.r * 0.35), 18, 42);
          state.health -= dmg;
          p.invulnMs = 650;
          spawnPop(state, p.x, p.y, { r: 255, g: 77, b: 125 });
          if (state.health <= 0) {
            state.health = 0;
            state.running = false;
            updateHud(state);
            showOverlay("Game Over", `Your score: ${state.score}`);
          }
          break;
        }
      }
    }

    updateHud(state);
  }

  function render(state, t) {
    ctx.clearRect(0, 0, state.w, state.h);

    // Background vignette
    const bg = ctx.createRadialGradient(state.w * 0.5, state.h * 0.35, 40, state.w * 0.5, state.h * 0.45, Math.max(state.w, state.h));
    bg.addColorStop(0, "rgba(98,213,255,.06)");
    bg.addColorStop(0.45, "rgba(255,77,125,.03)");
    bg.addColorStop(1, "rgba(0,0,0,.42)");
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, state.w, state.h);

    // Stars
    for (const s of state.stars) {
      const tw = 0.65 + 0.35 * Math.sin(t * s.tw + s.x * 0.01);
      ctx.fillStyle = `rgba(255,255,255,${(s.a * tw).toFixed(3)})`;
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
      ctx.fill();
    }

    // Light nebula streaks
    ctx.globalAlpha = 0.18;
    ctx.strokeStyle = "rgba(98,213,255,.30)";
    ctx.lineWidth = 2;
    for (let i = 0; i < 3; i++) {
      const y = (t * 22 + i * 170) % (state.h + 240) - 120;
      ctx.beginPath();
      ctx.moveTo(state.w * 0.15, y);
      ctx.quadraticCurveTo(state.w * 0.5, y + 60, state.w * 0.85, y + 120);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;

    // Meteors
    for (const m of state.meteors) drawMeteor(m);

    // Bullets
    for (const b of state.bullets) {
      ctx.save();
      ctx.shadowColor = "rgba(98,213,255,.55)";
      ctx.shadowBlur = 12;
      ctx.fillStyle = "rgba(98,213,255,.95)";
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // Pops (particles)
    for (const pop of state.pops) {
      const a = 1 - pop.t / pop.life;
      const alpha = Math.max(0, a);
      ctx.fillStyle = `rgba(${pop.rgb.r},${pop.rgb.g},${pop.rgb.b},${alpha.toFixed(3)})`;
      ctx.beginPath();
      ctx.arc(pop.x, pop.y, pop.r, 0, Math.PI * 2);
      ctx.fill();
    }

    // Player
    const p = state.player;
    const tilt = clamp((p.x / state.w - 0.5) * 0.35, -0.35, 0.35);
    const blink = p.invulnMs > 0 && Math.floor((p.invulnMs / 90) % 2) === 0;
    if (!blink) drawRocket(p.x, p.y, p.r, tilt);

    // Health bar hint (subtle)
    const barW = Math.min(240, state.w * 0.24);
    const barX = state.w - barW - 16;
    const barY = 16;
    ctx.save();
    ctx.globalAlpha = 0.80;
    ctx.fillStyle = "rgba(255,255,255,.08)";
    ctx.fillRect(barX, barY, barW, 8);
    const hp = clamp(state.health / 100, 0, 1);
    const grad = ctx.createLinearGradient(barX, 0, barX + barW, 0);
    grad.addColorStop(0, "rgba(98,213,255,.95)");
    grad.addColorStop(0.6, "rgba(255,215,120,.95)");
    grad.addColorStop(1, "rgba(255,77,125,.95)");
    ctx.fillStyle = grad;
    ctx.fillRect(barX, barY, barW * hp, 8);
    ctx.restore();
  }

  // Start the loop
  requestAnimationFrame((t) => {
    last = t;
    requestAnimationFrame(frame);
  });
})();
