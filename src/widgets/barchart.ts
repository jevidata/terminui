import type { Buffer } from '../core/buffer';
import { bufferSetLine, bufferSetString, bufferSetStyle } from '../core/buffer';
import type { Rect } from '../core/layout';
import type { Style } from '../core/style';
import { createStyle, patchStyle } from '../core/style';
import { bar } from '../core/symbols';
import type { Line } from '../core/text';
import { lineWidth, rawLine } from '../core/text';
import type { WidgetRenderer } from '../core/widget';
import type { BlockConfig } from './block';
import { blockInner, renderBlock } from './block';

// Bar

interface Bar {
	readonly value: number;
	readonly label?: Line;
	readonly style: Style;
	readonly valueStyle: Style;
	readonly textValue?: string;
}

const createBar = (value: number, overrides?: Partial<Omit<Bar, 'value'>>): Bar => ({
	value,
	style: createStyle(),
	valueStyle: createStyle(),
	...overrides,
});

// BarGroup

interface BarGroup {
	readonly label?: Line;
	readonly bars: readonly Bar[];
}

const createBarGroup = (bars: readonly Bar[], label?: string | Line): BarGroup => {
	if (label === undefined) {
		return { bars };
	}
	const line: Line = typeof label === 'string' ? rawLine(label) : label;
	return { bars, label: line };
};

// Direction

type BarChartDirection = 'vertical' | 'horizontal';

// BarChartConfig

interface BarChartConfig {
	readonly data: readonly BarGroup[];
	readonly block?: BlockConfig;
	readonly barWidth: number;
	readonly barGap: number;
	readonly groupGap: number;
	readonly barStyle: Style;
	readonly valueStyle: Style;
	readonly labelStyle: Style;
	readonly style: Style;
	readonly max?: number;
	readonly direction: BarChartDirection;
}

const createBarChart = (
	data: readonly BarGroup[],
	overrides?: Partial<Omit<BarChartConfig, 'data'>>,
): BarChartConfig => ({
	data,
	barWidth: 1,
	barGap: 1,
	groupGap: 0,
	barStyle: createStyle(),
	valueStyle: createStyle(),
	labelStyle: createStyle(),
	style: createStyle(),
	direction: 'vertical',
	...overrides,
});

// Vertical bar symbols (bottom-up block characters: ▁▂▃▄▅▆▇█)
const VERTICAL_SYMBOLS: readonly string[] = [
	bar.NINE_LEVELS.empty,
	bar.NINE_LEVELS.oneEighth,
	bar.NINE_LEVELS.oneQuarter,
	bar.NINE_LEVELS.threeEighths,
	bar.NINE_LEVELS.half,
	bar.NINE_LEVELS.fiveEighths,
	bar.NINE_LEVELS.threeQuarters,
	bar.NINE_LEVELS.sevenEighths,
	bar.NINE_LEVELS.full,
];

// Horizontal bar symbols (left-to-right block characters: ▏▎▍▌▋▊▉█)
const HORIZONTAL_SYMBOLS: readonly string[] = [
	' ',
	'\u258F',
	'\u258E',
	'\u258D',
	'\u258C',
	'\u258B',
	'\u258A',
	'\u2589',
	'\u2588',
];

const computeMaxValue = (data: readonly BarGroup[], configMax?: number): number => {
	if (configMax !== undefined) {
		return configMax;
	}
	let max = 0;
	for (const group of data) {
		for (const b of group.bars) {
			if (b.value > max) {
				max = b.value;
			}
		}
	}
	return max;
};

const barValueText = (b: Bar): string =>
	b.textValue !== undefined ? b.textValue : b.value.toString();

const renderCenteredString = (
	buf: Buffer,
	x: number,
	y: number,
	width: number,
	text: string,
	style: Style,
): void => {
	if (text.length === 0 || width === 0) {
		return;
	}
	const truncated = text.length > width ? text.slice(0, width) : text;
	const offset = Math.floor((width - truncated.length) / 2);
	bufferSetString(buf, x + offset, y, truncated, style);
};

