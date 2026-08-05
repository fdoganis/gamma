import { State } from "./State"
import { IGameContext } from './IGameContext'
import { Action } from "../input/Action"
import { ActionType } from "../input/ActionType"
import { GameRunningState } from "./GameRunningState"

export class GameOverState extends State {
  enter(ctx: IGameContext) {
    // TODO: show GameOver UI

    //ctx.activateAudio();
    // TODO: play game over tune

    console.log("ENTER GameOverState");
  }
  exit(ctx: IGameContext) {
    // TODO: hide GameOver UI
    // TODO: stop tune (unless it is already stopped when playing the next)
    console.log("EXIT GameOverState");
  }

  handleAction(ctx: IGameContext, action: Action) {
    if (action.type === ActionType.START) ctx.changeState(new GameRunningState())
  }
}