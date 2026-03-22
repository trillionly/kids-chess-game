const boardElement = document.getElementById("chessboard");

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

let selectedPiece = null;

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

function createPieceElement(piece) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = `piece ${piece.color}`;
  button.dataset.square = piece.square;
  button.dataset.color = piece.color;
  button.dataset.type = piece.type;
  button.dataset.asset = getPieceAssetPath(piece);
  button.setAttribute("aria-label", `${piece.color} ${piece.type} on ${piece.square}`);

  const label = document.createElement("span");
  label.className = "piece-label";
  label.textContent = pieceSymbols[piece.color][piece.type];

  if (gameConfig.usePieceImages) {
    button.classList.add("image-piece");
    button.style.backgroundImage = `url("${button.dataset.asset}")`;
  }

  button.appendChild(label);
  button.addEventListener("click", () => selectPiece(button));

  return button;
}

function selectPiece(pieceElement) {
  if (selectedPiece) {
    selectedPiece.classList.remove("selected");
  }

  if (selectedPiece === pieceElement) {
    selectedPiece = null;
    return;
  }

  pieceElement.classList.add("selected");
  selectedPiece = pieceElement;
}

function createSquare(rank, file) {
  const square = document.createElement("div");
  const isLightSquare = (rank + file) % 2 === 0;
  const squareName = `${files[file]}${8 - rank}`;

  square.className = `square ${isLightSquare ? "light" : "dark"}`;
  square.dataset.square = squareName;
  square.dataset.label = squareName;
  square.setAttribute("role", "gridcell");

  return square;
}

function renderBoard() {
  const pieces = createStartingPieces();
  const pieceMap = new Map(pieces.map((piece) => [piece.square, piece]));

  for (let rank = 0; rank < 8; rank += 1) {
    for (let file = 0; file < 8; file += 1) {
      const square = createSquare(rank, file);
      const squareName = square.dataset.square;
      const piece = pieceMap.get(squareName);

      if (piece) {
        square.appendChild(createPieceElement(piece));
      }

      boardElement.appendChild(square);
    }
  }
}

renderBoard();
