const pairedIds = {
  place: { front: "back", back: "front", inside: "front" },
};

const swappingPools = new Set(["size", "drink", "container", "negative"]);

function valueId(pool, value, index) {
  if (typeof value?.id !== "string" || value.id.trim() === "") {
    throw new Error(`Slot pool "${pool?.id ?? "missing"}" value ${index + 1} is missing a stable id`);
  }
  return value.id;
}

export function pairedSlotValue(pool, value) {
  const index = pool.values.indexOf(value);
  if (index < 0) return null;
  let pairedId;
  if (pool.id === "number_1_10") {
    pairedId = pool.values[index + (index % 2 === 0 ? 1 : -1)]?.id;
  } else if (swappingPools.has(pool.id) && pool.values.length === 2) {
    pairedId = pool.values[index === 0 ? 1 : 0]?.id;
  } else {
    pairedId = pairedIds[pool.id]?.[value.id];
  }
  return pool.values.find((candidate) => candidate.id === pairedId) ?? null;
}

export function slotValuePairIsEligible(pool, value, eligibleWords) {
  const alternative = pairedSlotValue(pool, value);
  if (!alternative) return false;
  if (!eligibleWords) return true;
  return [...(value.words ?? []), ...(alternative.words ?? [])]
    .every((word) => eligibleWords.has(word));
}

export function eligibleSlotTuples(names, poolBySlot, eligibleWords) {
  let result = [{}];
  for (const name of [...new Set(names)]) {
    const pool = poolBySlot.get(name);
    if (!pool?.values?.length) return [];
    const values = pool.values.filter((value, index) => {
      valueId(pool, value, index);
      return slotValuePairIsEligible(pool, value, eligibleWords);
    });
    result = result.flatMap((binding) =>
      values
        .filter((value) => Object.entries(binding).every(([boundName, boundValue]) =>
          poolBySlot.get(boundName)?.id !== pool.id || boundValue.id !== value.id
        ))
        .map((value) => ({ ...binding, [name]: value }))
    );
  }
  return result;
}
