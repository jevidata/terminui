import type { Buffer } from '../core/buffer';
import { bufferSetString, bufferSetStyle } from '../core/buffer';
import type { Rect } from '../core/layout';
import { createRect } from '../core/layout';
import type { Style } from '../core/style';
import { createStyle } from '../core/style';
import type { ScrollbarSet } from '../core/symbols';
import { scrollbar } from '../core/symbols';
import type { StatefulWidgetRenderer } from '../core/widget';

type ScrollbarOrientation =
	| 'verticalRight'
	| 'verticalLeft'
	| 'horizontalBottom'
	| 'horizontalTop';

interface ScrollbarConfig {
	readonly orientation: ScrollbarOrientation;
	readonly thumbStyle: Style;
	readonly trackStyle: Style;
	readonly beginSymbol?: string;
	readonly endSymbol?: string;
	readonly trackSymbol?: string;
	readonly thumbSymbol: string;
	readonly style: Style;
	readonly symbolSet: ScrollbarSet;
}

interface ScrollbarState {
	contentLength: number;
	position: number;
	viewportContentLength: number;
}

const createScrollbarState = (contentLength: number, position?: number): ScrollbarState => ({
	contentLength,
	position: position ?? 0,
	viewportContentLength: 0,
});

const isVertical = (orientation: ScrollbarOrientation): boolean =>
	orientation === 'verticalRight' || orientation === 'verticalLeft';

const defaultSymbolSet = (orientation: ScrollbarOrientation): ScrollbarSet =>
	isVertical(orientation) ? scrollbar.VERTICAL : scrollbar.HORIZONTAL;

const createScrollbar = (
	orientation: ScrollbarOrientation,
	overrides?: Partial<Omit<ScrollbarConfig, 'orientation'>>,
): ScrollbarConfig => {
	const symbols = overrides?.symbolSet ?? defaultSymbolSet(orientation);
	return {
		orientation,
		thumbStyle: createStyle(),
		trackStyle: createStyle(),
		beginSymbol: symbols.begin,
		endSymbol: symbols.end,
		trackSymbol: symbols.track,
		thumbSymbol: symbols.thumb,
		style: createStyle(),
		symbolSet: symbols,
		...overrides,
	};
};

const getTrackArea = (orientation: ScrollbarOrientation, area: Rect): Rect => {
	switch (orientation) {
		case 'verticalRight':
			return createRect(area.x + area.width - 1, area.y, 1, area.height);
		case 'verticalLeft':
			return createRect(area.x, area.y, 1, area.height);
		case 'horizontalBottom':
			return createRect(area.x, area.y + area.height - 1, area.width, 1);
		case 'horizontalTop':
			return createRect(area.x, area.y, area.width, 1);
	}
};

const renderStatefulScrollbar = (
	config: ScrollbarConfig,
): StatefulWidgetRenderer<ScrollbarState> => {
	return (area: Rect, buf: Buffer, state: ScrollbarState): void => {
		if (area.width === 0 || area.height === 0) {
			return;
		}
		if (state.contentLength === 0) {
			return;
		}

		const trackArea = getTrackArea(config.orientation, area);

		// Apply base style to the entire track area first
		bufferSetStyle(buf, trackArea, config.style);

		const vertical = isVertical(config.orientation);
		const totalLength = vertical ? trackArea.height : trackArea.width;

		if (totalLength === 0) {
			return;
		}

		// Account for begin/end symbols
		let trackStart = 0;
		let trackLength = totalLength;

		if (config.beginSymbol !== undefined) {
			bufferSetString(buf, trackArea.x, trackArea.y, config.beginSymbol, config.style);
			trackStart = 1;
			trackLength -= 1;
		}

		if (config.endSymbol !== undefined) {
			const ex = vertical ? trackArea.x : trackArea.x + totalLength - 1;
			const ey = vertical ? trackArea.y + totalLength - 1 : trackArea.y;
			bufferSetString(buf, ex, ey, config.endSymbol, config.style);
			trackLength -= 1;
		}

		if (trackLength <= 0) {
			return;
		}

		const viewportLen =
			state.viewportContentLength > 0 ? state.viewportContentLength : trackLength;
		const thumbSize = Math.max(1, Math.floor((trackLength * viewportLen) / state.contentLength));
		const maxScroll = Math.max(1, state.contentLength - viewportLen);
		const thumbOffset = Math.min(
			trackLength - thumbSize,
			Math.floor((state.position * (trackLength - thumbSize)) / maxScroll),
		);

		// Draw track symbols
		for (let i = 0; i < trackLength; i++) {
			const pos = trackStart + i;
			const tx = vertical ? trackArea.x : trackArea.x + pos;
			const ty = vertical ? trackArea.y + pos : trackArea.y;
			if (config.trackSymbol !== undefined) {
				bufferSetString(buf, tx, ty, config.trackSymbol, config.trackStyle);
			}
		}

		// Draw thumb at the calculated position
		for (let i = 0; i < thumbSize; i++) {
			const pos = trackStart + thumbOffset + i;
			const tx = vertical ? trackArea.x : trackArea.x + pos;
			const ty = vertical ? trackArea.y + pos : trackArea.y;
			bufferSetString(buf, tx, ty, config.thumbSymbol, config.thumbStyle);
		}
	};
};

export type { ScrollbarOrientation, ScrollbarConfig, ScrollbarState };
export { createScrollbar, createScrollbarState, renderStatefulScrollbar };
