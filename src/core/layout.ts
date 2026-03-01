// Position
interface Position {
	readonly x: number;
	readonly y: number;
}

const createPosition = (x: number, y: number): Position => ({ x, y });

// Size
interface Size {
	readonly width: number;
	readonly height: number;
}

const createSize = (width: number, height: number): Size => ({ width, height });

// Margin
interface Margin {
	readonly top: number;
	readonly right: number;
	readonly bottom: number;
	readonly left: number;
}

const createMargin = (vertical: number, horizontal: number): Margin => ({
	top: vertical,
	right: horizontal,
	bottom: vertical,
	left: horizontal,
});

const uniformMargin = (value: number): Margin => ({
	top: value,
	right: value,
	bottom: value,
	left: value,
});

const NO_MARGIN: Margin = { top: 0, right: 0, bottom: 0, left: 0 };

const noMargin = (): Margin => ({ ...NO_MARGIN });

// Safe u16 clamping
const U16_MAX = 65535;

const clampU16 = (value: number): number => Math.min(U16_MAX, Math.max(0, Math.floor(value)));

// Rect
interface Rect {
	readonly x: number;
	readonly y: number;
	readonly width: number;
	readonly height: number;
}

const EMPTY_RECT: Rect = { x: 0, y: 0, width: 0, height: 0 };

const createRect = (x: number, y: number, width: number, height: number): Rect => ({
	x: clampU16(x),
	y: clampU16(y),
	width: clampU16(width),
	height: clampU16(height),
});

const rectArea = (rect: Rect): number => rect.width * rect.height;

const rectIsEmpty = (rect: Rect): boolean => rect.width === 0 || rect.height === 0;

const rectLeft = (rect: Rect): number => rect.x;

const rectRight = (rect: Rect): number => rect.x + rect.width;

const rectTop = (rect: Rect): number => rect.y;

const rectBottom = (rect: Rect): number => rect.y + rect.height;

const rectContains = (rect: Rect, pos: Position): boolean =>
	pos.x >= rectLeft(rect) &&
	pos.x < rectRight(rect) &&
	pos.y >= rectTop(rect) &&
	pos.y < rectBottom(rect);

const rectInner = (rect: Rect, margin: Margin): Rect => {
	const hMargin = margin.left + margin.right;
	const vMargin = margin.top + margin.bottom;

	if (hMargin > rect.width || vMargin > rect.height) {
		return EMPTY_RECT;
	}

	return createRect(
		rect.x + margin.left,
		rect.y + margin.top,
		rect.width - hMargin,
		rect.height - vMargin,
	);
};

const rectOuter = (rect: Rect, margin: Margin): Rect =>
	createRect(
		rect.x - margin.left,
		rect.y - margin.top,
		rect.width + margin.left + margin.right,
		rect.height + margin.top + margin.bottom,
	);

const rectIntersection = (a: Rect, b: Rect): Rect => {
	const x = Math.max(a.x, b.x);
	const y = Math.max(a.y, b.y);
	const right = Math.min(rectRight(a), rectRight(b));
	const bottom = Math.min(rectBottom(a), rectBottom(b));

	if (right <= x || bottom <= y) {
		return EMPTY_RECT;
	}

	return createRect(x, y, right - x, bottom - y);
};

const rectUnion = (a: Rect, b: Rect): Rect => {
	const x = Math.min(a.x, b.x);
	const y = Math.min(a.y, b.y);
	const right = Math.max(rectRight(a), rectRight(b));
	const bottom = Math.max(rectBottom(a), rectBottom(b));

	return createRect(x, y, right - x, bottom - y);
};

const rectRows = (rect: Rect): readonly Rect[] => {
	const rows: Rect[] = [];
	for (let row = 0; row < rect.height; row++) {
		rows.push(createRect(rect.x, rect.y + row, rect.width, 1));
	}
	return rows;
};

const rectColumns = (rect: Rect): readonly Rect[] => {
	const cols: Rect[] = [];
	for (let col = 0; col < rect.width; col++) {
		cols.push(createRect(rect.x + col, rect.y, 1, rect.height));
	}
	return cols;
};

const rectPositions = (rect: Rect): readonly Position[] => {
	const positions: Position[] = [];
	for (let row = 0; row < rect.height; row++) {
		for (let col = 0; col < rect.width; col++) {
			positions.push(createPosition(rect.x + col, rect.y + row));
		}
	}
	return positions;
};

// Alignment
type Alignment = 'left' | 'center' | 'right';

// Direction
type Direction = 'horizontal' | 'vertical';

// Constraint - discriminated union
interface MinConstraint {
	readonly type: 'min';
	readonly value: number;
}

interface MaxConstraint {
	readonly type: 'max';
	readonly value: number;
}

interface LengthConstraint {
	readonly type: 'length';
	readonly value: number;
}

interface PercentageConstraint {
	readonly type: 'percentage';
	readonly value: number;
}

interface RatioConstraint {
	readonly type: 'ratio';
	readonly numerator: number;
	readonly denominator: number;
}

interface FillConstraint {
	readonly type: 'fill';
	readonly value: number;
}

type Constraint =
	| MinConstraint
	| MaxConstraint
	| LengthConstraint
	| PercentageConstraint
	| RatioConstraint
	| FillConstraint;

const minConstraint = (value: number): Constraint => ({
	type: 'min',
	value,
});

const maxConstraint = (value: number): Constraint => ({
	type: 'max',
	value,
});

const lengthConstraint = (value: number): Constraint => ({
	type: 'length',
	value,
});

