import type { Buffer } from '../core/buffer';
import { bufferSetString, bufferSetStyle } from '../core/buffer';
import type { Rect } from '../core/layout';
import type { Style } from '../core/style';
import { createStyle, patchStyle } from '../core/style';
import type { Text } from '../core/text';
import { rawText, stringWidth } from '../core/text';
import type { StatefulWidgetRenderer, WidgetRenderer } from '../core/widget';
import type { BlockConfig } from './block';
import { blockInner, renderBlock } from './block';

// ListItem

interface ListItem {
	readonly content: Text;
	readonly style: Style;
}

const createListItem = (content: string | Text, style?: Style): ListItem => ({
	content: typeof content === 'string' ? rawText(content) : content,
	style: style ?? createStyle(),
});

// ListDirection

type ListDirection = 'topToBottom' | 'bottomToTop';

// HighlightSpacing

type HighlightSpacing = 'always' | 'whenSelected' | 'never';

// ListConfig

interface ListConfig {
	readonly items: readonly ListItem[];
	readonly block?: BlockConfig;
	readonly style: Style;
	readonly highlightStyle: Style;
	readonly highlightSymbol?: string;
	readonly repeatHighlightSymbol: boolean;
	readonly direction: ListDirection;
	readonly highlightSpacing: HighlightSpacing;
}

// ListState

interface ListState {
	offset: number;
	selected?: number;
}

const createListState = (selected?: number): ListState => ({
	offset: 0,
	selected,
});

// createList

const createList = (
	items: readonly (string | ListItem)[],
	overrides?: Partial<Omit<ListConfig, 'items'>>,
): ListConfig => ({
	items: items.map((item) => (typeof item === 'string' ? createListItem(item) : item)),
	style: createStyle(),
	highlightStyle: createStyle(),
	repeatHighlightSymbol: false,
	direction: 'topToBottom',
	highlightSpacing: 'whenSelected',
	...overrides,
});

// Rendering helpers

const shouldShowSpacing = (
	spacing: HighlightSpacing,
	hasSelected: boolean,
): boolean => {
	if (spacing === 'always') return true;
	if (spacing === 'never') return false;
	return hasSelected;
};

const renderListInner = (
	config: ListConfig,
	area: Rect,
	buf: Buffer,
	state?: ListState,
): void => {
	if (area.width === 0 || area.height === 0) return;

	let contentArea = area;
	if (config.block !== undefined) {
		renderBlock(config.block)(area, buf);
		contentArea = blockInner(config.block, area);
	}

	if (contentArea.width === 0 || contentArea.height === 0) return;

	bufferSetStyle(buf, contentArea, config.style);

	const selected = state?.selected;
	const hasSelected = selected !== undefined;
	const highlightSymbolWidth = config.highlightSymbol !== undefined
		? stringWidth(config.highlightSymbol)
		: 0;
	const showSpacing = shouldShowSpacing(config.highlightSpacing, hasSelected);
	const spacingWidth = showSpacing ? highlightSymbolWidth : 0;

	// Adjust offset to keep selected item visible
	if (state !== undefined && selected !== undefined) {
		if (selected < state.offset) {
			state.offset = selected;
		}
		if (selected >= state.offset + contentArea.height) {
			state.offset = selected - contentArea.height + 1;
		}
	}

	const offset = state?.offset ?? 0;

	// Collect visible items with their line counts
	const visibleItems: {
		readonly index: number;
		readonly item: ListItem;
	}[] = [];

	if (config.direction === 'topToBottom') {
		for (let i = offset; i < config.items.length; i++) {
			visibleItems.push({ index: i, item: config.items[i]! });
		}
	} else {
		for (let i = Math.min(config.items.length - 1, offset + contentArea.height - 1); i >= 0; i--) {
			visibleItems.push({ index: i, item: config.items[i]! });
		}
	}

	// Render visible items
	let y = contentArea.y;

	for (const { index, item } of visibleItems) {
		if (y >= contentArea.y + contentArea.height) break;

		const isSelected = hasSelected && selected === index;
		const itemStyle = isSelected ? patchStyle(item.style, config.highlightStyle) : item.style;
		const lines = item.content.lines;

		for (let lineIdx = 0; lineIdx < lines.length; lineIdx++) {
			if (y >= contentArea.y + contentArea.height) break;

			const line = lines[lineIdx]!;

			// Apply item style to the full row
			bufferSetStyle(buf, {
				x: contentArea.x,
				y,
				width: contentArea.width,
				height: 1,
			}, itemStyle);

			let x = contentArea.x;

			// Render highlight symbol or spacing
			if (showSpacing) {
				if (isSelected && config.highlightSymbol !== undefined) {
					if (lineIdx === 0 || config.repeatHighlightSymbol) {
						bufferSetString(buf, x, y, config.highlightSymbol, itemStyle);
					}
				}
				x += spacingWidth;
			}

			// Render line spans
			for (const span of line.spans) {
				const merged = patchStyle(itemStyle, span.style);
				for (const ch of span.content) {
					if (x >= contentArea.x + contentArea.width) break;
					bufferSetString(buf, x, y, ch, merged);
					x += stringWidth(ch);
				}
			}

			y += 1;
		}
	}
};

// renderList

const renderList = (config: ListConfig): WidgetRenderer =>
	(area: Rect, buf: Buffer): void => {
		renderListInner(config, area, buf);
	};

// renderStatefulList

const renderStatefulList = (config: ListConfig): StatefulWidgetRenderer<ListState> =>
	(area: Rect, buf: Buffer, state: ListState): void => {
		renderListInner(config, area, buf, state);
	};

export type { ListItem, ListDirection, HighlightSpacing, ListConfig, ListState };
export { createListItem, createList, createListState, renderList, renderStatefulList };
