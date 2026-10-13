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
const countBackBtn = document.getElementById('countBackBtn');
const roomBackBtn = document.getElementById('roomBackBtn');
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
let amountReplaceNext = true;
const avatarColors = [['随机',''],['珊瑚','#a54949'],['陶土','#a66b58'],['琥珀','#b66b32'],['奶茶','#a18b72'],['麦黄','#9a9255'],['橄榄','#85865e'],['鼠尾草','#748b75'],['松绿','#357960'],['烟青','#608e89'],['青蓝','#497f88'],['雾蓝','#69869c'],['海蓝','#3b72b8'],['暮紫','#706c91'],['紫罗兰','#8056ad'],['薰衣草','#8e7c9f'],['玫瑰','#ba5076']];
let editingLocalPlayerId = null;

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

const createRoomBtn = document.getElementById('createRoomBtn');
const joinRoomBtn = document.getElementById('joinRoomBtn');
const joinRoomCodeInput = document.getElementById('joinRoomCodeInput');
const roomInfoBox = document.getElementById('roomInfoBox');
const roomStatusText = document.getElementById('roomStatusText');
const modePanel = document.getElementById('modePanel');
const roomPanel = document.getElementById('roomPanel');
const localModeBtn = document.getElementById('localModeBtn');
const onlineModeBtn = document.getElementById('onlineModeBtn');
const profileNameInput = document.getElementById('profileNameInput');
const profileAvatar = document.getElementById('profileAvatar');
// 玩家数据、流水等信息的本地浏览器磁盘缓存键名 (LocalStorage Key)
const storageKey = 'mahjong-scoreboard-state';
const onlineStorageKey = 'mahjong-scoreboard-online';
// 皮肤主题（深色/浅色）的本地缓存键名
const modeStorageKey = 'mahjong-scoreboard-mode';
const themeStorageKey = 'mahjong-scoreboard-theme';

const socketAvailable = Boolean(window.io);
const socket = socketAvailable ? window.io() : {
  on: () => {},
  emit: () => {},
};

// 全局核心状态机：保存整局游戏所有运行中的数据，是整个应用的单一数据源
let state = {
  players: [],               // 玩家对象数组，如：[{id: "p1", name: "张三", score: 0}]
  selectedPlayerId: null,    // 当前处于选中状态的输家/出分人（actor）唯一 ID
  pendingTransferTargetId: null, // 当前处于等待输入金额状态的赢家/接收人唯一 ID
  logs: [],                  // 存放计分变动的历史流水记录对象数组
};

let sessionToken = loadOnlineState()?.token || null;
let selfPlayerId = loadOnlineState()?.playerId || null;
let transferPending = false;
// Request IDs do not authenticate players. The fallback also works over LAN HTTP.
function makeRequestId() { return typeof globalThis.crypto?.randomUUID === 'function' ? globalThis.crypto.randomUUID() : Date.now() + '-' + Math.random().toString(36).slice(2) + '-' + Math.random().toString(36).slice(2); }
function escapeHtml(value) { return String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }

let roomInfo = {
  roomCode: null,
  hostName: null,
  isHost: false,
  connected: false,
};

let currentMode = sessionStorage.getItem(modeStorageKey) || localStorage.getItem(modeStorageKey) || 'idle';

function syncProfilePreview() {
  const name = (profileNameInput.value || '').trim();
  const firstChar = Array.from(name)[0] || '?';
  const avatar = document.getElementById('profileAvatarSelect').value;
  profileAvatar.innerHTML = avatarGraphic(avatar === '昵称' ? firstChar : avatar);
  profileAvatar.style.background = avatarGradient(document.getElementById('profileAvatarColor').value || 'var(--panel-2)');
  profileAvatar.style.color = document.getElementById('profileAvatarColor').value ? '#fff' : 'var(--text)';
  syncAvatarSelection('profileAvatarSelect');
}

function setConnectionStatus(text, stateType) {
  roomStatusText.textContent = text;
  roomStatusText.style.visibility = 'visible';
  roomStatusText.dataset.state = stateType || '';
  const copyable = currentMode === 'online' && Boolean(roomInfo.roomCode);
  roomStatusText.classList.toggle('copy-room-status', copyable);
  if (copyable) { roomStatusText.setAttribute('role', 'button'); roomStatusText.tabIndex = 0; roomStatusText.title = '点击复制房间号'; }
  else { roomStatusText.removeAttribute('role'); roomStatusText.removeAttribute('tabindex'); roomStatusText.removeAttribute('title'); }
}

function setRoomActionLoading(action, isLoading) {
  const button = action === 'create' ? createRoomBtn : joinRoomBtn;
  button.classList.toggle('motion-loading', isLoading);
  button.setAttribute('aria-busy', String(isLoading));
  if (action === 'create') {
    createRoomBtn.disabled = isLoading;
    createRoomBtn.textContent = isLoading ? '创建中...' : '创建房间';
  } else if (action === 'join') {
    joinRoomBtn.disabled = isLoading;
    joinRoomBtn.textContent = isLoading ? '加入中...' : '加入房间';
  }
}

function normalizeRoomCode(code) {
  // 只保留数字并截取前 4 位（确保输入框仅显示数字）
  return String(code).replace(/\D/g, '').slice(0, 4);
}

function updateRoomInfoBox() {
  if (!roomInfo.roomCode) {
    roomInfoBox.classList.add('hidden');
    return;
  }

  const modeText = currentMode === 'online' ? '联机模式' : '本地模式';
  const hostText = roomInfo.isHost ? '你是房主' : '你不是房主，无法重置房间';
  const playerText = state.players.map((player) => player.name).join('，') || '无玩家';
  let detailHtml = '';

  if (currentMode === 'online') {
    detailHtml = `
      <p class="room-info-line">房间号：<strong>${roomInfo.roomCode}</strong></p>
      <p class="room-info-line">${roomInfo.isHost ? '你是房主' : '普通玩家'}</p>
      <p class="room-info-line">当前玩家：${escapeHtml(playerText)}</p>
    `;
  } else {
    detailHtml = `<p class="room-info-line">${modeText}</p>`;
  }

  roomInfoBox.innerHTML = detailHtml;
  roomInfoBox.classList.remove('hidden');
}

function isValidRoomCode(value) {
  // 仅接受 4 位数字房间码
  return /^[0-9]{4}$/.test(value);
}

function saveOnlineState() {
  const name = profileNameInput.value.trim();
  if (!roomInfo.roomCode || !name) return;
  const saved = {
    roomCode: roomInfo.roomCode,
    playerName: name,
    mode: 'online',
    token: sessionToken,
    playerId: selfPlayerId,
  };
  sessionStorage.setItem(onlineStorageKey, JSON.stringify(saved));
  if (saved.token && saved.playerId) {
    const recent = readRecentSeats().filter(item => item.playerId !== saved.playerId);
    localStorage.setItem('score-recent-seats', JSON.stringify([saved, ...recent].slice(0, 8)));
  }
}

