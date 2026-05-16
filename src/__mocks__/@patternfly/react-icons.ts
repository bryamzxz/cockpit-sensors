import React from 'react';

const createIcon = (name: string) => {
    const Icon = () => React.createElement('span', { 'data-icon': name });
    Icon.displayName = name;
    return Icon;
};

export const DownloadIcon = createIcon('DownloadIcon');
export const ClipboardIcon = createIcon('ClipboardIcon');
export const OutlinedStarIcon = createIcon('OutlinedStarIcon');
export const StarIcon = createIcon('StarIcon');
export const SearchIcon = createIcon('SearchIcon');
export const BarsIcon = createIcon('BarsIcon');
export const ThIcon = createIcon('ThIcon');
export const PauseIcon = createIcon('PauseIcon');
export const PlayIcon = createIcon('PlayIcon');
