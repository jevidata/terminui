import { describe, it, expect } from 'vitest';

import {
	createBuffer,
	bufferCell,
	bufferSetString,
} from '../core/buffer';

import {
	createRect,
	lengthConstraint,
} from '../core/layout';

import {
	createStyle,
	Color,
	Modifier,
	styleFg,
} from '../core/style';


import {
	createTerminal,
	terminalDraw,
	frameRenderWidget,
	frameRenderStatefulWidget,
} from '../core/terminal';

import {
	createTestBackendState,
	createTestBackend,
	testBackendToString,
} from '../backends/test';

import { border, scrollbar as scrollbarSymbols } from '../core/symbols';

import {
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
} from '../widgets/block';

import { createParagraph, renderParagraph } from '../widgets/paragraph';

import {
	createList,
	createListState,
	renderList,
	renderStatefulList,
} from '../widgets/list';

import {
	createRow,
	createTable,
	createTableState,
	renderTable,
	renderStatefulTable,
} from '../widgets/table';

import {
	createGauge,
	gaugePercent,
	renderGauge,
	createLineGauge,
	renderLineGauge,
} from '../widgets/gauge';

import { createTabs, renderTabs } from '../widgets/tabs';

import { createSparkline, renderSparkline } from '../widgets/sparkline';

import {
	createBar,
	createBarGroup,
	createBarChart,
	renderBarChart,
} from '../widgets/barchart';

import {
	createScrollbar,
	createScrollbarState,
	renderStatefulScrollbar,
} from '../widgets/scrollbar';

import { renderClear } from '../widgets/clear';

// ---------------------------------------------------------------------------
// Helper: read a row of symbols from a buffer
// ---------------------------------------------------------------------------

const readRow = (buf: ReturnType<typeof createBuffer>, y: number, x0: number, len: number): string => {
	let s = '';
	for (let x = x0; x < x0 + len; x++) {
		s += bufferCell(buf, x, y)?.symbol ?? ' ';
	}
	return s;
};

// ---------------------------------------------------------------------------
// Block widget
// ---------------------------------------------------------------------------

