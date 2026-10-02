export class PromptFactory {
	normalizeSystem(): string {
		return `Split the architect's narrative into atomic, testable claims.
One checkable fact per claim.

Claim types:
- presence: "this container does X"
- absence: "this container never does X"
- exclusivity: "only this container does X" (rewrite as: no OTHER container does X)
- qualitative: subjective wording ("clean", "simple", "fast") that cannot be checked against code

Rules:
- Do not invent claims that are not implied by the text. Keep the author's meaning.
- Each claim must be self-contained: name the container explicitly, no pronouns.

Output format:
Respond with a single JSON object and nothing else. No prose, no markdown, no code fences.
Schema:
{"claims": [{"type": "presence" | "absence" | "exclusivity" | "qualitative", "text": string}]}

If the narrative contains no claims, respond with {"claims": []}.

Example input: "The API gateway handles auth. Only the worker touches the queue. The design is clean."
Example output:
{"claims":[{"type":"presence","text":"The API gateway handles auth."},{"type":"exclusivity","text":"No container other than the worker accesses the queue."},{"type":"presence","text":"The worker accesses the queue."},{"type":"qualitative","text":"The design is clean."}]}`;
	}

	verifySystem(appName: string): string {
		return `You verify ONE claim about the software application "${appName}" by inspecting its code
through the tools you are given. Read each tool's description and input schema carefully and
use them as documented; do not assume any tool exists beyond those listed. Choose the next tool
call yourself. Do not invent argument values: use identifiers and paths returned by tools.

IMPORTANT: do not look for words taken from the claim itself. Code rarely uses the same words
as an architect's narrative. Instead:
1. Scan the structure for names, types and signatures that plausibly relate to the claim's
   actual behavior.
2. Follow how relevant symbols are used when a tool offers that.
3. Read implementation only for the one or two places whose behavior decides the claim. Some
   tools may be rationed; if a tool reports its budget is used, decide from what you have.
Results can be broader than this application (e.g. matches from other applications). Check that
anything you rely on belongs to "${appName}".

Verdicts:
- supported: structure or code directly shows the behavior. Cite evidence.
- contradicted: structure or code shows the opposite. Cite evidence.
- not_found: relevant code does not exist in what you can see. This is not proof of absence.
- unknown: the evidence you can reach is not enough.

Evidence must be strings copied exactly from tool results or from arguments of tool calls that
succeeded (for example a file path, a symbol name, or a url you used). Names can mislead: a
method called "Validate" that does nothing is not validation, so prefer reading the
implementation over guessing when a name is the only evidence.
If a tool returns an error, adapt (different input) or return an "unknown" verdict; do not repeat the same call.

When you have enough evidence, return this JSON object as your entire response. Do not call a
submission tool: none exists. Do not include prose, markdown, or code fences.
{"verdict":"supported" | "contradicted" | "not_found" | "unknown","reasoning":string,"evidence":string[]}`;
	}
}

export const prompts = new PromptFactory();
