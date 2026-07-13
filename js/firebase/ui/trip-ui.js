import { auth, db } from "../firebase-init.js";
import {
    getActiveUserTrip,
    createNewTrip,
    endTrip,
    leaveTrip,
    joinTrip,
} from "../services/trip-services.js";
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

const btnCreateNewTrip = document.getElementById("btnCreateNewTrip");
const btnJoinTrip = document.getElementById("btnJoinTrip");
const btnEndTrip = document.getElementById("btnEndTrip");
const btnShareTrip = document.getElementById("btnShareTrip");
const btnLeaveTrip = document.getElementById("btnLeaveTrip");

let currentActiveTripId = null;
let unsubscribeTrip = null;

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

            // --- NEU: VERGANGENE REISEN IM DASHBOARD LADEN ---
            // Wir importieren die Funktion, falls sie noch nicht geladen ist
            const { getUserPastTrips } =
                await import("../services/trip-services.js");
            const pastTrips = await getUserPastTrips(userId);

            // Wir suchen den Container für die vergangenen Reisen im HTML
            // (Ersetze 'container-past-trips' durch die ID deines Listen-Elements, falls sie anders heisst)
            const pastTripsContainer =
                document.getElementById("container-past-trips") ||
                document.querySelector("#dashboard-view div:last-child");
            if (pastTripsContainer) {
                if (pastTrips && pastTrips.length > 0) {
                    // KORREKTUR: Exakt dein Kartendesign mit rounded-sm, font-mono und text-xs
                    pastTripsContainer.innerHTML = `
                        <div class="space-y-2 overflow-y-auto">
                            ${pastTrips
                                .map((trip) => {
                                    const datum = trip.createdAt
                                        ? new Date(
                                              trip.createdAt,
                                          ).toLocaleDateString("de-CH")
                                        : "Unbekannt";
                                    const stationenZaehler = trip.diary
                                        ? trip.diary.length
                                        : 0;

                                    return `
<div class="bg-gray-100 dark:bg-gray-700 rounded-sm p-5 text-sm font-mono text-gray-900 dark:text-white flex justify-between items-center shadow-sm">
        <div class="flex items-center space-x-4">
            <span class="bg-red-600 text-white font-bold px-2 py-1 rounded-sm uppercase tracking-wider text-xs">
                ${trip.id}
            </span>
            <div>
                <p class="font-bold text-base">${trip.title || "Zug Abenteuer"}</p>
                <p class="text-xs text-gray-500 dark:text-gray-300 mt-1">${stationenZaehler} Stationen</p>
            </div>
        </div>
        
        <!-- Bereich für die Profilbilder -->
<div class="flex -space-x-2">
            ${
                trip.members && Array.isArray(trip.members)
                    ? trip.members
                          .map(
                              (member) => `
                <div class="w-8 h-8 rounded-full border-2 border-gray-100 dark:border-gray-700 overflow-hidden bg-gray-300">
                    <img src="${member.avatarUrl || "https://ui-avatars.com/api/?name=" + member + "&background=random"}" 
                         class="w-full h-full object-cover" 
                         alt="Avatar"
                         onerror="this.src='https://ui-avatars.com/api/?name=User&background=random'">
                </div>
            `,
                          )
                          .join("")
                    : ""
            }
        </div>

        <div class="text-gray-500 dark:text-gray-300 font-medium">
            ${datum}
        </div>
    </div>
                                `;
                                })
                                .join("")}
                        </div>
                    `;
                } else {
                    pastTripsContainer.innerHTML = `<p class="text-xs font-mono text-gray-400 italic">Noch keine Reisen vorhanden.</p>`;
                }
            }
            // --------------------------------------------------
        }
    } catch (e) {
        console.error(e);
    }
}

