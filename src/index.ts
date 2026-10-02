import { buildApp } from './server/app.js';
import { config } from './config.js';

const app = buildApp();

app.listen({ port: config.PORT, host: '0.0.0.0' })
	.then(() => {
		app.log.info(`wright-claims-agent listening on :${config.PORT}`);
	})
	.catch((err) => {
		app.log.error(err);
		process.exit(1);
	});
