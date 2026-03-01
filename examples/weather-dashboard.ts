/**
 * Weather Dashboard CLI
 *
 * Renders a weather dashboard using terminui widgets.
 * Data source: Open-Meteo (no API key required).
 *
 * Run:
 *   npx tsx examples/weather-dashboard.ts --city "New York"
 *   npx tsx examples/weather-dashboard.ts London --units fahrenheit
 */
import {
	Color,
	Modifier,
	blockBordered,
	createLayout,
	createParagraph,
	createRow,
	createSparkline,
	createStyle,
	createTable,
	createTabs,
	createTerminal,
	createTestBackend,
	createTestBackendState,
	createTitle,
	fillConstraint,
	frameRenderWidget,
	gaugePercent,
	lengthConstraint,
	renderGauge,
	renderParagraph,
	renderSparkline,
	renderTable,
	renderTabs,
	splitLayout,
	styleAddModifier,
	styleFg,
	terminalDraw,
	testBackendToString,
} from '../src/index';
import type { Frame } from '../src/index';

type TemperatureUnit = 'celsius' | 'fahrenheit';

interface CliOptions {
	city: string;
	units: TemperatureUnit;
	width: number;
	height: number;
}

interface GeocodeResult {
	name: string;
	latitude: number;
	longitude: number;
	country?: string;
	admin1?: string;
	timezone?: string;
}

interface GeocodeResponse {
	results?: GeocodeResult[];
}

interface WeatherResponse {
	timezone: string;
	current: {
		time: string;
		temperature_2m: number;
		apparent_temperature: number;
		relative_humidity_2m: number;
		precipitation: number;
		weather_code: number;
		wind_speed_10m: number;
		wind_direction_10m: number;
	};
	hourly: {
		time: string[];
		temperature_2m: number[];
		precipitation_probability: number[];
		wind_speed_10m: number[];
		relative_humidity_2m: number[];
	};
	daily: {
		time: string[];
		weather_code: number[];
		temperature_2m_max: number[];
		temperature_2m_min: number[];
		precipitation_probability_max: number[];
	};
}

interface HourlyPoint {
	time: string;
	temperature: number;
	rainChance: number;
	windSpeed: number;
}

interface DailyPoint {
	date: string;
	max: number;
	min: number;
	rainChance: number;
	weatherCode: number;
}

interface DashboardData {
	locationLabel: string;
	timezone: string;
	temperatureUnit: 'C' | 'F';
	windUnit: 'km/h' | 'mph';
	precipUnit: 'mm' | 'in';
	current: {
		time: string;
		temperature: number;
		feelsLike: number;
		humidity: number;
		precipitation: number;
		weatherCode: number;
		windSpeed: number;
		windDirection: number;
	};
	nextHours: HourlyPoint[];
	nextDays: DailyPoint[];
	sparklineSeries: number[];
}

const DEFAULT_CITY = 'New York';
const DEFAULT_WIDTH = Math.max(80, process.stdout.columns ?? 100);
const DEFAULT_HEIGHT = Math.max(28, process.stdout.rows ?? 30);

const clamp = (value: number, min: number, max: number): number =>
	Math.max(min, Math.min(max, value));

const parseNumber = (value: string, flag: string): number => {
	const parsed = Number.parseInt(value, 10);
	if (!Number.isFinite(parsed)) {
		throw new Error(`Invalid value for ${flag}: ${value}`);
	}
	return parsed;
};

const readNextArg = (args: string[], index: number, flag: string): string => {
	const value = args[index + 1];
	if (value === undefined || value.startsWith('-')) {
		throw new Error(`Missing value for ${flag}`);
	}
	return value;
};

const parseCliOptions = (args: string[]): CliOptions => {
	let cityFromFlag: string | undefined;
	const positional: string[] = [];
	let units: TemperatureUnit = 'celsius';
	let width = DEFAULT_WIDTH;
	let height = DEFAULT_HEIGHT;

	for (let i = 0; i < args.length; i++) {
		const arg = args[i];
		if (arg === undefined) {
			continue;
		}

		if (arg === '--city' || arg === '-c') {
			cityFromFlag = readNextArg(args, i, arg);
			i++;
			continue;
		}

		if (arg === '--units' || arg === '-u') {
			const value = readNextArg(args, i, arg).toLowerCase();
			if (value === 'c' || value === 'celsius') {
				units = 'celsius';
			} else if (value === 'f' || value === 'fahrenheit') {
				units = 'fahrenheit';
			} else {
				throw new Error(`Invalid units: ${value} (use celsius|fahrenheit)`);
			}
			i++;
			continue;
		}

		if (arg === '--width' || arg === '-w') {
			width = parseNumber(readNextArg(args, i, arg), arg);
			i++;
			continue;
		}

		if (arg === '--height' || arg === '-hgt') {
			height = parseNumber(readNextArg(args, i, arg), arg);
			i++;
			continue;
		}

		if (arg === '--help' || arg === '-h') {
			printHelp();
			process.exit(0);
		}

		if (arg.startsWith('-')) {
			throw new Error(`Unknown flag: ${arg}`);
		}

		positional.push(arg);
	}

	const city = cityFromFlag ?? (positional.length > 0 ? positional.join(' ') : DEFAULT_CITY);

	return {
		city,
		units,
		width: clamp(width, 80, 220),
		height: clamp(height, 24, 70),
	};
};

