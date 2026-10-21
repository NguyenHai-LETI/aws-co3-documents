#!/bin/bash
# macOS: double-click in Finder to start the SAA-C03 Trainer (opens Terminal + the browser).
# First time: if macOS blocks it, right-click → Open. Same as ./start.sh (incl. the restart after an app update — exit
# code 75 → npm install when needed → start again), but keeps the window open on errors.
cd "$(dirname "$0")" || exit 1
TRAINER_PAUSE=1 exec bash ./start.sh "$@"
