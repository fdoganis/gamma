// DEV-only runtime switches the ?tweak panel flips. Every reader guards with
// `__DEV__ &&`, so in a production build the reference short-circuits away and
// this module tree-shakes out (0 bytes shipped).
export const devFlags = {
  pauseTimer: false, // RunState skips the countdown decrement while true
};
