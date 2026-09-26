#!/usr/bin/env node

import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import {
  ambientRows,
  checkStrictContent,
  legacyCoverageScenes,
  strictRuleNumbers,
} from "./check-level-rules.mjs";

const strict = process.argv.includes("--strict");
const phaseArgument = process.argv.slice(2).find((argument) => argument !== "--strict");
const phaseDir = resolve(phaseArgument ?? "");
if (!phaseArgument) {
  console.error("Usage: node scripts/check-level.mjs <phase-directory> [--strict]");
  process.exit(1);
}

const failures = Array.from({ length: 7 }, () => []);
const warnings = Array.from({ length: 7 }, () => []);

let words;
let scenes;
let world;

let ambient = [];

try {
  [words, scenes, world] = await Promise.all(
    ["words.json", "scenes.json", "world.json"].map(async (name) =>
      JSON.parse(await readFile(resolve(phaseDir, name), "utf8"))
    )
  );
  try {
    ambient = ambientRows(JSON.parse(await readFile(resolve(phaseDir, "ambient.json"), "utf8")));
  } catch {
    ambient = [];
  }
} catch (error) {
  if (strict) {
    for (const rule of strictRuleNumbers) {
      console.log(`RULE${rule} FAIL content: ${rule === 1 ? `content files could not be read: ${error.message}` : "not checked because content could not be read"}`);
    }
    process.exit(1);
  }
  console.log(`Rule 1 FAIL — content files could not be read: ${error.message}`);
  console.log("Rule 2 FAIL — not checked because content could not be read.");
  console.log("Rule 3 FAIL — not checked because content could not be read.");
  console.log("Rule 4 FAIL — not checked because content could not be read.");
  console.log("Rule 5 FAIL — not checked because content could not be read.");
  console.log("Rule 6 FAIL — not checked because content could not be read.");
  console.log("Rule 7 FAIL — not checked because content could not be read.");
  console.log("Summary FAIL — 7 rules failed.");
  process.exit(1);
}

if (strict) {
  let wordAudioMap = {};
  try {
    wordAudioMap = JSON.parse(await readFile(resolve(phaseDir, "word-audio-map.json"), "utf8"));
  } catch {
    wordAudioMap = {};
  }
  const result = checkStrictContent(words, scenes, world, wordAudioMap, ambient);
  const issuesByRule = new Map(strictRuleNumbers.map((rule) => [rule, []]));
  for (const issue of result.issues) issuesByRule.get(issue.rule)?.push(issue);
  for (const rule of strictRuleNumbers) {
    const ruleIssues = issuesByRule.get(rule);
    if (ruleIssues.length === 0) {
      console.log(`RULE${rule} PASS summary: no strict issues`);
      continue;
    }
    const bySite = new Map();
    for (const issue of ruleIssues) {
      const entry = bySite.get(issue.siteId) ?? { severity: issue.severity, messages: [] };
      if (!entry.messages.includes(issue.message)) entry.messages.push(issue.message);
      bySite.set(issue.siteId, entry);
    }
    for (const [siteId, entry] of bySite) {
      console.log(`RULE${rule} ${entry.severity} ${siteId}: ${entry.messages.join("; ")}`);
    }
  }
  process.exit(result.failed ? 1 : 0);
}

const wordByHanzi = new Map(words.map((word) => [word.hanzi, word]));
const phaseWords = words.filter((word) => !word.bonus);
const bonusWords = words.filter((word) => word.bonus);
const lexicon = [...wordByHanzi.keys()]
  .sort((a, b) => [...b].length - [...a].length || a.localeCompare(b, "zh-CN"));
const pools = new Map(world.slotPools.map((pool) => [pool.id, pool]));
const sceneIds = new Set(scenes.map((scene) => scene.id));
let lineCount = 0;
let replyCount = 0;
let signCount = 0;
let slotValueCount = 0;
let maxIntroducedInExchange = 0;

function label(scene, exchange) {
  return `${scene.id}/${exchange.id}`;
}

function allExchangeWords(exchange) {
  return [
    ...(exchange.line?.words ?? []),
    ...(exchange.replies ?? []).flatMap((reply) => reply.words ?? [])
  ];
}

