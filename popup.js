
// Wait for DOM to be fully loaded
document.addEventListener('DOMContentLoaded', () => {
    // Load saved options with default values
    chrome.storage.sync.get({
        exchangeRate: 83.88,
        enabled: true
    }, (data) => {
        document.getElementById('exchangeRate').value = data.exchangeRate;
        document.getElementById('enabled').checked = data.enabled;
    });

    document.getElementById('save').addEventListener('click', () => {
        const newRate = parseFloat(document.getElementById('exchangeRate').value);
        const enabled = document.getElementById('enabled').checked;

        if (isNaN(newRate) || newRate <= 0) {
            alert('Please enter a valid exchange rate');
            return;
        }

        chrome.storage.sync.set({ exchangeRate: newRate, enabled: enabled }, () => {
            // Send messages to content script
            chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
                if (tabs[0]) {
                    chrome.tabs.sendMessage(tabs[0].id, {
                        action: "updateExchangeRate",
                        exchangeRate: newRate
                    });
                    chrome.tabs.sendMessage(tabs[0].id, {
                        action: "toggleEnabled",
                        enabled: enabled,
                    });
                }
            });
        });
    });
});