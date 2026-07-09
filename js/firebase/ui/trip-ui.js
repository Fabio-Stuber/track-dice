import { auth, db } from "../firebase-init.js";
import {
    getActiveUserTrip,
    createNewTrip,
    endTrip,
    getUserPastTrips,
    joinTrip, // HIER ERWEITERT
} from "../services/trip-services.js";
import {
    rollDestinationFromOpenData,
    rollForStations,
    rollForDuration,
    fetchNextConnection, // HIER ERGÄNZT
} from "../services/dice-services.js";
import {
    doc,
    updateDoc,
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// HTML-Elemente holen
const dashboardView = document.getElementById("dashboard-view");
const activeTripView = document.getElementById("active-trip-view");
const btnCreateNewTrip = document.getElementById("btnCreateNewTrip");
const btnJoinTrip = document.getElementById("btnJoinTrip"); // HIER ERWEITERT
const btnEndTrip = document.getElementById("btnEndTrip");

const activeTripTitle = document.getElementById("active-trip-title");
const currentStationName = document.getElementById("current-station-name");

// Würfel-Elemente
const btnRollDestination = document.getElementById("btnRollDestination");
const btnRollStationCount = document.getElementById("btnRollStationCount");
const connectionDetails = document.getElementById("connection-details");

let currentActiveTripId = null;

export async function initTripView(userId) {
    if (!userId) return;

    const diaryNavLinks = document.querySelectorAll(
        'a[href="diary"], a[href="diary.html"]',
    );
    try {
        const activeTrip = await getActiveUserTrip(userId);

        if (activeTrip) {
            currentActiveTripId = activeTrip.id;

            if (dashboardView) dashboardView.classList.add("hidden");
            if (activeTripView) activeTripView.classList.remove("hidden");

            if (activeTripTitle)
                activeTripTitle.textContent = activeTrip.title || "Meine Reise";
            if (currentStationName)
                currentStationName.textContent =
                    activeTrip.gameState.currentStation;

            // Zeige den aktuellen Schritt an und befülle Texte
            showCorrectDiceStep(activeTrip.gameState);
        } else {
            currentActiveTripId = null;
            diaryNavLinks.forEach((link) => link.classList.add("hidden"));
            if (activeTripView) activeTripView.classList.add("hidden");
            if (dashboardView) dashboardView.classList.remove("hidden");

            loadPastTripsList(userId);
        }
    } catch (error) {
        console.error("Error loading trip view:", error);
    }
}

function showCorrectDiceStep(gameState) {
    const stepDest = document.getElementById("step-1-destination");
    const stepConn = document.getElementById("step-2-connection");
    const stepStat = document.getElementById("step-3-stations");

    if (stepDest) stepDest.classList.add("hidden");
    if (stepConn) stepConn.classList.add("hidden");
    if (stepStat) stepStat.classList.add("hidden");

    const currentStep = gameState.currentStep;

    if (currentStep === "destination" && stepDest) {
        stepDest.classList.remove("hidden");
    } else if (currentStep === "connection" && stepConn) {
        stepConn.classList.remove("hidden");

        if (connectionDetails) {
            connectionDetails.innerHTML = `<p class="text-xs text-gray-500 italic animate-pulse">Lade aktuelle SBB-Verbindung...</p>`;

            // Suche die echte Verbindung live im Hintergrund
            fetchNextConnection(
                gameState.currentStation,
                gameState.finalDestination,
            ).then((conn) => {
                if (conn) {
                    connectionDetails.innerHTML = `
                        <div class="space-y-2 text-gray-900 dark:text-white">
                            <p class="font-bold text-red-600 dark:text-red-400">Erwürfeltes Endziel: ${gameState.finalDestination}</p>
                            <div class="border-t border-gray-200 dark:border-gray-700 pt-2 grid grid-cols-2 gap-2 text-xs">
                                <div><span class="font-semibold">Abfahrt:</span> ${conn.departure} ab Gleis ${conn.platform}</div>
                                <div><span class="font-semibold">Ankunft:</span> ${conn.arrival}</div>
                                <div><span class="font-semibold">Fahrzeit:</span> ${conn.duration.replace("00d", "")}</div>
                                <div><span class="font-semibold">Typ:</span> ${conn.line}</div>
                            </div>
                        </div>
                        <button id="btnProceedToStations" class="mt-4 w-full bg-gray-600 hover:bg-gray-700 text-white text-xs font-medium px-3 py-2 rounded transition cursor-pointer uppercase tracking-wider">
                            Verbindung bestaetigen
                        </button>
                    `;
                } else {
                    connectionDetails.innerHTML = `
                        <p class="font-bold text-red-600">Erwürfeltes Endziel: ${gameState.finalDestination}</p>
                        <p class="text-xs text-amber-600 mt-2">Keine direkte Verbindung gefunden oder API überlastet.</p>
                        <button id="btnProceedToStations" class="mt-4 w-full bg-gray-600 hover:bg-gray-700 text-white text-xs font-medium px-3 py-2 rounded transition cursor-pointer uppercase">
                            Trotzdem weitergehen
                        </button>
                    `;
                }

                // Event-Listener für den neu generierten Knopf aktivieren
                document
                    .getElementById("btnProceedToStations")
                    ?.addEventListener("click", async () => {
                        if (!currentActiveTripId) return;
                        const tripRef = doc(db, "trips", currentActiveTripId);
                        await updateDoc(tripRef, {
                            "gameState.currentStep": "stations",
                        });
                        // Aktualisiert die Ansicht für alle Mitglieder
                        const user = auth.currentUser;
                        if (user) initTripView(user.uid);
                    });
            });
        }
    } else if (currentStep === "stations" && stepStat) {
        stepStat.classList.remove("hidden");
    }
}

// ==========================================
// EVENT LISTENERS FÜR REISE-STEUTERUNG & WÜRFEL
// ==========================================

// NEU: Mit einem Code einer Reise beitreten
if (btnJoinTrip) {
    btnJoinTrip.addEventListener("click", async () => {
        const user = auth.currentUser;
        if (!user) return;

        const codeInput = prompt(
            "Gib den Reise-Code deines Freundes ein (z.B. TRIP-1234):",
        );
        if (!codeInput) return;

        const formattedCode = codeInput.trim().toUpperCase();

        try {
            await joinTrip(formattedCode, user.uid);
            alert("Erfolgreich beigetreten! Ihr reist jetzt zusammen.");
            initTripView(user.uid); // Ansicht direkt umschalten
        } catch (error) {
            alert(
                "Fehler beim Beitreten: Der Code ist ungueltig oder die Reise wurde bereits beendet.",
            );
        }
    });
}

// Schritt 1: Endziel live via OpenData erwürfeln
if (btnRollDestination) {
    btnRollDestination.addEventListener("click", async () => {
        if (!currentActiveTripId) return;

        btnRollDestination.disabled = true;
        btnRollDestination.textContent = "Suche Live-Ziele...";

        try {
            const currentStation = currentStationName
                ? currentStationName.textContent
                : "Zürich HB";
            const targetDestination =
                await rollDestinationFromOpenData(currentStation);

            alert(
                `Das Würfel-Glück hat entschieden!\nDein Ziel ab ${currentStation} ist: ${targetDestination}`,
            );

            const tripRef = doc(db, "trips", currentActiveTripId);
            await updateDoc(tripRef, {
                "gameState.finalDestination": targetDestination,
                "gameState.currentStep": "connection",
            });

            const user = auth.currentUser;
            if (user) initTripView(user.uid);
        } catch (error) {
            console.error("Fehler beim Speichern des OpenData-Ziels:", error);
            alert(
                "Es gab ein Problem mit der Verbindung. Bitte versuche es noch einmal.",
            );
        } finally {
            btnRollDestination.disabled = false;
            btnRollDestination.textContent = "index.steps.dest_btn";
        }
    });
}

// Schritt 3: Stationen erwürfeln & im Tagebuch (Diary) loggen
if (btnRollStationCount) {
    btnRollStationCount.addEventListener("click", async () => {
        if (!currentActiveTripId) return;

        const stations = rollForStations();
        const duration = rollForDuration();

        // Wir holen uns das aktuelle Ziel, das als nächstes angefahren wird
        const nextStation =
            connectionDetails
                ?.querySelector("p.font-bold")
                ?.textContent?.replace("Erwürfeltes Endziel: ", "") ||
            "Unbekannter Bahnhof";
        const oldStation = currentStationName
            ? currentStationName.textContent
            : "Start";

        alert(
            `Du fährst ${stations} Stationen weit Richtung ${nextStation}!\nAufenthaltszeit dort: ${duration} Minuten.`,
        );

        try {
            const tripRef = doc(db, "trips", currentActiveTripId);

            // Wir erstellen einen neuen Tagebucheintrag
            const diaryEntry = {
                from: oldStation,
                to: nextStation,
                stationsFahrzeit: stations,
                durationAtStation: duration,
                timestamp: new Date().toISOString(),
            };

            // Firebase-Update: Das Ziel wird zum neuen aktuellen Standort,
            // und der Eintrag wird ins Tagebuch-Array geschoben!
            const { arrayUnion } =
                await import("https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js");

            await updateDoc(tripRef, {
                "gameState.currentStation": nextStation, // Neuer Standort nach der Fahrt
                "gameState.rolledStations": stations,
                "gameState.durationAtStation": duration,
                "gameState.currentStep": "destination", // Runde startet von vorn
                "gameState.finalDestination": null,
                diary: arrayUnion(diaryEntry), // Eintrag ins Reisetagebuch einspeisen
            });

            const user = auth.currentUser;
            if (user) initTripView(user.uid);
        } catch (error) {
            console.error(
                "Fehler beim Speichern der Stationen im Tagebuch:",
                error,
            );
        }
    });
}

// Liste der alten Reisen auslesen
async function loadPastTripsList(userId) {
    const recentTripsList = document.getElementById("recent-trips-list");
    if (!recentTripsList) return;

    try {
        const pastTrips = await getUserPastTrips(userId);

        if (pastTrips.length === 0) {
            recentTripsList.innerHTML = `<p data-key="index.dashboard.no_trips" class="text-sm italic">index.dashboard.no_trips</p>`;
            return;
        }

        recentTripsList.innerHTML = "";
        pastTrips.forEach((trip) => {
            const date = new Date(trip.createdAt).toLocaleDateString();
            const card = document.createElement("div");
            card.className =
                "p-4 bg-white dark:bg-gray-700 rounded-lg shadow-sm flex justify-between items-center text-gray-900 dark:text-white";
            card.innerHTML = `
                <div>
                    <h4 class="font-bold">${trip.title}</h4>
                    <p class="text-xs text-gray-500 dark:text-gray-400">${date}</p>
                </div>
                <span class="text-xs bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-300 px-2 py-1 rounded">Beendet</span>
            `;
            recentTripsList.appendChild(card);
        });
    } catch (error) {
        console.error("Error loading past trips:", error);
    }
}

// Reise starten
if (btnCreateNewTrip) {
    btnCreateNewTrip.addEventListener("click", async () => {
        const user = auth.currentUser;
        if (!user) return;

        const tripTitle = prompt(
            "Gib deiner Reise einen Namen:",
            "Zugsabenteuer",
        );
        if (!tripTitle) return;

        try {
            await createNewTrip(user.uid, tripTitle);
            initTripView(user.uid);
        } catch (error) {
            alert("Fehler beim Erstellen der Reise: " + error.message);
        }
    });
}

// Reise beenden
if (btnEndTrip) {
    btnEndTrip.addEventListener("click", async () => {
        const user = auth.currentUser;
        if (!user) return;

        const confirmEnd = confirm(
            "Möchtest du diese Reise wirklich beenden? Sie wird dann in deinem Profil gespeichert.",
        );
        if (!confirmEnd) return;

        try {
            if (currentActiveTripId) {
                await endTrip(currentActiveTripId);
                initTripView(user.uid);
            }
        } catch (error) {
            alert("Fehler beim Beenden der Reise: " + error.message);
        }
    });
}