function segment(hanzi) {
  const placeholders = [];
  const withoutSlots = String(hanzi).replace(/\{([A-Za-z_][A-Za-z0-9_]*)\}/g, (_, name) => {
    placeholders.push(name);
    return "";
  });
  const chars = [...withoutSlots];
  const tokens = [];
  const unknown = [];

  for (let index = 0; index < chars.length;) {
    if (!/\p{Script=Han}/u.test(chars[index])) {
      index += 1;
      continue;
    }

    const remainder = chars.slice(index).join("");
    const match = lexicon.find((candidate) => remainder.startsWith(candidate));
    if (match) {
      tokens.push(match);
      index += [...match].length;
    } else {
      unknown.push(chars[index]);
      tokens.push(`<?>${chars[index]}`);
      index += 1;
    }
  }

  return { tokens, unknown, placeholders };
}

function addUnique(bucket, message) {
  if (!bucket.includes(message)) bucket.push(message);
}

function validateSite({
  scene,
  where,
  site,
  kind,
  boundSlots = new Map(),
  rule1Bucket = failures[0]
}) {
  const segmented = segment(site?.hanzi ?? "");
  const sceneIntroduces = new Set(scene?.introduces ?? []);
  const phase = scene?.phase ?? world.phase;
  const tagged = site?.words ?? [];

  for (const token of new Set([...tagged, ...segmented.tokens])) {
    if (token.startsWith("<?>")) continue;
    const word = wordByHanzi.get(token);
    if (!word) {
      addUnique(rule1Bucket, `${where} tags off-list word "${token}"`);
    } else if (word.hsk > phase && !sceneIntroduces.has(token) && !word.bonus) {
      addUnique(rule1Bucket, `${where} uses HSK ${word.hsk} word "${token}" above phase ${phase}`);
    }
  }
  for (const token of new Set(segmented.unknown)) {
    addUnique(rule1Bucket, `${where} contains off-list word/character "${token}"`);
  }

  if (kind !== "sign" && JSON.stringify(tagged) !== JSON.stringify(segmented.tokens)) {
    failures[2].push(
      `${where} tags [${tagged.join(", ")}] != segmentation [${segmented.tokens.join(", ")}]`
    );
  }

  if (kind !== "sign") {
    const requiredFields = kind === "line"
      ? ["hanzi", "pinyin", "en", "audio"]
      : ["hanzi", "pinyin", "en"];
    for (const field of requiredFields) {
      if (typeof site?.[field] !== "string" || site[field].trim() === "") {
        failures[4].push(`${where} is missing ${field}`);
      }
    }

    if (kind === "line" || kind === "reply") {
      for (const field of ["hanzi", "pinyin", "en"]) {
        const placeholders = [...String(site?.[field] ?? "").matchAll(
          /\{([A-Za-z_][A-Za-z0-9_]*)\}/g
        )].map((match) => match[1]);
        for (const placeholder of new Set(placeholders)) {
          if (!boundSlots.has(placeholder)) {
            failures[5].push(`${where}.${field} has unbound slot "{${placeholder}}"`);
          }
        }
      }
    }
  }
}

function normalizeReplyHanzi(value) {
  return String(value ?? "")
    .normalize("NFKC")
    .replace(/\s+/gu, "")
    .replace(/[，。！？、,.!?;；:：]/gu, "");
}

function replyPlaceholders(hanzi) {
  return [...normalizeReplyHanzi(hanzi).matchAll(
    /\{([A-Za-z_][A-Za-z0-9_]*)\}/g
  )].map((match) => match[1]);
}

function slotSkeleton(hanzi) {
  return normalizeReplyHanzi(hanzi).replace(
    /\{[A-Za-z_][A-Za-z0-9_]*\}/g,
    "{slot}"
  );
}

function renderedReplyValues(reply, boundSlots) {
  const placeholders = [...new Set(replyPlaceholders(reply.hanzi))];
  let rendered = [normalizeReplyHanzi(reply.hanzi)];

  for (const placeholder of placeholders) {
    const pool = pools.get(boundSlots.get(placeholder));
    if (!pool) return new Set();
    rendered = rendered.flatMap((candidate) =>
      pool.values.map((value) =>
        candidate.replaceAll(`{${placeholder}}`, value.hanzi)
      )
    );
  }

  return new Set(rendered.map(normalizeReplyHanzi));
}