function loadOnlineState() {
  try {
    let raw = sessionStorage.getItem(onlineStorageKey);
    const legacy = localStorage.getItem(onlineStorageKey);
    if (!raw && legacy) { raw = legacy; sessionStorage.setItem(onlineStorageKey, raw); }
    if (legacy) localStorage.removeItem(onlineStorageKey);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch (error) {
    console.warn('读取联机会话状态失败', error);
    return null;
  }
}

function clearOnlineState() {
  sessionStorage.removeItem(onlineStorageKey);
  localStorage.removeItem(onlineStorageKey);
  sessionToken = null; selfPlayerId = null;
}

function restoreModePanel() {
  const savedMode = currentMode;
  if (savedMode === 'local') {
    currentMode = 'local';
    roomStatusText.textContent = '本地模式';
    roomStatusText.style.visibility = 'visible';
    modePanel.classList.add('hidden');
    countPanel.classList.remove('hidden');
    roomPanel.classList.add('hidden');
  } else if (savedMode === 'online') {
    currentMode = 'online';
    roomStatusText.textContent = '联机模式';
    roomStatusText.style.visibility = 'visible';
    modePanel.classList.add('hidden');
    roomPanel.classList.remove('hidden');
    countPanel.classList.add('hidden');
  }
}

function updateHeaderControls() {
  const inGame = !gamePanel.classList.contains('hidden');
  const showControls = inGame && (currentMode === 'local' || (currentMode === 'online' && roomInfo.isHost && Boolean(roomInfo.roomCode)));
  resetBtn.classList.toggle('hidden', !showControls);
  settleBtn.classList.toggle('hidden', !inGame);
  document.getElementById('localPlayersBtn').classList.toggle('hidden', !inGame || currentMode !== 'local');
  document.getElementById('nextRoundBtn').classList.toggle('hidden', currentMode !== 'online' || !roomInfo.isHost);
  resetBtn.disabled = currentMode === 'online' && (!socket.connected || !roomInfo.connected);
}

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
function showToast(message, type = 'info') {
  // 清除上一次还未执行完的定时器，防止大拇指高频连续连点按钮时产生闪烁
  if (toastTimeout) {
    clearTimeout(toastTimeout);
  }
  toast.textContent = message;
  toast.classList.toggle('toast-error', type === 'error');
  toast.setAttribute('role', type === 'error' ? 'alert' : 'status');
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
  if (currentMode === 'online') {
    chooseRoomBtn.textContent = '解散房间';
    dialogMessage.textContent = '重置分数保留在场玩家；解散房间会结束所有人的联机会话，请先导出结算图片。';
  } else {
    chooseRoomBtn.textContent = '重置房间';
    dialogMessage.textContent = '重置房间会清空玩家信息与分数；仅重置分数会保留玩家信息。';
  }
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
  if (currentMode === 'online' && mode === 'room') { dialogTitle.textContent = '确认解散房间'; dialogMessage.textContent = '所有玩家将退出，房间和当前账目将删除。确定解散吗？'; }
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

  if (currentMode === 'local') {
    if (pendingResetMode === 'room') {
      state.players = [];
      state.logs = [];
      state.selectedPlayerId = null;
      state.pendingTransferTargetId = null;
      saveState();
      currentMode = 'idle';
      modePanel.classList.remove('hidden');
      countPanel.classList.add('hidden');
      nicknamePanel.classList.add('hidden');
      roomPanel.classList.add('hidden');
      gamePanel.classList.add('hidden');
      logsPanel.classList.add('hidden');
      roomStatusText.textContent = '';
      roomStatusText.style.visibility = 'hidden';
      updateHeaderControls();
      render();
    } else if (pendingResetMode === 'score') {
      state.players = state.players.map((player) => ({ ...player, score: 0 }));
      state.logs = [];
      state.selectedPlayerId = null;
      state.pendingTransferTargetId = null;
      saveState();
      render();
      showToast('本局分数已重置。');
    }

    closeDialog();
    return;
  }

  if (!roomInfo.roomCode) {
    closeDialog();
    return;
  }

  if (pendingResetMode === 'room') {
    sendOnlineAction('reset-room', { roomCode: roomInfo.roomCode });
  } else if (pendingResetMode === 'score') {
    sendOnlineAction('reset-score', { roomCode: roomInfo.roomCode });
  }

  closeDialog();
}


// ==========================================================================
// 【模块六：大厅人数设定、动态框渲染与名字注册业务流】
// ==========================================================================

// 根据用户微调选择的参与总人数，实时、安全、自适应地在页面生成对应数量的昵称输入文本框
let setupPlayers = ['', ''];
function renderPlayerNameInputs(removedIndex) {
  const oldRows = [...playerNameInputs.querySelectorAll('.setup-player-row')].map(row => ({ rect: row.getBoundingClientRect(), clone: row.cloneNode(true) }));
  const removedRows = Number.isInteger(removedIndex) ? oldRows.splice(removedIndex, 1) : [];
  playerCountInput.value = setupPlayers.length;
  const addButton = document.getElementById('addPlayerBtn');
  playerNameInputs.replaceChildren();
  setupPlayers.forEach((name, index) => {
    const row = document.createElement('div'); row.className = 'setup-player-row';
    const input = document.createElement('input'); input.type = 'text'; input.name = 'player' + (index + 1); input.maxLength = 8; input.value = name; input.placeholder = '玩家' + (index + 1); input.setAttribute('aria-label', input.placeholder);
    input.addEventListener('input', () => { setupPlayers[index] = input.value; });
    const remove = document.createElement('button'); remove.type = 'button'; remove.className = 'remove-player'; remove.textContent = '×'; remove.setAttribute('aria-label', '移除玩家' + (index + 1)); remove.disabled = setupPlayers.length <= 2;
    remove.addEventListener('click', () => { setupPlayers.splice(index, 1); renderPlayerNameInputs(index); });
    row.append(input, remove); playerNameInputs.append(row);
  });
  addButton.disabled = setupPlayers.length >= 8;
  addButton.classList.toggle('hidden', setupPlayers.length >= 8);
  document.getElementById('playerCountHint').textContent = setupPlayers.length + ' / 8 位玩家 · 点击昵称可修改';
  animateSetupRows(oldRows, removedRows);
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
  event.preventDefault();

  const formData = new FormData(registrationForm);
  const count = Math.max(2, Math.min(8, Number(playerCountInput.value) || 4));
  const names = Array.from({ length: count }, (_, index) => {
    const value = String(formData.get(`player${index + 1}`) || '').trim() || `玩家${index + 1}`;
    return value;
  });

  const emptyIndex = names.findIndex((name) => !name);
  if (emptyIndex !== -1) {
    showToast(`玩家${emptyIndex + 1} 昵称不能为空。`, 'error');
    return;
  }

  const filteredNames = names.filter(Boolean);
  if (filteredNames.length !== count) {
    showToast(`请完整填写 ${count} 位玩家昵称。`, 'error');
    return;
  }

  const uniqueNames = [...new Set(filteredNames)];
  if (uniqueNames.length !== count) {
    showToast('昵称不能重复。', 'error');
    return;
  }

  const roomAvatarColors = avatarColors.filter(([,color]) => color).map(([,color]) => color);
  state.players = names.map((name, index) => ({
    id: `p${index + 1}`,
    name,
    avatarColor: roomAvatarColors.splice(Math.floor(Math.random() * roomAvatarColors.length), 1)[0],
    score: 0,
  }));
  state.selectedPlayerId = null;
  state.logs = [];

  if (currentMode === 'local') {
    saveState();
    roomStatusText.textContent = '本地模式';
    roomStatusText.style.visibility = 'visible';
  }
  countPanel.classList.add('hidden');
  nicknamePanel.classList.add('hidden');
  gamePanel.classList.remove('hidden');
  logsPanel.classList.remove('hidden');
  updateHeaderControls();
  render();
}


// ==========================================================================
// 【模块七：本地磁盘缓存（LocalStorage）读取与同步】
// ==========================================================================

// 从浏览器磁盘中读取之前可能由于刷新、关闭标签页而保存的历史现场状态，保证体验连贯性
function loadState() {
  if (currentMode === 'online') return;
  try {
    const raw = localStorage.getItem(storageKey);
    if (!raw) return;

    const parsed = JSON.parse(raw);
    // 严格校验缓存取出的格式合法性，确保无损后覆盖内存中的运行时状态 state
    if (parsed && Array.isArray(parsed.players) && Array.isArray(parsed.logs)) {
      state = {
        players: parsed.players,
        selectedPlayerId: null,
        logs: parsed.logs,
      };
      if (parsed.mode === 'local') {
        currentMode = 'local';
      }
    }
  } catch (error) {
    console.warn('读取本地存储失败。', error);
  }
}

// 核心同步机：将当前内存中的运行时状态 state 同步写入浏览器磁盘存储中（仅本地模式
function saveState() {
  if (currentMode !== 'local') {
    return;
  }

  if (!state.players.length) {
    localStorage.removeItem(storageKey);
    return;
  }

  const payload = {
    mode: 'local',
    players: state.players,
    selectedPlayerId: null,
    logs: state.logs,
  };
  localStorage.setItem(storageKey, JSON.stringify(payload));
}

// 唤起重置弹窗操作
function resetRoom() {
  if (currentMode === 'local') {
    state.players = [];
    state.logs = [];
    state.selectedPlayerId = null;
    state.pendingTransferTargetId = null;
    saveState();
    currentMode = 'idle';
    modePanel.classList.remove('hidden');
    countPanel.classList.add('hidden');
    nicknamePanel.classList.add('hidden');
    roomPanel.classList.add('hidden');
    gamePanel.classList.add('hidden');
    logsPanel.classList.add('hidden');
    roomStatusText.textContent = '';
    roomStatusText.style.visibility = 'hidden';
    updateHeaderControls();
    render();
    return;
  }

  if (!roomInfo.roomCode) {
    showToast('请先创建或加入房间。');
    return;
  }
  openResetDialog();
}

// ==========================================================================
// 【模块八：出分与转分核心算账逻辑】
// ==========================================================================

// 执行一次分数流转：从“出分人（actor）”向“目标接收人（target）”转移指定的积分数值
function transferScore(targetId, amount) {
  if (!state.players.length) return;

  const actor = state.players.find((player) => player.id === state.selectedPlayerId);
  if (!actor) {
    state.selectedPlayerId = null;
    render();
    return;
  }

  const target = state.players.find((player) => player.id === targetId);
  if (!target || target.id === actor.id) return;

  if (currentMode === 'online') {
    if (!roomInfo.roomCode || !socket.connected) { showToast('连接已断开，请重连后记分'); return; }
    if (transferPending) return;
    transferPending = true;
    sendOnlineAction('transfer-score', {
      roomCode: roomInfo.roomCode, fromId: actor.id, toId: target.id, amount, requestId: makeRequestId(),
    }, () => { transferPending = false; render(); });
  } else {
    ScoreCore.transfer(state.players, actor.id, target.id, amount);
    // 本地模式下使用与联机模式相同的日志格式，方便 renderLogs 正确解析与归组
    const entry = {
      id: `${Date.now()}-${makeRequestId()}`,
      from: actor.name,
      to: target.name,
      amount,
      timestamp: new Date().toLocaleString('zh-CN', { hour12: false }),
    };
    state.logs.unshift(entry);
    saveState();
  }

  state.selectedPlayerId = null;
  state.pendingTransferTargetId = null;
  render();
}

// 主交互控制器：控制游戏主控板上所有玩家卡片的点按状态轮转
function selectPlayer(playerId) {
  if (currentMode === 'online' && (!socket.connected || !roomInfo.connected || transferPending)) return showToast('等待连接恢复或上一笔确认后再记分');
  if (currentMode === 'online' && state.players.find(p => p.id === playerId)?.left) return showToast('这位玩家已离开，账目仅用于结算');
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
    amountDialogInput.readOnly = true;
    amountReplaceNext = true;
    document.getElementById('amountTransferSummary').textContent = state.players.find(p => p.id === state.selectedPlayerId).name + ' → ' + state.players.find(p => p.id === playerId).name;
    amountDialog.classList.remove('hidden');  // 滑出输入框遮罩层
    amountDialogInput.focus();                // 只读输入框不会唤起手机输入法
  } else {
    // 情况三：第一次点击卡片，将此玩家设为“出分人”高亮显示
    if (currentMode === 'online' && !roomInfo.isHost && playerId !== selfPlayerId) { showToast('请选择自己作为出分人，房主可代记'); return; }
    state.selectedPlayerId = playerId;
    render();
  }
}


