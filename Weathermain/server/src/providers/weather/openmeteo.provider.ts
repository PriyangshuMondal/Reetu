import type { AirQuality } from "@weathergpt/shared";

import {
  AirQualityNotFound,
  WeatherProviderError,
} from "./weather.provider";

interface OpenMeteoAirQualityResponse {
  current?: {
    pm2_5?: number;
    pm10?: number;
    us_aqi?: number;
  };
}

interface OpenMeteoWeatherResponse {
  current?: { uv_index?: number };
}

export class OpenMeteoProvider {
  readonly name = "open-meteo";

  async airQuality(lat: number, lon: number): Promise<AirQuality> {
    const data = await this.request<OpenMeteoAirQualityResponse>(
      "https://air-quality-api.open-meteo.com/v1/air-quality",
      lat,
      lon,
      "current=pm2_5,pm10,us_aqi",
    );
    const pm25 = data.current?.pm2_5;
    const pm10 = data.current?.pm10;
    const usAqi = data.current?.us_aqi;

    if (
      typeof pm25 !== "number" ||
      typeof pm10 !== "number" ||
      typeof usAqi !== "number" ||
      !Number.isFinite(pm25) ||
      !Number.isFinite(pm10) ||
      !Number.isFinite(usAqi)
    ) {
      throw new AirQualityNotFound("Air quality data is not available.");
    }

    return {
      aqi: Math.max(0, Math.min(500, Math.round(usAqi))),
      pollutant: "pm2.5",
      pm25,
      pm10,
    };
  }

  async uvIndex(lat: number, lon: number): Promise<number | null> {
    const data = await this.request<OpenMeteoWeatherResponse>(
      "https://api.open-meteo.com/v1/forecast",
      lat,
      lon,
      "current=uv_index",
    );
    const uv = data.current?.uv_index;
    return typeof uv === "number" && Number.isFinite(uv) ? Math.max(0, uv) : null;
  }

  private async request<T>(baseUrl: string, lat: number, lon: number, query: string): Promise<T> {
    const url = `${baseUrl}?latitude=${lat}&longitude=${lon}&${query}`;
    let response: Response;
    try {
      response = await fetch(url);
    } catch {
      throw new WeatherProviderError("UPSTREAM_REQUEST_FAILED", "The weather enrichment service could not be reached.");
    }
    if (!response.ok) {
      throw new WeatherProviderError("UPSTREAM_REQUEST_FAILED", "The weather enrichment service returned an error.");
    }
    return (await response.json()) as T;
  }

}