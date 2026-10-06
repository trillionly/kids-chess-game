const boardElement = document.getElementById("chessboard");
const statusElement = document.getElementById("game-status");
const startScreenElement = document.getElementById("start-screen");
const gameScreenElement = document.getElementById("game-screen");
const levelGroupElement = document.getElementById("level-group");
const startHelpTextElement = document.getElementById("start-help-text");
const modeDisplayElement = document.getElementById("mode-display");
const levelDisplayElement = document.getElementById("level-display");
const turnDisplayElement = document.getElementById("turn-display");
const turnPillElement = document.getElementById("turn-pill");
const guideToggleButton = document.getElementById("guide-toggle-button");
const guideDisplayElement = document.getElementById("guide-display");
const newGameButton = document.getElementById("new-game-button");
const drawButton = document.getElementById("draw-button");
const animationLayerElement = document.getElementById("animation-layer");
const boardFrameElement = document.getElementById("board-frame");
const capturedWhiteElement = document.getElementById("captured-white");
const capturedBlackElement = document.getElementById("captured-black");
const victoryOverlayElement = document.getElementById("victory-overlay");
const victoryTitleElement = document.getElementById("victory-title");
const victoryMessageElement = document.getElementById("victory-message");
const victoryLeftPieceElement = document.getElementById("victory-left-piece");
const victoryRightPieceElement = document.getElementById("victory-right-piece");
const promotionOverlayElement = document.getElementById("promotion-overlay");
const promotionTitleElement = document.getElementById("promotion-title");
const promotionOptionsElement = document.getElementById("promotion-options");
const startCharacterElements = Array.from(document.querySelectorAll(".start-character"));

const modeOptionButtons = Array.from(document.querySelectorAll("[data-mode-option]"));
const levelOptionButtons = Array.from(document.querySelectorAll("[data-level-option]"));

const files = ["a", "b", "c", "d", "e", "f", "g", "h"];
const backRank = ["rook", "knight", "bishop", "queen", "king", "bishop", "knight", "rook"];
const pieceTypes = ["pawn", "rook", "knight", "bishop", "queen", "king"];
const promotionTypes = ["queen", "rook", "bishop", "knight"];

const pieceSymbols = {
  white: {
    king: "K",
    queen: "Q",
    rook: "R",
    bishop: "B",
    knight: "N",
    pawn: "P",
  },
  black: {
    king: "K",
    queen: "Q",
    rook: "R",
    bishop: "B",
    knight: "N",
    pawn: "P",
  },
};

const gameConfig = {
  pieceAssetExtensions: ["png"],
  aiMoveDelayMs: 1000,
  moveAnimationDurationMs: 1100,
  soundAssets: {
    move: "assets/audio/move.mp3",
    capture: "assets/audio/capture.mp3",
    check: "assets/audio/check.mp3",
    checkmate: "assets/audio/checkmate.mp3",
    victory: "assets/audio/victory.mp3",
    character: "assets/audio/character.mp3",
  },
};

const pieceAssetCatalog = createPieceAssetCatalog();
const pieceAssetStatus = new Map();
const warnedMissingAssets = new Set();

const setupState = {
  mode: null,
  level: null,
};

const soundState = {
  audioContext: null,
  warnedKinds: new Set(),
  unavailableAssets: new Set(),
  preferredVoice: null,
};

const interactionState = {
  characterTimers: new WeakMap(),
  touchStartY: null,
  touchLatestY: null,
  pullRefreshHandled: false,
};

const gameState = {
  screen: "start",
  mode: null,
  level: null,
  currentTurn: "white",
  selectedPiece: null,
  validMoves: [],
  pieces: createStartingPieces(),
  capturedPieces: {
    white: [],
    black: [],
  },
  winner: null,
  isGameOver: false,
  isStalemate: false,
  drawReason: null,
  halfmoveClock: 0,
  positionCounts: new Map(),
  needsPositionRecord: false,
  pendingPromotion: null,
  isComputerThinking: false,
  aiTimerId: null,
  moveGuideEnabled: true,
  checkState: {
    checkedColor: null,
    inCheck: false,
    checkmate: false,
    stalemate: false,
  },
};

function createStartingPieces() {
  const pieces = [];

  for (let index = 0; index < files.length; index += 1) {
    const file = files[index];
    const majorPiece = backRank[index];

    pieces.push(createPieceData("black", majorPiece, `${file}8`));
    pieces.push(createPieceData("black", "pawn", `${file}7`));
    pieces.push(createPieceData("white", "pawn", `${file}2`));
    pieces.push(createPieceData("white", majorPiece, `${file}1`));
  }

  return pieces;
}

function createPieceAssetCatalog() {
  const catalog = {};

  for (const color of ["white", "black"]) {
    catalog[color] = {};

    for (const type of pieceTypes) {
      catalog[color][type] = gameConfig.pieceAssetExtensions.map(
        (extension) => `assets/pieces/${color}-${type}.${extension}`,
      );
    }
  }

  return catalog;
}

function createPieceData(color, type, square) {
  return {
    color,
    type,
    square,
    hasMoved: false,
    imageKey: `${color}-${type}`,
    assetPath: null,
  };
}

function resetBoardState() {
  if (gameState.aiTimerId) {
    window.clearTimeout(gameState.aiTimerId);
    gameState.aiTimerId = null;
  }

  gameState.currentTurn = "white";
  gameState.selectedPiece = null;
  gameState.validMoves = [];
  gameState.pieces = createStartingPieces();
  gameState.capturedPieces = {
    white: [],
    black: [],
  };
  gameState.winner = null;
  gameState.isGameOver = false;
  gameState.isStalemate = false;
  gameState.drawReason = null;
  gameState.halfmoveClock = 0;
  gameState.positionCounts = new Map();
  gameState.needsPositionRecord = false;
  gameState.pendingPromotion = null;
  gameState.isComputerThinking = false;
  gameState.checkState = {
    checkedColor: null,
    inCheck: false,
    checkmate: false,
    stalemate: false,
  };
  recordDrawPosition();
}

function startGame() {
  gameState.mode = setupState.mode;
  gameState.level = setupState.level;
  gameState.screen = "game";
  resetBoardState();

  startScreenElement.classList.add("is-hidden");
  gameScreenElement.classList.remove("is-hidden");

  updateThreatState(false);
  renderBoard();
}

function showStartScreen() {
  if (gameState.aiTimerId) {
    window.clearTimeout(gameState.aiTimerId);
    gameState.aiTimerId = null;
  }

  setupState.mode = null;
  setupState.level = null;
  gameState.screen = "start";
  gameState.selectedPiece = null;
  gameState.validMoves = [];
  gameState.isComputerThinking = false;
  gameState.winner = null;
  gameState.isGameOver = false;
  gameState.isStalemate = false;
  gameState.pendingPromotion = null;
  gameState.checkState = {
    checkedColor: null,
    inCheck: false,
    checkmate: false,
    stalemate: false,
  };
  startScreenElement.classList.remove("is-hidden");
  gameScreenElement.classList.add("is-hidden");
  updateSetupControls();
}

function updateSetupControls() {
  startScreenElement.classList.toggle("single-mode-active", setupState.mode === "single");

  for (const button of modeOptionButtons) {
    button.classList.toggle("is-selected", button.dataset.modeOption === setupState.mode);
  }

  for (const button of levelOptionButtons) {
    button.classList.toggle("is-selected", Number(button.dataset.levelOption) === setupState.level);
  }

  const showLevels = setupState.mode === "single";
  levelGroupElement.classList.toggle("is-hidden", !showLevels);

  if (showLevels) {
    startHelpTextElement.textContent = "Choose a level to start the single player game.";
  } else {
    startHelpTextElement.textContent = "Choose how you want to play.";
  }
}

function getPieceAssetPath(piece) {
  const assetOptions = pieceAssetCatalog[piece.color][piece.type];
  return assetOptions[0] || null;
}

function getPieceAssetOptions(piece) {
  return pieceAssetCatalog[piece.color][piece.type] || [];
}

function getPieceVisualState(piece) {
  const assetOptions = getPieceAssetOptions(piece);

  for (const assetPath of assetOptions) {
    const status = pieceAssetStatus.get(assetPath);
    if (status === "loaded") {
      piece.assetPath = assetPath;
      return {
        imageKey: piece.imageKey,
        assetPath,
        useImage: true,
      };
    }
  }

  piece.assetPath = getPieceAssetPath(piece);
  return {
    imageKey: piece.imageKey,
    assetPath: piece.assetPath,
    useImage: false,
  };
}

