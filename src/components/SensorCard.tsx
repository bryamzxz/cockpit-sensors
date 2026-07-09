import React from 'react';
import { Button, Label, Tooltip } from '@patternfly/react-core';
import { OutlinedStarIcon, StarIcon } from '@patternfly/react-icons';

import { Sparkline } from './Sparkline';
import type { Sample } from '../lib/history';
import type { ThresholdState } from '../utils/thresholds';
import { _ } from '../utils/cockpit';

export interface SensorCardProps {
    sensorKey: string;
    chip: string;
    sensorLabel: string;
    source?: string;
    valueDisplay: string;
    unitDisplay?: string;
    threshold: ThresholdState;
    history: Sample[];
    historyUnit?: string;
    statsLine: string;
    isPinned: boolean;
    onTogglePin: (key: string) => void;
    progressPercent?: number;
    thresholdLine?: number;
}

export const SensorCard: React.FC<SensorCardProps> = ({
    sensorKey,
    chip,
    sensorLabel,
    source,
    valueDisplay,
    unitDisplay,
    threshold,
    history,
    historyUnit,
    statsLine,
    isPinned,
    onTogglePin,
    progressPercent,
    thresholdLine,
}) => {
    const cardClasses = ['sensor-card', `sensor-card--${threshold}`].join(' ');

    return (
        <article
            className={cardClasses}
            data-pinned={isPinned}
            data-testid="sensor-card"
            aria-label={`${chip} ${sensorLabel}`}
        >
            <div className="sensor-card__head">
                <div className="sensor-card__title">
                    <div className="sensor-card__sensor" title={sensorLabel}>
                        {sensorLabel}
                    </div>
                    <div className="sensor-card__chip" title={chip}>
                        {chip}
                    </div>
                </div>
                <Tooltip content={isPinned ? _('Unpin sensor') : _('Pin sensor')} entryDelay={300}>
                    <Button
                        variant="plain"
                        onClick={() => onTogglePin(sensorKey)}
                        aria-label={isPinned ? _('Unpin sensor') : _('Pin sensor')}
                        aria-pressed={isPinned}
                        className="sensor-row__pin-btn"
                        data-pinned={isPinned}
                        data-testid="sensor-pin-toggle"
                    >
                        {isPinned ? <StarIcon /> : <OutlinedStarIcon />}
                    </Button>
                </Tooltip>
            </div>

            <div className={`sensor-card__value sensor-reading--${threshold}`}>
                <span>{valueDisplay}</span>
                {unitDisplay && <span className="sensor-card__value-unit">{unitDisplay}</span>}
            </div>

            {typeof progressPercent === 'number' && (
                <div
                    className={`sensor-progress sensor-progress--${threshold}`}
                    role="progressbar"
                    aria-valuenow={Math.round(progressPercent)}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-label={_('Range against threshold')}
                >
                    <span
                        className="sensor-progress__bar"
                        style={{ inlineSize: `${Math.max(0, Math.min(100, progressPercent))}%` }}
                    />
                </div>
            )}

            <div className="sensor-card__spark">
                <Sparkline
                    data={history}
                    threshold={threshold}
                    unit={historyUnit}
                    thresholdLine={thresholdLine}
                />
            </div>

            <div className="sensor-card__footer">
                <span className="sensor-stats">{statsLine}</span>
                {source && (
                    <Label color="grey" isCompact>
                        {source}
                    </Label>
                )}
            </div>
        </article>
    );
};