describe('block', () => {
	describe('hasBorder', () => {
		it('returns true when border flag is set', () => {
			expect(hasBorder(Borders.ALL, Borders.TOP)).toBe(true);
			expect(hasBorder(Borders.ALL, Borders.RIGHT)).toBe(true);
			expect(hasBorder(Borders.ALL, Borders.BOTTOM)).toBe(true);
			expect(hasBorder(Borders.ALL, Borders.LEFT)).toBe(true);
		});

		it('returns false when border flag is not set', () => {
			expect(hasBorder(Borders.NONE, Borders.TOP)).toBe(false);
			expect(hasBorder(Borders.TOP, Borders.BOTTOM)).toBe(false);
		});

		it('works with individual flags', () => {
			expect(hasBorder(Borders.TOP | Borders.LEFT, Borders.TOP)).toBe(true);
			expect(hasBorder(Borders.TOP | Borders.LEFT, Borders.RIGHT)).toBe(false);
		});
	});

	describe('createBlock', () => {
		it('has default values', () => {
			const block = createBlock();
			expect(block.borders).toBe(Borders.NONE);
			expect(block.borderType).toBe('plain');
			expect(block.titles).toEqual([]);
			expect(block.padding).toEqual(noPadding());
		});

		it('accepts overrides', () => {
			const block = createBlock({ borders: Borders.ALL, borderType: 'rounded' });
			expect(block.borders).toBe(Borders.ALL);
			expect(block.borderType).toBe('rounded');
		});
	});

	describe('blockBordered', () => {
		it('has borders ALL', () => {
			const block = blockBordered();
			expect(block.borders).toBe(Borders.ALL);
		});

		it('accepts additional overrides', () => {
			const block = blockBordered({ borderType: 'double' });
			expect(block.borders).toBe(Borders.ALL);
			expect(block.borderType).toBe('double');
		});
	});

	describe('blockInner', () => {
		it('subtracts borders from area', () => {
			const block = blockBordered();
			const area = createRect(0, 0, 20, 10);
			const inner = blockInner(block, area);
			expect(inner).toEqual(createRect(1, 1, 18, 8));
		});

		it('returns full area when no borders', () => {
			const block = createBlock();
			const area = createRect(0, 0, 20, 10);
			const inner = blockInner(block, area);
			expect(inner).toEqual(createRect(0, 0, 20, 10));
		});

		it('subtracts padding', () => {
			const block = createBlock({ padding: uniformPadding(2) });
			const area = createRect(0, 0, 20, 10);
			const inner = blockInner(block, area);
			expect(inner).toEqual(createRect(2, 2, 16, 6));
		});

		it('subtracts both borders and padding', () => {
			const block = blockBordered({ padding: createPadding(1, 1, 1, 1) });
			const area = createRect(0, 0, 20, 10);
			const inner = blockInner(block, area);
			// borders take 1 each side + padding 1 each side = 2 each side
			expect(inner).toEqual(createRect(2, 2, 16, 6));
		});

		it('returns zero-size for empty area', () => {
			const block = blockBordered();
			const inner = blockInner(block, createRect(0, 0, 0, 0));
			expect(inner.width).toBe(0);
			expect(inner.height).toBe(0);
		});

		it('returns zero width/height when padding exceeds area', () => {
			const block = createBlock({ padding: uniformPadding(20) });
			const inner = blockInner(block, createRect(0, 0, 10, 10));
			expect(inner.width).toBe(0);
			expect(inner.height).toBe(0);
		});
	});

	describe('renderBlock', () => {
		it('draws border characters with plain type', () => {
			const area = createRect(0, 0, 10, 5);
			const buf = createBuffer(area);
			const block = blockBordered();
			renderBlock(block)(area, buf);

			expect(bufferCell(buf, 0, 0)?.symbol).toBe('┌');
			expect(bufferCell(buf, 9, 0)?.symbol).toBe('┐');
			expect(bufferCell(buf, 0, 4)?.symbol).toBe('└');
			expect(bufferCell(buf, 9, 4)?.symbol).toBe('┘');
			expect(bufferCell(buf, 1, 0)?.symbol).toBe('─');
			expect(bufferCell(buf, 0, 1)?.symbol).toBe('│');
		});

		it('draws rounded borders', () => {
			const area = createRect(0, 0, 10, 5);
			const buf = createBuffer(area);
			const block = blockBordered({ borderType: 'rounded' });
			renderBlock(block)(area, buf);

			expect(bufferCell(buf, 0, 0)?.symbol).toBe('╭');
			expect(bufferCell(buf, 9, 0)?.symbol).toBe('╮');
			expect(bufferCell(buf, 0, 4)?.symbol).toBe('╰');
			expect(bufferCell(buf, 9, 4)?.symbol).toBe('╯');
		});

		it('draws double borders', () => {
			const area = createRect(0, 0, 10, 5);
			const buf = createBuffer(area);
			const block = blockBordered({ borderType: 'double' });
			renderBlock(block)(area, buf);

			expect(bufferCell(buf, 0, 0)?.symbol).toBe('╔');
			expect(bufferCell(buf, 9, 0)?.symbol).toBe('╗');
			expect(bufferCell(buf, 0, 4)?.symbol).toBe('╚');
			expect(bufferCell(buf, 9, 4)?.symbol).toBe('╝');
			expect(bufferCell(buf, 1, 0)?.symbol).toBe('═');
		});

		it('draws thick borders', () => {
			const area = createRect(0, 0, 10, 5);
			const buf = createBuffer(area);
			const block = blockBordered({ borderType: 'thick' });
			renderBlock(block)(area, buf);

			expect(bufferCell(buf, 0, 0)?.symbol).toBe('┏');
			expect(bufferCell(buf, 9, 0)?.symbol).toBe('┓');
			expect(bufferCell(buf, 0, 4)?.symbol).toBe('┗');
			expect(bufferCell(buf, 9, 4)?.symbol).toBe('┛');
			expect(bufferCell(buf, 1, 0)?.symbol).toBe('━');
		});

		it('renders title on top border', () => {
			const area = createRect(0, 0, 20, 5);
			const buf = createBuffer(area);
			const block = blockBordered({
				titles: [createTitle('Hello')],
			});
			renderBlock(block)(area, buf);

			// Title starts after left border
			expect(bufferCell(buf, 1, 0)?.symbol).toBe('H');
			expect(bufferCell(buf, 2, 0)?.symbol).toBe('e');
			expect(bufferCell(buf, 3, 0)?.symbol).toBe('l');
			expect(bufferCell(buf, 4, 0)?.symbol).toBe('l');
			expect(bufferCell(buf, 5, 0)?.symbol).toBe('o');
		});

		it('renders title with center alignment', () => {
			const area = createRect(0, 0, 20, 5);
			const buf = createBuffer(area);
			const block = blockBordered({
				titles: [createTitle('Hi', { alignment: 'center' })],
			});
			renderBlock(block)(area, buf);

			// Inner width = 18, title width = 2, offset = floor((18-2)/2) = 8
			// Position = left border(1) + 8 = 9
			expect(bufferCell(buf, 9, 0)?.symbol).toBe('H');
			expect(bufferCell(buf, 10, 0)?.symbol).toBe('i');
		});

		it('renders title with right alignment', () => {
			const area = createRect(0, 0, 20, 5);
			const buf = createBuffer(area);
			const block = blockBordered({
				titles: [createTitle('Hi', { alignment: 'right' })],
			});
			renderBlock(block)(area, buf);

			// Inner width = 18, title width = 2, offset = 18 - 2 = 16
			// Position = left border(1) + 16 = 17
			expect(bufferCell(buf, 17, 0)?.symbol).toBe('H');
			expect(bufferCell(buf, 18, 0)?.symbol).toBe('i');
		});

		it('does nothing for empty area', () => {
			const area = createRect(0, 0, 0, 0);
			const buf = createBuffer(createRect(0, 0, 1, 1));
			const block = blockBordered();
			// Should not throw
			renderBlock(block)(area, buf);
		});
	});

	describe('borderTypeToSet', () => {
		it('returns correct border set for each type', () => {
			expect(borderTypeToSet('plain')).toBe(border.PLAIN);
			expect(borderTypeToSet('rounded')).toBe(border.ROUNDED);
			expect(borderTypeToSet('double')).toBe(border.DOUBLE);
			expect(borderTypeToSet('thick')).toBe(border.THICK);
		});
	});

	describe('padding helpers', () => {
		it('createPadding', () => {
			expect(createPadding(1, 2, 3, 4)).toEqual({ top: 1, right: 2, bottom: 3, left: 4 });
		});

		it('uniformPadding', () => {
			expect(uniformPadding(5)).toEqual({ top: 5, right: 5, bottom: 5, left: 5 });
		});

		it('noPadding', () => {
			expect(noPadding()).toEqual({ top: 0, right: 0, bottom: 0, left: 0 });
		});

		it('horizontalPadding', () => {
			expect(horizontalPadding(3)).toEqual({ top: 0, right: 3, bottom: 0, left: 3 });
		});

		it('verticalPadding', () => {
			expect(verticalPadding(3)).toEqual({ top: 3, right: 0, bottom: 3, left: 0 });
		});
	});
});

