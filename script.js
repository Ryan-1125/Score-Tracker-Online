// ==========================================================================
// 【模块一：DOM 元素获取与核心全局状态】
// ==========================================================================

// 获取主应用页面上的基础 HTML DOM 元素，以便通过脚本控制它们的显示与内容
const registrationForm = document.getElementById('registrationForm');
const registrationError = document.getElementById('registrationError');
const countPanel = document.getElementById('countPanel');
const nicknamePanel = document.getElementById('nicknamePanel');
const playerCountInput = document.getElementById('playerCountInput');
const nextStepBtn = document.getElementById('nextStepBtn');
const backToCountBtn = document.getElementById('backToCountBtn');
const playerNameInputs = document.getElementById('playerNameInputs');
const gamePanel = document.getElementById('gamePanel');
const logsPanel = document.getElementById('logsPanel');
const playersGrid = document.getElementById('playersGrid');
const activePlayerInfo = document.getElementById('activePlayerInfo');
const logList = document.getElementById('logList');
const recordCount = document.getElementById('recordCount');
const resetBtn = document.getElementById('resetBtn');
const dialogOverlay = document.getElementById('dialogOverlay');
const dialogTitle = document.getElementById('dialogTitle');
const dialogMessage = document.getElementById('dialogMessage');
const dialogChoiceActions = document.getElementById('dialogChoiceActions');
const dialogConfirmActions = document.getElementById('dialogConfirmActions');
const dialogCancel = document.getElementById('dialogCancel');
const dialogConfirm = document.getElementById('dialogConfirm');
const chooseCancelBtn = document.getElementById('chooseCancelBtn');
const chooseRoomBtn = document.getElementById('chooseRoomBtn');
const chooseScoreBtn = document.getElementById('chooseScoreBtn');
const amountDialog = document.getElementById('amountDialog');
const amountDialogInput = document.getElementById('amountDialogInput');
const amountDialogCancel = document.getElementById('amountDialogCancel');
const amountDialogConfirm = document.getElementById('amountDialogConfirm');

// 获取底端轻量滑动通知容器元素
const toast = document.getElementById('toast');

// 获取顶部控制台的主题切换圆形按钮
const themeToggleBtn = document.getElementById('themeToggleBtn');

// 获取掷骰子弹窗及内部的骰子容器、摇骰按钮等
const diceBtn = document.getElementById('diceBtn');
const diceDialog = document.getElementById('diceDialog');
const dice1 = document.getElementById('dice1');
const dice2 = document.getElementById('dice2');
const rollDiceBtn = document.getElementById('rollDiceBtn');
const diceCancel = document.getElementById('diceCancel');

// 获取本局终极结算弹窗、确认卡片、排行榜滚动列表等
const settleBtn = document.getElementById('settleBtn');
const settleDialog = document.getElementById('settleDialog');
const settleConfirmCard = document.getElementById('settleConfirmCard');
const settleCancelBtn = document.getElementById('settleCancelBtn');
const settleConfirmBtn = document.getElementById('settleConfirmBtn');
const leaderboardCard = document.getElementById('leaderboardCard');
const leaderboardList = document.getElementById('leaderboardList');
const leaderboardCloseBtn = document.getElementById('leaderboardCloseBtn');

// 玩家数据、流水等信息的本地浏览器磁盘缓存键名 (LocalStorage Key)
const storageKey = 'mahjong-scoreboard-state';
// 皮肤主题（深色/浅色）的本地缓存键名
const themeStorageKey = 'mahjong-scoreboard-theme';

// 全局核心状态机：保存整局游戏所有运行中的数据，是整个应用的单一数据源
let state = {
  players: [],               // 玩家对象数组，如：[{id: "p1", name: "张三", score: 0}]
  selectedPlayerId: null,    // 当前处于选中状态的输家/出分人（actor）唯一 ID
  pendingTransferTargetId: null, // 当前处于等待输入金额状态的赢家/接收人唯一 ID
  logs: [],                  // 存放计分变动的历史流水记录对象数组
};

// 重置操作的临时状态标记
let pendingResetMode = null; // 标记用户点击了何种重置方式：'room'（整房重置） 或 'score'（仅清零分数）
let dialogStep = 'choose';   // 标记重置弹窗当前的渲染步骤：'choose'（选项选择步） 或 'confirm'（安全确认步）


