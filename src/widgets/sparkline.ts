import type { Buffer } from '../core/buffer';
import { bufferSetString, bufferSetStyle } from '../core/buffer';
import type { Rect } from '../core/layout';
import type { Style } from '../core/style';
import { createStyle } from '../core/style';
import type { BarSet } from '../core/symbols';
import { bar } from '../core/symbols';
import type { WidgetRenderer } from '../core/widget';
import type { BlockConfig } from './block';
import { blockInner, renderBlock } from './block';

type SparklineDirection = 'leftToRight' | 'rightToLeft';

interface SparklineConfig {
	readonly data: readonly number[];
	readonly max?: number;
	readonly block?: BlockConfig;
	readonly style: Style;
	readonly barSet: BarSet;
	readonly direction: SparklineDirection;
}

const barSymbols = (barSet: BarSet): readonly string[] => [
	barSet.empty,
	barSet.oneEighth,
	barSet.oneQuarter,
	barSet.threeEighths,
	barSet.half,
	barSet.fiveEighths,
	barSet.threeQuarters,
	barSet.sevenEighths,
	barSet.full,
];

const createSparkline = (
	data: readonly number[],
	overrides?: Partial<Omit<SparklineConfig, 'data'>>,
): SparklineConfig => ({
	data,
	style: createStyle(),
	barSet: bar.NINE_LEVELS,
	direction: 'leftToRight',
	...overrides,
});

const renderSparkline = (config: SparklineConfig): WidgetRenderer => {
	return (area: Rect, buf: Buffer): void => {
		if (area.width === 0 || area.height === 0) {
			return;
		}

		let sparkArea = area;
		if (config.block !== undefined) {
			renderBlock(config.block)(area, buf);
			sparkArea = blockInner(config.block, area);
		}

		if (sparkArea.width === 0 || sparkArea.height === 0) {
			return;
		}

		bufferSetStyle(buf, sparkArea, config.style);

		const maxVal =
			config.max !== undefined ? config.max : config.data.reduce((m, v) => Math.max(m, v), 0);

		if (maxVal === 0) {
			return;
		}

		const symbols = barSymbols(config.barSet);
		const dataLen = config.data.length;
		const cols = sparkArea.width;

		for (let col = 0; col < cols; col++) {
			const dataIndex = config.direction === 'rightToLeft' ? dataLen - 1 - col : col;

			if (dataIndex < 0 || dataIndex >= dataLen) {
				continue;
			}

			const value = config.data[dataIndex] ?? 0;
			const scaledHeight = (value / maxVal) * (sparkArea.height * 8);

			let remaining = Math.round(scaledHeight);
			const x = sparkArea.x + col;

			for (let row = sparkArea.height - 1; row >= 0; row--) {
				if (remaining <= 0) {
					break;
				}

				const level = Math.min(remaining, 8);
				const symbol = symbols[level] ?? symbols[0] ?? ' ';
				const y = sparkArea.y + row;
				bufferSetString(buf, x, y, symbol, config.style);
				remaining -= 8;
			}
		}
	};
};

export type { SparklineDirection, SparklineConfig };
export { createSparkline, renderSparkline };
