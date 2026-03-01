import type { Buffer } from '../core/buffer';
import { bufferSetLine, bufferSetString, bufferSetStyle } from '../core/buffer';
import type { Alignment, Rect } from '../core/layout';
import { createRect } from '../core/layout';
import type { Style } from '../core/style';
import { createStyle } from '../core/style';
import type { BorderSet } from '../core/symbols';
import { border } from '../core/symbols';
import type { Line } from '../core/text';
import { lineWidth, rawLine } from '../core/text';
import type { WidgetRenderer } from '../core/widget';

// Borders bitflag constants

const Borders = {
	NONE: 0,
	TOP: 1,
	RIGHT: 2,
	BOTTOM: 4,
	LEFT: 8,
	ALL: 1 | 2 | 4 | 8,
} as const;

const hasBorder = (borders: number, b: number): boolean => (borders & b) === b;

// BorderType

type BorderType = 'plain' | 'rounded' | 'double' | 'thick' | 'quadrantInside' | 'quadrantOutside';

const borderTypeToSet = (borderType: BorderType): BorderSet => {
	switch (borderType) {
		case 'plain':
			return border.PLAIN;
		case 'rounded':
			return border.ROUNDED;
		case 'double':
			return border.DOUBLE;
		case 'thick':
			return border.THICK;
		case 'quadrantInside':
			return border.QUADRANT_INSIDE;
		case 'quadrantOutside':
			return border.QUADRANT_OUTSIDE;
	}
};

// Padding

interface Padding {
	readonly top: number;
	readonly right: number;
	readonly bottom: number;
	readonly left: number;
}

const createPadding = (top: number, right: number, bottom: number, left: number): Padding => ({
	top,
	right,
	bottom,
	left,
});

const uniformPadding = (value: number): Padding => ({
	top: value,
	right: value,
	bottom: value,
	left: value,
});

const noPadding = (): Padding => ({ top: 0, right: 0, bottom: 0, left: 0 });

const horizontalPadding = (value: number): Padding => ({
	top: 0,
	right: value,
	bottom: 0,
	left: value,
});

const verticalPadding = (value: number): Padding => ({
	top: value,
	right: 0,
	bottom: value,
	left: 0,
});

// Title

interface Title {
	readonly content: Line;
	readonly alignment?: Alignment;
	readonly position?: 'top' | 'bottom';
}

const createTitle = (
	content: string | Line,
	overrides?: { readonly alignment?: Alignment; readonly position?: 'top' | 'bottom' },
): Title => {
	const line: Line = typeof content === 'string' ? rawLine(content) : content;
	const title: Title = { content: line };
	if (!overrides) {
		return title;
	}
	return {
		...title,
		...(overrides.alignment !== undefined ? { alignment: overrides.alignment } : {}),
		...(overrides.position !== undefined ? { position: overrides.position } : {}),
	};
};

// BlockConfig

interface BlockConfig {
	readonly titles: readonly Title[];
	readonly borders: number;
	readonly borderType: BorderType;
	readonly borderStyle: Style;
	readonly style: Style;
	readonly padding: Padding;
}

const createBlock = (overrides?: Partial<BlockConfig>): BlockConfig => ({
	titles: [],
	borders: Borders.NONE,
	borderType: 'plain',
	borderStyle: createStyle(),
	style: createStyle(),
	padding: noPadding(),
	...overrides,
});

const blockBordered = (overrides?: Partial<BlockConfig>): BlockConfig =>
	createBlock({ borders: Borders.ALL, ...overrides });

// Compute inner area: subtract borders then padding

const blockInner = (block: BlockConfig, area: Rect): Rect => {
	if (area.width === 0 || area.height === 0) {
		return createRect(area.x, area.y, 0, 0);
	}

	const topBorder = hasBorder(block.borders, Borders.TOP) ? 1 : 0;
	const bottomBorder = hasBorder(block.borders, Borders.BOTTOM) ? 1 : 0;
	const leftBorder = hasBorder(block.borders, Borders.LEFT) ? 1 : 0;
	const rightBorder = hasBorder(block.borders, Borders.RIGHT) ? 1 : 0;

	const x = area.x + leftBorder + block.padding.left;
	const y = area.y + topBorder + block.padding.top;
	const totalH = leftBorder + rightBorder + block.padding.left + block.padding.right;
	const totalV = topBorder + bottomBorder + block.padding.top + block.padding.bottom;

	const width = totalH >= area.width ? 0 : area.width - totalH;
	const height = totalV >= area.height ? 0 : area.height - totalV;

	return createRect(x, y, width, height);
};

