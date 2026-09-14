import * as THREE from 'three';

export interface Pose {
  /** spherical coordinates around the target, radians */
  theta: number;
  phi: number;
  distance: number;
  target: THREE.Vector3;
}

export interface RigLimits {
  minDistance: number;
  maxDistance: number;
  minPolar: number;
  maxPolar: number;
}

const quintic = (t: number) => (t < 0.5 ? 16 * t ** 5 : 1 - (-2 * t + 2) ** 5 / 2);

/**
 * Orbit camera with inertia and interruptible flights. Follow and fly modes
 * arrive in Phase 1 alongside the floating origin.
 */
export class CameraRig {
  readonly pose: Pose;
  limits: RigLimits = { minDistance: 0.5, maxDistance: 5000, minPolar: 0.02, maxPolar: Math.PI - 0.02 };
  enabled = true;
  rotateSpeed = 1;
  zoomSpeed = 1;
  damping = 8;
  private velocity = { theta: 0, phi: 0, zoom: 0 };
  private flight: { from: Pose; to: Pose; t: number; duration: number; start: number; resolve: () => void } | null = null;
  private pointers = new Map<number, { x: number; y: number }>();
  private pinchDistance = 0;
  private reducedMotion = false;
  private disposers: (() => void)[] = [];

  constructor(readonly camera: THREE.PerspectiveCamera, readonly element: HTMLElement, initial?: Partial<Pose>) {
    this.pose = {
      theta: initial?.theta ?? 0.6,
      phi: initial?.phi ?? 1.2,
      distance: initial?.distance ?? 20,
      target: initial?.target?.clone() ?? new THREE.Vector3(),
    };
    this.reducedMotion = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
    this.bind();
    this.apply();
  }

  private bind(): void {
    const el = this.element;
    el.style.touchAction = 'none';
    const down = (e: PointerEvent) => {
      if (!this.enabled) return;
      if ((e.target as HTMLElement).closest('[data-ui]')) return;
      this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      el.setPointerCapture(e.pointerId);
      this.cancelFlight();
      if (this.pointers.size === 2) this.pinchDistance = this.currentPinch();
    };
    const move = (e: PointerEvent) => {
      const prev = this.pointers.get(e.pointerId);
      if (!prev) return;
      const cur = { x: e.clientX, y: e.clientY };
      this.pointers.set(e.pointerId, cur);
      if (this.pointers.size === 1) {
        const dx = cur.x - prev.x;
        const dy = cur.y - prev.y;
        const k = (2 * Math.PI * this.rotateSpeed) / el.clientHeight;
        this.velocity.theta = -dx * k;
        this.velocity.phi = -dy * k;
        this.pose.theta += this.velocity.theta;
        this.pose.phi += this.velocity.phi;
        this.clamp();
      } else if (this.pointers.size === 2) {
        const d = this.currentPinch();
        if (this.pinchDistance > 0) this.zoomBy(this.pinchDistance / d);
        this.pinchDistance = d;
      }
    };
    const up = (e: PointerEvent) => {
      this.pointers.delete(e.pointerId);
      if (el.hasPointerCapture(e.pointerId)) el.releasePointerCapture(e.pointerId);
    };
    const wheel = (e: WheelEvent) => {
      if (!this.enabled) return;
      if ((e.target as HTMLElement).closest('[data-ui]')) return;
      e.preventDefault();
      this.cancelFlight();
      const factor = Math.exp((e.deltaY * 0.0015) * this.zoomSpeed);
      this.velocity.zoom = factor;
    };
    el.addEventListener('pointerdown', down);
    el.addEventListener('pointermove', move);
    el.addEventListener('pointerup', up);
    el.addEventListener('pointercancel', up);
    el.addEventListener('wheel', wheel, { passive: false });
    this.disposers.push(() => {
      el.removeEventListener('pointerdown', down);
      el.removeEventListener('pointermove', move);
      el.removeEventListener('pointerup', up);
      el.removeEventListener('pointercancel', up);
      el.removeEventListener('wheel', wheel);
    });
  }

