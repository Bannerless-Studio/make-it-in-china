import { eligibleSlotTuples } from "./slot-tuples.mjs";

const PLACEHOLDER = /\{([A-Za-z_][A-Za-z0-9_]*)\}/g;

function compareStrings(left, right) {
  return left < right ? -1 : left > right ? 1 : 0;
}

function normalized(value) {
  return String(value ?? "").normalize("NFC");
}

function placeholderNames(value) {
  return [...new Set([...normalized(value).matchAll(PLACEHOLDER)].map((match) => match[1]))];
}

function fill(value, binding, field) {
  return normalized(value).replace(PLACEHOLDER, (_, name) => {
    const selected = binding[name];
    if (!selected) throw new Error(`Unbound slot "${name}" in ${field}`);
    return normalized(selected[field] ?? selected.hanzi);
  });
}

export function buildWordAudioMap(words, existing = {}) {
  const retained = { ...existing };
  const usedIds = new Map();
  let next = 1;
  for (const [hanzi, id] of Object.entries(retained)) {
    if (!/^word_\d{3,}$/u.test(id)) {
      throw new Error(`Word audio map entry "${hanzi}" has invalid clip id "${id}"`);
    }
    if (usedIds.has(id)) {
      throw new Error(`Word audio clip id "${id}" is mapped by both "${usedIds.get(id)}" and "${hanzi}"`);
    }
    usedIds.set(id, hanzi);
    next = Math.max(next, Number.parseInt(id.slice(5), 10) + 1);
  }
  const current = {};
  const seenHanzi = new Set();
  for (const word of words) {
    if (seenHanzi.has(word.hanzi)) throw new Error(`Duplicate dictionary hanzi "${word.hanzi}"`);
    seenHanzi.add(word.hanzi);
    let id = retained[word.hanzi];
    if (!id) {
      do {
        id = `word_${String(next).padStart(3, "0")}`;
        next += 1;
      } while (usedIds.has(id));
      retained[word.hanzi] = id;
      usedIds.set(id, word.hanzi);
    }
    current[word.hanzi] = id;
  }
  return { current, retained };
}

function presetMap(voices) {
  return voices.presets ?? voices;
}

function getPreset(voices, owner) {
  const preset = presetMap(voices)[owner];
  if (!preset) throw new Error(`Missing voice preset for "${owner}"`);
  for (const field of ["voice", "rate", "pitch"]) {
    if (typeof preset[field] !== "string" || preset[field].length === 0) {
      throw new Error(`Voice preset "${owner}" is missing ${field}`);
    }
  }
  return { voice: preset.voice, rate: preset.rate, pitch: preset.pitch };
}

function checkVoiceSeparation(voices, world) {
  const byVoice = new Map();
  const speakingCharacters = [{ id: "player" }, ...(world.npcs ?? [])];
  for (const npc of speakingCharacters) {
    const preset = getPreset(voices, npc.id);
    const pitch = Number.parseFloat(preset.pitch);
    if (!Number.isFinite(pitch)) {
      throw new Error(`Voice preset "${npc.id}" has invalid pitch "${preset.pitch}"`);
    }
    const owners = byVoice.get(preset.voice) ?? [];
    for (const other of owners) {
      if (Math.abs(other.pitch - pitch) <= 2) {
        throw new Error(
          `Voice presets "${other.id}" and "${npc.id}" must differ by more than 2 Hz`
        );
      }
    }
    owners.push({ id: npc.id, pitch });
    byVoice.set(preset.voice, owners);
  }
  getPreset(voices, "system");
}

function catalogLines(catalog, keys) {
  if (!catalog) return [];
  if (Array.isArray(catalog)) return catalog;
  for (const key of keys) {
    if (Array.isArray(catalog[key])) return catalog[key];
  }
  return [];
}

function assertSpokenText(id, text) {
  if (!text.trim()) throw new Error(`${id} has empty spoken text`);
  if (/<[^>]*>/u.test(text)) throw new Error(`${id} contains unsupported SSML/XML`);
}

export function bindingKey(names, binding) {
  return names.map((name) => `${name}=${binding[name].id}`).join("|");
}

