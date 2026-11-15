// Weather retrieval using Open-Meteo (free, no API key required).
// Forecasts cover up to 16 days ahead; past dates use the historical archive.
import { getJson } from './net.js';

export const FORECAST_DAYS = 16;

const WMO = {
  0: 'Clear sky',
  1: 'Mainly clear',
  2: 'Partly cloudy',
  3: 'Overcast',
  45: 'Fog',
  48: 'Freezing fog',
  51: 'Light drizzle',
  53: 'Drizzle',
  55: 'Heavy drizzle',
  56: 'Freezing drizzle',
  57: 'Freezing drizzle',
  61: 'Light rain',
  63: 'Rain',
  65: 'Heavy rain',
  66: 'Freezing rain',
  67: 'Freezing rain',
  71: 'Light snow',
  73: 'Snow',
  75: 'Heavy snow',
  77: 'Snow grains',
  80: 'Light showers',
  81: 'Showers',
  82: 'Heavy showers',
  85: 'Snow showers',
  86: 'Heavy snow showers',
  95: 'Thunderstorms',
  96: 'Thunderstorms with hail',
  99: 'Thunderstorms with hail',
};

export const describeCode = (code) => WMO[code] ?? 'Unknown';

// Rough severity used to pick the "headline" condition for the match window.
const severity = (code) => {
  if (code >= 95) return 9;
  if ([65, 82, 67, 75, 86].includes(code)) return 8;
  if ([63, 81, 73, 66, 57, 56].includes(code)) return 7;
  if ([61, 80, 71, 77, 85].includes(code)) return 6;
  if ([51, 53, 55].includes(code)) return 5;
  if ([45, 48].includes(code)) return 4;
  return code; // 0-3
};

export const compass = (deg) => {
  if (deg == null || Number.isNaN(deg)) return '';
  const dirs = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
  return dirs[Math.round(((deg % 360) / 22.5)) % 16];
};

const cleanPart = (s) =>
  s
    .replace(/\b\d{3,5}\b/g, '') // postcodes / street numbers
    .replace(/^\s*\d+[a-z]?\s+/i, '')
    .replace(/\b(NSW|VIC|QLD|SA|WA|TAS|ACT|NT)\b/gi, '')
    .replace(/\s+/g, ' ')
    .trim();

// Build a list of search candidates from a free-text location / address.
export function locationCandidates(text) {
  const raw = (text || '').trim();
  if (!raw) return [];
  const parts = raw.split(',').map(cleanPart).filter(Boolean);
  const out = [raw, ...parts.slice().reverse(), ...parts];
  // Also try the trailing words of the last part (e.g. "Smith St Parramatta" -> "Parramatta")
  const last = parts[parts.length - 1] || '';
  const words = last.split(' ');
  if (words.length > 1) out.push(words.slice(-2).join(' '), words[words.length - 1]);
  return [...new Set(out.map((s) => s.trim()).filter((s) => s.length > 1))];
}

