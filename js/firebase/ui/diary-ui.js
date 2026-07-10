import { auth } from "../firebase-init.js";
import { getActiveUserTrip } from "../services/trip-services.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";

const diaryTimeline = document.getElementById("diary-timeline");
let map = null;
let routeLayer = null;

function initLeafletMap() {
    if (map) return;
    const mapElement = document.getElementById("map");
    if (!mapElement) return;

    map = L.map("map").setView([47.3769, 8.5417], 9);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: "© OpenStreetMap & SBB",
    }).addTo(map);

    routeLayer = L.layerGroup().addTo(map);
}

function fixCoordinates(lat, lng) {
    if (!lat || !lng) return null;
    const val1 = parseFloat(lat);
    const val2 = parseFloat(lng);
    if (val1 < val2) return [val2, val1];
    return [val1, val2];
}

// Holt die exakte Schienengeometrie für die Strecke von Bahnhof A nach Bahnhof B
async function fetchSBBTrackGeometry(startStation, station) {
    try {
        // Wir reinigen die Namen (z.B. "Langenthal" statt "Langenthal, Bahnhof")
        const cleanFrom = startStation.split(",")[0].trim();
        const cleanTo = station.split(",")[0].trim();

        // Offizielle SBB-API Abfrage: Wir suchen Streckenstücke, die genau diese Bahnhöfe als Start oder Ziel haben
        const url = `https://data.sbb.ch/api/explore/v2.1/catalog/datasets/linie/records?where=(bp_von_von_name%20like%20%22${encodeURIComponent(cleanFrom)}%22%20and%20bp_bis_bis_name%20like%20%22${encodeURIComponent(cleanTo)}%22)%20or%20(bp_von_von_name%20like%20%22${encodeURIComponent(cleanTo)}%22%20and%20bp_bis_bis_name%20like%20%22${encodeURIComponent(cleanFrom)}%22)&limit=10`;

        const response = await fetch(url);
        const data = await response.json();

        if (data.results && data.results.length > 0) {
            // Wir nehmen das beste gefundene Linienstück
            const record = data.results[0];
            if (record.geoline && record.geoline.coordinates) {
                // SBB liefert [Lng, Lat], Leaflet braucht [Lat, Lng]
                return record.geoline.coordinates.map((coord) => [
                    coord[1],
                    coord[0],
                ]);
            }
        }
    } catch (e) {
        console.error("Fehler beim Abrufen der SBB-Schienengeometrie:", e);
    }
    return null;
}

async function initDiaryPage(user) {
    if (!diaryTimeline) return;
    initLeafletMap();

    try {
        const activeTrip = await getActiveUserTrip(user.uid);
        if (!activeTrip || !activeTrip.diary || activeTrip.diary.length === 0) {
            diaryTimeline.innerHTML =
                '<li class="pl-6 text-gray-500 italic">Noch keine Etappen vorhanden.</li>';
            return;
        }

        // Text-Liste links befüllen (Dein Original-Layout!)
        diaryTimeline.innerHTML = activeTrip.diary
            .map(
                (entry) => `
            <li class="pl-6 relative">
                <div class="absolute w-4 h-4 bg-red-600 rounded-full border-2 border-white dark:border-gray-800 -left-[9px] top-1"></div>
                <h3 class="font-bold text-gray-900 dark:text-white">${entry.startStation} ➔ ${entry.station}</h3>
                <p class="text-sm text-gray-600 dark:text-gray-400">Ankunft: ${new Date(entry.arrivalAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</p>
                <div class="mt-2 inline-block bg-gray-100 dark:bg-gray-700 p-2 rounded-sm text-sm">
                    <p class="text-gray-800 dark:text-gray-200">
                        Stationen: ${entry.rolledStopsCount} | Aufenthalt: ${entry.stayMinutes} Min.
                    </p>
                </div>
            </li>
        `,
            )
            .join("");

        if (routeLayer) routeLayer.clearLayers();
        const boundsPoints = [];

        // Jede Etappe einzeln zeichnen, damit die Schienenlinien stimmen
        for (let i = 0; i < activeTrip.diary.length; i++) {
            const entry = activeTrip.diary[i];

            // Aktuelle Koordinaten (Ziel der Etappe)
            const currentLatLng = fixCoordinates(
                entry.latitude,
                entry.longitude,
            );

            // Startkoordinaten: Entweder aus dem vorherigen Eintrag (i-1)
            // oder, falls es der erste Eintrag (i=0) ist, nehmen wir eine
            // Startposition an oder überspringen das Zeichnen der Linie.
            let startLatLng = null;
            if (i > 0) {
                const previousEntry = activeTrip.diary[i - 1];
                startLatLng = fixCoordinates(
                    previousEntry.latitude,
                    previousEntry.longitude,
                );
            } else {
                // Hier kannst du entscheiden: Soll die erste Etappe
                // einen eigenen Startpunkt haben?
                // Wenn nicht, setze startLatLng auf null.
                startLatLng = currentLatLng;
            }

            // Jetzt kannst du mit startLatLng und currentLatLng arbeiten:
            if (startLatLng && currentLatLng) {
                // Marker für Start (nur beim ersten Mal oder bei jeder Etappe?)
                if (i === 0) {
                    L.marker(startLatLng)
                        .addTo(routeLayer)
                        .bindPopup(`<b>${entry.startStation}</b>`);
                }

                // Marker für Ziel
                L.marker(currentLatLng)
                    .addTo(routeLayer)
                    .bindPopup(`<b>${entry.station}</b>`);

                // Hier kommt dein API-Aufruf für die Linie
                const sbbTrackGeo = await fetchSBBTrackGeometry(
                    entry.startStation,
                    entry.station,
                );

                if (sbbTrackGeo && sbbTrackGeo.length > 0) {
                    L.polyline(sbbTrackGeo, {
                        color: "#dc2626",
                        weight: 5,
                    }).addTo(routeLayer);
                } else {
                    // Fallback
                    L.polyline([startLatLng, currentLatLng], {
                        color: "#dc2626",
                        weight: 4,
                        dashArray: "5, 10",
                    }).addTo(routeLayer);
                }
            }
        }

        if (boundsPoints.length > 0 && map) {
            map.fitBounds(L.latLngBounds(boundsPoints), { padding: [50, 50] });
        }
    } catch (error) {
        console.error("Fehler beim Laden des Tagebuchs:", error);
    }
}

onAuthStateChanged(auth, (user) => {
    if (user) initDiaryPage(user);
});
