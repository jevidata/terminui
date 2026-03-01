/**
 * Alternate Screen Demo
 *
 * Demonstrates rendering to an alternate terminal buffer (like vim, htop, etc.).
 * In a real application, you would use a Node.js backend that enters the alternate
 * screen via ANSI escape codes (\x1b[?1049h) and exits on cleanup (\x1b[?1049l).
 *
 * This example simulates that pattern: it renders multiple frames to show how
 * double-buffered diff rendering works — only changed cells are redrawn between frames.
 *
 * Run: npx tsx examples/alternate-screen.ts
 */
import {
	createTestBackendState,
	createTestBackend,
	testBackendToString,
} from '../src/backends/test';
import {
	createRect,
	createLayout,
	lengthConstraint,
	fillConstraint,
	percentageConstraint,
	splitLayout,
} from '../src/core/layout';
import {
	createStyle,
	styleFg,
	styleBg,
	Color,
	Modifier,
	styleAddModifier,
} from '../src/core/style';
import {
	rawText,
	createText,
	createLine,
	styledSpan,
	rawSpan,
} from '../src/core/text';
import {
	createTerminal,
	terminalDraw,
	frameRenderWidget,
	frameRenderStatefulWidget,
} from '../src/core/terminal';
import { blockBordered, createTitle, renderBlock, createBlock, Borders } from '../src/widgets/block';
import { createParagraph, renderParagraph } from '../src/widgets/paragraph';
import { createList, createListState, renderStatefulList } from '../src/widgets/list';
import { gaugePercent, renderGauge, createLineGauge, renderLineGauge } from '../src/widgets/gauge';
import {
	createBarChart,
	createBar,
	createBarGroup,
	renderBarChart,
} from '../src/widgets/barchart';
import {
	createScrollbar,
	createScrollbarState,
	renderStatefulScrollbar,
} from '../src/widgets/scrollbar';
import { renderClear } from '../src/widgets/clear';
import type { Frame } from '../src/core/terminal';

const WIDTH = 80;
const HEIGHT = 24;

// Simulate a tick counter for animated content
let tick = 0;

