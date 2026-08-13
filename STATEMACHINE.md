## Combining Command and State Patterns

The elegant way to combine these patterns is to **delegate command execution to the current State**. Here's how it works:

Instead of having commands execute directly on an actor, have them ask the actor's current state to handle them. This gives each state control over how the same button press behaves in different contexts.

---

## The Key Insight

From the **Command** chapter, you have buttons mapped to reusable command objects. From the **State** chapter, you have a state object that owns behavior for each condition. The connection point is the **execute** method of the command — instead of calling a global function or method directly, it passes itself to the actor's state.

---

## Implementation Approach

Here's a basic structure:

```cpp
class Command
{
public:
  virtual ~Command() {}
  virtual void execute(GameActor& actor) = 0;
};

class JumpCommand : public Command
{
public:
  virtual void execute(GameActor& actor)
  {
    // Delegate to the actor's current state
    actor.getCurrentState()->handleCommand(*this, actor);
  }
};
```

Then, your state classes decide what actually happens:

```cpp
class StandingState : public ActorState
{
public:
  virtual void handleCommand(JumpCommand& cmd, GameActor& actor)
  {
    // Standing: allow the jump
    actor.setVelocity(0, JUMP_VELOCITY);
    actor.setState(jumpingState);
  }
};

class DuckingState : public ActorState
{
public:
  virtual void handleCommand(JumpCommand& cmd, GameActor& actor)
  {
    // Ducking: maybe jump shorter, or don't allow it
    // Different behavior in different state
    actor.setVelocity(0, JUMP_VELOCITY * 0.5f);
  }
};
```

---

## Alternative: State-Aware Command Bindings

Another approach is to **rebind commands based on state**. When your actor enters a new state, change which commands are bound to which buttons:

```cpp
void Actor::setState(ActorState* newState)
{
  state_ = newState;
  inputHandler->rebindCommands(state_->getCommandBindings());
}
```

This is cleaner if you want completely different control schemes in different states (for example, a menu state might bind buttons completely differently than gameplay).

---

## Why This Works Well

The **Command** pattern gives you flexible, remappable input binding. The **State** pattern gives you encapsulated, state-specific behavior. Together, they let you:

- **Keep configurability**: Players can still rebind buttons
- **Keep state logic together**: All behavior for ducking lives in the ducking state
- **Avoid massive switch statements**: Each state class handles the commands it cares about
- **Share states easily**: The same state objects work for multiple actors with different animations or values

This combination is particularly powerful in games where the same button (like a jump command) needs to behave very differently depending on context.


===


## State-Aware Command Rebinding in Detail

The second approach treats **each state as having its own control scheme**. When you change states, you literally swap out which commands are bound to which buttons. This is particularly useful when different states need radically different controls.

---

## How It Works

Your input handler stores command bindings, and the state tells the handler what those bindings should be:

```cpp
class InputHandler
{
private:
  map<InputKey, Command*> bindings_;

public:
  void rebindCommands(const map<InputKey, Command*>& newBindings)
  {
    bindings_ = newBindings;
  }

  void handleInput(InputKey key)
  {
    if (bindings_.find(key) != bindings_.end())
    {
      bindings_[key]->execute();
    }
  }
};
```

Each state class defines its own command mappings:

```cpp
class PlayingState : public ActorState
{
private:
  map<InputKey, Command*> commandBindings_;

public:
  PlayingState()
  {
    commandBindings_[KEY_W] = new MoveForwardCommand();
    commandBindings_[KEY_A] = new TurnLeftCommand();
    commandBindings_[KEY_SPACE] = new JumpCommand();
    commandBindings_[KEY_CTRL] = new CrouchCommand();
  }

  map<InputKey, Command*> getCommandBindings() const
  {
    return commandBindings_;
  }
};

class MenuState : public ActorState
{
private:
  map<InputKey, Command*> commandBindings_;

public:
  MenuState()
  {
    commandBindings_[KEY_W] = new SelectPreviousCommand();
    commandBindings_[KEY_S] = new SelectNextCommand();
    commandBindings_[KEY_SPACE] = new ConfirmCommand();
    commandBindings_[KEY_ESC] = new BackCommand();
  }

  map<InputKey, Command*> getCommandBindings() const
  {
    return commandBindings_;
  }
};
```

When the actor transitions states, it pushes the new bindings to the input handler:

```cpp
class GameActor
{
private:
  ActorState* currentState_;
  InputHandler* input_;

public:
  void setState(ActorState* newState)
  {
    currentState_ = newState;
    // Tell input handler about this state's bindings
    input_->rebindCommands(newState->getCommandBindings());
  }
};
```

---

## Real-World Example: Combat States

Imagine a game where a character has different movement abilities depending on their state:

