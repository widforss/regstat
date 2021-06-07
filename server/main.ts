import * as request from "request";
import * as express from "express";

const PORT = 10418;
const URL = "https://api.regobs.no/v4/Search";
const N_RECORDS = 50;
const PARALLEL_DOWNLOADS = 50;
const REGIONS_A = [
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
const REGIONS_B = [
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
const REGIONS: number[] = [].concat(REGIONS_A, REGIONS_B);

interface Observation {
    DtObsTime: string,
    DtRegTime: string,
    ObsLocation: {
        ForecastRegionTID: number,
        ForecastRegionName: string,
    }
    Summaries: {
        RegistrationTID: number,
        RegistrationName: string,
    }[],
}

type Season = string;
type ObsDate = string;
type Region = string;
type RegionId = number;
type Counted = Map<Season, Map<ObsDate, Map<Region, SimpleAdv>>>;

interface SimpleAdv {
    observations: {
        simple: number,
        advanced: number,
    },
    schemas: {
        simple: number,
        advanced: number,
    }
};

function serve(port: number, observations: Observation[]) {
    let counted = count(observations);
    let countedObsesJson = JSON.stringify(counted, replacer);

    const app = express();
    app.use('/static', express.static(`${__dirname}/static`));
    app.get('/', function(req, res) {
        res.sendFile(`${__dirname}/static/html/index.html`);
    });

    // All observations counted
    app.get('/api/count', (_: void, res: any) => {
        res.set('Content-Type', 'application/json');
        res.send(countedObsesJson);
    });

    app.listen(port, '0.0.0.0', () => {console.log(`Web server started on port ${port}.`)});
}

function count(observations: Observation[]): Counted {
    let regionIds: {[name: string]: number} = {}
    let counted: Counted = new Map();
    for (let obs of observations) {
        let season = getSeason(obs);
        let date = date2String(getDate(obs));
        let region = getRegion(obs);
        let advanced = isAdvanced(obs)
        let schemas = obs.Summaries.length;

        if (!(region in regionIds)) {
            regionIds[region] = getRegionId(obs);
        }

        if (!counted.has(season)) {
            counted.set(season, new Map());
        }
        if (!counted.get(season).has(date)) {
            counted.get(season).set(date, new Map());
        }
        if (!counted.get(season).get(date).has(region)) {
            let emptyObject = {
                observations: {
                    simple: 0,
                    advanced: 0,
                },
                schemas: {
                    simple: 0,
                    advanced: 0,
                }
            }
            counted.get(season).get(date).set(region, emptyObject);
        }

        let prev = counted.get(season).get(date).get(region)
        if (advanced) {
            prev.observations.advanced += 1
            prev.schemas.advanced += schemas
        } else {
            prev.observations.simple += 1
            prev.schemas.simple += schemas
        }
    }


    // Sort the Maps
    counted = new Map([...counted].sort((a, b) =>
        // Ordering definition for seasons
        parseInt(a[0].slice(0, 4)) - parseInt(b[0].slice(0, 4))
    ).map(([season, dates]) => {
        dates = new Map([...dates].sort((a, b) =>
            // Ordering definition for dates
            new Date(a[0]).getTime() - new Date(b[0]).getTime()
        ).map(([date, regions]) => {
            regions = new Map([...regions].sort((a, b) =>
                // Ordering definition for regions
                regionIds[a[0]] - regionIds[b[0]]
            ))
            return [date, regions]
        }))
        return [season, dates]
    }));
    return counted;
}

function getSeason(observation: Observation): Season {
    let date = getDate(observation);
    let year = new Date(date.getFullYear(), date.getMonth() + 4).getFullYear();
    return `${year - 1}-${year.toString().slice(2, 4)}`;
}

function getDate(observation: Observation): Date {
    return new Date(observation.DtObsTime);
}

function getRegion(observation: Observation): Region {
    return observation.ObsLocation.ForecastRegionName;
}

function getRegionId(observation: Observation): RegionId {
    return observation.ObsLocation.ForecastRegionTID;
}

function date2String<T>(date: Date): ObsDate {
    let year = date.getFullYear();
    let month = (date.getMonth() + 1).toFixed(0).padStart(2, "0");
    let day = date.getDate().toFixed(0).padStart(2, "0");
    return `${year}-${month}-${day}`;
}

function isAdvanced(observation: Observation): boolean {
    return observation.Summaries
        .map((summary) => [31, 32].includes(summary.RegistrationTID))
        .reduce((acc, advanced) => acc || advanced, false);
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

    let now = new Date();
    let options = {
        uri: url + "/Count",
        method: 'POST',
        json: {
            LangKey: 1,
            FromDate: new Date(2017, 8, 1).toISOString(),
            ToDate: now.toISOString(),
            SelectedRegions: regions,
            SelectedGeoHazards: [10],
        },
    }

    request.post(options, (err, res, body) => {
        let fail = () => downloadObservations(url, regions, callback, retries - 1);
        if (err) { return fail() }
        if (res && (res.statusCode < 200 || res.statusCode > 299)) { return fail() }
        if (!('TotalMatches' in body)) { return fail() }

        let count: number = body.TotalMatches

        fetchAll(url, regions, count, now, callback)
    })
}

function fetchAll(
    url: string,
    regions: number[],
    count: number,
    now: Date,
    callback: (observations: Observation[]) => void
) {
    let fetchNextbatch = () => {
        if (offset > count) { return }
        fetchBatch(
            url,
            regions,
            offset,
            now,
            rObs,
            (obs) => {
                offset += N_RECORDS;
                if (rObs.length % 1000 < N_RECORDS) {
                    console.log(`Fetched ${rObs.length} out of ${count} Regobs observations.`);
                }
                if (rObs.length >= count && rObs.length - count < N_RECORDS) {
                    console.log(`Fetched ${rObs.length} out of ${count} Regobs observations`);
                    callback(obs);
                } else {
                    fetchNextbatch();
                }
            },
        )
    }

    let rObs: Observation[] = [];
    let offset = -N_RECORDS;
    for (let parallel = 0; parallel < PARALLEL_DOWNLOADS; parallel += 1){
        offset += N_RECORDS;
        fetchNextbatch();
    }
}

function fetchBatch(
    url: string,
    regions: number[],
    offset: number,
    now: Date,
    rObs: Observation[],
    callback: (observations: Observation[]) => void,
    retries: number = 5
) {
    if (retries < 0) {
        throw new Error(`Failed to fetch batch of observations (offset: ${offset})!`);
    } else if (retries < 5) {
        console.error(`Failed to fetch batch of observations (offset: ${offset}), retrying (${5 - retries}/5)...`)
    }

    let options = {
        uri: url,
        method: 'POST',
        json: {
            LangKey: 1,
            FromDate: new Date(2017, 8, 1).toISOString(),
            ToDate: now.toISOString(),
            SelectedRegions: regions,
            SelectedGeoHazards: [10],
            NumberOfRecords: N_RECORDS,
            Offset: offset
        },
    }

    request.post(options, (err, res, body) => {
        let fail = () => fetchBatch(url, regions, offset, now, rObs, callback, retries - 1);
        if (err) { return fail() }
        if (res && (res.statusCode < 200 || res.statusCode > 299)) { return fail() }
        if (!Array.isArray(body)) { return fail() }

        rObs.push(...body);
        callback(rObs)
    })
}

function replacer<K, V>(key: K, value: V) {
    if (value instanceof Map) {
        return Object.fromEntries(value);
    } else {
        return value;
    }
}

downloadObservations(URL, REGIONS, (obses) => serve(PORT, obses));