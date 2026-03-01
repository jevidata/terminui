import type { Buffer } from '../core/buffer';
import { bufferSetString, bufferSetStyle } from '../core/buffer';
import type { Alignment, Rect } from '../core/layout';
import type { Style } from '../core/style';
import { createStyle, patchStyle } from '../core/style';
import type { Line, Text } from '../core/text';
import { createLine, createSpan, isWideChar, lineWidth, rawText, stringWidth } from '../core/text';
import type { WidgetRenderer } from '../core/widget';
import type { BlockConfig } from './block';
import { blockInner, renderBlock } from './block';

// Wrap

interface Wrap {
	readonly trim: boolean;
}

// ParagraphConfig

interface ParagraphConfig {
	readonly text: Text;
	readonly block?: BlockConfig;
	readonly style: Style;
	readonly alignment: Alignment;
	readonly wrap?: Wrap;
	readonly scroll: readonly [number, number];
}

// createParagraph

const createParagraph = (
	text: Text | string,
	overrides?: Partial<Omit<ParagraphConfig, 'text'>>,
): ParagraphConfig => {
	const resolvedText: Text = typeof text === 'string' ? rawText(text) : text;
	return {
		text: resolvedText,
		style: createStyle(),
		alignment: 'left',
		scroll: [0, 0],
		...overrides,
	};
};

// Word wrapping helpers

interface StyledSegment {
	readonly text: string;
	readonly style: Style;
	readonly width: number;
}

interface StyledText {
	readonly text: string;
	readonly style: Style;
}

const isSpaces = (s: string): boolean => {
	if (s.length === 0) return false;
	for (const ch of s) {
		if (ch !== ' ') return false;
	}
	return true;
};

const splitSegments = (line: Line): readonly StyledSegment[] => {
	const segments: StyledSegment[] = [];
	for (const span of line.spans) {
		const parts = span.content.split(/( +)/);
		for (const part of parts) {
			if (part.length > 0) {
				segments.push({ text: part, style: span.style, width: stringWidth(part) });
			}
		}
	}
	return segments;
};

const buildWrappedLine = (spans: readonly StyledText[], baseLine: Line): Line =>
	createLine(
		spans.map((s) => createSpan(s.text, s.style)),
		{ style: baseLine.style, alignment: baseLine.alignment },
	);

const trimTrailing = (spans: readonly StyledText[]): readonly StyledText[] => {
	const result = [...spans];
	while (result.length > 0) {
		const last = result[result.length - 1];
		if (last === undefined) break;
		const trimmed = last.text.trimEnd();
		if (trimmed.length === 0) {
			result.pop();
		} else if (trimmed !== last.text) {
			result[result.length - 1] = { text: trimmed, style: last.style };
			break;
		} else {
			break;
		}
	}
	return result;
};

const wrapLine = (line: Line, maxWidth: number, trim: boolean): readonly Line[] => {
	if (maxWidth === 0) return [];
	if (lineWidth(line) <= maxWidth) return [line];

	const segments = splitSegments(line);
	const result: Line[] = [];
	let currentSpans: StyledText[] = [];
	let currentWidth = 0;

	const flush = (): void => {
		const spans = trim ? trimTrailing(currentSpans) : currentSpans;
		result.push(buildWrappedLine(spans, line));
		currentSpans = [];
		currentWidth = 0;
	};

	for (const seg of segments) {
		// Skip leading whitespace on wrapped lines when trim is true
		if (trim && isSpaces(seg.text) && currentWidth === 0 && result.length > 0) {
			continue;
		}

		if (currentWidth + seg.width <= maxWidth) {
			currentSpans.push({ text: seg.text, style: seg.style });
			currentWidth += seg.width;
		} else if (isSpaces(seg.text)) {
			flush();
		} else if (seg.width <= maxWidth) {
			// Word fits on a fresh line
			if (currentWidth > 0) flush();
			currentSpans.push({ text: seg.text, style: seg.style });
			currentWidth += seg.width;
		} else {
			// Word wider than maxWidth — break mid-word
			if (currentWidth > 0) flush();
			let remaining = seg.text;
			while (remaining.length > 0) {
				let chunk = '';
				let chunkWidth = 0;
				for (const ch of remaining) {
					const code = ch.codePointAt(0) ?? 0;
					const cw = isWideChar(code) ? 2 : 1;
					if (chunkWidth + cw > maxWidth && chunkWidth > 0) break;
					chunk += ch;
					chunkWidth += cw;
				}
				if (chunk.length === 0) break;
				currentSpans.push({ text: chunk, style: seg.style });
				currentWidth += chunkWidth;
				remaining = remaining.slice(chunk.length);
				if (remaining.length > 0) flush();
			}
		}
	}

	if (currentSpans.length > 0) {
		const spans = trim ? trimTrailing(currentSpans) : currentSpans;
		result.push(buildWrappedLine(spans, line));
	}

	return result.length > 0 ? result : [createLine([], { style: line.style })];
};

// renderParagraph

const renderParagraph = (config: ParagraphConfig): WidgetRenderer => {
	return (area: Rect, buf: Buffer): void => {
		if (area.width === 0 || area.height === 0) return;

		let contentArea = area;
		if (config.block !== undefined) {
			renderBlock(config.block)(area, buf);
			contentArea = blockInner(config.block, area);
		}

		if (contentArea.width === 0 || contentArea.height === 0) return;

		bufferSetStyle(buf, contentArea, config.style);

		let lines: readonly Line[] = config.text.lines;
		if (config.wrap !== undefined) {
			const wrapped: Line[] = [];
			for (const ln of lines) {
				for (const wl of wrapLine(ln, contentArea.width, config.wrap.trim)) {
					wrapped.push(wl);
				}
			}
			lines = wrapped;
		}

		const [vScroll, hScroll] = config.scroll;

		for (let i = 0; i < contentArea.height; i++) {
			const lineIdx = i + vScroll;
			if (lineIdx >= lines.length) break;

			const ln = lines[lineIdx];
			if (ln === undefined) continue;

			const lw = lineWidth(ln);
			const alignment = ln.alignment ?? config.alignment;

			let alignOffset: number;
			switch (alignment) {
				case 'left':
					alignOffset = 0;
					break;
				case 'center':
					alignOffset = Math.max(0, Math.floor((contentArea.width - lw) / 2));
					break;
				case 'right':
					alignOffset = Math.max(0, contentArea.width - lw);
					break;
			}

			const y = contentArea.y + i;
			let charPos = 0;
			let pastEnd = false;

			for (const span of ln.spans) {
				if (pastEnd) break;
				const merged = patchStyle(config.style, span.style);
				for (const ch of span.content) {
					const code = ch.codePointAt(0) ?? 0;
					const w = isWideChar(code) ? 2 : 1;
					const screenX = contentArea.x + alignOffset + charPos - hScroll;

					if (screenX >= contentArea.x + contentArea.width) {
						pastEnd = true;
						break;
					}

					if (screenX >= contentArea.x && screenX + w <= contentArea.x + contentArea.width) {
						bufferSetString(buf, screenX, y, ch, merged);
					}

					charPos += w;
				}
			}
		}
	};
};

export type { ParagraphConfig, Wrap };
export { createParagraph, renderParagraph };
