import { auth, db } from "../firebase-init.js";
import { getActiveUserTrip } from "../services/trip-services.js";
import { rollForDuration } from "../services/dice-services.js";
import {
    doc,
    updateDoc,
    arrayUnion,
    onSnapshot,
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

const currentStationName = document.getElementById("current-station-name");
const step2 = document.getElementById("step-2-connection");
const step4 = document.getElementById("step-4-confirm");
const lblNextConnection = document.getElementById("lblNextConnection");
const containerIntermediateStops = document.getElementById(
    "container-intermediate-stops",
);
const btnRollStationCount = document.getElementById("btnRollStationCount");
const stationsResult = document.getElementById("stations-result");
const valRolledStops = document.getElementById("valRolledStops");
const valNextExitStation = document.getElementById("valNextExitStation");
const btnConfirmArrival = document.getElementById("btnConfirmArrival");
const stationsDiceDisplay = document.getElementById(
    "stations-dice-display-container",
);
const stationsDiceWrapper = document.getElementById("stations-dice-wrapper");
const btnStopsDice1 = document.getElementById("btnStopsDice1");
const btnStopsDice2 = document.getElementById("btnStopsDice2");
const btnStopsDice3 = document.getElementById("btnStopsDice3");

let stopsDiceCount = 1;
let currentActiveTripId = null;
let fetchedRouteStopsData = [];
let unsubscribeTrip = null;
let targetStationCoords = { lat: null, lon: null };
let lastTargetDestination = null;
let gpsWatchId = null;

function getDiceSvg(val) {
    const dots = {
        1: [[12, 12]],
        2: [
            [6, 6],
            [18, 18],
        ],
        3: [
            [6, 6],
            [12, 12],
            [18, 18],
        ],
        4: [
            [6, 6],
            [6, 18],
            [18, 6],
            [18, 18],
        ],
        5: [
            [6, 6],
            [6, 18],
            [12, 12],
            [18, 6],
            [18, 18],
        ],
        6: [
            [6, 6],
            [6, 12],
            [6, 18],
            [18, 6],
            [18, 12],
            [18, 18],
        ],
    };
    let dotsHtml = "";
    if (dots[val]) {
        dotsHtml = dots[val]
            .map(
                (coord) =>
                    `<circle cx="${coord[0]}" cy="${coord[1]}" r="2" class="fill-sbb-red" />`,
            )
            .join("");
    }
    return `<svg class="w-12 h-12 bg-white border border-slate-300 rounded-sm shadow-sm" viewBox="0 0 24 24">${dotsHtml}</svg>`;
}

auth.onAuthStateChanged(async (user) => {
    if (!user) return;
    const activeTrip = await getActiveUserTrip(user.uid);
    if (activeTrip) {
        currentActiveTripId = activeTrip.id;
        setupTripRealtimeListener(currentActiveTripId);
    }
});

function setupTripRealtimeListener(tripId) {
    if (unsubscribeTrip) unsubscribeTrip();
    unsubscribeTrip = onSnapshot(doc(db, "trips", tripId), async (snapshot) => {
        if (!snapshot.exists()) return;
        const tripData = snapshot.data();
        const user = auth.currentUser;
        if (user) {
            if (btnRollStationCount) btnRollStationCount.disabled = false;
        }
        await renderStep2(tripData.gameState, tripData.hostId);
        if (typeof window.languageSwitcher === "function")
            window.languageSwitcher();
    });
}

async function fetchNextConnectionWithStops(fromStation, toStation, filters) {
    try {
        const apiUrl = `https://transport.opendata.ch/v1/connections?from=${encodeURIComponent(fromStation)}&to=${encodeURIComponent(toStation)}&limit=1&${filters}`;
        const res = await fetch(apiUrl);
        if (!res.ok) return null;
        const data = await res.json();
        if (!data.connections || data.connections.length === 0) return null;
        const conn = data.connections[0];
        let stops = [];
        if (conn.sections) {
            conn.sections.forEach((sec) => {
                if (sec.journey?.passList) {
                    sec.journey.passList.forEach((stop) => {
                        if (
                            stop.station?.name &&
                            !stops.some((s) => s.name === stop.station.name) &&
                            stop.station.name.trim().toLowerCase() !==
                                fromStation.trim().toLowerCase()
                        ) {
                            stops.push({
                                name: stop.station.name,
                                lat: stop.station.coordinate?.x || null,
                                lon: stop.station.coordinate?.y || null,
                            });
                        }
                    });
                }
            });
        }
        let lineName = "SBB";
        if (conn.products && conn.products[0]) {
            lineName = conn.products[0];
        } else if (conn.sections && conn.sections[0]?.journey?.name) {
            lineName = conn.sections[0].journey.name;
        } else if (conn.sections && conn.sections[0]?.journey?.category) {
            lineName = conn.sections[0].journey.category;
        }
        return {
            departure: new Date(conn.from.departure).toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit",
            }),
            line: lineName,
            stops: stops,
        };
    } catch {
        return null;
    }
}