// ==========================================================================
// 【模块二：主题（深浅皮肤）控制系统】
// ==========================================================================

// 主题切换辅助函数：根据参数决定将页面切换为高对比度白昼主题还是极简暗黑主题
function applyTheme(theme) {
  if (theme === 'light') {
    document.body.classList.add('light-theme');
    themeToggleBtn.textContent = '夜'; // 浅色（白昼）模式下，右上角按钮显示“夜”，提示可以切换回深色
  } else {
    document.body.classList.remove('light-theme');
    themeToggleBtn.textContent = '昼'; // 深色（暗黑）模式下，右上角按钮显示“昼”，提示可以切换回浅色
  }
}

// 皮肤环境自运行初始化：读取并应用上一次保存在磁盘里的主题记忆，默认是深色主题
let currentTheme = localStorage.getItem(themeStorageKey) || 'dark';
applyTheme(currentTheme);


// ==========================================================================
// 【模块三：全局轻量底端滑动通知（Toast）系统】
// ==========================================================================

// 控制悬浮提示卡片在屏幕底部滑出、滑入并自动倒计时消失的动效控制器
let toastTimeout = null;
function showToast(message) {
  // 清除上一次还未执行完的定时器，防止大拇指高频连续连点按钮时产生闪烁
  if (toastTimeout) {
    clearTimeout(toastTimeout);
  }
  toast.textContent = message;
  toast.classList.add('show'); // 挂载显示类名，激活 CSS 带物理阻尼曲线的滑入效果
  
  // 页面驻留 2.5 秒后自动向原路下滑并隐退
  toastTimeout = setTimeout(() => {
    toast.classList.remove('show');
    toastTimeout = null;
  }, 2500);
}


// ==========================================================================
// 【模块四：实体骰子渲染器（Unicode 渲染与红点着色）】
// ==========================================================================

// 骰子点数 1 至 6 所对应的 Unicode 物理骰子字符
const diceFaces = ['', '⚀', '⚁', '⚂', '⚃', '⚄', '⚅'];

// 根据生成的随机数值设置对应的骰子字符，并完美应用传统的红/黑着色规范（1、4点为鲜红色，其他点数为深灰/深蓝灰色）
function setDiceFace(el, val) {
  el.textContent = diceFaces[val];
  if (val === 1 || val === 4) {
    el.style.color = '#dc2626'; // 1和4是经典的红点
  } else {
    // 根据当前所处的皮肤主题，自适应展示低对比度灰或深黑灰色，保障极佳的可读性
    el.style.color = document.body.classList.contains('light-theme') ? '#1f2937' : '#111827';
  }
}


// ==========================================================================
// 【模块五：房间/分数重置弹窗业务流】
// ==========================================================================

// 控制重置选项弹窗在“选择重置方式”和“确认二次操作”两步之间进行切换渲染的逻辑
function updateDialogView() {
  if (dialogStep === 'choose') {
    dialogChoiceActions.classList.remove('hidden'); // 显示“重设分数”、“重设房间”选项按钮
    dialogConfirmActions.classList.add('hidden');    // 隐藏“确认/取消”确认按键
    return;
  }
  dialogChoiceActions.classList.add('hidden');       // 隐藏选项按钮
  dialogConfirmActions.classList.remove('hidden');    // 显示确认按键
}

// 安全关闭并完全退出重置弹窗，重置内部状态变量
function closeDialog() {
  dialogOverlay.classList.add('hidden');
  pendingResetMode = null;
  dialogStep = 'choose';
  updateDialogView();
}

// 唤起重置弹窗，并初始化首步的选项提示文字
function openResetDialog() {
  dialogTitle.textContent = '选择重置方式';
  dialogMessage.textContent = '重置房间会清空玩家的信息和分数；仅重置分数会保留玩家信息。';
  dialogCancel.textContent = '取消';
  dialogConfirm.textContent = '确认';
  pendingResetMode = null;
  dialogStep = 'choose';
  updateDialogView();
  dialogOverlay.classList.remove('hidden');
}

