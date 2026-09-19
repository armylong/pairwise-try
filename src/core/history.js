// 撤销 / 重做栈（纯逻辑），超过深度丢弃最旧记录
export class History {
  constructor(limit = 80) {
    this.limit = limit;
    this.undoStack = [];
    this.redoStack = [];
  }

  execute(command, graph) {
    command.do(graph);
    this.undoStack.push(command);
    if (this.undoStack.length > this.limit) this.undoStack.shift();
    this.redoStack = [];
  }

  undo(graph) {
    const command = this.undoStack.pop();
    if (!command) return false;
    command.undo(graph);
    this.redoStack.push(command);
    return true;
  }

  redo(graph) {
    const command = this.redoStack.pop();
    if (!command) return false;
    command.do(graph);
    this.undoStack.push(command);
    if (this.undoStack.length > this.limit) this.undoStack.shift();
    return true;
  }

  canUndo() {
    return this.undoStack.length > 0;
  }

  canRedo() {
    return this.redoStack.length > 0;
  }

  clear() {
    this.undoStack = [];
    this.redoStack = [];
  }
}
