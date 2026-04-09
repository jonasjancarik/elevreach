import { indexFromLatLng, type TerrainDataset } from './terrain';

export interface ExtraTraversalEdge {
  fromIndex: number;
  toIndex: number;
  cost: number;
}

interface RawConnector {
  cost: number;
  from: {
    lat: number;
    lng: number;
  };
  to: {
    lat: number;
    lng: number;
  };
}

const PRAGUE_PATTERN = /(^|,|\s)(prague|praha)(,|\s|$)/i;

const PRAGUE_CONNECTORS: RawConnector[] = [
  {
    cost: 0,
    // Bridge deck portals at the north/south ends of Nuselsky most.
    from: { lat: 50.068252, lng: 14.430355 },
    to: { lat: 50.062986, lng: 14.430456 },
  },
];

export function resolveCityExtraEdges(
  dataset: TerrainDataset,
  cityQuery: string,
  cityLabel: string,
) {
  if (!isPrague(cityQuery, cityLabel)) {
    return [];
  }

  return PRAGUE_CONNECTORS.flatMap((connector) => {
    const fromIndex = indexFromLatLng(dataset, connector.from.lng, connector.from.lat);
    const toIndex = indexFromLatLng(dataset, connector.to.lng, connector.to.lat);

    if (fromIndex === null || toIndex === null || fromIndex === toIndex) {
      return [];
    }

    return [
      {
        fromIndex,
        toIndex,
        cost: connector.cost,
      } satisfies ExtraTraversalEdge,
    ];
  });
}

function isPrague(...values: string[]) {
  return values.some((value) => PRAGUE_PATTERN.test(value));
}
