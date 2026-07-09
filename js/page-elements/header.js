// Wir speichern das Laden in einer Variable, damit andere Skripte darauf warten können
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
