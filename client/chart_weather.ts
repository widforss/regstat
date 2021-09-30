import * as Highcharts from 'highcharts';
import { reduce } from '../webpack.config';
import { chartTemplate, emptyArray_, makeSeries, Point } from './chart';
import { COLORS, MARKERS } from './color';

type Charts = {[problem: string]: Highcharts.Chart};

interface Options {
    region: HTMLSelectElement,
    param: HTMLSelectElement,
    date: HTMLInputElement,
    normalize: HTMLInputElement,
}
type Param = "vind" | "temperatur (min)" | "temperatur (max)" | "nedbør (snitt)" | "nedbør (max)"

type DangerLevel = number;
type Problem = number;
type Warning = [DangerLevel, Problem[], Weather];
interface Counted {
    [region: string]: {
        [year: number]: {
            [month: number]: {
                [day: string]: Warning
            }
        }
    }
}

interface Weather {[tid: number]: {
    [subtid: number]: number
}}

const ALL_REGIONS: string = "Alle regioner";
const ALL_PROBLEMS: string = "Alle skredproblem";

const WIND_SPEEDS: {[speed: number]: string} = {
    0: 'Stille/svak vind',
    6: 'Bris',
    9: 'Frisk bris',
    12: 'Liten kuling',
    16: 'Stiv kuling',
    19: 'Sterk kuling',
    23: 'Liten storm',
    26: 'Storm',
    35: 'Orkan',
};

const PROBLEMS: string[] = [
    ALL_PROBLEMS,
    'Fokksnø',
    'Nysnø (flakskred)',
    'Våt snø (flakskred)',
    'Vedvarende svakt lag',
    'Nysnø (løssnøskred)',
    'Wet snow (løssnøskred)',
    'Glideskred',
];

const PROBLEMS_ID: {[tid: number]: number} = {
    3: 5,
    5: 6,
    7: 2,
    10: 1,
    30: 4,
    37: 4,
    45: 3,
    50: 7,
};

const X_TITLE: {[name: string]: string} = {
    "vind": "Vindhastighet",
    "temperatur (min)": "Temperatur (min) [°C]",
    "temperatur (max)": "Temperatur (max) [°C]",
    "nedbør (max)": "Nedbør (max) [mm/24h]",
    "nedbør (snitt)": "Nedbør (snitt) [mm/24h]",
};

const Y_TITLE: {[normalized: number]: string} = {
    1: "P(verdi|faregrad)",
    0: "n",
};

const GET: {[name: string]: (warning: Warning) => number | string} = {
    "vind": (warning) => WIND_SPEEDS[warning[2][20][20]],
    "temperatur (min)": (warning) => warning[2][40][30],
    "temperatur (max)": (warning) => warning[2][40][40],
    "nedbør (max)": (warning) => warning[2][10][60],
    "nedbør (snitt)": (warning) => warning[2][10][70],
};

function addCharts(counted: Counted, template: Options): Options {
    let root = document.getElementById("weather-charts");
    let container = document.createElement("div");
    container.classList.add("weather-charts-container");

    let close = () => { root.removeChild(container) };

    let options = initOptions(counted, close, container, template);
    for (let option of Object.values(options)) {
        option.addEventListener("input", () => initWeather(counted, charts, options))
    }

    let charts: {[problem: string]: Highcharts.Chart} = {};
    for (let problem of PROBLEMS) {
        let chartDiv = document.createElement("div");
        chartDiv.classList.add("weather-chart");
        chartDiv.classList.add("bottom-margin");

        let chart = initSplineChart(chartDiv, problem, '', [...Object.values(WIND_SPEEDS)]);
        chart.update({
            yAxis: [{}, {max: 1, min: 0, visible: false}],
            chart: {
                alignTicks: false,
            }
        });
        charts[problem] = chart;
        container.appendChild(chartDiv);
    }
    root.insertBefore(container, root.childNodes[root.childNodes.length - 1]);

    initWeather(counted, charts, options);

    return options;
}