function requestPieceAssetCheck(assetPath) {
  if (!assetPath || pieceAssetStatus.has(assetPath)) {
    return;
  }

  pieceAssetStatus.set(assetPath, "loading");

  const image = new Image();
  image.addEventListener("load", () => {
    pieceAssetStatus.set(assetPath, "loaded");
    renderBoard();
  });
  image.addEventListener("error", () => {
    pieceAssetStatus.set(assetPath, "missing");
    if (!warnedMissingAssets.has(assetPath)) {
      console.warn(`Missing piece image: ${assetPath}`);
      warnedMissingAssets.add(assetPath);
    }
  });
  image.src = assetPath;
}

function primePieceAssetChecks() {
  for (const color of Object.keys(pieceAssetCatalog)) {
    for (const type of Object.keys(pieceAssetCatalog[color])) {
      for (const assetPath of pieceAssetCatalog[color][type]) {
        requestPieceAssetCheck(assetPath);
      }
    }
  }
}

function squareToPosition(square) {
  return {
    file: files.indexOf(square[0]),
    rank: Number(square[1]) - 1,
  };
}

function positionToSquare(fileIndex, rankIndex) {
  if (!isInsideBoard(fileIndex, rankIndex)) {
    return null;
  }

  return `${files[fileIndex]}${rankIndex + 1}`;
}

function isInsideBoard(fileIndex, rankIndex) {
  return fileIndex >= 0 && fileIndex < 8 && rankIndex >= 0 && rankIndex < 8;
}

function getPieceAtSquare(square) {
  return gameState.pieces.find((piece) => piece.square === square) || null;
}

function getSquareElement(square) {
  return boardElement.querySelector(`.square[data-square="${square}"]`);
}

function getRenderedPieceElement(square) {
  return boardElement.querySelector(`.piece[data-square="${square}"]`);
}

function createPieceMap() {
  return new Map(gameState.pieces.map((piece) => [piece.square, piece]));
}

function createPieceMapFromPieces(pieces) {
  return new Map(pieces.map((piece) => [piece.square, piece]));
}

function getAudioContext() {
  if (soundState.audioContext) {
    return soundState.audioContext;
  }

  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextClass) {
    return null;
  }

  soundState.audioContext = new AudioContextClass();
  return soundState.audioContext;
}

function unlockAudioContext() {
  const audioContext = getAudioContext();
  if (audioContext && audioContext.state === "suspended") {
    audioContext.resume().catch(() => {});
  }
}

function playFallbackToneSequence(config) {
  const audioContext = getAudioContext();
  if (!audioContext) {
    return;
  }

  const now = audioContext.currentTime + 0.01;

  for (const note of config.notes) {
    const oscillator = audioContext.createOscillator();
    const noteGain = audioContext.createGain();

    oscillator.type = note.wave || "sine";
    oscillator.frequency.setValueAtTime(note.frequency, now + note.start);
    noteGain.gain.setValueAtTime(0.0001, now + note.start);
    noteGain.gain.exponentialRampToValueAtTime(note.volume, now + note.start + 0.012);
    noteGain.gain.exponentialRampToValueAtTime(0.0001, now + note.start + note.duration);

    oscillator.connect(noteGain);
    noteGain.connect(audioContext.destination);
    oscillator.start(now + note.start);
    oscillator.stop(now + note.start + note.duration + 0.03);
  }
}

function playFallbackSound(kind) {
  if (kind === "check") {
    speakCheckAlert();
    return;
  }

  if (kind === "character") {
    playFallbackToneSequence({
      notes: [
        { frequency: 420, start: 0, duration: 0.08, volume: 0.04, wave: "triangle" },
        { frequency: 560, start: 0.04, duration: 0.16, volume: 0.045, wave: "sine" },
        { frequency: 480, start: 0.12, duration: 0.14, volume: 0.03, wave: "sine" },
      ],
    });
    return;
  }

  if (kind === "victory") {
    playFallbackToneSequence({
      notes: [
        { frequency: 523, start: 0, duration: 0.2, volume: 0.06, wave: "triangle" },
        { frequency: 659, start: 0.09, duration: 0.22, volume: 0.055, wave: "triangle" },
        { frequency: 784, start: 0.18, duration: 0.3, volume: 0.05, wave: "sine" },
        { frequency: 1046, start: 0.3, duration: 0.34, volume: 0.04, wave: "sine" },
      ],
    });
    return;
  }

  if (kind === "checkmate") {
    playFallbackToneSequence({
      notes: [
        { frequency: 392, start: 0, duration: 0.18, volume: 0.05, wave: "triangle" },
        { frequency: 523, start: 0.08, duration: 0.22, volume: 0.055, wave: "triangle" },
        { frequency: 659, start: 0.18, duration: 0.28, volume: 0.05, wave: "sine" },
      ],
    });
    return;
  }

  if (kind === "check") {
    playFallbackToneSequence({
      notes: [
        { frequency: 698, start: 0, duration: 0.11, volume: 0.042, wave: "triangle" },
        { frequency: 784, start: 0.04, duration: 0.14, volume: 0.038, wave: "sine" },
      ],
    });
    return;
  }

  if (kind === "capture") {
    playFallbackToneSequence({
      notes: [
        { frequency: 740, start: 0, duration: 0.14, volume: 0.055, wave: "triangle" },
        { frequency: 988, start: 0.045, duration: 0.18, volume: 0.045, wave: "sine" },
      ],
    });
    return;
  }

  playFallbackToneSequence({
    notes: [
      { frequency: 240, start: 0, duration: 0.12, volume: 0.07, wave: "triangle" },
      { frequency: 182, start: 0.035, duration: 0.16, volume: 0.05, wave: "sine" },
    ],
  });
}

function playSoundEffect(kind) {
  unlockAudioContext();

  const assetPath = gameConfig.soundAssets[kind];
  if (!assetPath || soundState.unavailableAssets.has(kind)) {
    playFallbackSound(kind);
    return;
  }

  const audio = new Audio(assetPath);
  audio.preload = "auto";
  audio.volume = kind === "capture" ? 0.72 : kind === "checkmate" ? 0.68 : 0.62;
  let hasHandledFailure = false;

  const markMissing = () => {
    if (hasHandledFailure) {
      return;
    }
    hasHandledFailure = true;
    soundState.unavailableAssets.add(kind);
    if (!soundState.warnedKinds.has(kind)) {
      console.warn(`Missing sound asset: ${assetPath}`);
      soundState.warnedKinds.add(kind);
    }
    playFallbackSound(kind);
  };

  audio.addEventListener("error", markMissing, { once: true });
  audio.play().catch(markMissing);
}

function getPreferredSpeechVoice() {
  if (!("speechSynthesis" in window)) {
    return null;
  }

  if (soundState.preferredVoice) {
    return soundState.preferredVoice;
  }

  const voices = window.speechSynthesis.getVoices();
  const preferredVoice =
    voices.find((voice) => /en/i.test(voice.lang) && /female|samantha|zira|google us english/i.test(voice.name)) ||
    voices.find((voice) => /en/i.test(voice.lang)) ||
    null;

  soundState.preferredVoice = preferredVoice;
  return preferredVoice;
}

function speakCheckAlert() {
  if (!("speechSynthesis" in window)) {
    playFallbackToneSequence({
      notes: [
        { frequency: 698, start: 0, duration: 0.11, volume: 0.042, wave: "triangle" },
        { frequency: 784, start: 0.04, duration: 0.14, volume: 0.038, wave: "sine" },
      ],
    });
    return;
  }

  const utterance = new SpeechSynthesisUtterance("Check");
  const voice = getPreferredSpeechVoice();
  if (voice) {
    utterance.voice = voice;
    utterance.lang = voice.lang;
  } else {
    utterance.lang = "en-US";
  }
  utterance.rate = 0.98;
  utterance.pitch = 1.02;
  utterance.volume = 0.9;
  window.speechSynthesis.cancel();
  window.speechSynthesis.speak(utterance);
}

function getPawnMoves(piece, pieceMap) {
  const moves = [];
  const { file, rank } = squareToPosition(piece.square);
  const direction = piece.color === "white" ? 1 : -1;
  const startingRank = piece.color === "white" ? 1 : 6;

  const forwardSquare = positionToSquare(file, rank + direction);
  if (forwardSquare && !pieceMap.has(forwardSquare)) {
    moves.push({ square: forwardSquare, type: "move" });

    const doubleForwardSquare = positionToSquare(file, rank + direction * 2);
    if (rank === startingRank && doubleForwardSquare && !pieceMap.has(doubleForwardSquare)) {
      moves.push({ square: doubleForwardSquare, type: "move" });
    }
  }

  for (const fileOffset of [-1, 1]) {
    const captureSquare = positionToSquare(file + fileOffset, rank + direction);
    const targetPiece = captureSquare ? pieceMap.get(captureSquare) : null;

    if (captureSquare && targetPiece && targetPiece.color !== piece.color) {
      moves.push({ square: captureSquare, type: "capture" });
    }
    const adjacentSquare = positionToSquare(file + fileOffset, rank);
    const adjacentPawn = pieceMap.get(adjacentSquare);
    if (captureSquare && !targetPiece && rank === (piece.color === "white" ? 4 : 3)
      && adjacentPawn?.type === "pawn" && adjacentPawn.color !== piece.color && adjacentPawn.enPassantVulnerable) {
      moves.push({ square: captureSquare, type: "capture", enPassant: adjacentSquare });
    }
  }

  return moves;
}

