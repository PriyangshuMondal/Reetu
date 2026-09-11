import type { AirQuality } from "@weathergpt/shared";

import {
  AirQualityNotFound,
  WeatherProviderError,
} from "./weather.provider";

export interface OpenWeatherMapConfig {
  apiKey: string;
  baseUrl: string;
}

interface AirPollutionResponse {
  list?: Array<{
    main?: { aqi?: number };
    components?: { pm2_5?: number; pm10?: number };
  }>;
}

interface OneCallResponse {
  current?: { uvi?: number };
}

export class OpenWeatherMapProvider {
  readonly name = "openweathermap";

  constructor(private readonly config: OpenWeatherMapConfig) {}

  async airQuality(lat: number, lon: number): Promise<AirQuality> {
    const data = await this.request<AirPollutionResponse>(
      "/data/2.5/air_pollution",
      lat,
      lon,
    );
    const reading = data.list?.[0];
    const pm25 = reading?.components?.pm2_5;
    const pm10 = reading?.components?.pm10;

    if (
      typeof pm25 !== "number" ||
      typeof pm10 !== "number"
    ) {
      throw new AirQualityNotFound("Air quality data is not available from OpenWeatherMap.");
    }

    return {
      aqi: this.usAqiFromPm25(pm25),
      pollutant: "pm2.5",
      pm25: this.number(pm25),
      pm10: this.number(pm10),
    };
  }

  async uvIndex(lat: number, lon: number): Promise<number | null> {
    const data = await this.request<OneCallResponse>(
      "/data/3.0/onecall",
      lat,
      lon,
      new URLSearchParams({ exclude: "minutely,hourly,daily,alerts", units: "metric" }),
    );
    return typeof data.current?.uvi === "number" && Number.isFinite(data.current.uvi)
      ? Math.max(0, data.current.uvi)
      : null;
  }

  private async request<T>(
    path: string,
    lat: number,
    lon: number,
    extraParams = new URLSearchParams(),
  ): Promise<T> {
    const params = new URLSearchParams(extraParams);
    params.set("lat", String(lat));
    params.set("lon", String(lon));
    params.set("appid", this.config.apiKey);
    const url = `${this.config.baseUrl.replace(/\/+$/, "")}${path}?${params}`;

    let response: Response;
    try {
      response = await fetch(url);
    } catch {
      throw new WeatherProviderError("UPSTREAM_REQUEST_FAILED", "The air-quality service could not be reached.");
    }

    if (!response.ok) {
      const code = response.status === 401 || response.status === 403
        ? "UNAUTHORIZED"
        : response.status === 429
          ? "RATE_LIMITED"
          : "UPSTREAM_REQUEST_FAILED";
      throw new WeatherProviderError(code, "The air-quality service returned an error.");
    }

    return (await response.json()) as T;
  }

  private number(value: number): number {
    return Number.isFinite(value) ? value : 0;
  }

  private usAqiFromPm25(pm25: number): number {
    const concentration = Math.max(0, Math.min(500.4, Math.floor(pm25 * 10) / 10));
    const breakpoints = [
      [0, 12, 0, 50],
      [12.1, 35.4, 51, 100],
      [35.5, 55.4, 101, 150],
      [55.5, 150.4, 151, 200],
      [150.5, 250.4, 201, 300],
      [250.5, 350.4, 301, 400],
      [350.5, 500.4, 401, 500],
    ] as const;
    const range = [...breakpoints].reverse().find(([low]) => concentration >= low) ?? breakpoints[0];
    const [lowConcentration, highConcentration, lowAqi, highAqi] = range;
    return Math.round(
      ((highAqi - lowAqi) / (highConcentration - lowConcentration)) *
        (concentration - lowConcentration) +
        lowAqi,
    );
  }
}