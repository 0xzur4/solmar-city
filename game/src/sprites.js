// sprites.js: Pixel chibi characters. One shared 14x20 grid per body part — hair,
// face, torso, legs — painted with a palette from the character's look, so the same
// shapes draw the street, the hero cards and the HUD portrait. No image to load;
// fillRect runs keep the pixels crisp at any scale.
export const FOOT = 17;
const OUTLINE = '#141824';



const HAIR = {
  short: ['....KKKKKK....', '...KHHHHHHK...', '..KHHHHHHHHK..'],
  quiff: ['.....KKKKK....', '...KHHHHHHK...', '..KHHHHHHHHK..'],
  cap: ['....KKKKKK....', '...KAAAAAAK...', '..KAAAAAAAKK.'],
  band: ['....KKKKKK....', '...KSSSSSSK...', '..KAAAAAAAAK..'],
  buns: ['.KK........KK.', '..KHHHHHHHHK..', '..KHHHHHHHHK..'],
  hood: ['...KKKKKKKK...', '..KHHHHHHHHK..', '..KHHHHHHHHK..'],
};
const FACE = {
  normal: ['..KSSSSSSSSK..', '..KSSESSESSK..', '..KSSSSSSSSK..', '...KSSSESSK...'],
  shades: ['..KSSSSSSSSK..', '..KSEEEEEESK..', '..KSSSSSSSSK..', '...KSSSESSK...'],
  hood: ['..KHSSSSSSHK..', '..KHSESSESHK..', '..KHSSSSSSHK..', '...KHSSSSHK...'],
  goggles: ['..KSSAASSAASK..', '..KSSESSESSK..', '..KSSSSSSSSK..', '...KSSSESSK...'],
  beard: ['..KSSSSSSSSK..', '..KSSESSESSK..', '..KSSSSSSSSK..', '...KHHHHHHK...'],
};
const NECK = { plain: ['.....SSSS.....'], scarf: ['....KAAAAK....'] };
const TORSO = [
  '..KKTTTTTTKK..',
  '.KTTKTTTTKTTK.',
  '.KTTKTTTTKTTK.',
  '.KTTKDDDDKTTK.',
  '.KSSKTTTTKSSK.',
  '..KKTTTTTTKK..',
  '...KPPPPPPK...',
];
const LEGS = {
  together: ['...KPP..PPK...', '...KPP..PPK...', '...KPP..PPK...', '..KFFFKKFFFK..', '...KKKKKKKK...'],
  apart: ['..KPP....PPK..', '..KPP....PPK..', '..KPP....PPK..', '.KFFFK..KFFFK.', '..KKKKKKKKKK..'],
};
const DETAIL_COLOR = { jacket: '#ffd23f', vest: '#e0b030', labcoat: '#37b8c8', bodysuit: '#37e0c8', uniform: '#f2c230' };

const SKINS = ['#f6d3bd', '#e9b996', '#d89c74', '#b97a56', '#8d5a3b', '#6b4129'];
const HAIRS = ['#1b1410', '#3a2416', '#6b4423', '#b5833a', '#d9c27a', '#8a8f99', '#c94f43', '#4a3a7a'];
const HAIR_STYLES = ['short', 'short', 'long', 'cap', 'bald', 'buns', 'quiff', 'short'];
const PANTS = ['#2d3550', '#3b3f2a', '#5a4a3a', '#262a33', '#4a5a7a', '#6a4a5a'];
const SHOES = ['#f2f0e6', '#222630', '#7a5a3a'];
const CAPS = ['#c94f43', '#4f7ec9', '#2fb3a6', '#f2c230'];

const pedLooks = new Map();


export function pedLook(id, shirt) {
  let look = pedLooks.get(id);
  if (look !== undefined) return look;
  const h = Math.imul(id + 7, 2654435761) >>> 0;
  look = {
    skin: SKINS[(h >>> 3) % SKINS.length],
    hairStyle: HAIR_STYLES[h % HAIR_STYLES.length],
    hair: HAIRS[(h >>> 6) % HAIRS.length],
    top: shirt,
    detail: 'tee',
    pants: PANTS[(h >>> 9) % PANTS.length],
    shoes: SHOES[(h >>> 12) % SHOES.length],
    face: (h >>> 15) % 7 === 0 ? 'shades' : 'normal',
    accent: CAPS[(h >>> 4) % CAPS.length],
    eye: '#1a1a22',
    scale: 0.86 + ((h >>> 18) % 5) * 0.025,
  };
  if (pedLooks.size > 500) pedLooks.clear();
  pedLooks.set(id, look);
  return look;
}


export const COP_LOOK = {
  skin: '#e2b08d', hairStyle: 'cap', hair: '#2a1c14', accent: '#1d2433', top: '#26324a',
  detail: 'uniform', pants: '#1a2030', shoes: '#101218', face: 'shades', eye: '#1a1a22', scale: 0.95,
};



const WEAPON_SPRITES = {
  pistol: { tip: 14, rows: ['..KKKKKKKKKK..', '..KGGGGGGGGGK.', '..KGWWWWWWWGK.', '.KKK..........', '.KDK..........'] },
  smg: { tip: 18, rows: ['...KKKKKKKKKKKKK..', '...KGGGGGGGGGGGGK.', '...KGWWWWWWWWWWGK.', '.KKK...KKKK.......', '.KDK...KDDK.......'] },
  shotgun: { tip: 20, rows: ['..KKKKKKKKKKKKKKKK..', '..KGGGGGGGGGGGGGGGK.', '..KGWWWWWWWWWWWWWGK.', '.KKKKKKKKK............', '.KDDDDDDDDD...........'] },
  plasma: { tip: 18, rows: ['..KKKKKKKKKKKKKK..', '..KGGGGGGGGGGGGGK.', '..KGCCCCCCCCCCCGK.', '..KGGGGGGGGGGGGGK.', '.KKK...KKKK.......', '.KDK...KDDK.......'] },
};


