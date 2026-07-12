import { auth, db } from "../firebase-init.js";
import {
    loginNutzer,
    registriereNutzer,
    sendePasswortLink,
    speichereNeuesPasswort,
    logoutNutzer,
} from "../services/auth-services.js";

import { initTripView } from "./trip-ui.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";

function initAuthFormListeners() {
    const loginForm = document.getElementById("loginForm");
    if (loginForm) {
        loginForm.addEventListener("submit", (e) => {
            e.preventDefault();
            const email = document.getElementById("email").value;
            const password = document.getElementById("password").value;

            loginNutzer(email, password)
                .then(() => {
                    window.location.reload();
                })
                .catch((error) => {
                    alert("Login failed: " + error.message);
                });
        });
    }

    const signupForm = document.getElementById("signupForm");
    if (signupForm) {
        signupForm.addEventListener("submit", (e) => {
            e.preventDefault();
            const firstName = document.getElementById("signupVorname").value;
            const lastName = document.getElementById("signupNachname").value;
            const email = document.getElementById("signupEmail").value;
            const password = document.getElementById("signupPassword").value;

            registriereNutzer(firstName, lastName, email, password)
                .then(() => {
                    window.location.reload();
                })
                .catch((error) => {
                    alert("Registration failed: " + error.message);
                });
        });
    }

    const forgotForm = document.getElementById("forgotForm");
    if (forgotForm) {
        forgotForm.addEventListener("submit", (e) => {
            e.preventDefault();
            const email = document.getElementById("forgotEmail").value;

            sendePasswortLink(email)
                .then(() => {
                    alert(
                        "Ein Link zum Zuruecksetzen des Passworts wurde an Ihre E-Mail-Adresse gesendet.",
                    );
                    const forgotModal = document.getElementById("forgotModal");
                    if (forgotModal) forgotModal.classList.add("hidden");
                })
                .catch((error) => {
                    alert("Fehler: " + error.message);
                });
        });
    }

    const urlParams = new URLSearchParams(window.location.search);
    const oobCode = urlParams.get("oobCode");

    if (oobCode) {
        if (oobCode === "test") {
            const emailDisplay = document.getElementById("resetEmailDisplay");
            if (emailDisplay)
                emailDisplay.textContent = "test-benutzer@beispiel.com";
            const resetPasswordModal =
                document.getElementById("resetPasswordModal");
            if (resetPasswordModal)
                resetPasswordModal.classList.remove("hidden");
        } else {
            import("https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js")
                .then(({ verifyPasswordResetCode }) =>
                    verifyPasswordResetCode(auth, oobCode),
                )
                .then((email) => {
                    const emailDisplay =
                        document.getElementById("resetEmailDisplay");
                    if (emailDisplay) emailDisplay.textContent = email;
                    const resetPasswordModal =
                        document.getElementById("resetPasswordModal");
                    if (resetPasswordModal)
                        resetPasswordModal.classList.remove("hidden");
                })
                .catch((error) => {
                    alert(
                        "Der Link ist ungueltig oder abgelaufen: " +
                            error.message,
                    );
                });
        }
    }

    const resetPasswordForm = document.getElementById("resetPasswordForm");
    if (resetPasswordForm) {
        resetPasswordForm.addEventListener("submit", (e) => {
            e.preventDefault();
            const newPassword = document.getElementById("newPassword").value;

            if (!oobCode || oobCode === "test") {
                alert(
                    "Im Testmodus (oobCode=test) kann kein echtes Passwort gespeichert werden.",
                );
                return;
            }

            speichereNeuesPasswort(oobCode, newPassword)
                .then(() => {
                    alert(
                        "Ihr Passwort wurde erfolgreich geandert! Sie koennen sich jetzt einloggen.",
                    );
                    window.history.replaceState(
                        {},
                        document.title,
                        window.location.pathname,
                    );
                    const resetPasswordModal =
                        document.getElementById("resetPasswordModal");
                    const loginModal = document.getElementById("loginModal");
                    if (resetPasswordModal)
                        resetPasswordModal.classList.add("hidden");
                    if (loginModal) loginModal.classList.remove("hidden");
                })
                .catch((error) => {
                    alert("Fehler beim Zuruecksetzen: " + error.message);
                });
        });
    }
}


if (document.getElementById("loginForm")) {
    initAuthFormListeners();
} else {
    window.initAuthFormListeners = initAuthFormListeners;
}

function updateVisibilityBasedOnAuth(user) {
    const loggedInElements = document.querySelectorAll(".show-logged-in");
    const loggedOutElements = document.querySelectorAll(".show-logged-out");

    if (user) {
        loggedInElements.forEach((el) => {
            el.setAttribute("data-active", "true");
            el.style.removeProperty("display");
        });
        loggedOutElements.forEach((el) => {
            el.removeAttribute("data-active");
            el.style.setProperty("display", "none", "important");
        });
    } else {
        loggedInElements.forEach((el) => {
            el.removeAttribute("data-active");
            el.style.setProperty("display", "none", "important");
        });
        loggedOutElements.forEach((el) => {
            el.setAttribute("data-active", "true");
            el.style.removeProperty("display");
        });
    }
}

