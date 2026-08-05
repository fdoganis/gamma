import { State } from "./State"
import { IGameContext } from './IGameContext'
import { Action } from "../input/Action"
import { ActionType } from "../input/ActionType"
import { GameOverState } from "./GameOverState"
import { GameIntroState } from "./GameIntroState"
import { Quaternion, Vector3 } from "three"

export class GameRunningState extends State {

  __vec: Vector3 = new Vector3();
  __quat: Quaternion = new Quaternion();

  enter(ctx: IGameContext) {
    // TODO: play main theme
    console.log("ENTER GameRunningState");
  }


  exit(ctx: IGameContext) {
    console.log("EXIT GameRunningState");
  }


  _isEmpty = (obj: Object) => Object.keys(obj).length === 0;



  // Right now, we are spawning cones on select
  handleAction(ctx: IGameContext, action: Action) {
    if (action.type === ActionType.AIM) {

      if (this._isEmpty(action.data)) {

        this.__vec.set((Math.random() - 0.5) * 2,
          Math.random() * 1.5 + 0.5,
          -Math.random() * 2 - 1);

        this.__quat.random();

      } else {
        // Real data has been stored, by SpatialInputSource for example

        // TODO: FIXME: CHECK: any way to avoid this ugly cast?
        // Should Action type be enforced?
        // In that case replace the isEmptyTest?
        // Or cast to a specific AIMAction dince we have tested the type?
        this.__vec.copy((action.data as Record<string, any>).position);
        this.__quat.copy((action.data as Record<string, any>).orientation);
      }

      // TODO: use action.data instead of random! See how input sources handle this properly
      ctx.spawnTarget(this.__vec, this.__quat); // TODO: CHECK: clone needed?

    } else if (action.type === ActionType.GAME_OVER) {
      ctx.changeState(new GameOverState());
    } else if (action.type === ActionType.START) {
      ctx.changeState(new GameIntroState());
    }
  }
}


