// background.js
let requestsMap = new Map();
const savedIds = [];
let currentTabId = null;

const urls = [
    "https://open.spotify.com/*",
    "https://episode-transcripts.spotifycdn.com/*",
    "https://spclient.wg.spotify.com/*",
];

function getEpisodeId(url) {
    if (!url.includes("spclient.wg.spotify.com/transcript-read-along")) {
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

chrome.webRequest.onBeforeSendHeaders.addListener(
    function (details) {
        const episodeId = getEpisodeId(details.url);
        if (episodeId != false || savedIds.includes(episodeId)) {
            requestsMap.set(details.requestId, {
                requestHeaders: details.requestHeaders,
                episodeId,
            });
        }
        return { requestHeaders: details.requestHeaders };
    },
    { urls },
    ["requestHeaders"]
);

chrome.webRequest.onCompleted.addListener(
    function (details) {
        const episodeId = getEpisodeId(details.url);
        if (
            episodeId == false ||
            savedIds.includes(episodeId) ||
            !requestsMap.has(details.requestId)
        ) {
            return;
        }
        console.log(details.url);
        if (details.responseHeaders) {
            const contentTypeHeader = details.responseHeaders.find(
                (header) => header.name.toLowerCase() === "content-type"
            );
            if (
                contentTypeHeader &&
                contentTypeHeader.value.includes("application/json")
            ) {
                const request = requestsMap.get(details.requestId);
                const requestHeaders = request.requestHeaders;
                const headers = new Headers();
                requestHeaders.forEach((header) => {
                    headers.append(header.name, header.value);
                });
                // Fetch the response body
                fetch(details.url, {
                    method: details.method,
                    headers: headers,
                })
                    .then((response) => response.json())
                    .then((data) => {
                        console.log("JSON Response:", data);

                        chrome.storage.local.set(
                            { [request.episodeId]: data },
                            () => {
                                console.log(
                                    "JSON response saved to local storage for url:",
                                    request.episodeId
                                );
                            }
                        );
                        savedIds.push(request.episodeId);
                        chrome.tabs.sendMessage(currentTabId, {message: "jsonSaved"});
                    })
                    .catch((error) => {
                        console.error("Error fetching JSON response:", error);
                    });
            }
        }
    },
    { urls },
    ["responseHeaders"]
);

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "saveToFile") {
        const { episodeId } = request.data;
        chrome.storage.local.get([episodeId], (result) => {
            if (result[episodeId]) {
                const jsonString = JSON.stringify(result[episodeId], null, 2);

                const dataUrl =
                    "data:application/json;charset=utf-8," +
                    encodeURIComponent(jsonString);

                chrome.downloads.download(
                    {
                        url: dataUrl,
                        filename: episodeId + ".json",
                        saveAs: true,
                    },
                    (downloadId) => {
                        if (chrome.runtime.lastError) {
                            console.error(
                                "Error downloading file:",
                                chrome.runtime.lastError
                            );
                        } else {
                            console.log(
                                "Download started with ID:",
                                downloadId
                            );
                        }
                    }
                );
            }
        });
    }
});

chrome.tabs.onUpdated.addListener(function (tabId, changeInfo, tab) {
    currentTabId = tabId;
    chrome.tabs.sendMessage(tabId, {
        message: "urlChanged",
        url: changeInfo.url,
    });
});
