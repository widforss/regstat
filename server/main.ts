import * as request from "request";
import * as express from "express";

const PORT = 10418;
const URL = "https://api.regobs.no/v4/Search";
const N_RECORDS = 50;
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

type Year = number;
type Month = number;
type Day = number;
type Region = string;
type RegionId = number;
type Tid = number;
type Counted = Map<Region, Map<Year, Map<Month, Map<Day, [Tid, Tid[]][]>>>>;

let REGIONS: {[region: number]: Region} = {
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
  '2012': "Drammensvassdraget",//'DRAMMENSVASSDRAGET',
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
  '2199': "Tromsøysundet og Grøtsundet øst, Reinøya og Karlsø",//'TROMSØYSUNDET OG GRØTSUNDET ØST, REINØYA OG KARLSØ',
  '2200': "Ringvassøya",//'RINGVASSØYA',
  '2203': "Lakselva",//'LAKSELVA',
  '2204': "Signaldalselva",//'SIGNALDALSELVA',
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
}


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
        let date = getDate(obs);
        let year = date.getFullYear();
        let month = date.getMonth() + 1;
        let day = date.getDate();
        let region = getRegion(obs);

        if (!(region in regionIds)) {
            regionIds[region] = getRegionId(obs);
        }

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

        let prev = counted.get(region).get(year).get(month).get(day)
        let tids = obs.Summaries.map((summary) => summary.RegistrationTID)
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
                        .sort(([gTidA, rTidsA], [gTidB, rTidsB]) => {
                            let a = rTidsA as number[];
                            let b = rTidsB as number[];
                            if (a.length == b.length && a.length) {
                                return a[0] - b[0];
                            }
                            return a.length - b.length;
                        }) as [number, number[]][];
                    return [date, obses]
                }))
                return [month, dates]
            }))
            return [year, months]
        }))
        return [region, years]
    }));
    return counted;
}

function getDate(observation: Observation): Date {
    return new Date(observation.DtObsTime);
}

function getRegion(observation: Observation): Region {
    let id = observation.ObsLocation.ForecastRegionTID;
    return REGIONS[id];
}

function getRegionId(observation: Observation): RegionId {
    return observation.ObsLocation.ForecastRegionTID;
}

function downloadObservations(
    url: string,
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
        uri: url + "/Count",
        method: 'POST',
        json: {
            LangKey: 1,
            FromDtObsTime: new Date(2017, 8, 1).toISOString(),
            ToDtObsTime: now.toISOString(),
        },
    }

    request.post(options, (err, res, body) => {
        let fail = () => downloadObservations(url, callback, retries - 1);
        if (err) { return fail() }
        if (res && (res.statusCode < 200 || res.statusCode > 299)) { return fail() }
        if (!('TotalMatches' in body)) { return fail() }

        let count: number = body.TotalMatches

        fetchAll(url, count, now, callback)
    })
}

function fetchAll(
    url: string,
    count: number,
    now: Date,
    callback: (observations: Observation[]) => void
) {
    let fetchNextbatch = () => {
        if (offset > count) { return }
        fetchBatch(
            url,
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
    offset: number,
    now: Date,
    rObs: Observation[],
    callback: (observations: Observation[]) => void,
    retries: number = 10
) {
    if (retries < 0) {
        throw new Error(`Failed to fetch batch of observations (offset: ${offset})!`);
    } else if (retries < 10) {
        console.error(`Failed to fetch batch of observations (offset: ${offset}), retrying (${10 - retries}/10)...`)
    }

    let options = {
        uri: url,
        method: 'POST',
        json: {
            LangKey: 1,
            FromDtObsTime: new Date(2017, 8, 1).toISOString(),
            ToDtObsTime: now.toISOString(),
            NumberOfRecords: N_RECORDS,
            Offset: offset
        },
    }

    request.post(options, (err, res, body) => {
        let fail = () => fetchBatch(url, offset, now, rObs, callback, retries - 1);
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

downloadObservations(URL, (obses) => serve(PORT, obses));