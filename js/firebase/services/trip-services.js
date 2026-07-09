import { db } from "../firebase-init.js";
import {
    doc,
    setDoc,
    updateDoc,
    arrayUnion,
    getDoc,
    collection,
    query,
    where,
    getDocs,
    orderBy,
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// 1. Neue Reise erstellen (Erweiterte Version)
export async function createNewTrip(userId, title) {
    const tripId = "TRIP-" + Math.floor(10000000 + Math.random() * 90000000);
    const tripRef = doc(db, "trips", tripId);

    const initialData = {
        title: title,
        hostId: userId,
        members: [userId],
        createdAt: new Date().toISOString(),
        isPublic: false,
        status: "active", // "active" oder "completed"
        gameState: {
            currentStation: "Zürich HB",
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

// 3. Eine aktive Reise beenden
export async function endTrip(tripId) {
    const tripRef = doc(db, "trips", tripId);
    await updateDoc(tripRef, {
        status: "completed",
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