// 步骤分流控制器：当用户选定重置方向后，暂存选择状态并切换至第二步“最终安全确认”
function selectResetMode(mode) {
  pendingResetMode = mode;
  dialogStep = 'confirm';
  dialogTitle.textContent = mode === 'room' ? '确认重置房间' : '确认重置分数';
  dialogMessage.textContent = mode === 'room'
    ? '确定要重置整个房间吗？'
    : '确定要重置分数吗？';
  dialogCancel.textContent = '取消';
  dialogConfirm.textContent = '确认';
  updateDialogView();
}

// 重置最终确认按钮执行函数：根据保存的重置模式，执行对应的数据抹除计算
function confirmReset() {
  if (!pendingResetMode) {
    closeDialog();
    return;
  }

  // 模式一：彻底重置房间。清除所有运行数据并倒回至第一步“人数选择”首屏
  if (pendingResetMode === 'room') {
    state = { players: [], selectedPlayerId: null, pendingTransferTargetId: null, logs: [] };
    localStorage.removeItem(storageKey); // 抹除浏览器本地磁盘缓存
    registrationForm.reset();            // 彻底清空表单中残留的人名输入内容
    countPanel.classList.remove('hidden'); // 显示第一步
    nicknamePanel.classList.add('hidden'); // 隐藏后面所有面板
    gamePanel.classList.add('hidden');
    logsPanel.classList.add('hidden');
    renderLogs();                          // 重新生成清空状态下的空白界面
    renderPlayers();
  } 
  // 模式二：仅重设分数。保留所有玩家昵称和房间信息，只把积分彻底归零并抹除记账历史日志
  else if (pendingResetMode === 'score') {
    if (state.players.length) {
      state.players = state.players.map((player) => ({ ...player, score: 0 }));
      state.logs = [];
      state.selectedPlayerId = null;
      state.pendingTransferTargetId = null;
      saveState(); // 同步保存数据并写入浏览器缓存
      render();    // 进行一轮全局界面重渲染
    }
  }

  closeDialog(); // 执行关闭退出
}


// ==========================================================================
// 【模块六：大厅人数设定、动态框渲染与名字注册业务流】
// ==========================================================================

// 根据用户微调选择的参与总人数，实时、安全、自适应地在页面生成对应数量的昵称输入文本框
function renderPlayerNameInputs() {
  const count = Math.max(2, Math.min(8, Number(playerCountInput.value) || 4)); // 强制限制人数在 2 - 8 人范围内
  playerCountInput.value = count;
  playerNameInputs.innerHTML = ''; // 渲染前清除上一次缓存生成的输入框

  for (let index = 0; index < count; index += 1) {
    const label = document.createElement('label');
    label.innerHTML = `
      玩家${index + 1}
      <input type="text" name="player${index + 1}" placeholder="输入昵称" maxlength="8" />
    `;
    playerNameInputs.appendChild(label);
  }
}

// 界面切换：从“人数选择”第一步切换至“输入名字”第二步
function showNicknameStep() {
  renderPlayerNameInputs();
  countPanel.classList.add('hidden');
  nicknamePanel.classList.remove('hidden');
}

// 界面反向退回：从“输入名字”退回到“人数选择”
function showCountStep() {
  countPanel.classList.remove('hidden');
  nicknamePanel.classList.add('hidden');
}

