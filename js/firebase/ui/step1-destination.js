import { auth, db } from "../firebase-init.js";
import { getActiveUserTrip } from "../services/trip-services.js";
import {
    doc,
    updateDoc,
    onSnapshot,
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

const dashboardView = document.getElementById("dashboard-view");
const activeTripView = document.getElementById("active-trip-view");
const activeTripTitle = document.getElementById("active-trip-title");
const tripInviteCode = document.getElementById("trip-invite-code");
const currentStationName = document.getElementById("current-station-name");
const valStayTime = document.getElementById("valStayTime");

const step1 = document.getElementById("step-1-destination");
const containerPossibleDestinations = document.getElementById(
    "container-possible-destinations",
);
const btnRollDestination = document.getElementById("btnRollDestination");
const destinationResult = document.getElementById("destination-result");
const valRolledDestination = document.getElementById("valRolledDestination");
const destDiceDisplay = document.getElementById("dest-dice-display-container");
const destDiceWrapper = document.getElementById("dest-dice-wrapper");

const filterTrain = document.getElementById("filter-train");
const filterBus = document.getElementById("filter-bus");
const filterShip = document.getElementById("filter-ship");
const filterCableway = document.getElementById("filter-cableway");
const filterTram = document.getElementById("filter-tram");

const btnDice1 = document.getElementById("btnDice1");
const btnDice2 = document.getElementById("btnDice2");
const btnDice3 = document.getElementById("btnDice3");
let destinationDiceCount = 1;

let currentActiveTripId = null;
let currentPossibleDestinationsList = [];
let unsubscribeTrip = null;
let lastStation = null;

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

        if (activeTripTitle)
            activeTripTitle.textContent = tripData.title || "Trip";
        if (tripInviteCode) tripInviteCode.textContent = tripId;
        if (currentStationName)
            currentStationName.textContent =
                tripData.gameState.currentStation || "Zuerich HB";
        if (valStayTime)
            valStayTime.textContent =
                tripData.gameState.durationAtStation || "0";

        if (tripData.gameState.filters) {
            if (filterTrain)
                filterTrain.checked = tripData.gameState.filters.train ?? true;
            if (filterBus)
                filterBus.checked = tripData.gameState.filters.bus ?? true;
            if (filterShip)
                filterShip.checked = tripData.gameState.filters.ship ?? true;
            if (filterCableway)
                filterCableway.checked =
                    tripData.gameState.filters.cableway ?? true;
            if (filterTram)
                filterTram.checked = tripData.gameState.filters.tram ?? true;
        }

        const user = auth.currentUser;
        if (user) {
            // HIER: Sperre entfernen, damit jeder Gast klicken darf!
            if (btnRollDestination) btnRollDestination.disabled = false;
        }

        await renderStep1(tripData.gameState);
        if (typeof window.languageSwitcher === "function")
            window.languageSwitcher();
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
        const locRes = await fetch(
            `https://transport.opendata.ch/v1/locations?query=${encodeURIComponent(stationName)}`,
        );
        const locData = await locRes.json();
        let allDestinations = [];
        const filters = getTransportationParams();
        if (locData.stations && locData.stations.length > 0) {
            const topStations = locData.stations.slice(0, 3);
            for (const station of topStations) {
                if (station.id) {
                    const res = await fetch(
                        `https://transport.opendata.ch/v1/stationboard?id=${station.id}&limit=50&${filters}`,
                    );
                    if (res.ok) {
                        const data = await res.json();
                        if (data.stationboard) {
                            data.stationboard.forEach((item) => {
                                if (item.to && item.to.trim() !== stationName)
                                    allDestinations.push(item.to.trim());
                            });
                        }
                    }
                }
            }
        }
        const unique = allDestinations.filter(
            (name, idx, self) => self.indexOf(name) === idx,
        );
        return unique.length === 0
            ? ["Olten", "Bern", "Zuerich HB"]
            : unique.slice(0, 18);
    } catch {
        return ["Olten", "Bern", "Zuerich HB"];
    }
}

