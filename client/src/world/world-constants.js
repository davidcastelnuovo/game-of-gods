/**
 * World sizing and block-type sets from minecraft-chaluton.html.
 * Rendering / InstancedMesh logic remains in the legacy monolith.
 */

/** Default footprint (SZ) before user expands the world. */
export const WORLD_DEFAULT_SIZE = 26;

/** Per block-type InstancedMesh initial capacity. */
export const INSTANCED_MESH_INITIAL_CAPACITY = 2048;

/** Block ids that use interactWorld (doors / windows), not instanced cubes. */
export const INTERACTIVE_BLOCK_TYPES = Object.freeze(
  new Set(['door_wood', 'door_iron', 'window_glass']),
);

/** Blocks stored in animBlocks (water / lava surface animation). */
export const ANIMATED_LIQUID_BLOCK_TYPES = Object.freeze(new Set(['water', 'lava']));

/**
 * @param {string | null | undefined} id
 */
export function isInteractiveBlockType(id) {
  return id != null && INTERACTIVE_BLOCK_TYPES.has(id);
}

/**
 * @param {string | null | undefined} id
 */
export function isAnimatedLiquidBlock(id) {
  return id != null && ANIMATED_LIQUID_BLOCK_TYPES.has(id);
}
