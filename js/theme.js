function updateTheme() {
    if (
        localStorage.theme === "dark" ||
        (!("theme" in localStorage) &&
            window.matchMedia("(prefers-color-scheme: dark)").matches)
    ) {
        document.documentElement.classList.add("dark");
    } else {
        document.documentElement.classList.remove("dark");
    }
}

updateTheme();

function darkMode() {
    const themeToggle = document.getElementById("themeToggle");
    if (themeToggle) {
        themeToggle.addEventListener("click", () => {
            if (document.documentElement.classList.contains("dark")) {
                localStorage.theme = "light";
            } else {
                localStorage.theme = "dark";
            }
            updateTheme();
        });
    }
}

window.updateTheme = updateTheme;
window.darkMode = darkMode;
