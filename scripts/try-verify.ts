/**
 *   npm run try -- --container daemon --claim "Business logic lives here"
 */
import process from 'node:process';
import { verify } from '../src/verify/loop.js';

function arg(name: string): string | undefined {
	const i = process.argv.indexOf(`--${name}`);
	return i >= 0 ? process.argv[i + 1] : undefined;
}

async function main() {
	const containerId = arg('container') ?? 'daemon';
	const text =
		arg('claim') ??
		'Business logic (validation, rules) lives in this container';

	const claim = { id: 'manual.n1', text, type: 'presence' as const };

	console.log(`\nVerifying claim on "${containerId}": "${text}"\n`);
	const result = await verify(containerId, claim);

	console.log('Verdict:      ', result.verdict);
	console.log('Reasoning:    ', result.reasoning);
	console.log('Evidence:     ', result.evidence);
	console.log('Rounds used:  ', result.rounds);
	console.log('Code requests:', result.codeRequests);
	console.log('\nTrace:');
	for (const step of result.trace) {
		console.log(
			`  [round ${step.round}] ${step.tool}`,
			step.args,
			'->',
			step.resultSummary
		);
	}
}

main().catch((err) => {
	console.error(err);
	process.exit(1);
});
