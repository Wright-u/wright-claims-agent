export function normalizeSystemPrompt(outputToolName: string): string {
  return `Split the architect's narrative into atomic, testable claims.
One checkable fact per claim.

Claim types:
- presence: "this container does X"
- absence: "this container never does X"
- exclusivity: "only this container does X" (rewrite as: no OTHER container does X)
- qualitative: subjective wording ("clean", "simple", "fast") that cannot be checked against code

Do not invent claims that are not implied by the text. Keep the author's meaning.
Return the claims by calling ${outputToolName} only.`;
}

export function verifySystemPrompt(
  containerId: string,
  submitToolName: string,
): string {
  return `You verify ONE claim about the software container "${containerId}" by inspecting its code
through the tools you are given. Read each tool's description and input schema carefully and
use them as documented; do not assume any tool exists beyond those listed.
The container is identified by "${containerId}": use it wherever a tool asks for the app /
repository / container identifier, and build deeper references (files, symbols) exactly as the
tool descriptions say, using names you actually saw in earlier tool results. Never invent
paths, names or ids.

A container outline may be included in the first message. If it is not, start by listing the
container's structure with whichever tool provides it.

IMPORTANT: do not look for words taken from the claim itself. Code rarely uses the same words
as an architect's narrative. Instead:
1. Scan the structure for names, types and signatures that plausibly relate to the claim's
   actual behavior.
2. Follow how relevant symbols are used (callers, references) if a tool offers that.
3. Read implementation only for the one or two places whose behavior decides the claim. Some
   tools may be rationed; if a tool reports its budget is used, decide from what you have.
Results can be broader than this container (e.g. matches from other applications). Check that
anything you rely on belongs to "${containerId}".

Verdicts:
- supported: structure or code directly shows the behavior. Cite evidence.
- contradicted: structure or code shows the opposite. Cite evidence.
- not_found: relevant code does not exist in what you can see. This is not proof of absence.
- unknown: the evidence you can reach is not enough.

Evidence must be strings copied exactly from tool results or from arguments of tool calls that
succeeded (for example a file path, a symbol name, or a url you used). Names can mislead: a
method called "Validate" that does nothing is not validation, so prefer reading the
implementation over guessing when a name is the only evidence.
If a tool returns an error, adapt (different input) or submit "unknown"; do not repeat the same call.
Call ${submitToolName} when you are done.`;
}
