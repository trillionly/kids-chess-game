# kids-chess-game
kids-chess-game for my son

Open `index.html` in a browser to play; no server or installation is required.

The computer uses iterative deepening with alpha-beta search (up to four plies),
plus two extra plies for captures and check evasions. Evaluation considers material,
development, central squares, king placement, and automatic queen promotion.
Search yields between short batches so a new game can cancel pending calculations.

Levels 1-10 share this engine. Each step adds 55 ms to the search budget
(250-745 ms) and reduces the allowed score loss by 18 centipawns (180-18).
Moves within that allowance are weighted toward the best score. These settings
give gradual strength changes, not measured Elo ratings. Actual search depth depends
on the position and device. The engine uses the game's existing move rules.

Run the AI regression checks with `node --test tests/ai.test.cjs`.
