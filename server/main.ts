import * as request from "request";
import * as express from "express";
import { stringify } from "qs";
import { ObjectFlags } from "typescript";

const port = 10418;
const url = "https://api.regobs.no/v4/Search";
const numberOfRecords = 50;
const regionsA = [
    3003, // Nordenskiöld Land
    3006, // Finnmarkskysten
    3007, // Vest-Finnmark
    3009, // Nord-Troms
    3010, // Lyngen
    3011, // Tromsø
    3012, // Sør-Troms
    3013, // Indre Troms
    3014, // Lofoten og Vesterålen
    3015, // Ofoten
    3016, // Salten
    3017, // Svartisen
    3022, // Trollheimen
    3023, // Romsdal
    3024, // Sunnmøre
    3027, // Indre Fjordane
    3028, // Jotunheimen
    3029, // Indre Sogn
    3031, // Voss
    3032, // Hallingdal
    3034, // Hardanger
    3035, // Vest-Telemark
    3037, // Heiane
];
const regionsB = [
    3001, // Svalbard øst
    3002, // Svalbard vest
    3004, // Svalbard sør
    3005, // Øst-Finnmark
    3008, // Finnmarksvidda
    3018, // Helgeland
    3019, // Nord-Trøndelag
    3020, // Sør-Trøndelag
    3021, // Ytre Nordmøre
    3025, // Nord-Gudbrandsdalen
    3026, // Ytre Fjordane
    3030, // Ytre Sogn
    3033, // Hordalandskysten
    3036, // Rogalandskysten
    3038, // Agder sør
    3039, // Telemark sør
    3040, // Vestfold
    3041, // Buskerud sør
    3042, // Oppland sør
    3043, // Hedmark
    3044, // Akershus
    3045, // Oslo
    3046, // Østfold
];
const regions: number[] = [].concat(regionsA, regionsB);

interface Observation {
    DtObsTime: string,
    DtRegTime: string,
    Summaries: {
        RegistrationTID: number,
        RegistrationName: string,
    }[],
}

type ObsPerDate = Map<string, Observation[]>;
type NumPerDate = Map<string, number>;
type ObsPerSeason = Map<string, ObsPerDate>;

function serve(port: number, observations: Observation[]) {
    var obsPerSeason = splitObservations(observations);
    var simplePerSeason = new Map([...obsPerSeason].map(([season, obsPerDate]) =>
        [season, filterSimple(obsPerDate)]
    ));
    var advancedPerSeason = new Map([...obsPerSeason].map(([season, obsPerDate]) =>
        [season, filterSimple(obsPerDate, false)]
    ));

    const app = express();
    app.use('/static', express.static(`${__dirname}/static`));
    app.get('/', function(req, res) {
        res.sendFile(`${__dirname}/static/html/index.html`);
    });

    // All observations counted
    var countedObses = new Map([...obsPerSeason].map(([season, obsPerDate]) =>
        [season, countObses(obsPerDate)]
    ));
    var countedObsesJson = JSON.stringify(countedObses, replacer);
    app.get('/api/count', (_: void, res: any) => {
        res.set('Content-Type', 'application/json');
        res.send(countedObsesJson);
    });

    // Simple observations counted
    var countedSimple = new Map([...simplePerSeason].map(([season, obsPerDate]) =>
        [season, countObses(obsPerDate)]
    ));
    var countedSimpleJson = JSON.stringify(countedSimple, replacer);
    app.get('/api/countsimple', (_: void, res: any) => {
        res.set('Content-Type', 'application/json');
        res.send(countedSimpleJson);
    });

    // Advanced observations counted
    var countedAdvanced = new Map([...advancedPerSeason].map(([season, obsPerDate]) =>
        [season, countObses(obsPerDate)]
    ));
    var countedAdvancedJson = JSON.stringify(countedAdvanced, replacer);
    app.get('/api/countadvanced', (_: void, res: any) => {
        res.set('Content-Type', 'application/json');
        res.send(countedAdvancedJson);
    });

    // Schemas counted
    var countedSchemas = new Map([...obsPerSeason].map(([season, obsPerDate]) =>
        [season, countSchemas(obsPerDate)]
    ));
    var countedSchemasJson = JSON.stringify(countedSchemas, replacer);
    app.get('/api/countschemas', (_: void, res: any) => {
        res.set('Content-Type', 'application/json');
        res.send(countedSchemasJson);
    });

    app.listen(port, '0.0.0.0', () => {console.log(`Web server started on port ${port}.`)});
}

function filterSimple(obsPerDate: ObsPerDate, keep: boolean = true): ObsPerDate {
    return new Map([...obsPerDate].map(([date, obses]) => {
        obses = obses.map((obs) => {
            var advanced = obs.Summaries
                .map((summary) => [31, 32].includes(summary.RegistrationTID))
                .reduce((acc, advanced) => acc || advanced, false);
            if (keep) {
                return advanced ? null : obs;
            } else {
                return advanced ? obs : null;
            }
        }).filter(Boolean);
        return [date, obses];
    }));
}

