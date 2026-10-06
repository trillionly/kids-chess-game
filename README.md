# kids-chess-game
kids-chess-game for my son

Open `index.html` in a browser to play; no server or installation is required.

The computer uses iterative deepening with alpha-beta search (up to four plies),
plus two extra plies for captures and check evasions. Evaluation considers material,
development, central squares, king placement, and automatic queen promotion.
Search yields between short batches so a new game can cancel pending calculations.

Levels 1-10 share this engine with beginner-friendly strength settings. Level 1
chooses a random legal move 85% of the time; that probability decreases by about
9.4 percentage points per level to 0% at level 10. Discovered mates are retained.
Evaluated choices allow 400-40 centipawns of score loss, narrowing by 40 per level.
Each step adds 65 ms to the search budget (100-685 ms). Levels 1-3 search one ply
with no extra capture search, levels 4-6 up to two with one extra capture ply,
levels 7-9 up to three with two extra capture plies, and level 10 up to four.
These settings provide gradual average strength changes, not measured Elo ratings
or a guaranteed win rate. Actual search depth depends on the position and device.
The engine uses the game's existing move rules.

Draws end the game automatically for stalemate, insufficient mating material,
threefold repetition, and 50 moves per side without a pawn move or capture.
The fivefold/75-move thresholds are also recognized, although the earlier automatic
thresholds normally end the game first. Checkmate takes priority on the final move.
Two-player games also support an agreed draw through the Draw button.

Repetition identity includes the player to move, castling rights, and legally
available en passant captures. Move history is finalized after promotion.
Players must make legal moves, and checkmate now ends the game without capturing
the king. Recognized dead positions include bare kings, a lone bishop or knight,
bishops restricted to one square color, and permanently sealed pawn-only barriers.
This is not an exhaustive solver for every unusual dead position involving blocked
pieces. There is no chess clock, so time-expiration rules do not apply.

FIDE normally requires a claim for threefold repetition and the 50-move rule;
this child-friendly game applies them automatically.
Reference: https://handbook.fide.com/chapter/e012023

Run regression checks with `node --test tests/ai.test.cjs tests/draw.test.cjs`.
