import * as Layer from "./ol/layer";
import Feature from "ol/Feature";
import Polygon from "ol/geom/Polygon";
import Group from "ol/layer/Group";
import Map from "ol/Map";
import { Counted, getSeason, Obs, startStop, Position } from "./chart";
import { getOptions } from "./option";
import { Region } from "./region";
import Point from "ol/geom/Point";
import { createHeatmapLayer } from "./ol/layer";
import { Heatmap } from "ol/layer";

interface Ol {
    map: Map,
    heatmap: Heatmap,
}

// Keeps track of the number of times basemap tiles has failed to load.
let backoff_counter_bw: Record<string, number> = {};

function initMap(): Ol {
    let regions: Record<string, Feature<Polygon>> = {};
    let backoff_counter_bw: Record<string, number> = {};
    let backoff_counter_color: Record<string, number> = {};

    let baseLayerBw = Layer.createBaseLayer('topo4graatone', backoff_counter_bw);
    baseLayerBw.setZIndex(0);

    let regionLayer = Layer.createRegionLayer();

    let heatmap = createHeatmapLayer([]);

    let baseGroup = new Group({
        layers: [
            baseLayerBw,
        ]
    });
    baseGroup.set('title', 'Baselayers');
    let extraGroup = new Group({
        layers: [
        ]
    });
    extraGroup.set('title', 'Overlays');

    let layers = [
        regionLayer,
        heatmap,
        extraGroup,
        baseGroup,
    ];

    return {
        map: Layer.createMap(layers),
        heatmap: heatmap,
    };
}

function populateMap(
    counted: Counted,
    filter: (obses: Obs[]) => Obs[],
    regions: Region[],
    hydrologicalYear: boolean = true,
    leap: boolean = false,
    ol: Ol,
) {
    let seasons: {[season: string]: [number, number][]} = {}
    let points: Position[] = [];
    let start = startStop(hydrologicalYear, leap)[0];
    for (let [region, years] of Object.entries(counted) as [string, any][]) {
        if (!regions.includes(region)) { continue }

        let hydroRemovedFirst = false;
        for (let [year, months] of Object.entries(years) as any as [number, any][]) {
            if (!hydrologicalYear && !hydroRemovedFirst) {
                hydroRemovedFirst = true;
                continue;
            }
            for (let [month, days] of Object.entries(months) as any as [number, any][]) {
                for (let [day, obses] of Object.entries(days) as any as [number, Obs[]][]) {
                    let date = new Date(year, month - 1, day);
                    let season = getSeason(date, hydrologicalYear);
                    let addYear = date.getMonth() < start.getMonth() ? 1 : 0;
                    date.setFullYear(start.getFullYear() + addYear);
                    if (!(season in seasons)) {
                        seasons[season] = [];
                    }
                    for (let obs of filter(obses)) {
                        let [lat, lon] = obs[3]
                        points.push([lon, lat]);
                    }
                }
            }
        }
    }
    ol.map.removeLayer(ol.heatmap)
    let newLayer = createHeatmapLayer(points);
    ol.map.addLayer(newLayer);
    ol.heatmap = newLayer;
}

export { initMap, populateMap, Ol };