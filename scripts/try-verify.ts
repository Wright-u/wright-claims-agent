/**
 *   npm run try -- --app daemon --narrative "Business logic lives here"
 */
import process from 'node:process';
import { ClaimVerifier } from '../src/verify/loop.js';

function arg(name: string): string | undefined {
	const i = process.argv.indexOf(`--${name}`);
	return i >= 0 ? process.argv[i + 1] : undefined;
}

async function main() {
	const appName = arg('app') ?? 'daemon';
	const narrative =
		arg('narrative') ??
		'Business logic (validation, rules) lives in this application';

	console.log(`\nVerifying narrative on "${appName}": "${narrative}"\n`);
	const result = await new ClaimVerifier().verify(appName, narrative);

	for (const verification of result.results) {
		console.log(`\nClaim:        ${verification.claimId}`);
		console.log('Verdict:      ', verification.verdict);
		console.log('Reasoning:    ', verification.reasoning);
		console.log('Evidence:     ', verification.evidence);
		console.log('Rounds used:  ', verification.rounds);
		console.log('Code requests:', verification.codeRequests);
	}
}

main().catch((err) => {
	console.error(err);
	process.exit(1);
});