// ---------------------------------------------------------------------------
// Paragraph widget
// ---------------------------------------------------------------------------

describe('paragraph', () => {
	it('renders basic text at correct position', () => {
		const area = createRect(0, 0, 20, 5);
		const buf = createBuffer(area);
		const p = createParagraph('Hello');
		renderParagraph(p)(area, buf);

		expect(readRow(buf, 0, 0, 5)).toBe('Hello');
	});

	it('renders multi-line text', () => {
		const area = createRect(0, 0, 20, 5);
		const buf = createBuffer(area);
		const p = createParagraph('AB\nCD');
		renderParagraph(p)(area, buf);

		expect(bufferCell(buf, 0, 0)?.symbol).toBe('A');
		expect(bufferCell(buf, 1, 0)?.symbol).toBe('B');
		expect(bufferCell(buf, 0, 1)?.symbol).toBe('C');
		expect(bufferCell(buf, 1, 1)?.symbol).toBe('D');
	});

	it('aligns text to center', () => {
		const area = createRect(0, 0, 20, 5);
		const buf = createBuffer(area);
		const p = createParagraph('Hi', { alignment: 'center' });
		renderParagraph(p)(area, buf);

		// Width 20, text width 2, offset = floor((20-2)/2) = 9
		expect(bufferCell(buf, 9, 0)?.symbol).toBe('H');
		expect(bufferCell(buf, 10, 0)?.symbol).toBe('i');
	});

	it('aligns text to right', () => {
		const area = createRect(0, 0, 20, 5);
		const buf = createBuffer(area);
		const p = createParagraph('Hi', { alignment: 'right' });
		renderParagraph(p)(area, buf);

		// Width 20, text width 2, offset = 20 - 2 = 18
		expect(bufferCell(buf, 18, 0)?.symbol).toBe('H');
		expect(bufferCell(buf, 19, 0)?.symbol).toBe('i');
	});

	it('wraps long text', () => {
		const area = createRect(0, 0, 10, 5);
		const buf = createBuffer(area);
		const p = createParagraph('hello world foo', { wrap: { trim: true } });
		renderParagraph(p)(area, buf);

		// "hello" on first line, "world foo" on second
		expect(readRow(buf, 0, 0, 5)).toBe('hello');
		expect(bufferCell(buf, 0, 1)?.symbol).toBe('w');
	});

	it('wraps with trim removing leading spaces on wrapped lines', () => {
		const area = createRect(0, 0, 6, 5);
		const buf = createBuffer(area);
		const p = createParagraph('ab cd ef', { wrap: { trim: true } });
		renderParagraph(p)(area, buf);

		expect(readRow(buf, 0, 0, 5)).toBe('ab cd');
		// Second line should start with 'ef' (trimmed leading space)
		expect(bufferCell(buf, 0, 1)?.symbol).toBe('e');
		expect(bufferCell(buf, 1, 1)?.symbol).toBe('f');
	});

	it('applies vertical scroll', () => {
		const area = createRect(0, 0, 20, 2);
		const buf = createBuffer(area);
		const p = createParagraph('line0\nline1\nline2', { scroll: [1, 0] });
		renderParagraph(p)(area, buf);

		expect(readRow(buf, 0, 0, 5)).toBe('line1');
		expect(readRow(buf, 1, 0, 5)).toBe('line2');
	});

	it('renders inside a block', () => {
		const area = createRect(0, 0, 20, 5);
		const buf = createBuffer(area);
		const p = createParagraph('Hi', {
			block: blockBordered(),
		});
		renderParagraph(p)(area, buf);

		// Block border at corners
		expect(bufferCell(buf, 0, 0)?.symbol).toBe('┌');
		// Content starts inside the border
		expect(bufferCell(buf, 1, 1)?.symbol).toBe('H');
		expect(bufferCell(buf, 2, 1)?.symbol).toBe('i');
	});

	it('does nothing for empty area', () => {
		const area = createRect(0, 0, 0, 0);
		const buf = createBuffer(createRect(0, 0, 1, 1));
		const p = createParagraph('Hello');
		renderParagraph(p)(area, buf);
		expect(bufferCell(buf, 0, 0)?.symbol).toBe(' ');
	});
});

// ---------------------------------------------------------------------------
// List widget
// ---------------------------------------------------------------------------

