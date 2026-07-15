import "dotenv/config";
import { app, PORT } from "./app.js";
import { logger } from "./lib/logger.js";

app.listen(PORT, () => {
  logger.info(`Trevio API running on http://localhost:${PORT}`);
});
