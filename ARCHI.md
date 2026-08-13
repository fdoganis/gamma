// 2026-07-08 : Architecture status

**On EntityManager — the correct responsibility**

You are right. EntityManager should hold ALL objects — the complete pool, active and inactive. `active` is just a component like any other. The pool IS the EntityManager. TargetManager is purely the Three.js bridge on top of it.

```
EntityManager:  ALL entities (active + inactive), IDs, components
TargetManager:  owns EntityManager, bridges to scene, owns geometry + raycaster
```

`spawn` finds an inactive entity and flips it active. `zap` flips it inactive. Nothing is ever truly created or destroyed after initialisation — only state changes.

---

**Session summary for handoff**

---

# Architecture Summary — XR Cone Game

## Patterns used (all from Game Programming Patterns)

| Pattern | GPP ch. | Used for |
|---|---|---|
| Game Loop | 9 | `GameLoop` — processInput → update → render |
| Command | 2 | All input actions, pre-allocated singletons |
| State | 7 | `StateMachine` + `State` subclasses |
| Component | 14 | `EntityManager` component stores |
| Object Pool | 19 | `EntityManager` holds all entities active+inactive |
| Service Locator | 16 | Rejected — direct injection instead |
| Observer | 4 | UI only — not audio (GPP ch.13: audio stays cohesive in commands) |

---

## Dependency rules

```
GameLoop → Game (type-only import, no runtime cycle)
State    → no imports (abstract base)
Commands → their specific manager targets only
Managers → Three.js only
Game     → everything (single wiring point, nothing imports Game)
```

---

## File list and final code

```
core/
  GameLoop.js
  Command.js
  State.js
  StateMachine.js
  EntityManager.js

input/
  InputSource.js
  InputProcessor.js
  KeyboardInputSource.js
  PointerInputSource.js
  GamepadInputSource.js
  SpatialInputSource.js
  HandSource.js
  InputManager.js

audio/
  AudioManager.js

managers/
  RenderManager.js
  TargetManager.js

commands/
  ChangeStateCommand.js
  ToggleAudioCommand.js
  ShootTargetCommand.js
  SpawnAtOrientationCommand.js

states/
  GameIntroState.js
  GameRunningState.js
  GameOverState.js

Game.js
main.js
```

---

```js
// core/GameLoop.js
// import type Game — erased at runtime, no cycle
class GameLoop {
  _host  : Game
  _timer : Timer

  constructor(host : Game) {
    this._host  = host
    this._timer = new Timer()
    this._timer.connect(document)
  }

  tick = () => {
    this._timer.update()
    this._host.processInput()
    this._host.update(this._timer.getDelta())
    this._host.render()
  }
}
```

```js
// core/Command.js
class Command {
  execute() {}
}
```

```js
// core/State.js
// abstract — prevents direct instantiation, empty defaults so subclasses
// only override what they need
abstract class State {
  enter()                {}
  update(delta : number) {}
  exit()                 {}
}
```

```js
// core/StateMachine.js
// Keys are class constructors — unique by object identity, refactor-safe,
// survives minification unlike string names
// register() guards against inheritance collisions at startup
class StateMachine {
  _states      : Map    = new Map()   // StateClass → State instance
  _currentClass         = null
  _current     : State  = null

  register(StateClass : Function, state : State) {
    for (const key of this._states.keys())
      if (StateClass.prototype instanceof key || key.prototype instanceof StateClass)
        throw new Error(`${StateClass.name} shares inheritance with ${key.name}`)
    this._states.set(StateClass, state)
    return this
  }

  start(StateClass : Function) {
    this._currentClass = StateClass
    this._current      = this._states.get(StateClass)
    this._current.enter()
  }

  change(StateClass : Function) {
    if (this._currentClass === StateClass) return
    this._current?.exit()
    this._currentClass = StateClass
    this._current      = this._states.get(StateClass)
    this._current.enter()
  }

  get currentClass() { return this._currentClass }

  update(delta : number) { this._current?.update(delta) }
}
```

```js
// core/EntityManager.js
// Holds ALL entities — active and inactive (pool pattern).
// active is a plain component like any other.
// find() avoids array allocation — iterates store directly.
// TargetManager is the only consumer: it owns one EntityManager instance.
class EntityManager {
  _nextId : number = 0
  _store  : Map    = new Map()   // id → { id, ...components }

  create(components : Object = {}) : number {
    const id = this._nextId++
    this._store.set(id, { id, ...components })
    return id
  }

  get(id : number)           { return this._store.get(id) }
  destroy(id : number)       { this._store.delete(id) }
  clear()                    { this._store.clear() }

  // predicate-based find: no array allocation, short-circuits on first match
  find(predicate : Function) {
    for (const entity of this._store.values())
      if (predicate(entity)) return entity
    return null
  }

  // forEach: no array allocation, iterates all entities
  forEach(callback : Function) {
    for (const entity of this._store.values()) callback(entity)
  }

  // collect: allocates only when caller needs an array (raycasting, proximate)
  filter(predicate : Function) {
    const result = []
    for (const entity of this._store.values())
      if (predicate(entity)) result.push(entity)
    return result
  }
}
```

```js
// input/InputSource.js
// Base for all input sources — emits Command[] directly, no action strings
class InputSource {
  queue   : Command[] = []
  enabled : boolean   = true
  poll()    {}
  dispose() {}
}
```

```js
// input/InputProcessor.js
// Was InputManager. Typed to InputSource only — never needs concrete types.
// Collects commands from all registered sources once per frame.
class InputProcessor {
  _sources : InputSource[] = []
  commands : Command[]     = []

  add(source : InputSource) { this._sources.push(source) }

  collect() {
    this.commands.length = 0
    for (const source of this._sources) {
      source.poll()
      for (const cmd of source.queue) this.commands.push(cmd)
      source.queue.length = 0
    }
  }

  dispose() { for (const source of this._sources) source.dispose() }
}
```

```js
// input/KeyboardInputSource.js
class KeyboardInputSource extends InputSource {
  _bindings : Object = {}

  constructor() {
    super()
    window.addEventListener('keydown', this._onKeyDown)
  }

  bind(code : string, command : Command) { this._bindings[code] = command }

  _onKeyDown = (e : any) => {
    if (!this.enabled || e.repeat) return
    const cmd = this._bindings[e.code]
    if (cmd) this.queue.push(cmd)
  }

  dispose() { window.removeEventListener('keydown', this._onKeyDown) }
}
```

