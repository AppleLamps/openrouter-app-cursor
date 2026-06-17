export const MODEL_VARIANTS = [
  "nitro",
  "floor",
  "online",
  "free",
  "extended",
  "exacto",
  "thinking",
] as const;

export type ModelVariant = (typeof MODEL_VARIANTS)[number];

const VARIANT_SET = new Set<string>(MODEL_VARIANTS);

/** Preferred suffix order when composing model ids. */
const VARIANT_ORDER: ModelVariant[] = [
  "free",
  "extended",
  "thinking",
  "nitro",
  "floor",
  "exacto",
  "online",
];

export type ModelVariantOption = {
  id: ModelVariant;
  label: string;
  description: string;
};

export const MODEL_VARIANT_OPTIONS: ModelVariantOption[] = [
  {
    id: "nitro",
    label: "Nitro",
    description: "Sort providers by throughput for faster responses.",
  },
  {
    id: "floor",
    label: "Floor",
    description: "Sort providers by price for lowest cost.",
  },
  {
    id: "online",
    description: "Lightweight built-in web search via the :online suffix.",
    label: "Online",
  },
  {
    id: "free",
    label: "Free",
    description: "Use the free endpoint when available (rate limits apply).",
  },
  {
    id: "extended",
    label: "Extended",
    description: "Extended context window variant (model-specific).",
  },
  {
    id: "exacto",
    label: "Exacto",
    description: "Quality-first provider routing for tool calling.",
  },
  {
    id: "thinking",
    label: "Thinking",
    description: "Extended reasoning variant (model-specific).",
  },
];

/** Sort variants that compete for provider ordering — only one applies at a time. */
const PROVIDER_SORT_VARIANTS: ModelVariant[] = ["nitro", "floor", "exacto"];

export function isModelVariant(value: string): value is ModelVariant {
  return VARIANT_SET.has(value);
}

export function parseModelWithVariants(model: string) {
  const trimmed = model.trim();
  const slashIndex = trimmed.indexOf("/");
  if (slashIndex === -1) {
    return { baseModel: trimmed, variants: new Set<ModelVariant>() };
  }

  const provider = trimmed.slice(0, slashIndex);
  const slugParts = trimmed.slice(slashIndex + 1).split(":");
  const variants: ModelVariant[] = [];
  let end = slugParts.length;

  while (end > 1 && isModelVariant(slugParts[end - 1])) {
    variants.unshift(slugParts[end - 1] as ModelVariant);
    end -= 1;
  }

  const baseSlug = slugParts.slice(0, end).join(":");

  return {
    baseModel: `${provider}/${baseSlug}`,
    variants: new Set(variants),
  };
}

export function applyModelVariants(baseModel: string, variants: Iterable<ModelVariant>) {
  const normalizedBase = baseModel.trim();
  if (!normalizedBase) {
    return normalizedBase;
  }

  const active = new Set(variants);
  if (active.size === 0) {
    return normalizedBase;
  }

  const suffixes = VARIANT_ORDER.filter((variant) => active.has(variant));
  return `${normalizedBase}:${suffixes.join(":")}`;
}

export function toggleModelVariant(model: string, variant: ModelVariant, enabled: boolean) {
  const { baseModel, variants } = parseModelWithVariants(model);
  const nextVariants = new Set(variants);

  if (enabled) {
    if (PROVIDER_SORT_VARIANTS.includes(variant)) {
      for (const competing of PROVIDER_SORT_VARIANTS) {
        if (competing !== variant) {
          nextVariants.delete(competing);
        }
      }
    }
    nextVariants.add(variant);
  } else {
    nextVariants.delete(variant);
  }

  return applyModelVariants(baseModel, nextVariants);
}

export function setModelBase(model: string, baseModel: string) {
  const { variants } = parseModelWithVariants(model);
  return applyModelVariants(baseModel, variants);
}
