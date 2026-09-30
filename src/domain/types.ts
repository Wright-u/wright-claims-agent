export type ClaimType = "presence" | "absence" | "exclusivity" | "qualitative";

export interface Claim {
  id: string;
  text: string;
  type: ClaimType;
}

export type Verdict = "supported" | "contradicted" | "not_found" | "undetermined";

export interface TraceStep {
  round: number;
  tool: string;
  args: Record<string, unknown>;
  resultSummary: string;
}

export interface VerifyResult {
  claimId: string;
  verdict: Verdict;
  reasoning: string;
  evidence: string[];
  rounds: number;
  codeRequests: number;
  trace: TraceStep[];
}

export interface NormalizeRequest {
  containerId: string;
  narrative: string;
}

export interface VerifyRequest {
  containerId: string;
  claim: Claim;
}
