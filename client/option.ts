import { populateCharts, Counted, Charts } from "./chart";
import {REGIONS, REGIONS_A, REGIONS_B, Region, REGIONS_LAND, REGIONS_WATER, REGIONS_ICE} from "./region";
import { Ol } from "./ol";

interface Options {
    filter: string,
    average: number,
    regions: Region[],
    hydrological: boolean,
    schema: boolean,
}

interface OptionsDom {
    filter: HTMLDivElement,
    average: HTMLInputElement,
    regionsSnow: HTMLDivElement,
    regionsLand: HTMLDivElement,
    regionsWater: HTMLDivElement,
    regionsIce: HTMLDivElement,
    radioObs: HTMLInputElement,
    radioSchema: HTMLInputElement,
    radioHydro: HTMLInputElement,
    radioCal: HTMLInputElement,
}

type MenuTree = {[title: string]: [string, MenuTree, (box: HTMLInputElement) => void]}

let mode: "all"|"snow"|"land"|"ice"|"water" = "all";

function getOptionsDom(): OptionsDom {
    let domIds = {
        average: "avg-num",
        radioObs: "radio-schema-obs",
        radioSchema: "radio-schema-schema",
        radioHydro: "radio-hydro-hydro",
        radioCal: "radio-hydro-cal",
    }

    let domObj: {[input: string]: HTMLElement | {[input: string]: HTMLElement}} = {};
    for (let [input, id] of Object.entries(domIds)) {
        domObj[input] = <HTMLInputElement> document.getElementById(id);
    }

    domObj.regionsSnow = document.getElementById("regionboxes-snow");
    domObj.regionsLand = document.getElementById("regionboxes-land");
    domObj.regionsWater = document.getElementById("regionboxes-water");
    domObj.regionsIce = document.getElementById("regionboxes-ice");
    domObj.filter = document.getElementById("filter-radio");

    return domObj as any as OptionsDom;
}

