import { buildWordAudioMap } from "./tts-inventory.mjs";
import {
  eligibleSlotTuples,
  pairedSlotValue,
} from "./slot-tuples.mjs";

const placeholderPattern = /\{([A-Za-z_][A-Za-z0-9_]*)\}/g;
const starterWords = new Set(["你", "好", "我", "是", "这", "那", "一", "二", "三", "四"]);
const allowedSlotLabels = new Set(["M", "A1", "A2", "A3", "A4", "E"]);
const lengthLimits = { line: 14, hint: 10, reply: 8, ambient: 8 };
const numeralPattern = /^[零一二三四五六七八九十两]+$/u;

function syllables(value) {
  let count = 0;
  const withoutSlots = String(value ?? "").replace(placeholderPattern, () => {
    count += 2;
    return "";
  });
  for (const character of withoutSlots) {
    if (/\p{Script=Han}/u.test(character)) count += 1;
  }
  return count;
}

function numericPool(pool) {
  return Boolean(pool?.values?.length)
    && pool.values.every((value) => numeralPattern.test(String(value.hanzi ?? "")));
}

export function ambientRows(ambient) {
  if (Array.isArray(ambient)) return ambient;
  if (Array.isArray(ambient?.lines)) return ambient.lines;
  return [];
}

function siteId(scene, exchange, kind, index) {
  const base = `${scene.id}/${exchange.id}`;
  if (kind === "reply") return `${base}/r${index + 1}`;
  return `${base}/${kind}`;
}

