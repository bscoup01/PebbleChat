import Poco from "commodetto/Poco";
import parseBMF from "commodetto/parseBMF";
import parseRLE from "commodetto/parseRLE";
import Battery from "embedded:sensor/Battery";
import Location from "embedded:sensor/Location";
import Message from "pebble/message";

let render = new Poco(screen);

// Fonts
function getFont(name, size) {
    const font = parseBMF(new Resource(`${name}-${size}.fnt`));
    font.bitmap = parseRLE(new Resource(`${name}-${size}-alpha.bm4`));
    return font;
}

const clockFont = getFont("clockfont", 39);
const standardFont = getFont("pebblechatwip", 12);

// Colors
const black = render.makeColor(0, 0, 0);
const white = render.makeColor(255, 255, 255);
const hiBattery = render.makeColor(0, 255, 0);
const medBattery = render.makeColor(255, 170, 0);

const dateColor1 = render.makeColor(0, 85, 170);
const dateColor2 = render.makeColor(85, 170, 255);

const clockColor1 = render.makeColor(255, 0, 85);
const clockColor2 = render.makeColor(255, 170, 170);

const healthColor1 = render.makeColor(0, 170, 0);
const healthColor2 = render.makeColor(85, 255, 85);

const weatherColor1 = render.makeColor(85, 0, 170);
const weatherColor2 = render.makeColor(170, 85, 255);

// Date formatting
const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun",
                "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

let lastDate = new Date();

// Weather data
let weather = null;
let latitude = null;
let longitude = null;

// Track battery percentage
let batteryPercent = 100;
let isCharging = false;
const battery = new Battery({
    onSample() {
        const sampleResult = this.sample();
        if (sampleResult) {
            batteryPercent = sampleResult.percent;
            isCharging = sampleResult.charging;
            drawScreen();
        }
    }
});

const initialSample = battery.sample();
if (initialSample) {
    batteryPercent = initialSample.percent;
    isCharging = initialSample.charging;
}


// Load background
const background = new Poco.PebbleBitmap(1);

// Load correct now entering sign and room icon
let nowEntering = new Poco.PebbleBitmap(2);
let roomIcon = new Poco.PebbleBitmap(6);

// Render the correct battery icon and battery percentage
const chargingIcon = new Poco.PebbleBitmap(10);
let batteryWidth = render.getTextWidth(batteryPercent, standardFont);

function drawBatteryLevel() {
    if (batteryPercent > 75) {
        render.fillRectangle(hiBattery, 2, 2, 14, 1);
        render.fillRectangle(hiBattery, 2, 15, 14, 1);
        render.fillRectangle(white, 7, 11, 2, 2);
        render.fillRectangle(white, 10, 8, 2, 5);
        render.fillRectangle(white, 13, 5, 2, 8);
    } else if (batteryPercent > 50) {
        render.fillRectangle(hiBattery, 2, 2, 14, 1);
        render.fillRectangle(hiBattery, 2, 15, 14, 1);
        render.fillRectangle(white, 7, 11, 2, 2);
        render.fillRectangle(white, 10, 8, 2, 5);
    } else if (batteryPercent > 25) {
        render.fillRectangle(medBattery, 2, 2, 14, 1);
        render.fillRectangle(medBattery, 2, 15, 14, 1);
        render.fillRectangle(white, 7, 11, 2, 2);
    }

    if (isCharging == true) {
        render.drawBitmap(chargingIcon, 2, 5);
    }
    render.drawText(batteryPercent, standardFont, black, ((19-batteryWidth) / 2), 20);
}

// Check if the watch is connected via bluetooth
const bluetoothConnected = new Poco.PebbleBitmap(12);
let isConnected = true;

function checkConnection() {
    isConnected = watch.connected.app;
    drawScreen();
}

let location = null;

function requestLocation() {
    location = new Location({
        onSample() {
            const sample = this.sample();
            console.log("Got location: " + sample.latitude + ", " + sample.longitude);
            this.close();
            sendLocationRequest(sample.latitude, sample.longitude);
        }
    });
}