function initOptions(cachedCounted: Counted, charts: Charts, map: Ol) {
    let onInput = () => populateCharts(cachedCounted, charts, map);

    let oDiv = getOptionsDom(); // Not all children populated yet!

    let all = () => {
        mode = "all";
        document.getElementById("chart-regions").classList.add("hidden");
        document.getElementById("chart-correct-forecast").classList.add("hidden");
        document.getElementById("chart-correct-forecast-regions").classList.add("hidden");
        oDiv.regionsSnow.classList.add("hidden");
        oDiv.regionsLand.classList.add("hidden");
        oDiv.regionsWater.classList.add("hidden");
        oDiv.regionsIce.classList.add("hidden");
        onInput();
    }
    let snow = () => {
        mode = "snow";
        document.getElementById("chart-regions").classList.remove("hidden");
        document.getElementById("chart-correct-forecast").classList.remove("hidden");
        document.getElementById("chart-correct-forecast-regions").classList.remove("hidden");
        oDiv.regionsSnow.classList.remove("hidden");
        oDiv.regionsLand.classList.add("hidden");
        oDiv.regionsWater.classList.add("hidden");
        oDiv.regionsIce.classList.add("hidden");
        onInput();
    };
    let land = () => {
        mode = "land";
        document.getElementById("chart-regions").classList.remove("hidden");
        oDiv.regionsSnow.classList.add("hidden");
        oDiv.regionsLand.classList.remove("hidden");
        oDiv.regionsWater.classList.add("hidden");
        oDiv.regionsIce.classList.add("hidden");
        onInput();
    };
    let water = () => {
        mode = "water";
        document.getElementById("chart-regions").classList.remove("hidden");
        oDiv.regionsSnow.classList.add("hidden");
        oDiv.regionsLand.classList.add("hidden");
        oDiv.regionsWater.classList.remove("hidden");
        oDiv.regionsIce.classList.add("hidden");
        onInput();
    };
    let ice = () => {
        mode = "ice";
        document.getElementById("chart-regions").classList.remove("hidden");
        oDiv.regionsSnow.classList.add("hidden");
        oDiv.regionsLand.classList.add("hidden");
        oDiv.regionsWater.classList.add("hidden");
        oDiv.regionsIce.classList.remove("hidden");
        onInput();
    };
    let filterTree: MenuTree = {
        //"All": ["all", {}, onInput],
        "All": ["all", {}, all],
        "Soil": ["allSoil", {
            "Danger sign": ["dangersignSoil", {}, land],
            "Landslide": ["landslideSoil", {}, land],
            "Notes": ["notesSoil", {}, land],
        }, land],
        "Water": ["allWater", {
            "Danger sign": ["dangersignWater", {}, water],
            "Damages": ["damagesWater", {}, water],
            "Water level": ["levelWater", {}, water],
            "Notes": ["notesWater", {}, water],
        }, water],
        "Ice": ["allIce", {
            "Ice cover": ["coverIce", {}, ice],
            "Ice thickness": ["thicknessIce", {}, ice],
            "Danger sign": ["dangersignIce", {}, ice],
            "Incident": ["incidentIce", {}, ice],
            "Notes": ["notesIce", {}, ice],
        }, ice],
        "Snow": ["allSnow", {
            "Advanced": ["advanced", {}, snow],
            "Simple": ["simple", {}, snow],
            "Incident": ["avalancheAndAccident", {
                "Avalanche": ["avalanche", {}, snow],
                "Incident": ["accident", {}, snow],
            }, snow],
            "Avalanche and danger sign": ["avalancheAndDangersign", {
                "Danger sign": ["dangersign", {}, snow],
                "Avalanche": ["avalanche", {}, snow],
                "Avalanche activity": ["avalancheActivity", {}, snow],
            }, snow],
            "Snow cover and weather": ["snowcoverAndWeather", {
                "Snow cover": ["snowcover", {}, snow],
                "Weather": ["weather", {}, snow],
                "Test": ["tests", {}, snow],
                "Snow profile": ["profile", {}, snow],
            }, snow],
            "Assessment and problem": ["advanced", {
                "Problem": ["problem", {}, snow],
                "Assessment": ["assessment", {}, snow],
            }, snow],
            "Notes": ["notes", {}, snow],
            "Snow surface forms": ["surfaceforms", {
                ">30 cm loose snow": ["30cmloose", {}, snow],
                "10–30 cm loose snow": ["10-30cmloose", {}, snow],
                "1–10 cm loose snow": ["1-10cmloose", {}, snow],
                "SH on hard surface": ["SHhard", {}, snow],
                "SH on soft surface": ["SHsoft", {}, snow],
                "Near surface facets": ["FC", {}, snow],
                "Crust": ["MFcr", {}, snow],
                "Wind slab": ["windslab", {}, snow],
                "Storm slab": ["stormslab", {}, snow],
                "Wet loose": ["wetloose", {}, snow],
                "Other": ["other", {}, snow],
            }, snow],
        }, snow],
    }
    oDiv.filter.appendChild(checkboxTree(filterTree, "radio", "all"));

    let regionTree: MenuTree = {
        "No region": ["No region", {}, onInput],
        "A-regions": [null, {}, onInput],
        "B-regions": [null, {}, onInput],
    }
    let iterator: [string, string[]][] = [
        ["A-regions", Object.keys(REGIONS_A)],
        ["B-regions", Object.keys(REGIONS_B)],
    ];
    for (let [parent, regions] of iterator) {
        for (let region of regions) {
            regionTree[parent][1][region] = [region, {}, onInput];
        }
    }
    oDiv.regionsSnow.appendChild(checkboxTree(regionTree))

    let landTree: MenuTree = {
        "All regions": [null, {}, onInput],
        "No region": ["No region", {}, onInput],
    };
    REGIONS_LAND.forEach((name) => {
        landTree["All regions"][1][name] = [name, {}, onInput];
    });
    oDiv.regionsLand.appendChild(checkboxTree(landTree))

    let waterTree: MenuTree = {
        "All regions": [null, {}, onInput],
        "No region": ["No region", {}, onInput],
    };
    REGIONS_WATER.forEach((name) => {
        waterTree["All regions"][1][name] = [name, {}, onInput];
    });
    oDiv.regionsWater.appendChild(checkboxTree(waterTree))

    let iceTree: MenuTree = {
        "All regions": [null, {}, onInput],
        "No region": ["No region", {}, onInput],
    };
    REGIONS_ICE.forEach((name) => {
        iceTree["All regions"][1][name] = [name, {}, onInput];
    });
    oDiv.regionsIce.appendChild(checkboxTree(iceTree))

    oDiv = getOptionsDom();
    oDiv.radioObs.addEventListener("input", onInput);
    oDiv.radioSchema.addEventListener("input", onInput);
    oDiv.radioHydro.addEventListener("input", onInput);
    oDiv.radioCal.addEventListener("input", onInput);
    Object.values(oDiv.filter).forEach((elem) => elem.addEventListener("input", onInput))
    oDiv.average.addEventListener('input', () => {
        let value = parseInt(oDiv.average.value);
        if (!isNaN(value) && value > 0 && value <= 20) {
            oDiv.average.classList.remove("invalid");
            onInput()
        } else {
            oDiv.average.classList.add("invalid");
        }
    });
}

