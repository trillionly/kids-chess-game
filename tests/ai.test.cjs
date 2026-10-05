const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { test } = require("node:test");

function engine() {
  const context = vm.createContext({
    document: { getElementById: () => null, querySelectorAll: () => [] },
    window: { setTimeout }, performance, console,
  });
  const source = fs.readFileSync(path.join(__dirname, "../script.js"), "utf8");
  vm.runInContext(source.slice(0, source.lastIndexOf("attachSetupEvents();")), context);
  return { context, run: (code) => vm.runInContext(code, context) };
}

const piece = (type, color, square) => ({ type, color, square, hasMoved: true });
function scores(engine, pieces, depth = 2) {
  engine.context.position = pieces;
  return engine.run(`
    (() => {
      const search = scoreComputerCandidates(position, getAllLegalMoves("black", position), ${depth});
      let result;
      do { result = search.next(); } while (!result.done);
      return result.value;
    })()
  `);
}

test("every level takes a forced mate rather than a weaker move", () => {
  const ai = engine();
  const position = [piece("king", "black", "f6"), piece("queen", "black", "g6"), piece("king", "white", "h8")];
  ai.context.scored = scores(ai, position);
  for (let level = 1; level <= 10; level += 1) {
    const move = ai.run(`selectComputerCandidate(scored, ${level}, () => 0.99)`);
    ai.context.move = move;
    assert.equal(ai.run('evaluateTurnState("white", simulateComputerMove(position, move)).checkmate'), true);
  }
});

test("search rejects a pawn capture that loses the queen to a rook", () => {
  const ai = engine();
  const position = [piece("king", "black", "g8"), piece("queen", "black", "d8"),
    piece("king", "white", "g1"), piece("pawn", "white", "d4"), piece("rook", "white", "d1")];
  const results = scores(ai, position);
  const poisoned = results.find((entry) => entry.move.fromSquare === "d8" && entry.move.toSquare === "d4");
  assert.ok(poisoned);
  assert.ok(Math.max(...results.map((entry) => entry.score)) - poisoned.score > 180);
  ai.context.scored = results;
  assert.notEqual(ai.run('selectComputerCandidate(scored, 1, () => 0.5).toSquare'), "d4");
});

test("search models promotion without mutating the board", () => {
  const ai = engine();
  const position = [piece("king", "black", "h8"), piece("pawn", "black", "a2"), piece("king", "white", "h1")];
  const before = JSON.stringify(position);
  ai.context.position = position;
  assert.equal(ai.run('simulateComputerMove(position, getAllLegalMoves("black", position).find(move => move.toSquare === "a1")).find(piece => piece.square === "a1").type'), "queen");
  scores(ai, position);
  assert.equal(JSON.stringify(position), before);
});

test("candidate tolerance shrinks gradually and never admits a major blunder", () => {
  const ai = engine();
  ai.context.scored = [0, -40, -80, -120, -160, -300].map((score) => ({ score, move: { score } }));
  let previous = -Infinity;
  for (let level = 1; level <= 10; level += 1) {
    const selected = ai.run(`selectComputerCandidate(scored, ${level}, () => 0.99999).score`);
    assert.ok(selected >= previous);
    assert.ok(selected > -300);
    previous = selected;
  }
});

test("async search returns a legal move within its budget and leaves pieces intact", async () => {
  const ai = engine();
  ai.run('gameState.screen = "game"; gameState.level = 10; gameState.currentTurn = "black"');
  const before = ai.run("JSON.stringify(gameState.pieces)");
  const start = performance.now();
  const move = await ai.run("chooseComputerMove()");
  assert.ok(performance.now() - start < 2000);
  ai.context.move = move;
  assert.ok(ai.run('getAllLegalMoves("black").some(candidate => candidate.fromSquare === move.fromSquare && candidate.toSquare === move.toSquare)'));
  assert.equal(ai.run("JSON.stringify(gameState.pieces)"), before);
});

test("starting a new game cancels an in-flight search", async () => {
  const ai = engine();
  ai.run('gameState.screen = "game"; gameState.level = 10');
  const pending = ai.run("chooseComputerMove()");
  ai.run("gameState.pieces = createStartingPieces()");
  assert.equal(await pending, null);
});

test("checkmate and stalemate receive distinct terminal scores", () => {
  const ai = engine();
  ai.context.position = [piece("king", "black", "f6"), piece("queen", "black", "g7"), piece("king", "white", "h8")];
  assert.equal(ai.run('searchComputerPosition(position, "white", 2, -Infinity, Infinity).next().done'), false);
  assert.equal(ai.run('(() => { const search = searchComputerPosition(position, "white", 2, -Infinity, Infinity); search.next(); return search.next().value; })()'), 99999);
  ai.context.position = [piece("king", "black", "f7"), piece("queen", "black", "g6"), piece("king", "white", "h8")];
  assert.equal(ai.run('(() => { const search = searchComputerPosition(position, "white", 2, -Infinity, Infinity); search.next(); return search.next().value; })()'), 0);
});

test("computer escapes check instead of accepting an illegal capture", async () => {
  const ai = engine();
  ai.context.position = [piece("king", "black", "e8"), piece("queen", "black", "d8"),
    piece("king", "white", "a1"), piece("rook", "white", "e1"), piece("pawn", "white", "d4")];
  ai.run('gameState.pieces = position; gameState.screen = "game"; gameState.level = 1');
  ai.context.move = await ai.run("chooseComputerMove()");
  assert.equal(ai.run('isKingInCheck("black", simulateComputerMove(position, move))'), false);
});