// 开始记分表单验证：深度校验输入框合法性并正式将玩家注册进入状态机
function registerPlayers(event) {
  event.preventDefault(); // 阻止表单默认的提交刷新网页行为

  const formData = new FormData(registrationForm); // 实时读取并封装表单数据
  const count = Math.max(2, Math.min(8, Number(playerCountInput.value) || 4));
  const names = Array.from({ length: count }, (_, index) => {
    const value = String(formData.get(`player${index + 1}`) || '').trim();
    return value;
  });

  // 校验一：任何一位参与玩家的昵称都不允许留空
  const emptyIndex = names.findIndex((name) => !name);
  if (emptyIndex !== -1) {
    showToast(`玩家${emptyIndex + 1} 昵称不能为空。`); // 直接触发底部轻量向滑出通知提示
    return;
  }

  const filteredNames = names.filter(Boolean);

  // 校验二：确保已输入姓名个数与设定的总人数严格对齐
  if (filteredNames.length !== count) {
    showToast(`请完整填写 ${count} 位玩家昵称。`);
    return;
  }

  // 校验三：玩家昵称不允许发生重复冲突（否则算账流水将无法区分）
  const uniqueNames = [...new Set(filteredNames)];
  if (uniqueNames.length !== count) {
    showToast('昵称不能重复。');
    return;
  }

  // 验证无误，将所有人正式注册，初始化各自底分积分为 0 并派发唯一 ID 标识
  state.players = names.map((name, index) => ({
    id: `p${index + 1}`,
    name,
    score: 0,
  }));
  state.selectedPlayerId = null;
  state.logs = []; // 属于该新房间的新流水日志初始化
  saveState();     // 写入浏览器缓存

  // 界面状态流转：隐藏准备阶段大厅，亮起打牌过程控制台及账目历史
  countPanel.classList.add('hidden');
  nicknamePanel.classList.add('hidden');
  gamePanel.classList.remove('hidden');
  logsPanel.classList.remove('hidden');
  render(); // 进行首次全局界面渲染
}


// ==========================================================================
// 【模块七：本地磁盘缓存（LocalStorage）读取与同步】
// ==========================================================================

// 从浏览器磁盘中读取之前可能由于刷新、关闭标签页而保存的历史现场状态，保证体验连贯性
function loadState() {
  try {
    const raw = localStorage.getItem(storageKey);
    if (!raw) return;

    const parsed = JSON.parse(raw);
    // 严格校验缓存取出的格式合法性，确保无损后覆盖内存中的运行时状态 state
    if (parsed && Array.isArray(parsed.players) && Array.isArray(parsed.logs)) {
      state = {
        players: parsed.players,
        selectedPlayerId: parsed.selectedPlayerId || null,
        logs: parsed.logs,
      };
    }
  } catch (error) {
    console.warn('读取本地存储失败，已忽略。', error);
  }
}

// 核心同步机：将当前内存中的运行时状态 state 同步写入浏览器磁盘存储中
function saveState() {
  localStorage.setItem(storageKey, JSON.stringify(state));
}

// 唤起重置弹窗操作
function resetRoom() {
  openResetDialog();
}

// ==========================================================================
// 【模块八：出分与转分核心算账逻辑】
// ==========================================================================

// 执行一次分数流转：从“出分人（actor）”向“目标接收人（target）”转移指定的积分数值
function transferScore(targetId, amount) {
  if (!state.players.length) return;

  // 1) 抓取出分人对象
  const actor = state.players.find((player) => player.id === state.selectedPlayerId);
  if (!actor) {
    state.selectedPlayerId = null;
    render();
    return;
  }

  // 2) 抓取目标接收人（赢家）对象，防止出现自己转给自己等非法操作
  const target = state.players.find((player) => player.id === targetId);
  if (!target || target.id === actor.id) return;

  // 3) 执行核心数学计算：出分人扣分，接收人加分
  actor.score -= amount;
  target.score += amount;

  // 4) 生成符合当前系统时区规范的交易发生时间戳文字
  const now = new Date();
  const timestamp = now.toLocaleString('zh-CN', {
    hour12: false,
  });

  // 5) 创建一笔账单流水记录，并将该记录推至流水链表的最顶端 (unshift)
  state.logs.unshift({
    id: `${now.getTime()}`, // 使用时间戳毫秒数作为日志的物理主键和排序权重
    timestamp,
    from: actor.name,
    to: target.name,
    amount,
    fromScore: actor.score,
    toScore: target.score,
  });

  // 6) 流水流转完成，安全重置临时选人状态，保存最新的 state 并重新调度界面渲染
  state.selectedPlayerId = null;
  state.pendingTransferTargetId = null;
  saveState();
  render();
}

