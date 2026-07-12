import { auth, db } from "../firebase-init.js";
import {
    getActiveUserTrip,
    createNewTrip,
    endTrip,
    getUserPastTrips,
    leaveTrip,
    joinTrip,
} from "../services/trip-services.js";
import { rollForStations, rollForDuration } from "../services/dice-services.js";
import {
    doc,
    updateDoc,
    arrayUnion,
    onSnapshot,
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

const dashboardView = document.getElementById("dashboard-view");
const activeTripView = document.getElementById("active-trip-view");
const btnCreateNewTrip = document.getElementById("btnCreateNewTrip");
const btnJoinTrip = document.getElementById("btnJoinTrip");
const btnEndTrip = document.getElementById("btnEndTrip");
const btnShareTrip = document.getElementById("btnShareTrip");
const btnLeaveTrip = document.getElementById("btnLeaveTrip");

const activeTripTitle = document.getElementById("active-trip-title");
const currentStationName = document.getElementById("current-station-name");
const valStayTime = document.getElementById("valStayTime");
const tripInviteCode = document.getElementById("trip-invite-code");

const step1 = document.getElementById("step-1-destination");
const step2 = document.getElementById("step-2-connection");
const step3 = document.getElementById("step-3-stations");
const step4 = document.getElementById("step-4-confirm");

const containerPossibleDestinations = document.getElementById(
    "container-possible-destinations",
);
const btnRollDestination = document.getElementById("btnRollDestination");
const destinationResult = document.getElementById("destination-result");
const valRolledDestination = document.getElementById("valRolledDestination");
const btnConfirmStep1 = document.getElementById("btnConfirmStep1");

const lblNextConnection = document.getElementById("lblNextConnection");
const containerIntermediateStops = document.getElementById(
    "container-intermediate-stops",
);
const btnConfirmStep2 = document.getElementById("btnConfirmStep2");

const btnRollStationCount = document.getElementById("btnRollStationCount");
const stationsResult = document.getElementById("stations-result");
const valRolledStops = document.getElementById("valRolledStops");
const valNextExitStation = document.getElementById("valNextExitStation");
const btnConfirmStep3 = document.getElementById("btnConfirmStep3");

const btnConfirmArrival = document.getElementById("btnConfirmArrival");

const destDiceDisplay = document.getElementById("dest-dice-display-container");
const destDiceWrapper = document.getElementById("dest-dice-wrapper");
const stationsDiceDisplay = document.getElementById(
    "stations-dice-display-container",
);
const stationsDiceWrapper = document.getElementById("stations-dice-wrapper");

const filterTrain = document.getElementById("filter-train");
const filterBus = document.getElementById("filter-bus");
const filterShip = document.getElementById("filter-ship");
const filterCableway = document.getElementById("filter-cableway");
const filterTram = document.getElementById("filter-tram");

const btnDice1 = document.getElementById("btnDice1");
const btnDice2 = document.getElementById("btnDice2");
const btnDice3 = document.getElementById("btnDice3");
let destinationDiceCount = 1;

const btnStopsDice1 = document.getElementById("btnStopsDice1");
const btnStopsDice2 = document.getElementById("btnStopsDice2");
const btnStopsDice3 = document.getElementById("btnStopsDice3");
let stopsDiceCount = 1;

let currentActiveTripId = null;
let currentPossibleDestinationsList = [];
let fetchedRouteStopsData = [];
let unsubscribeTrip = null;

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

    return `
        <svg class="w-12 h-12 bg-white border border-slate-300 rounded-sm shadow-sm" viewBox="0 0 24 24">
          ${dotsHtml}
        </svg>
      `;
}

