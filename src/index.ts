// Core - Style
export type { NamedColor, IndexedColor, RgbColor, NamedColorType, Style } from './core/style';
export {
	Color,
	indexedColor,
	rgbColor,
	Modifier,
	createStyle,
	styleFg,
	styleBg,
	styleAddModifier,
	styleSubModifier,
	patchStyle,
	resetStyle,
} from './core/style';

// Core - Layout
export type {
	Position,
	Size,
	Margin,
	Rect,
	Alignment,
	Direction,
	MinConstraint,
	MaxConstraint,
	LengthConstraint,
	PercentageConstraint,
	RatioConstraint,
	FillConstraint,
	Constraint,
	SpaceSpacing,
	OverlapSpacing,
	Spacing,
	Layout,
} from './core/layout';
export {
	createPosition,
	createSize,
	createMargin,
	uniformMargin,
	noMargin,
	EMPTY_RECT,
	createRect,
	rectArea,
	rectIsEmpty,
	rectLeft,
	rectRight,
	rectTop,
	rectBottom,
	rectContains,
	rectInner,
	rectOuter,
	rectIntersection,
	rectUnion,
	rectRows,
	rectColumns,
	rectPositions,
	minConstraint,
	maxConstraint,
	lengthConstraint,
	percentageConstraint,
	ratioConstraint,
	fillConstraint,
	applyConstraint,
	createLayout,
	splitLayout,
} from './core/layout';

// Core - Buffer
export type { Cell, Buffer, CellDiff } from './core/buffer';
export {
	createCell,
	cellSetSymbol,
	cellSetStyle,
	cellReset,
	cellWidth,
	charWidth,
	createBuffer,
	bufferIndex,
	bufferCell,
	bufferSetCell,
	bufferSetString,
	bufferSetStyle,
	bufferSetLine,
	bufferDiff,
	bufferMerge,
} from './core/buffer';

// Core - Text
export type { Span, Line, Text } from './core/text';
export {
	isWideChar,
	stringWidth,
	createSpan,
	rawSpan,
	styledSpan,
	spanWidth,
	spanPatchStyle,
	createLine,
	rawLine,
	styledLine,
	lineWidth,
	lineHeight,
	linePatchStyle,
	linePushSpan,
	lineAlignment,
	createText,
	rawText,
	styledText,
	textWidth,
	textHeight,
	textPatchStyle,
	textPushLine,
	textPushSpan,
} from './core/text';

// Core - Symbols
export type { BorderSet, BarSet, LineSet, ScrollbarSet, Marker } from './core/symbols';
export { border, bar, line, scrollbar, shade, BRAILLE_OFFSET, BRAILLE_DOTS } from './core/symbols';

// Core - Widget
export type { WidgetRenderer, StatefulWidgetRenderer } from './core/widget';

// Core - Terminal
export type {
	Backend,
	Viewport,
	TerminalOptions,
	Terminal,
	Frame,
	CompletedFrame,
} from './core/terminal';
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
} from './core/terminal';

// Backends
export type { TestBackendState } from './backends/test';
export {
	createTestBackendState,
	createTestBackend,
	testBackendToString,
	testBackendCellAt,
} from './backends/test';

// Widgets - Block
export type { BlockConfig, BorderType, Padding, Title } from './widgets/block';
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
} from './widgets/block';

// Widgets - Paragraph
export type { ParagraphConfig, Wrap } from './widgets/paragraph';
export { createParagraph, renderParagraph } from './widgets/paragraph';

// Widgets - List
export type { ListItem, ListDirection, HighlightSpacing, ListConfig, ListState } from './widgets/list';
export {
	createListItem,
	createList,
	createListState,
	renderList,
	renderStatefulList,
} from './widgets/list';

// Widgets - Table
export type { TableCell, Row, TableConfig, TableState } from './widgets/table';
export {
	createTableCell,
	createRow,
	createTable,
	createTableState,
	renderTable,
	renderStatefulTable,
} from './widgets/table';

// Widgets - Gauge
export type { GaugeConfig, LineGaugeConfig } from './widgets/gauge';
export {
	createGauge,
	gaugePercent,
	renderGauge,
	createLineGauge,
	renderLineGauge,
} from './widgets/gauge';

// Widgets - Tabs
export type { TabsConfig } from './widgets/tabs';
export { createTabs, renderTabs } from './widgets/tabs';

// Widgets - Sparkline
export type { SparklineDirection, SparklineConfig } from './widgets/sparkline';
export { createSparkline, renderSparkline } from './widgets/sparkline';

// Widgets - BarChart
export type { Bar, BarGroup, BarChartDirection, BarChartConfig } from './widgets/barchart';
export { createBar, createBarGroup, createBarChart, renderBarChart } from './widgets/barchart';

// Widgets - Scrollbar
export type { ScrollbarOrientation, ScrollbarConfig, ScrollbarState } from './widgets/scrollbar';
export {
	createScrollbar,
	createScrollbarState,
	renderStatefulScrollbar,
} from './widgets/scrollbar';

// Widgets - Clear
export { renderClear } from './widgets/clear';
