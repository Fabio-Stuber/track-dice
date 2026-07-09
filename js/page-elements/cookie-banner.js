fetch("page-elements/cookie-banner.html")
    .then((response) => response.text())
    .then((data) => {
        const cookieContainer = document.getElementById("cookieBanner");
        cookieContainer.innerHTML = data;
        cookieContainer.classList.add(
            "fixed",
            "bottom-4",
            "left-4",
            "right-4",
            "md:left-auto",
            "md:max-w-md",
            "bg-gray-100",
            "dark:bg-gray-900",
            "border",
            "border-gray-200",
            "dark:border-gray-800",
            "p-6",
            "rounded-lg",
            "shadow-xl",
            "z-50",
            "transition-all",
            "duration-300",
            "transform",
            "translate-y-0",
        );
        initCookieScripts();
    });

function initCookieScripts() {
    const banner = document.getElementById("cookieBanner");
    const acceptBtn = document.getElementById("acceptCookies");
    const declineBtn = document.getElementById("declineCookies");

    if (banner && acceptBtn && declineBtn) {
        if (localStorage.getItem("cookieBannerDecision")) {
            banner.classList.add("hidden");
        } else {
            banner.classList.remove("hidden");
        }

        acceptBtn.addEventListener("click", function () {
            localStorage.setItem("cookieBannerDecision", "accepted");
            banner.classList.add("hidden");
            loadGoogleAnalytics();
        });

        if (localStorage.getItem("cookieBannerDecision") === "accepted") {
            loadGoogleAnalytics();
        }

        function loadGoogleAnalytics() {
            const gaId = "G-8D4W3TJ3YZ";
            const script1 = document.createElement("script");
            script1.async = true;
            script1.src = `https://www.googletagmanager.com/gtag/js?id=${gaId}`;
            document.head.appendChild(script1);

            const script2 = document.createElement("script");
            script2.innerHTML = `
                window.dataLayer = window.dataLayer || [];
                function gtag(){dataLayer.push(arguments);}
                gtag('js', new Date());
                gtag('config', '${gaId}', { 'anonymize_ip': true });
            `;
            document.head.appendChild(script2);
        }

        declineBtn.addEventListener("click", function () {
            localStorage.setItem("cookieBannerDecision", "declined");
            banner.classList.add("hidden");
        });
    }
}
