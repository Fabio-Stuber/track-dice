import { auth, db } from "../firebase-init.js";
import {
    updateProfile,
    updatePassword,
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import {
    doc,
    updateDoc,
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

        updateProfile(user, { displayName: displayName })
            .then(async () => {
                if (db) {
                    const { doc, setDoc } =
                        await import("https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js");
                    const userDocRef = doc(db, "users", user.uid);

                    await setDoc(
                        userDocRef,
                        {
                            firstName: firstName,
                            lastName: lastName,
                            displayName: displayName,
                            avatarUrl: avatarUrl,
                            language: language,
                            sbbTarif: sbbTarif,
                        },
                        { merge: true },
                    );
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

export async function speichereSpracheInFirebase(selectedLanguage) {
    const user = auth.currentUser;
    if (user && db) {
        try {
            const { doc, updateDoc } =
                await import("https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js");
            const userDocRef = doc(db, "users", user.uid);
            await updateDoc(userDocRef, { language: selectedLanguage });
        } catch (error) {
            console.error("Fehler beim Speichern der Sprache:", error);
        }
    } else {
        localStorage.setItem("selectedLanguage", selectedLanguage);
    }

    if (typeof window.setLanguage === "function") {
        window.setLanguage(selectedLanguage);
    }
}