// Render helpers

const renderBorders = (block: BlockConfig, area: Rect, buf: Buffer): void => {
	if (block.borders === Borders.NONE) {
		return;
	}

	const symbols = borderTypeToSet(block.borderType);
	const right = area.x + area.width - 1;
	const bottom = area.y + area.height - 1;
	const hasTop = hasBorder(block.borders, Borders.TOP);
	const hasBottom = hasBorder(block.borders, Borders.BOTTOM);
	const hasLeft = hasBorder(block.borders, Borders.LEFT);
	const hasRight = hasBorder(block.borders, Borders.RIGHT);

	// Top border
	if (hasTop && area.height > 0) {
		for (let x = area.x; x < area.x + area.width; x++) {
			bufferSetString(buf, x, area.y, symbols.horizontalTop, block.borderStyle);
		}
	}

	// Bottom border
	if (hasBottom && area.height > 0) {
		for (let x = area.x; x < area.x + area.width; x++) {
			bufferSetString(buf, x, bottom, symbols.horizontalBottom, block.borderStyle);
		}
	}

	// Left border
	if (hasLeft && area.width > 0) {
		for (let y = area.y; y < area.y + area.height; y++) {
			bufferSetString(buf, area.x, y, symbols.verticalLeft, block.borderStyle);
		}
	}

	// Right border
	if (hasRight && area.width > 0) {
		for (let y = area.y; y < area.y + area.height; y++) {
			bufferSetString(buf, right, y, symbols.verticalRight, block.borderStyle);
		}
	}

	// Corners
	if (hasTop && hasLeft) {
		bufferSetString(buf, area.x, area.y, symbols.topLeft, block.borderStyle);
	}
	if (hasTop && hasRight && area.width > 1) {
		bufferSetString(buf, right, area.y, symbols.topRight, block.borderStyle);
	}
	if (hasBottom && hasLeft && area.height > 1) {
		bufferSetString(buf, area.x, bottom, symbols.bottomLeft, block.borderStyle);
	}
	if (hasBottom && hasRight && area.width > 1 && area.height > 1) {
		bufferSetString(buf, right, bottom, symbols.bottomRight, block.borderStyle);
	}
};

const renderTitles = (block: BlockConfig, area: Rect, buf: Buffer): void => {
	if (block.titles.length === 0) {
		return;
	}

	const hasLeft = hasBorder(block.borders, Borders.LEFT);
	const hasRight = hasBorder(block.borders, Borders.RIGHT);
	const leftOffset = hasLeft ? 1 : 0;
	const rightOffset = hasRight ? 1 : 0;
	const titleAreaWidth = area.width - leftOffset - rightOffset;

	if (titleAreaWidth <= 0) {
		return;
	}

	for (const title of block.titles) {
		const pos = title.position ?? 'top';
		const alignment = title.alignment ?? 'left';

		const y = pos === 'top' ? area.y : area.y + area.height - 1;

		// Only render if border exists on that side, or area is big enough
		if (pos === 'top' && !hasBorder(block.borders, Borders.TOP)) {
			continue;
		}
		if (pos === 'bottom' && !hasBorder(block.borders, Borders.BOTTOM)) {
			continue;
		}

		const width = lineWidth(title.content);
		const renderWidth = Math.min(width, titleAreaWidth);

		let x: number;
		switch (alignment) {
			case 'left':
				x = area.x + leftOffset;
				break;
			case 'center':
				x = area.x + leftOffset + Math.floor((titleAreaWidth - renderWidth) / 2);
				break;
			case 'right':
				x = area.x + leftOffset + titleAreaWidth - renderWidth;
				break;
		}

		bufferSetLine(buf, x, y, title.content, renderWidth, block.borderStyle);
	}
};

// Main render function

const renderBlock = (block: BlockConfig): WidgetRenderer => {
	return (area: Rect, buf: Buffer): void => {
		if (area.width === 0 || area.height === 0) {
			return;
		}

		bufferSetStyle(buf, area, block.style);
		renderBorders(block, area, buf);
		renderTitles(block, area, buf);
	};
};

export type { BlockConfig, BorderType, Padding, Title };
export {
	Borders,
	createBlock,
	blockBordered,
	blockInner,
	renderBlock,
	createTitle,
	createPadding,
	uniformPadding,
	noPadding,
	horizontalPadding,
	verticalPadding,
	hasBorder,
	borderTypeToSet,
};
