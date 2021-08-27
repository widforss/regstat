import {Counted, populateCharts, showCharts} from "./chart";
import { fetchData } from "./download";
import {initOptions} from "./option";

let charts = showCharts();
fetchData<Counted>("./api/count", (counted) => {
    initOptions(counted, charts);
    populateCharts(counted, charts)
})