function initOptions(
    counted: Counted,
    close: () => void,
    container: HTMLDivElement,
    template: Options,
): Options {
    let today2 = new Date(new Date().setDate(new Date().getDate() + 2));
    let dateStr = getDateStr(today2);

    let optionsDiv = document.createElement("div");
    let dateDiv = document.createElement("div");
    let paramDiv = document.createElement("div");
    let regionDiv = document.createElement("div");
    let normalizeDiv = document.createElement("div");
    optionsDiv.classList.add("bottom-margin");
    optionsDiv.classList.add("weather-options");
    container.appendChild(optionsDiv);

    let closeDiv = document.createElement("span");
    closeDiv.id = "close-cross";
    closeDiv.innerText = "✕";
    closeDiv.onclick = close;
    optionsDiv.appendChild(closeDiv);

    let dateSelector = document.createElement("input");
    let dateTitle = document.createElement("span");
    dateTitle.innerText = "Dato: ";
    dateSelector.min = "2017-09-01";
    dateSelector.max = dateStr;
    dateSelector.value = template ? template.date.value : getDateStr(new Date());
    dateSelector.type = "date";
    dateDiv.appendChild(dateTitle);
    dateDiv.appendChild(dateSelector);
    optionsDiv.appendChild(dateDiv);

    let paramSelector = document.createElement("select");
    let paramTitle = document.createElement("span");
    paramTitle.innerText = "Parameter: ";
    paramDiv.appendChild(paramTitle);
    paramDiv.appendChild(paramSelector);
    for (let param of ["Vind", "Temperatur (max)", "Temperatur (min)", "Nedbør (max)", "Nedbør (snitt)"]) {
        let paramOption = document.createElement("option");
        paramOption.value = param.toLowerCase();
        paramOption.innerText = param;
        if (!template && param == "vind" || template && param.toLowerCase() == template.param.value) {
            paramOption.selected = true;
        }
        paramSelector.appendChild(paramOption);
    }
    optionsDiv.appendChild(paramDiv);

    let regionSelector = document.createElement("select");
    let regionTitle = document.createElement("span");
    regionTitle.innerText = "Region: ";
    regionDiv.appendChild(regionTitle);
    regionDiv.appendChild(regionSelector);
    for (let region of [ALL_REGIONS].concat(Object.keys(counted))) {
        let regionOption = document.createElement("option");
        regionOption.value = region;
        regionOption.innerText = region;
        if (!template && region == ALL_REGIONS || template && region == template.region.value) {
            regionOption.selected = true;
        }
        regionSelector.appendChild(regionOption);
    }
    optionsDiv.appendChild(regionDiv);

    let normalizeCheckbox = document.createElement("input");
    let normalizeTitle = document.createElement("span");
    normalizeTitle.innerText = "Normalisere: "
    normalizeCheckbox.type = "checkbox";
    normalizeCheckbox.checked = template ? template.normalize.checked : false;
    normalizeDiv.appendChild(normalizeTitle);
    normalizeDiv.appendChild(normalizeCheckbox);
    optionsDiv.appendChild(normalizeDiv);

    return {
        region: regionSelector,
        param: paramSelector,
        date: dateSelector,
        normalize: normalizeCheckbox,
    }
}

