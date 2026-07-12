
let deferredPrompt = null;

window.headerLoaded = fetch("page-elements/header.html")
    .then((response) => response.text())
    .then((data) => {
        const navContainer = document.getElementById("header");
        if (navContainer) {
            navContainer.innerHTML = data;
            navContainer.classList.add("sticky", "top-0", "z-50", "shadow-sm");
            initHeaderScripts();
            if (typeof darkMode === "function") darkMode();
            mobileMenu();

            
            
            initInstallButton();

            if (typeof loadAuthModals === "function") loadAuthModals();
        }
    })
    .catch((error) => console.log("Fehler beim Laden des Headers:", error));

function initHeaderScripts() {
    let currentPage = window.location.pathname.split("/").pop();
    if (
        currentPage === "" ||
        currentPage === "index.html" ||
        currentPage === "index" ||
        currentPage === undefined
    ) {
        currentPage = "/";
    }

    const activeLinks = document.querySelectorAll(
        `#navigation nav a[href="${currentPage}"], #navigation #mobileMenu a[href="${currentPage}"]`,
    );

    if (activeLinks && activeLinks.length > 0) {
        activeLinks.forEach((link) => {
            link.classList.remove("text-white/80");
            link.classList.add("text-white/100", "font-bold");
        });
    }
}

function mobileMenu() {
    const mobileMenuToggle = document.getElementById("mobileMenuToggle");
    const mobileMenu = document.getElementById("mobileMenu");

    const burgerIcon = mobileMenuToggle?.querySelector(".burger-icon");
    const closeIcon = mobileMenuToggle?.querySelector(".close-icon");

    if (mobileMenuToggle && mobileMenu) {
        mobileMenuToggle.addEventListener("click", (e) => {
            e.preventDefault();
            e.stopPropagation();

            const dropdown = document.getElementById("profileDropdown");
            const profileArrow = document.getElementById("profileArrow");
            if (dropdown && !dropdown.classList.contains("hidden")) {
                dropdown.classList.add("hidden");
                if (profileArrow) profileArrow.classList.remove("rotate-180");
            }

            mobileMenu.classList.toggle("hidden");
            const isOpen = !mobileMenu.classList.contains("hidden");

            if (burgerIcon && closeIcon) {
                if (isOpen) {
                    burgerIcon.classList.add("hidden");
                    closeIcon.classList.remove("hidden");
                } else {
                    burgerIcon.classList.remove("hidden");
                    closeIcon.classList.add("hidden");
                }
            }
        });
    }

    document.addEventListener("click", (e) => {
        if (mobileMenu && !mobileMenu.classList.contains("hidden")) {
            if (!mobileMenu.contains(e.target)) {
                mobileMenu.classList.add("hidden");
                if (burgerIcon && closeIcon) {
                    burgerIcon.classList.remove("hidden");
                    closeIcon.classList.add("hidden");
                }
            }
        }
    });
}


window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    deferredPrompt = e;

    
    const installButton = document.getElementById("install-button");
    if (installButton) {
        installButton.classList.remove("hidden");
    }
});


function initInstallButton() {
    const installButton = document.getElementById("install-button");

    if (installButton) {
        
        
        if (deferredPrompt) {
            installButton.classList.remove("hidden");
        }

        installButton.addEventListener("click", async () => {
            if (!deferredPrompt) return;

            
            deferredPrompt.prompt();

            
            const { outcome } = await deferredPrompt.userChoice;
            console.log(`Nutzer-Entscheidung: ${outcome}`);

            
            deferredPrompt = null;
            installButton.classList.add("hidden");
        });
    }
}


window.addEventListener("appinstalled", (evt) => {
    console.log("Track Dice wurde erfolgreich installiert!");
    const installButton = document.getElementById("install-button");
    if (installButton) {
        installButton.classList.add("hidden");
    }
});