function paintRows(ctx, rows, palette, x0, y0) {
  for (let r = 0; r < rows.length; r += 1) {
    const row = rows[r];
    let c = 0;
    while (c < row.length) {
      const ch = row[c];
      if (ch === '.') { c += 1; continue; }
      let end = c + 1;
      while (end < row.length && row[end] === ch) end += 1;
      ctx.fillStyle = palette[ch];
      ctx.fillRect(x0 + c, y0 + r, end - c, 1);
      c = end;
    }
  }
}





export function drawCharacter(ctx, c) {
  const look = c.look;
  const time = c.time ?? 0;
  const seed = c.seed ?? 0;
  const moving = c.moving ?? 0;
  const phase = c.walk ?? 0;
  const facing = c.facing < 0 ? -1 : 1;
  const sc = (c.scale ?? 1) * (look.scale ?? 1) * 0.9;
  const flash = c.flash ?? 0;
  const tint = c.tint ?? '#ffffff';
  const idle = Math.sin(time * 2.6 + seed);
  const walking = moving > 0.05;
  const bob = walking ? -Math.abs(Math.sin(phase)) * 1.6 * moving : idle * 0.4;
  const squash = 1 + (walking ? Math.cos(phase * 2) * 0.03 * moving : idle * 0.008) + (c.stretch ?? 0);
  const am = facing > 0 ? (c.aim ?? 0) : Math.PI - (c.aim ?? 0);
  const palette = {
    K: OUTLINE, S: look.skin, H: look.hair, T: look.top, P: look.pants,
    F: look.shoes, E: look.eye ?? '#1a1a22', A: look.accent ?? look.top,
    D: DETAIL_COLOR[look.detail] ?? look.top,
  };
  const step = walking && Math.sin(phase) < 0 ? 'apart' : 'together';

  ctx.save();
  ctx.translate(c.x, c.y + FOOT * sc);
  if (c.alpha !== undefined) ctx.globalAlpha = c.alpha;

  const sw = 13 * sc * ((look.bodyW ?? 19) / 19);
  ctx.fillStyle = 'rgba(0, 0, 0, 0.38)';
  ctx.beginPath();
  ctx.ellipse(0, 1, sw, sw * 0.4, 0, 0, Math.PI * 2);
  ctx.fill();
  if (c.aura) {
    ctx.strokeStyle = c.aura;
    ctx.globalAlpha = (c.alpha ?? 1) * (0.55 + Math.sin(time * 9) * 0.25);
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(0, 1, sw * 1.15, sw * 0.48, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.globalAlpha = c.alpha ?? 1;
  }
  ctx.scale(facing * sc, sc * squash);
  ctx.translate(-7, -20 + bob);
  const rows = [
    ...(HAIR[look.hairStyle] ?? HAIR.short),
    ...(FACE[look.face ?? 'normal'] ?? FACE.normal),
    ...(NECK[look.extra === 'scarf' ? 'scarf' : 'plain']),
    ...TORSO,
    ...LEGS[step],
  ];
  paintRows(ctx, rows, palette, 0, 0);

  if (flash > 0.02) {
    const flashPalette = { K: tint, S: tint, H: tint, T: tint, P: tint, F: tint, E: tint, A: tint, D: tint };
    ctx.globalAlpha = Math.min(1, flash) * (c.alpha ?? 1);
    paintRows(ctx, rows, flashPalette, 0, 0);
    ctx.globalAlpha = c.alpha ?? 1;
  }

  const weaponId = c.weapon;
  if (weaponId !== null && weaponId !== undefined) {
    const weapon = WEAPON_SPRITES[weaponId] ?? WEAPON_SPRITES.pistol;
    const recoil = c.recoil ?? 0;
    const hx = 4 + Math.cos(am) * (8 - recoil * 3);
    const hy = -9 + Math.sin(am) * (8 - recoil * 3);
    ctx.save();
    ctx.translate(hx, hy);
    ctx.rotate(am);
    paintRows(ctx, weapon.rows, { K: OUTLINE, G: '#8e97a8', D: '#3a2f2a', W: '#e4ebf7', C: '#37e0c8' }, -3, -2);
    if (c.muzzle > 0) {
      const size = 4 + Math.min(1, c.muzzle / 0.07) * 4;
      ctx.fillStyle = weaponId === 'plasma' ? '#37e0c8' : '#ffb347';
      ctx.fillRect(weapon.tip - 3, -size / 2, size, size);
      ctx.fillStyle = '#fff6c0';
      ctx.fillRect(weapon.tip - 2, -size / 4, size / 2, size / 2);
    }
    ctx.restore();
  }
  ctx.restore();

  if (c.shield > 0) {
    ctx.save();
    ctx.translate(c.x, c.y);
    const r = 27 * sc;
    ctx.fillStyle = `rgba(90, 200, 255, ${0.25 * c.shield})`;
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = `rgba(170, 235, 255, ${0.7 * c.shield})`;
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.restore();
  }
}


export function muzzleReach(id) {
  return (WEAPON_SPRITES[id]?.tip ?? 14) + 6;
}


export function facingFromAngle(angle) {
  return Math.cos(angle) < 0 ? -1 : 1;
}
