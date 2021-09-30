import * as request from "request";
import e, * as express from "express";
import * as fs from "fs";

const PORT = 10418;
const URL_REGOBS = "https://api.regobs.no/v4/Search";
const URL_VARSOM = "https://api01.nve.no/hydrology/forecast/avalanche/v4.0.2/api/AvalancheWarningByRegion/Detail"
const REGOBS_N_RECORDS = 50;
const VARSOM_N_RECORDS = 30;
const PARALLEL_DOWNLOADS = 50;

interface Observation {
    DtObsTime: string,
    DtRegTime: string,
    GeoHazardTID: number,
    ObsLocation: {
        ForecastRegionTID: number,
        ForecastRegionName: string,
    }
    Summaries: {
        RegistrationTID: number,
        RegistrationName: string,
    }[],
}

interface AvalancheWarning {
    DangerLevelName: string,
    DangerLevel: string,
    RegionName: string,
    RegionId: string,
    RegionTypeName: string,
    ValidFrom: string,
    ValidTo: string,
    AvalancheProblems: AvalancheProblem[],
    MountainWeather: MountainWeather,
}

interface AvalancheProblem {
    AvalancheProblemTypeId: number,
    AvalancheProblemTypeName: string,
}

interface MountainWeather {
    MeasurementTypes: WeatherType[]
}

interface WeatherType {
    Id: number,
    Name: string,
    MeasurementSubTypes: WeatherSubType[]
}

interface WeatherSubType {
        Id: number,
        Name: string,
        Value: string,
}

type Year = number;
type Month = number;
type Day = number;
type Region = string;
type RegionId = number;
type Tid = number;
type DangerLevel = number;
type Problem = number;
type Counted = Map<Region, Map<Year, Map<Month, Map<Day, [Tid, Tid[]][]>>>>;
type CountedWeather = Map<
    Region, Map<
        Year, Map<
            Month, Map<
                Day, [DangerLevel, Problem[], Map<Tid, Map<Tid, string | number>>]
            >
        >
    >
>;