export async function initTripView(userId) {
    if (!userId) return;
    try {
        const activeTrip = await getActiveUserTrip(userId);
        if (activeTrip) {
            currentActiveTripId = activeTrip.id;
            dashboardView?.classList.add("hidden");
            activeTripView?.classList.remove("hidden");
            setupTripRealtimeListener(currentActiveTripId);
        } else {
            if (unsubscribeTrip) {
                unsubscribeTrip();
                unsubscribeTrip = null;
            }
            currentActiveTripId = null;
            activeTripView?.classList.add("hidden");
            dashboardView?.classList.remove("hidden");
            loadPastTripsList(userId);
        }
    } catch (e) {
        console.error(e);
    }
}

function setupTripRealtimeListener(tripId) {
    if (unsubscribeTrip) unsubscribeTrip();
    unsubscribeTrip = onSnapshot(doc(db, "trips", tripId), async (snapshot) => {
        if (!snapshot.exists()) return;
        const tripData = snapshot.data();
        if (activeTripTitle)
            activeTripTitle.textContent = tripData.title || "Trip";
        if (tripInviteCode) tripInviteCode.textContent = tripId;
        if (currentStationName)
            currentStationName.textContent =
                tripData.gameState.currentStation || "Zürich HB";
        if (valStayTime)
            valStayTime.textContent =
                tripData.gameState.durationAtStation || "0";

        const user = auth.currentUser;
        if (user) {
            if (tripData.hostId === user.uid) {
                btnEndTrip?.classList.remove("hidden");
                btnLeaveTrip?.classList.add("hidden");
            } else {
                btnEndTrip?.classList.add("hidden");
                btnLeaveTrip?.classList.remove("hidden");
            }
        }

        renderGameSteps(tripData.gameState);
    });
}

function getTransportationParams() {
    let params = [];
    if (filterTrain?.checked) params.push("transportations[]=train");
    if (filterBus?.checked) params.push("transportations[]=bus");
    if (filterShip?.checked) params.push("transportations[]=ship");
    if (filterCableway?.checked) params.push("transportations[]=cableway");
    if (filterTram?.checked) params.push("transportations[]=tram");
    return params.length > 0 ? params.join("&") : "transportations[]=train";
}

// Hilfsfunktion: Berechnet die Distanz zwischen zwei Koordinaten in Metern
function getDistanceInMeters(lat1, lon1, lat2, lon2) {
    if (!lat1 || !lon1 || !lat2 || !lon2) return 9999;
    const R = 6371e3; // Erdradius in Metern
    const rad = Math.PI / 180;
    const dLat = (lat2 - lat1) * rad;
    const dLon = (lon2 - lon1) * rad;
    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(lat1 * rad) *
            Math.cos(lat2 * rad) *
            Math.sin(dLon / 2) *
            Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
}

async function fetchFilteredDestinations(stationName) {
    try {
        const locRes = await fetch(
            `https://transport.opendata.ch/v1/locations?query=${encodeURIComponent(stationName)}`,
        );
        const locData = await locRes.json();

        let startLat = null;
        let startLon = null;
        let allDestinations = [];
        const filters = getTransportationParams();

        if (locData.stations && locData.stations.length > 0) {
            startLat = locData.stations[0].coordinate.x;
            startLon = locData.stations[0].coordinate.y;

            const topStations = locData.stations.slice(0, 3);
            for (const station of topStations) {
                if (station.id) {
                    // Lade mehr Verbindungen (50), da wir einige herausfiltern werden
                    const apiUrl = `https://transport.opendata.ch/v1/stationboard?id=${station.id}&limit=50&${filters}`;
                    const res = await fetch(apiUrl);
                    if (res.ok) {
                        const data = await res.json();
                        if (data.stationboard) {
                            data.stationboard.forEach((item) => {
                                if (!item.to) return;
                                const destName = item.to.trim();
                                if (destName === stationName) return;

                                // 200m Filter prüfen: Wir schauen, wo der Bus/Zug hinfährt
                                if (
                                    startLat &&
                                    startLon &&
                                    item.passList &&
                                    item.passList.length > 0
                                ) {
                                    const lastStop =
                                        item.passList[item.passList.length - 1];
                                    if (
                                        lastStop.station &&
                                        lastStop.station.coordinate
                                    ) {
                                        const destLat =
                                            lastStop.station.coordinate.x;
                                        const destLon =
                                            lastStop.station.coordinate.y;
                                        const dist = getDistanceInMeters(
                                            startLat,
                                            startLon,
                                            destLat,
                                            destLon,
                                        );

                                        // Wenn das Ziel weniger als 200m entfernt ist, ignorieren wir es
                                        if (dist < 200) return;
                                    }
                                }
                                allDestinations.push(destName);
                            });
                        }
                    }
                }
            }
        }

        const uniqueDestinations = allDestinations.filter(
            (name, idx, self) => self.indexOf(name) === idx,
        );
        if (uniqueDestinations.length === 0)
            return ["Olten", "Bern", "Zürich HB"];

        // Gib bis zu 18 Ziele zurück (3 Würfel = max 18)
        return uniqueDestinations.slice(0, 18);
    } catch (e) {
        return ["Olten", "Bern", "Zürich HB"];
    }
}

