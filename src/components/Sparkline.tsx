import React from 'react';
import './Sparkline.scss';

import type { Sample } from '../lib/history';
import type { ThresholdState } from '../utils/thresholds';
import { _, format } from '../utils/cockpit';

export interface SparklineProps {
    data: Sample[];
    width?: number;
    height?: number;
    threshold?: ThresholdState;
    unit?: string;
    /** When true, render a subtle area fill below the trace. */
    area?: boolean;
    /** Optional threshold marker (e.g. high/critical) drawn as a horizontal guide. */
    thresholdLine?: number;
}

const DEFAULT_WIDTH = 156;
const DEFAULT_HEIGHT = 40;

const formatTooltipValue = (value: number, unit?: string): string => {
    const formatted = Math.abs(value) < 10 ? value.toFixed(2) : value.toFixed(1);
    return unit ? `${formatted} ${unit}` : formatted;
};

export const Sparkline: React.FC<SparklineProps> = ({
    data,
    width = DEFAULT_WIDTH,
    height = DEFAULT_HEIGHT,
    threshold = 'normal',
    unit,
    area = true,
    thresholdLine,
}) => {
    const reactId = React.useId();
    const gradientId = `sensor-spark-${reactId.replace(/[:]/g, '-')}`;

    const [hover, setHover] = React.useState<{ x: number; y: number; value: number } | null>(null);
    const svgRef = React.useRef<SVGSVGElement>(null);

    if (data.length === 0) {
        return (
            <svg
                role="img"
                className="sensor-sparkline sensor-sparkline--empty"
                width={width}
                height={height}
                aria-hidden="true"
            >
                <line
                    className="sensor-sparkline__baseline"
                    x1={1}
                    x2={width - 1}
                    y1={height / 2}
                    y2={height / 2}
                />
            </svg>
        );
    }

    const values = data.map(sample => sample.v);
    const dataMin = Math.min(...values);
    const dataMax = Math.max(...values);
    // Enforce a minimum vertical span so a stable sensor with ±0.3 units of
    // jitter reads as a flat line instead of full-amplitude waves.
    const MIN_SPAN = 2;
    const rawSpan = dataMax - dataMin;
    const padding = Math.max(rawSpan * 0.15, (MIN_SPAN - rawSpan) / 2, 0.25);
    const min = dataMin - padding;
    const max = dataMax + padding;
    const range = max - min || 1;

    const inset = 1.5;
    const drawableHeight = height - inset * 2;
    const drawableWidth = width - inset * 2;

    const xForIndex = (index: number) =>
        (index / Math.max(data.length - 1, 1)) * drawableWidth + inset;
    const yForValue = (value: number) =>
        height - inset - ((value - min) / range) * drawableHeight;

    const points = data
            .map((sample, index) => `${xForIndex(index).toFixed(2)},${yForValue(sample.v).toFixed(2)}`)
            .join(' ');

    const areaPath = (() => {
        if (!area || data.length < 2) {
            return null;
        }

        const first = `${xForIndex(0).toFixed(2)},${yForValue(data[0].v).toFixed(2)}`;
        const last = `${xForIndex(data.length - 1).toFixed(2)},${yForValue(data[data.length - 1].v).toFixed(2)}`;
        const middle = data
                .slice(1, -1)
                .map((sample, index) => `${xForIndex(index + 1).toFixed(2)},${yForValue(sample.v).toFixed(2)}`)
                .join(' ');

        const lineSegments = [first, middle, last].filter(Boolean).join(' ');
        return `M${inset.toFixed(2)},${(height - inset).toFixed(2)} L${lineSegments} L${(width - inset).toFixed(2)},${(height - inset).toFixed(2)} Z`;
    })();

    const handlePointerMove: React.PointerEventHandler<SVGSVGElement> = event => {
        const svg = svgRef.current;
        if (!svg) {
            return;
        }

        const rect = svg.getBoundingClientRect();
        const localX = event.clientX - rect.left;
        const ratio = Math.max(0, Math.min(1, (localX - inset) / drawableWidth));
        const index = Math.round(ratio * (data.length - 1));
        const sample = data[index];

        if (!sample) {
            setHover(null);
            return;
        }

        setHover({
            x: xForIndex(index),
            y: yForValue(sample.v),
            value: sample.v,
        });
    };

    const handlePointerLeave = () => setHover(null);

    const thresholdY =
        typeof thresholdLine === 'number' && Number.isFinite(thresholdLine) && thresholdLine >= min && thresholdLine <= max
            ? yForValue(thresholdLine)
            : null;

    return (
        <svg
            ref={svgRef}
            role="img"
            className={`sensor-sparkline sensor-sparkline--${threshold}`}
            width={width}
            height={height}
            aria-label={format(_('Trend with $0 samples'), data.length)}
            onPointerMove={handlePointerMove}
            onPointerLeave={handlePointerLeave}
        >
            <defs>
                <linearGradient id={gradientId} x1="0" x2="0" y1="0" y2="1">
                    <stop offset="0%" className="sensor-sparkline__gradient-top" />
                    <stop offset="100%" className="sensor-sparkline__gradient-bottom" />
                </linearGradient>
            </defs>
            <line
                className="sensor-sparkline__baseline"
                x1={1}
                x2={width - 1}
                y1={height - inset}
                y2={height - inset}
            />
            {thresholdY !== null && (
                <line
                    className="sensor-sparkline__threshold"
                    x1={1}
                    x2={width - 1}
                    y1={thresholdY}
                    y2={thresholdY}
                />
            )}
            {areaPath && <path d={areaPath} className="sensor-sparkline__area" fill={`url(#${gradientId})`} />}
            <polyline points={points} vectorEffect="non-scaling-stroke" />
            {hover && (
                <>
                    <line
                        className="sensor-sparkline__cursor"
                        x1={hover.x}
                        x2={hover.x}
                        y1={inset}
                        y2={height - inset}
                    />
                    <circle cx={hover.x} cy={hover.y} r={3} className="sensor-sparkline__dot" />
                    <text
                        className="sensor-sparkline__tooltip"
                        x={Math.min(Math.max(hover.x, 22), width - 22)}
                        y={hover.y - 6 < 10 ? hover.y + 14 : hover.y - 6}
                        textAnchor="middle"
                    >
                        {formatTooltipValue(hover.value, unit)}
                    </text>
                </>
            )}
        </svg>
    );
};
