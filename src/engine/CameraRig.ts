import * as THREE from 'three';
import { anchoredTarget, clamp, direction, easeInOutCubic, easeOutQuint, flightDuration, liftFor, normalizeWheel, NOTCH, smoothDamp, smoothDampVec3, softClamp, type SpringRef } from './motion';
import { cameraStore, type CameraRequest } from '@/store/camera';

export interface Pose {
  /** spherical coordinates around the target, radians */
  theta: number;
  phi: number;
  distance: number;
  target: THREE.Vector3;
}

export interface RigLimits {
  /** closest approach to the target (or to the anchor's centre when an anchor is set) */
  minDistance: number;
  maxDistance: number;
  minPolar: number;
  maxPolar: number;
}

export interface Anchor {
  /** the body the camera is looking at; zoom aims at the point under the cursor and never enters it */
  center: THREE.Vector3;
  radius: number;
}

interface Flight {
  from: Pose;
  to: Pose;
  t: number;
  duration: number;
  start: number;
  lift: number;
  resolve: () => void;
}

const LN_BURST = Math.log(6);
const LN_SLACK = Math.log(1.08);
const CLICK_ZOOM = Math.exp(2 * NOTCH);
const tmpV = new THREE.Vector3();
const tmpW = new THREE.Vector3();
const tmpU = new THREE.Vector3();
const raycaster = new THREE.Raycaster();
const ndc = new THREE.Vector2();
const sphere = new THREE.Sphere();

/**
 * Orbit camera. Input moves a *goal* pose; critically damped springs carry
 * the real pose toward it, so a burst of wheel notches, a drag release or a
 * pinch all arrive on one smooth curve with no overshoot. Flights (fly-tos)
 * are eased on the wall clock and are interrupted by a drag or a wheel, not by
 * a click. Zoom aims at the point under the cursor when an anchor body is set.
 */
export class CameraRig {
  readonly pose: Pose;
  limits: RigLimits = { minDistance: 0.5, maxDistance: 5000, minPolar: 0.02, maxPolar: Math.PI - 0.02 };
  enabled = true;
  rotateSpeed = 1;
  zoomSpeed = 1;
  /** higher = shorter glide after a drag release */
  damping = 8;
  /** what the springs ease toward */
  readonly goal: { theta: number; phi: number; logDistance: number; target: THREE.Vector3 };
  /** smoothing time per channel, seconds */
  readonly smooth = { theta: 0.12, phi: 0.12, logDistance: 0.25, target: 0.25 };
  anchor: Anchor | null = null;
  /** human distance readout, given the distance published in telemetry */
  readout: ((distance: number) => string | null) | null = null;
  /** "Reset view" (default: fly home) */
  onReset: (() => void) | null = null;
  /** Shift+wheel or a horizontal two-finger scroll, in notches */
  onScrub: ((notches: number, e: WheelEvent) => void) | null = null;
  /** double-click / double-tap on the stage (default: fly toward the anchor surface under the pointer) */
  onDoubleTap: ((clientX: number, clientY: number) => void) | null = null;

  private readonly vel = { theta: { v: 0 } as SpringRef, phi: { v: 0 } as SpringRef, logDistance: { v: 0 } as SpringRef, target: new THREE.Vector3() };
  private flight: Flight | null = null;
  private pointers = new Map<number, { x: number; y: number }>();
  private pinchDistance = 0;
  private dragTrail: { t: number; x: number; y: number }[] = [];
  private dragging = false;
  private lastTap: { t: number; x: number; y: number } | null = null;
  private reducedMotion = false;
  private home: Pose;
  private lastInputMs = -Infinity;
  private lastZoomMs = -Infinity;
  private anchorPoint: THREE.Vector3 | null = null;
  private telemetryMs = 0;
  private disposers: (() => void)[] = [];

