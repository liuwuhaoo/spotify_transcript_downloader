// content.js
function getEpisodeIdFromPageURL() {
    const url = window.location.href;
    if (!url.includes("open.spotify.com/episode")) {
        return false;
    }
    try {
        const pathname = new URL(url).pathname;
        const urlSegments = pathname.split("/");
        return urlSegments[urlSegments.length - 1];
    } catch (error) {
        console.error("Error parsing episode ID from URL:", error);
        return false;
    }
}

const button = document.createElement("button");
button.textContent = "Download Transcript";
button.style.position = "fixed";
button.style.bottom = "10px";
button.style.right = "10px";
button.style.zIndex = 1000;
button.style.visibility = "hidden";

button.addEventListener("click", () => {
    const episodeId = getEpisodeIdFromPageURL();
    if (episodeId) {
        chrome.runtime.sendMessage({
            action: "saveToFile",
            data: {episodeId },
        });
    }
});

document.body.appendChild(button);

function genButton() {
    const episodeId = getEpisodeIdFromPageURL();
    if (!episodeId) {
        button.style.visibility = "hidden";
        return;
    }
    chrome.storage.local.get([episodeId], (result) => {
        button.style.visibility = result[episodeId]? "visible" : "hidden";
    });
}

genButton();

chrome.runtime.onMessage.addListener(function (request, sender, sendResponse) {
    if ([ "jsonSaved", "urlChanged" ].includes(request.message)) {
        genButton();
    }
});