import React from 'react';
import { Card, CardBody, Gallery } from '@patternfly/react-core';

import { _ } from '../utils/cockpit';
import type { ThresholdState } from '../utils/thresholds';

export interface SummaryStat {
    label: string;
    value: string;
    unit?: string;
    hint?: string;
    severity?: ThresholdState;
}

export interface SensorSummaryProps {
    stats: SummaryStat[];
    'aria-label'?: string;
}

export const SensorSummary: React.FC<SensorSummaryProps> = ({ stats, 'aria-label': ariaLabel }) => {
    if (stats.length === 0) {
        return null;
    }

    return (
        <Gallery
            hasGutter
            minWidths={{ default: '220px' }}
            className="sensor-summary"
            aria-label={ariaLabel ?? _('Sensor highlights')}
        >
            {stats.map(stat => {
                const severity = stat.severity ?? 'normal';
                return (
                    <Card
                        isCompact
                        key={stat.label}
                        className={`sensor-summary__card--${severity}`}
                        data-testid="sensor-summary-card"
                    >
                        <CardBody>
                            <div className="sensor-summary__label">{stat.label}</div>
                            <div className="sensor-summary__value">
                                <span>{stat.value}</span>
                                {stat.unit && <span className="sensor-summary__unit">{stat.unit}</span>}
                            </div>
                            {stat.hint && <div className="sensor-summary__hint">{stat.hint}</div>}
                        </CardBody>
                    </Card>
                );
            })}
        </Gallery>
    );
};
