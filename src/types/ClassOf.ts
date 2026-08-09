// "The class of T" matches any constructor (concrete or abstract) whose instances are T
// Routes by class identity in State.on() and StateMachine.
// any[] is the exception: these are never called, only compared by identity,
// so the argument list is deliberately unconstrained.
export type ClassOf<T> = abstract new (...args: any[]) => T;
