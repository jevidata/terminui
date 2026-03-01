import type { Cell } from '../core/buffer';
import type { Position, Size } from '../core/layout';
import type { Backend } from '../core/terminal';

import { createCell } from '../core/buffer';

interface TestBackendState {
	width: number;
	height: number;
	buffer: Cell[][];
	cursorPosition: Position;
	cursorVisible: boolean;
}

const createEmptyGrid = (width: number, height: number): Cell[][] => {
	const grid: Cell[][] = [];
	for (let row = 0; row < height; row++) {
		const cells: Cell[] = [];
		for (let col = 0; col < width; col++) {
			cells.push(createCell());
		}
		grid.push(cells);
	}
	return grid;
};

const createTestBackendState = (width: number, height: number): TestBackendState => ({
	width,
	height,
	buffer: createEmptyGrid(width, height),
	cursorPosition: { x: 0, y: 0 },
	cursorVisible: true,
});

const createTestBackend = (state: TestBackendState): Backend => ({
	size: (): Size => ({ width: state.width, height: state.height }),

	draw: (
		content: readonly { readonly x: number; readonly y: number; readonly cell: Cell }[],
	): void => {
		for (const entry of content) {
			const row = state.buffer[entry.y];
			if (row && entry.x >= 0 && entry.x < state.width) {
				row[entry.x] = entry.cell;
			}
		}
	},

	flush: (): void => {},

	hideCursor: (): void => {
		state.cursorVisible = false;
	},

	showCursor: (): void => {
		state.cursorVisible = true;
	},

	getCursorPosition: (): Position => state.cursorPosition,

	setCursorPosition: (pos: Position): void => {
		state.cursorPosition = pos;
	},

	clear: (): void => {
		state.buffer = createEmptyGrid(state.width, state.height);
	},
});

const testBackendToString = (state: TestBackendState): string =>
	state.buffer.map((row) => row.map((cell) => cell.symbol).join('')).join('\n');

const testBackendCellAt = (state: TestBackendState, x: number, y: number): Cell | undefined => {
	const row = state.buffer[y];
	if (!row) {
		return undefined;
	}
	return row[x];
};

export type { TestBackendState };
export {
	createTestBackendState,
	createTestBackend,
	testBackendToString,
	testBackendCellAt,
};