const START_DATE = new Date(2017, 8, 1);
const WIND_SPEEDS: {[name: string]: number} = {
    'Calm/light breeze': 0,
    'Breeze': 6,
    'Fresh breeze': 9,
    'Strong breeze': 12,
    'Moderate gale': 16,
    'Gale': 19,
    'Strong gale': 23,
    'Storm': 26,
    'Hurricane force': 35,
};
const WIND_DIRS: {[name: string]: number} = {
    'N': 0,
    'NE': 1,
    'E': 2,
    'SE': 3,
    'S': 4,
    'SW': 5,
    'W': 6,
    'NW': 7,
};
const REGIONS: {[region: number]: Region} = {
  '0':   "No region",//'',
  '119': "No region",//'',
  '200': "No region",//'Fylke ikke gitt',
  '201': "Viken",//'Østfold',
  '202': "Viken",//'Akershus',
  '203': "Oslo",//'Oslo',
  '204': "Innlandet",//'Hedmark',
  '205': "Innlandet",//'Oppland',
  '206': "Viken",//'Buskerud',
  '207': "Vestfold og Telemark",//'Vestfold',
  '208': "Vestfold og Telemark",//'Telemark',
  '209': "Agder",//'Aust-Agder',
  '210': "Agder",//'Vest-Agder',
  '211': "Rogaland",//'Rogaland',
  '212': "Vestland",//'Hordaland',
  '214': "Vestland",//'Sogn og Fjordane',
  '215': "Møre og Romsdal",//'Møre og Romsdal',
  '218': "Nordland",//'Nordland',
  '219': "Troms og Finnmark",//'Troms',
  '220': "Troms og Finnmark",//'Finnmark',
  '230': "Viken",//'Viken',
  '234': "Innlandet",//'Innlandet',
  '238': "Vestfold og Telemark",//'Vestfold og Telemark',
  '242': "Agder",//'Agder',
  '246': "Vestland",//'Vestland',
  '250': "Trøndelag",//'Trøndelag',
  '254': "Troms og Finnmark",//'Troms og Finnmark',
  '700': "No region",//'Fylke ikke gitt',
  '701': "Viken",//'Østfold',
  '702': "Viken",//'Akershus',
  '703': "Oslo",//'Oslo',
  '704': "Innlandet",//'Hedmark',
  '705': "Innlandet",//'Oppland',
  '706': "Viken",//'Buskerud',
  '707': "Vestfold og Telemark",//'Vestfold',
  '708': "Vestfold og Telemark",//'Telemark',
  '709': "Agder",//'Aust-Agder',
  '710': "Agder",//'Vest-Agder',
  '711': "Rogaland",//'Rogaland',
  '712': "Vestland",//'Hordaland',
  '714': "Vestland",//'Sogn og Fjordane',
  '715': "Møre og Romsdal",//'Møre og Romsdal',
  '718': "Nordland",//'Nordland',
  '719': "Troms og Finnmark",//'Troms',
  '720': "Troms og Finnmark",//'Finnmark',
  '750': "Trøndelag",//'Trøndelag',
  '2000': "No region",//'Vassdrag ikke gitt',                                                                             
  '2001': "Haldenvassdraget",//'HALDENVASSDRAGET',
  '2002': "Glommavassdraget",//'GLOMMAVASSDRAGET',
  '2003': "Mossevassdraget",//'MOSSEVASSDRAGET',
  '2004': "Hølenelva",//'HØLENELVA',
  '2005': "Nesodden og Bunnefjorden",//'NESODDEN OG BUNNEFJORDEN',
  '2006': "Nordmarkvassdraget",//'NORDMARKVASSDRAGET',
  '2007': "Lysakerelva",//'LYSAKERELVA',
  '2008': "Sandvikelva",//'SANDVIKSELVA',
  '2009': "Årosvassdraget",//'ÅROSVASSDRAGET',
  '2210': "Storelva/Kvænangen nord",
  '2012': "Drammensvassdraget",//'DRAMMENSVASSDRAGET',
  '2213': "Repparfjordvassdraget",
  '2015': "Numedalslågen og Siljansvassdraget",//'NUMEDALSLÅGEN OG SILJANVASSDRAGET',
  '2016': "Skiensvassdraget",//'SKIENSVASSDRAGET',
  '2018': "Vegårsvassdraget",//'VEGÅRSVASSDRAGET OG GJERSTADVASSDRAGET',
  '2019': "Arendalsvassdraget",//'ARENDALSVASSDRAGET',
  '2021': "Otra",//'OTRA',
  '2022': "Mandalselva",//'MANDALSELVA',
  '2027': "Bjerkreimvassdraget",//'BJERKREIMVASSDRAGET',
  '2028': "Figgjo",//'FIGGJO',
  '2037': "Saudavassdraget",//'SAUDAVASSDRAGET',
  '2038': "Vikedalselva",//'VIKEDALSELVA',
  '2041': "Etnevassdraget",//'ETNEVASSDRAGET',
  '2042': "Blåelva",//'BLÅELVA',
  '2044': "Stordøya",//'STORDØYA',
  '2048': "Opo",//'OPO',
  '2049': "Tysso",//'TYSSO',
  '2050': "Eidfjordvassdraget, Kinso og Sima",//'EIDFJORDVASSDRAGET, KINSO OG SIMA',
  '2052': "Granvinfjorden og Samlafjorden nord",//'GRANVINFJORDEN OG SAMLAFJORDEN NORD',
  '2053': "Sævareidelva",//'SÆVAREIDELVA',
  '2056': "Bergen og omegn",//'BERGEN OG OMEGN',
  '2061': "Bergsdalsvassdraget",//'BERGSDALSVASSDRAGET',
  '2062': "Vossovassdraget",//'VOSSOVASSDRAGET',
  '2067': "Masfjorden",//'MASFJORDEN',
  '2069': "Ytre Sognefjorden sør: Rutledal-Varmråk",//'YTRE SOGNEFJORDEN SØR: RUTLEDAL-VARMRÅK',
  '2070': "Viksvassdraget",//'VIKSVASSDRAGET',
  '2071': "Nærøyelvi",//'NÆRØYELVI',
  '2072': "Aurlandsvassdraget",//'AURLANDSVASSDRAGET',
  '2073': "Lærdalsvassdraget",//'LÆRDALSVASSDRAGET',
  '2074': "Årdalsvassdraget",//'ÅRDALSVASSDRAGET',
  '2075': "Fortunvassdraget",//'FORTUNVASSDRAGET',
  '2076': "Jostedøla",//'JOSTEDØLA',
  '2077': "Årøyvassdraget",//'ÅRØYVASSDRAGET',
  '2079': "Høyangervassdraget",//'HØYANGERVASSDRAGET',
  '2083': "Gaularvassdraget",//'GAULARVASSDRAGET',
  '2084': "Jølstra",//'JØLSTRA',
  '2085': "Oselvvassdraget",//'OSELVVASSDRAGET',
  '2086': "Gjengedalsvassdraget",//'GJENGEDALSVASSDRAGET',
  '2087': "Breimsvassdraget",//'BREIMSVASSDRAGET',
  '2088': "Strynvassdraget",//'STRYNVASSDRAGET',
  '2089': "Hornindalvassdraget",//'HORNINDALVASSDRAGET',
  '2093': "Rovdefjorden sør og Syvdefjorden",//'ROVDEFJORDEN SØR OG SYVDEFJORDEN',
  '2095': "Ørstavassdraget",//'ØRSTAVASSDRAGET',
  '2096': "Hareidlandet og Gurskøya",//'HAREIDLANDET OG GURSKØYA',
  '2098': "Storfjorden sør, Sunnylvsfjorden og Geirangerfjord",//'STORFJORDEN SØR, SUNNYLVSFJORDEN OG GEIRANGERFJORD',
  '2103': "Rauma",//'RAUMA',
  '2104': "Eira",//'EIRA',
  '2105': "Gusjåvassdraget",//'GUSJÅVASSDRAGET',
  '2107': "Frænfjorden, Julsundet og Hustadvika",//'FRÆNFJORDEN, JULSUNDET OG HUSTADVIKA',
  '2109': "Driva",//'DRIVA',
  '2111': "Kyst Tingvollfjorden-Surnadalsfjorden",//'KYST TINGVOLLFJORDEN-SURNADALSFJORDEN',
  '2112': "Surna",//'SURNA',
  '2119': "Trondheimsleia øst: Stamnes-Agdenes fyr",//'TRONDHEIMSLEIA ØST: STAMNES-AGDENES FYR',
  '2121': "Orkla",//'ORKLA',
  '2122': "Gaula",//'GAULA',
  '2123': "Nidelvvassdraget",//'NIDELVVASSDRAGET',
  '2124': "Stjørdalsvassdraget",//'STJØRDALSVASSDRAGET',
  '2127': "Verdalsvassdraget",//'VERDALSVASSDRAGET',
  '2128': "Snåsavassdraget",//'SNÅSAVASSDRAGET',
  '2129': "Follavassdraget",//'FOLLAVASSDRAGET',
  '2131': "Trondheimsfjorden vest",//'TRONDHEIMSFJORDEN VEST',
  '2137': "Osen og Flatanger kommuner",//'OSEN OG FLATANGER KOMMUNER',
  '2138': "Årgårdsvassdraget og Bogna",//'ÅRGÅRDSVASSDRAGET OG BOGNA',
  '2139': "Namsen",//'NAMSEN',
  '2151': "Vefsna",//'VEFSNA',
  '2153': "Leirfjord kommune",//'LEIRFJORD KOMMUNE',
  '2155': "Rossåga",//'RØSSÅGA',
  '2156': "Ranavassdraget",//'RANAVASSDRAGET',
  '2160': "Fykanåga",//'FYKANÅGA',
  '2161': "Beiarelva, Morsdalsfjorden og Nordfjorden",//'BEIARELVA, MORSDALSFJORDEN OG NORDFJORDEN',
  '2165': "Kyst Saltstraumen-Bodø-Tårnvikfjellet",//'KYST SALTSTRAUMEN-BODØ-TÅRNVIKFJELLET',
  '2173': "Skjomavassdraget",//'SKJOMAVASSDRAGET',
  '2174': "Indre Ofotfjorden",//'INDRE OFOTFJORDEN',
  '2177': "Østre Hinnøya",//'ØSTRE HINNØYA',
  '2178': "Vestre Hinnøya",//'VESTRE HINNØYA',
  '2181': "Flakstadøya og Moskenesøya",//'FLAKSTADØYA OG MOSKENESØYA',
  '2190': "Gratangen og Lavangen",//'GRATANGEN OG LAVANGEN',
  '2191': "Salangselva",//'SALANGSELVA',
  '2194': "Lakselva og Lyselvvassdraget",//'LAKSELVA OG LYSELVVASSDRAGET',
  '2195': "Senja vest",//'SENJA VEST',
  '2196': "Målselvvassdraget",//'MÅLSELVVASSDRAGET',
  '2197': "Kvaløya og Tromsøya",//'KVALØYA OG TROMSØYA',
  '2198': "Nordkjoselva",
  '2199': "Tromsøysundet og Grøtsundet øst, Reinøya og Karlsø",//'TROMSØYSUNDET OG GRØTSUNDET ØST, REINØYA OG KARLSØ',
  '2200': "Ringvassøya",//'RINGVASSØYA',
  '2203': "Lakselva",//'LAKSELVA',
  '2204': "Signaldalselva",//'SIGNALDALSELVA',
  '2206': "Kåfjordvassdraget",
  '2208': "Reisavassdraget",//'REISAVASSDRAGET',
  '2209': "Kvænangsvassdraget",//'KVÆNANGSVASSDRAGET',
  '2212': "Altavassdraget",//'ALTAVASSDRAGET',
  '2217': "Kvaløya",//'KVALØYA',
  '2221': "Magerøya",//'MAGERØYA',
  '2224': "Lakselvvassdraget",//'LAKSELVVASSDRAGET',
  '2234': "Tana",//'TANA',
  '2240': "Vestre Jakobselva",//'VESTRE JAKOBSELVA',
  '2302': "No region",//'TORNEELVEN',
  '2307': "No region",//'ÅNGERMANELVEN',
  '2308': "No region",//'INDALSELVEN',
  '2311': "No region",//"VANERN-GØTA ELV'S SIDENEDBØRFELT KLARAELVEN",
  '3001': 'Svalbard øst',
  '3002': 'Svalbard vest',
  '3003': 'Nordenskiöld Land',
  '3004': 'Svalbard sør',
  '3005': 'Øst-Finnmark',
  '3006': 'Finnmarkskysten',
  '3007': 'Vest-Finnmark',
  '3008': 'Finnmarksvidda',
  '3009': 'Nord-Troms',
  '3010': 'Lyngen',
  '3011': 'Tromsø',
  '3012': 'Sør-Troms',
  '3013': 'Indre Troms',
  '3014': 'Lofoten og Vesterålen',
  '3015': 'Ofoten',
  '3016': 'Salten',
  '3017': 'Svartisen',
  '3018': 'Helgeland',
  '3019': 'Nord-Trøndelag',
  '3020': 'Sør-Trøndelag',
  '3021': 'Ytre Nordmøre',
  '3022': 'Trollheimen',
  '3023': 'Romsdal',
  '3024': 'Sunnmøre',
  '3025': 'Nord-Gudbrandsdalen',
  '3026': 'Ytre Fjordane',
  '3027': 'Indre Fjordane',
  '3028': 'Jotunheimen',
  '3029': 'Indre Sogn',
  '3031': 'Voss',
  '3032': 'Hallingdal',
  '3033': 'Hordalandskysten',
  '3034': 'Hardanger',
  '3035': 'Vest-Telemark',
  '3036': 'Rogalandskysten',
  '3037': 'Heiane',
  '3038': 'Agder sør',
  '3039': 'Telemark sør',
  '3040': 'Vestfold',
  '3041': 'Buskerud sør',
  '3042': 'Oppland sør',
  '3043': 'Hedmark',
  '3044': 'Akershus',
  '3045': 'Oslo',
  '3046': 'Østfold'
};


