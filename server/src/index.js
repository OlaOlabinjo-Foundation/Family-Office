import { PORT } from './config.js';
import { assertProductionSafeConfig } from './productionGuard.js';
import { app } from './serverApp.js';

assertProductionSafeConfig();

app.listen(PORT, () => {
  console.log(`Command centre API listening on http://localhost:${PORT}`);
});
