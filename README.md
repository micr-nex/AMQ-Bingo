# AMQ Bingo

Bingo for [Anime Music Quiz](https://animemusicquiz.com). Every player gets a 5×5 board of things that can happen in a game ("Movie", "Get a solo", "Song title is ALL CAPS"…). Most tiles mark themselves after each song, and the host's panel checks everyone's bingos.

## Install

1. Install [Tampermonkey](https://www.tampermonkey.net/) in your browser.
2. Open **[amqBingo.user.js](https://raw.githubusercontent.com/micr-nex/AMQ-Bingo/main/amqBingo.user.js)** and click **Install**.
3. Reload AMQ.

Updates install themselves (Tampermonkey checks about once a day). To update right away: Tampermonkey dashboard → **Check for userscript updates**. If the host is on a newer version, the script tells you in chat.

## Playing

- When the host announces a round in chat, your board appears. **Alt+G** shows or hides it.
- Plain tiles mark themselves after each song. Striped ✋ tiles are ones you click yourself when they happen.
- E / M / H on each tile means easy / medium / hard.
- Get five in a row (row, column or diagonal) and press **BINGO!**. Your board goes to the host with the call.
- The small log under the board shows what each song marked.

## Hosting

- **Alt+H** opens the host panel.
- **Game** tab: *Announce & start game* posts the round code and starts AMQ. *End round now* ends the round (and can return the room to the lobby).
- **Players** tab: everyone's board and which of their lines tracking confirmed.
- **Tiles** tab: tick judgment tiles when they happen, or add your own tiles.
- **Settings** tab: tile set (Casual / Standard / Expert), wild card, one tile per song, only on songs you got right, lock auto tiles, rounds, and more.

A solo game gets a speedrun timer, and the fifth column becomes a mix of the other four.

## Files

- `amqBingo.user.js`: the script everyone installs.
- `amqBingoLogger.user.js` (optional): records a game's events so problems can be fixed. It never answers or sends anything. Press **Alt+L** after a game to copy the log.
