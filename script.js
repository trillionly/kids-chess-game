const boardElement = document.getElementById("chessboard");
const statusElement = document.getElementById("game-status");
const startScreenElement = document.getElementById("start-screen");
const gameScreenElement = document.getElementById("game-screen");
const levelGroupElement = document.getElementById("level-group");
const modeDisplayElement = document.getElementById("mode-display");
const levelDisplayElement = document.getElementById("level-display");
const turnDisplayElement = document.getElementById("turn-display");
const startGameButton = document.getElementById("start-game-button");
const newGameButton = document.getElementById("new-game-button");

const modeOptionButtons = Array.from(document.querySelectorAll("[data-mode-option]"));
const levelOptionButtons = Array.from(document.querySelectorAll("[data-level-option]"));

const files = ["a", "b", "c", "d", "e", "f", "g", "h"];
const backRank = ["rook", "knight", "bishop", "queen", "king", "bishop", "knight", "rook"];

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
  usePieceImages: false,
  aiMoveDelayMs: 500,
};

const setupState = {
  mode: "single",
  level: 1,
};

const gameState = {
  screen: "start",
  mode: "single",
  level: 1,
  currentTurn: "white",
  selectedPiece: null,
  validMoves: [],
  pieces: createStartingPieces(),
  isComputerThinking: false,
  aiTimerId: null,
};

function createStartingPieces() {
  const pieces = [];

  for (let index = 0; index < files.length; index += 1) {
    const file = files[index];
    const majorPiece = backRank[index];

    pieces.push({ color: "black", type: majorPiece, square: `${file}8` });
    pieces.push({ color: "black", type: "pawn", square: `${file}7` });
    pieces.push({ color: "white", type: "pawn", square: `${file}2` });
    pieces.push({ color: "white", type: majorPiece, square: `${file}1` });
  }

  return pieces;
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
  gameState.isComputerThinking = false;
}

function startGame() {
  gameState.mode = setupState.mode;
  gameState.level = setupState.level;
  gameState.screen = "game";
  resetBoardState();

  startScreenElement.classList.add("is-hidden");
  gameScreenElement.classList.remove("is-hidden");

  renderBoard();
}

function showStartScreen() {
  if (gameState.aiTimerId) {
    window.clearTimeout(gameState.aiTimerId);
    gameState.aiTimerId = null;
  }

  gameState.screen = "start";
  gameState.selectedPiece = null;
  gameState.validMoves = [];
  gameState.isComputerThinking = false;
  startScreenElement.classList.remove("is-hidden");
  gameScreenElement.classList.add("is-hidden");
  updateSetupControls();
}

function updateSetupControls() {
  for (const button of modeOptionButtons) {
    button.classList.toggle("is-selected", button.dataset.modeOption === setupState.mode);
  }

  for (const button of levelOptionButtons) {
    button.classList.toggle("is-selected", Number(button.dataset.levelOption) === setupState.level);
  }

  levelGroupElement.classList.toggle("is-hidden", setupState.mode !== "single");
}