function getOptions(): Options {
    let oDiv = getOptionsDom();

    let regions: Region[];
    let regionsDiv = {
        "all": document.createElement("div"),
        "snow": oDiv.regionsSnow,
        "land": oDiv.regionsLand,
        "water": oDiv.regionsWater,
        "ice": oDiv.regionsIce,
    }[mode];
    if (mode == "all"){
        regions = Object.keys(REGIONS).concat(REGIONS_LAND).concat(REGIONS_WATER).concat(REGIONS_ICE)
            .filter((v, i, a) => a.indexOf(v) == i)
    } else if (regionsDiv.lastChild) {
        regions = checkboxValues(regionsDiv.lastChild as HTMLDivElement);
    } else {
        regions = [];
    }

    let filter: string;
    if(oDiv.filter.lastChild) {
        filter = radioValues(oDiv.filter.lastChild as HTMLDivElement);
    } else {
        filter = "none";
    }

    return {
        filter,
        average: parseInt(oDiv.average.value),
        regions,
        schema: oDiv.radioSchema.checked,
        hydrological: oDiv.radioHydro.checked,
    };
}

function checkboxTree(
    tree: MenuTree,
    radio: string = "",
    radioActive: string = "",
): HTMLElement {
    if (!Object.keys(tree).length) {
        return document.createElement("span");
    }
    let root = document.createElement("div");
    root.style.marginLeft = "0px"
    root.classList.add("checkbox-list");

    Object.entries(tree).map(([title, [value, gChilds, callback]]) => {

        let main = document.createElement("div");
        let label = document.createElement("label");
        let legend = document.createElement("span");
        let primary = document.createElement("input");
        let br = document.createElement("br");
        let secondary = checkboxTree(gChilds, radio, radioActive);

        let margin = parseInt(secondary.style.marginLeft);
        secondary.style.marginLeft = `${margin + 20}px`;

        legend.innerText = title;
        if (radio) {
            primary.type = "radio";
            primary.name = radio;
            if (value == radioActive) {
                primary.checked = value == radioActive;
                secondary.classList.remove("hidden");
            } else {
                secondary.classList.add("hidden");
            }
        } else {
            primary.type = "checkbox";
            primary.checked = true;
        }
        primary.value = value;

        let childBoxes = [...secondary.childNodes].map((child) =>
            child.firstChild.firstChild as HTMLInputElement
        );
        let onPrimary = () => {
            if (primary.checked && !radio) {
                childBoxes.map((child) => {
                    child.checked = true;
                })
            } else if (!radio) {
                childBoxes.map((child) => {
                    child.checked = false;
                })
            } else {
                [...root.childNodes, ...secondary.childNodes].forEach((main) => {
                    (main.lastChild as HTMLDivElement).classList.add("hidden");
                })
                secondary.classList.remove("hidden");
            }
            callback(primary);
        };
        let onSecondary = () => {
            let active = childBoxes
                .map((elem) => elem.checked)
                .reduce((acc, value) => acc + (value as unknown as number), 0)
            if (active == 0 && !radio) {
                primary.indeterminate = false;
                primary.checked = false;
            } else if (active == childBoxes.length && !radio) {
                primary.indeterminate = false;
                primary.checked = true;
            } else if (!radio) {
                primary.checked = false;
                primary.indeterminate = true;
            } else {
                secondary.classList.remove("hidden");
            }
        };
        primary.addEventListener("input", onPrimary);
        secondary.addEventListener("input", onSecondary);

        label.appendChild(primary);
        label.appendChild(legend);
        main.appendChild(label);
        main.appendChild(br);
        main.appendChild(secondary);

        if (value == radioActive) {
            main.dispatchEvent(new Event("input"));
        }

        root.appendChild(main);
    })
    return root;
}

function checkboxValues(root: HTMLDivElement): string[] {
    let values: string[] = [];

    [...root.childNodes].forEach((main) => {
        let primary = main.firstChild.firstChild as HTMLInputElement;
        let secondary = main.lastChild as HTMLDivElement;
        if (primary.checked && primary.value) {
            values.push(primary.value);
        }
        values = values.concat(checkboxValues(secondary));
    });
    return values;
}

function radioValues(root: HTMLDivElement): string {
    for (let main of root.childNodes) {
        let primary = main.firstChild.firstChild as HTMLInputElement;
        let secondary = main.lastChild as HTMLDivElement;
        if (primary.checked) {
            return primary.value;
        }
        let secondaryValue = radioValues(secondary);
        if (secondaryValue) {
            return secondaryValue;
        }
    }
}

export {initOptions, getOptions};