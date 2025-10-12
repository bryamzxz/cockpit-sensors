import React from 'react';
import './Sparkline.scss';

import type { Sample } from '../lib/history';

export interface SparklineProps {
    data: Sample[];
    width?: number;
    height?: number;
}

export const Sparkline: React.FC<SparklineProps> = ({ data, width = 140, height = 32 }) => {
    if (!data.length) {
        return <svg role="img" className="sensor-sparkline" width={width} height={height} aria-hidden="true" />;
    }

    const values = data.map(sample => sample.v);
    const min = Math.min(...values);
    const max = Math.max(...values);
    const range = max - min || 1;

    const points = data
            .map((sample, index) => {
                const x = (index / Math.max(data.length - 1, 1)) * (width - 2) + 1;
                const normalised = (sample.v - min) / range;
                const y = height - 1 - normalised * (height - 2);
                return `${x},${y}`;
            })
            .join(' ');

    return (
        <svg role="img" className="sensor-sparkline" width={width} height={height} aria-hidden="true">
            <polyline points={points} vectorEffect="non-scaling-stroke" />
        </svg>
    );
};
