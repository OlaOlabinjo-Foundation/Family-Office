import { PORT } from './config.js';
import { app } from './serverApp.js';

app.listen(PORT, () => {
  console.log(`Command centre API listening on http://localhost:${PORT}`);
});