// ==========================================================================
// 【模块九：动态渲染引擎 - 玩家名片与排行榜】
// ==========================================================================

// 玩家卡片渲染模块：根据内存中的最新玩家数据，动态重构并挂载 HTML 玩家卡片网格
function renderPlayers() {
  const previous = new Map([...playersGrid.querySelectorAll('[data-player-id]')].map(card => [card.dataset.playerId, { score: Number(card.dataset.score), active: card.classList.contains('active'), presence: card.dataset.presence }]));
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
    card.dataset.playerId = player.id;
    card.dataset.score = player.score;
    card.dataset.presence = String(player.online);
    if (state.selectedPlayerId === player.id) {
      card.classList.add('active'); // 出分人亮黄框样式
    }

    const scoreClass = player.score < 0 ? 'score-negative' : 'score-positive'; // 积分红/绿分色
    
    // 只有当场上有唯一大赢家，且循环遍历到该赢家时，才在其右上角渲染皇冠 👑
    const crownIcon = hasUniqueWinner && player.id === highestScorePlayers[0].id 
      ? '<span class="crown-icon">' + avatarGraphic('👑') + '</span>'
      : '';
    
    // 提取玩家昵称的首字符（采用 Array.from 避免多字节复杂 Emoji 首字母截取出现乱码）
    const firstChar = /^玩家([1-8])$/.exec(player.name)?.[1] || Array.from(player.name)[0];
    
    card.innerHTML = `
      ${crownIcon}
      <div class="avatar" style="background:${playerAvatarBackground(player)}">${avatarGraphic(player.avatar === '昵称' ? firstChar : player.avatar || firstChar)}</div>
      <div class="player-info">
        <strong>${escapeHtml(player.name)}</strong>
        ${currentMode === 'online' ? '<span class="player-presence">' + (player.left ? '已离开' : player.online ? '在线' : '离线') + (player.isHost ? ' [房主]' : '') + '</span>' : ''}
        <span class="score-badge ${scoreClass}">积分 ${player.score}</span>
      </div>
    `;

    // 绑定点按事件
    card.addEventListener('click', () => {
      selectPlayer(player.id);
    });

    frag.appendChild(card);
    const old = previous.get(String(player.id));
    if (old && old.score !== player.score) animateScore(card, old.score, player.score);
    if (!old) card.classList.add('motion-enter');
    if (old && old.presence !== card.dataset.presence) card.querySelector('.player-presence')?.classList.add('motion-enter');
    if (card.classList.contains('active') && !old?.active) card.querySelector('.avatar').classList.add('motion-pop');
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
    card.style.setProperty('--motion-delay', Math.min(index, 7) * 35 + 'ms');
    
    // 4) 输赢家勋章：最高分获得皇冠 👑，最低分领到小丑 🤡
    let badgeIcon = '';
    if (hasScoreVariance) {
      if (player.score === maxScore) {
        badgeIcon = '<span class="leaderboard-badge-icon">' + avatarGraphic('👑') + '</span>';
      } else if (player.score === minScore) {
        badgeIcon = '<span class="leaderboard-badge-icon">' + avatarGraphic('🤡') + '</span>';
      }
    }
    
    const scoreClass = player.score < 0 ? 'score-negative' : 'score-positive';
    const firstChar = /^玩家([1-8])$/.exec(player.name)?.[1] || Array.from(player.name)[0];
    
    card.innerHTML = `
      <div class="leaderboard-rank">第 ${displayRank} 名</div>
      <div class="avatar leaderboard-avatar" style="background:${playerAvatarBackground(player)}">${avatarGraphic(player.avatar === '昵称' ? firstChar : player.avatar || firstChar)}</div>
      <div class="leaderboard-info">
        <strong>${escapeHtml(player.name)}</strong>
        <div class="leaderboard-score-group">
          ${badgeIcon}
          <span class="score-badge ${scoreClass}">积分 ${player.score}</span>
        </div>
      </div>
    `;
    
    leaderboardList.appendChild(card);
  });
  const suggestion = document.createElement('p'); suggestion.className = 'settlement-suggestion';
  try { suggestion.textContent = 'tips: ' + (ScoreCore.settlement(state.players).map(t => t.from + ' → ' + t.to + ' ' + t.amount + ' 分').join('；') || '全员已平分'); }
  catch (error) { suggestion.textContent = error.message; }
  leaderboardList.appendChild(suggestion);
}


// ==========================================================================
// 【模块十：高级账目日志归组与分析】
// ==========================================================================

