import {Counted, initWeather, addCharts} from "./chart_weather";
import {fetchData} from "./download";

fetchData<Counted>("./api/weather", (counted) => {
    let root = document.getElementById("weather-charts");
    let plusDiv = document.createElement("div");
    let plus = document.createElement("span");
    root.appendChild(plusDiv)
    plusDiv.appendChild(plus);

    plus.innerText = "＋";
    plusDiv.classList.add("plus");
    plusDiv.onclick = () => addCharts(counted);

    addCharts(counted);
})