/**
 * Camadas de canvas do hero (telemetria). Portado de Lukas_20.html mantendo parâmetros, cores e contagens.
 * Cada camada guarda o próprio estado e desenha num contexto 2D já escalado pelo DPR.
 */
export type Layer = {
  /** Informa o tamanho em px CSS; as partículas só são criadas na primeira chamada (como no original). */
  resize(width: number, height: number): void;
  draw(time: number): void;
};

const rnd = Math.random;
const TAU = Math.PI * 2;

export function createBaseLayer(ctx: CanvasRenderingContext2D): Layer {
  let W = 0;
  let H = 0;
  type Dot = { x: number; y: number; vx: number; vy: number; r: number; a: number; tw: number; life: number };
  type Trail = { x: number; y: number; len: number; vy: number; a: number; w: number };
  type Pulse = { y: number; x: number; speed: number; width: number; a: number; delay: number };
  const dots: Dot[] = [];
  const trails: Trail[] = [];
  const pulses: Pulse[] = [];

  const makeDot = (initial: boolean): Dot => ({
    x: rnd() * W, y: initial ? rnd() * H : H + 10, vx: (rnd() - 0.5) * 0.16, vy: -0.1 - rnd() * 0.34,
    r: 0.6 + rnd() * 1.5, a: 0.14 + rnd() * 0.65, tw: rnd() * TAU, life: 300 + rnd() * 700,
  });
  const makeTrail = (initial: boolean): Trail => ({
    x: rnd() * W, y: initial ? rnd() * H : H + 30, len: 12 + rnd() * 54, vy: 0.18 + rnd() * 0.55, a: 0.12 + rnd() * 0.42, w: 0.45 + rnd() * 0.9,
  });
  const makePulse = (initial: boolean): Pulse => ({
    y: H * (0.34 + rnd() * 0.52), x: initial ? rnd() * W : -160, speed: 0.65 + rnd() * 1.15, width: 60 + rnd() * 160, a: 0.18 + rnd() * 0.38, delay: rnd() * 200,
  });

  const grid = (time: number) => {
    ctx.save();
    ctx.globalAlpha = 0.075;
    ctx.strokeStyle = 'rgb(225,201,134)';
    ctx.lineWidth = 0.5;
    const spacing = 54;
    const offset = (time * 0.008) % spacing;
    for (let x = 0; x < W; x += spacing) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke(); }
    for (let y = -spacing + offset; y < H; y += spacing) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }
    ctx.restore();
  };

  const connections = () => {
    ctx.save();
    ctx.lineWidth = 0.45;
    for (let i = 0; i < dots.length; i++) {
      const a = dots[i]!;
      for (let j = i + 1; j < dots.length; j++) {
        const b = dots[j]!;
        const dx = a.x - b.x;
        const dy = a.y - b.y;
        const d2 = dx * dx + dy * dy;
        if (d2 < 7200) {
          ctx.strokeStyle = `rgba(225,201,134,${((1 - d2 / 7200) * 0.075).toFixed(3)})`;
          ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
        }
      }
    }
    ctx.restore();
  };

  return {
    resize(w, h) {
      W = w; H = h;
      if (!dots.length) {
        for (let i = 0; i < 95; i++) dots.push(makeDot(true));
        for (let j = 0; j < 28; j++) trails.push(makeTrail(true));
        for (let k = 0; k < 5; k++) pulses.push(makePulse(true));
      }
    },
    draw(time) {
      ctx.clearRect(0, 0, W, H);
      grid(time);

      for (const t of trails) {
        t.y -= t.vy;
        if (t.y + t.len < 0) Object.assign(t, makeTrail(false));
        const g = ctx.createLinearGradient(0, t.y, 0, t.y + t.len);
        g.addColorStop(0, 'rgba(225,201,134,0)');
        g.addColorStop(0.45, `rgba(255,240,184,${t.a})`);
        g.addColorStop(1, 'rgba(225,201,134,0)');
        ctx.strokeStyle = g;
        ctx.lineWidth = t.w;
        ctx.beginPath(); ctx.moveTo(t.x, t.y); ctx.lineTo(t.x, t.y + t.len); ctx.stroke();
      }

      dots.forEach((d, index) => {
        d.x += d.vx; d.y += d.vy; d.tw += 0.025; d.life--;
        if (d.y < -8 || d.x < -8 || d.x > W + 8 || d.life <= 0) Object.assign(d, makeDot(false));
        const alpha = d.a * (0.62 + 0.38 * Math.sin(d.tw));
        ctx.beginPath();
        ctx.fillStyle = `rgba(255,238,177,${alpha.toFixed(3)})`;
        ctx.shadowColor = 'rgba(225,201,134,.62)';
        ctx.shadowBlur = d.r * 5;
        ctx.arc(d.x, d.y, d.r, 0, TAU);
        ctx.fill();
        ctx.shadowBlur = 0;
        if (index % 13 === 0) {
          ctx.strokeStyle = `rgba(225,201,134,${(alpha * 0.55).toFixed(3)})`;
          ctx.lineWidth = 0.7;
          ctx.strokeRect(d.x - 4, d.y - 4, 8, 8);
        }
      });

      connections();

      for (const p of pulses) {
        if (p.delay > 0) { p.delay--; continue; }
        p.x += p.speed;
        if (p.x > W + 200) Object.assign(p, makePulse(false));
        const grad = ctx.createLinearGradient(p.x, 0, p.x + p.width, 0);
        grad.addColorStop(0, 'rgba(225,201,134,0)');
        grad.addColorStop(0.48, `rgba(255,240,184,${p.a})`);
        grad.addColorStop(1, 'rgba(225,201,134,0)');
        ctx.fillStyle = grad;
        ctx.fillRect(p.x, p.y, p.width, 1.2);
      }

      ctx.save();
      ctx.font = '8px JetBrains Mono, monospace';
      ctx.fillStyle = 'rgba(225,201,134,.22)';
      const labels = ['NODE 05', 'SYNC', 'LIVE', 'TRACE', 'DATA', '08:24', 'CB/01'];
      for (let q = 0; q < 8; q++) {
        ctx.fillText(labels[q % labels.length]!, W * (0.08 + (q % 4) * 0.27), H * (0.22 + Math.floor(q / 4) * 0.52));
      }
      ctx.restore();
    },
  };
}

