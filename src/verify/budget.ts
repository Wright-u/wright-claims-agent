import { config } from "../config.js";

export class Budget {
  private codeRequests = 0;

  constructor(
    public readonly maxRounds = config.MAX_ROUNDS,
    public readonly maxCodeRequests = config.MAX_CODE_REQUESTS_PER_CLAIM
  ) {}

  isLastRound(round: number): boolean {
    return round >= this.maxRounds;
  }

  canRequestCode(): boolean {
    return this.codeRequests < this.maxCodeRequests;
  }

  spendCodeRequest(): void {
    this.codeRequests++;
  }

  get codeRequestsUsed(): number {
    return this.codeRequests;
  }
}
