import { ActionType } from "./ActionType";
export class Action {
  type: Symbol = ActionType.GAME_OVER;
  data: Object = {}; // optional extra data required by some actions

  constructor(type: Symbol, data: Object = {}) {
    this.type = type;
    this.data = data;
  }

}