```js
// input/PointerInputSource.js
// ndc is a shared mutable object owned here.
// Bound command holds a reference to it — reads ndc at execute() time.
// collect() and execute() are synchronous in the same frame: always current.
// Zero allocation per click.
class PointerInputSource extends InputSource {
  _domElement : HTMLElement
  _command    : Command = null
  ndc         : Object  = { x: 0, y: 0 }

  constructor(domElement : HTMLElement) {
    super()
    this._domElement = domElement
    domElement.addEventListener('pointerdown', this._onPointerDown)
  }

  bind(command : Command) { this._command = command }

  _onPointerDown = (e : any) => {
    if (!this.enabled || !this._command) return
    this.ndc.x =  (e.clientX / window.innerWidth)  * 2 - 1
    this.ndc.y = -(e.clientY / window.innerHeight) * 2 + 1
    this.queue.push(this._command)
  }

  dispose() { this._domElement.removeEventListener('pointerdown', this._onPointerDown) }
}
```

```js
// input/GamepadInputSource.js
// Must be polled — browser fires no press events.
// Covers desktop gamepads and XR hardware buttons (index 0=left, 1=right).
class GamepadInputSource extends InputSource {
  _connected : Map   = new Map()
  _bindings  : Array = []

  constructor() {
    super()
    window.addEventListener('gamepadconnected',    this._onConnected)
    window.addEventListener('gamepaddisconnected', this._onDisconnected)
  }

  bind(buttonIndex : number, command : Command, gamepadIndex = 'any') {
    this._bindings.push({ gamepadIndex, buttonIndex, command })
  }

  _onConnected    = (e : any) => { this._connected.set(e.gamepad.index, []) }
  _onDisconnected = (e : any) => { this._connected.delete(e.gamepad.index) }

  poll() {
    if (!this.enabled) return
    for (const gp of navigator.getGamepads()) {
      if (!gp || !this._connected.has(gp.index)) continue
      const prev = this._connected.get(gp.index)
      for (const { gamepadIndex, buttonIndex, command } of this._bindings) {
        if (gamepadIndex !== 'any' && gamepadIndex !== gp.index) continue
        const pressed = gp.buttons[buttonIndex]?.pressed || false
        if (pressed && !prev[buttonIndex]) this.queue.push(command)
        prev[buttonIndex] = pressed
      }
    }
  }

  dispose() {
    window.removeEventListener('gamepadconnected',    this._onConnected)
    window.removeEventListener('gamepaddisconnected', this._onDisconnected)
  }
}
```

```js
// input/SpatialInputSource.js
// Wraps renderer.xr.getController(n).
// Self-enables only when a physical device with matching handedness connects.
// _handlers: one map serves both dispatch (closures) and disposal.
class SpatialInputSource extends InputSource {
  _node       : Object3D
  _handedness : string
  _handlers   : Object = {}

  constructor(node : Object3D, handedness : string) {
    super()
    this._node       = node
    this._handedness = handedness
    this.enabled     = false
    node.addEventListener('connected',    this._onConnected)
    node.addEventListener('disconnected', this._onDisconnected)
  }

  get position() { return this._node.position }
  get node()     { return this._node }

  bind(event : string, command : Command) {
    const handler = () => { if (this.enabled) this.queue.push(command) }
    this._handlers[event] = handler
    this._node.addEventListener(event, handler)
  }

  _onConnected    = (e : any) => { this.enabled = e.data.handedness === this._handedness }
  _onDisconnected = ()        => { this.enabled = false; this.queue.length = 0 }

  dispose() {
    this._node.removeEventListener('connected',    this._onConnected)
    this._node.removeEventListener('disconnected', this._onDisconnected)
    for (const [event, handler] of Object.entries(this._handlers))
      this._node.removeEventListener(event, handler)
  }
}
```

```js
// input/HandSource.js
// Wraps renderer.xr.getHand(n).
// Overrides position with index finger tip for accurate proximity detection.
class HandSource extends SpatialInputSource {
  get position() {
    return this._node.joints?.['index-finger-tip']?.position ?? this._node.position
  }
}
```

```js
// input/InputManager.js
// Was InputSystem. Creates and owns all typed sources — retains typed references
// for binding in Game._bindInput(). Registers them with InputProcessor as
// InputSource base type — no cast needed. Creation separated from registration.
class InputManager {
  keyboard     : KeyboardInputSource
  pointer      : PointerInputSource
  gamepad      : GamepadInputSource
  xrLeft       : SpatialInputSource
  xrRight      : SpatialInputSource
  handLeft     : HandSource
  handRight    : HandSource
  interactors  : Array      // [SpatialInputSource|HandSource] — .enabled + .position
  _processor   : InputProcessor

  constructor(renderer : WebGLRenderer, scene : Scene) {
    this._processor = new InputProcessor()

    this.keyboard = new KeyboardInputSource()
    this.pointer  = new PointerInputSource(renderer.domElement)
    this.gamepad  = new GamepadInputSource()

    const ctrlL = renderer.xr.getController(0)
    const ctrlR = renderer.xr.getController(1)
    const handL = renderer.xr.getHand(0)
    const handR = renderer.xr.getHand(1)
    scene.add(ctrlL); scene.add(ctrlR); scene.add(handL); scene.add(handR)

    this.xrLeft    = new SpatialInputSource(ctrlL, 'left')
    this.xrRight   = new SpatialInputSource(ctrlR, 'right')
    this.handLeft  = new HandSource(handL, 'left')
    this.handRight = new HandSource(handR, 'right')

    this._processor.add(this.keyboard)
    this._processor.add(this.pointer)
    this._processor.add(this.gamepad)
    this._processor.add(this.xrLeft)
    this._processor.add(this.xrRight)
    this._processor.add(this.handLeft)
    this._processor.add(this.handRight)

    this.interactors = [this.xrLeft, this.xrRight, this.handLeft, this.handRight]
  }

  get commands() { return this._processor.commands }
  collect()      { this._processor.collect() }

  onSessionStart() { this.keyboard.enabled = false; this.pointer.enabled = false }
  onSessionEnd()   { this.keyboard.enabled = true;  this.pointer.enabled = true  }

  dispose() { this._processor.dispose() }
}
```

```js
// audio/AudioManager.js
class AudioManager {
  _camera   : PerspectiveCamera
  _listener : AudioListener
  _clips    : Object  = {}
  _muted    : boolean = false

  constructor(camera : PerspectiveCamera) {
    this._camera   = camera
    this._listener = new AudioListener()
    camera.add(this._listener)
  }

  load(id : string, url : string, loop : boolean = false, volume : number = 1) {
    const sound = new Audio(this._listener)
    new AudioLoader().load(url, buffer => {
      sound.setBuffer(buffer); sound.setLoop(loop); sound.setVolume(volume)
    })
    this._clips[id] = sound
  }

  play(id : string) { const s = this._clips[id]; if (!this._muted && s && !s.isPlaying) s.play() }
  stop(id : string) { const s = this._clips[id]; if (s?.isPlaying) s.stop() }
  toggle()          { this._muted ? this.activate() : this.deactivate() }

  activate() {
    this._muted = false
    if (this._listener.context.state === 'suspended') this._listener.context.resume()
  }

  deactivate() {
    this._muted = true
    for (const id in this._clips) this.stop(id)
  }

  dispose() { this.deactivate(); this._camera.remove(this._listener) }
}
```

