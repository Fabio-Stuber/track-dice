function getNestedValue(obj, path) {
    return path.split(".").reduce((current, key) => {
        return current && current[key] !== undefined ? current[key] : null;
    }, obj);
}

async function setLanguage(language) {
    try {
        const response = await fetch(`./language/${language}.json`);
        let translations = {};

        if (response.ok) {
            translations = await response.json();
        } else {
            console.warn(
                `Language for ${language} could not be loaded. Using keys as fallback.`,
            );
        }

        const elements = document.querySelectorAll("[data-key]");
        elements.forEach((element) => {
            const key = element.getAttribute("data-key");
            const translatedText = getNestedValue(translations, key);

            // Wenn die Übersetzung existiert, nehmen wir sie.
            // Ansonsten zeigen wir direkt den Schlüsselnamen an (perfekt zum Testen!).
            const textToDisplay =
                translatedText !== null ? translatedText : key;

            const tagName = element.tagName.toLowerCase();
            if (tagName === "img") {
                if (translatedText) element.src = translatedText;
            } else if (tagName === "meta") {
                element.setAttribute("content", textToDisplay);
            } else if (tagName === "title") {
                document.title = textToDisplay;
            } else {
                element.innerHTML = textToDisplay;
            }
        });

        localStorage.setItem("selectedLanguage", language);
        document.documentElement.lang = language;
    } catch (error) {
        console.error("Error while loading language:", error);
    }
}

function languageSwitcher() {
    if (typeof setLanguage === "function") {
        const urlParams = new URLSearchParams(window.location.search);
        let targetLanguage = urlParams.get("lang");

        if (targetLanguage) {
            localStorage.setItem("selectedLanguage", targetLanguage);
        } else {
            targetLanguage = localStorage.getItem("selectedLanguage");
        }

        if (!targetLanguage) {
            targetLanguage = "en";
        }

        if (document.documentElement.lang !== targetLanguage) {
            setLanguage(targetLanguage);
        }
    }
}

window.setLanguage = setLanguage;
window.languageSwitcher = languageSwitcher;
