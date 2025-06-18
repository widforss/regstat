import {Counted, initWeather, addCharts, Options} from "./chart_weather";
import {fetchData} from "./download";

fetchData<Counted>("./api/weather", (counted) => {
    let root = document.getElementById("weather-charts");
    let plusDiv = document.createElement("div");
    let plus = document.createElement("span");
    let column_options: Options[] = [];
    root.appendChild(plusDiv)
    plusDiv.appendChild(plus);

    plus.innerText = "＋";
    plusDiv.classList.add("plus");
    plusDiv.onclick = () => {
        column_options.push(addCharts(counted, column_options));
    }

    column_options.push(addCharts(counted, null));
})