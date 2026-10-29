
"use strict";

/*
 * RouteSafe extended features
 * Compatible with the index.html and script.js from the previous answer.
 *
 * Important:
 * - Weather comparison and forecasts use Open-Meteo.
 * - Cyclone and flood feeds are NOT connected to official live data.
 * - Admin reports and forecast history are stored in this browser only.
 * - This file does not provide live family tracking.
 */

(() => {
  const $ = id => document.getElementById(id);

  const STORAGE = {
    accuracy: "routesafe.accuracy.v3",
    reports: "routesafe.localReports.v2"
  };

  const translations = {
    en: {
      title: "Weather safety update",
      safe: "No severe signal was detected by this basic forecast check. This is not an official all-clear.",
      rain: "Rain may be possible. Check official local weather warnings.",
      lightning: "Thunderstorm conditions appear in the forecast. Move indoors and avoid open areas, isolated trees and metal objects.",
      cyclone: "An official live cyclone feed is not connected. Check India Meteorological Department (IMD) bulletins.",
      flood: "Official river gauge and flood-warning feeds are not connected. Follow local disaster-management instructions."
    },
    hi: {
      title: "मौसम सुरक्षा सूचना",
      safe: "इस सामान्य पूर्वानुमान जाँच में गंभीर संकेत नहीं मिला। यह आधिकारिक सुरक्षित होने की घोषणा नहीं है।",
      rain: "बारिश संभव है। स्थानीय आधिकारिक मौसम चेतावनियाँ देखें।",
      lightning: "पूर्वानुमान में तूफान का संकेत है। घर के अंदर जाएँ और खुले मैदानों तथा अकेले पेड़ों से दूर रहें।",
      cyclone: "आधिकारिक लाइव चक्रवात फ़ीड जुड़ी नहीं है। IMD के बुलेटिन देखें।",
      flood: "आधिकारिक नदी स्तर और बाढ़ चेतावनी फ़ीड जुड़ी नहीं है। स्थानीय आपदा प्रबंधन निर्देशों का पालन करें।"
    },
    te: {
      title: "వాతావరణ భద్రత సమాచారం",
      safe: "ఈ ప్రాథమిక అంచనాలో తీవ్రమైన సంకేతం కనిపించలేదు. ఇది అధికారిక భద్రతా ప్రకటన కాదు.",
      rain: "వర్షం వచ్చే అవకాశం ఉంది. అధికారిక స్థానిక వాతావరణ హెచ్చరికలను చూడండి.",
      lightning: "అంచనాలో ఉరుములతో కూడిన తుఫాను సూచన ఉంది. ఇంటి లోపలికి వెళ్లి బహిరంగ ప్రదేశాలు, ఒంటరి చెట్లకు దూరంగా ఉండండి.",
      cyclone: "అధికారిక ప్రత్యక్ష తుఫాను డేటా కనెక్ట్ కాలేదు. IMD బులెటిన్లను చూడండి.",
      flood: "అధికారిక నది స్థాయి, వరద హెచ్చరిక ఫీడ్లు కనెక్ట్ కాలేదు. స్థానిక విపత్తు నిర్వహణ సూచనలను పాటించండి."
    }
  };

  const cities = [
    { name: "Guntur", lat: 16.3067, lon: 80.4365 },
    { name: "Vijayawada", lat: 16.5062, lon: 80.6480 },
    { name: "Visakhapatnam", lat: 17.6868, lon: 83.2185 },
    { name: "Amaravati", lat: 16.5745, lon: 80.3580 },
    { name: "Hyderabad", lat: 17.3850, lon: 78.4867 },
    { name: "Chennai", lat: 13.0827, lon: 80.2707 },
    { name: "Bhubaneswar", lat: 20.2961, lon: 85.8245 },
    { name: "Kolkata", lat: 22.5726, lon: 88.3639 },
    { name: "Mumbai", lat: 19.0760, lon: 72.8777 },
    { name: "Delhi", lat: 28.6139, lon: 77.2090 },
    { name: "Kochi", lat: 9.9312, lon: 76.2673 },
    { name: "Puducherry", lat: 11.9416, lon: 79.8083 }
  ];

  function getLanguage() {
    return $("languageSelect")?.value || "en";
  }

  function getTranslation() {
    return translations[getLanguage()] || translations.en;
  }

  function readStorage(key, fallback = []) {
    try {
      const value = JSON.parse(localStorage.getItem(key));
      return value ?? fallback;
    } catch {
      return fallback;
    }
  }

  function writeStorage(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch (error) {
      console.warn("RouteSafe could not save local data:", error);
      showToast("Browser storage is unavailable.");
      return false;
    }
  }

  function escapeHTML(value) {
    return String(value ?? "").replace(/[&<>"']/g, char => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;"
    })[char]);
  }

  function showToast(message) {
    const toast = $("toast");
    if (!toast) {
      console.info(message);
      return;
    }

    toast.textContent = message;
    toast.classList.add("visible");

    clearTimeout(showToast.timer);
    showToast.timer = setTimeout(() => {
      toast.classList.remove("visible");
    }, 3500);
  }

  function getCurrentCityName() {
    return typeof selectedCity !== "undefined" && selectedCity?.name
      ? selectedCity.name
      : $("citySelect")?.selectedOptions?.[0]?.textContent || "Selected location";
  }

  function getCurrentWeather() {
    return typeof weatherData !== "undefined" ? weatherData : null;
  }

  // ---------------------------------------------------------
  // Multilingual alert messages
  // ---------------------------------------------------------

  function renderTranslatedAlert() {
    const target = $("translatedAlert");
    if (!target) return;

    const weather = getCurrentWeather();
    const code = Number(weather?.current?.weather_code);
    const t = getTranslation();

    let message = t.safe;

    if ([95, 96, 99].includes(code)) {
      message = t.lightning;
    } else if ([51, 53, 55, 61, 63, 65, 80, 81, 82].includes(code)) {
      message = t.rain;
    }

    target.innerHTML =
      `<strong>${escapeHTML(t.title)}</strong><p>${escapeHTML(message)}</p>`;
  }

  function renderLightning() {
    const status = $("lightningStatus");
    const details = $("lightningDetails");

    if (!status || !details) return;

    const weather = getCurrentWeather();

    if (!weather?.current) {
      status.textContent = "Waiting for forecast";
      status.className = "status-pill status-warning";
      details.textContent = "Load weather data to check forecast thunderstorm indicators.";
      return;
    }

    const currentCode = Number(weather.current.weather_code);
    const hourlyCodes = weather.hourly?.weather_code || [];
    const thunderCodes = [95, 96, 99];

    const thunderNow = thunderCodes.includes(currentCode);
    const thunderSoon = hourlyCodes
      .slice(0, 6)
      .some(code => thunderCodes.includes(Number(code)));

    const t = getTranslation();

    if (thunderNow || thunderSoon) {
      status.textContent = "Thunderstorm signal";
      status.className = "status-pill status-danger";
      details.textContent = t.lightning;
    } else {
      status.textContent = "No thunderstorm code detected";
      status.className = "status-pill";
      details.textContent =
        "No thunderstorm code was detected in the current forecast window. " +
        "This is not a lightning-detection service. Conditions can change quickly.";
    }
  }

  function updateHazardPanels() {
    const cycloneStatus = $("cycloneStatus");
    const cycloneDetails = $("cycloneDetails");
    const floodStatus = $("floodStatus");
    const floodDetails = $("floodDetails");

    if (cycloneStatus) {
      cycloneStatus.textContent = "Official feed not connected";
      cycloneStatus.className = "status-pill status-warning";
    }

    if (cycloneDetails) {
      cycloneDetails.textContent = getTranslation().cyclone;
    }

    if (floodStatus) {
      floodStatus.textContent = "Official feed not connected";
      floodStatus.className = "status-pill status-warning";
    }

    if (floodDetails) {
      floodDetails.textContent = getTranslation().flood;
    }

    const timeline = $("cycloneTimeline");
    if (timeline) {
      timeline.innerHTML = `
        <div class="timeline-item">
          No verified cyclone track is available in this demo.
        </div>
        <div class="timeline-item">
          Connect an official feed before displaying storm positions or forecasts.
        </div>`;
    }
  }

  // ---------------------------------------------------------
  // City weather comparison
  // ---------------------------------------------------------

  async function compareCities() {
    const container = $("cityComparison");
    if (!container) return;

    container.innerHTML = "<p>Loading city weather comparison…</p>";

    try {
      const results = await Promise.all(
        cities.map(async city => {
          const params = new URLSearchParams({
            latitude: String(city.lat),
            longitude: String(city.lon),
            current: [
              "temperature_2m",
              "relative_humidity_2m",
              "precipitation",
              "wind_speed_10m",
              "weather_code"
            ].join(","),
            daily: "precipitation_probability_max",
            forecast_days: "1",
            timezone: "auto"
          });

          const response = await fetch(
            `https://api.open-meteo.com/v1/forecast?${params}`
          );

          if (!response.ok) {
            throw new Error(`Weather service returned ${response.status}`);
          }

          const data = await response.json();

          return {
            name: city.name,
            temperature: data.current?.temperature_2m,
            humidity: data.current?.relative_humidity_2m,
            wind: data.current?.wind_speed_10m,
            rain: data.current?.precipitation,
            rainChance: data.daily?.precipitation_probability_max?.[0]
          };
        })
      );

      container.innerHTML = results.map(city => `
        <article class="comparison-card">
          <h3>${escapeHTML(city.name)}</h3>
          <div class="comparison-temp">
            ${city.temperature == null
              ? "N/A"
              : `${Number(city.temperature).toFixed(1)}°C`}
          </div>
          <div class="comparison-details">
            <span>Humidity: ${city.humidity ?? "—"}%</span>
            <span>Wind: ${city.wind ?? "—"} km/h</span>
            <span>Rain: ${city.rain ?? "—"} mm</span>
            <span>Rain chance: ${city.rainChance ?? "—"}%</span>
          </div>
        </article>
      `).join("") + `
        <p class="muted">
          Source: Open-Meteo. Forecast values may differ from official observations.
        </p>`;
    } catch (error) {
      console.error("City comparison failed:", error);
      container.innerHTML = `
        <p>City comparison could not load. Check your internet connection and try again.</p>`;
    }
  }

  // ---------------------------------------------------------
  // Forecast accuracy tracker
  // ---------------------------------------------------------

  function renderAccuracy() {
    const container = $("accuracySummary");
    if (!container) return;

    const records = readStorage(STORAGE.accuracy, []);
    const completed = records.filter(record =>
      Number.isFinite(Number(record.observedTemp)) &&
      record.observedTemp !== null
    );
    const pending = records.length - completed.length;

    const mae = completed.length
      ? completed.reduce((total, record) => {
          return total + Math.abs(
            Number(record.forecastTemp) - Number(record.observedTemp)
          );
        }, 0) / completed.length
      : null;

    container.innerHTML = `
      <p>Saved forecast snapshots: <strong>${records.length}</strong></p>
      <p>Waiting for an observation: <strong>${pending}</strong></p>
      <p>Completed comparisons: <strong>${completed.length}</strong></p>
      <p>
        Mean absolute temperature error:
        <strong>${mae === null ? "Not enough observations" : `${mae.toFixed(1)}°C`}</strong>
      </p>
      <div class="report-list">
        ${records.slice(-5).reverse().map(record => `
          <div class="report-item">
            <strong>${escapeHTML(record.city)}</strong>
            <p>Forecast: ${Number(record.forecastTemp).toFixed(1)}°C</p>
            <small>${escapeHTML(new Date(record.savedAt).toLocaleString())}</small>
            <small>
              Observed:
              ${record.observedTemp == null
                ? "Not entered"
                : `${Number(record.observedTemp).toFixed(1)}°C`}
            </small>
          </div>
        `).join("")}
      </div>
      <p class="muted">
        This is a local tracker, not an independently verified historical forecast archive.
      </p>`;
  }

  function saveForecastSnapshot() {
    const weather = getCurrentWeather();

    if (!weather?.current) {
      showToast("Load current weather before saving a snapshot.");
      return;
    }

    const records = readStorage(STORAGE.accuracy, []);

    records.push({
      city: getCurrentCityName(),
      savedAt: new Date().toISOString(),
      forecastTemp: Number(weather.current.temperature_2m),
      observedTemp: null
    });

    if (writeStorage(STORAGE.accuracy, records.slice(-100))) {
      renderAccuracy();
      showToast("Forecast snapshot saved.");
    }
  }

  function recordObservation() {
    const input = $("observedTemp");
    if (!input || input.value.trim() === "") {
      showToast("Enter an observed temperature first.");
      return;
    }

    const observed = Number(input.value);

    if (!Number.isFinite(observed) || observed < -90 || observed > 65) {
      showToast("Enter a valid temperature in °C.");
      return;
    }

    const records = readStorage(STORAGE.accuracy, []);
    let index = -1;

    for (let i = records.length - 1; i >= 0; i--) {
      if (records[i].observedTemp == null) {
        index = i;
        break;
      }
    }

    if (index === -1) {
      showToast("Save a forecast snapshot first.");
      return;
    }

    records[index].observedTemp = observed;
    records[index].observedAt = new Date().toISOString();

    if (writeStorage(STORAGE.accuracy, records)) {
      input.value = "";
      renderAccuracy();
      showToast("Observed temperature recorded.");
    }
  }

  // ---------------------------------------------------------
  // Family safety sharing
  // ---------------------------------------------------------

  async function shareSafetyUpdate() {
    const messageInput = $("familyMessage");
    const customMessage = messageInput?.value.trim();

    const weather = getCurrentWeather();
    const temperature = weather?.current?.temperature_2m;
    const message = [
      "RouteSafe safety update",
      `Location: ${getCurrentCityName()}`,
      `Temperature: ${temperature == null ? "Unavailable" : `${temperature}°C`}`,
      `Time: ${new Date().toLocaleString()}`,
      customMessage || "Please check official local weather warnings.",
      "This is a snapshot, not live location tracking."
    ].join("\n");

    const status = $("shareStatus");

    try {
      if (navigator.share) {
        await navigator.share({
          title: "RouteSafe safety update",
          text: message
        });

        if (status) status.textContent = "Safety update shared.";
      } else if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(message);

        if (status) {
          status.textContent =
            "Safety update copied. Paste it into your messaging app.";
        }
      } else {
        window.prompt("Copy this safety update:", message);
        if (status) status.textContent = "Copy the message from the prompt.";
      }
    } catch (error) {
      if (error.name !== "AbortError") {
        console.error("Sharing failed:", error);
        if (status) status.textContent = "Sharing is unavailable in this browser.";
      }
    }
  }

  // ---------------------------------------------------------
  // Local admin report review
  // ---------------------------------------------------------

  function renderReports() {
    const container = $("adminReports");
    if (!container) return;

    const reports = readStorage(STORAGE.reports, []);

    if (!reports.length) {
      container.innerHTML = '<p class="muted">No local reports submitted.</p>';
      return;
    }

    container.innerHTML = reports.slice().reverse().map(report => `
      <article class="report-item">
        <strong>${escapeHTML(report.city)}</strong>
        <p>${escapeHTML(report.description)}</p>
        <small>${escapeHTML(new Date(report.createdAt).toLocaleString())}</small>
        <small>${report.reviewed ? "Reviewed locally" : "Pending local review"}</small>
        <button
          class="button button-secondary"
          type="button"
          data-review-id="${escapeHTML(report.id)}">
          Mark reviewed
        </button>
      </article>
    `).join("");

    container.querySelectorAll("[data-review-id]").forEach(button => {
      button.addEventListener("click", () => {
        const allReports = readStorage(STORAGE.reports, []);
        const report = allReports.find(item => item.id === button.dataset.reviewId);

        if (!report) return;

        report.reviewed = true;
        writeStorage(STORAGE.reports, allReports);
        renderReports();
      });
    });
  }

  function submitLocalReport() {
    const input = $("reportText");
    const description = input?.value.trim();

    if (!description) {
      showToast("Describe the observed condition first.");
      return;
    }

    const reports = readStorage(STORAGE.reports, []);

    reports.push({
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      city: getCurrentCityName(),
      description,
      createdAt: new Date().toISOString(),
      reviewed: false
    });

    if (writeStorage(STORAGE.reports, reports.slice(-100))) {
      input.value = "";
      renderReports();
      showToast("Report saved in this browser.");
    }
  }

  // ---------------------------------------------------------
  // Emergency guide and text-to-speech
  // ---------------------------------------------------------

  function toggleEmergencyGuide() {
    const guide = $("emergencyGuide");
    if (guide) guide.classList.toggle("hidden");
  }

  function speakAlert() {
    if (!("speechSynthesis" in window)) {
      showToast("Text-to-speech is not supported by this browser.");
      return;
    }

    const text = $("translatedAlert")?.innerText ||
      "Please check official weather warnings.";

    const languageCodes = {
      en: "en-IN",
      hi: "hi-IN",
      te: "te-IN"
    };

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = languageCodes[getLanguage()] || "en-IN";

    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(utterance);
  }

  // ---------------------------------------------------------
  // Offline cache request
  // ---------------------------------------------------------

  async function requestOfflineCache() {
    if (!("serviceWorker" in navigator)) {
      showToast("Service workers are not supported by this browser.");
      return;
    }

    try {
      const registration = await navigator.serviceWorker.ready;

      if (registration.active) {
        registration.active.postMessage({ type: "CACHE_APP_SHELL" });
        showToast("Offline app-shell caching requested.");
      } else {
        showToast("Reload the page after the service worker activates.");
      }
    } catch (error) {
      console.error("Offline cache request failed:", error);
      showToast("Offline caching is not ready. Use Live Server or HTTPS.");
    }
  }

  // ---------------------------------------------------------
  // Event binding
  // ---------------------------------------------------------

  function bindEvents() {
    $("languageSelect")?.addEventListener("change", () => {
      renderTranslatedAlert();
      renderLightning();
      updateHazardPanels();
    });

    $("compareBtn")?.addEventListener("click", () => {
      $("comparison")?.scrollIntoView({ behavior: "smooth" });
      compareCities();
    });

    $("runComparisonBtn")?.addEventListener("click", compareCities);

    $("recordObservationBtn")?.addEventListener("click", recordObservation);

    $("saveForecastBtn")?.addEventListener("click", saveForecastSnapshot);

    $("shareSafetyBtn")?.addEventListener("click", shareSafetyUpdate);

    $("submitReportBtn")?.addEventListener("click", submitLocalReport);

    $("openGuideBtn")?.addEventListener("click", toggleEmergencyGuide);

    $("speakAlertBtn")?.addEventListener("click", speakAlert);

    $("cacheOfflineBtn")?.addEventListener("click", requestOfflineCache);

    window.addEventListener("routesafe-weather-updated", () => {
      renderTranslatedAlert();
      renderLightning();
      updateHazardPanels();
    });

    window.addEventListener("online", () => {
      renderTranslatedAlert();
      renderLightning();
    });
  }

  document.addEventListener("DOMContentLoaded", () => {
    bindEvents();
    renderAccuracy();
    renderReports();
    renderTranslatedAlert();
    renderLightning();
    updateHazardPanels();

    // The main script may load weather after this file initializes.
    // This is a light UI refresh, not a weather API request.
    window.setInterval(() => {
      renderTranslatedAlert();
      renderLightning();
    }, 15000);
  });
})();