function serve(
    port: number,
    observations: Observation[],
    warnings: AvalancheWarning[],
) {
    let counted = count(observations);
    let countedObsesJson = JSON.stringify(counted, replacer);

    let weather = countWeather(warnings);
    let countedWeatherJson = JSON.stringify(weather, replacer);

    const app = express();
    app.use('/static', express.static(`${__dirname}/static`));
    app.get('/', function(req, res) {
        res.sendFile(`${__dirname}/static/html/index.html`);
    });
    app.get('/weather', function(req, res) {
        res.sendFile(`${__dirname}/static/html/weather.html`);
    });

    // All observations counted
    app.get('/api/count', (_: void, res: any) => {
        res.set('Content-Type', 'application/json');
        res.send(countedObsesJson);
    });

    // All weather counted
    app.get('/api/weather', (_: void, res: any) => {
        res.set('Content-Type', 'application/json');
        res.send(countedWeatherJson);
    });

    app.listen(port, '0.0.0.0', () => {console.log(`Web server started on port ${port}.`)});
}

function count(observations: Observation[]): Counted {
    let counted: Counted = new Map();
    for (let obs of observations) {
        let date = getDate(obs);
        let year = date.getFullYear();
        let month = date.getMonth() + 1;
        let day = date.getDate();
        let region = getRegion(obs);

        if (!counted.has(region)) {
            counted.set(region, new Map());
        }
        if (!counted.get(region).has(year)) {
            counted.get(region).set(year, new Map());
        }
        if (!counted.get(region).get(year).has(month)) {
            counted.get(region).get(year).set(month, new Map());
        }
        if (!counted.get(region).get(year).get(month).has(day)) {
            counted.get(region).get(year).get(month).set(day, []);
        }

        let prev = counted.get(region).get(year).get(month).get(day);
        let tids = obs.Summaries.map((summary) => summary.RegistrationTID);
        prev.push([obs.GeoHazardTID, tids]);
    }


    // Sort the Maps
    let numSort = (a: {[n: number]: any}, b: {[n: number]: any}) => a[0] - b[0];
    counted = new Map([...counted].sort((a, b) =>
        // Ordering definition for regions
        a[0].localeCompare(b[0], "no-NO")
    ).map(([region, years]) => {
        years = new Map([...years].sort(numSort).map(([year, months]) => {
            months = new Map([...months].sort(numSort).map(([month, dates]) => {
                dates = new Map([...dates].sort(numSort).map(([date, obses]) => {
                    obses = obses
                        .map(([gTid, rTids]) => [gTid, rTids.sort()])
                        .sort(([gTidA, rTidsA], [_, rTidsB]) => {
                            let a = rTidsA as number[];
                            let b = rTidsB as number[];
                            if (a.length == b.length && a.length) {
                                return a[0] - b[0];
                            }
                            return a.length - b.length;
                        }) as [number, number[]][];
                    return [date, obses]
                }));
                return [month, dates]
            }));
            return [year, months]
        }));
        return [region, years]
    }));
    return counted;
}