function getSlidingMoves(piece, pieceMap, directions) {
  const moves = [];
  const start = squareToPosition(piece.square);

  for (const [fileStep, rankStep] of directions) {
    let nextFile = start.file + fileStep;
    let nextRank = start.rank + rankStep;

    while (isInsideBoard(nextFile, nextRank)) {
      const nextSquare = positionToSquare(nextFile, nextRank);
      const targetPiece = pieceMap.get(nextSquare);

      if (!targetPiece) {
        moves.push({ square: nextSquare, type: "move" });
      } else {
        if (targetPiece.color !== piece.color) {
          moves.push({ square: nextSquare, type: "capture" });
        }
        break;
      }

      nextFile += fileStep;
      nextRank += rankStep;
    }
  }

  return moves;
}

function getKnightMoves(piece, pieceMap) {
  const moves = [];
  const start = squareToPosition(piece.square);
  const offsets = [
    [-2, -1],
    [-2, 1],
    [-1, -2],
    [-1, 2],
    [1, -2],
    [1, 2],
    [2, -1],
    [2, 1],
  ];

  for (const [fileOffset, rankOffset] of offsets) {
    const nextSquare = positionToSquare(start.file + fileOffset, start.rank + rankOffset);
    if (!nextSquare) {
      continue;
    }

    const targetPiece = pieceMap.get(nextSquare);
    if (!targetPiece) {
      moves.push({ square: nextSquare, type: "move" });
      continue;
    }

    if (targetPiece.color !== piece.color) {
      moves.push({ square: nextSquare, type: "capture" });
    }
  }

  return moves;
}

function getCastlingMoves(piece, pieceMap, pieces = gameState.pieces) {
  if (piece.hasMoved || isKingInCheck(piece.color, pieces)) {
    return [];
  }

  const moves = [];
  const { file, rank } = squareToPosition(piece.square);

  const options = [
    {
      rookSquare: positionToSquare(7, rank),
      emptyFiles: [5, 6],
      travelFiles: [5, 6],
      destinationFile: 6,
      rookToFile: 5,
      side: "king",
    },
    {
      rookSquare: positionToSquare(0, rank),
      emptyFiles: [1, 2, 3],
      travelFiles: [3, 2],
      destinationFile: 2,
      rookToFile: 3,
      side: "queen",
    },
  ];

  for (const option of options) {
    const rook = pieceMap.get(option.rookSquare);
    if (!rook || rook.type !== "rook" || rook.color !== piece.color || rook.hasMoved) {
      continue;
    }

    if (file !== 4) {
      continue;
    }

    const pathBlocked = option.emptyFiles.some((nextFile) => pieceMap.has(positionToSquare(nextFile, rank)));
    if (pathBlocked) {
      continue;
    }

    const underAttack = option.travelFiles.some((nextFile) =>
      isSquareAttacked(positionToSquare(nextFile, rank), piece.color === "white" ? "black" : "white", pieces),
    );
    if (underAttack) {
      continue;
    }

    moves.push({
      square: positionToSquare(option.destinationFile, rank),
      type: "castle",
      castle: {
        side: option.side,
        rookFrom: rook.square,
        rookTo: positionToSquare(option.rookToFile, rank),
      },
    });
  }

  return moves;
}

function getKingMoves(piece, pieceMap, pieces = gameState.pieces) {
  const moves = [];
  const start = squareToPosition(piece.square);

  for (let fileOffset = -1; fileOffset <= 1; fileOffset += 1) {
    for (let rankOffset = -1; rankOffset <= 1; rankOffset += 1) {
      if (fileOffset === 0 && rankOffset === 0) {
        continue;
      }

      const nextSquare = positionToSquare(start.file + fileOffset, start.rank + rankOffset);
      if (!nextSquare) {
        continue;
      }

      const targetPiece = pieceMap.get(nextSquare);
      if (!targetPiece) {
        moves.push({ square: nextSquare, type: "move" });
        continue;
      }

      if (targetPiece.color !== piece.color) {
        moves.push({ square: nextSquare, type: "capture" });
      }
    }
  }

  return moves.concat(getCastlingMoves(piece, pieceMap, pieces));
}

function getPseudoLegalMovesForPiece(piece, pieces = gameState.pieces) {
  const pieceMap = createPieceMapFromPieces(pieces);

  switch (piece.type) {
    case "pawn":
      return getPawnMoves(piece, pieceMap);
    case "rook":
      return getSlidingMoves(piece, pieceMap, [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
      ]);
    case "knight":
      return getKnightMoves(piece, pieceMap);
    case "bishop":
      return getSlidingMoves(piece, pieceMap, [
        [1, 1],
        [1, -1],
        [-1, 1],
        [-1, -1],
      ]);
    case "queen":
      return getSlidingMoves(piece, pieceMap, [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
        [1, 1],
        [1, -1],
        [-1, 1],
        [-1, -1],
      ]);
    case "king":
      return getKingMoves(piece, pieceMap, pieces);
    default:
      return [];
  }
}

function getAttackSquaresForPiece(piece, pieces = gameState.pieces) {
  if (piece.type === "pawn") {
    const attacks = [];
    const { file, rank } = squareToPosition(piece.square);
    const direction = piece.color === "white" ? 1 : -1;

    for (const fileOffset of [-1, 1]) {
      const attackSquare = positionToSquare(file + fileOffset, rank + direction);
      if (attackSquare) {
        attacks.push(attackSquare);
      }
    }

    return attacks;
  }

  if (piece.type === "king") {
    const attacks = [];
    const start = squareToPosition(piece.square);

    for (let fileOffset = -1; fileOffset <= 1; fileOffset += 1) {
      for (let rankOffset = -1; rankOffset <= 1; rankOffset += 1) {
        if (fileOffset === 0 && rankOffset === 0) {
          continue;
        }

        const nextSquare = positionToSquare(start.file + fileOffset, start.rank + rankOffset);
        if (nextSquare) {
          attacks.push(nextSquare);
        }
      }
    }

    return attacks;
  }

  return getPseudoLegalMovesForPiece(piece, pieces).map((move) => move.square);
}

function findKing(color, pieces = gameState.pieces) {
  return pieces.find((piece) => piece.color === color && piece.type === "king") || null;
}

function isSquareAttacked(square, attackerColor, pieces = gameState.pieces) {
  for (const piece of pieces) {
    if (piece.color !== attackerColor) {
      continue;
    }

    const attackSquares = getAttackSquaresForPiece(piece, pieces);
    if (attackSquares.includes(square)) {
      return true;
    }
  }

  return false;
}

function isKingInCheck(color, pieces = gameState.pieces) {
  const king = findKing(color, pieces);
  if (!king) {
    return false;
  }

  const attackerColor = color === "white" ? "black" : "white";
  return isSquareAttacked(king.square, attackerColor, pieces);
}

function getLegalMovesForPiece(piece, pieces = gameState.pieces) {
  const pseudoMoves = getPseudoLegalMovesForPiece(piece, pieces);

  return pseudoMoves.filter((move) => {
    if (pieces.some((target) => target.square === move.square && target.type === "king")) return false;
    const nextPieces = simulateMove(pieces, {
      piece,
      fromSquare: piece.square,
      toSquare: move.square,
      castle: move.castle || null,
      enPassant: move.enPassant || null,
    });
    return !isKingInCheck(piece.color, nextPieces);
  });
}

function getValidMovesForPiece(piece, pieces = gameState.pieces) {
  return getLegalMovesForPiece(piece, pieces);
}

function clearSelection() {
  gameState.selectedPiece = null;
  gameState.validMoves = [];
}

function setSelectedPiece(piece) {
  gameState.selectedPiece = piece;
  gameState.validMoves = getValidMovesForPiece(piece);
}

function isSinglePlayerGame() {
  return gameState.mode === "single";
}

function isHumanTurn() {
  return !isSinglePlayerGame() || gameState.currentTurn === "white";
}

function shouldShowMoveDots() {
  return gameState.moveGuideEnabled && isSinglePlayerGame() && gameState.level <= 3 && gameState.currentTurn === "white";
}

