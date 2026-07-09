fetch("page-elements/footer.html")
    .then((response) => response.text())
    .then((data) => {
        const footerContainer = document.getElementById("footer");
        if (footerContainer) {
            footerContainer.innerHTML = data;

            setTimeout(() => {
                initFooterScripts();
            }, 1000);
        }
    });

function initFooterScripts() {
    const yearSpan = document.getElementById("copyrightYear");
    if (yearSpan) {
        yearSpan.textContent = new Date().getFullYear();
    }
}