async function renderStep2(gameState, hostId) {
    const currentStep = gameState.currentStep;
    const diceButtonContainer2 = document.getElementById("dice-button-2");

    if (["connection", "stations", "confirm"].includes(currentStep)) {
        step2.classList.remove("hidden");
    } else {
        step2.classList.add("hidden");
    }

    step4.classList.toggle("hidden", currentStep !== "confirm");

    if (gameState.lastStationRolls && gameState.lastStationRolls.length > 0) {
        if (stationsDiceDisplay) stationsDiceDisplay.classList.remove("hidden");
        if (stationsDiceWrapper)
            stationsDiceWrapper.innerHTML = gameState.lastStationRolls
                .map(getDiceSvg)
                .join("");
        const stationsSumDisplay = document.getElementById(
            "dice-stations-sum-display",
        );
        if (stationsSumDisplay)
            stationsSumDisplay.textContent = gameState.lastStationRolls.reduce(
                (a, b) => a + b,
                0,
            );
    } else {
        if (stationsDiceDisplay) stationsDiceDisplay.classList.add("hidden");
    }

    if (["connection", "stations", "confirm"].includes(currentStep)) {
        if (currentStep === "stations" || currentStep === "connection") {
            if (diceButtonContainer2)
                diceButtonContainer2.classList.remove("hidden");
        }

        const currentDestinationKey =
            gameState.finalDestination || gameState.targetDestinationTemp;

        // WICHTIGE ABSICHERUNG: Nur laden, wenn wir NICHT im confirm-Modus sind
        // ERWEITERTE KORREKTUR: Laden erlauben, wenn die Liste leer ist, ODER wenn wir im Wuerfel-Modus sind
        const isListEmpty =
            containerIntermediateStops.innerHTML === "" ||
            containerIntermediateStops.innerHTML.trim() === "" ||
            containerIntermediateStops.innerHTML.includes(
                "Lade Verbindung...",
            ) ||
            fetchedRouteStopsData.length === 0;

        if (
            isListEmpty ||
            (["connection", "stations"].includes(currentStep) &&
                lastTargetDestination !== currentDestinationKey)
        ) {
            lastTargetDestination = currentDestinationKey;
            lblNextConnection.innerHTML = `<span>Loading route stops...</span>`;

            // KORREKTUR: Filter direkt aus Firebase auslesen, damit es beim Neuladen nicht fehlschlaegt!
            let p = [];
            if (gameState.filters) {
                if (gameState.filters.train ?? true)
                    p.push("transportations[]=train");
                if (gameState.filters.bus ?? true)
                    p.push("transportations[]=bus");
                if (gameState.filters.ship ?? true)
                    p.push("transportations[]=ship");
                if (gameState.filters.cableway ?? true)
                    p.push("transportations[]=cableway");
                if (gameState.filters.tram ?? true)
                    p.push("transportations[]=tram");
            }

            // Falls gar nichts angewaehlt ist, nehmen wir Bus und Zug als Sicherung
            const filterParams =
                p.length > 0
                    ? p.join("&")
                    : "transportations[]=train&transportations[]=bus";

            // ERWEITERTE KORREKTUR: Laden erlauben, wenn die Liste leer ist, ODER wenn wir im Wuerfel-Modus sind
            const hasParagraphs = containerIntermediateStops
                ? containerIntermediateStops.querySelectorAll("p").length > 0
                : false;
            const isListEmpty =
                !hasParagraphs || fetchedRouteStopsData.length === 0;

            if (
                isListEmpty ||
                (["connection", "stations"].includes(currentStep) &&
                    lastTargetDestination !== currentDestinationKey)
            ) {
                lastTargetDestination = currentDestinationKey;

                // Schickes Loading-Design im neuen SBB-Stil
                lblNextConnection.innerHTML = `
                <div class="flex items-center justify-between w-full animate-pulse">
                    <div class="flex items-center space-x-3">
                        <div class="bg-slate-700 w-10 h-6 rounded-sm"></div>
                        <div class="h-5 bg-slate-700 rounded-sm w-32"></div>
                    </div>
                    <div class="h-4 bg-slate-700 rounded-sm w-12"></div>
                </div>
            `;

                // Häkchen live aus dem HTML auslesen
                let p = [];
                if (document.getElementById("filter-train")?.checked)
                    p.push("transportations[]=train");
                if (document.getElementById("filter-bus")?.checked)
                    p.push("transportations[]=bus");
                if (document.getElementById("filter-ship")?.checked)
                    p.push("transportations[]=ship");
                if (document.getElementById("filter-cableway")?.checked)
                    p.push("transportations[]=cableway");
                if (document.getElementById("filter-tram")?.checked)
                    p.push("transportations[]=tram");

                // Falls gar nichts angewählt ist, nehmen wir Bus und Zug als Standard-Sicherung
                const filterParams =
                    p.length > 0
                        ? p.join("&")
                        : "transportations[]=train&transportations[]=bus";

                fetchNextConnectionWithStops(
                    gameState.currentStation,
                    currentDestinationKey,
                    filterParams,
                ).then((connData) => {
                    if (connData) {
                        const displayLine =
                            connData.line && connData.line !== "undefined"
                                ? connData.line
                                : "Verbindung";

                        // Farb-Klassifizierung für das SBB-Badge-Design ermitteln
                        let catColor = "bg-slate-500";
                        const upperLine = displayLine.toUpperCase();
                        if (
                            ["IC", "IR", "ICE", "EC", "TGV"].some((c) =>
                                upperLine.includes(c),
                            )
                        ) {
                            catColor = "bg-sbb-red";
                        } else if (upperLine.startsWith("S")) {
                            catColor = "bg-blue-600";
                        } else if (
                            ["RE", "RX"].some((c) => upperLine.includes(c))
                        ) {
                            catColor = "bg-amber-600";
                        } else if (
                            ["B", "BUS"].some((c) => upperLine.includes(c)) ||
                            displayLine.length >= 3
                        ) {
                            catColor = "bg-slate-600"; // Bus-Standardfarbe
                        }

                        // Dynamische Gleis- / Kanten-Ermittlung aus den API-Daten (Sicherung falls leer)
                        const platformDisplay =
                            connData.platform && connData.platform !== "-"
                                ? connData.platform
                                : "-";
                        const isBusType =
                            catColor === "bg-slate-600" ||
                            upperLine.includes("BUS");
                        const platformLabel = isBusType ? "Kante" : "Gleis";

                        // --- NEUES SBB-GLEISWÜRFELN DESIGN FÜR LBLNEXTCONNECTION ---
                        lblNextConnection.className =
                            "bg-sbb-dark text-white dark:bg-white dark:text-slate-800 p-4 rounded-xl mb-4 relative overflow-hidden shadow-sm transition-colors";

                        lblNextConnection.innerHTML = `
                        <div class="relative z-10 flex justify-between items-center">
                            <div class="flex items-center space-x-2">
                                <span class="font-bold text-lg tracking-wide">${connData.departure || "--:--"} Uhr</span>
                            </div>
                            <div class="text-right">
                                <p class="text-[10px] uppercase tracking-wider text-slate-400 dark:text-slate-500 font-semibold">${platformLabel}</p>
                                <p class="text-lg font-black leading-tight">${platformDisplay}</p>
                            </div>
                        </div>
                        <div class="mt-3 relative z-10">
                            <p class="text-[10px] uppercase tracking-wider text-slate-400 dark:text-slate-500 font-semibold mb-1">Richtung</p>
                            <div class="flex items-center space-x-2 flex-wrap gap-y-1">
                                <!-- Das Linien-Badge als Tag vor dem Zielbahnhof -->
                                <span class="${catColor} text-white font-black text-xs px-2 py-1 rounded-sm uppercase tracking-wider shadow-sm shrink-0">${displayLine}</span>
                                <span class="text-xl font-bold tracking-tight">${currentDestinationKey}</span>
                            </div>
                        </div>
                        <!-- Das SVG passt sich farblich an (Dunkel im Hellen Modus, Hell im Dunkelmodus) -->
                        <div class="absolute right-0 bottom-0 opacity-5 dark:opacity-10 transform translate-y-4 translate-x-4 pointer-events-none text-white dark:text-slate-800">
                            <svg class="w-28 h-28" fill="currentColor" viewBox="0 0 16 16">
                                <path d="M5.621 1.485c1.815-.454 2.943-.454 4.758 0 .784.196 1.743.673 2.527 1.119.688.39 1.094 1.148 1.094 1.979V13.5a1.5 1.5 0 0 1-1.5 1.5h-9A1.5 1.5 0 0 1 2 13.5V4.583c0-.831.406-1.588 1.094-1.98.784-.445 1.744-.922 2.527-1.118m5-.97C8.647.02 7.353.02 5.38.515c-.924.23-1.982.766-2.78 1.22C1.566 2.322 1 3.432 1 4.582V13.5A2.5 2.5 0 0 0 3.5 16h9a2.5 2.5 0 0 0 2.5-2.5V4.583c0-1.15-.565-2.26-1.6-2.849-.797-.453-1.855-.988-2.779-1.22ZM5 13a1 1 0 1 1-2 0 1 1 0 0 1 2 0m0 0a1 1 0 1 1 2 0 1 1 0 0 1-2 0m7 1a1 1 0 1 0-1-1 1 1 0 1 0-2 0 1 1 0 0 0 2 0 1 1 0 0 0 1 1M4.5 5a.5.5 0 0 0-.5.5v2a.5.5 0 0 0 .5.5h3V5zm4 0v3h3a.5.5 0 0 0 .5-.5v-2a.5.5 0 0 0-.5-.5zM3 5.5A1.5 1.5 0 0 1 4.5 4h7A1.5 1.5 0 0 1 13 5.5v2A1.5 1.5 0 0 1 11.5 9h-7A1.5 1.5 0 0 1 3 7.5zM6.5 2a.5.5 0 0 0 0 1h3a.5.5 0 0 0 0-1z" />
                            </svg>
                        </div>
                    `;

                        fetchedRouteStopsData = connData.stops;

                        if (containerIntermediateStops) {
                            containerIntermediateStops.innerHTML = "";
                            fetchedRouteStopsData.forEach((stop, index) => {
                                const p = document.createElement("p");
                                p.id = `stop-row-${index}`;
                                p.setAttribute("data-name", stop.name);
                                p.setAttribute("data-lat", stop.lat);
                                p.setAttribute("data-lon", stop.lon);
                                p.className =
                                    "text-sm text-gray-900 dark:text-white font-medium p-1 flex items-center rounded-sm transition-all";
                                p.innerHTML = `<span class="bg-red-600 text-white font-bold px-2 py-1.5 h-8 w-8 text-center rounded-sm mr-4">${index + 1}</span> <span> ${stop.name}</span>`;
                                containerIntermediateStops.appendChild(p);
                            });
                        }

                        if (gameState.currentStep === "confirm") {
                            const matchedIdx = fetchedRouteStopsData.findIndex(
                                (s) => s.name === gameState.exitStation,
                            );
                            if (matchedIdx !== -1) {
                                const stopRow = document.getElementById(
                                    `stop-row-${matchedIdx}`,
                                );
                                if (stopRow) {
                                    stopRow.classList.remove(
                                        "text-gray-900",
                                        "dark:text-white",
                                    );
                                    stopRow.classList.add(
                                        "bg-red-600",
                                        "text-white",
                                        "font-bold",
                                        "shadow-sm",
                                    );
                                }
                                const matchedStop =
                                    fetchedRouteStopsData[matchedIdx];
                                if (matchedStop) {
                                    targetStationCoords = {
                                        lat: matchedStop.lat,
                                        lon: matchedStop.lon,
                                    };
                                }
                                starteLiveStandortPruefung();
                            }
                        }

                        const user = auth.currentUser;
                        if (
                            currentStep === "connection" &&
                            currentActiveTripId &&
                            user &&
                            hostId === user.uid
                        ) {
                            updateDoc(doc(db, "trips", currentActiveTripId), {
                                "gameState.currentStep": "stations",
                            });
                        }
                    }
                });
            }
        }

        if (currentStep === "stations") {
            if (stationsResult) stationsResult.classList.add("hidden");
        }

        if (currentStep === "confirm") {
            if (diceButtonContainer2)
                diceButtonContainer2.classList.add("hidden");
            if (stationsResult) stationsResult.classList.remove("hidden");
            if (valRolledStops)
                valRolledStops.textContent = gameState.rolledStations || "0";
            if (valNextExitStation)
                valNextExitStation.textContent = gameState.exitStation || "-";

            // Rekonstruiere gefundene Stopps direkt aus dem HTML, falls durch Neuladen verloren
            if (fetchedRouteStopsData.length === 0) {
                const rows =
                    containerIntermediateStops.querySelectorAll("p[data-name]");
                if (rows.length > 0) {
                    fetchedRouteStopsData = Array.from(rows).map((el, idx) => ({
                        name: el.getAttribute("data-name"),
                        lat: el.getAttribute("data-lat")
                            ? parseFloat(el.getAttribute("data-lat"))
                            : null,
                        lon: el.getAttribute("data-lon")
                            ? parseFloat(el.getAttribute("data-lon"))
                            : null,
                    }));
                }
            }

            const matchedStop = fetchedRouteStopsData.find(
                (s) => s.name === gameState.exitStation,
            );
            if (matchedStop) {
                targetStationCoords = {
                    lat: matchedStop.lat,
                    lon: matchedStop.lon,
                };
            }

            if (fetchedRouteStopsData.length > 0) {
                const matchedIdx = fetchedRouteStopsData.findIndex(
                    (s) => s.name === gameState.exitStation,
                );
                if (matchedIdx !== -1) {
                    fetchedRouteStopsData.forEach((_, idx) => {
                        const row = document.getElementById(`stop-row-${idx}`);
                        if (row) {
                            row.classList.remove(
                                "bg-red-600",
                                "text-white",
                                "font-bold",
                                "shadow-sm",
                            );
                            row.classList.add(
                                "text-gray-900",
                                "dark:text-white",
                            );
                        }
                    });
                    const stopRow = document.getElementById(
                        `stop-row-${matchedIdx}`,
                    );
                    if (stopRow) {
                        stopRow.classList.remove(
                            "text-gray-900",
                            "dark:text-white",
                        );
                        stopRow.classList.add(
                            "bg-red-600",
                            "text-white",
                            "font-bold",
                            "shadow-sm",
                        );
                    }
                }
            }
            starteLiveStandortPruefung();
        }
    }
}

