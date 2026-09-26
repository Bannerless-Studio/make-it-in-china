#!/usr/bin/env node

import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import {
  access,
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  rename,
  rm,
  stat,
  writeFile
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { buildTtsInventory } from "./tts-inventory.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const PHASE_DIR = join(ROOT, "content", "phase1");
const AUDIO_DIR = join(ROOT, "public", "audio", "phase1");
const MANIFEST_PATH = join(ROOT, "public", "audio", "manifest.json");
const REVIEW_PATH = join(ROOT, "docs", "design", "review-sheet.tsv");
const WORD_AUDIO_MAP_PATH = join(PHASE_DIR, "word-audio-map.json");
const CONTENT_REVISION = "phase1-design-1";
const TTS_PROVIDER_VERSION = "edge-tts@7.2.3";
const CODEC_SETTINGS = {
  codec: "libopus",
  bitrate: "32k",
  vbr: "off",
  application: "voip",
  channels: 1,
  sampleRate: 48_000,
  filter: "silenceremove=start_periods=1:start_duration=0:start_threshold=-50dB:start_silence=0.08:stop_periods=-1:stop_duration=0:stop_threshold=-50dB:stop_silence=0.18,loudnorm=I=-18:TP=-2:LRA=11"
};
const CATEGORY_ORDER = ["lines", "replies", "hints", "words", "ambient", "system"];
const MAX_OUTPUT = 32_768;
const SIZE_CAP_TOLERANCE = 1.05;

function usage() {
  return [
    "Usage: node scripts/tts.mjs [--dry-run] [--validate] [--only <idPrefix>] [--force]",
    "  --dry-run   Print the speech inventory without writing files",
    "  --validate  Validate manifest entries and generated Opus files",
    "  --only      Generate or validate IDs beginning with the prefix",
    "  --force     Regenerate selected clips even when cached"
  ].join("\n");
}

function parseArgs(argv) {
  const options = { dryRun: false, validate: false, force: false, only: null };
  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (value === "--dry-run") options.dryRun = true;
    else if (value === "--validate") options.validate = true;
    else if (value === "--force") options.force = true;
    else if (value === "--only") {
      options.only = argv[index + 1];
      if (!options.only || options.only.startsWith("--")) throw new Error("--only needs an ID prefix");
      index += 1;
    } else if (value === "--help" || value === "-h") {
      console.log(usage());
      process.exit(0);
    } else {
      throw new Error(`Unknown argument "${value}"`);
    }
  }
  if (options.dryRun && options.validate) {
    throw new Error("--dry-run and --validate cannot be combined");
  }
  if (options.validate && options.force) {
    throw new Error("--force cannot be used with --validate");
  }
  return options;
}

