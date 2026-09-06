import request from "supertest";
import { afterEach, describe, expect, it, vi } from "vitest";
import { weatherResponseSchema } from "@weathergpt/shared";
import { createApp } from "../src/app";
import { testConfig } from "./helpers";

const WEATHER = {
  address: "London",
  resolvedAddress: "London, GB",
  latitude: 51.5,
  longitude: -0.12,
  currentConditions: {
    datetimeEpoch: 1700000000,
    temp: 21,
    feelslike: 20,
    humidity: 61,
    pressure: 1013,
    visibility: 10,
    windspeed: 4.2,
    winddir: 315,
    precip: 0,
    precipprob: 10,
    uvindex: 2,
    conditions: "Clear",
    description: "clear sky",
    icon: "clear-day",
    sunriseEpoch: 1700001268,
    sunsetEpoch: 1700042235,
  },
  days: [{
    datetime: "2023-11-14",
    tempmax: 22,
    tempmin: 16,
    precipprob: 10,
    icon: "clear-day",
    hours: [{ datetime: "12:00:00", temp: 21, precipprob: 10, icon: "clear-day" }],
  }],
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

function stubUpstream() {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) => {
      const href = String(url);
      return jsonResponse(WEATHER);
    }),
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("GET /api/weather", () => {
  it("returns validated weather for a city query", async () => {
    stubUpstream();
    const app = createApp(testConfig());
    const res = await request(app).get("/api/weather?city=London").expect(200);

    expect(weatherResponseSchema.safeParse(res.body).success).toBe(true);
    expect(res.body.current.city).toBe("London");
    expect(res.body.current.country).toBe("GB");
    expect(res.body.hourly.length).toBeGreaterThan(0);
  });

  it("supports coordinate queries", async () => {
    stubUpstream();
    const app = createApp(testConfig());
    const res = await request(app).get("/api/weather?lat=51.5&lon=-0.12").expect(200);
    expect(res.body.location).toEqual({ lat: 51.5, lon: -0.12 });
  });

  it("preserves provider rain probabilities without inventing values", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => jsonResponse({
      ...WEATHER,
      days: [{
        ...WEATHER.days[0],
        hours: [
          { datetime: "18:00:00", temp: 28, precipprob: 0, icon: "clear-day" },
          { datetime: "19:00:00", temp: 27, precipprob: 100, icon: "rain" },
          { datetime: "20:00:00", temp: 26, precipprob: 0, icon: "clear-night" },
        ],
      }],
    })));
    const app = createApp(testConfig());
    const res = await request(app).get("/api/weather?city=London").expect(200);
    expect(res.body.hourly.map((hour: { precipitationProbability: number }) => hour.precipitationProbability))
      .toEqual([0, 100, 0]);
  });

  it("returns 400 when no location is provided", async () => {
    const app = createApp(testConfig());
    const res = await request(app).get("/api/weather").expect(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
  });

  it("returns 400 for out-of-range coordinates", async () => {
    const app = createApp(testConfig());
    const res = await request(app).get("/api/weather?lat=999&lon=0").expect(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
  });

  it("returns 503 WEATHER_NOT_CONFIGURED without a key", async () => {
    const app = createApp(testConfig({ WEATHER_API_KEY: "" }));
    const res = await request(app).get("/api/weather?city=London").expect(503);
    expect(res.body.error.code).toBe("WEATHER_NOT_CONFIGURED");
  });

  it("maps an unknown city to 404", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => jsonResponse({ message: "city not found" }, 404)));
    const app = createApp(testConfig());
    const res = await request(app).get("/api/weather?city=atlantis").expect(404);
    expect(res.body.error.code).toBe("NOT_FOUND");
  });

  it("maps upstream rate-limiting to 429", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => jsonResponse({ message: "slow down" }, 429)));
    const app = createApp(testConfig());
    const res = await request(app).get("/api/weather?city=London").expect(429);
    expect(res.body.error.code).toBe("RATE_LIMITED");
  });

  it("does not leak upstream internals on failures", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => jsonResponse({ message: "opaque upstream detail" }, 500)));
    const app = createApp(testConfig());
    const res = await request(app).get("/api/weather?city=London").expect(502);
    expect(JSON.stringify(res.body)).not.toContain("opaque");
  });
});

describe("GET /api/health", () => {
  it("reports ok", async () => {
    const app = createApp(testConfig());
    const res = await request(app).get("/api/health").expect(200);
    expect(res.body).toEqual({ status: "ok" });
  });
});
