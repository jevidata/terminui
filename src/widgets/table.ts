import type { Buffer } from '../core/buffer';
import { bufferSetString, bufferSetStyle } from '../core/buffer';
import type { Constraint, Rect } from '../core/layout';
import { applyConstraint, createRect } from '../core/layout';
import type { Style } from '../core/style';
import { createStyle, patchStyle } from '../core/style';
import type { Text } from '../core/text';
import { rawText, stringWidth } from '../core/text';
import type { StatefulWidgetRenderer, WidgetRenderer } from '../core/widget';
import type { BlockConfig } from './block';
import { blockInner, renderBlock } from './block';
import type { HighlightSpacing } from './list';

// TableCell

interface TableCell {
	readonly content: Text;
	readonly style: Style;
}

const createTableCell = (content: string | Text, style?: Style): TableCell => ({
	content: typeof content === 'string' ? rawText(content) : content,
	style: style ?? createStyle(),
});

// Row

interface Row {
	readonly cells: readonly TableCell[];
	readonly height: number;
	readonly style: Style;
	readonly topMargin: number;
	readonly bottomMargin: number;
}

const createRow = (
	cells: readonly (string | TableCell)[],
	overrides?: Partial<Omit<Row, 'cells'>>,
): Row => ({
	cells: cells.map((cell) => (typeof cell === 'string' ? createTableCell(cell) : cell)),
	height: 1,
	style: createStyle(),
	topMargin: 0,
	bottomMargin: 0,
	...overrides,
});

// TableConfig

interface TableConfig {
	readonly rows: readonly Row[];
	readonly header?: Row;
	readonly footer?: Row;
	readonly widths: readonly Constraint[];
	readonly columnSpacing: number;
	readonly block?: BlockConfig;
	readonly style: Style;
	readonly highlightStyle: Style;
	readonly highlightSymbol?: string;
	readonly highlightSpacing: HighlightSpacing;
}

// TableState

interface TableState {
	offset: number;
	selected?: number;
}

const createTableState = (selected?: number): TableState => ({
	offset: 0,
	selected,
});

// createTable

const createTable = (
	rows: readonly Row[],
	widths: readonly Constraint[],
	overrides?: Partial<Omit<TableConfig, 'rows' | 'widths'>>,
): TableConfig => ({
	rows,
	widths,
	columnSpacing: 1,
	style: createStyle(),
	highlightStyle: createStyle(),
	highlightSpacing: 'whenSelected',
	...overrides,
});

// Helpers

const resolveColumnWidths = (
	widths: readonly Constraint[],
	availableWidth: number,
	columnSpacing: number,
): readonly number[] => {
	if (widths.length === 0) {
		return [];
	}
	const totalSpacing = columnSpacing * (widths.length - 1);
	const usable = Math.max(0, availableWidth - totalSpacing);
	return widths.map((c) => applyConstraint(c, usable));
};

const shouldShowSpacing = (spacing: HighlightSpacing, hasSelected: boolean): boolean => {
	if (spacing === 'always') {
		return true;
	}
	if (spacing === 'never') {
		return false;
	}
	return hasSelected;
};

const totalRowHeight = (row: Row): number => row.topMargin + row.height + row.bottomMargin;

const renderRowCells = (
	row: Row,
	columnWidths: readonly number[],
	columnSpacing: number,
	area: Rect,
	buf: Buffer,
	rowStyle: Style,
): void => {
	const rowArea = createRect(area.x, area.y, area.width, Math.min(row.height, area.height));
	bufferSetStyle(buf, rowArea, rowStyle);

	let x = area.x;
	for (let colIdx = 0; colIdx < columnWidths.length; colIdx++) {
		const colWidth = columnWidths[colIdx] ?? 0;
		if (colIdx >= row.cells.length) {
			break;
		}
		const cell = row.cells[colIdx]!;
		const cellStyle = patchStyle(rowStyle, cell.style);

		for (let lineIdx = 0; lineIdx < row.height && lineIdx < cell.content.lines.length; lineIdx++) {
			const line = cell.content.lines[lineIdx];
			if (line === undefined) {
				continue;
			}
			const cy = area.y + lineIdx;
			if (cy >= area.y + area.height) {
				break;
			}

			let cx = x;
			for (const span of line.spans) {
				const merged = patchStyle(cellStyle, span.style);
				for (const ch of span.content) {
					if (cx >= x + colWidth) {
						break;
					}
					bufferSetString(buf, cx, cy, ch, merged);
					cx += stringWidth(ch);
				}
			}
		}

		x += colWidth + columnSpacing;
	}
};

// Core render logic