async function renderStep1(gameState) {
    step1.classList.remove("hidden");
    const diceButtonContainer1 = document.getElementById("dice-button-1");

    if (gameState.lastDestRolls && gameState.lastDestRolls.length > 0) {
        if (destDiceDisplay) destDiceDisplay.classList.remove("hidden");
        if (destDiceWrapper)
            destDiceWrapper.innerHTML = gameState.lastDestRolls
                .map(getDiceSvg)
                .join("");
        const sumDisplay = document.getElementById("dice-sum-display");
        if (sumDisplay)
            sumDisplay.textContent = gameState.lastDestRolls.reduce(
                (a, b) => a + b,
                0,
            );
    } else {
        if (destDiceDisplay) destDiceDisplay.className += " hidden";
    }

    const currentFinalDest =
        gameState.finalDestination || gameState.targetDestinationTemp;

    // --- DIE LISTE WIRD GELADEN UND ERST WENN DIE DATEN ETABLIERT SIND, ERFOLGT DIE MARKIERUNG ---
    if (
        containerPossibleDestinations.innerHTML === "" ||
        currentPossibleDestinationsList.length === 0 ||
        lastStation !== gameState.currentStation
    ) {
        lastStation = gameState.currentStation;
        containerPossibleDestinations.innerHTML = `<p class="text-xs text-gray-400 italic">Loading live destinations...</p>`;

        // Wir holen die Daten, ohne den restlichen Render-Ablauf zu blockieren
        fetchFilteredDestinations(gameState.currentStation).then(
            (destinations) => {
                currentPossibleDestinationsList = destinations;
                containerPossibleDestinations.innerHTML = "";
                currentPossibleDestinationsList.forEach((dest, idx) => {
                    const p = document.createElement("p");
                    p.id = `dest-option-${idx + 1}`;
                    p.setAttribute("data-name", dest);
                    p.className =
                        "text-sm text-gray-900 dark:text-white font-medium p-1 flex items-center rounded-sm transition-all";
                    p.innerHTML = `<span class="bg-red-600 text-white font-bold px-2 py-1.5 h-8 w-8 text-center rounded-sm mr-4">${idx + 1}</span> <span> ${dest}</span>`;
                    containerPossibleDestinations.appendChild(p);
                });

                // STRIKTE PRÜFUNG: Nur markieren, wenn wirklich ein gütiges Ziel vorhanden ist und es NICHT null/undefined ist
                const currentFinalDest =
                    gameState.finalDestination ||
                    gameState.targetDestinationTemp;
                if (
                    currentFinalDest &&
                    currentFinalDest !== null &&
                    currentFinalDest !== "null" &&
                    currentFinalDest !== undefined
                ) {
                    if (destinationResult)
                        destinationResult.classList.remove("hidden");
                    if (valRolledDestination)
                        valRolledDestination.textContent = currentFinalDest;

                    const rolledIdx =
                        currentPossibleDestinationsList.indexOf(
                            currentFinalDest,
                        ) + 1;
                    if (rolledIdx > 0) {
                        const row = document.getElementById(
                            `dest-option-${rolledIdx}`,
                        );
                        if (row) {
                            row.classList.remove(
                                "text-gray-900",
                                "dark:text-white",
                            );
                            row.classList.add(
                                "bg-red-600",
                                "text-white",
                                "font-bold",
                                "shadow-sm",
                            );
                        }
                    }
                } else {
                    // Sicherheits-Schutz: Wenn kein Ziel da ist, blenden wir die Ergebnisbox aus
                    if (destinationResult)
                        destinationResult.classList.add("hidden");
                }
            },
        );
    } else {
        // Wenn die Liste bereits existiert und nicht neu geladen werden musste
        if (
            currentFinalDest &&
            currentFinalDest !== null &&
            currentFinalDest !== undefined
        ) {
            if (destinationResult) destinationResult.classList.remove("hidden");
            if (valRolledDestination)
                valRolledDestination.textContent = currentFinalDest;

            // Zuerst alle alten Markierungen sauber entfernen
            currentPossibleDestinationsList.forEach((_, idx) => {
                const oldRow = document.getElementById(
                    `dest-option-${idx + 1}`,
                );
                if (oldRow) {
                    // Entfernt die rote Hintergrundfarbe und setzt die Standard-Klassen
                    oldRow.classList.remove(
                        "bg-red-600",
                        "text-white",
                        "font-bold",
                        "shadow-sm",
                    );
                    oldRow.classList.add("text-gray-900", "dark:text-white");
                }
            });

            const rolledIdx =
                currentPossibleDestinationsList.indexOf(currentFinalDest) + 1;
            if (rolledIdx > 0) {
                const row = document.getElementById(`dest-option-${rolledIdx}`);
                if (row) {
                    row.classList.remove("text-gray-900", "dark:text-white");
                    row.classList.add(
                        "bg-red-600",
                        "text-white",
                        "font-bold",
                        "shadow-sm",
                    );
                }
                const sumDisplay = document.getElementById("dice-sum-display");
                if (sumDisplay) sumDisplay.textContent = rolledIdx;
            }
        }
    }

    // Steuerung der Knöpfe basierend auf dem Zustand
    if (gameState.currentStep === "destination") {
        if (destinationResult && !gameState.finalDestination)
            destinationResult.className += " hidden";
        if (diceButtonContainer1)
            diceButtonContainer1.classList.remove("hidden");
    } else {
        if (diceButtonContainer1) diceButtonContainer1.classList.add("hidden");
    }
}