function shouldShowMoveHighlights() {
  return gameState.moveGuideEnabled && gameState.mode === "two";
}

function getAllValidMoves(color, pieces = gameState.pieces) {
  const moves = [];

  for (const piece of pieces) {
    if (piece.color !== color) {
      continue;
    }

    const validMoves = getValidMovesForPiece(piece, pieces);
    for (const move of validMoves) {
      moves.push({
        piece,
        fromSquare: piece.square,
        toSquare: move.square,
        moveType: move.type,
        castle: move.castle || null,
        enPassant: move.enPassant || null,
      });
    }
  }

  return moves;
}

function getAllLegalMoves(color, pieces = gameState.pieces) {
  const moves = [];

  for (const piece of pieces) {
    if (piece.color !== color) {
      continue;
    }

    const legalMoves = getLegalMovesForPiece(piece, pieces);
    for (const move of legalMoves) {
      moves.push({
        piece,
        fromSquare: piece.square,
        toSquare: move.square,
        moveType: move.type,
        castle: move.castle || null,
        enPassant: move.enPassant || null,
      });
    }
  }

  return moves;
}

function evaluateTurnState(colorToMove = gameState.currentTurn, pieces = gameState.pieces) {
  const inCheck = isKingInCheck(colorToMove, pieces);
  const legalMoves = getAllLegalMoves(colorToMove, pieces);
  const checkmate = inCheck && legalMoves.length === 0;
  const stalemate = !inCheck && legalMoves.length === 0;

  return {
    checkedColor: inCheck ? colorToMove : null,
    inCheck,
    checkmate,
    stalemate,
  };
}

function clonePieces(pieces) {
  return pieces.map((piece) => ({ ...piece }));
}

function simulateMove(pieces, move) {
  const nextPieces = clonePieces(pieces);
  const movingPiece = nextPieces.find(
    (piece) =>
      piece.square === move.fromSquare &&
      piece.color === move.piece.color &&
      piece.type === move.piece.type,
  );

  if (!movingPiece) {
    return nextPieces;
  }

  const capturedIndex = nextPieces.findIndex(
    (piece) => piece.square === (move.enPassant || move.toSquare) && piece !== movingPiece,
  );

  if (capturedIndex >= 0) {
    nextPieces.splice(capturedIndex, 1);
  }

  for (const piece of nextPieces) piece.enPassantVulnerable = false;
  movingPiece.enPassantVulnerable = movingPiece.type === "pawn"
    && Math.abs(squareToPosition(move.fromSquare).rank - squareToPosition(move.toSquare).rank) === 2;
  movingPiece.square = move.toSquare;
  movingPiece.hasMoved = true;

  if (move.castle?.rookFrom && move.castle?.rookTo) {
    const rook = nextPieces.find(
      (piece) =>
        piece.square === move.castle.rookFrom &&
        piece.color === movingPiece.color &&
        piece.type === "rook",
    );
    if (rook) {
      rook.square = move.castle.rookTo;
      rook.hasMoved = true;
    }
  }

  return nextPieces;
}

function getPieceValue(type) {
  switch (type) {
    case "pawn":
      return 1;
    case "knight":
    case "bishop":
      return 3;
    case "rook":
      return 5;
    case "queen":
      return 9;
    case "king":
      return 100;
    default:
      return 0;
  }
}

function getMoveTargetPiece(move, pieces = gameState.pieces) {
  return pieces.find((piece) => piece.square === (move.enPassant || move.toSquare) && piece.color !== move.piece.color) || null;
}

const drawMessages = {
  stalemate: "Stalemate: no legal moves and no check.",
  material: "Neither side has enough pieces to checkmate.",
  deadPosition: "The locked position makes checkmate impossible.",
  repetition: "The same position has occurred three times.",
  fivefold: "The same position has occurred five times.",
  fiftyMoves: "50 moves each without a pawn move or capture.",
  seventyFiveMoves: "75 moves each without a pawn move or capture.",
  agreement: "Both players agreed to a draw.",
};

function hasInsufficientMaterial(pieces) {
  if (!findKing("white", pieces) || !findKing("black", pieces)) return false;
  const others = pieces.filter((piece) => piece.type !== "king");
  if (others.length === 0) return true;
  if (others.length === 1) return ["bishop", "knight"].includes(others[0].type);
  if (!others.every((piece) => piece.type === "bishop")) return false;
  const squareColors = others.map((piece) => {
    const { file, rank } = squareToPosition(piece.square);
    return (file + rank) % 2;
  });
  return squareColors.every((color) => color === squareColors[0]);
}

function hasLockedPawnDeadPosition(pieces) {
  const pawns = pieces.filter((piece) => piece.type !== "king");
  if (!pawns.length || !pawns.every((piece) => piece.type === "pawn")) return false;
  const map = createPieceMapFromPieces(pieces);
  if (pawns.some((pawn) => getPawnMoves(pawn, map).length > 0)) return false;
  // Ignore the other king to overestimate reachability. If neither king can
  // reach an enemy pawn even then, the pawn barrier can never be opened.
  for (const color of ["white", "black"]) {
    const king = findKing(color, pieces);
    if (!king || isKingInCheck(color, pieces)) return false;
    const enemyPawns = pawns.filter((pawn) => pawn.color !== color);
    const attacked = new Set(enemyPawns.flatMap((pawn) => getAttackSquaresForPiece(pawn, pieces)));
    const visited = new Set([king.square]);
    const queue = [king.square];
    for (let index = 0; index < queue.length; index += 1) {
      const { file, rank } = squareToPosition(queue[index]);
      for (let dx = -1; dx <= 1; dx += 1) {
        for (let dy = -1; dy <= 1; dy += 1) {
          const square = positionToSquare(file + dx, rank + dy);
          if (!square || visited.has(square) || attacked.has(square)) continue;
          const occupant = map.get(square);
          if (occupant?.type === "pawn") {
            if (occupant.color !== color) return false;
            continue;
          }
          visited.add(square);
          queue.push(square);
        }
      }
    }
  }
  return true;
}

function getDrawPositionKey(pieces = gameState.pieces, turn = gameState.currentTurn) {
  const placement = pieces.map((piece) => `${piece.color}:${piece.type}:${piece.square}`).sort().join(",");
  const rights = [];
  for (const color of ["white", "black"]) {
    const rank = color === "white" ? "1" : "8";
    const king = pieces.find((piece) => piece.color === color && piece.type === "king" && piece.square === `e${rank}`);
    if (!king || king.hasMoved) continue;
    for (const file of ["a", "h"]) {
      const rook = pieces.find((piece) => piece.color === color && piece.type === "rook" && piece.square === `${file}${rank}`);
      if (rook && !rook.hasMoved) rights.push(`${color}:${file}`);
    }
  }
  // Only a legal en passant capture changes the repetition identity.
  const enPassant = getAllLegalMoves(turn, pieces).filter((move) => move.enPassant)
    .map((move) => move.toSquare).sort().join(",");
  return `${placement}|${turn}|${rights.join(",")}|${enPassant}`;
}

function recordDrawPosition() {
  const key = getDrawPositionKey();
  gameState.positionCounts.set(key, (gameState.positionCounts.get(key) || 0) + 1);
  gameState.needsPositionRecord = false;
}

function getDrawReason(turnState = evaluateTurnState()) {
  if (turnState.checkmate) return null;
  if (turnState.stalemate) return "stalemate";
  if (hasInsufficientMaterial(gameState.pieces)) return "material";
  if (hasLockedPawnDeadPosition(gameState.pieces)) return "deadPosition";
  const repetitions = gameState.positionCounts.get(getDrawPositionKey()) || 0;
  if (repetitions >= 5) return "fivefold";
  if (gameState.halfmoveClock >= 150) return "seventyFiveMoves";
  if (repetitions >= 3) return "repetition";
  if (gameState.halfmoveClock >= 100) return "fiftyMoves";
  return null;
}

function evaluateComputerPosition(pieces) {
  let score = 0;
  const endgame = pieces.filter((piece) => piece.type !== "pawn" && piece.type !== "king").length <= 4;
  for (const piece of pieces) {
    const { file, rank } = squareToPosition(piece.square);
    const progress = piece.color === "white" ? rank : 7 - rank;
    const center = 7 - Math.abs(file - 3.5) - Math.abs(rank - 3.5);
    let value = piece.type === "king" ? 0 : getPieceValue(piece.type) * 100;
    if (piece.type === "pawn") value += progress * 9 + center * 3;
    if (piece.type === "knight") value += center * 12;
    if (piece.type === "bishop") value += center * 7 + (piece.hasMoved ? 12 : 0);
    if (piece.type === "rook") value += progress === 6 ? 22 : 0;
    if (piece.type === "queen") value += center * 3;
    if (piece.type === "king") {
      value += endgame ? center * 12 : -center * 8;
      if (!endgame && progress <= 1 && (file <= 2 || file >= 6)) value += 35;
    }
    score += piece.color === "black" ? value : -value;
  }
  return score;
}

