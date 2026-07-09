import { auth } from "../firebase-init.js";
import { getActiveUserTrip } from "../services/trip-services.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";

const diaryTimeline = document.getElementById("diary-timeline");
let map = null;

// Initialisiert die Leaflet Karte
function initLeafletMap() {
    if (map) return;
    map = L.map('map').setView([46.8182, 8.2275], 8);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(map);
}

// Holt GPS Daten
async function getCoords(station) {
    const res = await fetch(`https://transport.opendata.ch/v1/locations?query=${encodeURIComponent(station)}&type=station`);
    const data = await res.json();
    return data.stations?.length ? [data.stations[0].coordinate.y, data.stations[0].coordinate.x] : null;
}

async function loadDiary(user) {
    initLeafletMap();
    const trip = await getActiveUserTrip(user.uid);
    if (!trip || !trip.diary) return;

    // Timeline befüllen - Respektiert dein HTML-Layout!
    diaryTimeline.innerHTML = trip.diary.map(entry => `
        <li class="pl-6 relative">
            <div class="absolute w-4 h-4 bg-red-600 rounded-full border-2 border-white dark:border-gray-800 -left-[9px] top-1"></div>
            <h3 class="font-bold text-gray-900 dark:text-white">${entry.from} ➔ ${entry.to}</h3>
            <p class="text-sm text-gray-600 dark:text-gray-400">Ankunft: ${new Date(entry.timestamp).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}</p>
            <div class="mt-2 inline-block bg-gray-100 dark:bg-gray-700 p-2 rounded-sm text-sm">
                <p class="text-gray-800 dark:text-gray-200">
                    Stationen: ${entry.stationsFahrzeit} | Aufenthalt: ${entry.durationAtStation} Min.
                </p>
            </div>
        </li>
    `).join('');

    // Karte zeichnen
    const path = [];
    for (const entry of trip.diary) {
        const c1 = await getCoords(entry.from);
        const c2 = await getCoords(entry.to);
        if (c1) { path.push(c1); L.marker(c1).addTo(map).bindPopup(entry.from); }
        if (c2) { path.push(c2); L.marker(c2).addTo(map).bindPopup(entry.to); }
    }
    if (path.length > 1) {
        L.polyline(path, { color: 'red', weight: 4 }).addTo(map);
        map.fitBounds(path);
    }
}

onAuthStateChanged(auth, (user) => { if (user) loadDiary(user); });