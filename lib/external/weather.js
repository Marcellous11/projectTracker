import { config } from "./config.js";
import { safeFetch, makeCached } from "./fetch-util.js";

/**
 * Open-Meteo — current weather + AQI. Two endpoints, both anonymous and
 * keyed on user coords. AQI is optional (some regions lack data).
 */

const WMO_CODE = {
  0: "clear", 1: "clear", 2: "partly cloudy", 3: "overcast",
  45: "fog", 48: "fog",
  51: "drizzle", 53: "drizzle", 55: "drizzle",
  61: "rain", 63: "rain", 65: "heavy rain",
  71: "snow", 73: "snow", 75: "heavy snow",
  80: "showers", 81: "showers", 82: "heavy showers",
  95: "thunderstorm", 96: "thunderstorm", 99: "thunderstorm",
};

function aqiCategory(usAqi) {
  if (usAqi == null) return null;
  if (usAqi <= 50) return "good";
  if (usAqi <= 100) return "moderate";
  if (usAqi <= 150) return "sensitive";
  if (usAqi <= 200) return "unhealthy";
  if (usAqi <= 300) return "very unhealthy";
  return "hazardous";
}

async function fetchWeather() {
  if (!config.signals.wx) return null;
  const { lat, lon } = config.user.coords;
  const wxUrl = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,weather_code,wind_speed_10m&temperature_unit=fahrenheit&timezone=auto`;
  const aqUrl = `https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${lat}&longitude=${lon}&current=us_aqi`;
  const [wxR, aqR] = await Promise.allSettled([
    safeFetch(wxUrl, { timeoutMs: 2000 }),
    safeFetch(aqUrl, { timeoutMs: 2000 }),
  ]);
  const wx = wxR.status === "fulfilled" ? wxR.value : null;
  const aq = aqR.status === "fulfilled" ? aqR.value : null;
  if (!wx?.current) return null;
  const c = wx.current;
  const usAqi = aq?.current?.us_aqi ?? null;
  return {
    tempF: Math.round(Number(c.temperature_2m)),
    code: Number(c.weather_code),
    condition: WMO_CODE[c.weather_code] || "—",
    windMph: Math.round(Number(c.wind_speed_10m)),
    aqi: usAqi == null ? null : Math.round(Number(usAqi)),
    aqiCategory: aqiCategory(usAqi),
  };
}

export const getWeather = makeCached("weather", fetchWeather, 600); // 10 min