const renderCenteredLine = (
	buf: Buffer,
	x: number,
	y: number,
	width: number,
	line: Line,
	baseStyle: Style,
): void => {
	const lw = lineWidth(line);
	if (lw === 0 || width === 0) {
		return;
	}
	const renderWidth = Math.min(lw, width);
	const offset = Math.floor((width - renderWidth) / 2);
	bufferSetLine(buf, x + offset, y, line, renderWidth, baseStyle);
};

// Vertical rendering: bars grow upward, labels and values below

const renderVertical = (config: BarChartConfig, chartArea: Rect, buf: Buffer): void => {
	const { data, barWidth, barGap, groupGap } = config;

	let hasBarLabels = false;
	let hasGroupLabels = false;
	for (const group of data) {
		if (group.label !== undefined) {
			hasGroupLabels = true;
		}
		for (const b of group.bars) {
			if (b.label !== undefined) {
				hasBarLabels = true;
			}
		}
	}

	const groupLabelRows = hasGroupLabels ? 1 : 0;
	const barLabelRows = hasBarLabels ? 1 : 0;
	const valueRows = 1;
	const reservedRows = groupLabelRows + barLabelRows + valueRows;

	if (chartArea.height <= reservedRows) {
		return;
	}

	const barAreaHeight = chartArea.height - reservedRows;
	const maxVal = computeMaxValue(data, config.max);

	if (maxVal === 0) {
		return;
	}

	let xCursor = chartArea.x;

	for (let gi = 0; gi < data.length; gi++) {
		const group = data[gi];
		if (group === undefined) {
			continue;
		}

		const groupStartX = xCursor;

		for (let bi = 0; bi < group.bars.length; bi++) {
			const b = group.bars[bi];
			if (b === undefined) {
				continue;
			}

			if (xCursor + barWidth > chartArea.x + chartArea.width) {
				break;
			}

			const scaledHeight = (b.value / maxVal) * (barAreaHeight * 8);
			let remaining = Math.round(scaledHeight);
			const mergedBarStyle = patchStyle(config.barStyle, b.style);

			// Draw bar from bottom up
			for (let row = barAreaHeight - 1; row >= 0; row--) {
				if (remaining <= 0) {
					break;
				}

				const level = Math.min(remaining, 8);
				const symbol = VERTICAL_SYMBOLS[level] ?? ' ';
				const y = chartArea.y + row;

				for (let col = 0; col < barWidth; col++) {
					const x = xCursor + col;
					if (x < chartArea.x + chartArea.width) {
						bufferSetString(buf, x, y, symbol, mergedBarStyle);
					}
				}
				remaining -= 8;
			}

			// Value text row
			const mergedValueStyle = patchStyle(config.valueStyle, b.valueStyle);
			const valueY = chartArea.y + barAreaHeight;
			renderCenteredString(buf, xCursor, valueY, barWidth, barValueText(b), mergedValueStyle);

			// Bar label row
			if (hasBarLabels && b.label !== undefined) {
				const labelY = chartArea.y + barAreaHeight + valueRows;
				renderCenteredLine(buf, xCursor, labelY, barWidth, b.label, config.labelStyle);
			}

			xCursor += barWidth;
			if (bi < group.bars.length - 1) {
				xCursor += barGap;
			}
		}

		// Group label at the bottom row, centered under the group's bars
		if (hasGroupLabels && group.label !== undefined) {
			const groupWidth = xCursor - groupStartX;
			const groupLabelY = chartArea.y + chartArea.height - 1;
			renderCenteredLine(buf, groupStartX, groupLabelY, groupWidth, group.label, config.labelStyle);
		}

		if (gi < data.length - 1) {
			xCursor += groupGap;
		}
	}
};

// Horizontal rendering: bars grow left to right, labels on the left

