console.log("=== RUNNING ONE.JS ===");
require("dotenv").config();

const API_KEY = process.env.VISUAL_CROSSING_API_KEY;

const latitude = 23.4833;
const longitude = 87.3167;

async function getWeatherForecast() {

    const url =
        `https://weather.visualcrossing.com/VisualCrossingWebServices/rest/services/timeline/` +
        `${latitude},${longitude}` +
        `?unitGroup=metric` +
        `&include=current,days,hours` +
        `&key=${API_KEY}` +
        `&contentType=json`;

    console.log("\nREQUESTING:");
    console.log(url);

    const response = await fetch(url);

    console.log("STATUS:", response.status);
    console.log("FINAL URL:", response.url);

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(
            `Visual Crossing API error ${response.status}: ${errorText}`
        );
    }

    return await response.json();
}



async function main() {
    try {
        const data = await getWeatherForecast();
        console.log(JSON.stringify(data, null, 2));

        console.log("\n==============================");
        console.log("       WEATHER FORECAST");
        console.log("==============================\n");

        console.log(`Location: ${data.resolvedAddress}`);
        console.log(`Timezone: ${data.timezone}`);

        // -------------------------
        // CURRENT WEATHER
        // -------------------------

        const current = data.currentConditions;

        console.log("\n--- CURRENT WEATHER ---");

        console.log(`Temperature: ${current.temp} °C`);
        console.log(`Feels Like: ${current.feelslike} °C`);
        console.log(`Humidity: ${current.humidity}%`);
        console.log(`Conditions: ${current.conditions}`);
        console.log(`Cloud Cover: ${current.cloudcover}%`);
        console.log(`Wind Speed: ${current.windspeed} km/h`);
        console.log(`Wind Direction: ${current.winddir}°`);
        console.log(`Visibility: ${current.visibility} km`);
        console.log(`Pressure: ${current.pressure} hPa`);

        // -------------------------
        // DAILY FORECAST
        // -------------------------

        console.log("\n--- DAILY FORECAST ---");

        for (const day of data.days) {

            console.log(`\nDate: ${day.datetime}`);
            console.log(`Temperature: ${day.temp} °C`);
            console.log(`Minimum: ${day.tempmin} °C`);
            console.log(`Maximum: ${day.tempmax} °C`);
            console.log(`Feels Like: ${day.feelslike} °C`);

            console.log(`Humidity: ${day.humidity}%`);
            console.log(`Conditions: ${day.conditions}`);

            // THIS IS THE IMPORTANT ONE
            console.log(
                `Rain Probability: ${day.precipprob}%`
            );

            console.log(
                `Precipitation: ${day.precip} mm`
            );

            if (day.preciptype) {
                console.log(
                    `Precipitation Type: ${day.preciptype.join(", ")}`
                );
            }

            console.log(`Wind Speed: ${day.windspeed} km/h`);
            console.log(`Cloud Cover: ${day.cloudcover}%`);
            console.log(`Visibility: ${day.visibility} km`);
            console.log(`Pressure: ${day.pressure} hPa`);

            console.log(`Sunrise: ${day.sunrise}`);
            console.log(`Sunset: ${day.sunset}`);
        }

        // -------------------------
        // HOURLY FORECAST
        // -------------------------

        console.log("\n--- HOURLY FORECAST ---");

        for (const day of data.days) {

            console.log(`\n========== ${day.datetime} ==========`);

            for (const hour of day.hours) {

                console.log(
                    `${hour.datetime} | ` +
                    `Temp: ${hour.temp}°C | ` +
                    `Rain Probability: ${hour.precipprob}% | ` +
                    `Rain: ${hour.precip} mm | ` +
                    `${hour.conditions}`
                );
            }
        }

    } catch (error) {
        console.error("\nERROR:");
        console.error(error.message);
    }
}

main();