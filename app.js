var map = null;
var markersLayer = null;
var selectedCity = null;
var charts = {};
var filteredSettlements = settlementsData || [];

$(document).ready(function() {
    initMap();
    initSearch();
    updateMarkerCount();

    $("#populationFilter").on("change", filterMarkers);
});

function initMap() {
    map = L.map("map", {
        center: [55.75, 37.62],
        zoom: 5
    });

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: "© OpenStreetMap",
        maxZoom: 18
    }).addTo(map);

    markersLayer = L.layerGroup().addTo(map);
    addMarkers();
}

function getMarkerRadius(pop) {
    if (pop >= 1000000) return 10;
    if (pop >= 500000) return 8;
    if (pop >= 250000) return 7;
    if (pop >= 100000) return 6;
    return 4;
}

function getMarkerColor(pop) {
    if (pop >= 1000000) return "#2563eb";
    if (pop >= 500000) return "#3b82f6";
    if (pop >= 250000) return "#60a5fa";
    return "#93c5fd";
}

function addMarkers() {
    markersLayer.clearLayers();

    filteredSettlements.forEach(function(city) {
        var marker = L.circleMarker([city.lat, city.lon], {
            radius: getMarkerRadius(city.pop),
            fillColor: getMarkerColor(city.pop),
            color: "#fff",
            weight: 1.5,
            opacity: 1,
            fillOpacity: 0.75
        });

        var popupHtml =
            '<div><b>' + escapeHtml(city.name) + '</b><br>' +
            'Регион: ' + escapeHtml(city.region) + '<br>' +
            'Население: ' + formatPop(city.pop) + '<br>' +
            '<button onclick="getForecast(' + city.lat + ', ' + city.lon + ', \'' + escapeHtml(city.name).replace(/'/g, "\\'") + '\', \'' + escapeHtml(city.region).replace(/'/g, "\\'") + '\', ' + city.pop + ')">Показать прогноз</button>' +
            '</div>';

        marker.bindPopup(popupHtml);
        markersLayer.addLayer(marker);
    });

    updateMarkerCount();
}

function filterMarkers() {
    var minPop = parseInt($("#populationFilter").val()) || 0;

    filteredSettlements = settlementsData.filter(function(city) {
        return city.pop >= minPop;
    });

    addMarkers();
}

function updateMarkerCount() {
    $("#markerCount").text(markersLayer.getLayers().length);
}

function getForecast(lat, lon, name, region, pop) {
    $("#loader").show();
    $("#charts").hide();
    $("#currentWeather").hide();
    $("#errorBox").hide();
    $("#forecastStatus").hide();

    $("#forecastTitle").text(name);
    $("#forecastMeta").text("Регион: " + region + " | Население: " + formatPop(pop));

    selectedCity = { lat: lat, lon: lon, name: name, region: region, pop: pop };

    var url = "https://api.open-meteo.com/v1/forecast" +
        "?latitude=" + lat +
        "&longitude=" + lon +
        "&hourly=temperature_2m,precipitation,wind_speed_10m" +
        "&daily=temperature_2m_max,temperature_2m_min,precipitation_sum,wind_speed_10m_max,relative_humidity_2m_max" +
        "&current=temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,wind_speed_10m,pressure_msl,precipitation,cloud_cover" +
        "&forecast_days=7" +
        "&wind_speed_unit=ms" +
        "&timezone=Europe%2FMoscow";

    $.ajax({
        url: url,
        method: "GET",
        dataType: "json",
        timeout: 15000,
        success: function(data) {
            $("#loader").hide();
            showCurrentWeather(data.current);
            showCharts(data.hourly);
            showDaily(data.daily);
            $("#charts").show();
            $("#currentWeather").show();
        },
        error: function(xhr, status, error) {
            $("#loader").hide();
            $("#errorMsg").text("Ошибка загрузки прогноза: " + error);
            $("#errorBox").show();
        }
    });
}

function showCurrentWeather(cur) {
    var temp = Math.round(cur.temperature_2m);
    var feels = Math.round(cur.apparent_temperature);
    var hum = Math.round(cur.relative_humidity_2m);
    var wind = cur.wind_speed_10m.toFixed(1);
    var press = Math.round(cur.pressure_msl / 133.322);
    var precip = cur.precipitation.toFixed(1);
    var clouds = Math.round(cur.cloud_cover);

    $("#currentTemp").text(temp);
    $("#curFeels").text(feels + " °C");
    $("#curHumidity").text(hum + "%");
    $("#curWind").text(wind + " м/с");
    $("#curPressure").text(press + " мм");
    $("#curPrecip").text(precip + " мм");
    $("#curClouds").text(clouds + "%");

    var info = getWeatherInfo(cur.weather_code);
    $("#weatherTxt").remove();
    $("#currentMain").append('<div id="weatherTxt">' + info.icon + ' ' + info.desc + '</div>');
}

function showCharts(hourly) {
    if (charts.temp) charts.temp.destroy();
    if (charts.precip) charts.precip.destroy();
    if (charts.wind) charts.wind.destroy();

    var times = hourly.time.slice(0, 72);
    var labels = [];
    for (var i = 0; i < times.length; i++) {
        var d = new Date(times[i]);
        labels.push(d.getDate() + "." + (d.getMonth() + 1) + " " + d.getHours() + ":00");
    }

    charts.temp = new Chart(document.getElementById("tempChart").getContext("2d"), {
        type: "line",
        data: {
            labels: labels,
            datasets: [{
                label: "Температура",
                data: hourly.temperature_2m.slice(0, 72),
                borderColor: "#e74c3c",
                backgroundColor: "rgba(231,76,60,0.1)",
                fill: true,
                tension: 0.3,
                pointRadius: 1
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: { y: {} }
        }
    });

    charts.precip = new Chart(document.getElementById("precipChart").getContext("2d"), {
        type: "bar",
        data: {
            labels: labels,
            datasets: [{
                label: "Осадки",
                data: hourly.precipitation.slice(0, 72),
                backgroundColor: "rgba(52,152,219,0.6)"
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: { y: { beginAtZero: true } }
        }
    });

    charts.wind = new Chart(document.getElementById("windChart").getContext("2d"), {
        type: "line",
        data: {
            labels: labels,
            datasets: [{
                label: "Ветер",
                data: hourly.wind_speed_10m.slice(0, 72),
                borderColor: "#27ae60",
                backgroundColor: "rgba(39,174,96,0.1)",
                fill: true,
                tension: 0.3,
                pointRadius: 1
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: { y: { beginAtZero: true } }
        }
    });
}

function showDaily(daily) {
    var tbody = $("#dailyTable tbody");
    tbody.empty();

    for (var i = 0; i < daily.time.length; i++) {
        var d = new Date(daily.time[i]);
        var dayName = ["Вс", "Пн", "Вт", "Ср", "Чт", "Пт", "Сб"][d.getDay()];
        var dateStr = dayName + " " + d.getDate() + "." + (d.getMonth() + 1);
        var maxT = Math.round(daily.temperature_2m_max[i]);
        var minT = Math.round(daily.temperature_2m_min[i]);
        var precip = daily.precipitation_sum[i].toFixed(1);
        var wind = daily.wind_speed_10m_max[i].toFixed(1);
        var hum = Math.round(daily.relative_humidity_2m_max[i]);

        tbody.append(
            "<tr><td>" + dateStr + "</td><td>" + maxT + "°C</td><td>" + minT + "°C</td><td>" +
            precip + " мм</td><td>" + wind + " м/с</td><td>" + hum + "%</td></tr>"
        );
    }
}

function initSearch() {
    var timer = null;

    $("#citySearch").on("input", function() {
        var q = $(this).val().trim().toLowerCase();
        clearTimeout(timer);

        if (q.length < 1) {
            $("#searchResults").removeClass("open").empty();
            return;
        }

        timer = setTimeout(function() {
            doSearch(q);
        }, 200);
    });

    $(document).on("click", function(e) {
        if (!$(e.target).closest("#search-block").length) {
            $("#searchResults").removeClass("open");
        }
    });
}

function doSearch(query) {
    var results = [];

    for (var i = 0; i < settlementsData.length; i++) {
        if (results.length >= 10) break;
        if (settlementsData[i].name.toLowerCase().indexOf(query) >= 0) {
            results.push(settlementsData[i]);
        }
    }

    var $box = $("#searchResults").empty().removeClass("open");

    if (results.length === 0) {
        $box.html('<div class="no-results">Ничего не найдено</div>').addClass("open");
        return;
    }

    for (var j = 0; j < results.length; j++) {
        (function(city) {
            var item = $("<div>")
                .addClass("search-item")
                .html('<span class="sname">' + escapeHtml(city.name) + '</span><br>' +
                      '<span class="sregion">' + escapeHtml(city.region) + ' | ' + formatPop(city.pop) + '</span>')
                .on("click", function() {
                    $("#searchResults").removeClass("open");
                    map.setView([city.lat, city.lon], 11);
                    getForecast(city.lat, city.lon, city.name, city.region, city.pop);
                })
                .appendTo($box);
        })(results[j]);
    }

    $box.addClass("open");
}

function escapeHtml(text) {
    var div = document.createElement("div");
    div.appendChild(document.createTextNode(text));
    return div.innerHTML;
}

function formatPop(pop) {
    if (pop >= 1000000) {
        return (pop / 1000000).toFixed(1).replace(".", ",") + " млн";
    }
    return pop.toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ");
}

function getWeatherInfo(code) {
    var map = {
        0:  { icon: "\u2600\uFE0F", desc: "Ясно" },
        1:  { icon: "\uD83C\uDF24\uFE0F", desc: "Малооблачно" },
        2:  { icon: "\u26C5", desc: "Переменная облачность" },
        3:  { icon: "\u2601\uFE0F", desc: "Пасмурно" },
        45: { icon: "\uD83C\uDF2B\uFE0F", desc: "Туман" },
        51: { icon: "\uD83C\uDF27\uFE0F", desc: "Слабая морось" },
        61: { icon: "\uD83C\uDF27\uFE0F", desc: "Дождь" },
        63: { icon: "\uD83C\uDF27\uFE0F", desc: "Умеренный дождь" },
        65: { icon: "\uD83C\uDF27\uFE0F", desc: "Сильный дождь" },
        71: { icon: "\u2744\uFE0F", desc: "Снег" },
        73: { icon: "\u2744\uFE0F", desc: "Умеренный снег" },
        75: { icon: "\u2744\uFE0F", desc: "Сильный снег" },
        80: { icon: "\uD83C\uDF26\uFE0F", desc: "Ливень" },
        82: { icon: "\u26C8\uFE0F", desc: "Сильный ливень" },
        95: { icon: "\u26C8\uFE0F", desc: "Гроза" }
    };
    return map[code] || { icon: "\u2753", desc: "\u2014" };
}