#!/usr/bin/env node
"use strict";

var assert = require("assert");
var path = require("path");
var SD = require(path.join(__dirname, "..", "engine.js"));

var passed = 0;
var failed = 0;
var current = "";

function test(name, fn) {
  current = name;
  try {
    fn();
    passed += 1;
    console.log("  ok  " + name);
  } catch (err) {
    failed += 1;
    console.log("  FAIL  " + name);
    console.log("        " + (err && err.message ? err.message : err));
  }
}

function game() {
  return SD.createGame({ names: ["Dice", "Curb", "Ace", "Wall"], bankroll: 200 });
}

function mustOk(res, hint) {
  assert.ok(res.ok, (hint || "expected ok") + " — " + (res.error || ""));
  return res.state;
}

function money(state) {
  return SD.moneyInPlay(state);
}

test("createGame starts come-out with four stacks", function () {
  var s = game();
  assert.strictEqual(s.phase, "comeout");
  assert.strictEqual(s.point, null);
  assert.strictEqual(s.players.length, 4);
  assert.strictEqual(s.shooterId, "p1");
  assert.strictEqual(SD.bankSum(s), 800);
  assert.strictEqual(SD.escrowTotal(s), 0);
});

test("cannot post more than bankroll or a negative number", function () {
  var s = game();
  assert.strictEqual(SD.postLine(s, "p1", 201).ok, false);
  assert.strictEqual(SD.postLine(s, "p1", 0).ok, false);
  assert.strictEqual(SD.postLine(s, "p1", -10).ok, false);
  assert.strictEqual(SD.postLine(s, "p1", 1.5).ok, false);
  assert.strictEqual(SD.player(s, "p1").bankroll, 200);
});

test("only shooter posts; shooter cannot fade themselves", function () {
  var s = game();
  assert.strictEqual(SD.postLine(s, "p2", 10).ok, false);
  s = mustOk(SD.postLine(s, "p1", 20));
  assert.strictEqual(SD.fadeLine(s, "p1", 20).ok, false);
  assert.strictEqual(SD.player(s, "p1").bankroll, 180);
  assert.strictEqual(s.line.amount, 20);
});

test("partial fade blocks the roll until the line is covered", function () {
  var s = game();
  s = mustOk(SD.postLine(s, "p1", 30));
  s = mustOk(SD.fadeLine(s, "p2", 10));
  assert.strictEqual(SD.lineRemaining(s), 20);
  assert.strictEqual(SD.canRoll(s), false);
  assert.strictEqual(SD.settleRoll(s, 3, 4).ok, false);
  s = mustOk(SD.fadeLine(s, "p3", 20));
  assert.strictEqual(SD.canRoll(s), true);
  assert.strictEqual(SD.lineRemaining(s), 0);
});

test("fade will not take more than the remaining line or bankroll", function () {
  var s = game();
  s = mustOk(SD.postLine(s, "p1", 15));
  s = mustOk(SD.fadeLine(s, "p2", 100));
  assert.strictEqual(SD.fadedTotal(s), 15);
  assert.strictEqual(SD.player(s, "p2").bankroll, 185);
  assert.strictEqual(SD.fadeLine(s, "p3", 5).ok, false);
});

test("come-out 7 pays the shooter even money and keeps the dice", function () {
  var s = game();
  var start = money(s);
  s = mustOk(SD.postLine(s, "p1", 20));
  s = mustOk(SD.fadeLine(s, "p2", 20));
  s = mustOk(SD.settleRoll(s, 3, 4));
  assert.strictEqual(s.lastSettlement.result, "natural");
  assert.strictEqual(SD.player(s, "p1").bankroll, 220);
  assert.strictEqual(SD.player(s, "p2").bankroll, 180);
  assert.strictEqual(s.shooterId, "p1");
  assert.strictEqual(s.phase, "comeout");
  assert.strictEqual(s.line.amount, 0);
  assert.strictEqual(money(s), start);
});

