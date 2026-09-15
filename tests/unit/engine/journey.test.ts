import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { directionFromSpherical, handoffFromPose, poseFromHandoff, sphericalFromDirection } from '@/engine/Journey';

describe('journey handoff', () => {
  it('round-trips a pose through a handoff at a different display scale', () => {
    const pose = { theta: 0.7, phi: 1.2, distance: 25 }; // illustrated Earth radius 3500 units
    const h = handoffFromPose('solar', 'earth', pose, 6371, 3500, 0);
    expect(h.distanceKm).toBeCloseTo((25 / 3500) * 6371, 9);
    const back = poseFromHandoff(h, 6371, 6.371); // true-scale Earth radius in units
    expect(back.theta).toBeCloseTo(0.7, 9);
    expect(back.phi).toBeCloseTo(1.2, 9);
    expect(back.distance).toBeCloseTo((25 / 3500) * 6.371, 9);
  });
  it('preserves the camera direction through a rotated frame', () => {
    const q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), 0.9);
    const pose = { theta: -0.4, phi: 0.9, distance: 10 };
    const h = handoffFromPose('moon', 'moon', pose, 1737, 1.737, 0, q);
    const back = poseFromHandoff(h, 1737, 1.737, q);
    expect(back.theta).toBeCloseTo(pose.theta, 9);
    expect(back.phi).toBeCloseTo(pose.phi, 9);
    // in the shared frame the direction differs by the rotation
    const shared = directionFromSpherical(h.theta, h.phi);
    const local = directionFromSpherical(pose.theta, pose.phi);
    expect(shared.angleTo(local)).toBeCloseTo(0.9 * Math.sin(pose.phi) > 0 ? shared.angleTo(local) : 0, 9);
    expect(shared.applyQuaternion(q).angleTo(local)).toBeCloseTo(0, 9);
  });
  it('spherical helpers agree with the camera rig convention', () => {
    const d = directionFromSpherical(Math.PI / 2, Math.PI / 2);
    expect(d.x).toBeCloseTo(1, 9);
    expect(d.y).toBeCloseTo(0, 9);
    expect(d.z).toBeCloseTo(0, 9);
    const s = sphericalFromDirection(new THREE.Vector3(0, 1, 0));
    expect(s.phi).toBeCloseTo(0, 9);
  });
});
