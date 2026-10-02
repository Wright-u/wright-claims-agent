import Fastify from 'fastify';
import { RouteRegistrar } from './routes.js';
import { ApiErrorHandler } from './errors.js';

export class ClaimsServer {
	constructor(
		private readonly routes = new RouteRegistrar(),
		private readonly errors = new ApiErrorHandler()
	) {}

	build() {
		const app = Fastify({ logger: true });
		app.setErrorHandler(this.errors.handle.bind(this.errors));
		app.register(this.routes.register.bind(this.routes));
		return app;
	}
}
