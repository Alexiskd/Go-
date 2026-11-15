#!/usr/bin/env node
/**
 * go-hot : point d'entrée du service en production.
 * Render : startCommand « npx go-hot » (ou node packages/hot/dist/bin.js), autoDeployTrigger: off.
 */
import { createLogger } from '@go-/core';
import { loadHotConfig } from './config.js';
import { Supervisor } from './supervisor.js';

const logger = createLogger({ name: 'go-hot', format: process.env.NODE_ENV === 'production' ? 'json' : 'pretty' });
try {
  const config = loadHotConfig();
  const supervisor = new Supervisor(config, logger);
  await supervisor.start({ initialDir: process.cwd() });
  const shutdown = (signal: string) => {
    logger.info(`arrêt (${signal})`);
    void supervisor.stop().then(() => process.exit(0));
    setTimeout(() => process.exit(1), 25_000).unref();
  };
  process.once('SIGTERM', () => shutdown('SIGTERM'));
  process.once('SIGINT', () => shutdown('SIGINT'));
} catch (error) {
  logger.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}
