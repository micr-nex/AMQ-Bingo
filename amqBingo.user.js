// ==UserScript==
// @name         AMQ Bingo
// @namespace    http://tampermonkey.net/
// @version      0.39
// @description  Bingo boards that mark themselves as you play. Alt+G: your board. Alt+H: host panel.
// @match        https://animemusicquiz.com/*
// @grant        GM_xmlhttpRequest
// @grant        unsafeWindow
// @connect      anisongdb.com
// @updateURL    https://raw.githubusercontent.com/micr-nex/AMQ-Bingo/main/amqBingo.user.js
// @downloadURL  https://raw.githubusercontent.com/micr-nex/AMQ-Bingo/main/amqBingo.user.js
// @homepageURL  https://github.com/micr-nex/AMQ-Bingo
// ==/UserScript==

(() => {
"use strict";
const SCRIPT_VERSION = "0.39";
const INSTALL_URL = "https://raw.githubusercontent.com/micr-nex/AMQ-Bingo/main/amqBingo.user.js";
/* ---------- shared with the website (same tiles, boards and codes) ---------- */
const COLS = [
  { key: "anime", name: "Anime", tiles: [
    "-Before 2010", "*Before 1990", "-Aired in the last 2 years", "-A sequel", "OVA/ONA/Special/Music", "Movie", "*Mix of Japanese and English", "Title is 7+ words long", "Anime from your list twice in a row", "*Same anime appears twice", "One genre", "*More than 5 genres", "Less than 4 tags", "-More than 15 tags", "*Song name is same as the anime title", "*Tautogram (3 or more words start with the same letter)", "-Title has \"no\" as a word (e.g. Shingeki no Kyojin)", "-Title is one word", "Title includes a character's name", "-Isekai anime", "3 or more Isekai anime in one round", "*Sports anime", "Mecha anime", "-Same franchise appears twice in a row", "Same year twice in a row"] },
  { key: "song", name: "Song", tiles: [
    "English", "Non-Japanese or English title", "Acoustic", "*Sound effects", "Talking/Rapping", "*Male/Female duet (or more)", "*Instrumental", "*Chanting", "-OP/ED number higher than 2", "*Karaoke/Live (bad sound quality on purpose)", "-Song title is one word", "Song title contains a number", "*Song title contains a color", "-Song name drop in audio", "*Song works for 3 or more titles (3+ accepted anime)", "-Three of a kind: 3 OPs, EDs, or Inserts in a row", "Song title has Love, Ai, Koi, or Suki", "-Song title is longer than the anime title", "Song title is ALL CAPS", "Song difficulty 80% or higher", "*Song difficulty 15% or lower", "\"ver.\", \"version\" or \"edit\" in the song title (e.g. TV ver., TV edit)"] },
  { key: "artist", name: "Artist", wild: true, tiles: [
    "-Cast-sung", "-Band/Group", "Artist name is ALL CAPS", "Artist contains a symbol", "*Same artist appears twice", "Non-English/Japanese artist name", "*Inactive artist (solo artists only)", "*Artist younger than you (solo artists only)", "*Right artist, wrong anime (your answer has a song by this artist)", "Weird capitalization (a capital in the middle of a word, like LiSA or nano.RIPE)", "-Collab: \"feat.\" or \"&\" in the artist name", "Idol group or unit (real or from an idol anime)", "*Artist is also the composer", "-Parentheses ( ) in the artist name", "*Artist name starts with \"The\"", "More than 3 artists credited", "-Artist name is one word"] },
  { key: "ind", name: "Individual", tiles: [
    "-Get 3 songs in a row", "Get a solo", "Get an anti-solo", "-Snipe (get a song not on your list)", "Name Drop", "Change your answer from another real title to the right one", "Lock in slower than any of the other people who got it right", "-Type within 5 seconds", "Stay in the top 3 for 3 songs in a row", "*Surpass 3 players in one song", "-Your avatar is unique from others", "-Get the first song of the round right", "Your wrong answer shares a word with the correct title", "Right franchise, wrong season or movie", "-Miss 3 songs in a row", "*Get 5 songs in a row", "*Answer correctly in under 3 seconds", "-Get the last song of the round right", "Reach 10 points (no hints)", "*Reach 15 points (no hints)", "Unique right answer (a title no other correct player used)", "*Flex answer (right with a different show the song also counts for)"] },
  { key: "multi", name: "Multiplayer", tiles: [
    "-Everyone gets a song right", "-No one gets a song right", "*Both players next to you guess it right (if you're on the edge, 1)", "-Someone types an emoji in chat", "The player in 1st place misses, you get it right", "A song from only 1 person's list", "A song from 5 or more people's list", "*2 or more people share the same wrong answer", "Last-place player gets it right", "Half of the people get it right", "Someone else disconnects", "*Everyone gives the same answer", "Tie for 1st place after song 10", "-A song nobody has on their list"] }
].map(col => ({ ...col, pool: col.tiles.map(tile => tile.startsWith("*") ? { text: tile.slice(1), hard: true, d: "H" } : tile.startsWith("-") ? { text: tile.slice(1), hard: false, d: "E" } : { text: tile, hard: false, d: "M" }) }));

/* Tiles in the same family (e.g. Get 3 / 5 / 7 songs in a row) never share a board. */
const FAMILY = {"Before 2010": "before", "Before 1990": "before", "Aired in the last 2 years": "recent", "Same anime appears twice": "sameanime", "Less than 4 tags": "fewtags", "More than 15 tags": "manytags", "Title has \"no\" as a word (e.g. Shingeki no Kyojin)": "no", "Title is one word": "animeoneword", "Isekai anime": "isekai", "3 or more Isekai anime in one round": "isekai", "OP/ED number higher than 2": "opnum", "Song title is one word": "songoneword", "Song title contains a number": "number", "Three of a kind: 3 OPs, EDs, or Inserts in a row": "kind", "Song title has Love, Ai, Koi, or Suki": "love", "Song title is longer than the anime title": "longer", "Song title is ALL CAPS": "caps", "Song difficulty 15% or lower": "lowdiff", "Artist name is ALL CAPS": "caps", "Artist contains a symbol": "symbol", "Same artist appears twice": "sameartist", "Parentheses ( ) in the artist name": "paren", "Get 3 songs in a row": "streak", "Get a solo": "solo", "Snipe (get a song not on your list)": "snipe", "Reach 30 points (hint mode)": "points", "Type within 5 seconds": "speed", "Get the first song of the round right": "first", "Miss 3 songs in a row": "miss", "Everyone gets a song right": "everyone", "No one gets a song right": "noone", "Last-place player gets it right": "lastplace", "Nobody uses a hint": "hintcount", "More than 3 people use a hint": "hintcount", "Season 3 or later": "season", "More than 3 artists credited": "credits", "Get 5 songs in a row": "streak", "Answer correctly in under 2 seconds": "speed", "Answer correctly in under 3 seconds": "speed", "Same franchise appears twice in a row": "franchise", "Reach 10 points (no hints)": "points", "Reach 15 points (no hints)": "points", "Before 2000": "before", "Aired this year": "recent", "Season 4 or later": "season", "Anime title is one word of 4 letters or fewer": "animeoneword", "Title has \"no\" twice (e.g. Boku no Kokoro no Yabai Yatsu)": "no", "33 or more tags": "manytags", "Only 1 or 2 tags": "fewtags", "Same anime appears 3 times": "sameanime", "Same franchise appears 3 times in one round": "franchise", "5 or more Isekai anime in one round": "isekai", "Four of a kind: 4 OPs, EDs, or Inserts in a row": "kind", "OP/ED number 5 or higher": "opnum", "Song title is one word of 3 letters or fewer": "songoneword", "Song title has a number with 3+ digits (e.g. 100, 2024)": "number", "Two love songs in a row (Love, Ai, Koi, Suki)": "love", "Song title twice as long as the anime title": "longer", "Song title and artist both ALL CAPS": "caps", "Song difficulty 10% or lower": "lowdiff", "Artist name has 2 or more different symbols": "symbol", "6 or more artists credited": "credits", "Same artist twice in a row": "sameartist", "Parentheses ( ) in the artist name two songs in a row": "paren", "Get 7 songs in a row": "streak", "Snipe 3 songs in one round": "snipe", "Get the first 3 songs right": "first", "Miss 5 in a row, then get one right": "miss", "Get 3 solos in one round": "solo", "Everyone gets 3 songs in a row right": "everyone", "No one gets 2 songs in a row right": "noone", "Last-place player gets a solo": "lastplace"};

const WILD = [
  { name: "Top Scorer", desc: "Get the most points in-game. Ties are permitted." },
  { name: "Rigged Match", desc: "Get the most songs from your own anime list. You need your list linked." },
  { name: "5 Artists", desc: "Write down 5 artists you think will appear. Mark it if any of them appear." },
  { name: "5 Words", desc: "Write down 5 real English/Japanese nouns, verbs, or adjectives (no proper nouns). Mark it if one appears in an anime title, song name, or artist." },
  { name: "Free? Tile", auto: true, desc: "Starts marked. Remove it for good if you miss more than 2 songs from your list." },
  { name: "Freer? Tile", auto: true, desc: "Starts marked. Remove it for good if you miss a song that everyone else gets." },
  { name: "Linked Fate", desc: "Pick a teammate and share boards. A hit counts for both only if both of you got the song right." },
  { name: "Skilled", desc: "Ignore all number requirements, but you must get the song right that round to mark a tile." },
  { name: "Hinting", auto: true, desc: "Starts marked. Use one chosen hint (not multiple choice) on every song. Break the rule and you lose this tile." },
  { name: "Speed = Experience", auto: true, desc: "Starts marked. Answer within 15 s (under level 10), 12 s (under 25), or 10 s (25+), or you can't mark tiles for that song." },
  { name: "Not Me!", desc: "Predict who wins AMQ and whether they also win the bingo. Mark it if you get both right." }
];

const ALPHA = "ABCDEFGHJKMNPQRSTUVWXYZ";
function hash32(text) { let hash = 2166136261 >>> 0; for (let charNo = 0; charNo < text.length; charNo++) { hash ^= text.charCodeAt(charNo); hash = Math.imul(hash, 16777619); } return hash >>> 0; }
function rng(seed) { let state = hash32(seed); return () => { state |= 0; state = state + 0x6D2B79F5 | 0; let mixed = Math.imul(state ^ state >>> 15, 1 | state); mixed = mixed + Math.imul(mixed ^ mixed >>> 7, 61 | mixed) ^ mixed; return ((mixed ^ mixed >>> 14) >>> 0) / 4294967296; }; }
function shuffle(arr, rand) { const copy = arr.slice(); for (let idx = copy.length - 1; idx > 0; idx--) { const swapIdx = Math.floor(rand() * (idx + 1)); [copy[idx], copy[swapIdx]] = [copy[swapIdx], copy[idx]]; } return copy; }
const norm = text => text.trim().replace(/\s+/g, " ").toLowerCase();
function checkLetter(three, round) { let sum = round * 7; for (let pos = 0; pos < 3; pos++) sum += (ALPHA.indexOf(three[pos]) + 1) * (pos + 3); return ALPHA[sum % ALPHA.length]; }
function codeValid(code, round) { return code.length === 4 && [...code].every(letter => ALPHA.includes(letter)) && checkLetter(code.slice(0, 3), round) === code[3]; }

/* A board is fully decided by name + round code + variant (0 = original, 1 = replacement). */
function buildBoard(name, code, variant) {
  const rand = rng(norm(name) + "|" + code + "|" + variant);
  const fams = new Set();
  const picks = COLS.map(col => {
    const size = col.wild ? 4 : 5, out = []; let hard = 0;
    for (const tile of shuffle(col.pool, rand)) { if (out.length === size) break; if (tile.hard && hard >= 1) continue; const family = FAMILY[tile.text]; if (family && fams.has(family)) continue; out.push(tile); if (tile.hard) hard++; if (family) fams.add(family); }
    return out;
  });
  const cells = [];
  for (let row = 0; row < 5; row++) for (let colIdx = 0; colIdx < 5; colIdx++) {
    if (colIdx === 2 && row === 2) { cells.push({ wild: true, col: colIdx }); continue; }
    const idx = colIdx === 2 && row > 2 ? row - 1 : row;
    cells.push({ ...picks[colIdx][idx], col: colIdx });
  }
  return cells;
}
/* Claim code: the player's marks, board variant and wild card packed into 8 characters,
   plus a check tied to their username and the round code, so typos and mismatches are caught. */
const B32 = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";
function makeClaim(name, code, variant, state) {
  let bits = 0;
  for (let cellIdx = 0; cellIdx < 25; cellIdx++) if (cellIdx === 12 ? state.wildOn : state.marks.includes(cellIdx)) bits += 2 ** cellIdx;
  bits += variant * 2 ** 25 + (WILD.findIndex(option => option.name === state.wild) + 1) * 2 ** 26;
  let body = ""; for (let digitNo = 0; digitNo < 6; digitNo++) { body = B32[bits % 32] + body; bits = Math.floor(bits / 32); }
  const check = hash32(norm(name) + "|" + code + "|" + body) & 1023;
  const full = body + B32[check >> 5] + B32[check & 31];
  return full.slice(0, 4) + "-" + full.slice(4);
}
function readClaim(name, code, raw) {
  const clean = raw.toUpperCase().replace(/O/g, "0").replace(/[IL]/g, "1").replace(/[^0-9A-Z]/g, "");
  if (clean.length !== 8 || [...clean].some(char => !B32.includes(char))) return null;
  const body = clean.slice(0, 6), check = hash32(norm(name) + "|" + code + "|" + body) & 1023;
  if (B32[check >> 5] + B32[check & 31] !== clean.slice(6)) return null;
  let bits = 0; for (const char of body) bits = bits * 32 + B32.indexOf(char);
  const marks = new Set(); for (let cellIdx = 0; cellIdx < 25; cellIdx++) if (Math.floor(bits / 2 ** cellIdx) % 2) marks.add(cellIdx);
  const wildIdx = Math.floor(bits / 2 ** 26);
  return { marks, variant: Math.floor(bits / 2 ** 25) % 2, wild: wildIdx && WILD[wildIdx - 1] ? WILD[wildIdx - 1].name : "" };
}

const LINES = [];
for (let lineNo = 0; lineNo < 5; lineNo++) { LINES.push([0,1,2,3,4].map(pos => lineNo * 5 + pos)); LINES.push([0,1,2,3,4].map(pos => pos * 5 + lineNo)); }
LINES.push([0, 6, 12, 18, 24], [4, 8, 12, 16, 20]);
const LINE_NAMES = [];
for (let lineNo = 0; lineNo < 5; lineNo++) { LINE_NAMES.push("Row " + (lineNo + 1)); LINE_NAMES.push(COLS[lineNo].name + " column"); }
LINE_NAMES.push("Diagonal (top left to bottom right)", "Diagonal (top right to bottom left)");
function randomKey() { let key = ""; for (let charNo = 0; charNo < 6; charNo++) key += ALPHA[Math.floor(Math.random() * ALPHA.length)]; return key; }
function codesFromKey(key) {
  const out = {};
  for (const round of [1, 2, 3]) { const rand = rng("event|" + key + "|" + round); let letters = ""; for (let charNo = 0; charNo < 3; charNo++) letters += ALPHA[Math.floor(rand() * ALPHA.length)]; out[round] = letters + checkLetter(letters, round); }
  return out;
}

const TILESETS = [[0,"E",1,"CS","Before 2010"],[0,"H",1,"SX","Before 1990"],[0,"E",1,"CS","Aired in the last 2 years"],[0,"E",1,"CS","A sequel"],[0,"M",1,"CSX","OVA/ONA/Special/Music"],[0,"M",1,"CSX","Movie"],[0,"H",0,"CSX","Mix of Japanese and English"],[0,"M",1,"SX","Title is 7+ words long"],[0,"M",1,"SX","Anime from your list twice in a row"],[0,"H",1,"CSX","Same anime appears twice"],[0,"M",1,"CSX","One genre"],[0,"H",1,"CSX","More than 5 genres"],[0,"M",1,"CSX","Less than 4 tags"],[0,"E",1,"CSX","More than 15 tags"],[0,"H",1,"SX","Song name is same as the anime title"],[0,"H",1,"SX","Tautogram (3 or more words start with the same letter)"],[0,"M",1,"C","Name hint revealed more than half of the title"],[0,"E",1,"CS","Title has \"no\" as a word (e.g. Shingeki no Kyojin)"],[0,"E",1,"CS","Title is one word"],[0,"M",0,"SX","Title includes a character's name"],[0,"E",1,"CS","Isekai anime"],[0,"M",1,"S","3 or more Isekai anime in one round"],[0,"H",1,"CSX","Sports anime"],[0,"M",1,"CSX","Mecha anime"],[1,"M",0,"SX","English"],[1,"M",0,"SX","Non-Japanese or English title"],[1,"M",0,"SX","Acoustic"],[1,"H",0,"SX","Sound effects"],[1,"M",0,"CSX","Talking/Rapping"],[1,"H",0,"SX","Male/Female duet (or more)"],[1,"H",1,"SX","Instrumental"],[1,"H",1,"SX","Chanting"],[1,"E",1,"CS","OP/ED number higher than 2"],[1,"H",0,"SX","Karaoke/Live (bad sound quality on purpose)"],[1,"E",1,"CS","Song title is one word"],[1,"M",1,"CSX","Song title contains a number"],[1,"H",1,"SX","Song title contains a color"],[1,"E",0,"CS","Song name drop in audio"],[1,"H",1,"SX","Song works for 3 or more titles (3+ accepted anime)"],[1,"E",1,"CS","Three of a kind: 3 OPs, EDs, or Inserts in a row"],[1,"M",1,"CSX","Song title has Love, Ai, Koi, or Suki"],[1,"E",1,"CS","Song title is longer than the anime title"],[1,"M",1,"CSX","Song title is ALL CAPS"],[1,"M",1,"CSX","Song difficulty 80% or higher"],[1,"H",1,"SX","Song difficulty 15% or lower"],[1,"M",1,"CSX","\"ver.\", \"version\" or \"edit\" in the song title (e.g. TV ver., TV edit)"],[2,"E",0,"CSX","Cast-sung"],[2,"E",0,"CSX","Band/Group"],[2,"M",1,"CSX","Artist name is ALL CAPS"],[2,"M",1,"CS","Artist contains a symbol"],[2,"H",1,"CSX","Same artist appears twice"],[2,"M",0,"CSX","Non-English/Japanese artist name"],[2,"H",0,"SX","Inactive artist (solo artists only)"],[2,"H",0,"SX","Artist younger than you (solo artists only)"],[2,"H",1,"SX","Right artist, wrong anime (your answer has a song by this artist)"],[2,"M",1,"SX","Weird capitalization (a capital in the middle of a word, like LiSA or nano.RIPE)"],[2,"E",1,"CS","Collab: \"feat.\" or \"&\" in the artist name"],[2,"M",0,"SX","Idol group or unit (real or from an idol anime)"],[2,"H",1,"SX","Artist is also the composer"],[2,"E",1,"CS","Parentheses ( ) in the artist name"],[2,"H",1,"CSX","Artist name starts with \"The\""],[3,"E",1,"CSX","Get 3 songs in a row"],[3,"M",1,"CSX","Get a solo"],[3,"M",1,"CSX","Get an anti-solo"],[3,"E",1,"CS","Snipe (get a song not on your list)"],[3,"M",0,"CSX","Name Drop"],[3,"H",0,"C","Multiple Choice hint gave 3 or more titles of the same series"],[3,"M",0,"C","Info hint was actually helpful"],[3,"M",1,"C","Reach 30 points (hint mode)"],[3,"M",1,"SX","Change your answer from another real title to the right one"],[3,"M",1,"CSX","Lock in slower than any of the other people who got it right"],[3,"E",1,"CS","Type within 5 seconds"],[3,"M",1,"C","Never use a hint but be in top 5"],[3,"M",1,"CSX","Stay in the top 3 for 3 songs in a row"],[3,"H",1,"SX","Surpass 3 players in one song"],[3,"E",0,"CS","Your avatar is unique from others"],[3,"E",1,"CS","Get the first song of the round right"],[3,"M",1,"CSX","Your wrong answer shares a word with the correct title"],[3,"M",1,"CSX","Right franchise, wrong season or movie"],[3,"E",1,"CS","Miss 3 songs in a row"],[4,"E",1,"CS","Everyone gets a song right"],[4,"E",1,"CS","No one gets a song right"],[4,"H",1,"SX","Both players next to you guess it right (if you're on the edge, 1)"],[4,"E",1,"CSX","Someone types an emoji in chat"],[4,"M",1,"CSX","The player in 1st place misses, you get it right"],[4,"M",1,"CSX","A song from only 1 person's list"],[4,"M",1,"CSX","A song from 5 or more people's list"],[4,"H",1,"SX","2 or more people share the same wrong answer"],[4,"M",1,"CSX","Last-place player gets it right"],[4,"M",1,"CSX","Half of the people get it right"],[4,"M",1,"C","Nobody uses a hint"],[4,"M",1,"C","More than 3 people use a hint"],[4,"E",1,"C","Somebody uses Song Info Hint"],[4,"M",1,"CSX","Someone else disconnects"],[0,"E",1,"C","Romance anime"],[0,"H",1,"CX","Mahou Shoujo anime"],[0,"H",1,"CX","Idol anime"],[0,"E",1,"CX","Anime score 8.0 or higher"],[0,"M",1,"CX","Anime score below 6.0"],[0,"H",1,"CX","Obscure anime (popularity rank above 3000)"],[0,"M",1,"C","Top 100 most popular anime"],[0,"H",1,"","Season 3 or later"],[0,"E",1,"C","Same season twice in a row (e.g. two Spring anime)"],[0,"M",1,"C","English and romaji titles are the same"],[1,"E",1,"C","Show has 3 or more insert songs"],[1,"M",1,"X","Song title has 5+ words"],[1,"E",1,"C","Song title has ! or ?"],[1,"H",1,"X","Song title includes the anime's title"],[2,"M",1,"SX","More than 3 artists credited"],[2,"E",1,"CS","Artist name is one word"],[3,"H",1,"SX","Get 5 songs in a row"],[3,"H",1,"X","Answer correctly in under 2 seconds"],[3,"H",1,"S","Answer correctly in under 3 seconds"],[3,"E",1,"CS","Get the last song of the round right"],[3,"M",1,"CX","Be in 1st place after any song"],[4,"M",1,"CX","Exactly 2 people get it right"],[4,"H",1,"SX","Everyone gives the same answer"],[4,"M",1,"SX","Tie for 1st place after song 10"],[4,"E",1,"CS","A song nobody has on their list"],[4,"M",1,"","Someone answers in under 2 seconds"],[0,"E",1,"CS","Same franchise appears twice in a row"],[0,"M",1,"CS","Same year twice in a row"],[1,"M",1,"X","Sample starts in the first 5 seconds of the song"],[3,"M",1,"S","Reach 10 points (no hints)"],[3,"H",1,"SX","Reach 15 points (no hints)"],[3,"M",1,"SX","Unique right answer (a title no other correct player used)"],[3,"H",1,"SX","Flex answer (right with a different show the song also counts for)"],[0,"M",1,"X","Before 2000"],[0,"H",1,"X","Aired this year"],[0,"H",1,"X","Season 4 or later"],[0,"H",1,"X","Anime title is one word of 4 letters or fewer"],[0,"H",1,"X","Title has \"no\" twice (e.g. Boku no Kokoro no Yabai Yatsu)"],[0,"H",1,"X","33 or more tags"],[0,"H",1,"X","Only 1 or 2 tags"],[0,"H",1,"X","Same anime appears 3 times"],[0,"H",1,"X","Same franchise appears 3 times in one round"],[0,"H",1,"X","5 or more Isekai anime in one round"],[1,"H",1,"X","Four of a kind: 4 OPs, EDs, or Inserts in a row"],[1,"H",1,"X","OP/ED number 5 or higher"],[1,"H",1,"X","Song title is one word of 3 letters or fewer"],[1,"H",1,"X","Song title has a number with 3+ digits (e.g. 100, 2024)"],[1,"H",1,"","Two love songs in a row (Love, Ai, Koi, Suki)"],[1,"H",1,"X","Song title twice as long as the anime title"],[1,"H",1,"X","Song title and artist both ALL CAPS"],[1,"H",1,"X","Song difficulty 10% or lower"],[2,"H",1,"X","Artist name has 2 or more different symbols"],[2,"H",1,"X","6 or more artists credited"],[2,"H",1,"X","Same artist twice in a row"],[2,"H",1,"","Parentheses ( ) in the artist name two songs in a row"],[3,"H",1,"X","Get 7 songs in a row"],[3,"M",1,"X","Snipe 3 songs in one round"],[3,"H",1,"X","Get the first 3 songs right"],[3,"H",1,"X","Miss 5 in a row, then get one right"],[3,"H",1,"X","Get 3 solos in one round"],[4,"H",1,"X","Everyone gets 3 songs in a row right"],[4,"H",1,"X","No one gets 2 songs in a row right"],[4,"M",1,"X","Last-place player gets a solo"]];
/* =====================================================================
 * AMQ Bingo: in-game board (Alt+G) and host panel (Alt+H)
 * Only reads data AMQ shows after each answer is revealed.
 * ===================================================================== */

const PREFIX = "[AMQBingo]";
const ANNOUNCE_RE = /AMQ Bingo round ([1-5]) · code ([A-Z]{4}) · host (\S+)(?: · tiles ([0-9A-Z]{4}))?(?: \(\w+\))?(?: · rules ([A-Z][0-9]{9}))?(?: · board ([A-Z]{4})(\+)?)?(?: · v([0-9.]+))?/;
// A player's BINGO call in game chat carries their claim code, so the host gets it even when DMs are blocked.
const BINGO_RE = /^BINGO! (\S+) has \d+ lines? in AMQ Bingo round ([1-5]) · claim ([0-9A-Z]{4}-[0-9A-Z]{4})/;
const COLUMN_COLORS = ["#4f8cff", "#3fbf7f", "#ff9f43", "#b37bff", "#27c2c2"]; // Anime, Song, Artist, Individual, Multiplayer
const COOLDOWN_MS = 3 * 60 * 1000;

const store = {
  get(key, fallback) { try { const raw = localStorage.getItem("amqBingo." + key); return raw != null ? JSON.parse(raw) : fallback; } catch (error) { return fallback; } },
  set(key, value) { try { localStorage.setItem("amqBingo." + key, JSON.stringify(value)); } catch (error) {} },
};
const PAGE = typeof unsafeWindow !== "undefined" ? unsafeWindow : window; // AMQ's own variables live on the page
const myName = () => PAGE.selfName || "";
const sysMsg = (message) => { try { PAGE.gameChat.systemMessage(message); } catch (error) { console.log("[AMQ Bingo]", message); } };

function makeEl(tag, attrs, ...kids) {
  const element = document.createElement(tag);
  for (const [attr, value] of Object.entries(attrs || {})) {
    if (attr === "class") element.className = value;
    else if (attr.startsWith("on")) element.addEventListener(attr.slice(2), value);
    else if (value !== false && value != null) element.setAttribute(attr, value === true ? "" : value);
  }
  for (const child of kids.flat()) if (child != null && child !== false) element.append(child instanceof Node ? child : String(child));
  return element;
}

/* ---------------- game tracking (reveal data only) ---------------- */
const game = { players: {}, hist: [], answers: {}, songNumber: 0, chat: false, left: false };

function trackGameStart(payload) {
  game.players = {};
  (payload.players || []).forEach((player) => { game.players[player.gamePlayerId] = { name: player.name, seat: player.positionSlot, level: player.level }; });
  game.hist = []; game.answers = {}; game.chat = false; game.left = false; game.inQuiz = true;
}
function myId() {
  const myLower = myName().toLowerCase();
  const entry = Object.entries(game.players).find(([, player]) => (player.name || "").toLowerCase() === myLower);
  return entry ? Number(entry[0]) : null;
}

/* ---------------- auto-marking rules ---------------- */
const titlesOf = (song) => [song.animeNames && song.animeNames.romaji, song.animeNames && song.animeNames.english].filter(Boolean);
const allTitles = (song) => [...new Set([...titlesOf(song), ...(song.altAnimeNames || []), ...(song.altAnimeNamesAnswers || [])])];
const words = (text) => (text || "").trim().split(/\s+/).map((word) => word.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, "")).filter(Boolean);
const lettersOnly = (text) => (text || "").toLowerCase().replace(/[^\p{L}\p{N}]/gu, "");
const yearOf = (song) => song.vintage && song.vintage.data && song.vintage.data.year;
const isAllCaps = (text) => { const letters = (text || "").replace(/[^\p{L}]/gu, ""); return letters.length >= 2 && letters === letters.toUpperCase() && letters !== letters.toLowerCase(); };
const COLOR_RE = /\b(red|blue|green|yellow|white|black|pink|purple|orange|gold|golden|silver|gr[ae]y|crimson|scarlet|azure|violet|indigo|rainbow|aka|ao|midori|kiiro|shiro|kuro|momo|murasaki|niji|kin|gin)\b/i;
const STOP = new Set(["the", "a", "an", "of", "no", "to", "wa", "ga", "wo", "ni", "de", "and", "in", "on", "season", "movie", "part"]);
const baseTitle = (title) => lettersOnly((title || "").toLowerCase().replace(/^(zoku|zan|shin|gekijouban|gekijou-ban|eiga|the movie)\s+/, "").split(/[:\-–(]|\bseason\b|\bmovie\b|\b(?:2nd|3rd|\d+th)\b|\bii+\b/)[0]);
const artistParts = (artist) => (artist || "").split(/\s*(?:,|&|・|×|\bfeat\.?|\bx\b|\bwith\b)\s*/i).map(norm).filter(Boolean);
const playerIdsIn = (rec) => Object.keys(rec.res).map(Number);
const correctCount = (rec) => playerIdsIn(rec).filter((playerId) => rec.res[playerId].correct).length;
const isOnMyList = (result) => !!(result && result.listStatus && result.listStatus > 0);
const isRealTitle = (answer) => { try { const list = PAGE.quiz.answerInput.typingInput.autoCompleteController.list; const lower = (answer || "").toLowerCase(); return Array.isArray(list) && list.some((name) => (name || "").toLowerCase() === lower); } catch (error) { return false; } };
const isIsekai = (song) => [...(song.animeTags || []), ...(song.animeGenre || [])].includes("Isekai");
const LOVE_RE = /(^|[^\p{L}])(love|ai|koi|suki)([^\p{L}]|$)/iu;
const artistKey = (song) => { const info = song.artistInfo; return info && (info.artistId != null ? "a" + info.artistId : info.groupId != null ? "g" + info.groupId : null); };
const sameArtist = (songA, songB) => (artistKey(songA) && artistKey(songA) === artistKey(songB)) || norm(songA.artist || "") === norm(songB.artist || "");
const sameFranchise = (songA, songB) => allTitles(songA).some((nameA) => { const baseA = baseTitle(nameA); return baseA.length >= 4 && allTitles(songB).some((nameB) => { const baseB = baseTitle(nameB); if (baseA === baseB) return true; const [shorter, longer] = baseB.length < baseA.length ? [baseB, baseA] : [baseA, baseB]; return shorter.length >= 6 && longer.startsWith(shorter); }); });
const lastSongs = (ctx, count) => (ctx.hist.length >= count ? ctx.hist.slice(-count) : null);

// kind "global": same for everyone. kind "personal": depends on the player (id).
const RULES = {
  // Anime
  "Before 2010": { global: (ctx) => yearOf(ctx.s) < 2010 },
  "Before 1990": { global: (ctx) => yearOf(ctx.s) < 1990 },
  "Aired in the last 2 years": { global: (ctx) => yearOf(ctx.s) >= new Date().getFullYear() - 1 },
  "A sequel": { global: (ctx) => (ctx.s.seasonInfo && ctx.s.seasonInfo.name === "Season" && parseFloat(ctx.s.seasonInfo.number) >= 2) || titlesOf(ctx.s).some((title) => /\b(season|part)\s*[2-9]|\b(2nd|3rd|[4-9]th)\b|\bII+\b/i.test(title)) },
  "OVA/ONA/Special/Music": { global: (ctx) => /^(ova|ona|special|music)/i.test(ctx.s.animeType || "") },
  "Movie": { global: (ctx) => /^movie/i.test(ctx.s.animeType || "") },
  "Title is 7+ words long": { global: (ctx) => titlesOf(ctx.s).some((title) => words(title).length >= 7) },
  "Anime from your list twice in a row": { personal: (ctx, playerId) => { const recent = lastSongs(ctx, 2); return !!recent && recent.every((rec) => isOnMyList(rec.res[playerId])); } },
  "Same anime appears twice": { global: (ctx) => ctx.hist.slice(0, -1).some((rec) => rec.s.annId === ctx.s.annId) },
  "Same franchise appears twice in a row": { global: (ctx) => !!ctx.prev && allTitles(ctx.prev.s).some((prevTitle) => { const prevBase = baseTitle(prevTitle); return prevBase.length >= 4 && allTitles(ctx.s).some((title) => { const base = baseTitle(title); if (base === prevBase) return true; const [shorter, longer] = base.length < prevBase.length ? [base, prevBase] : [prevBase, base]; return shorter.length >= 6 && longer.startsWith(shorter); }); }) },
  "One genre": { global: (ctx) => (ctx.s.animeGenre || []).length === 1 },
  "More than 5 genres": { global: (ctx) => (ctx.s.animeGenre || []).length > 5 },
  "Less than 4 tags": { global: (ctx) => (ctx.s.animeTags || []).length < 4 },
  "More than 15 tags": { global: (ctx) => (ctx.s.animeTags || []).length > 15 },
  "Song name is same as the anime title": { global: (ctx) => allTitles(ctx.s).some((title) => lettersOnly(title) === lettersOnly(ctx.s.songName)) },
  "Tautogram (3 or more words start with the same letter)": { global: (ctx) => titlesOf(ctx.s).some((title) => { const letterCounts = {}; words(title).forEach((word) => { const letter = word[0].toLowerCase(); letterCounts[letter] = (letterCounts[letter] || 0) + 1; }); return Object.values(letterCounts).some((count) => count >= 3); }) },
  "Title has \"no\" as a word (e.g. Shingeki no Kyojin)": { global: (ctx) => /(^|[^\p{L}])no([^\p{L}]|$)/iu.test((ctx.s.animeNames || {}).romaji || "") },
  "Title is one word": { global: (ctx) => words((ctx.s.animeNames || {}).romaji).length === 1 },
  "Isekai anime": { global: (ctx) => [...(ctx.s.animeTags || []), ...(ctx.s.animeGenre || [])].includes("Isekai") },
  "Sports anime": { global: (ctx) => (ctx.s.animeGenre || []).includes("Sports") },
  "Mecha anime": { global: (ctx) => (ctx.s.animeGenre || []).includes("Mecha") },
  // Song
  "OP/ED number higher than 2": { global: (ctx) => (ctx.s.type === 1 || ctx.s.type === 2) && ctx.s.typeNumber > 2 },
  "Song title is one word": { global: (ctx) => words(ctx.s.songName).length === 1 },
  "Song title contains a number": { global: (ctx) => /\d/.test(ctx.s.songName || "") },
  "Song title contains a color": { global: (ctx) => COLOR_RE.test(ctx.s.songName || "") },
  "Three of a kind: 3 OPs, EDs, or Inserts in a row": { global: (ctx) => { const recent = lastSongs(ctx, 3); return !!recent && recent.every((rec) => rec.s.type === ctx.s.type); } },
  "Song title has Love, Ai, Koi, or Suki": { global: (ctx) => /(^|[^\p{L}])(love|ai|koi|suki)([^\p{L}]|$)/iu.test(ctx.s.songName || "") },
  "Song title is longer than the anime title": { global: (ctx) => (ctx.s.songName || "").length > ((ctx.s.animeNames || {}).romaji || "").length },
  "Song title is ALL CAPS": { global: (ctx) => isAllCaps(ctx.s.songName) },
  "Song difficulty 80% or higher": { global: (ctx) => ctx.s.animeDifficulty >= 80 },
  "Song difficulty 15% or lower": { global: (ctx) => ctx.s.animeDifficulty <= 15 },
  "Song works for 3 or more titles (3+ accepted anime)": { global: (ctx) => 1 + new Set((ctx.s.altAnimeNamesAnswers || []).map(lettersOnly)).size >= 3 },
  "\"ver.\", \"version\" or \"edit\" in the song title (e.g. TV ver., TV edit)": { global: (ctx) => /(^|[^\p{L}])(ver\.|version|edit)([^\p{L}]|$)/iu.test(ctx.s.songName || "") },
  // Artist
  "Artist name is ALL CAPS": { global: (ctx) => isAllCaps(ctx.s.artist) },
  "Weird capitalization (a capital in the middle of a word, like LiSA or nano.RIPE)": { global: (ctx) => (ctx.s.artist || "").split(/[\s・♥♡☆★×&\/,()（）]+/).some((word) => /\p{Ll}.*\p{Lu}/u.test(word.replace(/^Ma?c(?=\p{Lu})/u, ""))) },
  "Artist contains a symbol": { global: (ctx) => /[^\p{L}\p{N}\s,.'\-]/u.test(ctx.s.artist || "") },
  // Same artist even when credited differently: AMQ gives each artist/group a fixed id.
  "Same artist appears twice": { global: (ctx) => { const keyOf = (info) => info && (info.artistId != null ? "a" + info.artistId : info.groupId != null ? "g" + info.groupId : null); const thisArtist = keyOf(ctx.s.artistInfo); return ctx.hist.slice(0, -1).some((rec) => (thisArtist && keyOf(rec.s.artistInfo) === thisArtist) || norm(rec.s.artist || "") === norm(ctx.s.artist || "")); } },
  "Collab: \"feat.\" or \"&\" in the artist name": { global: (ctx) => /\bfeat\b|&/i.test(ctx.s.artist || "") },
  "Artist is also the composer": { global: (ctx) => { const comp = norm((ctx.s.composerInfo || {}).name || ""); return !!comp && (artistParts(ctx.s.artist).includes(comp) || norm(ctx.s.artist || "") === comp); } },
  "Parentheses ( ) in the artist name": { global: (ctx) => /[()（）]/.test(ctx.s.artist || "") },
  "Artist name starts with \"The\"": { global: (ctx) => /^the\s/i.test(ctx.s.artist || "") },
  // Individual
  "Get 3 songs in a row": { personal: (ctx, playerId) => { const recent = lastSongs(ctx, 3); return !!recent && recent.every((rec) => rec.res[playerId] && rec.res[playerId].correct); } },
  "Get a solo": { personal: (ctx, playerId) => playerIdsIn(ctx.rec).length >= 2 && ctx.rec.res[playerId].correct && correctCount(ctx.rec) === 1 },
  "Get an anti-solo": { personal: (ctx, playerId) => playerIdsIn(ctx.rec).length >= 2 && !ctx.rec.res[playerId].correct && correctCount(ctx.rec) === playerIdsIn(ctx.rec).length - 1 },
  "Snipe (get a song not on your list)": { personal: (ctx, playerId) => ctx.rec.res[playerId].correct && !isOnMyList(ctx.rec.res[playerId]) },
  "Reach 30 points (hint mode)": { personal: (ctx, playerId) => ctx.rec.res[playerId].score >= 30 },
  "Reach 10 points (no hints)": { personal: (ctx, playerId) => ctx.rec.res[playerId].score >= 10 },
  "Reach 15 points (no hints)": { personal: (ctx, playerId) => ctx.rec.res[playerId].score >= 15 },
  "Lock in slower than any of the other people who got it right": { personal: (ctx, playerId) => { const myResult = ctx.rec.res[playerId]; if (!myResult.correct || myResult.answerTimeing == null) return false; const others = playerIdsIn(ctx.rec).filter((otherId) => otherId !== playerId && ctx.rec.res[otherId].correct && ctx.rec.res[otherId].answerTimeing != null); return others.length > 0 && others.every((otherId) => myResult.answerTimeing > ctx.rec.res[otherId].answerTimeing); } },
  "Type within 5 seconds": { personal: (ctx, playerId) => ctx.rec.res[playerId].answerTimeing != null && ctx.rec.res[playerId].answerTimeing < 5 },
  "Stay in the top 3 for 3 songs in a row": { personal: (ctx, playerId) => { const recent = lastSongs(ctx, 3); return !!recent && playerIdsIn(ctx.rec).length >= 4 && recent.every((rec) => rec.res[playerId] && rec.res[playerId].position <= 3); } },
  "Surpass 3 players in one song": { personal: (ctx, playerId) => { const prevResult = ctx.prev && ctx.prev.res[playerId]; return !!prevResult && prevResult.position - ctx.rec.res[playerId].position >= 3; } },
  // Your own board only: AMQ echoes your submissions, and AMQ's title list tells real titles from half-typed ones.
  "Change your answer from another real title to the right one": { personal: (ctx, playerId) => { const myResult = ctx.rec.res[playerId]; if (!myResult.correct || playerId !== myId()) return false; const fin = lettersOnly(ctx.rec.answers[playerId]); return (ctx.rec.mySubs || []).some((submission) => lettersOnly(submission) !== fin && isRealTitle(submission)); } },
  "Unique right answer (a title no other correct player used)": { personal: (ctx, playerId) => { const myResult = ctx.rec.res[playerId]; if (!myResult.correct) return false; const mine = lettersOnly(ctx.rec.answers[playerId]); const others = playerIdsIn(ctx.rec).filter((otherId) => otherId !== playerId && ctx.rec.res[otherId].correct); return !!mine && others.length > 0 && others.every((otherId) => lettersOnly(ctx.rec.answers[otherId]) !== mine); } },
  "Flex answer (right with a different show the song also counts for)": { personal: (ctx, playerId) => { const myResult = ctx.rec.res[playerId]; if (!myResult.correct) return false; const mine = lettersOnly(ctx.rec.answers[playerId]); const own = new Set([...titlesOf(ctx.s), ...(ctx.s.altAnimeNames || [])].map(lettersOnly)); const flex = new Set((ctx.s.altAnimeNamesAnswers || []).map(lettersOnly)); return !!mine && flex.has(mine) && !own.has(mine) && playerIdsIn(ctx.rec).some((otherId) => otherId !== playerId && ctx.rec.res[otherId].correct); } },
  "Get the first song of the round right": { personal: (ctx, playerId) => ctx.hist.length === 1 && ctx.rec.n === 1 && ctx.rec.res[playerId].correct },
  "Your wrong answer shares a word with the correct title": { personal: (ctx, playerId) => { if (ctx.rec.res[playerId].correct) return false; const answerWords = words(ctx.rec.answers[playerId]).map((word) => word.toLowerCase()).filter((word) => word.length > 2 && !STOP.has(word)); if (!answerWords.length) return false; const titleWords = new Set(allTitles(ctx.s).flatMap(words).map((word) => word.toLowerCase())); return answerWords.some((word) => titleWords.has(word)); } },
  "Right franchise, wrong season or movie": { personal: (ctx, playerId) => { if (ctx.rec.res[playerId].correct) return false; const answerBase = baseTitle(ctx.rec.answers[playerId]); return answerBase.length >= 4 && allTitles(ctx.s).some((title) => baseTitle(title) === answerBase); } },
  "Miss 3 songs in a row": { personal: (ctx, playerId) => { const recent = lastSongs(ctx, 3); return !!recent && recent.every((rec) => rec.res[playerId] && !rec.res[playerId].correct); } },
  // ---- Expert versions (harder numbers / rarer situations) ----
  "Before 2000": { global: (ctx) => yearOf(ctx.s) < 2000 },
  "Aired this year": { global: (ctx) => yearOf(ctx.s) >= new Date().getFullYear() },
  "Season 4 or later": { global: (ctx) => !!ctx.s.seasonInfo && ctx.s.seasonInfo.name === "Season" && parseFloat(ctx.s.seasonInfo.number) >= 4 },
  "Anime title is one word of 4 letters or fewer": { global: (ctx) => { const title = (ctx.s.animeNames || {}).romaji; return words(title).length === 1 && lettersOnly(title).length <= 4; } },
  "Title has \"no\" twice (e.g. Boku no Kokoro no Yabai Yatsu)": { global: (ctx) => (((ctx.s.animeNames || {}).romaji || "").match(/(^|[^\p{L}])no(?=[^\p{L}]|$)/giu) || []).length >= 2 },
  "33 or more tags": { global: (ctx) => (ctx.s.animeTags || []).length >= 33 },
  "Only 1 or 2 tags": { global: (ctx) => { const tagCount = (ctx.s.animeTags || []).length; return tagCount >= 1 && tagCount <= 2; } },
  "Same anime appears 3 times": { global: (ctx) => ctx.hist.filter((rec) => rec.s.annId === ctx.s.annId).length >= 3 },
  "Same franchise appears 3 times in one round": { global: (ctx) => ctx.hist.filter((rec) => sameFranchise(rec.s, ctx.s)).length >= 3 },
  "3 or more Isekai anime in one round": { global: (ctx) => isIsekai(ctx.s) && ctx.hist.filter((rec) => isIsekai(rec.s)).length === 3 },
  "5 or more Isekai anime in one round": { global: (ctx) => isIsekai(ctx.s) && ctx.hist.filter((rec) => isIsekai(rec.s)).length === 5 },
  "Four of a kind: 4 OPs, EDs, or Inserts in a row": { global: (ctx) => { const recent = lastSongs(ctx, 4); return !!recent && recent.every((rec) => rec.s.type === ctx.s.type); } },
  "OP/ED number 5 or higher": { global: (ctx) => (ctx.s.type === 1 || ctx.s.type === 2) && ctx.s.typeNumber >= 5 },
  "Song title is one word of 3 letters or fewer": { global: (ctx) => words(ctx.s.songName).length === 1 && lettersOnly(ctx.s.songName).length <= 3 },
  "Song title has a number with 3+ digits (e.g. 100, 2024)": { global: (ctx) => /\d{3,}/.test(ctx.s.songName || "") },
  "Two love songs in a row (Love, Ai, Koi, Suki)": { global: (ctx) => { const recent = lastSongs(ctx, 2); return !!recent && recent.every((rec) => LOVE_RE.test(rec.s.songName || "")); } },
  "Song title twice as long as the anime title": { global: (ctx) => { const animeTitleLength = ((ctx.s.animeNames || {}).romaji || "").length; return animeTitleLength > 0 && (ctx.s.songName || "").length >= 2 * animeTitleLength; } },
  "Song title and artist both ALL CAPS": { global: (ctx) => isAllCaps(ctx.s.songName) && isAllCaps(ctx.s.artist) },
  "Song difficulty 90% or higher": { global: (ctx) => ctx.s.animeDifficulty >= 90 },
  "Song difficulty 10% or lower": { global: (ctx) => ctx.s.animeDifficulty <= 10 },
  "Artist name has 2 or more different symbols": { global: (ctx) => new Set(((ctx.s.artist || "").match(/[^\p{L}\p{N}\s,.'\-]/gu) || [])).size >= 2 },
  "6 or more artists credited": { global: (ctx) => artistParts(ctx.s.artist).length >= 6 },
  "Same artist twice in a row": { global: (ctx) => !!ctx.prev && sameArtist(ctx.prev.s, ctx.s) },
  "Parentheses ( ) in the artist name two songs in a row": { global: (ctx) => { const recent = lastSongs(ctx, 2); return !!recent && recent.every((rec) => /[()（）]/.test(rec.s.artist || "")); } },
  "Get 7 songs in a row": { personal: (ctx, playerId) => { const recent = lastSongs(ctx, 7); return !!recent && recent.every((rec) => rec.res[playerId] && rec.res[playerId].correct); } },
  "Snipe 3 songs in one round": { personal: (ctx, playerId) => ctx.rec.res[playerId].correct && !isOnMyList(ctx.rec.res[playerId]) && ctx.hist.filter((rec) => rec.res[playerId] && rec.res[playerId].correct && !isOnMyList(rec.res[playerId])).length === 3 },
  "Get the first 3 songs right": { personal: (ctx, playerId) => ctx.hist.length === 3 && ctx.hist[0].n === 1 && ctx.hist.every((rec) => rec.res[playerId] && rec.res[playerId].correct) },
  "Miss 5 in a row, then get one right": { personal: (ctx, playerId) => { const recent = lastSongs(ctx, 6); return !!recent && recent[5].res[playerId] && recent[5].res[playerId].correct && recent.slice(0, 5).every((rec) => rec.res[playerId] && !rec.res[playerId].correct); } },
  "Get 3 solos in one round": { personal: (ctx, playerId) => { const solo = (rec) => Object.keys(rec.res).length >= 2 && rec.res[playerId] && rec.res[playerId].correct && correctCount(rec) === 1; return solo(ctx.rec) && ctx.hist.filter(solo).length === 3; } },
  "Everyone gets 3 songs in a row right": { global: (ctx) => { const recent = lastSongs(ctx, 3); return !!recent && recent.every((rec) => playerIdsIn(rec).length >= 2 && correctCount(rec) === playerIdsIn(rec).length); } },
  "No one gets 2 songs in a row right": { global: (ctx) => { const recent = lastSongs(ctx, 2); return !!recent && recent.every((rec) => playerIdsIn(rec).length >= 1 && correctCount(rec) === 0); } },
  "Last-place player gets a solo": { global: (ctx) => { if (!ctx.prev || correctCount(ctx.rec) !== 1) return false; const pos = playerIdsIn(ctx.rec).filter((playerId) => ctx.prev.res[playerId]).map((playerId) => ctx.prev.res[playerId].position); if (pos.length < 3 || Math.max(...pos) === Math.min(...pos)) return false; const last = Math.max(...pos); return playerIdsIn(ctx.rec).some((playerId) => ctx.prev.res[playerId] && ctx.prev.res[playerId].position === last && ctx.rec.res[playerId].correct); } },
  // ---- Tiles from the tile sets ----
  "Romance anime": { global: (ctx) => (ctx.s.animeGenre || []).includes("Romance") },
  "Mahou Shoujo anime": { global: (ctx) => (ctx.s.animeGenre || []).includes("Mahou Shoujo") },
  "Idol anime": { global: (ctx) => (ctx.s.animeTags || []).includes("Idol") },
  "Anime score 8.0 or higher": { global: (ctx) => parseFloat(ctx.s.animeScore) >= 8 },
  "Anime score below 6.0": { global: (ctx) => parseFloat(ctx.s.animeScore) < 6 },
  "Obscure anime (popularity rank above 3000)": { global: (ctx) => ctx.s.popularityRank > 3000 },
  "Top 100 most popular anime": { global: (ctx) => ctx.s.popularityRank > 0 && ctx.s.popularityRank <= 100 },
  "Season 3 or later": { global: (ctx) => !!ctx.s.seasonInfo && ctx.s.seasonInfo.name === "Season" && parseFloat(ctx.s.seasonInfo.number) >= 3 },
  "Same season twice in a row (e.g. two Spring anime)": { global: (ctx) => { const seasonKey = (song) => song.vintage && song.vintage.key; return !!ctx.prev && !!seasonKey(ctx.s) && seasonKey(ctx.s) === seasonKey(ctx.prev.s); } },
  "Same year twice in a row": { global: (ctx) => !!ctx.prev && !!yearOf(ctx.s) && yearOf(ctx.s) === yearOf(ctx.prev.s) },
  "English and romaji titles are the same": { global: (ctx) => { const names = ctx.s.animeNames || {}; return !!names.romaji && lettersOnly(names.romaji) === lettersOnly(names.english); } },
  "Song title has 5+ words": { global: (ctx) => words(ctx.s.songName).length >= 5 },
  "Song title has ! or ?": { global: (ctx) => /[!?！？]/.test(ctx.s.songName || "") },
  "Song title includes the anime's title": { global: (ctx) => { const song = lettersOnly(ctx.s.songName); return titlesOf(ctx.s).some((title) => { const base = baseTitle(title); return base.length >= 4 && song.includes(base) && song !== lettersOnly(title); }); } },
  "Sample starts in the first 5 seconds of the song": { global: (ctx) => ctx.rec.start != null && ctx.rec.start <= 5 },
  "More than 3 artists credited": { global: (ctx) => artistParts(ctx.s.artist).length >= 4 },
  "Artist name is one word": { global: (ctx) => words(ctx.s.artist).length === 1 },
  "Get 5 songs in a row": { personal: (ctx, playerId) => { const recent = lastSongs(ctx, 5); return !!recent && recent.every((rec) => rec.res[playerId] && rec.res[playerId].correct); } },
  "Answer correctly in under 2 seconds": { personal: (ctx, playerId) => { const myResult = ctx.rec.res[playerId]; return myResult.correct && myResult.answerTimeing != null && myResult.answerTimeing < 2; } },
  "Answer correctly in under 3 seconds": { personal: (ctx, playerId) => { const myResult = ctx.rec.res[playerId]; return myResult.correct && myResult.answerTimeing != null && myResult.answerTimeing < 3; } },
  "Get the last song of the round right": { personal: (ctx, playerId) => !!ctx.rec.last && ctx.rec.res[playerId].correct },
  "Be in 1st place after any song": { personal: (ctx, playerId) => playerIdsIn(ctx.rec).length >= 2 && ctx.rec.res[playerId].position === 1 && playerIdsIn(ctx.rec).filter((otherId) => ctx.rec.res[otherId].position === 1).length === 1 && ctx.rec.res[playerId].score > 0 },
  "Exactly 2 people get it right": { global: (ctx) => correctCount(ctx.rec) === 2 },
  "Everyone gives the same answer": { global: (ctx) => { const answers = playerIdsIn(ctx.rec).map((playerId) => lettersOnly(ctx.rec.answers[playerId])); return answers.length >= 2 && !!answers[0] && answers.every((answer) => answer === answers[0]); } },
  "Tie for 1st place after song 10": { global: (ctx) => ctx.hist.length > 10 && playerIdsIn(ctx.rec).filter((playerId) => ctx.rec.res[playerId].position === 1 && ctx.rec.res[playerId].score > 0).length >= 2 },
  "A song nobody has on their list": { global: (ctx) => playerIdsIn(ctx.rec).length >= 1 && playerIdsIn(ctx.rec).every((playerId) => !isOnMyList(ctx.rec.res[playerId])) },
  "Someone answers in under 2 seconds": { global: (ctx) => playerIdsIn(ctx.rec).some((playerId) => ctx.rec.res[playerId].answerTimeing != null && ctx.rec.res[playerId].answerTimeing < 2) },
  // Hints. rec.hints = { gamePlayerId: [hintId, ...] } for this song; null when the log has no hint data.
  // Hint ids: 1 name, 2 info, 3 multiple choice, 4 audio, 5 tiny video, 6 blurred video (1 and 3 confirmed from logs).
  "Nobody uses a hint": { global: (ctx) => !!ctx.rec.hints && Object.keys(ctx.rec.hints).length === 0 },
  "More than 3 people use a hint": { global: (ctx) => !!ctx.rec.hints && Object.keys(ctx.rec.hints).length > 3 },
  "Somebody uses Song Info Hint": { global: (ctx) => !!ctx.rec.hints && Object.values(ctx.rec.hints).some((hintList) => hintList.includes(2)) },
  "Never use a hint but be in top 5": { personal: (ctx, playerId) => !!ctx.rec.last && ctx.hist.every((rec) => rec.hints && !(rec.hints[playerId] || []).length) && ctx.rec.res[playerId].position <= 5 && ctx.rec.res[playerId].score > 0 },
  "Name hint revealed more than half of the title": { personal: (ctx, playerId) => !!ctx.rec.nameHint && ctx.rec.nameHint.id === playerId && ctx.rec.nameHint.shown > 0.5 },
  // Multiplayer
  "Everyone gets a song right": { global: (ctx) => playerIdsIn(ctx.rec).length >= 2 && correctCount(ctx.rec) === playerIdsIn(ctx.rec).length },
  "No one gets a song right": { global: (ctx) => playerIdsIn(ctx.rec).length >= 1 && correctCount(ctx.rec) === 0 },
  "Both players next to you guess it right (if you're on the edge, 1)": { personal: (ctx, playerId) => { const seats = playerIdsIn(ctx.rec).filter((otherId) => game.players[otherId]).sort((idA, idB) => game.players[idA].seat - game.players[idB].seat); const seatIdx = seats.indexOf(playerId); if (seatIdx < 0) return false; const neighbors = [seats[seatIdx - 1], seats[seatIdx + 1]].filter((neighborId) => neighborId != null); return neighbors.length > 0 && neighbors.every((otherId) => ctx.rec.res[otherId].correct); } },
  "Someone types an emoji in chat": { global: (ctx) => ctx.rec.chat },
  "The player in 1st place misses, you get it right": { personal: (ctx, playerId) => { if (!ctx.prev || !ctx.rec.res[playerId].correct) return false; if (!ctx.prev.res[playerId] || ctx.prev.res[playerId].position === 1) return false; const firsts = playerIdsIn(ctx.rec).filter((otherId) => otherId !== playerId && ctx.prev.res[otherId] && ctx.prev.res[otherId].position === 1); return firsts.some((otherId) => !ctx.rec.res[otherId].correct); } },
  "A song from only 1 person's list": { global: (ctx) => playerIdsIn(ctx.rec).filter((playerId) => isOnMyList(ctx.rec.res[playerId])).length === 1 },
  "A song from 5 or more people's list": { global: (ctx) => playerIdsIn(ctx.rec).filter((playerId) => isOnMyList(ctx.rec.res[playerId])).length >= 5 },
  "2 or more people share the same wrong answer": { global: (ctx) => { const seen = {}; return playerIdsIn(ctx.rec).some((playerId) => { if (ctx.rec.res[playerId].correct) return false; const answer = lettersOnly(ctx.rec.answers[playerId]); if (!answer) return false; seen[answer] = (seen[answer] || 0) + 1; return seen[answer] >= 2; }); } },
  "Last-place player gets it right": { global: (ctx) => { if (!ctx.prev) return false; const pos = playerIdsIn(ctx.rec).filter((playerId) => ctx.prev.res[playerId]).map((playerId) => ctx.prev.res[playerId].position); if (pos.length < 2 || Math.max(...pos) === Math.min(...pos)) return false; const last = Math.max(...pos), inLast = playerIdsIn(ctx.rec).filter((playerId) => ctx.prev.res[playerId] && ctx.prev.res[playerId].position === last); return inLast.length === 1 && ctx.rec.res[inLast[0]].correct; } },
  "Half of the people get it right": { global: (ctx) => playerIdsIn(ctx.rec).length >= 2 && correctCount(ctx.rec) === Math.floor(playerIdsIn(ctx.rec).length / 2) },
  "Someone else disconnects": { global: (ctx) => ctx.rec.left },
};
const AUTO_TILES = new Set(Object.keys(RULES));
// Tiles the script can't be sure about: it asks the player to confirm instead of marking.
const ASK_TILES = {
  "Idol group or unit (real or from an idol anime)": { global: (ctx) => (ctx.s.animeGenre || []).includes("Music") && (ctx.s.animeTags || []).includes("Idol"), question: "Idol group?" },
};

function ctxFor(rec) { return { rec, s: rec.s, hist: game.hist, prev: game.hist[game.hist.length - 2] || null }; }
function testTile(text, ctx, playerId) {
  const rule = RULES[text]; if (!rule) return false;
  try { return rule.global ? !!rule.global(ctx) : (playerId != null && !!ctx.rec.res[playerId] && !!rule.personal(ctx, playerId)); } catch (error) { return false; }
}

/* ---------------- tile packs: custom tiles and settings ---------------- */
// Tile sets: TILESETS rows are [column, difficulty E/M/H, auto 1/0, sets "CSX", text]. Standard = the website's tiles.
const SET_NAMES = { C: "Casual", S: "Standard", X: "Expert" };
const SET_INFO = { C: "Easier, hints on.", S: "Standard experience.", X: "Harder." };
const SET_CAP = { C: 1, S: 1, X: 3 };
function poolsFor(set, manual) {
  return COLS.map((col, colIdx) => TILESETS.filter((row) => row[0] === colIdx && row[3].includes(set) && (manual || row[2])).map((row) => ({ text: row[4], hard: row[1] === "H", d: row[1] })));
}
const DEFAULT_POOLS = COLS.map((col) => col.pool.slice());
const DEFAULT_SETTINGS = { set: "S", manual: true, hardCap: 1, replace: true, auto: true, needCorrect: false, onePerSong: false, wild: true, lockAuto: false, soloMix: false };
// Settings as a 10-character token, e.g. "X131100100", so players can load a tile set without DMs.
const RULE_KEYS = ["manual", "hardCap", "replace", "auto", "needCorrect", "onePerSong", "wild", "lockAuto", "soloMix"];
function encodeRules(settings) { return (settings.set || "S") + RULE_KEYS.map((key) => (key === "hardCap" ? Math.min(9, settings.hardCap | 0) : settings[key] ? 1 : 0)).join(""); }
function decodeRules(tok) {
  if (!/^[CSX][0-9]{9}$/.test(tok || "")) return null;
  const settings = { ...DEFAULT_SETTINGS, set: tok[0] };
  RULE_KEYS.forEach((key, keyIdx) => { const digit = Number(tok[keyIdx + 1]); settings[key] = key === "hardCap" ? digit : digit === 1; });
  return settings;
}
let SETTINGS = { ...DEFAULT_SETTINGS };
const COL_ALIASES = { anime: 0, song: 1, songs: 1, artist: 2, artists: 2, individual: 3, ind: 3, "meta (individual)": 3, multiplayer: 4, multi: 4, "meta (multiplayer)": 4 };

// Text format: "Anime: tile" per line, or a "[Song]" / "Song:" header followed by tiles. "*" in front = hard tile.
function parseTiles(text) {
  const cols = [[], [], [], [], []], errors = []; let currentCol = null;
  (text || "").split(/\r?\n/).forEach((raw, lineNo) => {
    const line = raw.trim(); if (!line || line.startsWith("#")) return;
    const head = line.match(/^\[(.+)\]$/) || line.match(/^([^:]+):$/);
    if (head) { const col = COL_ALIASES[head[1].trim().toLowerCase()]; if (col == null) errors.push(`Line ${lineNo + 1}: unknown column "${head[1]}"`); else currentCol = col; return; }
    const inl = line.match(/^([^:]{3,20}):\s*(.+)$/); let col = currentCol, tile = line;
    if (inl && COL_ALIASES[inl[1].trim().toLowerCase()] != null) { col = COL_ALIASES[inl[1].trim().toLowerCase()]; tile = inl[2].trim(); }
    if (col == null) { errors.push(`Line ${lineNo + 1}: no column for "${line}"`); return; }
    const hard = tile.startsWith("*"), easy = !hard && tile.startsWith("-"); tile = tile.replace(/^[*-]\s*/, "");
    if (tile.length > 90) tile = tile.slice(0, 90);
    cols[col].push({ text: tile, hard, d: hard ? "H" : easy ? "E" : "M" });
  });
  return { cols, errors };
}
function packOf(custom, settings) {
  const body = JSON.stringify({ m: custom.mode || "add", t: custom.text || "", s: settings });
  const isStd = !(custom.text || "").trim() && Object.keys(DEFAULT_SETTINGS).every((key) => settings[key] === DEFAULT_SETTINGS[key]);
  const hash = hash32(body); let packId = ""; for (let digitNo = 0, rest = hash; digitNo < 4; digitNo++) { packId += B32[rest % 32]; rest = Math.floor(rest / 32); }
  return { id: isStd ? "" : packId, body };
}
// Apply a pack to this client. Returns an error string if a column would be too small.
function applyPack(body) {
  let mode = "add", text = "", settings = DEFAULT_SETTINGS;
  if (body) { try { const parsed = JSON.parse(body); mode = parsed.m; text = parsed.t; settings = { ...DEFAULT_SETTINGS, ...parsed.s }; } catch (error) { return "Couldn't read the tile pack."; } }
  const { cols } = parseTiles(text);
  const setPools = poolsFor(settings.set || "S", settings.manual !== false);
  const pools = COLS.map((col, colIdx) => {
    const base = mode === "replace" ? [] : setPools[colIdx], seen = new Set(base.map((tile) => tile.text));
    cols[colIdx].forEach((tile) => { if (!seen.has(tile.text)) { seen.add(tile.text); base.push(tile); } });
    return base;
  });
  const short = COLS.find((col, colIdx) => pools[colIdx].length < (col.wild ? 4 : 5));
  if (short) return `The ${short.name} column needs at least ${short.wild ? 4 : 5} tiles.`;
  COLS.forEach((col, colIdx) => { col.pool = pools[colIdx]; });
  SETTINGS = settings;
  return "";
}
// Same algorithm as the website's buildBoard, with the hard-tile limit from the settings.
function makeBoard(name, code, variant) {
  const rand = rng(norm(name) + "|" + code + "|" + variant), cap = SETTINGS.hardCap, wildOn = SETTINGS.wild !== false, fams = new Set();
  const mix = !!SETTINGS.soloMix, picksSoFar = [];
  const picks = COLS.map((col, colIdx) => {
    const size = col.wild && wildOn ? 4 : 5, out = []; let hard = 0;
    // Solo: the Multiplayer column is replaced by a mix of leftover tiles from the other four columns.
    if (mix && colIdx === 4) {
      const used = new Set(); for (let colIdx = 0; colIdx < 4; colIdx++) (picksSoFar[colIdx] || []).forEach((tile) => used.add(tile.text));
      const pool = COLS.slice(0, 4).flatMap((col, colIdx) => col.pool.filter((tile) => !used.has(tile.text)).map((tile) => ({ ...tile, from: colIdx })));
      for (const tile of shuffle(pool, rand)) { if (out.length === size) break; if (tile.hard && hard >= cap) continue; const family = FAMILY[tile.text]; if (family && fams.has(family)) continue; out.push(tile); if (tile.hard) hard++; if (family) fams.add(family); }
      return out;
    }
    for (const tile of shuffle(col.pool, rand)) { if (out.length === size) break; if (tile.hard && hard >= cap) continue; const family = FAMILY[tile.text]; if (family && fams.has(family)) continue; out.push(tile); if (tile.hard) hard++; if (family) fams.add(family); }
    if (out.length < size) for (const tile of shuffle(col.pool, rand)) { if (out.length === size) break; if (!out.includes(tile)) out.push(tile); }
    picksSoFar[colIdx] = out;
    return out;
  });
  const cells = [];
  for (let row = 0; row < 5; row++) for (let colIdx = 0; colIdx < 5; colIdx++) {
    if (colIdx === 2 && row === 2 && wildOn) { cells.push({ wild: true, col: colIdx }); continue; }
    const idx = colIdx === 2 && row > 2 && wildOn ? row - 1 : row;
    const tile = picks[colIdx][idx]; cells.push({ ...tile, col: tile && tile.from != null ? tile.from : colIdx });
  }
  return cells;
}

/* ---------------- confetti ---------------- */
function confetti(host) {
  if (!host || (window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches)) return;
  const layer = makeEl("div", { style: "position:absolute;inset:0;pointer-events:none;overflow:hidden;z-index:10" });
  host.appendChild(layer);
  const colors = ["#ff4f93", "#ffd166", "#4f8cff", "#3fbf7f", "#b37bff", "#ff9f43"];
  for (let pieceNo = 0; pieceNo < 46; pieceNo++) {
    const piece = makeEl("span", { style: `position:absolute;left:${10 + Math.random() * 80}%;top:38%;width:${5 + Math.random() * 5}px;height:${8 + Math.random() * 6}px;background:${colors[pieceNo % colors.length]};border-radius:2px` });
    layer.appendChild(piece);
    const driftX = (Math.random() - 0.5) * 320, riseY = -120 - Math.random() * 160, down = 260 + Math.random() * 160;
    piece.animate([
      { transform: "translate(0,0) rotate(0)", opacity: 1 },
      { transform: `translate(${driftX * 0.6}px,${riseY}px) rotate(${Math.random() * 360}deg)`, opacity: 1, offset: 0.35 },
      { transform: `translate(${driftX}px,${down}px) rotate(${Math.random() * 720}deg)`, opacity: 0 },
    ], { duration: 1500 + Math.random() * 700, easing: "cubic-bezier(.2,.7,.4,1)" });
  }
  setTimeout(() => layer.remove(), 2400);
}

/* ---------------- AnisongDB: "right artist, wrong anime" ---------------- */
const ARTIST_TILE = "Right artist, wrong anime (your answer has a song by this artist)";
RULES[ARTIST_TILE] = { personal: () => false }; AUTO_TILES.add(ARTIST_TILE); // marked later, once AnisongDB answers
const artistCache = {};
function postJSON(url, body) {
  return new Promise((resolve, reject) => {
    if (typeof GM_xmlhttpRequest === "function") {
      GM_xmlhttpRequest({ method: "POST", url, data: JSON.stringify(body), headers: { "Content-Type": "application/json" }, timeout: 10000,
        onload: (response) => { try { resolve(JSON.parse(response.responseText)); } catch (error) { reject(error); } }, onerror: reject, ontimeout: reject });
    } else fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }).then((response) => response.json()).then(resolve, reject);
  });
}
// All anime names that have a song by this artist (cached per artist).
function animeByArtist(artist) {
  const key = norm(artist || ""); if (!key) return Promise.resolve(new Set());
  if (!artistCache[key]) {
    artistCache[key] = postJSON("https://anisongdb.com/api/search_request", {
      artist_search_filter: { search: artist, partial_match: false, match_case: false, group_granularity: 0, max_other_artist: 99 },
      and_logic: false, ignore_duplicate: false,
    }).then((rows) => {
      const names = new Set();
      (Array.isArray(rows) ? rows : []).forEach((row) => [row.animeENName, row.animeJPName, ...(row.animeAltName || [])].forEach((name) => name && names.add(lettersOnly(name))));
      return names;
    }).catch((error) => { console.warn("[AMQ Bingo] AnisongDB lookup failed", error); delete artistCache[key]; return null; });
  }
  return artistCache[key];
}
// Which players answered a different anime that also has a song by this artist.
async function artistMatches(rec) {
  const wrong = playerIdsIn(rec).filter((playerId) => !rec.res[playerId].correct && lettersOnly(rec.answers[playerId]));
  if (!wrong.length) return [];
  const names = await animeByArtist(rec.s.artist); if (!names) return [];
  const right = new Set(allTitles(rec.s).map(lettersOnly));
  return wrong.filter((playerId) => { const answer = lettersOnly(rec.answers[playerId]); return names.has(answer) && !right.has(answer); });
}

/* ---------------- AnisongDB: tiles AMQ's reveal doesn't carry ---------------- */
// One lookup per anime (all its songs), cached. Each song row has songType and songCategory
// ("standard" | "character" | "chanting" | "instrumental" | "other").
const annCache = {};
function annRows(annId) {
  if (!annId) return Promise.resolve(null);
  if (!(annId in annCache)) {
    annCache[annId] = postJSON("https://anisongdb.com/api/annId_request", { annId: Number(annId), ignore_duplicate: false })
      .then((rows) => (Array.isArray(rows) ? rows : []))
      .catch((error) => { console.warn("[AMQ Bingo] AnisongDB lookup failed", error); delete annCache[annId]; return null; });
  }
  return annCache[annId];
}
const songCategory = (rec) => annRows(rec.s.annId).then((rows) => { const row = rows && rows.find((row) => Number(row.annSongId) === Number(rec.s.annSongId)); return row ? String(row.songCategory || "").toLowerCase() : null; });
const INSERT_TILE = "Show has 3 or more insert songs";
const ASYNC_TILES = {
  [INSERT_TILE]: (rec) => annRows(rec.s.annId).then((rows) => !!rows && rows.filter((row) => /insert/i.test(String(row.songType || ""))).length >= 3),
  "Instrumental": (rec) => songCategory(rec).then((category) => category === "instrumental"),
  "Chanting": (rec) => songCategory(rec).then((category) => category === "chanting"),
};
Object.keys(ASYNC_TILES).forEach((text) => { RULES[text] = { global: () => false }; AUTO_TILES.add(text); }); // marked later, once AnisongDB answers

/* ---------------- messaging ---------------- */
// Players AMQ refused to let us message (level-5 rule). Cleared as soon as a message to them goes through.
let lastOwnDM = 0, lastDMTarget = "";
const dmBlocked = new Map(); // name -> time; retried after a minute
function sendDM(target, message) {
  if (!target || norm(target) === norm(myName()) || Date.now() - (dmBlocked.get(norm(target)) || 0) < 60000) return;
  lastOwnDM = Date.now(); lastDMTarget = norm(target);
  console.log("[AMQ Bingo] DM ->", target, message.slice(0, 60));
  try { PAGE.socket.sendCommand({ type: "social", command: "chat message", data: { target, message } }); } catch (error) { console.warn("[AMQ Bingo] DM failed", error); }
}
function sendGameChat(msg) {
  try { PAGE.socket.sendCommand({ type: "lobby", command: "game chat message", data: { msg, teamMessage: false } }); } catch (error) { console.warn("[AMQ Bingo] chat failed", error); }
}

/* ---------------- styles ---------------- */
const CSS = `
.amqb-panel{position:fixed;z-index:9999;top:70px;width:440px;min-width:300px;min-height:120px;max-width:calc(100vw - 16px);max-height:calc(100vh - 16px);resize:both;overflow:auto;background:#1c1b26;color:#ecebf5;border:1px solid #3a3850;border-radius:14px;box-shadow:0 12px 40px rgba(0,0,0,.5);font:13px/1.35 "Segoe UI",Roboto,sans-serif}
.amqb-panel,.amqb-panel *{box-sizing:border-box}
.amqb-panel{--cat:#6c6a90}
.amqb-head{display:flex;align-items:center;justify-content:space-between;gap:8px;padding:10px 12px;background:#2a2740;border-radius:14px 14px 0 0;cursor:move;user-select:none;position:sticky;top:0;z-index:2}
.amqb-head b{font-size:15px}.amqb-head small{color:#a3a1b8;margin-left:6px}
.amqb-x{border:0;background:none;color:#a3a1b8;font-size:18px;cursor:pointer;padding:0 4px}
.amqb-body{padding:10px 12px;display:flex;flex-direction:column;gap:10px}
.amqb-btn{border:1.5px solid #5b5876;background:#262436;color:#ecebf5;border-radius:999px;padding:5px 12px;font-weight:700;font-size:12px;cursor:pointer}
.amqb-btn.pri{background:#ff4f93;border-color:#ff4f93;color:#1d0b14}
.amqb-btn:disabled{opacity:.45;cursor:not-allowed}
.amqb-row{display:flex;flex-wrap:wrap;gap:6px;align-items:center}
.amqb-in{background:#13121c;color:#ecebf5;border:1.5px solid #3a3850;border-radius:8px;padding:5px 8px;font:inherit}
.amqb-muted{color:#a3a1b8;font-size:12px}
.amqb-grid{display:grid;grid-template-columns:repeat(5,1fr);gap:2px;background:#3a3850;border:2px solid #3a3850;border-radius:10px;overflow:hidden}
.amqb-ch{background:#2f2b72;color:#fff;font-weight:800;font-size:10.5px;text-align:center;padding:4px 2px}
.amqb-cell{position:relative;min-height:62px;background:#1c1b26;color:#ecebf5;border:0;padding:4px 3px;font-size:10.5px;line-height:1.2;text-align:center;cursor:pointer;display:flex;align-items:center;justify-content:center;overflow-wrap:anywhere}
.amqb-cell.hard{font-weight:700}
.amqb-cell.on{background:#5a2440;font-weight:700}
.amqb-cell.on::after{content:"✓";position:absolute;top:2px;right:3px;font-size:10px;color:#ff4f93}
.amqb-cell.auto::before{content:"auto";position:absolute;bottom:2px;left:3px;font-size:8px;color:#ff9bc2;font-weight:800}
.amqb-cell.line{box-shadow:inset 0 0 0 2px #ff4f93}
.amqb-cell.wild{flex-direction:column;gap:3px;cursor:default;background:#23213a}
.amqb-cell.wild select{width:100%;font-size:10px;background:#13121c;color:#ecebf5;border:1px solid #3a3850;border-radius:4px}
.amqb-cell.ok{background:#1f4d36}.amqb-cell.unk{background:#5a3a14;outline:1.5px dashed #fdba74;outline-offset:-3px}.amqb-cell.hostonly{background:#2c2a40;color:#a3a1b8}
.amqb-stats{display:flex;gap:12px;font-weight:700}.amqb-stats b{color:#ff4f93;font-size:16px}
.amqb-bingo{position:absolute;left:0;right:0;top:38%;z-index:6;pointer-events:none;text-align:center;font-size:34px;font-weight:900;color:#ff4f93;text-shadow:0 2px 12px rgba(0,0,0,.85),0 0 2px #000;animation:amqbPop .5s}
@keyframes amqbPop{0%{transform:scale(.3);opacity:0}100%{transform:none;opacity:1}}
.amqb-code{font-size:26px;font-weight:900;letter-spacing:6px}
.amqb-tabs button{border:1.5px solid #3a3850;background:#13121c;color:#ecebf5;border-radius:8px;padding:4px 10px;font-weight:800;cursor:pointer}
.amqb-tabs button.sel{background:#ecebf5;color:#13121c}
.amqb-plist{display:flex;flex-direction:column;gap:4px}
.amqb-pl{display:grid;grid-template-columns:1fr auto auto auto;gap:6px;align-items:center;background:#13121c;border-radius:8px;padding:5px 8px}
.amqb-pl b.ok{color:#5fd39a}
.amqb-tog{border:1.5px solid #3a3850;background:#262436;color:#a3a1b8;border-radius:999px;padding:1px 9px;font-size:11px;font-weight:800;cursor:pointer}
.amqb-tog.on{background:#5fd39a;border-color:#5fd39a;color:#13121c}
.amqb-tiles{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:8px}
.amqb-tiles .self{opacity:.5}
.amqb-tiles .self .amqb-t{cursor:default}
.amqb-tiles div{display:flex;flex-direction:column;gap:2px}
.amqb-tiles b{font-size:11px;color:#a3a1b8}
.amqb-t{border:0;text-align:left;background:#13121c;color:#ecebf5;border-radius:5px;padding:3px 5px;font-size:10px;cursor:pointer}
.amqb-t.on{background:#1f4d36;font-weight:700}
.amqb-log{font-size:11px;color:#a3a1b8;max-height:70px;overflow:auto}
.amqb-grip{flex:none;height:12px;cursor:ns-resize;background:linear-gradient(transparent 5px,#3a3850 5px,#3a3850 7px,transparent 7px);display:flex;justify-content:center;border-top:1px solid #2f2d42}
.amqb-grip::after{content:"";width:40px;height:4px;border-radius:2px;background:#a3a1b8;margin-top:4px;opacity:.8}
.amqb-grip:hover::after{background:#ff4f93}
.amqb-panel.docked{resize:none;min-width:0;min-height:0;position:absolute;z-index:5;width:auto;max-height:none;border-radius:8px;box-shadow:none;border-color:#2f2d42;overflow:hidden;display:flex;flex-direction:column}
.amqb-panel.docked .amqb-head{flex:none;position:static}
.amqb-panel.docked .amqb-head{cursor:default;border-radius:8px 8px 0 0;padding:6px 10px}
.amqb-panel.docked .amqb-body{padding:6px 8px 8px;gap:6px;flex:1;min-height:0;overflow-y:auto}
.amqb-body > *{flex-shrink:0}
.amqb-panel.docked .amqb-cell{min-height:0;height:var(--cellh,44px);font-size:var(--cellf,9.5px);padding:2px 2px;overflow:hidden}
.amqb-panel.docked .amqb-ch{font-size:9.5px;padding:3px 1px}

.amqb-hbtn{border:0;background:none;color:#a3a1b8;font-size:13px;cursor:pointer;padding:0 4px}
.amqb-ch{background:color-mix(in srgb,var(--cat) 62%,#1c1b26)}
.amqb-cell{background:color-mix(in srgb,var(--cat) 9%,#1c1b26)}
.amqb-cell.man:not(.on){background-image:repeating-linear-gradient(135deg,transparent 0 6px,rgba(243,201,105,.10) 6px 9px);outline:1px dashed rgba(243,201,105,.55);outline-offset:-4px}
.amqb-cell.man .tag{color:#f3c969;opacity:.95}
.amqb-cell .dif,.amqb-legend .dif{font-style:normal;font-size:8px;font-weight:900;border-radius:5px;padding:0 3px;line-height:11px}
.amqb-cell .dif{position:absolute;bottom:2px;right:3px}
.amqb-legend .dif{margin-right:2px}
.dif.dE{background:#1f4d36;color:#7ee2ae}.dif.dM{background:#4d3f14;color:#f3c969}.dif.dH{background:#5a2440;color:#ff9bc2}
.amqb-legend .lg-man{color:#f3c969}
.amqb-cell.pickme{outline:2px solid #ffd166;outline-offset:-3px}
.amqb-pick{display:flex;flex-direction:column;gap:6px;background:#2a2740;border:1.5px solid #ffd166;border-radius:10px;padding:8px}
.amqb-err{color:#fdba74;font-size:12px;font-weight:700}
.amqb-speed{font-weight:800;font-size:13px;color:#7ee2ae;display:flex;flex-wrap:wrap;gap:6px;align-items:baseline;font-variant-numeric:tabular-nums}
.amqb-speed.done{color:#ffd166}
.amqb-speed .amqb-muted{font-weight:600;font-size:11px}
.amqb-endprompt{position:fixed;top:14px;left:50%;transform:translateX(-50%);z-index:10001;background:#2a2740;color:#ecebf5;border:2px solid #ff4f93;border-radius:12px;padding:10px 14px;font:13px/1.35 "Segoe UI",Roboto,sans-serif;box-shadow:0 12px 40px rgba(0,0,0,.5);text-align:center;max-width:min(560px,92vw);animation:amqbPop .4s}
.amqb-endprompt .amqb-btn{font-size:12px}
.amqb-undo{background:#23213a;border-radius:8px;padding:4px 8px;justify-content:space-between}
.amqb-cell .tag{position:absolute;bottom:2px;left:3px;font-size:7.5px;font-weight:800;letter-spacing:.3px;color:color-mix(in srgb,var(--cat) 80%,#fff);opacity:.75}
.amqb-cell.on .tag{opacity:1;color:#ff9bc2}
.amqb-cell.auto::before{content:none}
.amqb-cell.line.pulse{animation:amqbPulse .9s ease-in-out 3}
@keyframes amqbPulse{50%{box-shadow:inset 0 0 0 3px #ffd166;background:#6b2a4d}}
.amqb-cell.ask{outline:2px solid #ffd166;outline-offset:-3px;animation:amqbAsk 1.2s ease-in-out 3;padding-top:14px}
@keyframes amqbAsk{50%{outline-color:transparent}}
.amqb-cell .askq{position:absolute;left:3px;top:2px;font-size:8.5px;font-weight:800;color:#1d0b14;background:#ffd166;border-radius:999px;padding:0 5px;line-height:12px}
.amqb-cell .askx{position:absolute;top:1px;right:3px;font-size:12px;color:#ffd166;cursor:pointer;line-height:1}
.amqb-t.ask{outline:1.5px solid #ffd166}
.amqb-legend{display:flex;gap:10px;font-size:10.5px;color:#a3a1b8}
.amqb-log{display:flex;flex-direction:column;gap:5px;max-height:110px}
.amqb-logrow{display:flex;flex-wrap:wrap;gap:4px;align-items:center}
.amqb-logn{font-size:10px;font-weight:800;color:#a3a1b8;min-width:26px;flex-shrink:0}
.amqb-logbox{display:flex;flex-direction:column;gap:5px;border-top:1px solid #2f2d42;padding-top:6px}
.amqb-songlog{display:flex;flex-direction:column;gap:3px;font-size:11px;height:68px;min-height:68px;overflow-y:auto;overflow-x:hidden;background:#15141f;border:1px solid #2f2d42;border-radius:8px;padding:4px 6px}
.amqb-songlog .amqb-logrow{flex-wrap:nowrap;white-space:nowrap;overflow:hidden;flex-shrink:0}
.amqb-songlog .amqb-chip,.amqb-songlog .amqb-lognote{flex-shrink:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.amqb-lognote{font-size:10px;color:#ffd166;font-style:italic}
.amqb-prefs{font-size:10px;color:#a3a1b8;gap:4px;row-gap:6px;padding-bottom:4px}
.amqb-seg{border:1px solid #3a3850;background:#13121c;color:#a3a1b8;border-radius:6px;padding:0 6px;font-size:10px;line-height:16px;cursor:pointer}
.amqb-seg.sel{background:#ecebf5;color:#13121c;border-color:#ecebf5}
.amqb-chip{font-size:10px;font-weight:700;padding:1px 7px;border-radius:999px;background:color-mix(in srgb,var(--cat) 28%,#1c1b26);border:1px solid color-mix(in srgb,var(--cat) 60%,transparent);color:#fff;max-width:170px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.amqb-ta{width:100%;min-height:110px;background:#13121c;color:#ecebf5;border:1.5px solid #3a3850;border-radius:8px;padding:6px 8px;font:12px/1.4 ui-monospace,Menlo,monospace}
.amqb-set{display:flex;flex-wrap:wrap;gap:6px 14px;font-size:12px}
.amqb-set label{display:flex;gap:5px;align-items:center}
.amqb-err{color:#fdba74;font-size:12px}
.amqb-ok{color:#5fd39a;font-size:12px}
.amqb-setrow{display:grid;grid-template-columns:1fr auto;gap:10px;align-items:center;padding:6px 0;border-bottom:1px solid #2a2840}
.amqb-setrow b{font-size:12.5px}
.amqb-sechead{margin-top:6px;color:#ff9bc2;font-size:12px;text-transform:uppercase;letter-spacing:.8px}
.amqb-mini{position:fixed;left:16px;bottom:16px;z-index:9999;display:flex;align-items:center;gap:8px;padding:6px 12px;border-radius:999px;background:#2a2740;color:#ecebf5;border:1px solid #3a3850;box-shadow:0 6px 20px rgba(0,0,0,.45);font:12px "Segoe UI",Roboto,sans-serif;cursor:pointer}
.amqb-mini b{letter-spacing:2px}
.amqb-mini .alert{background:#ff4f93;color:#1d0b14;border-radius:999px;padding:0 8px;font-weight:800;animation:amqbPulse2 1s ease-in-out 4}
@keyframes amqbPulse2{50%{transform:scale(1.12)}}
`;

/* ---------------- panels (shared) ---------------- */
function makePanel(panelId, title, side, extra, onClose) {
  const body = makeEl("div", { class: "amqb-body" });
  const sub = makeEl("small", {});
  const panel = makeEl("div", { class: "amqb-panel", id: panelId, style: `${side}:16px;display:none` },
    makeEl("div", { class: "amqb-head" }, makeEl("span", {}, makeEl("b", {}, title), sub),
      makeEl("span", {}, extra, makeEl("button", { class: "amqb-x", title: "Close", onclick: () => { panel.style.display = "none"; if (onClose) onClose(); } }, "×"))),
    body);
  // Drag by the header. The header always stays on screen, so the panel can't be lost.
  const head = panel.firstChild, saveKey = "pos." + panelId;
  const clamp = () => {
    if (panel.classList.contains("docked") || panel.style.display === "none" || panel.style.left === "") return;
    const panelWidth = panel.offsetWidth, left = parseFloat(panel.style.left) || 0, top = parseFloat(panel.style.top) || 0;
    panel.style.left = Math.max(80 - panelWidth, Math.min(window.innerWidth - 80, left)) + "px";
    panel.style.top = Math.max(0, Math.min(window.innerHeight - 40, top)) + "px";
  };
  const savePos = () => { if (!panel.classList.contains("docked")) store.set(saveKey, { x: panel.style.left, y: panel.style.top, w: panel.style.width, h: panel.style.height }); };
  const resetPos = () => { panel.style.left = ""; panel.style.top = "70px"; panel.style[side] = "16px"; panel.style.width = ""; panel.style.height = ""; store.set(saveKey, null); };
  head.addEventListener("mousedown", (event) => {
    if (event.target.closest("button") || panel.classList.contains("docked")) return;
    const rect = panel.getBoundingClientRect(), grabX = event.clientX - rect.left, grabY = event.clientY - rect.top;
    const onMove = (moveEvent) => { panel.style.left = moveEvent.clientX - grabX + "px"; panel.style.top = moveEvent.clientY - grabY + "px"; panel.style.right = "auto"; clamp(); };
    const onUp = () => { document.removeEventListener("mousemove", onMove); document.removeEventListener("mouseup", onUp); savePos(); };
    document.addEventListener("mousemove", onMove); document.addEventListener("mouseup", onUp);
  });
  head.title = "Drag to move. Double-click to put it back in the corner.";
  head.addEventListener("dblclick", (event) => { if (!event.target.closest("button") && !panel.classList.contains("docked")) resetPos(); });
  window.addEventListener("resize", clamp);
  // Resizable from the bottom-right corner; the size is remembered.
  try { new ResizeObserver(() => { if (panel.style.display !== "none" && !panel.classList.contains("docked") && (panel.style.width || panel.style.height)) savePos(); }).observe(panel); } catch (error) {}
  panel.addEventListener("mouseup", () => { if (!panel.classList.contains("docked") && panel.offsetWidth && (panel.style.width || panel.style.height)) savePos(); });
  // Scroll ourselves, so AMQ's own wheel handling can't block scrolling inside the panel.
  panel.addEventListener("wheel", (event) => {
    let element = event.target;
    while (element && element !== panel.parentNode) {
      if (element.scrollHeight > element.clientHeight + 1 && /(auto|scroll)/.test(getComputedStyle(element).overflowY)) break;
      element = element.parentElement;
    }
    if (!element || element === panel.parentNode) return;
    element.scrollTop += event.deltaMode === 1 ? event.deltaY * 16 : event.deltaY; event.preventDefault(); event.stopPropagation();
  }, { passive: false });
  const saved = store.get(saveKey, null);
  if (saved) { if (saved.x) { panel.style.left = saved.x; panel.style.top = saved.y; panel.style.right = "auto"; } if (saved.w) panel.style.width = saved.w; if (saved.h) panel.style.height = saved.h; }
  // keep AMQ from grabbing keys typed in our inputs
  panel.addEventListener("keydown", (event) => { if (event.target.matches("input,select")) event.stopPropagation(); });
  document.body.appendChild(panel);
  return { panel, body, sub, resetPos, toggle: () => { panel.style.display = panel.style.display === "none" ? "" : "none"; clamp(); } };
}

/* ---------------- docking the board into the chat column ---------------- */
// AMQ's chat messages box. These ids are best guesses; Alt+Shift+D copies the real layout if none match.
const CHAT_SELECTORS = ["#gcMessageContainer", "#gcChatContent", "#gcContent", "#gcContainer"];
const findChat = () => { for (const selector of CHAT_SELECTORS) { const element = document.querySelector(selector); if (element && element.offsetHeight > 80) return element; } return null; };
let dock = null; // { chat, saved: {top,height,flex} }

function undockBoard() {
  if (!dock) return;
  const { chat, saved } = dock;
  chat.style.top = saved.top; chat.style.height = saved.height; chat.style.flex = saved.flex; if (dock.restoreMargin) chat.style.marginTop = "";
  const boardPanel = playerUI.panel;
  boardPanel.classList.remove("docked"); const grip = boardPanel.querySelector(".amqb-grip"); if (grip) grip.remove();
  boardPanel.style.cssText = "right:16px;top:70px;display:" + boardPanel.style.display;
  document.body.appendChild(boardPanel);
  dock = null;
}
function dockBoard() {
  undockBoard();
  const chat = findChat(), boardPanel = playerUI.panel;
  if (!chat) return false;
  const computed = getComputedStyle(chat), rect = chat.getBoundingClientRect();
  if (rect.height < 230) return false;
  dock = { chat, saved: { top: chat.style.top, height: chat.style.height, flex: chat.style.flex }, restoreMargin: false,
    total: rect.height, origTop: chat.offsetTop, abs: computed.position === "absolute" || computed.position === "fixed", autoBottom: computed.bottom === "auto" };
  const origLeft = chat.offsetLeft, width = chat.offsetWidth;
  boardPanel.classList.add("docked");
  const parent = chat.offsetParent || chat.parentElement;
  if (getComputedStyle(parent).position === "static") parent.style.position = "relative";
  parent.appendChild(boardPanel);
  boardPanel.style.left = origLeft + "px"; boardPanel.style.top = dock.origTop + "px"; boardPanel.style.width = width + "px"; boardPanel.style.right = "auto";
  setDockHeight(Math.round(rect.height * (playerData.dockRatio || 0.6)));
  // Drag handle along the bottom edge: sets how much of the chat column the board takes.
  if (!boardPanel.querySelector(".amqb-grip")) {
    const grip = makeEl("div", { class: "amqb-grip", title: "Drag to give the board or the chat more room. Double-click to reset." });
    grip.addEventListener("mousedown", (event) => {
      if (!dock) return; event.preventDefault();
      const startY = event.clientY, startHeight = boardPanel.offsetHeight;
      const onMove = (moveEvent) => setDockHeight(startHeight + moveEvent.clientY - startY);
      const onUp = () => { document.removeEventListener("mousemove", onMove); document.removeEventListener("mouseup", onUp); if (dock) { playerData.dockRatio = boardPanel.offsetHeight / dock.total; savePlayerData(); } };
      document.addEventListener("mousemove", onMove); document.addEventListener("mouseup", onUp);
    });
    grip.addEventListener("dblclick", () => { playerData.dockRatio = 0.6; savePlayerData(); if (dock) setDockHeight(Math.round(dock.total * 0.6)); });
    boardPanel.appendChild(grip);
  }
  return true;
}
// Board height when docked; the chat gets the rest (at least 70px each way).
function setDockHeight(newHeight) {
  if (!dock) return;
  const boardPanel = playerUI.panel, chat = dock.chat;
  newHeight = Math.max(120, Math.min(dock.total - 70, Math.round(newHeight)));
  boardPanel.style.height = newHeight + "px";
  // Cells shrink with the board so all 5 rows stay visible; stats and buttons scroll below.
  const cellH = Math.max(26, Math.min(56, Math.floor((newHeight - 165) / 5))); // leaves room for the song log under the board
  boardPanel.style.setProperty("--cellh", cellH + "px"); boardPanel.style.setProperty("--cellf", Math.max(8, Math.min(10.5, cellH / 4.6)).toFixed(1) + "px");
  if (dock.abs) { chat.style.top = (dock.origTop + newHeight) + "px"; if (dock.autoBottom) chat.style.height = (dock.total - newHeight) + "px"; }
  else { chat.style.flex = "0 0 auto"; chat.style.height = (dock.total - newHeight) + "px"; chat.style.marginTop = newHeight + "px"; dock.restoreMargin = true; }
  // keep the newest chat line in view
  chat.scrollTop = chat.scrollHeight;
}
function placeBoard() {
  if (!playerUI) return;
  const shown = playerUI.panel.style.display !== "none";
  if (!shown) { undockBoard(); return; }
  if (playerData.dock !== false) { if (!dockBoard()) { undockBoard(); if (!placeBoard.warned) { placeBoard.warned = true; sysMsg("AMQ Bingo: couldn't find the chat panel, so the board is a popup. Press Alt+Shift+D and send the copied text to Claude."); } } }
  else undockBoard();
}
function copyChatLayout() {
  const out = [];
  const chatish = [...document.querySelectorAll("[id^=gc], [id*=Chat], [id*=chat]")].slice(0, 40);
  chatish.forEach((element) => { const rect = element.getBoundingClientRect(), computed = getComputedStyle(element); out.push(`#${element.id} <${element.tagName.toLowerCase()} class="${element.className}"> pos=${computed.position} display=${computed.display} rect=${Math.round(rect.left)},${Math.round(rect.top)} ${Math.round(rect.width)}x${Math.round(rect.height)} parent=#${element.parentElement && element.parentElement.id}`); });
  const text = out.join("\n") || "no chat elements found";
  navigator.clipboard.writeText(text).then(() => sysMsg("AMQ Bingo: chat layout copied. Paste it to Claude."), () => { console.log(text); sysMsg("AMQ Bingo: couldn't copy; the layout is in the console (F12)."); });
}

/* =====================================================================
 * PLAYER BOARD
 * ===================================================================== */
let playerData = store.get("player", { round: 0, code: "", host: "", boards: {} });
const savePlayerData = () => store.set("player", playerData);
const boardKey = () => norm(myName()) + "|" + playerData.round + "|" + playerData.code;
const curBoard = () => playerData.boards[boardKey()];
let playerUI, flashUntil = 0, autoLog = [], note = "";
// One log row per song: marks and notices for the same song are merged.
function logAdd(entry) {
  const top = autoLog[0];
  if (top && top.n === entry.n) { top.hits = [...(top.hits || []), ...(entry.hits || [])]; if (entry.note) top.note = top.note ? top.note + " " + entry.note : entry.note; }
  else autoLog.unshift({ ...entry, hits: entry.hits || [] });
  if (autoLog.length > 30) autoLog.length = 30;
}

let pendingJoin = null, packParts = {};
function announceSeen(round, code, hostName, packId, rulesTok) {
  packId = packId || "";
  // Tile set + settings only (no custom tiles): rebuild the pack from the announcement, no DM needed.
  const rules = packId && decodeRules(rulesTok);
  if (rules && packId !== (playerData.packId || "")) {
    const pack = packOf({ mode: "add", text: "" }, rules);
    if (pack.id === packId && !applyPack(pack.body)) { playerData.packId = packId; playerData.packBody = pack.body; savePlayerData(); joinRound(round, code, hostName); return true; }
  }
  if (packId === (playerData.packId || "")) { joinRound(round, code, hostName); return true; }
  if (!packId) { applyPack(""); playerData.packId = ""; playerData.packBody = ""; savePlayerData(); joinRound(round, code, hostName); return true; }
  pendingJoin = { round, code, hostName, packId };
  if (hostName.toLowerCase() === myName().toLowerCase()) { receivePack(packId, hostData.packBody || ""); return true; }
  sendDM(hostName, `${PREFIX} NEED ${packId}`);
  sysMsg("AMQ Bingo: getting the host's custom tiles…");
  return false;
}
function receivePack(packId, body) {
  if (!pendingJoin || pendingJoin.packId !== packId) return;
  const err = applyPack(body);
  if (err) { sysMsg("AMQ Bingo: " + err); return; }
  playerData.packId = packId; playerData.packBody = body; savePlayerData();
  const join = pendingJoin; pendingJoin = null;
  joinRound(join.round, join.code, join.hostName);
  sysMsg(`AMQ Bingo: custom tiles loaded. Joined round ${join.round}.`);
}
function onPackChunk(parts) {
  const [, packId, pos, chunk] = parts; const [chunkNo, chunkCount] = pos.split("/").map(Number);
  const bag = (packParts[packId] = packParts[packId] || {}); bag[chunkNo] = chunk;
  if (Object.keys(bag).length === chunkCount) {
    let body = ""; try { body = decodeURIComponent(Array.from({ length: chunkCount }, (_, idx) => bag[idx + 1]).join("")); } catch (error) { return; }
    if (packOf({ mode: JSON.parse(body).m, text: JSON.parse(body).t }, { ...DEFAULT_SETTINGS, ...JSON.parse(body).s }).id !== packId) return;
    delete packParts[packId]; receivePack(packId, body);
  }
}

function joinRound(round, code, hostName) {
  if (!myName()) return;
  const nextBoard = playerData.nextBoard; playerData.nextBoard = null;
  playerData.round = round; playerData.code = code; playerData.bcode = nextBoard && nextBoard.bcode !== code ? nextBoard.bcode : ""; if (hostName) playerData.host = hostName;
  if (!curBoard()) {
    const fresh = { variant: 0, firstAt: Date.now(), marks: [], auto: {}, wild: "", wildOn: false, lost: false, bcode: myBoardCode() };
    // Same board as before: reuse its layout (replacement too), and with "+" also its marks and wild card.
    const prev = nextBoard && Object.values(playerData.boards).filter((saved) => saved.bcode === nextBoard.bcode && saved !== fresh).sort((boardA, boardB) => (boardB.joinedAt || boardB.firstAt) - (boardA.joinedAt || boardA.firstAt))[0];
    if (prev) { fresh.variant = prev.variant; fresh.firstAt = prev.firstAt; if (nextBoard.keep) Object.assign(fresh, { marks: prev.marks.slice(), auto: { ...prev.auto }, wild: prev.wild, wildOn: prev.wildOn, lost: prev.lost, called: prev.called }); }
    fresh.joinedAt = Date.now();
    playerData.boards[boardKey()] = fresh;
  }
  savePlayerData(); autoLog = []; renderPlayer(); queueSync(true);
}

// Boards can outlive a round: with "same board" rounds, the board comes from an earlier round's code.
const myBoardCode = () => playerData.bcode || playerData.code;
const currentClaim = (board) => makeClaim(myName(), myBoardCode(), board.variant, SETTINGS.wild === false ? { ...board, wild: "", wildOn: board.marks.includes(12) } : board);
function cellsNow() { const board = curBoard(); return board ? makeBoard(myName(), myBoardCode(), board.variant) : null; }
function completedLines(board) {
  const marked = new Set(board.marks); if (board.wildOn && SETTINGS.wild !== false) marked.add(12);
  return LINES.filter((line) => line.every((cellIdx) => marked.has(cellIdx)));
}

/* ---------------- solo speedrun timer ---------------- */
// In a solo game the board gets a clock: it starts with the first song and stops at your first bingo.
const isSolo = () => Object.keys(game.players).length === 1;
const fmtTime = (ms) => { const seconds = Math.max(0, Math.round(ms / 1000)); return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`; };
// Official speedrun rules: fixed bingo settings plus fixed room settings, so times compare between
// runs and between people. Only the song selection varies: Random or Watched.
const SPEEDRUN_TILES = { set: "S", manual: false, hardCap: 1, replace: false, auto: true, needCorrect: false, onePerSong: false, wild: false, lockAuto: true, soloMix: true };
const SPEEDRUN_GAME = { rounds: 1, endMode: "bingo", autoNext: false, autoLobby: true, nextBoard: "new" };
function speedrunRoom(cat) {
  return {
    numberOfSongs: 100,
    songSelection: cat === "random" ? { standardValue: 1, advancedValue: { watched: 0, unwatched: 0, random: 100 } } : { standardValue: 3, advancedValue: { watched: 100, unwatched: 0, random: 0 } },
    songType: { standardValue: { openings: true, endings: true, inserts: true }, advancedValue: { openings: 0, endings: 0, inserts: 0, random: 100 } },
    openingCategories: { instrumental: true, chanting: true, character: true, standard: true },
    endingCategories: { instrumental: true, chanting: true, character: true, standard: true },
    insertCategories: { instrumental: true, chanting: true, character: true, standard: true },
    guessTime: { randomOn: false, standardValue: 20, randomValue: [1, 60] },
    extraGuessTime: { randomOn: false, standardValue: 0, randomValue: [0, 15] },
    songDifficulity: { advancedOn: true, standardValue: { beginner: true, easy: true, medium: true, hard: true, expert: true }, advancedValue: [0, 100] },
    songPopularity: { advancedOn: true, standardValue: { disliked: true, mixed: true, liked: true }, advancedValue: [0, 100] },
    playbackSpeed: { randomOn: false, standardValue: 1, randomValue: [true, true, true, true] },
    scoreType: 1,
    guessMode: { song: true, tinyVideo: false, blurVideo: false },
  };
}
// The room's current settings (lobby, or the snapshot we got when joining/hosting).
function roomSettingsNow() {
  try { if (PAGE.lobby && PAGE.lobby.settings && PAGE.lobby.settings.songSelection) return PAGE.lobby.settings; } catch (error) {}
  return game.roomSettings || null;
}
// Which leaderboard a run belongs to. "Speedrun · Random/Watched" only when every rule matches.
function speedCategory() {
  const room = roomSettingsNow(), selection = room && room.songSelection && room.songSelection.standardValue;
  const category = selection === 1 ? "Random" : selection === 3 ? "Watched" : "Mixed", why = [];
  if (!Object.keys(SPEEDRUN_TILES).every((key) => SETTINGS[key] === SPEEDRUN_TILES[key])) why.push("bingo settings");
  if (!room) why.push("room settings unknown");
  else {
    const want = speedrunRoom(category === "Random" ? "random" : "watched");
    const same = (key) => JSON.stringify(room[key]) === JSON.stringify(want[key]);
    if (category === "Mixed") why.push("song selection");
    if (!(room.guessTime && !room.guessTime.randomOn && room.guessTime.standardValue === 20) || !(room.extraGuessTime && room.extraGuessTime.standardValue === 0)) why.push("guess time");
    if (!same("songType") || !same("openingCategories") || !same("endingCategories") || !same("insertCategories")) why.push("song types");
    const difficulty = room.songDifficulity; if (!(difficulty && ((difficulty.advancedOn && difficulty.advancedValue[0] === 0 && difficulty.advancedValue[1] === 100) || (!difficulty.advancedOn && Object.values(difficulty.standardValue).every(Boolean))))) why.push("difficulty");
    if (!(room.playbackSpeed && !room.playbackSpeed.randomOn && room.playbackSpeed.standardValue === 1)) why.push("playback speed");
  }
  return { key: why.length ? `Custom · ${category}` : `Speedrun · ${category}`, official: !why.length, why };
}
const speedKey = () => { const board = curBoard(); return (board && board.speed && board.speed.key) || speedCategory().key; };
function speedStart() {
  const board = curBoard(); if (!board || board.speed || !isSolo() || completedLines(board).length) return;
  const category = speedCategory();
  board.speed = { start: Date.now(), seq0: game.seq || 0, key: category.key, why: category.why }; savePlayerData();
  if (!category.official) sysMsg(`AMQ Bingo speedrun: this run counts as "${category.key}" (differs from the speedrun rules: ${category.why.join(", ")}). Use Speedrun: Random or Watched in the host Settings for an official run.`);
}
function speedCheck(board, lines) {
  if (!board.speed || board.speed.end || !lines) return;
  const speed = board.speed; speed.end = Date.now(); speed.songs = (game.seq || 0) - speed.seq0;
  const key = speedKey(), personalBest = (playerData.pb = playerData.pb || {})[key], ms = speed.end - speed.start;
  speed.best = !personalBest || ms < personalBest.ms; if (speed.best) playerData.pb[key] = { ms, songs: speed.songs, at: Date.now() };
  savePlayerData();
  sysMsg(`AMQ Bingo speedrun: bingo in ${fmtTime(ms)} over ${speed.songs} song${speed.songs === 1 ? "" : "s"}` + (speed.best ? (personalBest ? ` — new best! (was ${fmtTime(personalBest.ms)})` : " — first record!") : ` (best ${fmtTime(personalBest.ms)})`));
}
setInterval(() => {
  const element = document.getElementById("amqbSpeed"), board = curBoard();
  if (element && board && board.speed && !board.speed.end) element.firstChild.textContent = `⏱ ${fmtTime(Date.now() - board.speed.start)} · ${(game.seq || 0) - board.speed.seq0} songs`;
}, 1000);

// Version check: "0.34" vs "0.33" etc.
let warnedVersion = false;
function newerVersion(versionA, versionB) { const partsA = String(versionA).split(".").map(Number), partsB = String(versionB).split(".").map(Number); for (let part = 0; part < Math.max(partsA.length, partsB.length); part++) { const diff = (partsA[part] || 0) - (partsB[part] || 0); if (diff) return diff > 0; } return false; }

// Last revealed song number: manual marks count for it (one-tile-per-song limit).
// Songs are keyed by a counter that never resets, since song numbers restart every AMQ game.
const lastSongN = () => game.seq || 0;
// Auto-mark tile i for song n. With "one tile per song", several matches become a pick instead.
function autoMark(board, cellIdx, rec) {
  if (board.marks.includes(cellIdx)) return false;
  const key = rec.seq;
  if (SETTINGS.onePerSong) {
    board.used = board.used || {};
    if (board.pick && board.pick.key === key) { if (!board.pick.opts.includes(cellIdx)) board.pick.opts.push(cellIdx); return false; }
    if (board.used[key] != null) return false;
  }
  board.marks.push(cellIdx); board.auto[cellIdx] = rec.n; if (SETTINGS.onePerSong) board.used[key] = cellIdx;
  return true;
}
let skipHeld = false, releaseSkip = () => {};
// Choose tile i (or null = skip) for the open pick. It can be undone until the next song's answer shows.
function choosePick(board, cellIdx, cells) {
  const pending = board.pick; if (!pending) return;
  if (cellIdx != null) { board.marks.push(cellIdx); board.auto[cellIdx] = pending.n; (board.used = board.used || {})[pending.key] = cellIdx; logAdd({ n: pending.n, hits: [{ text: cells[cellIdx].text, col: cells[cellIdx].col }] }); }
  board.lastPick = { ...pending, chosen: cellIdx }; board.pick = null;
  setTimeout(() => releaseSkip(), 0); // a skip vote held while picking goes out now
}
function undoPick(board) {
  const lastPick = board.lastPick; if (!lastPick || lastPick.key !== lastSongN()) return;
  if (lastPick.chosen != null) { const idx = board.marks.indexOf(lastPick.chosen); if (idx >= 0) board.marks.splice(idx, 1); delete board.auto[lastPick.chosen]; if (board.used) delete board.used[lastPick.key]; }
  board.pick = { n: lastPick.n, key: lastPick.key, opts: lastPick.opts }; board.lastPick = null;
}
function playerOnSong(rec) {
  const board = curBoard(); if (!board) return;
  const cells = cellsNow(), playerId = myId(), ctx = ctxFor(rec);
  const myResult = playerId != null ? rec.res[playerId] : null;
  // Wild card side rules
  if (myResult && board.wild === "Free? Tile" && !board.lost) {
    const missed = game.hist.filter((rec) => isOnMyList(rec.res[playerId]) && !rec.res[playerId].correct).length;
    if (missed > 2) { board.wildOn = false; board.lost = true; sysMsg("AMQ Bingo: you missed 3 songs from your list, so Free? Tile is gone."); }
  }
  if (myResult && board.wild === "Freer? Tile" && !board.lost && !myResult.correct && playerIdsIn(rec).length >= 2 && correctCount(rec) === playerIdsIn(rec).length - 1) {
    board.wildOn = false; board.lost = true; sysMsg("AMQ Bingo: everyone else got that one, so Freer? Tile is gone.");
  }
  game.lastCorrect = !!(myResult && myResult.correct);
  if (board.pick && board.pick.key !== rec.seq) { board.pick = null; skipHeld = false; } // an unanswered pick expires at the next reveal
  if (board.lastPick && board.lastPick.key !== rec.seq) board.lastPick = null; // and so does its undo
  if (!SETTINGS.auto) { savePlayerData(); renderPlayer(); return; }
  if (SETTINGS.needCorrect && !(myResult && myResult.correct)) { board.ask = {}; savePlayerData(); renderPlayer(); return; }
  if (board.wild === "Skilled" && !(myResult && myResult.correct)) { savePlayerData(); renderPlayer(); return; }
  if (board.wild === "Speed = Experience" && myResult) {
    const lvl = (game.players[playerId] || {}).level || 0, limit = lvl < 10 ? 15 : lvl < 25 ? 12 : 10;
    if (myResult.answerTimeing == null || myResult.answerTimeing > limit) { savePlayerData(); renderPlayer(); return; }
  }
  const before = completedLines(board).length, hits = [], found = [];
  cells.forEach((cell, cellIdx) => { if (!cell.wild && !board.marks.includes(cellIdx) && AUTO_TILES.has(cell.text) && testTile(cell.text, ctx, playerId)) found.push(cellIdx); });
  if (SETTINGS.onePerSong && found.length > 1 && !(board.used && board.used[rec.seq] != null)) {
    board.pick = { n: rec.n, key: rec.seq, opts: found };
    logAdd({ n: rec.n, note: `Matched ${found.length} tiles. Pick one under the board.` });
  } else found.forEach((cellIdx) => { if (autoMark(board, cellIdx, rec)) hits.push({ text: cells[cellIdx].text, col: cells[cellIdx].col }); });
  if (hits.length) logAdd({ n: rec.n, hits });
  board.ask = {};
  cells.forEach((cell, cellIdx) => { if (!cell.wild && ASK_TILES[cell.text] && !board.marks.includes(cellIdx)) { try { if (ASK_TILES[cell.text].global(ctx)) { board.ask[cellIdx] = rec.n; logAdd({ n: rec.n, note: `"${cell.text}" might count. Click it if it does.` }); } } catch (error) {} } });
  const artistCellIdx = cells.findIndex((cell) => cell.text === ARTIST_TILE);
  if (artistCellIdx >= 0 && !board.marks.includes(artistCellIdx) && playerId != null && SETTINGS.auto) artistMatches(rec).then((who) => {
    if (!who.includes(playerId) || board.marks.includes(artistCellIdx)) return;
    const was = completedLines(board).length; if (!autoMark(board, artistCellIdx, rec)) { savePlayerData(); renderPlayer(); return; } logAdd({ n: rec.n, hits: [{ text: ARTIST_TILE, col: 2 }] });
    savePlayerData(); renderPlayer(); if (completedLines(board).length > was) { flashUntil = Date.now() + 6000; celebrate(); } queueSync(true);
  });
  cells.forEach((cell, cellIdx) => {
    if (cell.wild || !ASYNC_TILES[cell.text] || board.marks.includes(cellIdx)) return;
    ASYNC_TILES[cell.text](rec).then((yes) => {
      if (!yes || board.marks.includes(cellIdx) || curBoard() !== board || (SETTINGS.needCorrect && !(myResult && myResult.correct))) return;
      const was = completedLines(board).length; if (!autoMark(board, cellIdx, rec)) { savePlayerData(); renderPlayer(); return; } logAdd({ n: rec.n, hits: [{ text: cell.text, col: cell.col }] });
      savePlayerData(); renderPlayer(); if (completedLines(board).length > was) { flashUntil = Date.now() + 6000; celebrate(); } queueSync(true);
    });
  });
  savePlayerData();
  const after = completedLines(board).length;
  if (after > before) flashUntil = Date.now() + 6000;
  renderPlayer();
  if (after > before) celebrate();
  queueSync(after > before);
}

function celebrate() {
  const boardPanel = playerUI && playerUI.panel; if (!boardPanel || boardPanel.style.display === "none") return;
  boardPanel.querySelectorAll(".amqb-cell.line").forEach((cell) => cell.classList.add("pulse"));
  confetti(boardPanel);
}

let syncTimer = null, lastSent = "";
function queueSync(now) {
  clearTimeout(syncTimer);
  syncTimer = setTimeout(sendSync, now ? 50 : 2500);
}
function sendSync() {
  const board = curBoard(); if (!board || !playerData.host) return;
  const claim = currentClaim(board);
  const msg = `${PREFIX} S ${playerData.round} ${playerData.code} ${claim} ${playerData.packId || "STD"}`;
  if (msg === lastSent) return;
  lastSent = msg;
  if (playerData.host.toLowerCase() === myName().toLowerCase()) hostReceive(myName(), msg); else sendDM(playerData.host, msg);
}

function renderPlayer() {
  if (!playerUI) return;
  const { body, sub } = playerUI; body.innerHTML = "";
  const board = curBoard();
  if (!myName()) { body.append(makeEl("p", { class: "amqb-muted" }, "Log in to AMQ to get a board.")); return; }
  if (!board) {
    sub.textContent = "";
    const code = makeEl("input", { class: "amqb-in", maxlength: 4, placeholder: "CODE", style: "width:90px;text-transform:uppercase;letter-spacing:3px" });
    const hostIn = makeEl("input", { class: "amqb-in", maxlength: 24, placeholder: "Host's AMQ name", value: playerData.host || "" });
    const err = makeEl("p", { class: "amqb-muted" }, "");
    const submit = () => {
      const codeText = code.value.trim().toUpperCase(), round = [1, 2, 3, 4, 5].find((candidate) => codeValid(codeText, candidate));
      if (!round) { err.textContent = "That code doesn't match any round. Check the code the host announced."; return; }
      joinRound(round, codeText, hostIn.value.trim());
    };
    body.append(
      makeEl("p", {}, "When the host announces a round in chat, your board appears here automatically. You can also type the round code."),
      makeEl("div", { class: "amqb-row" }, code, hostIn, makeEl("button", { class: "amqb-btn pri", onclick: submit }, "Get my board")), err,
      makeEl("p", { class: "amqb-muted" }, `Your board is made from your AMQ name (${myName()}), the same as on the website.`));
    return;
  }
  sub.textContent = `Round ${playerData.round} · ${playerData.code}${board.variant ? " · replacement" : ""}`;
  const cells = cellsNow(), lines = completedLines(board), inLine = new Set(lines.flat());
  speedCheck(board, lines.length);
  if (Date.now() < flashUntil) body.append(makeEl("div", { class: "amqb-bingo" }, "🎉 BINGO! 🎉"));
  const grid = makeEl("div", { class: "amqb-grid" }, COLS.map((col, colIdx) => makeEl("div", { class: "amqb-ch", style: colIdx === 4 && SETTINGS.soloMix ? "background:linear-gradient(90deg,#4f8cff,#3fbf7f,#ff9f43,#b37bff)" : `--cat:${COLUMN_COLORS[colIdx]}` }, colIdx === 4 && SETTINGS.soloMix ? "Mix" : col.name)));
  cells.forEach((cell, cellIdx) => {
    if (cell.wild) {
      const wildSelect = makeEl("select", { title: "Your wild card" }, makeEl("option", { value: "" }, "Wild card…"), WILD.map((wild) => makeEl("option", { value: wild.name, selected: board.wild === wild.name }, wild.name)));
      wildSelect.addEventListener("change", () => { board.wild = wildSelect.value; const wild = WILD.find((option) => option.name === wildSelect.value); board.wildOn = !!(wild && wild.auto); board.lost = false; savePlayerData(); renderPlayer(); queueSync(); });
      const toggleBtn = makeEl("button", { class: "amqb-tog" + (board.wildOn ? " on" : ""), disabled: !board.wild || board.lost, onclick: () => { board.wildOn = !board.wildOn; savePlayerData(); renderPlayer(); queueSync(true); } }, board.lost ? "Lost" : board.wildOn ? "Marked" : "Mark");
      const wild = WILD.find((option) => option.name === board.wild);
      grid.append(makeEl("div", { class: "amqb-cell wild" + (board.wildOn ? " on" : "") + (inLine.has(12) ? " line" : ""), style: `--cat:${COLUMN_COLORS[2]}`, title: wild ? wild.desc : "Pick a wild card" }, wildSelect, toggleBtn));
      return;
    }
    const isMarked = board.marks.includes(cellIdx), isAuto = AUTO_TILES.has(cell.text) && SETTINGS.auto, ask = !isMarked && board.ask && board.ask[cellIdx], difficulty = cell.d || (cell.hard ? "H" : "M");
    grid.append(makeEl("button", {
      style: `--cat:${COLUMN_COLORS[cell.col]}`,
      class: "amqb-cell" + (isMarked ? " on" : "") + (isAuto ? " am" : " man") + (ask ? " ask" : "") + (inLine.has(cellIdx) ? " line" : "") + (board.pick && board.pick.opts.includes(cellIdx) ? " pickme" : ""),
      title: (isAuto ? "Marks itself when it happens. " : "You mark this one: click it when it happens. ") + ({ E: "Easy", M: "Medium", H: "Hard" }[difficulty]) + "." + (board.auto[cellIdx] ? ` Auto-marked on song ${board.auto[cellIdx]}.` : ""),
      onclick: () => {
        if (board.ask) delete board.ask[cellIdx];
        const markIdx = board.marks.indexOf(cellIdx), songNo = lastSongN();
        // Host setting: auto tiles can't be marked or unmarked by hand (picking from a multi-match is still allowed).
        if (SETTINGS.lockAuto && isAuto && !(board.pick && board.pick.opts.includes(cellIdx))) { note = "This tile marks itself. The host locked auto tiles, so it can't be changed by hand."; renderPlayer(); return; }
        if (markIdx >= 0) { board.marks.splice(markIdx, 1); delete board.auto[cellIdx]; if (board.used) Object.keys(board.used).forEach((key) => { if (board.used[key] === cellIdx) delete board.used[key]; }); }
        else {
          if (board.pick && board.pick.opts.includes(cellIdx)) choosePick(board, cellIdx, cells);
          else {
            if (SETTINGS.needCorrect && game.hist.length && !game.lastCorrect) { note = "You can only mark tiles on songs you got right."; renderPlayer(); return; }
            let swapped = "";
            if (SETTINGS.onePerSong && game.hist.length) {
              // Choosing a click tile instead of the open pick closes the pick.
              if (board.pick && board.pick.key === songNo) choosePick(board, null, cells);
              // One tile per song: swap out this song's tile, even an auto tile when auto tiles are locked.
              const prev = board.used && board.used[songNo];
              if (prev != null && prev !== cellIdx) { const otherIdx = board.marks.indexOf(prev); if (otherIdx >= 0) board.marks.splice(otherIdx, 1); delete board.auto[prev]; swapped = cells[prev].text; board.lastPick = null; }
            }
            board.marks.push(cellIdx); if (SETTINGS.onePerSong && game.hist.length) (board.used = board.used || {})[songNo] = cellIdx;
            if (swapped) { const last = game.hist[game.hist.length - 1]; note = ""; logAdd({ n: last ? last.n : 0, note: `Swapped "${swapped}" for "${cell.text}".` }); }
          }
        }
        note = ""; const lineCount = completedLines(board).length; savePlayerData(); if (lineCount > lines.length) flashUntil = Date.now() + 6000; renderPlayer(); if (lineCount > lines.length) celebrate(); queueSync(lineCount > lines.length);
      },
    }, cell.text, makeEl("span", { class: "dif d" + difficulty }, difficulty),
      ask ? makeEl("span", { class: "askq" }, ASK_TILES[cell.text].question) : null,
      ask ? makeEl("span", { class: "askx", title: "Not this time", onclick: (event) => { event.stopPropagation(); delete board.ask[cellIdx]; savePlayerData(); renderPlayer(); } }, "×") : null,
      makeEl("span", { class: "tag" }, isMarked && board.auto[cellIdx] ? `auto #${board.auto[cellIdx]}` : isAuto ? "auto" : ASK_TILES[cell.text] ? "asks" : "✋ you")));
  });
  const pickBox = board.pick ? makeEl("div", { class: "amqb-pick" }, makeEl("b", {}, `Song ${board.pick.n} matched ${board.pick.opts.length} tiles. Pick one (or click a highlighted tile):`),
    skipHeld ? makeEl("div", { class: "amqb-muted" }, "Your skip vote is on hold until you pick.") : "",
    makeEl("div", { class: "amqb-row" }, board.pick.opts.map((cellIdx) => makeEl("button", { class: "amqb-btn", style: `border-color:${COLUMN_COLORS[cells[cellIdx].col]}`, onclick: () => {
      const was = completedLines(board).length; choosePick(board, cellIdx, cells);
      savePlayerData(); const lineCount = completedLines(board).length; if (lineCount > was) flashUntil = Date.now() + 6000; renderPlayer(); if (lineCount > was) celebrate(); queueSync(lineCount > was);
    } }, cells[cellIdx].text)), makeEl("button", { class: "amqb-btn", onclick: () => { choosePick(board, null, cells); savePlayerData(); renderPlayer(); } }, "Skip")))
    : board.lastPick && board.lastPick.key === lastSongN() ? makeEl("div", { class: "amqb-row amqb-undo" },
      makeEl("span", { class: "amqb-muted" }, board.lastPick.chosen != null ? `Picked "${cells[board.lastPick.chosen].text}" for song ${board.lastPick.n}.` : `Skipped song ${board.lastPick.n}.`),
      makeEl("button", { class: "amqb-btn", title: "Available until the next song's answer shows", onclick: () => { undoPick(board); savePlayerData(); renderPlayer(); queueSync(); } }, "Undo")) : null;
  const claim = currentClaim(board);
  const left = COOLDOWN_MS - (Date.now() - board.firstAt);
  const rulesLine = [SETTINGS.soloMix ? "solo: the 5th column mixes the other four" : "", SETTINGS.lockAuto ? "auto tiles are locked" : "", SETTINGS.wild === false ? "no wild card" : "", SETTINGS.needCorrect ? "only on songs you get right" : "", SETTINGS.onePerSong ? "one tile per song" : ""].filter(Boolean).join(" · ");
  // Song log right under the board, fixed height, newest first: marks as chips, notices as short yellow text.
  const logRow = (entry) => makeEl("div", { class: "amqb-logrow" }, makeEl("span", { class: "amqb-logn" }, `#${entry.n}`),
    (entry.hits || []).map((hit) => makeEl("span", { class: "amqb-chip", style: `--cat:${COLUMN_COLORS[hit.col]}`, title: hit.text }, hit.text)),
    entry.note ? makeEl("span", { class: "amqb-lognote", title: entry.note }, entry.note) : "");
  const logEl = makeEl("div", { class: "amqb-songlog" }, autoLog.length ? autoLog.slice(0, 10).map(logRow) : makeEl("span", { class: "amqb-muted" }, "Tiles marked after each song show here."));
  const pbNow = playerData.pb && playerData.pb[speedKey()];
  const speedEl = board.speed ? makeEl("div", { id: "amqbSpeed", class: "amqb-speed" + (board.speed.end ? " done" : "") },
    board.speed.end ? `🏁 Bingo in ${fmtTime(board.speed.end - board.speed.start)} · ${board.speed.songs} songs` + (board.speed.best ? " · new best!" : "") : `⏱ ${fmtTime(Date.now() - board.speed.start)} · ${(game.seq || 0) - board.speed.seq0} songs`,
    makeEl("span", { class: "amqb-muted", title: board.speed.why && board.speed.why.length ? "Not official: " + board.speed.why.join(", ") : "Official speedrun rules" }, ` ${speedKey()}` + (pbNow ? ` · best ${fmtTime(pbNow.ms)}, ${pbNow.songs} songs` : " · first bingo stops the clock"))) : "";
  body.append(speedEl, grid, logEl, pickBox || "", note ? makeEl("div", { class: "amqb-err" }, note) : "", rulesLine ? makeEl("div", { class: "amqb-muted" }, "This round: " + rulesLine + ".") : "",
    makeEl("div", { class: "amqb-row", style: "justify-content:space-between" },
      makeEl("div", { class: "amqb-stats" }, makeEl("span", {}, makeEl("b", {}, lines.length), " bingos"), makeEl("span", {}, makeEl("b", {}, board.marks.length + (board.wildOn ? 1 : 0)), " tiles")),
      makeEl("span", { class: "amqb-muted", title: "Your claim code, in case the host uses the website" }, "Claim ", makeEl("b", { style: "letter-spacing:1px;color:#ecebf5" }, claim))),
    makeEl("div", { class: "amqb-row" },
      makeEl("button", { class: "amqb-btn" + (lines.length ? " pri" : ""), disabled: !lines.length || (board.called || 0) >= lines.length, title: (board.called || 0) >= lines.length && lines.length ? "Already called. Get another line to call again." : "", onclick: () => {
        if ((board.called || 0) >= lines.length) return;
        board.called = lines.length; savePlayerData();
        if (hostData.active && playerData.host && norm(playerData.host) === norm(myName())) { const hostPlayer = hostData.players[norm(myName())]; if (hostPlayer) (hostPlayer.chatCalled = hostPlayer.chatCalled || {})[playerData.round] = lines.length; }
        sendSync();
        if (playerData.host && norm(playerData.host) !== norm(myName())) sendDM(playerData.host, `${PREFIX} B ${playerData.round} ${playerData.code} ${claim}`);
        sendGameChat(`BINGO! ${myName()} has ${lines.length} line${lines.length === 1 ? "" : "s"} in AMQ Bingo round ${playerData.round} · claim ${claim} 🎉`);
        renderPlayer();
      } }, (board.called || 0) >= lines.length && lines.length ? "Called ✓" : "🎉 BINGO!"),
      !SETTINGS.replace ? null : makeEl("button", { class: "amqb-btn", disabled: board.variant === 1 || left > 0, title: "One replacement per round, 3 minutes after you get your board", onclick: () => {
        const key = boardKey(); playerData.boards[key] = { variant: 1, firstAt: board.firstAt, marks: [], auto: {}, wild: board.wild, wildOn: false, lost: false }; savePlayerData(); renderPlayer(); queueSync(true);
      } }, board.variant === 1 ? "Replacement used" : left > 0 ? `New board in ${Math.ceil(left / 60000)} min` : "Replace board"),
      makeEl("button", { class: "amqb-btn", onclick: () => { playerData.code = ""; playerData.bcode = ""; playerData.round = 0; savePlayerData(); renderPlayer(); } }, "Change round")),
    makeEl("p", { class: "amqb-muted" }, playerData.host ? `Syncing with host ${playerData.host}.` : "No host set. Your board isn't being sent anywhere."),
    makeEl("div", { class: "amqb-legend" }, makeEl("span", {}, "Plain: marks itself"), makeEl("span", { class: "lg-man" }, "Striped ✋: you mark it"), makeEl("span", {}, makeEl("i", { class: "dif dE" }, "E"), makeEl("i", { class: "dif dM" }, "M"), makeEl("i", { class: "dif dH" }, "H"), " easy / medium / hard")));
}

/* =====================================================================
 * HOST PANEL
 * ===================================================================== */
// Rounds 1-3 use the website's codes; rounds 4-5 continue the same pattern (script only).
function codesFor(key) {
  const out = codesFromKey(key);
  for (const round of [4, 5]) { const rand = rng("event|" + key + "|" + round); let letters = ""; for (let charNo = 0; charNo < 3; charNo++) letters += ALPHA[Math.floor(rand() * ALPHA.length)]; out[round] = letters + checkLetter(letters, round); }
  return out;
}
const DEFAULT_GAME = { rounds: 3, endMode: "amq", autoNext: true, autoLobby: true, announceBingo: true, askEnd: true, nextBoard: "new" };
// Which code a round's boards are built from: its own, or round 1's when boards carry over between rounds.
const boardCodeFor = (round) => (hostData.game.nextBoard && hostData.game.nextBoard !== "new" ? hostData.codes[1] : hostData.codes[round]);
const freshHost = (key = randomKey()) => ({ key, round: 1, codes: codesFor(key), active: false, tab: "game", game: { ...DEFAULT_GAME }, ended: {}, checks: {}, personal: {}, players: {}, wildHost: {} });
let hostData = store.get("host", null) || freshHost();
hostData.game = { ...DEFAULT_GAME, ...(hostData.game || {}) }; if (hostData.settings) hostData.settings = { ...DEFAULT_SETTINGS, ...hostData.settings }; hostData.codes = codesFor(hostData.key); hostData.tab = hostData.tab || "game"; hostData.ended = hostData.ended || {};
function ensureRound(round) { hostData.checks[round] = hostData.checks[round] || {}; hostData.personal[round] = hostData.personal[round] || {}; }
[1, 2, 3, 4, 5].forEach(ensureRound);
const saveHostData = () => store.set("host", hostData);
let hostUI, viewName = "", bingoAlerts = [];

function hostOnSong(rec) {
  if (!hostData.active || hostData.ended[hostData.round]) return;
  const round = hostData.round, ctx = ctxFor(rec);
  hostData.asks = hostData.asks || {}; hostData.asks[round] = {};
  Object.keys(ASK_TILES).forEach((text) => { try { if (!(text in hostData.checks[round]) && ASK_TILES[text].global(ctx)) hostData.asks[round][text] = rec.n; } catch (error) {} });
  artistMatches(rec).then((who) => { who.forEach((playerId) => { const player = game.players[playerId]; if (!player) return; const key = norm(player.name), bag = (hostData.personal[round][key] = hostData.personal[round][key] || {}); if (!(ARTIST_TILE in bag)) bag[ARTIST_TILE] = rec.n; }); if (who.length) { saveHostData(); checkBingoEnd(); renderHost(); } });
  Object.keys(ASYNC_TILES).forEach((text) => {
    if ((text in hostData.checks[round] && !SETTINGS.needCorrect) || !COLS.some((col) => col.pool.some((tile) => tile.text === text))) return;
    ASYNC_TILES[text](rec).then((yes) => {
      if (!yes || hostData.round !== round) return;
      if (!(text in hostData.checks[round])) hostData.checks[round][text] = rec.n;
      if (SETTINGS.needCorrect) playerIdsIn(rec).forEach((playerId) => { const player = game.players[playerId]; if (!player || !rec.res[playerId].correct) return; const bag = (hostData.personal[round][norm(player.name)] = hostData.personal[round][norm(player.name)] || {}); if (!(text in bag)) bag[text] = rec.n; });
      saveHostData(); checkBingoEnd(); renderHost();
    });
  });
  COLS.forEach((col) => col.pool.forEach((tile) => {
    const rule = RULES[tile.text]; if (!rule) return;
    const need = SETTINGS.needCorrect;
    if (rule.global) {
      const hit = testTile(tile.text, ctx);
      if (hit && !(tile.text in hostData.checks[round])) hostData.checks[round][tile.text] = rec.n;
      // "Only on songs you got right": the tile counts only for players who got this song.
      if (hit && need) playerIdsIn(rec).forEach((playerId) => { const player = game.players[playerId]; if (!player || !rec.res[playerId].correct) return; const bag = (hostData.personal[round][norm(player.name)] = hostData.personal[round][norm(player.name)] || {}); if (!(tile.text in bag)) bag[tile.text] = rec.n; });
    }
    else playerIdsIn(rec).forEach((playerId) => {
      const player = game.players[playerId]; if (!player || (need && !rec.res[playerId].correct)) return;
      const key = norm(player.name), bag = (hostData.personal[round][key] = hostData.personal[round][key] || {});
      if (!(tile.text in bag) && testTile(tile.text, ctx, playerId)) bag[tile.text] = rec.n;
    });
  }));
  saveHostData(); checkBingoEnd(); renderHost();
}

function hostReceive(sender, message) {
  if (!hostData.active) return;
  const parts = message.slice(PREFIX.length).trim().split(/\s+/);
  const [kind, roundText, code, claim, pid] = parts, round = Number(roundText);
  if (kind === "NEED") { if (roundText === (hostData.packId || "")) sendPack(sender); return; }
  if (!(kind === "S" || kind === "B") || hostData.codes[round] !== code) return;
  if ((pid || "STD") !== (hostData.packId || "STD")) return; // board made with different tiles
  const key = norm(sender), hostPlayer = (hostData.players[key] = hostData.players[key] || { name: sender, claims: {} });
  hostPlayer.claims[round] = claim;
  if (kind === "B") { bingoAlerts.unshift(`${sender} called BINGO (round ${round})`); sysMsg(`AMQ Bingo: ${sender} called BINGO! Check their board in the host panel.`); }
  saveHostData(); checkBingoEnd(); renderHost();
}

function hostTakeBingo(sender, round, claim) {
  if (!hostData.active || hostData.codes[round] == null || !readClaim(sender, boardCodeFor(round), claim)) return;
  const key = norm(sender), hostPlayer = (hostData.players[key] = hostData.players[key] || { name: sender, claims: {} });
  hostPlayer.claims[round] = claim;
  const score = scorePlayer(hostPlayer, round); (hostPlayer.chatCalled = hostPlayer.chatCalled || {})[round] = score ? score.lines.length : 0; // they announced it themselves
  if (norm(sender) !== norm(myName())) { bingoAlerts.unshift(`${sender} called BINGO (round ${round})`); sysMsg(`AMQ Bingo: ${sender} called BINGO! Check their board in the host panel.`); }
  saveHostData(); checkBingoEnd(); renderHost();
}
const CLAIM_RE = /\b([0-9A-HJKMNP-TV-Z]{4})[- ]?([0-9A-HJKMNP-TV-Z]{4})\b/i;
function hostTakeClaim(sender, text) {
  if (!hostData.active || hostData.packId || !sender) return false; // website boards only exist with standard tiles
  const match = (text || "").toUpperCase().replace(/O/g, "0").match(CLAIM_RE); if (!match) return false;
  const claim = match[1] + "-" + match[2];
  const round = [hostData.round, 1, 2, 3].find((candidate) => readClaim(sender, boardCodeFor(candidate), claim)); if (!round) return false;
  const key = norm(sender), hostPlayer = (hostData.players[key] = hostData.players[key] || { name: sender, claims: {} });
  const before = scorePlayer(hostPlayer, round); hostPlayer.claims[round] = claim; hostPlayer.web = true;
  const after = scorePlayer(hostPlayer, round);
  if (after && after.lines.length > (before ? before.lines.length : 0)) { bingoAlerts.unshift(`${sender} has ${after.lines.length} line${after.lines.length === 1 ? "" : "s"} (website, round ${round})`); sysMsg(`AMQ Bingo: ${sender} (website) has a bingo. Check their board in the host panel.`); }
  saveHostData(); checkBingoEnd(); renderHost(); return true;
}

function sendPack(target) {
  const enc = encodeURIComponent(hostData.packBody || ""), size = 180, chunkCount = Math.max(1, Math.ceil(enc.length / size));
  for (let chunkNo = 0; chunkNo < chunkCount; chunkNo++) setTimeout(() => sendDM(target, `${PREFIX} P ${hostData.packId} ${chunkNo + 1}/${chunkCount} ${enc.slice(chunkNo * size, (chunkNo + 1) * size)}`), chunkNo * 450);
}
function hostSavePack(custom, settings) {
  const pack = packOf(custom, settings);
  const err = applyPack(pack.id ? pack.body : "");
  if (err) return err;
  hostData.custom = custom; hostData.settings = settings; hostData.packId = pack.id; hostData.packBody = pack.id ? pack.body : "";
  playerData.packId = hostData.packId; playerData.packBody = hostData.packBody; savePlayerData();
  saveHostData(); return "";
}

function scorePlayer(hostPlayer, round) {
  const claim = hostPlayer.claims && hostPlayer.claims[round]; if (!claim) return null;
  const code = boardCodeFor(round), claimData = readClaim(hostPlayer.name, code, claim); if (!claimData) return null;
  const cells = makeBoard(hostPlayer.name, code, claimData.variant), key = norm(hostPlayer.name);
  const wildOn = !!(hostData.wildHost[key] && hostData.wildHost[key][round]);
  const mine = (text) => !!(hostData.personal[round][key] && text in hostData.personal[round][key]);
  const isConfirmed = (cellIdx) => { if (cells[cellIdx].wild) return wildOn; const text = cells[cellIdx].text; if (SETTINGS.needCorrect && RULES[text] && RULES[text].global) return mine(text); return (text in hostData.checks[round]) || mine(text); };
  const lines = LINES.map((line, idx) => ({ line, idx })).filter((entry) => entry.line.every((cellIdx) => claimData.marks.has(cellIdx)));
  return { claimData, cells, isConfirmed, lines, confirmed: lines.filter((entry) => entry.line.every(isConfirmed)).length };
}

let miniBar = null, lastAlertSeen = 0;
function renderMini() {
  if (!hostUI) return;
  markHostButton();
  if (!miniBar) {
    miniBar = makeEl("div", { class: "amqb-mini", title: "Open the host panel (Alt+H)", onclick: () => { hostUI.panel.style.display = "block"; lastAlertSeen = bingoAlerts.length; renderHost(); } });
    document.body.appendChild(miniBar);
  }
  const hidden = hostUI.panel.style.display === "none";
  miniBar.style.display = hidden && hostData.active ? "flex" : "none";
  if (miniBar.style.display === "none") return;
  const round = hostData.round, list = Object.values(hostData.players);
  const bingos = list.reduce((total, player) => { const score = scorePlayer(player, round); return total + (score ? score.lines.length : 0); }, 0);
  const fresh = bingoAlerts.length - lastAlertSeen;
  miniBar.innerHTML = "";
  miniBar.append(makeEl("span", {}, "Bingo host"), makeEl("span", {}, `Round ${round}`), makeEl("b", {}, hostData.codes[round]),
    makeEl("span", {}, `${list.length} player${list.length === 1 ? "" : "s"}`), makeEl("span", {}, `${bingos} bingo${bingos === 1 ? "" : "s"}`),
    fresh > 0 ? makeEl("span", { class: "alert" }, `${bingoAlerts[0]}`) : "");
}

// Players in the room right now (lobby or game), used to switch the solo Mix column on or off.
function roomSize() {
  try { const lobby = PAGE.lobby; if (lobby && lobby.inLobby && lobby.players) return Object.keys(lobby.players).length; } catch (error) {}
  try { const quiz = PAGE.quiz; if (quiz && quiz.inQuiz && quiz.players) return Object.values(quiz.players).filter((player) => !player.isSpectator).length || Object.keys(quiz.players).length; } catch (error) {}
  return Object.keys(game.players).length;
}
function announceRound(round) {
  { // solo room: the Multiplayer column becomes a Mix of the other four
    const st0 = hostData.settings || DEFAULT_SETTINGS, solo = roomSize() === 1;
    if (!!st0.soloMix !== solo) { const error = hostSavePack(hostData.custom || { mode: "add", text: "" }, { ...DEFAULT_SETTINGS, ...st0, soloMix: solo }); if (error) sysMsg("AMQ Bingo: " + error); else renderPlayer(); }
  }
  hostData.active = true; hostData.round = round; hostData.announced = round; delete hostData.ended[round]; ensureRound(round); saveHostData();
  const label = hostData.game.rounds > 1 ? `round ${round}` : "round 1";
  const settings = hostData.settings || DEFAULT_SETTINGS, plain = !((hostData.custom || {}).text || "").trim();
  const nextBoard = hostData.game.nextBoard || "new";
  // Marks carry over: so do the host's checks from the round before.
  if (nextBoard === "keep" && round > 1) { const prevRound = round - 1; ensureRound(prevRound); hostData.checks[round] = { ...hostData.checks[prevRound], ...hostData.checks[round] }; Object.entries(hostData.personal[prevRound]).forEach(([key, bag]) => { hostData.personal[round][key] = { ...bag, ...(hostData.personal[round][key] || {}) }; }); Object.values(hostData.players).forEach((player) => { if (player.claims && player.claims[prevRound] && !player.claims[round]) player.claims[round] = player.claims[prevRound]; if (player.chatCalled && player.chatCalled[prevRound]) player.chatCalled[round] = player.chatCalled[prevRound]; }); hostData.seen = hostData.seen || {}; hostData.seen[round] = { ...(hostData.seen[prevRound] || {}), ...(hostData.seen[round] || {}) }; saveHostData(); }
  sendGameChat(`AMQ Bingo ${label} · code ${hostData.codes[round]} · host ${myName()}` + (hostData.packId ? ` · tiles ${hostData.packId} (${SET_NAMES[settings.set || "S"]})` + (plain ? ` · rules ${encodeRules(settings)}` : "") : "") + (nextBoard !== "new" && round > 1 ? ` · board ${hostData.codes[1]}${nextBoard === "keep" ? "+" : ""}` : "") + ` · v${SCRIPT_VERSION}`);
  renderHost();
}

// A round ends when the AMQ game ends (endMode "amq") or when someone has a confirmed bingo (endMode "bingo").
function endRound(reason) {
  const round = hostData.round; if (!hostData.active || hostData.ended[round]) return;
  hostData.ended[round] = true; endPrompt = null; showEndPrompt();
  const called = Object.values(hostData.players).map((player) => ({ player, score: scorePlayer(player, round) })).filter((entry) => entry.score && entry.score.lines.length > 0)
    .sort((entryA, entryB) => entryB.sc.confirmed - entryA.sc.confirmed || entryB.sc.lines.length - entryA.sc.lines.length);
  const label = hostData.game.rounds > 1 ? `Round ${round}` : "The round";
  const say = (entry) => `${entry.player.name} ${entry.score.confirmed}` + (entry.score.lines.length > entry.score.confirmed ? ` (+${entry.score.lines.length - entry.score.confirmed} to check)` : "");
  sendGameChat(`AMQ Bingo: ${label} is over (${reason}). ` + (called.length ? `Bingos: ${called.map(say).join(", ")}.` : "No bingos."));
  if (called.some((entry) => entry.score.lines.length > entry.score.confirmed)) sysMsg("AMQ Bingo: some lines have tiles tracking couldn't confirm (click tiles, wild cards). Check them in the Players tab.");
  // Ended early (button or bingo) while a song quiz is running: send the room back to the lobby.
  if (hostData.game.autoLobby && game.inQuiz && !/AMQ game ended/.test(reason)) returnToLobby();
  if (hostData.game.autoNext && round < hostData.game.rounds) { setTimeout(() => announceRound(round + 1), 1500); }
  else if (round >= hostData.game.rounds) { hostData.active = false; sysMsg("AMQ Bingo: that was the last round. Tracking is off."); }
  saveHostData(); renderHost();
}
// Start the AMQ game from the lobby (same command as AMQ's Start button; you must be the room host).
function startAmqGame() {
  try { PAGE.socket.sendCommand({ type: "lobby", command: "start game" }); } catch (error) { sysMsg("AMQ Bingo: couldn't start the game."); }
}
function applySpeedrun(cat) {
  // bingo side
  const error = hostSavePack({ mode: "add", text: "" }, { ...DEFAULT_SETTINGS, ...SPEEDRUN_TILES });
  if (error) { sysMsg("AMQ Bingo: " + error); return; }
  hostData.custom = { mode: "add", text: "" }; hostData.game = { ...hostData.game, ...SPEEDRUN_GAME }; hostData.round = 1; saveHostData();
  // room side: only send what differs
  const want = speedrunRoom(cat), cur = roomSettingsNow() || {}, changes = {};
  Object.keys(want).forEach((key) => { if (JSON.stringify(cur[key]) !== JSON.stringify(want[key])) changes[key] = want[key]; });
  if (Object.keys(changes).length) { try { PAGE.socket.sendCommand({ type: "lobby", command: "change game settings", data: { settingChanges: changes, communityMode: false } }); } catch (err) {} }
  setTimeout(() => {
    const category = speedCategory();
    sysMsg(category.official ? `AMQ Bingo: speedrun (${cat === "random" ? "Random" : "Watched"}) is set. Press Announce & start game.`
      : `AMQ Bingo: bingo settings are set, but the room still differs (${category.why.join(", ")}). Set it in AMQ's room settings: ${cat === "random" ? "Random" : "Only watched"} songs, 20s guess time, all song types and categories, full difficulty range, normal speed.`);
    renderHost(); renderPlayer();
  }, 1500);
  renderHost(); renderPlayer();
}
function returnToLobby() {
  try {
    PAGE.socket.sendCommand({ type: "quiz", command: "start return lobby vote" });
    setTimeout(() => { try { PAGE.socket.sendCommand({ type: "quiz", command: "return lobby vote", data: { accept: true } }); } catch (error) {} }, 300);
  } catch (error) { console.warn("[AMQ Bingo] couldn't return to lobby", error); }
}
// Any new line on anyone's board: say it in chat (unless they already did) and ask the host whether to end the round.
let endPrompt = null;
function noticeBingos() {
  const round = hostData.round; if (!hostData.active || hostData.ended[round]) return;
  hostData.seen = hostData.seen || {}; const seen = (hostData.seen[round] = hostData.seen[round] || {});
  Object.entries(hostData.players).forEach(([key, player]) => {
    const score = scorePlayer(player, round); if (!score) return;
    const lineCount = score.lines.length, before = seen[key] || 0;
    if (lineCount > before) {
      const said = player.chatCalled && player.chatCalled[round] >= lineCount;
      if (hostData.game.announceBingo !== false && !said) sendGameChat(`🎉 AMQ Bingo: ${player.name} has ${lineCount} line${lineCount === 1 ? "" : "s"}` + (score.confirmed ? ` (${score.confirmed} confirmed)!` : " (host is checking)!"));
      askToEnd(player.name);
    }
    seen[key] = Math.max(before, lineCount);
  });
}
function askToEnd(name) {
  const round = hostData.round;
  if (hostData.game.askEnd === false || hostData.game.endMode === "bingo" || !hostData.active || hostData.ended[round]) return;
  endPrompt = { r: round, who: [...new Set([...(endPrompt && endPrompt.r === round ? endPrompt.who : []), name])] }; showEndPrompt();
}
function showEndPrompt() {
  let box = document.getElementById("amqbEndPrompt"); if (box) box.remove();
  if (!endPrompt || !hostData.active || hostData.ended[endPrompt.r] || hostData.round !== endPrompt.r) { endPrompt = null; return; }
  const round = endPrompt.r, list = endPrompt.who.map((name) => { const player = hostData.players[norm(name)], score = player && scorePlayer(player, round); return `${name}${score && score.lines.length ? ` (${score.confirmed}/${score.lines.length} confirmed)` : " (board not received yet)"}`; }).join(", ");
  box = makeEl("div", { id: "amqbEndPrompt", class: "amqb-endprompt" },
    makeEl("b", {}, "🎉 BINGO: "), makeEl("span", {}, list),
    makeEl("div", { class: "amqb-row", style: "margin-top:6px;justify-content:center" },
      makeEl("button", { class: "amqb-btn pri", onclick: () => { endPrompt = null; showEndPrompt(); endRound("someone got a bingo"); } }, (hostData.game.rounds > 1 ? `End round ${round}` : "End the round") + (hostData.game.autoLobby !== false && game.inQuiz ? " + back to lobby" : "")),
      makeEl("button", { class: "amqb-btn", onclick: () => { hostUI.panel.style.display = "block"; hostData.tab = "players"; saveHostData(); renderHost(); } }, "Check boards"),
      makeEl("button", { class: "amqb-btn", onclick: () => { endPrompt = null; showEndPrompt(); } }, "Keep playing")));
  document.body.appendChild(box);
}
function checkBingoEnd() {
  noticeBingos();
  if (!hostData.active || hostData.game.endMode !== "bingo" || hostData.ended[hostData.round]) return;
  if (Object.values(hostData.players).some((player) => { const score = scorePlayer(player, hostData.round); return score && score.confirmed > 0; })) endRound("someone got a bingo");
}

const TABS = [["game", "Game"], ["players", "Players"], ["tiles", "Tiles"], ["settings", "Settings"]];
function renderHost() {
  if (!hostUI) return;
  renderMini();
  const { body, sub } = hostUI; body.innerHTML = "";
  const round = hostData.round; ensureRound(round);
  const code = hostData.codes[round], multi = hostData.game.rounds > 1;
  sub.textContent = hostData.active ? (multi ? `Round ${round} · tracking` : "Tracking") : "Not tracking";
  const nPlayers = Object.keys(hostData.players).length;
  body.append(makeEl("div", { class: "amqb-tabs amqb-row" }, TABS.map(([tabId, name]) =>
    makeEl("button", { class: hostData.tab === tabId ? "sel" : "", onclick: () => { hostData.tab = tabId; saveHostData(); renderHost(); } }, name + (tabId === "players" && nPlayers ? ` (${nPlayers})` : "")))));
  ({ game: tabGame, players: tabPlayers, tiles: tabTiles, settings: tabSettings })[hostData.tab](body, round, code, multi);
}

// New event: new codes, clears players and checks, keeps settings and custom tiles. Asks once before wiping.
let newArmed = 0;
function newEventBtn(tab) {
  const armed = Date.now() - newArmed < 4000;
  return makeEl("button", { class: "amqb-btn" + (armed ? " pri" : ""), title: "New codes. Clears players and checks; keeps your settings and custom tiles.", onclick: () => {
    if (Date.now() - newArmed >= 4000) { newArmed = Date.now(); renderHost(); setTimeout(() => { if (newArmed && Date.now() - newArmed >= 4000) renderHost(); }, 4100); return; }
    newArmed = 0;
    const keep = { game: hostData.game, custom: hostData.custom, settings: hostData.settings, packId: hostData.packId, packBody: hostData.packBody };
    hostData = { ...freshHost(), ...keep, tab }; [1, 2, 3, 4, 5].forEach(ensureRound); saveHostData(); viewName = ""; bingoAlerts = []; renderHost();
    sysMsg("AMQ Bingo: new event ready. Press Announce to post the new code.");
  } }, armed ? "Click again to start over" : "New event");
}
function tabGame(body, round, code, multi) {
  body.append(
    makeEl("div", { class: "amqb-row", style: "justify-content:space-between" },
      multi ? makeEl("div", { class: "amqb-tabs amqb-row" }, Array.from({ length: hostData.game.rounds }, (_, idx) => idx + 1).map((roundNo) =>
        makeEl("button", { class: roundNo === round ? "sel" : "", onclick: () => { hostData.round = roundNo; ensureRound(roundNo); viewName = ""; saveHostData(); renderHost(); } }, (hostData.ended[roundNo] ? "✓ " : "") + "Round " + roundNo))) : makeEl("span", {}),
      makeEl("div", { style: "text-align:right" }, makeEl("div", { class: "amqb-muted" }, multi ? `Round ${round} code` : "Code"), makeEl("div", { class: "amqb-code" }, code))),
    makeEl("div", { class: "amqb-row" },
      makeEl("button", { class: "amqb-btn pri", onclick: () => announceRound(round) }, multi ? `Announce round ${round} in chat` : "Announce in chat"),
      game.inQuiz ? "" : makeEl("button", { class: "amqb-btn pri", title: "Posts the round code, then starts the AMQ game a few seconds later so everyone gets their board first. You need to be the room host.", onclick: () => {
        if (!(hostData.active && !hostData.ended[round] && hostData.announced === round)) announceRound(round);
        sysMsg("AMQ Bingo: starting the game in 3 seconds…"); setTimeout(startAmqGame, 3000);
      } }, "Announce & start game"),
      makeEl("button", { class: "amqb-btn", onclick: () => { hostData.active = !hostData.active; saveHostData(); renderHost(); } }, hostData.active ? "Stop tracking" : "Start tracking"),
      hostData.active && !hostData.ended[round] ? makeEl("button", { class: "amqb-btn", onclick: () => endRound("ended by host") }, "End round now") : null,
      newEventBtn("game")),
    makeEl("p", { class: "amqb-muted" }, "Announcing posts the code in game chat and turns on tracking: after every song, tiles are checked automatically and each player's board syncs here."),
    makeEl("p", { class: "amqb-muted" }, (hostData.game.endMode === "bingo" ? "Rounds end when someone has a confirmed bingo" : "Rounds end when the AMQ game ends") + (multi && hostData.game.autoNext ? ", then the next round is announced automatically." : ".") + " Change this in Settings."));
  if (bingoAlerts.length) body.append(makeEl("div", { class: "amqb-log" }, bingoAlerts.slice(0, 4).map((alert) => makeEl("div", {}, "🎉 " + alert))));
}

function tabPlayers(body, round, code) {
  const list = Object.values(hostData.players).sort((playerA, playerB) => playerA.name.localeCompare(playerB.name));
  const playerList = makeEl("div", { class: "amqb-plist" });
  if (!list.length) playerList.append(makeEl("p", { class: "amqb-muted" }, "No boards yet. Players appear here once their board syncs, or when a website player pastes their claim code in chat."));
  list.forEach((player) => {
    const score = scorePlayer(player, round), key = norm(player.name), won = !!(hostData.wildHost[key] && hostData.wildHost[key][round]);
    playerList.append(makeEl("div", { class: "amqb-pl" },
      makeEl("span", {}, makeEl("b", {}, player.name), player.web ? makeEl("span", { class: "amqb-muted" }, " (website)") : null, score ? makeEl("span", { class: "amqb-muted" }, ` · ${score.claimData.marks.size} tiles · ${score.claimData.wild || "no wild card"}`) : makeEl("span", { class: "amqb-muted" }, " · no board this round")),
      score ? makeEl("span", {}, `${score.lines.length} bingo${score.lines.length === 1 ? "" : "s"} `, makeEl("b", { class: "ok" }, `(${score.confirmed} ✓)`)) : makeEl("span", {}),
      score && score.claimData.wild ? makeEl("button", { class: "amqb-tog" + (won ? " on" : ""), title: "Did they earn their wild card?", onclick: () => { (hostData.wildHost[key] = hostData.wildHost[key] || {})[round] = !won; saveHostData(); checkBingoEnd(); renderHost(); } }, won ? "Wild On" : "Wild Off") : makeEl("span", {}),
      makeEl("button", { class: "amqb-btn", disabled: !score, onclick: () => { viewName = viewName === key ? "" : key; renderHost(); } }, viewName === key ? "Hide" : "View")));
  });
  body.append(playerList);

  const webName = makeEl("input", { class: "amqb-in", placeholder: "Website player's name", style: "width:150px" });
  const webClaim = makeEl("input", { class: "amqb-in", placeholder: "Claim code", style: "width:110px;text-transform:uppercase" });
  const webMsg = makeEl("span", { class: "amqb-muted" }, "");
  body.append(makeEl("div", { class: "amqb-row" }, webName, webClaim, makeEl("button", { class: "amqb-btn", onclick: () => {
    const name = webName.value.trim(), claim = webClaim.value.trim().toUpperCase();
    if (!name || !claim) { webMsg.textContent = "Enter their name and claim code."; return; }
    if (hostData.packId) { webMsg.textContent = "Website boards only work with the standard tiles."; return; }
    if (!readClaim(name, code, claim)) { webMsg.textContent = `No board for "${name}" matches that code.`; return; }
    const key = norm(name); (hostData.players[key] = hostData.players[key] || { name, claims: {} }).claims[round] = claim; hostData.players[key].web = true; saveHostData(); checkBingoEnd(); renderHost();
  } }, "Add website player"), webMsg),
    makeEl("p", { class: "amqb-muted" }, "Website players can also just paste their claim code in AMQ chat. It's picked up automatically."));

  const viewedPlayer = viewName && hostData.players[viewName], viewedScore = viewedPlayer && scorePlayer(viewedPlayer, round);
  if (viewedScore) {
    const grid = makeEl("div", { class: "amqb-grid" }, COLS.map((col, colIdx) => makeEl("div", { class: "amqb-ch", style: `--cat:${COLUMN_COLORS[colIdx]}` }, col.name)));
    const inLine = new Set(viewedScore.lines.flatMap((entry) => entry.line));
    const key = norm(viewedPlayer.name);
    viewedScore.cells.forEach((cell, cellIdx) => {
      const mine = viewedScore.claimData.marks.has(cellIdx), yes = viewedScore.isConfirmed(cellIdx), man = !cell.wild && !AUTO_TILES.has(cell.text), difficulty = cell.d || (cell.hard ? "H" : "M");
      const cls = "amqb-cell" + (mine ? (yes ? " ok" : " unk") : yes ? " hostonly" : "") + (inLine.has(cellIdx) ? " line" : "") + (man ? " man" : "");
      // Click tiles: the host can confirm (or un-confirm) them for this player by clicking.
      const toggle = man ? () => { const bag = (hostData.personal[round][key] = hostData.personal[round][key] || {}); if (cell.text in bag) delete bag[cell.text]; else bag[cell.text] = "host"; saveHostData(); checkBingoEnd(); renderHost(); } : null;
      grid.append(makeEl(man ? "button" : "div", { class: cls, style: `cursor:${man ? "pointer" : "default"};--cat:${COLUMN_COLORS[cell.col]}`, title: man ? (yes ? "Click tile, confirmed. Click to undo." : mine ? "Click tile they marked. Click to confirm it." : "Click tile. They haven't marked it.") : "Tracked automatically", onclick: toggle },
        cell.wild ? `Wild: ${viewedScore.claimData.wild || "none"}` : cell.text,
        cell.wild ? "" : makeEl("span", { class: "dif d" + difficulty }, difficulty),
        man ? makeEl("span", { class: "tag" }, yes ? "✋ ✓" : "✋") : ""));
    });
    const manMarked = viewedScore.cells.map((cell, cellIdx) => ({ cell, cellIdx })).filter(({ cell, cellIdx }) => !cell.wild && !AUTO_TILES.has(cell.text) && viewedScore.claimData.marks.has(cellIdx));
    const verdicts = viewedScore.lines.map((entry) => {
      const miss = entry.line.filter((cellIdx) => !viewedScore.isConfirmed(cellIdx)).map((cellIdx) => viewedScore.cells[cellIdx].wild ? "wild card" : viewedScore.cells[cellIdx].text);
      return makeEl("div", {}, `${LINE_NAMES[entry.idx]}: `, miss.length ? makeEl("b", { style: "color:#fdba74" }, "check " + miss.join(", ")) : makeEl("b", { style: "color:#5fd39a" }, "confirmed"));
    });
    body.append(makeEl("b", {}, `${viewedPlayer.name}'s board`), grid,
      manMarked.length ? makeEl("div", { class: "amqb-muted" }, "Click tiles they marked: ", manMarked.map(({ cell, cellIdx }) => makeEl("b", { style: `color:${viewedScore.isConfirmed(cellIdx) ? "#5fd39a" : "#fdba74"}` }, cell.text + (viewedScore.isConfirmed(cellIdx) ? " ✓" : ""))).reduce((parts, part, partIdx) => (partIdx ? [...parts, ", ", part] : [part]), [])) : "",
      makeEl("div", { class: "amqb-muted" }, "Green: confirmed. Amber: they marked it, not confirmed yet. Grey: happened but they didn't mark it. Striped ✋ = click tiles: click one to confirm it for this player."), verdicts);
  }
}

function tabTiles(body, round) {
  const tiles = makeEl("div", { class: "amqb-tiles" });
  COLS.forEach((col, colIdx) => tiles.append(makeEl("div", { class: colIdx === 3 ? "self" : "" }, makeEl("b", { style: `color:${COLUMN_COLORS[colIdx]}` }, col.name), colIdx === 3 ? makeEl("span", { class: "amqb-muted", style: "font-size:10px" }, "Each player's own. Auto ones are tracked per player (Players tab); the host can't check the rest.") : "", col.pool.map((tile) => {
    const isChecked = tile.text in hostData.checks[round], rule = RULES[tile.text], ask = !isChecked && hostData.asks && hostData.asks[round] && hostData.asks[round][tile.text];
    if (colIdx === 3) return makeEl("button", { class: "amqb-t", disabled: true, title: rule ? "Tracked per player automatically" : "Only the player knows. It shows as \"check\" on their board." }, tile.text + (rule ? "" : " ✋"));
    return makeEl("button", { class: "amqb-t" + (isChecked ? " on" : "") + (ask ? " ask" : ""), title: ask ? `Might count for song ${ask}. Click to confirm.` : rule && rule.personal ? "Tracked per player automatically" : rule ? "Checked automatically" : "Click when it happens",
      onclick: () => { if (isChecked) delete hostData.checks[round][tile.text]; else hostData.checks[round][tile.text] = game.songNumber || 0; saveHostData(); checkBingoEnd(); renderHost(); } },
      (isChecked ? "✓ " : "") + tile.text + (rule && rule.personal ? " (per player)" : rule ? "" : " ✋"));
  }))));
  body.append(makeEl("p", { class: "amqb-muted" }, `Checked this round: ${Object.keys(hostData.checks[round]).length}. ✋ = judgment tile, click it when it happens. "(per player)" tiles are tracked for each player separately.`), tiles);

  const current = hostData.custom || { mode: "add", text: "" };
  const tilesInput = makeEl("textarea", { class: "amqb-ta", placeholder: "Anime: Anime has a dog in it\nSong: *Song is over 5 minutes\n[Artist]\nArtist is a VTuber\nArtist has a number in their name" });
  tilesInput.value = current.text || "";
  const mode = makeEl("select", { class: "amqb-in" }, makeEl("option", { value: "add", selected: current.mode !== "replace" }, "Add to the tile set"), makeEl("option", { value: "replace", selected: current.mode === "replace" }, "Replace the tile set"));
  const note = makeEl("div", {});
  const save = () => {
    const { cols, errors } = parseTiles(tilesInput.value);
    const error = hostSavePack({ mode: mode.value, text: tilesInput.value }, hostData.settings || DEFAULT_SETTINGS);
    note.innerHTML = "";
    if (errors.length) note.append(makeEl("div", { class: "amqb-err" }, errors.slice(0, 4).join(" · ")));
    if (error) { note.append(makeEl("div", { class: "amqb-err" }, error)); return; }
    const added = cols.map((colTiles, colIdx) => colTiles.length ? `${COLS[colIdx].name} ${colTiles.length}` : "").filter(Boolean).join(", ");
    note.append(makeEl("div", { class: "amqb-ok" }, (added ? `Saved: ${added}. ` : "Saved. ") + (hostData.packId ? `Tile pack ${hostData.packId}. Announce the round again so players get it. Website boards won't match while custom tiles are on.` : `Using the ${SET_NAMES[(hostData.settings || DEFAULT_SETTINGS).set || "S"]} tiles.`)));
    renderPlayer();
  };
  body.append(makeEl("b", {}, "Custom tiles" + (hostData.packId ? ` (pack ${hostData.packId})` : "")),
    makeEl("p", { class: "amqb-muted" }, "One tile per line. Start with the column (Anime, Song, Artist, Individual, Multiplayer) and a colon, or put a [Column] header above a group. * in front = hard, - in front = easy, otherwise medium. Custom tiles are click-to-mark."),
    tilesInput, makeEl("div", { class: "amqb-row" }, mode,
      makeEl("button", { class: "amqb-btn pri", onclick: save }, "Save tiles"),
      makeEl("button", { class: "amqb-btn", onclick: () => { tilesInput.value = COLS.map((col) => `[${col.name}]\n` + col.pool.map((tile) => (tile.hard ? "*" : tile.d === "E" ? "-" : "") + tile.text).join("\n")).join("\n\n"); mode.value = "replace"; } }, "Load current list to edit"),
      makeEl("button", { class: "amqb-btn", onclick: () => { tilesInput.value = ""; mode.value = "add"; save(); } }, "Clear custom tiles")),
    note);
}

function tabSettings(body) {
  const gameSettings = hostData.game, tileSettings = hostData.settings || DEFAULT_SETTINGS;
  const makeSelect = (opts, val, onChange) => { const control = makeEl("select", { class: "amqb-in" }, opts.map(([value, label]) => makeEl("option", { value: value, selected: String(value) === String(val) }, label))); control.addEventListener("change", () => onChange(control.value)); return control; };
  const makeCheckbox = (val, onChange) => { const control = makeEl("input", { type: "checkbox", checked: val }); control.addEventListener("change", () => onChange(control.checked)); return control; };
  const setGame = (patch) => { hostData.game = { ...hostData.game, ...patch }; if (hostData.round > hostData.game.rounds) hostData.round = 1; saveHostData(); renderHost(); };
  const setTiles = (patch) => { const error = hostSavePack(hostData.custom || { mode: "add", text: "" }, { ...tileSettings, ...patch }); if (error) sysMsg("AMQ Bingo: " + error); renderPlayer(); renderHost(); };
  const row = (label, ctl, help) => makeEl("div", { class: "amqb-setrow" }, makeEl("div", {}, makeEl("b", {}, label), help ? makeEl("div", { class: "amqb-muted" }, help) : null), ctl);
  body.append(
    makeEl("b", { class: "amqb-sechead" }, "Speedrun (solo)"),
    row("Official speedrun rules", makeEl("div", { class: "amqb-row" }, makeEl("button", { class: "amqb-btn", onclick: () => applySpeedrun("random") }, "Random songs"), makeEl("button", { class: "amqb-btn", onclick: () => applySpeedrun("watched") }, "Watched songs")),
      "Sets everything to the fixed speedrun rules so times compare: Standard tiles, auto tiles only (locked), no wild card, Mix column, round ends at the first bingo; room: 100 songs, 20s guess time, all song types, full difficulty. Only Random vs Watched differs."),
    makeEl("b", { class: "amqb-sechead" }, "Rounds"),
    row("Number of rounds", makeSelect([[1, "1 (no rounds)"], [2, "2"], [3, "3"], [4, "4"], [5, "5"]], gameSettings.rounds, (value) => setGame({ rounds: Number(value) })), "With 1, round buttons are hidden. The website supports up to 3."),
    row("A round ends", makeSelect([["amq", "When the AMQ game ends"], ["bingo", "When someone gets a confirmed bingo"]], gameSettings.endMode, (value) => setGame({ endMode: value })), gameSettings.endMode === "bingo" ? "The round keeps going across AMQ games until a bingo is confirmed." : "Boards reset with each new AMQ game."),
    row("Return to lobby when a round ends early", makeCheckbox(gameSettings.autoLobby !== false, (value) => setGame({ autoLobby: value })), "After End round now or a bingo, starts the return-to-lobby vote and votes yes. Only works if you're the room host."),
    row("Announce bingos in chat", makeCheckbox(gameSettings.announceBingo !== false, (value) => setGame({ announceBingo: value })), "When a board gets a line and the player hasn't called it yet, posts it in game chat."),
    row("Ask me to end the round on a bingo", makeCheckbox(gameSettings.askEnd !== false, (value) => setGame({ askEnd: value })), "Shows a prompt with End round / Keep playing. (With \"ends on a bingo\" the round ends by itself instead.)"),
    row("Boards in the next round", makeSelect([["new", "New board"], ["same", "Same board, marks cleared"], ["keep", "Same board, marks kept"]], gameSettings.nextBoard || "new", (value) => setGame({ nextBoard: value })), "Same board = everyone keeps the tiles from round 1. Website players always get a new board."),
    row("Start the next round automatically", makeCheckbox(gameSettings.autoNext, (value) => setGame({ autoNext: value })), "Posts the next round's code in chat when a round ends."),
    makeEl("b", { class: "amqb-sechead" }, "Boards"),
    row("Tile set", makeSelect(Object.entries(SET_NAMES), tileSettings.set || "S", (value) => setTiles({ set: value, hardCap: SET_CAP[value] })), SET_INFO[tileSettings.set || "S"] + (tileSettings.set && tileSettings.set !== "S" ? " Website boards only use Standard." : "")),
    row("Include click-to-mark tiles", makeCheckbox(tileSettings.manual !== false, (value) => setTiles({ manual: value })), "Off = only tiles the script marks by itself."),
    row("Hard tiles per column", makeSelect([[0, "0"], [1, "1"], [2, "2"], [3, "3"], [5, "No limit"]], tileSettings.hardCap, (value) => setTiles({ hardCap: Number(value) })), "Website boards always use 1."),
    row("Wild card in the center", makeCheckbox(tileSettings.wild !== false, (value) => setTiles({ wild: value })), "Off = the center is a normal Artist tile. Website boards always have the wild card."),
    row("Lock auto tiles", makeCheckbox(!!tileSettings.lockAuto, (value) => setTiles({ lockAuto: value })), "Players can't mark or unmark auto tiles by hand; only the script does. Picking one of several matches still works. Website players aren't limited."),
    row("Only mark tiles on songs you got right", makeCheckbox(!!tileSettings.needCorrect, (value) => setTiles({ needCorrect: value })), "Tiles only count for players who got that song. Website players aren't limited."),
    row("One tile per song", makeCheckbox(!!tileSettings.onePerSong, (value) => setTiles({ onePerSong: value })), "When a song matches several tiles, players pick one. Website players aren't limited."),
    row("Replacement boards", makeCheckbox(tileSettings.replace, (value) => setTiles({ replace: value })), "One new board per round, 3 minutes after joining."),
    row("Auto-marking for players", makeCheckbox(tileSettings.auto, (value) => setTiles({ auto: value })), "Off = players mark every tile by hand. Your tracking still runs."),
    makeEl("b", { class: "amqb-sechead" }, "Event"),
    (() => {
      const keyIn = makeEl("input", { class: "amqb-in", maxlength: 6, placeholder: "Event key", style: "width:110px;text-transform:uppercase;letter-spacing:2px" });
      return row("Event key", makeEl("div", { class: "amqb-row" }, makeEl("b", { style: "letter-spacing:2px" }, hostData.key), keyIn, makeEl("button", { class: "amqb-btn", onclick: () => {
        const key = keyIn.value.trim().toUpperCase();
        if (!/^[A-Z]{6}$/.test(key) || [...key].some((letter) => !ALPHA.includes(letter))) { sysMsg("AMQ Bingo: an event key is 6 letters (no I, L or O)."); return; }
        hostData.key = key; hostData.codes = codesFor(key); saveHostData(); renderHost();
      } }, "Use key")), "Same key as the website, so the codes match.");
    })(),
    row("Start over", newEventBtn("settings"), "New codes, clears players and checks. Keeps these settings and your custom tiles."));
}

/* ---------------- buttons in AMQ's own menus ---------------- */
function toggleBoard() { playerUI.toggle(); renderPlayer(); placeBoard(); }
function toggleHost() { hostUI.toggle(); if (hostUI.panel.style.display !== "none") lastAlertSeen = bingoAlerts.length; renderHost(); }
function addMenuButtons() {
  // Quiz screen: icons in the top bar next to AMQ's own options
  const optionContainer = document.getElementById("qpOptionContainer");
  if (optionContainer && !document.getElementById("qpAmqBingo")) {
    const inner = optionContainer.querySelector("div") || optionContainer;
    const width = parseFloat(getComputedStyle(optionContainer).width) || optionContainer.offsetWidth;
    optionContainer.style.width = (width + 70) + "px";
    const icon = (iconClass, fallback) => { const iconEl = makeEl("i", { class: `fa ${iconClass} qpMenuItem`, "aria-hidden": "true" }); if (!document.querySelector(".fa")) iconEl.textContent = fallback; return iconEl; };
    inner.append(
      makeEl("div", { id: "qpAmqBingo", class: "clickAble qpOption", title: "AMQ Bingo board (Alt+G)", onclick: toggleBoard }, icon("fa-th", "B")),
      makeEl("div", { id: "qpAmqBingoHost", class: "clickAble qpOption", title: "AMQ Bingo host panel (Alt+H)", onclick: toggleHost }, icon("fa-trophy", "H")));
  }
  // Main menu: entries in the settings dropdown
  const optionList = document.getElementById("optionListSettings");
  if (optionList && !document.getElementById("olAmqBingo")) {
    optionList.parentNode.insertBefore(makeEl("li", { id: "olAmqBingo", class: "clickAble", onclick: toggleBoard }, "AMQ Bingo"), optionList);
    optionList.parentNode.insertBefore(makeEl("li", { id: "olAmqBingoHost", class: "clickAble", onclick: toggleHost }, "Bingo host"), optionList);
  }
}
function markHostButton() {
  const button = document.getElementById("qpAmqBingoHost"); if (!button) return;
  const fresh = bingoAlerts.length - lastAlertSeen > 0 && hostUI.panel.style.display === "none";
  button.style.color = fresh ? "#ff4f93" : ""; button.title = fresh ? `AMQ Bingo: ${bingoAlerts[0]}` : "AMQ Bingo host panel (Alt+H)";
}

/* =====================================================================
 * BOOT
 * ===================================================================== */
function boot() {
  document.head.appendChild(makeEl("style", {}, CSS));
  if (playerData.packId && playerData.packBody) { if (applyPack(playerData.packBody)) { playerData.packId = ""; playerData.packBody = ""; } }
  const dockBtn = makeEl("button", { class: "amqb-hbtn", title: "Switch between docked in chat and popup" }, "⇄");
  playerUI = makePanel("amqbPlayer", "AMQ Bingo", "right", dockBtn, () => undockBoard());
  dockBtn.addEventListener("click", () => { playerData.dock = playerData.dock === false; savePlayerData(); placeBoard(); dockBtn.title = playerData.dock !== false ? "Pop out" : "Dock into chat"; });
  window.addEventListener("resize", () => { if (dock) placeBoard(); });
  hostUI = makePanel("amqbHost", "Bingo host", "left", null, () => renderMini());
  renderPlayer(); renderHost();
  addMenuButtons(); setInterval(addMenuButtons, 3000); // AMQ can rebuild its menus

  document.addEventListener("keydown", (event) => {
    if (!event.altKey || event.ctrlKey || event.metaKey) return;
    if (event.code === "KeyG") { event.preventDefault(); toggleBoard(); }
    if (event.code === "KeyD" && event.shiftKey) { event.preventDefault(); copyChatLayout(); }
    if (event.code === "KeyH") { event.preventDefault(); toggleHost(); }
  });

  const listen = (name, handler) => { try { const listener = new PAGE.Listener(name, (payload) => { try { handler(payload); } catch (error) { console.error("[AMQ Bingo]", name, error); } }); listener.__amqb = true; listener.bindListener(); } catch (error) { console.warn("[AMQ Bingo] no listener for", name); } };
  // Keep our hidden sync messages away from AMQ's own chat code, so no DM windows pop open
  // for them (on either side) and AMQ's "can't message" popups for them are swallowed.
  const ours = (text) => typeof text === "string" && text.startsWith(PREFIX);
  try {
    const listenerProto = PAGE.Listener.prototype, fire = listenerProto.fire;
    // find which field holds the event name (normally "command")
    const probe = new PAGE.Listener("__amqbProbe", () => {}), key = Object.keys(probe).find((prop) => probe[prop] === "__amqbProbe") || "command";
    if (typeof fire === "function") listenerProto.fire = function (payload) {
      const cmd = this[key];
      if (!this.__amqb) {
        if (cmd === "chat message" && payload && ours(payload.message)) return;
        if (cmd === "chat message response" && payload && (ours(payload.msg) || ours(payload.message))) return;
        if (cmd === "new chat alert" && payload && /level \d+ required/i.test(payload.alert || "") && Date.now() - lastOwnDM < 3000 && norm(payload.name || "") === lastDMTarget) return;
      }
      return fire.apply(this, arguments);
    };
  } catch (error) { console.warn("[AMQ Bingo] couldn't filter chat events", error); }
  listen("Game Starting", (payload) => { trackGameStart(payload); setTimeout(placeBoard, 800); setTimeout(() => sysMsg("AMQ Bingo is on. Alt+G: your board. Alt+H: host panel."), 600); });
  listen("quiz over", () => { game.inQuiz = false; renderHost(); });
  listen("play next song", (payload) => { speedStart(); game.inQuiz = true; game.hints = {}; game.nameHint = null; game.songNumber = payload.songNumber; game.mySubs = []; game.onLast = !!payload.onLastSong; game.start = game.nextStart; game.nextStart = null; });
  // Only the sample's start second is kept (it says nothing about which song it is); it's used after the reveal.
  listen("quiz next video info", (payload) => { game.nextStart = payload && typeof payload.startPoint === "number" ? payload.startPoint : null; });
  listen("quiz answer", (payload) => { if (payload && payload.success !== false && typeof payload.answer === "string") (game.mySubs = game.mySubs || []).push(payload.answer); });
  const amqGameOver = () => { if (hostData.active && hostData.game.endMode === "amq" && game.hist.length) endRound("the AMQ game ended"); };
  listen("quiz end result", () => { amqGameOver(); game.inQuiz = false; });
  listen("return lobby vote result", (payload) => { if (payload && payload.passed) { amqGameOver(); game.inQuiz = false; } });
  // Hints: who used which hint this song (sent to everyone), and how much of the title your own name hint showed.
  listen("quiz player hint used", (payload) => { (payload.gamePlayerIds || []).forEach((playerId) => { const hints = (game.hints = game.hints || {}); (hints[playerId] = hints[playerId] || []).push(payload.hintId); }); });
  listen("quiz name hint", (payload) => { const hintWords = String((payload && payload.hint) || "").split(/\s+/).filter(Boolean); if (hintWords.length) game.nameHint = { id: myId(), shown: hintWords.filter((word) => word !== "_").length / hintWords.length }; });
  // Joining mid-game (spectate, late join) or a Jam restart: learn the players so per-player tracking works.
  const keepRoom = (settings) => { if (settings && settings.songSelection) game.roomSettings = settings; };
  listen("Host Game", (payload) => keepRoom(payload && payload.settings));
  listen("Join Game", (payload) => keepRoom(payload && payload.settings));
  // AMQ sends { changes: {...}, communityMode } (seen in a real log).
  listen("Room Settings Changed", (payload) => { const changes = (payload && payload.changes) || payload; if (changes) game.roomSettings = { ...(game.roomSettings || {}), ...changes }; renderPlayer(); });
  listen("Spectate Game", (payload) => { keepRoom(payload && payload.settings); });
  listen("Spectate Game", (payload) => { const quizState = payload && payload.quizState; if (quizState && quizState.players) trackGameStart({ players: quizState.players }); });
  // Rejoining after a disconnect (or a page reload mid-game) sends "Join Game" with the current players.
  listen("Join Game", (payload) => { const quizState = payload && payload.quizState; if (quizState && quizState.players && !payload.inLobby) trackGameStart({ players: quizState.players }); });
  listen("Jam Game Restarting", (payload) => { trackGameStart(payload); });
  listen("player late join", (payload) => { const newPlayer = payload && payload.newPlayer; if (newPlayer && newPlayer.gamePlayerId != null) game.players[newPlayer.gamePlayerId] = { name: newPlayer.name, seat: newPlayer.positionSlot, level: newPlayer.level }; });
  listen("player answers", (payload) => { game.answers = {}; (payload.answers || []).forEach((entry) => { game.answers[entry.gamePlayerId] = entry.answer || ""; }); });
  listen("answer results", (payload) => {
    const res = {}; (payload.players || []).forEach((player) => { res[player.gamePlayerId] = player; });
    game.seq = (game.seq || 0) + 1;
    const rec = { seq: game.seq, n: game.songNumber || game.hist.length + 1, s: payload.songInfo || {}, res, answers: { ...game.answers }, chat: game.chat, left: game.left, mySubs: (game.mySubs || []).slice(), last: !!game.onLast, start: game.start, hints: { ...(game.hints || {}) }, nameHint: game.nameHint || null };
    game.hist.push(rec); game.chat = false; game.left = false; game.answers = {};
    playerOnSong(rec); hostOnSong(rec);
  });
  listen("game chat update", (payload) => {
    (payload.messages || []).forEach((message) => {
      const text = message.message || "";
      const match = text.match(ANNOUNCE_RE);
      if (match && match[8] && newerVersion(match[8], SCRIPT_VERSION) && !warnedVersion) { warnedVersion = true; sysMsg(`AMQ Bingo: the host is on v${match[8]} and you have v${SCRIPT_VERSION}. Update so your board matches: open Tampermonkey and "Check for userscript updates", or reinstall from ${INSTALL_URL}`); }
      if (match) { if (!(Number(match[1]) === playerData.round && match[2] === playerData.code && (match[4] || "") === (playerData.packId || ""))) { playerData.nextBoard = match[6] ? { bcode: match[6], keep: !!match[7] } : null; if (announceSeen(Number(match[1]), match[2], match[3], match[4], match[5])) sysMsg(`AMQ Bingo: joined round ${match[1]}. Press Alt+G to see your board.`); } return; }
      const bingoMatch = text.match(BINGO_RE);
      if (bingoMatch) { if (message.sender && norm(message.sender) === norm(bingoMatch[1])) hostTakeBingo(message.sender, Number(bingoMatch[2]), bingoMatch[3]); return; }
      // Any other BINGO call (older script, website player typing it, claim that doesn't match): still ask the host.
      if (message.sender && /^\s*bingo\b/i.test(text) && hostData.active && !hostData.ended[hostData.round] && norm(message.sender) !== norm(myName())) { askToEnd(message.sender); return; }
      if (message.sender && hostTakeClaim(message.sender, text)) return;
      if (/\p{Extended_Pictographic}|:[a-z0-9_+\-]+:/iu.test(text) && !/^(BINGO! |🎉 AMQ Bingo|AMQ Bingo)/u.test(text)) game.chat = true;
    });
  });
  // Someone else leaving or moving to spectator counts; you don't.
  ["Player Left", "Player Changed To Spectator"].forEach((eventName) => listen(eventName, (payload) => {
    const who = payload && ((payload.player && payload.player.name) || (payload.playerDescription && payload.playerDescription.name) || payload.name);
    if (!who || norm(who) !== norm(myName())) game.left = true;
  }));
  let dmWarned = false;
  const isOurAlert = (payload) => !!payload && /level \d+ required/i.test(payload.alert || "") && Date.now() - lastOwnDM < 3000 && norm(payload.name || "") === lastDMTarget;
  const onOurAlert = (payload) => {
    // Only AMQ's "Level 5 required ..." refusal for the player we just messaged counts.
    if (!isOurAlert(payload)) return;
    dmBlocked.set(lastDMTarget, Date.now());
    if (!dmWarned) { dmWarned = true; sysMsg("AMQ Bingo: AMQ won't deliver private messages to " + payload.name + " (" + payload.alert + "). Your board still reaches them when you press BINGO."); }
  };
  listen("new chat alert", onOurAlert);
  listen("chat message response", (payload) => {
    const target = payload && (payload.target || payload.name); if (target) dmBlocked.delete(norm(target));
  });
  const onDM = (payload) => {
    if (!payload || typeof payload.message !== "string") return;
    if (!payload.message.startsWith(PREFIX)) { hostTakeClaim(payload.sender, payload.message); return; }
    const parts = payload.message.slice(PREFIX.length).trim().split(" ");
    if (parts[0] === "P") onPackChunk(parts); else hostReceive(payload.sender, payload.message);
  };
  listen("chat message", onDM);
  // Earliest hook (the same one other AMQ scripts use): our sync messages are handled here and never
  // reach AMQ's chat code at all. If AMQ changes this internal, the listener filters below still apply.
  try {
    const cmds = PAGE.socket._socket.t.$command, first = cmds && cmds[0];
    if (typeof first === "function") cmds[0] = function (msg) {
      const data = msg && msg.data;
      if (msg && msg.command === "chat message" && data && ours(data.message)) { onDM(data); return; }
      if (msg && msg.command === "chat message response" && data && (ours(data.msg) || ours(data.message))) { const target = data.target || data.name; if (target) dmBlocked.delete(norm(target)); return; }
      if (msg && msg.command === "new chat alert" && isOurAlert(data)) { onOurAlert(data); return; }
      return first.apply(this, arguments);
    };
  } catch (error) { /* not available; listener filters handle it */ }

  // Hold this player's skip vote while they still have a tile to pick, and send it once they pick.
  try {
    const sock = PAGE.socket, send = sock.sendCommand;
    sock.sendCommand = function (cmd) {
      if (cmd && cmd.type === "quiz" && cmd.command === "skip vote" && cmd.data) {
        const board = curBoard();
        if (cmd.data.skipVote && board && board.pick) {
          skipHeld = true; try { PAGE.quiz.skipController.toggled = false; } catch (error) {}
          renderPlayer(); return;
        }
        if (!cmd.data.skipVote) skipHeld = false;
      }
      return send.apply(this, arguments);
    };
    releaseSkip = () => {
      if (!skipHeld) return; skipHeld = false;
      try { send.call(sock, { type: "quiz", command: "skip vote", data: { skipVote: true } }); PAGE.quiz.skipController.toggled = true; } catch (error) {}
    };
  } catch (error) { console.warn("[AMQ Bingo] couldn't hook skip votes", error); }

  // hide our sync DMs from chat windows
  try {
    PAGE.ChatBox.prototype.writeMessage = (function (orig) {
      return function () { for (const arg of arguments) if (ours(arg) || (arg && typeof arg === "object" && (ours(arg.message) || ours(arg.msg)))) return; return orig.apply(this, arguments); };
    })(PAGE.ChatBox.prototype.writeMessage);
  } catch (error) {}
}

const waitForLoad = setInterval(() => {
  const loadingScreen = document.getElementById("loadingScreen");
  if (loadingScreen && loadingScreen.classList.contains("hidden") && typeof PAGE.Listener !== "undefined") { clearInterval(waitForLoad); boot(); }
}, 500);

})();
