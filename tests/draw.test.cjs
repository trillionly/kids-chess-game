const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { test } = require("node:test");

const piece = (type, color, square, extra = {}) => ({ type, color, square, hasMoved: true, ...extra });
const kings = () => [piece("king", "white", "a1"), piece("king", "black", "h8")];

function engine(position) {
  const elements = new Map();
  const getElementById = (id) => {
    if (!elements.has(id)) elements.set(id, {
      textContent: "", innerHTML: "", disabled: false,
      classList: { add() {}, remove() {}, toggle() {} }, appendChild() {},
    });
    return elements.get(id);
  };
  const context = vm.createContext({
    document: { getElementById, querySelectorAll: () => [] },
    window: { setTimeout, clearTimeout }, performance, console,
  });
  const source = fs.readFileSync(path.join(__dirname, "../script.js"), "utf8");
  vm.runInContext(source.slice(0, source.lastIndexOf("attachSetupEvents();")), context);
  const run = (code) => vm.runInContext(code, context);
  run('createCelebrationPiece = () => ({}); playSoundEffect = () => {}; launchConfetti = () => {}; gameState.screen = "game"; gameState.mode = "two"');
  if (position) {
    context.position = position;
    run("gameState.pieces = position; recordDrawPosition()");
  }
  return { context, run, elements };
}

test("dead material: kings, single bishop/knight, same-color bishops", () => {
  const ai = engine();
  for (const material of [[], [piece("bishop", "white", "c1")], [piece("knight", "black", "g8")],
    [piece("bishop", "white", "c1"), piece("bishop", "black", "f8")],
    [piece("bishop", "white", "c1"), piece("bishop", "white", "e3"), piece("bishop", "black", "f8")]]) {
    ai.context.position = [...kings(), ...material];
    assert.equal(ai.run("hasInsufficientMaterial(position)"), true);
  }
});

test("do not wrongly draw two knights, opposite-color bishops, or minor pieces on both sides", () => {
  const ai = engine();
  for (const material of [
    [piece("knight", "white", "b1"), piece("knight", "white", "g1")],
    [piece("bishop", "white", "c1"), piece("bishop", "black", "c8")],
    [piece("knight", "white", "b1"), piece("knight", "black", "b8")],
    [piece("rook", "white", "b1")], [piece("pawn", "white", "b2")]]) {
    ai.context.position = [...kings(), ...material];
    assert.equal(ai.run("hasInsufficientMaterial(position)"), false);
  }
});

test("stalemate ends the game and keeps Draw visible", () => {
  const ai = engine([piece("king", "black", "f7"), piece("queen", "black", "g6"), piece("king", "white", "h8")]);
  ai.run("updateThreatState(); updateStatusText()");
  assert.equal(ai.run("gameState.isGameOver"), true);
  assert.equal(ai.run("gameState.drawReason"), "stalemate");
  assert.equal(ai.elements.get("victory-title").textContent, "Draw!");
  assert.match(ai.elements.get("game-status").textContent, /Draw.*Stalemate/);
});

test("threefold repetition is recorded once per completed turn", () => {
  const ai = engine();
  ai.run("resetBoardState()");
  for (let cycle = 0; cycle < 2; cycle += 1) {
    for (const [from, to] of [["g1", "f3"], ["g8", "f6"], ["f3", "g1"], ["f6", "g8"]]) {
      ai.context.from = from;
      ai.context.to = to;
      ai.run('performMove(from, to); updateThreatState(); updateThreatState()');
    }
  }
  assert.equal(ai.run("gameState.drawReason"), "repetition");
  assert.equal(ai.run("gameState.positionCounts.get(getDrawPositionKey())"), 3);
});

test("position identity tracks turn and castling rights, not piece IDs or minor-piece movement", () => {
  const ai = engine();
  ai.run("resetBoardState()");
  const original = ai.run("getDrawPositionKey()");
  ai.run('gameState.pieces.find(piece => piece.square === "g1").hasMoved = true');
  assert.equal(ai.run("getDrawPositionKey()"), original);
  ai.run('gameState.pieces.find(piece => piece.square === "h1").hasMoved = true');
  assert.notEqual(ai.run("getDrawPositionKey()"), original);
  assert.notEqual(ai.run('getDrawPositionKey(gameState.pieces, "black")'), ai.run("getDrawPositionKey()"));
});

test("50 moves counts 100 half-moves, pawn moves and captures reset it", () => {
  const ai = engine([...kings(), piece("rook", "white", "b1"), piece("rook", "black", "g8")]);
  ai.run("gameState.halfmoveClock = 98; performMove('b1', 'b2'); updateThreatState()");
  assert.equal(ai.run("gameState.isGameOver"), false);
  ai.run("performMove('g8', 'g7'); updateThreatState()");
  assert.equal(ai.run("gameState.drawReason"), "fiftyMoves");
  ai.run("resetBoardState(); gameState.halfmoveClock = 99; performMove('e2', 'e4')");
  assert.equal(ai.run("gameState.halfmoveClock"), 0);
  ai.context.position = [...kings(), piece("rook", "white", "b2"), piece("rook", "black", "b7")];
  ai.run("gameState.pieces = position; gameState.halfmoveClock = 99; performMove('b2', 'b7')");
  assert.equal(ai.run("gameState.halfmoveClock"), 0);
});

