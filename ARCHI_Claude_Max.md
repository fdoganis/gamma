
Grilling the design — honest assessment

Scaling: what holds up

State.#handlers Map lookup is O(1) — cmd.constructor as key costs one pointer comparison. Stays fast at any number of command types. Adding a new command type is one new class and one this.on() in the relevant states, nothing else changes. The dispatch path is short and auditable.

Scaling: what breaks down

State constructors accumulate this.on() calls as the game grows. At 10+ handled commands per state the constructor becomes a registration list — extract to #registerHandlers() when that happens.

The deeper problem: GameRunningState owns a static BufferGeometry. A state is a behavioral object. It should not own GPU resources. Static geometry on a state class is a layer violation — the only thing that should be static on a state is behaviour, not data. Geometry belongs in a manager passed in at construction.

Similarly, Mesh creation inside a state constructor callback is Three.js concern leaking into game logic. The state should call targetManager.spawn(pos, quat) and know nothing about MeshPhongMaterial.

GPP on States calling actions vs being the action

GPP ch.7 is explicit: the state is where the action happens. There is no intermediate "action" object between state and system. The pattern in the book:

handleInput(Heroine& heroine, Input input) {
  heroine.setGraphics(IMAGE_DUCK);   // direct call on the game object
}
No extra dispatch layer. States call methods on whatever systems are passed to them. Our design is correct on this point — GameRunningState spawns cones directly in its handler. The only fix needed is: not doing it with raw Three.js calls, but by calling targetManager.spawn(). One level of indirection to the right system, not two.

IXRNode — overkill?

No. It solves a real problem: Three.js's XRTargetRaySpace and XRHandSpace don't share a typed interface even though they behave identically at runtime. Without IXRNode you get any, a union type XRTargetRaySpace | XRHandSpace, or Object3D (loses XR event typing). The interface costs nothing at runtime — fully erased. XRBindableEvent constraining bind() to legal event names is also genuinely useful. Keep them.

"Not pre-allocated — there is new everywhere"

The new calls in #bindInput() happen once at init time, not per frame. Each creates one SelectCommand instance that is reused every time the event fires. That is the definition of pre-allocation: allocate once, reuse indefinitely. The concern would be valid if new SelectCommand() appeared inside the event handler — that would allocate per press. Here it does not.

Four instances are needed because each source holds a different node reference. Same class, different data.