// 流水记录渲染器：提取所有对账日志，进行 1 分钟时差智能归组并逆序展示
function renderLogs() {
  const previousLatest = logList.dataset.latest;
  logList.dataset.latest = state.logs[0]?.id || '';
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
  let runningScores = Object.create(null);
  state.players.forEach((p) => (runningScores[p.name] = 0)); // 临时累计记账账本

  for (let index = groups.length - 1; index >= 0; index--) {
    for (const log of [...groups[index]].reverse()) {
      runningScores[log.from] -= log.amount;
      runningScores[log.to] += log.amount;
    }
    playerScoresSnapshots[index] = { ...runningScores };
  }

  // 3) HTML 拼接渲染输出
  groups.forEach((group, index) => {
    const item = document.createElement('li');
    item.className = 'log-item';
    if (index === 0 && previousLatest !== undefined && previousLatest !== String(state.logs[0].id)) item.classList.add('motion-new-log');

    // 截取掉具体秒数，仅展示发生年月日的具体分值，界面排版更清秀
    const firstEntry = group[0];
    const timeStr = firstEntry.timestamp.substring(0, firstEntry.timestamp.lastIndexOf(':'));

    const scoresAtEnd = playerScoresSnapshots[index] || {};

    // 罗列该合并卡片内部发生的所有交易（如：玩家A → 玩家B 10分）
    const transfersHtml = group
      .map((entry) => {
        return `<div class="transfer-item">
          <span class="transfer-text">${escapeHtml(entry.from)} → ${escapeHtml(entry.to)}${entry.operatorId && entry.operatorId !== entry.fromId ? ' · ' + escapeHtml(state.players.find(p => p.id === entry.operatorId)?.name || '房主') + '代记' : ''}</span>
          <span class="transfer-amount">${entry.amount}分</span>
        </div>`;
      })
      .join('');

    // 渲染该时间节点发生时，全员的积分总榜（如当前：张三 10分，李四 -10分）
    const scoresHtml = state.players
      .map((player) => {
        const score = scoresAtEnd[player.name] || 0;
        const scoreClass = score < 0 ? 'score-negative' : 'score-positive';
        return `<span class="current-score-text">${escapeHtml(player.name)} <span class="${scoreClass}">${score}</span> 分</span>`;
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
  renderRoomTools();
  document.getElementById('undoBtn').disabled = !state.logs.length || (currentMode === 'online' && (!roomInfo.isHost || !socket.connected || !roomInfo.connected));
  document.getElementById('gameRoomInfo').classList.toggle('hidden', currentMode !== 'online');

  renderPlayers();
  renderLogs();
  updateHeaderControls();

  if (transferPending) { activePlayerInfo.textContent = '正在确认记分…'; return; }
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
countBackBtn.addEventListener('click', () => {
  modePanel.classList.remove('hidden');
  countPanel.classList.add('hidden');
  roomPanel.classList.add('hidden');
  nicknamePanel.classList.add('hidden');
  roomStatusText.style.visibility = 'hidden';
});
roomBackBtn.addEventListener('click', () => {
  modePanel.classList.remove('hidden');
  roomPanel.classList.add('hidden');
  countPanel.classList.add('hidden');
  nicknamePanel.classList.add('hidden');
  roomStatusText.style.visibility = 'hidden';
});
playerCountInput.addEventListener('input', renderPlayerNameInputs); // 人数框数值改变
profileNameInput.addEventListener('input', syncProfilePreview);
localModeBtn.addEventListener('click', () => {
  currentMode = 'local';
  localStorage.setItem(modeStorageKey, 'local');
  sessionStorage.setItem(modeStorageKey, 'local');
  roomInfo = { roomCode: null, hostName: null, isHost: false, connected: false };
  roomInfoBox.classList.add('hidden');
  setConnectionStatus('本地模式', 'local');
  updateHeaderControls();
  modePanel.classList.add('hidden');
  countPanel.classList.remove('hidden');
  roomPanel.classList.add('hidden');
  renderPlayerNameInputs();
});
onlineModeBtn.addEventListener('click', () => {
  currentMode = 'online';
  localStorage.setItem(modeStorageKey, 'online');
  sessionStorage.setItem(modeStorageKey, 'online');
  roomInfo = { roomCode: null, hostName: null, isHost: false, connected: false };
  roomInfoBox.classList.add('hidden');
  setConnectionStatus('联机模式', 'online');
  modePanel.classList.add('hidden');
  roomPanel.classList.remove('hidden');
  countPanel.classList.add('hidden');
  updateHeaderControls();
  syncProfilePreview(); renderRecentSeats();
});
createRoomBtn.addEventListener('click', () => {
  const name = profileNameInput.value.trim();
  if (!name) {
    showToast('请输入你的昵称。', 'error');
    return;
  }
  if (!socketAvailable) {
    showToast('无法加载 Socket.IO 客户端脚本，请确认已通过 HTTP 访问页面。', 'error');
    return;
  }
  if (!socket.connected) {
    showToast('正在连接服务器，请稍后再试。');
    return;
  }
  setRoomActionLoading('create', true);
  sendOnlineAction('create-room', { hostName: name, avatar: document.getElementById('profileAvatarSelect').value, avatarColor: document.getElementById('profileAvatarColor').value });
});
joinRoomCodeInput.addEventListener('input', () => {
  joinRoomCodeInput.value = normalizeRoomCode(joinRoomCodeInput.value);
});
joinRoomBtn.addEventListener('click', () => {
  const roomCode = normalizeRoomCode(joinRoomCodeInput.value);
  const playerName = profileNameInput.value.trim();
  if (!playerName) {
    showToast('请输入昵称。', 'error');
    return;
  }
  if (!isValidRoomCode(roomCode)) {
    showToast('请输入4位数字房间码。', 'error');
    return;
  }
  if (!socketAvailable) {
    showToast('无法加载 Socket.IO 客户端脚本，请确认已通过 HTTP 访问页面。', 'error');
    return;
  }
  if (!socket.connected) {
    showToast('正在连接服务器，请稍后再试。');
    return;
  }
  setRoomActionLoading('join', true);
  sendOnlineAction('join-room', { roomCode, playerName, password: document.getElementById('joinPassword').value, avatar: document.getElementById('profileAvatarSelect').value, avatarColor: document.getElementById('profileAvatarColor').value });
});

// --- 2) 重置选项对话框事件 ---
resetBtn.addEventListener('click', openResetDialog);                // 顶部“清”按钮唤起重置
chooseCancelBtn.addEventListener('click', closeDialog);       // 选项第一步点“取消”
chooseRoomBtn.addEventListener('click', () => selectResetMode('room'));   // 选项点“重置房间”
chooseScoreBtn.addEventListener('click', () => selectResetMode('score')); // 选项点“重置分数”
dialogCancel.addEventListener('click', closeDialog);          // 二次确认点“取消”
dialogConfirm.addEventListener('click', confirmReset);        // 二次确认点“确认"
dialogOverlay.addEventListener('click', (event) => {          // 点击弹窗黑边遮罩层空白关闭
  if (event.target === dialogOverlay) {
    closeDialog();
  }
});

// --- 3) 转分弹窗及输入事件 ---
document.getElementById('amountManualInput').addEventListener('click', () => {
  amountDialogInput.readOnly = false; amountReplaceNext = true; amountDialogInput.focus(); amountDialogInput.select();
});
document.getElementById('amountQuickChoices').addEventListener('click', event => {
  const button = event.target.closest('button[data-amount]'); if (!button) return;
  amountDialogInput.readOnly = true; amountDialogInput.value = button.dataset.amount; amountReplaceNext = true;
});
document.getElementById('amountKeypad').addEventListener('click', event => {
  const button = event.target.closest('button'); if (!button) return;
  amountDialogInput.readOnly = true;
  if (button.dataset.key === 'clear') { amountDialogInput.value = ''; amountReplaceNext = false; return; }
  if (button.dataset.key === 'backspace') { amountDialogInput.value = amountDialogInput.value.slice(0, -1); amountReplaceNext = false; return; }
  if (button.dataset.digit === undefined) return;
  const value = (amountReplaceNext ? '' : amountDialogInput.value) + button.dataset.digit;
  if (Number(value) > 1000000) return showToast('积分最多为 1000000', 'error');
  amountDialogInput.value = String(Number(value)); amountReplaceNext = false;
});
amountDialogCancel.addEventListener('click', () => {          // 点击转分“取消”
  state.selectedPlayerId = null;
  state.pendingTransferTargetId = null;
  amountDialog.classList.add('hidden');
  render();
});
amountDialogConfirm.addEventListener('click', () => {         // 点击转分“确认”
  if (currentMode === 'online' && (!socket.connected || !roomInfo.connected || transferPending)) return showToast('请等待连接恢复或上一笔记分确认');
  if (state.pendingTransferTargetId) {
    const amount = Number(amountDialogInput.value);
    if (!Number.isSafeInteger(amount) || amount < 1 || amount > 1000000) { showToast('请输入 1 到 1000000 的整数积分', 'error'); return; }
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
  renderLeaderboard();
  settleConfirmCard.classList.add('hidden');
  leaderboardCard.classList.remove('hidden');
});
settleCancelBtn.addEventListener('click', () => {             // 结算询问点“取消”
  settleDialog.classList.add('hidden');
});
settleConfirmBtn.addEventListener('click', () => {            // 结算询问点“确定”，正式生成并渲染并列排行榜
  renderLeaderboard();
  settleConfirmCard.classList.add('hidden');
  leaderboardCard.classList.remove('hidden');
});
leaderboardCloseBtn.addEventListener('click', () => {         // 右上角小叉仅关闭排行榜，保留账目
  settleDialog.classList.add('hidden');
});


// ==========================================================================
// 【模块十三：页面首次加载自运行逻辑】
// ==========================================================================

socket.on('connect', () => {
  roomInfo.connected = true;
  if (currentMode === 'online') {
    setConnectionStatus('联机模式', 'online');
    const onlineData = loadOnlineState();
    const playerName = profileNameInput.value.trim() || onlineData?.playerName;
    const roomCode = roomInfo.roomCode || onlineData?.roomCode;
    if (roomCode && playerName) {
      setConnectionStatus('正在恢复房间，请稍候', 'reconnect');
      roomInfo.connected = false;
      sendOnlineAction('rejoin-room', {
        roomCode,
        token: sessionToken,
      });
    }
  } else {
    if (currentMode === 'local') setConnectionStatus('本地模式', 'local');
    else { roomStatusText.textContent = ''; roomStatusText.style.visibility = 'hidden'; }
  }
});

socket.on('disconnect', () => {
  roomInfo.connected = false;
  if (currentMode === 'online') {
    setConnectionStatus('连接已断开，正在重连；暂时无法记分', 'disconnected');
    render();
  }
});

socket.io?.on('reconnect_attempt', () => {
  if (currentMode === 'online') {
    setConnectionStatus('正在重连...', 'reconnecting');
  }
});

socket.on('reconnect', () => {
  if (currentMode === 'online') {
    setConnectionStatus('联机模式', 'online');
  }
});

socket.io?.on('reconnect_failed', () => {
  if (currentMode === 'online') {
    setConnectionStatus('重连失败，请刷新页面或重新加入房间', 'failed');
    showToast('重连失败，请重新进入房间。', 'error');
  }
});

socket.on('connect_error', () => {
  if (currentMode === 'online') {
    setConnectionStatus('连接错误，请检查网络', 'error');
  }
});

socket.on('session-token', ({ token, playerId }) => { sessionToken = token; selfPlayerId = playerId; saveOnlineState(); });

socket.on('room-created', ({ roomCode, hostName, players, logs }) => {
  roomInfo = { roomCode, hostName, isHost: true, connected: true };
  localStorage.setItem(modeStorageKey, 'online');
  sessionStorage.setItem(modeStorageKey, 'online');
  saveOnlineState();
  state.players = players;
  state.logs = logs;
  state.selectedPlayerId = null;
  state.pendingTransferTargetId = null;
  setConnectionStatus(`联机模式 [房间号:${roomCode}] - 你是房主`, 'online');
  updateRoomInfoBox();
  roomInfoBox.classList.remove('hidden');
  modePanel.classList.add('hidden');
  roomPanel.classList.add('hidden');
  countPanel.classList.add('hidden');
  nicknamePanel.classList.add('hidden');
  gamePanel.classList.remove('hidden');
  logsPanel.classList.remove('hidden');
  updateHeaderControls();
  render();
  setRoomActionLoading('create', false);
});

socket.on('room-error', ({ message, event }) => {
  if (event === 'join-room' && message.includes('密码')) { document.getElementById('joinPasswordDetails').open = true; document.getElementById('joinPassword').focus(); }
  if (event === 'rejoin-room') { forgetRecentRoom(roomInfo.roomCode, selfPlayerId); returnOnlineLobby(message, 'error'); }
  showToast(message, 'error');
  setRoomActionLoading('create', false);
  setRoomActionLoading('join', false);
});

socket.on('room-state', ({ roomCode, hostName, hostId, players, logs, locked, hasPassword, round, rounds, hostOfflineSince }) => {
  if (currentMode !== 'online') return;
  const wasHost = roomInfo.isHost;
  const hadRoom = gamePanel.classList.contains('hidden') === false;
  roomInfo.connected = true;
  const selected = state.selectedPlayerId;
  const target = state.pendingTransferTargetId;
  const roundChanged = (roomInfo.round || 1) !== (round || 1);
  roomInfo.roomCode = roomCode;
  roomInfo.hostName = hostName;
  roomInfo.isHost = selfPlayerId === hostId;
  Object.assign(roomInfo, { locked, hasPassword, round: round || 1, rounds: rounds || [], hostOfflineSince });
  saveOnlineState();
  state.players = players;
  state.logs = logs;
  state.selectedPlayerId = !roundChanged && players.some(p => p.id === selected && !p.left) ? selected : null;
  const ownProfile = players.find(p => p.id === selfPlayerId);
  if (ownProfile) { profileNameInput.value = ownProfile.name; document.getElementById('profileAvatarSelect').value = ownProfile.avatar || '昵称'; document.getElementById('profileAvatarColor').value = ownProfile.avatarColor || ''; syncProfilePreview(); refreshColorChoices('profile'); }
  state.pendingTransferTargetId = !roundChanged && players.some(p => p.id === target && !p.left) ? target : null;
  if (!state.selectedPlayerId || !state.pendingTransferTargetId) amountDialog.classList.add('hidden');
  updateRoomInfoBox();
  roomInfoBox.classList.remove('hidden');
  setConnectionStatus(`联机模式 [房间号:${roomCode}]`, 'online');
  modePanel.classList.add('hidden');
  roomPanel.classList.add('hidden');
  countPanel.classList.add('hidden');
  nicknamePanel.classList.add('hidden');
  gamePanel.classList.remove('hidden');
  logsPanel.classList.remove('hidden');
  updateHeaderControls();
  render();
  setRoomActionLoading('join', false);
  if (hadRoom && !wasHost && roomInfo.isHost) {
    showToast('你已成为新房主。');
  }
});

const onlineSession = loadOnlineState();
loadState();
syncProfilePreview();
restoreModePanel();
if (onlineSession) {
  if (onlineSession.playerName) {
    if (!profileNameInput.value) {
      profileNameInput.value = onlineSession.playerName;
    }
    syncProfilePreview();
  }
  if (onlineSession.roomCode && currentMode === 'online') {
    roomInfo.roomCode = onlineSession.roomCode;
    roomInfo.hostName = null;
    roomInfo.isHost = false;
    joinRoomCodeInput.value = onlineSession.roomCode;
    if (currentMode === 'online') {
      updateRoomInfoBox();
    }
  }
}
if (state.players.length && currentMode === 'local') {
  modePanel.classList.add('hidden');
  roomPanel.classList.add('hidden');
  countPanel.classList.add('hidden');
  nicknamePanel.classList.add('hidden');
  gamePanel.classList.remove('hidden');
  logsPanel.classList.remove('hidden');
  roomStatusText.textContent = '本地模式';
  roomStatusText.style.visibility = 'visible';
  updateHeaderControls();
  render();
} else {
  modePanel.classList.remove('hidden');
  countPanel.classList.add('hidden');
  nicknamePanel.classList.add('hidden');
  roomPanel.classList.add('hidden');
  gamePanel.classList.add('hidden');
  logsPanel.classList.add('hidden');
}
// Shared local/online ledger tools.
let pendingUndoLogId = null;
const undoDialog = document.getElementById('undoDialog');
function closeUndoDialog() { undoDialog.classList.add('hidden'); pendingUndoLogId = null; document.getElementById('undoBtn').focus(); }
document.getElementById('undoBtn').addEventListener('click', () => {
  const log = state.logs[0];
  if (!log) return;
  pendingUndoLogId = log.id;
  document.getElementById('undoMessage').textContent = '撤销 ' + log.from + ' → ' + log.to + ' 的 ' + log.amount + ' 分？双方积分将恢复。';
  undoDialog.classList.remove('hidden'); document.getElementById('undoCancelBtn').focus();
});
document.getElementById('undoCancelBtn').addEventListener('click', closeUndoDialog);
undoDialog.addEventListener('click', event => { if (event.target === undoDialog) closeUndoDialog(); });
document.addEventListener('keydown', event => { if (event.key === 'Escape' && !undoDialog.classList.contains('hidden')) closeUndoDialog(); });
document.getElementById('undoConfirmBtn').addEventListener('click', () => {
  const log = state.logs[0];
  if (!log || log.id !== pendingUndoLogId) { closeUndoDialog(); return showToast('记录已变化，请重新选择撤销'); }
  if (currentMode === 'online') {
    if (!socket.connected) return showToast('请重连后操作');
    sendOnlineAction('undo-score', { roomCode: roomInfo.roomCode, logId: pendingUndoLogId }, result => { if (result?.ok) showToast('已撤销'); });
  } else {
    const from = state.players.find(p => p.name === log.from);
    const to = state.players.find(p => p.name === log.to);
    ScoreCore.transfer(state.players, to.id, from.id, log.amount);
    state.logs.shift(); saveState(); render();
    showToast('已撤销');
  }
  closeUndoDialog();
});
document.getElementById('exportBtn').addEventListener('click', exportScoreImage);
async function exportScoreImage() {
  const exportButton = document.getElementById('exportBtn');
  if (exportButton.disabled) return;
  exportButton.disabled = true; exportButton.classList.add('motion-loading');
  exportButton.setAttribute('aria-busy', 'true');
  try {
  await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  const sorted = [...state.players].sort((a,b) => b.score-a.score);
  let suggestions;
  try { suggestions = ScoreCore.settlement(state.players); } catch (error) { return showToast(error.message, 'error'); }
  const canvas = document.createElement('canvas'); canvas.width = 1000; canvas.height = 240 + sorted.length * 100 + Math.max(1,suggestions.length) * 56;
  const ctx = canvas.getContext('2d'); ctx.fillStyle = '#f5f6f8'; ctx.fillRect(0,0,canvas.width,canvas.height);
  ctx.font = 'bold 44px system-ui, sans-serif'; ctx.fillStyle='#172033'; ctx.fillText('牌局记分 · 本局结算', 60, 80);
  ctx.font='24px system-ui, sans-serif'; ctx.fillStyle='#657084'; ctx.fillText(new Date().toLocaleString('zh-CN') + ' · ' + state.logs.length + ' 笔记录',60,125);
  sorted.forEach((p,i) => {
    const y=160+i*100; ctx.fillStyle='#ffffff'; ctx.fillRect(50,y,900,84);
    ctx.fillStyle='#172033'; ctx.font='30px system-ui, sans-serif'; ctx.fillText(p.name,80,y+54);
    ctx.textAlign='right'; ctx.fillStyle=p.score<0?'#be3349':'#13775b'; ctx.font='bold 40px system-ui, sans-serif'; ctx.fillText((p.score>0?'+':'')+p.score+' 分',920,y+56); ctx.textAlign='left';
  });
  let y=200+sorted.length*100; ctx.font='26px system-ui, sans-serif'; ctx.fillStyle='#172033'; ctx.fillText('tips:',60,y);
  (suggestions.length?suggestions:[{from:'全员已平分'}]).forEach(t => { y+=56; ctx.font='24px system-ui, sans-serif'; ctx.fillText(t.to?t.from+' → '+t.to+'   '+t.amount+' 分':t.from,60,y); });
  const imageUrl = canvas.toDataURL('image/png');
  document.getElementById('scoreImagePreview').src = imageUrl;
  document.getElementById('saveImageLink').href = imageUrl;
  document.getElementById('imagePreviewDialog').classList.remove('hidden');
  } finally { exportButton.disabled = false; exportButton.classList.remove('motion-loading'); exportButton.removeAttribute('aria-busy'); }
}
document.getElementById('addPlayerBtn').addEventListener('click', () => { if(setupPlayers.length<8) { setupPlayers.push(''); renderPlayerNameInputs(); } });
document.getElementById('profileAvatarSelect').addEventListener('change', syncProfilePreview);
document.getElementById('editProfileBtn').addEventListener('click', () => {
  const me=state.players.find(p=>p.id===selfPlayerId); if(!me) return showToast('请重连后修改');
  document.getElementById('roomManageDialog').classList.add('hidden');
  openProfileEditor(me, false);
});
document.getElementById('profileCancelBtn').addEventListener('click',()=>document.getElementById('profileDialog').classList.add('hidden'));
document.getElementById('profileEditForm').addEventListener('submit',event=>{
  event.preventDefault();
  if (!document.getElementById('editNameInput').value.trim()) return showToast('昵称不能为空', 'error');
  const playerName = document.getElementById('editNameInput').value.trim();
  const avatar = document.getElementById('editAvatarSelect').value;
  const avatarColor = document.getElementById('editAvatarColor').value;
  if (editingLocalPlayerId && currentMode === 'local') {
    const player = state.players.find(p => p.id === editingLocalPlayerId); if (!player) return;
    if (state.players.some(p => p.id !== player.id && p.name === playerName)) return showToast('昵称不能重复', 'error');
    for (const log of state.logs) { if (log.from === player.name) log.from = playerName; if (log.to === player.name) log.to = playerName; }
    Object.assign(player, {name:playerName, avatar, avatarColor}); saveState(); render(); document.getElementById('profileDialog').classList.add('hidden'); showToast('玩家信息已保存'); return;
  }
  if(!socket.connected) return showToast('请重连后修改');
  sendOnlineAction('update-profile',{roomCode:roomInfo.roomCode,playerName,avatar,avatarColor});
});
socket.on('profile-updated',({playerName,avatar,avatarColor})=>{ profileNameInput.value=playerName; document.getElementById('profileAvatarSelect').value=avatar; document.getElementById('profileAvatarColor').value=avatarColor || ''; syncProfilePreview(); saveOnlineState(); document.getElementById('profileDialog').classList.add('hidden'); showToast('头像昵称已更新'); });
renderPlayerNameInputs();

document.getElementById('imagePreviewClose').addEventListener('click',()=>document.getElementById('imagePreviewDialog').classList.add('hidden'));

function sendOnlineAction(event, payload, done) {
  if (!socket.connected) { showToast('连接已断开，请重连后操作'); done?.(); return; }
  let finished = false;
  // Only score commands have a persisted idempotency key and are safe to retry.
  const retryTimer = event === 'transfer-score' ? setTimeout(() => {
    if (!finished && socket.connected) socket.emit(event, payload, acknowledge);
  }, 3500) : null;
  const timer = setTimeout(() => {
    if (finished) return;
    finished = true; clearTimeout(retryTimer); setRoomActionLoading('create', false); setRoomActionLoading('join', false);
    showToast('请求未确认，请先核对最新记录，再重试', 'error'); done?.();
  }, 8000);
  function acknowledge(result) {
    if (finished) return; finished = true; clearTimeout(timer); clearTimeout(retryTimer); done?.(result);
  }
  socket.emit(event, payload, acknowledge);
}
function returnOnlineLobby(message, type = 'info') {
  clearOnlineState(); transferPending = false;
  roomInfo = { roomCode: null, hostName: null, isHost: false, connected: socket.connected };
  state = { players: [], logs: [], selectedPlayerId: null, pendingTransferTargetId: null };
  currentMode = 'online'; sessionStorage.setItem(modeStorageKey, 'online');
  for (const id of ['gamePanel','logsPanel','countPanel','nicknamePanel','modePanel','roomInfoBox','profileDialog','undoDialog','settleDialog','roomManageDialog','roomActionDialog','imagePreviewDialog','dialogOverlay','amountDialog']) document.getElementById(id).classList.add('hidden');
  roomPanel.classList.remove('hidden'); renderRecentSeats(); updateHeaderControls(); setConnectionStatus('联机模式 · 请选择房间', 'online');
  if (message) showToast(message, type);
}
function renderRoomTools() {
  const online = currentMode === 'online' && Boolean(roomInfo.roomCode);
  document.getElementById('roomManageBtn').classList.toggle('hidden', !online);
  if (!online) return;
  if (roomInfo.connected && socket.connected) setConnectionStatus('联机模式 [房间号:' + roomInfo.roomCode + '] · ' + state.players.filter(p=>p.online).length + ' 人在线', 'online');
  const editButton = document.getElementById('editProfileBtn');
  const list = document.getElementById('roomMemberList');
  const previousMembers = new Map([...list.querySelectorAll('[data-member-id]')].map(row => [row.dataset.memberId, row.dataset.status]));
  list.replaceChildren();
  editButton.classList.add('hidden');
  list.append(editButton);
  for (const player of state.players) {
    const row = document.createElement('div'); row.className = 'room-member';
    row.dataset.memberId = player.id; row.dataset.status = String(player.online) + ':' + String(player.left);
    if (previousMembers.get(String(player.id)) !== row.dataset.status) row.classList.add('motion-enter');
    const text = document.createElement('span'); text.textContent = player.name + (player.id === selfPlayerId ? '（我）' : '') + ' · ' + (player.left?'已离开':player.online?'在线':'离线') + (player.isHost?' [房主]':'');
    row.append(text);
    if (player.id === selfPlayerId) {
      editButton.classList.remove('hidden');
      const actions = document.createElement('div'); actions.className = 'member-actions'; actions.append(editButton); row.append(actions);
    } else if (roomInfo.isHost && player.online && !player.left) {
      const button = document.createElement('button'); button.type='button'; button.className='secondary-btn'; button.textContent='移交房主';
      button.addEventListener('click',()=>openRoomAction('transfer-host', {roomCode:roomInfo.roomCode,playerId:player.id}, '移交房主', '将房主权限交给 '+player.name+'？你仍可继续记分。'));
      row.append(button);
    }
    list.append(row);
    if (roomInfo.isHost && player.id !== selfPlayerId && !player.left) {
      const remove = document.createElement('button'); remove.type = 'button'; remove.className = 'secondary-btn'; remove.textContent = '移出';
      remove.addEventListener('click', () => openRoomAction('remove-player', {roomCode: roomInfo.roomCode, playerId: player.id}, '移出成员', '将 ' + player.name + ' 移出房间？已有积分和账目会保留。'));
      const actions = document.createElement('div'); actions.className = 'member-actions';
      const existing = row.querySelector('button'); if (existing) actions.append(existing); actions.append(remove); row.append(actions);
    }
  }
  renderOnlineExtras();
  document.getElementById('roomManageHint').textContent = roomInfo.isHost ? '你是房主，可代记和管理成员。退出时自动移交房主，已有账目保留。' : '房主：'+roomInfo.hostName+'。你可从自己转出积分，离线和退出均保留账目。';
}
let roomAction = null;
function openRoomAction(event,payload,title,message) {
  roomAction = {event,payload}; document.getElementById('roomActionTitle').textContent=title; document.getElementById('roomActionMessage').textContent=message; document.getElementById('roomActionDialog').classList.remove('hidden');
}
document.getElementById('roomManageBtn').addEventListener('click',()=>{ renderRoomTools(); document.getElementById('roomManageDialog').classList.remove('hidden'); });
document.getElementById('roomManageClose').addEventListener('click',()=>document.getElementById('roomManageDialog').classList.add('hidden'));
document.getElementById('leaveRoomBtn').addEventListener('click',()=>openRoomAction('leave-room',{roomCode:roomInfo.roomCode},'退出房间','退出后保留已记账的积分。房主退出时会将权限交给下一位在场玩家。确定退出吗？'));
document.getElementById('roomActionCancel').addEventListener('click',()=>document.getElementById('roomActionDialog').classList.add('hidden'));
document.getElementById('roomActionConfirm').addEventListener('click',()=>{
  if (!roomAction) return;
  const action = roomAction;
  sendOnlineAction(action.event,action.payload, result=>{ if(result?.ok) { document.getElementById('roomActionDialog').classList.add('hidden'); if(action.event==='transfer-host') showToast('房主已移交'); if(action.event==='next-round') { settleDialog.classList.add('hidden'); showToast('本局已保存，下一局已开始'); } } });
});
async function copyCurrentRoomCode() {
  if (currentMode !== 'online' || !roomInfo.roomCode) return;
  const code = roomInfo.roomCode;
  try { if (!navigator.clipboard?.writeText) throw new Error('Clipboard unavailable'); await navigator.clipboard.writeText(code); showToast('房间号已复制'); return; } catch {}
  const field = document.createElement('textarea'); field.value = code; field.style.cssText = 'position:fixed;left:-9999px;top:0'; field.setAttribute('readonly',''); document.body.append(field); field.select();
  let copied = false; try { copied = document.execCommand('copy'); } catch {} finally { field.remove(); roomStatusText.focus(); }
  showToast(copied ? '房间号已复制' : '未能自动复制，房间号：' + code, copied ? 'info' : 'error');
}
roomStatusText.addEventListener('click', copyCurrentRoomCode);
roomStatusText.addEventListener('keydown', event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); copyCurrentRoomCode(); } });
socket.on('room-left',({canRestore,roomCode})=>{ if(!canRestore) forgetRecentRoom(roomCode,selfPlayerId); document.getElementById('roomActionDialog').classList.add('hidden'); returnOnlineLobby('已退出房间'); });
socket.on('room-closed',({message})=>{ forgetRecentRoom(roomInfo.roomCode); returnOnlineLobby(message); });
socket.on('session-replaced',({message})=>returnOnlineLobby(message));

function readRecentSeats() { try { const value=JSON.parse(localStorage.getItem('score-recent-seats')||'[]'); return Array.isArray(value)?value.filter(s=>s&&s.token&&s.playerId&&s.roomCode):[]; } catch { return []; } }
function forgetRecentRoom(code,playerId) { localStorage.setItem('score-recent-seats',JSON.stringify(readRecentSeats().filter(s=>s.roomCode!==code || (playerId && s.playerId!==playerId)))); }
function renderRecentSeats() {
  const select=document.getElementById('recentSeatSelect'); select.replaceChildren();
  const seats=readRecentSeats(); document.getElementById('recentSeatRow').classList.toggle('hidden',!seats.length);
  for(const seat of seats) { const option=document.createElement('option'); option.value=seat.playerId; option.textContent=seat.playerName+' · 房间 '+seat.roomCode; select.append(option); }
  const preferred = seats.find(seat => seat.playerName === profileNameInput.value.trim());
  if (preferred) select.value = preferred.playerId;
}
document.getElementById('restoreSeatBtn').addEventListener('click',()=>{
  if (!socket.connected) return showToast('请等待服务器连接');
  const seat=readRecentSeats().find(s=>s.playerId===document.getElementById('recentSeatSelect').value); if(!seat) return;
  sessionToken=seat.token; selfPlayerId=seat.playerId; roomInfo.roomCode=seat.roomCode; roomInfo.connected=false;
  profileNameInput.value=seat.playerName; joinRoomCodeInput.value=seat.roomCode;
  setConnectionStatus('正在恢复席位','reconnect'); sendOnlineAction('rejoin-room',{roomCode:seat.roomCode,token:seat.token});
});

// Room controls share the same server-authorized commands as scoring.
const roomExtras = document.createElement('div');
roomExtras.id = 'roomExtras';
roomExtras.innerHTML = `<p id="roomPolicy" class="tips"></p><div class="dialog-actions"><button id="inviteBtn" class="secondary-btn" type="button">邀请朋友</button><button id="claimHostBtn" class="secondary-btn hidden" type="button">接管房主</button><button id="roundHistoryBtn" class="secondary-btn" type="button">往局记录</button></div><form id="roomSettingsForm" class="hidden room-settings"><label><input id="lockRoomInput" type="checkbox" /> 锁定加入</label><label>设置新密码<input id="roomPasswordInput" type="password" maxlength="32" placeholder="留空保留原密码" autocomplete="new-password" /></label><div class="dialog-actions"><button type="submit" class="secondary-btn">保存设置</button><button id="removePasswordBtn" type="button" class="secondary-btn">取消密码</button></div></form>`;
document.getElementById('roomMemberList').after(roomExtras);
const settingsSection = document.createElement('details'); settingsSection.className = 'room-settings-section'; settingsSection.id = 'settingsSection';
const settingsTitle = document.createElement('summary'); settingsTitle.textContent = '房间设置'; settingsSection.append(settingsTitle, document.getElementById('roomSettingsForm')); roomExtras.append(settingsSection);
const roundsOverlay = document.createElement('div'); roundsOverlay.className = 'dialog-overlay hidden'; roundsOverlay.id = 'roundsOverlay';
roundsOverlay.innerHTML = `<div class="dialog-card" role="dialog" aria-modal="true" aria-labelledby="roundsTitle"><button id="roundsClose" class="dialog-close" aria-label="关闭往局记录">×</button><h3 id="roundsTitle">往局记录</h3><div id="roundsContent"></div></div>`;
document.body.append(roundsOverlay);
function renderOnlineExtras() {
  if (!document.getElementById('roomPolicy')) return;
  document.getElementById('roomPolicy').textContent = '第 ' + (roomInfo.round || 1) + ' 局 · ' + (roomInfo.locked ? '已锁定加入' : '允许加入') + (roomInfo.hasPassword ? ' · 需要密码' : ' · 无密码');
  document.getElementById('roomSettingsForm').classList.toggle('hidden', !roomInfo.isHost);
  settingsSection.classList.toggle('hidden', !roomInfo.isHost);
  document.getElementById('lockRoomInput').checked = Boolean(roomInfo.locked);
  document.getElementById('claimHostBtn').classList.toggle('hidden', roomInfo.isHost || !roomInfo.hostOfflineSince);
  document.getElementById('nextRoundBtn').classList.toggle('hidden', !roomInfo.isHost);
}
document.getElementById('roomSettingsForm').addEventListener('submit', event => {
  event.preventDefault(); sendOnlineAction('room-settings', {roomCode:roomInfo.roomCode, locked:document.getElementById('lockRoomInput').checked, password:document.getElementById('roomPasswordInput').value}, result => {
    if (result?.ok) { document.getElementById('roomPasswordInput').value = ''; showToast('房间设置已保存'); }
  });
});
document.getElementById('removePasswordBtn').addEventListener('click', () => openRoomAction('remove-password', {roomCode:roomInfo.roomCode}, '取消房间密码', '取消后，知道房间号的人可以申请加入。锁定加入设置仍然有效。'));
document.getElementById('claimHostBtn').addEventListener('click', () => openRoomAction('claim-host', {roomCode:roomInfo.roomCode}, '接管房主', '房主离线满 2 分钟后，你可以接管房间。原房主回来后作为普通成员继续。'));
document.getElementById('nextRoundBtn').addEventListener('click', () => openRoomAction('next-round', {roomCode:roomInfo.roomCode, round:roomInfo.round || 1}, '开始下一局', '保存本局积分与记录，然后将当前积分归零开始下一局？'));
document.getElementById('roundsClose').addEventListener('click', () => roundsOverlay.classList.add('hidden'));
document.getElementById('roundHistoryBtn').addEventListener('click', () => {
  const rounds = roomInfo.rounds || []; const content = document.getElementById('roundsContent'); content.replaceChildren();
  if (rounds.length) {
    const totals = new Map();
    for (const round of rounds) for (const player of round.players) { const previous = totals.get(player.id); totals.set(player.id, {name: player.name, score: (previous?.score || 0) + player.score}); }
    const heading = document.createElement('h4'); heading.textContent = '已完成 ' + rounds.length + ' 局 · 累计积分'; content.append(heading);
    for (const player of [...totals.values()].sort((a,b) => b.score-a.score)) { const line = document.createElement('p'); line.textContent = player.name + '：' + player.score + ' 分'; content.append(line); }
  }
  if (!rounds.length) content.textContent = '还没有往局记录。结算后选择“开始下一局”即可保存。';
  for (const round of rounds) {
    const card = document.createElement('details'); const title = document.createElement('summary'); title.textContent = '第 ' + round.number + ' 局 · ' + new Date(round.endedAt).toLocaleString('zh-CN') + ' · ' + round.logs.length + ' 笔'; card.append(title);
    for (const player of [...round.players].sort((a,b) => b.score-a.score)) { const line = document.createElement('p'); line.textContent = player.name + '：' + player.score + ' 分'; card.append(line); }
    for (const log of round.logs) { const line = document.createElement('p'); line.className = 'tips'; line.textContent = log.from + ' → ' + log.to + ' ' + log.amount + ' 分 · ' + log.timestamp; card.append(line); }
    content.append(card);
  }
  roundsOverlay.classList.remove('hidden');
});
document.getElementById('inviteBtn').addEventListener('click', async () => {
  const url = new URL(location.href); url.search = ''; url.hash = ''; url.searchParams.set('room', roomInfo.roomCode);
  try { await navigator.clipboard.writeText(url.href); showToast('邀请链接已复制'); }
  catch { const field = document.createElement('textarea'); field.value = url.href; document.body.append(field); field.select(); const copied = document.execCommand('copy'); field.remove(); showToast(copied ? '邀请链接已复制' : '邀请链接：' + url.href); }
});
const inviteCode = new URLSearchParams(location.search).get('room');
if (inviteCode && /^\d{4}$/.test(inviteCode) && !roomInfo.roomCode) { document.getElementById('onlineModeBtn').click(); joinRoomCodeInput.value = inviteCode; showToast('房间号已填入，设置昵称后加入'); }
for (const selectId of ['profileAvatarSelect','editAvatarSelect']) {
  const select = document.getElementById(selectId);
  const initialOption = document.createElement('option'); initialOption.textContent = '昵称'; select.prepend(initialOption);
  for (const symbol of ['😀','😊','😂','😎','🤔','😴','☀️','☁️','🌧️','❄️','🐶','🦊','🐯','🐰','🐸','🐨','🦁','🐵','🐧','🦉','🐻','🐹','🌙','⭐','🌻','🍀','🔥','🌊','🎲']) { const option = document.createElement('option'); option.textContent = symbol; select.append(option); }
  const picker = document.createElement('details'); picker.className = 'avatar-picker';
  const title = document.createElement('summary'); title.textContent = '图案'; picker.append(title);
  const grid = document.createElement('div'); grid.className = 'avatar-options';
  const randomPattern = document.createElement('button'); randomPattern.type = 'button'; randomPattern.className = 'secondary-btn avatar-option'; randomPattern.innerHTML = avatarGraphic('❓'); randomPattern.setAttribute('aria-label', '随机图案');
  randomPattern.addEventListener('click', () => { const options = [...grid.querySelectorAll('button[data-symbol]')].filter(button => button.dataset.symbol !== select.value && button.dataset.symbol !== '昵称'); options[Math.floor(Math.random() * options.length)].click(); }); grid.append(randomPattern);
  for (const option of select.options) {
    const button = document.createElement('button'); button.type = 'button'; button.className = 'secondary-btn avatar-option'; button.textContent = option.value === '昵称' ? '字' : option.value; button.setAttribute('aria-label', '头像：' + option.value);
    button.setAttribute('aria-pressed', String(select.value === option.value));
    button.dataset.symbol = option.value;
    button.innerHTML = option.value === '昵称' ? '字' : avatarGraphic(option.value);
    button.addEventListener('click', () => { select.value = option.value; grid.querySelectorAll('button').forEach(choice => choice.setAttribute('aria-pressed', String(choice === button))); title.textContent = '图案'; if (selectId === 'profileAvatarSelect') syncProfilePreview(); else syncEditPreview(); const preview = document.getElementById(selectId === 'profileAvatarSelect' ? 'profileAvatar' : 'editAvatarPreview'); if (!motionReduced()) preview.animate([{ opacity: .4, transform: 'scale(.9)' }, { opacity: 1, transform: 'scale(1)' }], { duration: 200 }); picker.open = true; }); grid.append(button);
  }
  picker.open = true;
  picker.append(grid); select.after(picker); select.classList.add('hidden');
}
function avatarHue(id) { return Array.from(String(id)).reduce((sum, char) => (sum * 31 + char.codePointAt(0)) % 360, 0); }
function avatarGradient(color) { return `linear-gradient(145deg, color-mix(in srgb, ${color} 78%, white), ${color} 55%, color-mix(in srgb, ${color} 82%, #172033))`; }
function playerAvatarBackground(player) { return avatarGradient([...avatarColors.map(([,color]) => color), '#64748b','#a67d87','#69869c'].includes(player.avatarColor) && player.avatarColor ? player.avatarColor : `hsl(${avatarHue(player.id)} 35% 35%)`); }
function avatarGraphic(symbol) {
  const assets = {'👑':'crown','🤡':'clown_face','❓':'red_question_mark','😀':'grinning_face','😊':'smiling_face_with_smiling_eyes','😂':'face_with_tears_of_joy','😎':'smiling_face_with_sunglasses','🤔':'thinking_face','😴':'sleeping_face','☀️':'sun','☁️':'cloud','🌧️':'cloud_with_rain','❄️':'snowflake','🐻':'bear','🐹':'hamster','🐱':'cat_face','🐼':'panda','🐶':'dog_face','🦊':'fox','🐯':'tiger_face','🐰':'rabbit_face','🐸':'frog','🐨':'koala','🦁':'lion','🐵':'monkey_face','🐧':'penguin','🦉':'owl','🌙':'crescent_moon','⭐':'star','🌻':'sunflower','🍀':'four_leaf_clover','🔥':'fire','🌊':'water_wave','🎲':'game_die','🎯':'bullseye'};
  return assets[symbol] ? `<img class="avatar-emoji" src="/image/emoji/${assets[symbol]}_3d.png" alt="${escapeHtml(symbol)}" draggable="false" />` : escapeHtml(symbol);
}
function syncEditPreview() {
  const name = document.getElementById('editNameInput').value.trim(); const symbol = document.getElementById('editAvatarSelect').value;
  const preview = document.getElementById('editAvatarPreview');
  preview.innerHTML = avatarGraphic(symbol === '昵称' ? (/^玩家([1-8])$/.exec(name)?.[1] || Array.from(name)[0] || '?') : symbol);
  const player = state.players.find(p => p.id === (editingLocalPlayerId || selfPlayerId));
  preview.style.background = document.getElementById('editAvatarColor').value ? avatarGradient(document.getElementById('editAvatarColor').value) : playerAvatarBackground({id:player?.id || 'preview'});
  document.getElementById('editPreviewName').textContent = name || '昵称预览';
  syncAvatarSelection('editAvatarSelect');
}
function syncAvatarSelection(id) {
  const select = document.getElementById(id);
  select.nextElementSibling?.querySelectorAll('.avatar-option').forEach(button => button.setAttribute('aria-pressed', String(button.getAttribute('aria-label') === '头像：' + select.value)));
}
function openProfileEditor(player, local) {
  editingLocalPlayerId = local ? player.id : null;
  document.getElementById('editNameInput').value = player.name;
  document.getElementById('editAvatarSelect').value = player.avatar || '昵称';
  document.getElementById('editAvatarColor').value = player.avatarColor || '';
  document.getElementById('editAvatarSelect').nextElementSibling.querySelector('summary').textContent = '图案';
  document.getElementById('editAvatarSelect').nextElementSibling.open = true;
  refreshColorChoices('edit'); syncEditPreview(); document.getElementById('profileDialog').classList.remove('hidden');
}
function refreshColorChoices(prefix) {
  const selected = document.getElementById(prefix + 'AvatarColor').value;
  document.querySelectorAll('#' + prefix + 'ColorChoices button').forEach(button => button.setAttribute('aria-pressed', String(Boolean(button.dataset.color) && button.dataset.color === selected)));
}
for (const prefix of ['profile','edit']) {
  const list = document.getElementById(prefix + 'ColorChoices');
  for (const [name,color] of avatarColors) {
    const button = document.createElement('button'); button.type = 'button'; button.className = 'avatar-color'; button.dataset.color = color;
    button.setAttribute('aria-label', color ? '底色：' + name : '随机底色'); button.title = name; button.style.background = avatarGradient(color || 'var(--panel-2)'); button.innerHTML = color ? '' : avatarGraphic('❓');
    button.addEventListener('click', () => { const current = document.getElementById(prefix + 'AvatarColor').value; const choices = avatarColors.filter(([,value]) => value && value !== current); document.getElementById(prefix + 'AvatarColor').value = color || choices[Math.floor(Math.random() * choices.length)][1]; refreshColorChoices(prefix); prefix === 'profile' ? syncProfilePreview() : syncEditPreview(); }); list.append(button);
  }
  refreshColorChoices(prefix);
}
document.getElementById('editNameInput').addEventListener('input', syncEditPreview);
document.getElementById('localPlayersBtn').addEventListener('click', () => {
  const list = document.getElementById('localPlayersList'); list.replaceChildren();
  document.getElementById('localRoomSummary').textContent = '本地房间 · ' + state.players.length + ' 位玩家';
  for (const player of state.players) {
    const row = document.createElement('div'); row.className = 'local-room-member';
    const avatar = document.createElement('div'); avatar.className = 'avatar'; avatar.style.background = playerAvatarBackground(player);
    const initial = /^玩家([1-8])$/.exec(player.name)?.[1] || Array.from(player.name)[0]; avatar.innerHTML = avatarGraphic(player.avatar && player.avatar !== '昵称' ? player.avatar : initial);
    const info = document.createElement('div'); info.className = 'local-member-info';
    const name = document.createElement('strong'); name.textContent = player.name;
    const score = document.createElement('span'); score.className = player.score < 0 ? 'score-negative' : 'score-positive'; score.textContent = '积分 ' + player.score; info.append(name, score);
    const button = document.createElement('button'); button.type = 'button'; button.className = 'secondary-btn'; button.textContent = '编辑信息'; button.setAttribute('aria-label', '编辑信息：' + player.name);
    button.addEventListener('click', () => { document.getElementById('localPlayersDialog').classList.add('hidden'); openProfileEditor(player, true); }); row.append(avatar, info, button); list.append(row);
  }
  document.getElementById('localPlayersDialog').classList.remove('hidden');
});
document.getElementById('localPlayersClose').addEventListener('click', () => document.getElementById('localPlayersDialog').classList.add('hidden'));
function renderQuickScores(values) {
  const list = document.getElementById('amountQuickChoices'); list.replaceChildren();
  for (const value of values) { const button = document.createElement('button'); button.type = 'button'; button.className = 'secondary-btn'; button.dataset.amount = value; button.textContent = value; list.append(button); }
  list.style.gridTemplateColumns = `repeat(${values.length}, minmax(0,1fr))`;
  document.getElementById('quickScoresInput').value = values.join(',');
}
document.getElementById('saveQuickScoresBtn').addEventListener('click', () => {
  const tokens = document.getElementById('quickScoresInput').value.trim().split(/[,，\s]+/);
  const values = [...new Set(tokens.map(Number))];
  if (values.length > 6 || tokens.some(token => !/^\d+$/.test(token)) || values.some(value => !Number.isSafeInteger(value) || value < 1 || value > 1000000)) return showToast('请设置 1 到 6 个分数，每个在 1 到 1000000 之间', 'error');
  localStorage.setItem('score-quick-amounts', JSON.stringify(values)); renderQuickScores(values); document.querySelector('.quick-score-settings').open = false; showToast('常用分数已保存');
});
try { const values = JSON.parse(localStorage.getItem('score-quick-amounts')); if (Array.isArray(values) && values.length >= 1 && values.length <= 6 && values.every(v => Number.isSafeInteger(v) && v >= 1 && v <= 1000000)) renderQuickScores([...new Set(values)]); } catch {}
function foldHelpText(element, title) {
  const details = document.createElement('details'); details.className = 'inline-help';
  const summary = document.createElement('summary'); summary.textContent = title;
  element.before(details); details.append(summary, element);
}
foldHelpText(document.getElementById('roomManageHint'), '房间说明');
foldHelpText(document.getElementById('scoreImagePreview').nextElementSibling, '保存图片说明');

/* Motion stays decorative: final scores and connection state are available immediately. */
function motionReduced() { return matchMedia('(prefers-reduced-motion: reduce)').matches; }
function animateScore(card, before, after) {
  if (motionReduced()) return;
  const label = card.querySelector('.score-badge');
  label.setAttribute('aria-label', '积分 ' + after);
  const delta = document.createElement('span'); delta.className = 'score-delta ' + (after < before ? 'score-negative' : 'score-positive');
  delta.textContent = (after > before ? '+' : '') + (after - before); delta.setAttribute('aria-hidden', 'true'); card.append(delta);
  delta.addEventListener('animationend', () => delta.remove(), { once: true });
  const started = performance.now();
  function frame(now) {
    if (!card.isConnected) return;
    const progress = Math.min((now - started) / 300, 1);
    label.textContent = '积分 ' + Math.round(before + (after - before) * (1 - Math.pow(1 - progress, 3)));
    if (progress < 1) requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}
function animateSetupRows(previous, removed = []) {
  if (motionReduced()) return;
  const rows = [...playerNameInputs.querySelectorAll('.setup-player-row')];
  rows.forEach((row, index) => {
    const old = previous[index];
    if (!old) { row.classList.add('motion-enter'); return; }
    const rect = row.getBoundingClientRect();
    row.animate([{ transform: `translate(${old.rect.left - rect.left}px, ${old.rect.top - rect.top}px)` }, { transform: 'translate(0,0)' }], { duration: 220, easing: 'ease-out' });
  });
  [...removed, ...previous.slice(rows.length)].forEach(({rect, clone}) => {
    if (!rect.width) return;
    clone.classList.add('motion-ghost'); clone.setAttribute('aria-hidden', 'true'); clone.inert = true;
    Object.assign(clone.style, { position: 'fixed', left: rect.left + 'px', top: rect.top + 'px', width: rect.width + 'px', height: rect.height + 'px' });
    document.body.append(clone);
    clone.animate([{ opacity: 1, transform: 'scale(1)' }, { opacity: 0, transform: 'scale(.95)' }], { duration: 160 }).finished.then(() => clone.remove());
  });
}
// Shared transitions also cover dynamically created room and archive dialogs.
const motionVisibility = new WeakMap();
const motionTimers = new WeakMap();
function rememberMotionElements() {
  document.querySelectorAll('.dialog-overlay, .dialog-card, main > section.panel').forEach(element => {
    if (!motionVisibility.has(element)) motionVisibility.set(element, !element.classList.contains('hidden'));
  });
}
rememberMotionElements();
new MutationObserver(records => {
  for (const record of records) {
    const element = record.target;
    if (record.type !== 'attributes' || !motionVisibility.has(element)) continue;
    const visible = !element.classList.contains('hidden');
    if (visible === motionVisibility.get(element)) continue;
    motionVisibility.set(element, visible);
    clearTimeout(motionTimers.get(element));
    element.classList.remove('motion-closing');
    if (motionReduced()) continue;
    if (visible) {
      element.animate(element.matches('.dialog-overlay') ? [{ opacity: 0 }, { opacity: 1 }] : [{ opacity: 0, transform: 'translateY(8px) scale(.98)' }, { opacity: 1, transform: 'translateY(0) scale(1)' }], { duration: 200, easing: 'ease-out' });
    } else if (element.matches('.dialog-overlay')) {
      element.classList.add('motion-closing');
      motionTimers.set(element, setTimeout(() => element.classList.remove('motion-closing'), 120));
    }
  }
  rememberMotionElements();
}).observe(document.body, { subtree: true, attributes: true, attributeFilter: ['class'], childList: true });
document.addEventListener('click', event => {
  const summary = event.target.closest('summary');
  if (!summary || motionReduced()) return;
  const details = summary.parentElement;
  if (details.tagName !== 'DETAILS') return;
  event.preventDefault();
  if (details.dataset.animating) return;
  const opening = !details.open;
  const from = details.getBoundingClientRect().height;
  const previousOverflow = details.style.overflow;
  details.dataset.animating = 'true'; details.open = true;
  const to = opening ? details.getBoundingClientRect().height : summary.getBoundingClientRect().height + parseFloat(getComputedStyle(details).paddingTop) + parseFloat(getComputedStyle(details).paddingBottom);
  details.style.overflow = 'hidden';
  const animation = details.animate([{ height: from + 'px' }, { height: to + 'px' }], { duration: 220, easing: 'ease-out' });
  animation.finished.finally(() => { details.open = opening; details.style.overflow = previousOverflow; delete details.dataset.animating; });
});
