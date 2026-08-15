// Robert Penner's power eases
// Each takes t in [0,1] and returns an eased [0,1]
// They reshape the parameter a lerp receives, they don't replace the lerp itself.
export type Ease = (t: number) => number;

/* @__NO_SIDE_EFFECTS__ */
export const linear: Ease = (t) => t;

/* @__NO_SIDE_EFFECTS__ */
export const easeOutCubic: Ease = (t) => 1 - (1 - t) ** 3;

/* @__NO_SIDE_EFFECTS__ */
export const easeOutQuint: Ease = (t) => 1 - (1 - t) ** 5; // gsap's power4.out

/* @__NO_SIDE_EFFECTS__ */
export const easeOutBack: Ease = (t) => {
  const c1 = 1.70158, c3 = c1 + 1;
  return 1 + c3 * (t - 1) ** 3 + c1 * (t - 1) ** 2;
};