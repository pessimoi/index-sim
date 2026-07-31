import {
  createGeneratedRuntimeContext,
  type GeneratedRuntimeBootstrapResult,
  type GeneratedRuntimeContextOptions
} from "../../adapters/generated";

/**
 * Test-only current runtime fixture. It intentionally uses the same validated
 * generated snapshot and static PriceSet composition as the supported app.
 * Historical assertions must use immutable legacy fixtures instead.
 */
export function createCurrentTestContext(
  options: GeneratedRuntimeContextOptions = {}
): GeneratedRuntimeBootstrapResult {
  return createGeneratedRuntimeContext(options);
}

export async function loadCurrentTestContext(
  options: GeneratedRuntimeContextOptions = {}
): Promise<GeneratedRuntimeBootstrapResult> {
  return createCurrentTestContext(options);
}
