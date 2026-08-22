/**
 * Returns the query parameters as a key/value object. 
 * Example: If the query parameters are
 *
 *    abc=123&def=456&name=gman
 *
 * Then `getQuery()` will return an object like
 *
 *    {
 *      abc: '123',
 *      def: '456',
 *      name: 'gman',
 *    }
 * 
 * source: https://threejs.org/manual/#en/debugging-javascript 
 */

/* @__NO_SIDE_EFFECTS__ */
export function getQuery() {
  return Object.fromEntries(new URLSearchParams(window.location.search).entries());
}

/* @__NO_SIDE_EFFECTS__ */
export function isEmpty(obj: Object): boolean {
  return Object.keys(obj).length === 0;
}

import { Matrix4, Quaternion, Vector3 } from 'three';
import type { ITransform } from '../types/ITransform';

// CONST
const UP = new Vector3(0, 1, 0);
const SCALE = new Vector3(1, 1, 1);


/* @__NO_SIDE_EFFECTS__ */
export function randomTransform(): ITransform {
  const pos = new Vector3(
    (Math.random() - 0.5) * 1.5,
    1.2 + Math.random() * 0.6,
    -0.5 - Math.random() * 1.5
  );
  const quat = new Quaternion().setFromAxisAngle(UP, Math.random() * Math.PI * 2);
  return { matrixWorld: new Matrix4().compose(pos, quat, SCALE) };
}

// TODO: FIXME: replqce with 3D text
export function createOverlay(text: string): HTMLElement {
  const el = document.createElement('div');
  el.textContent = text;
  el.style.cssText = 'position:fixed;inset:0;display:none;place-items:center;font:2rem sans-serif;color:#fff;background:#000a;';
  document.body.appendChild(el);
  return el;
}