test("come-out 11 is a natural", function () {
  var s = game();
  s = mustOk(SD.postLine(s, "p1", 10));
  s = mustOk(SD.fadeLine(s, "p2", 10));
  s = mustOk(SD.settleRoll(s, 5, 6));
  assert.strictEqual(s.lastSettlement.result, "natural");
  assert.strictEqual(SD.player(s, "p1").bankroll, 210);
});

test("come-out 2/3/12 fade wins and shooter keeps the rocks", function () {
  [ [1, 1], [1, 2], [6, 6] ].forEach(function (dice) {
    var s = game();
    var start = money(s);
    s = mustOk(SD.postLine(s, "p1", 25));
    s = mustOk(SD.fadeLine(s, "p3", 25));
    s = mustOk(SD.settleRoll(s, dice[0], dice[1]));
    assert.strictEqual(s.lastSettlement.result, "craps");
    assert.strictEqual(SD.player(s, "p1").bankroll, 175);
    assert.strictEqual(SD.player(s, "p3").bankroll, 225);
    assert.strictEqual(s.shooterId, "p1");
    assert.strictEqual(money(s), start);
  });
});

test("other come-out totals set the point", function () {
  var s = game();
  s = mustOk(SD.postLine(s, "p1", 10));
  s = mustOk(SD.fadeLine(s, "p2", 10));
  s = mustOk(SD.settleRoll(s, 4, 4));
  assert.strictEqual(s.phase, "point");
  assert.strictEqual(s.point, 8);
  assert.strictEqual(s.line.amount, 10);
  assert.strictEqual(SD.fadedTotal(s), 10);
});

test("point hit pays pass; idle rolls leave the pot; seven-out passes the dice", function () {
  var s = game();
  s = mustOk(SD.postLine(s, "p1", 20));
  s = mustOk(SD.fadeLine(s, "p2", 10));
  s = mustOk(SD.fadeLine(s, "p3", 10));
  s = mustOk(SD.settleRoll(s, 3, 3));
  assert.strictEqual(s.point, 6);
  s = mustOk(SD.settleRoll(s, 2, 3));
  assert.strictEqual(s.lastSettlement.result, "idle");
  assert.strictEqual(s.point, 6);
  s = mustOk(SD.settleRoll(s, 1, 5));
  assert.strictEqual(s.lastSettlement.result, "hit");
  assert.strictEqual(SD.player(s, "p1").bankroll, 220);
  assert.strictEqual(SD.player(s, "p2").bankroll, 190);
  assert.strictEqual(SD.player(s, "p3").bankroll, 190);
  assert.strictEqual(s.shooterId, "p1");
  assert.strictEqual(s.phase, "comeout");

  s = game();
  s = mustOk(SD.postLine(s, "p1", 20));
  s = mustOk(SD.fadeLine(s, "p2", 20));
  s = mustOk(SD.settleRoll(s, 4, 2));
  s = mustOk(SD.settleRoll(s, 3, 4));
  assert.strictEqual(s.lastSettlement.result, "seven-out");
  assert.strictEqual(s.shooterId, "p2");
  assert.strictEqual(s.actingId, "p2");
  assert.strictEqual(SD.player(s, "p1").bankroll, 180);
  assert.strictEqual(SD.player(s, "p2").bankroll, 220);
});

test("broke shooter is skipped when the dice move", function () {
  var s = game();
  SD.player(s, "p2").bankroll = 0;
  s = mustOk(SD.postLine(s, "p1", 20));
  s = mustOk(SD.fadeLine(s, "p3", 20));
  s = mustOk(SD.settleRoll(s, 5, 1));
  s = mustOk(SD.settleRoll(s, 2, 5));
  assert.strictEqual(s.shooterId, "p3");
});

test("cannot post more line after the point is up", function () {
  var s = game();
  s = mustOk(SD.postLine(s, "p1", 10));
  s = mustOk(SD.fadeLine(s, "p2", 10));
  s = mustOk(SD.settleRoll(s, 2, 2));
  assert.strictEqual(SD.postLine(s, "p1", 10).ok, false);
});

