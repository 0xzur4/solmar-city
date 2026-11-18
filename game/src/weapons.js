// weapons.js: The arsenal. Every weapon is data: how it fires, how it sounds, how it
// looks in the hand. All weapons fire while the trigger is held (their cooldown paces
// repeat fire); the pistol keeps the numbers the original game was tuned around. New
// weapons are picked up from crates around the city, or issued to a hero at the start.
export const WEAPON_ORDER = ['pistol', 'smg', 'shotgun', 'plasma'];

export const WEAPONS = {
  pistol: {
    id: 'pistol', name: 'Street Pistol', slot: 1, damage: 34, cooldown: 0.28,
    speed: 900, range: 520, spread: 0.05, pellets: 1, auto: true,
    pickupAmmo: 24, startAmmo: 24, heat: 12, muzzle: 17, color: '#ffe08a',
    size: 6, pierce: 0, kind: 'bullet', twoHanded: false,
  },
  smg: {
    id: 'smg', name: 'Rattler SMG', slot: 2, damage: 13, cooldown: 0.085,
    speed: 980, range: 470, spread: 0.11, pellets: 1, auto: true,
    pickupAmmo: 60, startAmmo: 90, heat: 2.5, muzzle: 24, color: '#ffcf5a',
    size: 5, pierce: 0, kind: 'bullet', twoHanded: true,
  },
  shotgun: {
    id: 'shotgun', name: 'Boom Stick', slot: 3, damage: 15, cooldown: 0.75,
    speed: 820, range: 300, spread: 0.26, pellets: 6, auto: true,
    pickupAmmo: 12, startAmmo: 16, heat: 16, muzzle: 29, color: '#ff9a3c',
    size: 5, pierce: 0, kind: 'bullet', twoHanded: true,
  },
  plasma: {
    id: 'plasma', name: 'Ion Blaster', slot: 4, damage: 46, cooldown: 0.3,
    speed: 760, range: 640, spread: 0.02, pellets: 1, auto: true,
    pickupAmmo: 20, startAmmo: 30, heat: 14, muzzle: 27, color: '#37e0c8',
    size: 9, pierce: 2, kind: 'plasma', twoHanded: true,
  },
};


export function cycleWeapon(owned, current, dir) {
  const start = WEAPON_ORDER.indexOf(current);
  for (let step = 1; step <= WEAPON_ORDER.length; step += 1) {
    const id = WEAPON_ORDER[(start + dir * step + WEAPON_ORDER.length * 4) % WEAPON_ORDER.length];
    if (owned[id]) return id;
  }
  return current;
}
