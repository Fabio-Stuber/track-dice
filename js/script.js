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

import { initTripView, handleDeepLinking } from "./firebase/ui/trip-ui.js";
import { auth } from "./firebase/firebase-init.js";


auth.onAuthStateChanged(async (user) => {
    if (user) {
        
        await initTripView(user.uid);

        
        
        await handleDeepLinking(user.uid);
        
    } else {
        
    }
});

if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => {
        navigator.serviceWorker
            .register("/sw.js")
            .then((reg) => console.log("ServiceWorker online", reg))
            .catch((err) => console.log("ServiceWorker offline", err));
    });
}

const fields = document.querySelectorAll(".code-field");
const hiddenInput = document.getElementById("joinTripCode");


function updateHiddenInput() {
    let fullCode = "";
    fields.forEach((field) => {
        fullCode += field.value;
    });

    hiddenInput.value = fullCode;

    
    hiddenInput.dispatchEvent(new Event("input", { bubbles: true }));
    hiddenInput.dispatchEvent(new Event("change", { bubbles: true }));
}

fields.forEach((field, index) => {
    
    field.addEventListener("paste", (e) => {
        e.preventDefault();
        const pastedData = (e.clipboardData || window.clipboardData)
            .getData("text")
            .toUpperCase()
            .trim();

        for (let i = 0; i < pastedData.length; i++) {
            if (index + i < fields.length) {
                fields[index + i].value = pastedData[i];
                fields[index + i].focus();
            }
        }
        updateHiddenInput(); 
    });

    
    field.addEventListener("input", (e) => {
        field.value = field.value.toUpperCase();

        if (field.value.length === 1 && index < fields.length - 1) {
            fields[index + 1].focus();
        }
        updateHiddenInput(); 
    });

    
    field.addEventListener("keydown", (e) => {
        if (e.key === "Backspace" && field.value.length === 0 && index > 0) {
            fields[index - 1].focus();
            updateHiddenInput(); 
        }
    });
});


document.getElementById('trip-invite-code').addEventListener('click', function() {
    const textToCopy = this.innerText;
    
    navigator.clipboard.writeText(textToCopy).then(() => {
        const originalText = this.innerText;
        this.innerText = 'Kopiert!';
        
        setTimeout(() => {
            this.innerText = originalText;
        }, 1500);
    }).catch(err => {
        console.error('Fehler beim Kopieren: ', err);
    });
});