describe('list', () => {
	describe('createList', () => {
		it('creates list items from strings', () => {
			const list = createList(['a', 'b', 'c']);
			expect(list.items).toHaveLength(3);
			expect(list.items[0]!.content.lines[0]!.spans[0]!.content).toBe('a');
			expect(list.items[1]!.content.lines[0]!.spans[0]!.content).toBe('b');
			expect(list.items[2]!.content.lines[0]!.spans[0]!.content).toBe('c');
		});

		it('uses default direction topToBottom', () => {
			const list = createList(['a']);
			expect(list.direction).toBe('topToBottom');
		});
	});

	describe('renderList', () => {
		it('renders items vertically', () => {
			const area = createRect(0, 0, 10, 5);
			const buf = createBuffer(area);
			renderList(createList(['aaa', 'bbb', 'ccc']))(area, buf);

			expect(readRow(buf, 0, 0, 3)).toBe('aaa');
			expect(readRow(buf, 1, 0, 3)).toBe('bbb');
			expect(readRow(buf, 2, 0, 3)).toBe('ccc');
		});
	});

	describe('renderStatefulList', () => {
		it('highlights selected item', () => {
			const area = createRect(0, 0, 10, 5);
			const buf = createBuffer(area);
			const list = createList(['aaa', 'bbb', 'ccc'], {
				highlightStyle: styleFg(createStyle(), Color.Red),
			});
			const state = createListState(1);
			renderStatefulList(list)(area, buf, state);

			// Selected row (index 1) should have Red fg
			expect(bufferCell(buf, 0, 1)?.fg).toEqual(Color.Red);
			// Non-selected row should not have Red fg
			expect(bufferCell(buf, 0, 0)?.fg).not.toEqual(Color.Red);
		});

		it('shows highlight symbol next to selected item', () => {
			const area = createRect(0, 0, 15, 5);
			const buf = createBuffer(area);
			const list = createList(['aaa', 'bbb'], {
				highlightSymbol: '>> ',
			});
			const state = createListState(0);
			renderStatefulList(list)(area, buf, state);

			expect(readRow(buf, 0, 0, 6)).toBe('>> aaa');
		});

		it('adjusts offset when selected item is out of view', () => {
			const area = createRect(0, 0, 10, 2);
			const buf = createBuffer(area);
			const list = createList(['a', 'b', 'c', 'd', 'e']);
			const state = createListState(4);
			renderStatefulList(list)(area, buf, state);

			// Offset should have adjusted so item 4 ('e') is visible
			expect(state.offset).toBe(3);
			expect(readRow(buf, 1, 0, 1)).toBe('e');
		});

		it('renders bottom-to-top direction', () => {
			const area = createRect(0, 0, 10, 3);
			const buf = createBuffer(area);
			const list = createList(['aaa', 'bbb', 'ccc'], {
				direction: 'bottomToTop',
			});
			renderList(list)(area, buf);

			// bottomToTop reverses the order
			expect(readRow(buf, 0, 0, 3)).toBe('ccc');
			expect(readRow(buf, 1, 0, 3)).toBe('bbb');
			expect(readRow(buf, 2, 0, 3)).toBe('aaa');
		});
	});

	describe('highlightSpacing', () => {
		it('always shows spacing even without selection', () => {
			const area = createRect(0, 0, 15, 5);
			const buf = createBuffer(area);
			const list = createList(['aaa'], {
				highlightSymbol: '> ',
				highlightSpacing: 'always',
			});
			// No state (no selection) - use renderList
			renderList(list)(area, buf);

			// With 'always' mode, spacing is reserved even without selection
			// Content should be offset by the highlight symbol width
			expect(bufferCell(buf, 2, 0)?.symbol).toBe('a');
		});

		it('never shows spacing', () => {
			const area = createRect(0, 0, 15, 5);
			const buf = createBuffer(area);
			const list = createList(['aaa'], {
				highlightSymbol: '> ',
				highlightSpacing: 'never',
			});
			const state = createListState(0);
			renderStatefulList(list)(area, buf, state);

			// With 'never', no spacing is reserved and content starts at x=0
			expect(bufferCell(buf, 0, 0)?.symbol).toBe('a');
		});
	});
});

// ---------------------------------------------------------------------------
// Table widget
// ---------------------------------------------------------------------------

describe('table', () => {
	describe('createRow', () => {
		it('creates cells from strings', () => {
			const row = createRow(['a', 'b', 'c']);
			expect(row.cells).toHaveLength(3);
			expect(row.cells[0]!.content.lines[0]!.spans[0]!.content).toBe('a');
		});

		it('has default height of 1', () => {
			expect(createRow(['x']).height).toBe(1);
		});
	});

	describe('renderTable', () => {
		it('renders header and rows', () => {
			const area = createRect(0, 0, 20, 5);
			const buf = createBuffer(area);
			const table = createTable(
				[createRow(['a1', 'b1']), createRow(['a2', 'b2'])],
				[lengthConstraint(5), lengthConstraint(5)],
				{ header: createRow(['H1', 'H2']) },
			);
			renderTable(table)(area, buf);

			expect(readRow(buf, 0, 0, 2)).toBe('H1');
			expect(readRow(buf, 1, 0, 2)).toBe('a1');
			expect(readRow(buf, 2, 0, 2)).toBe('a2');
		});

		it('respects column widths', () => {
			const area = createRect(0, 0, 30, 3);
			const buf = createBuffer(area);
			const table = createTable(
				[createRow(['col1', 'col2'])],
				[lengthConstraint(10), lengthConstraint(10)],
			);
			renderTable(table)(area, buf);

			expect(readRow(buf, 0, 0, 4)).toBe('col1');
			// Column 2 starts at 10 (col width) + 1 (spacing) = 11
			expect(readRow(buf, 0, 11, 4)).toBe('col2');
		});
	});

	describe('renderStatefulTable', () => {
		it('highlights selected row', () => {
			const area = createRect(0, 0, 20, 5);
			const buf = createBuffer(area);
			const table = createTable(
				[createRow(['a1']), createRow(['b1']), createRow(['c1'])],
				[lengthConstraint(5)],
				{ highlightStyle: styleFg(createStyle(), Color.Red) },
			);
			const state = createTableState(1);
			renderStatefulTable(table)(area, buf, state);

			// Selected row (index 1) has Red fg
			expect(bufferCell(buf, 0, 1)?.fg).toEqual(Color.Red);
			// Other rows don't
			expect(bufferCell(buf, 0, 0)?.fg).not.toEqual(Color.Red);
		});
	});

	it('renders table with block borders', () => {
		const area = createRect(0, 0, 20, 5);
		const buf = createBuffer(area);
		const table = createTable(
			[createRow(['x'])],
			[lengthConstraint(5)],
			{ block: blockBordered() },
		);
		renderTable(table)(area, buf);

		expect(bufferCell(buf, 0, 0)?.symbol).toBe('┌');
		expect(bufferCell(buf, 19, 0)?.symbol).toBe('┐');
		// Content inside
		expect(bufferCell(buf, 1, 1)?.symbol).toBe('x');
	});
});