export function createLeftLayer(ctx: CanvasRenderingContext2D): Layer {
  let W = 0;
  let H = 0;
  type Point = { x: number; y: number; vy: number; vx: number; r: number; a: number; p: number };
  type Stream = { x: number; y: number; len: number; speed: number; a: number };
  const points: Point[] = [];
  const streams: Stream[] = [];

  return {
    resize(w, h) {
      W = w; H = h;
      if (!points.length) {
        for (let i = 0; i < 54; i++) {
          points.push({ x: rnd() * W, y: rnd() * H, vy: 0.08 + rnd() * 0.22, vx: (rnd() - 0.5) * 0.1, r: 0.5 + rnd() * 1.2, a: 0.08 + rnd() * 0.38, p: rnd() * TAU });
        }
        for (let j = 0; j < 18; j++) {
          streams.push({ x: rnd() * W, y: rnd() * H, len: 12 + rnd() * 38, speed: 0.14 + rnd() * 0.32, a: 0.08 + rnd() * 0.26 });
        }
      }
    },
    draw() {
      ctx.clearRect(0, 0, W, H);
      ctx.save();
      ctx.strokeStyle = 'rgba(225,201,134,.055)';
      ctx.lineWidth = 0.5;
      const spacing = 58;
      for (let x = 0; x < W; x += spacing) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke(); }
      for (let y = 0; y < H; y += spacing) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }
      ctx.restore();

      for (const s of streams) {
        s.y -= s.speed;
        if (s.y + s.len < 0) { s.y = H + 10; s.x = rnd() * W; }
        const g = ctx.createLinearGradient(0, s.y, 0, s.y + s.len);
        g.addColorStop(0, 'rgba(225,201,134,0)');
        g.addColorStop(0.5, `rgba(255,240,184,${s.a})`);
        g.addColorStop(1, 'rgba(225,201,134,0)');
        ctx.strokeStyle = g;
        ctx.lineWidth = 0.7;
        ctx.beginPath(); ctx.moveTo(s.x, s.y); ctx.lineTo(s.x, s.y + s.len); ctx.stroke();
      }

      points.forEach((d, index) => {
        d.x += d.vx; d.y -= d.vy; d.p += 0.02;
        if (d.y < -5) { d.y = H + 5; d.x = rnd() * W; }
        const alpha = d.a * (0.7 + 0.3 * Math.sin(d.p));
        ctx.fillStyle = `rgba(255,238,177,${alpha.toFixed(3)})`;
        ctx.shadowColor = 'rgba(225,201,134,.45)';
        ctx.shadowBlur = d.r * 4;
        ctx.beginPath(); ctx.arc(d.x, d.y, d.r, 0, TAU); ctx.fill();
        ctx.shadowBlur = 0;
        if (index % 11 === 0) {
          ctx.strokeStyle = `rgba(225,201,134,${(alpha * 0.42).toFixed(3)})`;
          ctx.lineWidth = 0.5;
          ctx.strokeRect(d.x - 3, d.y - 3, 6, 6);
        }
      });
    },
  };
}

