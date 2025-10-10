import type { Sample } from '../lib/history';

export interface HistorySeries {
    key: string;
    label: string;
    samples: Sample[];
}

const escapeCell = (value: string): string => {
    if (/[",\n]/.test(value)) {
        return `"${value.replace(/"/g, '""')}"`;
    }

    return value;
};

export const buildHistoryCsv = (series: HistorySeries[]): string => {
    const headers = ['timestamp', ...series.map(item => escapeCell(item.label))];
    const maxLength = Math.max(0, ...series.map(item => item.samples.length));

    const rows: string[] = [headers.join(',')];

    for (let index = 0; index < maxLength; index += 1) {
        let timestamp = '';
        const values: string[] = [];

        for (const item of series) {
            const sample = item.samples[index];
            if (sample) {
                if (!timestamp) {
                    timestamp = new Date(sample.t).toISOString();
                }
                values.push(escapeCell(String(sample.v)));
            } else {
                values.push('');
            }
        }

        rows.push([timestamp, ...values].join(','));
    }

    return rows.join('\n');
};