const printHelp = (): void => {
	console.log(`Weather Dashboard CLI (terminui example)

Usage:
  npx tsx examples/weather-dashboard.ts [city] [options]

Options:
  -c, --city <name>            City name (default: ${DEFAULT_CITY})
  -u, --units <celsius|fahrenheit>
                               Temperature units (default: celsius)
  -w, --width <columns>        Dashboard width (default: terminal width)
  -hgt, --height <rows>        Dashboard height (default: terminal height)
  -h, --help                   Show this help

Examples:
  npx tsx examples/weather-dashboard.ts "San Francisco"
  npx tsx examples/weather-dashboard.ts London --units fahrenheit --width 110 --height 34
`);
};

const weatherLabel = (code: number): string => {
	switch (code) {
		case 0:
			return 'Clear';
		case 1:
			return 'Mainly clear';
		case 2:
			return 'Partly cloudy';
		case 3:
			return 'Overcast';
		case 45:
		case 48:
			return 'Fog';
		case 51:
		case 53:
		case 55:
			return 'Drizzle';
		case 56:
		case 57:
			return 'Freezing drizzle';
		case 61:
		case 63:
		case 65:
			return 'Rain';
		case 66:
		case 67:
			return 'Freezing rain';
		case 71:
		case 73:
		case 75:
			return 'Snow';
		case 77:
			return 'Snow grains';
		case 80:
		case 81:
		case 82:
			return 'Rain showers';
		case 85:
		case 86:
			return 'Snow showers';
		case 95:
			return 'Thunderstorm';
		case 96:
		case 99:
			return 'Thunderstorm + hail';
		default:
			return `Code ${code}`;
	}
};

const formatHour = (isoTime: string): string => {
	const hourText = isoTime.slice(11, 13);
	const hour24 = Number.parseInt(hourText, 10);
	if (!Number.isFinite(hour24)) {
		return isoTime;
	}
	const period = hour24 >= 12 ? 'PM' : 'AM';
	const hour12 = hour24 % 12 === 0 ? 12 : hour24 % 12;
	return `${hour12}${period}`;
};

const formatDay = (isoDate: string): string => {
	const date = new Date(`${isoDate}T00:00:00Z`);
	return date.toLocaleDateString('en-US', { weekday: 'short', timeZone: 'UTC' });
};

const fetchJson = async <T>(url: string): Promise<T> => {
	const response = await fetch(url);
	if (!response.ok) {
		throw new Error(`Request failed (${response.status}) for ${url}`);
	}
	return (await response.json()) as T;
};

const findLocation = async (city: string): Promise<GeocodeResult> => {
	const params = new URLSearchParams({
		name: city,
		count: '1',
		language: 'en',
		format: 'json',
	});
	const url = `https://geocoding-api.open-meteo.com/v1/search?${params.toString()}`;
	const data = await fetchJson<GeocodeResponse>(url);

	const first = data.results?.[0];
	if (first === undefined) {
		throw new Error(`No location found for "${city}"`);
	}
	return first;
};

const fetchWeather = async (
	location: GeocodeResult,
	units: TemperatureUnit,
): Promise<WeatherResponse> => {
	const temperatureUnit = units === 'fahrenheit' ? 'fahrenheit' : 'celsius';
	const windSpeedUnit = units === 'fahrenheit' ? 'mph' : 'kmh';
	const precipitationUnit = units === 'fahrenheit' ? 'inch' : 'mm';

	const params = new URLSearchParams({
		latitude: String(location.latitude),
		longitude: String(location.longitude),
		timezone: 'auto',
		temperature_unit: temperatureUnit,
		wind_speed_unit: windSpeedUnit,
		precipitation_unit: precipitationUnit,
		forecast_days: '7',
		current: [
			'temperature_2m',
			'apparent_temperature',
			'relative_humidity_2m',
			'precipitation',
			'weather_code',
			'wind_speed_10m',
			'wind_direction_10m',
		].join(','),
		hourly: [
			'temperature_2m',
			'precipitation_probability',
			'wind_speed_10m',
			'relative_humidity_2m',
		].join(','),
		daily: [
			'weather_code',
			'temperature_2m_max',
			'temperature_2m_min',
			'precipitation_probability_max',
		].join(','),
	});

	const url = `https://api.open-meteo.com/v1/forecast?${params.toString()}`;
	return fetchJson<WeatherResponse>(url);
};

