import {Counted, populateCharts, showCharts} from "./chart";
import { fetchData } from "./download";
import { initMap } from "./ol";
import {initOptions} from "./option";

let charts = showCharts();
let ol = initMap();
fetchData<Counted>("./api/count", (counted) => {
    initOptions(counted, charts, ol);
    populateCharts(counted, charts, ol);
})