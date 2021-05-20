import * as Highcharts from 'highcharts';

type NumPerDate = Map<string, number>;
type NumPerSeason = Map<string, NumPerDate>;
interface Point {
    y: number,
    actualValue: number,
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

function showCharts() {
    var countChart = initChart(
        'chart-count',
        `Snow observations per day (${SLOTS} days rolling average)`,
        'Registered snow observations',
        START,
        STOP,
    );
    var accChart = initChart(
        'chart-acc',
        `Accumulated snow observations`,
        'Registered snow observations',
        START,
        STOP,
    );
    var simpleChart = initChart(
        'chart-simple',
        `Simple snow observations per day (${SLOTS} days rolling average)`,
        'Registered snow observations',
        START,
        STOP,
    );
    var advancedChart = initChart(
        'chart-advanced',
        `Advanced snow observations per day (${SLOTS} days rolling average)`,
        'Registered snow observations',
        START,
        STOP,
    );
    var schemaChart = initChart(
        'chart-schemas',
        `Snow observations schemas per day (${SLOTS} days rolling average)`,
        'Registered snow observations',
        START,
        STOP,
    );
    fetchData("/api/count", (observations) => {
        var seasons = makeData(observations);
        for (var [season, data] of Object.entries(seasons)) {
            addSeries(season, rollingAverage(data, SLOTS), countChart);
            addSeries(season, accumulateData(data), accChart);
        }
    })
    fetchData("/api/countsimple", populateChart(simpleChart))
    fetchData("/api/countadvanced", populateChart(advancedChart))
    fetchData("/api/countschemas", populateChart(schemaChart))
}

function populateChart(
    chart: Highcharts.Chart,
): (observations: NumPerSeason) => void {
    return (observations: NumPerSeason) => {
        var seasons = makeData(observations);
        for (var [season, data] of Object.entries(seasons)) {
            addSeries(season, rollingAverage(data, SLOTS), chart);
        }
    }
}

function rollingAverage(data: number[], slots: number): Point[] {
    var buffer = emptyArray_(slots, 0);
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
    var acc: Point[] = []
    data.forEach((elem) => {
        var sum = elem + (acc.length ? acc[acc.length - 1].y : 0);
        acc.push({y: sum, actualValue: elem});
    });
    return acc;
}

function fetchData(
    url: string,
    callback: (observations: NumPerSeason) => void,
    retries: number = 5
) {
    var fail = () => { return fetchData(url, callback, retries - 1) }
    if (retries < 0) {
        throw new Error(`Failed to fetch data (${url})!`);
    } else if (retries < 5) {
        console.error(`Failed to fetch data (${url}), retrying (${5 - retries}/5)...`)
    }

    var req = new XMLHttpRequest();
    req.open("GET", url);
    req.onerror = () => {
        return fail();
    }
    req.onload = () => {
        if (req.status < 200 || req.status > 299) { return fail() }

        try {
            var json = JSON.parse(req.responseText);
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
    return date.toLocaleString('no-NO', DATE_FORMAT);
}

function emptyArray_(size: number, value: number): number[] {
    return Array.apply(null, new Array(size)).map(Number.prototype.valueOf, value);
}

function makeData(observations: NumPerSeason) {
    var datas: {[season: string]: number[]} = {}
    for (var [season, dates] of Object.entries(observations)) {
        var length = Math.round((STOP.getTime() - START.getTime()) / (1000 * 3600 * 24))
        var data = emptyArray_(length, 0);
        for (var [dateStr, count] of Object.entries(dates)) {
            var date = new Date(dateStr);
            date.setFullYear(START.getFullYear() + (date.getMonth() < START.getMonth() ? 1 : 0));
            var offset = Math.round((date.getTime() - START.getTime()) / (1000 * 3600 * 24));
            if (offset >= 0 && offset < data.length) {
                data[offset] = count as number;
            }
        }
        datas[season] = data;
    }
    return datas;
}

function addSeries(title: string, data: Point[], chart: Highcharts.Chart) {
    var series: Highcharts.SeriesLineOptions = {
        name: title,
        data: data,
        type: "line",
    };
    chart.addSeries(series);
}

function initChart(
    div: string,
    title: string,
    yText: string,
    start: Date,
    stop: Date
) {
    let dates = dateRange(start, stop);
    return Highcharts.chart(div, {
        chart: {
            type: 'line',
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
            categories: dates,
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
        series: [],
    }, () => null);
}

showCharts()