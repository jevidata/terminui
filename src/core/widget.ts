import type { Buffer } from './buffer';
import type { Rect } from './layout';

// A widget render function takes an area and buffer and renders into it
type WidgetRenderer = (area: Rect, buf: Buffer) => void;

// A stateful widget render function also takes and may mutate state
type StatefulWidgetRenderer<S> = (area: Rect, buf: Buffer, state: S) => void;

export type { WidgetRenderer, StatefulWidgetRenderer };
