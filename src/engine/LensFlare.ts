import * as THREE from 'three';

/**
 * Screen-space lens flare: a few additive ghosts placed along the line from
 * the light through the screen centre, faded by how much of the light's disc
 * is visible (an occluder sphere test) and by its distance from the centre.
 */
export class LensFlare {
  readonly group = new THREE.Group();
  private sprites: { sprite: THREE.Sprite; offset: number; size: number; alpha: number }[] = [];
  private textures: THREE.Texture[] = [];

  constructor() {
    const ring = makeTexture('ring');
    const disc = makeTexture('disc');
    const streak = makeTexture('streak');
    this.textures.push(ring, disc, streak);
    const defs: [THREE.Texture, number, number, number, number][] = [
      [streak, 0, 0.5, 0.12, 0xffe6c0],
      [disc, 0.35, 0.09, 0.28, 0x9fc3ff],
      [ring, 0.55, 0.22, 0.14, 0xffd27a],
      [disc, 0.85, 0.05, 0.3, 0xff9a6a],
      [ring, 1.15, 0.3, 0.1, 0x7fa8ff],
      [disc, 1.45, 0.12, 0.2, 0xffe6c0],
    ];
    for (const [tex, offset, size, alpha, color] of defs) {
      const mat = new THREE.SpriteMaterial({ map: tex, color, blending: THREE.AdditiveBlending, transparent: true, depthTest: false, depthWrite: false, opacity: 0 });
      const sprite = new THREE.Sprite(mat);
      sprite.renderOrder = 50;
      this.group.add(sprite);
      this.sprites.push({ sprite, offset, size, alpha });
    }
    this.group.frustumCulled = false;
  }

  /**
   * @param lightWorld world position of the light
   * @param occluder sphere that may hide the light (the focus body), or null
   * @param intensity 0..1 overall strength
   */
  update(camera: THREE.PerspectiveCamera, lightWorld: THREE.Vector3, occluder: { center: THREE.Vector3; radius: number } | null, intensity: number): void {
    const ndc = lightWorld.clone().project(camera);
    let visible = ndc.z < 1 && Math.abs(ndc.x) < 1.3 && Math.abs(ndc.y) < 1.3;
    if (visible && occluder) {
      const toLight = lightWorld.clone().sub(camera.position);
      const dist = toLight.length();
      toLight.divideScalar(dist);
      const toC = occluder.center.clone().sub(camera.position);
      const along = toC.dot(toLight);
      if (along > 0 && along < dist) {
        const perp = Math.sqrt(Math.max(0, toC.lengthSq() - along * along));
        if (perp < occluder.radius) visible = false;
      }
    }
    const centreFade = 1 - Math.min(1, Math.hypot(ndc.x, ndc.y) / 1.3);
    const strength = visible ? intensity * (0.35 + 0.65 * centreFade) : 0;
    // place sprites in camera space at a fixed depth so their screen size is predictable
    const depth = Math.max(camera.near * 4, 1);
    const halfH = Math.tan((camera.fov * Math.PI) / 360) * depth;
    const halfW = halfH * camera.aspect;
    for (const s of this.sprites) {
      const x = ndc.x * (1 - s.offset) * halfW * -1 + ndc.x * halfW; // interpolate from light (offset 0) toward the mirrored side (offset 2)
      const y = ndc.y * (1 - s.offset) * halfH * -1 + ndc.y * halfH;
      const local = new THREE.Vector3(x, y, -depth);
      s.sprite.position.copy(local.applyMatrix4(camera.matrixWorld));
      const sc = s.size * halfH;
      s.sprite.scale.set(sc * (s.sprite.material.map === this.textures[2] ? 5 : 1), sc * (s.sprite.material.map === this.textures[2] ? 0.35 : 1), 1);
      s.sprite.material.opacity += (strength * s.alpha - s.sprite.material.opacity) * 0.2;
      s.sprite.visible = s.sprite.material.opacity > 0.005;
    }
  }

  dispose(): void {
    for (const s of this.sprites) s.sprite.material.dispose();
    for (const t of this.textures) t.dispose();
  }
}

function makeTexture(kind: 'ring' | 'disc' | 'streak'): THREE.Texture {
  const n = 128;
  const c = document.createElement('canvas');
  c.width = c.height = n;
  const ctx = c.getContext('2d')!;
  if (kind === 'streak') {
    const g = ctx.createLinearGradient(0, 0, n, 0);
    g.addColorStop(0, 'rgba(255,255,255,0)');
    g.addColorStop(0.5, 'rgba(255,255,255,1)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, n / 2 - 2, n, 4);
    const v = ctx.createLinearGradient(0, 0, 0, n);
    v.addColorStop(0, 'rgba(0,0,0,1)');
    v.addColorStop(0.5, 'rgba(0,0,0,0)');
    v.addColorStop(1, 'rgba(0,0,0,1)');
    ctx.globalCompositeOperation = 'destination-out';
    ctx.fillStyle = v;
    ctx.fillRect(0, 0, n, n);
  } else {
    const g = ctx.createRadialGradient(n / 2, n / 2, 0, n / 2, n / 2, n / 2);
    if (kind === 'ring') {
      g.addColorStop(0, 'rgba(255,255,255,0)');
      g.addColorStop(0.75, 'rgba(255,255,255,0)');
      g.addColorStop(0.86, 'rgba(255,255,255,0.9)');
      g.addColorStop(1, 'rgba(255,255,255,0)');
    } else {
      g.addColorStop(0, 'rgba(255,255,255,0.9)');
      g.addColorStop(0.6, 'rgba(255,255,255,0.35)');
      g.addColorStop(1, 'rgba(255,255,255,0)');
    }
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, n, n);
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
