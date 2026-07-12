
export function rollForStations() {
    return Math.floor(Math.random() * 6) + 1;
}


export function rollForDuration() {
    const options = [10, 15, 20, 30, 45, 60];
    const randomIndex = Math.floor(Math.random() * options.length);
    return options[randomIndex];
}


export async function fetchPossibleDestinations(currentStation) {
    try {
        const apiUrl = `https://transport.opendata.ch/v1/stationboard?station=${encodeURIComponent(currentStation)}&limit=15`;
        const response = await fetch(apiUrl);
        if (!response.ok) throw new Error("API error");

        const data = await response.json();
        if (!data.stationboard || data.stationboard.length === 0) {
            return ["Olten", "Bern", "Zürich HB"];
        }

        
        const destinations = data.stationboard
            .map((item) => item.to)
            .filter(
                (name, index, self) =>
                    name &&
                    name !== currentStation &&
                    self.indexOf(name) === index,
            );

        return destinations.length > 0 ? destinations : ["Olten", "Bern"];
    } catch (error) {
        console.error("Error fetching destinations:", error);
        return ["Olten", "Bern", "Zürich HB"];
    }
}


export async function fetchNextConnectionWithStops(fromStation, toStation) {
    try {
        const apiUrl = `https://transport.opendata.ch/v1/connections?from=${encodeURIComponent(fromStation)}&to=${encodeURIComponent(toStation)}&limit=1`;
        const response = await fetch(apiUrl);
        if (!response.ok) throw new Error("API error");

        const data = await response.json();
        if (!data.connections || data.connections.length === 0) return null;

        const conn = data.connections[0];
        const departureTime = new Date(conn.from.departure).toLocaleTimeString(
            [],
            { hour: "2-digit", minute: "2-digit" },
        );
        const arrivalTime = new Date(conn.to.arrival).toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
        });

        
        let stops = [];
        if (conn.sections) {
            conn.sections.forEach((section) => {
                if (section.journey && section.journey.passList) {
                    section.journey.passList.forEach((stop) => {
                        if (
                            stop.station &&
                            stop.station.name &&
                            !stops.includes(stop.station.name)
                        ) {
                            stops.push(stop.station.name);
                        }
                    });
                }
            });
        }

        
        if (stops.length === 0) {
            stops = [fromStation, toStation];
        }

        return {
            departure: departureTime,
            arrival: arrivalTime,
            line: conn.products
                ? conn.products[0]
                : conn.from.platform || "Zug",
            platform: conn.from.platform || "-",
            duration: conn.duration,
            stops: stops,
        };
    } catch (error) {
        console.error("Error fetching connection paths:", error);
        return null;
    }
}
