function setupModalToggles() {
    document.addEventListener("click", (e) => {
        if (e.target.closest("#loginNavBtn")) {
            e.preventDefault();
            toggleModal("loginModal", true);
            toggleModal("signupModal", false);
            toggleModal("forgotModal", false);
            toggleModal("resetPasswordModal", false);
        }
        if (e.target.closest("#signupNavBtn")) {
            e.preventDefault();
            toggleModal("signupModal", true);
            toggleModal("loginModal", false);
            toggleModal("forgotModal", false);
            toggleModal("resetPasswordModal", false);
        }
        if (e.target.closest("#googleLoginBtn")) {
            e.preventDefault();
            e.stopPropagation();

            const auth = window.auth;
            const googleProvider = window.googleProvider;

            import("https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js")
                .then(({ signInWithPopup }) => {
                    if (auth && googleProvider) {
                        return signInWithPopup(auth, googleProvider);
                    } else {
                        throw new Error("Firebase wurde noch nicht geladen.");
                    }
                })
                .then(() => {
                    window.location.reload();
                })
                .catch((error) => {
                    if (error.code !== "auth/popup-closed-by-user") {
                        alert("Google login failed: " + error.message);
                    }
                });
        }
    });

    document
        .getElementById("closeLoginBtn")
        ?.addEventListener("click", () => toggleModal("loginModal", false));
    document
        .getElementById("closeSignupBtn")
        ?.addEventListener("click", () => toggleModal("signupModal", false));
    document
        .getElementById("closeForgotBtn")
        ?.addEventListener("click", () => toggleModal("forgotModal", false));
    document
        .getElementById("closeResetPasswordBtn")
        ?.addEventListener("click", () =>
            toggleModal("resetPasswordModal", false),
        );

    document.getElementById("switchToSignup")?.addEventListener("click", () => {
        toggleModal("loginModal", false);
        toggleModal("signupModal", true);
    });

    document.getElementById("switchToLogin")?.addEventListener("click", () => {
        toggleModal("signupModal", false);
        toggleModal("loginModal", true);
    });

    document.getElementById("switchToForgot")?.addEventListener("click", () => {
        toggleModal("loginModal", false);
        toggleModal("forgotModal", true);
    });

    document
        .getElementById("switchToLoginFromForgot")
        ?.addEventListener("click", () => {
            toggleModal("forgotModal", false);
            toggleModal("loginModal", true);
        });

    window.addEventListener("click", (e) => {
        const loginModal = document.getElementById("loginModal");
        const signupModal = document.getElementById("signupModal");
        const forgotModal = document.getElementById("forgotModal");
        const resetPasswordModal =
            document.getElementById("resetPasswordModal");

        if (e.target === loginModal) toggleModal("loginModal", false);
        if (e.target === signupModal) toggleModal("signupModal", false);
        if (e.target === forgotModal) toggleModal("forgotModal", false);
        if (e.target === resetPasswordModal)
            toggleModal("resetPasswordModal", false);
    });
}

function loadAuthModals() {
    const loginContainer = document.getElementById("loginModalContainer");
    const signupContainer = document.getElementById("signupModalContainer");
    const forgotContainer = document.getElementById("forgotModalContainer");
    const resetContainer = document.getElementById(
        "resetPasswordModalContainer",
    );

    if (
        loginContainer &&
        signupContainer &&
        forgotContainer &&
        resetContainer
    ) {
        Promise.all([
            fetch("modals/login.html").then((r) => r.text()),
            fetch("modals/signup.html").then((r) => r.text()),
            fetch("modals/forgot.html").then((r) => r.text()),
            fetch("modals/reset-password.html").then((r) => r.text()), //
        ]).then(([loginHtml, signupHtml, forgotHtml, resetHtml]) => {
            loginContainer.innerHTML = loginHtml;
            signupContainer.innerHTML = signupHtml;
            forgotContainer.innerHTML = forgotHtml;
            resetContainer.innerHTML = resetHtml;

            setupModalToggles();

            languageSwitcher();

            document.dispatchEvent(new Event("modalsLoaded"));
        });
    }
}

function toggleModal(modalId, show) {
    const modal = document.getElementById(modalId);
    if (modal) {
        if (show) {
            modal.classList.remove("hidden");
        } else {
            modal.classList.add("hidden");
        }
    }
}

function checkUrlHash() {
    const hash = window.location.hash;

    if (hash === "#login") {
        toggleModal("loginModal", true);
        toggleModal("signupModal", false);
    } else if (hash === "#signup") {
        toggleModal("signupModal", true);
        toggleModal("loginModal", false);
    }
}

window.addEventListener("DOMContentLoaded", checkUrlHash);
window.addEventListener("hashchange", checkUrlHash);
