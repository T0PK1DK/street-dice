/**
 * Street Dice — player-banked street craps engine.
 * Works in the browser (window.StreetDice) and in Node (module.exports).
 * No DOM. All money is integer dollars. Bankrolls never go negative.
 */
(function (root, factory) {
  var api = factory();
  if (typeof module === "object" && module.exports) {
    module.exports = api;
  }
  root.StreetDice = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  var SAVE_VERSION = 2;
  var SAVE_KEY = "street-dice-v2";
  var STARTING_BANK = 200;
  var DEFAULT_NAMES = ["Dice", "Curb", "Ace", "Wall"];
  var EXTRA_NAMES = ["Chalk", "Boxcars", "Cee-Lo", "Alley"];
  var COLORS = ["#e8c36a", "#7ec8e3", "#f0a07a", "#9ad0a0", "#d4a5e8", "#f2d08b", "#f5c6aa", "#b8d4e8"];

  var BET_TYPES = {
    hits: {
      id: "hits",
      label: "He hits",
      group: "point",
      needsPoint: true,
      oneRoll: false
    },
    dont: {
      id: "dont",
      label: "He don't",
      group: "point",
      needsPoint: true,
      oneRoll: false
    },
    next7: {
      id: "next7",
      label: "Next roll 7",
      group: "next",
      needsPoint: false,
      oneRoll: true
    },
    next11: {
      id: "next11",
      label: "Next roll 11",
      group: "next",
      needsPoint: false,
      oneRoll: true
    },
    craps: {
      id: "craps",
      label: "Any craps",
      group: "next",
      needsPoint: false,
      oneRoll: true
    },
    hard4: {
      id: "hard4",
      label: "Hard 4",
      group: "hard",
      needsPoint: false,
      oneRoll: false,
      number: 4
    },
    hard6: {
      id: "hard6",
      label: "Hard 6",
      group: "hard",
      needsPoint: false,
      oneRoll: false,
      number: 6
    },
    hard8: {
      id: "hard8",
      label: "Hard 8",
      group: "hard",
      needsPoint: false,
      oneRoll: false,
      number: 8
    },
    hard10: {
      id: "hard10",
      label: "Hard 10",
      group: "hard",
      needsPoint: false,
      oneRoll: false,
      number: 10
    }
  };

  function clone(obj) {
    return JSON.parse(JSON.stringify(obj));
  }

  function ok(state, extra) {
    var out = { ok: true, error: null, state: state };
    if (extra) {
      for (var k in extra) {
        if (Object.prototype.hasOwnProperty.call(extra, k)) out[k] = extra[k];
      }
    }
    return out;
  }

  function fail(state, error) {
    return { ok: false, error: error, state: state };
  }

  function nextId(state, prefix) {
    state.nextId += 1;
    return (prefix || "id") + "_" + state.nextId;
  }

  function player(state, id) {
    for (var i = 0; i < state.players.length; i++) {
      if (state.players[i].id === id) return state.players[i];
    }
    return null;
  }

  function playerName(state, id) {
    var p = player(state, id);
    return p ? p.name : "Somebody";
  }

  function shooter(state) {
    return player(state, state.shooterId);
  }

  function fadedTotal(state) {
    var n = 0;
    for (var i = 0; i < state.line.covers.length; i++) n += state.line.covers[i].amount;
    return n;
  }

  function lineRemaining(state) {
    return Math.max(0, state.line.amount - fadedTotal(state));
  }

  function lineCovered(state) {
    return state.line.amount > 0 && lineRemaining(state) === 0;
  }

  function canRoll(state) {
    return !state.busy && lineCovered(state);
  }

  function isCraps(total) {
    return total === 2 || total === 3 || total === 12;
  }

  function isNatural(total) {
    return total === 7 || total === 11;
  }

  function isHard(d1, d2) {
    return d1 === d2;
  }

  function oddsPair(type, point) {
    if (type === "hits" || type === "dont") {
      if (point === 4 || point === 10) return type === "hits" ? [2, 1] : [1, 2];
      if (point === 5 || point === 9) return type === "hits" ? [3, 2] : [2, 3];
      if (point === 6 || point === 8) return type === "hits" ? [6, 5] : [5, 6];
      return null;
    }
    if (type === "next7") return [5, 1];
    if (type === "next11") return [17, 1];
    if (type === "craps") return [8, 1];
    if (type === "hard4" || type === "hard10") return [8, 1];
    if (type === "hard6" || type === "hard8") return [10, 1];
    return null;
  }

  function oddsLabel(type, point) {
    var pair = oddsPair(type, point);
    if (!pair) return "—";
    return pair[0] + ":" + pair[1];
  }

  function betKind(type) {
    var spec = BET_TYPES[type];
    if (!spec) return "Side";
    return spec.group === "point" ? "Room" : "Side";
  }

  function rollNick(d1, d2) {
    var total = d1 + d2;
    var hard = isHard(d1, d2);
    if (total === 2) return "Snake eyes";
    if (total === 3) return "Ace-deuce";
    if (total === 11) return "Yo-leven";
    if (total === 12) return "Boxcars";
    if (total === 7) return "Seven";
    if (hard && (total === 4 || total === 6 || total === 8 || total === 10)) return "Hard " + total;
    if (total === 4 || total === 6 || total === 8 || total === 10) return "Easy " + total;
    return String(total);
  }

  function rollCallout(d1, d2, result, point) {
    var total = d1 + d2;
    var nick = rollNick(d1, d2);
    var line = nick + " · " + total;
    if (result === "natural") line = nick + " — pass";
    else if (result === "craps") line = nick + " — craps";
    else if (result === "point") line = nick + " — point is " + total;
    else if (result === "hit") line = nick + " — point!";
    else if (result === "seven-out") line = nick + " — seven out";
    else if (result === "idle" && point) line = nick + " · looking for " + point;
    return { total: total, nick: nick, line: line, result: result || "" };
  }

  function coverForStake(type, stake, point) {
    stake = intAmt(stake);
    if (stake === null) return { ok: false, error: "Need a whole-dollar stake." };
    var pair = oddsPair(type, point);
    if (!pair) return { ok: false, error: "No point yet for that action." };
    var against = pair[0];
    var fav = pair[1];
    if (stake % fav !== 0) {
      return {
        ok: false,
        error: "Stake has to be a multiple of $" + fav + " for " + oddsLabel(type, point) + " odds."
      };
    }
    return { ok: true, cover: (stake / fav) * against, against: against, for: fav };
  }

  function previewPayout(type, stake, point) {
    var spec = BET_TYPES[type];
    if (!spec) return { ok: false, error: "Unknown bet." };
    var usedPoint = spec.needsPoint ? point : null;
    var cov = coverForStake(type, stake, spec.needsPoint ? point : 4);
    if (spec.needsPoint && !point) {
      return { ok: false, error: "Wait for a point before taking hits / don't." };
    }
    if (!cov.ok) return cov;
    return {
      ok: true,
      type: type,
      label: spec.label,
      stake: intAmt(stake),
      cover: cov.cover,
      pot: intAmt(stake) + cov.cover,
      odds: oddsLabel(type, spec.needsPoint ? point : usedPoint),
      unit: cov.for,
      winIfHit: intAmt(stake) + cov.cover,
      profitIfHit: cov.cover,
      covererProfitIfMiss: intAmt(stake)
    };
  }

  function intAmt(n) {
    if (typeof n === "string" && n.trim() === "") return null;
    var x = typeof n === "number" ? n : parseInt(n, 10);
    if (!isFinite(x) || x !== Math.floor(x)) return null;
    return x;
  }

  function debit(p, amount, err) {
    if (amount <= 0) return err || "Nothing to put down.";
    if (p.bankroll < amount) return (p.name || "That stack") + " is light — only $" + p.bankroll + " left.";
    p.bankroll -= amount;
    return null;
  }

  function credit(p, amount) {
    p.bankroll += amount;
  }

  function escrowTotal(state) {
    var n = state.line.amount + fadedTotal(state);
    var bets = state.bets;
    for (var i = 0; i < bets.length; i++) {
      n += betEscrow(bets[i]);
    }
    return n;
  }

  function betEscrow(bet) {
    var n = bet.stake - bet.refundedStake;
    for (var i = 0; i < bet.covers.length; i++) n += bet.covers[i].amount;
    return n;
  }

  function bankSum(state) {
    var n = 0;
    for (var i = 0; i < state.players.length; i++) n += state.players[i].bankroll;
    return n;
  }

  function moneyInPlay(state) {
    return bankSum(state) + escrowTotal(state);
  }

  function createGame(opts) {
    opts = opts || {};
    var names = opts.names || DEFAULT_NAMES.slice();
    var bank = opts.bankroll != null ? opts.bankroll : STARTING_BANK;
    var players = [];
    for (var i = 0; i < names.length; i++) {
      players.push({
        id: "p" + (i + 1),
        name: String(names[i]).trim() || "Player " + (i + 1),
        bankroll: bank,
        color: COLORS[i % COLORS.length]
      });
    }
    var state = {
      version: SAVE_VERSION,
      players: players,
      shooterId: players[0].id,
      actingId: players[0].id,
      phase: "comeout",
      point: null,
      line: { amount: 0, covers: [] },
      bets: [],
      rollHistory: [],
      lastSettlement: null,
      busy: false,
      muted: false,
      nextId: players.length,
      createdAt: Date.now()
    };
    return state;
  }

  function setActing(state, playerId) {
    state = clone(state);
    if (!player(state, playerId)) return fail(state, "Nobody like that at this wall.");
    state.actingId = playerId;
    return ok(state);
  }

  function setMuted(state, muted) {
    state = clone(state);
    state.muted = !!muted;
    return ok(state);
  }

  function setBusy(state, busy) {
    state = clone(state);
    state.busy = !!busy;
    return ok(state);
  }

  function renamePlayer(state, playerId, name) {
    state = clone(state);
    var p = player(state, playerId);
    if (!p) return fail(state, "Can't rename a ghost.");
    name = String(name || "").trim();
    if (!name) return fail(state, "Need a street name.");
    if (name.length > 16) return fail(state, "Keep the name short — 16 letters max.");
    p.name = name;
    return ok(state);
  }

  function addPlayer(state, name) {
    state = clone(state);
    if (state.players.length >= 8) return fail(state, "Wall's crowded. Eight is plenty.");
    name = String(name || "").trim();
    if (!name) {
      var used = {};
      for (var i = 0; i < state.players.length; i++) used[state.players[i].name] = true;
      var pool = DEFAULT_NAMES.concat(EXTRA_NAMES);
      for (var j = 0; j < pool.length; j++) {
        if (!used[pool[j]]) {
          name = pool[j];
          break;
        }
      }
      if (!name) name = "Kid " + (state.players.length + 1);
    }
    var p = {
      id: nextId(state, "p"),
      name: name,
      bankroll: STARTING_BANK,
      color: COLORS[state.players.length % COLORS.length]
    };
    state.players.push(p);
    return ok(state, { player: p });
  }

  function playerHasEscrow(state, playerId) {
    if (state.shooterId === playerId && state.line.amount > 0) return true;
    for (var i = 0; i < state.line.covers.length; i++) {
      if (state.line.covers[i].playerId === playerId) return true;
    }
    for (var b = 0; b < state.bets.length; b++) {
      var bet = state.bets[b];
      if (bet.fromId === playerId && betEscrow(bet) > 0) return true;
      for (var c = 0; c < bet.covers.length; c++) {
        if (bet.covers[c].playerId === playerId) return true;
      }
    }
    return false;
  }

  function removePlayer(state, playerId) {
    state = clone(state);
    if (state.players.length <= 2) return fail(state, "Need at least two people to fade each other.");
    if (playerHasEscrow(state, playerId)) {
      return fail(state, "Cash them out of the pot first — they've still got money down.");
    }
    var idx = -1;
    for (var i = 0; i < state.players.length; i++) {
      if (state.players[i].id === playerId) idx = i;
    }
    if (idx < 0) return fail(state, "They're not on this wall.");
    state.players.splice(idx, 1);
    if (state.shooterId === playerId) state.shooterId = nextShooterId(state, playerId);
    if (state.actingId === playerId) state.actingId = state.shooterId;
    return ok(state);
  }

  function rebuy(state, playerId, amount) {
    state = clone(state);
    var p = player(state, playerId);
    if (!p) return fail(state, "Nobody to rebuy.");
    amount = intAmt(amount);
    if (amount === null || amount <= 0) return fail(state, "Rebuy has to be real money.");
    if (amount > 5000) return fail(state, "Keep the rebuy under $5000. This is a curb, not a vault.");
    p.bankroll += amount;
    return ok(state);
  }

  function nextShooterId(state, fromId) {
    var start = 0;
    for (var i = 0; i < state.players.length; i++) {
      if (state.players[i].id === fromId) {
        start = i;
        break;
      }
    }
    for (var step = 1; step <= state.players.length; step++) {
      var p = state.players[(start + step) % state.players.length];
      if (p.bankroll > 0) return p.id;
    }
    return state.players[(start + 1) % state.players.length].id;
  }

  function passDice(state) {
    state.shooterId = nextShooterId(state, state.shooterId);
    state.actingId = state.shooterId;
  }

  function postLine(state, playerId, amount) {
    state = clone(state);
    if (state.busy) return fail(state, "Dice are in the air.");
    if (state.phase !== "comeout") {
      return fail(state, "Line's locked once the point is up. Take room action instead.");
    }
    var p = player(state, playerId);
    if (!p) return fail(state, "Who's posting?");
    if (p.id !== state.shooterId) return fail(state, "Only the shooter posts the line.");
    amount = intAmt(amount);
    if (amount === null || amount <= 0) return fail(state, "Put a real number on the line.");
    var err = debit(p, amount);
    if (err) return fail(state, err);
    state.line.amount += amount;
    return ok(state, { posted: amount });
  }

  function fadeLine(state, playerId, amount) {
    state = clone(state);
    if (state.busy) return fail(state, "Dice are in the air.");
    var p = player(state, playerId);
    if (!p) return fail(state, "Who's fading?");
    if (p.id === state.shooterId) return fail(state, "Shooter can't fade their own line.");
    if (state.line.amount <= 0) return fail(state, "Nothing on the line to fade.");
    var need = lineRemaining(state);
    if (need <= 0) return fail(state, "Line's already covered.");
    amount = intAmt(amount);
    if (amount === null || amount <= 0) return fail(state, "Fade a real amount.");
    var take = Math.min(amount, need, p.bankroll);
    if (take <= 0) return fail(state, p.name + " is light.");
    var err = debit(p, take);
    if (err) return fail(state, err);
    var found = null;
    for (var i = 0; i < state.line.covers.length; i++) {
      if (state.line.covers[i].playerId === p.id) found = state.line.covers[i];
    }
    if (found) found.amount += take;
    else state.line.covers.push({ playerId: p.id, amount: take });
    return ok(state, { faded: take, remaining: lineRemaining(state) });
  }

  function cutLine(state, playerId) {
    state = clone(state);
    if (state.busy) return fail(state, "Dice are in the air.");
    if (state.phase !== "comeout") return fail(state, "Can't cut the line after the point's up.");
    if (playerId !== state.shooterId) return fail(state, "Only the shooter can cut the line.");
    var faded = fadedTotal(state);
    if (state.line.amount <= faded) return fail(state, "Nothing extra to cut.");
    if (faded <= 0) return fail(state, "Nobody's faded yet — pull the whole line instead.");
    var refund = state.line.amount - faded;
    credit(shooter(state), refund);
    state.line.amount = faded;
    return ok(state, { refunded: refund });
  }

  function pullLine(state, playerId) {
    state = clone(state);
    if (state.busy) return fail(state, "Dice are in the air.");
    if (state.phase !== "comeout") return fail(state, "Can't yank the line after the come-out.");
    if (playerId !== state.shooterId) return fail(state, "Only the shooter pulls the line.");
    if (fadedTotal(state) > 0) {
      return fail(state, "Somebody already faded. Cut it down to what's covered, or roll.");
    }
    if (state.line.amount <= 0) return fail(state, "Line's already empty.");
    credit(shooter(state), state.line.amount);
    var pulled = state.line.amount;
    state.line.amount = 0;
    return ok(state, { refunded: pulled });
  }

  function unpostLine(state, playerId, amount) {
    state = clone(state);
    if (state.busy) return fail(state, "Dice are in the air.");
    if (state.phase !== "comeout") return fail(state, "Line's locked once the point is up.");
    if (playerId !== state.shooterId) return fail(state, "Only the shooter can take chips back off the line.");
    var max = lineRemaining(state);
    if (max <= 0) return fail(state, "That piece is already faded.");
    amount = intAmt(amount);
    if (amount === null || amount <= 0) amount = max;
    var take = Math.min(amount, max);
    state.line.amount -= take;
    credit(shooter(state), take);
    return ok(state, { refunded: take });
  }

  function unfadeLine(state, playerId, amount) {
    state = clone(state);
    if (state.busy) return fail(state, "Dice are in the air.");
    var p = player(state, playerId);
    if (!p) return fail(state, "Who's taking the fade back?");
    var found = null;
    var idx = -1;
    for (var i = 0; i < state.line.covers.length; i++) {
      if (state.line.covers[i].playerId === p.id) {
        found = state.line.covers[i];
        idx = i;
      }
    }
    if (!found) return fail(state, "You don't have a fade down.");
    if (state.phase !== "comeout") {
      return fail(state, "Line's locked once the point is up. That fade stays until the 7 or the number.");
    }
    amount = intAmt(amount);
    if (amount === null || amount <= 0) amount = found.amount;
    var take = Math.min(amount, found.amount);
    found.amount -= take;
    if (found.amount <= 0) state.line.covers.splice(idx, 1);
    credit(p, take);
    return ok(state, { refunded: take });
  }

  function uncoverBet(state, betId, playerId, amount) {
    state = clone(state);
    if (state.busy) return fail(state, "Dice are in the air.");
    var bet = null;
    for (var i = 0; i < state.bets.length; i++) {
      if (state.bets[i].id === betId) bet = state.bets[i];
    }
    if (!bet) return fail(state, "That ticket's gone.");
    var p = player(state, playerId);
    if (!p) return fail(state, "Who's uncovering?");
    var found = null;
    var idx = -1;
    for (var c = 0; c < bet.covers.length; c++) {
      if (bet.covers[c].playerId === p.id) {
        found = bet.covers[c];
        idx = c;
      }
    }
    if (!found) return fail(state, "You didn't fade that ticket.");
    amount = intAmt(amount);
    if (amount === null || amount <= 0) amount = found.amount;
    var take = Math.min(amount, found.amount);
    found.amount -= take;
    if (found.amount <= 0) bet.covers.splice(idx, 1);
    var filled = 0;
    for (var k = 0; k < bet.covers.length; k++) filled += bet.covers[k].amount;
    if (filled < bet.coverNeeded) bet.status = "open";
    credit(p, take);
    return ok(state, { refunded: take });
  }

  function tableExposure(state) {
    var out = [];
    var i;
    var c;
    var b;
    for (i = 0; i < state.players.length; i++) {
      var p = state.players[i];
      var row = { id: p.id, name: p.name, color: p.color, bankroll: p.bankroll, line: 0, fade: 0, room: 0, onTable: 0 };
      if (p.id === state.shooterId) row.line = state.line.amount;
      for (c = 0; c < state.line.covers.length; c++) {
        if (state.line.covers[c].playerId === p.id) row.fade += state.line.covers[c].amount;
      }
      for (b = 0; b < state.bets.length; b++) {
        var bet = state.bets[b];
        if (bet.fromId === p.id) row.room += bet.stake - bet.refundedStake;
        for (c = 0; c < bet.covers.length; c++) {
          if (bet.covers[c].playerId === p.id) row.room += bet.covers[c].amount;
        }
      }
      row.onTable = row.line + row.fade + row.room;
      out.push(row);
    }
    return out;
  }

  function offerBet(state, fromId, type, stake) {
    state = clone(state);
    if (state.busy) return fail(state, "Dice are in the air.");
    var spec = BET_TYPES[type];
    if (!spec) return fail(state, "That action isn't on this wall.");
    var p = player(state, fromId);
    if (!p) return fail(state, "Who's offering?");
    if (spec.needsPoint && (state.phase !== "point" || !state.point)) {
      return fail(state, "Need a point before you take hits / don't.");
    }
    var point = spec.needsPoint ? state.point : null;
    var prev = previewPayout(type, stake, spec.needsPoint ? state.point : 4);
    if (!prev.ok) return fail(state, prev.error);
    var err = debit(p, prev.stake);
    if (err) return fail(state, err);
    var bet = {
      id: nextId(state, "b"),
      type: type,
      fromId: fromId,
      stake: prev.stake,
      refundedStake: 0,
      coverNeeded: prev.cover,
      point: point,
      covers: [],
      status: "open"
    };
    state.bets.push(bet);
    return ok(state, { bet: bet, preview: prev });
  }

  function coverBet(state, betId, covererId, amount) {
    state = clone(state);
    if (state.busy) return fail(state, "Dice are in the air.");
    var bet = null;
    for (var i = 0; i < state.bets.length; i++) {
      if (state.bets[i].id === betId) bet = state.bets[i];
    }
    if (!bet) return fail(state, "That action already walked.");
    if (bet.status !== "open") return fail(state, "That's already live.");
    var p = player(state, covererId);
    if (!p) return fail(state, "Who's covering?");
    if (p.id === bet.fromId) return fail(state, "You can't fade your own action.");
    var filled = 0;
    for (var c = 0; c < bet.covers.length; c++) filled += bet.covers[c].amount;
    var need = bet.coverNeeded - filled;
    if (need <= 0) return fail(state, "Already covered.");
    amount = intAmt(amount);
    if (amount === null || amount <= 0) amount = need;
    var take = Math.min(amount, need, p.bankroll);
    if (take <= 0) return fail(state, p.name + " is light.");
    var pair = oddsPair(bet.type, bet.point || 4);
    if (!pair) return fail(state, "Odds fell off the wall.");
    if (take % pair[0] !== 0) {
      return fail(state, "Cover has to be a multiple of $" + pair[0] + " to keep true odds.");
    }
    var err = debit(p, take);
    if (err) return fail(state, err);
    var found = null;
    for (var k = 0; k < bet.covers.length; k++) {
      if (bet.covers[k].playerId === p.id) found = bet.covers[k];
    }
    if (found) found.amount += take;
    else bet.covers.push({ playerId: p.id, amount: take });
    filled += take;
    if (filled >= bet.coverNeeded) bet.status = "live";
    return ok(state, { covered: take, remaining: Math.max(0, bet.coverNeeded - filled), live: bet.status === "live" });
  }

  function cancelBet(state, betId, playerId) {
    state = clone(state);
    if (state.busy) return fail(state, "Dice are in the air.");
    var idx = -1;
    for (var i = 0; i < state.bets.length; i++) {
      if (state.bets[i].id === betId) idx = i;
    }
    if (idx < 0) return fail(state, "Nothing to pull down.");
    var bet = state.bets[idx];
    if (playerId !== bet.fromId) return fail(state, "Only the one who offered can pull it down.");
    if (bet.covers.length > 0) {
      return fail(state, "Somebody already faded a piece. Let it ride or wait for the roll.");
    }
    credit(player(state, bet.fromId), bet.stake - bet.refundedStake);
    state.bets.splice(idx, 1);
    return ok(state);
  }

  function pay(state, settlement, playerId, amount, text, cls) {
    var p = player(state, playerId);
    if (!p || amount <= 0) return;
    credit(p, amount);
    settlement.deltas[playerId] = (settlement.deltas[playerId] || 0) + amount;
    settlement.lines.push({
      playerId: playerId,
      name: p.name,
      amount: amount,
      text: text,
      cls: cls || "info"
    });
  }

  function note(settlement, text, cls) {
    settlement.lines.push({ playerId: null, name: null, amount: 0, text: text, cls: cls || "info" });
  }

  function coveredStake(bet) {
    var filled = 0;
    for (var i = 0; i < bet.covers.length; i++) filled += bet.covers[i].amount;
    if (bet.coverNeeded <= 0) return 0;
    return Math.round((bet.stake * filled) / bet.coverNeeded);
  }

  function settleSideBet(state, settlement, bet, takerWins) {
    var filled = 0;
    var i;
    for (i = 0; i < bet.covers.length; i++) filled += bet.covers[i].amount;
    var matchedStake = coveredStake(bet);
    var unmatched = bet.stake - bet.refundedStake - matchedStake;
    if (unmatched > 0) {
      pay(state, settlement, bet.fromId, unmatched, playerName(state, bet.fromId) + " gets $" + unmatched + " unmatched stake back", "info");
    }
    if (filled <= 0 || matchedStake <= 0) {
      bet.status = "done";
      return;
    }
    if (takerWins) {
      pay(
        state,
        settlement,
        bet.fromId,
        matchedStake + filled,
        playerName(state, bet.fromId) + " scoops $" + (matchedStake + filled) + " on " + BET_TYPES[bet.type].label,
        "win"
      );
    } else {
      for (i = 0; i < bet.covers.length; i++) {
        var c = bet.covers[i];
        var shareStake = Math.round((matchedStake * c.amount) / filled);
        pay(
          state,
          settlement,
          c.playerId,
          c.amount + shareStake,
          playerName(state, c.playerId) + " fades " + BET_TYPES[bet.type].label + " and takes $" + (c.amount + shareStake),
          "win"
        );
      }
    }
    bet.status = "done";
  }

  function hardResolved(bet, d1, d2, total) {
    var n = BET_TYPES[bet.type].number;
    if (total === 7) return { done: true, takerWins: false };
    if (total === n && isHard(d1, d2)) return { done: true, takerWins: true };
    if (total === n) return { done: true, takerWins: false };
    return { done: false };
  }

  function nextResolved(bet, total) {
    if (bet.type === "next7") return { done: true, takerWins: total === 7 };
    if (bet.type === "next11") return { done: true, takerWins: total === 11 };
    if (bet.type === "craps") return { done: true, takerWins: isCraps(total) };
    return { done: false };
  }

  function settleLinePass(state, settlement) {
    var pot = state.line.amount + fadedTotal(state);
    if (pot <= 0) return;
    pay(
      state,
      settlement,
      state.shooterId,
      pot,
      playerName(state, state.shooterId) + " takes the line ($" + fadedTotal(state) + " profit)",
      "win"
    );
    state.line = { amount: 0, covers: [] };
  }

  function settleLineFade(state, settlement) {
    var covers = state.line.covers;
    for (var i = 0; i < covers.length; i++) {
      var c = covers[i];
      pay(
        state,
        settlement,
        c.playerId,
        c.amount * 2,
        playerName(state, c.playerId) + " faded and takes $" + c.amount * 2,
        "win"
      );
    }
    state.line = { amount: 0, covers: [] };
  }

  function settleHitsDont(state, settlement, pointHit) {
    for (var i = 0; i < state.bets.length; i++) {
      var bet = state.bets[i];
      if (bet.status === "done") continue;
      if (bet.type !== "hits" && bet.type !== "dont") continue;
      if (bet.covers.length === 0) {
        pay(state, settlement, bet.fromId, bet.stake - bet.refundedStake, playerName(state, bet.fromId) + " unmatched hits ticket comes down", "info");
        bet.status = "done";
        continue;
      }
      var takerWins = bet.type === "hits" ? pointHit : !pointHit;
      settleSideBet(state, settlement, bet, takerWins);
    }
  }

  function refundUnmatchedHardways(state, settlement) {
    for (var i = 0; i < state.bets.length; i++) {
      var bet = state.bets[i];
      if (bet.status === "done") continue;
      if (BET_TYPES[bet.type].group !== "hard") continue;
      if (bet.covers.length > 0) continue;
      var leftover = bet.stake - bet.refundedStake;
      if (leftover > 0) {
        pay(
          state,
          settlement,
          bet.fromId,
          leftover,
          playerName(state, bet.fromId) + " unmatched " + BET_TYPES[bet.type].label + " comes down",
          "info"
        );
      }
      bet.status = "done";
    }
  }

  function pruneBets(state) {
    var keep = [];
    for (var i = 0; i < state.bets.length; i++) {
      if (state.bets[i].status !== "done") keep.push(state.bets[i]);
    }
    state.bets = keep;
  }

  function rollDice(rng) {
    rng = rng || Math.random;
    return [1 + Math.floor(rng() * 6), 1 + Math.floor(rng() * 6)];
  }

  function settleRoll(state, d1, d2) {
    state = clone(state);
    d1 = intAmt(d1);
    d2 = intAmt(d2);
    if (d1 === null || d2 === null || d1 < 1 || d1 > 6 || d2 < 1 || d2 > 6) {
      return fail(state, "Those aren't dice.");
    }
    if (!lineCovered(state)) return fail(state, "Line isn't faded yet.");
    var total = d1 + d2;
    var settlement = {
      headline: "",
      result: "",
      d1: d1,
      d2: d2,
      total: total,
      hard: isHard(d1, d2),
      phase: state.phase,
      point: state.point,
      dicePassed: false,
      lines: [],
      deltas: {}
    };

    var i;
    var bet;
    var res;

    for (i = 0; i < state.bets.length; i++) {
      bet = state.bets[i];
      if (bet.status === "done") continue;
      if (BET_TYPES[bet.type].group === "next") {
        if (bet.covers.length === 0) {
          pay(state, settlement, bet.fromId, bet.stake - bet.refundedStake, playerName(state, bet.fromId) + " unmatched next-roll ticket comes down", "info");
          bet.status = "done";
          continue;
        }
        res = nextResolved(bet, total);
        if (res.done) settleSideBet(state, settlement, bet, res.takerWins);
      } else if (BET_TYPES[bet.type].group === "hard") {
        if (bet.covers.length === 0) continue;
        res = hardResolved(bet, d1, d2, total);
        if (res.done) settleSideBet(state, settlement, bet, res.takerWins);
      }
    }

    if (state.phase === "comeout") {
      if (isNatural(total)) {
        settlement.result = "natural";
        settlement.headline = "Natural " + total + " — " + playerName(state, state.shooterId) + " scoops the pile.";
        settleLinePass(state, settlement);
        refundUnmatchedHardways(state, settlement);
      } else if (isCraps(total)) {
        settlement.result = "craps";
        settlement.headline = "Craps " + total + ". Fade takes the pile. " + playerName(state, state.shooterId) + " keeps the rocks.";
        settleLineFade(state, settlement);
        refundUnmatchedHardways(state, settlement);
      } else {
        state.point = total;
        state.phase = "point";
        settlement.result = "point";
        settlement.headline = "Point is " + total + ". " + playerName(state, state.shooterId) + " gotta hit it before a 7.";
        note(settlement, "Money stays in the street. Room can take hits / don't at " + oddsLabel("hits", total) + ".", "info");
      }
    } else {
      if (total === state.point) {
        settlement.result = "hit";
        settlement.headline = playerName(state, state.shooterId) + " hit the " + state.point + "! Pass takes it, shooter keeps the rocks.";
        settleLinePass(state, settlement);
        settleHitsDont(state, settlement, true);
        refundUnmatchedHardways(state, settlement);
        state.point = null;
        state.phase = "comeout";
      } else if (total === 7) {
        settlement.result = "seven-out";
        settlement.headline = "Seven out. Fade takes the pile. Dice move on.";
        settleLineFade(state, settlement);
        settleHitsDont(state, settlement, false);
        refundUnmatchedHardways(state, settlement);
        state.point = null;
        state.phase = "comeout";
        passDice(state);
        settlement.dicePassed = true;
        note(settlement, playerName(state, state.shooterId) + " has the rocks now.", "info");
      } else {
        settlement.result = "idle";
        settlement.headline = total + "… still looking for " + state.point + ". No seven.";
      }
    }

    settlement.callout = rollCallout(d1, d2, settlement.result, settlement.point);

    pruneBets(state);
    state.lastSettlement = settlement;
    state.rollHistory.unshift({
      d1: d1,
      d2: d2,
      total: total,
      hard: isHard(d1, d2),
      result: settlement.result,
      phase: settlement.phase,
      point: settlement.point,
      headline: settlement.headline,
      at: Date.now()
    });
    if (state.rollHistory.length > 40) state.rollHistory.length = 40;
    state.busy = false;
    return ok(state, { settlement: settlement });
  }

  function snapshot(state) {
    var slim = clone(state);
    slim.busy = false;
    slim.version = SAVE_VERSION;
    return {
      version: SAVE_VERSION,
      key: SAVE_KEY,
      state: slim
    };
  }

  function hydrate(payload) {
    if (!payload) return null;
    var data = typeof payload === "string" ? JSON.parse(payload) : payload;
    if (!data || data.version !== SAVE_VERSION || !data.state) return null;
    var s = data.state;
    if (!s.players || !s.players.length || !s.shooterId) return null;
    s.busy = false;
    s.version = SAVE_VERSION;
    if (!s.line) s.line = { amount: 0, covers: [] };
    if (!s.bets) s.bets = [];
    if (!s.rollHistory) s.rollHistory = [];
    if (!s.actingId) s.actingId = s.shooterId;
    return s;
  }

  function resetCrew() {
    return createGame();
  }

  function describeBet(state, bet) {
    var spec = BET_TYPES[bet.type];
    var filled = 0;
    for (var i = 0; i < bet.covers.length; i++) filled += bet.covers[i].amount;
    var names = [];
    for (var c = 0; c < bet.covers.length; c++) {
      names.push(playerName(state, bet.covers[c].playerId) + " $" + bet.covers[c].amount);
    }
    return {
      kind: betKind(bet.type),
      title: spec.label + (bet.point ? " on " + bet.point : ""),
      odds: oddsLabel(bet.type, bet.point || 4),
      from: playerName(state, bet.fromId),
      stake: bet.stake,
      coverNeeded: bet.coverNeeded,
      covered: filled,
      coverers: names,
      status: bet.status
    };
  }

  function coverersSummary(state) {
    var out = [];
    for (var i = 0; i < state.line.covers.length; i++) {
      var c = state.line.covers[i];
      out.push(playerName(state, c.playerId) + " faded $" + c.amount);
    }
    return out;
  }

  function parseChip(n) {
    var x = intAmt(n);
    if (x === null || x <= 0) return { ok: false, error: "Need a whole-dollar chip." };
    if (x > 500) return { ok: false, error: "Keep a custom chip at $500 or under." };
    return { ok: true, amount: x };
  }

  function flickPower(dx, dy, dt) {
    dt = Math.max(16, Number(dt) || 16);
    dx = Number(dx) || 0;
    dy = Number(dy) || 0;
    var dist = Math.sqrt(dx * dx + dy * dy);
    var speed = dist / dt;
    if (dy >= 16 || (dist >= 20 && dy >= 8) || (speed >= 0.2 && dy > 4)) {
      return Math.min(1.7, 0.55 + dy / 220 + 280 / dt);
    }
    return 0;
  }

  function collideDice(a, b, radius) {
    radius = radius == null ? 0.23 : radius;
    var dx = b.x - a.x;
    var dy = b.y - a.y;
    var dz = b.z - a.z;
    var dist2 = dx * dx + dy * dy + dz * dz;
    var min = radius * 2;
    var outA = { x: a.x, y: a.y, z: a.z, vx: a.vx, vy: a.vy, vz: a.vz };
    var outB = { x: b.x, y: b.y, z: b.z, vx: b.vx, vy: b.vy, vz: b.vz };
    if (dist2 >= min * min) return { a: outA, b: outB, hit: false, separated: false };
    var dist = Math.sqrt(dist2);
    var nx;
    var ny;
    var nz;
    if (dist < 1e-6) {
      nx = 1;
      ny = 0;
      nz = 0;
      dist = 0;
    } else {
      nx = dx / dist;
      ny = dy / dist;
      nz = dz / dist;
    }
    var overlap = min - dist;
    outA.x -= nx * overlap * 0.5;
    outA.y -= ny * overlap * 0.5;
    outA.z -= nz * overlap * 0.5;
    outB.x += nx * overlap * 0.5;
    outB.y += ny * overlap * 0.5;
    outB.z += nz * overlap * 0.5;
    var rvn = (outB.vx - outA.vx) * nx + (outB.vy - outA.vy) * ny + (outB.vz - outA.vz) * nz;
    var hit = false;
    if (rvn < 0) {
      var j = -(1 + 0.58) * rvn / 2;
      outA.vx -= j * nx;
      outA.vy -= j * ny;
      outA.vz -= j * nz;
      outB.vx += j * nx;
      outB.vy += j * ny;
      outB.vz += j * nz;
      hit = true;
    }
    return { a: outA, b: outB, hit: hit, separated: true, overlap: overlap };
  }

  function stepDice2D(a, b, world, dt) {
    world = world || {};
    dt = dt == null ? 1 / 60 : Number(dt);
    if (!(dt > 0)) dt = 0;
    if (dt > 0.05) dt = 0.05;
    var r = world.radius == null ? 30 : world.radius;
    var g = world.gravity == null ? 2400 : world.gravity;
    var left = world.left == null ? r : world.left;
    var right = world.right == null ? 400 - r : world.right;
    var top = world.top == null ? r : world.top;
    var floor = world.floor == null ? 300 - r : world.floor;
    var rest = world.restitution == null ? 0.55 : world.restitution;
    var friction = world.friction == null ? 0.76 : world.friction;

    function integrate(d) {
      return {
        x: d.x + (d.vx || 0) * dt,
        y: d.y + (d.vy || 0) * dt,
        z: 0,
        vx: d.vx || 0,
        vy: (d.vy || 0) + g * dt,
        vz: 0
      };
    }

    function clamp(o) {
      var wall = false;
      var floorHit = false;
      if (o.x < left) { o.x = left; if (o.vx < 0) { o.vx *= -rest; wall = true; } }
      if (o.x > right) { o.x = right; if (o.vx > 0) { o.vx *= -rest; wall = true; } }
      if (o.y < top) { o.y = top; if (o.vy < 0) { o.vy *= -rest; wall = true; } }
      if (o.y > floor) {
        o.y = floor;
        if (o.vy > 0) {
          o.vy *= -rest;
          o.vx *= friction;
          floorHit = true;
          if (Math.abs(o.vy) < 40) o.vy = 0;
        }
      }
      return { wall: wall, floor: floorHit };
    }

    var A = integrate(a);
    var B = integrate(b);
    var ca = clamp(A);
    var cb = clamp(B);
    var bump = collideDice(A, B, r);
    A.x = bump.a.x;
    A.y = bump.a.y;
    A.vx = bump.a.vx;
    A.vy = bump.a.vy;
    B.x = bump.b.x;
    B.y = bump.b.y;
    B.vx = bump.b.vx;
    B.vy = bump.b.vy;
    var ca2 = clamp(A);
    var cb2 = clamp(B);
    return {
      a: A,
      b: B,
      hit: bump.hit,
      separated: bump.separated,
      wall: ca.wall || cb.wall || ca2.wall || cb2.wall,
      floor: ca.floor || cb.floor || ca2.floor || cb2.floor
    };
  }

  function validateState(state) {
    if (bankSum(state) < 0) return "Negative bankroll.";
    for (var i = 0; i < state.players.length; i++) {
      if (state.players[i].bankroll < 0) return "Negative bankroll for " + state.players[i].name;
    }
    if (state.line.amount < 0) return "Negative line.";
    if (fadedTotal(state) > state.line.amount) return "Fade exceeds line.";
    return null;
  }

  return {
    SAVE_VERSION: SAVE_VERSION,
    SAVE_KEY: SAVE_KEY,
    STARTING_BANK: STARTING_BANK,
    DEFAULT_NAMES: DEFAULT_NAMES.slice(),
    BET_TYPES: BET_TYPES,
    createGame: createGame,
    setActing: setActing,
    setMuted: setMuted,
    setBusy: setBusy,
    renamePlayer: renamePlayer,
    addPlayer: addPlayer,
    removePlayer: removePlayer,
    rebuy: rebuy,
    COLORS: COLORS.slice(),
    postLine: postLine,
    fadeLine: fadeLine,
    cutLine: cutLine,
    pullLine: pullLine,
    unpostLine: unpostLine,
    unfadeLine: unfadeLine,
    uncoverBet: uncoverBet,
    tableExposure: tableExposure,
    offerBet: offerBet,
    coverBet: coverBet,
    cancelBet: cancelBet,
    settleRoll: settleRoll,
    rollDice: rollDice,
    snapshot: snapshot,
    hydrate: hydrate,
    resetCrew: resetCrew,
    previewPayout: previewPayout,
    oddsLabel: oddsLabel,
    oddsPair: oddsPair,
    coverForStake: coverForStake,
    fadedTotal: fadedTotal,
    lineRemaining: lineRemaining,
    lineCovered: lineCovered,
    canRoll: canRoll,
    player: player,
    playerName: playerName,
    shooter: shooter,
    describeBet: describeBet,
    betKind: betKind,
    rollNick: rollNick,
    rollCallout: rollCallout,
    coverersSummary: coverersSummary,
    escrowTotal: escrowTotal,
    bankSum: bankSum,
    moneyInPlay: moneyInPlay,
    nextShooterId: nextShooterId,
    validateState: validateState,
    isCraps: isCraps,
    isNatural: isNatural,
    isHard: isHard,
    parseChip: parseChip,
    flickPower: flickPower,
    collideDice: collideDice,
    stepDice2D: stepDice2D
  };
});