```js
// managers/RenderManager.js
class RenderManager {
  scene    : Scene
  camera   : PerspectiveCamera
  renderer : WebGLRenderer
  controls : OrbitControls

  constructor() {
    this.renderer = new WebGLRenderer({ antialias: true, alpha: true })
    this.renderer.setPixelRatio(window.devicePixelRatio)
    this.renderer.setSize(window.innerWidth, window.innerHeight)
    this.renderer.xr.enabled = true
    document.body.appendChild(this.renderer.domElement)

    const btn = XRButton.createButton(this.renderer, {})
    btn.style.backgroundColor = 'skyblue'
    document.body.appendChild(btn)

    this.scene  = new Scene()
    this.camera = new PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 10)
    this.camera.position.set(0, 1.6, 3)

    const hemi = new HemisphereLight(0xffffff, 0xbbbbff, 3)
    hemi.position.set(0.5, 1, 0.25)
    this.scene.add(new AmbientLight(0xffffff, 1.0))
    this.scene.add(hemi)

    this.controls = new OrbitControls(this.camera, this.renderer.domElement)
    this.controls.target.set(0, 1.6, 0)
    this.controls.update()

    window.addEventListener('resize', this._onResize)
  }

  render() { this.renderer.render(this.scene, this.camera) }

  _onResize = () => {
    this.camera.aspect = window.innerWidth / window.innerHeight
    this.camera.updateProjectionMatrix()
    this.renderer.setSize(window.innerWidth, window.innerHeight)
  }

  dispose() {
    window.removeEventListener('resize', this._onResize)
    this.controls.dispose()
    this.renderer.dispose()
  }
}
```

```js
// managers/TargetManager.js
// EntityManager holds ALL entities (active + inactive = the pool).
// TargetManager bridges entity lifecycle to Three.js.
// Shared geometry: one TypedArray for all cones regardless of count.
// Individual materials: each cone needs its own colour, disposed on zap.
// find() and forEach() avoid array allocation in hot paths.
class TargetManager {
  _em        : EntityManager = new EntityManager()
  _scene     : Scene
  _geo       : BufferGeometry
  _raycaster : Raycaster
  _camera    : PerspectiveCamera

  constructor(scene : Scene, camera : PerspectiveCamera, poolSize : number = 16) {
    this._scene     = scene
    this._geo       = new CylinderGeometry(0, 0.05, 0.2, 32).rotateX(Math.PI / 2)
    this._raycaster = new Raycaster()
    this._camera    = camera

    // pre-allocate full pool — all inactive
    for (let i = 0; i < poolSize; i++)
      this._em.create({ mesh: new Mesh(this._geo, new MeshPhongMaterial()), active: false })
  }

  // random position — called by GameRunningState spawn timer
  spawn(position : Vector3) { this._activate(position, new Quaternion()) }

  // oriented spawn — called by SpawnAtOrientationCommand (XR/camera)
  spawnAt(position : Vector3, quaternion : Quaternion) { this._activate(position, quaternion) }

  _activate(position : Vector3, quaternion : Quaternion) {
    const entity = this._em.find(e => !e.active)
    if (!entity) return
    entity.active = true
    entity.mesh.position.copy(position)
    entity.mesh.quaternion.copy(quaternion)
    entity.mesh.material.color.setHex(Math.random() * 0xffffff)
    this._scene.add(entity.mesh)
  }

  zap(mesh : Mesh) {
    const entity = this._em.find(e => e.mesh === mesh)
    if (!entity?.active) return
    entity.active = false
    this._scene.remove(mesh)
  }

  clear() {
    this._em.forEach(entity => {
      if (!entity.active) return
      entity.active = false
      this._scene.remove(entity.mesh)
    })
  }

  raycast(ndc : Object) : Mesh | null {
    const meshes = this._em.filter(e => e.active).map(e => e.mesh)
    this._raycaster.setFromCamera(ndc, this._camera)
    return this._raycaster.intersectObjects(meshes)[0]?.object ?? null
  }

  proximate(positions : Vector3[], radius : number) : Mesh[] {
    const active = this._em.filter(e => e.active)
    const result = []
    for (const pos of positions)
      for (const { mesh } of active)
        if (pos.distanceTo(mesh.position) < radius && !result.includes(mesh))
          result.push(mesh)
    return result
  }

  dispose() {
    this.clear()
    this._geo.dispose()
    this._em.forEach(e => e.mesh.material.dispose())
    this._em.clear()
  }
}
```

```js
// commands/ChangeStateCommand.js
// _from guard: silently ignored if fired from wrong state (e.g. double-press)
class ChangeStateCommand extends Command {
  _sm   : StateMachine
  _from : Function
  _to   : Function

  constructor(sm : StateMachine, from : Function, to : Function) {
    super(); this._sm = sm; this._from = from; this._to = to
  }

  execute() { if (this._sm.currentClass === this._from) this._sm.change(this._to) }
}
```

```js
// commands/ToggleAudioCommand.js
class ToggleAudioCommand extends Command {
  _audio : AudioManager
  constructor(audio : AudioManager) { super(); this._audio = audio }
  execute() { this._audio.toggle() }
}
```

```js
// commands/ShootTargetCommand.js
// _ndc: shared reference to PointerInputSource.ndc — zero allocation per click
// Audio cohesion (GPP ch.13): all consequences of shooting live here
class ShootTargetCommand extends Command {
  _targets : TargetManager
  _audio   : AudioManager
  _ndc     : Object

  constructor(targets : TargetManager, audio : AudioManager, ndc : Object) {
    super(); this._targets = targets; this._audio = audio; this._ndc = ndc
  }

  execute() {
    const hit = this._targets.raycast(this._ndc)
    if (!hit) return
    this._targets.zap(hit)
    this._audio.play('zap')
  }
}
```

```js
// commands/SpawnAtOrientationCommand.js
// Spawns a cone 0.3m in front of the given transform, oriented along its -Z axis.
// Used for XR controller/hand select and camera (desktop click).
// _pos/_quat pre-allocated — no allocation in execute()
class SpawnAtOrientationCommand extends Command {
  _targets   : TargetManager
  _audio     : AudioManager
  _transform : Object3D
  _pos       : Vector3    = new Vector3()
  _quat      : Quaternion = new Quaternion()

  constructor(targets : TargetManager, audio : AudioManager, transform : Object3D) {
    super()
    this._targets   = targets
    this._audio     = audio
    this._transform = transform
  }

  execute() {
    this._pos.set(0, 0, -0.3).applyMatrix4(this._transform.matrixWorld)
    this._quat.setFromRotationMatrix(this._transform.matrixWorld)
    this._targets.spawnAt(this._pos, this._quat)
    this._audio.play('spawn')
  }
}
```

