
import type { IGameContext } from './IGameContext'
import type { Action } from '../input/Action'

export class State {
  enter(game: IGameContext) { }
  handleAction(game: IGameContext, action: Action) { }
  update(game: IGameContext, delta: number) { }
  exit(game: IGameContext) { }
}