```cpp
class RunningState : public ActorState
{
public:
  RunningState()
  {
    commandBindings_[KEY_W] = new SprintCommand();      // Sprint faster
    commandBindings_[KEY_A] = new QuickTurnLeftCommand(); // Turn more responsively
    commandBindings_[KEY_SPACE] = new DiveCommand();    // Roll dive
  }
};

class CombatState : public ActorState
{
public:
  CombatState()
  {
    commandBindings_[KEY_W] = new AdvanceCommand();     // Cautious advance
    commandBindings_[KEY_A] = new SideStepCommand();    // Defensive sidestep
    commandBindings_[KEY_SPACE] = new ParryCommand();   // Parry instead of jump
    commandBindings_[KEY_Q] = new BlockCommand();       // New ability available
  }
};

class SwimmingState : public ActorState
{
public:
  SwimmingState()
  {
    commandBindings_[KEY_W] = new SwimForwardCommand();
    commandBindings_[KEY_A] = new SwimLeftCommand();
    commandBindings_[KEY_SPACE] = new SurfaceCommand(); // Space = surface, not jump
    commandBindings_[KEY_SHIFT] = nullptr;              // Can't sprint in water
  }
};
```

Now when the player presses **W**, the effect is different in each state without requiring the command or input handler to know anything about states.

---

## Advantages of This Approach

- **Completely state-agnostic commands**: Commands don't need conditional logic for different states
- **Clean separation**: All control scheme data lives in the state class
- **Easy to debug**: You can see exactly what buttons do in a given state by looking at that state class
- **No switch statements**: You avoid giant if-else chains checking "am I in state X, Y, or Z?"
- **Great for menu systems**: Menu states have completely different bindings than gameplay states

---

## Disadvantages

- **More objects**: You create a new Command instance for each state binding, which uses more memory
- **Duplication**: If multiple states share commands, you may create redundant command objects
- **Dynamic unbinding**: Some commands might be invalid in certain states (handle with `nullptr` checks)

---

## Optimization: Share Commands Across States

If memory is a concern, create command objects once and reuse them:

```cpp
class GameActor
{
private:
  // Shared command instances
  MoveForwardCommand moveCmd_;
  JumpCommand jumpCmd_;
  ParryCommand parryCmd_;

public:
  void initializeStates()
  {
    playingState_->setCommandBinding(KEY_W, &moveCmd_);
    playingState_->setCommandBinding(KEY_SPACE, &jumpCmd_);
    
    combatState_->setCommandBinding(KEY_W, &moveCmd_);
    combatState_->setCommandBinding(KEY_Q, &parryCmd_);
  }
};
```

This gives you the organizational clarity of per-state bindings without the object creation overhead.


===

Do I need a State Machine?

===

## No, You Don't Strictly Need One — But It Helps

The **State pattern alone** is sufficient for the Command+State combination. You can transition between states with simple `setState()` calls without a dedicated state machine. However, **a state machine becomes valuable as complexity grows**.

---

## What's the Difference?

The **State pattern** lets you transition from any state to any state:

```cpp
void GameActor::setState(ActorState* newState)
{
  currentState_ = newState;
  input_->rebindCommands(newState->getCommandBindings());
}

// Later, anywhere in code:
actor->setState(combatState);  // Valid
actor->setState(swimState);    // Also valid, even if weird
```

A **state machine** enforces which transitions are *allowed*:

```cpp
class StateMachine
{
public:
  void transition(ActorState* targetState)
  {
    if (currentState_->canTransitionTo(targetState))
    {
      currentState_->onExit();
      currentState_ = targetState;
      currentState_->onEnter();
    }
    else
    {
      // Invalid transition — prevent it
      logError("Cannot transition from " + currentState_->name() + 
               " to " + targetState->name());
    }
  }
};
```

---

## When You Probably Don't Need a State Machine

**Simple games with loose transitions:**
- A small character with standing, jumping, and crouching states
- A menu system with a few screens
- Transitions that can happen from anywhere without much ceremony

Just use `setState()` directly. It's simpler and clearer.

---

## When a State Machine Becomes Valuable

**Complex games with strict rules:**

- **Preventing invalid transitions**: You don't want to accidentally jump into a "dead" state from an invalid starting state
- **Explicit state graphs**: You want to document "from Running, you can go to Combat, Jumping, or Dead — nothing else"
- **Lifecycle hooks**: States need `onEnter()` and `onExit()` to clean up resources or trigger animations
- **Many states**: When you have 10+ states, accidental invalid transitions become more likely

Example:

```cpp
class RunningState : public ActorState
{
public:
  bool canTransitionTo(ActorState* target)
  {
    // Can only transition from running to: combat, jumping, dead
    return dynamic_cast<CombatState*>(target) ||
           dynamic_cast<JumpingState*>(target) ||
           dynamic_cast<DeadState*>(target);
  }
};
```

---

## Practical Recommendation

**Start without a state machine.** Use simple `setState()` calls and the Command+State pattern. If you find yourself:

- Writing defensive checks like "wait, can we actually be in this state right now?"
- Debugging weird state combinations that shouldn't exist
- Managing complex entry/exit logic

...then add a state machine layer on top. It's easy to refactor into one later.

For most game scenarios, especially with the Command+State combination you're building, **the State pattern alone is sufficient and clearer**. The benefit of enforcing transitions isn't worth the extra complexity until you need it.