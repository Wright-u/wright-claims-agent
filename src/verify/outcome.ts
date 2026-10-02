import type { TraceStep, VerifyResult } from '../domain/types.js';
import type { RawVerdict } from './validator.js';

export class VerificationOutcomeFactory {
	finish(
		claimId: string,
		verdict: RawVerdict,
		rounds: number,
		codeRequests: number,
		trace: TraceStep[]
	): VerifyResult {
		if (verdict.verdict === 'unknown') {
			return this.undetermined(
				claimId,
				rounds,
				codeRequests,
				trace,
				verdict.reasoning
			);
		}
		return {
			claimId,
			verdict: verdict.verdict,
			reasoning: verdict.reasoning,
			evidence: verdict.evidence,
			rounds,
			codeRequests,
			trace,
		};
	}

	undetermined(
		claimId: string,
		rounds: number,
		codeRequests: number,
		trace: TraceStep[],
		reasoning = 'Evidence remained insufficient after the maximum number of rounds.'
	): VerifyResult {
		return {
			claimId,
			verdict: 'undetermined',
			reasoning,
			evidence: [],
			rounds,
			codeRequests,
			trace,
		};
	}
}
