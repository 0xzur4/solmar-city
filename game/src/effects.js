// effects.js: Short-lived visual effects: particles (smoke, sparks, dust), skid mark

const MAX_PARTICLES = 240;
const MAX_SKIDS = 400;
const MAX_FLOATERS = 40;
const MAX_RINGS = 10;

export function createEffects() {
  const particles = [];
  for (let i = 0; i < MAX_PARTICLES; i += 1) {
    particles.push({ active: false, x: 0, y: 0, vx: 0, vy: 0, life: 0, maxLife: 1, size: 2, color: '#ffffff' });
  }
  const skids = [];
  for (let i = 0; i < MAX_SKIDS; i += 1) {
    skids.push({ active: false, x1: 0, y1: 0, x2: 0, y2: 0, life: 0 });
  }
  const floaters = [];
  for (let i = 0; i < MAX_FLOATERS; i += 1) {
    floaters.push({ active: false, x: 0, y: 0, life: 0, text: '', color: '#ffffff' });
  }
  const rings = [];
  for (let i = 0; i < MAX_RINGS; i += 1) {
    rings.push({ active: false, x: 0, y: 0, radius: 0, life: 0, maxLife: 1, color: '#ffffff' });
  }
  let skidCursor = 0;
  let shake = 0;

  function freeParticle() {
    for (const particle of particles) if (!particle.active) return particle;
    return null;
  }

  function burst(x, y, count, color, speed, size, life) {
    for (let i = 0; i < count; i += 1) {
      const particle = freeParticle();
      if (particle === null) return;
      const angle = Math.random() * Math.PI * 2;
      const velocity = speed * (0.4 + Math.random() * 0.6);
      particle.active = true;
      particle.x = x;
      particle.y = y;
      particle.vx = Math.cos(angle) * velocity;
      particle.vy = Math.sin(angle) * velocity;
      particle.life = life * (0.6 + Math.random() * 0.4);
      particle.maxLife = particle.life;
      particle.size = size * (0.7 + Math.random() * 0.6);
      particle.color = color;
    }
  }

  return {

    get shake() {
      return shake;
    },
    addShake(amount) {
      shake = Math.min(14, shake + amount);
    },
    smoke(x, y) {
      burst(x, y, 2, '#9a9a9a', 40, 5, 0.7);
    },

    explosion(x, y) {
      burst(x, y, 22, '#ff9a3c', 320, 6, 0.7);
      burst(x, y, 12, '#ffd23f', 220, 4, 0.4);
      burst(x, y, 10, '#5a5a5a', 70, 9, 1.4);
      shake = Math.min(14, shake + 9);
    },
    sparks(x, y) {
      burst(x, y, 10, '#ffd23f', 260, 3, 0.4);
    },
    muzzle(x, y) {
      burst(x, y, 5, '#ffe08a', 200, 3, 0.12);
    },
    blood(x, y) {
      burst(x, y, 8, '#a02020', 140, 3, 0.5);
    },
    addSkid(x1, y1, x2, y2) {
      const skid = skids[skidCursor];
      skidCursor = (skidCursor + 1) % skids.length;
      skid.active = true;
      skid.x1 = x1;
      skid.y1 = y1;
      skid.x2 = x2;
      skid.y2 = y2;
      skid.life = 6;
    },

    addRing(x, y, color, radius, life) {
      for (const ring of rings) {
        if (ring.active) continue;
        ring.active = true;
        ring.x = x;
        ring.y = y;
        ring.radius = radius;
        ring.life = life;
        ring.maxLife = life;
        ring.color = color;
        return;
      }
    },

    shell(x, y) {
      burst(x, y, 1, '#e0b030', 90, 2.2, 0.55);
    },
    addFloater(x, y, text, color) {
      for (const floater of floaters) {
        if (floater.active) continue;
        floater.active = true;
        floater.x = x;
        floater.y = y;
        floater.life = 1.6;
        floater.text = text;
        floater.color = color;
        return;
      }
    },
    step(dt) {
      shake = Math.max(0, shake - dt * 26);
      for (const particle of particles) {
        if (!particle.active) continue;
        particle.life -= dt;
        if (particle.life <= 0) {
          particle.active = false;
          continue;
        }
        particle.x += particle.vx * dt;
        particle.y += particle.vy * dt;
        particle.vx *= 0.96;
        particle.vy *= 0.96;
      }
      for (const skid of skids) {
        if (!skid.active) continue;
        skid.life -= dt;
        if (skid.life <= 0) skid.active = false;
      }
      for (const ring of rings) {
        if (!ring.active) continue;
        ring.life -= dt;
        if (ring.life <= 0) ring.active = false;
      }
      for (const floater of floaters) {
        if (!floater.active) continue;
        floater.life -= dt;
        floater.y -= 34 * dt;
        if (floater.life <= 0) floater.active = false;
      }
    },
    forEachParticle(callback) {
      for (const particle of particles) if (particle.active) callback(particle);
    },
    forEachSkid(callback) {
      for (const skid of skids) if (skid.active) callback(skid);
    },
    forEachRing(callback) {
      for (const ring of rings) if (ring.active) callback(ring);
    },
    forEachFloater(callback) {
      for (const floater of floaters) if (floater.active) callback(floater);
    },
  };
}
