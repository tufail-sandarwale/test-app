import type { StyleSpecification } from '@maplibre/maplibre-react-native';

export type MapStyleId = 'streets' | 'bright' | 'light' | 'dark' | 'satellite';

export interface MapStyleOption {
  id: MapStyleId;
  label: string;
  style: string | StyleSpecification;
  dark: boolean;
}

const satellite: StyleSpecification = {
  version: 8,
  sources: {
    satellite: {
      type: 'raster',
      tiles: [
        'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
      ],
      tileSize: 256,
      maxzoom: 19,
      attribution:
        'Powered by Esri. Source: Esri, Vantor, Earthstar Geographics, and the GIS User Community',
    },
  },
  layers: [{ id: 'satellite', type: 'raster', source: 'satellite' }],
};

export const mapStyles: MapStyleOption[] = [
  {
    id: 'streets',
    label: 'Streets',
    style: 'https://tiles.openfreemap.org/styles/liberty',
    dark: false,
  },
  {
    id: 'bright',
    label: 'Bright',
    style: 'https://tiles.openfreemap.org/styles/bright',
    dark: false,
  },
  {
    id: 'light',
    label: 'Light',
    style: 'https://tiles.openfreemap.org/styles/positron',
    dark: false,
  },
  {
    id: 'dark',
    label: 'Dark',
    style: 'https://tiles.openfreemap.org/styles/dark',
    dark: true,
  },
  { id: 'satellite', label: 'Satellite', style: satellite, dark: true },
];

export function mapStyleFor(id: MapStyleId) {
  return mapStyles.find(option => option.id === id) ?? mapStyles[0];
}