function countWeather(warnings: AvalancheWarning[]): CountedWeather {
    let counted: CountedWeather = new Map();
    for (let warning of warnings) {
        if (!warning.MountainWeather) { continue }

        let date = getDateVarsom(warning);
        let year = date.getFullYear();
        let month = date.getMonth() + 1;
        let day = date.getDate();
        let region = getRegionVarsom(warning);
        let dangerLevel = parseInt(warning.DangerLevel);

        let tids = new Map([...warning.MountainWeather.MeasurementTypes].map((type) => [
            type.Id,
            new Map([...type.MeasurementSubTypes]
                .filter((sub) => sub.Value !== null)
                .map((sub) => {
                    let isWindSpeed = (type: WeatherType, sub: WeatherSubType) =>
                        (type.Id == 20 || type.Id == 30) && sub.Id == 20;
                    let isWindDir = (type: WeatherType, sub: WeatherSubType) =>
                        (type.Id == 20 || type.Id == 30) && sub.Id == 50;

                    let val: number | string;
                    if (isWindSpeed(type, sub)) {
                        if (!(sub.Value in WIND_SPEEDS)) {
                            console.error(`Unknown wind speed: ${sub.Value}`)
                        }
                        val = WIND_SPEEDS[sub.Value];
                    } else if (isWindDir(type, sub)) {
                        if (!(sub.Value in WIND_DIRS)) {
                            console.error(`Unknown wind direction: ${sub.Value}`)
                        }
                        val = WIND_DIRS[sub.Value];
                    } else if (isNaN(Number(sub.Value))) {
                        val = sub.Value;
                    } else {
                        val = Math.round(Number(sub.Value));
                    }

                    return [sub.Id, val]
                })
            )
        ]).filter(([_, subs]) => (subs as any).size) as [number, Map<number, string>][]);

        let problems = warning.AvalancheProblems
            .map((problem) => problem.AvalancheProblemTypeId)
            .filter(Boolean);

        if (tids.size) {
            if (!counted.has(region)) {
                counted.set(region, new Map());
            }
            if (!counted.get(region).has(year)) {
                counted.get(region).set(year, new Map());
            }
            if (!counted.get(region).get(year).has(month)) {
                counted.get(region).get(year).set(month, new Map());
            }
            counted.get(region).get(year).get(month).set(day, [dangerLevel, problems, tids]);
        }
    }


    // Sort the Maps
    let numSort = (a: {[n: number]: any}, b: {[n: number]: any}) => a[0] - b[0];
    counted = new Map([...counted].sort((a, b) =>
        // Ordering definition for regions
        Object.values(REGIONS).indexOf(a[0]) - Object.values(REGIONS).indexOf(b[0])
    ).map(([region, years]) => {
        years = new Map([...years].sort(numSort).map(([year, months]) => {
            months = new Map([...months].sort(numSort).map(([month, dates]) => {
                dates = new Map([...dates].sort(numSort).map(([date, [dl, problems, tids]]) => {
                    tids = new Map([...tids].sort().map(([tid, subtids]) =>
                        [tid, new Map([...subtids].sort())]
                    ));
                    return [date, [dl, problems, tids]]
                }));
                return [month, dates]
            }));
            return [year, months]
        }));
        return [region, years]
    }));
    return counted;
}

