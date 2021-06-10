import {Counted} from "./chart"

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

export {fetchData};