async function fetchNextConnectionWithStops(fromStation, toStation) {
    try {
        const filters = getTransportationParams();
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
                            !stops.some((s) => s.name === stop.station.name)
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
        if (stops.length === 0) {
            stops = [
                { name: fromStation, lat: null, lon: null },
                { name: toStation, lat: null, lon: null },
            ];
        }
        return {
            departure: new Date(conn.from.departure).toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit",
            }),
            line: conn.products ? conn.products[0] : "SBB",
            stops: stops,
        };
    } catch (e) {
        return null;
    }
}

async function renderGameSteps(gameState) {
    const currentStep = gameState.currentStep;

    // 1. Sichtbarkeit steuern: Alte Etappen bleiben offen!
    step1.classList.remove("hidden");

    if (["connection", "stations", "confirm"].includes(currentStep)) {
        step2.classList.remove("hidden");
    } else {
        step2.classList.add("hidden");
    }

    if (currentStep === "confirm") {
        step4.classList.remove("hidden");
    } else {
        step4.classList.add("hidden");
    }

    // 2. Manuelle Bestätigungs-Knöpfe komplett ausblenden
    if (btnConfirmStep1) btnConfirmStep1.style.display = "none";
    if (btnConfirmStep2) btnConfirmStep2.style.display = "none";

    if (currentStep === "destination") {
        step1.classList.remove("hidden");
        if (destDiceDisplay)
            containerPossibleDestinations.innerHTML = `<p class="text-xs text-gray-400 italic animate-pulse">Loading live destinations...</p>`;

        currentPossibleDestinationsList = await fetchFilteredDestinations(
            gameState.currentStation,
        );
        containerPossibleDestinations.innerHTML = "";

        currentPossibleDestinationsList.forEach((dest, idx) => {
            const p = document.createElement("p");
            p.id = `dest-option-${idx + 1}`;
            p.className =
                "text-sm text-gray-900 dark:text-white font-medium p-1 flex items-center rounded-sm transition-all";
            p.innerHTML = `<span class="bg-red-600 text-white font-bold px-2 py-1.5 h-8 w-8 text-center rounded-sm mr-4">${idx + 1}</span> <span> ${dest}</span>`;
            containerPossibleDestinations.appendChild(p);
        });

        if (gameState.finalDestination) {
            if (destinationResult) destinationResult.classList.remove("hidden");
            if (valRolledDestination)
                valRolledDestination.textContent = gameState.finalDestination;
            btnConfirmStep1.classList.remove("hidden");
            const rolledIdx =
                currentPossibleDestinationsList.indexOf(
                    gameState.finalDestination,
                ) + 1;
            const row = document.getElementById(`dest-option-${rolledIdx}`);
            if (row)
                row.className += " bg-red-600 text-white font-bold shadow-sm";
        }
    } else if (currentStep === "connection") {
        step2.classList.remove("hidden");
        lblNextConnection.innerHTML = `<span>Loading route stops...</span>`;
        containerIntermediateStops.innerHTML = "";

        const connData = await fetchNextConnectionWithStops(
            gameState.currentStation,
            gameState.finalDestination,
        );
        if (connData) {
            lblNextConnection.innerHTML = `<span>${connData.line} to ${gameState.finalDestination}</span> <span class="text-red-600 font-bold">Dep: ${connData.departure}</span>`;
            fetchedRouteStopsData = connData.stops;

            fetchedRouteStopsData.forEach((stop, index) => {
                const item = document.createElement("div");
                item.id = `stop-row-${index}`;
                item.className =
                    "text-xs flex justify-between text-gray-900 dark:text-white border-b border-gray-100 dark:border-gray-700 py-1.5 px-2 transition-all rounded-sm";
                item.innerHTML = `<span class="font-medium">${index}. ${stop.name}</span>`;
                containerIntermediateStops.appendChild(item);
                fetchedRouteStopsData.forEach((stop, index) => {
                    const item = document.createElement("div");
                    item.id = `stop-row-${index}`;
                    item.className =
                        "text-xs flex justify-between text-gray-900 dark:text-white border-b border-gray-100 dark:border-gray-700 py-1.5 px-2 transition-all rounded-sm";
                    item.innerHTML = `<span class="font-medium">${index}. ${stop.name}</span>`;
                    containerIntermediateStops.appendChild(item);
                });

                // --- NEU: Nach dem Laden 1.5 Sekunden warten, dann automatisch zu Etappe 3 ---
                setTimeout(async () => {
                    if (currentActiveTripId) {
                        const tripRef = doc(db, "trips", currentActiveTripId);
                        await updateDoc(tripRef, {
                            "gameState.currentStep": "stations",
                        });

                        setTimeout(() => {
                            if (step3)
                                step3.scrollIntoView({
                                    behavior: "smooth",
                                    block: "start",
                                });
                        }, 400);
                    }
                }, 1500);
            });
        } else {
            lblNextConnection.innerHTML = `<span>No route found. Fallback loaded.</span>`;
            fetchedRouteStopsData = [
                { name: gameState.currentStation, lat: null, lon: null },
                { name: gameState.finalDestination, lat: null, lon: null },
            ];
        }
    } else if (currentStep === "stations") {
        step3.classList.remove("hidden");
        if (stationsDiceDisplay) stationsDiceDisplay.classList.add("hidden");
        stationsResult.classList.add("hidden");
    } else if (currentStep === "confirm") {
        step3.classList.remove("hidden");
        step4.classList.remove("hidden");
        stationsResult.classList.remove("hidden");
        btnConfirmStep3.classList.remove("hidden");
        if (valRolledStops)
            valRolledStops.textContent = gameState.rolledStations || "0";
        if (valNextExitStation)
            valNextExitStation.textContent = gameState.finalDestination || "-";

        const matchedIdx = fetchedRouteStopsData.findIndex(
            (s) => s.name === gameState.finalDestination,
        );
        if (matchedIdx !== -1) {
            const stopRow = document.getElementById(`stop-row-${matchedIdx}`);
            if (stopRow)
                stopRow.className +=
                    " bg-red-600 text-white font-bold shadow-sm";
        }
    }
}