onAuthStateChanged(auth, async (user) => {
    updateVisibilityBasedOnAuth(user);

    
    if (user) {
        initTripView(user.uid);
    }

    const checkHeaderInterval = setInterval(async () => {
        const loginNavBtns = document.querySelectorAll(
            "#loginNavBtn, #profileMenuToggle",
        );

        if (loginNavBtns.length > 0) {
            clearInterval(checkHeaderInterval);

            if (user) {
                let displayName = user.displayName || user.email;
                let avatarUrl =
                    "https://www.w3schools.com/howto/img_avatar.png";

                if (db) {
                    try {
                        const { getDoc, doc } =
                            await import("https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js");
                        const userDocRef = doc(db, "users", user.uid);
                        const userDoc = await getDoc(userDocRef);

                        if (userDoc.exists()) {
                            const userData = userDoc.data();
                            if (userData.avatarUrl)
                                avatarUrl = userData.avatarUrl;
                            if (userData.displayName)
                                displayName = userData.displayName;

                            if (
                                userData.language &&
                                typeof window.setLanguage === "function"
                            ) {
                                window.setLanguage(userData.language);
                            }
                        }
                    } catch (error) {
                        console.error(
                            "Error loading header profile image or language:",
                            error,
                        );
                    }
                }

                const userHeaderHTML = `
                    <div id="userProfileGroup" class="inline-block text-left">
                        <button id="profileMenuToggle" class="flex items-center gap-3 text-white rounded-sm text-sm font-medium transition cursor-pointer">
                            <img src="${avatarUrl}" alt="Profilbild" class="w-8 h-8 rounded-full border border-white/40 object-cover">
                            <span class="text-white font-medium text-sm inline">${displayName}</span>
                            <svg id="profileArrow" class="w-4 h-4 text-white transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path>
                            </svg>
                        </button>
                        
                        <div id="profileDropdown" class="hidden absolute left-0 right-0 top-full bg-red-600 shadow-md p-4 text-sm z-50 space-y-1 md:right-13 md:left-auto md:top-16 md:w-48 md:rounded-sm">
                            <div class="max-w-7xl mx-auto px-2 md:px-0 space-y-2">
                                <a data-key="header.account" href="account" class="w-full text-left text-white/80 hover:text-white/100 hover:bg-white/20 block rounded-sm px-4 py-2 uppercase">
                                    Edit Account
                                </a>
                                <a data-key="header.trips" href="profile" class="w-full text-left text-white/80 hover:text-white/100 hover:bg-white/20 block rounded-sm px-4 py-2 uppercase">
                                    My Trips
                                </a>
                                <hr class="border-white/50">
                                <button data-key="header.logout" id="logoutBtn" class="w-full text-left text-white/80 hover:text-white/100 hover:bg-white/20 block rounded-sm px-4 py-2 cursor-pointer uppercase">
                                    Logout
                                </button>
                            </div>
                        </div>
                    </div>
                `;

                if (!document.getElementById("userProfileGroup")) {
                    loginNavBtns.forEach((btn) => {
                        btn.outerHTML = userHeaderHTML;
                    });
                }

                const dropdown = document.getElementById("profileDropdown");
                const menuToggle = document.getElementById("profileMenuToggle");

                if (menuToggle && dropdown) {
                    menuToggle.replaceWith(menuToggle.cloneNode(true));
                    const newMenuToggle =
                        document.getElementById("profileMenuToggle");
                    const profileArrow =
                        document.getElementById("profileArrow");

                    newMenuToggle.addEventListener("click", (e) => {
                        e.stopPropagation();
                        e.preventDefault();
                        const isClosed = dropdown.classList.contains("hidden");

                        if (isClosed) {
                            dropdown.classList.remove("hidden");
                            if (profileArrow)
                                profileArrow.classList.add("rotate-180");

                            
                            const mobileMenu =
                                document.getElementById("mobileMenu");
                            if (
                                mobileMenu &&
                                !mobileMenu.classList.contains("hidden")
                            ) {
                                mobileMenu.classList.add("hidden");

                                
                                const mobileMenuToggle =
                                    document.getElementById("mobileMenuToggle");
                                const burgerIcon =
                                    mobileMenuToggle?.querySelector(
                                        ".burger-icon",
                                    );
                                const closeIcon =
                                    mobileMenuToggle?.querySelector(
                                        ".close-icon",
                                    );
                                if (burgerIcon && closeIcon) {
                                    burgerIcon.classList.remove("hidden");
                                    closeIcon.classList.add("hidden");
                                }
                            }
                        } else {
                            dropdown.classList.add("hidden");
                            if (profileArrow)
                                profileArrow.classList.remove("rotate-180");
                        }
                    });

                    document.addEventListener("click", (e) => {
                        if (!newMenuToggle.contains(e.target)) {
                            if (dropdown) dropdown.classList.add("hidden");
                            if (profileArrow)
                                profileArrow.classList.remove("rotate-180");
                        }
                    });
                }

                const logoutBtn = document.getElementById("logoutBtn");
                if (logoutBtn) {
                    logoutBtn.addEventListener("click", () => {
                        localStorage.setItem("selectedLanguage", "en");
                        logoutNutzer()
                            .then(() => {
                                window.location.reload();
                            })
                            .catch(() => {
                                window.location.reload();
                            });
                    });
                }
            } else {
                const profileGroup =
                    document.getElementById("userProfileGroup");
                if (profileGroup) {
                    profileGroup.outerHTML = `
                        <a data-key="nav.login" id="loginNavBtn" class="bg-white/40 hover:bg-white/60 text-white rounded-sm px-5 py-2.5 text-sm font-medium transition" href="#">
                            LOGIN
                        </a>
                    `;
                }
            }
        }
    }, 100);
});
