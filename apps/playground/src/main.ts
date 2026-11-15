import { bootstrap, runApp } from '@go-/runtime';
import { apiModules } from './app.js';
import { apiConfig } from './config.js';

try {
  const { app } = bootstrap({
    name: 'playground',
    config: apiConfig,
    envPrefix: 'API',
    modules: (config, environment, logger) => apiModules(config, environment, (msg) => logger.warn(msg)),
  });
  await runApp(app);
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}
