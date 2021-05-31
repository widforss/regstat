import * as Highcharts from 'highcharts';

const REGIONS_A: {[region: string]: number} = {
    "Nordenskiöld Land": 3003,
    "Finnmarkskysten": 3006,
    "Vest-Finnmark": 3007,
    "Nord-Troms": 3009,
    "Lyngen": 3010,
    "Tromsø": 3011,
    "Sør-Troms": 3012,
    "Indre Troms": 3013,
    "Lofoten og Vesterålen": 3014,
    "Ofoten": 3015,
    "Salten": 3016,
    "Svartisen": 3017,
    "Trollheimen": 3022,
    "Romsdal": 3023,
    "Sunnmøre": 3024,
    "Indre Fjordane": 3027,
    "Jotunheimen": 3028,
    "Indre Sogn": 3029,
    "Voss": 3031,
    "Hallingdal": 3032,
    "Hardanger": 3034,
    "Vest-Telemark": 3035,
    "Heiane": 3037,
};
const REGIONS_B: {[region: string]: number} = {
    "Svalbard øst": 3001,
    "Svalbard vest": 3002,
    "Svalbard sør": 3004,
    "Øst-Finnmark": 3005,
    "Finnmarksvidda": 3008,
    "Helgeland": 3018,
    "Nord-Trøndelag": 3019,
    "Sør-Trøndelag": 3020,
    "Ytre Nordmøre": 3021,
    "Nord-Gudbrandsdalen": 3025,
    "Ytre Fjordane": 3026,
    "Ytre Sogn": 3030,
    "Hordalandskysten": 3033,
    "Rogalandskysten": 3036,
    "Agder sør": 3038,
    "Telemark sør": 3039,
    "Vestfold": 3040,
    "Buskerud sør": 3041,
    "Oppland sør": 3042,
    "Hedmark": 3043,
    "Akershus": 3044,
    "Oslo": 3045,
    "Østfold":3046,
};
const REGIONS: {[region: string]: number} = {...REGIONS_A, ...REGIONS_B};

interface Point {
    y: number,
    actualValue: number,
}

type Season = string;
type ObsDate = string;
type Region = string;
interface Counted {
    [season: string]: {
        [date: string]: {
            [region: string]: {
                observations: {
                    simple: number,
                    advanced: number,
                },
                schemas: {
                    simple: number,
                    advanced: number,
                }
            }
        }
    }
}

interface Charts {
    countChart: Highcharts.Chart,
    accChart: Highcharts.Chart,
    regionChart: Highcharts.Chart,
}

interface Options {
    type: {
        simple: boolean,
        advanced: boolean,
    }
    average: number,
    regions: Region[],
    schema: boolean,
}

interface OptionsDom {
    simple: HTMLInputElement,
    advanced: HTMLInputElement,
    average: HTMLInputElement,
    regionRootA: HTMLInputElement,
    regionRootB: HTMLInputElement,
    regionsA: HTMLInputElement[],
    regionsDivA: HTMLDivElement,
    regionsB: HTMLInputElement[],
    regionsDivB: HTMLDivElement,
    regions: HTMLInputElement[],
    radioObs: HTMLInputElement,
    radioSchema: HTMLInputElement,
}

const SLOTS = 4;
const [START, STOP] = [new Date("1970-09-01"), new Date("1971-09-01")];
const COLORS = {
    BACKGROUND: 'rgb(244,244,244)',
};
const DATE_FORMAT = {
    month: '2-digit',
    day: '2-digit',
};

let charts = showCharts();
let cachedCounted = {};
let knownGoodAverage = 4;

