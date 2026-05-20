import { PORT } from './config.js';
import { assertProductionSafeConfig } from './productionGuard.js';
import { app } from './serverApp.js';

assertProductionSafeConfig();

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Command centre API listening on http://0.0.0.0:${PORT}`);
});