// 主交互控制器：控制游戏主控板上所有玩家卡片的点按状态轮转
function selectPlayer(playerId) {
  if (!state.players.length) return;

  // 情况一：如果点击的是当前已经是高亮的“出分人”，则视为反选，取消高亮并关闭提示
  if (state.selectedPlayerId === playerId) {
    state.selectedPlayerId = null;
    render();
    return;
  }

  // 情况二：如果之前已经选定了一位出分人，这一次点击另一位玩家，说明这第二个人是“接收人”，弹出输分金额输入弹窗
  if (state.selectedPlayerId) {
    state.pendingTransferTargetId = playerId; // 暂存目标接收人 ID
    amountDialogInput.value = '1';            // 转分输入框默认初值置为 1 分
    amountDialog.classList.remove('hidden');  // 滑出输入框遮罩层
    amountDialogInput.focus();                // 自动将焦点投入输入框，方便用户直接打字
  } else {
    // 情况三：第一次点击卡片，将此玩家设为“出分人”高亮显示
    state.selectedPlayerId = playerId;
    render();
  }
}


// ==========================================================================
// 【模块九：动态渲染引擎 - 玩家名片与排行榜】
// ==========================================================================

// 玩家卡片渲染模块：根据内存中的最新玩家数据，动态重构并挂载 HTML 玩家卡片网格
function renderPlayers() {
  playersGrid.innerHTML = '';

  if (!state.players.length) {
    playersGrid.innerHTML = '<p class="tips">登记四位玩家后即可开始计分。</p>';
    return;
  }

  // 找到当前全场的最高分，只有当最高分唯一（非并列）时，才触发戴皇冠逻辑
  const maxScore = Math.max(...state.players.map(p => p.score));
  const highestScorePlayers = state.players.filter(p => p.score === maxScore);
  const hasUniqueWinner = highestScorePlayers.length === 1;

  const frag = document.createDocumentFragment(); // 使用文档碎片提升 DOM 批量挂载性能
  state.players.forEach((player) => {
    const card = document.createElement('button');
    card.className = 'player-card';
    if (state.selectedPlayerId === player.id) {
      card.classList.add('active'); // 出分人亮黄框样式
    }

    const scoreClass = player.score < 0 ? 'score-negative' : 'score-positive'; // 积分红/绿分色
    
    // 只有当场上有唯一大赢家，且循环遍历到该赢家时，才在其右上角渲染皇冠 👑
    const crownIcon = hasUniqueWinner && player.id === highestScorePlayers[0].id 
      ? '<span class="crown-icon">👑</span>' 
      : '';
    
    // 提取玩家昵称的首字符（采用 Array.from 避免多字节复杂 Emoji 首字母截取出现乱码）
    const firstChar = Array.from(player.name)[0];
    
    card.innerHTML = `
      ${crownIcon}
      <div class="avatar">${firstChar}</div>
      <div class="player-info">
        <strong>${player.name}</strong>
        <span class="score-badge ${scoreClass}">积分 ${player.score}</span>
      </div>
    `;

    // 绑定点按事件
    card.addEventListener('click', () => {
      selectPlayer(player.id);
    });

    frag.appendChild(card);
  });

  playersGrid.appendChild(frag);
}

// 排行榜生成模块：在点击结算并生成最终对账单时，计算并列名次、输赢家勋章并横向渲染榜单
function renderLeaderboard() {
  leaderboardList.innerHTML = '';
  
  // 1) 深拷贝一份玩家数组并按分数进行降序排序
  const sorted = [...state.players].sort((a, b) => b.score - a.score);
  
  // 2) 确定场上的最高分与最低分，若全场同分，说明都是第一名，则不显示皇冠或小丑
  const maxScore = Math.max(...sorted.map(p => p.score));
  const minScore = Math.min(...sorted.map(p => p.score));
  const hasScoreVariance = maxScore > minScore;

  let displayRank = 1; // 当前正在展示的名次序数
  
  sorted.forEach((player, index) => {
    // 3) 并列判定：如果跟前一个人分数相同，名次并列保持不变；否则名次递增为 index + 1
    if (index > 0 && player.score < sorted[index - 1].score) {
      displayRank = index + 1;
    }
    
    const card = document.createElement('div');
    card.className = 'leaderboard-item';
    
    // 4) 输赢家勋章：最高分获得皇冠 👑，最低分领到小丑 🤡
    let badgeIcon = '';
    if (hasScoreVariance) {
      if (player.score === maxScore) {
        badgeIcon = '<span class="leaderboard-badge-icon">👑</span>';
      } else if (player.score === minScore) {
        badgeIcon = '<span class="leaderboard-badge-icon">🤡</span>';
      }
    }
    
    const scoreClass = player.score < 0 ? 'score-negative' : 'score-positive';
    const firstChar = Array.from(player.name)[0];
    
    card.innerHTML = `
      <div class="leaderboard-rank">第 ${displayRank} 名</div>
      <div class="avatar leaderboard-avatar">${firstChar}</div>
      <div class="leaderboard-info">
        <strong>${player.name}</strong>
        <div class="leaderboard-score-group">
          ${badgeIcon}
          <span class="score-badge ${scoreClass}">积分 ${player.score}</span>
        </div>
      </div>
    `;
    
    leaderboardList.appendChild(card);
  });
}