() => sm.change( — genericity and inconsistency

The inconsistency is real and will grow: GameIntroState and GameOverState take transition callbacks, GameRunningState does not because its select handler does something else. As the game grows this divergence becomes confusing.

The root cause: states are currently responsible for their own exit transitions. An alternative: the StateMachine owns all transitions, states declare only behaviour:

sm.register(GameIntroState,   new GameIntroState())
sm.transition(GameIntroState, SelectCommand, GameRunningState)
States then have no sm reference, no callbacks, and no knowledge of what triggers their exit. All transition logic lives in one place — Game.#buildStateMachine(). The cost: states lose the ability to conditionally transition based on internal state. For this game that is not needed yet.

enter() / exit() timing

sm.change(NextState)
  → currentState.exit()    // called on the state being LEFT
  → currentState = next
  → currentState.enter()   // called on the state being ENTERED
sm.start(StateClass)
  → enter() only           // no previous state to exit
enter() = initialize what this state needs: reset timers, show UI, activate audio. exit() = release what this state owns: clear targets, hide UI, deactivate audio.

dispatch() and update() — what they mean

dispatch(cmd) answers "something happened" — an input event occurred, route it to the current state's handler. It is GPP's handleInput().

update(delta) answers "time passed" — a frame elapsed, let the current state do time-based work: advance spawn timers, check proximity, drive animations.

These are the two fundamental concerns in a game loop: events and time. Keeping them separate is the right call.

For Game itself: processInput() collects and dispatches — event concern. update(delta) delegates to sm.update(delta) — time concern. render() delegates to RenderManager — draw concern. Three responsibilities, no overlap.

Summary verdict

The pattern is correct and lightweight. The two real problems are layer violations: geometry on a state, and Three.js mesh creation inside state logic. Fix those by passing a TargetManager to GameRunningState and moving transition ownership to StateMachine. Everything else holds at scale.





===



Naming

TargetManager is game-specific. RenderManager renders — wrong responsibility for spawning. SceneManager conflicts conceptually with Three.js's own scene. GeometryManager is too narrow.

The right name is World — used in Bevy, Unity DOTS, and most ECS engines. It owns what exists in the game: spawn, despawn, query. It bridges to Scene for rendering. Short, generic, scales to any object type, immediately understood by anyone with engine experience.

#registerHandlers() — the scaling problem explained

Currently handlers register inline in the constructor:

constructor(sm: ITransition, scene: Scene, audio: AudioManager) {
  super();
  this.on(SelectCommand, (cmd) => { /* 10 lines */ });
  this.on(SqueezeCommand, () => { /* 5 lines */ });
  this.on(GamepadCommand, () => { /* 8 lines */ });
  // constructor becomes unreadable at 10+ commands
}
The fix is extracting to named private methods:

constructor(sm: ITransition, scene: Scene, audio: AudioManager) {
  super();
  this.#scene = scene;
  this.#audio = audio;
  this.#registerHandlers();   // constructor stays clean
}

#registerHandlers(): void {
  this.on(SelectCommand, this.#onSelect);
  this.on(SqueezeCommand, this.#onSqueeze);
}

#onSelect = (cmd: SelectCommand): void => { /* spawn */ };
#onSqueeze = (): void => { /* audio toggle */ };
Named handlers have three concrete benefits: they appear by name in stack traces, they can be read independently, and each one has a clear single responsibility.

Lifecycle audit — who owns what

SelectCommand instances in #bindInput():

xrLeft.bind('select', new SelectCommand(xrLeft.node));
These are not stored directly. bind() captures them inside a closure stored in SpatialInputSource.#handlers. The chain is:

SelectCommand ← captured by closure ← #handlers ← SpatialInputSource 
← InputProcessor ← InputManager ← Game
Game.dispose() → InputManager.dispose() → InputProcessor.dispose() → SpatialInputSource.dispose()removes all listeners and clears #handlers → closures released → commands eligible for GC. ✓

Real leaks found:

GameLoop in start():

start(): void { this.#render.renderer.setAnimationLoop(new GameLoop(this).tick); }
GameLoop is not stored. renderer.setAnimationLoop(null) must be called before renderer.dispose(), otherwise the renderer holds tick, which closes over the loop, which holds Game — a full retain cycle. Fix: store the loop and call setAnimationLoop(null) in dispose().

Spawned Mesh materials:

new MeshPhongMaterial({ color: Math.random() * 0xffffff })
Each cone gets its own material. Materials are GPU resources. Removing a mesh from the scene does not dispose its material — that must be done explicitly. Currently nothing does this. When World despawns an object it must call material.dispose().

StateMachine has no dispose(). The states themselves have no GPU resources currently — but GameRunningState has static geometry. disposeGeo() is called manually in Game.dispose(). This is fragile. Better: move geometry into World, which has a proper dispose() lifecycle.

Conditional transitions — the important missing feature

The callback approach:

new GameIntroState(() => sm.change(GameRunningState))
works for unconditional transitions but breaks if the state needs to decide:

// impossible with a fixed callback
this.on(SelectCommand, (cmd) => {
  if (this.#lives <= 0) sm.change(GameOverState);
  else this.#spawn(cmd);
});
The fix: states receive an ITransition — a structural type requiring only change(). No new file needed, just a type alias:

type ITransition = { change(StateClass: object): void };
StateMachine already satisfies this shape. States store it and call it when their own logic dictates. Unconditional transitions remain as callbacks if preferred — both coexist:

// unconditional — callback is cleaner
new GameIntroState(sm, () => sm.change(GameRunningState))

// conditional — state decides internally
class GameRunningState extends State {
  #sm: ITransition;
  // ...
  #onSelect = (cmd: SelectCommand): void => {
    if (this.#lives <= 0) this.#sm.change(GameOverState);
    else this.#world.spawn(cmd.transform);
  };
}
GameRunningState currently has no transition callback because its select handler does work rather than changing state. Once it can change state conditionally, passing sm is consistent across all states and the asymmetry disappears.

GPP on States doing work vs delegating

GPP ch.7 is unambiguous: states do the work directly on whatever systems are passed to them. There is no intermediate action layer. The state calls world.spawn(), audio.play() — direct method calls on injected dependencies. The pattern breaks if you add another dispatch layer between the state handler and the system call. Keep it direct.

Ready to rewrite with these fixes applied?







===