function initWeather(counted: Counted, charts: Charts, options: Options) {
    let region = options.region.value;
    let date = new Date(options.date.value);
    let param = options.param.value as Param;
    let normalizeOption = options.normalize.checked;
    let labels = null;

    let data;
    if (param == "vind") {
        labels = Object.values(WIND_SPEEDS);
        data = makeDataCat(counted, labels, param, region);
        Object.values(charts).forEach((chart) => chart.update({xAxis: {max: null, min: null}}));
    } else {
        data = makeDataScal(counted, param, region);
        let dataPoints = Object.values(data).map((dls) => Object.values(dls)).flat(2);
        let minPoint = Math.min(...dataPoints.filter(n => !isNaN(Number(n))));
        let maxPoint = Math.max(...dataPoints.filter(n => !isNaN(Number(n))));
        Object.values(charts).forEach((chart) => chart.update({xAxis: {max: maxPoint, min: minPoint}}));
    }

    let dayVal = dayValue(date, counted, labels, param, region);
    let isDayVal;
    if (labels) {
        isDayVal = Boolean(dayVal.reduce((acc, elem) => acc + elem.y, 0))
    } else {
        isDayVal = Boolean(dayVal.length);
    }
    let daySeries = makeSeries(
        `${date.getDate()}.${date.getMonth() + 1}.${date.getFullYear()}`,
        dayVal,
        "column"
    ) as Highcharts.SeriesColumnOptions;
    daySeries.id = "day";
    daySeries.yAxis = 1;
    daySeries.maxPointWidth = 5;
    daySeries.color = COLORS.BLACK;
    daySeries.zIndex = -1;
    daySeries.legendIndex = 5;
    daySeries.tooltip = {
        pointFormat: '<span style="color:{point.color}">\u25CF</span> {series.name}<br/>',
    };

    for (let problem of PROBLEMS) {
        let series: Highcharts.SeriesOptionsType[];
        if (problem in data) {
            series = Object.entries(data[problem]).map(([dl, data]) => {
                let length = param == "vind" ? data.reduce((ack, v) => ack + v, 0) : data.length;
                if (length < 10) {
                    return null;
                }
                let points = param == "vind" ? normalize(data, normalizeOption) : reduceY(data, normalizeOption);
                let series: Highcharts.SeriesSplineOptions = makeSeries(dl, points, "spline", dl) as Highcharts.SeriesSplineOptions;
                series.color = COLORS[`DL${dl}`];
                series.legendIndex = Number(dl);
                series.marker = {symbol: MARKERS[`DL${dl}`]};
                series.turboThreshold = 0;
                return series;
            }).filter((series) => series !== null);
        } else {
            series = [];
        }

        
        if (isDayVal) {
            charts[problem].update({
                series: [daySeries, ...series],
                xAxis: {
                    categories: param == "vind" ? labels : null,
                    title: {text: X_TITLE[param]},
                },
                yAxis: [{
                    title: {text: Y_TITLE[Number(normalizeOption)]}
                }, {max: 1, min: 0}]
            }, true, true);
        } else {
            charts[problem].update({
                series,
                xAxis: {
                    categories: param == "vind" ? labels : null,
                    title: {text: X_TITLE[param]},
                },
                yAxis: [{
                    title: {text: Y_TITLE[Number(normalizeOption)]}
                }, {max: 1, min: 0, visible: false}]
            }, true, true);
        }
    }
}

function dayValue(
    date: Date,
    counted: Counted,
    labels: string[],
    parameter: Param,
    filterRegion: string,
): Point[] {
    let data: Point[] = [];
    let year = date.getFullYear();
    let month = date.getMonth() + 1;
    let day = date.getDate();
    try {
        let val = GET[parameter](counted[filterRegion][year][month][day]);
        if (labels){
            data = Array.from([...Array(labels.length).keys()].map((i) => {
                return {x: i, y: 0, actualValue: 0}
            }));
            let offset = labels.indexOf(val as string);
            if (offset >= 0) {
                data[offset] = {x: offset, y: 1, actualValue: val};
            }
        } else {
            data.push({x: val as number, y: 1, actualValue: val});
        }
    } catch {}
    return data;
}