const renderTableInner = (
	config: TableConfig,
	area: Rect,
	buf: Buffer,
	state?: TableState,
): void => {
	if (area.width === 0 || area.height === 0) {
		return;
	}

	let contentArea = area;
	if (config.block !== undefined) {
		renderBlock(config.block)(area, buf);
		contentArea = blockInner(config.block, area);
	}

	if (contentArea.width === 0 || contentArea.height === 0) {
		return;
	}

	bufferSetStyle(buf, contentArea, config.style);

	const selected = state?.selected;
	const hasSelected = selected !== undefined;
	const highlightSymbolWidth =
		config.highlightSymbol !== undefined ? stringWidth(config.highlightSymbol) : 0;
	const showSpacing = shouldShowSpacing(config.highlightSpacing, hasSelected);
	const spacingWidth = showSpacing ? highlightSymbolWidth : 0;

	const tableArea = createRect(
		contentArea.x + spacingWidth,
		contentArea.y,
		Math.max(0, contentArea.width - spacingWidth),
		contentArea.height,
	);

	const columnWidths = resolveColumnWidths(config.widths, tableArea.width, config.columnSpacing);

	let y = tableArea.y;

	// Render header
	if (config.header !== undefined) {
		const headerHeight = Math.min(config.header.height, tableArea.y + tableArea.height - y);
		if (headerHeight > 0) {
			renderRowCells(
				config.header,
				columnWidths,
				config.columnSpacing,
				createRect(tableArea.x, y, tableArea.width, headerHeight),
				buf,
				config.header.style,
			);
			y += headerHeight + config.header.bottomMargin;
		}
	}

	// Reserve space for footer
	let footerHeight = 0;
	if (config.footer !== undefined) {
		footerHeight = config.footer.height + config.footer.topMargin;
	}

	const rowsAreaHeight = Math.max(0, tableArea.y + tableArea.height - y - footerHeight);

	// Adjust offset for selected row visibility
	if (state !== undefined && selected !== undefined) {
		if (selected < state.offset) {
			state.offset = selected;
		}

		let visibleHeight = 0;
		let lastVisible = state.offset;
		for (let i = state.offset; i < config.rows.length; i++) {
			const row = config.rows[i];
			if (row === undefined) {
				break;
			}
			const rh = totalRowHeight(row);
			if (visibleHeight + rh > rowsAreaHeight) {
				break;
			}
			visibleHeight += rh;
			lastVisible = i;
		}

		if (selected > lastVisible) {
			let h = 0;
			let newOffset = selected;
			for (let i = selected; i >= 0; i--) {
				const row = config.rows[i];
				if (row === undefined) {
					break;
				}
				const rh = totalRowHeight(row);
				if (h + rh > rowsAreaHeight) {
					break;
				}
				h += rh;
				newOffset = i;
			}
			state.offset = newOffset;
		}
	}

	const offset = state?.offset ?? 0;

	// Render visible rows
	let rowY = y;
	for (let i = offset; i < config.rows.length; i++) {
		const row = config.rows[i];
		if (row === undefined) {
			break;
		}

		rowY += row.topMargin;
		if (rowY >= y + rowsAreaHeight) {
			break;
		}

		const isSelected = hasSelected && selected === i;
		const rowStyle = isSelected ? patchStyle(row.style, config.highlightStyle) : row.style;
		const renderHeight = Math.min(row.height, y + rowsAreaHeight - rowY);

		if (renderHeight <= 0) {
			break;
		}

		if (showSpacing && isSelected && config.highlightSymbol !== undefined) {
			bufferSetString(buf, contentArea.x, rowY, config.highlightSymbol, rowStyle);
		}

		renderRowCells(
			row,
			columnWidths,
			config.columnSpacing,
			createRect(tableArea.x, rowY, tableArea.width, renderHeight),
			buf,
			rowStyle,
		);

		rowY += row.height + row.bottomMargin;
	}

	// Render footer
	if (config.footer !== undefined) {
		const footerY = tableArea.y + tableArea.height - config.footer.height;
		if (footerY >= y && footerY < tableArea.y + tableArea.height) {
			renderRowCells(
				config.footer,
				columnWidths,
				config.columnSpacing,
				createRect(tableArea.x, footerY, tableArea.width, config.footer.height),
				buf,
				config.footer.style,
			);
		}
	}
};

// renderTable

const renderTable = (config: TableConfig): WidgetRenderer =>
	(area: Rect, buf: Buffer): void => {
		renderTableInner(config, area, buf);
	};

// renderStatefulTable

const renderStatefulTable = (config: TableConfig): StatefulWidgetRenderer<TableState> =>
	(area: Rect, buf: Buffer, state: TableState): void => {
		renderTableInner(config, area, buf, state);
	};

export type { TableCell, Row, TableConfig, TableState };
export {
	createTableCell,
	createRow,
	createTable,
	createTableState,
	renderTable,
	renderStatefulTable,
};
