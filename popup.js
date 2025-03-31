
// Popup script for USD to INR Converter

document.addEventListener('DOMContentLoaded', async () => {
    const exchangeRateInput = document.getElementById('exchangeRate');
    const enabledToggle = document.getElementById('enabled');
    const saveButton = document.getElementById('save');
    const statusElement = document.getElementById('status');

    // Load saved settings
    chrome.storage.sync.get(['exchangeRate', 'enabled', 'lastUpdate'], (data) => {
        exchangeRateInput.value = data.exchangeRate || 83.88;
        enabledToggle.checked = data.enabled !== false;

        if (data.lastUpdate) {
            updateStatus(`Last updated: ${new Date(data.lastUpdate).toLocaleString()}`);
        }
    });

    // Get current rate from background script
    chrome.runtime.sendMessage({ action: 'getExchangeRate' }, (response) => {
        if (response && response.exchangeRate) {
            exchangeRateInput.value = response.exchangeRate;
            if (response.lastUpdate) {
                updateStatus(`Last updated: ${new Date(response.lastUpdate).toLocaleString()}`);
            }
        }
    });

    // Save settings
    saveButton.addEventListener('click', async () => {
        const newRate = parseFloat(exchangeRateInput.value);
        const enabled = enabledToggle.checked;

        if (isNaN(newRate) || newRate <= 0) {
            updateStatus('Please enter a valid exchange rate', true);
            return;
        }

        // Save to storage
        chrome.storage.sync.set({ 
            exchangeRate: newRate,
            enabled: enabled 
        }, () => {
            // Notify all tabs
            chrome.tabs.query({}, (tabs) => {
                tabs.forEach(tab => {
                    chrome.tabs.sendMessage(tab.id, {
                        action: 'updateExchangeRate',
                        exchangeRate: newRate
                    });
                    chrome.tabs.sendMessage(tab.id, {
                        action: 'toggleEnabled',
                        enabled: enabled
                    });
                });
            });

            updateStatus('Settings saved successfully');
            
            // Force an update check
            chrome.runtime.sendMessage({ action: 'forceUpdate' });
        });
    });

    // Helper function to update status
    function updateStatus(message, isError = false) {
        statusElement.textContent = message;
        statusElement.style.color = isError ? '#dc3545' : '#28a745';
        if (!isError) {
            setTimeout(() => {
                statusElement.style.color = '#666';
            }, 2000);
        }
    }
});