// Use weather code to determine the type of weather
function getWeatherDescription(code) {
    if (code == 0) return "Clear";
    if (code == 1) return "Mainly Clear";
    if (code == 2) return "Partly Cloudy";
    if (code == 3) return "Cloudy";
    if (code == 45) return "Foggy";
    if (code == 48) return "Rime Fog";
    if (code == 51) return "Light Drizzle";
    if (code == 53) return "Drizzle";
    if (code == 55) return "Heavy Drizzle";
    if (code == 56) return "Light Freezing Drizzle";
    if (code == 57) return "Freezing Drizzle";
    if (code == 61) return "Light Rain";
    if (code == 63) return "Rain";
    if (code == 65) return "Heavy Rain";
    if (code == 66) return "Light Freezing Rain";
    if (code == 67) return "Freezing Rain";
    if (code == 71) return "Light Snow";
    if (code == 73) return "Snow";
    if (code == 75) return "Heavy Snow";
    if (code == 77) return "Snow Grains";
    if (code == 80) return "Light Showers";
    if (code == 81) return "Showers";
    if (code == 82) return "Heavy Showers";
    if (code == 85) return "Light Snow Showers";
    if (code == 86) return "Snow Showers";
    if (code == 95) return "Thunderstorm";
    if (code == 96) return "Light Thunderstorms With Hail";
    if (code == 99) return "Thunderstorm With Hail";
    return "Unknown";
}
function getWeatherType(code) {
    if (code < 2) return 0;
    if (code < 51) return 1;
    if (code < 55) return 2;
    if (code < 61) return 3;
    if (code < 65) return 2;
    if (code < 80) return 3;
    if (code < 85) return 2;
    if (code < 95) return 3;
    if (code < 100) return 4;
    return 5;
}

// Fetch the temperature and weather
async function fetchWeather(latitude, longitude) {
    try {
        const url = new URL("http://api.open-meteo.com/v1/forecast");
        url.search = new URLSearchParams({
            latitude,
            longitude,
            current: "temperature_2m,weather_code,relative_humidity_2m"
        });

        console.log("Fetching weather...");
        const response = await fetch(url);
        const data = await response.json();

        weather = {
            temp: Math.round(data.current.temperature_2m * 1.8 + 32),
            conditions: getWeatherDescription(data.current.weather_code),
            weatherCode: getWeatherType(data.current.weather_code),
            humidity: data.current.relative_humidity_2m
        };

        console.log("Weather: " + weather.temp + " F, " + weather.conditions);
        drawScreen();

    } catch (e) {
        console.log("Weather fetch error: " + e);
    }
}

// Load the weather icons
const sunny = new Poco.PebbleBitmap(13);
const cloudy = new Poco.PebbleBitmap(14);
const rainy = new Poco.PebbleBitmap(15);
const snowy = new Poco.PebbleBitmap(16);
const stormy = new Poco.PebbleBitmap(17);

const thermometer = new Poco.PebbleBitmap(18);
const humidity = new Poco.PebbleBitmap(19);

// Initialize placeholders for steps, distance walked, and heartrate
let steps = -1;
let distanceWalked = -1;
let heartRate = -1;

let messageWritable = false;
let pendingLocation = null;

// AppMessage interface to receive data from PKJS
const message = new Message(
    {keys: ["HEALTH_STEPS", "HEART_RATE_BPM", "WALKED_DISTANCE_METERS", "LATITUDE", "LONGITUDE", "WEATHER_TEMP", "WEATHER_CODE", "WEATHER_HUMIDITY"],
    input: 128,
    output: 128,

    onWritable() {
        messageWritable = true;
        if (pendingLocation) {
            const { latitude, longitude } = pendingLocation;
            pendingLocation = null;
            sendLocationRequest(latitude, longitude);
        }
    },
    onSuspend() {
        messageWritable = false;
    },
    // Listener for incoming messages
    onReadable() {
        const data = message.read();
        let gotHealth = false;
        if (data.has("HEALTH_STEPS")) {
            steps = data.get("HEALTH_STEPS");
            gotHealth = true;
        }
        if (data.has("HEART_RATE_BPM")) {
            heartRate = data.get("HEART_RATE_BPM");
            gotHealth = true;
        }
        if (data.has("WALKED_DISTANCE_METERS")) {
            distanceWalked = data.get("WALKED_DISTANCE_METERS");
            gotHealth = true;
        }

        if (gotHealth) {
            console.log(`JS received steps=${steps} bpm=${heartRate} distance=${distanceWalked}`);
        }

        if (data.has("WEATHER_TEMP") && data.has("WEATHER_CODE") && data.has("WEATHER_HUMIDITY")) {
            weather = {
                temp: data.get("WEATHER_TEMP"),
                conditions: getWeatherDescription(data.get("WEATHER_CODE")),
                weatherCode: getWeatherType(data.get("WEATHER_CODE")),
                humidity: data.get("WEATHER_HUMIDITY")
            };
            console.log("Weather: " + weather.temp + " F, " + weather.conditions + ", Weather code: " + weather.weatherCode + ", " + weather.humidity + "%");
        }
        drawScreen();
    }
});