test("checkmate has priority over 75 moves", () => {
  const ai = engine([piece("king", "black", "f6"), piece("queen", "black", "g7"), piece("king", "white", "h8")]);
  ai.run("gameState.halfmoveClock = 150; updateThreatState()");
  assert.equal(ai.run("gameState.winner"), "black");
  assert.equal(ai.run("gameState.drawReason"), null);
});

test("fivefold and 75-move safety thresholds are recognized", () => {
  const ai = engine([...kings(), piece("rook", "white", "b2")]);
  ai.run("gameState.positionCounts.set(getDrawPositionKey(), 5)");
  assert.equal(ai.run("getDrawReason()"), "fivefold");
  ai.run("gameState.positionCounts.clear(); gameState.halfmoveClock = 150");
  assert.equal(ai.run("getDrawReason()"), "seventyFiveMoves");
});

test("legal en passant changes repetition identity; a pinned or expired capture does not", () => {
  const ai = engine([...kings(), piece("pawn", "white", "e5"), piece("pawn", "black", "d5", { enPassantVulnerable: true })]);
  const eligible = ai.run("getDrawPositionKey()");
  ai.run('gameState.pieces.find(piece => piece.square === "d5").enPassantVulnerable = false');
  assert.notEqual(ai.run("getDrawPositionKey()"), eligible);
  ai.context.position = [piece("king", "white", "e1"), piece("king", "black", "a8"),
    piece("rook", "black", "e8"), piece("pawn", "white", "e5"), piece("pawn", "black", "d5", { enPassantVulnerable: true })];
  ai.run("gameState.pieces = position");
  const pinned = ai.run("getDrawPositionKey()");
  ai.run('gameState.pieces.find(piece => piece.square === "d5").enPassantVulnerable = false');
  assert.equal(ai.run("getDrawPositionKey()"), pinned);
});

test("en passant removes the adjacent pawn, resets the clock, and expires after one turn", () => {
  const ai = engine([...kings(), piece("pawn", "white", "e5"), piece("pawn", "black", "d5", { enPassantVulnerable: true })]);
  ai.run('gameState.halfmoveClock = 45; performMove("e5", "d6", { enPassant: "d5" })');
  assert.equal(ai.run('getPieceAtSquare("d5")'), null);
  assert.equal(ai.run("gameState.halfmoveClock"), 0);
  assert.equal(ai.run("gameState.capturedPieces.black.length"), 1);
  ai.run("resetBoardState(); performMove('e2', 'e4'); performMove('g8', 'f6')");
  assert.equal(ai.run('gameState.pieces.some(piece => piece.enPassantVulnerable)'), false);
});

test("promotion is recorded only after the player chooses a piece", () => {
  const ai = engine([...kings(), piece("pawn", "white", "b7")]);
  ai.run('performMove("b7", "b8"); gameState.pendingPromotion = getPieceAtSquare("b8"); updateThreatState()');
  assert.equal(ai.run("gameState.needsPositionRecord"), true);
  ai.run('applyPromotion(gameState.pendingPromotion, "bishop"); gameState.pendingPromotion = null; updateThreatState()');
  assert.equal(ai.run("gameState.drawReason"), "material");
  assert.equal(ai.run("gameState.positionCounts.get(getDrawPositionKey())"), 1);
});

test("draw stops computer timers and New Game resets all draw history", () => {
  const ai = engine(kings());
  ai.run('gameState.isComputerThinking = true; gameState.aiTimerId = window.setTimeout(() => {}, 10000)');
  ai.run('updateThreatState()');
  assert.equal(ai.run("gameState.aiTimerId"), null);
  assert.equal(ai.run("gameState.isComputerThinking"), false);
  ai.run("resetBoardState()");
  assert.equal(ai.run("gameState.drawReason"), null);
  assert.equal(ai.run("gameState.halfmoveClock"), 0);
  assert.equal(ai.run("gameState.positionCounts.size"), 1);
});

test("legal player moves cannot leave the king checked or capture the enemy king", () => {
  const ai = engine([piece("king", "white", "e1"), piece("king", "black", "a8"),
    piece("rook", "white", "e2"), piece("rook", "black", "e8")]);
  assert.equal(ai.run('getValidMovesForPiece(getPieceAtSquare("e2")).some(move => move.square === "d2")'), false);
  ai.context.position = [piece("king", "white", "a1"), piece("king", "black", "h8"), piece("queen", "white", "h7")];
  ai.run("gameState.pieces = position");
  assert.equal(ai.run('getAllLegalMoves("white").some(move => move.toSquare === "h8")'), false);
});

test("a permanently locked pawn barrier is dead, but a pawn that can move is not", () => {
  const ai = engine();
  const barrier = kings();
  for (let file = 0; file < 8; file += 1) {
    const letter = "abcdefgh"[file];
    const whiteRank = file % 2 ? 5 : 4;
    barrier.push(piece("pawn", "white", `${letter}${whiteRank}`), piece("pawn", "black", `${letter}${whiteRank + 1}`));
  }
  ai.context.position = barrier;
  assert.equal(ai.run("hasLockedPawnDeadPosition(position)"), true);
  ai.context.position = [...kings(), piece("pawn", "white", "b2"), piece("pawn", "black", "b7")];
  assert.equal(ai.run("hasLockedPawnDeadPosition(position)"), false);
});
