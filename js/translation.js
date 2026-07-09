function getNestedValue(obj, path) {
    return path.split(".").reduce((current, key) => {
        return current && current[key] !== undefined ? current[key] : null;
    }, obj);
}

async function setLanguage(language) {
    try {
        const response = await fetch(`./language/${language}.json`);

        if (!response.ok) {
            throw new Error(`language for ${language} could not be loaded.`);
        }

        const translations = await response.json();

        const elements = document.querySelectorAll("[data-key]");
        elements.forEach((element) => {
            const key = element.getAttribute("data-key");
            const translatedText = getNestedValue(translations, key);

            if (translatedText !== null) {
                const tagName = element.tagName.toLowerCase();

                if (tagName === "img") {
                    element.src = translatedText;
                } else if (tagName === "meta") {
                    element.setAttribute("content", translatedText);
                } else if (tagName === "title") {
                    document.title = translatedText;
                } else {
                    element.innerHTML = translatedText;
                }
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
