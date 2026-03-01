// Border symbols for box-drawing

interface BorderSet {
	readonly topLeft: string;
	readonly topRight: string;
	readonly bottomLeft: string;
	readonly bottomRight: string;
	readonly horizontalTop: string;
	readonly horizontalBottom: string;
	readonly verticalLeft: string;
	readonly verticalRight: string;
	readonly cross: string;
}

const border = {
	PLAIN: {
		topLeft: '┌',
		topRight: '┐',
		bottomLeft: '└',
		bottomRight: '┘',
		horizontalTop: '─',
		horizontalBottom: '─',
		verticalLeft: '│',
		verticalRight: '│',
		cross: '┼',
	},
	ROUNDED: {
		topLeft: '╭',
		topRight: '╮',
		bottomLeft: '╰',
		bottomRight: '╯',
		horizontalTop: '─',
		horizontalBottom: '─',
		verticalLeft: '│',
		verticalRight: '│',
		cross: '┼',
	},
	DOUBLE: {
		topLeft: '╔',
		topRight: '╗',
		bottomLeft: '╚',
		bottomRight: '╝',
		horizontalTop: '═',
		horizontalBottom: '═',
		verticalLeft: '║',
		verticalRight: '║',
		cross: '╬',
	},
	THICK: {
		topLeft: '┏',
		topRight: '┓',
		bottomLeft: '┗',
		bottomRight: '┛',
		horizontalTop: '━',
		horizontalBottom: '━',
		verticalLeft: '┃',
		verticalRight: '┃',
		cross: '╋',
	},
	QUADRANT_INSIDE: {
		topLeft: '▗',
		topRight: '▖',
		bottomLeft: '▝',
		bottomRight: '▘',
		horizontalTop: '▀',
		horizontalBottom: '▄',
		verticalLeft: '▐',
		verticalRight: '▌',
		cross: '█',
	},
	QUADRANT_OUTSIDE: {
		topLeft: '▛',
		topRight: '▜',
		bottomLeft: '▙',
		bottomRight: '▟',
		horizontalTop: '▀',
		horizontalBottom: '▄',
		verticalLeft: '▌',
		verticalRight: '▐',
		cross: '█',
	},
	EMPTY: {
		topLeft: '',
		topRight: '',
		bottomLeft: '',
		bottomRight: '',
		horizontalTop: '',
		horizontalBottom: '',
		verticalLeft: '',
		verticalRight: '',
		cross: '',
	},
} as const satisfies Record<string, BorderSet>;

// Bar chart symbols

interface BarSet {
	readonly full: string;
	readonly sevenEighths: string;
	readonly threeQuarters: string;
	readonly fiveEighths: string;
	readonly half: string;
	readonly threeEighths: string;
	readonly oneQuarter: string;
	readonly oneEighth: string;
	readonly empty: string;
}

const bar = {
	NINE_LEVELS: {
		full: '█',
		sevenEighths: '▇',
		threeQuarters: '▆',
		fiveEighths: '▅',
		half: '▄',
		threeEighths: '▃',
		oneQuarter: '▂',
		oneEighth: '▁',
		empty: ' ',
	},
	THREE_LEVELS: {
		full: '█',
		sevenEighths: '░',
		threeQuarters: '░',
		fiveEighths: '░',
		half: '▄',
		threeEighths: '░',
		oneQuarter: '░',
		oneEighth: '░',
		empty: ' ',
	},
	ASCII: {
		full: '#',
		sevenEighths: '#',
		threeQuarters: '#',
		fiveEighths: '#',
		half: '#',
		threeEighths: '-',
		oneQuarter: '-',
		oneEighth: '-',
		empty: ' ',
	},
} as const satisfies Record<string, BarSet>;

// Line symbols

interface LineSet {
	readonly horizontal: string;
	readonly vertical: string;
	readonly cross: string;
}

const line = {
	NORMAL: {
		horizontal: '─',
		vertical: '│',
		cross: '┼',
	},
	THICK: {
		horizontal: '━',
		vertical: '┃',
		cross: '╋',
	},
	DOUBLE: {
		horizontal: '═',
		vertical: '║',
		cross: '╬',
	},
} as const satisfies Record<string, LineSet>;

// Scrollbar symbols

interface ScrollbarSet {
	readonly track: string;
	readonly thumb: string;
	readonly begin: string;
	readonly end: string;
}

const scrollbar = {
	VERTICAL: {
		track: '│',
		thumb: '█',
		begin: '↑',
		end: '↓',
	},
	HORIZONTAL: {
		track: '─',
		thumb: '█',
		begin: '←',
		end: '→',
	},
	DOUBLE_VERTICAL: {
		track: '║',
		thumb: '▐',
		begin: '▲',
		end: '▼',
	},
	DOUBLE_HORIZONTAL: {
		track: '═',
		thumb: '▌',
		begin: '◄',
		end: '►',
	},
} as const satisfies Record<string, ScrollbarSet>;

// Marker type for canvas/chart
type Marker = 'dot' | 'block' | 'bar' | 'braille' | 'halfBlock';

// Block shade symbols
const shade = {
	FULL: '█',
	DARK: '▓',
	MEDIUM: '▒',
	LIGHT: '░',
	EMPTY: ' ',
} as const;

// Braille drawing constants
const BRAILLE_OFFSET = 0x2800;

const BRAILLE_DOTS: readonly (readonly [number, number])[] = [
	[0x01, 0x08],
	[0x02, 0x10],
	[0x04, 0x20],
	[0x40, 0x80],
] as const;

export type { BorderSet, BarSet, LineSet, ScrollbarSet, Marker };
export { border, bar, line, scrollbar, shade, BRAILLE_OFFSET, BRAILLE_DOTS };
