const { test } = require('node:test');
const assert = require('node:assert/strict');
const { transfer, settlement } = require('../score-core');
test('transfers preserve total and reject invalid amounts without mutation', () => {
  const players = [{ id: 'a', name: '甲', score: 0 }, { id: 'b', name: '乙', score: 0 }];
  for (const amount of [NaN, Infinity, -1, 0, 1.5, '5', 1000001]) {
    assert.throws(() => transfer(players, 'a', 'b', amount));
    assert.equal(players[0].score, 0);
  }
  transfer(players, 'a', 'b', 12);
  assert.deepEqual(players.map(p => p.score), [-12, 12]);
  assert.throws(() => transfer(players, 'a', 'a', 1));
});
test('settlement clears every balance with suggested transfers', () => {
  const players = [{ name: '甲', score: -30 }, { name: '乙', score: -10 }, { name: '丙', score: 25 }, { name: '丁', score: 15 }];
  const balances = Object.fromEntries(players.map(p => [p.name, p.score]));
  for (const item of settlement(players)) { balances[item.from] += item.amount; balances[item.to] -= item.amount; }
  assert.deepEqual(Object.values(balances), [0, 0, 0, 0]);
  assert.throws(() => settlement([{ name: '甲', score: 1 }]));
});