function triggerDiceAnimation(
    wrapperElement,
    displayContainer,
    finalValue,
    callback,
) {
    if (displayContainer) displayContainer.classList.remove("hidden");
    let counter = 0;
    const interval = setInterval(() => {
        wrapperElement.innerHTML = getDiceSvg(
            Math.floor(Math.random() * 6) + 1,
        );
        counter++;
        if (counter > 12) {
            clearInterval(interval);
            wrapperElement.innerHTML = getDiceSvg(finalValue);
            if (callback) callback();
        }
    }, 100);
}

// --- Würfel Anzahl Auswahl ---
function updateDiceSelection(count) {
    destinationDiceCount = count;
    [btnDice1, btnDice2, btnDice3].forEach((btn, index) => {
        if (!btn) return;
        if (index + 1 === count) {
            btn.className =
                "bg-red-600 text-white rounded-sm px-3.5 py-1.5 text-sm font-medium transition cursor-pointer";
        } else {
            btn.className =
                "bg-gray-600 hover:bg-gray-700 text-white rounded-sm px-3.5 py-1.5 text-sm font-medium transition cursor-pointer";
        }
    });
}

if (btnDice1) btnDice1.addEventListener("click", () => updateDiceSelection(1));
if (btnDice2) btnDice2.addEventListener("click", () => updateDiceSelection(2));
if (btnDice3) btnDice3.addEventListener("click", () => updateDiceSelection(3));