// ==========================================================================
// 【模块十：高级账目日志归组与分析】
// ==========================================================================

// 流水记录渲染器：提取所有对账日志，进行 1 分钟时差智能归组并逆序展示
function renderLogs() {
  if (!state.logs.length) {
    logList.innerHTML = '<li class="log-item">暂无积分记录</li>';
    recordCount.textContent = '0 条记录';
    return;
  }

  logList.innerHTML = '';

  // 1) 归组阶段：将发生时间相差在 60 秒内的一笔或多笔积分变动，合并为同一个卡片分组
  const groups = [];
  let currentGroup = [];

  state.logs.forEach((entry, index) => {
    if (currentGroup.length === 0) {
      currentGroup.push(entry);
    } else {
      const firstEntry = currentGroup[0];
      const firstTime = parseInt(firstEntry.id);
      const currentTime = parseInt(entry.id);
      const timeDiff = firstTime - currentTime; // 计算时差

      if (timeDiff <= 60000) { // 时差 <= 1 分钟，强行归入本合并组
        currentGroup.push(entry);
      } else {
        groups.push(currentGroup); // 结束旧分组
        currentGroup = [entry];    // 开启新分组
      }
    }
  });

  if (currentGroup.length > 0) {
    groups.push(currentGroup);
  }

  // 2) 累计流水快照计算阶段：从时间线最底端的古老日志开始正向推演，推算每个合并卡片节点结束时，所有人对应的阶段积分线
  const playerScoresSnapshots = []; 
  let runningScores = {};
  state.players.forEach((p) => (runningScores[p.name] = 0)); // 临时累计记账账本

  let groupIndex = 0;
  state.logs.forEach((log) => {
    runningScores[log.from] -= log.amount;
    runningScores[log.to] += log.amount;

    if (groupIndex < groups.length) {
      const group = groups[groupIndex];
      const lastLogInGroup = group[group.length - 1];
      if (log.id === lastLogInGroup.id) {
        playerScoresSnapshots[groupIndex] = { ...runningScores }; // 在合并节点的末尾留底一份全员分数快照
        groupIndex++;
      }
    }
  });

  // 3) HTML 拼接渲染输出
  groups.forEach((group, index) => {
    const item = document.createElement('li');
    item.className = 'log-item';

    // 截取掉具体秒数，仅展示发生年月日的具体分值，界面排版更清秀
    const firstEntry = group[0];
    const timeStr = firstEntry.timestamp.substring(0, firstEntry.timestamp.lastIndexOf(':'));

    const scoresAtEnd = playerScoresSnapshots[index] || {};

    // 罗列该合并卡片内部发生的所有交易（如：玩家A → 玩家B 10分）
    const transfersHtml = group
      .map((entry) => {
        return `<div class="transfer-item">
          <span class="transfer-text">${entry.from} → ${entry.to}</span>
          <span class="transfer-amount">${entry.amount}分</span>
        </div>`;
      })
      .join('');

    // 渲染该时间节点发生时，全员的积分总榜（如当前：张三 10分，李四 -10分）
    const scoresHtml = state.players
      .map((player) => {
        const score = scoresAtEnd[player.name] || 0;
        const scoreClass = score < 0 ? 'score-negative' : 'score-positive';
        return `<span class="current-score-text">${player.name} <span class="${scoreClass}">${score}</span> 分</span>`;
      })
      .join('，');

    item.innerHTML = `
      <div class="log-meta">
        <span>${timeStr}</span>
      </div>
      <div class="transfer-group">${transfersHtml}</div>
      <div class="current-scores">当前：${scoresHtml}</div>
    `;
    logList.appendChild(item);
  });

  recordCount.textContent = `${state.logs.length} 条记录`;
}