export async function geocode(text) {
  for (const candidate of locationCandidates(text)) {
    const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(candidate)}&count=1&language=en&format=json`;
    const data = await getJson(url);
    if (data?.results?.length) {
      const r = data.results[0];
      return {
        name: r.name,
        admin1: r.admin1 || '',
        country: r.country || '',
        latitude: r.latitude,
        longitude: r.longitude,
        timezone: r.timezone,
        matchedOn: candidate,
      };
    }
  }
  return null;
}

const daysBetween = (isoDate) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const d = new Date(isoDate + 'T00:00:00');
  return Math.round((d - today) / 86400000);
};

// Retrieve weather for a match. Returns a plain object that is stored with the match.
export async function fetchMatchWeather({ location, date, startTime, durationHours }) {
  const fetchedAt = Date.now();
  if (!location?.trim()) return { status: 'missing', message: 'Enter the ground location to retrieve the weather.', fetchedAt };
  if (!date) return { status: 'missing', message: 'Choose the match date to retrieve the weather.', fetchedAt };

  const offset = daysBetween(date);
  if (offset >= FORECAST_DAYS) {
    return {
      status: 'too-far',
      date,
      fetchedAt,
      message: `The match is ${offset} days away. Forecasts are only available up to ${FORECAST_DAYS - 1} days ahead, and are most reliable within about a week. Check again closer to the match.`,
    };
  }

  const place = await geocode(location);
  if (!place) {
    return {
      status: 'not-found',
      fetchedAt,
      message: `Couldn't find "${location}". Try entering the suburb or town name (for example "Parramatta" or "Richmond, Melbourne").`,
    };
  }

  const historical = offset < -60; // older dates come from the archive
  const hourlyVars = historical
    ? 'temperature_2m,precipitation,weather_code,wind_speed_10m,wind_direction_10m,wind_gusts_10m,relative_humidity_2m,dew_point_2m,cloud_cover'
    : 'temperature_2m,precipitation_probability,precipitation,weather_code,wind_speed_10m,wind_direction_10m,wind_gusts_10m,relative_humidity_2m,dew_point_2m,cloud_cover';
  const host = historical ? 'https://archive-api.open-meteo.com/v1/archive' : 'https://api.open-meteo.com/v1/forecast';
  const url = `${host}?latitude=${place.latitude}&longitude=${place.longitude}&hourly=${hourlyVars}&timezone=auto&start_date=${date}&end_date=${date}&wind_speed_unit=kmh`;
  const data = await getJson(url);
  const h = data?.hourly;
  if (!h?.time?.length) {
    return { status: 'unavailable', fetchedAt, location: place, message: 'The weather service returned no data for this date.' };
  }

  const startHour = startTime ? parseInt(startTime.split(':')[0], 10) : 10;
  const hours = Math.max(1, Math.ceil(durationHours || 6));
  const endHour = Math.min(23, startHour + hours);
  const hourly = h.time.map((t, i) => ({
    time: t.slice(11, 16),
    hour: parseInt(t.slice(11, 13), 10),
    temp: h.temperature_2m?.[i],
    prob: h.precipitation_probability?.[i] ?? null,
    precip: h.precipitation?.[i] ?? 0,
    code: h.weather_code?.[i],
    wind: h.wind_speed_10m?.[i],
    gust: h.wind_gusts_10m?.[i],
    dir: h.wind_direction_10m?.[i],
    humidity: h.relative_humidity_2m?.[i],
    dew: h.dew_point_2m?.[i],
    cloud: h.cloud_cover?.[i],
  }));
  const win = hourly.filter((x) => x.hour >= startHour && x.hour <= endHour && x.temp != null);
  if (!win.length) {
    return { status: 'unavailable', fetchedAt, location: place, message: 'No hourly weather was available for the match hours.' };
  }

  const avg = (arr) => (arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : null);
  const nums = (k) => win.map((x) => x[k]).filter((v) => v != null && !Number.isNaN(v));
  const probs = nums('prob');
  const headline = win.reduce((a, b) => (severity(b.code) > severity(a.code) ? b : a), win[0]);
  // Vector-average wind direction
  const sx = win.reduce((a, x) => a + Math.sin(((x.dir || 0) * Math.PI) / 180), 0);
  const cy = win.reduce((a, x) => a + Math.cos(((x.dir || 0) * Math.PI) / 180), 0);
  const dir = ((Math.atan2(sx, cy) * 180) / Math.PI + 360) % 360;
  const late = win.slice(-3);
  const lateSpread = avg(late.map((x) => x.temp - (x.dew ?? x.temp)));

  const summary = {
    tempMin: Math.min(...nums('temp')),
    tempMax: Math.max(...nums('temp')),
    tempAvg: avg(nums('temp')),
    rainProb: probs.length ? Math.max(...probs) : null,
    rainTotal: nums('precip').reduce((a, b) => a + b, 0),
    rainMaxHour: Math.max(0, ...nums('precip')),
    wind: avg(nums('wind')),
    gust: nums('gust').length ? Math.max(...nums('gust')) : null,
    windDir: dir,
    humidity: avg(nums('humidity')),
    cloud: avg(nums('cloud')),
    code: headline.code,
    conditions: describeCode(headline.code),
    dewRisk: lateSpread != null && lateSpread <= 3 && endHour >= 17,
    wetHours: win.filter((x) => x.precip >= 0.2 || (x.prob ?? 0) >= 50).map((x) => x.time),
  };

  return {
    status: 'ok',
    kind: offset < 0 ? 'historical' : 'forecast',
    source: 'Open-Meteo',
    date,
    fetchedAt,
    daysAhead: offset,
    location: place,
    window: { start: `${String(startHour).padStart(2, '0')}:00`, end: `${String(endHour).padStart(2, '0')}:00`, assumedStart: !startTime },
    summary,
    hourly: win,
  };
}

// Classify rain risk for warnings.
export function rainLevel(summary) {
  if (!summary) return null;
  const { rainProb, rainTotal, rainMaxHour, code } = summary;
  const p = rainProb ?? (rainTotal > 0.2 ? 60 : 0);
  if (code >= 95 || rainTotal >= 10 || rainMaxHour >= 4 || (p >= 80 && rainTotal >= 5)) return 'heavy';
  if (p >= 60 || rainTotal >= 2) return 'likely';
  if (p >= 30 || rainTotal >= 0.3) return 'possible';
  return 'clear';
}

export function weatherWarning(summary) {
  const level = rainLevel(summary);
  switch (level) {
    case 'heavy':
      return {
        level,
        tone: 'danger',
        title: 'Heavy rain expected',
        text: 'Significant rain is forecast during match hours. Play may be heavily interrupted, reduced or abandoned. Check with the competition and ground manager before travelling.',
      };
    case 'likely':
      return {
        level,
        tone: 'warning',
        title: 'Rain is likely',
        text: 'Rain is likely during the match. Expect interruptions and possibly reduced playing time. Bring towels and sawdust for the bowlers’ footholds.',
      };
    case 'possible':
      return {
        level,
        tone: 'caution',
        title: 'Rain is possible',
        text: 'Rain is possible during the match. Consider the possibility of interruptions and reduced playing time.',
      };
    case 'clear':
      return { level, tone: 'good', title: 'Conditions look favourable', text: 'Little or no rain is expected during match hours.' };
    default:
      return null;
  }
}
