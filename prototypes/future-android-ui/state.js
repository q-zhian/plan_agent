const originalTasks = [
  {
    id: "review",
    time: "09:30",
    title: "回顾今天的安排",
    description: "确认优先事项与时间边界。",
    goal: "带着清晰次序开始一天",
  },
  {
    id: "focus",
    time: "11:00",
    title: "整理方案并写入今日日记",
    description: "把讨论后的决定压缩成可执行的下一步。",
    goal: "留下一条可继续推进的记录",
  },
  {
    id: "walk",
    time: "16:30",
    title: "散步与留白",
    description: "离开屏幕，给思考留出空白。",
    goal: "恢复注意力",
  },
];

const plannedTask = {
  id: "summary",
  time: "13:30",
  title: "发送行动摘要",
  description: "把上午整理出的下一步发送给协作方。",
  goal: "让今天的计划形成闭环",
};

export function createPrototypeState() {
  return {
    screen: "today",
    expandedTaskId: null,
    showPreview: false,
    planSaved: false,
    tasks: originalTasks,
  };
}

export function reducePrototypeState(state, action) {
  if (action.type === "toggle-task") {
    return {
      ...state,
      expandedTaskId: state.expandedTaskId === action.id ? null : action.id,
    };
  }

  if (action.type === "open-conversation") {
    return { ...state, screen: "conversation", showPreview: false };
  }

  if (action.type === "show-preview") {
    return { ...state, showPreview: true };
  }

  if (action.type === "save-plan") {
    return {
      ...state,
      screen: "today",
      showPreview: false,
      planSaved: true,
      expandedTaskId: null,
      tasks: [...state.tasks.slice(0, 2), plannedTask, ...state.tasks.slice(2)],
    };
  }

  if (action.type === "back-to-today") {
    return { ...state, screen: "today", showPreview: false };
  }

  return state;
}