```js
// states/GameIntroState.js
class GameIntroState extends State {
  enter() { /* show intro UI */ }
  exit()  { /* hide intro UI */ }
}
```

```js
// states/GameRunningState.js
// Dependencies injected at construction — no coupling to Game.
// Spawn + sound: cohesion (GPP ch.2) — all of "spawn" in one place.
// Proximity zap + sound: same principle.
class GameRunningState extends State {
  _targets       : TargetManager
  _audio         : AudioManager
  _interactors   : Array
  _spawnTimer    : number = 0
  SPAWN_INTERVAL : number = 2      // seconds
  PROXIMITY      : number = 0.12   // metres

  constructor(targets : TargetManager, audio : AudioManager, interactors : Array) {
    super()
    this._targets     = targets
    this._audio       = audio
    this._interactors = interactors
  }

  enter() { this._spawnTimer = 0; this._audio.activate() }
  exit()  { this._audio.deactivate(); this._targets.clear() }

  update(delta : number) {
    this._spawnTimer += delta
    if (this._spawnTimer >= this.SPAWN_INTERVAL) {
      this._spawnTimer = 0
      this._targets.spawn(new Vector3(
        (Math.random() - 0.5) * 4,
         Math.random() * 1.5 + 0.5,
        -Math.random() * 2 - 1
      ))
      this._audio.play('spawn')
    }

    const positions = this._interactors.filter(i => i.enabled).map(i => i.position)
    for (const mesh of this._targets.proximate(positions, this.PROXIMITY)) {
      this._targets.zap(mesh)
      this._audio.play('zap')
    }
  }
}
```

```js
// states/GameOverState.js
class GameOverState extends State {
  enter() { /* show game over UI */ }
  exit()  { /* hide game over UI */ }
}
```

```js
// Game.js
// Single wiring point. Owns all managers. Nothing outside knows about Game.
// Satisfies GameLoop's expected shape via processInput/update/render.
// UI wired here via observer subscriptions (not yet implemented — add per panel).
class Game {
  _render  : RenderManager
  _targets : TargetManager
  _audio   : AudioManager
  _input   : InputManager
  _sm      : StateMachine

  _onXRStart = () => { this._render.controls.enabled = false; this._input.onSessionStart() }
  _onXREnd   = () => { this._render.controls.enabled = true;  this._input.onSessionEnd()   }

  constructor() {
    this._render  = new RenderManager()
    this._targets = new TargetManager(this._render.scene, this._render.camera)
    this._audio   = new AudioManager(this._render.camera)
    this._input   = new InputManager(this._render.renderer, this._render.scene)
    this._sm      = this._buildStateMachine()
    this._bindInput()

    const xr = this._render.renderer.xr
    xr.addEventListener('sessionstart', this._onXRStart)
    xr.addEventListener('sessionend',   this._onXREnd)
  }

  _buildStateMachine() {
    const sm = new StateMachine()
    sm.register(GameIntroState,   new GameIntroState())
    sm.register(GameRunningState, new GameRunningState(this._targets, this._audio, this._input.interactors))
    sm.register(GameOverState,    new GameOverState())
    sm.start(GameIntroState)
    return sm
  }

  _bindInput() {
    const { _sm: sm, _targets: tgt, _audio: audio } = this
    const { keyboard: kb, pointer: ptr, gamepad: gp, xrLeft, xrRight } = this._input

    // state transitions
    kb.bind('Space', new ChangeStateCommand(sm, GameIntroState,    GameRunningState))
    kb.bind('KeyO',  new ChangeStateCommand(sm, GameRunningState,  GameOverState))
    kb.bind('KeyR',  new ChangeStateCommand(sm, GameOverState,     GameIntroState))
    kb.bind('KeyM',  new ToggleAudioCommand(audio))

    // desktop: pointer shoots existing targets
    ptr.bind(new ShootTargetCommand(tgt, audio, ptr.ndc))

    // gamepad
    gp.bind(3, new ToggleAudioCommand(audio))

    // XR: select spawns oriented cone (original behaviour from prompt)
    //     squeeze: audio toggle left, state change right
    xrLeft.bind('select',  new SpawnAtOrientationCommand(tgt, audio, xrLeft.node))
    xrLeft.bind('squeeze', new ToggleAudioCommand(audio))

    xrRight.bind('select',  new SpawnAtOrientationCommand(tgt, audio, xrRight.node))
    xrRight.bind('squeeze', new ChangeStateCommand(sm, GameRunningState, GameOverState))
  }

  processInput() {
    this._input.collect()
    for (const cmd of this._input.commands) cmd.execute()
  }

  update(delta : number) { this._sm.update(delta) }
  render()               { this._render.render() }

  dispose() {
    const xr = this._render.renderer.xr
    xr.removeEventListener('sessionstart', this._onXRStart)
    xr.removeEventListener('sessionend',   this._onXREnd)
    this._input.dispose()
    this._targets.dispose()
    this._audio.dispose()
    this._render.dispose()
  }

  start() { this._render.renderer.setAnimationLoop(new GameLoop(this).tick) }
}
```

```js
// main.js
new Game().start()
```

---

**Open questions to carry into next session:**

- InstancedMesh integration: entity holds `instanceIndex` as component, manager owns reverse map + swap-and-pop for O(1) despawn
- UI: observer subscriptions in `Game` wiring — `StateMachine` emits `onChange`, panels subscribe
- ECS migration path: `EntityManager` already separates lifecycle from rendering — next step is typed component arrays when entity count justifies it
- `GameRunningState` allocates `new Vector3()` in update via `map(i => i.position)` — consider pre-allocating a fixed positions array





# Engine changes — 2026-07-08 session 2

8 modified files + 3 new files.
Unchanged: Command.js, State.js, StateMachine.js, EntityManager.js,
InputSource.js, InputProcessor.js, KeyboardInputSource.js,
PointerInputSource.js, GamepadInputSource.js, HandSource.js,
InputManager.js, RenderManager.js, GameIntroState.js, GameOverState.js,
ChangeStateCommand.js, ToggleAudioCommand.js, main.js

---

## Modified files

---

### core/GameLoop.js

**Change:** `Timer` was undefined. Replaced with `THREE.Timer` import
(available since r168; has `connect(document)` for visibilitychange handling
and `update()` / `getDelta()` methods — drop-in for what was written).
If your Three.js is older, replace `Timer` with `Clock` and remove `connect`.

