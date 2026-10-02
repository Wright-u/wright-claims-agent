import type { TraceStep, VerifyResult } from '../domain/types.js';

export class TraceLogger {
	print(result: VerifyResult): void {
		console.log(`\nClaim: ${result.claimId}`);
		console.log(
			`Verdict: ${result.verdict}  (rounds=${result.rounds}, codeRequests=${result.codeRequests})`
		);
		console.log(`Reasoning: ${result.reasoning}`);
		if (result.evidence.length)
			console.log(`Evidence: ${result.evidence.join(', ')}`);
		console.log('Trace:');
		for (const step of result.trace) this.printStep(step);
	}

	private printStep(step: TraceStep): void {
		console.log(
			`  [round ${step.round}] ${step.tool}(${JSON.stringify(step.args)})`
		);
		console.log(`    -> ${step.resultSummary}`);
	}
}