test("cut line refunds the unfaded piece; pull refunds an unfaded line", function () {
  var s = game();
  s = mustOk(SD.postLine(s, "p1", 40));
  s = mustOk(SD.fadeLine(s, "p2", 10));
  s = mustOk(SD.cutLine(s, "p1"));
  assert.strictEqual(s.line.amount, 10);
  assert.strictEqual(SD.player(s, "p1").bankroll, 190);
  assert.strictEqual(SD.canRoll(s), true);

  s = game();
  s = mustOk(SD.postLine(s, "p1", 15));
  s = mustOk(SD.pullLine(s, "p1"));
  assert.strictEqual(SD.player(s, "p1").bankroll, 200);
  assert.strictEqual(s.line.amount, 0);
});

test("true odds table matches the street numbers", function () {
  assert.deepStrictEqual(SD.oddsPair("hits", 4), [2, 1]);
  assert.deepStrictEqual(SD.oddsPair("hits", 10), [2, 1]);
  assert.deepStrictEqual(SD.oddsPair("hits", 5), [3, 2]);
  assert.deepStrictEqual(SD.oddsPair("hits", 9), [3, 2]);
  assert.deepStrictEqual(SD.oddsPair("hits", 6), [6, 5]);
  assert.deepStrictEqual(SD.oddsPair("hits", 8), [6, 5]);
  assert.deepStrictEqual(SD.oddsPair("dont", 6), [5, 6]);
  assert.deepStrictEqual(SD.oddsPair("next7", null), [5, 1]);
  assert.deepStrictEqual(SD.oddsPair("next11", null), [17, 1]);
  assert.deepStrictEqual(SD.oddsPair("craps", null), [8, 1]);
  assert.deepStrictEqual(SD.oddsPair("hard6", null), [10, 1]);
  assert.deepStrictEqual(SD.oddsPair("hard4", null), [8, 1]);
});

test("hits / don't require a point and a legal stake unit", function () {
  var s = game();
  assert.strictEqual(SD.offerBet(s, "p2", "hits", 10).ok, false);
  s = mustOk(SD.postLine(s, "p1", 10));
  s = mustOk(SD.fadeLine(s, "p2", 10));
  s = mustOk(SD.settleRoll(s, 3, 3));
  assert.strictEqual(s.point, 6);
  assert.strictEqual(SD.offerBet(s, "p2", "hits", 6).ok, false);
  s = mustOk(SD.offerBet(s, "p2", "hits", 10));
  assert.strictEqual(s.bets[0].coverNeeded, 12);
  assert.strictEqual(SD.player(s, "p2").bankroll, 180);
});

test("matched hits pays true odds; seven-out pays the fader", function () {
  var s = game();
  var start = money(s);
  s = mustOk(SD.postLine(s, "p1", 10));
  s = mustOk(SD.fadeLine(s, "p2", 10));
  s = mustOk(SD.settleRoll(s, 4, 1));
  s = mustOk(SD.offerBet(s, "p3", "hits", 10));
  s = mustOk(SD.coverBet(s, s.bets[0].id, "p4", 15));
  assert.strictEqual(s.bets[0].status, "live");
  s = mustOk(SD.settleRoll(s, 2, 3));
  assert.strictEqual(SD.player(s, "p3").bankroll, 215);
  assert.strictEqual(SD.player(s, "p4").bankroll, 185);
  assert.strictEqual(money(s), start);

  s = game();
  start = money(s);
  s = mustOk(SD.postLine(s, "p1", 10));
  s = mustOk(SD.fadeLine(s, "p2", 10));
  s = mustOk(SD.settleRoll(s, 4, 1));
  s = mustOk(SD.offerBet(s, "p3", "hits", 10));
  s = mustOk(SD.coverBet(s, s.bets[0].id, "p4", 15));
  s = mustOk(SD.settleRoll(s, 3, 4));
  assert.strictEqual(SD.player(s, "p3").bankroll, 190);
  assert.strictEqual(SD.player(s, "p4").bankroll, 210);
  assert.strictEqual(s.shooterId, "p2");
  assert.strictEqual(money(s), start);
});

