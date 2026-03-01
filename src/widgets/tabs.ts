import type { Buffer } from '../core/buffer';
import { bufferSetLine, bufferSetString, bufferSetStyle } from '../core/buffer';
import type { Rect } from '../core/layout';
import type { Style } from '../core/style';
import { createStyle, patchStyle } from '../core/style';
import type { Line, Span } from '../core/text';
import { createSpan, lineWidth, rawLine, spanWidth } from '../core/text';
import type { WidgetRenderer } from '../core/widget';
import type { BlockConfig } from './block';
import { blockInner, renderBlock } from './block';

// TabsConfig

interface TabsConfig {
	readonly titles: readonly Line[];
	readonly selected?: number;
	readonly block?: BlockConfig;
	readonly style: Style;
	readonly highlightStyle: Style;
	readonly divider: Span;
	readonly paddingLeft: Span;
	readonly paddingRight: Span;
}

const createTabs = (
	titles: readonly (string | Line)[],
	overrides?: Partial<Omit<TabsConfig, 'titles'>>,
): TabsConfig => ({
	titles: titles.map((t) => (typeof t === 'string' ? rawLine(t) : t)),
	selected: 0,
	style: createStyle(),
	highlightStyle: createStyle(),
	divider: createSpan(' | '),
	paddingLeft: createSpan(' '),
	paddingRight: createSpan(' '),
	...overrides,
});

const renderTabs = (config: TabsConfig): WidgetRenderer => {
	return (area: Rect, buf: Buffer): void => {
		if (area.width === 0 || area.height === 0) {
			return;
		}

		let tabsArea = area;
		if (config.block !== undefined) {
			renderBlock(config.block)(area, buf);
			tabsArea = blockInner(config.block, area);
		}

		if (tabsArea.width === 0 || tabsArea.height === 0) {
			return;
		}

		bufferSetStyle(buf, tabsArea, config.style);

		const xMax = tabsArea.x + tabsArea.width;
		let x = tabsArea.x;

		for (let i = 0; i < config.titles.length; i++) {
			const title = config.titles[i];
			if (title === undefined) {
				continue;
			}
			const isSelected = i === config.selected;
			const tabStyle = isSelected ? patchStyle(config.style, config.highlightStyle) : config.style;

			// Padding left
			const padLeftWidth = spanWidth(config.paddingLeft);
			if (x + padLeftWidth > xMax) {
				break;
			}
			bufferSetString(buf, x, tabsArea.y, config.paddingLeft.content, tabStyle);
			x += padLeftWidth;

			// Title content
			const titleWidth = lineWidth(title);
			const remaining = xMax - x;
			if (remaining <= 0) {
				break;
			}
			const renderWidth = Math.min(titleWidth, remaining);
			bufferSetLine(buf, x, tabsArea.y, title, renderWidth, tabStyle);
			x += renderWidth;

			// Padding right
			const padRightWidth = spanWidth(config.paddingRight);
			if (x + padRightWidth > xMax) {
				break;
			}
			bufferSetString(buf, x, tabsArea.y, config.paddingRight.content, tabStyle);
			x += padRightWidth;

			// Divider between tabs (not after last)
			if (i < config.titles.length - 1) {
				const dividerWidth = spanWidth(config.divider);
				if (x + dividerWidth > xMax) {
					break;
				}
				bufferSetString(buf, x, tabsArea.y, config.divider.content, config.style);
				x += dividerWidth;
			}
		}
	};
};

export type { TabsConfig };
export { createTabs, renderTabs };
