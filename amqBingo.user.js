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
].map(c => ({ ...c, pool: c.tiles.map(t => t.startsWith("*") ? { text: t.slice(1), hard: true, d: "H" } : t.startsWith("-") ? { text: t.slice(1), hard: false, d: "E" } : { text: t, hard: false, d: "M" }) }));

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
function hash32(s) { let h = 2166136261 >>> 0; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
function rng(seed) { let a = hash32(seed); return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
function shuffle(arr, r) { const a = arr.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
const norm = s => s.trim().replace(/\s+/g, " ").toLowerCase();
function checkLetter(three, round) { let s = round * 7; for (let i = 0; i < 3; i++) s += (ALPHA.indexOf(three[i]) + 1) * (i + 3); return ALPHA[s % ALPHA.length]; }
function codeValid(code, round) { return code.length === 4 && [...code].every(c => ALPHA.includes(c)) && checkLetter(code.slice(0, 3), round) === code[3]; }

/* A board is fully decided by name + round code + variant (0 = original, 1 = replacement). */
function buildBoard(name, code, variant) {
  const r = rng(norm(name) + "|" + code + "|" + variant);
  const fams = new Set();
  const picks = COLS.map(c => {
    const n = c.wild ? 4 : 5, out = []; let hard = 0;
    for (const t of shuffle(c.pool, r)) { if (out.length === n) break; if (t.hard && hard >= 1) continue; const f = FAMILY[t.text]; if (f && fams.has(f)) continue; out.push(t); if (t.hard) hard++; if (f) fams.add(f); }
    return out;
  });
  const cells = [];
  for (let row = 0; row < 5; row++) for (let c = 0; c < 5; c++) {
    if (c === 2 && row === 2) { cells.push({ wild: true, col: c }); continue; }
    const idx = c === 2 && row > 2 ? row - 1 : row;
    cells.push({ ...picks[c][idx], col: c });
  }
  return cells;
}
/* Claim code: the player's marks, board variant and wild card packed into 8 characters,
   plus a check tied to their username and the round code, so typos and mismatches are caught. */
const B32 = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";
function makeClaim(name, code, variant, state) {
  let v = 0;
  for (let i = 0; i < 25; i++) if (i === 12 ? state.wildOn : state.marks.includes(i)) v += 2 ** i;
  v += variant * 2 ** 25 + (WILD.findIndex(x => x.name === state.wild) + 1) * 2 ** 26;
  let body = ""; for (let k = 0; k < 6; k++) { body = B32[v % 32] + body; v = Math.floor(v / 32); }
  const h = hash32(norm(name) + "|" + code + "|" + body) & 1023;
  const full = body + B32[h >> 5] + B32[h & 31];
  return full.slice(0, 4) + "-" + full.slice(4);
}
function readClaim(name, code, raw) {
  const s = raw.toUpperCase().replace(/O/g, "0").replace(/[IL]/g, "1").replace(/[^0-9A-Z]/g, "");
  if (s.length !== 8 || [...s].some(c => !B32.includes(c))) return null;
  const body = s.slice(0, 6), h = hash32(norm(name) + "|" + code + "|" + body) & 1023;
  if (B32[h >> 5] + B32[h & 31] !== s.slice(6)) return null;
  let v = 0; for (const c of body) v = v * 32 + B32.indexOf(c);
  const marks = new Set(); for (let i = 0; i < 25; i++) if (Math.floor(v / 2 ** i) % 2) marks.add(i);
  const wi = Math.floor(v / 2 ** 26);
  return { marks, variant: Math.floor(v / 2 ** 25) % 2, wild: wi && WILD[wi - 1] ? WILD[wi - 1].name : "" };
}

const LINES = [];
for (let i = 0; i < 5; i++) { LINES.push([0,1,2,3,4].map(j => i * 5 + j)); LINES.push([0,1,2,3,4].map(j => j * 5 + i)); }
LINES.push([0, 6, 12, 18, 24], [4, 8, 12, 16, 20]);
const LINE_NAMES = [];
for (let i = 0; i < 5; i++) { LINE_NAMES.push("Row " + (i + 1)); LINE_NAMES.push(COLS[i].name + " column"); }
LINE_NAMES.push("Diagonal (top left to bottom right)", "Diagonal (top right to bottom left)");
function randomKey() { let k = ""; for (let i = 0; i < 6; i++) k += ALPHA[Math.floor(Math.random() * ALPHA.length)]; return k; }
function codesFromKey(key) {
  const out = {};
  for (const r of [1, 2, 3]) { const g = rng("event|" + key + "|" + r); let t = ""; for (let i = 0; i < 3; i++) t += ALPHA[Math.floor(g() * ALPHA.length)]; out[r] = t + checkLetter(t, r); }
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
const CAT = ["#4f8cff", "#3fbf7f", "#ff9f43", "#b37bff", "#27c2c2"]; // Anime, Song, Artist, Individual, Multiplayer
const COOLDOWN_MS = 3 * 60 * 1000;

const S = {
  get(k, d) { try { const v = localStorage.getItem("amqBingo." + k); return v != null ? JSON.parse(v) : d; } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem("amqBingo." + k, JSON.stringify(v)); } catch (e) {} },
};
const PAGE = typeof unsafeWindow !== "undefined" ? unsafeWindow : window; // AMQ's own variables live on the page
const myName = () => PAGE.selfName || "";
const sysMsg = (m) => { try { PAGE.gameChat.systemMessage(m); } catch (e) { console.log("[AMQ Bingo]", m); } };

function h(tag, attrs, ...kids) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (k === "class") el.className = v;
    else if (k.startsWith("on")) el.addEventListener(k.slice(2), v);
    else if (v !== false && v != null) el.setAttribute(k, v === true ? "" : v);
  }
  for (const c of kids.flat()) if (c != null && c !== false) el.append(c instanceof Node ? c : String(c));
  return el;
}

/* ---------------- game tracking (reveal data only) ---------------- */
const game = { players: {}, hist: [], answers: {}, songNumber: 0, chat: false, left: false };

function trackGameStart(p) {
  game.players = {};
  (p.players || []).forEach((x) => { game.players[x.gamePlayerId] = { name: x.name, seat: x.positionSlot, level: x.level }; });
  game.hist = []; game.answers = {}; game.chat = false; game.left = false; game.inQuiz = true;
}
function myId() {
  const n = myName().toLowerCase();
  const e = Object.entries(game.players).find(([, v]) => (v.name || "").toLowerCase() === n);
  return e ? Number(e[0]) : null;
}

/* ---------------- auto-marking rules ---------------- */
const titlesOf = (s) => [s.animeNames && s.animeNames.romaji, s.animeNames && s.animeNames.english].filter(Boolean);
const allNames = (s) => [...new Set([...titlesOf(s), ...(s.altAnimeNames || []), ...(s.altAnimeNamesAnswers || [])])];
const words = (t) => (t || "").trim().split(/\s+/).map((w) => w.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, "")).filter(Boolean);
const flat = (t) => (t || "").toLowerCase().replace(/[^\p{L}\p{N}]/gu, "");
const yearOf = (s) => s.vintage && s.vintage.data && s.vintage.data.year;
const isCaps = (t) => { const l = (t || "").replace(/[^\p{L}]/gu, ""); return l.length >= 2 && l === l.toUpperCase() && l !== l.toLowerCase(); };
const COLOR_RE = /\b(red|blue|green|yellow|white|black|pink|purple|orange|gold|golden|silver|gr[ae]y|crimson|scarlet|azure|violet|indigo|rainbow|aka|ao|midori|kiiro|shiro|kuro|momo|murasaki|niji|kin|gin)\b/i;
const STOP = new Set(["the", "a", "an", "of", "no", "to", "wa", "ga", "wo", "ni", "de", "and", "in", "on", "season", "movie", "part"]);
const base = (t) => flat((t || "").toLowerCase().replace(/^(zoku|zan|shin|gekijouban|gekijou-ban|eiga|the movie)\s+/, "").split(/[:\-–(]|\bseason\b|\bmovie\b|\b(?:2nd|3rd|\d+th)\b|\bii+\b/)[0]);
const artistParts = (a) => (a || "").split(/\s*(?:,|&|・|×|\bfeat\.?|\bx\b|\bwith\b)\s*/i).map(norm).filter(Boolean);
const ids = (rec) => Object.keys(rec.res).map(Number);
const correctCount = (rec) => ids(rec).filter((i) => rec.res[i].correct).length;
const onList = (x) => !!(x && x.listStatus && x.listStatus > 0);
const isRealTitle = (a) => { try { const list = PAGE.quiz.answerInput.typingInput.autoCompleteController.list; const f = (a || "").toLowerCase(); return Array.isArray(list) && list.some((x) => (x || "").toLowerCase() === f); } catch (e) { return false; } };
const isIsekai = (s) => [...(s.animeTags || []), ...(s.animeGenre || [])].includes("Isekai");
const LOVE_RE = /(^|[^\p{L}])(love|ai|koi|suki)([^\p{L}]|$)/iu;
const artistKey = (s) => { const x = s.artistInfo; return x && (x.artistId != null ? "a" + x.artistId : x.groupId != null ? "g" + x.groupId : null); };
const sameArtist = (a, b) => (artistKey(a) && artistKey(a) === artistKey(b)) || norm(a.artist || "") === norm(b.artist || "");
const sameFranchise = (a, b) => allNames(a).some((x) => { const p = base(x); return p.length >= 4 && allNames(b).some((y) => { const q = base(y); if (p === q) return true; const [sh, lo] = q.length < p.length ? [q, p] : [p, q]; return sh.length >= 6 && lo.startsWith(sh); }); });
const lastN = (ctx, n) => (ctx.hist.length >= n ? ctx.hist.slice(-n) : null);

// kind "global": same for everyone. kind "personal": depends on the player (id).
const RULES = {
  // Anime
  "Before 2010": { g: (c) => yearOf(c.s) < 2010 },
  "Before 1990": { g: (c) => yearOf(c.s) < 1990 },
  "Aired in the last 2 years": { g: (c) => yearOf(c.s) >= new Date().getFullYear() - 1 },
  "A sequel": { g: (c) => (c.s.seasonInfo && c.s.seasonInfo.name === "Season" && parseFloat(c.s.seasonInfo.number) >= 2) || titlesOf(c.s).some((t) => /\b(season|part)\s*[2-9]|\b(2nd|3rd|[4-9]th)\b|\bII+\b/i.test(t)) },
  "OVA/ONA/Special/Music": { g: (c) => /^(ova|ona|special|music)/i.test(c.s.animeType || "") },
  "Movie": { g: (c) => /^movie/i.test(c.s.animeType || "") },
  "Title is 7+ words long": { g: (c) => titlesOf(c.s).some((t) => words(t).length >= 7) },
  "Anime from your list twice in a row": { p: (c, id) => { const l = lastN(c, 2); return !!l && l.every((r) => onList(r.res[id])); } },
  "Same anime appears twice": { g: (c) => c.hist.slice(0, -1).some((r) => r.s.annId === c.s.annId) },
  "Same franchise appears twice in a row": { g: (c) => !!c.prev && allNames(c.prev.s).some((a) => { const b = base(a); return b.length >= 4 && allNames(c.s).some((t) => { const x = base(t); if (x === b) return true; const [sh, lo] = x.length < b.length ? [x, b] : [b, x]; return sh.length >= 6 && lo.startsWith(sh); }); }) },
  "One genre": { g: (c) => (c.s.animeGenre || []).length === 1 },
  "More than 5 genres": { g: (c) => (c.s.animeGenre || []).length > 5 },
  "Less than 4 tags": { g: (c) => (c.s.animeTags || []).length < 4 },
  "More than 15 tags": { g: (c) => (c.s.animeTags || []).length > 15 },
  "Song name is same as the anime title": { g: (c) => allNames(c.s).some((t) => flat(t) === flat(c.s.songName)) },
  "Tautogram (3 or more words start with the same letter)": { g: (c) => titlesOf(c.s).some((t) => { const n = {}; words(t).forEach((w) => { const k = w[0].toLowerCase(); n[k] = (n[k] || 0) + 1; }); return Object.values(n).some((v) => v >= 3); }) },
  "Title has \"no\" as a word (e.g. Shingeki no Kyojin)": { g: (c) => /(^|[^\p{L}])no([^\p{L}]|$)/iu.test((c.s.animeNames || {}).romaji || "") },
  "Title is one word": { g: (c) => words((c.s.animeNames || {}).romaji).length === 1 },
  "Isekai anime": { g: (c) => [...(c.s.animeTags || []), ...(c.s.animeGenre || [])].includes("Isekai") },
  "Sports anime": { g: (c) => (c.s.animeGenre || []).includes("Sports") },
  "Mecha anime": { g: (c) => (c.s.animeGenre || []).includes("Mecha") },
  // Song
  "OP/ED number higher than 2": { g: (c) => (c.s.type === 1 || c.s.type === 2) && c.s.typeNumber > 2 },
  "Song title is one word": { g: (c) => words(c.s.songName).length === 1 },
  "Song title contains a number": { g: (c) => /\d/.test(c.s.songName || "") },
  "Song title contains a color": { g: (c) => COLOR_RE.test(c.s.songName || "") },
  "Three of a kind: 3 OPs, EDs, or Inserts in a row": { g: (c) => { const l = lastN(c, 3); return !!l && l.every((r) => r.s.type === c.s.type); } },
  "Song title has Love, Ai, Koi, or Suki": { g: (c) => /(^|[^\p{L}])(love|ai|koi|suki)([^\p{L}]|$)/iu.test(c.s.songName || "") },
  "Song title is longer than the anime title": { g: (c) => (c.s.songName || "").length > ((c.s.animeNames || {}).romaji || "").length },
  "Song title is ALL CAPS": { g: (c) => isCaps(c.s.songName) },
  "Song difficulty 80% or higher": { g: (c) => c.s.animeDifficulty >= 80 },
  "Song difficulty 15% or lower": { g: (c) => c.s.animeDifficulty <= 15 },
  "Song works for 3 or more titles (3+ accepted anime)": { g: (c) => 1 + new Set((c.s.altAnimeNamesAnswers || []).map(flat)).size >= 3 },
  "\"ver.\", \"version\" or \"edit\" in the song title (e.g. TV ver., TV edit)": { g: (c) => /(^|[^\p{L}])(ver\.|version|edit)([^\p{L}]|$)/iu.test(c.s.songName || "") },
  // Artist
  "Artist name is ALL CAPS": { g: (c) => isCaps(c.s.artist) },
  "Weird capitalization (a capital in the middle of a word, like LiSA or nano.RIPE)": { g: (c) => (c.s.artist || "").split(/[\s・♥♡☆★×&\/,()（）]+/).some((w) => /\p{Ll}.*\p{Lu}/u.test(w.replace(/^Ma?c(?=\p{Lu})/u, ""))) },
  "Artist contains a symbol": { g: (c) => /[^\p{L}\p{N}\s,.'\-]/u.test(c.s.artist || "") },
  // Same artist even when credited differently: AMQ gives each artist/group a fixed id.
  "Same artist appears twice": { g: (c) => { const id = (x) => x && (x.artistId != null ? "a" + x.artistId : x.groupId != null ? "g" + x.groupId : null); const me = id(c.s.artistInfo); return c.hist.slice(0, -1).some((r) => (me && id(r.s.artistInfo) === me) || norm(r.s.artist || "") === norm(c.s.artist || "")); } },
  "Collab: \"feat.\" or \"&\" in the artist name": { g: (c) => /\bfeat\b|&/i.test(c.s.artist || "") },
  "Artist is also the composer": { g: (c) => { const comp = norm((c.s.composerInfo || {}).name || ""); return !!comp && (artistParts(c.s.artist).includes(comp) || norm(c.s.artist || "") === comp); } },
  "Parentheses ( ) in the artist name": { g: (c) => /[()（）]/.test(c.s.artist || "") },
  "Artist name starts with \"The\"": { g: (c) => /^the\s/i.test(c.s.artist || "") },
  // Individual
  "Get 3 songs in a row": { p: (c, id) => { const l = lastN(c, 3); return !!l && l.every((r) => r.res[id] && r.res[id].correct); } },
  "Get a solo": { p: (c, id) => ids(c.rec).length >= 2 && c.rec.res[id].correct && correctCount(c.rec) === 1 },
  "Get an anti-solo": { p: (c, id) => ids(c.rec).length >= 2 && !c.rec.res[id].correct && correctCount(c.rec) === ids(c.rec).length - 1 },
  "Snipe (get a song not on your list)": { p: (c, id) => c.rec.res[id].correct && !onList(c.rec.res[id]) },
  "Reach 30 points (hint mode)": { p: (c, id) => c.rec.res[id].score >= 30 },
  "Reach 10 points (no hints)": { p: (c, id) => c.rec.res[id].score >= 10 },
  "Reach 15 points (no hints)": { p: (c, id) => c.rec.res[id].score >= 15 },
  "Lock in slower than any of the other people who got it right": { p: (c, id) => { const me = c.rec.res[id]; if (!me.correct || me.answerTimeing == null) return false; const o = ids(c.rec).filter((i) => i !== id && c.rec.res[i].correct && c.rec.res[i].answerTimeing != null); return o.length > 0 && o.every((i) => me.answerTimeing > c.rec.res[i].answerTimeing); } },
  "Type within 5 seconds": { p: (c, id) => c.rec.res[id].answerTimeing != null && c.rec.res[id].answerTimeing < 5 },
  "Stay in the top 3 for 3 songs in a row": { p: (c, id) => { const l = lastN(c, 3); return !!l && ids(c.rec).length >= 4 && l.every((r) => r.res[id] && r.res[id].position <= 3); } },
  "Surpass 3 players in one song": { p: (c, id) => { const pr = c.prev && c.prev.res[id]; return !!pr && pr.position - c.rec.res[id].position >= 3; } },
  // Your own board only: AMQ echoes your submissions, and AMQ's title list tells real titles from half-typed ones.
  "Change your answer from another real title to the right one": { p: (c, id) => { const me = c.rec.res[id]; if (!me.correct || id !== myId()) return false; const fin = flat(c.rec.answers[id]); return (c.rec.mySubs || []).some((a) => flat(a) !== fin && isRealTitle(a)); } },
  "Unique right answer (a title no other correct player used)": { p: (c, id) => { const me = c.rec.res[id]; if (!me.correct) return false; const mine = flat(c.rec.answers[id]); const others = ids(c.rec).filter((i) => i !== id && c.rec.res[i].correct); return !!mine && others.length > 0 && others.every((i) => flat(c.rec.answers[i]) !== mine); } },
  "Flex answer (right with a different show the song also counts for)": { p: (c, id) => { const me = c.rec.res[id]; if (!me.correct) return false; const mine = flat(c.rec.answers[id]); const own = new Set([...titlesOf(c.s), ...(c.s.altAnimeNames || [])].map(flat)); const flex = new Set((c.s.altAnimeNamesAnswers || []).map(flat)); return !!mine && flex.has(mine) && !own.has(mine) && ids(c.rec).some((i) => i !== id && c.rec.res[i].correct); } },
  "Get the first song of the round right": { p: (c, id) => c.hist.length === 1 && c.rec.n === 1 && c.rec.res[id].correct },
  "Your wrong answer shares a word with the correct title": { p: (c, id) => { if (c.rec.res[id].correct) return false; const a = words(c.rec.answers[id]).map((w) => w.toLowerCase()).filter((w) => w.length > 2 && !STOP.has(w)); if (!a.length) return false; const t = new Set(allNames(c.s).flatMap(words).map((w) => w.toLowerCase())); return a.some((w) => t.has(w)); } },
  "Right franchise, wrong season or movie": { p: (c, id) => { if (c.rec.res[id].correct) return false; const b = base(c.rec.answers[id]); return b.length >= 4 && allNames(c.s).some((t) => base(t) === b); } },
  "Miss 3 songs in a row": { p: (c, id) => { const l = lastN(c, 3); return !!l && l.every((r) => r.res[id] && !r.res[id].correct); } },
  // ---- Expert versions (harder numbers / rarer situations) ----
  "Before 2000": { g: (c) => yearOf(c.s) < 2000 },
  "Aired this year": { g: (c) => yearOf(c.s) >= new Date().getFullYear() },
  "Season 4 or later": { g: (c) => !!c.s.seasonInfo && c.s.seasonInfo.name === "Season" && parseFloat(c.s.seasonInfo.number) >= 4 },
  "Anime title is one word of 4 letters or fewer": { g: (c) => { const t = (c.s.animeNames || {}).romaji; return words(t).length === 1 && flat(t).length <= 4; } },
  "Title has \"no\" twice (e.g. Boku no Kokoro no Yabai Yatsu)": { g: (c) => (((c.s.animeNames || {}).romaji || "").match(/(^|[^\p{L}])no(?=[^\p{L}]|$)/giu) || []).length >= 2 },
  "33 or more tags": { g: (c) => (c.s.animeTags || []).length >= 33 },
  "Only 1 or 2 tags": { g: (c) => { const n = (c.s.animeTags || []).length; return n >= 1 && n <= 2; } },
  "Same anime appears 3 times": { g: (c) => c.hist.filter((r) => r.s.annId === c.s.annId).length >= 3 },
  "Same franchise appears 3 times in one round": { g: (c) => c.hist.filter((r) => sameFranchise(r.s, c.s)).length >= 3 },
  "3 or more Isekai anime in one round": { g: (c) => isIsekai(c.s) && c.hist.filter((r) => isIsekai(r.s)).length === 3 },
  "5 or more Isekai anime in one round": { g: (c) => isIsekai(c.s) && c.hist.filter((r) => isIsekai(r.s)).length === 5 },
  "Four of a kind: 4 OPs, EDs, or Inserts in a row": { g: (c) => { const l = lastN(c, 4); return !!l && l.every((r) => r.s.type === c.s.type); } },
  "OP/ED number 5 or higher": { g: (c) => (c.s.type === 1 || c.s.type === 2) && c.s.typeNumber >= 5 },
  "Song title is one word of 3 letters or fewer": { g: (c) => words(c.s.songName).length === 1 && flat(c.s.songName).length <= 3 },
  "Song title has a number with 3+ digits (e.g. 100, 2024)": { g: (c) => /\d{3,}/.test(c.s.songName || "") },
  "Two love songs in a row (Love, Ai, Koi, Suki)": { g: (c) => { const l = lastN(c, 2); return !!l && l.every((r) => LOVE_RE.test(r.s.songName || "")); } },
  "Song title twice as long as the anime title": { g: (c) => { const a = ((c.s.animeNames || {}).romaji || "").length; return a > 0 && (c.s.songName || "").length >= 2 * a; } },
  "Song title and artist both ALL CAPS": { g: (c) => isCaps(c.s.songName) && isCaps(c.s.artist) },
  "Song difficulty 90% or higher": { g: (c) => c.s.animeDifficulty >= 90 },
  "Song difficulty 10% or lower": { g: (c) => c.s.animeDifficulty <= 10 },
  "Artist name has 2 or more different symbols": { g: (c) => new Set(((c.s.artist || "").match(/[^\p{L}\p{N}\s,.'\-]/gu) || [])).size >= 2 },
  "6 or more artists credited": { g: (c) => artistParts(c.s.artist).length >= 6 },
  "Same artist twice in a row": { g: (c) => !!c.prev && sameArtist(c.prev.s, c.s) },
  "Parentheses ( ) in the artist name two songs in a row": { g: (c) => { const l = lastN(c, 2); return !!l && l.every((r) => /[()（）]/.test(r.s.artist || "")); } },
  "Get 7 songs in a row": { p: (c, id) => { const l = lastN(c, 7); return !!l && l.every((r) => r.res[id] && r.res[id].correct); } },
  "Snipe 3 songs in one round": { p: (c, id) => c.rec.res[id].correct && !onList(c.rec.res[id]) && c.hist.filter((r) => r.res[id] && r.res[id].correct && !onList(r.res[id])).length === 3 },
  "Get the first 3 songs right": { p: (c, id) => c.hist.length === 3 && c.hist[0].n === 1 && c.hist.every((r) => r.res[id] && r.res[id].correct) },
  "Miss 5 in a row, then get one right": { p: (c, id) => { const l = lastN(c, 6); return !!l && l[5].res[id] && l[5].res[id].correct && l.slice(0, 5).every((r) => r.res[id] && !r.res[id].correct); } },
  "Get 3 solos in one round": { p: (c, id) => { const solo = (r) => Object.keys(r.res).length >= 2 && r.res[id] && r.res[id].correct && correctCount(r) === 1; return solo(c.rec) && c.hist.filter(solo).length === 3; } },
  "Everyone gets 3 songs in a row right": { g: (c) => { const l = lastN(c, 3); return !!l && l.every((r) => ids(r).length >= 2 && correctCount(r) === ids(r).length); } },
  "No one gets 2 songs in a row right": { g: (c) => { const l = lastN(c, 2); return !!l && l.every((r) => ids(r).length >= 1 && correctCount(r) === 0); } },
  "Last-place player gets a solo": { g: (c) => { if (!c.prev || correctCount(c.rec) !== 1) return false; const pos = ids(c.rec).filter((i) => c.prev.res[i]).map((i) => c.prev.res[i].position); if (pos.length < 3 || Math.max(...pos) === Math.min(...pos)) return false; const last = Math.max(...pos); return ids(c.rec).some((i) => c.prev.res[i] && c.prev.res[i].position === last && c.rec.res[i].correct); } },
  // ---- Tiles from the tile sets ----
  "Romance anime": { g: (c) => (c.s.animeGenre || []).includes("Romance") },
  "Mahou Shoujo anime": { g: (c) => (c.s.animeGenre || []).includes("Mahou Shoujo") },
  "Idol anime": { g: (c) => (c.s.animeTags || []).includes("Idol") },
  "Anime score 8.0 or higher": { g: (c) => parseFloat(c.s.animeScore) >= 8 },
  "Anime score below 6.0": { g: (c) => parseFloat(c.s.animeScore) < 6 },
  "Obscure anime (popularity rank above 3000)": { g: (c) => c.s.popularityRank > 3000 },
  "Top 100 most popular anime": { g: (c) => c.s.popularityRank > 0 && c.s.popularityRank <= 100 },
  "Season 3 or later": { g: (c) => !!c.s.seasonInfo && c.s.seasonInfo.name === "Season" && parseFloat(c.s.seasonInfo.number) >= 3 },
  "Same season twice in a row (e.g. two Spring anime)": { g: (c) => { const k = (s) => s.vintage && s.vintage.key; return !!c.prev && !!k(c.s) && k(c.s) === k(c.prev.s); } },
  "Same year twice in a row": { g: (c) => !!c.prev && !!yearOf(c.s) && yearOf(c.s) === yearOf(c.prev.s) },
  "English and romaji titles are the same": { g: (c) => { const n = c.s.animeNames || {}; return !!n.romaji && flat(n.romaji) === flat(n.english); } },
  "Song title has 5+ words": { g: (c) => words(c.s.songName).length >= 5 },
  "Song title has ! or ?": { g: (c) => /[!?！？]/.test(c.s.songName || "") },
  "Song title includes the anime's title": { g: (c) => { const song = flat(c.s.songName); return titlesOf(c.s).some((t) => { const b = base(t); return b.length >= 4 && song.includes(b) && song !== flat(t); }); } },
  "Sample starts in the first 5 seconds of the song": { g: (c) => c.rec.start != null && c.rec.start <= 5 },
  "More than 3 artists credited": { g: (c) => artistParts(c.s.artist).length >= 4 },
  "Artist name is one word": { g: (c) => words(c.s.artist).length === 1 },
  "Get 5 songs in a row": { p: (c, id) => { const l = lastN(c, 5); return !!l && l.every((r) => r.res[id] && r.res[id].correct); } },
  "Answer correctly in under 2 seconds": { p: (c, id) => { const me = c.rec.res[id]; return me.correct && me.answerTimeing != null && me.answerTimeing < 2; } },
  "Answer correctly in under 3 seconds": { p: (c, id) => { const me = c.rec.res[id]; return me.correct && me.answerTimeing != null && me.answerTimeing < 3; } },
  "Get the last song of the round right": { p: (c, id) => !!c.rec.last && c.rec.res[id].correct },
  "Be in 1st place after any song": { p: (c, id) => ids(c.rec).length >= 2 && c.rec.res[id].position === 1 && ids(c.rec).filter((i) => c.rec.res[i].position === 1).length === 1 && c.rec.res[id].score > 0 },
  "Exactly 2 people get it right": { g: (c) => correctCount(c.rec) === 2 },
  "Everyone gives the same answer": { g: (c) => { const a = ids(c.rec).map((i) => flat(c.rec.answers[i])); return a.length >= 2 && !!a[0] && a.every((x) => x === a[0]); } },
  "Tie for 1st place after song 10": { g: (c) => c.hist.length > 10 && ids(c.rec).filter((i) => c.rec.res[i].position === 1 && c.rec.res[i].score > 0).length >= 2 },
  "A song nobody has on their list": { g: (c) => ids(c.rec).length >= 1 && ids(c.rec).every((i) => !onList(c.rec.res[i])) },
  "Someone answers in under 2 seconds": { g: (c) => ids(c.rec).some((i) => c.rec.res[i].answerTimeing != null && c.rec.res[i].answerTimeing < 2) },
  // Hints. rec.hints = { gamePlayerId: [hintId, ...] } for this song; null when the log has no hint data.
  // Hint ids: 1 name, 2 info, 3 multiple choice, 4 audio, 5 tiny video, 6 blurred video (1 and 3 confirmed from logs).
  "Nobody uses a hint": { g: (c) => !!c.rec.hints && Object.keys(c.rec.hints).length === 0 },
  "More than 3 people use a hint": { g: (c) => !!c.rec.hints && Object.keys(c.rec.hints).length > 3 },
  "Somebody uses Song Info Hint": { g: (c) => !!c.rec.hints && Object.values(c.rec.hints).some((h) => h.includes(2)) },
  "Never use a hint but be in top 5": { p: (c, id) => !!c.rec.last && c.hist.every((r) => r.hints && !(r.hints[id] || []).length) && c.rec.res[id].position <= 5 && c.rec.res[id].score > 0 },
  "Name hint revealed more than half of the title": { p: (c, id) => !!c.rec.nameHint && c.rec.nameHint.id === id && c.rec.nameHint.shown > 0.5 },
  // Multiplayer
  "Everyone gets a song right": { g: (c) => ids(c.rec).length >= 2 && correctCount(c.rec) === ids(c.rec).length },
  "No one gets a song right": { g: (c) => ids(c.rec).length >= 1 && correctCount(c.rec) === 0 },
  "Both players next to you guess it right (if you're on the edge, 1)": { p: (c, id) => { const seats = ids(c.rec).filter((i) => game.players[i]).sort((a, b) => game.players[a].seat - game.players[b].seat); const k = seats.indexOf(id); if (k < 0) return false; const nb = [seats[k - 1], seats[k + 1]].filter((x) => x != null); return nb.length > 0 && nb.every((i) => c.rec.res[i].correct); } },
  "Someone types an emoji in chat": { g: (c) => c.rec.chat },
  "The player in 1st place misses, you get it right": { p: (c, id) => { if (!c.prev || !c.rec.res[id].correct) return false; if (!c.prev.res[id] || c.prev.res[id].position === 1) return false; const firsts = ids(c.rec).filter((i) => i !== id && c.prev.res[i] && c.prev.res[i].position === 1); return firsts.some((i) => !c.rec.res[i].correct); } },
  "A song from only 1 person's list": { g: (c) => ids(c.rec).filter((i) => onList(c.rec.res[i])).length === 1 },
  "A song from 5 or more people's list": { g: (c) => ids(c.rec).filter((i) => onList(c.rec.res[i])).length >= 5 },
  "2 or more people share the same wrong answer": { g: (c) => { const seen = {}; return ids(c.rec).some((i) => { if (c.rec.res[i].correct) return false; const a = flat(c.rec.answers[i]); if (!a) return false; seen[a] = (seen[a] || 0) + 1; return seen[a] >= 2; }); } },
  "Last-place player gets it right": { g: (c) => { if (!c.prev) return false; const pos = ids(c.rec).filter((i) => c.prev.res[i]).map((i) => c.prev.res[i].position); if (pos.length < 2 || Math.max(...pos) === Math.min(...pos)) return false; const last = Math.max(...pos), inLast = ids(c.rec).filter((i) => c.prev.res[i] && c.prev.res[i].position === last); return inLast.length === 1 && c.rec.res[inLast[0]].correct; } },
  "Half of the people get it right": { g: (c) => ids(c.rec).length >= 2 && correctCount(c.rec) === Math.floor(ids(c.rec).length / 2) },
  "Someone else disconnects": { g: (c) => c.rec.left },
};
const AUTO = new Set(Object.keys(RULES));
// Tiles the script can't be sure about: it asks the player to confirm instead of marking.
const ASK = {
  "Idol group or unit (real or from an idol anime)": { g: (c) => (c.s.animeGenre || []).includes("Music") && (c.s.animeTags || []).includes("Idol"), q: "Idol group?" },
};

function ctxFor(rec) { return { rec, s: rec.s, hist: game.hist, prev: game.hist[game.hist.length - 2] || null }; }
function testTile(text, ctx, id) {
  const r = RULES[text]; if (!r) return false;
  try { return r.g ? !!r.g(ctx) : (id != null && !!ctx.rec.res[id] && !!r.p(ctx, id)); } catch (e) { return false; }
}

/* ---------------- tile packs: custom tiles and settings ---------------- */
// Tile sets: TILESETS rows are [column, difficulty E/M/H, auto 1/0, sets "CSX", text]. Standard = the website's tiles.
const SET_NAMES = { C: "Casual", S: "Standard", X: "Expert" };
const SET_INFO = { C: "Easier, hints on.", S: "Standard experience.", X: "Harder." };
const SET_CAP = { C: 1, S: 1, X: 3 };
function poolsFor(set, manual) {
  return COLS.map((c, i) => TILESETS.filter((r) => r[0] === i && r[3].includes(set) && (manual || r[2])).map((r) => ({ text: r[4], hard: r[1] === "H", d: r[1] })));
}
const DEFAULT_POOLS = COLS.map((c) => c.pool.slice());
const DEFAULT_SETTINGS = { set: "S", manual: true, hardCap: 1, replace: true, auto: true, needCorrect: false, onePerSong: false, wild: true, lockAuto: false, soloMix: false };
// Settings as a 10-character token, e.g. "X131100100", so players can load a tile set without DMs.
const RULE_KEYS = ["manual", "hardCap", "replace", "auto", "needCorrect", "onePerSong", "wild", "lockAuto", "soloMix"];
function encodeRules(st) { return (st.set || "S") + RULE_KEYS.map((k) => (k === "hardCap" ? Math.min(9, st.hardCap | 0) : st[k] ? 1 : 0)).join(""); }
function decodeRules(tok) {
  if (!/^[CSX][0-9]{9}$/.test(tok || "")) return null;
  const st = { ...DEFAULT_SETTINGS, set: tok[0] };
  RULE_KEYS.forEach((k, i) => { const d = Number(tok[i + 1]); st[k] = k === "hardCap" ? d : d === 1; });
  return st;
}
let SETTINGS = { ...DEFAULT_SETTINGS };
const COL_ALIASES = { anime: 0, song: 1, songs: 1, artist: 2, artists: 2, individual: 3, ind: 3, "meta (individual)": 3, multiplayer: 4, multi: 4, "meta (multiplayer)": 4 };

// Text format: "Anime: tile" per line, or a "[Song]" / "Song:" header followed by tiles. "*" in front = hard tile.
function parseTiles(text) {
  const cols = [[], [], [], [], []], errors = []; let cur = null;
  (text || "").split(/\r?\n/).forEach((raw, n) => {
    const line = raw.trim(); if (!line || line.startsWith("#")) return;
    const head = line.match(/^\[(.+)\]$/) || line.match(/^([^:]+):$/);
    if (head) { const k = COL_ALIASES[head[1].trim().toLowerCase()]; if (k == null) errors.push(`Line ${n + 1}: unknown column "${head[1]}"`); else cur = k; return; }
    const inl = line.match(/^([^:]{3,20}):\s*(.+)$/); let col = cur, tile = line;
    if (inl && COL_ALIASES[inl[1].trim().toLowerCase()] != null) { col = COL_ALIASES[inl[1].trim().toLowerCase()]; tile = inl[2].trim(); }
    if (col == null) { errors.push(`Line ${n + 1}: no column for "${line}"`); return; }
    const hard = tile.startsWith("*"), easy = !hard && tile.startsWith("-"); tile = tile.replace(/^[*-]\s*/, "");
    if (tile.length > 90) tile = tile.slice(0, 90);
    cols[col].push({ text: tile, hard, d: hard ? "H" : easy ? "E" : "M" });
  });
  return { cols, errors };
}
function packOf(custom, settings) {
  const body = JSON.stringify({ m: custom.mode || "add", t: custom.text || "", s: settings });
  const isStd = !(custom.text || "").trim() && Object.keys(DEFAULT_SETTINGS).every((k) => settings[k] === DEFAULT_SETTINGS[k]);
  const v = hash32(body); let id = ""; for (let i = 0, x = v; i < 4; i++) { id += B32[x % 32]; x = Math.floor(x / 32); }
  return { id: isStd ? "" : id, body };
}
// Apply a pack to this client. Returns an error string if a column would be too small.
function applyPack(body) {
  let m = "add", t = "", st = DEFAULT_SETTINGS;
  if (body) { try { const o = JSON.parse(body); m = o.m; t = o.t; st = { ...DEFAULT_SETTINGS, ...o.s }; } catch (e) { return "Couldn't read the tile pack."; } }
  const { cols } = parseTiles(t);
  const setPools = poolsFor(st.set || "S", st.manual !== false);
  const pools = COLS.map((c, i) => {
    const base = m === "replace" ? [] : setPools[i], seen = new Set(base.map((x) => x.text));
    cols[i].forEach((x) => { if (!seen.has(x.text)) { seen.add(x.text); base.push(x); } });
    return base;
  });
  const short = COLS.find((c, i) => pools[i].length < (c.wild ? 4 : 5));
  if (short) return `The ${short.name} column needs at least ${short.wild ? 4 : 5} tiles.`;
  COLS.forEach((c, i) => { c.pool = pools[i]; });
  SETTINGS = st;
  return "";
}
// Same algorithm as the website's buildBoard, with the hard-tile limit from the settings.
function makeBoard(name, code, variant) {
  const r = rng(norm(name) + "|" + code + "|" + variant), cap = SETTINGS.hardCap, wildOn = SETTINGS.wild !== false, fams = new Set();
  const mix = !!SETTINGS.soloMix, picksSoFar = [];
  const picks = COLS.map((c, ci) => {
    const n = c.wild && wildOn ? 4 : 5, out = []; let hard = 0;
    // Solo: the Multiplayer column is replaced by a mix of leftover tiles from the other four columns.
    if (mix && ci === 4) {
      const used = new Set(); for (let k = 0; k < 4; k++) (picksSoFar[k] || []).forEach((t) => used.add(t.text));
      const pool = COLS.slice(0, 4).flatMap((cc, k) => cc.pool.filter((t) => !used.has(t.text)).map((t) => ({ ...t, from: k })));
      for (const t of shuffle(pool, r)) { if (out.length === n) break; if (t.hard && hard >= cap) continue; const f = FAMILY[t.text]; if (f && fams.has(f)) continue; out.push(t); if (t.hard) hard++; if (f) fams.add(f); }
      return out;
    }
    for (const t of shuffle(c.pool, r)) { if (out.length === n) break; if (t.hard && hard >= cap) continue; const f = FAMILY[t.text]; if (f && fams.has(f)) continue; out.push(t); if (t.hard) hard++; if (f) fams.add(f); }
    if (out.length < n) for (const t of shuffle(c.pool, r)) { if (out.length === n) break; if (!out.includes(t)) out.push(t); }
    picksSoFar[ci] = out;
    return out;
  });
  const cells = [];
  for (let row = 0; row < 5; row++) for (let c = 0; c < 5; c++) {
    if (c === 2 && row === 2 && wildOn) { cells.push({ wild: true, col: c }); continue; }
    const idx = c === 2 && row > 2 && wildOn ? row - 1 : row;
    const t = picks[c][idx]; cells.push({ ...t, col: t && t.from != null ? t.from : c });
  }
  return cells;
}

/* ---------------- confetti ---------------- */
function confetti(host) {
  if (!host || (window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches)) return;
  const layer = h("div", { style: "position:absolute;inset:0;pointer-events:none;overflow:hidden;z-index:10" });
  host.appendChild(layer);
  const colors = ["#ff4f93", "#ffd166", "#4f8cff", "#3fbf7f", "#b37bff", "#ff9f43"];
  for (let i = 0; i < 46; i++) {
    const piece = h("span", { style: `position:absolute;left:${10 + Math.random() * 80}%;top:38%;width:${5 + Math.random() * 5}px;height:${8 + Math.random() * 6}px;background:${colors[i % colors.length]};border-radius:2px` });
    layer.appendChild(piece);
    const dx = (Math.random() - 0.5) * 320, up = -120 - Math.random() * 160, down = 260 + Math.random() * 160;
    piece.animate([
      { transform: "translate(0,0) rotate(0)", opacity: 1 },
      { transform: `translate(${dx * 0.6}px,${up}px) rotate(${Math.random() * 360}deg)`, opacity: 1, offset: 0.35 },
      { transform: `translate(${dx}px,${down}px) rotate(${Math.random() * 720}deg)`, opacity: 0 },
    ], { duration: 1500 + Math.random() * 700, easing: "cubic-bezier(.2,.7,.4,1)" });
  }
  setTimeout(() => layer.remove(), 2400);
}

/* ---------------- AnisongDB: "right artist, wrong anime" ---------------- */
const ARTIST_TILE = "Right artist, wrong anime (your answer has a song by this artist)";
RULES[ARTIST_TILE] = { p: () => false }; AUTO.add(ARTIST_TILE); // marked later, once AnisongDB answers
const artistCache = {};
function postJSON(url, body) {
  return new Promise((resolve, reject) => {
    if (typeof GM_xmlhttpRequest === "function") {
      GM_xmlhttpRequest({ method: "POST", url, data: JSON.stringify(body), headers: { "Content-Type": "application/json" }, timeout: 10000,
        onload: (r) => { try { resolve(JSON.parse(r.responseText)); } catch (e) { reject(e); } }, onerror: reject, ontimeout: reject });
    } else fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }).then((r) => r.json()).then(resolve, reject);
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
      (Array.isArray(rows) ? rows : []).forEach((x) => [x.animeENName, x.animeJPName, ...(x.animeAltName || [])].forEach((n) => n && names.add(flat(n))));
      return names;
    }).catch((e) => { console.warn("[AMQ Bingo] AnisongDB lookup failed", e); delete artistCache[key]; return null; });
  }
  return artistCache[key];
}
// Which players answered a different anime that also has a song by this artist.
async function artistMatches(rec) {
  const wrong = ids(rec).filter((i) => !rec.res[i].correct && flat(rec.answers[i]));
  if (!wrong.length) return [];
  const names = await animeByArtist(rec.s.artist); if (!names) return [];
  const right = new Set(allNames(rec.s).map(flat));
  return wrong.filter((i) => { const a = flat(rec.answers[i]); return names.has(a) && !right.has(a); });
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
      .catch((e) => { console.warn("[AMQ Bingo] AnisongDB lookup failed", e); delete annCache[annId]; return null; });
  }
  return annCache[annId];
}
const songCategory = (rec) => annRows(rec.s.annId).then((rows) => { const row = rows && rows.find((x) => Number(x.annSongId) === Number(rec.s.annSongId)); return row ? String(row.songCategory || "").toLowerCase() : null; });
const INSERT_TILE = "Show has 3 or more insert songs";
const ASYNC_TILES = {
  [INSERT_TILE]: (rec) => annRows(rec.s.annId).then((rows) => !!rows && rows.filter((x) => /insert/i.test(String(x.songType || ""))).length >= 3),
  "Instrumental": (rec) => songCategory(rec).then((c) => c === "instrumental"),
  "Chanting": (rec) => songCategory(rec).then((c) => c === "chanting"),
};
Object.keys(ASYNC_TILES).forEach((t) => { RULES[t] = { g: () => false }; AUTO.add(t); }); // marked later, once AnisongDB answers

/* ---------------- messaging ---------------- */
// Players AMQ refused to let us message (level-5 rule). Cleared as soon as a message to them goes through.
let lastOwnDM = 0, lastDMTarget = "";
const dmBlocked = new Map(); // name -> time; retried after a minute
function sendDM(target, message) {
  if (!target || norm(target) === norm(myName()) || Date.now() - (dmBlocked.get(norm(target)) || 0) < 60000) return;
  lastOwnDM = Date.now(); lastDMTarget = norm(target);
  console.log("[AMQ Bingo] DM ->", target, message.slice(0, 60));
  try { PAGE.socket.sendCommand({ type: "social", command: "chat message", data: { target, message } }); } catch (e) { console.warn("[AMQ Bingo] DM failed", e); }
}
function sendGameChat(msg) {
  try { PAGE.socket.sendCommand({ type: "lobby", command: "game chat message", data: { msg, teamMessage: false } }); } catch (e) { console.warn("[AMQ Bingo] chat failed", e); }
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
function makePanel(id, title, side, extra, onClose) {
  const body = h("div", { class: "amqb-body" });
  const sub = h("small", {});
  const panel = h("div", { class: "amqb-panel", id, style: `${side}:16px;display:none` },
    h("div", { class: "amqb-head" }, h("span", {}, h("b", {}, title), sub),
      h("span", {}, extra, h("button", { class: "amqb-x", title: "Close", onclick: () => { panel.style.display = "none"; if (onClose) onClose(); } }, "×"))),
    body);
  // Drag by the header. The header always stays on screen, so the panel can't be lost.
  const head = panel.firstChild, saveKey = "pos." + id;
  const clamp = () => {
    if (panel.classList.contains("docked") || panel.style.display === "none" || panel.style.left === "") return;
    const w = panel.offsetWidth, x = parseFloat(panel.style.left) || 0, y = parseFloat(panel.style.top) || 0;
    panel.style.left = Math.max(80 - w, Math.min(window.innerWidth - 80, x)) + "px";
    panel.style.top = Math.max(0, Math.min(window.innerHeight - 40, y)) + "px";
  };
  const savePos = () => { if (!panel.classList.contains("docked")) S.set(saveKey, { x: panel.style.left, y: panel.style.top, w: panel.style.width, h: panel.style.height }); };
  const resetPos = () => { panel.style.left = ""; panel.style.top = "70px"; panel.style[side] = "16px"; panel.style.width = ""; panel.style.height = ""; S.set(saveKey, null); };
  head.addEventListener("mousedown", (e) => {
    if (e.target.closest("button") || panel.classList.contains("docked")) return;
    const r = panel.getBoundingClientRect(), dx = e.clientX - r.left, dy = e.clientY - r.top;
    const mv = (ev) => { panel.style.left = ev.clientX - dx + "px"; panel.style.top = ev.clientY - dy + "px"; panel.style.right = "auto"; clamp(); };
    const up = () => { document.removeEventListener("mousemove", mv); document.removeEventListener("mouseup", up); savePos(); };
    document.addEventListener("mousemove", mv); document.addEventListener("mouseup", up);
  });
  head.title = "Drag to move. Double-click to put it back in the corner.";
  head.addEventListener("dblclick", (e) => { if (!e.target.closest("button") && !panel.classList.contains("docked")) resetPos(); });
  window.addEventListener("resize", clamp);
  // Resizable from the bottom-right corner; the size is remembered.
  try { new ResizeObserver(() => { if (panel.style.display !== "none" && !panel.classList.contains("docked") && (panel.style.width || panel.style.height)) savePos(); }).observe(panel); } catch (e) {}
  panel.addEventListener("mouseup", () => { if (!panel.classList.contains("docked") && panel.offsetWidth && (panel.style.width || panel.style.height)) savePos(); });
  // Scroll ourselves, so AMQ's own wheel handling can't block scrolling inside the panel.
  panel.addEventListener("wheel", (e) => {
    let el = e.target;
    while (el && el !== panel.parentNode) {
      if (el.scrollHeight > el.clientHeight + 1 && /(auto|scroll)/.test(getComputedStyle(el).overflowY)) break;
      el = el.parentElement;
    }
    if (!el || el === panel.parentNode) return;
    el.scrollTop += e.deltaMode === 1 ? e.deltaY * 16 : e.deltaY; e.preventDefault(); e.stopPropagation();
  }, { passive: false });
  const saved = S.get(saveKey, null);
  if (saved) { if (saved.x) { panel.style.left = saved.x; panel.style.top = saved.y; panel.style.right = "auto"; } if (saved.w) panel.style.width = saved.w; if (saved.h) panel.style.height = saved.h; }
  // keep AMQ from grabbing keys typed in our inputs
  panel.addEventListener("keydown", (e) => { if (e.target.matches("input,select")) e.stopPropagation(); });
  document.body.appendChild(panel);
  return { panel, body, sub, resetPos, toggle: () => { panel.style.display = panel.style.display === "none" ? "" : "none"; clamp(); } };
}

/* ---------------- docking the board into the chat column ---------------- */
// AMQ's chat messages box. These ids are best guesses; Alt+Shift+D copies the real layout if none match.
const CHAT_SELECTORS = ["#gcMessageContainer", "#gcChatContent", "#gcContent", "#gcContainer"];
const findChat = () => { for (const s of CHAT_SELECTORS) { const el = document.querySelector(s); if (el && el.offsetHeight > 80) return el; } return null; };
let dock = null; // { chat, saved: {top,height,flex} }

function undockBoard() {
  if (!dock) return;
  const { chat, saved } = dock;
  chat.style.top = saved.top; chat.style.height = saved.height; chat.style.flex = saved.flex; if (dock.restoreMargin) chat.style.marginTop = "";
  const pnl = playerUI.panel;
  pnl.classList.remove("docked"); const g = pnl.querySelector(".amqb-grip"); if (g) g.remove();
  pnl.style.cssText = "right:16px;top:70px;display:" + pnl.style.display;
  document.body.appendChild(pnl);
  dock = null;
}
function dockBoard() {
  undockBoard();
  const chat = findChat(), pnl = playerUI.panel;
  if (!chat) return false;
  const cs = getComputedStyle(chat), r = chat.getBoundingClientRect();
  if (r.height < 230) return false;
  dock = { chat, saved: { top: chat.style.top, height: chat.style.height, flex: chat.style.flex }, restoreMargin: false,
    total: r.height, origTop: chat.offsetTop, abs: cs.position === "absolute" || cs.position === "fixed", autoBottom: cs.bottom === "auto" };
  const origLeft = chat.offsetLeft, w = chat.offsetWidth;
  pnl.classList.add("docked");
  const parent = chat.offsetParent || chat.parentElement;
  if (getComputedStyle(parent).position === "static") parent.style.position = "relative";
  parent.appendChild(pnl);
  pnl.style.left = origLeft + "px"; pnl.style.top = dock.origTop + "px"; pnl.style.width = w + "px"; pnl.style.right = "auto";
  setDockHeight(Math.round(r.height * (P.dockRatio || 0.6)));
  // Drag handle along the bottom edge: sets how much of the chat column the board takes.
  if (!pnl.querySelector(".amqb-grip")) {
    const grip = h("div", { class: "amqb-grip", title: "Drag to give the board or the chat more room. Double-click to reset." });
    grip.addEventListener("mousedown", (e) => {
      if (!dock) return; e.preventDefault();
      const y0 = e.clientY, h0 = pnl.offsetHeight;
      const mv = (ev) => setDockHeight(h0 + ev.clientY - y0);
      const up = () => { document.removeEventListener("mousemove", mv); document.removeEventListener("mouseup", up); if (dock) { P.dockRatio = pnl.offsetHeight / dock.total; saveP(); } };
      document.addEventListener("mousemove", mv); document.addEventListener("mouseup", up);
    });
    grip.addEventListener("dblclick", () => { P.dockRatio = 0.6; saveP(); if (dock) setDockHeight(Math.round(dock.total * 0.6)); });
    pnl.appendChild(grip);
  }
  return true;
}
// Board height when docked; the chat gets the rest (at least 70px each way).
function setDockHeight(dh) {
  if (!dock) return;
  const pnl = playerUI.panel, chat = dock.chat;
  dh = Math.max(120, Math.min(dock.total - 70, Math.round(dh)));
  pnl.style.height = dh + "px";
  // Cells shrink with the board so all 5 rows stay visible; stats and buttons scroll below.
  const cellH = Math.max(26, Math.min(56, Math.floor((dh - 165) / 5))); // leaves room for the song log under the board
  pnl.style.setProperty("--cellh", cellH + "px"); pnl.style.setProperty("--cellf", Math.max(8, Math.min(10.5, cellH / 4.6)).toFixed(1) + "px");
  if (dock.abs) { chat.style.top = (dock.origTop + dh) + "px"; if (dock.autoBottom) chat.style.height = (dock.total - dh) + "px"; }
  else { chat.style.flex = "0 0 auto"; chat.style.height = (dock.total - dh) + "px"; chat.style.marginTop = dh + "px"; dock.restoreMargin = true; }
  // keep the newest chat line in view
  chat.scrollTop = chat.scrollHeight;
}
function placeBoard() {
  if (!playerUI) return;
  const shown = playerUI.panel.style.display !== "none";
  if (!shown) { undockBoard(); return; }
  if (P.dock !== false) { if (!dockBoard()) { undockBoard(); if (!placeBoard.warned) { placeBoard.warned = true; sysMsg("AMQ Bingo: couldn't find the chat panel, so the board is a popup. Press Alt+Shift+D and send the copied text to Claude."); } } }
  else undockBoard();
}
function copyChatLayout() {
  const out = [];
  const chatish = [...document.querySelectorAll("[id^=gc], [id*=Chat], [id*=chat]")].slice(0, 40);
  chatish.forEach((el) => { const r = el.getBoundingClientRect(), cs = getComputedStyle(el); out.push(`#${el.id} <${el.tagName.toLowerCase()} class="${el.className}"> pos=${cs.position} display=${cs.display} rect=${Math.round(r.left)},${Math.round(r.top)} ${Math.round(r.width)}x${Math.round(r.height)} parent=#${el.parentElement && el.parentElement.id}`); });
  const text = out.join("\n") || "no chat elements found";
  navigator.clipboard.writeText(text).then(() => sysMsg("AMQ Bingo: chat layout copied. Paste it to Claude."), () => { console.log(text); sysMsg("AMQ Bingo: couldn't copy; the layout is in the console (F12)."); });
}

/* =====================================================================
 * PLAYER BOARD
 * ===================================================================== */
let P = S.get("player", { round: 0, code: "", host: "", boards: {} });
const saveP = () => S.set("player", P);
const boardKey = () => norm(myName()) + "|" + P.round + "|" + P.code;
const curBoard = () => P.boards[boardKey()];
let playerUI, flashUntil = 0, autoLog = [], note = "";
// One log row per song: marks and notices for the same song are merged.
function logAdd(e) {
  const top = autoLog[0];
  if (top && top.n === e.n) { top.hits = [...(top.hits || []), ...(e.hits || [])]; if (e.note) top.note = top.note ? top.note + " " + e.note : e.note; }
  else autoLog.unshift({ ...e, hits: e.hits || [] });
  if (autoLog.length > 30) autoLog.length = 30;
}

let pendingJoin = null, packParts = {};
function announceSeen(round, code, hostName, packId, rulesTok) {
  packId = packId || "";
  // Tile set + settings only (no custom tiles): rebuild the pack from the announcement, no DM needed.
  const st = packId && decodeRules(rulesTok);
  if (st && packId !== (P.packId || "")) {
    const pk = packOf({ mode: "add", text: "" }, st);
    if (pk.id === packId && !applyPack(pk.body)) { P.packId = packId; P.packBody = pk.body; saveP(); joinRound(round, code, hostName); return true; }
  }
  if (packId === (P.packId || "")) { joinRound(round, code, hostName); return true; }
  if (!packId) { applyPack(""); P.packId = ""; P.packBody = ""; saveP(); joinRound(round, code, hostName); return true; }
  pendingJoin = { round, code, hostName, packId };
  if (hostName.toLowerCase() === myName().toLowerCase()) { receivePack(packId, H.packBody || ""); return true; }
  sendDM(hostName, `${PREFIX} NEED ${packId}`);
  sysMsg("AMQ Bingo: getting the host's custom tiles…");
  return false;
}
function receivePack(id, body) {
  if (!pendingJoin || pendingJoin.packId !== id) return;
  const err = applyPack(body);
  if (err) { sysMsg("AMQ Bingo: " + err); return; }
  P.packId = id; P.packBody = body; saveP();
  const j = pendingJoin; pendingJoin = null;
  joinRound(j.round, j.code, j.hostName);
  sysMsg(`AMQ Bingo: custom tiles loaded. Joined round ${j.round}.`);
}
function onPackChunk(parts) {
  const [, id, pos, chunk] = parts; const [i, n] = pos.split("/").map(Number);
  const bag = (packParts[id] = packParts[id] || {}); bag[i] = chunk;
  if (Object.keys(bag).length === n) {
    let body = ""; try { body = decodeURIComponent(Array.from({ length: n }, (_, k) => bag[k + 1]).join("")); } catch (e) { return; }
    if (packOf({ mode: JSON.parse(body).m, text: JSON.parse(body).t }, { ...DEFAULT_SETTINGS, ...JSON.parse(body).s }).id !== id) return;
    delete packParts[id]; receivePack(id, body);
  }
}

function joinRound(round, code, hostName) {
  if (!myName()) return;
  const nb = P.nextBoard; P.nextBoard = null;
  P.round = round; P.code = code; P.bcode = nb && nb.bcode !== code ? nb.bcode : ""; if (hostName) P.host = hostName;
  if (!curBoard()) {
    const fresh = { variant: 0, firstAt: Date.now(), marks: [], auto: {}, wild: "", wildOn: false, lost: false, bcode: bcode() };
    // Same board as before: reuse its layout (replacement too), and with "+" also its marks and wild card.
    const prev = nb && Object.values(P.boards).filter((x) => x.bcode === nb.bcode && x !== fresh).sort((a, b) => (b.joinedAt || b.firstAt) - (a.joinedAt || a.firstAt))[0];
    if (prev) { fresh.variant = prev.variant; fresh.firstAt = prev.firstAt; if (nb.keep) Object.assign(fresh, { marks: prev.marks.slice(), auto: { ...prev.auto }, wild: prev.wild, wildOn: prev.wildOn, lost: prev.lost, called: prev.called }); }
    fresh.joinedAt = Date.now();
    P.boards[boardKey()] = fresh;
  }
  saveP(); autoLog = []; renderPlayer(); queueSync(true);
}

// Boards can outlive a round: with "same board" rounds, the board comes from an earlier round's code.
const bcode = () => P.bcode || P.code;
const claimOf = (b) => makeClaim(myName(), bcode(), b.variant, SETTINGS.wild === false ? { ...b, wild: "", wildOn: b.marks.includes(12) } : b);
function cellsNow() { const b = curBoard(); return b ? makeBoard(myName(), bcode(), b.variant) : null; }
function linesOf(b) {
  const on = new Set(b.marks); if (b.wildOn && SETTINGS.wild !== false) on.add(12);
  return LINES.filter((l) => l.every((i) => on.has(i)));
}

/* ---------------- solo speedrun timer ---------------- */
// In a solo game the board gets a clock: it starts with the first song and stops at your first bingo.
const isSolo = () => Object.keys(game.players).length === 1;
const fmtTime = (ms) => { const t = Math.max(0, Math.round(ms / 1000)); return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, "0")}`; };
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
  try { if (PAGE.lobby && PAGE.lobby.settings && PAGE.lobby.settings.songSelection) return PAGE.lobby.settings; } catch (e) {}
  return game.roomSettings || null;
}
// Which leaderboard a run belongs to. "Speedrun · Random/Watched" only when every rule matches.
function speedCategory() {
  const st = roomSettingsNow(), sel = st && st.songSelection && st.songSelection.standardValue;
  const cat = sel === 1 ? "Random" : sel === 3 ? "Watched" : "Mixed", why = [];
  if (!Object.keys(SPEEDRUN_TILES).every((k) => SETTINGS[k] === SPEEDRUN_TILES[k])) why.push("bingo settings");
  if (!st) why.push("room settings unknown");
  else {
    const want = speedrunRoom(cat === "Random" ? "random" : "watched");
    const same = (k) => JSON.stringify(st[k]) === JSON.stringify(want[k]);
    if (cat === "Mixed") why.push("song selection");
    if (!(st.guessTime && !st.guessTime.randomOn && st.guessTime.standardValue === 20) || !(st.extraGuessTime && st.extraGuessTime.standardValue === 0)) why.push("guess time");
    if (!same("songType") || !same("openingCategories") || !same("endingCategories") || !same("insertCategories")) why.push("song types");
    const d = st.songDifficulity; if (!(d && ((d.advancedOn && d.advancedValue[0] === 0 && d.advancedValue[1] === 100) || (!d.advancedOn && Object.values(d.standardValue).every(Boolean))))) why.push("difficulty");
    if (!(st.playbackSpeed && !st.playbackSpeed.randomOn && st.playbackSpeed.standardValue === 1)) why.push("playback speed");
  }
  return { key: why.length ? `Custom · ${cat}` : `Speedrun · ${cat}`, official: !why.length, why };
}
const speedKey = () => { const b = curBoard(); return (b && b.speed && b.speed.key) || speedCategory().key; };
function speedStart() {
  const b = curBoard(); if (!b || b.speed || !isSolo() || linesOf(b).length) return;
  const c = speedCategory();
  b.speed = { start: Date.now(), seq0: game.seq || 0, key: c.key, why: c.why }; saveP();
  if (!c.official) sysMsg(`AMQ Bingo speedrun: this run counts as "${c.key}" (differs from the speedrun rules: ${c.why.join(", ")}). Use Speedrun: Random or Watched in the host Settings for an official run.`);
}
function speedCheck(b, lines) {
  if (!b.speed || b.speed.end || !lines) return;
  const sp = b.speed; sp.end = Date.now(); sp.songs = (game.seq || 0) - sp.seq0;
  const key = speedKey(), pb = (P.pb = P.pb || {})[key], ms = sp.end - sp.start;
  sp.best = !pb || ms < pb.ms; if (sp.best) P.pb[key] = { ms, songs: sp.songs, at: Date.now() };
  saveP();
  sysMsg(`AMQ Bingo speedrun: bingo in ${fmtTime(ms)} over ${sp.songs} song${sp.songs === 1 ? "" : "s"}` + (sp.best ? (pb ? ` — new best! (was ${fmtTime(pb.ms)})` : " — first record!") : ` (best ${fmtTime(pb.ms)})`));
}
setInterval(() => {
  const el = document.getElementById("amqbSpeed"), b = curBoard();
  if (el && b && b.speed && !b.speed.end) el.firstChild.textContent = `⏱ ${fmtTime(Date.now() - b.speed.start)} · ${(game.seq || 0) - b.speed.seq0} songs`;
}, 1000);

// Version check: "0.34" vs "0.33" etc.
let warnedVersion = false;
function newerVersion(a, b) { const x = String(a).split(".").map(Number), y = String(b).split(".").map(Number); for (let i = 0; i < Math.max(x.length, y.length); i++) { const d = (x[i] || 0) - (y[i] || 0); if (d) return d > 0; } return false; }

// Last revealed song number: manual marks count for it (one-tile-per-song limit).
// Songs are keyed by a counter that never resets, since song numbers restart every AMQ game.
const lastSongN = () => game.seq || 0;
// Auto-mark tile i for song n. With "one tile per song", several matches become a pick instead.
function autoMark(b, i, rec) {
  if (b.marks.includes(i)) return false;
  const key = rec.seq;
  if (SETTINGS.onePerSong) {
    b.used = b.used || {};
    if (b.pick && b.pick.key === key) { if (!b.pick.opts.includes(i)) b.pick.opts.push(i); return false; }
    if (b.used[key] != null) return false;
  }
  b.marks.push(i); b.auto[i] = rec.n; if (SETTINGS.onePerSong) b.used[key] = i;
  return true;
}
let skipHeld = false, releaseSkip = () => {};
// Choose tile i (or null = skip) for the open pick. It can be undone until the next song's answer shows.
function choosePick(b, i, cells) {
  const pk = b.pick; if (!pk) return;
  if (i != null) { b.marks.push(i); b.auto[i] = pk.n; (b.used = b.used || {})[pk.key] = i; logAdd({ n: pk.n, hits: [{ text: cells[i].text, col: cells[i].col }] }); }
  b.lastPick = { ...pk, chosen: i }; b.pick = null;
  setTimeout(() => releaseSkip(), 0); // a skip vote held while picking goes out now
}
function undoPick(b) {
  const lp = b.lastPick; if (!lp || lp.key !== lastSongN()) return;
  if (lp.chosen != null) { const k = b.marks.indexOf(lp.chosen); if (k >= 0) b.marks.splice(k, 1); delete b.auto[lp.chosen]; if (b.used) delete b.used[lp.key]; }
  b.pick = { n: lp.n, key: lp.key, opts: lp.opts }; b.lastPick = null;
}
function playerOnSong(rec) {
  const b = curBoard(); if (!b) return;
  const cells = cellsNow(), id = myId(), ctx = ctxFor(rec);
  const me = id != null ? rec.res[id] : null;
  // Wild card side rules
  if (me && b.wild === "Free? Tile" && !b.lost) {
    const missed = game.hist.filter((r) => onList(r.res[id]) && !r.res[id].correct).length;
    if (missed > 2) { b.wildOn = false; b.lost = true; sysMsg("AMQ Bingo: you missed 3 songs from your list, so Free? Tile is gone."); }
  }
  if (me && b.wild === "Freer? Tile" && !b.lost && !me.correct && ids(rec).length >= 2 && correctCount(rec) === ids(rec).length - 1) {
    b.wildOn = false; b.lost = true; sysMsg("AMQ Bingo: everyone else got that one, so Freer? Tile is gone.");
  }
  game.lastCorrect = !!(me && me.correct);
  if (b.pick && b.pick.key !== rec.seq) { b.pick = null; skipHeld = false; } // an unanswered pick expires at the next reveal
  if (b.lastPick && b.lastPick.key !== rec.seq) b.lastPick = null; // and so does its undo
  if (!SETTINGS.auto) { saveP(); renderPlayer(); return; }
  if (SETTINGS.needCorrect && !(me && me.correct)) { b.ask = {}; saveP(); renderPlayer(); return; }
  if (b.wild === "Skilled" && !(me && me.correct)) { saveP(); renderPlayer(); return; }
  if (b.wild === "Speed = Experience" && me) {
    const lvl = (game.players[id] || {}).level || 0, limit = lvl < 10 ? 15 : lvl < 25 ? 12 : 10;
    if (me.answerTimeing == null || me.answerTimeing > limit) { saveP(); renderPlayer(); return; }
  }
  const before = linesOf(b).length, hits = [], found = [];
  cells.forEach((c, i) => { if (!c.wild && !b.marks.includes(i) && AUTO.has(c.text) && testTile(c.text, ctx, id)) found.push(i); });
  if (SETTINGS.onePerSong && found.length > 1 && !(b.used && b.used[rec.seq] != null)) {
    b.pick = { n: rec.n, key: rec.seq, opts: found };
    logAdd({ n: rec.n, note: `Matched ${found.length} tiles. Pick one under the board.` });
  } else found.forEach((i) => { if (autoMark(b, i, rec)) hits.push({ text: cells[i].text, col: cells[i].col }); });
  if (hits.length) logAdd({ n: rec.n, hits });
  b.ask = {};
  cells.forEach((c, i) => { if (!c.wild && ASK[c.text] && !b.marks.includes(i)) { try { if (ASK[c.text].g(ctx)) { b.ask[i] = rec.n; logAdd({ n: rec.n, note: `"${c.text}" might count. Click it if it does.` }); } } catch (e) {} } });
  const ai = cells.findIndex((c) => c.text === ARTIST_TILE);
  if (ai >= 0 && !b.marks.includes(ai) && id != null && SETTINGS.auto) artistMatches(rec).then((who) => {
    if (!who.includes(id) || b.marks.includes(ai)) return;
    const was = linesOf(b).length; if (!autoMark(b, ai, rec)) { saveP(); renderPlayer(); return; } logAdd({ n: rec.n, hits: [{ text: ARTIST_TILE, col: 2 }] });
    saveP(); renderPlayer(); if (linesOf(b).length > was) { flashUntil = Date.now() + 6000; celebrate(); } queueSync(true);
  });
  cells.forEach((c, ii) => {
    if (c.wild || !ASYNC_TILES[c.text] || b.marks.includes(ii)) return;
    ASYNC_TILES[c.text](rec).then((yes) => {
      if (!yes || b.marks.includes(ii) || curBoard() !== b || (SETTINGS.needCorrect && !(me && me.correct))) return;
      const was = linesOf(b).length; if (!autoMark(b, ii, rec)) { saveP(); renderPlayer(); return; } logAdd({ n: rec.n, hits: [{ text: c.text, col: c.col }] });
      saveP(); renderPlayer(); if (linesOf(b).length > was) { flashUntil = Date.now() + 6000; celebrate(); } queueSync(true);
    });
  });
  saveP();
  const after = linesOf(b).length;
  if (after > before) flashUntil = Date.now() + 6000;
  renderPlayer();
  if (after > before) celebrate();
  queueSync(after > before);
}

function celebrate() {
  const pnl = playerUI && playerUI.panel; if (!pnl || pnl.style.display === "none") return;
  pnl.querySelectorAll(".amqb-cell.line").forEach((c) => c.classList.add("pulse"));
  confetti(pnl);
}

let syncTimer = null, lastSent = "";
function queueSync(now) {
  clearTimeout(syncTimer);
  syncTimer = setTimeout(sendSync, now ? 50 : 2500);
}
function sendSync() {
  const b = curBoard(); if (!b || !P.host) return;
  const claim = claimOf(b);
  const msg = `${PREFIX} S ${P.round} ${P.code} ${claim} ${P.packId || "STD"}`;
  if (msg === lastSent) return;
  lastSent = msg;
  if (P.host.toLowerCase() === myName().toLowerCase()) hostReceive(myName(), msg); else sendDM(P.host, msg);
}

function renderPlayer() {
  if (!playerUI) return;
  const { body, sub } = playerUI; body.innerHTML = "";
  const b = curBoard();
  if (!myName()) { body.append(h("p", { class: "amqb-muted" }, "Log in to AMQ to get a board.")); return; }
  if (!b) {
    sub.textContent = "";
    const code = h("input", { class: "amqb-in", maxlength: 4, placeholder: "CODE", style: "width:90px;text-transform:uppercase;letter-spacing:3px" });
    const hostIn = h("input", { class: "amqb-in", maxlength: 24, placeholder: "Host's AMQ name", value: P.host || "" });
    const err = h("p", { class: "amqb-muted" }, "");
    const go = () => {
      const c = code.value.trim().toUpperCase(), r = [1, 2, 3, 4, 5].find((n) => codeValid(c, n));
      if (!r) { err.textContent = "That code doesn't match any round. Check the code the host announced."; return; }
      joinRound(r, c, hostIn.value.trim());
    };
    body.append(
      h("p", {}, "When the host announces a round in chat, your board appears here automatically. You can also type the round code."),
      h("div", { class: "amqb-row" }, code, hostIn, h("button", { class: "amqb-btn pri", onclick: go }, "Get my board")), err,
      h("p", { class: "amqb-muted" }, `Your board is made from your AMQ name (${myName()}), the same as on the website.`));
    return;
  }
  sub.textContent = `Round ${P.round} · ${P.code}${b.variant ? " · replacement" : ""}`;
  const cells = cellsNow(), lines = linesOf(b), inLine = new Set(lines.flat());
  speedCheck(b, lines.length);
  if (Date.now() < flashUntil) body.append(h("div", { class: "amqb-bingo" }, "🎉 BINGO! 🎉"));
  const grid = h("div", { class: "amqb-grid" }, COLS.map((c, ci) => h("div", { class: "amqb-ch", style: ci === 4 && SETTINGS.soloMix ? "background:linear-gradient(90deg,#4f8cff,#3fbf7f,#ff9f43,#b37bff)" : `--cat:${CAT[ci]}` }, ci === 4 && SETTINGS.soloMix ? "Mix" : c.name)));
  cells.forEach((c, i) => {
    if (c.wild) {
      const sel = h("select", { title: "Your wild card" }, h("option", { value: "" }, "Wild card…"), WILD.map((w) => h("option", { value: w.name, selected: b.wild === w.name }, w.name)));
      sel.addEventListener("change", () => { b.wild = sel.value; const w = WILD.find((x) => x.name === sel.value); b.wildOn = !!(w && w.auto); b.lost = false; saveP(); renderPlayer(); queueSync(); });
      const mk = h("button", { class: "amqb-tog" + (b.wildOn ? " on" : ""), disabled: !b.wild || b.lost, onclick: () => { b.wildOn = !b.wildOn; saveP(); renderPlayer(); queueSync(true); } }, b.lost ? "Lost" : b.wildOn ? "Marked" : "Mark");
      const w = WILD.find((x) => x.name === b.wild);
      grid.append(h("div", { class: "amqb-cell wild" + (b.wildOn ? " on" : "") + (inLine.has(12) ? " line" : ""), style: `--cat:${CAT[2]}`, title: w ? w.desc : "Pick a wild card" }, sel, mk));
      return;
    }
    const on = b.marks.includes(i), isAuto = AUTO.has(c.text) && SETTINGS.auto, ask = !on && b.ask && b.ask[i], d = c.d || (c.hard ? "H" : "M");
    grid.append(h("button", {
      style: `--cat:${CAT[c.col]}`,
      class: "amqb-cell" + (on ? " on" : "") + (isAuto ? " am" : " man") + (ask ? " ask" : "") + (inLine.has(i) ? " line" : "") + (b.pick && b.pick.opts.includes(i) ? " pickme" : ""),
      title: (isAuto ? "Marks itself when it happens. " : "You mark this one: click it when it happens. ") + ({ E: "Easy", M: "Medium", H: "Hard" }[d]) + "." + (b.auto[i] ? ` Auto-marked on song ${b.auto[i]}.` : ""),
      onclick: () => {
        if (b.ask) delete b.ask[i];
        const k = b.marks.indexOf(i), n = lastSongN();
        // Host setting: auto tiles can't be marked or unmarked by hand (picking from a multi-match is still allowed).
        if (SETTINGS.lockAuto && isAuto && !(b.pick && b.pick.opts.includes(i))) { note = "This tile marks itself. The host locked auto tiles, so it can't be changed by hand."; renderPlayer(); return; }
        if (k >= 0) { b.marks.splice(k, 1); delete b.auto[i]; if (b.used) Object.keys(b.used).forEach((x) => { if (b.used[x] === i) delete b.used[x]; }); }
        else {
          if (b.pick && b.pick.opts.includes(i)) choosePick(b, i, cells);
          else {
            if (SETTINGS.needCorrect && game.hist.length && !game.lastCorrect) { note = "You can only mark tiles on songs you got right."; renderPlayer(); return; }
            let swapped = "";
            if (SETTINGS.onePerSong && game.hist.length) {
              // Choosing a click tile instead of the open pick closes the pick.
              if (b.pick && b.pick.key === n) choosePick(b, null, cells);
              // One tile per song: swap out this song's tile, even an auto tile when auto tiles are locked.
              const prev = b.used && b.used[n];
              if (prev != null && prev !== i) { const pk = b.marks.indexOf(prev); if (pk >= 0) b.marks.splice(pk, 1); delete b.auto[prev]; swapped = cells[prev].text; b.lastPick = null; }
            }
            b.marks.push(i); if (SETTINGS.onePerSong && game.hist.length) (b.used = b.used || {})[n] = i;
            if (swapped) { const last = game.hist[game.hist.length - 1]; note = ""; logAdd({ n: last ? last.n : 0, note: `Swapped "${swapped}" for "${c.text}".` }); }
          }
        }
        note = ""; const bl = linesOf(b).length; saveP(); if (bl > lines.length) flashUntil = Date.now() + 6000; renderPlayer(); if (bl > lines.length) celebrate(); queueSync(bl > lines.length);
      },
    }, c.text, h("span", { class: "dif d" + d }, d),
      ask ? h("span", { class: "askq" }, ASK[c.text].q) : null,
      ask ? h("span", { class: "askx", title: "Not this time", onclick: (e) => { e.stopPropagation(); delete b.ask[i]; saveP(); renderPlayer(); } }, "×") : null,
      h("span", { class: "tag" }, on && b.auto[i] ? `auto #${b.auto[i]}` : isAuto ? "auto" : ASK[c.text] ? "asks" : "✋ you")));
  });
  const pickBox = b.pick ? h("div", { class: "amqb-pick" }, h("b", {}, `Song ${b.pick.n} matched ${b.pick.opts.length} tiles. Pick one (or click a highlighted tile):`),
    skipHeld ? h("div", { class: "amqb-muted" }, "Your skip vote is on hold until you pick.") : "",
    h("div", { class: "amqb-row" }, b.pick.opts.map((i) => h("button", { class: "amqb-btn", style: `border-color:${CAT[cells[i].col]}`, onclick: () => {
      const was = linesOf(b).length; choosePick(b, i, cells);
      saveP(); const bl = linesOf(b).length; if (bl > was) flashUntil = Date.now() + 6000; renderPlayer(); if (bl > was) celebrate(); queueSync(bl > was);
    } }, cells[i].text)), h("button", { class: "amqb-btn", onclick: () => { choosePick(b, null, cells); saveP(); renderPlayer(); } }, "Skip")))
    : b.lastPick && b.lastPick.key === lastSongN() ? h("div", { class: "amqb-row amqb-undo" },
      h("span", { class: "amqb-muted" }, b.lastPick.chosen != null ? `Picked "${cells[b.lastPick.chosen].text}" for song ${b.lastPick.n}.` : `Skipped song ${b.lastPick.n}.`),
      h("button", { class: "amqb-btn", title: "Available until the next song's answer shows", onclick: () => { undoPick(b); saveP(); renderPlayer(); queueSync(); } }, "Undo")) : null;
  const claim = claimOf(b);
  const left = COOLDOWN_MS - (Date.now() - b.firstAt);
  const rulesLine = [SETTINGS.soloMix ? "solo: the 5th column mixes the other four" : "", SETTINGS.lockAuto ? "auto tiles are locked" : "", SETTINGS.wild === false ? "no wild card" : "", SETTINGS.needCorrect ? "only on songs you get right" : "", SETTINGS.onePerSong ? "one tile per song" : ""].filter(Boolean).join(" · ");
  // Song log right under the board, fixed height, newest first: marks as chips, notices as short yellow text.
  const logRow = (l) => h("div", { class: "amqb-logrow" }, h("span", { class: "amqb-logn" }, `#${l.n}`),
    (l.hits || []).map((x) => h("span", { class: "amqb-chip", style: `--cat:${CAT[x.col]}`, title: x.text }, x.text)),
    l.note ? h("span", { class: "amqb-lognote", title: l.note }, l.note) : "");
  const logEl = h("div", { class: "amqb-songlog" }, autoLog.length ? autoLog.slice(0, 10).map(logRow) : h("span", { class: "amqb-muted" }, "Tiles marked after each song show here."));
  const pbNow = P.pb && P.pb[speedKey()];
  const speedEl = b.speed ? h("div", { id: "amqbSpeed", class: "amqb-speed" + (b.speed.end ? " done" : "") },
    b.speed.end ? `🏁 Bingo in ${fmtTime(b.speed.end - b.speed.start)} · ${b.speed.songs} songs` + (b.speed.best ? " · new best!" : "") : `⏱ ${fmtTime(Date.now() - b.speed.start)} · ${(game.seq || 0) - b.speed.seq0} songs`,
    h("span", { class: "amqb-muted", title: b.speed.why && b.speed.why.length ? "Not official: " + b.speed.why.join(", ") : "Official speedrun rules" }, ` ${speedKey()}` + (pbNow ? ` · best ${fmtTime(pbNow.ms)}, ${pbNow.songs} songs` : " · first bingo stops the clock"))) : "";
  body.append(speedEl, grid, logEl, pickBox || "", note ? h("div", { class: "amqb-err" }, note) : "", rulesLine ? h("div", { class: "amqb-muted" }, "This round: " + rulesLine + ".") : "",
    h("div", { class: "amqb-row", style: "justify-content:space-between" },
      h("div", { class: "amqb-stats" }, h("span", {}, h("b", {}, lines.length), " bingos"), h("span", {}, h("b", {}, b.marks.length + (b.wildOn ? 1 : 0)), " tiles")),
      h("span", { class: "amqb-muted", title: "Your claim code, in case the host uses the website" }, "Claim ", h("b", { style: "letter-spacing:1px;color:#ecebf5" }, claim))),
    h("div", { class: "amqb-row" },
      h("button", { class: "amqb-btn" + (lines.length ? " pri" : ""), disabled: !lines.length || (b.called || 0) >= lines.length, title: (b.called || 0) >= lines.length && lines.length ? "Already called. Get another line to call again." : "", onclick: () => {
        if ((b.called || 0) >= lines.length) return;
        b.called = lines.length; saveP();
        if (H.active && P.host && norm(P.host) === norm(myName())) { const pl = H.players[norm(myName())]; if (pl) (pl.chatCalled = pl.chatCalled || {})[P.round] = lines.length; }
        sendSync();
        if (P.host && norm(P.host) !== norm(myName())) sendDM(P.host, `${PREFIX} B ${P.round} ${P.code} ${claim}`);
        sendGameChat(`BINGO! ${myName()} has ${lines.length} line${lines.length === 1 ? "" : "s"} in AMQ Bingo round ${P.round} · claim ${claim} 🎉`);
        renderPlayer();
      } }, (b.called || 0) >= lines.length && lines.length ? "Called ✓" : "🎉 BINGO!"),
      !SETTINGS.replace ? null : h("button", { class: "amqb-btn", disabled: b.variant === 1 || left > 0, title: "One replacement per round, 3 minutes after you get your board", onclick: () => {
        const k = boardKey(); P.boards[k] = { variant: 1, firstAt: b.firstAt, marks: [], auto: {}, wild: b.wild, wildOn: false, lost: false }; saveP(); renderPlayer(); queueSync(true);
      } }, b.variant === 1 ? "Replacement used" : left > 0 ? `New board in ${Math.ceil(left / 60000)} min` : "Replace board"),
      h("button", { class: "amqb-btn", onclick: () => { P.code = ""; P.bcode = ""; P.round = 0; saveP(); renderPlayer(); } }, "Change round")),
    h("p", { class: "amqb-muted" }, P.host ? `Syncing with host ${P.host}.` : "No host set. Your board isn't being sent anywhere."),
    h("div", { class: "amqb-legend" }, h("span", {}, "Plain: marks itself"), h("span", { class: "lg-man" }, "Striped ✋: you mark it"), h("span", {}, h("i", { class: "dif dE" }, "E"), h("i", { class: "dif dM" }, "M"), h("i", { class: "dif dH" }, "H"), " easy / medium / hard")));
}

/* =====================================================================
 * HOST PANEL
 * ===================================================================== */
// Rounds 1-3 use the website's codes; rounds 4-5 continue the same pattern (script only).
function codesFor(key) {
  const out = codesFromKey(key);
  for (const r of [4, 5]) { const g = rng("event|" + key + "|" + r); let t = ""; for (let i = 0; i < 3; i++) t += ALPHA[Math.floor(g() * ALPHA.length)]; out[r] = t + checkLetter(t, r); }
  return out;
}
const DEFAULT_GAME = { rounds: 3, endMode: "amq", autoNext: true, autoLobby: true, announceBingo: true, askEnd: true, nextBoard: "new" };
// Which code a round's boards are built from: its own, or round 1's when boards carry over between rounds.
const bcodeFor = (r) => (H.game.nextBoard && H.game.nextBoard !== "new" ? H.codes[1] : H.codes[r]);
const freshHost = (key = randomKey()) => ({ key, round: 1, codes: codesFor(key), active: false, tab: "game", game: { ...DEFAULT_GAME }, ended: {}, checks: {}, personal: {}, players: {}, wildHost: {} });
let H = S.get("host", null) || freshHost();
H.game = { ...DEFAULT_GAME, ...(H.game || {}) }; if (H.settings) H.settings = { ...DEFAULT_SETTINGS, ...H.settings }; H.codes = codesFor(H.key); H.tab = H.tab || "game"; H.ended = H.ended || {};
function ensureRound(r) { H.checks[r] = H.checks[r] || {}; H.personal[r] = H.personal[r] || {}; }
[1, 2, 3, 4, 5].forEach(ensureRound);
const saveH = () => S.set("host", H);
let hostUI, viewName = "", bingoAlerts = [];

function hostOnSong(rec) {
  if (!H.active || H.ended[H.round]) return;
  const r = H.round, ctx = ctxFor(rec);
  H.asks = H.asks || {}; H.asks[r] = {};
  Object.keys(ASK).forEach((t) => { try { if (!(t in H.checks[r]) && ASK[t].g(ctx)) H.asks[r][t] = rec.n; } catch (e) {} });
  artistMatches(rec).then((who) => { who.forEach((id) => { const pl = game.players[id]; if (!pl) return; const k = norm(pl.name), bag = (H.personal[r][k] = H.personal[r][k] || {}); if (!(ARTIST_TILE in bag)) bag[ARTIST_TILE] = rec.n; }); if (who.length) { saveH(); checkBingoEnd(); renderHost(); } });
  Object.keys(ASYNC_TILES).forEach((t) => {
    if ((t in H.checks[r] && !SETTINGS.needCorrect) || !COLS.some((c) => c.pool.some((x) => x.text === t))) return;
    ASYNC_TILES[t](rec).then((yes) => {
      if (!yes || H.round !== r) return;
      if (!(t in H.checks[r])) H.checks[r][t] = rec.n;
      if (SETTINGS.needCorrect) ids(rec).forEach((id) => { const pl = game.players[id]; if (!pl || !rec.res[id].correct) return; const bag = (H.personal[r][norm(pl.name)] = H.personal[r][norm(pl.name)] || {}); if (!(t in bag)) bag[t] = rec.n; });
      saveH(); checkBingoEnd(); renderHost();
    });
  });
  COLS.forEach((col) => col.pool.forEach((t) => {
    const rule = RULES[t.text]; if (!rule) return;
    const need = SETTINGS.needCorrect;
    if (rule.g) {
      const hit = testTile(t.text, ctx);
      if (hit && !(t.text in H.checks[r])) H.checks[r][t.text] = rec.n;
      // "Only on songs you got right": the tile counts only for players who got this song.
      if (hit && need) ids(rec).forEach((id) => { const pl = game.players[id]; if (!pl || !rec.res[id].correct) return; const bag = (H.personal[r][norm(pl.name)] = H.personal[r][norm(pl.name)] || {}); if (!(t.text in bag)) bag[t.text] = rec.n; });
    }
    else ids(rec).forEach((id) => {
      const pl = game.players[id]; if (!pl || (need && !rec.res[id].correct)) return;
      const k = norm(pl.name), bag = (H.personal[r][k] = H.personal[r][k] || {});
      if (!(t.text in bag) && testTile(t.text, ctx, id)) bag[t.text] = rec.n;
    });
  }));
  saveH(); checkBingoEnd(); renderHost();
}

function hostReceive(sender, message) {
  if (!H.active) return;
  const m = message.slice(PREFIX.length).trim().split(/\s+/);
  const [kind, rs, code, claim, pid] = m, r = Number(rs);
  if (kind === "NEED") { if (rs === (H.packId || "")) sendPack(sender); return; }
  if (!(kind === "S" || kind === "B") || H.codes[r] !== code) return;
  if ((pid || "STD") !== (H.packId || "STD")) return; // board made with different tiles
  const k = norm(sender), pl = (H.players[k] = H.players[k] || { name: sender, claims: {} });
  pl.claims[r] = claim;
  if (kind === "B") { bingoAlerts.unshift(`${sender} called BINGO (round ${r})`); sysMsg(`AMQ Bingo: ${sender} called BINGO! Check their board in the host panel.`); }
  saveH(); checkBingoEnd(); renderHost();
}

function hostTakeBingo(sender, r, claim) {
  if (!H.active || H.codes[r] == null || !readClaim(sender, bcodeFor(r), claim)) return;
  const k = norm(sender), pl = (H.players[k] = H.players[k] || { name: sender, claims: {} });
  pl.claims[r] = claim;
  const sc = scorePlayer(pl, r); (pl.chatCalled = pl.chatCalled || {})[r] = sc ? sc.lines.length : 0; // they announced it themselves
  if (norm(sender) !== norm(myName())) { bingoAlerts.unshift(`${sender} called BINGO (round ${r})`); sysMsg(`AMQ Bingo: ${sender} called BINGO! Check their board in the host panel.`); }
  saveH(); checkBingoEnd(); renderHost();
}
const CLAIM_RE = /\b([0-9A-HJKMNP-TV-Z]{4})[- ]?([0-9A-HJKMNP-TV-Z]{4})\b/i;
function hostTakeClaim(sender, text) {
  if (!H.active || H.packId || !sender) return false; // website boards only exist with standard tiles
  const m = (text || "").toUpperCase().replace(/O/g, "0").match(CLAIM_RE); if (!m) return false;
  const claim = m[1] + "-" + m[2];
  const r = [H.round, 1, 2, 3].find((n) => readClaim(sender, bcodeFor(n), claim)); if (!r) return false;
  const k = norm(sender), pl = (H.players[k] = H.players[k] || { name: sender, claims: {} });
  const before = scorePlayer(pl, r); pl.claims[r] = claim; pl.web = true;
  const after = scorePlayer(pl, r);
  if (after && after.lines.length > (before ? before.lines.length : 0)) { bingoAlerts.unshift(`${sender} has ${after.lines.length} line${after.lines.length === 1 ? "" : "s"} (website, round ${r})`); sysMsg(`AMQ Bingo: ${sender} (website) has a bingo. Check their board in the host panel.`); }
  saveH(); checkBingoEnd(); renderHost(); return true;
}

function sendPack(target) {
  const enc = encodeURIComponent(H.packBody || ""), size = 180, n = Math.max(1, Math.ceil(enc.length / size));
  for (let i = 0; i < n; i++) setTimeout(() => sendDM(target, `${PREFIX} P ${H.packId} ${i + 1}/${n} ${enc.slice(i * size, (i + 1) * size)}`), i * 450);
}
function hostSavePack(custom, settings) {
  const pk = packOf(custom, settings);
  const err = applyPack(pk.id ? pk.body : "");
  if (err) return err;
  H.custom = custom; H.settings = settings; H.packId = pk.id; H.packBody = pk.id ? pk.body : "";
  P.packId = H.packId; P.packBody = H.packBody; saveP();
  saveH(); return "";
}

function scorePlayer(pl, r) {
  const claim = pl.claims && pl.claims[r]; if (!claim) return null;
  const code = bcodeFor(r), cl = readClaim(pl.name, code, claim); if (!cl) return null;
  const cells = makeBoard(pl.name, code, cl.variant), k = norm(pl.name);
  const wildOn = !!(H.wildHost[k] && H.wildHost[k][r]);
  const mine = (t) => !!(H.personal[r][k] && t in H.personal[r][k]);
  const ok = (i) => { if (cells[i].wild) return wildOn; const t = cells[i].text; if (SETTINGS.needCorrect && RULES[t] && RULES[t].g) return mine(t); return (t in H.checks[r]) || mine(t); };
  const lines = LINES.map((l, idx) => ({ l, idx })).filter((x) => x.l.every((i) => cl.marks.has(i)));
  return { cl, cells, ok, lines, confirmed: lines.filter((x) => x.l.every(ok)).length };
}

let miniBar = null, lastAlertSeen = 0;
function renderMini() {
  if (!hostUI) return;
  markHostButton();
  if (!miniBar) {
    miniBar = h("div", { class: "amqb-mini", title: "Open the host panel (Alt+H)", onclick: () => { hostUI.panel.style.display = "block"; lastAlertSeen = bingoAlerts.length; renderHost(); } });
    document.body.appendChild(miniBar);
  }
  const hidden = hostUI.panel.style.display === "none";
  miniBar.style.display = hidden && H.active ? "flex" : "none";
  if (miniBar.style.display === "none") return;
  const r = H.round, list = Object.values(H.players);
  const bingos = list.reduce((n, p) => { const sc = scorePlayer(p, r); return n + (sc ? sc.lines.length : 0); }, 0);
  const fresh = bingoAlerts.length - lastAlertSeen;
  miniBar.innerHTML = "";
  miniBar.append(h("span", {}, "Bingo host"), h("span", {}, `Round ${r}`), h("b", {}, H.codes[r]),
    h("span", {}, `${list.length} player${list.length === 1 ? "" : "s"}`), h("span", {}, `${bingos} bingo${bingos === 1 ? "" : "s"}`),
    fresh > 0 ? h("span", { class: "alert" }, `${bingoAlerts[0]}`) : "");
}

// Players in the room right now (lobby or game), used to switch the solo Mix column on or off.
function roomSize() {
  try { const l = PAGE.lobby; if (l && l.inLobby && l.players) return Object.keys(l.players).length; } catch (e) {}
  try { const q = PAGE.quiz; if (q && q.inQuiz && q.players) return Object.values(q.players).filter((x) => !x.isSpectator).length || Object.keys(q.players).length; } catch (e) {}
  return Object.keys(game.players).length;
}
function announceRound(r) {
  { // solo room: the Multiplayer column becomes a Mix of the other four
    const st0 = H.settings || DEFAULT_SETTINGS, solo = roomSize() === 1;
    if (!!st0.soloMix !== solo) { const e = hostSavePack(H.custom || { mode: "add", text: "" }, { ...DEFAULT_SETTINGS, ...st0, soloMix: solo }); if (e) sysMsg("AMQ Bingo: " + e); else renderPlayer(); }
  }
  H.active = true; H.round = r; H.announced = r; delete H.ended[r]; ensureRound(r); saveH();
  const label = H.game.rounds > 1 ? `round ${r}` : "round 1";
  const st = H.settings || DEFAULT_SETTINGS, plain = !((H.custom || {}).text || "").trim();
  const nb = H.game.nextBoard || "new";
  // Marks carry over: so do the host's checks from the round before.
  if (nb === "keep" && r > 1) { const pr = r - 1; ensureRound(pr); H.checks[r] = { ...H.checks[pr], ...H.checks[r] }; Object.entries(H.personal[pr]).forEach(([k, bag]) => { H.personal[r][k] = { ...bag, ...(H.personal[r][k] || {}) }; }); Object.values(H.players).forEach((p) => { if (p.claims && p.claims[pr] && !p.claims[r]) p.claims[r] = p.claims[pr]; if (p.chatCalled && p.chatCalled[pr]) p.chatCalled[r] = p.chatCalled[pr]; }); H.seen = H.seen || {}; H.seen[r] = { ...(H.seen[pr] || {}), ...(H.seen[r] || {}) }; saveH(); }
  sendGameChat(`AMQ Bingo ${label} · code ${H.codes[r]} · host ${myName()}` + (H.packId ? ` · tiles ${H.packId} (${SET_NAMES[st.set || "S"]})` + (plain ? ` · rules ${encodeRules(st)}` : "") : "") + (nb !== "new" && r > 1 ? ` · board ${H.codes[1]}${nb === "keep" ? "+" : ""}` : "") + ` · v${SCRIPT_VERSION}`);
  renderHost();
}

// A round ends when the AMQ game ends (endMode "amq") or when someone has a confirmed bingo (endMode "bingo").
function endRound(reason) {
  const r = H.round; if (!H.active || H.ended[r]) return;
  H.ended[r] = true; endPrompt = null; showEndPrompt();
  const called = Object.values(H.players).map((p) => ({ p, sc: scorePlayer(p, r) })).filter((x) => x.sc && x.sc.lines.length > 0)
    .sort((a, b) => b.sc.confirmed - a.sc.confirmed || b.sc.lines.length - a.sc.lines.length);
  const label = H.game.rounds > 1 ? `Round ${r}` : "The round";
  const say = (x) => `${x.p.name} ${x.sc.confirmed}` + (x.sc.lines.length > x.sc.confirmed ? ` (+${x.sc.lines.length - x.sc.confirmed} to check)` : "");
  sendGameChat(`AMQ Bingo: ${label} is over (${reason}). ` + (called.length ? `Bingos: ${called.map(say).join(", ")}.` : "No bingos."));
  if (called.some((x) => x.sc.lines.length > x.sc.confirmed)) sysMsg("AMQ Bingo: some lines have tiles tracking couldn't confirm (click tiles, wild cards). Check them in the Players tab.");
  // Ended early (button or bingo) while a song quiz is running: send the room back to the lobby.
  if (H.game.autoLobby && game.inQuiz && !/AMQ game ended/.test(reason)) returnToLobby();
  if (H.game.autoNext && r < H.game.rounds) { setTimeout(() => announceRound(r + 1), 1500); }
  else if (r >= H.game.rounds) { H.active = false; sysMsg("AMQ Bingo: that was the last round. Tracking is off."); }
  saveH(); renderHost();
}
// Start the AMQ game from the lobby (same command as AMQ's Start button; you must be the room host).
function startAmqGame() {
  try { PAGE.socket.sendCommand({ type: "lobby", command: "start game" }); } catch (e) { sysMsg("AMQ Bingo: couldn't start the game."); }
}
function applySpeedrun(cat) {
  // bingo side
  const e = hostSavePack({ mode: "add", text: "" }, { ...DEFAULT_SETTINGS, ...SPEEDRUN_TILES });
  if (e) { sysMsg("AMQ Bingo: " + e); return; }
  H.custom = { mode: "add", text: "" }; H.game = { ...H.game, ...SPEEDRUN_GAME }; H.round = 1; saveH();
  // room side: only send what differs
  const want = speedrunRoom(cat), cur = roomSettingsNow() || {}, changes = {};
  Object.keys(want).forEach((k) => { if (JSON.stringify(cur[k]) !== JSON.stringify(want[k])) changes[k] = want[k]; });
  if (Object.keys(changes).length) { try { PAGE.socket.sendCommand({ type: "lobby", command: "change game settings", data: { settingChanges: changes, communityMode: false } }); } catch (err) {} }
  setTimeout(() => {
    const c = speedCategory();
    sysMsg(c.official ? `AMQ Bingo: speedrun (${cat === "random" ? "Random" : "Watched"}) is set. Press Announce & start game.`
      : `AMQ Bingo: bingo settings are set, but the room still differs (${c.why.join(", ")}). Set it in AMQ's room settings: ${cat === "random" ? "Random" : "Only watched"} songs, 20s guess time, all song types and categories, full difficulty range, normal speed.`);
    renderHost(); renderPlayer();
  }, 1500);
  renderHost(); renderPlayer();
}
function returnToLobby() {
  try {
    PAGE.socket.sendCommand({ type: "quiz", command: "start return lobby vote" });
    setTimeout(() => { try { PAGE.socket.sendCommand({ type: "quiz", command: "return lobby vote", data: { accept: true } }); } catch (e) {} }, 300);
  } catch (e) { console.warn("[AMQ Bingo] couldn't return to lobby", e); }
}
// Any new line on anyone's board: say it in chat (unless they already did) and ask the host whether to end the round.
let endPrompt = null;
function noticeBingos() {
  const r = H.round; if (!H.active || H.ended[r]) return;
  H.seen = H.seen || {}; const seen = (H.seen[r] = H.seen[r] || {});
  Object.entries(H.players).forEach(([k, p]) => {
    const sc = scorePlayer(p, r); if (!sc) return;
    const n = sc.lines.length, before = seen[k] || 0;
    if (n > before) {
      const said = p.chatCalled && p.chatCalled[r] >= n;
      if (H.game.announceBingo !== false && !said) sendGameChat(`🎉 AMQ Bingo: ${p.name} has ${n} line${n === 1 ? "" : "s"}` + (sc.confirmed ? ` (${sc.confirmed} confirmed)!` : " (host is checking)!"));
      askToEnd(p.name);
    }
    seen[k] = Math.max(before, n);
  });
}
function askToEnd(name) {
  const r = H.round;
  if (H.game.askEnd === false || H.game.endMode === "bingo" || !H.active || H.ended[r]) return;
  endPrompt = { r, who: [...new Set([...(endPrompt && endPrompt.r === r ? endPrompt.who : []), name])] }; showEndPrompt();
}
function showEndPrompt() {
  let box = document.getElementById("amqbEndPrompt"); if (box) box.remove();
  if (!endPrompt || !H.active || H.ended[endPrompt.r] || H.round !== endPrompt.r) { endPrompt = null; return; }
  const r = endPrompt.r, list = endPrompt.who.map((n) => { const p = H.players[norm(n)], sc = p && scorePlayer(p, r); return `${n}${sc && sc.lines.length ? ` (${sc.confirmed}/${sc.lines.length} confirmed)` : " (board not received yet)"}`; }).join(", ");
  box = h("div", { id: "amqbEndPrompt", class: "amqb-endprompt" },
    h("b", {}, "🎉 BINGO: "), h("span", {}, list),
    h("div", { class: "amqb-row", style: "margin-top:6px;justify-content:center" },
      h("button", { class: "amqb-btn pri", onclick: () => { endPrompt = null; showEndPrompt(); endRound("someone got a bingo"); } }, (H.game.rounds > 1 ? `End round ${r}` : "End the round") + (H.game.autoLobby !== false && game.inQuiz ? " + back to lobby" : "")),
      h("button", { class: "amqb-btn", onclick: () => { hostUI.panel.style.display = "block"; H.tab = "players"; saveH(); renderHost(); } }, "Check boards"),
      h("button", { class: "amqb-btn", onclick: () => { endPrompt = null; showEndPrompt(); } }, "Keep playing")));
  document.body.appendChild(box);
}
function checkBingoEnd() {
  noticeBingos();
  if (!H.active || H.game.endMode !== "bingo" || H.ended[H.round]) return;
  if (Object.values(H.players).some((p) => { const sc = scorePlayer(p, H.round); return sc && sc.confirmed > 0; })) endRound("someone got a bingo");
}

const TABS = [["game", "Game"], ["players", "Players"], ["tiles", "Tiles"], ["settings", "Settings"]];
function renderHost() {
  if (!hostUI) return;
  renderMini();
  const { body, sub } = hostUI; body.innerHTML = "";
  const r = H.round; ensureRound(r);
  const code = H.codes[r], multi = H.game.rounds > 1;
  sub.textContent = H.active ? (multi ? `Round ${r} · tracking` : "Tracking") : "Not tracking";
  const nPlayers = Object.keys(H.players).length;
  body.append(h("div", { class: "amqb-tabs amqb-row" }, TABS.map(([id, name]) =>
    h("button", { class: H.tab === id ? "sel" : "", onclick: () => { H.tab = id; saveH(); renderHost(); } }, name + (id === "players" && nPlayers ? ` (${nPlayers})` : "")))));
  ({ game: tabGame, players: tabPlayers, tiles: tabTiles, settings: tabSettings })[H.tab](body, r, code, multi);
}

// New event: new codes, clears players and checks, keeps settings and custom tiles. Asks once before wiping.
let newArmed = 0;
function newEventBtn(tab) {
  const armed = Date.now() - newArmed < 4000;
  return h("button", { class: "amqb-btn" + (armed ? " pri" : ""), title: "New codes. Clears players and checks; keeps your settings and custom tiles.", onclick: () => {
    if (Date.now() - newArmed >= 4000) { newArmed = Date.now(); renderHost(); setTimeout(() => { if (newArmed && Date.now() - newArmed >= 4000) renderHost(); }, 4100); return; }
    newArmed = 0;
    const keep = { game: H.game, custom: H.custom, settings: H.settings, packId: H.packId, packBody: H.packBody };
    H = { ...freshHost(), ...keep, tab }; [1, 2, 3, 4, 5].forEach(ensureRound); saveH(); viewName = ""; bingoAlerts = []; renderHost();
    sysMsg("AMQ Bingo: new event ready. Press Announce to post the new code.");
  } }, armed ? "Click again to start over" : "New event");
}
function tabGame(body, r, code, multi) {
  body.append(
    h("div", { class: "amqb-row", style: "justify-content:space-between" },
      multi ? h("div", { class: "amqb-tabs amqb-row" }, Array.from({ length: H.game.rounds }, (_, k) => k + 1).map((n) =>
        h("button", { class: n === r ? "sel" : "", onclick: () => { H.round = n; ensureRound(n); viewName = ""; saveH(); renderHost(); } }, (H.ended[n] ? "✓ " : "") + "Round " + n))) : h("span", {}),
      h("div", { style: "text-align:right" }, h("div", { class: "amqb-muted" }, multi ? `Round ${r} code` : "Code"), h("div", { class: "amqb-code" }, code))),
    h("div", { class: "amqb-row" },
      h("button", { class: "amqb-btn pri", onclick: () => announceRound(r) }, multi ? `Announce round ${r} in chat` : "Announce in chat"),
      game.inQuiz ? "" : h("button", { class: "amqb-btn pri", title: "Posts the round code, then starts the AMQ game a few seconds later so everyone gets their board first. You need to be the room host.", onclick: () => {
        if (!(H.active && !H.ended[r] && H.announced === r)) announceRound(r);
        sysMsg("AMQ Bingo: starting the game in 3 seconds…"); setTimeout(startAmqGame, 3000);
      } }, "Announce & start game"),
      h("button", { class: "amqb-btn", onclick: () => { H.active = !H.active; saveH(); renderHost(); } }, H.active ? "Stop tracking" : "Start tracking"),
      H.active && !H.ended[r] ? h("button", { class: "amqb-btn", onclick: () => endRound("ended by host") }, "End round now") : null,
      newEventBtn("game")),
    h("p", { class: "amqb-muted" }, "Announcing posts the code in game chat and turns on tracking: after every song, tiles are checked automatically and each player's board syncs here."),
    h("p", { class: "amqb-muted" }, (H.game.endMode === "bingo" ? "Rounds end when someone has a confirmed bingo" : "Rounds end when the AMQ game ends") + (multi && H.game.autoNext ? ", then the next round is announced automatically." : ".") + " Change this in Settings."));
  if (bingoAlerts.length) body.append(h("div", { class: "amqb-log" }, bingoAlerts.slice(0, 4).map((a) => h("div", {}, "🎉 " + a))));
}

function tabPlayers(body, r, code) {
  const list = Object.values(H.players).sort((a, b) => a.name.localeCompare(b.name));
  const pl = h("div", { class: "amqb-plist" });
  if (!list.length) pl.append(h("p", { class: "amqb-muted" }, "No boards yet. Players appear here once their board syncs, or when a website player pastes their claim code in chat."));
  list.forEach((p) => {
    const sc = scorePlayer(p, r), k = norm(p.name), won = !!(H.wildHost[k] && H.wildHost[k][r]);
    pl.append(h("div", { class: "amqb-pl" },
      h("span", {}, h("b", {}, p.name), p.web ? h("span", { class: "amqb-muted" }, " (website)") : null, sc ? h("span", { class: "amqb-muted" }, ` · ${sc.cl.marks.size} tiles · ${sc.cl.wild || "no wild card"}`) : h("span", { class: "amqb-muted" }, " · no board this round")),
      sc ? h("span", {}, `${sc.lines.length} bingo${sc.lines.length === 1 ? "" : "s"} `, h("b", { class: "ok" }, `(${sc.confirmed} ✓)`)) : h("span", {}),
      sc && sc.cl.wild ? h("button", { class: "amqb-tog" + (won ? " on" : ""), title: "Did they earn their wild card?", onclick: () => { (H.wildHost[k] = H.wildHost[k] || {})[r] = !won; saveH(); checkBingoEnd(); renderHost(); } }, won ? "Wild On" : "Wild Off") : h("span", {}),
      h("button", { class: "amqb-btn", disabled: !sc, onclick: () => { viewName = viewName === k ? "" : k; renderHost(); } }, viewName === k ? "Hide" : "View")));
  });
  body.append(pl);

  const wn = h("input", { class: "amqb-in", placeholder: "Website player's name", style: "width:150px" });
  const wc = h("input", { class: "amqb-in", placeholder: "Claim code", style: "width:110px;text-transform:uppercase" });
  const wmsg = h("span", { class: "amqb-muted" }, "");
  body.append(h("div", { class: "amqb-row" }, wn, wc, h("button", { class: "amqb-btn", onclick: () => {
    const name = wn.value.trim(), claim = wc.value.trim().toUpperCase();
    if (!name || !claim) { wmsg.textContent = "Enter their name and claim code."; return; }
    if (H.packId) { wmsg.textContent = "Website boards only work with the standard tiles."; return; }
    if (!readClaim(name, code, claim)) { wmsg.textContent = `No board for "${name}" matches that code.`; return; }
    const k = norm(name); (H.players[k] = H.players[k] || { name, claims: {} }).claims[r] = claim; H.players[k].web = true; saveH(); checkBingoEnd(); renderHost();
  } }, "Add website player"), wmsg),
    h("p", { class: "amqb-muted" }, "Website players can also just paste their claim code in AMQ chat. It's picked up automatically."));

  const vp = viewName && H.players[viewName], vs = vp && scorePlayer(vp, r);
  if (vs) {
    const g = h("div", { class: "amqb-grid" }, COLS.map((c, ci) => h("div", { class: "amqb-ch", style: `--cat:${CAT[ci]}` }, c.name)));
    const inLine = new Set(vs.lines.flatMap((x) => x.l));
    const k = norm(vp.name);
    vs.cells.forEach((c, i) => {
      const mine = vs.cl.marks.has(i), yes = vs.ok(i), man = !c.wild && !AUTO.has(c.text), d = c.d || (c.hard ? "H" : "M");
      const cls = "amqb-cell" + (mine ? (yes ? " ok" : " unk") : yes ? " hostonly" : "") + (inLine.has(i) ? " line" : "") + (man ? " man" : "");
      // Click tiles: the host can confirm (or un-confirm) them for this player by clicking.
      const toggle = man ? () => { const bag = (H.personal[r][k] = H.personal[r][k] || {}); if (c.text in bag) delete bag[c.text]; else bag[c.text] = "host"; saveH(); checkBingoEnd(); renderHost(); } : null;
      g.append(h(man ? "button" : "div", { class: cls, style: `cursor:${man ? "pointer" : "default"};--cat:${CAT[c.col]}`, title: man ? (yes ? "Click tile, confirmed. Click to undo." : mine ? "Click tile they marked. Click to confirm it." : "Click tile. They haven't marked it.") : "Tracked automatically", onclick: toggle },
        c.wild ? `Wild: ${vs.cl.wild || "none"}` : c.text,
        c.wild ? "" : h("span", { class: "dif d" + d }, d),
        man ? h("span", { class: "tag" }, yes ? "✋ ✓" : "✋") : ""));
    });
    const manMarked = vs.cells.map((c, i) => ({ c, i })).filter(({ c, i }) => !c.wild && !AUTO.has(c.text) && vs.cl.marks.has(i));
    const verdicts = vs.lines.map((x) => {
      const miss = x.l.filter((i) => !vs.ok(i)).map((i) => vs.cells[i].wild ? "wild card" : vs.cells[i].text);
      return h("div", {}, `${LINE_NAMES[x.idx]}: `, miss.length ? h("b", { style: "color:#fdba74" }, "check " + miss.join(", ")) : h("b", { style: "color:#5fd39a" }, "confirmed"));
    });
    body.append(h("b", {}, `${vp.name}'s board`), g,
      manMarked.length ? h("div", { class: "amqb-muted" }, "Click tiles they marked: ", manMarked.map(({ c, i }) => h("b", { style: `color:${vs.ok(i) ? "#5fd39a" : "#fdba74"}` }, c.text + (vs.ok(i) ? " ✓" : ""))).reduce((a, x, j) => (j ? [...a, ", ", x] : [x]), [])) : "",
      h("div", { class: "amqb-muted" }, "Green: confirmed. Amber: they marked it, not confirmed yet. Grey: happened but they didn't mark it. Striped ✋ = click tiles: click one to confirm it for this player."), verdicts);
  }
}

function tabTiles(body, r) {
  const tiles = h("div", { class: "amqb-tiles" });
  COLS.forEach((col, ci) => tiles.append(h("div", { class: ci === 3 ? "self" : "" }, h("b", { style: `color:${CAT[ci]}` }, col.name), ci === 3 ? h("span", { class: "amqb-muted", style: "font-size:10px" }, "Each player's own. Auto ones are tracked per player (Players tab); the host can't check the rest.") : "", col.pool.map((t) => {
    const on = t.text in H.checks[r], rule = RULES[t.text], ask = !on && H.asks && H.asks[r] && H.asks[r][t.text];
    if (ci === 3) return h("button", { class: "amqb-t", disabled: true, title: rule ? "Tracked per player automatically" : "Only the player knows. It shows as \"check\" on their board." }, t.text + (rule ? "" : " ✋"));
    return h("button", { class: "amqb-t" + (on ? " on" : "") + (ask ? " ask" : ""), title: ask ? `Might count for song ${ask}. Click to confirm.` : rule && rule.p ? "Tracked per player automatically" : rule ? "Checked automatically" : "Click when it happens",
      onclick: () => { if (on) delete H.checks[r][t.text]; else H.checks[r][t.text] = game.songNumber || 0; saveH(); checkBingoEnd(); renderHost(); } },
      (on ? "✓ " : "") + t.text + (rule && rule.p ? " (per player)" : rule ? "" : " ✋"));
  }))));
  body.append(h("p", { class: "amqb-muted" }, `Checked this round: ${Object.keys(H.checks[r]).length}. ✋ = judgment tile, click it when it happens. "(per player)" tiles are tracked for each player separately.`), tiles);

  const cur = H.custom || { mode: "add", text: "" };
  const ta = h("textarea", { class: "amqb-ta", placeholder: "Anime: Anime has a dog in it\nSong: *Song is over 5 minutes\n[Artist]\nArtist is a VTuber\nArtist has a number in their name" });
  ta.value = cur.text || "";
  const mode = h("select", { class: "amqb-in" }, h("option", { value: "add", selected: cur.mode !== "replace" }, "Add to the tile set"), h("option", { value: "replace", selected: cur.mode === "replace" }, "Replace the tile set"));
  const note = h("div", {});
  const save = () => {
    const { cols, errors } = parseTiles(ta.value);
    const e = hostSavePack({ mode: mode.value, text: ta.value }, H.settings || DEFAULT_SETTINGS);
    note.innerHTML = "";
    if (errors.length) note.append(h("div", { class: "amqb-err" }, errors.slice(0, 4).join(" · ")));
    if (e) { note.append(h("div", { class: "amqb-err" }, e)); return; }
    const added = cols.map((c, i) => c.length ? `${COLS[i].name} ${c.length}` : "").filter(Boolean).join(", ");
    note.append(h("div", { class: "amqb-ok" }, (added ? `Saved: ${added}. ` : "Saved. ") + (H.packId ? `Tile pack ${H.packId}. Announce the round again so players get it. Website boards won't match while custom tiles are on.` : `Using the ${SET_NAMES[(H.settings || DEFAULT_SETTINGS).set || "S"]} tiles.`)));
    renderPlayer();
  };
  body.append(h("b", {}, "Custom tiles" + (H.packId ? ` (pack ${H.packId})` : "")),
    h("p", { class: "amqb-muted" }, "One tile per line. Start with the column (Anime, Song, Artist, Individual, Multiplayer) and a colon, or put a [Column] header above a group. * in front = hard, - in front = easy, otherwise medium. Custom tiles are click-to-mark."),
    ta, h("div", { class: "amqb-row" }, mode,
      h("button", { class: "amqb-btn pri", onclick: save }, "Save tiles"),
      h("button", { class: "amqb-btn", onclick: () => { ta.value = COLS.map((c) => `[${c.name}]\n` + c.pool.map((t) => (t.hard ? "*" : t.d === "E" ? "-" : "") + t.text).join("\n")).join("\n\n"); mode.value = "replace"; } }, "Load current list to edit"),
      h("button", { class: "amqb-btn", onclick: () => { ta.value = ""; mode.value = "add"; save(); } }, "Clear custom tiles")),
    note);
}

function tabSettings(body) {
  const g = H.game, st = H.settings || DEFAULT_SETTINGS;
  const sel = (opts, val, on) => { const x = h("select", { class: "amqb-in" }, opts.map(([v, t]) => h("option", { value: v, selected: String(v) === String(val) }, t))); x.addEventListener("change", () => on(x.value)); return x; };
  const chk = (val, on) => { const x = h("input", { type: "checkbox", checked: val }); x.addEventListener("change", () => on(x.checked)); return x; };
  const setGame = (patch) => { H.game = { ...H.game, ...patch }; if (H.round > H.game.rounds) H.round = 1; saveH(); renderHost(); };
  const setTiles = (patch) => { const e = hostSavePack(H.custom || { mode: "add", text: "" }, { ...st, ...patch }); if (e) sysMsg("AMQ Bingo: " + e); renderPlayer(); renderHost(); };
  const row = (label, ctl, help) => h("div", { class: "amqb-setrow" }, h("div", {}, h("b", {}, label), help ? h("div", { class: "amqb-muted" }, help) : null), ctl);
  body.append(
    h("b", { class: "amqb-sechead" }, "Speedrun (solo)"),
    row("Official speedrun rules", h("div", { class: "amqb-row" }, h("button", { class: "amqb-btn", onclick: () => applySpeedrun("random") }, "Random songs"), h("button", { class: "amqb-btn", onclick: () => applySpeedrun("watched") }, "Watched songs")),
      "Sets everything to the fixed speedrun rules so times compare: Standard tiles, auto tiles only (locked), no wild card, Mix column, round ends at the first bingo; room: 100 songs, 20s guess time, all song types, full difficulty. Only Random vs Watched differs."),
    h("b", { class: "amqb-sechead" }, "Rounds"),
    row("Number of rounds", sel([[1, "1 (no rounds)"], [2, "2"], [3, "3"], [4, "4"], [5, "5"]], g.rounds, (v) => setGame({ rounds: Number(v) })), "With 1, round buttons are hidden. The website supports up to 3."),
    row("A round ends", sel([["amq", "When the AMQ game ends"], ["bingo", "When someone gets a confirmed bingo"]], g.endMode, (v) => setGame({ endMode: v })), g.endMode === "bingo" ? "The round keeps going across AMQ games until a bingo is confirmed." : "Boards reset with each new AMQ game."),
    row("Return to lobby when a round ends early", chk(g.autoLobby !== false, (v) => setGame({ autoLobby: v })), "After End round now or a bingo, starts the return-to-lobby vote and votes yes. Only works if you're the room host."),
    row("Announce bingos in chat", chk(g.announceBingo !== false, (v) => setGame({ announceBingo: v })), "When a board gets a line and the player hasn't called it yet, posts it in game chat."),
    row("Ask me to end the round on a bingo", chk(g.askEnd !== false, (v) => setGame({ askEnd: v })), "Shows a prompt with End round / Keep playing. (With \"ends on a bingo\" the round ends by itself instead.)"),
    row("Boards in the next round", sel([["new", "New board"], ["same", "Same board, marks cleared"], ["keep", "Same board, marks kept"]], g.nextBoard || "new", (v) => setGame({ nextBoard: v })), "Same board = everyone keeps the tiles from round 1. Website players always get a new board."),
    row("Start the next round automatically", chk(g.autoNext, (v) => setGame({ autoNext: v })), "Posts the next round's code in chat when a round ends."),
    h("b", { class: "amqb-sechead" }, "Boards"),
    row("Tile set", sel(Object.entries(SET_NAMES), st.set || "S", (v) => setTiles({ set: v, hardCap: SET_CAP[v] })), SET_INFO[st.set || "S"] + (st.set && st.set !== "S" ? " Website boards only use Standard." : "")),
    row("Include click-to-mark tiles", chk(st.manual !== false, (v) => setTiles({ manual: v })), "Off = only tiles the script marks by itself."),
    row("Hard tiles per column", sel([[0, "0"], [1, "1"], [2, "2"], [3, "3"], [5, "No limit"]], st.hardCap, (v) => setTiles({ hardCap: Number(v) })), "Website boards always use 1."),
    row("Wild card in the center", chk(st.wild !== false, (v) => setTiles({ wild: v })), "Off = the center is a normal Artist tile. Website boards always have the wild card."),
    row("Lock auto tiles", chk(!!st.lockAuto, (v) => setTiles({ lockAuto: v })), "Players can't mark or unmark auto tiles by hand; only the script does. Picking one of several matches still works. Website players aren't limited."),
    row("Only mark tiles on songs you got right", chk(!!st.needCorrect, (v) => setTiles({ needCorrect: v })), "Tiles only count for players who got that song. Website players aren't limited."),
    row("One tile per song", chk(!!st.onePerSong, (v) => setTiles({ onePerSong: v })), "When a song matches several tiles, players pick one. Website players aren't limited."),
    row("Replacement boards", chk(st.replace, (v) => setTiles({ replace: v })), "One new board per round, 3 minutes after joining."),
    row("Auto-marking for players", chk(st.auto, (v) => setTiles({ auto: v })), "Off = players mark every tile by hand. Your tracking still runs."),
    h("b", { class: "amqb-sechead" }, "Event"),
    (() => {
      const keyIn = h("input", { class: "amqb-in", maxlength: 6, placeholder: "Event key", style: "width:110px;text-transform:uppercase;letter-spacing:2px" });
      return row("Event key", h("div", { class: "amqb-row" }, h("b", { style: "letter-spacing:2px" }, H.key), keyIn, h("button", { class: "amqb-btn", onclick: () => {
        const k = keyIn.value.trim().toUpperCase();
        if (!/^[A-Z]{6}$/.test(k) || [...k].some((c) => !ALPHA.includes(c))) { sysMsg("AMQ Bingo: an event key is 6 letters (no I, L or O)."); return; }
        H.key = k; H.codes = codesFor(k); saveH(); renderHost();
      } }, "Use key")), "Same key as the website, so the codes match.");
    })(),
    row("Start over", newEventBtn("settings"), "New codes, clears players and checks. Keeps these settings and your custom tiles."));
}

/* ---------------- buttons in AMQ's own menus ---------------- */
function toggleBoard() { playerUI.toggle(); renderPlayer(); placeBoard(); }
function toggleHost() { hostUI.toggle(); if (hostUI.panel.style.display !== "none") lastAlertSeen = bingoAlerts.length; renderHost(); }
function addMenuButtons() {
  // Quiz screen: icons in the top bar next to AMQ's own options
  const qc = document.getElementById("qpOptionContainer");
  if (qc && !document.getElementById("qpAmqBingo")) {
    const inner = qc.querySelector("div") || qc;
    const w = parseFloat(getComputedStyle(qc).width) || qc.offsetWidth;
    qc.style.width = (w + 70) + "px";
    const icon = (fa, fallback) => { const i = h("i", { class: `fa ${fa} qpMenuItem`, "aria-hidden": "true" }); if (!document.querySelector(".fa")) i.textContent = fallback; return i; };
    inner.append(
      h("div", { id: "qpAmqBingo", class: "clickAble qpOption", title: "AMQ Bingo board (Alt+G)", onclick: toggleBoard }, icon("fa-th", "B")),
      h("div", { id: "qpAmqBingoHost", class: "clickAble qpOption", title: "AMQ Bingo host panel (Alt+H)", onclick: toggleHost }, icon("fa-trophy", "H")));
  }
  // Main menu: entries in the settings dropdown
  const ol = document.getElementById("optionListSettings");
  if (ol && !document.getElementById("olAmqBingo")) {
    ol.parentNode.insertBefore(h("li", { id: "olAmqBingo", class: "clickAble", onclick: toggleBoard }, "AMQ Bingo"), ol);
    ol.parentNode.insertBefore(h("li", { id: "olAmqBingoHost", class: "clickAble", onclick: toggleHost }, "Bingo host"), ol);
  }
}
function markHostButton() {
  const b = document.getElementById("qpAmqBingoHost"); if (!b) return;
  const fresh = bingoAlerts.length - lastAlertSeen > 0 && hostUI.panel.style.display === "none";
  b.style.color = fresh ? "#ff4f93" : ""; b.title = fresh ? `AMQ Bingo: ${bingoAlerts[0]}` : "AMQ Bingo host panel (Alt+H)";
}

/* =====================================================================
 * BOOT
 * ===================================================================== */
function boot() {
  document.head.appendChild(h("style", {}, CSS));
  if (P.packId && P.packBody) { if (applyPack(P.packBody)) { P.packId = ""; P.packBody = ""; } }
  const dockBtn = h("button", { class: "amqb-hbtn", title: "Switch between docked in chat and popup" }, "⇄");
  playerUI = makePanel("amqbPlayer", "AMQ Bingo", "right", dockBtn, () => undockBoard());
  dockBtn.addEventListener("click", () => { P.dock = P.dock === false; saveP(); placeBoard(); dockBtn.title = P.dock !== false ? "Pop out" : "Dock into chat"; });
  window.addEventListener("resize", () => { if (dock) placeBoard(); });
  hostUI = makePanel("amqbHost", "Bingo host", "left", null, () => renderMini());
  renderPlayer(); renderHost();
  addMenuButtons(); setInterval(addMenuButtons, 3000); // AMQ can rebuild its menus

  document.addEventListener("keydown", (e) => {
    if (!e.altKey || e.ctrlKey || e.metaKey) return;
    if (e.code === "KeyG") { e.preventDefault(); toggleBoard(); }
    if (e.code === "KeyD" && e.shiftKey) { e.preventDefault(); copyChatLayout(); }
    if (e.code === "KeyH") { e.preventDefault(); toggleHost(); }
  });

  const on = (name, fn) => { try { const l = new PAGE.Listener(name, (p) => { try { fn(p); } catch (e) { console.error("[AMQ Bingo]", name, e); } }); l.__amqb = true; l.bindListener(); } catch (e) { console.warn("[AMQ Bingo] no listener for", name); } };
  // Keep our hidden sync messages away from AMQ's own chat code, so no DM windows pop open
  // for them (on either side) and AMQ's "can't message" popups for them are swallowed.
  const ours = (x) => typeof x === "string" && x.startsWith(PREFIX);
  try {
    const LP = PAGE.Listener.prototype, fire = LP.fire;
    // find which field holds the event name (normally "command")
    const probe = new PAGE.Listener("__amqbProbe", () => {}), key = Object.keys(probe).find((k) => probe[k] === "__amqbProbe") || "command";
    if (typeof fire === "function") LP.fire = function (p) {
      const cmd = this[key];
      if (!this.__amqb) {
        if (cmd === "chat message" && p && ours(p.message)) return;
        if (cmd === "chat message response" && p && (ours(p.msg) || ours(p.message))) return;
        if (cmd === "new chat alert" && p && /level \d+ required/i.test(p.alert || "") && Date.now() - lastOwnDM < 3000 && norm(p.name || "") === lastDMTarget) return;
      }
      return fire.apply(this, arguments);
    };
  } catch (e) { console.warn("[AMQ Bingo] couldn't filter chat events", e); }
  on("Game Starting", (p) => { trackGameStart(p); setTimeout(placeBoard, 800); setTimeout(() => sysMsg("AMQ Bingo is on. Alt+G: your board. Alt+H: host panel."), 600); });
  on("quiz over", () => { game.inQuiz = false; renderHost(); });
  on("play next song", (p) => { speedStart(); game.inQuiz = true; game.hints = {}; game.nameHint = null; game.songNumber = p.songNumber; game.mySubs = []; game.onLast = !!p.onLastSong; game.start = game.nextStart; game.nextStart = null; });
  // Only the sample's start second is kept (it says nothing about which song it is); it's used after the reveal.
  on("quiz next video info", (p) => { game.nextStart = p && typeof p.startPoint === "number" ? p.startPoint : null; });
  on("quiz answer", (p) => { if (p && p.success !== false && typeof p.answer === "string") (game.mySubs = game.mySubs || []).push(p.answer); });
  const amqGameOver = () => { if (H.active && H.game.endMode === "amq" && game.hist.length) endRound("the AMQ game ended"); };
  on("quiz end result", () => { amqGameOver(); game.inQuiz = false; });
  on("return lobby vote result", (p) => { if (p && p.passed) { amqGameOver(); game.inQuiz = false; } });
  // Hints: who used which hint this song (sent to everyone), and how much of the title your own name hint showed.
  on("quiz player hint used", (p) => { (p.gamePlayerIds || []).forEach((id) => { const h = (game.hints = game.hints || {}); (h[id] = h[id] || []).push(p.hintId); }); });
  on("quiz name hint", (p) => { const t = String((p && p.hint) || "").split(/\s+/).filter(Boolean); if (t.length) game.nameHint = { id: myId(), shown: t.filter((x) => x !== "_").length / t.length }; });
  // Joining mid-game (spectate, late join) or a Jam restart: learn the players so per-player tracking works.
  const keepRoom = (st) => { if (st && st.songSelection) game.roomSettings = st; };
  on("Host Game", (p) => keepRoom(p && p.settings));
  on("Join Game", (p) => keepRoom(p && p.settings));
  // AMQ sends { changes: {...}, communityMode } (seen in a real log).
  on("Room Settings Changed", (p) => { const ch = (p && p.changes) || p; if (ch) game.roomSettings = { ...(game.roomSettings || {}), ...ch }; renderPlayer(); });
  on("Spectate Game", (p) => { keepRoom(p && p.settings); });
  on("Spectate Game", (p) => { const q = p && p.quizState; if (q && q.players) trackGameStart({ players: q.players }); });
  // Rejoining after a disconnect (or a page reload mid-game) sends "Join Game" with the current players.
  on("Join Game", (p) => { const q = p && p.quizState; if (q && q.players && !p.inLobby) trackGameStart({ players: q.players }); });
  on("Jam Game Restarting", (p) => { trackGameStart(p); });
  on("player late join", (p) => { const x = p && p.newPlayer; if (x && x.gamePlayerId != null) game.players[x.gamePlayerId] = { name: x.name, seat: x.positionSlot, level: x.level }; });
  on("player answers", (p) => { game.answers = {}; (p.answers || []).forEach((a) => { game.answers[a.gamePlayerId] = a.answer || ""; }); });
  on("answer results", (p) => {
    const res = {}; (p.players || []).forEach((x) => { res[x.gamePlayerId] = x; });
    game.seq = (game.seq || 0) + 1;
    const rec = { seq: game.seq, n: game.songNumber || game.hist.length + 1, s: p.songInfo || {}, res, answers: { ...game.answers }, chat: game.chat, left: game.left, mySubs: (game.mySubs || []).slice(), last: !!game.onLast, start: game.start, hints: { ...(game.hints || {}) }, nameHint: game.nameHint || null };
    game.hist.push(rec); game.chat = false; game.left = false; game.answers = {};
    playerOnSong(rec); hostOnSong(rec);
  });
  on("game chat update", (p) => {
    (p.messages || []).forEach((m) => {
      const text = m.message || "";
      const a = text.match(ANNOUNCE_RE);
      if (a && a[8] && newerVersion(a[8], SCRIPT_VERSION) && !warnedVersion) { warnedVersion = true; sysMsg(`AMQ Bingo: the host is on v${a[8]} and you have v${SCRIPT_VERSION}. Update so your board matches: open Tampermonkey and "Check for userscript updates", or reinstall from ${INSTALL_URL}`); }
      if (a) { if (!(Number(a[1]) === P.round && a[2] === P.code && (a[4] || "") === (P.packId || ""))) { P.nextBoard = a[6] ? { bcode: a[6], keep: !!a[7] } : null; if (announceSeen(Number(a[1]), a[2], a[3], a[4], a[5])) sysMsg(`AMQ Bingo: joined round ${a[1]}. Press Alt+G to see your board.`); } return; }
      const bc = text.match(BINGO_RE);
      if (bc) { if (m.sender && norm(m.sender) === norm(bc[1])) hostTakeBingo(m.sender, Number(bc[2]), bc[3]); return; }
      // Any other BINGO call (older script, website player typing it, claim that doesn't match): still ask the host.
      if (m.sender && /^\s*bingo\b/i.test(text) && H.active && !H.ended[H.round] && norm(m.sender) !== norm(myName())) { askToEnd(m.sender); return; }
      if (m.sender && hostTakeClaim(m.sender, text)) return;
      if (/\p{Extended_Pictographic}|:[a-z0-9_+\-]+:/iu.test(text) && !/^(BINGO! |🎉 AMQ Bingo|AMQ Bingo)/u.test(text)) game.chat = true;
    });
  });
  // Someone else leaving or moving to spectator counts; you don't.
  ["Player Left", "Player Changed To Spectator"].forEach((n) => on(n, (p) => {
    const who = p && ((p.player && p.player.name) || (p.playerDescription && p.playerDescription.name) || p.name);
    if (!who || norm(who) !== norm(myName())) game.left = true;
  }));
  let dmWarned = false;
  const isOurAlert = (p) => !!p && /level \d+ required/i.test(p.alert || "") && Date.now() - lastOwnDM < 3000 && norm(p.name || "") === lastDMTarget;
  const onOurAlert = (p) => {
    // Only AMQ's "Level 5 required ..." refusal for the player we just messaged counts.
    if (!isOurAlert(p)) return;
    dmBlocked.set(lastDMTarget, Date.now());
    if (!dmWarned) { dmWarned = true; sysMsg("AMQ Bingo: AMQ won't deliver private messages to " + p.name + " (" + p.alert + "). Your board still reaches them when you press BINGO."); }
  };
  on("new chat alert", onOurAlert);
  on("chat message response", (p) => {
    const t = p && (p.target || p.name); if (t) dmBlocked.delete(norm(t));
  });
  const onDM = (p) => {
    if (!p || typeof p.message !== "string") return;
    if (!p.message.startsWith(PREFIX)) { hostTakeClaim(p.sender, p.message); return; }
    const parts = p.message.slice(PREFIX.length).trim().split(" ");
    if (parts[0] === "P") onPackChunk(parts); else hostReceive(p.sender, p.message);
  };
  on("chat message", onDM);
  // Earliest hook (the same one other AMQ scripts use): our sync messages are handled here and never
  // reach AMQ's chat code at all. If AMQ changes this internal, the listener filters below still apply.
  try {
    const cmds = PAGE.socket._socket.t.$command, first = cmds && cmds[0];
    if (typeof first === "function") cmds[0] = function (msg) {
      const d = msg && msg.data;
      if (msg && msg.command === "chat message" && d && ours(d.message)) { onDM(d); return; }
      if (msg && msg.command === "chat message response" && d && (ours(d.msg) || ours(d.message))) { const t = d.target || d.name; if (t) dmBlocked.delete(norm(t)); return; }
      if (msg && msg.command === "new chat alert" && isOurAlert(d)) { onOurAlert(d); return; }
      return first.apply(this, arguments);
    };
  } catch (e) { /* not available; listener filters handle it */ }

  // Hold this player's skip vote while they still have a tile to pick, and send it once they pick.
  try {
    const sock = PAGE.socket, send = sock.sendCommand;
    sock.sendCommand = function (cmd) {
      if (cmd && cmd.type === "quiz" && cmd.command === "skip vote" && cmd.data) {
        const b = curBoard();
        if (cmd.data.skipVote && b && b.pick) {
          skipHeld = true; try { PAGE.quiz.skipController.toggled = false; } catch (e) {}
          renderPlayer(); return;
        }
        if (!cmd.data.skipVote) skipHeld = false;
      }
      return send.apply(this, arguments);
    };
    releaseSkip = () => {
      if (!skipHeld) return; skipHeld = false;
      try { send.call(sock, { type: "quiz", command: "skip vote", data: { skipVote: true } }); PAGE.quiz.skipController.toggled = true; } catch (e) {}
    };
  } catch (e) { console.warn("[AMQ Bingo] couldn't hook skip votes", e); }

  // hide our sync DMs from chat windows
  try {
    PAGE.ChatBox.prototype.writeMessage = (function (orig) {
      return function () { for (const a of arguments) if (ours(a) || (a && typeof a === "object" && (ours(a.message) || ours(a.msg)))) return; return orig.apply(this, arguments); };
    })(PAGE.ChatBox.prototype.writeMessage);
  } catch (e) {}
}

const wait = setInterval(() => {
  const ls = document.getElementById("loadingScreen");
  if (ls && ls.classList.contains("hidden") && typeof PAGE.Listener !== "undefined") { clearInterval(wait); boot(); }
}, 500);

})();