function getDate(observation: Observation): Date {
    return new Date(observation.DtObsTime);
}

function getDateVarsom(warning: AvalancheWarning): Date {
    return new Date(warning.ValidFrom.slice(0, 10));
}

function getDateStr(date: Date): string {
    let year = date.getFullYear();
    let month = (date.getMonth() + 1).toFixed(0).padStart(2, "0");
    let day = date.getDate().toFixed(0).padStart(2, "0");
    return `${year}-${month}-${day}`
}

function getRegion(observation: Observation): Region {
    let id = observation.ObsLocation.ForecastRegionTID;
    let name = REGIONS[id];
    if (!name) {
        name = observation.ObsLocation.ForecastRegionName;
        console.error(`Unknown region id ${id}: ${name}`);
    }
    return name;
}

function getRegionVarsom(warning: AvalancheWarning): Region {
    let id: any = warning.RegionId;
    let name = REGIONS[id];
    if (!name) {
        name = warning.RegionName;
        console.error(`Unknown region id ${id}: ${name}`);
    }
    return name;
}

function downloadObservations(
    callback: (observations: Observation[]) => void,
    retries: number = 10
) {
    if (retries < 0) {
        throw new Error("Failed to fetch observations count!");
    } else if (retries < 5) {
        console.error(`Failed to fetch observations count, retrying (${10 - retries}/10)...`)
    }

    let now = new Date();
    let options = {
        uri: URL_REGOBS + "/Count",
        method: 'POST',
        json: {
            LangKey: 1,
            FromDtObsTime: START_DATE.toISOString(),
            ToDtObsTime: now.toISOString(),
        },
    };

    request.post(options, (err, res, body) => {
        let fail = () => downloadObservations(callback, retries - 1);
        if (err) { return fail() }
        if (res && (res.statusCode < 200 || res.statusCode > 299)) { return fail() }
        if (!('TotalMatches' in body)) { return fail() }

        let count: number = body.TotalMatches;

        fetchAllObs(count, now, callback)
    })
}

