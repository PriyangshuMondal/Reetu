import { corsOrigins, loadConfig } from "./config";
import { createApp } from "./app";

const config = loadConfig();
const app = createApp(config);

app.listen(config.PORT, () => {
  console.log(
    `[server] Reetu listening on http://localhost:${config.PORT} (env=${config.NODE_ENV})`,
  );
  const origins = corsOrigins(config);
  console.log(
    `[server] CORS origins: ${origins.length > 0 ? origins.join(", ") : "same-origin only"}`,
  );
  console.log(
    `[server] Weather sources: Visual Crossing=${config.WEATHER_API_KEY ? "configured" : "missing"}, OpenWeatherMap=${config.OPENWEATHER_API_KEY ? "configured" : "missing"}`,
  );
  if (!config.OPENWEATHER_API_KEY) {
    console.warn(
      "[server] OpenWeatherMap AQI and UV enrichment is disabled. Set OPENWEATHER_API_KEY and restart the server.",
    );
  }
});