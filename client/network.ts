function get(url: string, old_request: [XMLHttpRequest | null], callback: (responseText: string) => void): void {
    if (old_request[0]) old_request[0].abort();
    let request = new XMLHttpRequest();
    request.open("GET", url, true);
    request.onreadystatechange = () => {
        if (request.readyState == XMLHttpRequest.DONE) {
            if (request.status >= 200 && request.status < 400) {
                callback(request.responseText);
            }
        }
    };
    request.send();
    old_request[0] = request;
}

export {get};