function normalizeHanzi(value) {
  return String(value ?? "")
    .normalize("NFKC")
    .replace(/\s+/gu, "")
    .replace(/[，。！？、,.!?;；:：'"“”‘’（）()[\]]/gu, "");
}

function placeholders(value) {
  return [...String(value ?? "").matchAll(placeholderPattern)].map((match) => match[1]);
}

function createSegmenter(words) {
  const known = new Map(words.map((word) => [word.hanzi, word]));
  const lexicon = [...known.keys()]
    .sort((left, right) => [...right].length - [...left].length || left.localeCompare(right, "zh-CN"));

  return {
    known,
    segment(value) {
      const foundPlaceholders = [];
      const withoutSlots = String(value ?? "").replace(placeholderPattern, (_, name) => {
        foundPlaceholders.push(name);
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
      return { tokens, unknown, placeholders: foundPlaceholders };
    },
  };
}

function exchangeWords(exchange) {
  return [
    ...(exchange.line?.words ?? []),
    ...(exchange.replies ?? []).flatMap((reply) => reply.words ?? []),
    ...(exchange.hint?.words ?? []),
  ];
}

function fill(value, bindings) {
  return String(value ?? "").replace(placeholderPattern, (match, name) => bindings[name]?.hanzi ?? match);
}

export function legacyCoverageScenes(scenes) {
  const hasCurriculumMetadata = scenes.some((scene) => scene.curriculumIndex !== undefined);
  return hasCurriculumMetadata
    ? scenes.filter((scene) => scene.curriculumIndex !== undefined)
    : scenes.filter((scene) => scene.kind !== "consequence");
}

function strictSceneOrder(scenes) {
  return scenes
    .map((scene, index) => ({ scene, index }))
    .sort((left, right) => {
      const leftIndex = Number.isInteger(left.scene.curriculumIndex)
        ? left.scene.curriculumIndex
        : Number.MAX_SAFE_INTEGER;
      const rightIndex = Number.isInteger(right.scene.curriculumIndex)
        ? right.scene.curriculumIndex
        : Number.MAX_SAFE_INTEGER;
      return leftIndex - rightIndex || left.index - right.index;
    })
    .map(({ scene }) => scene);
}

function strictExchangeRoute(orderedScenes, sceneById) {
  const route = [];
  const emittedScenes = new Set();
  const activeScenes = new Set();
  const guidedSceneIds = new Set(orderedScenes.flatMap((scene) =>
    (scene.exchanges ?? []).map((exchange) => exchange.guidedConsequence).filter(Boolean)
  ));

  function appendScene(scene) {
    if (!scene || emittedScenes.has(scene.id) || activeScenes.has(scene.id)) return;
    activeScenes.add(scene.id);
    emittedScenes.add(scene.id);
    for (const exchange of scene.exchanges ?? []) {
      route.push({ scene, exchange });
      appendScene(sceneById.get(exchange.guidedConsequence));
    }
    activeScenes.delete(scene.id);
  }

  for (const scene of orderedScenes) {
    if (!guidedSceneIds.has(scene.id)) appendScene(scene);
  }
  for (const scene of orderedScenes) appendScene(scene);
  return route;
}

function sceneSiteWords(scene, poolById, sceneById, visited = new Set()) {
  if (!scene || visited.has(scene.id)) return [];
  const nextVisited = new Set(visited).add(scene.id);
  const result = [];
  const boundPools = new Map();
  for (const exchange of scene.exchanges ?? []) {
    for (const [name, poolId] of Object.entries(exchange.slots ?? {})) boundPools.set(name, poolId);
    result.push(...exchangeWords(exchange));
    const usedSlots = [
      ...placeholders(exchange.line?.hanzi),
      ...(exchange.replies ?? []).flatMap((reply) => placeholders(reply.hanzi)),
      ...placeholders(exchange.hint?.hanzi),
    ];
    for (const name of new Set(usedSlots)) {
      result.push(...(poolById.get(boundPools.get(name))?.values ?? []).flatMap((value) => value.words ?? []));
    }
    if (exchange.onWrong) {
      result.push(...sceneSiteWords(sceneById.get(exchange.onWrong), poolById, sceneById, nextVisited));
    }
  }
  return result;
}

function directSceneWords(scene, poolById) {
  if (!scene) return [];
  const result = [];
  const boundPools = new Map();
  for (const exchange of scene.exchanges ?? []) {
    for (const [name, poolId] of Object.entries(exchange.slots ?? {})) boundPools.set(name, poolId);
    result.push(...exchangeWords(exchange));
    const usedSlots = [
      ...placeholders(exchange.line?.hanzi),
      ...(exchange.replies ?? []).flatMap((reply) => placeholders(reply.hanzi)),
      ...placeholders(exchange.hint?.hanzi),
    ];
    for (const name of new Set(usedSlots)) {
      result.push(...(poolById.get(boundPools.get(name))?.values ?? []).flatMap((value) => value.words ?? []));
    }
  }
  return result;
}

export function listContentSites(scenes, world, ambient = []) {
  const sites = [];
  for (const scene of scenes) {
    for (const exchange of scene.exchanges ?? []) {
      sites.push({ id: siteId(scene, exchange, "line"), sceneId: scene.id, exchangeId: exchange.id, kind: "line", value: exchange.line });
      for (const [index, reply] of (exchange.replies ?? []).entries()) {
        sites.push({ id: siteId(scene, exchange, "reply", index), sceneId: scene.id, exchangeId: exchange.id, kind: "reply", value: reply });
      }
      if (exchange.hint) {
        sites.push({ id: siteId(scene, exchange, "hint"), sceneId: scene.id, exchangeId: exchange.id, kind: "hint", value: exchange.hint });
      }
    }
  }
  for (const pool of world.slotPools ?? []) {
    for (const [index, value] of (pool.values ?? []).entries()) {
      sites.push({ id: `pool:${pool.id}/${index}`, sceneId: "", exchangeId: "", kind: "slot", value });
    }
  }
  for (const location of world.locations ?? []) {
    for (const [index, value] of (location.signs ?? []).entries()) {
      sites.push({
        id: `sign:${location.id}/${index}`,
        sceneId: "",
        exchangeId: "",
        kind: "sign",
        value: { hanzi: value },
      });
    }
  }
  for (const [index, line] of ambientRows(ambient).entries()) {
    sites.push({
      id: `ambient:${line.id ?? index}`,
      sceneId: "",
      exchangeId: "",
      kind: "ambient",
      value: line,
    });
  }
  return sites;
}

export function checkStrictContent(words, scenes, world, authoredWordAudioMap = null, ambient = []) {
  const issues = [];
  const { known: wordByHanzi, segment } = createSegmenter(words);
  const poolById = new Map((world.slotPools ?? []).map((pool) => [pool.id, pool]));
  const sceneById = new Map(scenes.map((scene) => [scene.id, scene]));
  const orderedScenes = strictSceneOrder(scenes);
  const exchangeRoute = strictExchangeRoute(orderedScenes, sceneById);
  const add = (rule, site, message) => issues.push({ rule, severity: "FAIL", siteId: site, message });
  const eligibleWordsByExchange = new Map();
  const canonicalEncountered = new Set();
  for (const { scene, exchange } of exchangeRoute) {
    eligibleWordsByExchange.set(
      `${scene.id}/${exchange.id}`,
      new Set([...canonicalEncountered, ...(exchange.introduces ?? [])]),
    );
    const correctReply = (exchange.replies ?? []).find((reply) => reply.correct === true);
    for (const word of [
      ...(exchange.line?.words ?? []),
      ...(correctReply?.words ?? []),
      ...(exchange.introduces ?? []),
    ]) canonicalEncountered.add(word);
  }

  function poolsForSlots(names, boundPools) {
    return new Map([...new Set(names)].map((name) => [name, poolById.get(boundPools.get(name))]));
  }

  function permittedTuples(names, boundPools, exchangeKey, issueSite) {
    try {
      return eligibleSlotTuples(
        names,
        poolsForSlots(names, boundPools),
        eligibleWordsByExchange.get(exchangeKey),
      );
    } catch (error) {
      add(14, issueSite, error.message);
      return [];
    }
  }

  function validateStrictSite(ruleScene, exchange, kind, index, value, boundPools) {
    const id = siteId(ruleScene, exchange, kind, index);
    const tagged = value?.words ?? [];
    const introduced = new Set([...(ruleScene.introduces ?? []), ...(exchange.introduces ?? [])]);
    const segmented = segment(value?.hanzi);
    for (const token of new Set([...tagged, ...segmented.tokens])) {
      if (token.startsWith("<?>")) continue;
      const word = wordByHanzi.get(token);
      if (!word) add(1, id, `tagged word "${token}" is not in words.json`);
      else if (word.hsk > (ruleScene.phase ?? world.phase) && !introduced.has(token) && !word.bonus) {
        add(1, id, `HSK ${word.hsk} word "${token}" is above phase and not introduced here`);
      }
    }
    for (const token of new Set(segmented.unknown)) add(1, id, `Han character "${token}" is not dictionary-listed`);

    const names = [
      ...placeholders(value?.hanzi),
      ...placeholders(value?.pinyin),
      ...placeholders(value?.en),
    ];
    const combinations = permittedTuples(
      names,
      boundPools,
      `${ruleScene.id}/${exchange.id}`,
      id,
    );
    const checks = names.length === 0 ? [{}] : combinations;
    if (
      names.length > 0
      && checks.length === 0
      && names.some((name) => !poolById.get(boundPools.get(name))?.values?.length)
    ) {
      add(3, id, "cannot validate post-fill tags because a slot pool is missing or empty");
    }
    for (const bindings of checks) {
      const actual = segment(fill(value?.hanzi, bindings)).tokens;
      for (const token of actual) {
        const word = wordByHanzi.get(token);
        if (word && word.hsk > (ruleScene.phase ?? world.phase) && !introduced.has(token) && !word.bonus) {
          add(1, id, `slot-filled HSK ${word.hsk} word "${token}" is above phase and not introduced here`);
        }
      }
      const inserted = [];
      const templateTokens = [];
      const text = String(value?.hanzi ?? "");
      let cursor = 0;
      let tagCursor = 0;
      for (const match of text.matchAll(placeholderPattern)) {
        const prefix = text.slice(cursor, match.index);
        const prefixTokens = segment(prefix).tokens;
        const prefixCount = prefixTokens.length;
        templateTokens.push(...prefixTokens);
        inserted.push(...tagged.slice(tagCursor, tagCursor + prefixCount));
        tagCursor += prefixCount;
        inserted.push(...(bindings[match[1]]?.words ?? []));
        cursor = match.index + match[0].length;
      }
      templateTokens.push(...segment(text.slice(cursor)).tokens);
      inserted.push(...tagged.slice(tagCursor));
      const expected = names.length > 0 ? inserted : tagged;
      if (JSON.stringify(expected) !== JSON.stringify(actual)) {
        add(3, id, `tags [${expected.join(", ")}] != post-fill segmentation [${actual.join(", ")}]`);
        break;
      }
      if (names.length > 0 && JSON.stringify(tagged) !== JSON.stringify(templateTokens)) {
        add(3, id, `template tags [${tagged.join(", ")}] != segmentation [${templateTokens.join(", ")}]`);
        break;
      }
    }

    for (const field of ["hanzi", "pinyin", "en", "audio"]) {
      if (typeof value?.[field] !== "string" || value[field].trim() === "") add(5, id, `missing ${field}`);
    }
    if (kind === "reply" && normalizeHanzi(value?.hanzi) === "") add(5, id, "reply has no Chinese text");
    if (/[a-züv]+[1-5]\b/iu.test(String(value?.pinyin ?? ""))) add(5, id, "pinyin uses tone numbers instead of tone marks");

    for (const field of ["hanzi", "pinyin", "en"]) {
      for (const name of new Set(placeholders(value?.[field]))) {
        if (!boundPools.has(name)) add(6, id, `${field} has unbound slot "{${name}}"`);
      }
    }

    const limit = lengthLimits[kind];
    const numericSlot = kind === "reply"
      && placeholders(value?.hanzi).some((name) => numericPool(poolById.get(boundPools.get(name))));
    const length = syllables(value?.hanzi);
    if (limit !== undefined && !numericSlot && length > limit) {
      add(15, id, `${length} syllables; the ${kind} limit is ${limit}`);
    }
  }

  for (const scene of scenes) {
    const boundPools = new Map();
    const seenBindingStates = [{ index: 0, bound: new Set() }];
    const checkedBindingStates = new Set();
    for (const exchange of scene.exchanges ?? []) {
      for (const [name, poolId] of Object.entries(exchange.slots ?? {})) {
        if (!poolById.get(poolId)?.values?.length) {
          add(6, siteId(scene, exchange, "line"), `slot "{${name}}" uses unknown or empty pool "${poolId}"`);
        }
        boundPools.set(name, poolId);
      }
      validateStrictSite(scene, exchange, "line", 0, exchange.line, boundPools);
      for (const [index, reply] of (exchange.replies ?? []).entries()) {
        validateStrictSite(scene, exchange, "reply", index, reply, boundPools);
      }
      if (exchange.hint) validateStrictSite(scene, exchange, "hint", 0, exchange.hint, boundPools);

      const ordinaryConsequence = scene.kind === "consequence" && !Number.isInteger(scene.curriculumIndex);
      const replyCount = exchange.replies?.length ?? 0;
      if ((ordinaryConsequence && replyCount !== 1) || (!ordinaryConsequence && (replyCount < 2 || replyCount > 4))) {
        add(7, siteId(scene, exchange, "line"), ordinaryConsequence
          ? `ordinary consequence exchange has ${replyCount} replies; expected 1`
          : `exchange has ${replyCount} replies; expected 2–4`);
      }
      for (const [index, reply] of (exchange.replies ?? []).entries()) {
        if (reply.correct === false && (!exchange.onWrong || sceneById.get(exchange.onWrong)?.kind !== "consequence")) {
          add(7, siteId(scene, exchange, "reply", index), "wrong reply has no valid onWrong consequence");
        }
      }
      if ((exchange.replies ?? []).some((reply) => reply.correct === false) && !exchange.hint) {
        add(5, siteId(scene, exchange, "hint"), "wrong choices require an authored hint");
      }
      const replySlotNames = (exchange.replies ?? []).flatMap((reply) => placeholders(reply.hanzi));
      const combinations = permittedTuples(
        replySlotNames,
        boundPools,
        `${scene.id}/${exchange.id}`,
        siteId(scene, exchange, "line"),
      );
      const tuples = replySlotNames.length === 0 ? [{}] : combinations;
      for (const bindings of tuples) {
        const rendered = (exchange.replies ?? []).map((reply) => normalizeHanzi(fill(reply.hanzi, bindings)));
        const duplicateIndex = rendered.findIndex((value, index) => rendered.indexOf(value) !== index);
        if (duplicateIndex >= 0) {
          add(7, siteId(scene, exchange, "reply", duplicateIndex), `reply text duplicates another choice for an eligible slot tuple`);
          break;
        }
        const audio = (exchange.replies ?? []).map((reply) => String(reply.audio ?? "").trim()).filter(Boolean);
        const duplicateAudio = audio.find((value, index) => audio.indexOf(value) !== index);
        if (duplicateAudio) {
          add(7, siteId(scene, exchange, "line"), `reply audio ID "${duplicateAudio}" is reused by distinct choices`);
          break;
        }
      }
    }

    while (seenBindingStates.length > 0) {
      const state = seenBindingStates.pop();
      const exchange = scene.exchanges?.[state.index];
      if (!exchange) continue;
      const bound = new Set(state.bound);
      for (const name of Object.keys(exchange.slots ?? {})) bound.add(name);
      const stateKey = `${state.index}:${[...bound].sort().join(",")}`;
      if (checkedBindingStates.has(stateKey)) continue;
      checkedBindingStates.add(stateKey);
      for (const value of [exchange.line, ...(exchange.replies ?? []), exchange.hint].filter(Boolean)) {
        for (const field of ["hanzi", "pinyin", "en"]) {
          for (const name of placeholders(value[field])) {
            const replyIndex = (exchange.replies ?? []).indexOf(value);
            if (!bound.has(name)) add(6, siteId(scene, exchange, value === exchange.line ? "line" : value === exchange.hint ? "hint" : "reply", Math.max(0, replyIndex)), `reachable route skips binding "{${name}}"`);
          }
        }
      }
      for (const reply of exchange.replies ?? []) {
        const nextIndex = reply.next
          ? scene.exchanges.findIndex((candidate) => candidate.id === reply.next)
          : reply.correct === true ? state.index + 1 : state.index;
        if (nextIndex >= 0) seenBindingStates.push({ index: nextIndex, bound });
      }
    }

    for (const exchange of scene.exchanges ?? []) {
      for (const target of [
        exchange.onWrong,
        exchange.guidedConsequence,
        ...(exchange.replies ?? []).map((reply) => reply.next),
      ]) {
        if (!target || scene.exchanges.some((candidate) => candidate.id === target)) continue;
        if (!sceneById.has(target)) add(6, siteId(scene, exchange, "line"), `route target "${target}" does not exist`);
      }
      if (exchange.onWrong && sceneById.get(exchange.onWrong)?.kind !== "consequence") {
        add(6, siteId(scene, exchange, "line"), `onWrong target "${exchange.onWrong}" is not a consequence`);
      }
      if (exchange.guidedConsequence && sceneById.get(exchange.guidedConsequence)?.kind !== "consequence") {
        add(6, siteId(scene, exchange, "line"), `guidedConsequence target "${exchange.guidedConsequence}" is not a consequence`);
      }
    }
  }

  for (const pool of world.slotPools ?? []) {
    for (const [index, value] of (pool.values ?? []).entries()) {
      const id = `pool:${pool.id}/${index}`;
      const segmented = segment(value.hanzi);
      for (const token of new Set([...(value.words ?? []), ...segmented.tokens])) {
        if (!token.startsWith("<?>") && !wordByHanzi.has(token)) add(1, id, `word "${token}" is not dictionary-listed`);
      }
      for (const token of new Set(segmented.unknown)) add(1, id, `Han character "${token}" is not dictionary-listed`);
      if (JSON.stringify(value.words ?? []) !== JSON.stringify(segmented.tokens)) {
        add(3, id, `tags [${(value.words ?? []).join(", ")}] != segmentation [${segmented.tokens.join(", ")}]`);
      }
      for (const field of ["hanzi", "pinyin", "en"]) {
        if (typeof value[field] !== "string" || value[field].trim() === "") add(5, id, `missing ${field}`);
      }
      if (/[a-züv]+[1-5]\b/iu.test(String(value.pinyin ?? ""))) add(5, id, "pinyin uses tone numbers instead of tone marks");
    }
  }
  for (const location of world.locations ?? []) {
    for (const [index, value] of (location.signs ?? []).entries()) {
      const id = `sign:${location.id}/${index}`;
      const segmented = segment(value);
      for (const token of new Set(segmented.tokens)) {
        if (!token.startsWith("<?>") && !wordByHanzi.has(token)) add(1, id, `word "${token}" is not dictionary-listed`);
      }
      for (const token of new Set(segmented.unknown)) add(1, id, `Han character "${token}" is not dictionary-listed`);
    }
  }
  const ambientLines = ambientRows(ambient);
  const knownLocations = new Set((world.locations ?? []).map((location) => location.id));
  const knownSpeakers = new Set((world.npcs ?? []).map((npc) => npc.id));
  const ambientWordsByLocation = new Map();
  for (const [index, line] of ambientLines.entries()) {
    const id = `ambient:${line.id ?? index}`;
    const segmented = segment(line.hanzi);
    for (const token of new Set([...(line.words ?? []), ...segmented.tokens])) {
      if (token.startsWith("<?>")) continue;
      const word = wordByHanzi.get(token);
      if (!word) add(1, id, `word "${token}" is not dictionary-listed`);
      else if (word.hsk > world.phase && !word.bonus) add(1, id, `HSK ${word.hsk} word "${token}" is above phase`);
    }
    for (const token of new Set(segmented.unknown)) add(1, id, `Han character "${token}" is not dictionary-listed`);
    if (JSON.stringify(line.words ?? []) !== JSON.stringify(segmented.tokens)) {
      add(3, id, `tags [${(line.words ?? []).join(", ")}] != segmentation [${segmented.tokens.join(", ")}]`);
    }
    for (const field of ["hanzi", "pinyin", "en", "audio"]) {
      if (typeof line[field] !== "string" || line[field].trim() === "") add(5, id, `missing ${field}`);
    }
    if (/[a-züv]+[1-5]\b/iu.test(String(line.pinyin ?? ""))) add(5, id, "pinyin uses tone numbers instead of tone marks");
    if (placeholders(line.hanzi).length > 0) add(6, id, "ambient lines cannot use slots");
    if (!knownLocations.has(line.location)) add(14, id, `unknown location "${line.location}"`);
    if (!knownSpeakers.has(line.speaker)) add(14, id, `unknown speaker "${line.speaker}"`);
    if (line.audio !== line.id) add(14, id, "ambient audio ID must equal its line ID");
    const length = syllables(line.hanzi);
    if (length > lengthLimits.ambient) {
      add(15, id, `${length} syllables; the ambient limit is ${lengthLimits.ambient}`);
    }
    const bucket = ambientWordsByLocation.get(line.location) ?? new Set();
    for (const token of segmented.tokens) if (wordByHanzi.has(token)) bucket.add(token);
    ambientWordsByLocation.set(line.location, bucket);
  }

  let wordAudioLookup = {};
  try {
    const builtWordAudioMap = buildWordAudioMap(words, authoredWordAudioMap ?? {});
    wordAudioLookup = authoredWordAudioMap === null
      ? builtWordAudioMap.current
      : authoredWordAudioMap;
  } catch (error) {
    add(5, "words:audio-map", error.message);
  }
  const mappedWordIds = new Set();
  for (const word of words) {
    const audioId = wordAudioLookup[word.hanzi];
    if (typeof audioId !== "string" || !/^word_\d{3,}$/u.test(audioId)) {
      add(5, `word:${word.hanzi}`, "does not resolve to a word_NNN clip ID");
    } else if (mappedWordIds.has(audioId)) {
      add(5, `word:${word.hanzi}`, `word clip ID "${audioId}" is mapped more than once`);
    } else {
      mappedWordIds.add(audioId);
    }
    if (/[a-züv]+[1-5]\b/iu.test(String(word.pinyin ?? ""))) add(5, `word:${word.hanzi}`, "pinyin uses tone numbers instead of tone marks");
  }

  const encountered = new Set();
  const exchangeNovelty = new Map();
  let familiarityNumerator = 0;
  let familiarityDenominator = 0;
  const familiarityNewTypes = new Set();
  for (const { scene, exchange } of exchangeRoute) {
    const branchWords = sceneSiteWords(sceneById.get(exchange.onWrong), poolById, sceneById);
    const boundPools = new Map();
    for (const candidate of scene.exchanges ?? []) {
      for (const [name, poolId] of Object.entries(candidate.slots ?? {})) boundPools.set(name, poolId);
      if (candidate === exchange) break;
    }
    const usedSlotNames = [
      ...placeholders(exchange.line?.hanzi),
      ...(exchange.replies ?? []).flatMap((reply) => placeholders(reply.hanzi)),
      ...placeholders(exchange.hint?.hanzi),
    ];
    const slotTuples = permittedTuples(
      usedSlotNames,
      boundPools,
      `${scene.id}/${exchange.id}`,
      siteId(scene, exchange, "line"),
    );
    if (usedSlotNames.length > 0 && slotTuples.length === 0) {
      add(2, siteId(scene, exchange, "line"), "no slot value and fixed wrong alternative pair is eligible here");
    }
    const slotWords = slotTuples.flatMap((binding) =>
      Object.entries(binding).flatMap(([name, value]) => {
        const pool = poolById.get(boundPools.get(name));
        const alternative = pairedSlotValue(pool, pool?.values?.find((candidate) => candidate.id === value.id));
        return [...(value.words ?? []), ...(alternative?.words ?? [])];
      })
    );
    const actual = [...new Set([...exchangeWords(exchange), ...slotWords, ...branchWords])];
    const newlySeen = actual.filter((word) => wordByHanzi.has(word) && !encountered.has(word));
    exchangeNovelty.set(`${scene.id}/${exchange.id}`, newlySeen);
    if (newlySeen.length > 2) {
      add(2, siteId(scene, exchange, "line"), `encounters ${newlySeen.length} unseen words: ${newlySeen.join(", ")}`);
    }
    const declared = new Set(exchange.introduces ?? []);
    for (const word of declared) {
      if (!actual.includes(word)) add(2, siteId(scene, exchange, "line"), `declared introduction "${word}" is not encountered`);
    }
    for (const word of newlySeen) {
      if (!declared.has(word)) add(2, siteId(scene, exchange, "line"), `unseen word "${word}" is not declared in exchange.introduces`);
    }

    if (Number.isInteger(scene.curriculumIndex) && scene.curriculumIndex !== 0) {
      const lineWords = exchange.line?.words ?? [];
      familiarityNumerator += lineWords.filter((word) => encountered.has(word)).length;
      familiarityDenominator += lineWords.length;
      for (const word of lineWords) {
        if (!encountered.has(word)) familiarityNewTypes.add(word);
      }
      for (const word of lineWords) encountered.add(word);
      const laterWords = [
        ...(exchange.replies ?? []).flatMap((reply) => reply.words ?? []),
        ...(exchange.hint?.words ?? []),
      ];
      familiarityNumerator += laterWords.filter((word) => encountered.has(word)).length;
      familiarityDenominator += laterWords.length;
      for (const word of laterWords) {
        if (!encountered.has(word)) familiarityNewTypes.add(word);
      }
    }
    const correctReply = (exchange.replies ?? []).find((reply) => reply.correct === true);
    const guaranteed = [
      ...(exchange.line?.words ?? []),
      ...(correctReply?.words ?? []),
      ...(exchange.introduces ?? []),
    ];
    for (const word of guaranteed) encountered.add(word);
  }
  for (const scene of orderedScenes) {
    for (const word of scene.introduces ?? []) {
      if (!directSceneWords(scene, poolById).includes(word)) {
        add(2, `scene:${scene.id}`, `declared scene introduction "${word}" is never encountered`);
      }
    }
  }

  const familiarity = familiarityDenominator === 0 ? 1 : familiarityNumerator / familiarityDenominator;
  if (familiarity < 0.8) {
    add(11, "familiarity:curriculum", `${familiarityNumerator}/${familiarityDenominator} familiar tokens (${(familiarity * 100).toFixed(1)}%); ${familiarityNewTypes.size} actual new types; minimum is 80%`);
  }

  const phaseWords = words.filter((word) => !word.bonus && word.hsk === 1);
  const bonusWords = words.filter((word) => word.bonus);
  const curriculumScenes = scenes.filter((scene) => Number.isInteger(scene.curriculumIndex));
  const coverage = new Map(phaseWords.map((word) => [word.hanzi, new Set()]));
  for (const scene of curriculumScenes) {
    for (const word of new Set(directSceneWords(scene, poolById))) coverage.get(word)?.add(scene.id);
    for (const word of ambientWordsByLocation.get(scene.location) ?? []) coverage.get(word)?.add(scene.id);
  }
  let placementsTotal = 0;
  for (const [word, coveredScenes] of coverage) {
    placementsTotal += coveredScenes.size;
    const required = starterWords.has(word) ? 4 : 3;
    if (coveredScenes.size < required) {
      add(4, `coverage:${word}`, `${coveredScenes.size} curriculum scenes; requires at least ${required}`);
    }
    if (starterWords.has(word)) {
      const starterIndices = new Set(
        curriculumScenes
          .filter((scene) => coveredScenes.has(scene.id))
          .map((scene) => scene.curriculumIndex)
          .filter((index) => index >= 0 && index <= 3),
      );
      if (starterIndices.size < 4) add(4, `coverage:${word}`, `starter word is not present in each of S00–S03`);
    }
  }
  if (phaseWords.length !== 150) add(4, "coverage:target", `${phaseWords.length}/150 nonbonus HSK1 words`);
  if (placementsTotal < 460) add(4, "coverage:placements", `${placementsTotal}/460 curriculum scene-word placements`);
  if (bonusWords.length > 10) add(4, "coverage:bonus", `${bonusWords.length} bonus words; maximum is 10`);

  const allCorrectWords = new Set();
  const assistedWords = new Set();
  for (const scene of orderedScenes.filter((candidate) => Number.isInteger(candidate.curriculumIndex))) {
    for (const requirement of scene.requires ?? []) {
      if (!allCorrectWords.has(requirement)) add(10, `scene:${scene.id}`, `requires "${requirement}" before it is encountered on the canonical route`);
    }
    const slots = scene.allowedSlots ?? [];
    for (const slot of slots) {
      if (!allowedSlotLabels.has(slot)) add(10, `scene:${scene.id}`, `unknown allowed slot "${slot}"`);
    }
    if (scene.kind === "mentor" && !slots.includes("A4")) add(10, `scene:${scene.id}`, "mentor scene is not available in A4");
    for (const exchange of scene.exchanges ?? []) {
      if (!(exchange.replies ?? []).some((reply) => reply.correct === true)) {
        add(10, siteId(scene, exchange, "line"), "canonical route has no correct reply");
      }
    }
    const guaranteedWords = [];
    const assistedSceneWords = [];
    for (const exchange of scene.exchanges ?? []) {
      guaranteedWords.push(...(exchange.line?.words ?? []));
      const correctReply = (exchange.replies ?? []).find((reply) => reply.correct === true);
      guaranteedWords.push(...(correctReply?.words ?? []));
      assistedSceneWords.push(
        ...(exchange.line?.words ?? []),
        ...(correctReply?.words ?? []),
        ...(exchange.hint?.words ?? []),
      );
      const wrongReply = (exchange.replies ?? []).find((reply) => reply.correct === false);
      if (wrongReply) assistedSceneWords.push(...(wrongReply.words ?? []));
      if (exchange.onWrong) {
        assistedSceneWords.push(...directSceneWords(sceneById.get(exchange.onWrong), poolById));
      }
      if (exchange.guidedConsequence) {
        const guidedWords = directSceneWords(sceneById.get(exchange.guidedConsequence), poolById);
        guaranteedWords.push(...guidedWords);
        assistedSceneWords.push(...guidedWords);
      }
    }
    for (const word of guaranteedWords) {
      if (wordByHanzi.get(word)?.hsk === 1 && !wordByHanzi.get(word)?.bonus) allCorrectWords.add(word);
    }
    for (const word of assistedSceneWords) {
      if (wordByHanzi.get(word)?.hsk === 1 && !wordByHanzi.get(word)?.bonus) assistedWords.add(word);
    }
  }
  if (allCorrectWords.size !== 150) add(10, "progression:all-correct", `${allCorrectWords.size}/150 HSK1 words encountered`);
  if (assistedWords.size !== 150) add(10, "progression:assisted", `${assistedWords.size}/150 HSK1 words encountered`);

  const ids = new Map();
  const recordId = (id, where) => {
    if (typeof id !== "string" || id.trim() === "") add(14, where, "missing stable ID");
    else if (ids.has(id)) add(14, where, `duplicate ID "${id}" also used at ${ids.get(id)}`);
    else ids.set(id, where);
  };
  words.forEach((word) => recordId(word.hanzi, `word:${word.hanzi || "missing"}`));
  ambientLines.forEach((line, index) => recordId(line.id, `ambient:${line.id ?? index}`));
  for (const pool of world.slotPools ?? []) {
    recordId(pool.id, `pool:${pool.id || "missing"}`);
    const valueIds = new Set();
    for (const [index, value] of (pool.values ?? []).entries()) {
      const where = `pool:${pool.id}/${index}`;
      if (typeof value.id !== "string" || value.id.trim() === "") add(14, where, "missing stable slot value ID");
      else if (valueIds.has(value.id)) add(14, where, `duplicate slot value ID "${value.id}" in pool "${pool.id}"`);
      else valueIds.add(value.id);
    }
  }
  const guidedConsequenceIds = new Set(scenes.flatMap((scene) =>
    (scene.exchanges ?? []).map((exchange) => exchange.guidedConsequence).filter(Boolean)
  ));
  const tutorialConsequenceIds = new Set(scenes
    .filter((scene) => scene.curriculumIndex === 0)
    .flatMap((scene) => (scene.exchanges ?? []).map((exchange) => exchange.onWrong).filter(Boolean)));
  for (const scene of scenes) {
    recordId(scene.id, `scene:${scene.id || "missing"}`);
    for (const exchange of scene.exchanges ?? []) {
      recordId(exchange.id, siteId(scene, exchange, "line"));
      for (const [index, reply] of (exchange.replies ?? []).entries()) {
        recordId(reply.id, siteId(scene, exchange, "reply", index));
        const expectedId = `${exchange.id}_r${index + 1}`;
        if (reply.id !== expectedId) {
          add(14, siteId(scene, exchange, "reply", index), `reply ID must be "${expectedId}"`);
        }
      }
      if (!Array.isArray(exchange.introduces)) add(14, siteId(scene, exchange, "line"), "strict exchange requires introduces");
      if (!Array.isArray(exchange.tests)) add(14, siteId(scene, exchange, "line"), "strict exchange requires tests");
      for (const introduced of exchange.introduces ?? []) {
        if (!(scene.introduces ?? []).includes(introduced)) {
          add(14, siteId(scene, exchange, "line"), `exchange introduction "${introduced}" is not declared by its scene`);
        }
      }
      for (const tested of exchange.tests ?? []) {
        if (!exchangeWords(exchange).includes(tested)) add(14, siteId(scene, exchange, "line"), `tested word "${tested}" is not present in the exchange`);
      }
      if (exchange.taskAfterCorrect) {
        for (const field of ["taskId", "targetTriggerId", "propId"]) {
          if (typeof exchange.taskAfterCorrect[field] !== "string" || exchange.taskAfterCorrect[field].trim() === "") {
            add(14, siteId(scene, exchange, "line"), `taskAfterCorrect requires ${field}`);
          }
        }
      }
    }
    if (Number.isInteger(scene.curriculumIndex)) {
      if (!Number.isInteger(scene.minDay) || scene.minDay < 1) add(14, `scene:${scene.id}`, "curriculum scene requires positive minDay");
      if (!Array.isArray(scene.afterScenes)) add(14, `scene:${scene.id}`, "curriculum scene requires afterScenes");
      if (typeof scene.repeatable !== "boolean") add(14, `scene:${scene.id}`, "curriculum scene requires repeatable");
      if (!Array.isArray(scene.allowedSlots) || scene.allowedSlots.length === 0) add(14, `scene:${scene.id}`, "curriculum scene requires allowedSlots");
    }
    for (const after of scene.afterScenes ?? []) {
      if (!sceneById.has(after) || after === scene.id) add(14, `scene:${scene.id}`, `invalid afterScenes target "${after}"`);
    }
    if (
      scene.kind === "consequence"
      && (guidedConsequenceIds.has(scene.id) || tutorialConsequenceIds.has(scene.id))
    ) {
      if (scene.cost !== 0) {
        add(14, `scene:${scene.id}`, "guided and tutorial consequence cost must be 0");
      }
    } else if (scene.kind === "consequence" && !Number.isInteger(scene.curriculumIndex)) {
      if (!Number.isInteger(scene.cost) || scene.cost < 1 || scene.cost > 5) {
        add(14, `scene:${scene.id}`, "ordinary consequence cost must be an integer from 1 to 5");
      }
    }
    if (scene.purchase) {
      if (!scene.purchase.itemId || !Number.isInteger(scene.purchase.price) || scene.purchase.price <= 0) {
        add(14, `scene:${scene.id}`, "purchase requires an itemId and positive integer price");
      }
      if (!["optional-entry", "withhold-first-reward"].includes(scene.purchase.mode)) {
        add(14, `scene:${scene.id}`, `invalid purchase mode "${scene.purchase.mode}"`);
      }
      if (scene.cost !== undefined) add(14, `scene:${scene.id}`, "purchase and scene cost would bill the same scene twice");
    }
  }
  const curriculumIndices = curriculumScenes.map((scene) => scene.curriculumIndex);
  if (curriculumScenes.length !== 25 || new Set(curriculumIndices).size !== 25 || curriculumIndices.some((index) => index < 0 || index > 24)) {
    add(14, "metadata:curriculum", `${curriculumScenes.length}/25 unique curriculum rows indexed 0–24`);
  }

  const routeEdges = new Map(scenes.map((scene) => [scene.id, []]));
  for (const scene of scenes) {
    for (const exchange of scene.exchanges ?? []) {
      for (const target of [
        exchange.onWrong,
        exchange.guidedConsequence,
        ...(exchange.replies ?? []).map((reply) => reply.next),
      ]) {
        if (target && sceneById.has(target) && !scene.exchanges.some((candidate) => candidate.id === target)) {
          routeEdges.get(scene.id).push(target);
        }
      }
    }
  }
  const visiting = new Set();
  const visited = new Set();
  function visitRoute(sceneId, path) {
    if (visiting.has(sceneId)) {
      add(6, `scene:${sceneId}`, `accidental cross-scene cycle: ${[...path, sceneId].join(" → ")}`);
      return;
    }
    if (visited.has(sceneId)) return;
    visiting.add(sceneId);
    for (const target of routeEdges.get(sceneId) ?? []) visitRoute(target, [...path, sceneId]);
    visiting.delete(sceneId);
    visited.add(sceneId);
  }
  for (const scene of scenes) visitRoute(scene.id, []);

  const coverageRows = [...coverage].map(([word, coveredScenes]) => ({
    word,
    sceneCount: coveredScenes.size,
    scenes: [...coveredScenes],
  }));
  return {
    issues,
    failed: issues.some((issue) => issue.severity === "FAIL"),
    sites: listContentSites(scenes, world, ambientLines),
    coverage: {
      rows: coverageRows,
      targetWords: phaseWords.length,
      placementsTotal,
      bonusWords: bonusWords.length,
    },
    exchangeNovelty,
    familiarity: {
      numerator: familiarityNumerator,
      denominator: familiarityDenominator,
      ratio: familiarity,
      newTypes: [...familiarityNewTypes].sort(),
    },
  };
}

export const strictRuleNumbers = [1, 2, 3, 4, 5, 6, 7, 10, 11, 14, 15];
