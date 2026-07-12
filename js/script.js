function togglePasswordVisibility(inputId, textId) {
    const passwordInput = document.getElementById(inputId);
    const toggleText = document.getElementById(textId);

    if (passwordInput && toggleText) {
        if (passwordInput.type === "password") {
            passwordInput.type = "text";
            toggleText.textContent = "Hide";
        } else {
            passwordInput.type = "password";
            toggleText.textContent = "Show";
        }
    }
}
window.togglePasswordVisibility = togglePasswordVisibility;

document.addEventListener("DOMContentLoaded", () => {
    const dependencies = [];

    if (window.headerLoaded) dependencies.push(window.headerLoaded);
    if (window.footerLoaded) dependencies.push(window.footerLoaded);

    Promise.all(dependencies).then(() => {
        if (typeof window.languageSwitcher === "function") {
            window.languageSwitcher();
        }
    });
});

import { initTripView, handleDeepLinking } from "./firebase/ui/trip-ui.js";
import { auth } from "./firebase/firebase-init.js";

// 2. Hier wird geprüft, ob der User eingeloggt ist
auth.onAuthStateChanged(async (user) => {
    if (user) {
        // UI für den angemeldeten User laden
        await initTripView(user.uid);

        // --- HIER MUSS DER AUFRUF HIN ---
        // Dies prüft beim Login, ob ein ?join=TRIPID Parameter in der URL steht
        await handleDeepLinking(user.uid);
        // --------------------------------
    } else {
        // User ist nicht eingeloggt
    }
});

if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => {
        navigator.serviceWorker
            .register("/sw.js")
            .then((reg) => console.log("ServiceWorker online", reg))
            .catch((err) => console.log("ServiceWorker offline", err));
    });
}

const fields = document.querySelectorAll(".code-field");
const hiddenInput = document.getElementById("joinTripCode");

// Hilfsfunktion: Aktualisiert das versteckte Feld für deine anderen Skripte
function updateHiddenInput() {
    let fullCode = "";
    fields.forEach((field) => {
        fullCode += field.value;
    });

    hiddenInput.value = fullCode;

    // Simuliert ein "Input"-Event, falls andere Skripte den Wert live überwachen
    hiddenInput.dispatchEvent(new Event("input", { bubbles: true }));
    hiddenInput.dispatchEvent(new Event("change", { bubbles: true }));
}

fields.forEach((field, index) => {
    // 1. Copy/Paste (Einfügen) abfangen
    field.addEventListener("paste", (e) => {
        e.preventDefault();
        const pastedData = (e.clipboardData || window.clipboardData)
            .getData("text")
            .toUpperCase()
            .trim();

        for (let i = 0; i < pastedData.length; i++) {
            if (index + i < fields.length) {
                fields[index + i].value = pastedData[i];
                fields[index + i].focus();
            }
        }
        updateHiddenInput(); // Wert aktualisieren
    });

    // 2. Normale Eingabe per Tastatur
    field.addEventListener("input", (e) => {
        field.value = field.value.toUpperCase();

        if (field.value.length === 1 && index < fields.length - 1) {
            fields[index + 1].focus();
        }
        updateHiddenInput(); // Wert aktualisieren
    });

    // 3. Zurück-Taste (Backspace)
    field.addEventListener("keydown", (e) => {
        if (e.key === "Backspace" && field.value.length === 0 && index > 0) {
            fields[index - 1].focus();
            updateHiddenInput(); // Wert aktualisieren
        }
    });
});
