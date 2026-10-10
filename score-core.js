(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.ScoreCore = factory();
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  function transfer(players, fromId, toId, amount) {
    if (!Number.isSafeInteger(amount) || amount < 1 || amount > 1000000) throw new Error('积分必须是 1 到 1000000 的整数');
    const from = players.find(p => p.id === fromId);
    const to = players.find(p => p.id === toId);
    if (!from || !to || from === to) throw new Error('请选择两位不同的玩家');
    if (!Number.isSafeInteger(from.score - amount) || !Number.isSafeInteger(to.score + amount)) throw new Error('累计积分超出范围');
    from.score -= amount;
    to.score += amount;
    return { from: from.name, to: to.name, fromId, toId, amount };
  }
  function settlement(players) {
    if (players.reduce((sum, p) => sum + p.score, 0) !== 0) throw new Error('积分合计异常，请先核对记录');
    const debtors = players.filter(p => p.score < 0).map(p => ({ name: p.name, balance: -p.score }));
    const creditors = players.filter(p => p.score > 0).map(p => ({ name: p.name, balance: p.score }));
    const result = [];
    let i = 0, j = 0;
    while (i < debtors.length && j < creditors.length) {
      const amount = Math.min(debtors[i].balance, creditors[j].balance);
      result.push({ from: debtors[i].name, to: creditors[j].name, amount });
      debtors[i].balance -= amount; creditors[j].balance -= amount;
      if (!debtors[i].balance) i++;
      if (!creditors[j].balance) j++;
    }
    return result;
  }
  return { transfer, settlement };
});