function setupTripRealtimeListener(tripId) {
    if (!tripId) return;
    if (unsubscribeTrip) unsubscribeTrip();

    // WICHTIG: Kein "async" direkt im onSnapshot!
    unsubscribeTrip = onSnapshot(doc(db, "trips", tripId), (snapshot) => {
        if (!snapshot.exists()) return;
        const tripData = snapshot.data();

        // Wenn die Reise beendet wurde, sofort zurück ins Dashboard wechseln
        if (tripData.status === "completed") {
            if (unsubscribeTrip) {
                unsubscribeTrip();
                unsubscribeTrip = null;
            }
            currentActiveTripId = null;
            activeTripView?.classList.add("hidden");
            dashboardView?.classList.remove("hidden");
            return;
        }

        // Texte und Inhalte setzen
        if (activeTripTitle)
            activeTripTitle.textContent = tripData.title || "Trip";
        if (tripInviteCode) tripInviteCode.textContent = tripId;
        if (currentStationName)
            currentStationName.textContent =
                tripData.gameState?.currentStation || "Zuerich HB";
        if (valStayTime)
            valStayTime.textContent =
                tripData.gameState?.durationAtStation || "0";

        // Filter Checkboxen synchronisieren
        if (tripData.gameState?.filters) {
            const filterTrain = document.getElementById("filter-train");
            const filterBus = document.getElementById("filter-bus");
            const filterShip = document.getElementById("filter-ship");
            const filterCableway = document.getElementById("filter-cableway");
            const filterTram = document.getElementById("filter-tram");

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

        // Host/Teilnehmer Buttons anzeigen oder verstecken
        const user = auth.currentUser;
        if (user) {
            // Wer die Reise beenden darf, bleibt wie gehabt (nur der Ersteller)
            if (tripData.hostId === user.uid) {
                btnEndTrip?.classList.remove("hidden");
                btnLeaveTrip?.classList.add("hidden");
            } else {
                btnEndTrip?.classList.add("hidden");
                btnLeaveTrip?.classList.remove("hidden");
            }
        }

        // Hier rufen wir die Render-Funktionen der Schritte asynchron auf, damit onSnapshot nicht blockiert!
        if (typeof window.renderStep1 === "function") {
            window.renderStep1(tripData.gameState);
        }
        if (typeof window.renderStep2 === "function") {
            window.renderStep2(tripData.gameState, tripData.hostId);
        }

        if (typeof window.languageSwitcher === "function") {
            window.languageSwitcher();
        }
    });
}

if (btnCreateNewTrip) {
    btnCreateNewTrip.addEventListener("click", async () => {
        const user = auth.currentUser;
        if (!user) return;
        const tripTitle = prompt(
            "Gib einen Namen fuer deine Reise ein:",
            "Zug Abenteuer",
        );
        if (!tripTitle) return;
        try {
            if (unsubscribeTrip) {
                unsubscribeTrip();
                unsubscribeTrip = null;
            }
            const containerPossibleDestinations = document.getElementById(
                "container-possible-destinations",
            );
            const containerIntermediateStops = document.getElementById(
                "container-intermediate-stops",
            );
            if (containerPossibleDestinations)
                containerPossibleDestinations.innerHTML = "";
            if (containerIntermediateStops)
                containerIntermediateStops.innerHTML = "";

            await createNewTrip(user.uid, tripTitle);
            await initTripView(user.uid);
        } catch (error) {
            alert("Fehler: " + error.message);
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
            await initTripView(user.uid);
        } catch (error) {
            alert("Ungueltiger Code.");
        }
    });
}

if (btnEndTrip) {
    btnEndTrip.addEventListener("click", async () => {
        const user = auth.currentUser;
        if (!user) return;
        if (!confirm("Moechtest du diese Reise wirklich fuer alle beenden?"))
            return;
        try {
            if (currentActiveTripId) {
                await endTrip(currentActiveTripId, user.uid);
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
        if (!confirm("Moechtest du diese Reise wirklich verlassen?")) return;
        try {
            if (currentActiveTripId) {
                if (unsubscribeTrip) {
                    unsubscribeTrip();
                    unsubscribeTrip = null;
                }
                await leaveTrip(currentActiveTripId, user.uid);
                currentActiveTripId = null;
                activeTripView?.classList.add("hidden");
                dashboardView?.classList.remove("hidden");
                await initTripView(user.uid);
            }
        } catch (error) {
            alert("Fehler beim Verlassen: " + error.message);
        }
    });
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
                    "Teilen wird nicht unterstuetzt, Link wurde in die Zwischenablage kopiert.",
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
        await initTripView(userId);
    } catch (error) {
        console.error("Beitreten ueber Link fehlgeschlagen:", error);
    }
}
// --- DIESER TEIL MUSS GANZ UNTEN IN DIE TRIP-UI.JS ---

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
        searchTimeout = setTimeout(async () => {
            searchResults.innerHTML =
                '<p class="text-xs text-gray-400 italic p-3 text-center animate-pulse">Suche Bahnhoefe...</p>';
            try {
                const res = await fetch(
                    `https://transport.opendata.ch/v1/locations?query=${encodeURIComponent(query)}&type=station`,
                );
                const data = await res.json();
                if (data.stations && data.stations.length > 0) {
                    const validStations = data.stations.filter((s) => s.id);
                    if (validStations.length === 0) {
                        searchResults.innerHTML =
                            '<p class="text-xs text-gray-400 italic p-3 text-center">Keine passenden Stationen gefunden.</p>';
                        return;
                    }
                    searchResults.innerHTML = validStations
                        .map(
                            (s) => `
                        <button class="w-full text-left p-3 bg-gray-50 hover:bg-red-50 dark:bg-gray-700 dark:hover:bg-gray-600 transition text-sm font-medium text-gray-900 dark:text-white rounded-sm" data-station="${s.name}">
                            ${s.name}
                        </button>
                    `,
                        )
                        .join("");
                    searchResults.querySelectorAll("button").forEach((btn) => {
                        btn.addEventListener("click", async (e) => {
                            const selectedStation =
                                e.currentTarget.getAttribute("data-station");
                            searchModal.classList.add("hidden");
                            if (currentActiveTripId) {
                                const tripRef = doc(
                                    db,
                                    "trips",
                                    currentActiveTripId,
                                );
                                await updateDoc(tripRef, {
                                    "gameState.currentStation": selectedStation,
                                    "gameState.currentStep": "destination",
                                    "gameState.finalDestination": null,
                                    "gameState.rolledStations": null,
                                    "gameState.lastDestRolls": null,
                                    "gameState.lastStationRolls": null,
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
                    '<p class="text-xs text-red-500 italic p-3 text-center">Fehler bei der Suche.</p>';
            }
        }, 400);
    });
}
