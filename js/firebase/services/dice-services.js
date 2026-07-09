// Würfelt eine Zahl zwischen 1 und 6
export function rollForStations() {
    return Math.floor(Math.random() * 6) + 1;
}

// Erwürfelt eine zufällige Aufenthaltszeit in Minuten
export function rollForDuration() {
    const options = [10, 15, 20, 30, 45, 60];
    const randomIndex = Math.floor(Math.random() * options.length);
    return options[randomIndex];
}

// Holt echte, zufällige Abfahrten von einem Bahnhof via OpenData API
export async function rollDestinationFromOpenData(currentStation) {
    try {
        // Wir holen die nächsten 15 Abfahrten von der aktuellen Station
        const apiUrl = `https://transport.opendata.ch/v1/stationboard?station=${encodeURIComponent(currentStation)}&limit=15`;
        const response = await fetch(apiUrl);

        if (!response.ok) {
            throw new Error("OpenData API konnte nicht geladen werden.");
        }

        const data = await response.json();

        // Falls keine Verbindungen gefunden wurden, nutzen wir ein Backup-Ziel
        if (!data.stationboard || data.stationboard.length === 0) {
            return "Olten";
        }

        // Wir filtern alle Ziele heraus, die einen gültigen Namen haben
        const validDestinations = data.stationboard
            .map((item) => item.to)
            .filter((name) => name && name !== currentStation);

        if (validDestinations.length === 0) {
            return "Bern";
        }

        // Der Würfel wählt eine zufällige Verbindung aus der Live-Liste!
        const randomIndex = Math.floor(
            Math.random() * validDestinations.length,
        );
        return validDestinations[randomIndex];
    } catch (error) {
        console.error("Fehler bei der OpenData-Abfrage:", error);
        // Sicherer Fallback, falls das Internet mal weg ist
        return "Zürich HB";
    }
}
// Holt die nächste echte Verbindung zwischen zwei Bahnhöfen via OpenData API
export async function fetchNextConnection(fromStation, toStation) {
    try {
        const apiUrl = `https://transport.opendata.ch/v1/connections?from=${encodeURIComponent(fromStation)}&to=${encodeURIComponent(toStation)}&limit=1`;
        const response = await fetch(apiUrl);

        if (!response.ok) {
            throw new Error("Verbindungs-API konnte nicht geladen werden.");
        }

        const data = await response.json();

        if (!data.connections || data.connections.length === 0) {
            return null;
        }

        // Wir nehmen die allererste (nächste) Verbindung
        const conn = data.connections[0];
        const departureTime = new Date(conn.from.departure).toLocaleTimeString(
            [],
            { hour: "2-digit", minute: "2-digit" },
        );
        const arrivalTime = new Date(conn.to.arrival).toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
        });

        return {
            departure: departureTime,
            arrival: arrivalTime,
            line: conn.products
                ? conn.products[0]
                : conn.from.platform || "Zug",
            platform: conn.from.platform || "-",
            duration: conn.duration,
        };
    } catch (error) {
        console.error("Fehler beim Laden der Verbindung:", error);
        return null;
    }
}
