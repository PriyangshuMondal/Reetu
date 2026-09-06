import type {
	AirQuality,
	GeocodeMatch,
	WeatherResponse,
} from "@weathergpt/shared";

import {
	AirQualityNotFound,
	WeatherProviderError,
	type WeatherProvider,
	type WeatherQuery,
} from "./weather.provider";

export interface VisualCrossingConfig {
	apiKey: string;
	baseUrl: string;
}

interface VisualCrossingRecord {
	datetime?: string;
	datetimeEpoch?: number;
	temp?: number;
	feelslike?: number;
	tempmax?: number;
	tempmin?: number;
	humidity?: number;
	pressure?: number;
	visibility?: number;
	windspeed?: number;
	winddir?: number;
	precip?: number;
	precipprob?: number;
	uvindex?: number;
	conditions?: string;
	description?: string;
	icon?: string;
	sunriseEpoch?: number;
	sunsetEpoch?: number;
	hours?: VisualCrossingRecord[];
}

interface VisualCrossingResponse {
	address?: string;
	resolvedAddress?: string;
	latitude?: number;
	longitude?: number;
	currentConditions?: VisualCrossingRecord;
	days?: VisualCrossingRecord[];
	alerts?: Array<{
		event?: string;
		description?: string;
		onsetEpoch?: number;
		endsEpoch?: number;
	}>;
}

export class VisualCrossingProvider implements WeatherProvider {
	readonly name = "visualcrossing";

	constructor(private readonly config: VisualCrossingConfig) {}

	async getWeather(query: WeatherQuery): Promise<WeatherResponse> {
		const data = await this.request(this.location(query));
		const current = data.currentConditions;
		const latitude = data.latitude;
		const longitude = data.longitude;

		if (!current || typeof latitude !== "number" || typeof longitude !== "number") {
			throw new WeatherProviderError(
				"UPSTREAM_REQUEST_FAILED",
				"The weather service returned incomplete weather data.",
			);
		}

		const days = data.days ?? [];
		const hourlyRaw = days
			.flatMap((day) => day.hours ?? [])
			.slice(0, 24)
			.map((hour) => ({
				time: this.clock(hour.datetime),
				icon: hour.icon ?? "unknown",
				temperature: this.number(hour.temp),
				precipitationProbability: this.percent(hour.precipprob),
			}));
		const hourly = hourlyRaw;
		const dailyRaw = days.slice(0, 7).map((day) => ({
			day: day.datetime ?? "Unknown",
			icon: day.icon ?? "unknown",
			high: this.number(day.tempmax ?? day.temp),
			low: this.number(day.tempmin ?? day.temp),
			precipitationProbability: this.percent(day.precipprob),
		}));
		const daily = dailyRaw;

		return {
			location: { lat: latitude, lon: longitude },
			current: {
				city: data.address ?? data.resolvedAddress ?? "Unknown",
				country: this.country(data.resolvedAddress),
				condition: current.conditions ?? "Unknown",
				description: current.description ?? current.conditions ?? "Unknown",
				temperature: this.number(current.temp),
				feelsLike: this.number(current.feelslike ?? current.temp),
				humidity: this.percent(current.humidity),
				windSpeed: this.number(current.windspeed),
				windDirection: this.degree(current.winddir),
				pressure: this.number(current.pressure),
				visibility: this.number(current.visibility),
				precipitation: this.number(current.precip),
				uvIndex: this.number(current.uvindex),
				sunrise: this.clock(current.sunriseEpoch),
				sunset: this.clock(current.sunsetEpoch),
				icon: current.icon ?? "unknown",
			},
			hourly,
			daily,
			alerts: (data.alerts ?? []).map((alert) => ({
				event: alert.event ?? "Weather Alert",
				description: alert.description ?? "",
				source: "Visual Crossing",
				start: alert.onsetEpoch ?? 0,
				end: alert.endsEpoch ?? 0,
				tags: [],
			})),
		};
	}

	async geocode(queryText: string): Promise<GeocodeMatch[]> {
		const data = await this.request(queryText);
		if (typeof data.latitude !== "number" || typeof data.longitude !== "number") {
			throw new WeatherProviderError("NOT_FOUND", "Location not found.");
		}
		const name = data.address ?? data.resolvedAddress ?? queryText;
		return [{ name, lat: data.latitude, lon: data.longitude, country: "", state: "", localName: name, locality: name }];
	}

	async airQuality(_lat: number, _lon: number): Promise<AirQuality | null> {
		throw new AirQualityNotFound("Air quality data is not available from Visual Crossing.");
	}

	private location(query: WeatherQuery): string {
		return "city" in query ? query.city : `${query.lat},${query.lon}`;
	}

	private country(resolvedAddress: string | undefined): string {
		return resolvedAddress?.split(",").at(-1)?.trim() ?? "";
	}

	private async request(location: string): Promise<VisualCrossingResponse> {
		const url = `${this.config.baseUrl.replace(/\/+$/, "")}/timeline/${encodeURIComponent(location)}`;
		const params = new URLSearchParams({ key: this.config.apiKey, unitGroup: "metric", include: "current,days,hours,alerts", contentType: "json" });
		let response: Response;
		try {
			response = await fetch(`${url}?${params}`);
		} catch {
			throw new WeatherProviderError("UPSTREAM_REQUEST_FAILED", "The weather service could not be reached.");
		}
		if (!response.ok) {
			const code = response.status === 404 || response.status === 400
				? "NOT_FOUND"
				: response.status === 401 || response.status === 403
					? "UNAUTHORIZED"
					: response.status === 429
						? "RATE_LIMITED"
						: "UPSTREAM_REQUEST_FAILED";
			throw new WeatherProviderError(code, "The weather service returned an error.");
		}
		return (await response.json()) as VisualCrossingResponse;
	}

	private number(value: number | undefined): number {
		return typeof value === "number" && Number.isFinite(value) ? value : 0;
	}

	private percent(value: number | undefined): number {
		return Math.round(Math.max(0, Math.min(100, this.number(value))) * 10) / 10;
	}

	private degree(value: number | undefined): number {
		return Math.max(0, Math.min(360, Math.round(this.number(value))));
	}

	private clock(value: number | string | undefined): string {
		if (typeof value === "number") return new Date(value * 1000).toISOString().slice(11, 16);
		return typeof value === "string" && value.length >= 5 ? value.slice(0, 5) : "00:00";
	}
}