test("he-don't is the inverse side at true odds", function () {
  var s = game();
  s = mustOk(SD.postLine(s, "p1", 10));
  s = mustOk(SD.fadeLine(s, "p2", 10));
  s = mustOk(SD.settleRoll(s, 4, 4));
  assert.strictEqual(s.point, 8);
  s = mustOk(SD.offerBet(s, "p3", "dont", 12));
  assert.strictEqual(s.bets[0].coverNeeded, 10);
  s = mustOk(SD.coverBet(s, s.bets[0].id, "p4", 10));
  s = mustOk(SD.settleRoll(s, 3, 4));
  assert.strictEqual(SD.player(s, "p3").bankroll, 210);
  assert.strictEqual(SD.player(s, "p4").bankroll, 190);
});

test("next-roll 7 / 11 / craps resolve on this throw only", function () {
  var s = game();
  var start = money(s);
  s = mustOk(SD.postLine(s, "p1", 10));
  s = mustOk(SD.fadeLine(s, "p2", 10));
  s = mustOk(SD.offerBet(s, "p3", "next7", 10));
  s = mustOk(SD.coverBet(s, s.bets[0].id, "p4", 50));
  s = mustOk(SD.settleRoll(s, 2, 5));
  assert.strictEqual(SD.player(s, "p3").bankroll, 250);
  assert.strictEqual(SD.player(s, "p4").bankroll, 150);
  assert.strictEqual(s.bets.length, 0);
  assert.strictEqual(money(s), start);

  s = game();
  s = mustOk(SD.postLine(s, "p1", 10));
  s = mustOk(SD.fadeLine(s, "p2", 10));
  s = mustOk(SD.offerBet(s, "p3", "next11", 5));
  s = mustOk(SD.coverBet(s, s.bets[0].id, "p4", 85));
  s = mustOk(SD.settleRoll(s, 1, 2));
  assert.strictEqual(SD.player(s, "p3").bankroll, 195);
  assert.strictEqual(SD.player(s, "p4").bankroll, 205);

  s = game();
  s = mustOk(SD.postLine(s, "p1", 10));
  s = mustOk(SD.fadeLine(s, "p2", 10));
  s = mustOk(SD.offerBet(s, "p3", "craps", 10));
  s = mustOk(SD.coverBet(s, s.bets[0].id, "p4", 80));
  s = mustOk(SD.settleRoll(s, 6, 6));
  assert.strictEqual(SD.player(s, "p3").bankroll, 280);
});

test("hardways win only on the pair; lose on easy or 7", function () {
  var s = game();
  s = mustOk(SD.postLine(s, "p1", 10));
  s = mustOk(SD.fadeLine(s, "p2", 10));
  s = mustOk(SD.settleRoll(s, 2, 2));
  s = mustOk(SD.offerBet(s, "p3", "hard8", 10));
  s = mustOk(SD.coverBet(s, s.bets[0].id, "p4", 100));
  s = mustOk(SD.settleRoll(s, 3, 2));
  assert.strictEqual(s.bets.length, 1);
  s = mustOk(SD.settleRoll(s, 4, 4));
  assert.strictEqual(s.bets.length, 0);
  assert.strictEqual(SD.player(s, "p3").bankroll, 300);

  s = game();
  s = mustOk(SD.postLine(s, "p1", 10));
  s = mustOk(SD.fadeLine(s, "p2", 10));
  s = mustOk(SD.settleRoll(s, 2, 2));
  s = mustOk(SD.offerBet(s, "p3", "hard8", 10));
  s = mustOk(SD.coverBet(s, s.bets[0].id, "p4", 100));
  s = mustOk(SD.settleRoll(s, 2, 6));
  assert.strictEqual(s.bets.length, 0);
  assert.strictEqual(SD.player(s, "p3").bankroll, 190);
  assert.strictEqual(SD.player(s, "p4").bankroll, 210);
});

