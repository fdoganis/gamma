import { State } from "./State"
import { IGameContext } from './IGameContext'
import { Action } from "../input/Action"
import { ActionType } from "../input/ActionType"
import { GameRunningState } from "./GameRunningState"

export class GameIntroState extends State {
  enter(ctx: IGameContext) {
    // TODO: show intro UI

    //ctx.activateAudio();
    // TODO: play intro tune

    console.log("ENTER GameIntroState");
  }


  exit(ctx: IGameContext) {
    // TODO: hide intro UI
    // TODO: stop intro tune (unless it is already stopped when playing the next)

    console.log("EXIT GameIntroState");

  }


  handleAction(ctx: IGameContext, action: Action) {
    if (action.type === ActionType.AIM) ctx.changeState(new GameRunningState())
  }
}