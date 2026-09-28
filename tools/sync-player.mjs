import { readFileSync, writeFileSync, copyFileSync, statSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const source = resolve(dirname(fileURLToPath(import.meta.url)), '../assets');
const target = process.argv[2];
if (!target) throw new Error('Usage: node tools/sync-player.mjs <world3d/assets>');
const library = JSON.parse(readFileSync(join(source, 'index.json'), 'utf8'));
const indexPath = join(target, 'index.json');
const index = JSON.parse(readFileSync(indexPath, 'utf8'));
const player = library.assets.find(e => e.path === 'characters/player.glb');
const position = index.assets.findIndex(e => e.path === 'characters/player.glb');
if (!player || position < 0) throw new Error('Player is missing from an asset index');
const file = join(source, player.path);
copyFileSync(file, join(target, player.path));
index.assets[position] = { ...player, bytes: statSync(file).size };
writeFileSync(indexPath, JSON.stringify(index));
console.log(`Synced polished player: ${player.tris} triangles, ${statSync(file).size} bytes`);