export function buildTtsInventory({
  words,
  scenes,
  world,
  voices,
  ambient = null,
  wordAudioMap = {},
}) {
  checkVoiceSeparation(voices, world);
  const pools = new Map((world.slotPools ?? []).map((pool) => [pool.id, pool]));
  for (const pool of pools.values()) {
    const ids = new Set();
    for (const [index, value] of (pool.values ?? []).entries()) {
      if (typeof value.id !== "string" || value.id.trim() === "") {
        throw new Error(`Slot pool "${pool.id}" value ${index + 1} is missing a stable id`);
      }
      if (ids.has(value.id)) {
        throw new Error(`Slot pool "${pool.id}" has duplicate stable id "${value.id}"`);
      }
      ids.add(value.id);
    }
  }
  const clips = [];
  const variants = {};
  const { current: wordLookup, retained: retainedWordAudioMap } =
    buildWordAudioMap(words, wordAudioMap);
  const warnings = [];
  const ids = new Set();

  function addClip(clip) {
    if (ids.has(clip.id)) throw new Error(`Duplicate speech id "${clip.id}"`);
    if (!/^[A-Za-z0-9_-]+$/u.test(clip.id)) throw new Error(`Invalid speech id "${clip.id}"`);
    assertSpokenText(clip.id, clip.text);
    ids.add(clip.id);
    clips.push({
      ...clip,
      text: normalized(clip.text),
      pinyin: normalized(clip.pinyin)
    });
  }

  function addSite({ baseId, site, owner, category, exchangeId }) {
    if (!baseId) {
      warnings.push(`${exchangeId} ${category} has no audio id; skipped`);
      return;
    }
    const names = placeholderNames(site.hanzi);
    const pinyinNames = placeholderNames(site.pinyin);
    if (names.join("|") !== pinyinNames.join("|")) {
      throw new Error(`${baseId} hanzi and pinyin placeholders differ`);
    }
    const preset = getPreset(voices, owner);
    if (names.length === 0) {
      addClip({
        id: baseId,
        baseId,
        category,
        text: site.hanzi,
        pinyin: site.pinyin ?? "",
        ...preset
      });
      return;
    }

    const sortedNames = [...names].sort();
    const poolBySlot = site.poolBySlot;
    for (const name of sortedNames) {
      if (!poolBySlot.get(name)) throw new Error(`${baseId} slot "${name}" has no bound pool`);
    }
    const byBinding = {};
    const bindings = eligibleSlotTuples(sortedNames, poolBySlot);
    for (const [index, binding] of bindings.entries()) {
      const id = `${baseId}__v${String(index).padStart(3, "0")}`;
      byBinding[bindingKey(sortedNames, binding)] = id;
      addClip({
        id,
        baseId,
        category,
        text: fill(site.hanzi, binding, "hanzi"),
        pinyin: fill(site.pinyin ?? "", binding, "pinyin"),
        ...preset
      });
    }
    variants[baseId] = { slots: sortedNames, byBinding };
  }

  for (const scene of scenes) {
    const poolBySlot = new Map();
    for (const exchange of scene.exchanges ?? []) {
      for (const [name, poolId] of Object.entries(exchange.slots ?? {})) {
        const pool = pools.get(poolId);
        if (!pool) throw new Error(`${exchange.id} references unknown pool "${poolId}"`);
        poolBySlot.set(name, pool);
      }

      const line = exchange.line ?? {};
      addSite({
        baseId: line.audio,
        site: { ...line, poolBySlot },
        owner: scene.npc,
        category: "lines",
        exchangeId: exchange.id
      });

      for (const [index, reply] of (exchange.replies ?? []).entries()) {
        addSite({
          baseId: reply.audio,
          site: { ...reply, poolBySlot },
          owner: "player",
          category: "replies",
          exchangeId: `${exchange.id}_r${index + 1}`
        });
      }

      if (exchange.hint) {
        addSite({
          baseId: exchange.hint.audio,
          site: { ...exchange.hint, poolBySlot },
          owner: scene.npc,
          category: "hints",
          exchangeId: `${exchange.id}_hint`
        });
      } else if ((exchange.replies ?? []).some((reply) => reply.correct === false)) {
        warnings.push(`${exchange.id} has no hint; skipped`);
      }
    }
  }

  for (const word of words) {
    const id = wordLookup[word.hanzi];
    addClip({
      id,
      baseId: id,
      category: "words",
      text: word.hanzi,
      pinyin: word.pinyin,
      ...getPreset(voices, "system")
    });
  }

  const ambientLines = catalogLines(ambient, ["lines", "ambientLines"]);
  for (const [index, line] of ambientLines.entries()) {
    const baseId = line.audio ?? line.id;
    let owner = line.npc ?? line.speaker;
    if (!owner) {
      owner = "system";
      warnings.push(`${baseId ?? `ambient[${index}]`} has no speaker; using system voice`);
    }
    addSite({
      baseId,
      site: { ...line, hanzi: line.hanzi ?? line.text, poolBySlot: new Map() },
      owner,
      category: "ambient",
      exchangeId: baseId ?? `ambient[${index}]`
    });
  }

  const systemLines = [
    ...catalogLines(world.systemLines, ["lines"]),
    ...catalogLines(world.uiSpeech, ["lines"]),
    ...catalogLines(ambient?.systemLines, ["lines"])
  ];
  for (const [index, line] of systemLines.entries()) {
    const baseId = line.audio ?? line.id;
    addSite({
      baseId,
      site: { ...line, hanzi: line.hanzi ?? line.text, poolBySlot: new Map() },
      owner: "system",
      category: "system",
      exchangeId: baseId ?? `system[${index}]`
    });
  }

  clips.sort((left, right) => compareStrings(left.id, right.id));
  const sortedVariants = Object.fromEntries(
    Object.entries(variants)
      .sort(([left], [right]) => compareStrings(left, right))
      .map(([id, value]) => [
        id,
        {
          slots: value.slots,
          byBinding: Object.fromEntries(
            Object.entries(value.byBinding).sort(([left], [right]) => compareStrings(left, right))
          )
        }
      ])
  );
  const sortedWords = Object.fromEntries(
    Object.entries(wordLookup).sort(([left], [right]) => compareStrings(left, right))
  );
  const categories = {};
  for (const clip of clips) categories[clip.category] = (categories[clip.category] ?? 0) + 1;

  return {
    clips,
    variants: sortedVariants,
    words: sortedWords,
    wordAudioMap: Object.fromEntries(
      Object.entries(retainedWordAudioMap).sort(([left], [right]) => compareStrings(left, right))
    ),
    warnings,
    categories: Object.fromEntries(
      Object.entries(categories).sort(([a], [b]) => compareStrings(a, b))
    )
  };
}