const sliceHourlyPoints = (weather: WeatherResponse): HourlyPoint[] => {
	const currentIndex = weather.hourly.time.indexOf(weather.current.time);
	const start = currentIndex >= 0 ? currentIndex : 0;
	const points: HourlyPoint[] = [];

	for (let i = start; i < start + 24 && i < weather.hourly.time.length; i++) {
		points.push({
			time: weather.hourly.time[i] ?? '',
			temperature: weather.hourly.temperature_2m[i] ?? 0,
			rainChance: weather.hourly.precipitation_probability[i] ?? 0,
			windSpeed: weather.hourly.wind_speed_10m[i] ?? 0,
		});
	}

	return points;
};

const sliceDailyPoints = (weather: WeatherResponse): DailyPoint[] => {
	const points: DailyPoint[] = [];

	for (let i = 0; i < 5 && i < weather.daily.time.length; i++) {
		points.push({
			date: weather.daily.time[i] ?? '',
			max: weather.daily.temperature_2m_max[i] ?? 0,
			min: weather.daily.temperature_2m_min[i] ?? 0,
			rainChance: weather.daily.precipitation_probability_max[i] ?? 0,
			weatherCode: weather.daily.weather_code[i] ?? 0,
		});
	}

	return points;
};

const buildDashboardData = (
	location: GeocodeResult,
	weather: WeatherResponse,
	units: TemperatureUnit,
): DashboardData => {
	const nextHours = sliceHourlyPoints(weather);
	const nextDays = sliceDailyPoints(weather);

	const rawSeries = nextHours.slice(0, 24).map((hour) => hour.temperature);
	const sparklineSeries = (() => {
		if (rawSeries.length === 0) {
			return [1];
		}
		const minValue = rawSeries.reduce((min, value) => Math.min(min, value), rawSeries[0] ?? 0);
		return rawSeries.map((value) => value - minValue + 1);
	})();

	const locationParts = [location.name, location.admin1, location.country].filter(
		(part): part is string => part !== undefined && part.length > 0,
	);

	return {
		locationLabel: locationParts.join(', '),
		timezone: weather.timezone,
		temperatureUnit: units === 'fahrenheit' ? 'F' : 'C',
		windUnit: units === 'fahrenheit' ? 'mph' : 'km/h',
		precipUnit: units === 'fahrenheit' ? 'in' : 'mm',
		current: {
			time: weather.current.time,
			temperature: weather.current.temperature_2m,
			feelsLike: weather.current.apparent_temperature,
			humidity: weather.current.relative_humidity_2m,
			precipitation: weather.current.precipitation,
			weatherCode: weather.current.weather_code,
			windSpeed: weather.current.wind_speed_10m,
			windDirection: weather.current.wind_direction_10m,
		},
		nextHours,
		nextDays,
		sparklineSeries,
	};
};