function sendLocationRequest(latitude, longitude, attempt) {
    attempt = attempt || 0;
    if (!messageWritable) {
        if (attempt >= 10) {
            console.log("Giving up on weather reqeust - never became writable");
            return;
        }
        // Remember request until channel is free
        setTimeout(() => sendLocationRequest(latitude, longitude, attempt + 1), 500);
        return;
    }
    try {
        console.log("Sending weather request: " + latitude + ", " + longitude);
        message.write(new Map([["LATITUDE", Math.round(latitude * 1e6)], ["LONGITUDE", Math.round(longitude * 1e6)]]));
    } catch (e) {
        console.log("Weather request write failed: " + e);
        pendingLocation = { latitude, longitude };
    }
}

// Load the health icons
const heartRateIcon = new Poco.PebbleBitmap(20);
const stepsIcon = new Poco.PebbleBitmap(21);
const distanceIcon = new Poco.PebbleBitmap(22);

// Formatting for steps, distance walked, and heartrate
function formatSteps() {
    // Negative means it hasn't been received yet
    if (steps < 0) return ": --";
    return `: ${steps}`;
}

function formatDistance() {
    // Neative means it hasn't been received yet
    if (distanceWalked < 0) return ": -- mi";
    const miles = Math.trunc((distanceWalked / 1609.344) * 100) / 100;
    return `: ${miles} mi`;
}

function formatHeartRate() {
    // Negative means it hasn't been received yet
    if (heartRate < 0) return ": --";
    return `: ${heartRate} BPM`;
}