// ==========================================================================
// 【模块十一：主渲染总调度器】
// ==========================================================================

// 全局协调器：统合玩家卡片重渲染、历史流水重渲染，并实时同步更新最上方的选人文字提示
function render() {
  renderPlayers();
  renderLogs();

  if (state.selectedPlayerId) {
    const selected = state.players.find((player) => player.id === state.selectedPlayerId);
    activePlayerInfo.textContent = selected ? `当前出分人：${selected.name}` : '请选择出分人';
  } else {
    activePlayerInfo.textContent = '请选择出分人';
  }
}


// ==========================================================================
// 【模块十二：全局事件监听挂载区】
// ==========================================================================

// --- 1) 大厅准备登记阶段事件 ---
registrationForm.addEventListener('submit', registerPlayers); // 登记名字表单提交
nextStepBtn.addEventListener('click', showNicknameStep);     // 选择人数点“下一步”
backToCountBtn.addEventListener('click', showCountStep);     // 填写昵称点“上一步”
playerCountInput.addEventListener('input', renderPlayerNameInputs); // 人数框数值改变

// --- 2) 重置选项对话框事件 ---
resetBtn.addEventListener('click', resetRoom);                // 顶部“清”按钮唤起重置
chooseCancelBtn.addEventListener('click', closeDialog);       // 选项第一步点“取消”
chooseRoomBtn.addEventListener('click', () => selectResetMode('room'));   // 选项点“重置房间”
chooseScoreBtn.addEventListener('click', () => selectResetMode('score')); // 选项点“重置分数”
dialogCancel.addEventListener('click', closeDialog);          // 二次确认点“取消”
dialogConfirm.addEventListener('click', confirmReset);        // 二次确认点“确认”
dialogOverlay.addEventListener('click', (event) => {          // 点击弹窗黑边遮罩层空白关闭
  if (event.target === dialogOverlay) {
    closeDialog();
  }
});

// --- 3) 转分弹窗及输入事件 ---
amountDialogCancel.addEventListener('click', () => {          // 点击转分“取消”
  state.selectedPlayerId = null;
  state.pendingTransferTargetId = null;
  amountDialog.classList.add('hidden');
  render();
});
amountDialogConfirm.addEventListener('click', () => {         // 点击转分“确认”
  if (state.pendingTransferTargetId) {
    const amount = Math.max(1, Number(amountDialogInput.value) || 1);
    transferScore(state.pendingTransferTargetId, amount);
  }
  amountDialog.classList.add('hidden');
});
amountDialog.addEventListener('click', (event) => {           // 点击转分空白遮罩层取消退出
  if (event.target === amountDialog) {
    state.selectedPlayerId = null;
    state.pendingTransferTargetId = null;
    amountDialog.classList.add('hidden');
    render();
  }
});
amountDialogInput.addEventListener('keypress', (event) => {   // 转分输入框直接点键盘“回车”快速确认
  if (event.key === 'Enter') {
    amountDialogConfirm.click();
  }
});

// --- 4) 极简主题控制台事件 ---
themeToggleBtn.addEventListener('click', () => {              // 点击顶部“昼/夜”圆形按钮切换主题皮肤并存入磁盘
  currentTheme = currentTheme === 'dark' ? 'light' : 'dark';
  localStorage.setItem(themeStorageKey, currentTheme);
  applyTheme(currentTheme);
});

// --- 5) 掷骰子弹窗及高速翻滚震动物理事件 ---
diceBtn.addEventListener('click', () => {                     // 点击顶部“骰”按钮唤起弹窗，默认置为双 1 点
  diceDialog.classList.remove('hidden');
  setDiceFace(dice1, 1);
  setDiceFace(dice2, 1);
});
diceCancel.addEventListener('click', () => {                  // 点击“关闭”隐藏弹窗
  diceDialog.classList.add('hidden');
});
diceDialog.addEventListener('click', (event) => {             // 点击遮罩层空白关闭
  if (event.target === diceDialog) {
    diceDialog.classList.add('hidden');
  }
});