function simulateComputerMove(pieces, move) {
  const nextPieces = simulateMove(pieces, move);
  const moved = nextPieces.find((piece) => piece.square === move.toSquare && piece.color === move.piece.color);
  if (moved?.type === "pawn" && /[18]$/.test(moved.square)) moved.type = "queen";
  return nextPieces;
}

function orderComputerMoves(moves, pieces) {
  const priority = (move) => {
    const target = getMoveTargetPiece(move, pieces);
    const promotion = move.piece.type === "pawn" && /[18]$/.test(move.toSquare);
    return (target ? getPieceValue(target.type) * 100 - getPieceValue(move.piece.type) : 0)
      + (promotion ? 800 : 0) + (move.castle ? 30 : 0);
  };
  return moves.map((move) => ({ move, priority: priority(move) }))
    .sort((a, b) => b.priority - a.priority).map((entry) => entry.move);
}

// Yield at each node so search can be interrupted and the board stays responsive.
function* searchComputerPosition(pieces, color, depth, alpha, beta, ply = 1, exchanges = 2) {
  yield;
  const moves = getAllLegalMoves(color, pieces);
  const inCheck = isKingInCheck(color, pieces);
  if (moves.length === 0) return inCheck ? (color === "black" ? -100000 + ply : 100000 - ply) : 0;
  if (hasInsufficientMaterial(pieces)) return 0;
  const maximizing = color === "black";
  let best = maximizing ? -Infinity : Infinity;
  let candidates = moves;
  if (depth <= 0) {
    const standing = evaluateComputerPosition(pieces);
    if (exchanges <= 0) return standing;
    if (!inCheck) {
      best = standing;
      if (maximizing) alpha = Math.max(alpha, best);
      else beta = Math.min(beta, best);
      if (alpha >= beta) return best;
      candidates = moves.filter((move) => move.moveType === "capture"
        || (move.piece.type === "pawn" && /[18]$/.test(move.toSquare)));
    }
  }
  for (const move of orderComputerMoves(candidates, pieces)) {
    const value = yield* searchComputerPosition(simulateComputerMove(pieces, move),
      maximizing ? "white" : "black", depth - 1, alpha, beta, ply + 1,
      depth <= 0 ? exchanges - 1 : exchanges);
    best = maximizing ? Math.max(best, value) : Math.min(best, value);
    if (maximizing) alpha = Math.max(alpha, best);
    else beta = Math.min(beta, best);
    if (alpha >= beta) break;
  }
  return best;
}

function* scoreComputerCandidates(pieces, moves, depth, exchanges = 2) {
  const scores = [];
  for (const move of moves) {
    const score = yield* searchComputerPosition(simulateComputerMove(pieces, move), "white", depth - 1, -Infinity, Infinity, 1, exchanges);
    scores.push({ move, score });
  }
  return scores;
}

function getComputerDifficulty(level) {
  const boundedLevel = Math.min(10, Math.max(1, level || 1));
  return {
    randomMoveChance: 0.85 * (10 - boundedLevel) / 9,
    tolerance: 400 - (boundedLevel - 1) * 40,
    budgetMs: 100 + (boundedLevel - 1) * 65,
    maxDepth: Math.ceil(boundedLevel / 3),
    exchanges: boundedLevel <= 3 ? 0 : boundedLevel <= 6 ? 1 : 2,
  };
}

function selectComputerCandidate(scoredMoves, level, random = Math.random) {
  const best = Math.max(...scoredMoves.map((entry) => entry.score));
  const { randomMoveChance, tolerance } = getComputerDifficulty(level);
  // Beginner play must allow real mistakes, not just near-optimal variations.
  // Keep a discovered mate, but otherwise permit moves outside the strong pool.
  if (best < 90000 && randomMoveChance > 0 && random() < randomMoveChance) {
    return scoredMoves[Math.min(scoredMoves.length - 1, Math.floor(random() * scoredMoves.length))].move;
  }
  const candidates = scoredMoves.filter((entry) => best - entry.score <= tolerance);
  const weights = candidates.map((entry) => Math.exp((entry.score - best) / (tolerance * 0.6)));
  let ticket = random() * weights.reduce((sum, weight) => sum + weight, 0);
  for (let index = 0; index < candidates.length; index += 1) {
    ticket -= weights[index];
    if (ticket <= 0) return candidates[index].move;
  }
  return candidates[candidates.length - 1].move;
}

async function chooseComputerMove() {
  const pieces = gameState.pieces;
  const allMoves = getAllLegalMoves("black");
  if (allMoves.length === 0) {
    return null;
  }

  const aiLevel = Math.min(10, Math.max(1, gameState.level || 1));
  const difficulty = getComputerDifficulty(aiLevel);

  const moves = orderComputerMoves(allMoves, pieces);
  let scoredMoves = moves.map((move) => ({ move, score: evaluateComputerPosition(simulateComputerMove(pieces, move)) }));
  const deadline = performance.now() + difficulty.budgetMs;
  for (let depth = 1; depth <= difficulty.maxDepth; depth += 1) {
    const search = scoreComputerCandidates(pieces, moves, depth, difficulty.exchanges);
    let result;
    while (performance.now() < deadline) {
      const sliceEnd = Math.min(deadline, performance.now() + 8);
      do {
        result = search.next();
      } while (!result.done && performance.now() < sliceEnd);
      if (result.done) break;
      await new Promise((resolve) => window.setTimeout(resolve, 0));
      if (gameState.pieces !== pieces || gameState.isGameOver || gameState.screen !== "game") return null;
    }
    // Never mix partially searched roots with scores from a completed depth.
    if (!result?.done) break;
    scoredMoves = result.value;
  }
  return selectComputerCandidate(scoredMoves, aiLevel);
}

function performMove(fromSquare, toSquare, moveData = null) {
  const movingPiece = getPieceAtSquare(fromSquare);
  if (!movingPiece) {
    return null;
  }

  const capturedSquare = moveData?.enPassant || toSquare;
  const capturedPiece = getPieceAtSquare(capturedSquare);
  if (capturedPiece && capturedPiece !== movingPiece) {
    gameState.capturedPieces[capturedPiece.color].push({ ...capturedPiece });
  }

  gameState.halfmoveClock = movingPiece.type === "pawn" || capturedPiece ? 0 : gameState.halfmoveClock + 1;
  for (const piece of gameState.pieces) piece.enPassantVulnerable = false;
  movingPiece.enPassantVulnerable = movingPiece.type === "pawn"
    && Math.abs(squareToPosition(fromSquare).rank - squareToPosition(toSquare).rank) === 2;
  gameState.pieces = gameState.pieces.filter((piece) => piece.square !== capturedSquare || piece === movingPiece);
  movingPiece.square = toSquare;
  movingPiece.hasMoved = true;

  let castledRook = null;
  if (moveData?.castle?.rookFrom && moveData?.castle?.rookTo) {
    castledRook = getPieceAtSquare(moveData.castle.rookFrom);
    if (castledRook) {
      castledRook.square = moveData.castle.rookTo;
      castledRook.hasMoved = true;
    }
  }

  gameState.currentTurn = gameState.currentTurn === "white" ? "black" : "white";
  gameState.needsPositionRecord = true;
  clearSelection();
  return {
    movingPiece,
    capturedPiece,
    castledRook,
  };
}

function isPromotionSquare(piece) {
  if (!piece || piece.type !== "pawn") {
    return false;
  }

  const { rank } = squareToPosition(piece.square);
  return (piece.color === "white" && rank === 7) || (piece.color === "black" && rank === 0);
}

function applyPromotion(piece, nextType) {
  if (!piece || !promotionTypes.includes(nextType)) {
    return;
  }

  piece.type = nextType;
  piece.imageKey = `${piece.color}-${nextType}`;
  piece.assetPath = null;
}

function createPromotionOptionButton(color, type) {
  const piece = createPieceData(color, type, `${color}-${type}-promotion`);
  const button = document.createElement("button");
  button.type = "button";
  button.className = "promotion-button";
  button.dataset.type = type;

  const pieceElement = document.createElement("div");
  pieceElement.className = "promotion-piece";
  const image = document.createElement("img");
  image.src = getPieceAssetPath(piece);
  image.alt = "";
  image.decoding = "async";
  image.loading = "eager";
  image.draggable = false;
  image.addEventListener("error", () => {
    image.remove();
    pieceElement.classList.add("placeholder-piece", `${color}-${type}`);
    pieceElement.textContent = pieceSymbols[color][type];
  }, { once: true });
  pieceElement.appendChild(image);

  const label = document.createElement("span");
  label.className = "promotion-label";
  label.textContent = type[0].toUpperCase() + type.slice(1);

  button.appendChild(pieceElement);
  button.appendChild(label);
  return button;
}

