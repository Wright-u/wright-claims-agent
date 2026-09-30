export const NORMALIZE_SYSTEM_PROMPT = `Split the architect's narrative into atomic, testable claims.
One checkable fact per claim.

Claim types:
- presence: "this container does X"
- absence: "this container never does X"
- exclusivity: "only this container does X" (rewrite as: no OTHER container does X)
- qualitative: subjective wording ("clean", "simple", "fast") that cannot be checked against code

Do not invent claims that are not implied by the text. Keep the author's meaning.
Return claims via the emit_claims tool only.`;

// v1
export function verifySystemPrompt(containerId: string): string {
  return `You verify ONE claim about container "${containerId}". You do NOT have the source code.
You have a structural tree: symbols, signatures, doc comments, call graph, and external calls.

Work in this order:
1. Look for symbols whose name, doc or signature relates to the claim.
2. Follow the call graph with get_symbol to see who does the work.
3. Only if the structure cannot settle it, call request_code for ONE symbol
   and state exactly what you need to check.

Verdicts:
- supported: structure or code directly shows the behavior. Cite symbol ids.
- contradicted: structure or code shows the opposite. Cite symbol ids.
- not_found: relevant symbols do not exist in the tree. This is not proof of absence.
- unknown: the evidence you can reach is not enough.

Names can mislead. A method called "validate" that does nothing is not validation.
Prefer request_code over guessing when a name is the only evidence.
Call submit_verdict when you are done.`;
}
