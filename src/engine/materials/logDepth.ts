import type * as THREE from 'three';

/**
 * The renderer uses a logarithmic depth buffer. three's built-in materials
 * write log depth from the fragment shader; a custom ShaderMaterial must
 * include the same chunks or its depth will not compare correctly against
 * MeshStandardMaterial surfaces (points and lines vanish behind globes).
 */
export function applyLogDepth<T extends THREE.ShaderMaterial>(m: T): T {
  if (!m.vertexShader.includes('logdepthbuf_pars_vertex')) {
    m.vertexShader = `#include <common>\n#include <logdepthbuf_pars_vertex>\n${m.vertexShader.replace(/(gl_Position\s*=[^;]*;)/, '$1\n#include <logdepthbuf_vertex>')}`;
    m.fragmentShader = `#include <common>\n#include <logdepthbuf_pars_fragment>\n${m.fragmentShader.replace(/void main\(\)\s*\{/, 'void main() {\n#include <logdepthbuf_fragment>')}`;
    m.needsUpdate = true;
  }
  return m;
}
