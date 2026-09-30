import Fastify from "fastify";
import { registerRoutes } from "./routes.js";
import { errorHandler } from "./errors.js";

export function buildApp() {
  const app = Fastify({ logger: true });
  app.setErrorHandler(errorHandler);
  app.register(registerRoutes);
  return app;
}