function updateStopsDiceSelection(count) {
    stopsDiceCount = count;
    [btnStopsDice1, btnStopsDice2, btnStopsDice3].forEach((btn, index) => {
        if (!btn) return;
        if (index + 1 === count) {
            btn.className =
                "px-3 py-1 text-sm font-bold rounded-sm bg-red-600 text-white transition cursor-pointer";
        } else {
            btn.className =
                "px-3 py-1 text-sm font-bold rounded-sm text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition cursor-pointer";
        }
    });
}

if (btnStopsDice1)
    btnStopsDice1.addEventListener("click", () => updateStopsDiceSelection(1));
if (btnStopsDice2)
    btnStopsDice2.addEventListener("click", () => updateStopsDiceSelection(2));
if (btnStopsDice3)
    btnStopsDice3.addEventListener("click", () => updateStopsDiceSelection(3));

// --- Die eigentliche Würfel-Aktion ---
if (btnRollDestination) {
    btnRollDestination.addEventListener("click", async () => {
        if (
            !currentActiveTripId ||
            currentPossibleDestinationsList.length === 0
        )
            return;
        btnRollDestination.disabled = true;

        let sum = 0;
        let rollValues = [];

        // Würfelt für die ausgewählte Anzahl (1 bis 3)
        for (let i = 0; i < destinationDiceCount; i++) {
            const val = Math.floor(Math.random() * 6) + 1;
            rollValues.push(val);
            sum += val;
        }

        // Sicherstellen, dass die Zahl nicht über die Liste hinausgeht
        const targetIndex = (sum - 1) % currentPossibleDestinationsList.length;
        const selectedTarget = currentPossibleDestinationsList[targetIndex];

        // Die Animation für mehrere Würfel
        if (destDiceDisplay) destDiceDisplay.classList.remove("hidden");
        let counter = 0;

        const interval = setInterval(async () => {
            destDiceWrapper.innerHTML = Array.from(
                { length: destinationDiceCount },
                () => Math.floor(Math.random() * 6) + 1,
            )
                .map(getDiceSvg)
                .join("");
            counter++;

            if (counter > 12) {
                clearInterval(interval);
                // Endgültige Würfelaugen anzeigen
                destDiceWrapper.innerHTML = rollValues.map(getDiceSvg).join("");
                valRolledDestination.textContent = selectedTarget;
                destinationResult.classList.remove("hidden");

                const tripRef = doc(db, "trips", currentActiveTripId);
                await updateDoc(tripRef, {
                    "gameState.finalDestination": selectedTarget,
                    "gameState.currentStep": "connection", // <- NEU: Auto-Advance
                });

                // Sanft zum nächsten Schritt scrollen
                setTimeout(() => {
                    if (step2)
                        step2.scrollIntoView({
                            behavior: "smooth",
                            block: "start",
                        });
                }, 400);

                btnRollDestination.disabled = false;
            }
        }, 100);
    });
}

