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

// DOM Elemente holen
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

// Würfel-Elemente Steps
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

// Würfel SVGs Display Container
const destDiceDisplay = document.getElementById("dest-dice-display-container");
const destDiceWrapper = document.getElementById("dest-dice-wrapper");
const stationsDiceDisplay = document.getElementById(
    "stations-dice-display-container",
);
const stationsDiceWrapper = document.getElementById("stations-dice-wrapper");

// Verkehrsmittel Checkboxen
const filterTrain = document.getElementById("filter-train");
const filterBus = document.getElementById("filter-bus");
const filterShip = document.getElementById("filter-ship");
const filterCableway = document.getElementById("filter-cableway");
const filterTram = document.getElementById("filter-tram");

let currentActiveTripId = null;
let currentPossibleDestinationsList = [];
let fetchedRouteStopsData = []; // Speichert Name, Breitengrad und Längengrad der Haltestellen
let unsubscribeTrip = null;

// SBB Gleiswürfeln original Würfel-Grafik Generator
function getDiceSvg(val) {
    const dots = {
        1: [[24, 24]],
        2: [
            [12, 12],
            [36, 36],
        ],
        3: [
            [12, 12],
            [24, 24],
            [36, 36],
        ],
        4: [
            [12, 12],
            [12, 36],
            [36, 12],
            [36, 36],
        ],
        5: [
            [12, 12],
            [12, 36],
            [24, 24],
            [36, 12],
            [36, 36],
        ],
        6: [
            [12, 12],
            [12, 24],
            [12, 36],
            [36, 12],
            [36, 24],
            [36, 36],
        ],
    };

    const activeDots = dots[val] || [];
    // Weisse Punkte erzeugen
    const dotsHtml = activeDots
        .map((d) => `<circle cx="${d[0]}" cy="${d[1]}" r="4" fill="#ffffff"/>`)
        .join("");

    // Original SBB roter Hintergrund mit abgerundeten Ecken
    return `
        <svg class="w-20 h-20 shadow-lg" viewBox="0 0 48 48">
            <rect x="2" y="2" width="44" height="44" rx="6" fill="#eb0000" />
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
                // Ich bin der Ersteller -> Ich darf beenden, aber nicht verlassen
                btnEndTrip?.classList.remove("hidden");
                btnLeaveTrip?.classList.add("hidden");
            } else {
                // Ich bin ein Mitreisender -> Ich darf verlassen, aber nicht beenden
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

async function fetchFilteredDestinations(stationName) {
    try {
        const filters = getTransportationParams();
        const apiUrl = `https://transport.opendata.ch/v1/stationboard?station=${encodeURIComponent(stationName)}&limit=40&${filters}`;
        const res = await fetch(apiUrl);
        if (!res.ok) return ["Olten", "Bern", "Zürich HB", "Luzern"];
        const data = await res.json();
        if (!data.stationboard || data.stationboard.length === 0)
            return ["Olten", "Bern", "Zürich HB"];

        return data.stationboard
            .map((item) => item.to)
            .filter(
                (name, idx, self) =>
                    name && name !== stationName && self.indexOf(name) === idx,
            )
            .slice(0, 6);
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
    step1.classList.add("hidden");
    step2.classList.add("hidden");
    step3.classList.add("hidden");
    step4.classList.add("hidden");
    btnConfirmStep1.classList.add("hidden");
    btnConfirmStep3.classList.add("hidden");

    const currentStep = gameState.currentStep;

    if (currentStep === "destination") {
        step1.classList.remove("hidden");
        if (destDiceDisplay) destDiceDisplay.classList.add("hidden");
        containerPossibleDestinations.innerHTML = `<p class="text-xs text-gray-400 italic animate-pulse">Loading live destinations...</p>`;

        currentPossibleDestinationsList = await fetchFilteredDestinations(
            gameState.currentStation,
        );
        containerPossibleDestinations.innerHTML = "";

        currentPossibleDestinationsList.forEach((dest, idx) => {
            const p = document.createElement("p");
            p.id = `dest-option-${idx + 1}`;
            p.className =
                "text-xs text-gray-900 dark:text-white font-medium py-1.5 px-2 flex justify-between rounded-sm transition-all";
            p.innerHTML = `<span>${idx + 1}. ${dest}</span>`;
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

        // Markiere die gewählte Station in der Routen-Liste (Schritt 2)
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

// SBB Gleiswürfeln Shaker Simulation
function triggerDiceAnimation(
    wrapperElement,
    displayContainer,
    finalValue,
    callback,
) {
    if (displayContainer) displayContainer.classList.remove("hidden");
    wrapperElement.classList.add("animate-bounce");
    let counter = 0;
    const interval = setInterval(() => {
        wrapperElement.innerHTML = getDiceSvg(
            Math.floor(Math.random() * 6) + 1,
        );
        counter++;
        if (counter > 12) {
            clearInterval(interval);
            wrapperElement.classList.remove("animate-bounce");
            wrapperElement.innerHTML = getDiceSvg(finalValue);
            if (callback) callback();
        }
    }, 60);
}

// Event-Listener: Schritt 1 - Destination würfeln
if (btnRollDestination) {
    btnRollDestination.addEventListener("click", async () => {
        if (
            !currentActiveTripId ||
            currentPossibleDestinationsList.length === 0
        )
            return;
        btnRollDestination.disabled = true;

        const randomIndex = Math.floor(
            Math.random() * currentPossibleDestinationsList.length,
        );
        const selectedTarget = currentPossibleDestinationsList[randomIndex];
        const rolledNumber = randomIndex + 1;

        triggerDiceAnimation(
            destDiceWrapper,
            destDiceDisplay,
            rolledNumber,
            async () => {
                valRolledDestination.textContent = selectedTarget;
                destinationResult.classList.remove("hidden");
                const tripRef = doc(db, "trips", currentActiveTripId);
                await updateDoc(tripRef, {
                    "gameState.finalDestination": selectedTarget,
                });
                btnRollDestination.disabled = false;
            },
        );
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

// Event-Listener: Schritt 3 - Stationenanzahl würfeln
if (btnRollStationCount) {
    btnRollStationCount.addEventListener("click", async () => {
        if (!currentActiveTripId) return;
        btnRollStationCount.disabled = true;

        const rolledStops = rollForStations();
        const exitIndex =
            rolledStops < fetchedRouteStopsData.length
                ? rolledStops
                : fetchedRouteStopsData.length - 1;
        const targetStopObj = fetchedRouteStopsData[exitIndex] || {
            name: "Destination",
            lat: null,
            lon: null,
        };

        triggerDiceAnimation(
            stationsDiceWrapper,
            stationsDiceDisplay,
            rolledStops,
            async () => {
                if (valNextExitStation)
                    valNextExitStation.textContent = targetStopObj.name;
                const tripRef = doc(db, "trips", currentActiveTripId);
                await updateDoc(tripRef, {
                    "gameState.rolledStations": rolledStops,
                    "gameState.finalDestination": targetStopObj.name,
                    "gameState.currentStep": "confirm",
                });
                btnRollStationCount.disabled = false;
            },
        );
    });
}

if (btnConfirmStep3) {
    btnConfirmStep3.addEventListener("click", () => {
        step4?.classList.remove("hidden");
    });
}

// Event-Listener: Schritt 4 - Permanent loggen mit Startbahnhof & Koordinaten
if (btnConfirmArrival) {
    btnConfirmArrival.addEventListener("click", async () => {
        if (!currentActiveTripId) return;

        const tripRef = doc(db, "trips", currentActiveTripId);
        const stayDuration = rollForDuration();
        const nextStation = valNextExitStation.textContent;
        const startStation = currentStationName.textContent;

        // Finde die passenden Koordinaten aus unserer gespeicherten Liste heraus
        const matchedStop = fetchedRouteStopsData.find(
            (s) => s.name === nextStation,
        ) || { lat: null, lon: null };

        await updateDoc(tripRef, {
            "gameState.currentStation": nextStation,
            "gameState.durationAtStation": stayDuration,
            "gameState.currentStep": "destination",
            "gameState.finalDestination": null,
            "gameState.rolledStations": null,
            // Permanent ins Reisetagebuch eintragen
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

// [Die verbleibenden Standard-Funktionen für Erstellen/Beitreten/Enden bleiben identisch...]

// Event-Listener für Live-Filter-Wechsel (aktualisiert die Zielliste sofort)
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

// Reise erstellen / Beenden / Beitreten
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
                // Wir übergeben jetzt auch die user.uid zur Kontrolle
                await endTrip(currentActiveTripId, user.uid);
                initTripView(user.uid);
            }
        } catch (error) {
            alert("Fehler: " + error.message);
        }
    });
}

// NEU: Klick-Aktion für das Verlassen der Reise
if (btnLeaveTrip) {
    btnLeaveTrip.addEventListener("click", async () => {
        const user = auth.currentUser;
        if (!user) return;
        if (!confirm("Möchtest du diese Reise wirklich verlassen?")) return;
        try {
            if (currentActiveTripId) {
                await leaveTrip(currentActiveTripId, user.uid);
                // Ansicht aktualisieren, damit man wieder das Dashboard sieht
                initTripView(user.uid);
            }
        } catch (error) {
            alert("Fehler beim Verlassen: " + error.message);
        }
    });
}

// In trip-ui.js
function generateShareLink(tripId) {
    // Nimmt die aktuelle Domain und fügt den Parameter hinzu
    const baseUrl = window.location.origin;
    return `${baseUrl}/?join=${tripId}`;
}

// Beispiel für deinen Event-Listener am Share-Button
if (btnShareTrip) {
    btnShareTrip.addEventListener("click", async () => {
        if (!currentActiveTripId) return;

        const shareData = {
            title: "Track Dice Reise",
            text: `Komm mit auf meine Reise! Tritt meinem Trip bei unter diesem Link:`,
            url: `${window.location.origin}/?join=${currentActiveTripId}`,
        };

        try {
            // Prüfen, ob der Browser die Web Share API unterstützt
            if (navigator.share) {
                await navigator.share(shareData);
            } else {
                // Fallback für Browser, die das nicht unterstützen
                // Hier kopieren wir den Link als Alternative
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

    // Prüfen, ob wir bereits in diesem Trip sind oder ob gar kein Link vorhanden ist
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
