const moddableProxy = require("@moddable/pebbleproxy");

function xhrRequest(url, callback) {
    console.log("Building xhrRequest for " + url);
    try{
        const xhr = new XMLHttpRequest();
        xhr.timeout = 8000;
        xhr.onload = function() {
            console.log("xhrRequest: onload, status=" + xhr.status);
            callback(xhr.responseText);
        };
        xhr.onerror = function(err) {
            console.log("xhrRequest: onerror, status=" + xhr.status);
            errback("network error");
        };
        xhr.ontimeout = function() {
            console.log("xhrRequest: timed out");
            errback("timeout");
        };
        xhr.open("GET", url);
        console.log("xhrRequest: opened, sending");
        xhr.send();
        console.log("xhrRequest: send() returned");
    } catch (e) {
        console.log("xhrRequest: threw synchronously: " + e);
        errback(String(e));
    }
}
Pebble.addEventListener("ready", function(_e) {
    console.log("PKJS ready");
});

Pebble.addEventListener("appmessage", function(e) {
    if(!e || !e.payload) return;
    const payload = e.payload;
    console.log("PKJS got appmessage: " + JSON.stringify(payload));

    // Weather request from watch gets parsed on phone
    if (payload.LATITUDE !== undefined && payload.LONGITUDE !== undefined) {
        try {
            console.log("Weather request for " + payload.LATITUDE + ", " + payload.LONGITUDE);
            const lat = payload.LATITUDE / 1e6;
            const lon = payload.LONGITUDE /1e6;
            const url = "http://api.open-meteo.com/v1/forecast?latitude=" + lat + "&longitude=" + lon + "&current=temperature_2m,weather_code,relative_humidity_2m";

            xhrRequest(url, function (responseText) {
                try {
                    const data = JSON.parse(responseText);
                    Pebble.sendAppMessage({
                        WEATHER_TEMP: Math.round(data.current.temperature_2m * 1.8 + 32),
                        WEATHER_CODE: data.current.weather_code,
                        WEATHER_HUMIDITY: Math.round(data.current.relative_humidity_2m)
                    }, function() {
                        console.log("Sent weather to watch");
                    }, function (err) {
                        console.log("Weather send failed: " + JSON.stringify(err));
                    });
                } catch (err) {
                    console.log("Weather parse failed: " + err);
                }
            }, function(err) {
                console.log("weather fetch failed: " + err);
            });
        } catch (e) {
            console.log("Weather branch threw: " + e);
        }
        return;
    }

    if (moddableProxy.appMessageReceived(e)) return;

    const relay = {};

    if (payload.HEALTH_STEPS !== undefined) relay.HEALTH_STEPS = payload.HEALTH_STEPS;
    if (payload.HEART_RATE_BPM !== undefined) relay.HEART_RATE_BPM = payload.HEART_RATE_BPM;
    if (payload.WALKED_DISTANCE_METERS !== undefined) relay.WALKED_DISTANCE_METERS = payload.WALKED_DISTANCE_METERS;

    if (Object.keys(relay).length === 0) return;

    Pebble.sendAppMessage(relay, function() { console.log("Forwarded appmessage"); }, function(err) { console.log("forward failed " + JSON.stringify(err)); });
});