import { createPrototypeState, reducePrototypeState } from "./state.js";

const root = document.querySelector("#prototype");
let state = createPrototypeState();

const bubbleIcon = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 18.2 3.8 21l3.3-1.1c1.3.7 2.9 1.1 4.9 1.1 4.8 0 8.2-2.8 8.2-7s-3.4-7-8.2-7-8.2 2.8-8.2 7c0 1.5.5 2.9 1.4 4.2Z"/><path d="M8.2 14h7.6"/></svg>`;
const backIcon = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m14.8 5.8-6.1 6.2 6.1 6.2"/></svg>`;
const chevronIcon = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m9 7 5 5-5 5"/></svg>`;
const sendIcon = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m4 4 16 8-16 8 3.6-8L4 4Z"/><path d="M7.6 12H20"/></svg>`;

function todayLabel() {
  const date = new Date();
  const weekdays = ["星期日", "星期一", "星期二", "星期三", "星期四", "星期五", "星期六"];
  return `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日 · ${weekdays[date.getDay()]}`;
}

function renderTask(task) {
  const expanded = state.expandedTaskId === task.id;
  const isCurrent = task.id === "focus";
  return `<article class="timeline-row ${expanded ? "is-expanded" : ""} ${isCurrent ? "is-current" : ""}">
    <time>${task.time}</time>
    <div class="timeline-rail"><span class="timeline-node"></span></div>
    <div class="task-content">
      <button class="task-trigger" data-action="toggle-task" data-id="${task.id}" aria-expanded="${expanded}">
        <span>${task.title}</span><span class="chevron ${expanded ? "is-open" : ""}">${chevronIcon}</span>
      </button>
      ${expanded ? `<div class="task-details"><p>${task.description}</p><p><strong>目标</strong>${task.goal}</p></div>` : ""}
    </div>
  </article>`;
}

function renderToday() {
  return `<section class="phone today-screen">
    <header class="today-header">今天 · ${todayLabel()}</header>
    ${state.planSaved ? `<p class="outcome-line">已写入今日日记</p>` : ""}
    <div class="timeline">${state.tasks.map(renderTask).join("")}</div>
    <button class="agent-entry" data-action="open-conversation" aria-label="打开对话">${bubbleIcon}</button>
  </section>`;
}

function agentMessage() {
  return `<div class="message-group agent-group">
    <span class="agent-marker" aria-label="Agent">∷</span>
    <div><p class="message">上午的重点已经很清楚。要不要把后续行动整理成今天的计划？</p></div>
  </div>`;
}

function userMessage() {
  return `<div class="message-group user-group">
    <div><p class="message">可以，保留下午的留白时间。</p></div>
    <span class="user-marker" aria-label="用户">你</span>
  </div>`;
}

function previewTrigger() {
  return `<div class="preview-prompt"><p>我会补上一项下午的行动，并保留留白时间。</p><button class="quiet-action" data-action="show-preview">生成计划预览</button></div>`;
}

function planPreview() {
  return `<section class="plan-preview" aria-label="计划预览">
    <p class="preview-label">计划预览</p>
    <h2>今天下午</h2>
    <div class="preview-row"><span>13:30</span><span>发送行动摘要</span></div>
    <div class="preview-row"><span>16:30</span><span>散步与留白</span></div>
    <button class="primary-action" data-action="save-plan">保存并回到今天</button>
    <button class="quiet-action" data-action="hide-preview">继续调整</button>
  </section>`;
}

function composer() {
  return `<form class="composer" onsubmit="return false"><input aria-label="输入消息" placeholder="输入消息" /><button type="button" aria-label="发送">${sendIcon}</button></form>`;
}

function renderConversation() {
  return `<section class="phone conversation-screen">
    <header class="conversation-header"><button class="back-button" data-action="back-to-today" aria-label="返回">${backIcon}</button><span>对话</span></header>
    <p class="date-separator">${todayLabel()}</p>
    <div class="messages">${agentMessage()}${userMessage()}${state.showPreview ? planPreview() : previewTrigger()}</div>
    ${composer()}
  </section>`;
}

function render() {
  root.innerHTML = state.screen === "today" ? renderToday() : renderConversation();
}

root.addEventListener("click", (event) => {
  const target = event.target.closest("[data-action]");
  if (!target) return;
  const type = target.dataset.action === "hide-preview" ? "show-preview" : target.dataset.action;
  state = reducePrototypeState(state, { type, id: target.dataset.id });
  if (target.dataset.action === "hide-preview") state = { ...state, showPreview: false };
  render();
});

render();