if (btnConfirmStep1) {
    btnConfirmStep1.addEventListener("click", async () => {
        if (!currentActiveTripId) return;
        const tripRef = doc(db, "trips", currentActiveTripId);
        await updateDoc(tripRef, { "gameState.currentStep": "connection" });
    });
}

if (btnConfirmStep2) {
    btnConfirmStep2.addEventListener("click", async () => {
        if (!currentActiveTripId) return;
        const tripRef = doc(db, "trips", currentActiveTripId);
        await updateDoc(tripRef, { "gameState.currentStep": "stations" });
    });
}

if (btnRollStationCount) {
    btnRollStationCount.addEventListener("click", async () => {
        if (!currentActiveTripId || fetchedRouteStopsData.length === 0) return;
        btnRollStationCount.disabled = true;

        let sum = 0;
        let rollValues = [];

        // Entsprechende Anzahl Würfel werfen
        for (let i = 0; i < stopsDiceCount; i++) {
            const val = Math.floor(Math.random() * 6) + 1;
            rollValues.push(val);
            sum += val;
        }

        // Schauen, welcher Halt zur gewürfelten Zahl passt
        const exitIndex =
            sum < fetchedRouteStopsData.length
                ? sum
                : fetchedRouteStopsData.length - 1;
        const targetStopObj =
            fetchedRouteStopsData[exitIndex] ||
            fetchedRouteStopsData[fetchedRouteStopsData.length - 1];

        if (stationsDiceDisplay) stationsDiceDisplay.classList.remove("hidden");

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
                stationsDiceWrapper.innerHTML = rollValues
                    .map(getDiceSvg)
                    .join("");

                if (valRolledStops) valRolledStops.textContent = sum;
                if (valNextExitStation)
                    valNextExitStation.textContent = targetStopObj.name;
                stationsResult.classList.remove("hidden");

                // In der Datenbank speichern und zum Abschluss wechseln
                const tripRef = doc(db, "trips", currentActiveTripId);
                await updateDoc(tripRef, {
                    "gameState.rolledStations": sum,
                    "gameState.finalDestination": targetStopObj.name,
                    "gameState.currentStep": "confirm",
                });

                // Sanft nach unten zum nächsten Schritt gleiten
                setTimeout(() => {
                    if (step4)
                        step4.scrollIntoView({
                            behavior: "smooth",
                            block: "center",
                        });
                }, 400);

                btnRollStationCount.disabled = false;
            }
        }, 100);
    });
}

if (btnConfirmStep3) {
    btnConfirmStep3.addEventListener("click", () => {
        step4?.classList.remove("hidden");
    });
}

if (btnConfirmArrival) {
    btnConfirmArrival.addEventListener("click", async () => {
        if (!currentActiveTripId) return;

        const tripRef = doc(db, "trips", currentActiveTripId);
        const stayDuration = rollForDuration();
        const nextStation = valNextExitStation.textContent;
        const startStation = currentStationName.textContent;

        const matchedStop = fetchedRouteStopsData.find(
            (s) => s.name === nextStation,
        ) || { lat: null, lon: null };

        await updateDoc(tripRef, {
            "gameState.currentStation": nextStation,
            "gameState.durationAtStation": stayDuration,
            "gameState.currentStep": "destination",
            "gameState.finalDestination": null,
            "gameState.rolledStations": null,

            diary: arrayUnion({
                startStation: startStation,
                station: nextStation,
                latitude: matchedStop.lat,
                longitude: matchedStop.lon,
                arrivalAt: new Date().toISOString(),
                stayMinutes: stayDuration,
                rolledStopsCount: parseInt(valRolledStops.textContent || "0"),
            }),
        });
    });
}

