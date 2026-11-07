/**
 * WebGL renderer setup — first slice from minecraft-chaluton.html RENDERER section.
 * Legacy HTML still owns the live renderer until modules are wired in main game entry.
 */

import * as THREE from 'three';

export const RENDERER_OPTIONS = {
  antialias: true,
  powerPreference: 'high-performance',
};

export const MAX_DEVICE_PIXEL_RATIO = 2;

/**
 * Create and configure the WebGL renderer (same defaults as legacy).
 * @param {number} width
 * @param {number} height
 * @returns {THREE.WebGLRenderer}
 */
export function createRenderer(width = innerWidth, height = innerHeight) {
  const renderer = new THREE.WebGLRenderer(RENDERER_OPTIONS);
  renderer.setSize(width, height);
  renderer.setPixelRatio(Math.min(devicePixelRatio, MAX_DEVICE_PIXEL_RATIO));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.outputEncoding = THREE.sRGBEncoding;
  return renderer;
}

/**
 * @param {THREE.WebGLRenderer} renderer
 * @param {THREE.PerspectiveCamera} camera
 */
export function bindRendererResize(renderer, camera) {
  const onResize = () => {
    camera.aspect = innerWidth / innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(innerWidth, innerHeight);
  };
  window.addEventListener('resize', onResize);
  return () => window.removeEventListener('resize', onResize);
}

/**
 * @param {THREE.WebGLRenderer} renderer
 * @param {HTMLElement} [parent=document.body]
 */
export function mountRenderer(renderer, parent = document.body) {
  parent.appendChild(renderer.domElement);
}