// 掷骰子物理翻滚摇晃动画与网页端手机震动实现
let isRolling = false; // 动画锁状态：防止用户在动画播放期间疯狂重复点击导致计时器混乱
rollDiceBtn.addEventListener('click', () => {
  if (isRolling) return;
  isRolling = true;

  // 1) 挂载 CSS 摇晃类，使骰子卡片产生强烈的物理振动和角度抖动
  dice1.classList.add('rolling');
  dice2.classList.add('rolling');
  rollDiceBtn.disabled = true;
  rollDiceBtn.textContent = '开！！';

  let rollsCount = 0;
  // 2) 开启高速定时器：每 80 毫秒快速重置随机数点数，完美还原骰子在碗里高速旋转碰撞的真实效果
  const interval = setInterval(() => {
    const temp1 = Math.floor(Math.random() * 6) + 1;
    const temp2 = Math.floor(Math.random() * 6) + 1;
    setDiceFace(dice1, temp1);
    setDiceFace(dice2, temp2);
    
    // 📢 新增：网页端每次骰子在摇晃变幻点数时，手机轻微颤动一下（20毫秒）
    if (navigator.vibrate) {
      navigator.vibrate(20);
    }

    rollsCount++;
    // 快速幻化 10 次（总计大约 800 毫秒的物理滚动时间）后停止
    if (rollsCount > 10) {
      clearInterval(interval);

      // 3) 生成最终的纯随机数结果
      const finalVal1 = Math.floor(Math.random() * 6) + 1;
      const finalVal2 = Math.floor(Math.random() * 6) + 1;
      setDiceFace(dice1, finalVal1);
      setDiceFace(dice2, finalVal2);

      // 骰子定格的一瞬间，手机中度震动一下（150毫秒），给玩家一个清脆的大结局物理反馈
      if (navigator.vibrate) {
        navigator.vibrate(150);
      }

      // 4) 摇晃动画结束，移除 CSS 摇晃类，恢复按钮可用状态
      dice1.classList.remove('rolling');
      dice2.classList.remove('rolling');
      isRolling = false;
      rollDiceBtn.disabled = false;
      rollDiceBtn.textContent = '掷骰子';
    }
  }, 80);
});

// --- 6) 本局最终结算及排行榜事件 ---
settleBtn.addEventListener('click', () => {                   // 点击顶部“结”按钮唤起结算（防呆警告）
  if (!state.players.length) {
    showToast('请先创建房间。'); // 大厅或登记昵称未进入房间时，从底部滑出轻量通知警告
    return;
  }
  settleDialog.classList.remove('hidden');
  settleConfirmCard.classList.remove('hidden');
  leaderboardCard.classList.add('hidden');
});
settleCancelBtn.addEventListener('click', () => {             // 结算询问点“取消”
  settleDialog.classList.add('hidden');
});
settleConfirmBtn.addEventListener('click', () => {            // 结算询问点“确定”，正式生成并渲染并列排行榜
  renderLeaderboard();
  settleConfirmCard.classList.add('hidden');
  leaderboardCard.classList.remove('hidden');
});
leaderboardCloseBtn.addEventListener('click', () => {         // 榜单最下方“确认”点按：一键将全员分数清空，重置本局数据并退出弹窗
  state.players = state.players.map((player) => ({ ...player, score: 0 }));
  state.logs = [];
  state.selectedPlayerId = null;
  state.pendingTransferTargetId = null;
  saveState();
  render();
  settleDialog.classList.add('hidden');
});


// ==========================================================================
// 【模块十三：页面首次加载自运行逻辑】
// ==========================================================================

// 自启动加载：率先读取历史缓存
loadState();
// 如果检测到历史打牌房间存在（players有元素）
if (state.players.length) {
  // 直接跃过注册与准备大厅，直接亮起游戏记分控制面板
  countPanel.classList.add('hidden');
  nicknamePanel.classList.add('hidden');
  gamePanel.classList.remove('hidden');
  logsPanel.classList.remove('hidden');
  render(); // 执行一轮全局重渲染
} else {
  // 如果是全新的局，则初始化首屏，展示第一步“选择人数”
  countPanel.classList.remove('hidden');
  nicknamePanel.classList.add('hidden');
  gamePanel.classList.add('hidden');
  logsPanel.classList.add('hidden');
}