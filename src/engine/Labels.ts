import * as THREE from 'three';

export interface LabelEntry {
  id: string;
  text: string;
  color: string;
  /** higher wins in declutter */
  priority: number;
  position: THREE.Vector3;
  /** display radius in scene units, used for the anchor offset */
  radius: number;
  visible: boolean;
}

interface Slot {
  el: HTMLButtonElement;
  dot: HTMLSpanElement;
  name: HTMLSpanElement;
  id: string;
}

const tmp = new THREE.Vector3();
const tmp2 = new THREE.Vector3();

/**
 * DOM labels projected each frame with sphere occlusion and greedy
 * declutter. A hidden list mirrors the visible labels for screen readers.
 */
export class Labels {
  private readonly layer: HTMLDivElement;
  private readonly list: HTMLUListElement;
  private slots = new Map<string, Slot>();
  private rects: { x: number; y: number; w: number; h: number }[] = [];
  onSelect: ((id: string) => void) | null = null;
  enabled = true;

  constructor(private readonly stage: HTMLElement) {
    this.layer = document.createElement('div');
    this.layer.className = 'label-layer';
    this.layer.setAttribute('aria-hidden', 'true');
    this.list = document.createElement('ul');
    this.list.className = 'sr-only';
    this.list.setAttribute('aria-label', 'Worlds in view');
    stage.append(this.layer, this.list);
  }

  private slot(entry: LabelEntry): Slot {
    let s = this.slots.get(entry.id);
    if (!s) {
      const el = document.createElement('button');
      el.className = 'body-label';
      el.type = 'button';
      el.dataset.body = entry.id;
      el.setAttribute('data-ui', '');
      const dot = document.createElement('span');
      dot.className = 'body-label-dot';
      const name = document.createElement('span');
      name.className = 'body-label-name';
      el.append(dot, name);
      el.addEventListener('click', (e) => {
        e.stopPropagation();
        this.onSelect?.(entry.id);
      });
      this.layer.append(el);
      s = { el, dot, name, id: entry.id };
      this.slots.set(entry.id, s);
    }
    if (s.name.textContent !== entry.text) s.name.textContent = entry.text;
    s.dot.style.background = entry.color;
    return s;
  }

  update(entries: LabelEntry[], camera: THREE.Camera, occluder: { center: THREE.Vector3; radius: number } | null, selectedId: string | null): void {
    const w = this.stage.clientWidth;
    const h = this.stage.clientHeight;
    this.rects.length = 0;
    const sorted = [...entries].sort((a, b) => (b.id === selectedId ? 1 : 0) - (a.id === selectedId ? 1 : 0) || b.priority - a.priority);
    const shown: string[] = [];
    const seen = new Set<string>();
    for (const e of sorted) {
      seen.add(e.id);
      const s = this.slot(e);
      let visible = this.enabled && e.visible;
      if (visible) {
        tmp.copy(e.position);
        // occlusion by the focus sphere: hide if the segment camera->point passes through it and the point is behind
        if (occluder && e.id !== selectedId) {
          const toPoint = tmp2.subVectors(tmp, camera.position);
          const dist = toPoint.length();
          toPoint.divideScalar(dist);
          const toCenter = new THREE.Vector3().subVectors(occluder.center, camera.position);
          const along = toCenter.dot(toPoint);
          if (along > 0 && along < dist) {
            const perp = Math.sqrt(Math.max(0, toCenter.lengthSq() - along * along));
            if (perp < occluder.radius * 0.98) visible = false;
          }
        }
        tmp.project(camera);
        if (tmp.z > 1 || tmp.z < -1) visible = false;
        if (visible) {
          const x = (tmp.x * 0.5 + 0.5) * w;
          const y = (-tmp.y * 0.5 + 0.5) * h;
          if (x < -40 || x > w + 40 || y < -20 || y > h + 20) visible = false;
          else {
            const rect = { x: x + 10, y: y - 12, w: 14 + e.text.length * 7.2, h: 24 };
            const clash = this.rects.some((r) => rect.x < r.x + r.w && rect.x + rect.w > r.x && rect.y < r.y + r.h && rect.y + rect.h > r.y);
            if (clash && e.id !== selectedId) visible = false;
            else {
              this.rects.push(rect);
              s.el.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px)`;
            }
          }
        }
      }
      s.el.hidden = !visible;
      s.el.classList.toggle('is-selected', e.id === selectedId);
      if (visible) shown.push(e.text);
    }
    for (const [id, s] of this.slots) {
      if (!seen.has(id)) {
        s.el.remove();
        this.slots.delete(id);
      }
    }
    const summary = shown.join(', ');
    if (this.list.dataset.summary !== summary) {
      this.list.dataset.summary = summary;
      this.list.replaceChildren(...shown.map((t) => Object.assign(document.createElement('li'), { textContent: t })));
    }
  }

  dispose(): void {
    this.layer.remove();
    this.list.remove();
    this.slots.clear();
  }
}
