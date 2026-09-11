import type { AirQuality, GeocodeMatch, WeatherResponse } from "@weathergpt/shared";

import type {
  WeatherProvider,
  WeatherQuery,
} from "./weather.provider";

interface WeatherEnrichmentProvider {
  airQuality(lat: number, lon: number): Promise<AirQuality>;
  uvIndex(lat: number, lon: number): Promise<number | null>;
}

export class CompositeWeatherProvider implements WeatherProvider {
  readonly name = "visualcrossing+openweathermap";

  constructor(
    private readonly weatherProvider: WeatherProvider,
    private readonly enrichmentProvider: WeatherEnrichmentProvider,
    private readonly fallbackEnrichmentProvider?: WeatherEnrichmentProvider,
  ) {}

  async getWeather(query: WeatherQuery): Promise<WeatherResponse> {
    const weather = await this.weatherProvider.getWeather(query);
    try {
      const uvIndex = await this.enrichmentProvider.uvIndex(
        weather.location.lat,
        weather.location.lon,
      );
      if (uvIndex !== null) {
        return {
          ...weather,
          current: { ...weather.current, uvIndex },
        };
      }
    } catch {
      // Visual Crossing's UV value remains the fallback when OpenWeather is unavailable.
    }
    return weather;
  }

  geocode(queryText: string): Promise<GeocodeMatch[]> {
    return this.weatherProvider.geocode(queryText);
  }

  airQuality(lat: number, lon: number): Promise<AirQuality> {
    return this.enrichmentProvider.airQuality(lat, lon).catch((error) => {
      if (!this.fallbackEnrichmentProvider) throw error;
      return this.fallbackEnrichmentProvider.airQuality(lat, lon);
    });
  }
}