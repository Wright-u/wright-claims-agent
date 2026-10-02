import type { TraceStep, VerifyResult } from '../domain/types.js';
import type { RawVerdict } from './validator.js';

export function finish(
	claimId: string,
	v: RawVerdict,
	rounds: number,
	codeRequests: number,
	trace: TraceStep[]
): VerifyResult {
	if (v.verdict === 'unknown') {
		return undetermined(claimId, rounds, codeRequests, trace, v.reasoning);
	}
	return {
		claimId,
		verdict: v.verdict,
		reasoning: v.reasoning,
		evidence: v.evidence,
		rounds,
		codeRequests,
		trace,
	};
}

export function undetermined(
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