function validateDistinctReplies(exchange, where, boundSlots) {
  const replies = exchange.replies ?? [];
  const seenTemplates = new Map();

  for (const [index, reply] of replies.entries()) {
    const normalized = normalizeReplyHanzi(reply.hanzi);
    if (seenTemplates.has(normalized)) {
      failures[6].push(
        `${where} replies ${seenTemplates.get(normalized)} and ${index} have identical hanzi "${normalized}"`
      );
    } else {
      seenTemplates.set(normalized, index);
    }
  }

  for (let left = 0; left < replies.length; left += 1) {
    for (let right = left + 1; right < replies.length; right += 1) {
      const leftSlots = replyPlaceholders(replies[left].hanzi);
      const rightSlots = replyPlaceholders(replies[right].hanzi);

      if (leftSlots.length === 0 && rightSlots.length > 0) {
        if (renderedReplyValues(replies[right], boundSlots).has(
          normalizeReplyHanzi(replies[left].hanzi)
        )) {
          failures[6].push(
            `${where} hardcoded reply ${left} can equal slot-filled reply ${right}`
          );
        }
      } else if (rightSlots.length === 0 && leftSlots.length > 0) {
        if (renderedReplyValues(replies[left], boundSlots).has(
          normalizeReplyHanzi(replies[right].hanzi)
        )) {
          failures[6].push(
            `${where} hardcoded reply ${right} can equal slot-filled reply ${left}`
          );
        }
      } else if (
        leftSlots.length > 0 &&
        rightSlots.length > 0 &&
        slotSkeleton(replies[left].hanzi) === slotSkeleton(replies[right].hanzi)
      ) {
        const safelyPaired =
          leftSlots.length === rightSlots.length &&
          leftSlots.every((name, index) =>
            name !== rightSlots[index] &&
            boundSlots.get(name) === boundSlots.get(rightSlots[index]) &&
            pools.has(boundSlots.get(name))
          );
        if (!safelyPaired) {
          failures[6].push(
            `${where} slot replies ${left} and ${right} must use different slots from the same pool`
          );
        }
      }
    }
  }
}

for (const scene of scenes) {
  const introducedSoFar = new Set();
  const sceneIntroduces = new Set(scene.introduces ?? []);
  const boundSlots = new Map();

  for (const exchange of scene.exchanges ?? []) {
    lineCount += 1;
    const where = label(scene, exchange);

    for (const [name, poolId] of Object.entries(exchange.slots ?? {})) {
      if (!pools.has(poolId)) {
        failures[5].push(`${where} binds "{${name}}" to unknown slot pool "${poolId}"`);
      } else {
        boundSlots.set(name, poolId);
      }
    }

    validateSite({
      scene,
      where: `${where}/line`,
      site: exchange.line,
      kind: "line",
      boundSlots
    });
    for (const [replyIndex, reply] of (exchange.replies ?? []).entries()) {
      replyCount += 1;
      validateSite({
        scene,
        where: `${where}/reply[${replyIndex}]`,
        site: reply,
        kind: "reply",
        boundSlots
      });
    }
    validateDistinctReplies(exchange, where, boundSlots);

    const wordsHere = new Set(allExchangeWords(exchange));
    const newlyIntroduced = [...wordsHere].filter(
      (word) => sceneIntroduces.has(word) && !introducedSoFar.has(word)
    );
    maxIntroducedInExchange = Math.max(maxIntroducedInExchange, newlyIntroduced.length);
    if (newlyIntroduced.length > 2) {
      failures[1].push(
        `${where} introduces ${newlyIntroduced.length} words: ${newlyIntroduced.join(", ")}`
      );
    }
    newlyIntroduced.forEach((word) => introducedSoFar.add(word));

    const hasWrongReply = (exchange.replies ?? []).some((reply) => reply.correct === false);
    if (hasWrongReply && (!exchange.onWrong || !sceneIds.has(exchange.onWrong))) {
      failures[4].push(`${where} has a wrong reply without a valid onWrong consequence`);
    }
  }

  const missingIntroductions = [...sceneIntroduces].filter(
    (word) => !introducedSoFar.has(word)
  );
  if (missingIntroductions.length > 0) {
    failures[1].push(
      `${scene.id} declares but never introduces: ${missingIntroductions.join(", ")}`
    );
  }
}