function getOptionsDom(): OptionsDom {
    let domIds = {
        simple: "checkbox-simple",
        advanced: "checkbox-adv",
        average: "avg-num",
        regionRootA: "checkbox-regions-root-a",
        regionRootB: "checkbox-regions-root-b",
        regionsDivA: "regions-list-a",
        regionsDivB: "regions-list-b",
        radioObs: "radio-schema-obs",
        radioSchema: "radio-schema-schema",
    }

    let domObj: {[input: string]: HTMLElement} = {};
    for (let [input, id] of Object.entries(domIds)) {
        domObj[input] = <HTMLInputElement> document.getElementById(id);
    }

    let dom = domObj as any as OptionsDom;
    dom.regionsA = [...document.getElementById("regions-list-a").children]
        .map((elem) => elem.firstChild) as HTMLInputElement[];
    dom.regionsB = [...document.getElementById("regions-list-b").children]
        .map((elem) => elem.firstChild) as HTMLInputElement[];
    dom.regions = [...dom.regionsA, ...dom.regionsB]
        .sort((a, b) =>
            REGIONS[a.name] - REGIONS[b.name]
        );

    return dom
}

function initOptions() {
    let onInput = () => {
        validateOptions();
        populateCharts(cachedCounted, charts);
    };
    let rootCheckbox = (e: Event) => {
        let checkbox = <HTMLInputElement> e.target;
        let children;
        if (checkbox.name == "a") {
            children = <HTMLInputElement[]> oDiv.regionsA;
        } else {
            children = <HTMLInputElement[]> oDiv.regionsB;
        }
        if (checkbox.checked) {
            children.forEach((elem) => {
                elem.checked = true;
            })
        } else {
            [...children].forEach((elem) => {
                elem.checked = false;
            })
        }
        onInput();
    };

    let oDiv = getOptionsDom(); // Not all children populated yet!
    let iterator: [HTMLDivElement, string[]][] = [
        [oDiv.regionsDivA, Object.keys(REGIONS_A)],
        [oDiv.regionsDivB, Object.keys(REGIONS_B)]
    ];

    for (let [div, regions] of iterator) {
        for (let region of regions) {
            let label = <HTMLLabelElement> document.createElement("label");
            let checkbox = <HTMLInputElement> document.createElement("input");
            let name = <HTMLSpanElement> document.createElement("span");
            let br = <HTMLBRElement> document.createElement("br");
            checkbox.type = "checkbox";
            checkbox.checked = true;
            checkbox.name = region;
            name.innerText = region;
            label.appendChild(checkbox);
            label.appendChild(name);
            label.appendChild(br);
            (<HTMLDivElement> div).appendChild(label)
        }
    }

    oDiv = getOptionsDom();
    oDiv.simple.addEventListener('input', onInput);
    oDiv.advanced.addEventListener('input', onInput);
    oDiv.regionRootA.addEventListener('input', rootCheckbox);
    oDiv.regionRootB.addEventListener('input', rootCheckbox);
    oDiv.regions.forEach((elem) => elem.addEventListener("input", onInput))
    oDiv.average.addEventListener('input', () => {
        let value = parseInt(oDiv.average.value);
        if (!isNaN(value) && value > 0 && value <= 20) {
            knownGoodAverage = value;
            oDiv.average.classList.remove("invalid");
            onInput()
        } else {
            oDiv.average.classList.add("invalid");
        }
    });
    oDiv.radioObs.addEventListener("input", () => {
        oDiv.radioSchema.checked = false;
        onInput()
    });
    oDiv.radioSchema.addEventListener("input", () => {
        oDiv.radioObs.checked = false;
        onInput()
    });
}

function validateOptions() {
    let oDiv = getOptionsDom();
    let iterator: [HTMLInputElement, HTMLInputElement[]][] = [
        [oDiv.regionRootA, oDiv.regionsA],
        [oDiv.regionRootB, oDiv.regionsB],
    ];

    for (let [root, regions] of iterator) {
        let activeRegions = regions
            .map((elem) => elem.checked)
            .reduce((acc, value) => acc + (value as unknown as number), 0)
        if (activeRegions == 0) {
            root.indeterminate = false;
            root.checked = false;
        } else if (activeRegions == regions.length) {
            root.indeterminate = false;
            root.checked = true;
        } else {
            root.checked = false;
            root.indeterminate = true;
        }
    }

    let value = parseInt(oDiv.average.value);
    if (isNaN(value) || value < 0 || value > 20) {
        oDiv.average.value = knownGoodAverage.toFixed(0)
    }
}

