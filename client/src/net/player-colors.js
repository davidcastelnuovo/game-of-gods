/**
 * Multiplayer HUD player colour from user id (legacy userColorFromId).
 */

/**
 * @param {string | null | undefined} id
 * @returns {string} CSS colour
 */
export function userColorFromId(id) {
  const h = parseInt((id || '').replace(/-/g, '').slice(0, 6) || '0', 16) % 360;
  return `hsl(${h},70%,65%)`;
}
