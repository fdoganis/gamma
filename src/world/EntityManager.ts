// Generic lifecycle container, entities are plain records identified by integer ID.
// Knows nothing about Three.js or game logic
// T is whatever components the owner (World, or any future manager) decides to store.
// EntityManager = what exists
// World = what it looks like in Three.js

type Entity<T extends object> = T & { readonly id: number };

export class EntityManager<T extends object> {
  #nextId = 0; // global Entity ID generator
  #store = new Map<number, Entity<T>>();

  // No default: a component set missing a required field is now a compile error.
  create(components: T): number {
    const id = this.#nextId++;
    this.#store.set(id, { ...components, id });
    return id;
  }

  destroy(id: number) { this.#store.delete(id); }

  clear() { this.#store.clear(); }

  // Iterates without allocating an array, use for side effects
  forEach(fn: (e: Entity<T>) => void) {
    for (const e of this.#store.values()) { fn(e); }
  }

  // Allocates an array, use only when caller needs a collection
  filter(pred: (e: Entity<T>) => boolean): Entity<T>[] {
    const result: Entity<T>[] = [];
    for (const e of this.#store.values()) {
      if (pred(e)) {
        result.push(e);
      }
    }
    return result;
  }

  // Short-circuits on first match, preferred over filter when one result is enough
  find(pred: (e: Entity<T>) => boolean): Entity<T> | undefined {
    for (const e of this.#store.values()) {
      if (pred(e)) { return e; }
    }
  }
}