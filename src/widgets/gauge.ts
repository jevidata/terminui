import type { Buffer } from '../core/buffer';
import { bufferSetString, bufferSetStyle } from '../core/buffer';
import type { Rect } from '../core/layout';
import type { Style } from '../core/style';
import { Modifier, createStyle, patchStyle } from '../core/style';
import type { LineSet } from '../core/symbols';
import { line } from '../core/symbols';
import type { Span } from '../core/text';
import { spanWidth } from '../core/text';
import type { WidgetRenderer } from '../core/widget';
import type { BlockConfig } from './block';
import { blockInner, renderBlock } from './block';

// Unicode block characters for partial fill (eighths: 7/8 down to 1/8)
const UNICODE_BLOCKS: readonly string[] = ['█', '▉', '▊', '▋', '▌', '▍', '▎', '▏'];

// GaugeConfig

interface GaugeConfig {
	readonly ratio: number;
	readonly label?: Span;
	readonly useUnicode: boolean;
	readonly block?: BlockConfig;
	readonly style: Style;
	readonly gaugeStyle: Style;
}

const clampRatio = (value: number): number => Math.min(1.0, Math.max(0.0, value));

const createGauge = (overrides?: Partial<GaugeConfig>): GaugeConfig => {
	const base: GaugeConfig = {
		ratio: 0,
		useUnicode: false,
		style: createStyle(),
		gaugeStyle: createStyle(),
		...overrides,
	};
	return { ...base, ratio: clampRatio(base.ratio) };
};

const gaugePercent = (
	percent: number,
	overrides?: Partial<Omit<GaugeConfig, 'ratio'>>,
): GaugeConfig => {
	const clamped = Math.min(100, Math.max(0, percent));
	return createGauge({ ...overrides, ratio: clamped / 100 });
};

const renderGaugeLabel = (
	label: Span,
	area: Rect,
	buf: Buffer,
	filledWidth: number,
	gaugeStyle: Style,
	style: Style,
): void => {
	const labelWidth = spanWidth(label);
	if (labelWidth === 0 || area.width === 0 || area.height === 0) {
		return;
	}
	const labelX = area.x + Math.floor((area.width - labelWidth) / 2);
	const labelY = area.y + Math.floor(area.height / 2);
	const filledEnd = area.x + filledWidth;

	for (let i = 0; i < label.content.length; i++) {
		const cx = labelX + i;
		if (cx < area.x || cx >= area.x + area.width) {
			continue;
		}
		const ch = label.content[i];
		if (ch === undefined) {
			continue;
		}
		// Characters in the filled portion use the label style merged with gauge style,
		// characters in the unfilled portion use label style merged with base style
		const baseStyle = cx < filledEnd ? gaugeStyle : style;
		const merged = patchStyle(baseStyle, label.style);
		bufferSetString(buf, cx, labelY, ch, merged);
	}
};

const renderGauge = (config: GaugeConfig): WidgetRenderer => {
	return (area: Rect, buf: Buffer): void => {
		if (area.width === 0 || area.height === 0) {
			return;
		}

		let gaugeArea = area;
		if (config.block !== undefined) {
			renderBlock(config.block)(area, buf);
			gaugeArea = blockInner(config.block, area);
		}

		if (gaugeArea.width === 0 || gaugeArea.height === 0) {
			return;
		}

		bufferSetStyle(buf, gaugeArea, config.style);

		const filledWidth = Math.round(config.ratio * gaugeArea.width);

		if (config.useUnicode) {
			renderGaugeUnicode(config, gaugeArea, buf, filledWidth);
		} else {
			renderGaugeAscii(config, gaugeArea, buf, filledWidth);
		}

		if (config.label !== undefined) {
			renderGaugeLabel(config.label, gaugeArea, buf, filledWidth, config.gaugeStyle, config.style);
		}
	};
};