function getOptions(): Options {
    let oDiv = getOptionsDom();

    let regions = oDiv.regions
        .filter((elem) => elem.checked)
        .map((elem) => elem.name);

    return {
        type: {
            simple: oDiv.simple.checked,
            advanced: oDiv.advanced.checked
        },
        average: parseInt(oDiv.average.value),
        regions,
        schema: oDiv.radioSchema.checked,
    };
}

function showCharts(): Charts {
    let regions = getOptions().regions;
    let countChart = initLineChart(
        'chart-count',
        '',
        `Registered snow observations`,
        START,
        STOP,
    );
    let accChart = initLineChart(
        'chart-acc',
        '',
        'Registered snow observations',
        START,
        STOP,
    );
    let regionChart = initBarChart(
        'chart-regions',
        '',
        'Registered snow observations',
        regions,
    )
    return {
        countChart,
        accChart,
        regionChart,
    };
}

function populateCharts(counted: Counted, charts: Charts) {
    let options = getOptions()
    let simple = options.type.simple;
    let advanced = options.type.advanced;
    let regions = options.regions;
    let schema = options.schema;
    let average = options.average;

    let seasons = makeDataDate(counted, simple, advanced, regions, schema);
    let seasonsRegions = makeDataRegion(counted, simple, advanced, regions, schema);

    charts.countChart.update({
        series: Object.entries(seasons).map(([season, data]) => 
            makeSeries(season, rollingAverage(data, average), "line")
        )
    }, true, true);
    charts.accChart.update({
        series: Object.entries(seasons).map(([season, data]) => 
            makeSeries(season, accumulateData(data), "line")
        )
    }, true, true);
    charts.regionChart.update({
        series: Object.entries(seasonsRegions).map(([season, data]) => {
            let chartData: Point[] = data.map((y) => {
                return {y, actualValue: y}
            });
            return makeSeries(season, chartData, "column")
        }),
        xAxis: {
            categories: regions,
        }
    }, true, true);
}

function rollingAverage(data: number[], slots: number): Point[] {
    let buffer = emptyArray_(slots, 0);
    return [...data].map((elem) => {
        buffer.shift();
        buffer.push(elem);
        return {
            y: buffer.reduce((a, b) => a + b) / buffer.length,
            actualValue: elem,
        };
    });
}

function accumulateData(data: number[]): Point[] {
    let acc: Point[] = []
    data.forEach((elem) => {
        let sum = elem + (acc.length ? acc[acc.length - 1].y : 0);
        acc.push({y: sum, actualValue: elem});
    });
    return acc;
}

function fetchData(
    url: string,
    callback: (counted: Counted) => void,
    retries: number = 5
) {
    let fail = () => { return fetchData(url, callback, retries - 1) }
    if (retries < 0) {
        throw new Error(`Failed to fetch data (${url})!`);
    } else if (retries < 5) {
        console.error(`Failed to fetch data (${url}), retrying (${5 - retries}/5)...`)
    }

    let req = new XMLHttpRequest();
    req.open("GET", url);
    req.onerror = () => {
        return fail();
    }
    req.onload = () => {
        if (req.status < 200 || req.status > 299) { return fail() }

        let json;
        try {
            json = JSON.parse(req.responseText);
        } catch {
            return fail();
        }

        callback(json);
    }
    req.send()
}

function dateRange(start: Date, end: Date): string[] {
    let range = [start];
    let tail: (range: Date[]) => Date = (range) => range.slice(-1)[0];
    while (tail(range).getTime() < end.getTime() - 1000 * 3600 * 24) {
        range.push(new Date(tail(range).getTime() + 1000 * 3600 * 24));
    }
    return range.map((date) => getDate(date));
}

function getDate(date: Date): string {
    let month = (date.getMonth() + 1).toFixed(0);
    let day = date.getDate().toFixed(0);
    return `${day}.${month}.`;
}

