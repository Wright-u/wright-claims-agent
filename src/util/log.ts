import type { TraceStep, VerifyResult } from "../domain/types.js";

export function printTrace(result: VerifyResult): void {
  console.log(`\nClaim: ${result.claimId}`);
  console.log(`Verdict: ${result.verdict}  (rounds=${result.rounds}, codeRequests=${result.codeRequests})`);
  console.log(`Reasoning: ${result.reasoning}`);
  if (result.evidence.length) console.log(`Evidence: ${result.evidence.join(", ")}`);
  console.log("Trace:");
  for (const step of result.trace) printStep(step);
}

function printStep(step: TraceStep): void {
  console.log(`  [round ${step.round}] ${step.tool}(${JSON.stringify(step.args)})`);
  console.log(`    -> ${step.resultSummary}`);
}
