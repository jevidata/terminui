// Color types - discriminated union
type NamedColorType =
	| 'reset'
	| 'black'
	| 'red'
	| 'green'
	| 'yellow'
	| 'blue'
	| 'magenta'
	| 'cyan'
	| 'gray'
	| 'dark-gray'
	| 'light-red'
	| 'light-green'
	| 'light-yellow'
	| 'light-blue'
	| 'light-magenta'
	| 'light-cyan'
	| 'white';

interface NamedColor {
	readonly type: NamedColorType;
}

interface IndexedColor {
	readonly type: 'indexed';
	readonly index: number;
}

interface RgbColor {
	readonly type: 'rgb';
	readonly r: number;
	readonly g: number;
	readonly b: number;
}

type Color = NamedColor | IndexedColor | RgbColor;

const Color = {
	Reset: { type: 'reset' } as const,
	Black: { type: 'black' } as const,
	Red: { type: 'red' } as const,
	Green: { type: 'green' } as const,
	Yellow: { type: 'yellow' } as const,
	Blue: { type: 'blue' } as const,
	Magenta: { type: 'magenta' } as const,
	Cyan: { type: 'cyan' } as const,
	Gray: { type: 'gray' } as const,
	DarkGray: { type: 'dark-gray' } as const,
	LightRed: { type: 'light-red' } as const,
	LightGreen: { type: 'light-green' } as const,
	LightYellow: { type: 'light-yellow' } as const,
	LightBlue: { type: 'light-blue' } as const,
	LightMagenta: { type: 'light-magenta' } as const,
	LightCyan: { type: 'light-cyan' } as const,
	White: { type: 'white' } as const,
} satisfies Record<string, Color>;

const indexedColor = (index: number): Color => {
	if (index < 0 || index > 255) {
		throw new Error(`indexed color must be 0-255, got ${index}`);
	}
	return { type: 'indexed', index };
};

const rgbColor = (r: number, g: number, b: number): Color => {
	if (r < 0 || r > 255 || g < 0 || g > 255 || b < 0 || b > 255) {
		throw new Error(`rgb values must be 0-255, got (${r}, ${g}, ${b})`);
	}
	return { type: 'rgb', r, g, b };
};

// Modifier bitflags
const BOLD = 1;
const DIM = 2;
const ITALIC = 4;
const UNDERLINED = 8;
const SLOW_BLINK = 16;
const RAPID_BLINK = 32;
const REVERSED = 64;
const HIDDEN = 128;
const CROSSED_OUT = 256;
const DOUBLE_UNDERLINED = 512;
const OVERLINED = 1024;

const Modifier = {
	NONE: 0,
	BOLD,
	DIM,
	ITALIC,
	UNDERLINED,
	SLOW_BLINK,
	RAPID_BLINK,
	REVERSED,
	HIDDEN,
	CROSSED_OUT,
	DOUBLE_UNDERLINED,
	OVERLINED,
	ALL:
		BOLD |
		DIM |
		ITALIC |
		UNDERLINED |
		SLOW_BLINK |
		RAPID_BLINK |
		REVERSED |
		HIDDEN |
		CROSSED_OUT |
		DOUBLE_UNDERLINED |
		OVERLINED,
	contains: (flags: number, flag: number): boolean => (flags & flag) === flag,
	add: (flags: number, flag: number): number => flags | flag,
	remove: (flags: number, flag: number): number => flags & ~flag,
	union: (a: number, b: number): number => a | b,
} as const;

// Style
interface Style {
	readonly fg?: Color;
	readonly bg?: Color;
	readonly underlineColor?: Color;
	readonly addModifier: number;
	readonly subModifier: number;
}

const DEFAULT_STYLE: Style = {
	addModifier: 0,
	subModifier: 0,
};

const createStyle = (overrides?: Partial<Style>): Style => {
	if (!overrides) {
		return { ...DEFAULT_STYLE };
	}
	return {
		...DEFAULT_STYLE,
		...overrides,
	};
};

const styleFg = (style: Style, color: Color): Style => ({
	...style,
	fg: color,
});

const styleBg = (style: Style, color: Color): Style => ({
	...style,
	bg: color,
});

const styleAddModifier = (style: Style, modifier: number): Style => ({
	...style,
	addModifier: style.addModifier | modifier,
	subModifier: style.subModifier & ~modifier,
});

const styleSubModifier = (style: Style, modifier: number): Style => ({
	...style,
	addModifier: style.addModifier & ~modifier,
	subModifier: style.subModifier | modifier,
});

const patchStyle = (base: Style, patch: Style): Style => {
	const fg = patch.fg ?? base.fg;
	const bg = patch.bg ?? base.bg;
	const underlineColor = patch.underlineColor ?? base.underlineColor;
	const addModifier = (base.addModifier | patch.addModifier) & ~patch.subModifier;
	const subModifier = (base.subModifier | patch.subModifier) & ~patch.addModifier;

	return {
		...(fg !== undefined ? { fg } : {}),
		...(bg !== undefined ? { bg } : {}),
		...(underlineColor !== undefined ? { underlineColor } : {}),
		addModifier,
		subModifier,
	};
};

const resetStyle = (): Style => ({
	fg: Color.Reset,
	bg: Color.Reset,
	underlineColor: Color.Reset,
	addModifier: 0,
	subModifier: 0,
});

export type { NamedColor, IndexedColor, RgbColor, NamedColorType, Style };
export {
	Color,
	indexedColor,
	rgbColor,
	Modifier,
	createStyle,
	styleFg,
	styleBg,
	styleAddModifier,
	styleSubModifier,
	patchStyle,
	resetStyle,
};