function starteLiveStandortPruefung() {
    if (!navigator.geolocation) {
        btnConfirmArrival.disabled = false;
        btnConfirmArrival.className =
            "w-full bg-red-600 hover:bg-red-700 text-white rounded-sm px-5 py-3 text-sm font-bold transition uppercase cursor-pointer";
        btnConfirmArrival.textContent = "Confirm Arrival (Kein GPS)";
        return;
    }

    if (!targetStationCoords.lat || !targetStationCoords.lon) {
        btnConfirmArrival.disabled = false;
        btnConfirmArrival.className =
            "w-full bg-red-600 hover:bg-red-700 text-white rounded-sm px-5 py-3 text-sm font-bold transition uppercase cursor-pointer";
        btnConfirmArrival.textContent =
            "Confirm Arrival (Koordinaten unvollstaendig)";
        return;
    }

    if (gpsWatchId !== null) {
        navigator.geolocation.clearWatch(gpsWatchId);
    }

    btnConfirmArrival.disabled = true;
    btnConfirmArrival.className =
        "w-full bg-gray-400 text-white rounded-sm px-5 py-3 text-sm font-bold transition uppercase cursor-not-allowed";
    btnConfirmArrival.textContent = "Suche GPS Signal...";

    gpsWatchId = navigator.geolocation.watchPosition(
        (pos) => {
            const abstand =
                Math.acos(
                    Math.sin((pos.coords.latitude * Math.PI) / 180) *
                        Math.sin((targetStationCoords.lat * Math.PI) / 180) +
                        Math.cos((pos.coords.latitude * Math.PI) / 180) *
                            Math.cos(
                                (targetStationCoords.lat * Math.PI) / 180,
                            ) *
                            Math.cos(
                                ((targetStationCoords.lon -
                                    pos.coords.longitude) *
                                    Math.PI) /
                                    180,
                            ),
                ) * 6371e3;

            if (abstand < 500) {
                btnConfirmArrival.disabled = false;
                btnConfirmArrival.className =
                    "w-full bg-green-600 hover:bg-green-700 text-white rounded-sm px-5 py-3 text-sm font-bold transition uppercase cursor-pointer";
                btnConfirmArrival.textContent =
                    "Du bist da! Jetzt Ankunft bestaetigen";
                navigator.geolocation.clearWatch(gpsWatchId);
                gpsWatchId = null;
            } else {
                btnConfirmArrival.disabled = true;
                btnConfirmArrival.className =
                    "w-full bg-gray-400 text-white rounded-sm px-5 py-3 text-sm font-bold transition uppercase cursor-not-allowed";
                btnConfirmArrival.textContent = `Noch zu weit entfernt (${Math.round(abstand)}m bis zum Ziel)`;
            }
        },
        () => {
            btnConfirmArrival.disabled = false;
            btnConfirmArrival.className =
                "w-full bg-red-600 hover:bg-red-700 text-white rounded-sm px-5 py-3 text-sm font-bold transition uppercase cursor-pointer";
            btnConfirmArrival.textContent =
                "Confirm Arrival (GPS Fehler Fallback)";
        },
        { enableHighAccuracy: true },
    );
}