  private currentPinch(): number {
    const [a, b] = [...this.pointers.values()];
    if (!a || !b) return 0;
    return Math.hypot(a.x - b.x, a.y - b.y);
  }

  zoomBy(factor: number): void {
    this.pose.distance *= factor;
    this.clamp();
  }

  private clamp(): void {
    const p = this.pose;
    p.phi = Math.min(this.limits.maxPolar, Math.max(this.limits.minPolar, p.phi));
    p.distance = Math.min(this.limits.maxDistance, Math.max(this.limits.minDistance, p.distance));
  }

  flyTo(target: Partial<Pose>, durationSeconds = 1.6): Promise<void> {
    this.cancelFlight();
    const to: Pose = {
      theta: target.theta ?? this.pose.theta,
      phi: target.phi ?? this.pose.phi,
      distance: target.distance ?? this.pose.distance,
      target: target.target?.clone() ?? this.pose.target.clone(),
    };
    // shortest angular path
    const dTheta = ((to.theta - this.pose.theta + Math.PI) % (2 * Math.PI)) - Math.PI;
    to.theta = this.pose.theta + dTheta;
    return new Promise((resolve) => {
      this.flight = {
        from: { ...this.pose, target: this.pose.target.clone() },
        to,
        t: 0,
        start: performance.now(),
        duration: this.reducedMotion ? 0.2 : durationSeconds,
        resolve,
      };
    });
  }

  /** Update the destination of an in-progress flight (the target body keeps moving). */
  retarget(target: THREE.Vector3, distance?: number): void {
    if (!this.flight) return;
    this.flight.to.target.copy(target);
    if (distance !== undefined) this.flight.to.distance = distance;
  }

  cancelFlight(): void {
    if (this.flight) {
      this.flight.resolve();
      this.flight = null;
    }
  }

  get flying(): boolean {
    return this.flight !== null;
  }

  update(dt: number): void {
    const p = this.pose;
    if (this.flight) {
      const f = this.flight;
      f.t = Math.min(1, (performance.now() - f.start) / (f.duration * 1000));
      const k = quintic(f.t);
      p.theta = f.from.theta + (f.to.theta - f.from.theta) * k;
      p.phi = f.from.phi + (f.to.phi - f.from.phi) * k;
      p.distance = Math.exp(Math.log(f.from.distance) + (Math.log(f.to.distance) - Math.log(f.from.distance)) * k);
      p.target.lerpVectors(f.from.target, f.to.target, k);
      if (f.t >= 1) {
        f.resolve();
        this.flight = null;
      }
    } else {
      const decay = Math.exp(-this.damping * dt);
      if (this.pointers.size === 0) {
        p.theta += this.velocity.theta;
        p.phi += this.velocity.phi;
        this.velocity.theta *= decay;
        this.velocity.phi *= decay;
      }
      if (this.velocity.zoom !== 1 && this.velocity.zoom !== 0) {
        const step = Math.exp(Math.log(this.velocity.zoom) * Math.min(1, dt * 12));
        p.distance *= step;
        this.velocity.zoom = Math.exp(Math.log(this.velocity.zoom) * decay);
        if (Math.abs(Math.log(this.velocity.zoom)) < 1e-4) this.velocity.zoom = 1;
      }
    }
    this.clamp();
    this.apply();
  }

  private apply(): void {
    const p = this.pose;
    const sinPhi = Math.sin(p.phi);
    this.camera.position.set(
      p.target.x + p.distance * sinPhi * Math.sin(p.theta),
      p.target.y + p.distance * Math.cos(p.phi),
      p.target.z + p.distance * sinPhi * Math.cos(p.theta),
    );
    this.camera.lookAt(p.target);
  }

  exportPose(): Pose {
    return { ...this.pose, target: this.pose.target.clone() };
  }

  importPose(pose: Pose): void {
    Object.assign(this.pose, { theta: pose.theta, phi: pose.phi, distance: pose.distance });
    this.pose.target.copy(pose.target);
    this.clamp();
    this.apply();
  }

  dispose(): void {
    this.disposers.forEach((d) => d());
    this.disposers = [];
  }
}
