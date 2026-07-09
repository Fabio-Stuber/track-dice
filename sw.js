// Dieser Helfer sorgt dafür, dass die App installierbar ist
self.addEventListener("install", (event) => {
    console.log("App installiert");
});

self.addEventListener("fetch", (event) => {
    // Hier könnte man später einstellen, dass die App auch ohne Internet funktioniert
});