[filterTrain, filterBus, filterShip, filterCableway, filterTram].forEach(
    (checkbox) => {
        if (checkbox) {
            checkbox.addEventListener("change", async () => {
                if (
                    currentActiveTripId &&
                    dashboardView.classList.contains("hidden")
                ) {
                    const stationName = currentStationName.textContent;
                    containerPossibleDestinations.innerHTML = `<p class="text-xs text-gray-400 italic animate-pulse">Filtering destinations...</p>`;
                    currentPossibleDestinationsList =
                        await fetchFilteredDestinations(stationName);
                    renderGameSteps({
                        currentStep: "destination",
                        currentStation: stationName,
                    });
                }
            });
        }
    },
);

if (btnCreateNewTrip) {
    btnCreateNewTrip.addEventListener("click", async () => {
        const user = auth.currentUser;
        if (!user) return;
        const tripTitle = prompt(
            "Enter a name for your journey:",
            "Train Adventure",
        );
        if (!tripTitle) return;
        try {
            await createNewTrip(user.uid, tripTitle);
            initTripView(user.uid);
        } catch (error) {
            alert("Error: " + error.message);
        }
    });
}

if (btnJoinTrip) {
    btnJoinTrip.addEventListener("click", async () => {
        const user = auth.currentUser;
        if (!user) return;
        const codeInput = document.getElementById("joinTripCode")?.value;
        if (!codeInput) return;
        try {
            await joinTrip(codeInput.trim().toUpperCase(), user.uid);
            initTripView(user.uid);
        } catch (error) {
            alert("Invalid code.");
        }
    });
}

if (btnEndTrip) {
    btnEndTrip.addEventListener("click", async () => {
        const user = auth.currentUser;
        if (!user) return;
        if (!confirm("Möchtest du diese Reise wirklich für alle beenden?"))
            return;
        try {
            if (currentActiveTripId) {
                await endTrip(currentActiveTripId, user.uid);
                initTripView(user.uid);
            }
        } catch (error) {
            alert("Fehler: " + error.message);
        }
    });
}

if (btnLeaveTrip) {
    btnLeaveTrip.addEventListener("click", async () => {
        const user = auth.currentUser;
        if (!user) return;
        if (!confirm("Möchtest du diese Reise wirklich verlassen?")) return;
        try {
            if (currentActiveTripId) {
                await leaveTrip(currentActiveTripId, user.uid);

                initTripView(user.uid);
            }
        } catch (error) {
            alert("Fehler beim Verlassen: " + error.message);
        }
    });
}

function generateShareLink(tripId) {
    const baseUrl = window.location.origin;
    return `${baseUrl}/?join=${tripId}`;
}

if (btnShareTrip) {
    btnShareTrip.addEventListener("click", async () => {
        if (!currentActiveTripId) return;

        const shareData = {
            title: "Track Dice Reise",
            text: `Komm mit auf meine Reise! Tritt meinem Trip bei unter diesem Link:`,
            url: `${window.location.origin}/?join=${currentActiveTripId}`,
        };

        try {
            if (navigator.share) {
                await navigator.share(shareData);
            } else {
                const fullUrl = `${window.location.origin}/?join=${currentActiveTripId}`;
                await navigator.clipboard.writeText(fullUrl);
                alert(
                    "Teilen wird nicht unterstützt, Link wurde in die Zwischenablage kopiert.",
                );
            }
        } catch (err) {
            console.error("Fehler beim Teilen:", err);
        }
    });
}

export async function handleDeepLinking(userId) {
    const urlParams = new URLSearchParams(window.location.search);
    const tripIdToJoin = urlParams.get("join");

    if (!tripIdToJoin || currentActiveTripId === tripIdToJoin) return;

    try {
        await joinTrip(tripIdToJoin, userId);
        window.history.replaceState(
            {},
            document.title,
            window.location.pathname,
        );
        initTripView(userId);
    } catch (error) {
        console.error("Beitreten über Link fehlgeschlagen:", error);
    }
}

const btnOpenSearchModal = document.getElementById("btnOpenSearchModal");
const btnCloseSearchModal = document.getElementById("btnCloseSearchModal");
const searchModal = document.getElementById("searchModal");
const stationSearchInput = document.getElementById("stationSearchInput");
const searchResults = document.getElementById("searchResults");

