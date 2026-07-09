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

if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => {
        navigator.serviceWorker
            .register("/sw.js")
            .then((reg) => console.log("ServiceWorker online", reg))
            .catch((err) => console.log("ServiceWorker offline", err));
    });
}