function updateStopsDiceSelection(count) {
    stopsDiceCount = count;
    [btnStopsDice1, btnStopsDice2, btnStopsDice3].forEach((btn, idx) => {
        if (btn)
            btn.className =
                idx + 1 === count
                    ? "bg-red-600 text-white rounded-sm px-3.5 py-1.5 text-sm font-medium transition cursor-pointer"
                    : "bg-gray-600 hover:bg-gray-700 text-white rounded-sm px-3.5 py-1.5 text-sm font-medium transition cursor-pointer";
    });
}

if (btnStopsDice1)
    btnStopsDice1.addEventListener("click", () => updateStopsDiceSelection(1));
if (btnStopsDice2)
    btnStopsDice2.addEventListener("click", () => updateStopsDiceSelection(2));
if (btnStopsDice3)
    btnStopsDice3.addEventListener("click", () => updateStopsDiceSelection(3));

if (btnRollStationCount) {
    btnRollStationCount.addEventListener("click", async () => {
        if (!currentActiveTripId || fetchedRouteStopsData.length === 0) return;
        btnRollStationCount.disabled = true;
        let sum = 0,
            rollValues = [];
        for (let i = 0; i < stopsDiceCount; i++) {
            const val = Math.floor(Math.random() * 6) + 1;
            rollValues.push(val);
            sum += val;
        }
        const targetIndex = sum - 1;
        const exitIndex =
            targetIndex < fetchedRouteStopsData.length && targetIndex >= 0
                ? targetIndex
                : fetchedRouteStopsData.length - 1;
        const targetStopObj = fetchedRouteStopsData[exitIndex];
        let counter = 0;
        const interval = setInterval(async () => {
            stationsDiceWrapper.innerHTML = Array.from(
                { length: stopsDiceCount },
                () => Math.floor(Math.random() * 6) + 1,
            )
                .map(getDiceSvg)
                .join("");
            counter++;
            if (counter > 12) {
                clearInterval(interval);
                await updateDoc(doc(db, "trips", currentActiveTripId), {
                    "gameState.rolledStations": sum,
                    "gameState.exitStation": targetStopObj.name,
                    "gameState.currentStep": "confirm",
                    "gameState.lastStationRolls": rollValues,
                });
                btnRollStationCount.disabled = false;
            }
        }, 100);
    });
}

