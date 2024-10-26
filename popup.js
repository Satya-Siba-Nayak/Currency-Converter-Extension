
document.getElementById('save').addEventListener('click', () => {
    const newRate = parseFloat(document.getElementById('exchangeRate').value);
    const enabled = document.getElementById('enabled').checked;
  
    chrome.storage.sync.set({ exchangeRate: newRate, enabled: enabled }, () => {
      // Send message to content script to update conversion
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        chrome.tabs.sendMessage(tabs[0].id, {
          action: "updateExchangeRate",
          exchangeRate: newRate
        });
        chrome.tabs.sendMessage(tabs[0].id, {
          action: "toggleEnabled",
          enabled: enabled,
        });
      });
    });
  });
  
  
  // Load saved options
  chrome.storage.sync.get(['exchangeRate','enabled'], (data) => {
    document.getElementById('exchangeRate').value = data.exchangeRate;
    document.getElementById('enabled').checked = data.enabled;
  
  
  });