const renderFrame = (frame: Frame): void => {
	const area = frame.area;

	// Clear entire frame first (like entering alternate screen)
	frameRenderWidget(frame, renderClear(), area);

	// Outer layout: title(1) | content(fill) | status(1)
	const outerLayout = createLayout([
		lengthConstraint(1),
		fillConstraint(1),
		lengthConstraint(1),
	]);
	const outerChunks = splitLayout(outerLayout, area);
	const titleBar = outerChunks[0]!;
	const contentArea = outerChunks[1]!;
	const statusBar = outerChunks[2]!;

	// Title bar — full-width styled line
	const titleText = createParagraph(
		createText([
			createLine([
				styledSpan(
					' terminui ',
					styleAddModifier(
						styleBg(styleFg(createStyle(), Color.Black), Color.Cyan),
						Modifier.BOLD,
					),
				),
				rawSpan(' Alternate Screen Demo '),
				styledSpan(
					` Frame ${tick} `,
					styleFg(createStyle(), Color.DarkGray),
				),
			]),
		]),
	);
	frameRenderWidget(frame, renderParagraph(titleText), titleBar);

	// Content: left panel(30) | right panel(fill)
	const contentLayout = createLayout(
		[lengthConstraint(30), fillConstraint(1)],
		{ direction: 'horizontal' },
	);
	const contentChunks = splitLayout(contentLayout, contentArea);
	const leftPanel = contentChunks[0]!;
	const rightPanel = contentChunks[1]!;

	// Left panel: list + gauge
	const leftLayout = createLayout([
		fillConstraint(1),
		lengthConstraint(3),
		lengthConstraint(3),
	]);
	const leftChunks = splitLayout(leftLayout, leftPanel);
	const listArea = leftChunks[0]!;
	const gauge1Area = leftChunks[1]!;
	const gauge2Area = leftChunks[2]!;

	// Navigation list with scroll
	const menuItems = [
		'Overview',
		'CPU Usage',
		'Memory',
		'Disk I/O',
		'Network',
		'Processes',
		'Containers',
		'Logs',
		'Alerts',
		'Settings',
	];
	const selectedIdx = tick % menuItems.length;
	const list = createList(menuItems, {
		block: blockBordered({ titles: [createTitle('Navigation')] }),
		highlightStyle: styleBg(styleFg(createStyle(), Color.White), Color.Blue),
		highlightSymbol: '▸ ',
		highlightSpacing: 'always',
	});
	const listState = createListState(selectedIdx);
	frameRenderStatefulWidget(frame, renderStatefulList(list), listArea, listState);

	// Scrollbar alongside the list
	const scrollbar = createScrollbar('verticalRight');
	const scrollState = createScrollbarState(menuItems.length, selectedIdx);
	scrollState.viewportContentLength = listArea.height - 2; // subtract border
	frameRenderStatefulWidget(
		frame,
		renderStatefulScrollbar(scrollbar),
		listArea,
		scrollState,
	);

	// Animated gauge
	const progress = ((tick * 7) % 101);
	const gauge1 = gaugePercent(progress, {
		block: blockBordered({ titles: [createTitle('CPU')] }),
		useUnicode: true,
		gaugeStyle: styleFg(createStyle(), progress > 80 ? Color.Red : Color.Green),
	});
	frameRenderWidget(frame, renderGauge(gauge1), gauge1Area);

	// Line gauge
	const memUsage = ((tick * 3) % 101);
	const lineGauge = createLineGauge({
		ratio: memUsage / 100,
		block: blockBordered({ titles: [createTitle('Memory')] }),
		gaugeStyle: styleFg(createStyle(), Color.Magenta),
	});
	frameRenderWidget(frame, renderLineGauge(lineGauge), gauge2Area);

	// Right panel: bar chart(10) | paragraph(fill)
	const rightLayout = createLayout([lengthConstraint(12), fillConstraint(1)]);
	const rightChunks = splitLayout(rightLayout, rightPanel);
	const barChartArea = rightChunks[0]!;
	const infoArea = rightChunks[1]!;

	// Bar chart with animated data
	const barValues = [3, 7, 2, 5, 9, 4, 6].map((v, i) => {
		const animated = Math.max(0, v + ((tick + i) % 5) - 2);
		return createBar(animated, { textValue: `${animated}` });
	});
	const barChart = createBarChart(
		[createBarGroup(barValues, 'Req/s')],
		{
			block: blockBordered({ titles: [createTitle('Traffic')] }),
			barWidth: 3,
			barGap: 1,
			barStyle: styleFg(createStyle(), Color.LightCyan),
			valueStyle: styleFg(createStyle(), Color.White),
			direction: 'vertical',
		},
	);
	frameRenderWidget(frame, renderBarChart(barChart), barChartArea);

	// Info panel with wrapped text
	const infoText = rawText(
		`terminui is a fast, functional TypeScript library for building terminal UIs.\n\n` +
		`It follows a pure-functional architecture: no classes, no mutation, ` +
		`just plain objects and composable functions.\n\n` +
		`This alternate-screen demo shows:\n` +
		`• Double-buffered rendering (only diffs are flushed)\n` +
		`• Layout system with constraints\n` +
		`• Multiple widget types composing together\n` +
		`• Stateful widgets (list selection, scrollbar)\n` +
		`• Style system with colors and modifiers`,
	);
	const info = createParagraph(infoText, {
		block: blockBordered({
			titles: [createTitle('About')],
			borderType: 'rounded',
		}),
		wrap: { trim: true },
	});
	frameRenderWidget(frame, renderParagraph(info), infoArea);

	// Status bar
	const statusText = createParagraph(
		createText([
			createLine([
				styledSpan(' NORMAL ', styleBg(styleFg(createStyle(), Color.Black), Color.Green)),
				rawSpan('  '),
				styledSpan(`CPU: ${progress}%`, styleFg(createStyle(), progress > 80 ? Color.Red : Color.Green)),
				rawSpan('  │  '),
				styledSpan(`MEM: ${memUsage}%`, styleFg(createStyle(), Color.Magenta)),
				rawSpan('  │  '),
				styledSpan(`Frame: ${tick}`, styleFg(createStyle(), Color.DarkGray)),
			]),
		]),
	);
	frameRenderWidget(frame, renderParagraph(statusText), statusBar);
};

// Simulate alternate screen: render 3 frames to show diff-based rendering
const state = createTestBackendState(WIDTH, HEIGHT);
const backend = createTestBackend(state);
const terminal = createTerminal(backend);

console.log('=== ALTERNATE SCREEN DEMO ===\n');
console.log('Simulating 3 frames of an interactive TUI app.');
console.log('In production, this would run in the alternate terminal buffer.\n');

for (let i = 0; i < 3; i++) {
	tick = i;
	const completed = terminalDraw(terminal, renderFrame);
	console.log(`--- Frame ${i} (diff cells: rendered) ---`);
	console.log(testBackendToString(state));
	console.log();
}

console.log('--- Alternate Screen Demo Complete ---');
console.log(`Rendered 3 frames in a ${WIDTH}x${HEIGHT} terminal using double-buffered diff rendering.`);
console.log('In production, only changed cells would be written to the terminal between frames.');