// ---------------------------------------------------------------------------
// Gauge widget
// ---------------------------------------------------------------------------

describe('gauge', () => {
	describe('createGauge', () => {
		it('defaults to ratio 0', () => {
			expect(createGauge().ratio).toBe(0);
		});

		it('clamps ratio above 1 to 1', () => {
			expect(createGauge({ ratio: 1.5 }).ratio).toBe(1);
		});

		it('clamps ratio below 0 to 0', () => {
			expect(createGauge({ ratio: -0.5 }).ratio).toBe(0);
		});
	});

	describe('gaugePercent', () => {
		it('converts 50% to ratio 0.5', () => {
			expect(gaugePercent(50).ratio).toBe(0.5);
		});

		it('converts 0% to ratio 0', () => {
			expect(gaugePercent(0).ratio).toBe(0);
		});

		it('converts 100% to ratio 1', () => {
			expect(gaugePercent(100).ratio).toBe(1);
		});

		it('clamps percent above 100', () => {
			expect(gaugePercent(200).ratio).toBe(1);
		});

		it('clamps percent below 0', () => {
			expect(gaugePercent(-10).ratio).toBe(0);
		});
	});

	describe('renderGauge (unicode)', () => {
		it('draws full blocks for filled portion', () => {
			const area = createRect(0, 0, 10, 1);
			const buf = createBuffer(area);
			const gauge = gaugePercent(100, { useUnicode: true });
			renderGauge(gauge)(area, buf);

			// 100% → all cells are full blocks
			for (let x = 0; x < 10; x++) {
				expect(bufferCell(buf, x, 0)?.symbol).toBe('█');
			}
		});

		it('draws nothing for 0%', () => {
			const area = createRect(0, 0, 10, 1);
			const buf = createBuffer(area);
			const gauge = gaugePercent(0, { useUnicode: true });
			renderGauge(gauge)(area, buf);

			// 0% → no full blocks
			expect(bufferCell(buf, 0, 0)?.symbol).toBe(' ');
		});
	});

	describe('renderGauge (ascii)', () => {
		it('draws reversed spaces for filled portion', () => {
			const area = createRect(0, 0, 10, 1);
			const buf = createBuffer(area);
			const gauge = gaugePercent(50, { useUnicode: false });
			renderGauge(gauge)(area, buf);

			// 50% of 10 = 5 filled cells with REVERSED modifier
			const filledCell = bufferCell(buf, 0, 0);
			expect(filledCell?.symbol).toBe(' ');
			expect(Modifier.contains(filledCell?.modifier ?? 0, Modifier.REVERSED)).toBe(true);

			// Unfilled portion should not have REVERSED
			const unfilledCell = bufferCell(buf, 9, 0);
			expect(Modifier.contains(unfilledCell?.modifier ?? 0, Modifier.REVERSED)).toBe(false);
		});
	});

	describe('renderLineGauge', () => {
		it('draws line characters', () => {
			const area = createRect(0, 0, 10, 1);
			const buf = createBuffer(area);
			const gauge = createLineGauge({ ratio: 0.5 });
			renderLineGauge(gauge)(area, buf);

			// Filled portion uses line set horizontal char
			const filledCell = bufferCell(buf, 0, 0);
			expect(filledCell?.symbol).toBe('─');

			// Unfilled portion also uses line horizontal char (same for NORMAL set)
			const unfilledCell = bufferCell(buf, 9, 0);
			expect(unfilledCell?.symbol).toBe('─');
		});
	});
});

// ---------------------------------------------------------------------------
// Tabs widget
// ---------------------------------------------------------------------------

