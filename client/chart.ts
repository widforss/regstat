import * as Highcharts from 'highcharts';
import { COLORS } from './color';
import { getOptions } from './option';
import { Region } from './region';

interface Charts {
    countChart: Highcharts.Chart,
    accChart: Highcharts.Chart,
    regionChart: Highcharts.Chart,
}

const [START, STOP] = [new Date("1970-09-01"), new Date("1971-09-01")];
const [START_CAL, STOP_CAL] = [new Date("1971-01-01"), new Date("1972-01-01")];

const FILTER: {[keep: string]: (obses: [number, number[]][]) => [number, number[]][]} = {
    all: (obses) => obses,
    allSnow: (obses) => obses.filter((obs) => obs[0] == 10),
    allSoilWater: (obses) => obses.filter((obs) => [20, 60].includes(obs[0])),
    none: () => [],

    allSoil: (obses) => obses.filter((obs) => obs[0] == 20),
    dangersignSoil: (obses) => FILTER["allSoil"](obses).filter((obs) => obs[1].includes(13)),
    landslideSoil: (obses) => FILTER["allSoil"](obses).filter((obs) => obs[1].includes(71)),
    notesSoil: (obses) => FILTER["allSoil"](obses).filter((obs) => obs[1].includes(10)),

    allWater: (obses) => obses.filter((obs) => obs[0] == 60),
    dangersignWater: (obses) => FILTER["allWater"](obses).filter((obs) => obs[1].includes(13)),
    damagesWater: (obses) => FILTER["allWater"](obses).filter((obs) => obs[1].includes(14)),
    levelWater: (obses) => FILTER["allWater"](obses).filter((obs) => obs[1].includes(62)),
    notesWater: (obses) => FILTER["allWater"](obses).filter((obs) => obs[1].includes(10)),

    allIce: (obses) => obses.filter((obs) => obs[0] == 70),
    coverIce: (obses) => FILTER["allIce"](obses).filter((obs) => obs[1].includes(51)),
    thicknessIce: (obses) => FILTER["allIce"](obses).filter((obs) => obs[1].includes(50)),
    dangersignIce: (obses) => FILTER["allIce"](obses).filter((obs) => obs[1].includes(13)),
    incidentIce: (obses) => FILTER["allIce"](obses).filter((obs) => obs[1].includes(11)),
    notesIce: (obses) => FILTER["allIce"](obses).filter((obs) => obs[1].includes(10)),

    advanced: (obses) => FILTER["allSnow"](obses).filter(
        (obs) => intersection([31, 32], obs[1]).length
    ),
    simple: (obses) => FILTER["allSnow"](obses).filter(
        (obs) => !intersection([31, 32], obs[1]).length
    ),

    avalancheAndAccident: (obses) => FILTER["allSnow"](obses).filter(
        (obs) => intersection([26, 11], obs[1]).length
    ),
    avalanche: (obses) => FILTER["allSnow"](obses).filter((obs) => obs[1].includes(26)),
    accident: (obses) => FILTER["allSnow"](obses).filter((obs) => obs[1].includes(11)),

    avalancheAndDangersign: (obses) => FILTER["allSnow"](obses).filter(
        (obs) => intersection([13, 26, 33], obs[1]).length
    ),
    dangersign: (obses) => FILTER["allSnow"](obses).filter((obs) => obs[1].includes(13)),
    avalancheActivity: (obses) => FILTER["allSnow"](obses).filter((obs) => obs[1].includes(33)),

    snowcoverAndWeather: (obses) => FILTER["allSnow"](obses).filter(
        (obs) => intersection([22, 21, 25, 36], obs[1]).length
    ),
    snowcover: (obses) => FILTER["allSnow"](obses).filter((obs) => obs[1].includes(22)),
    weather: (obses) => FILTER["allSnow"](obses).filter((obs) => obs[1].includes(21)),
    tests: (obses) => FILTER["allSnow"](obses).filter((obs) => obs[1].includes(25)),
    profile: (obses) => FILTER["allSnow"](obses).filter((obs) => obs[1].includes(36)),

    problem: (obses) => FILTER["allSnow"](obses).filter((obs) => obs[1].includes(32)),
    assessment: (obses) => FILTER["allSnow"](obses).filter((obs) => obs[1].includes(31)),

    notes: (obses) => FILTER["allSnow"](obses).filter((obs) => obs[1].includes(10)),
};