function fetchAllObs(
    count: number,
    now: Date,
    callback: (observations: Observation[]) => void
) {
    let fetchNextbatch = () => {
        if (offset > count) { return }
        fetchBatchObs(
            offset,
            now,
            (batch) => {
                rObs.push(...batch);
                offset += REGOBS_N_RECORDS;
                if (rObs.length % 1000 < REGOBS_N_RECORDS) {
                    console.log(`Fetched ${rObs.length} out of ${count} Regobs observations.`);
                }
                if (rObs.length >= count && rObs.length - count < REGOBS_N_RECORDS) {
                    console.log(`Fetched ${rObs.length} out of ${count} Regobs observations`);
                    callback(rObs);
                } else {
                    fetchNextbatch();
                }
            },
        )
    };

    let rObs: Observation[] = [];
    let offset = -REGOBS_N_RECORDS;
    for (let parallel = 0; parallel < PARALLEL_DOWNLOADS; parallel += 1){
        offset += REGOBS_N_RECORDS;
        fetchNextbatch();
    }
}

function fetchBatchObs(
    offset: number,
    now: Date,
    callback: (observations: Observation[]) => void,
    retries: number = 10
) {
    if (retries < 0) {
        throw new Error(`Failed to fetch batch of observations (offset: ${offset})!`);
    } else if (retries < 10) {
        console.error(`Failed to fetch batch of observations (offset: ${offset}), retrying (${10 - retries}/10)...`)
    }

    let options = {
        uri: URL_REGOBS,
        method: 'POST',
        json: {
            LangKey: 1,
            FromDtObsTime: START_DATE.toISOString(),
            ToDtObsTime: now.toISOString(),
            NumberOfRecords: REGOBS_N_RECORDS,
            Offset: offset
        },
    };

    request.post(options, (err, res, body) => {
        let fail = () => fetchBatchObs(offset, now, callback, retries - 1);
        if (err) { return fail() }
        if (res && (res.statusCode < 200 || res.statusCode > 299)) { return fail() }
        if (!Array.isArray(body)) { return fail() }

        callback(body)
    })
}