describe('tabs', () => {
	describe('createTabs', () => {
		it('creates config from string titles', () => {
			const tabs = createTabs(['Tab1', 'Tab2']);
			expect(tabs.titles).toHaveLength(2);
			expect(tabs.selected).toBe(0);
		});

		it('has default divider', () => {
			const tabs = createTabs(['A', 'B']);
			expect(tabs.divider.content).toBe(' | ');
		});
	});

	describe('renderTabs', () => {
		it('renders tab titles with dividers', () => {
			const area = createRect(0, 0, 30, 1);
			const buf = createBuffer(area);
			const tabs = createTabs(['Tab1', 'Tab2']);
			renderTabs(tabs)(area, buf);

			// " Tab1 " then " | " then " Tab2 "
			const row = readRow(buf, 0, 0, 20);
			expect(row).toContain('Tab1');
			expect(row).toContain('|');
			expect(row).toContain('Tab2');
		});

		it('applies highlight style to selected tab', () => {
			const area = createRect(0, 0, 30, 1);
			const buf = createBuffer(area);
			const tabs = createTabs(['A', 'B'], {
				selected: 1,
				highlightStyle: styleFg(createStyle(), Color.Red),
			});
			renderTabs(tabs)(area, buf);

			// Find 'B' in the buffer - it should have Red fg
			// Tab layout: " A " + " | " + " B "
			// Positions:   0-2     3-5     6-8
			// 'B' is at position 7
			expect(bufferCell(buf, 7, 0)?.symbol).toBe('B');
			expect(bufferCell(buf, 7, 0)?.fg).toEqual(Color.Red);
		});

		it('truncates tabs that exceed area width', () => {
			const area = createRect(0, 0, 8, 1);
			const buf = createBuffer(area);
			const tabs = createTabs(['Tab1', 'Tab2', 'Tab3']);
			renderTabs(tabs)(area, buf);

			// Should render what fits within width
			const row = readRow(buf, 0, 0, 8);
			expect(row).toContain('Tab1');
		});
	});
});

// ---------------------------------------------------------------------------
// Sparkline widget
// ---------------------------------------------------------------------------

describe('sparkline', () => {
	describe('createSparkline', () => {
		it('creates config from data', () => {
			const sparkline = createSparkline([1, 2, 3]);
			expect(sparkline.data).toEqual([1, 2, 3]);
			expect(sparkline.direction).toBe('leftToRight');
		});
	});

	describe('renderSparkline', () => {
		it('draws bar characters proportional to data', () => {
			const area = createRect(0, 0, 3, 1);
			const buf = createBuffer(area);
			const sparkline = createSparkline([0, 4, 8]);
			renderSparkline(sparkline)(area, buf);

			// Max value is 8
			// Value 0 → no symbol drawn (stays space)
			expect(bufferCell(buf, 0, 0)?.symbol).toBe(' ');
			// Value 8 → full block
			expect(bufferCell(buf, 2, 0)?.symbol).toBe('█');
		});

		it('normalizes bars to max value', () => {
			const area = createRect(0, 0, 2, 1);
			const buf = createBuffer(area);
			const sparkline = createSparkline([50, 100]);
			renderSparkline(sparkline)(area, buf);

			// 100 is max → full block
			expect(bufferCell(buf, 1, 0)?.symbol).toBe('█');
			// 50 is half → some partial block character
			const halfCell = bufferCell(buf, 0, 0)?.symbol;
			expect(halfCell).not.toBe(' ');
			expect(halfCell).not.toBe('█');
		});

		it('uses custom max', () => {
			const area = createRect(0, 0, 1, 1);
			const buf = createBuffer(area);
			const sparkline = createSparkline([50], { max: 200 });
			renderSparkline(sparkline)(area, buf);

			// 50/200 = 25% — should be a partial block, not full
			const cell = bufferCell(buf, 0, 0)?.symbol;
			expect(cell).not.toBe('█');
		});

		it('renders rightToLeft direction', () => {
			const area = createRect(0, 0, 3, 1);
			const buf = createBuffer(area);
			const sparkline = createSparkline([0, 0, 8], { direction: 'rightToLeft' });
			renderSparkline(sparkline)(area, buf);

			// rightToLeft reverses data: data[2]=8 goes to col 0
			expect(bufferCell(buf, 0, 0)?.symbol).toBe('█');
			expect(bufferCell(buf, 1, 0)?.symbol).toBe(' ');
			expect(bufferCell(buf, 2, 0)?.symbol).toBe(' ');
		});

		it('does nothing when all data is zero', () => {
			const area = createRect(0, 0, 3, 1);
			const buf = createBuffer(area);
			const sparkline = createSparkline([0, 0, 0]);
			renderSparkline(sparkline)(area, buf);

			expect(bufferCell(buf, 0, 0)?.symbol).toBe(' ');
			expect(bufferCell(buf, 1, 0)?.symbol).toBe(' ');
			expect(bufferCell(buf, 2, 0)?.symbol).toBe(' ');
		});
	});
});

// ---------------------------------------------------------------------------
// BarChart widget
// ---------------------------------------------------------------------------