const renderWeatherDashboard = (frame: Frame, data: DashboardData): void => {
	const rootLayout = createLayout([lengthConstraint(3), fillConstraint(1), lengthConstraint(5)]);
	const [headerArea = frame.area, bodyArea = frame.area, footerArea = frame.area] = splitLayout(
		rootLayout,
		frame.area,
	);

	const tabs = createTabs(['Current', 'Hourly', '5-Day'], {
		selected: 0,
		block: blockBordered({
			titles: [createTitle('Weather Dashboard', { alignment: 'center' })],
		}),
		highlightStyle: styleAddModifier(styleFg(createStyle(), Color.LightCyan), Modifier.BOLD),
	});
	frameRenderWidget(frame, renderTabs(tabs), headerArea);

	const bodyLayout = createLayout([lengthConstraint(38), fillConstraint(1)], {
		direction: 'horizontal',
	});
	const [leftArea = bodyArea, rightArea = bodyArea] = splitLayout(bodyLayout, bodyArea);

	const leftLayout = createLayout([
		fillConstraint(1),
		lengthConstraint(3),
		lengthConstraint(3),
		lengthConstraint(3),
	]);
	const [
		summaryArea = leftArea,
		humidityArea = leftArea,
		rainArea = leftArea,
		windArea = leftArea,
	] = splitLayout(leftLayout, leftArea);

	const currentSummary = [
		data.locationLabel,
		weatherLabel(data.current.weatherCode),
		`Now: ${data.current.temperature.toFixed(1)} ${data.temperatureUnit}`,
		`Feels: ${data.current.feelsLike.toFixed(1)} ${data.temperatureUnit}`,
		`Precip: ${data.current.precipitation.toFixed(2)} ${data.precipUnit}`,
		`Wind: ${data.current.windSpeed.toFixed(1)} ${data.windUnit}`,
		`Direction: ${Math.round(data.current.windDirection)} deg`,
		`Time: ${data.current.time}`,
	].join('\n');

	const summary = createParagraph(currentSummary, {
		block: blockBordered({ titles: [createTitle('Current Conditions')] }),
		wrap: { trim: true },
	});
	frameRenderWidget(frame, renderParagraph(summary), summaryArea);

	const next12Hours = data.nextHours.slice(0, 12);
	const maxRainChance = next12Hours.reduce((max, point) => Math.max(max, point.rainChance), 0);

	const humidityGauge = gaugePercent(clamp(data.current.humidity, 0, 100), {
		block: blockBordered({ titles: [createTitle('Humidity')] }),
		useUnicode: true,
		gaugeStyle: styleFg(createStyle(), Color.Cyan),
	});
	frameRenderWidget(frame, renderGauge(humidityGauge), humidityArea);

	const rainGauge = gaugePercent(clamp(maxRainChance, 0, 100), {
		block: blockBordered({ titles: [createTitle('Rain Chance (12h max)')] }),
		useUnicode: true,
		gaugeStyle: styleFg(createStyle(), Color.Blue),
	});
	frameRenderWidget(frame, renderGauge(rainGauge), rainArea);

	const windScale = data.windUnit === 'mph' ? 60 : 100;
	const windRatio = clamp((data.current.windSpeed / windScale) * 100, 0, 100);
	const windGauge = gaugePercent(windRatio, {
		block: blockBordered({ titles: [createTitle(`Wind (scale ${windScale} ${data.windUnit})`)] }),
		useUnicode: true,
		gaugeStyle: styleFg(createStyle(), Color.LightYellow),
	});
	frameRenderWidget(frame, renderGauge(windGauge), windArea);

	const rightLayout = createLayout([fillConstraint(1), lengthConstraint(7)]);
	const [hourlyArea = rightArea, sparklineArea = rightArea] = splitLayout(rightLayout, rightArea);

	const hourlyRows = data.nextHours
		.slice(0, 8)
		.map((hour) =>
			createRow([
				formatHour(hour.time),
				`${hour.temperature.toFixed(1)} ${data.temperatureUnit}`,
				`${Math.round(hour.rainChance)}%`,
				`${Math.round(hour.windSpeed)} ${data.windUnit}`,
			]),
		);

	const hourlyTable = createTable(
		hourlyRows,
		[lengthConstraint(6), lengthConstraint(10), lengthConstraint(6), lengthConstraint(12)],
		{
			header: createRow(['Time', 'Temp', 'Rain', 'Wind'], {
				style: styleAddModifier(createStyle(), Modifier.BOLD),
			}),
			block: blockBordered({ titles: [createTitle('Next 8 Hours')] }),
		},
	);
	frameRenderWidget(frame, renderTable(hourlyTable), hourlyArea);

	const sparkline = createSparkline(data.sparklineSeries, {
		block: blockBordered({ titles: [createTitle('24h Temperature Trend')] }),
		style: styleFg(createStyle(), Color.LightMagenta),
	});
	frameRenderWidget(frame, renderSparkline(sparkline), sparklineArea);

	const daySummary = data.nextDays
		.map(
			(day) =>
				`${formatDay(day.date)} ${day.max.toFixed(0)}/${day.min.toFixed(0)} ${data.temperatureUnit} ${Math.round(day.rainChance)}% ${weatherLabel(day.weatherCode)}`,
		)
		.join(' | ');

	const footer = createParagraph(`Timezone: ${data.timezone}\n${daySummary}`, {
		block: blockBordered({ titles: [createTitle('Forecast')] }),
		wrap: { trim: true },
	});
	frameRenderWidget(frame, renderParagraph(footer), footerArea);
};

const main = async (): Promise<void> => {
	let options: CliOptions;
	try {
		options = parseCliOptions(process.argv.slice(2));
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		console.error(`Error: ${message}`);
		console.error('');
		printHelp();
		process.exit(1);
		return;
	}

	try {
		const location = await findLocation(options.city);
		const weather = await fetchWeather(location, options.units);
		const data = buildDashboardData(location, weather, options.units);

		const state = createTestBackendState(options.width, options.height);
		const backend = createTestBackend(state);
		const terminal = createTerminal(backend);

		terminalDraw(terminal, (frame) => {
			renderWeatherDashboard(frame, data);
		});

		console.log(testBackendToString(state));
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		console.error(`Failed to render weather dashboard: ${message}`);
		process.exit(1);
	}
};

void main();