function downloadVarsom(
    callback: (warnings: AvalancheWarning[]) => void,
) {
    let fetchNextbatch = () => {
        sync++;
        fetchBatchVarsom(
            new Date(fromDate),
            now,
            (batch) => {
                sync--;
                warnings.push(...batch);

                let lastForecast = new Date(new Date(now).setDate(now.getDate() + 2));
                if (batch.length) {
                    console.log(`Fetched ${warnings.length} avalanche warnings.`);
                }

                if (fromDate >= lastForecast && sync == 0) {
                    fs.writeFileSync("cache/varsom.json", JSON.stringify(warnings, null, 2));
                    callback(warnings);
                } else if (fromDate < lastForecast) {
                    fromDate.setDate(fromDate.getDate() + VARSOM_N_RECORDS);
                    fetchNextbatch();
                }
            },
        )
    };

    let now = new Date();
    let warnings: AvalancheWarning[];
    let fromDate = new Date(START_DATE.getTime());
    let sync = 0;
    let buf;
    try {
        buf = fs.readFileSync("cache/varsom.json");
        console.log("Reading Varsom cache file.");
        warnings = JSON.parse(buf.toString())
            .filter((warning: AvalancheWarning) => {
                let date = getDateVarsom(warning);
                let tooNew = new Date(new Date().setDate(new Date().getDate() - 30));
                return date < tooNew;
            });
        warnings = warnings.sort((a, b) =>
            getDateVarsom(a).getTime() - getDateVarsom(b).getTime()
        );
        let lastWarning = warnings[warnings.length - 1];
        let fromDateStr = getDateVarsom(lastWarning);
        fromDate = new Date(fromDateStr);
        fromDate.setDate(fromDate.getDate() + 1);
        console.log(`Using ${warnings.length} cached avalanche warnings.`)
    } catch {
        console.error("Failed to read Varsom cache file.");
        warnings = [];
    }
    
    fetchNextbatch();
}