describe('barchart', () => {
	describe('createBar', () => {
		it('creates a bar with a value', () => {
			const b = createBar(5);
			expect(b.value).toBe(5);
		});

		it('accepts overrides', () => {
			const b = createBar(10, { textValue: '10%' });
			expect(b.textValue).toBe('10%');
		});
	});

	describe('createBarGroup', () => {
		it('creates a group of bars', () => {
			const group = createBarGroup([createBar(5), createBar(10)]);
			expect(group.bars).toHaveLength(2);
			expect(group.label).toBeUndefined();
		});

		it('accepts a label', () => {
			const group = createBarGroup([createBar(5)], 'Group1');
			expect(group.label).toBeDefined();
		});
	});

	describe('renderBarChart vertical', () => {
		it('draws bars upward', () => {
			// With barWidth=1, barGap=0, 1 bar of max value
			// Area height = 5: reservedRows = 1 (value) + 0 (no labels) = 1
			// barAreaHeight = 4
			const area = createRect(0, 0, 3, 5);
			const buf = createBuffer(area);
			const chart = createBarChart(
				[createBarGroup([createBar(8)])],
				{ barWidth: 1, barGap: 0 },
			);
			renderBarChart(chart)(area, buf);

			// Value text '8' should appear in the value row (y=4, barAreaHeight)
			expect(bufferCell(buf, 0, 4)?.symbol).toBe('8');

			// The bar should have block characters above the value row
			// Max value = 8, so the bar fills the full bar area
			const topCell = bufferCell(buf, 0, 0)?.symbol;
			expect(topCell).not.toBe(' ');
		});
	});

	describe('renderBarChart horizontal', () => {
		it('draws bars rightward', () => {
			const area = createRect(0, 0, 20, 3);
			const buf = createBuffer(area);
			const chart = createBarChart(
				[createBarGroup([createBar(10), createBar(5)])],
				{ direction: 'horizontal', barWidth: 1, barGap: 0 },
			);
			renderBarChart(chart)(area, buf);

			// Value text should appear after the bar area
			// Bar 10 is max, so it fills the bar area, value '10' follows
			const row0 = readRow(buf, 0, 0, 20);
			expect(row0).toContain('10');
		});
	});

	it('value text appears in the output', () => {
		const state = createTestBackendState(20, 5);
		const backend = createTestBackend(state);
		const terminal = createTerminal(backend);
		const chart = createBarChart(
			[createBarGroup([createBar(42)])],
			{ barWidth: 3 },
		);
		terminalDraw(terminal, (frame) => {
			frameRenderWidget(frame, renderBarChart(chart), frame.area);
		});
		const output = testBackendToString(state);
		expect(output).toContain('42');
	});
});

// ---------------------------------------------------------------------------
// Scrollbar widget
// ---------------------------------------------------------------------------

describe('scrollbar', () => {
	describe('createScrollbarState', () => {
		it('creates state with content length and position 0', () => {
			const state = createScrollbarState(100);
			expect(state.contentLength).toBe(100);
			expect(state.position).toBe(0);
			expect(state.viewportContentLength).toBe(0);
		});

		it('accepts custom position', () => {
			const state = createScrollbarState(100, 50);
			expect(state.position).toBe(50);
		});
	});

	describe('createScrollbar', () => {
		it('verticalRight uses VERTICAL symbols', () => {
			const sb = createScrollbar('verticalRight');
			expect(sb.orientation).toBe('verticalRight');
			expect(sb.symbolSet).toBe(scrollbarSymbols.VERTICAL);
			expect(sb.thumbSymbol).toBe(scrollbarSymbols.VERTICAL.thumb);
		});

		it('horizontalBottom uses HORIZONTAL symbols', () => {
			const sb = createScrollbar('horizontalBottom');
			expect(sb.orientation).toBe('horizontalBottom');
			expect(sb.symbolSet).toBe(scrollbarSymbols.HORIZONTAL);
			expect(sb.thumbSymbol).toBe(scrollbarSymbols.HORIZONTAL.thumb);
		});
	});

	describe('renderStatefulScrollbar', () => {
		it('draws track and thumb for vertical scrollbar', () => {
			const area = createRect(0, 0, 1, 10);
			const buf = createBuffer(area);
			const sb = createScrollbar('verticalRight');
			const state = createScrollbarState(100, 0);
			renderStatefulScrollbar(sb)(area, buf, state);

			// Should have begin symbol at top
			expect(bufferCell(buf, 0, 0)?.symbol).toBe(scrollbarSymbols.VERTICAL.begin);
			// Should have end symbol at bottom
			expect(bufferCell(buf, 0, 9)?.symbol).toBe(scrollbarSymbols.VERTICAL.end);
			// Track area should have track symbols between begin and end
			const trackCell = bufferCell(buf, 0, 5)?.symbol;
			expect(trackCell).toBeDefined();
		});

		it('draws thumb at position', () => {
			const area = createRect(0, 0, 1, 10);
			const buf = createBuffer(area);
			const sb = createScrollbar('verticalRight');
			const state = createScrollbarState(100, 0);
			renderStatefulScrollbar(sb)(area, buf, state);

			// Thumb should be near the top (position=0)
			const thumbSym = scrollbarSymbols.VERTICAL.thumb;
			expect(bufferCell(buf, 0, 1)?.symbol).toBe(thumbSym);
		});

		it('moves thumb with position', () => {
			const area = createRect(0, 0, 1, 10);

			const buf1 = createBuffer(area);
			const sb = createScrollbar('verticalRight');
			const state1 = createScrollbarState(100, 0);
			renderStatefulScrollbar(sb)(area, buf1, state1);

			const buf2 = createBuffer(area);
			const state2 = createScrollbarState(100, 99);
			renderStatefulScrollbar(sb)(area, buf2, state2);

			// The thumb position should differ between position 0 and position 99
			// Collect thumb positions
			const thumbSym = scrollbarSymbols.VERTICAL.thumb;
			let thumb1Y = -1;
			let thumb2Y = -1;
			for (let y = 0; y < 10; y++) {
				if (bufferCell(buf1, 0, y)?.symbol === thumbSym) { thumb1Y = y; break; }
			}
			for (let y = 9; y >= 0; y--) {
				if (bufferCell(buf2, 0, y)?.symbol === thumbSym) { thumb2Y = y; break; }
			}
			expect(thumb2Y).toBeGreaterThan(thumb1Y);
		});

		it('renders horizontal scrollbar', () => {
			const area = createRect(0, 0, 10, 1);
			const buf = createBuffer(area);
			const sb = createScrollbar('horizontalBottom');
			const state = createScrollbarState(100, 0);
			renderStatefulScrollbar(sb)(area, buf, state);

			expect(bufferCell(buf, 0, 0)?.symbol).toBe(scrollbarSymbols.HORIZONTAL.begin);
			expect(bufferCell(buf, 9, 0)?.symbol).toBe(scrollbarSymbols.HORIZONTAL.end);
		});

		it('does nothing when content length is 0', () => {
			const area = createRect(0, 0, 1, 10);
			const buf = createBuffer(area);
			const sb = createScrollbar('verticalRight');
			const state = createScrollbarState(0, 0);
			renderStatefulScrollbar(sb)(area, buf, state);

			// Buffer should remain all spaces
			expect(bufferCell(buf, 0, 0)?.symbol).toBe(' ');
		});
	});
});