test("you cannot cover your own room bet; cancel refunds unmatched", function () {
  var s = game();
  s = mustOk(SD.offerBet(s, "p2", "next7", 10));
  assert.strictEqual(SD.coverBet(s, s.bets[0].id, "p2", 50).ok, false);
  s = mustOk(SD.cancelBet(s, s.bets[0].id, "p2"));
  assert.strictEqual(SD.player(s, "p2").bankroll, 200);
  assert.strictEqual(s.bets.length, 0);
});

test("busy flag and hydrate reject bad saves", function () {
  var s = game();
  s = mustOk(SD.setBusy(s, true));
  assert.strictEqual(SD.postLine(s, "p1", 10).ok, false);
  var snap = SD.snapshot(s);
  assert.strictEqual(snap.version, 2);
  var loaded = SD.hydrate(snap);
  assert.strictEqual(loaded.busy, false);
  assert.strictEqual(SD.hydrate({ version: 1, state: s }), null);
  assert.strictEqual(SD.hydrate({ version: 2, state: {} }), null);
});

test("money is conserved across a mixed hand", function () {
  var s = game();
  var start = money(s);
  s = mustOk(SD.postLine(s, "p1", 40));
  s = mustOk(SD.fadeLine(s, "p2", 25));
  s = mustOk(SD.fadeLine(s, "p3", 15));
  s = mustOk(SD.offerBet(s, "p4", "craps", 5));
  s = mustOk(SD.coverBet(s, s.bets[0].id, "p2", 40));
  assert.strictEqual(money(s), start);
  s = mustOk(SD.settleRoll(s, 2, 2));
  assert.strictEqual(s.point, 4);
  assert.strictEqual(money(s), start);
  s = mustOk(SD.offerBet(s, "p3", "hits", 10));
  s = mustOk(SD.coverBet(s, s.bets[0].id, "p4", 20));
  s = mustOk(SD.offerBet(s, "p2", "hard4", 5));
  s = mustOk(SD.coverBet(s, s.bets[s.bets.length - 1].id, "p3", 40));
  assert.strictEqual(money(s), start);
  s = mustOk(SD.settleRoll(s, 5, 4));
  assert.strictEqual(s.lastSettlement.result, "idle");
  assert.strictEqual(money(s), start);
  s = mustOk(SD.settleRoll(s, 1, 3));
  assert.strictEqual(s.lastSettlement.result, "hit");
  assert.strictEqual(money(s), start);
  assert.ok(!SD.validateState(s));
  for (var i = 0; i < s.players.length; i++) {
    assert.ok(s.players[i].bankroll >= 0, s.players[i].name + " went negative");
  }
});

test("cannot remove a player who still has money in the pot", function () {
  var s = game();
  s = mustOk(SD.postLine(s, "p1", 10));
  assert.strictEqual(SD.removePlayer(s, "p1").ok, false);
  s = mustOk(SD.fadeLine(s, "p2", 10));
  assert.strictEqual(SD.removePlayer(s, "p2").ok, false);
  s = mustOk(SD.addPlayer(s, "Chalk"));
  assert.strictEqual(s.players.length, 5);
  s = mustOk(SD.removePlayer(s, s.players[4].id));
  assert.strictEqual(s.players.length, 4);
});

test("preview payouts for a $10 hit on 6", function () {
  var prev = SD.previewPayout("hits", 10, 6);
  assert.ok(prev.ok);
  assert.strictEqual(prev.cover, 12);
  assert.strictEqual(prev.odds, "6:5");
  assert.strictEqual(prev.winIfHit, 22);
});

console.log("\n" + passed + " passed, " + failed + " failed");
process.exit(failed ? 1 : 0);
