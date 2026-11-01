import type { UserModelsResponse } from "../lib/api.types";
import { MODEL_TEXT } from "../lib/copy";
import { effectiveChoice, modelDetails, modelName } from "../lib/model.format";

interface ModelPickerProps {
  models: UserModelsResponse | null;
  /** Stored choice; null = admin default. */
  value: string | null;
  onChange: (model: string | null) => void;
  disabled?: boolean;
}

/** Compact model select for the composer; hidden when there is nothing to choose. */
export function ModelPicker({ models, value, onChange, disabled = false }: ModelPickerProps) {
  if (!models || models.models.length < 2) return null;
  const current = effectiveChoice(value, models.models, models.defaultModel) ?? models.defaultModel;
  return (
    <select aria-label={MODEL_TEXT.pickerLabel} value={current} disabled={disabled}
      onChange={(e) => onChange(e.target.value === models.defaultModel ? null : e.target.value)}
      className="max-w-56 truncate rounded-lg bg-transparent px-2 py-1 text-xs text-muted outline-none hover:bg-bubble hover:text-ink focus-visible:ring-2 focus-visible:ring-accent/40 disabled:opacity-50">
      {models.models.map((m) => (
        <option key={m.id} value={m.id} title={m.id}>
          {modelName(m)}{m.id === models.defaultModel ? ` (${MODEL_TEXT.defaultSuffix})` : ""} · {modelDetails(m, MODEL_TEXT.image)}
        </option>
      ))}
    </select>
  );
}
