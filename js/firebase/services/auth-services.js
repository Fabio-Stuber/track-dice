import { auth, db } from "../firebase-init.js";
import {
    signInWithEmailAndPassword,
    createUserWithEmailAndPassword,
    signOut,
    updateProfile,
    sendPasswordResetEmail,
    confirmPasswordReset,
    getAuth,
    onAuthStateChanged,
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import {
    doc,
    setDoc,
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

export function loginNutzer(email, password) {
    return signInWithEmailAndPassword(auth, email, password);
}

export async function registriereNutzer(firstName, lastName, email, password) {
    const userCredential = await createUserWithEmailAndPassword(
        auth,
        email,
        password,
    );
    const registeredUser = userCredential.user;
    const displayName = `${firstName} ${lastName}`.trim();

    await updateProfile(registeredUser, { displayName: displayName });

    if (db) {
        await setDoc(doc(db, "users", registeredUser.uid), {
            firstName: firstName,
            lastName: lastName,
            displayName: displayName,
            email: email,
            role: "Member",
            subscription: "Free",
            avatarUrl: "https://www.w3schools.com/howto/img_avatar.png",
            language: "en",
            sbbTarif: "none",
        });
    }
    return registeredUser;
}

export function sendePasswortLink(email) {
    return sendPasswordResetEmail(auth, email);
}

export function speichereNeuesPasswort(oobCode, newPassword) {
    return confirmPasswordReset(auth, oobCode, newPassword);
}

export function logoutNutzer() {
    return signOut(auth);
}

export function getCurrentUser() {
    const auth = getAuth();
    return auth.currentUser;
}