const renderHorizontal = (config: BarChartConfig, chartArea: Rect, buf: Buffer): void => {
	const { data, barWidth, barGap, groupGap } = config;

	let maxLabelWidth = 0;
	let maxValueWidth = 0;
	for (const group of data) {
		for (const b of group.bars) {
			if (b.label !== undefined) {
				const w = lineWidth(b.label);
				if (w > maxLabelWidth) {
					maxLabelWidth = w;
				}
			}
			const vtLen = barValueText(b).length;
			if (vtLen > maxValueWidth) {
				maxValueWidth = vtLen;
			}
		}
	}

	const labelColWidth = maxLabelWidth > 0 ? maxLabelWidth + 1 : 0;
	const valueColWidth = maxValueWidth > 0 ? maxValueWidth + 1 : 0;
	const barAreaWidth = chartArea.width - labelColWidth - valueColWidth;

	if (barAreaWidth <= 0) {
		return;
	}

	const maxVal = computeMaxValue(data, config.max);
	if (maxVal === 0) {
		return;
	}

	let yCursor = chartArea.y;

	for (let gi = 0; gi < data.length; gi++) {
		const group = data[gi];
		if (group === undefined) {
			continue;
		}

		for (let bi = 0; bi < group.bars.length; bi++) {
			const b = group.bars[bi];
			if (b === undefined) {
				continue;
			}

			for (let row = 0; row < barWidth; row++) {
				const y = yCursor + row;
				if (y >= chartArea.y + chartArea.height) {
					break;
				}

				// Label on the first row, right-aligned in the label column
				if (row === 0 && b.label !== undefined) {
					const lw = lineWidth(b.label);
					const renderW = Math.min(lw, maxLabelWidth);
					const labelX = chartArea.x + maxLabelWidth - renderW;
					bufferSetLine(buf, labelX, y, b.label, renderW, config.labelStyle);
				}

				// Draw horizontal bar
				const scaledWidth = (b.value / maxVal) * (barAreaWidth * 8);
				let remaining = Math.round(scaledWidth);
				const mergedBarStyle = patchStyle(config.barStyle, b.style);
				const barStartX = chartArea.x + labelColWidth;

				for (let col = 0; col < barAreaWidth; col++) {
					if (remaining <= 0) {
						break;
					}
					const level = Math.min(remaining, 8);
					const symbol = HORIZONTAL_SYMBOLS[level] ?? ' ';
					bufferSetString(buf, barStartX + col, y, symbol, mergedBarStyle);
					remaining -= 8;
				}

				// Value text on the first row, after the bar area
				if (row === 0) {
					const valueText = barValueText(b);
					const mergedValueStyle = patchStyle(config.valueStyle, b.valueStyle);
					const valueX = chartArea.x + labelColWidth + barAreaWidth;
					bufferSetString(buf, valueX, y, valueText, mergedValueStyle);
				}
			}

			yCursor += barWidth;
			if (bi < group.bars.length - 1) {
				yCursor += barGap;
			}
		}

		if (gi < data.length - 1) {
			yCursor += groupGap;
		}
	}
};

// Main render function

const renderBarChart = (config: BarChartConfig): WidgetRenderer => {
	return (area: Rect, buf: Buffer): void => {
		if (area.width === 0 || area.height === 0) {
			return;
		}

		let chartArea = area;
		if (config.block !== undefined) {
			renderBlock(config.block)(area, buf);
			chartArea = blockInner(config.block, area);
		}

		if (chartArea.width === 0 || chartArea.height === 0) {
			return;
		}

		bufferSetStyle(buf, chartArea, config.style);

		if (config.data.length === 0) {
			return;
		}

		if (config.direction === 'vertical') {
			renderVertical(config, chartArea, buf);
		} else {
			renderHorizontal(config, chartArea, buf);
		}
	};
};

export type { Bar, BarGroup, BarChartDirection, BarChartConfig };
export { createBar, createBarGroup, createBarChart, renderBarChart };