// --- Manuelle Bahnhofssuche ---

if (btnOpenSearchModal) {
    btnOpenSearchModal.addEventListener("click", () => {
        searchModal.classList.remove("hidden");
        stationSearchInput.value = "";
        searchResults.innerHTML =
            '<p class="text-xs text-gray-400 italic p-3 text-center">Tippe den Namen eines Bahnhofs ein...</p>';
        setTimeout(() => stationSearchInput.focus(), 100);
    });
}

if (btnCloseSearchModal) {
    btnCloseSearchModal.addEventListener("click", () => {
        searchModal.classList.add("hidden");
    });
}

// Schliesst das Fenster, wenn man daneben klickt
if (searchModal) {
    searchModal.addEventListener("click", (e) => {
        if (e.target === searchModal) {
            searchModal.classList.add("hidden");
        }
    });
}

let searchTimeout;
if (stationSearchInput) {
    stationSearchInput.addEventListener("input", (e) => {
        clearTimeout(searchTimeout);
        const query = e.target.value;

        if (query.length < 2) {
            searchResults.innerHTML =
                '<p class="text-xs text-gray-400 italic p-3 text-center">Tippe den Namen eines Bahnhofs ein...</p>';
            return;
        }

        // Kurze Wartezeit, damit nicht bei jedem Buchstaben sofort gesucht wird
        searchTimeout = setTimeout(async () => {
            searchResults.innerHTML =
                '<p class="text-xs text-gray-400 italic p-3 text-center animate-pulse">Suche Bahnhöfe...</p>';
            try {
                const res = await fetch(
                    `https://transport.opendata.ch/v1/locations?query=${encodeURIComponent(query)}&type=station`,
                );
                const data = await res.json();

                if (data.stations && data.stations.length > 0) {
                    // Nur gültige Haltestellen anzeigen
                    const validStations = data.stations.filter((s) => s.id);

                    if (validStations.length === 0) {
                        searchResults.innerHTML =
                            '<p class="text-xs text-gray-400 italic p-3 text-center">Keine passenden Stationen gefunden.</p>';
                        return;
                    }

                    // Liste der Treffer aufbauen
                    searchResults.innerHTML = validStations
                        .map(
                            (s) => `
                        <button class="w-full text-left p-3 bg-gray-50 hover:bg-red-50 dark:bg-gray-700 dark:hover:bg-gray-600 transition text-sm font-medium text-gray-900 dark:text-white rounded-sm" data-station="${s.name}">
                            ${s.name}
                        </button>
                    `,
                        )
                        .join("");

                    // Klick auf einen Treffer verarbeiten
                    searchResults.querySelectorAll("button").forEach((btn) => {
                        btn.addEventListener("click", async (e) => {
                            const selectedStation =
                                e.currentTarget.getAttribute("data-station");
                            searchModal.classList.add("hidden");

                            // Station in die Firebase-Datenbank speichern
                            if (currentActiveTripId) {
                                const tripRef = doc(
                                    db,
                                    "trips",
                                    currentActiveTripId,
                                );
                                await updateDoc(tripRef, {
                                    "gameState.currentStation": selectedStation,
                                    // Setzt die Route zurück, damit Etappe 1 neu startet
                                    "gameState.currentStep": "destination",
                                    "gameState.finalDestination": null,
                                    "gameState.rolledStations": null,
                                });
                            }
                        });
                    });
                } else {
                    searchResults.innerHTML =
                        '<p class="text-xs text-gray-400 italic p-3 text-center">Keine Stationen gefunden.</p>';
                }
            } catch (error) {
                searchResults.innerHTML =
                    '<p class="text-xs text-red-500 italic p-3 text-center">Fehler bei der Suche. Bitte prüfen Sie Ihre Verbindung.</p>';
            }
        }, 400); // 400 Millisekunden warten
    });
}