function fetchBatchVarsom(
    fromDate: Date,
    now: Date,
    callback: (batch: AvalancheWarning[]) => void,
    selectedRegion: number = null,
    retries: number = 10
) {
    let toDate = new Date(new Date(fromDate).setDate(fromDate.getDate() + VARSOM_N_RECORDS - 1));
    let fromStr = getDateStr(fromDate);
    let toStr = getDateStr(toDate);
    let failStr = "Failed to fetch batch of avalanche warnings";

    let batch: AvalancheWarning[] = [];
    let sync = 0;
    for (let region = 3000; region < 3050; region++) {
        if (selectedRegion && selectedRegion != region) { continue }
        if (!REGIONS.hasOwnProperty(region.toFixed(0))) { continue }
        if (retries < 0) {
            throw new Error(`${failStr} (from: ${fromStr}, to: ${toStr})!`);
        } else if (retries < 10) {
            console.error(`${failStr} (from: ${fromStr}, to: ${toStr}), retrying (${10 - retries}/10)...`)
        }

        let uri = `${URL_VARSOM}/${region}/2/${fromStr}/${toStr}`;
        sync++;
        request.get({uri}, (err, res, body) => {
            sync--;
            let fail = () => fetchBatchVarsom(fromDate, now, callback, region, retries - 1);
            if (err) { return fail() }
            if (res && (res.statusCode < 200 || res.statusCode > 299)) { return fail() }

            let json;
            try {
                json = JSON.parse(body as any as string);
            } catch {
                return fail();
            }
            if (!Array.isArray(batch)) { return fail() }

            json = json.filter((warning: AvalancheWarning) => {
                let dl = Number(warning.DangerLevel);
                return dl && dl < 5;
            });
            batch.push(...json);

            if (sync == 0) { callback(batch) }
        })
    }
}

function replacer<K, V>(key: K, value: V) {
    if (value instanceof Map) {
        return Object.fromEntries(value);
    } else {
        return value;
    }
}

let observations_: Observation[] = null;
let warnings_: AvalancheWarning[] = null;
let runServer = () => {
    if (observations_ && warnings_) {
        serve(PORT, observations_, warnings_);
    }
};
downloadObservations((obses) => {
    observations_ = obses;
    runServer();
});
downloadVarsom((avalancheWarnings) => {
    warnings_ = avalancheWarnings;
    runServer();
});