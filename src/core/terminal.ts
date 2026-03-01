import type { Buffer, Cell } from './buffer';
import { bufferDiff, createBuffer, createCell } from './buffer';
import type { Position, Rect, Size } from './layout';
import { createRect } from './layout';
import type { StatefulWidgetRenderer, WidgetRenderer } from './widget';

// Backend

interface Backend {
	readonly size: () => Size;
	readonly draw: (
		content: readonly { readonly x: number; readonly y: number; readonly cell: Cell }[],
	) => void;
	readonly flush: () => void;
	readonly hideCursor: () => void;
	readonly showCursor: () => void;
	readonly getCursorPosition: () => Position;
	readonly setCursorPosition: (pos: Position) => void;
	readonly clear: () => void;
}

// Viewport

type Viewport = 'fullscreen' | 'inline' | 'fixed';

// TerminalOptions

interface TerminalOptions {
	readonly viewport: Viewport;
}

// Terminal

interface Terminal {
	readonly backend: Backend;
	buffers: readonly [Buffer, Buffer];
	current: number;
	readonly viewport: Viewport;
	readonly viewportArea: Rect;
	hiddenCursor: boolean;
	frameCount: number;
}

// Frame

interface Frame {
	readonly buffer: Buffer;
	readonly area: Rect;
	readonly count: number;
	cursorPosition?: Position;
}

// CompletedFrame

interface CompletedFrame {
	readonly buffer: Buffer;
	readonly area: Rect;
	readonly count: number;
}

// Functions

const createTerminal = (backend: Backend, options?: Partial<TerminalOptions>): Terminal => {
	const viewport = options?.viewport ?? 'fullscreen';
	const size = backend.size();
	const area = createRect(0, 0, size.width, size.height);
	const buf0 = createBuffer(area);
	const buf1 = createBuffer(area);
	return {
		backend,
		buffers: [buf0, buf1],
		current: 0,
		viewport,
		viewportArea: area,
		hiddenCursor: false,
		frameCount: 0,
	};
};

const resetBuffer = (buf: Buffer): void => {
	const blank = createCell();
	for (let i = 0; i < buf.content.length; i++) {
		buf.content[i] = blank;
	}
};

const terminalDraw = (terminal: Terminal, renderFn: (frame: Frame) => void): CompletedFrame => {
	const currentBuf = terminal.buffers[terminal.current] as Buffer;
	const frame: Frame = {
		buffer: currentBuf,
		area: terminal.viewportArea,
		count: terminal.frameCount,
	};

	renderFn(frame);

	const previousIdx = terminal.current === 0 ? 1 : 0;
	const previousBuf = terminal.buffers[previousIdx] as Buffer;
	const diff = bufferDiff(previousBuf, currentBuf);
	terminal.backend.draw(diff);
	terminal.backend.flush();

	if (frame.cursorPosition) {
		terminal.backend.setCursorPosition(frame.cursorPosition);
		terminal.backend.showCursor();
		terminal.hiddenCursor = false;
	} else {
		terminal.backend.hideCursor();
		terminal.hiddenCursor = true;
	}

	// Swap buffers
	terminal.current = previousIdx;
	resetBuffer(terminal.buffers[terminal.current] as Buffer);

	terminal.frameCount++;

	return {
		buffer: currentBuf,
		area: terminal.viewportArea,
		count: terminal.frameCount - 1,
	};
};

const terminalClear = (terminal: Terminal): void => {
	terminal.backend.clear();
};

const terminalSetCursorPosition = (terminal: Terminal, pos: Position): void => {
	terminal.backend.setCursorPosition(pos);
};

const terminalHideCursor = (terminal: Terminal): void => {
	terminal.backend.hideCursor();
	terminal.hiddenCursor = true;
};

const terminalShowCursor = (terminal: Terminal): void => {
	terminal.backend.showCursor();
	terminal.hiddenCursor = false;
};

const terminalResize = (terminal: Terminal, size: Size): void => {
	const area = createRect(0, 0, size.width, size.height);
	const buf0 = createBuffer(area);
	const buf1 = createBuffer(area);
	terminal.buffers = [buf0, buf1];
	terminal.current = 0;
	(terminal as { viewportArea: Rect }).viewportArea = area;
};

const frameRenderWidget = (frame: Frame, renderer: WidgetRenderer, area: Rect): void => {
	renderer(area, frame.buffer);
};

const frameRenderStatefulWidget = <S>(
	frame: Frame,
	renderer: StatefulWidgetRenderer<S>,
	area: Rect,
	state: S,
): void => {
	renderer(area, frame.buffer, state);
};

const frameSetCursorPosition = (frame: Frame, pos: Position): void => {
	frame.cursorPosition = pos;
};

export type { Backend, Viewport, TerminalOptions, Terminal, Frame, CompletedFrame };
export {
	createTerminal,
	terminalDraw,
	terminalClear,
	terminalSetCursorPosition,
	terminalHideCursor,
	terminalShowCursor,
	terminalResize,
	frameRenderWidget,
	frameRenderStatefulWidget,
	frameSetCursorPosition,
};