function openPromotionChooser(piece) {
  gameState.pendingPromotion = piece;
  promotionTitleElement.textContent = "What do you want to change your pawn into?";
  promotionOptionsElement.innerHTML = "";

  for (const type of promotionTypes) {
    const button = createPromotionOptionButton(piece.color, type);
    button.addEventListener("click", () => {
      applyPromotion(piece, type);
      gameState.pendingPromotion = null;
      updateThreatState(true);
      renderBoard();
      if (!gameState.isGameOver && isSinglePlayerGame() && gameState.currentTurn === "black") {
        maybeRunComputerTurn();
      }
    });
    promotionOptionsElement.appendChild(button);
  }

  promotionOverlayElement.classList.remove("is-hidden");
}

function maybeHandlePromotionAfterMove(moveResult) {
  if (!moveResult?.movingPiece || moveResult?.capturedPiece?.type === "king" || !isPromotionSquare(moveResult.movingPiece)) {
    return false;
  }

  const movingPiece = moveResult.movingPiece;
  const needsPlayerChoice = !isSinglePlayerGame() || movingPiece.color === "white";

  if (needsPlayerChoice) {
    openPromotionChooser(movingPiece);
    return true;
  }

  const randomType = promotionTypes[Math.floor(Math.random() * promotionTypes.length)];
  applyPromotion(movingPiece, randomType);
  return false;
}

function createCelebrationPiece(color, type) {
  const piece = createPieceData(color, type, `${color}-${type}-victory`);
  const visualState = getPieceVisualState(piece);
  const wrapper = document.createElement("div");
  wrapper.className = `victory-piece ${color} ${type}`;

  if (visualState.useImage) {
    const image = document.createElement("img");
    image.className = "victory-piece-img";
    image.src = visualState.assetPath;
    image.alt = "";
    image.decoding = "async";
    image.loading = "eager";
    image.draggable = false;
    wrapper.appendChild(image);
  } else {
    wrapper.classList.add("placeholder-piece", `${color}-${type}`);
    const label = document.createElement("span");
    label.className = "victory-piece-label";
    label.textContent = pieceSymbols[color][type];
    wrapper.appendChild(label);
  }

  return wrapper;
}

function launchConfetti() {
  const colors = ["#ffe798", "#ffd1a3", "#b8e1ff", "#ffb7a8", "#fff6d8"];

  for (let index = 0; index < 22; index += 1) {
    const piece = document.createElement("span");
    piece.className = "confetti-piece";
    piece.style.left = `${Math.random() * 100}%`;
    piece.style.top = `${8 + Math.random() * 12}%`;
    piece.style.background = colors[index % colors.length];
    piece.style.animationDelay = `${Math.random() * 0.16}s`;
    piece.style.animationDuration = `${2.2 + Math.random() * 0.9}s`;
    piece.style.setProperty("--confetti-drift", `${-80 + Math.random() * 160}px`);
    piece.style.setProperty("--confetti-rotate", `${180 + Math.random() * 320}deg`);
    victoryOverlayElement.appendChild(piece);

    window.setTimeout(() => {
      piece.remove();
    }, 3400);
  }
}

function endGameWithWinner(winnerColor, reason = "capture") {
  gameState.winner = winnerColor;
  gameState.isGameOver = true;
  gameState.isStalemate = false;
  gameState.drawReason = null;
  gameState.isComputerThinking = false;

  if (gameState.aiTimerId) {
    window.clearTimeout(gameState.aiTimerId);
    gameState.aiTimerId = null;
  }

  const winnerName = winnerColor[0].toUpperCase() + winnerColor.slice(1);
  statusElement.textContent = `${winnerName} wins!`;
  victoryTitleElement.textContent = `${winnerName} Wins!`;
  victoryMessageElement.textContent = reason === "checkmate" ? "Checkmate!" : "The king has fallen!";
  victoryLeftPieceElement.innerHTML = "";
  victoryRightPieceElement.innerHTML = "";
  victoryLeftPieceElement.appendChild(createCelebrationPiece(winnerColor, "king"));
  victoryRightPieceElement.appendChild(createCelebrationPiece(winnerColor, "queen"));
  victoryOverlayElement.classList.remove("is-hidden");
  playSoundEffect(reason === "checkmate" ? "checkmate" : "victory");
  launchConfetti();
}

function endGameAsDraw(reason) {
  gameState.winner = null;
  gameState.isGameOver = true;
  gameState.isStalemate = reason === "stalemate";
  gameState.drawReason = reason;
  gameState.isComputerThinking = false;
  clearSelection();

  if (gameState.aiTimerId) {
    window.clearTimeout(gameState.aiTimerId);
    gameState.aiTimerId = null;
  }

  statusElement.textContent = `Draw! ${drawMessages[reason]}`;
  victoryTitleElement.textContent = "Draw!";
  victoryMessageElement.textContent = drawMessages[reason];
  victoryLeftPieceElement.innerHTML = "";
  victoryRightPieceElement.innerHTML = "";
  victoryLeftPieceElement.appendChild(createCelebrationPiece("white", "king"));
  victoryRightPieceElement.appendChild(createCelebrationPiece("black", "king"));
  victoryOverlayElement.classList.remove("is-hidden");
}

function updateThreatState(playSound = false) {
  if (gameState.isGameOver || gameState.pendingPromotion) return gameState.checkState;
  if (gameState.needsPositionRecord) recordDrawPosition();
  const nextState = evaluateTurnState(gameState.currentTurn, gameState.pieces);
  gameState.checkState = nextState;

  gameState.isStalemate = false;
  if (nextState.checkmate) {
    endGameWithWinner(gameState.currentTurn === "white" ? "black" : "white", "checkmate");
    return nextState;
  }
  const drawReason = getDrawReason(nextState);
  if (drawReason) {
    endGameAsDraw(drawReason);
    return nextState;
  }

  if (playSound) {
    if (nextState.checkmate) {
      playSoundEffect("checkmate");
    } else if (nextState.inCheck) {
      playSoundEffect("check");
    }
  }

  return nextState;
}

function buildAnimationClone(sourceElement, rect) {
  const clone = sourceElement.cloneNode(true);
  clone.classList.remove("selected", "is-arriving-piece");
  clone.classList.add("animation-piece");
  clone.style.left = `${rect.left}px`;
  clone.style.top = `${rect.top}px`;
  clone.style.width = `${rect.width}px`;
  clone.style.height = `${rect.height}px`;
  clone.style.margin = "0";
  animationLayerElement.appendChild(clone);
  return clone;
}

function createImpactBurst(rect, intensity = "move") {
  if (!rect) {
    return null;
  }

  const burst = document.createElement("div");
  burst.className = `impact-burst ${intensity}`;
  burst.style.left = `${rect.left + rect.width / 2}px`;
  burst.style.top = `${rect.top + rect.height / 2}px`;
  const multiplier = intensity === "capture" ? 0.52 : 0.38;
  burst.style.width = `${Math.max(rect.width * multiplier, 24)}px`;
  burst.style.height = `${Math.max(rect.height * multiplier, 24)}px`;
  animationLayerElement.appendChild(burst);
  return burst;
}

function runOnNextPaint(callback) {
  requestAnimationFrame(() => {
    requestAnimationFrame(callback);
  });
}

