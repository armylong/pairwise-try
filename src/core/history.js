/**
 * 命令栈：每条命令实现 do()/redo 语义为 apply()，撤销为 revert()。
 * 栈深默认 100（需求要求 >= 50）。
 */
export class History {
  constructor(limit = 100) {
    this.limit = limit;
    this.undoStack = [];
    this.redoStack = [];
  }

  /** 执行并入栈 */
  exec(cmd) {
    cmd.apply();
    this.undoStack.push(cmd);
    if (this.undoStack.length > this.limit) this.undoStack.shift();
    this.redoStack.length = 0;
  }

  /** 已在外部应用过的命令，仅入栈（用于拖拽松手时提交） */
  pushApplied(cmd) {
    this.undoStack.push(cmd);
    if (this.undoStack.length > this.limit) this.undoStack.shift();
    this.redoStack.length = 0;
  }

  undo() {
    const cmd = this.undoStack.pop();
    if (!cmd) return false;
    cmd.revert();
    this.redoStack.push(cmd);
    return true;
  }

  redo() {
    const cmd = this.redoStack.pop();
    if (!cmd) return false;
    cmd.apply();
    this.undoStack.push(cmd);
    return true;
  }

  get canUndo() {
    return this.undoStack.length > 0;
  }

  get canRedo() {
    return this.redoStack.length > 0;
  }
}