  constructor(readonly camera: THREE.PerspectiveCamera, readonly element: HTMLElement, initial?: Partial<Pose>) {
    this.pose = {
      theta: initial?.theta ?? 0.6,
      phi: initial?.phi ?? 1.2,
      distance: initial?.distance ?? 20,
      target: initial?.target?.clone() ?? new THREE.Vector3(),
    };
    this.goal = { theta: this.pose.theta, phi: this.pose.phi, logDistance: Math.log(this.pose.distance), target: this.pose.target.clone() };
    this.home = this.exportPose();
    this.reducedMotion = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
    this.bind();
    this.disposers.push(
      cameraStore.subscribe((s, prev) => {
        if (s.request && s.request !== prev.request) this.handleRequest(s.request);
      }),
    );
    this.apply();
  }

  /* ---------- input ---------- */

  private bind(): void {
    const el = this.element;
    el.style.touchAction = 'none';
    const isUi = (e: Event) => !!(e.target as HTMLElement | null)?.closest?.('[data-ui]');
    const down = (e: PointerEvent) => {
      if (!this.enabled || isUi(e)) return;
      this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      el.setPointerCapture(e.pointerId);
      this.dragging = false;
      this.dragTrail = [{ t: performance.now(), x: e.clientX, y: e.clientY }];
      if (this.pointers.size === 2) {
        this.pinchDistance = this.currentPinch();
        this.interrupt();
      }
    };
    const move = (e: PointerEvent) => {
      const prev = this.pointers.get(e.pointerId);
      if (!prev) return;
      const cur = { x: e.clientX, y: e.clientY };
      this.pointers.set(e.pointerId, cur);
      const now = performance.now();
      if (this.pointers.size === 1) {
        const first = this.dragTrail[0]!;
        if (!this.dragging && Math.hypot(cur.x - first.x, cur.y - first.y) > 4) {
          this.dragging = true;
          this.interrupt();
        }
        if (!this.dragging) return;
        const dx = cur.x - prev.x;
        const dy = cur.y - prev.y;
        const k = (2 * Math.PI * this.rotateSpeed) / Math.max(1, el.clientHeight);
        this.goal.theta -= dx * k;
        this.goal.phi = clamp(this.goal.phi - dy * k, this.limits.minPolar, this.limits.maxPolar);
        this.smooth.theta = this.smooth.phi = 0.12;
        this.dragTrail.push({ t: now, x: cur.x, y: cur.y });
        while (this.dragTrail.length > 2 && now - this.dragTrail[0]!.t > 80) this.dragTrail.shift();
        this.lastInputMs = now;
      } else if (this.pointers.size === 2) {
        const d = this.currentPinch();
        if (this.pinchDistance > 0 && d > 0) {
          const [a, b] = [...this.pointers.values()];
          this.zoomBy(this.pinchDistance / d, { x: (a!.x + b!.x) / 2, y: (a!.y + b!.y) / 2 });
          this.smooth.logDistance = this.smooth.target = 0.12;
        }
        this.pinchDistance = d;
      }
    };
    const up = (e: PointerEvent) => {
      const had = this.pointers.delete(e.pointerId);
      if (el.hasPointerCapture(e.pointerId)) el.releasePointerCapture(e.pointerId);
      if (!had) return;
      const now = performance.now();
      if (this.dragging && this.pointers.size === 0) {
        // glide: carry the last 80 ms of pointer velocity into the goal
        const a = this.dragTrail[0]!;
        const b = this.dragTrail[this.dragTrail.length - 1]!;
        const dtS = Math.max(1e-3, (b.t - a.t) / 1000);
        const k = (2 * Math.PI * this.rotateSpeed) / Math.max(1, el.clientHeight);
        const glide = 1.44 / this.damping;
        this.goal.theta -= clamp(((b.x - a.x) / dtS) * k * glide, -0.6, 0.6);
        this.goal.phi = clamp(this.goal.phi - clamp(((b.y - a.y) / dtS) * k * glide, -0.6, 0.6), this.limits.minPolar, this.limits.maxPolar);
        this.smooth.theta = this.smooth.phi = 0.45;
        this.lastInputMs = now;
      } else if (!this.dragging && e.pointerType === 'touch' && this.pointers.size === 0 && !isUi(e)) {
        const last = this.lastTap;
        if (last && now - last.t < 300 && Math.hypot(e.clientX - last.x, e.clientY - last.y) < 24) {
          this.lastTap = null;
          this.doubleTap(e.clientX, e.clientY);
        } else this.lastTap = { t: now, x: e.clientX, y: e.clientY };
      }
      this.dragging = false;
    };
    const dbl = (e: MouseEvent) => {
      if (!this.enabled || isUi(e)) return;
      this.doubleTap(e.clientX, e.clientY);
    };
    const wheel = (e: WheelEvent) => {
      if (!this.enabled || isUi(e)) return;
      e.preventDefault();
      const horizontal = Math.abs(e.deltaX) > Math.abs(e.deltaY);
      if (e.shiftKey || horizontal) {
        if (!this.onScrub) return;
        this.lastInputMs = performance.now();
        this.onScrub(normalizeWheel({ deltaY: e.shiftKey ? e.deltaY || e.deltaX : e.deltaX, deltaMode: e.deltaMode }, el.clientHeight), e);
        return;
      }
      const n = normalizeWheel(e, el.clientHeight);
      if (n === 0) return;
      this.interrupt();
      this.zoomBy(Math.exp(n * NOTCH * this.zoomSpeed), { x: e.clientX, y: e.clientY });
    };
    el.addEventListener('pointerdown', down);
    el.addEventListener('pointermove', move);
    el.addEventListener('pointerup', up);
    el.addEventListener('pointercancel', up);
    el.addEventListener('dblclick', dbl);
    el.addEventListener('wheel', wheel, { passive: false });
    this.disposers.push(() => {
      el.removeEventListener('pointerdown', down);
      el.removeEventListener('pointermove', move);
      el.removeEventListener('pointerup', up);
      el.removeEventListener('pointercancel', up);
      el.removeEventListener('dblclick', dbl);
      el.removeEventListener('wheel', wheel);
    });
  }

