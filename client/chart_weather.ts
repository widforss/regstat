import * as Highcharts from 'highcharts';
import { reduce } from '../webpack.config';
import { chartTemplate, emptyArray_, makeSeries, Point } from './chart';
import { COLORS } from './color';

type Charts = {[problem: string]: Highcharts.Chart};

interface Options {
    region: HTMLSelectElement,
    param: HTMLSelectElement,
    date: HTMLInputElement,
}
type Param = "wind" | "temp (min)" | "temp (max)" | "downfall (mean)" | "downfall (max)"

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

const WIND_SPEEDS: {[spped: number]: string} = {
    0: 'Calm',
    6: 'Breeze',
    9: 'Fresh breeze',
    12: 'Strong breeze',
    16: 'Moderate gale',
    19: 'Gale',
    23: 'Strong gale',
    26: 'Storm',
    35: 'Hurricane force',
};

const PROBLEMS: string[] = [
    'Wind-drifted snow',
    'PWL',
    'New snow (slab)',
    'Wet snow (slab)',
    'New snow (loose)',
    'Wet snow (loose)',
    'Glide',
];

const PROBLEMS_ID: {[tid: number]: number} = {
    3: 4,
    5: 5,
    7: 2,
    10: 0,
    30: 1,
    37: 1,
    45: 3,
    50: 6,
};

const GET: {[name: string]: (warning: Warning) => number | string} = {
    wind: (warning) => WIND_SPEEDS[warning[2][20][20]],
    "temp (min)": (warning) => warning[2][40][30],
    "temp (max)": (warning) => warning[2][40][40],
    "downfall (max)": (warning) => warning[2][10][60],
    "downfall (mean)": (warning) => warning[2][10][70],
};

function addCharts(counted: Counted) {
    let root = document.getElementById("weather-charts");
    let container = document.createElement("div");
    container.classList.add("weather-charts-container");

    let close = () => { root.removeChild(container) };

    let options = initOptions(counted, close, container);
    for (let option of Object.values(options)) {
        option.addEventListener("input", () => initWeather(counted, charts, options))
    }

    let charts: {[problem: string]: Highcharts.Chart} = {};
    for (let problem of PROBLEMS) {
        let chartDiv = document.createElement("div");
        chartDiv.classList.add("weather-chart");
        chartDiv.classList.add("bottom-margin");

        let chart = initSplineChart(chartDiv, problem, '', [...Object.values(WIND_SPEEDS)]);
        chart.update({yAxis: {max: 1, min: 0}});
        charts[problem] = chart;
        container.appendChild(chartDiv);
    }
    root.insertBefore(container, root.childNodes[root.childNodes.length - 1]);

    initWeather(counted, charts, options);
}

function initOptions(
    counted: Counted,
    close: () => void,
    container: HTMLDivElement
): Options {
    let today2 = new Date(new Date().setDate(new Date().getDate() + 2));
    let dateStr = getDateStr(today2);

    let optionsDiv = document.createElement("div");
    let dateDiv = document.createElement("div");
    let paramDiv = document.createElement("div");
    let regionDiv = document.createElement("div");
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
    dateTitle.innerText = "Date: ";
    dateSelector.min = "2017-09-01";
    dateSelector.max = dateStr;
    dateSelector.value = getDateStr(new Date());
    dateSelector.type = "date";
    dateDiv.appendChild(dateTitle);
    dateDiv.appendChild(dateSelector);
    optionsDiv.appendChild(dateDiv);

    let paramSelector = document.createElement("select");
    let paramTitle = document.createElement("span");
    paramTitle.innerText = "Parameter: ";
    paramDiv.appendChild(paramTitle);
    paramDiv.appendChild(paramSelector);
    for (let param of ["Wind", "Temp (max)", "Temp (min)", "Downfall (max)", "Downfall (mean)"]) {
        let paramOption = document.createElement("option");
        paramOption.value = param.toLowerCase();
        paramOption.innerText = param;
        if (param == "wind") {
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
    for (let region of Object.keys(counted)) {
        let regionOption = document.createElement("option");
        regionOption.value = region;
        regionOption.innerText = region;
        if (region == "Jotunheimen") {
            regionOption.selected = true;
        }
        regionSelector.appendChild(regionOption);
    }
    optionsDiv.appendChild(regionDiv);

    return {
        region: regionSelector,
        param: paramSelector,
        date: dateSelector,
    }
}

function initWeather(counted: Counted, charts: Charts, options: Options) {
    let region = options.region.value;
    let date = new Date(options.date.value);
    let param = options.param.value as Param;
    let labels = null;

    let data;
    if (param == "wind") {
        labels = Object.values(WIND_SPEEDS);
        data = makeDataCat(counted, labels, param, region);
        Object.values(charts).forEach((chart) => chart.update({xAxis: {max: null, min: null}}));
    } else {
        data = makeDataScal(counted, param, region);
        let dataPoints = Object.values(data).map((dls) => Object.values(dls)).flat(2);
        let minPoint = Math.min(...dataPoints.filter(Number));
        let maxPoint = Math.max(...dataPoints.filter(Number));
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
                let points = param == "wind" ? normalize(data) : reduceY(data);
                let series = makeSeries(dl, points, "spline", dl);
                series.color = COLORS[`DL${dl}`];
                series.legendIndex = Number(dl);
                return series;
            });
        } else {
            series = [];
        }

        
        if (isDayVal) {
            charts[problem].update({
                series: [daySeries, ...series],
                xAxis: {categories: param == "wind" ? labels : null}
            }, true, true);
        } else {
            charts[problem].update({
                series,
                xAxis: {
                    categories: param == "wind" ? labels : null,
                },
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
    for (let [region, years] of Object.entries(counted) as [string, any][]) {
        if (region != filterRegion) { continue }

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

                        data[offset] += 1
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
    for (let [region, years] of Object.entries(counted) as [string, any][]) {
        if (region != filterRegion) { continue }

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

                    for (let problem of problems) {
                        if (!(problem in d)) {
                            d[problem] = {};
                        }
                        if (!(dl in d[problem])) {
                            d[problem][dl] = [];
                        }
                        d[problem][dl].push(datum);
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

function normalize(data: number[]): Point[] {
    let sum: number = data.reduce((acc, datum) => acc + datum);
    let normedData: Point[] = [];
    data.forEach((datum, i) => {
        let normed = sum ? datum / sum : 0;
        normedData.push({y: normed, x: i, actualValue: datum});
    });
    return normedData;
}

function reduceY(data: number[]): Point[] {
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
        let normed = sum ? amount / sum : 0;
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

export {initWeather, addCharts, Charts, Counted};