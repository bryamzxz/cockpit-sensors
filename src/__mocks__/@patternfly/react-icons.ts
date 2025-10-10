import React from 'react';

const createIcon = (name: string) => () => React.createElement('span', { "data-icon": name });

export const DownloadIcon = createIcon('DownloadIcon');
export const OutlinedStarIcon = createIcon('OutlinedStarIcon');
export const StarIcon = createIcon('StarIcon');
export const SearchIcon = createIcon('SearchIcon');