async function exists(path) {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

async function readJson(path) {
  return JSON.parse(await readFile(path, "utf8"));
}

async function readOptionalJson(path) {
  try {
    return await readJson(path);
  } catch (error) {
    if (error?.code === "ENOENT") return null;
    throw error;
  }
}

async function loadInputs() {
  const [words, scenes, world, voices, ambient, wordAudioMap] = await Promise.all([
    readJson(join(PHASE_DIR, "words.json")),
    readJson(join(PHASE_DIR, "scenes.json")),
    readJson(join(PHASE_DIR, "world.json")),
    readJson(join(PHASE_DIR, "voices.json")),
    readOptionalJson(join(PHASE_DIR, "ambient.json")),
    readOptionalJson(WORD_AUDIO_MAP_PATH)
  ]);
  return {
    inventory: buildTtsInventory({
      words,
      scenes,
      world,
      voices,
      ambient,
      wordAudioMap: wordAudioMap ?? {},
    }),
    contentRevision: voices.contentRevision ?? world.contentRevision ?? CONTENT_REVISION
  };
}

function printWarnings(warnings) {
  for (const warning of warnings) console.warn(`WARN ${warning}`);
}

function printInventory(inventory, only) {
  const selected = inventory.clips.filter((clip) => !only || clip.id.startsWith(only));
  console.log(`TTS inventory${only ? ` for "${only}"` : ""}`);
  for (const category of CATEGORY_ORDER) {
    console.log(`${category}: ${selected.filter((clip) => clip.category === category).length}`);
  }
  console.log(`total: ${selected.length}`);
  console.log(`variantSites: ${Object.keys(inventory.variants).length}`);
  for (const [baseId, variant] of Object.entries(inventory.variants)) {
    if (!only || baseId.startsWith(only)) {
      console.log(`${baseId}: ${Object.keys(variant.byBinding).length} variants`);
    }
  }
  console.log(`warnings: ${inventory.warnings.length}`);
  printWarnings(inventory.warnings);
}

function run(command, args, timeoutMs = 30_000) {
  return new Promise((resolvePromise, rejectPromise) => {
    const child = spawn(command, args, {
      cwd: ROOT,
      shell: false,
      stdio: ["ignore", "pipe", "pipe"]
    });
    let stdout = "";
    let stderr = "";
    let settled = false;
    const append = (current, chunk) => (current + chunk.toString("utf8")).slice(-MAX_OUTPUT);
    child.stdout.on("data", (chunk) => {
      stdout = append(stdout, chunk);
    });
    child.stderr.on("data", (chunk) => {
      stderr = append(stderr, chunk);
    });
    const timer = setTimeout(() => {
      child.kill("SIGKILL");
      if (!settled) {
        settled = true;
        rejectPromise(new Error(`${command} timed out after ${timeoutMs}ms`));
      }
    }, timeoutMs);
    child.on("error", (error) => {
      clearTimeout(timer);
      if (!settled) {
        settled = true;
        rejectPromise(new Error(`${command} could not start: ${error.message}`));
      }
    });
    child.on("close", (code, signal) => {
      clearTimeout(timer);
      if (settled) return;
      settled = true;
      if (code === 0) resolvePromise({ stdout, stderr });
      else {
        const detail = stderr.trim() || stdout.trim() || `signal ${signal ?? "none"}`;
        rejectPromise(new Error(`${command} exited ${code}: ${detail}`));
      }
    });
  });
}

function sha256Buffer(buffer) {
  return createHash("sha256").update(buffer).digest("hex");
}

function sourceHash(clip) {
  return sha256Buffer(Buffer.from(JSON.stringify([
    TTS_PROVIDER_VERSION,
    CODEC_SETTINGS,
    clip.text,
    clip.voice,
    clip.rate,
    clip.pitch
  ])));
}

function entryMatches(clip, entry) {
  return entry?.sourceHash === sourceHash(clip);
}

function budgetBytes(durationMs) {
  let base = 0;
  if (durationMs <= 2_000) base = 8_000;
  else if (durationMs <= 3_000) base = 12_000;
  else if (durationMs <= 4_000) base = 16_000;
  else if (durationMs <= 6_000) base = 24_000;
  return Math.ceil(base * SIZE_CAP_TOLERANCE);
}

async function probe(path) {
  const result = await run("ffprobe", [
    "-v", "error",
    "-select_streams", "a:0",
    "-show_entries", "stream=codec_name,channels,sample_rate,bit_rate:format=duration,bit_rate",
    "-of", "json",
    path
  ]);
  const parsed = JSON.parse(result.stdout);
  const stream = parsed.streams?.[0];
  const duration = Number.parseFloat(parsed.format?.duration);
  if (!stream || !Number.isFinite(duration)) throw new Error("ffprobe returned no audio stream");
  return {
    codec: stream.codec_name,
    channels: Number(stream.channels),
    sampleRate: Number(stream.sample_rate),
    bitRate: Number(stream.bit_rate || 0),
    durationMs: Math.round(duration * 1000)
  };
}

function mediaFailures(id, media, bytes) {
  const failures = [];
  if (media.codec !== "opus") failures.push(`${id}: codec is ${media.codec}, expected opus`);
  if (media.channels !== 1) failures.push(`${id}: channels is ${media.channels}, expected 1`);
  if (media.sampleRate !== 48_000) {
    failures.push(`${id}: sample rate is ${media.sampleRate}, expected 48000`);
  }
  if (media.bitRate > 33_000) {
    failures.push(`${id}: nominal bitrate is ${media.bitRate}, expected at most 32000`);
  }
  if (media.durationMs < 250 || media.durationMs > 6_000) {
    failures.push(`${id}: duration ${media.durationMs}ms is outside 250–6000ms`);
  }
  const cap = budgetBytes(media.durationMs);
  if (cap && bytes > cap) failures.push(`${id}: ${bytes} bytes exceeds ${cap}-byte duration cap`);
  return failures;
}

async function describeFile(path) {
  const [buffer, details, media] = await Promise.all([readFile(path), stat(path), probe(path)]);
  return {
    bytes: details.size,
    sha256: sha256Buffer(buffer),
    media
  };
}

function manifestEntry(clip, details) {
  return {
    url: `audio/phase1/${clip.id}.opus`,
    text: clip.text,
    voice: clip.voice,
    rate: clip.rate,
    pitch: clip.pitch,
    sourceHash: sourceHash(clip),
    durationMs: details.media.durationMs,
    bytes: details.bytes,
    sha256: details.sha256
  };
}

async function makeClip(clip) {
  let lastError;
  for (let attempt = 1; attempt <= 2; attempt += 1) {
    const temp = await mkdtemp(join(tmpdir(), "make-it-in-china-tts-"));
    const mp3 = join(temp, `${clip.id}.mp3`);
    const opus = join(AUDIO_DIR, `.${clip.id}.${attempt}.tmp.opus`);
    try {
      await run("edge-tts", [
        "--voice", clip.voice,
        `--rate=${clip.rate}`,
        `--pitch=${clip.pitch}`,
        "--text", clip.text,
        "--write-media", mp3
      ]);
      await run("ffmpeg", [
        "-y",
        "-i", mp3,
        "-vn",
        "-af",
        CODEC_SETTINGS.filter,
        "-c:a", CODEC_SETTINGS.codec,
        "-b:a", CODEC_SETTINGS.bitrate,
        "-vbr", CODEC_SETTINGS.vbr,
        "-application", CODEC_SETTINGS.application,
        "-ac", String(CODEC_SETTINGS.channels),
        "-ar", String(CODEC_SETTINGS.sampleRate),
        opus
      ]);
      const details = await describeFile(opus);
      const failures = mediaFailures(clip.id, details.media, details.bytes);
      if (failures.length > 0) throw new Error(failures.join("; "));
      await rename(opus, join(AUDIO_DIR, `${clip.id}.opus`));
      await rm(temp, { recursive: true, force: true });
      return details;
    } catch (error) {
      lastError = error;
      await rm(opus, { force: true });
      await rm(temp, { recursive: true, force: true });
      if (attempt === 1) await new Promise((resolvePromise) => setTimeout(resolvePromise, 1_000));
    }
  }
  throw lastError;
}

async function mapLimit(items, limit, worker) {
  const results = new Array(items.length);
  let next = 0;
  async function take() {
    while (next < items.length) {
      const index = next;
      next += 1;
      results[index] = await worker(items[index], index);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, take));
  return results;
}

function orderedManifest(contentRevision, entries, inventory) {
  const clips = {};
  for (const clip of inventory.clips) {
    if (entries[clip.id]) clips[clip.id] = entries[clip.id];
  }
  return {
    schemaVersion: 1,
    contentRevision,
    clips,
    variants: inventory.variants,
    words: inventory.words
  };
}

function tsvValue(value) {
  return String(value ?? "").replace(/[\t\r\n]+/gu, " ");
}

function reviewSheet(inventory) {
  const rows = ["id\ttext\tpinyin\tvoice\tfile"];
  for (const clip of inventory.clips) {
    rows.push([
      clip.id,
      clip.text,
      clip.pinyin,
      clip.voice,
      `audio/phase1/${clip.id}.opus`
    ].map(tsvValue).join("\t"));
  }
  return `${rows.join("\n")}\n`;
}

async function generate(inventory, contentRevision, options) {
  await mkdir(AUDIO_DIR, { recursive: true });
  const previous = await readOptionalJson(MANIFEST_PATH);
  const previousClips = previous?.clips ?? {};
  const entries = {};
  const selected = inventory.clips.filter((clip) => !options.only || clip.id.startsWith(options.only));
  const selectedIds = new Set(selected.map((clip) => clip.id));
  let cached = 0;
  let generated = 0;
  let unavailable = 0;
  const errors = [];

  for (const clip of inventory.clips) {
    const path = join(AUDIO_DIR, `${clip.id}.opus`);
    if (!selectedIds.has(clip.id)) {
      if (previousClips[clip.id] && await exists(path)) entries[clip.id] = previousClips[clip.id];
      else unavailable += 1;
    } else if (!options.force && entryMatches(clip, previousClips[clip.id]) && await exists(path)) {
      entries[clip.id] = previousClips[clip.id];
      cached += 1;
    }
  }

  const pending = selected.filter((clip) => !entries[clip.id]);
  await mapLimit(pending, 4, async (clip) => {
    try {
      const details = await makeClip(clip);
      entries[clip.id] = manifestEntry(clip, details);
      generated += 1;
      console.log(`generated ${clip.id}`);
    } catch (error) {
      const oldPath = join(AUDIO_DIR, `${clip.id}.opus`);
      if (options.force && previousClips[clip.id] && await exists(oldPath)) {
        entries[clip.id] = previousClips[clip.id];
      }
      errors.push(`${clip.id}: ${error.message}`);
      console.error(`ERROR ${clip.id}: ${error.message}`);
    }
  });

  const manifest = orderedManifest(contentRevision, entries, inventory);
  await mkdir(dirname(MANIFEST_PATH), { recursive: true });
  await writeFile(MANIFEST_PATH, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
  await writeFile(WORD_AUDIO_MAP_PATH, `${JSON.stringify(inventory.wordAudioMap, null, 2)}\n`, "utf8");
  await writeFile(REVIEW_PATH, reviewSheet(inventory), "utf8");
  console.log(
    `TTS build: ${generated} generated, ${cached} cached, ${unavailable} unavailable, ${errors.length} failed`
  );
  if (errors.length > 0) process.exitCode = 1;
}

function sameJson(left, right) {
  return JSON.stringify(left) === JSON.stringify(right);
}

async function validate(inventory, contentRevision, only) {
  const failures = [];
  const stale = [];
  let manifest;
  try {
    manifest = await readJson(MANIFEST_PATH);
  } catch (error) {
    console.error(`Validation FAIL — manifest could not be read: ${error.message}`);
    process.exitCode = 1;
    return;
  }
  if (manifest.schemaVersion !== 1) failures.push("manifest schemaVersion must be 1");
  if (manifest.contentRevision !== contentRevision) {
    failures.push(
      `manifest contentRevision is "${manifest.contentRevision}", expected "${contentRevision}"`
    );
  }
  if (!sameJson(manifest.variants, inventory.variants)) {
    failures.push("manifest variants do not match the deterministic inventory");
  }
  if (!sameJson(manifest.words, inventory.words)) {
    failures.push("manifest words do not match dictionary order");
  }

  const expected = inventory.clips.filter((clip) => !only || clip.id.startsWith(only));
  await mapLimit(expected, 4, async (clip) => {
    const entry = manifest.clips?.[clip.id];
    if (!entry) {
      failures.push(`${clip.id}: missing manifest entry`);
      return;
    }
    if (!entryMatches(clip, entry)) {
      failures.push(`${clip.id}: text, voice, provider, or codec settings do not match inventory`);
    }
    if (!/^[a-f0-9]{64}$/u.test(entry.sourceHash ?? "")) {
      failures.push(`${clip.id}: manifest sourceHash is invalid`);
    }
    if (!Number.isInteger(entry.durationMs) || entry.durationMs < 0) {
      failures.push(`${clip.id}: manifest durationMs is invalid`);
    }
    if (!Number.isInteger(entry.bytes) || entry.bytes < 0) {
      failures.push(`${clip.id}: manifest bytes is invalid`);
    }
    if (!/^[a-f0-9]{64}$/u.test(entry.sha256 ?? "")) {
      failures.push(`${clip.id}: manifest sha256 is invalid`);
    }
    const expectedUrl = `audio/phase1/${clip.id}.opus`;
    if (entry.url !== expectedUrl) {
      failures.push(`${clip.id}: URL is "${entry.url}", expected "${expectedUrl}"`);
    }
    const path = join(AUDIO_DIR, `${clip.id}.opus`);
    if (!await exists(path)) {
      failures.push(`${clip.id}: file is missing`);
      return;
    }
    try {
      const details = await describeFile(path);
      if (entry.sha256 !== details.sha256) failures.push(`${clip.id}: sha256 does not match file`);
      if (entry.bytes !== details.bytes) failures.push(`${clip.id}: byte count does not match file`);
      if (
        Number.isInteger(entry.durationMs) &&
        Math.abs(entry.durationMs - details.media.durationMs) > 5
      ) {
        failures.push(`${clip.id}: durationMs does not match ffprobe`);
      }
      failures.push(...mediaFailures(clip.id, details.media, details.bytes));
    } catch (error) {
      failures.push(`${clip.id}: could not inspect file: ${error.message}`);
    }
  });

  const allIds = new Set(inventory.clips.map((clip) => clip.id));
  if (await exists(AUDIO_DIR)) {
    const files = await readdir(AUDIO_DIR, { withFileTypes: true });
    for (const file of files) {
      if (file.isFile() && file.name.endsWith(".opus")) {
        const id = file.name.slice(0, -5);
        if (!allIds.has(id)) stale.push(file.name);
      }
    }
  }
  for (const id of Object.keys(manifest.clips ?? {})) {
    if (!allIds.has(id)) stale.push(`manifest:${id}`);
  }

  for (const item of [...new Set(stale)].sort()) console.warn(`STALE ${item}`);
  for (const failure of failures.sort()) console.error(`FAIL ${failure}`);
  if (failures.length > 0) {
    console.error(
      `Validation FAIL — ${failures.length} problem(s), ${stale.length} stale artifact(s) reported`
    );
    process.exitCode = 1;
  } else {
    console.log(
      `Validation PASS — ${expected.length} clip(s), ${stale.length} stale artifact(s) reported`
    );
  }
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const { inventory, contentRevision } = await loadInputs();
  if (options.dryRun) {
    printInventory(inventory, options.only);
    return;
  }
  printWarnings(inventory.warnings);
  if (options.validate) {
    await validate(inventory, contentRevision, options.only);
    return;
  }
  await generate(inventory, contentRevision, options);
}

main().catch((error) => {
  console.error(`TTS FAIL — ${error.message}`);
  process.exitCode = 1;
});