function updateDiceSelection(count) {
    destinationDiceCount = count;
    [btnDice1, btnDice2, btnDice3].forEach((btn, idx) => {
        if (btn)
            btn.className =
                idx + 1 === count
                    ? "bg-red-600 text-white rounded-sm px-3.5 py-1.5 text-sm font-medium transition cursor-pointer"
                    : "bg-gray-600 hover:bg-gray-700 text-white rounded-sm px-3.5 py-1.5 text-sm font-medium transition cursor-pointer";
    });
}
if (btnDice1) btnDice1.addEventListener("click", () => updateDiceSelection(1));
if (btnDice2) btnDice2.addEventListener("click", () => updateDiceSelection(2));
if (btnDice3) btnDice3.addEventListener("click", () => updateDiceSelection(3));

if (btnRollDestination) {
    btnRollDestination.addEventListener("click", async () => {
        if (!currentActiveTripId) return;

        // --- STABILE ERKENNUNG AUS DEM HTML, FALLS DIE VARIABLE LEER IST ---
        if (currentPossibleDestinationsList.length === 0) {
            const rows =
                containerPossibleDestinations.querySelectorAll("p[data-name]");
            if (rows.length > 0) {
                currentPossibleDestinationsList = Array.from(rows).map((el) =>
                    el.getAttribute("data-name").trim(),
                );
            }
        }

        if (currentPossibleDestinationsList.length === 0) {
            console.warn(
                "Wuerfeln abgebrochen: Destinationsliste ist noch leer.",
            );
            return;
        }
        // -----------------------------------------------------------------

        btnRollDestination.disabled = true;
        let sum = 0,
            rollValues = [];
        for (let i = 0; i < destinationDiceCount; i++) {
            const val = Math.floor(Math.random() * 6) + 1;
            rollValues.push(val);
            sum += val;
        }

        const targetIndex = (sum - 1) % currentPossibleDestinationsList.length;
        const selectedTarget = currentPossibleDestinationsList[targetIndex];
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
                const tripRef = doc(db, "trips", currentActiveTripId);
                await updateDoc(tripRef, {
                    "gameState.finalDestination": selectedTarget,
                    "gameState.targetDestinationTemp": selectedTarget,
                    "gameState.currentStep": "connection",
                    "gameState.lastDestRolls": rollValues,
                });
                btnRollDestination.disabled = false;
            }
        }, 100);
    });
}

const filterCheckboxen = [
    filterTrain,
    filterBus,
    filterShip,
    filterCableway,
    filterTram,
];
filterCheckboxen.forEach((checkbox) => {
    checkbox?.addEventListener("change", async () => {
        if (currentActiveTripId) {
            await updateDoc(doc(db, "trips", currentActiveTripId), {
                "gameState.filters.train": filterTrain?.checked ?? true,
                "gameState.filters.bus": filterBus?.checked ?? true,
                "gameState.filters.ship": filterShip?.checked ?? true,
                "gameState.filters.cableway": filterCableway?.checked ?? true,
                "gameState.filters.tram": filterTram?.checked ?? true,
            });
        }
    });
});
window.renderStep1 = renderStep1;