function animateMoveTransition(moveSnapshot) {
  if (!moveSnapshot || !moveSnapshot.movingElement || !moveSnapshot.fromRect) {
    return;
  }

  const destinationElement = getRenderedPieceElement(moveSnapshot.toSquare);
  const destinationSquare = getSquareElement(moveSnapshot.toSquare);
  const destinationRect = destinationElement?.getBoundingClientRect() || destinationSquare?.getBoundingClientRect();

  if (!destinationRect) {
    return;
  }

  const movingClone = buildAnimationClone(moveSnapshot.movingElement, moveSnapshot.fromRect);
  const incomingPiece = destinationElement;
  const incomingRook = moveSnapshot.rookToSquare ? getRenderedPieceElement(moveSnapshot.rookToSquare) : null;
  const incomingRookRect = incomingRook?.getBoundingClientRect();

  if (incomingPiece) {
    incomingPiece.classList.add("is-arriving-piece");
  }
  if (incomingRook) {
    incomingRook.classList.add("is-arriving-piece");
  }

  let rookClone = null;
  let captureClone = null;
  let impactBurst = createImpactBurst(destinationRect, moveSnapshot.capturedElement ? "capture" : "move");
  if (moveSnapshot.capturedElement && moveSnapshot.captureRect) {
    captureClone = buildAnimationClone(moveSnapshot.capturedElement, moveSnapshot.captureRect);
    captureClone.classList.add("capture-fade");
  }

  if (moveSnapshot.rookElement && moveSnapshot.rookRect && incomingRookRect) {
    rookClone = buildAnimationClone(moveSnapshot.rookElement, moveSnapshot.rookRect);
  }

  runOnNextPaint(() => {
    const deltaX = destinationRect.left - moveSnapshot.fromRect.left;
    const deltaY = destinationRect.top - moveSnapshot.fromRect.top;

    movingClone.style.transform = `translate(${deltaX}px, ${deltaY - 20}px) scale(1.14)`;
    movingClone.classList.add("move-lift");

    if (rookClone && moveSnapshot.rookRect && incomingRookRect) {
      const rookDeltaX = incomingRookRect.left - moveSnapshot.rookRect.left;
      const rookDeltaY = incomingRookRect.top - moveSnapshot.rookRect.top;
      rookClone.style.transform = `translate(${rookDeltaX}px, ${rookDeltaY - 12}px) scale(1.08)`;
      rookClone.classList.add("move-lift", "rook-shift");
    }

    if (captureClone) {
      captureClone.classList.add("is-capturing");
    }

    if (impactBurst) {
      impactBurst.classList.add("is-active");
    }
  });

  window.setTimeout(() => {
    movingClone.remove();
    if (rookClone) {
      rookClone.remove();
    }
    if (captureClone) {
      captureClone.remove();
    }
    if (impactBurst) {
      impactBurst.remove();
    }
    if (incomingPiece) {
      incomingPiece.classList.remove("is-arriving-piece");
    }
    if (incomingRook) {
      incomingRook.classList.remove("is-arriving-piece");
    }
  }, gameConfig.moveAnimationDurationMs);
}

function maybeRunComputerTurn() {
  if (!isSinglePlayerGame() || gameState.currentTurn !== "black" || gameState.isGameOver || gameState.pendingPromotion) {
    return;
  }

  gameState.isComputerThinking = true;
  renderBoard();

  gameState.aiTimerId = window.setTimeout(async () => {
    gameState.aiTimerId = null;
    const piecesBeforeSearch = gameState.pieces;
    const computerMove = await chooseComputerMove();
    if (gameState.pieces !== piecesBeforeSearch || gameState.screen !== "game" || gameState.isGameOver) return;
    gameState.isComputerThinking = false;

    if (!computerMove) {
      updateThreatState(false);
      renderBoard();
      return;
    }

    const moveSnapshot = {
      fromSquare: computerMove.fromSquare,
      toSquare: computerMove.toSquare,
      movingElement: getRenderedPieceElement(computerMove.fromSquare),
      fromRect: getRenderedPieceElement(computerMove.fromSquare)?.getBoundingClientRect(),
      capturedElement: getRenderedPieceElement(computerMove.enPassant || computerMove.toSquare),
      captureRect: getRenderedPieceElement(computerMove.enPassant || computerMove.toSquare)?.getBoundingClientRect(),
      rookToSquare: computerMove.castle?.rookTo || null,
      rookElement: computerMove.castle?.rookFrom ? getRenderedPieceElement(computerMove.castle.rookFrom) : null,
      rookRect: computerMove.castle?.rookFrom ? getRenderedPieceElement(computerMove.castle.rookFrom)?.getBoundingClientRect() : null,
    };

    const moveResult = performMove(computerMove.fromSquare, computerMove.toSquare, computerMove);
    if (moveResult?.capturedPiece?.type === "king") {
      endGameWithWinner("black");
      renderBoard();
      return;
    }
    const promotionHandled = maybeHandlePromotionAfterMove(moveResult);
    if (!promotionHandled) {
      updateThreatState(true);
    }
    renderBoard();
    animateMoveTransition(moveSnapshot);
    playSoundEffect(moveResult?.capturedPiece ? "capture" : "move");
  }, gameConfig.aiMoveDelayMs);
}

function handleSquareClick(squareName) {
  if (gameState.screen !== "game" || gameState.isComputerThinking || gameState.isGameOver || gameState.pendingPromotion || !isHumanTurn()) {
    return;
  }

  const clickedPiece = getPieceAtSquare(squareName);
  const validMove = gameState.validMoves.find((move) => move.square === squareName);

  if (gameState.selectedPiece && validMove) {
    const moveSnapshot = {
      fromSquare: gameState.selectedPiece.square,
      toSquare: squareName,
      movingElement: getRenderedPieceElement(gameState.selectedPiece.square),
      fromRect: getRenderedPieceElement(gameState.selectedPiece.square)?.getBoundingClientRect(),
      capturedElement: getRenderedPieceElement(validMove.enPassant || squareName),
      captureRect: getRenderedPieceElement(validMove.enPassant || squareName)?.getBoundingClientRect(),
      rookToSquare: validMove.castle?.rookTo || null,
      rookElement: validMove.castle?.rookFrom ? getRenderedPieceElement(validMove.castle.rookFrom) : null,
      rookRect: validMove.castle?.rookFrom ? getRenderedPieceElement(validMove.castle.rookFrom)?.getBoundingClientRect() : null,
    };

    const moveResult = performMove(gameState.selectedPiece.square, squareName, validMove);
    if (moveResult?.capturedPiece?.type === "king") {
      endGameWithWinner(moveResult.movingPiece.color);
      renderBoard();
      return;
    }
    const promotionHandled = maybeHandlePromotionAfterMove(moveResult);
    if (!promotionHandled) {
      updateThreatState(true);
    }
    renderBoard();
    animateMoveTransition(moveSnapshot);
    playSoundEffect(moveResult?.capturedPiece ? "capture" : "move");
    if (promotionHandled) {
      return;
    }
    maybeRunComputerTurn();
    return;
  }

  if (!clickedPiece) {
    clearSelection();
    renderBoard();
    return;
  }

  if (clickedPiece.color !== gameState.currentTurn) {
    return;
  }

  if (gameState.selectedPiece && gameState.selectedPiece.square === squareName) {
    clearSelection();
  } else {
    setSelectedPiece(clickedPiece);
  }

  renderBoard();
}

function updateStatusText() {
  if (gameState.isGameOver && gameState.drawReason) {
    statusElement.textContent = `Draw! ${drawMessages[gameState.drawReason]}`;
    return;
  }
  if (gameState.isGameOver && gameState.winner) {
    const winnerName = gameState.winner[0].toUpperCase() + gameState.winner.slice(1);
    statusElement.textContent = `${winnerName} wins!`;
    return;
  }

  if (gameState.checkState.checkmate && gameState.checkState.checkedColor) {
    const checkedName = gameState.checkState.checkedColor[0].toUpperCase() + gameState.checkState.checkedColor.slice(1);
    statusElement.textContent = `${checkedName} is in checkmate!`;
    return;
  }

  if (gameState.checkState.inCheck && gameState.checkState.checkedColor) {
    const checkedName = gameState.checkState.checkedColor[0].toUpperCase() + gameState.checkState.checkedColor.slice(1);
    statusElement.textContent = `${checkedName} is in check!`;
    return;
  }

  statusElement.textContent = "";
}

function updateHud() {
  modeDisplayElement.textContent = gameState.mode === "single" ? "Single Player" : "Two Player";
  levelDisplayElement.textContent = gameState.level === null ? "-" : String(gameState.level);
  turnDisplayElement.textContent = gameState.currentTurn[0].toUpperCase() + gameState.currentTurn.slice(1);
  guideDisplayElement.textContent = gameState.moveGuideEnabled ? "On" : "Off";
  guideToggleButton.setAttribute("aria-pressed", String(gameState.moveGuideEnabled));
  guideToggleButton.classList.toggle("is-off", !gameState.moveGuideEnabled);
  turnPillElement.classList.toggle("white-turn", gameState.currentTurn === "white");
  turnPillElement.classList.toggle("black-turn", gameState.currentTurn === "black");
  boardFrameElement.classList.toggle("white-turn-glow", gameState.currentTurn === "white");
  boardFrameElement.classList.toggle("black-turn-glow", gameState.currentTurn === "black");
  drawButton.classList.toggle("is-hidden", gameState.mode !== "two");
  drawButton.disabled = gameState.isGameOver || Boolean(gameState.pendingPromotion);
  victoryOverlayElement.classList.toggle("is-hidden", !gameState.isGameOver);
  promotionOverlayElement.classList.toggle("is-hidden", !gameState.pendingPromotion);
}