function emptyArray_(size: number, value: number): number[] {
    return Array.apply(null, new Array(size)).map(Number.prototype.valueOf, value);
}

function makeDataDate(
    counted: Counted,
    simple: boolean,
    advanced: boolean,
    regions: Region[],
    schemas: boolean = false,
) {
    let datas: {[season: string]: number[]} = {}
    let length = Math.round((STOP.getTime() - START.getTime()) / (1000 * 3600 * 24))
    for (let [season, dates] of Object.entries(counted)) {
        let data = emptyArray_(length, 0);
        for (let [dateStr, obsRegions] of Object.entries(dates)) {
            let date = new Date(dateStr);
            date.setFullYear(START.getFullYear() + (date.getMonth() < START.getMonth() ? 1 : 0));
            let offset = Math.round((date.getTime() - START.getTime()) / (1000 * 3600 * 24));

            if (offset < 0 || offset >= data.length) { continue }

            for (let [region, count] of Object.entries(obsRegions)) {
                if (!regions.includes(region)) { continue }

                let field = schemas ? count.schemas : count.observations;
                if (simple) {
                    data[offset] += field.simple;
                }
                if (advanced) {
                    data[offset] += field.advanced;
                }
            }
        }
        datas[season] = data;
    }
    return datas;
}

function makeDataRegion(
    counted: Counted,
    simple: boolean,
    advanced: boolean,
    regions: Region[],
    schemas: boolean = false,
) {
    let datas: {[season: string]: number[]} = {}
    for (let [season, dates] of Object.entries(counted)) {
        let data = emptyArray_(regions.length, 0);
        for (let obsRegions of Object.values(dates)) {
            for (let [region, count] of Object.entries(obsRegions)) {
                if (!regions.includes(region)) { continue }

                let offset = regions.indexOf(region);
                let field = schemas ? count.schemas : count.observations;
                if (simple) {
                    data[offset] += field.simple;
                }
                if (advanced) {
                    data[offset] += field.advanced;
                }
            }
        }
        datas[season] = data;
    }
    return datas;
}

function makeSeries(
    title: string,
    data: Point[]|number[],
    type: "line" | "column",    
): Highcharts.SeriesLineOptions | Highcharts.SeriesColumnOptions {
    return {
        name: title,
        data,
        type,
    };
}

function initLineChart(
    div: string,
    title: string,
    yText: string,
    start: Date,
    stop: Date
) {
    let dates = dateRange(start, stop);
    return Highcharts.chart(
        div,
        chartTemplate(title, "line", yText, dates),
        () => null
    );
}

function initBarChart(
    div: string,
    title: string,
    yText: string,
    labels: string[],
) {
    return Highcharts.chart(
        div,
        chartTemplate(title, "column", yText, labels),
        () => null
    );
}

function chartTemplate(title: string, type: string, yText: string, labels: string[]) {
    return {
        chart: {
            type: type,
            backgroundColor: COLORS.BACKGROUND,
            style: {
                fontFamily: 'Source Sans Pro, sans-serif',
            }
        },
        title: {
            text: title,
            style: {
                fontSize: '24px',
            }
        },
        xAxis: {
            categories: labels,
            labels: {
                style: {
                    fontSize: '14px',
                }
            }
        },
        yAxis: {
            allowDecimals: false,
            title: {
                text: yText,
                style: {
                    fontSize: '20px',
                    fontWeight: '600',
                }
            },
            labels: {
                style: {
                    fontSize: '14px',
                }
            }
        },
        legend: {
            itemStyle: {
                fontSize: '14px',
                fontWeight: '400',
            }
        },
        tooltip: {
            headerFormat: '<span style="font-size: 12px">{point.key}</span><br/>',
            pointFormat: '<span style="color:{point.color}">\u25CF</span> {series.name}: <b>{point.actualValue}</b><br/>',
            style: {
                fontSize: '14px'
            }
        },
        series: [] as any,
    }
}

initOptions();
fetchData("./api/count", (counted) => {
    cachedCounted = counted;
    populateCharts(counted, charts)
})