  private currentPinch(): number {
    const [a, b] = [...this.pointers.values()];
    if (!a || !b) return 0;
    return Math.hypot(a.x - b.x, a.y - b.y);
  }

  /** User took over: stop any flight and continue from the current pose. */
  private interrupt(): void {
    this.lastInputMs = performance.now();
    if (this.flight) this.cancelFlight();
  }

  private handleRequest(r: CameraRequest): void {
    if (!this.enabled) return;
    switch (r.kind) {
      case 'in':
        this.interrupt();
        this.zoomBy(1 / CLICK_ZOOM);
        break;
      case 'out':
        this.interrupt();
        this.zoomBy(CLICK_ZOOM);
        break;
      case 'reset':
        if (this.onReset) this.onReset();
        else void this.flyTo(this.home);
        break;
      case 'nudge':
        this.nudge(r.dx ?? 0, r.dy ?? 0);
        break;
    }
  }

  private doubleTap(x: number, y: number): void {
    if (this.onDoubleTap) this.onDoubleTap(x, y);
    else this.flyToSurface(x, y);
  }

  /* ---------- commands ---------- */

  /**
   * Multiply the goal distance by `factor`. With `at` (client px) and an
   * anchor, the zoom keeps the point under the cursor fixed on screen.
   */
  zoomBy(factor: number, at?: { x: number; y: number }): void {
    if (!(factor > 0) || !Number.isFinite(factor)) return;
    const now = performance.now();
    this.lastInputMs = this.lastZoomMs = now;
    const cur = Math.log(this.pose.distance);
    this.goal.logDistance = clamp(this.goal.logDistance + Math.log(factor), cur - LN_BURST, cur + LN_BURST);
    this.smooth.logDistance = this.smooth.target = 0.25;
    if (at && this.anchor) this.anchorZoom(factor, at);
    else this.anchorPoint = null;
  }