if (btnConfirmArrival) {
    btnConfirmArrival.addEventListener("click", async () => {
        if (!currentActiveTripId) return;

        // Stabile Werte aus den Textfeldern lesen und absichern
        const nextStation =
            valNextExitStation && valNextExitStation.textContent
                ? valNextExitStation.textContent.trim()
                : "Unbekannter Bahnhof";
        const startStation =
            currentStationName && currentStationName.textContent
                ? currentStationName.textContent.trim()
                : "Startbahnhof";
        const stayDuration = rollForDuration() || 15;

        // Zähler für Stationen auslesen und NaN-Absturz verhindern
        let stopsCount = 0;
        if (valRolledStops && valRolledStops.textContent) {
            const parsed = parseInt(valRolledStops.textContent);
            if (!isNaN(parsed)) {
                stopsCount = parsed;
            }
        }

        let finalLat = null;
        let finalLon = null;

        // Vergleich komplett unempfindlich gegen Gross- und Kleinschreibung machen
        if (fetchedRouteStopsData && fetchedRouteStopsData.length > 0) {
            const matchedStop = fetchedRouteStopsData.find(
                (s) =>
                    s.name &&
                    s.name.trim().toLowerCase() === nextStation.toLowerCase(),
            );
            if (matchedStop) {
                finalLat = matchedStop.lat;
                finalLon = matchedStop.lon;
            }
        }

        // Falls oben nichts gefunden wurde, versuchen wir den globalen GPS-Speicher als Rettungsanker
        if (
            !finalLat &&
            !finalLon &&
            targetStationCoords.lat &&
            targetStationCoords.lon
        ) {
            finalLat = targetStationCoords.lat;
            finalLon = targetStationCoords.lon;
        }

        // SICHERHEITS-NETZ: Falls die Koordinaten immer noch null sind,
        // setzen wir Standard-Werte ein, damit Firebase unter keinen Umständen abstürzt!
        if (finalLat === null || finalLat === undefined || isNaN(finalLat)) {
            finalLat = 47.3769; // Zürich HB Fallback
        }
        if (finalLon === null || finalLon === undefined || isNaN(finalLon)) {
            finalLon = 8.5417;
        }

        // Erst JETZT loeschen wir die Oberflaeche, da die Daten sicher ermittelt wurden
        containerIntermediateStops.innerHTML = "";
        fetchedRouteStopsData = [];

        if (gpsWatchId !== null) {
            navigator.geolocation.clearWatch(gpsWatchId);
            gpsWatchId = null;
        }

        try {
            // Absenden an Firebase läuft jetzt garantiert ohne Absturz durch
            await updateDoc(doc(db, "trips", currentActiveTripId), {
                "gameState.currentStation": nextStation,
                "gameState.durationAtStation": stayDuration,
                "gameState.currentStep": "destination",
                "gameState.finalDestination": null,
                "gameState.targetDestinationTemp": null,
                "gameState.exitStation": null,
                "gameState.rolledStations": null,
                "gameState.lastDestRolls": null,
                "gameState.lastStationRolls": null,
                diary: arrayUnion({
                    startStation: startStation,
                    station: nextStation,
                    latitude: finalLat,
                    longitude: finalLon,
                    arrivalAt: new Date().toISOString(),
                    stayMinutes: stayDuration,
                    rolledStopsCount: stopsCount, // Nutzt jetzt den abgesicherten Integer-Wert
                }),
            });
        } catch (error) {
            console.error("Fehler beim Speichern in Firebase:", error);
            alert("Fehler beim Bestaetigen: " + error.message);
        }
    });
}

window.renderStep2 = renderStep2;