function getPieceAssetPath(piece) {
  return `assets/pieces/${piece.color}-${piece.type}.png`;
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

function createPieceMap() {
  return new Map(gameState.pieces.map((piece) => [piece.square, piece]));
}

function getPawnMoves(piece, pieceMap) {
  const moves = [];
  const { file, rank } = squareToPosition(piece.square);
  const direction = piece.color === "white" ? 1 : -1;

  const forwardSquare = positionToSquare(file, rank + direction);
  if (forwardSquare && !pieceMap.has(forwardSquare)) {
    moves.push({ square: forwardSquare, type: "move" });
  }

  for (const fileOffset of [-1, 1]) {
    const captureSquare = positionToSquare(file + fileOffset, rank + direction);
    const targetPiece = captureSquare ? pieceMap.get(captureSquare) : null;

    if (captureSquare && targetPiece && targetPiece.color !== piece.color) {
      moves.push({ square: captureSquare, type: "capture" });
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

function getValidMovesForPiece(piece) {
  const pieceMap = createPieceMap();

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
    default:
      return [];
  }
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
  return isSinglePlayerGame() && gameState.level <= 3 && gameState.currentTurn === "white";
}

function shouldShowMoveHighlights() {
  return gameState.mode === "two-player";
}

function getAllValidMoves(color) {
  const moves = [];

  for (const piece of gameState.pieces) {
    if (piece.color !== color) {
      continue;
    }

    const validMoves = getValidMovesForPiece(piece);
    for (const move of validMoves) {
      moves.push({
        piece,
        fromSquare: piece.square,
        toSquare: move.square,
        moveType: move.type,
      });
    }
  }

  return moves;
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
    (piece) => piece.square === move.toSquare && piece !== movingPiece,
  );

  if (capturedIndex >= 0) {
    nextPieces.splice(capturedIndex, 1);
  }

  movingPiece.square = move.toSquare;
  return nextPieces;
}

function countAttacksOnSquare(square, attackerColor, pieces) {
  const originalPieces = gameState.pieces;
  gameState.pieces = pieces;
  const attackCount = getAllValidMoves(attackerColor).filter((move) => move.toSquare === square).length;
  gameState.pieces = originalPieces;
  return attackCount;
}

function scoreMove(move, level) {
  let score = Math.random() * 0.2;
  const nextPieces = simulateMove(gameState.pieces, move);

  if (move.moveType === "capture") {
    score += 20;
  }

  if (move.piece.type === "pawn") {
    const destination = squareToPosition(move.toSquare);
    score += move.piece.color === "black" ? 7 - destination.rank : destination.rank;
  }

  if (move.piece.type === "knight") {
    score += 1.2;
  }

  if (level >= 3) {
    const danger = countAttacksOnSquare(move.toSquare, "white", nextPieces);
    score -= danger * 8;
    if (move.moveType === "capture" && danger === 0) {
      score += 6;
    }
  }

  if (level >= 4) {
    score += move.piece.type === "rook" ? 1.6 : 0;
    score += move.moveType === "capture" ? 4 : 0;
  }

  if (level >= 5) {
    const destination = squareToPosition(move.toSquare);
    score += (3.5 - Math.abs(3.5 - destination.file)) * 0.7;
  }

  return score;
}

function chooseComputerMove() {
  const allMoves = getAllValidMoves("black");
  if (allMoves.length === 0) {
    return null;
  }

  if (gameState.level === 1) {
    return allMoves[Math.floor(Math.random() * allMoves.length)];
  }

  if (gameState.level === 2) {
    const captureMoves = allMoves.filter((move) => move.moveType === "capture");
    const movePool = captureMoves.length > 0 ? captureMoves : allMoves;
    return movePool[Math.floor(Math.random() * movePool.length)];
  }

  let bestMove = allMoves[0];
  let bestScore = scoreMove(bestMove, gameState.level);

  for (const move of allMoves.slice(1)) {
    const score = scoreMove(move, gameState.level);
    if (score > bestScore) {
      bestScore = score;
      bestMove = move;
    }
  }

  return bestMove;
}

function performMove(fromSquare, toSquare) {
  const movingPiece = getPieceAtSquare(fromSquare);
  if (!movingPiece) {
    return;
  }

  gameState.pieces = gameState.pieces.filter((piece) => piece.square !== toSquare || piece === movingPiece);
  movingPiece.square = toSquare;
  gameState.currentTurn = gameState.currentTurn === "white" ? "black" : "white";
  clearSelection();
}

function maybeRunComputerTurn() {
  if (!isSinglePlayerGame() || gameState.currentTurn !== "black") {
    return;
  }

  gameState.isComputerThinking = true;
  renderBoard();

  gameState.aiTimerId = window.setTimeout(() => {
    const computerMove = chooseComputerMove();
    gameState.isComputerThinking = false;
    gameState.aiTimerId = null;

    if (!computerMove) {
      statusElement.textContent = "Black has no moves right now.";
      renderBoard();
      return;
    }

    performMove(computerMove.fromSquare, computerMove.toSquare);
    renderBoard();
  }, gameConfig.aiMoveDelayMs);
}

function handleSquareClick(squareName) {
  if (gameState.screen !== "game" || gameState.isComputerThinking || !isHumanTurn()) {
    return;
  }

  const clickedPiece = getPieceAtSquare(squareName);
  const validMove = gameState.validMoves.find((move) => move.square === squareName);

  if (gameState.selectedPiece && validMove) {
    performMove(gameState.selectedPiece.square, squareName);
    renderBoard();
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
  const turnName = gameState.currentTurn[0].toUpperCase() + gameState.currentTurn.slice(1);
  const modeLabel = gameState.mode === "single" ? "Single Player" : "Two Player";

  if (gameState.isComputerThinking) {
    statusElement.textContent = `Black is thinking in ${modeLabel}.`;
    return;
  }

  if (isSinglePlayerGame() && gameState.currentTurn === "white") {
    statusElement.textContent = `Your turn as White. Level ${gameState.level}.`;
    return;
  }

  if (isSinglePlayerGame() && gameState.currentTurn === "black") {
    statusElement.textContent = `Computer turn as Black. Level ${gameState.level}.`;
    return;
  }

  statusElement.textContent = `${turnName}'s turn in ${modeLabel}.`;
}

function updateHud() {
  modeDisplayElement.textContent = gameState.mode === "single" ? "Single Player" : "Two Player";
  levelDisplayElement.textContent = gameState.mode === "single" ? String(gameState.level) : "Local";
  turnDisplayElement.textContent = gameState.currentTurn[0].toUpperCase() + gameState.currentTurn.slice(1);
}

function createPieceElement(piece) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = `piece ${piece.color}`;
  button.dataset.square = piece.square;
  button.dataset.color = piece.color;
  button.dataset.type = piece.type;
  button.dataset.asset = getPieceAssetPath(piece);
  button.setAttribute("aria-label", `${piece.color} ${piece.type} on ${piece.square}`);

  if (gameState.selectedPiece && gameState.selectedPiece.square === piece.square) {
    button.classList.add("selected");
  }

  const label = document.createElement("span");
  label.className = "piece-label";
  label.textContent = pieceSymbols[piece.color][piece.type];

  if (gameConfig.usePieceImages) {
    button.classList.add("image-piece");
    button.style.backgroundImage = `url("${button.dataset.asset}")`;
  }

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
  square.dataset.label = squareName;
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

  updateHud();
  updateStatusText();
}

function attachSetupEvents() {
  for (const button of modeOptionButtons) {
    button.addEventListener("click", () => {
      setupState.mode = button.dataset.modeOption;
      updateSetupControls();
    });
  }

  for (const button of levelOptionButtons) {
    button.addEventListener("click", () => {
      setupState.level = Number(button.dataset.levelOption);
      updateSetupControls();
    });
  }

  startGameButton.addEventListener("click", startGame);
  newGameButton.addEventListener("click", showStartScreen);
}

attachSetupEvents();
updateSetupControls();