function createCapturedPieceElement(piece) {
  const tile = document.createElement("div");
  tile.className = "captured-piece";
  tile.dataset.color = piece.color;
  tile.dataset.type = piece.type;
  tile.title = `${piece.color} ${piece.type}`;

  const visualState = getPieceVisualState(piece);
  if (visualState.useImage) {
    tile.classList.add("image-piece");
    const image = document.createElement("img");
    image.className = "captured-piece-img";
    image.src = visualState.assetPath;
    image.alt = "";
    image.decoding = "async";
    image.loading = "eager";
    image.draggable = false;
    image.setAttribute("aria-hidden", "true");
    tile.appendChild(image);
  } else {
    tile.classList.add("placeholder-piece", `${piece.color}-${piece.type}`);
    const label = document.createElement("span");
    label.className = "captured-piece-label";
    label.textContent = pieceSymbols[piece.color][piece.type];
    tile.appendChild(label);

    for (const assetPath of getPieceAssetOptions(piece)) {
      requestPieceAssetCheck(assetPath);
    }
  }

  return tile;
}

function renderCapturedPieces() {
  if (!capturedWhiteElement || !capturedBlackElement) {
    return;
  }

  const targets = [
    { element: capturedWhiteElement, pieces: gameState.capturedPieces.white },
    { element: capturedBlackElement, pieces: gameState.capturedPieces.black },
  ];

  for (const target of targets) {
    target.element.innerHTML = "";

    for (const piece of target.pieces) {
      target.element.appendChild(createCapturedPieceElement(piece));
    }
  }
}

function createPieceElement(piece) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = `piece ${piece.color} ${piece.type}`;
  button.dataset.square = piece.square;
  button.dataset.color = piece.color;
  button.dataset.type = piece.type;
  button.dataset.imageKey = piece.imageKey;
  button.setAttribute("aria-label", `${piece.color} ${piece.type} on ${piece.square}`);

  if (gameState.selectedPiece && gameState.selectedPiece.square === piece.square) {
    button.classList.add("selected");
  }

  if (!gameState.isGameOver && piece.color === gameState.currentTurn) {
    button.classList.add("current-turn-piece");
  }

  const visualState = getPieceVisualState(piece);
  button.dataset.asset = visualState.assetPath || "";

  const label = document.createElement("span");
  label.className = "piece-label";
  label.textContent = pieceSymbols[piece.color][piece.type];
  label.setAttribute("aria-hidden", visualState.useImage ? "true" : "false");

  const badge = document.createElement("span");
  badge.className = "piece-badge";
  badge.textContent = piece.type[0].toUpperCase();
  badge.setAttribute("aria-hidden", "true");

  if (visualState.useImage) {
    button.classList.add("image-piece");
    if (gameState.mode === "two" && piece.color === "black") {
      button.classList.add("rotated-piece");
    }
    const image = document.createElement("img");
    image.className = "piece-img";
    image.src = visualState.assetPath;
    image.alt = "";
    image.decoding = "async";
    image.loading = "eager";
    image.draggable = false;
    image.setAttribute("aria-hidden", "true");
    button.appendChild(image);
  } else {
    button.classList.add("placeholder-piece", `${piece.color}-${piece.type}`);
    for (const assetPath of getPieceAssetOptions(piece)) {
      requestPieceAssetCheck(assetPath);
    }
  }

  button.appendChild(badge);
  button.appendChild(label);
  button.addEventListener("click", (event) => {
    event.stopPropagation();
    handleSquareClick(piece.square);
  });

  return button;
}

function addMoveIndicator(squareElement, move) {
  if (shouldShowMoveDots()) {
    squareElement.classList.add(move.type === "capture" ? "capture-dot" : "move-dot");
    return;
  }

  if (shouldShowMoveHighlights()) {
    squareElement.classList.add(move.type === "capture" ? "capture-move" : "valid-move");
  }
}

function createSquare(rank, fileIndex) {
  const square = document.createElement("div");
  const squareName = `${files[fileIndex]}${8 - rank}`;
  const isLightSquare = (rank + fileIndex) % 2 === 0;
  const move = gameState.validMoves.find((validMove) => validMove.square === squareName);

  square.className = `square ${isLightSquare ? "light" : "dark"}`;
  square.dataset.square = squareName;
  square.setAttribute("role", "gridcell");

  if (move) {
    addMoveIndicator(square, move);
  }

  square.addEventListener("click", () => handleSquareClick(squareName));

  return square;
}

function renderBoard() {
  const pieceMap = createPieceMap();
  boardElement.innerHTML = "";

  for (let rank = 0; rank < 8; rank += 1) {
    for (let fileIndex = 0; fileIndex < 8; fileIndex += 1) {
      const square = createSquare(rank, fileIndex);
      const piece = pieceMap.get(square.dataset.square);

      if (piece) {
        square.appendChild(createPieceElement(piece));
      }

      boardElement.appendChild(square);
    }
  }

  renderCapturedPieces();
  updateHud();
  updateStatusText();
}

function triggerStartCharacterInteraction(element) {
  playSoundEffect("character");
  element.classList.remove("is-animated");
  void element.offsetWidth;
  element.classList.add("is-animated");

  const existingTimer = interactionState.characterTimers.get(element);
  if (existingTimer) {
    window.clearTimeout(existingTimer);
  }

  const timerId = window.setTimeout(() => {
    element.classList.remove("is-animated");
    interactionState.characterTimers.delete(element);
  }, 1000);

  interactionState.characterTimers.set(element, timerId);
}

function attachSetupEvents() {
  const unlockAudio = () => unlockAudioContext();
  const resetPullRefreshState = () => {
    interactionState.touchStartY = null;
    interactionState.touchLatestY = null;
    interactionState.pullRefreshHandled = false;
  };

  window.addEventListener("pointerdown", unlockAudio, { passive: true });
  window.addEventListener("keydown", unlockAudio);
  window.addEventListener("touchstart", (event) => {
    if (event.touches.length === 1) {
      interactionState.touchStartY = event.touches[0].clientY;
      interactionState.touchLatestY = event.touches[0].clientY;
      interactionState.pullRefreshHandled = false;
    }
  }, { passive: true });
  window.addEventListener("touchmove", (event) => {
    if (event.touches.length !== 1 || interactionState.touchStartY === null) {
      return;
    }

    const currentY = event.touches[0].clientY;
    interactionState.touchLatestY = currentY;
    const isPullingDown = currentY > interactionState.touchStartY;
    if (isPullingDown && window.scrollY <= 0) {
      event.preventDefault();
    }
  }, { passive: false });
  window.addEventListener("touchend", () => {
    if (
      interactionState.touchStartY !== null &&
      interactionState.touchLatestY !== null &&
      !interactionState.pullRefreshHandled &&
      window.scrollY <= 0
    ) {
      const pullDistance = interactionState.touchLatestY - interactionState.touchStartY;
      if (pullDistance >= 80) {
        interactionState.pullRefreshHandled = true;
        const shouldReload = window.confirm("새로고침하시겠습니까?");
        if (shouldReload) {
          window.location.reload();
        }
      }
    }

    resetPullRefreshState();
  }, { passive: true });
  window.addEventListener("touchcancel", resetPullRefreshState, { passive: true });

  for (const character of startCharacterElements) {
    character.addEventListener("pointerenter", () => triggerStartCharacterInteraction(character));
    character.addEventListener("pointerdown", () => triggerStartCharacterInteraction(character));
  }

  for (const button of modeOptionButtons) {
    button.addEventListener("click", () => {
      setupState.mode = button.dataset.modeOption;

       if (setupState.mode === "two") {
        setupState.level = null;
        updateSetupControls();
        startGame();
        return;
      }

      if (setupState.level === null) {
        setupState.level = 1;
      }

      updateSetupControls();
    });
  }

  for (const button of levelOptionButtons) {
    button.addEventListener("click", () => {
      setupState.mode = "single";
      setupState.level = Number(button.dataset.levelOption);
      updateSetupControls();
      startGame();
    });
  }

  newGameButton.addEventListener("click", showStartScreen);
  drawButton.addEventListener("click", () => {
    if (gameState.mode !== "two" || gameState.isGameOver || gameState.pendingPromotion) return;
    if (window.confirm("Do both players agree to end this game as a draw?")) {
      endGameAsDraw("agreement");
      renderBoard();
    }
  });
  guideToggleButton.addEventListener("click", () => {
    gameState.moveGuideEnabled = !gameState.moveGuideEnabled;
    renderBoard();
  });
}

attachSetupEvents();
updateSetupControls();
primePieceAssetChecks();