export function createBoostLayer(ctx: CanvasRenderingContext2D): Layer {
  let W = 0;
  let H = 0;
  type Particle = { x: number; y: number; vx: number; vy: number; r: number; a: number; phase: number };
  type Stream = { x: number; y: number; len: number; speed: number; a: number; w: number };
  type Packet = { x: number; y: number; speed: number; width: number; a: number };
  const particles: Particle[] = [];
  const streams: Stream[] = [];
  const packets: Packet[] = [];

  const connections = () => {
    ctx.save();
    ctx.lineWidth = 0.55;
    for (let i = 0; i < particles.length; i += 2) {
      const a = particles[i]!;
      for (let j = i + 2; j < particles.length; j += 8) {
        const b = particles[j]!;
        const dx = a.x - b.x;
        const dy = a.y - b.y;
        const d2 = dx * dx + dy * dy;
        if (d2 < 10500) {
          ctx.strokeStyle = `rgba(225,201,134,${((1 - d2 / 10500) * 0.12).toFixed(3)})`;
          ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
        }
      }
    }
    ctx.restore();
  };

  return {
    resize(w, h) {
      W = w; H = h;
      if (!particles.length) {
        for (let i = 0; i < 150; i++) {
          particles.push({ x: rnd() * W, y: rnd() * H, vx: (rnd() - 0.5) * 0.18, vy: -0.12 - rnd() * 0.42, r: 0.7 + rnd() * 1.8, a: 0.18 + rnd() * 0.68, phase: rnd() * TAU });
        }
        for (let j = 0; j < 46; j++) {
          streams.push({ x: rnd() * W, y: rnd() * H, len: 18 + rnd() * 70, speed: 0.22 + rnd() * 0.7, a: 0.16 + rnd() * 0.46, w: 0.55 + rnd() * 1.2 });
        }
        for (let k = 0; k < 9; k++) {
          packets.push({ x: rnd() * W, y: H * (0.18 + rnd() * 0.72), speed: 0.9 + rnd() * 1.8, width: 90 + rnd() * 220, a: 0.24 + rnd() * 0.5 });
        }
      }
    },
    draw() {
      ctx.clearRect(0, 0, W, H);
      ctx.save();
      ctx.strokeStyle = 'rgba(225,201,134,.10)';
      ctx.lineWidth = 0.55;
      const spacing = 46;
      for (let x = 0; x < W; x += spacing) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke(); }
      for (let y = 0; y < H; y += spacing) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }
      ctx.restore();

      for (const s of streams) {
        s.y -= s.speed;
        if (s.y + s.len < 0) { s.y = H + 20; s.x = rnd() * W; }
        const g = ctx.createLinearGradient(0, s.y, 0, s.y + s.len);
        g.addColorStop(0, 'rgba(225,201,134,0)');
        g.addColorStop(0.45, `rgba(255,244,199,${s.a})`);
        g.addColorStop(1, 'rgba(225,201,134,0)');
        ctx.strokeStyle = g;
        ctx.lineWidth = s.w;
        ctx.shadowColor = 'rgba(225,201,134,.45)';
        ctx.shadowBlur = 5;
        ctx.beginPath(); ctx.moveTo(s.x, s.y); ctx.lineTo(s.x, s.y + s.len); ctx.stroke();
        ctx.shadowBlur = 0;
      }

      particles.forEach((d, index) => {
        d.x += d.vx; d.y += d.vy; d.phase += 0.03;
        if (d.y < -10) { d.y = H + 10; d.x = rnd() * W; }
        if (d.x < -10) d.x = W + 10;
        if (d.x > W + 10) d.x = -10;
        const alpha = d.a * (0.68 + 0.32 * Math.sin(d.phase));
        ctx.fillStyle = `rgba(255,244,199,${alpha.toFixed(3)})`;
        ctx.shadowColor = 'rgba(225,201,134,.85)';
        ctx.shadowBlur = d.r * 7;
        ctx.beginPath(); ctx.arc(d.x, d.y, d.r, 0, TAU); ctx.fill();
        ctx.shadowBlur = 0;
        if (index % 9 === 0) {
          ctx.strokeStyle = `rgba(225,201,134,${(alpha * 0.62).toFixed(3)})`;
          ctx.lineWidth = 0.8;
          ctx.strokeRect(d.x - 5, d.y - 5, 10, 10);
        }
      });

      connections();

      for (const pk of packets) {
        pk.x += pk.speed;
        if (pk.x > W + 250) { pk.x = -pk.width; pk.y = H * (0.18 + rnd() * 0.72); }
        const grad = ctx.createLinearGradient(pk.x, 0, pk.x + pk.width, 0);
        grad.addColorStop(0, 'rgba(225,201,134,0)');
        grad.addColorStop(0.45, `rgba(255,244,199,${pk.a})`);
        grad.addColorStop(0.55, `rgba(255,244,199,${Math.min(1, pk.a + 0.2)})`);
        grad.addColorStop(1, 'rgba(225,201,134,0)');
        ctx.fillStyle = grad;
        ctx.shadowColor = 'rgba(225,201,134,.65)';
        ctx.shadowBlur = 8;
        ctx.fillRect(pk.x, pk.y, pk.width, 1.8);
        ctx.shadowBlur = 0;
      }
    },
  };
}