// Draw the screen
function drawScreen(event) {
    const now = event?.date ?? lastDate;
    if (event?.date) lastDate = event.date;

    render.begin();
    render.drawBitmap(background, 0, 0);

    drawBatteryLevel();

    // Draw bluetooth indicator if connected
    if (isConnected == true) {
        render.drawBitmap(bluetoothConnected, 1, 36);
    }


    // Draw the now entering sign and room icon
    render.drawBitmap(nowEntering, 27, 31);
    render.drawBitmap(roomIcon, 1, 211);

    // Draw the Date message box
    render.fillRectangle(dateColor1, 22, 51, 175, 12);
    render.fillRectangle(dateColor1, 23, 50, 173, 14);
    render.fillRectangle(dateColor1, 24, 49, 171, 16);
    render.fillRectangle(dateColor1, 25, 48, 169, 18);

    render.fillRectangle(white, 81, 49, 113, 16);
    render.fillRectangle(white, 194, 50, 1, 14);
    render.fillRectangle(white, 195, 51, 1, 12);
    render.fillRectangle(white, 80, 63, 1, 2);
    render.fillRectangle(white, 79, 64, 1, 1);

    render.fillRectangle(dateColor2, 23, 51, 57, 12);
    render.fillRectangle(dateColor2, 24, 50, 55, 14);
    render.fillRectangle(dateColor2, 25, 49, 53, 16);
    render.fillRectangle(dateColor2, 77, 49, 3, 3);

    render.drawText("Date", standardFont, dateColor1, 27, 50);

    // Format date as "Thu Jan 01, 2026"
    const dayName = DAYS[now.getDay()];
    const monthName = MONTHS[now.getMonth()];
    const dateStr = `${dayName}, ${monthName} ${String(now.getDate())}, ${String(now.getYear() + 1900)}`;

    // Draw date in Date message box
    render.drawText(dateStr, standardFont, black, 85, 50);

    // Draw the Clock message box
    render.fillRectangle(clockColor1, 22, 72, 175, 60);
    render.fillRectangle(clockColor1, 23, 71, 173, 62);
    render.fillRectangle(clockColor1, 24, 70, 171, 64);
    render.fillRectangle(clockColor1, 25, 69, 169, 66);

    render.fillRectangle(white, 23, 72, 173, 60);
    render.fillRectangle(white, 24, 71, 171, 62);
    render.fillRectangle(white, 25, 70, 169, 64);

    render.fillRectangle(clockColor1, 22, 72, 56, 15);
    render.fillRectangle(clockColor1, 23, 71, 56, 15);
    render.fillRectangle(clockColor1, 24, 70, 56, 15);
    render.fillRectangle(clockColor1, 25, 69, 56, 15);

    render.fillRectangle(clockColor2, 23, 72, 55, 14);
    render.fillRectangle(clockColor2, 24, 71, 55, 14);
    render.fillRectangle(clockColor2, 25, 70, 55, 14);

    render.drawText("Clock", standardFont, clockColor1, 27, 72);

    // Format time as HH:MM
    let hours = now.getHours();
    if (hours > 11) {
        render.drawText("PM", standardFont, black, 181, 88);
    } else {
            render.drawText("AM", standardFont, black, 181, 88);
    }
    if (hours > 12) hours = hours - 12;
    if (hours == 0) hours = 12;
    
    const hoursStr = String(hours).padStart(2, "0");
    const minutes = String(now.getMinutes()).padStart(2, "0");
    const timeStr = `${hoursStr}:${minutes}`;

    render.drawText(timeStr, clockFont, black, 40, 89);

    // Draw the Health message box
    render.fillRectangle(healthColor1, 22, 141, 175, 44);
    render.fillRectangle(healthColor1, 23, 140, 173, 46);
    render.fillRectangle(healthColor1, 24, 139, 171, 48);
    render.fillRectangle(healthColor1, 25, 138, 169, 50);

    render.fillRectangle(white, 23, 141, 173, 44);
    render.fillRectangle(white, 24, 140, 171, 46);
    render.fillRectangle(white, 25, 139, 169, 48);

    render.fillRectangle(healthColor1, 22, 141, 56, 15);
    render.fillRectangle(healthColor1, 23, 140, 56, 15);
    render.fillRectangle(healthColor1, 24, 139, 56, 15);
    render.fillRectangle(healthColor1, 25, 138, 56, 15);

    render.fillRectangle(healthColor2, 23, 141, 55, 14);
    render.fillRectangle(healthColor2, 24, 140, 55, 14);
    render.fillRectangle(healthColor2, 25, 139, 55, 14);

    render.drawText("Health", standardFont, healthColor1, 27, 140);

    // Draw the heart rate
    render.drawBitmap(heartRateIcon, 84, 142);
    const heartRateStr = `${formatHeartRate()}`;
    render.drawText(heartRateStr, standardFont, black, 94, 140);

    // Draw the step counter
    render.drawBitmap(stepsIcon, 27, 159);
    const stepsStr = `${formatSteps()}`;
    render.drawText(stepsStr, standardFont, black, 36, 157);

    // Draw the distance walked
    render.drawBitmap(distanceIcon, 27, 175);
    const distanceStr = `${formatDistance()}`;
    render.drawText(distanceStr, standardFont, black, 36, 173);

    // Draw the Weather message box
    render.fillRectangle(weatherColor1, 22, 194, 175, 28);
    render.fillRectangle(weatherColor1, 23, 193, 173, 30);
    render.fillRectangle(weatherColor1, 24, 192, 171, 32);
    render.fillRectangle(weatherColor1, 25, 191, 169, 34);

    render.fillRectangle(white, 23, 194, 173, 28);
    render.fillRectangle(white, 24, 193, 171, 30);
    render.fillRectangle(white, 25, 192, 169, 32);

    render.fillRectangle(weatherColor1, 22, 194, 56, 15);
    render.fillRectangle(weatherColor1, 23, 193, 56, 15);
    render.fillRectangle(weatherColor1, 24, 192, 56, 15);
    render.fillRectangle(weatherColor1, 25, 191, 56, 15);

    render.fillRectangle(weatherColor2, 23, 194, 55, 14);
    render.fillRectangle(weatherColor2, 24, 193, 55, 14);
    render.fillRectangle(weatherColor2, 25, 192, 55, 14);

    render.drawText("Weather", standardFont, weatherColor1, 28, 193);

    // Draw weather at bottom
    render.drawBitmap(thermometer, 85, 195);
    render.drawBitmap(humidity, 138, 195);
    if (weather) {
        const tempStr = `: ${weather.temp} F`;
        const weatherStr = `: ${weather.conditions}`;
        const humidityStr = `: ${weather.humidity}%`;
        
        render.drawText(tempStr, standardFont, black, 94, 193);
        render.drawText(humidityStr, standardFont, black, 147, 193);
        
        // Draw correct weather icon
        if (weather.weatherCode == 0) {
            render.drawBitmap(sunny, 27, 212);
        } else if (weather.weatherCode == 1) {
            render.drawBitmap(cloudy, 27, 212);
        } else if (weather.weatherCode == 2) {
            render.drawBitmap(rainy, 27, 212);
        } else if (weather.weatherCode == 3) {
            render.drawBitmap(snowy, 27, 212);
        } else if (weather.weatherCode == 4) {
            render.drawBitmap(stormy, 27, 212);
        }
        render.drawText(weatherStr, standardFont, black, 36, 210);
    } else {
        const loadingMsg = ": Loading...";
        render.drawText(loadingMsg, standardFont, black, 36, 210);
    }

    render.end();
}

watch.addEventListener("connected", checkConnection);
checkConnection();
watch.addEventListener("minutechange", drawScreen);
watch.addEventListener("hourchange", requestLocation);