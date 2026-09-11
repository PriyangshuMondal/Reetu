import { afterEach, describe, expect, it, vi } from "vitest";
import { OpenWeatherMapProvider } from "../src/providers/weather/openweathermap.provider";
import { CompositeWeatherProvider } from "../src/providers/weather/composite.provider";
import type { WeatherProvider } from "../src/providers/weather/weather.provider";

afterEach(() => {
  vi.unstubAllGlobals();
});

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

const providerConfig = {
  apiKey: "openweather-test-key",
  baseUrl: "https://api.openweathermap.org",
};

describe("OpenWeatherMapProvider", () => {
  it("normalizes air pollution data for the health card", async () => {
    const fetchMock = vi.fn(async () => jsonResponse({
      list: [{ main: { aqi: 3 }, components: { pm2_5: 18.4, pm10: 31.2 } }],
    }));
    vi.stubGlobal("fetch", fetchMock);

    const air = await new OpenWeatherMapProvider(providerConfig).airQuality(29.38, 79.45);

    expect(air).toEqual({ aqi: 64, pollutant: "pm2.5", pm25: 18.4, pm10: 31.2 });
    expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining("/data/2.5/air_pollution"));
    expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining("appid=openweather-test-key"));
  });

  it("reads the UV index from One Call 3.0", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => jsonResponse({ current: { uvi: 8.2 } })));

    await expect(new OpenWeatherMapProvider(providerConfig).uvIndex(29.38, 79.45)).resolves.toBe(8.2);
  });
});

describe("CompositeWeatherProvider", () => {
  it("uses OpenWeatherMap UV for the existing protection guidance", async () => {
    const weatherProvider: WeatherProvider = {
      name: "visualcrossing",
      async getWeather() {
        return {
          location: { lat: 29.38, lon: 79.45 },
          current: {
            city: "Nainital",
            country: "IN",
            condition: "Clear",
            description: "clear sky",
            temperature: 24,
            feelsLike: 24,
            humidity: 50,
            windSpeed: 2,
            windDirection: 180,
            pressure: 1013,
            visibility: 10,
            precipitation: 0,
            uvIndex: 2,
            sunrise: "06:00",
            sunset: "18:00",
            icon: "clear-day",
          },
          hourly: [],
          daily: [],
          alerts: [],
        };
      },
      async geocode() {
        return [];
      },
    };
    vi.stubGlobal("fetch", vi.fn(async () => jsonResponse({ current: { uvi: 9 } })));

    const weather = await new CompositeWeatherProvider(
      weatherProvider,
      new OpenWeatherMapProvider(providerConfig),
    ).getWeather({ lat: 29.38, lon: 79.45 });

    expect(weather.current.uvIndex).toBe(9);
  });
});