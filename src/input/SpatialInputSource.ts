import { InputSource } from "./InputSource";
import type { Object3D } from "three";

// TODO: FIXME: WIP

// works for both getController(n) and getHand(n) slots
// Three.js routes controller events to getController and hand events to getHand
// 'connected'   fires when a physical device occupies this slot
// 'disconnected' fires on loss (battery, tracking lost, inputsourceslost)
// export class SpatialInputSource extends InputSource {
//   xrcontroller: Object3D;
//   handedness: string;        // 'left' | 'right'
//   bindings: Object = {};   // event -> handler (kept for dispose)

//   constructor(xrcontroller: Object3D, handedness: string) {
//     super();
//     this.xrcontroller = xrcontroller;
//     this.handedness = handedness;
//     this.enabled = false;   // disabled until device physically connects
//     xrcontroller.addEventListener('connected', this._onConnected);
//     xrcontroller.addEventListener('disconnected', this._onDisconnected);
//   }

//   bind(event: string, command: Command) {
//     const handler = () => { if (this.enabled) this.queue.push(command); };
//     this.bindings[event] = handler;
//     this.xrcontroller.addEventListener(event, handler);
//   }

//   _onConnected = (e: any) => {
//     this.enabled = e.data.handedness === this.handedness;
//   };

//   _onDisconnected = () => {
//     this.enabled = false;
//     this.queue.length = 0;    // drop commands queued before loss
//   };

//   dispose() {
//     this.xrcontroller.removeEventListener('connected', this._onConnected);
//     this.xrcontroller.removeEventListener('disconnected', this._onDisconnected);
//     for (const [event, handler] of Object.entries(this.bindings))
//       this.xrcontroller.removeEventListener(event, handler);
//   }
// }