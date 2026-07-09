import { auth, db } from "../firebase-init.js";
import { speichereSpracheInFirebase } from "../services/profile-services.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";

window.initProfilePage = function () {
    const publicPages = [
        "/",
        "/index",
        "/imprint",
        "/404",
        "/terms",
        "/privacy",
        "/unsubscribe",
        "/shared",
    ];

    onAuthStateChanged(auth, async (user) => {
        const profileEmailInput = document.getElementById("profileEmail");

        if (user) {
            if (profileEmailInput) {
                document.getElementById("profileEmail").value =
                    user.email || "";
                document.getElementById("profileHeaderEmail").textContent =
                    user.email || "";
                document.getElementById("profileDisplayName").value =
                    user.displayName || "";
                document.getElementById("profileHeaderName").textContent =
                    user.displayName || "User";
                document.getElementById("profilePreview").src =
                    "https://www.w3schools.com/howto/img_avatar.png";
            }

            if (db) {
                try {
                    const { getDoc, doc } =
                        await import("https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js");
                    const userDocRef = doc(db, "users", user.uid);
                    const userDoc = await getDoc(userDocRef);

                    if (userDoc.exists()) {
                        const userData = userDoc.data();

                        if (profileEmailInput) {
                            document.getElementById("profileFirstName").value =
                                userData.firstName || "";
                            document.getElementById("profileLastName").value =
                                userData.lastName || "";
                            document.getElementById("userRole").textContent =
                                userData.role || "Member";
                            document.getElementById(
                                "userSubscription",
                            ).textContent = userData.subscription || "Free";
                        }

                        if (userData.language) {
                            if (profileEmailInput) {
                                document.getElementById(
                                    "profileLanguage",
                                ).value = userData.language;
                            }
                            if (typeof window.setLanguage === "function") {
                                window.setLanguage(userData.language);
                            }
                        }

                        if (userData.sbbTarif && profileEmailInput) {
                            document.getElementById("profileSbbTarif").value =
                                userData.sbbTarif;
                        }

                        if (userData.avatarUrl && profileEmailInput) {
                            document.getElementById("profilePreview").src =
                                userData.avatarUrl;
                        }
                    }
                } catch (error) {
                    console.error("Error: ", error);
                }
            }
        } else {
            const localLang = localStorage.getItem("selectedLanguage") || "en";
            if (typeof window.setLanguage === "function") {
                window.setLanguage(localLang);
            }

            const currentPath = window.location.pathname;
            const isPublicPage = publicPages.includes(currentPath);

            if (!isPublicPage) {
                window.location.href = "/";
            }
        }
    });
};

window.handleProfileSubmit = function (event) {
    event.preventDefault();

    const firstName = document.getElementById("profileFirstName").value;
    const lastName = document.getElementById("profileLastName").value;
    const avatarUrl = document.getElementById("profilePreview").src;
    const language = document.getElementById("profileLanguage").value;
    const sbbTarif = document.getElementById("profileSbbTarif").value;
    const newPassword = document.getElementById("profileNewPassword").value;

    if (typeof window.updateUserProfile === "function") {
        window.updateUserProfile(
            firstName,
            lastName,
            avatarUrl,
            language,
            sbbTarif,
            newPassword,
        );
    }
};

window.togglePasswordVisibility = function () {
    const passwordInput = document.getElementById("profileNewPassword");
    const toggleText = document.getElementById("passwordToggleText");

    if (passwordInput.type === "password") {
        passwordInput.type = "text";
        toggleText.textContent = "Hide";
    } else {
        passwordInput.type = "password";
        toggleText.textContent = "Show";
    }
};

window.addEventListener("DOMContentLoaded", () => {
    if (typeof window.initProfilePage === "function") {
        window.initProfilePage();
    }

    const form = document.getElementById("profileForm");
    if (form && typeof window.handleProfileSubmit === "function") {
        form.addEventListener("submit", window.handleProfileSubmit);
    }

    const avatarUpload = document.getElementById("avatarUpload");
    const profilePreview = document.getElementById("profilePreview");

    if (avatarUpload && profilePreview) {
        avatarUpload.addEventListener("change", function (event) {
            const file = event.target.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = function (e) {
                    profilePreview.src = e.target.result;
                };
                reader.readAsDataURL(file);
            }
        });
    }

    const languageSelect = document.getElementById("languageSelect");
    if (languageSelect) {
        languageSelect.addEventListener("change", async (e) => {
            if (typeof speichereSpracheInFirebase === "function") {
                await speichereSpracheInFirebase(e.target.value);
            }
        });
    }
});
