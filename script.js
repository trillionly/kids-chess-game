const boardElement = document.getElementById("chessboard");
const statusElement = document.getElementById("game-status");

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
};

const gameState = {
  currentTurn: "white",
  pieces: createStartingPieces(),
  selectedSquare: null,
  validMoves: [],
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

  const captureOffsets = [-1, 1];
  for (const fileOffset of captureOffsets) {
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

function getValidMoves(piece) {
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
  gameState.selectedSquare = null;
  gameState.validMoves = [];
}

function setSelectedPiece(piece) {
  gameState.selectedSquare = piece.square;
  gameState.validMoves = getValidMoves(piece);
}

function movePiece(fromSquare, toSquare) {
  const movingPiece = getPieceAtSquare(fromSquare);
  if (!movingPiece) {
    return;
  }

  gameState.pieces = gameState.pieces.filter((piece) => piece.square !== toSquare || piece === movingPiece);
  movingPiece.square = toSquare;
  gameState.currentTurn = gameState.currentTurn === "white" ? "black" : "white";
  clearSelection();
}

function handleSquareClick(squareName) {
  const clickedPiece = getPieceAtSquare(squareName);
  const validMove = gameState.validMoves.find((move) => move.square === squareName);

  if (gameState.selectedSquare && validMove) {
    movePiece(gameState.selectedSquare, squareName);
    renderBoard();
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

  if (gameState.selectedSquare === squareName) {
    clearSelection();
  } else {
    setSelectedPiece(clickedPiece);
  }

  renderBoard();
}

function updateStatusText() {
  const turnName = gameState.currentTurn[0].toUpperCase() + gameState.currentTurn.slice(1);
  statusElement.textContent = `${turnName}'s turn. Select a pawn, rook, or knight.`;
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

  if (gameState.selectedSquare === piece.square) {
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

function createSquare(rank, fileIndex) {
  const square = document.createElement("div");
  const isLightSquare = (rank + fileIndex) % 2 === 0;
  const squareName = `${files[fileIndex]}${8 - rank}`;
  const move = gameState.validMoves.find((validMove) => validMove.square === squareName);

  square.className = `square ${isLightSquare ? "light" : "dark"}`;
  square.dataset.square = squareName;
  square.dataset.label = squareName;
  square.setAttribute("role", "gridcell");

  if (move) {
    square.classList.add(move.type === "capture" ? "capture-move" : "valid-move");
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
      const squareName = square.dataset.square;
      const piece = pieceMap.get(squareName);

      if (piece) {
        square.appendChild(createPieceElement(piece));
      }

      boardElement.appendChild(square);
    }
  }

  updateStatusText();
}

renderBoard();