for (const pool of world.slotPools ?? []) {
  for (const [valueIndex, value] of (pool.values ?? []).entries()) {
    slotValueCount += 1;
    validateSite({
      scene: { phase: world.phase, introduces: [] },
      where: `world/slotPool[${pool.id}]/value[${valueIndex}]`,
      site: value,
      kind: "slot-value"
    });
  }
}

for (const location of world.locations ?? []) {
  for (const [signIndex, sign] of (location.signs ?? []).entries()) {
    signCount += 1;
    validateSite({
      scene: { phase: world.phase, introduces: [] },
      where: `world/location[${location.id}]/sign[${signIndex}]`,
      site: { hanzi: sign },
      kind: "sign",
      rule1Bucket: warnings[0]
    });
  }
}

const coverageScenes = legacyCoverageScenes(scenes);
const coverageSceneLabel = scenes.some((scene) => scene.curriculumIndex !== undefined)
  ? "curriculum scenes"
  : "non-consequence scenes";
const ambientWordsByLocation = new Map();
for (const line of ambient) {
  const bucket = ambientWordsByLocation.get(line.location) ?? new Set();
  for (const word of line.words ?? []) bucket.add(word);
  ambientWordsByLocation.set(line.location, bucket);
}
const coverage = new Map(phaseWords.map((word) => [word.hanzi, new Set()]));
for (const scene of coverageScenes) {
  const seen = new Set([
    ...(scene.exchanges ?? []).flatMap((exchange) => [
      ...allExchangeWords(exchange),
      ...(exchange.hint?.words ?? []),
    ]),
    ...(ambientWordsByLocation.get(scene.location) ?? []),
  ]);
  for (const word of seen) {
    coverage.get(word)?.add(scene.id);
  }
}
const undercovered = [...coverage].filter(([, ids]) => ids.size < 3);
if (undercovered.length > 0) {
  const message =
    `${undercovered.length}/${phaseWords.length} phase-list words appear in fewer than 3 ` +
    coverageSceneLabel;
  if (scenes.length < 20) {
    warnings[3].push(
      `${message}; scenes.json has ${scenes.length} scenes (<20), so rule 4 is advisory`
    );
  } else {
    failures[3].push(message);
  }
}

const ruleMessages = [
  `all ${lineCount + replyCount + slotValueCount} dialogue and slot-value sites use dictionary words; ${signCount} signs checked`,
  `no exchange introduces more than 2 new words (maximum ${maxIntroducedInExchange})`,
  `all ${lineCount + replyCount + slotValueCount} line, reply, and slot-value word tags match longest-match segmentation`,
  `coverage checked for ${phaseWords.length} phase-list words across lines, replies, hints, and ${ambient.length} ambient line${ambient.length === 1 ? "" : "s"}; ${bonusWords.length} bonus word${bonusWords.length === 1 ? "" : "s"} excluded`,
  `all ${lineCount} lines have hanzi, pinyin, English, and audio; all ${replyCount} replies and ${slotValueCount} slot values have hanzi, pinyin, and English`,
  `all placeholders in lines and replies have valid scene-scoped bindings`,
  `all reply choices are distinct by template, slot pool, and rendered-value possibility`
];

console.log(
  `Dictionary — ${phaseWords.length} phase words + ${bonusWords.length} bonus.`
);

for (let index = 0; index < 7; index += 1) {
  const ruleNumber = index + 1;
  if (failures[index].length > 0) {
    console.log(`Rule ${ruleNumber} FAIL — ${failures[index].join("; ")}`);
  } else if (warnings[index].length > 0) {
    console.log(`Rule ${ruleNumber} WARN — ${warnings[index].join("; ")}`);
  } else {
    console.log(`Rule ${ruleNumber} PASS — ${ruleMessages[index]}.`);
  }
}

const failureCount = failures.filter((items) => items.length > 0).length;
const warningCount = warnings.filter((items) => items.length > 0).length;
if (failureCount > 0) {
  console.log(
    `Summary FAIL — ${failureCount} rule${failureCount === 1 ? "" : "s"} failed, ` +
    `${warningCount} warning${warningCount === 1 ? "" : "s"}.`
  );
  process.exit(1);
}

console.log(
  `Summary PASS — 0 failures, ${warningCount} warning${warningCount === 1 ? "" : "s"}.`
);
