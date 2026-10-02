export interface RawVerdict {
	verdict: 'supported' | 'contradicted' | 'not_found' | 'unknown';
	reasoning: string;
	evidence: string[];
}

/**
 * Returns an error message if the verdict is invalid, or null if it's fine.
 * Rules:
 * - supported/contradicted must cite at least one piece of evidence.
 * - every cited evidence id must have actually been returned by a tool this run.
 */
export function checkVerdict(
	v: RawVerdict,
	seenEvidence: Set<string>
): string | null {
	if (
		['supported', 'contradicted'].includes(v.verdict) &&
		v.evidence.length === 0
	) {
		return 'supported/contradicted requires at least one evidence reference.';
	}
	const fake = v.evidence.filter((e) => !seenEvidence.has(e));
	if (fake.length > 0) {
		return `Evidence not returned by any tool this run: ${fake.join(', ')}`;
	}
	return null;
}

// Extracts symbol-id-shaped references (path#Symbol.member) from a tool result string
export function collectEvidence(text: string, seen: Set<string>): void {
	for (const m of text.matchAll(/[\w./-]+#[\w.]+/g)) seen.add(m[0]);
}