// ---------------------------------------------------------------------------
// Clear widget
// ---------------------------------------------------------------------------

describe('clear', () => {
	it('resets all cells in area to space', () => {
		const area = createRect(0, 0, 5, 2);
		const buf = createBuffer(area);
		bufferSetString(buf, 0, 0, 'XXXXX', createStyle());
		bufferSetString(buf, 0, 1, 'YYYYY', createStyle());

		renderClear()(area, buf);

		for (let y = 0; y < 2; y++) {
			for (let x = 0; x < 5; x++) {
				expect(bufferCell(buf, x, y)?.symbol).toBe(' ');
			}
		}
	});

	it('after setting content, clear removes it', () => {
		const area = createRect(0, 0, 10, 3);
		const buf = createBuffer(area);
		bufferSetString(buf, 0, 0, 'Hello', createStyle());

		expect(bufferCell(buf, 0, 0)?.symbol).toBe('H');
		renderClear()(area, buf);
		expect(bufferCell(buf, 0, 0)?.symbol).toBe(' ');
	});

	it('only clears the specified area', () => {
		const fullArea = createRect(0, 0, 10, 3);
		const buf = createBuffer(fullArea);
		bufferSetString(buf, 0, 0, 'ABCDE', createStyle());
		bufferSetString(buf, 0, 1, 'FGHIJ', createStyle());

		// Clear only first row
		const clearArea = createRect(0, 0, 10, 1);
		renderClear()(clearArea, buf);

		// First row cleared
		expect(bufferCell(buf, 0, 0)?.symbol).toBe(' ');
		// Second row untouched
		expect(bufferCell(buf, 0, 1)?.symbol).toBe('F');
	});
});

// ---------------------------------------------------------------------------
// Integration tests using test backend
// ---------------------------------------------------------------------------

describe('integration', () => {
	const makeTerminal = (w: number, h: number) => {
		const state = createTestBackendState(w, h);
		const backend = createTestBackend(state);
		const terminal = createTerminal(backend);
		return { state, terminal };
	};

	it('renders block with paragraph inside via terminal', () => {
		const { state, terminal } = makeTerminal(20, 5);
		terminalDraw(terminal, (frame) => {
			const p = createParagraph('Hi', { block: blockBordered() });
			frameRenderWidget(frame, renderParagraph(p), frame.area);
		});
		const output = testBackendToString(state);
		expect(output).toContain('┌');
		expect(output).toContain('Hi');
		expect(output).toContain('┘');
	});

	it('renders stateful list via terminal', () => {
		const { state, terminal } = makeTerminal(20, 5);
		const list = createList(['alpha', 'beta', 'gamma'], {
			highlightSymbol: '> ',
			highlightStyle: styleFg(createStyle(), Color.Yellow),
		});
		const listState = createListState(1);
		terminalDraw(terminal, (frame) => {
			frameRenderStatefulWidget(frame, renderStatefulList(list), frame.area, listState);
		});
		const output = testBackendToString(state);
		expect(output).toContain('> beta');
		expect(output).toContain('alpha');
	});

	it('renders stateful table via terminal', () => {
		const { state, terminal } = makeTerminal(20, 5);
		const table = createTable(
			[createRow(['r1c1', 'r1c2']), createRow(['r2c1', 'r2c2'])],
			[lengthConstraint(6), lengthConstraint(6)],
		);
		const tableState = createTableState(0);
		terminalDraw(terminal, (frame) => {
			frameRenderStatefulWidget(frame, renderStatefulTable(table), frame.area, tableState);
		});
		const output = testBackendToString(state);
		expect(output).toContain('r1c1');
		expect(output).toContain('r2c2');
	});

	it('renders gauge via terminal', () => {
		const { state, terminal } = makeTerminal(20, 1);
		const gauge = gaugePercent(100, { useUnicode: true });
		terminalDraw(terminal, (frame) => {
			frameRenderWidget(frame, renderGauge(gauge), frame.area);
		});
		const output = testBackendToString(state);
		expect(output).toBe('████████████████████');
	});

	it('renders scrollbar via terminal', () => {
		const { state, terminal } = makeTerminal(1, 10);
		const sb = createScrollbar('verticalRight');
		const sbState = createScrollbarState(100, 0);
		terminalDraw(terminal, (frame) => {
			frameRenderStatefulWidget(frame, renderStatefulScrollbar(sb), frame.area, sbState);
		});
		const output = testBackendToString(state);
		expect(output).toContain(scrollbarSymbols.VERTICAL.thumb);
		expect(output).toContain(scrollbarSymbols.VERTICAL.begin);
	});
});