```js
// core/GameLoop.js
import { Timer } from 'three'

class GameLoop {
  _host  : Game
  _timer : Timer

  constructor(host : Game) {
    this._host  = host
    this._timer = new Timer()
    this._timer.connect(document)   // pauses delta accumulation when tab is hidden
  }

  tick = () => {
    this._timer.update()
    const delta = this._timer.getDelta()
    this._host.processInput()
    this._host.update(delta)
    this._host.render()
  }
}
```

---

### input/SpatialInputSource.js

**Changes:**
- `_onConnected` stores `e.data.gamepad` (XRInputSource carries it)
- `_onDisconnected` nulls the gamepad ref
- New `rumble(intensity, duration)` — optional chaining makes it safe
  on desktop (where `_gamepad` is null)

```js
// input/SpatialInputSource.js
class SpatialInputSource extends InputSource {
  _node       : Object3D
  _handedness : string
  _handlers   : Object        = {}
  _gamepad    : Gamepad | null = null   // NEW — stored from connected event

  constructor(node : Object3D, handedness : string) {
    super()
    this._node       = node
    this._handedness = handedness
    this.enabled     = false
    node.addEventListener('connected',    this._onConnected)
    node.addEventListener('disconnected', this._onDisconnected)
  }

  get position() { return this._node.position }
  get node()     { return this._node }

  bind(event : string, command : Command) {
    const handler = () => { if (this.enabled) this.queue.push(command) }
    this._handlers[event] = handler
    this._node.addEventListener(event, handler)
  }

  // NEW — safe on desktop: _gamepad is null, optional chain is a no-op
  rumble(intensity : number, duration : number = 100) {
    this._gamepad?.hapticActuators?.[0]?.pulse(intensity, duration)
  }

  _onConnected = (e : any) => {
    if (e.data.handedness !== this._handedness) return
    this.enabled   = true
    this._gamepad  = e.data.gamepad   // NEW
  }

  _onDisconnected = () => {
    this.enabled  = false
    this._gamepad = null              // NEW
    this.queue.length = 0
  }

  dispose() {
    this._node.removeEventListener('connected',    this._onConnected)
    this._node.removeEventListener('disconnected', this._onDisconnected)
    for (const [event, handler] of Object.entries(this._handlers))
      this._node.removeEventListener(event, handler)
  }
}
```

---

### audio/AudioManager.js

**Changes:**
- Constructor now takes `scene` (needed to add spatial pool nodes)
- `_buffers` stores raw `AudioBuffer` refs separately from `_clips`
  so the spatial pool can reuse buffers without holding Audio instances
- `load()` now stores the buffer in `_buffers` on load callback
- New `playAt(id, position)` — picks a free PositionalAudio from pool,
  sets position, plays. Silent fail if pool exhausted (8 slots)
- `deactivate()` / `dispose()` now also stop and clean up spatial pool

```js
// audio/AudioManager.js
class AudioManager {
  _camera      : PerspectiveCamera
  _scene       : Scene
  _listener    : AudioListener
  _clips       : Object  = {}   // id → Audio (non-positional)
  _buffers     : Object  = {}   // id → AudioBuffer (reused by spatial pool)
  _spatialPool : Array   = []   // pre-allocated PositionalAudio nodes
  _muted       : boolean = false
  POOL_SIZE    : number  = 8

  constructor(camera : PerspectiveCamera, scene : Scene) {  // +scene
    this._camera   = camera
    this._scene    = scene
    this._listener = new AudioListener()
    camera.add(this._listener)

    for (let i = 0; i < this.POOL_SIZE; i++) {
      const node = new PositionalAudio(this._listener)
      node.setRefDistance(1)   // tune per game scale
      scene.add(node)
      this._spatialPool.push(node)
    }
  }

  load(id : string, url : string, loop : boolean = false, volume : number = 1) {
    const sound = new Audio(this._listener)
    new AudioLoader().load(url, buffer => {
      this._buffers[id] = buffer                        // NEW — store raw buffer
      sound.setBuffer(buffer); sound.setLoop(loop); sound.setVolume(volume)
    })
    this._clips[id] = sound
  }

  // Non-positional — existing behaviour unchanged
  play(id : string) {
    const s = this._clips[id]
    if (!this._muted && s && !s.isPlaying) s.play()
  }

  // NEW — positional: picks a free pool node, copies position, plays
  playAt(id : string, position : Vector3) {
    if (this._muted) return
    const buffer = this._buffers[id]
    if (!buffer) return
    const node = this._spatialPool.find(n => !n.isPlaying)
    if (!node) return   // all 8 busy — silent fail, not an error
    node.position.copy(position)
    node.setBuffer(buffer)
    node.play()
  }

  stop(id : string) { const s = this._clips[id]; if (s?.isPlaying) s.stop() }

  toggle() { this._muted ? this.activate() : this.deactivate() }

  activate() {
    this._muted = false
    if (this._listener.context.state === 'suspended') this._listener.context.resume()
  }

  deactivate() {
    this._muted = true
    for (const id in this._clips) this.stop(id)
    for (const node of this._spatialPool) if (node.isPlaying) node.stop()   // NEW
  }

  dispose() {
    this.deactivate()
    this._camera.remove(this._listener)
    for (const node of this._spatialPool) this._scene.remove(node)           // NEW
  }
}
```

**Note on XR spatial audio stuttering:**
THREE.PositionalAudio can stutter in XR when the AudioListener (attached to the
camera) updates at eye-switching frequency. If you observe this on device, set
the listener's panner node to use the XR reference space transform directly
rather than the camera. Test early.

---

### managers/TargetManager.js

**Changes — full InstancedMesh refactor:**
- One `InstancedMesh` for all instances (one draw call, shared geometry + material)
- Entity component `instanceIndex` replaces `mesh` reference
- `_indexMap : Array` — instanceIndex → entity, O(1) reverse lookup
- Inactive instances: zero-scale matrix (invisible, no scene.add/remove)
- `zap()` now takes `instanceId : number` (from raycaster), not Mesh
- `raycast()` returns `number | null` (instanceId), not Mesh
- `getPosition()` helper — callers need world position for playAt()
- `proximate()` reads position from instance matrix (no mesh.position)
- All hot-path scratch objects pre-allocated — no allocation in update/spawn/zap