function countObses(obsPerDate: ObsPerDate): NumPerDate {
    return new Map([...obsPerDate].map(([date, obses]) => 
        [date, obses.length]
    ))
}

function countSchemas(obsPerDate: ObsPerDate): NumPerDate {
    return new Map([...obsPerDate].map(([date, obses]) => {
        var schemas = obses
            .map((obs) => obs.Summaries.length)
            .reduce((acc, len) => acc + len, 0);
        return [date, schemas];
    }));
}

function splitObservations(observations: Observation[]): ObsPerSeason {
    var splitObs: ObsPerSeason = new Map();
    for (var obs of observations) {
        var season = getSeason(obs);
        var date = date2String(getDate(obs));
        if (!splitObs.has(season)) {
            splitObs.set(season, new Map());
        }
        if (!splitObs.get(season).has(date)) {
            splitObs.get(season).set(date, []);
        }
        splitObs.get(season).get(date).push(obs)
    }


    // Sort the Maps
    splitObs = new Map([...splitObs].sort((a, b) =>
        // Ordering definition for seasons
        parseInt(a[0].slice(0, 4)) - parseInt(b[0].slice(0, 4))
    ).map(([season, dates]) => {
        dates = new Map([...dates].sort((a, b) =>
            // Ordering definition for dates
            new Date(a[0]).getTime() - new Date(b[0]).getTime()
        ).map(([date, obses]) => {
            obses = obses.sort((a, b) =>
                // Ordering definition for observations
                getDate(a).getTime() - getDate(b).getTime()
            );
            return [date, obses]
        }))
        return [season, dates]
    }));
    return splitObs;
}

function getSeason(observation: Observation) {
    var date = getDate(observation);
    var year = new Date(date.getFullYear(), date.getMonth() + 4).getFullYear();
    return `${year - 1}-${year.toString().slice(2, 4)}`;
}

function getDate(observation: Observation): Date {
    return new Date(observation.DtObsTime);
}

function date2String<T>(date: Date): string {
    return date.toISOString().slice(0, 10);
}

function downloadObservations(
    url: string,
    regions: number[],
    callback: (observations: Observation[]) => void,
    retries: number = 5
) {
    if (retries < 0) {
        throw new Error("Failed to fetch observations count!");
    } else if (retries < 5) {
        console.error(`Failed to fetch observations count, retrying (${5 - retries}/5)...`)
    }

    var options = {
        uri: url + "/Count",
        method: 'POST',
        json: {
            LangKey: 1,
            FromDate: new Date(2017, 8, 1).toISOString(),
            ToDate: Date.now(),
            SelectedRegions: regions,
            SelectedGeoHazards: [10],
        },
    }

    request.post(options, (err, res, body) => {
        var fail = () => downloadObservations(url, regions, callback, retries - 1);
        if (err) { return fail() }
        if (res && (res.statusCode < 200 || res.statusCode > 299)) { return fail() }
        if (!('TotalMatches' in body)) { return fail() }

        var count: number = body.TotalMatches

        fetchAll(url, regions, count, callback)
    })
}

function fetchAll(
    url: string,
    regions: number[],
    count: number,
    callback: (observations: Observation[]) => void
) {
    var observations: Observation[] = [];
    for (var offset = 0; offset < count; offset += numberOfRecords){
        fetchBatch(url, regions, offset, count, observations, callback)
    }
}

function fetchBatch(
    url: string,
    regions: number[],
    offset: number,
    count: number,
    rObs: Observation[],
    callback: (observations: Observation[]) => void,
    retries: number = 5
) {
    if (retries < 0) {
        throw new Error(`Failed to fetch batch of observations (offset: ${offset})!`);
    } else if (retries < 5) {
        console.error(`Failed to fetch batch of observations (offset: ${offset}), retrying (${5 - retries}/5)...`)
    }

    var options = {
        uri: url,
        method: 'POST',
        json: {
            LangKey: 1,
            FromDate: new Date(2017, 8, 1).toISOString(),
            ToDate: Date.now(),
            SelectedRegions: regions,
            SelectedGeoHazards: [10],
            NumberOfRecords: numberOfRecords,
            Offset: offset
        },
    }

    request.post(options, (err, res, body) => {
        var fail = () => fetchBatch(url, regions, offset, count, rObs, callback, retries - 1);
        if (err) { return fail() }
        if (res && (res.statusCode < 200 || res.statusCode > 299)) { return fail() }
        if (!Array.isArray(body)) { return fail() }

        rObs.push(...body);
        if (rObs.length % 1000 < numberOfRecords) {
            console.log(`Fetched ${rObs.length} out of ${count} Regobs observations.`);
        }
        if (rObs.length >= count) {
            console.log(`Fetched ${rObs.length} out of ${count} Regobs observations`);
            callback(rObs)
        }
    })
}

function replacer<K, V>(key: K, value: V) {
    if (value instanceof Map) {
        return Object.fromEntries(value);
    } else {
        return value;
    }
}

downloadObservations(url, regions, (obses) => serve(port, obses));