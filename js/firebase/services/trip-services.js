import { db } from "../firebase-init.js";
import {
    doc,
    setDoc,
    updateDoc,
    arrayUnion,
    arrayRemove,
    getDoc,
    collection,
    query,
    where,
    getDocs,
    orderBy,
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

function generateTripId() {
    const chars = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ";
    let result = "";
    for (let i = 0; i < 8; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
}

async function getStationFromCurrentLocation() {
    return new Promise((resolve) => {
        if (!navigator.geolocation) {
            showToast(
                "Geolocation wird von deinem Browser nicht unterstützt.",
                "error",
            );
            return;
        }

        navigator.geolocation.getCurrentPosition(
            async (position) => {
                const lat = position.coords.latitude;
                const lon = position.coords.longitude;
                try {
                    const response = await fetch(
                        `https://transport.opendata.ch/v1/locations?x=${lat}&y=${lon}&type=station`,
                    );
                    const data = await response.json();
                    // console.log(data);

                    if (data && data.stations && data.stations.length > 0) {
                        const station = data.stations.find(
                            (s) => s.id && !isNaN(s.id),
                        );
                        const cleanStationName = station.name;
                        resolve(cleanStationName);
                    } else {
                        resolve("Zürich HB");
                    }
                } catch {
                    resolve("Zürich HB");
                }
            },
            () => resolve("Zürich HB"),
            // Aus deinem alten Code übernommen: Sorgt für genauere GPS-Daten
            { enableHighAccuracy: true, timeout: 8000 },
        );
    });
}

// 1. Neue Reise erstellen (Erweiterte Version)
export async function createNewTrip(userId, title) {
    const tripId = generateTripId();
    const tripRef = doc(db, "trips", tripId);
    const startStation = await getStationFromCurrentLocation(); // Standort holen

    const initialData = {
        title: title,
        hostId: userId,
        members: [userId],
        createdAt: new Date().toISOString(),
        isPublic: false,
        status: "active", // "active" oder "completed"
        gameState: {
            currentStation: startStation,
            finalDestination: null,
            currentStep: "destination", // "destination", "connection", "stations"
            diceCount: 6,
            joker: 2,
            currentConnection: null,
            rolledStations: null,
            durationAtStation: 0,
        },
        diary: [],
    };

    await setDoc(tripRef, initialData);
    return tripId;
}

// 2. Mit einem Code einer Reise beitreten (Coop-Modus)
export async function joinTrip(tripId, userId) {
    const tripRef = doc(db, "trips", tripId);
    const tripSnap = await getDoc(tripRef);

    if (!tripSnap.exists()) {
        throw new Error("Trip not found!");
    }

    const tripData = tripSnap.data();
    if (tripData.status !== "active") {
        throw new Error("This trip has already ended!");
    }

    // Fügt die User-ID zu den Mitgliedern hinzu
    await updateDoc(tripRef, {
        members: arrayUnion(userId),
    });
    return true;
}

export async function endTrip(tripId, userId) {
    // <-- userId hier als Parameter übergeben
    const tripRef = doc(db, "trips", tripId);
    const tripSnap = await getDoc(tripRef);

    if (!tripSnap.exists()) {
        throw new Error("Reise nicht gefunden!");
    }

    const tripData = tripSnap.data();
    // Überprüfen, ob die aktuelle Person auch wirklich der Ersteller (hostId) ist
    if (tripData.hostId !== userId) {
        throw new Error("Nur der Ersteller kann diese Reise beenden!");
    }

    await updateDoc(tripRef, {
        status: "completed",
    });
    return true;
}

// NEU: Funktion zum Verlassen einer Reise
export async function leaveTrip(tripId, userId) {
    const tripRef = doc(db, "trips", tripId);
    await updateDoc(tripRef, {
        members: arrayRemove(userId), // Entfernt die userId aus der Liste der Mitglieder
    });
    return true;
}

// 4. Alle vergangenen Reisen eines Benutzers für das Profil laden
export async function getUserPastTrips(userId) {
    const tripsRef = collection(db, "trips");
    // Holt alle Reisen, bei denen der User Mitglied ist und die beendet sind
    const q = query(
        tripsRef,
        where("members", "array-contains", userId),
        where("status", "==", "completed"),
        orderBy("createdAt", "desc"),
    );

    const querySnapshot = await getDocs(q);
    const trips = [];
    querySnapshot.forEach((doc) => {
        trips.push({ id: doc.id, ...doc.data() });
    });
    return trips;
}

// 5. Die aktuell aktive Reise eines Benutzers suchen
export async function getActiveUserTrip(userId) {
    const tripsRef = collection(db, "trips");
    const q = query(
        tripsRef,
        where("members", "array-contains", userId),
        where("status", "==", "active"),
    );

    const querySnapshot = await getDocs(q);
    if (!querySnapshot.empty) {
        const firstDoc = querySnapshot.docs[0];
        return { id: firstDoc.id, ...firstDoc.data() };
    }
    return null;
}