const percentageConstraint = (value: number): Constraint => ({
	type: 'percentage',
	value,
});

const ratioConstraint = (numerator: number, denominator: number): Constraint => ({
	type: 'ratio',
	numerator,
	denominator,
});

const fillConstraint = (value: number): Constraint => ({
	type: 'fill',
	value,
});

const applyConstraint = (constraint: Constraint, length: number): number => {
	if (constraint.type === 'min') {
		return Math.max(constraint.value, length);
	}
	if (constraint.type === 'max') {
		return Math.min(constraint.value, length);
	}
	if (constraint.type === 'length') {
		return constraint.value;
	}
	if (constraint.type === 'percentage') {
		return Math.floor((length * constraint.value) / 100);
	}
	if (constraint.type === 'ratio') {
		if (constraint.denominator === 0) {
			return 0;
		}
		return Math.floor((length * constraint.numerator) / constraint.denominator);
	}
	// fill
	return constraint.value;
};

// Spacing - discriminated union
interface SpaceSpacing {
	readonly type: 'space';
	readonly value: number;
}

interface OverlapSpacing {
	readonly type: 'overlap';
	readonly value: number;
}

type Spacing = SpaceSpacing | OverlapSpacing;

// Layout
interface Layout {
	readonly direction: Direction;
	readonly constraints: readonly Constraint[];
	readonly margin: Margin;
	readonly spacing: Spacing;
}

const DEFAULT_SPACING: Spacing = { type: 'space', value: 0 };

const createLayout = (
	constraints: readonly Constraint[],
	overrides?: {
		direction?: Direction;
		margin?: Margin;
		spacing?: Spacing;
	},
): Layout => ({
	direction: overrides?.direction ?? 'vertical',
	constraints: [...constraints],
	margin: overrides?.margin ?? noMargin(),
	spacing: overrides?.spacing ?? DEFAULT_SPACING,
});

const spacingAmount = (spacing: Spacing): number => {
	if (spacing.type === 'space') {
		return spacing.value;
	}
	return -spacing.value;
};

const resolveSize = (constraint: Constraint, available: number): number => {
	if (constraint.type === 'length') {
		return Math.min(constraint.value, available);
	}
	if (constraint.type === 'percentage') {
		return Math.min(Math.floor((available * constraint.value) / 100), available);
	}
	if (constraint.type === 'ratio') {
		if (constraint.denominator === 0) {
			return 0;
		}
		return Math.min(
			Math.floor((available * constraint.numerator) / constraint.denominator),
			available,
		);
	}
	if (constraint.type === 'min') {
		return constraint.value;
	}
	if (constraint.type === 'max') {
		return Math.min(constraint.value, available);
	}
	// fill — resolved in the second pass
	return 0;
};

const splitLayout = (layout: Layout, area: Rect): readonly Rect[] => {
	if (layout.constraints.length === 0) {
		return [];
	}

	const inner = rectInner(area, layout.margin);
	const totalAvailable = layout.direction === 'horizontal' ? inner.width : inner.height;
	const count = layout.constraints.length;
	const gap = spacingAmount(layout.spacing);
	const totalGaps = count > 1 ? gap * (count - 1) : 0;
	const availableForConstraints = Math.max(0, totalAvailable - totalGaps);

	// First pass: resolve non-Fill constraints
	const sizes: number[] = [];
	let usedSpace = 0;
	let fillCount = 0;
	let fillWeightSum = 0;

	for (const constraint of layout.constraints) {
		if (constraint.type === 'fill') {
			sizes.push(0);
			fillCount++;
			fillWeightSum += Math.max(1, constraint.value);
		} else {
			const size = resolveSize(constraint, availableForConstraints);
			sizes.push(size);
			usedSpace += size;
		}
	}

	// Second pass: distribute remaining space among Fill constraints
	if (fillCount > 0) {
		const remaining = Math.max(0, availableForConstraints - usedSpace);
		let distributed = 0;

		for (let i = 0; i < count; i++) {
			const constraint = layout.constraints[i];
			if (constraint === undefined) {
				continue;
			}
			if (constraint.type !== 'fill') {
				continue;
			}

			const weight = Math.max(1, constraint.value);
			const share = Math.floor((remaining * weight) / fillWeightSum);
			sizes[i] = share;
			distributed += share;
		}

		// Give leftover pixels to the last Fill constraint
		const leftover = remaining - distributed;
		if (leftover > 0) {
			for (let i = count - 1; i >= 0; i--) {
				const constraint = layout.constraints[i];
				if (constraint === undefined) {
					continue;
				}
				if (constraint.type !== 'fill') {
					continue;
				}
				sizes[i] = (sizes[i] ?? 0) + leftover;
				break;
			}
		}
	}

	// Clamp sizes so total does not exceed available space
	let totalUsed = 0;
	for (let i = 0; i < count; i++) {
		const size = sizes[i] ?? 0;
		const clamped = Math.max(0, Math.min(size, availableForConstraints - totalUsed));
		sizes[i] = clamped;
		totalUsed += clamped;
	}

	// Build result rects
	const results: Rect[] = [];
	let offset = 0;

	for (let i = 0; i < count; i++) {
		const size = sizes[i] ?? 0;

		if (layout.direction === 'horizontal') {
			results.push(createRect(inner.x + offset, inner.y, size, inner.height));
		} else {
			results.push(createRect(inner.x, inner.y + offset, inner.width, size));
		}

		offset += size + gap;
	}

	return results;
};

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
};

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
};
