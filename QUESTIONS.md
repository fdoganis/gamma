- arScreen does not work, HandInput does not work either : pinch or tap on screen don't spawn cones

- GamepadInputSource

QUESTION: why not listening to gamepadconnected events? why the findXRGamepad?
// How generic is this?

- InputManager

Why all these casts? 

ctrlL as unknown as IXRNode,


SpatialInputSource, or a SpatialControllerInputSource should own a Gamepad? 
Gamepad should be standalone and exposed so that we can remap the buttons?
We should be able to connect as many gamepads as possible (Desktop mode / couch multiplayer)



The default WebXR 'select' command is generic, cross platform, cross device, now we need to make it explicit again?
Just listening to 'select' allowed the code to work on pichm on tap, on trigger. Now we need many classes, events, routing and dispatching.
Is there a way to bin a command to an event like WebXR 'select'?