  /** Point on the anchor sphere under a client position (nearest limb point on a miss), or null without an anchor. */
  hitAnchor(clientX: number, clientY: number, out = new THREE.Vector3()): THREE.Vector3 | null {
    if (!this.anchor) return null;
    const rect = this.element.getBoundingClientRect();
    ndc.set(((clientX - rect.left) / Math.max(1, rect.width)) * 2 - 1, -(((clientY - rect.top) / Math.max(1, rect.height)) * 2 - 1));
    raycaster.setFromCamera(ndc, this.camera);
    sphere.set(this.anchor.center, this.anchor.radius);
    if (raycaster.ray.intersectSphere(sphere, out)) return out;
    raycaster.ray.closestPointToPoint(this.anchor.center, tmpV);
    return out.subVectors(tmpV, this.anchor.center).setLength(this.anchor.radius).add(this.anchor.center);
  }

  private anchorZoom(factor: number, at: { x: number; y: number }): void {
    const { center, radius } = this.anchor!;
    if (this.camera.position.distanceTo(center) > 6 * radius) {
      this.anchorPoint = null;
      return;
    }
    const p = this.hitAnchor(at.x, at.y, this.anchorPoint ?? new THREE.Vector3())!;
    this.anchorPoint = p;
    if (factor < 1) {
      anchoredTarget(this.goal.target, p, factor, this.goal.target);
      tmpW.subVectors(this.goal.target, center);
      if (tmpW.length() > radius) this.goal.target.copy(tmpW.setLength(radius).add(center));
    } else {
      // pulling back: let the target drift home once the whole body is in view
      const s = clamp((Math.exp(this.goal.logDistance) / radius - 3) / 3, 0, 1);
      this.goal.target.lerp(center, s);
    }
  }

  /** Ease to a pose without a flight (a follow target, a scale morph). */
  setGoal(p: Partial<Pose>, smoothTime = 0.6): void {
    if (this.flight) this.cancelFlight();
    if (p.theta !== undefined) {
      this.goal.theta = this.pose.theta + this.shortest(p.theta - this.pose.theta);
      this.smooth.theta = smoothTime;
    }
    if (p.phi !== undefined) {
      this.goal.phi = p.phi;
      this.smooth.phi = smoothTime;
    }
    if (p.distance !== undefined) {
      this.goal.logDistance = Math.log(p.distance);
      this.smooth.logDistance = smoothTime;
    }
    if (p.target) {
      this.goal.target.copy(p.target);
      this.smooth.target = smoothTime;
    }
  }

  /** Remember the pose "Reset view" returns to (defaults to the current pose). */
  setHome(p?: Partial<Pose>): void {
    this.home = {
      theta: p?.theta ?? this.pose.theta,
      phi: p?.phi ?? this.pose.phi,
      distance: p?.distance ?? this.pose.distance,
      target: p?.target?.clone() ?? this.pose.target.clone(),
    };
  }

  /** Keyboard orbit. */
  nudge(dTheta: number, dPhi: number): void {
    this.interrupt();
    this.goal.theta += dTheta;
    this.goal.phi = clamp(this.goal.phi + dPhi, this.limits.minPolar, this.limits.maxPolar);
    this.smooth.theta = this.smooth.phi = 0.3;
  }

  /** Fly to the anchor's surface under a client position: half the distance, centred on that spot. */
  flyToSurface(clientX: number, clientY: number): void {
    const p = this.hitAnchor(clientX, clientY, tmpV);
    if (!p || !this.anchor) return;
    tmpU.subVectors(p, this.anchor.center).normalize();
    const theta = Math.atan2(tmpU.x, tmpU.z);
    const phi = Math.acos(clamp(tmpU.y, -1, 1));
    const d = this.camera.position.distanceTo(this.anchor.center);
    void this.flyTo({ theta, phi, distance: Math.max(this.limits.minDistance * 1.3, d * 0.5), target: this.anchor.center.clone() });
  }