function makeDataCat(
    counted: Counted,
    labels: string[],
    parameter: Param,
    filterRegion: string,
): {[problem: string]: {[dl: number]: number[]}} {
    let d: {[problem: string]: {[dl: number]: number[]}} = {};
    d[ALL_PROBLEMS] = {}

    for (let [region, years] of Object.entries(counted) as [string, any][]) {
        if (region != filterRegion && filterRegion != ALL_REGIONS) { continue }

        for (let [_, months] of Object.entries(years) as any as [any, any][]) {
            for (let [_, days] of Object.entries(months) as any as [any, any][]) {
                for (let [_, warning] of Object.entries(days) as any as [any, any]) {
                    let [dl, problems, _] = warning;
                    problems = unique(problems).map((p: number) => PROBLEMS[PROBLEMS_ID[p]]);

                    let datum;
                    try {
                        datum = GET[parameter](warning);
                    } catch {
                        continue;
                    }

                    if (!(dl in d[ALL_PROBLEMS])) {
                        d[ALL_PROBLEMS][dl] = emptyArray_(labels.length, 0);
                    }
                    for (let problem of problems) {
                        if (!(problem in d)) {
                            d[problem] = {};
                        }
                        if (!(dl in d[problem])) {
                            d[problem][dl] = emptyArray_(labels.length, 0);
                        }
                        let data = d[problem][dl];

                        let offset = labels.indexOf(datum as string);
                        if (offset < 0 || offset >= data.length) { continue }

                        data[offset] += 1;
                        d[ALL_PROBLEMS][dl][offset] += 1;
                    }
                }
            }
        }
    }
    return d;
}

function makeDataScal(
    counted: Counted,
    parameter: Param,
    filterRegion: string,
): {[problem: string]: {[dl: number]: number[]}} {
    let d: {[problem: string]: {[dl: number]: number[]}} = {};
    d[ALL_PROBLEMS] = {}

    for (let [region, years] of Object.entries(counted) as [string, any][]) {
        if (region != filterRegion && filterRegion != ALL_REGIONS) { continue }

        for (let [_, months] of Object.entries(years) as any as [any, any][]) {
            for (let [_, days] of Object.entries(months) as any as [any, any][]) {
                for (let [_, warning] of Object.entries(days) as any as [any, any]) {
                    let [dl, problems, _] = warning;
                    problems = unique(problems).map((p: number) => PROBLEMS[PROBLEMS_ID[p]]);

                    let datum;
                    try {
                        datum = GET[parameter](warning) as number;
                    } catch {
                        continue;
                    }

                    if (!(dl in d[ALL_PROBLEMS])) {
                        d[ALL_PROBLEMS][dl] = [];
                    }
                    for (let problem of problems) {
                        if (!(problem in d)) {
                            d[problem] = {};
                        }
                        if (!(dl in d[problem])) {
                            d[problem][dl] = [];
                        }
                        d[problem][dl].push(datum);
                        d[ALL_PROBLEMS][dl].push(datum);
                    }
                }
            }
        }
    }
    return d;
}

function initSplineChart(
    div: string | HTMLElement,
    title: string,
    yText: string,
    labels: string[]
) {
    return Highcharts.chart(
        div,
        chartTemplate(title, "spline", yText, labels),
        () => null
    );
}

function normalize(data: number[], normalize: boolean): Point[] {
    let sum: number = data.reduce((acc, datum) => acc + datum);
    let normedData: Point[] = [];
    data.forEach((datum, i) => {
        let normed;
        if (normalize) {
            normed = sum ? datum / sum : 0;
        } else {
            normed = datum;
        }
        normedData.push({y: normed, x: i, actualValue: datum});
    });
    return normedData;
}

function reduceY(data: number[], normalize: boolean): Point[] {
    let d: {[datum: number]: number} = {};
    data.forEach((datum) => {
        if (!(datum in d)) {
            d[datum] = 1;
        } else {
            d[datum] += 1
        }
    });
    let sum: number = data.length;
    let normedData: Point[] = [];
    Object.entries(d).forEach(([datum, amount]) => {
        let normed;
        if (normalize) {
            normed = sum ? amount /sum : 0;
        } else {
            normed = amount;
        }
        if (!isNaN(Number(datum))) {
            normedData.push({x: Number(datum), y: normed, actualValue: amount});
        }
    });
    return normedData.sort((a, b) => a.x - b.x);
}

function unique<T>(data: T[]): T[] {
    return data.filter((v: T, i: number, s: T[]) =>
        s.indexOf(v) === i
    )
}

function getDateStr(date: Date): string {
    let year = date.getFullYear();
    let month = (date.getMonth() + 1).toFixed(0).padStart(2, "0");
    let day = date.getDate().toFixed(0).padStart(2, "0");
    return `${year}-${month}-${day}`
}

export {initWeather, addCharts, Charts, Counted, Options};