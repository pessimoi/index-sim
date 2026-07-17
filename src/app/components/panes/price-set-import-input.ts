import type { ChangeEvent } from "react";

export async function importPriceSetFromInput(
  event: ChangeEvent<HTMLInputElement>,
  importPriceSet: (file: File) => Promise<void>
): Promise<void> {
  const input = event.currentTarget;
  const file = input.files?.[0];
  if (!file) return;
  try {
    await importPriceSet(file);
  } finally {
    input.value = "";
  }
}