const renderGaugeUnicode = (
	config: GaugeConfig,
	area: Rect,
	buf: Buffer,
	filledWidth: number,
): void => {
	const fractional = config.ratio * area.width - filledWidth;

	for (let y = area.y; y < area.y + area.height; y++) {
		// Draw full block cells
		for (let x = area.x; x < area.x + filledWidth; x++) {
			bufferSetString(buf, x, y, '█', config.gaugeStyle);
		}
		// Draw partial block for the fractional cell
		if (filledWidth < area.width && fractional > 0) {
			const partialIndex = Math.min(
				UNICODE_BLOCKS.length - 1,
				Math.floor((1 - fractional) * UNICODE_BLOCKS.length),
			);
			const partialChar = UNICODE_BLOCKS[partialIndex] ?? ' ';
			bufferSetString(buf, area.x + filledWidth, y, partialChar, config.gaugeStyle);
		}
	}
};

const renderGaugeAscii = (
	config: GaugeConfig,
	area: Rect,
	buf: Buffer,
	filledWidth: number,
): void => {
	// Non-unicode: use spaces with reversed colors for the filled portion
	const reversedStyle = patchStyle(
		config.gaugeStyle,
		createStyle({ addModifier: Modifier.REVERSED }),
	);

	for (let y = area.y; y < area.y + area.height; y++) {
		for (let x = area.x; x < area.x + filledWidth; x++) {
			bufferSetString(buf, x, y, ' ', reversedStyle);
		}
	}
};

// LineGaugeConfig

interface LineGaugeConfig {
	readonly ratio: number;
	readonly label?: Span;
	readonly lineSet: LineSet;
	readonly block?: BlockConfig;
	readonly style: Style;
	readonly gaugeStyle: Style;
}

const createLineGauge = (overrides?: Partial<LineGaugeConfig>): LineGaugeConfig => {
	const base: LineGaugeConfig = {
		ratio: 0,
		lineSet: line.NORMAL,
		style: createStyle(),
		gaugeStyle: createStyle(),
		...overrides,
	};
	return { ...base, ratio: clampRatio(base.ratio) };
};

const renderLineGauge = (config: LineGaugeConfig): WidgetRenderer => {
	return (area: Rect, buf: Buffer): void => {
		if (area.width === 0 || area.height === 0) {
			return;
		}

		let gaugeArea = area;
		if (config.block !== undefined) {
			renderBlock(config.block)(area, buf);
			gaugeArea = blockInner(config.block, area);
		}

		if (gaugeArea.width === 0 || gaugeArea.height === 0) {
			return;
		}

		bufferSetStyle(buf, gaugeArea, config.style);

		// Reserve space for label if present
		let labelWidth = 0;
		if (config.label !== undefined) {
			labelWidth = Math.min(spanWidth(config.label), gaugeArea.width);
		}

		const lineAreaWidth = gaugeArea.width - labelWidth;
		if (lineAreaWidth <= 0) {
			return;
		}

		const lineAreaX = gaugeArea.x + labelWidth;
		const filledWidth = Math.round(config.ratio * lineAreaWidth);
		const y = gaugeArea.y + Math.floor(gaugeArea.height / 2);

		// Render label at the left of the gauge area
		if (config.label !== undefined) {
			for (let i = 0; i < labelWidth; i++) {
				const ch = config.label.content[i];
				if (ch === undefined) {
					continue;
				}
				bufferSetString(buf, gaugeArea.x + i, y, ch, patchStyle(config.style, config.label.style));
			}
		}

		// Draw filled portion with thick horizontal line
		for (let x = lineAreaX; x < lineAreaX + filledWidth; x++) {
			bufferSetString(buf, x, y, config.lineSet.horizontal, config.gaugeStyle);
		}

		// Draw unfilled portion with thin line (─ for NORMAL/DOUBLE, ─ fallback)
		const thinLine = line.NORMAL.horizontal;
		for (let x = lineAreaX + filledWidth; x < lineAreaX + lineAreaWidth; x++) {
			bufferSetString(buf, x, y, thinLine, config.style);
		}
	};
};

export type { GaugeConfig, LineGaugeConfig };
export { createGauge, gaugePercent, renderGauge, createLineGauge, renderLineGauge };