  /** Move the frame of reference without moving the camera (a scene re-centre). */
  shiftTarget(delta: THREE.Vector3): void {
    this.pose.target.add(delta);
    this.goal.target.add(delta);
    if (this.flight) {
      this.flight.from.target.add(delta);
      this.flight.to.target.add(delta);
    }
  }

  private shortest(dTheta: number): number {
    return ((dTheta + Math.PI) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI) - Math.PI;
  }

  flyTo(target: Partial<Pose>, durationSeconds?: number): Promise<void> {
    this.cancelFlight();
    const from: Pose = this.exportPose();
    const to: Pose = {
      theta: target.theta ?? from.theta,
      phi: clamp(target.phi ?? from.phi, this.limits.minPolar, this.limits.maxPolar),
      distance: target.distance ?? from.distance,
      target: target.target?.clone() ?? from.target.clone(),
    };
    to.theta = from.theta + this.shortest(to.theta - from.theta);
    return new Promise((resolve) => {
      this.flight = {
        from,
        to,
        t: 0,
        start: performance.now(),
        duration: this.reducedMotion ? 0.15 : (durationSeconds ?? flightDuration(from, to)),
        lift: liftFor(from, to, this.reducedMotion),
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
    this.syncGoal();
  }

  private syncGoal(): void {
    this.goal.theta = this.pose.theta;
    this.goal.phi = this.pose.phi;
    this.goal.logDistance = Math.log(this.pose.distance);
    this.goal.target.copy(this.pose.target);
    this.vel.theta.v = this.vel.phi.v = this.vel.logDistance.v = 0;
    this.vel.target.set(0, 0, 0);
  }

  get flying(): boolean {
    return this.flight !== null;
  }

  /* ---------- per frame ---------- */

  /** Smallest distance from the target that keeps the camera outside the anchor (or minDistance without one). */
  private minDistanceAlong(target: THREE.Vector3, theta: number, phi: number): number {
    if (!this.anchor) return this.limits.minDistance;
    const m = Math.max(this.limits.minDistance, 1.02 * this.anchor.radius);
    tmpW.subVectors(target, this.anchor.center);
    const w2 = tmpW.lengthSq();
    if (w2 >= m * m) return 1e-3;
    direction(theta, phi, tmpU);
    const wu = tmpW.dot(tmpU);
    return Math.max(1e-3, -wu + Math.sqrt(Math.max(0, wu * wu - w2 + m * m)));
  }

  update(dt: number): void {
    dt = Math.min(dt, 0.1);
    const p = this.pose;
    const now = performance.now();
    if (this.flight) {
      const f = this.flight;
      f.t = Math.min(1, (now - f.start) / (f.duration * 1000));
      const k = easeInOutCubic(f.t);
      const kd = easeOutQuint(f.t);
      p.theta = f.from.theta + (f.to.theta - f.from.theta) * k;
      p.phi = f.from.phi + (f.to.phi - f.from.phi) * k;
      const lnFrom = Math.log(f.from.distance);
      const lnTo = Math.log(f.to.distance);
      p.distance = Math.exp(lnFrom + (lnTo - lnFrom) * kd + f.lift * Math.sin(Math.PI * f.t));
      p.target.lerpVectors(f.from.target, f.to.target, k);
      if (f.t >= 1) {
        this.flight = null;
        this.syncGoal();
        f.resolve();
      }
    } else {
      const g = this.goal;
      const live = now - this.lastInputMs < 120;
      const lo = Math.log(this.minDistanceAlong(g.target, g.theta, g.phi));
      const hi = Math.log(this.limits.maxDistance);
      g.logDistance = live ? softClamp(g.logDistance, lo, hi, LN_SLACK) : clamp(g.logDistance, lo, hi);
      g.phi = clamp(g.phi, this.limits.minPolar, this.limits.maxPolar);
      const s = this.reducedMotion ? 0.03 : 1;
      p.theta = smoothDamp(p.theta, g.theta, this.vel.theta, this.smooth.theta * s, dt);
      p.phi = smoothDamp(p.phi, g.phi, this.vel.phi, this.smooth.phi * s, dt);
      p.distance = Math.exp(smoothDamp(Math.log(p.distance), g.logDistance, this.vel.logDistance, this.smooth.logDistance * s, dt));
      smoothDampVec3(p.target, g.target, this.vel.target, this.smooth.target * s, dt);
    }
    // never inside the anchor, never past the limits
    p.phi = clamp(p.phi, this.limits.minPolar, this.limits.maxPolar);
    p.distance = clamp(p.distance, this.minDistanceAlong(p.target, p.theta, p.phi), this.limits.maxDistance * 1.08);
    this.apply();
    if (now - this.telemetryMs > 100) {
      this.telemetryMs = now;
      this.publish(now);
    }
  }

  private apply(): void {
    const p = this.pose;
    direction(p.theta, p.phi, tmpU);
    this.camera.position.copy(tmpU).multiplyScalar(p.distance).add(p.target);
    this.camera.lookAt(p.target);
  }

  private publish(now: number): void {
    const a = this.anchor;
    const distance = a ? this.camera.position.distanceTo(a.center) : this.pose.distance;
    const min = a ? Math.max(this.limits.minDistance, 1.02 * a.radius) : this.limits.minDistance;
    const max = this.limits.maxDistance;
    const ds = this.element.dataset;
    ds.cameraDistance = distance.toPrecision(6);
    ds.cameraMin = min.toPrecision(6);
    ds.cameraMax = max.toPrecision(6);
    if (this.anchorPoint && now - this.lastZoomMs < 6000) {
      const rect = this.element.getBoundingClientRect();
      tmpV.copy(this.anchorPoint).project(this.camera);
      ds.anchorPx = `${((tmpV.x * 0.5 + 0.5) * rect.width).toFixed(1)},${((-tmpV.y * 0.5 + 0.5) * rect.height).toFixed(1)}`;
    } else if (ds.anchorPx) delete ds.anchorPx;
    const readout = this.readout ? this.readout(distance) : null;
    const st = cameraStore.getState();
    if (Math.abs(st.distance - distance) > distance * 1e-3 || st.min !== min || st.max !== max || st.readout !== readout) {
      st.publish({ distance, min, max, readout });
    }
  }

  /* ---------- poses ---------- */

  exportPose(): Pose {
    return { ...this.pose, target: this.pose.target.clone() };
  }

  /** The camera's spherical pose about a point other than its target (for handoffs after an anchored zoom). */
  poseAbout(center: THREE.Vector3): { theta: number; phi: number; distance: number } {
    tmpU.subVectors(this.camera.position, center);
    const distance = tmpU.length();
    if (distance < 1e-9) return { theta: this.pose.theta, phi: this.pose.phi, distance: this.pose.distance };
    tmpU.divideScalar(distance);
    return { theta: Math.atan2(tmpU.x, tmpU.z), phi: Math.acos(clamp(tmpU.y, -1, 1)), distance };
  }

  /** Jump to a pose and make it home. */
  importPose(pose: Pose): void {
    if (this.flight) this.cancelFlight();
    Object.assign(this.pose, { theta: pose.theta, phi: pose.phi, distance: pose.distance });
    this.pose.target.copy(pose.target);
    this.pose.phi = clamp(this.pose.phi, this.limits.minPolar, this.limits.maxPolar);
    this.pose.distance = clamp(this.pose.distance, this.limits.minDistance, this.limits.maxDistance);
    this.syncGoal();
    this.setHome();
    this.apply();
  }

  dispose(): void {
    if (this.flight) this.cancelFlight();
    this.disposers.forEach((d) => d());
    this.disposers = [];
    const ds = this.element.dataset;
    delete ds.cameraDistance;
    delete ds.cameraMin;
    delete ds.cameraMax;
    delete ds.anchorPx;
  }
}