```js
// managers/TargetManager.js
class TargetManager {
  _em        : EntityManager  = new EntityManager()
  _scene     : Scene
  _im        : InstancedMesh
  _indexMap  : Array          = []   // instanceIndex → entity, O(1)
  _raycaster : Raycaster
  _camera    : PerspectiveCamera

  // scratch — pre-allocated, never reallocated
  _m4        : Matrix4        = new Matrix4()
  _color     : Color          = new Color()
  _probeM4   : Matrix4        = new Matrix4()
  _probePos  : Vector3        = new Vector3()
  _one       : Vector3        = new Vector3(1, 1, 1)
  _zeroM4    : Matrix4        = new Matrix4().makeScale(0, 0, 0)
  _identQuat : Quaternion     = new Quaternion()

  constructor(scene : Scene, camera : PerspectiveCamera, poolSize : number = 16) {
    this._scene     = scene
    this._camera    = camera
    this._raycaster = new Raycaster()

    const geo = new CylinderGeometry(0, 0.05, 0.2, 32).rotateX(Math.PI / 2)
    const mat = new MeshPhongMaterial()

    this._im = new InstancedMesh(geo, mat, poolSize)
    this._im.instanceMatrix.setUsage(DynamicDrawUsage)   // GPU hint: updated frequently
    scene.add(this._im)

    // Initialise all instances as invisible + init instanceColor buffer
    for (let i = 0; i < poolSize; i++) {
      this._im.setMatrixAt(i, this._zeroM4)
      this._im.setColorAt(i, this._color.setHex(0xffffff))   // init instanceColor buffer
      const entity = this._em.create({ instanceIndex: i, active: false })
      this._indexMap[i] = entity
    }
    this._im.instanceMatrix.needsUpdate = true
    this._im.instanceColor.needsUpdate  = true
  }

  // random-position spawn — called by GameRunningState spawn timer
  spawn(position : Vector3) { this._activate(position, this._identQuat) }

  // oriented spawn — called by SpawnAtOrientationCommand (XR / camera)
  spawnAt(position : Vector3, quaternion : Quaternion) { this._activate(position, quaternion) }

  _activate(position : Vector3, quaternion : Quaternion) {
    const entity = this._em.find(e => !e.active)
    if (!entity) return
    entity.active = true
    this._m4.compose(position, quaternion, this._one)
    this._im.setMatrixAt(entity.instanceIndex, this._m4)
    this._im.setColorAt(entity.instanceIndex, this._color.setHex(Math.random() * 0xffffff))
    this._im.instanceMatrix.needsUpdate = true
    this._im.instanceColor.needsUpdate  = true
  }

  // instanceId: integer returned by raycast() or proximate()
  zap(instanceId : number) {
    const entity = this._indexMap[instanceId]
    if (!entity?.active) return
    entity.active = false
    this._im.setMatrixAt(instanceId, this._zeroM4)
    this._im.instanceMatrix.needsUpdate = true
  }

  // Returns instanceId (integer) or null — replaces returning Mesh
  raycast(ndc : Object) : number | null {
    this._raycaster.setFromCamera(ndc, this._camera)
    const hits = this._raycaster.intersectObject(this._im)
    return hits.length ? hits[0].instanceId : null
  }

  // Writes world position of instanceId into target. Call before zap() if
  // you need the position (e.g. for audio.playAt).
  getPosition(instanceId : number, target : Vector3) : Vector3 {
    this._im.getMatrixAt(instanceId, this._probeM4)
    return target.setFromMatrixPosition(this._probeM4)
  }

  // Returns array of instanceIds within radius of any position in positions[].
  // Uses instance matrices — no mesh.position available.
  proximate(positions : Vector3[], radius : number) : number[] {
    const result = []
    this._em.forEach(entity => {
      if (!entity.active) return
      this._im.getMatrixAt(entity.instanceIndex, this._probeM4)
      this._probePos.setFromMatrixPosition(this._probeM4)
      for (const pos of positions)
        if (pos.distanceTo(this._probePos) < radius && !result.includes(entity.instanceIndex))
          result.push(entity.instanceIndex)
    })
    return result
  }

  clear() {
    this._em.forEach(entity => {
      if (!entity.active) return
      entity.active = false
      this._im.setMatrixAt(entity.instanceIndex, this._zeroM4)
    })
    this._im.instanceMatrix.needsUpdate = true
  }

  dispose() {
    this.clear()
    this._im.geometry.dispose()
    this._im.material.dispose()
    this._scene.remove(this._im)
    this._em.clear()
  }
}
```

---

### states/GameRunningState.js

**Changes:**
- `_posBuffer` pre-allocated — `filter/map` replaced with a plain `for` loop
- `_spawnPos` pre-allocated — `new Vector3(...)` in update gone
- `_zapPos` pre-allocated — for `getPosition()` before each zap
- `proximate()` now yields `instanceId` (integer) not Mesh — `zap()` and
  `playAt()` updated accordingly
- Spawn sound uses `playAt` (spatial, from spawn point)
- Zap sound uses `playAt` (spatial, from target position)

```js
// states/GameRunningState.js
class GameRunningState extends State {
  _targets       : TargetManager
  _audio         : AudioManager
  _interactors   : Array
  _spawnTimer    : number  = 0
  _posBuffer     : Array   = []              // pre-allocated — filled each frame
  _spawnPos      : Vector3 = new Vector3()   // pre-allocated — no alloc in update
  _zapPos        : Vector3 = new Vector3()   // pre-allocated — for playAt before zap
  SPAWN_INTERVAL : number  = 2
  PROXIMITY      : number  = 0.12

  constructor(targets : TargetManager, audio : AudioManager, interactors : Array) {
    super()
    this._targets     = targets
    this._audio       = audio
    this._interactors = interactors
  }

  enter() { this._spawnTimer = 0; this._audio.activate() }
  exit()  { this._audio.deactivate(); this._targets.clear() }

  update(delta : number) {
    // spawn timer
    this._spawnTimer += delta
    if (this._spawnTimer >= this.SPAWN_INTERVAL) {
      this._spawnTimer = 0
      this._spawnPos.set(
        (Math.random() - 0.5) * 4,
         Math.random() * 1.5 + 0.5,
        -Math.random() * 2 - 1
      )
      this._targets.spawn(this._spawnPos)         // reuses _spawnPos safely —
      this._audio.playAt('spawn', this._spawnPos) // _activate reads it synchronously
    }

    // Collect enabled interactor positions — no allocation
    this._posBuffer.length = 0
    for (const i of this._interactors)
      if (i.enabled) this._posBuffer.push(i.position)

    if (!this._posBuffer.length) return

    // proximate() returns instanceIds (integers), not Meshes
    for (const instanceId of this._targets.proximate(this._posBuffer, this.PROXIMITY)) {
      this._targets.getPosition(instanceId, this._zapPos)  // read before zap
      this._targets.zap(instanceId)
      this._audio.playAt('zap', this._zapPos)
    }
  }
}
```

---

### commands/ShootTargetCommand.js

**Changes:**
- `raycast()` now returns `instanceId` (integer or null), not Mesh
- `getPosition()` call before `zap()` to capture world position for `playAt()`
- `_zapPos` pre-allocated scratch
- Optional `xrSource` param — `rumble()` called if present (null-safe)

