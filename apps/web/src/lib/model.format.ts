import type { FreeModel } from "./api.types";
import { formatTokens } from "./quota.format";

const FREE_SUFFIX = /\s*\(free\)\s*$/i;

/** Display name without OpenRouter's "(free)" suffix (every listed model is free). */
export function modelName(model: Pick<FreeModel, "id" | "name">): string {
  return model.name.replace(FREE_SUFFIX, "") || model.id;
}

/** Short capability line, e.g. "262 rb konteks · gambar". */
export function modelDetails(model: FreeModel, imageLabel: string): string {
  const parts = [`${formatTokens(model.contextLength)} konteks`];
  if (model.inputModalities.includes("image")) parts.push(imageLabel);
  return parts.join(" · ");
}

/** The model a picker should show: the stored choice if still usable, else the default (null). */
export function effectiveChoice(choice: string | null, usable: FreeModel[], defaultModel: string): string | null {
  if (!choice || choice === defaultModel) return null;
  return usable.some((m) => m.id === choice) ? choice : null;
}
