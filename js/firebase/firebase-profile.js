import { auth, db } from "./firebase-init.js";
import {
    onAuthStateChanged,
    updateProfile,
    deleteUser,
    updatePassword,
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import {
    doc,
    getDoc,
    updateDoc,
    deleteDoc,
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

window.updateUserProfile = function (
    firstName,
    lastName,
    avatarUrl,
    language,
    sbbTarif,
    newPassword,
) {
    const user = auth.currentUser;

    if (user) {
        const displayName = `${firstName} ${lastName}`.trim();

        updateProfile(user, {
            displayName: displayName,
        })
            .then(async () => {
                if (db) {
                    const userDocRef = doc(db, "users", user.uid);
                    await updateDoc(userDocRef, {
                        firstName: firstName,
                        lastName: lastName,
                        displayName: displayName,
                        avatarUrl: avatarUrl,
                        language: language,
                        sbbTarif: sbbTarif,
                    });
                }

                if (newPassword && newPassword.trim() !== "") {
                    try {
                        await updatePassword(user, newPassword);
                        alert("Profil und Passwort erfolgreich aktualisiert!");
                    } catch (passError) {
                        if (passError.code === "auth/requires-recent-login") {
                            alert(
                                "Aus Sicherheitsgründen müssen Sie sich neu anmelden, um das Passwort zu ändern.",
                            );
                        } else {
                            alert(
                                "Fehler beim Passwort ändern: " +
                                    passError.message,
                            );
                        }
                    }
                } else {
                    alert("Profil erfolgreich aktualisiert!");
                }

                window.location.reload();
            })
            .catch((error) => {
                alert("Fehler beim Aktualisieren: " + error.message);
            });
    } else {
        alert("Kein Nutzer angemeldet!");
    }
};

window.initProfilePage = function () {
    // Liste aller Seiten (Pathnames), die man OHNE Login anschauen darf
    const publicPages = [
        "/",
        "/index",
        "/imprint",
        "/404",
        "/terms",
        "/privacy",
        "/unsubscribe",
    ];

    onAuthStateChanged(auth, async (user) => {
        // Elemente der Profilseite suchen
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
                            document.getElementById("profileLanguage").value =
                                userData.language;
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
            }
        } else {
            const localLang = localStorage.getItem("selectedLanguage") || "en";
            if (typeof window.setLanguage === "function") {
                window.setLanguage(localLang);
            }

            // Aktuellen Pfad auslesen (z.B. "/impressum.html")
            const currentPath = window.location.pathname;

            // Pruefen, ob der aktuelle Pfad in der erlaubten Liste ist
            const isPublicPage = publicPages.includes(currentPath);

            // Wenn die Seite NICHT erlaubt ist, schicke den Gast zur Startseite
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

window.autoUpdateLanguage = async function (selectedLanguage) {
    const user = auth.currentUser;

    if (user && db) {
        try {
            const userDocRef = doc(db, "users", user.uid);
            await updateDoc(userDocRef, {
                language: selectedLanguage,
            });
        } catch (error) {
            console.error(
                "Fehler beim Speichern der Sprache in Firebase:",
                error,
            );
        }
    } else {
        localStorage.setItem("selectedLanguage", selectedLanguage);
    }

    if (typeof window.setLanguage === "function") {
        window.setLanguage(selectedLanguage);
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
});