```js
// commands/ShootTargetCommand.js
// Desktop pointer shoots targets by raycasting.
// xrSource: SpatialInputSource | null — pass for XR bindings, omit for pointer.
// zap() now takes instanceId (integer from InstancedMesh raycaster).
// _zapPos: pre-allocated scratch for getPosition() — zero alloc per click.
class ShootTargetCommand extends Command {
  _targets  : TargetManager
  _audio    : AudioManager
  _ndc      : Object
  _xrSource : SpatialInputSource | null
  _zapPos   : Vector3 = new Vector3()

  constructor(
    targets   : TargetManager,
    audio     : AudioManager,
    ndc       : Object,
    xrSource  : SpatialInputSource | null = null
  ) {
    super()
    this._targets  = targets
    this._audio    = audio
    this._ndc      = ndc
    this._xrSource = xrSource
  }

  execute() {
    const instanceId = this._targets.raycast(this._ndc)
    if (instanceId === null) return
    this._targets.getPosition(instanceId, this._zapPos)   // read before zap
    this._targets.zap(instanceId)
    this._audio.playAt('zap', this._zapPos)               // spatial — from target
    this._xrSource?.rumble(0.8, 80)
  }
}
```

---

### commands/SpawnAtOrientationCommand.js

**Changes:**
- `audio.play('spawn')` → `audio.playAt('spawn', this._pos)` — spatial, from spawn point
- Optional `xrSource` param for haptic feedback on spawn

```js
// commands/SpawnAtOrientationCommand.js
// Spawns a cone 0.3m in front of the given transform, oriented along its -Z axis.
// Sound and haptics fire from the controller tip position.
// _pos/_quat pre-allocated — no allocation in execute().
class SpawnAtOrientationCommand extends Command {
  _targets   : TargetManager
  _audio     : AudioManager
  _transform : Object3D
  _xrSource  : SpatialInputSource | null
  _pos       : Vector3    = new Vector3()
  _quat      : Quaternion = new Quaternion()

  constructor(
    targets   : TargetManager,
    audio     : AudioManager,
    transform : Object3D,
    xrSource  : SpatialInputSource | null = null
  ) {
    super()
    this._targets   = targets
    this._audio     = audio
    this._transform = transform
    this._xrSource  = xrSource
  }

  execute() {
    this._pos.set(0, 0, -0.3).applyMatrix4(this._transform.matrixWorld)
    this._quat.setFromRotationMatrix(this._transform.matrixWorld)
    this._targets.spawnAt(this._pos, this._quat)
    this._audio.playAt('spawn', this._pos)   // spatial — from controller tip
    this._xrSource?.rumble(0.3, 50)          // light pulse on spawn
  }
}
```

---

### Game.js

**Changes:**
- `AudioManager` now receives `this._render.scene` as second argument
- `SpawnAtOrientationCommand` receives `xrLeft` / `xrRight` as fourth argument
  (for rumble — no behaviour change on desktop)

```js
// Game.js
// Single wiring point. Owns all managers.
// Satisfies GameLoop's expected shape via processInput/update/render.
class Game {
  _render  : RenderManager
  _targets : TargetManager
  _audio   : AudioManager
  _input   : InputManager
  _sm      : StateMachine

  _onXRStart = () => { this._render.controls.enabled = false; this._input.onSessionStart() }
  _onXREnd   = () => { this._render.controls.enabled = true;  this._input.onSessionEnd()   }

  constructor() {
    this._render  = new RenderManager()
    this._targets = new TargetManager(this._render.scene, this._render.camera)
    this._audio   = new AudioManager(this._render.camera, this._render.scene)  // +scene
    this._input   = new InputManager(this._render.renderer, this._render.scene)
    this._sm      = this._buildStateMachine()
    this._bindInput()

    const xr = this._render.renderer.xr
    xr.addEventListener('sessionstart', this._onXRStart)
    xr.addEventListener('sessionend',   this._onXREnd)
  }

  _buildStateMachine() {
    const sm = new StateMachine()
    sm.register(GameIntroState,   new GameIntroState())
    sm.register(GameRunningState, new GameRunningState(
      this._targets, this._audio, this._input.interactors
    ))
    sm.register(GameOverState,    new GameOverState())
    sm.start(GameIntroState)
    return sm
  }

  _bindInput() {
    const { _sm: sm, _targets: tgt, _audio: audio } = this
    const { keyboard: kb, pointer: ptr, gamepad: gp, xrLeft, xrRight } = this._input

    kb.bind('Space', new ChangeStateCommand(sm, GameIntroState,   GameRunningState))
    kb.bind('KeyO',  new ChangeStateCommand(sm, GameRunningState, GameOverState))
    kb.bind('KeyR',  new ChangeStateCommand(sm, GameOverState,    GameIntroState))
    kb.bind('KeyM',  new ToggleAudioCommand(audio))

    // desktop pointer: no xrSource (null default), no rumble
    ptr.bind(new ShootTargetCommand(tgt, audio, ptr.ndc))

    gp.bind(3, new ToggleAudioCommand(audio))

    // XR: pass xrSource for rumble
    xrLeft.bind('select',  new SpawnAtOrientationCommand(tgt, audio, xrLeft.node,  xrLeft))
    xrLeft.bind('squeeze', new ToggleAudioCommand(audio))

    xrRight.bind('select',  new SpawnAtOrientationCommand(tgt, audio, xrRight.node, xrRight))
    xrRight.bind('squeeze', new ChangeStateCommand(sm, GameRunningState, GameOverState))
  }

  processInput() {
    this._input.collect()
    for (const cmd of this._input.commands) cmd.execute()
  }

  update(delta : number) { this._sm.update(delta) }
  render()               { this._render.render() }

  dispose() {
    const xr = this._render.renderer.xr
    xr.removeEventListener('sessionstart', this._onXRStart)
    xr.removeEventListener('sessionend',   this._onXREnd)
    this._input.dispose()
    this._targets.dispose()
    this._audio.dispose()
    this._render.dispose()
  }

  start() { this._render.renderer.setAnimationLoop(new GameLoop(this).tick) }
}
```

---

## New files

---

### effects/ParticleSystem.js

Self-contained. No EntityManager, no GameLoop coupling.
Caller: `system.emit(position)` to fire particles, `system.update(delta)` each frame.
Separate from TargetManager — particles have no game-logic identity, no raycasting,
no pooling concept. They live and die entirely within ParticleSystem.