interface Point {
    x?: number,
    y: number,
    actualValue: number | string,
}

type Season = string;
interface Counted {
    [region: number]: {
        [year: number]: {
            [month: number]: {
                [day: string]: [number, number[]][]
            }
        }
    }
}

function showCharts(): Charts {
    let regions = getOptions().regions;
    let [start, stop] = startStop(true, false)
    let [startLeap, stopLeap] = startStop(true, true)
    let countChart = initLineChart(
        'chart-count',
        '',
        `Registered observations per day`,
        start,
        stop,
    );
    let accChart = initLineChart(
        'chart-acc',
        '',
        'Registered observations',
        startLeap,
        stopLeap
    );
    let regionChart = initBarChart(
        'chart-regions',
        '',
        'Registered observations',
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
    let regions = options.regions;
    let schema = options.schema;
    let hydro = options.hydrological;
    let average = options.average;
    let filter = FILTER[options.filter];

    let seasons = makeDataDate(counted, filter, regions, hydro, schema, false);
    let seasonsAcc = makeDataDate(counted, filter, regions, hydro, schema, true);
    let seasonsRegions = makeDataRegion(counted, filter, regions, hydro, schema, true);

    let [start, stop] = startStop(hydro, false);
    let [startLeap, stopLeap] = startStop(hydro, true);

    charts.countChart.update({
        series: Object.entries(seasons).map(([season, data]) => 
            makeSeries(season, rollingAverage(data, average), "line")
        ),
        xAxis: {
            categories: dateRange(start, stop),
        }
    }, true, true);
    charts.accChart.update({
        series: Object.entries(seasonsAcc).map(([season, data]) => 
            makeSeries(season, accumulateData(data), "line")
        ),
        xAxis: {
            categories: dateRange(startLeap, stopLeap),
        }
    }, true, true);
    charts.regionChart.update({
        series: Object.entries(seasonsRegions).map(([season, data]) => {
            let chartData: Point[] = data.map((y) => {
                return {y, actualValue: y}
            });
            return makeSeries(season, chartData, "column");
        }),
        xAxis: {
            categories: regions,
        }
    }, true, true);
}

function makeDataDate(
    counted: Counted,
    filter: (obses: [number, number[]][]) => [number, number[]][],
    regions: Region[],
    hydrologicalYear: boolean = true,
    schemas: boolean = false,
    leap: boolean = false,
) {
    let seasons: {[season: string]: number[]} = {}
    let [start, stop] = startStop(hydrologicalYear, leap);
    let length = Math.round((stop.getTime() - start.getTime()) / (1000 * 3600 * 24))
    let maxDate: Date;
    let maxOffset: number;
    for (let [region, years] of Object.entries(counted) as [string, any][]) {
        if (!regions.includes(region)) { continue }

        let hydroRemovedFirst = false;
        for (let [year, months] of Object.entries(years) as any as [number, any][]) {
            if (!hydrologicalYear && !hydroRemovedFirst) {
                hydroRemovedFirst = true;
                continue;
            }
            for (let [month, days] of Object.entries(months) as any as [number, any][]) {
                for (let [day, obses] of Object.entries(days) as any as [number, [number, number[]][]][]) {
                    let trueDate = new Date(year, month - 1, day);
                    let date = new Date(trueDate);

                    let season = getSeason(date, hydrologicalYear);
                    let addYear = date.getMonth() < start.getMonth() ? 1 : 0;
                    date.setFullYear(start.getFullYear() + addYear);

                    if (!(season in seasons)) {
                        seasons[season] = emptyArray_(length, 0);
                    }
                    let data = seasons[season];

                    let offset = Math.round((date.getTime() - start.getTime()) / (1000 * 3600 * 24));
                    if (offset < 0 || offset >= data.length) { continue }
                    if (!maxDate || trueDate.getTime() > maxDate.getTime()) {
                        maxDate = trueDate;
                        maxOffset = offset;
                    }

                    if (schemas) {
                        data[offset] += filter(obses)
                            .map((obs) => obs[1])
                            .reduce((acc, obs) => acc + obs.length, 0);
                    } else {
                        data[offset] += filter(obses)
                        .map((obs) => obs[1]).length
                    }
                }
            }
        }
    }
    if (maxDate) {
        let season = getSeason(maxDate, hydrologicalYear);
        seasons[season] = seasons[season].slice(0, maxOffset + 1);
    }
    return seasons;
}

function makeDataRegion(
    counted: Counted,
    filter: (obses: [number, number[]][]) => [number, number[]][],
    regions: Region[],
    hydrologicalYear: boolean = true,
    schemas: boolean = false,
    leap: boolean = false,
) {
    let seasons: {[season: string]: number[]} = {}
    let start = startStop(hydrologicalYear, leap)[0];
    for (let [region, years] of Object.entries(counted) as [string, [number, number[]][]][]) {
        if (!regions.includes(region)) { continue }

        let hydroRemovedFirst = false;
        for (let [year, months] of Object.entries(years) as any as [number, any][]) {
            if (!hydrologicalYear && !hydroRemovedFirst) {
                hydroRemovedFirst = true;
                continue;
            }
            for (let [month, days] of Object.entries(months) as any as [number, any][]) {
                for (let [day, obses] of Object.entries(days) as any as [number, [number, number[]][]][]) {
                    let date = new Date(year, month - 1, day);
                    let season = getSeason(date, hydrologicalYear);
                    let addYear = date.getMonth() < start.getMonth() ? 1 : 0;
                    date.setFullYear(start.getFullYear() + addYear);

                    if (!(season in seasons)) {
                        seasons[season] = emptyArray_(regions.length, 0);
                    }
                    let data = seasons[season];


                    let offset = regions.indexOf(region);

                    if (schemas) {
                        data[offset] += filter(obses)
                            .map((obs) => obs[1])
                            .reduce((acc, obs) => acc + obs.length, 0);
                    } else {
                        data[offset] += filter(obses)
                            .map((obs) => obs[1]).length
                    }
                }
            }
        }
    }
    return seasons;
}

function makeSeries(
    title: string,
    data: Point[]|number[],
    type: "line" | "column" | "spline",
    id: string = null,
): Highcharts.SeriesLineOptions | Highcharts.SeriesColumnOptions | Highcharts.SeriesSplineOptions {
    id = id ? id : title.slice(title.length - 2);
    return {
        name: title,
        id,
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
    let template = {
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
            title: {
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
        yAxis: {
            allowDecimals: true,
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
    } as Highcharts.Options;
    if (labels !== null) {
        (<Highcharts.XAxisOptions> template.xAxis).categories = labels;
    }
    return template;
}

function rollingAverage(data: number[], slots: number): Point[] {
    let buffer: number[] = [];
    let offset = Math.floor(slots / 2);
    let avg = [...data, ...emptyArray_(offset, 0)].map((elem, idx, arr) => {
        if (idx >= slots) {
            buffer.shift();
        }
        if (idx < data.length) {
            buffer.push(elem);
        }
        return buffer.reduce((a, b) => a + b) / buffer.length;
    }).slice(offset);
    return data.map((elem, idx) => {
        return {
            y: avg[idx],
            actualValue: elem,
        } as Point;
    });
}

function accumulateData(data: number[]): Point[] {
    let acc: Point[] = []
    data.forEach((elem) => {
        let sum = elem + (acc.length ? acc[acc.length - 1].y : 0);
        acc.push({y: sum, actualValue: sum});
    });
    return acc;
}

function startStop(hydrologicalYear: boolean, leap: boolean) {
    let start;
    let stop;
    if (hydrologicalYear) {
        [start, stop] = [new Date(START),  new Date(STOP)];
    } else {
        [start, stop] = [new Date(START_CAL), new Date(STOP_CAL)];
    }
    start.setFullYear(start.getFullYear() + (leap as any as number));
    stop.setFullYear(stop.getFullYear() + (leap as any as number));
    return [start, stop];
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

function getSeason(date: Date, hydrologicalYear: boolean): Season {
    if (hydrologicalYear) {
        let year = new Date(date.getFullYear(), date.getMonth() + 4).getFullYear();
        return `${year - 1}-${year.toString().slice(2, 4)}`;
    } else {
        return date.getFullYear().toFixed();
    }
}

function emptyArray_(size: number, value: number): number[] {
    return Array.apply(null, new Array(size)).map(Number.prototype.valueOf, value);
}

function intersection(a: number[], b: number[]): number[] {
    return a.filter((a1) => b.includes(a1))
}

export {populateCharts, showCharts, chartTemplate, makeSeries, intersection, emptyArray_, Charts, Counted, Point};