import type { Buffer } from '../core/buffer';
import { bufferSetCell, createCell } from '../core/buffer';
import type { Rect } from '../core/layout';
import type { WidgetRenderer } from '../core/widget';

const renderClear = (): WidgetRenderer => {
	return (area: Rect, buf: Buffer): void => {
		if (area.width === 0 || area.height === 0) {
			return;
		}
		const blank = createCell();
		for (let y = area.y; y < area.y + area.height; y++) {
			for (let x = area.x; x < area.x + area.width; x++) {
				bufferSetCell(buf, x, y, blank);
			}
		}
	};
};

export { renderClear };