```js
// effects/ParticleSystem.js
class ParticleSystem {
  _scene     : Scene
  _im        : InstancedMesh
  _particles : Array   = []
  _m4        : Matrix4 = new Matrix4()
  _zeroM4    : Matrix4 = new Matrix4().makeScale(0, 0, 0)

  constructor(scene : Scene, poolSize : number = 64) {
    this._scene = scene

    const geo = new SphereGeometry(0.02, 6, 6)
    const mat = new MeshBasicMaterial({ color: 0xffffff })

    this._im = new InstancedMesh(geo, mat, poolSize)
    this._im.instanceMatrix.setUsage(DynamicDrawUsage)
    scene.add(this._im)

    for (let i = 0; i < poolSize; i++) {
      this._im.setMatrixAt(i, this._zeroM4)
      this._particles.push({
        instanceIndex : i,
        active        : false,
        pos           : new Vector3(),
        vel           : new Vector3(),
        age           : 0,
        maxAge        : 0
      })
    }
    this._im.instanceMatrix.needsUpdate = true
  }

  emit(origin : Vector3, count : number = 8, maxAge : number = 0.6) {
    let spawned = 0
    for (const p of this._particles) {
      if (p.active || spawned >= count) continue
      p.active = true
      p.age    = 0
      p.maxAge = maxAge
      p.pos.copy(origin)
      p.vel.set(
        (Math.random() - 0.5) * 3,
         Math.random() * 2 + 1,
        (Math.random() - 0.5) * 3
      )
      spawned++
    }
  }

  // Called each frame from game loop update phase
  update(delta : number) {
    let dirty = false
    for (const p of this._particles) {
      if (!p.active) continue
      p.age += delta
      if (p.age >= p.maxAge) {
        p.active = false
        this._im.setMatrixAt(p.instanceIndex, this._zeroM4)
        dirty = true
        continue
      }
      // simple gravity
      p.vel.y -= 4 * delta
      p.pos.addScaledVector(p.vel, delta)
      // shrink to 0 as particle ages
      const scale = 1 - p.age / p.maxAge
      // makeScale + setPosition: no temporary Vector3 needed
      this._m4.makeScale(scale, scale, scale)
      this._m4.setPosition(p.pos)
      this._im.setMatrixAt(p.instanceIndex, this._m4)
      dirty = true
    }
    if (dirty) this._im.instanceMatrix.needsUpdate = true
  }

  dispose() {
    this._scene.remove(this._im)
    this._im.geometry.dispose()
    this._im.material.dispose()
  }
}
```

**Wiring in Game.js when ready:**
```js
this._particles = new ParticleSystem(this._render.scene)
// in update: this._particles.update(delta)
// in ShootTargetCommand.execute(): this._particles.emit(this._zapPos)
```

---

### ui/UIPanel.js

Group wrapping a PlaneGeometry + CanvasTexture.
`render(callback)` exposes the raw 2D canvas context — caller draws freely.
Canvas → texture keeps the Three.js render pipeline out of UI logic.

```js
// ui/UIPanel.js
class UIPanel extends Group {
  _canvas : HTMLCanvasElement
  _ctx    : CanvasRenderingContext2D
  _tex    : CanvasTexture
  _mesh   : Mesh

  constructor(
    widthM  : number = 0.4,    // world-space width in metres
    heightM : number = 0.2,    // world-space height in metres
    canvasW : number = 512,    // texture resolution
    canvasH : number = 256
  ) {
    super()
    this._canvas        = document.createElement('canvas')
    this._canvas.width  = canvasW
    this._canvas.height = canvasH
    this._ctx           = this._canvas.getContext('2d')

    this._tex  = new CanvasTexture(this._canvas)
    this._mesh = new Mesh(
      new PlaneGeometry(widthM, heightM),
      new MeshBasicMaterial({ map: this._tex, transparent: true, depthTest: false })
    )
    this.add(this._mesh)
    this.visible = false
  }

  // callback: (ctx: CanvasRenderingContext2D, w: number, h: number) => void
  render(callback : Function) {
    const { _ctx: ctx, _canvas: c } = this
    ctx.clearRect(0, 0, c.width, c.height)
    callback(ctx, c.width, c.height)
    this._tex.needsUpdate = true
  }

  show() { this.visible = true  }
  hide() { this.visible = false }

  dispose() {
    this._mesh.geometry.dispose()
    this._mesh.material.dispose()
    this._tex.dispose()
  }
}
```

---

### ui/UIManager.js

Owns all UIPanel instances. Subscribed to state changes via observer
(planned wiring in Game.js). Panels attach to scene (world-anchored) or
camera (HUD-style) depending on use.

```js
// ui/UIManager.js
class UIManager {
  _panels : Map = new Map()   // name → UIPanel

  constructor() {}

  // attachTo: scene for world-anchored, camera for HUD-style. Defaults to scene.
  register(name : string, panel : UIPanel, attachTo : Object3D) {
    this._panels.set(name, panel)
    attachTo.add(panel)
    return this   // chainable
  }

  show(name : string)  { this._panels.get(name)?.show() }
  hide(name : string)  { this._panels.get(name)?.hide() }
  hideAll()            { for (const p of this._panels.values()) p.hide() }
  get(name : string)   { return this._panels.get(name) }

  dispose() {
    for (const p of this._panels.values()) p.dispose()
    this._panels.clear()
  }
}
```

**Wiring example in Game.js when ready:**
```js
this._ui = new UIManager()

const introPanel = new UIPanel(0.6, 0.3)
introPanel.position.set(0, 1.6, -1.5)
introPanel.render((ctx, w, h) => {
  ctx.fillStyle = 'rgba(0,0,0,0.8)'
  ctx.fillRect(0, 0, w, h)
  ctx.fillStyle = '#fff'
  ctx.font = '48px sans-serif'
  ctx.fillText('Press Space to start', 20, h / 2)
})
this._ui.register('intro', introPanel, this._render.scene)

// Observer wiring (when StateMachine gets onChange emitter):
// sm.onChange = (NextState) => {
//   this._ui.hideAll()
//   if (NextState === GameIntroState)   this._ui.show('intro')
//   if (NextState === GameOverState)    this._ui.show('gameover')
// }
```

---

## What still needs an entry in ARCHI.md

| Topic | Status |
|---|---|
| InstancedMesh integration | Done — TargetManager refactored |
| Allocation bug in GameRunningState | Fixed |
| Timer undefined | Fixed |
| Spatial audio (PositionalAudio pool) | Done — AudioManager.playAt() |
| Haptics | Done — SpatialInputSource.rumble() |
| Particles | New — ParticleSystem.js |
| 3D UI | New — UIPanel + UIManager (stub wiring) |
| StateMachine.onChange emitter | Still open — needed for UIManager wiring |
| 3D Text (troika-three-text) | Still open |
| AnimationMixer as entity component | Still open |
| ECS migration path | Still open (design unchanged, not needed yet) |