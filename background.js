
// Background script for USD to INR Converter

// State management
let state = {
  exchangeRate: 83.88,
  lastUpdate: null,
  updateInterval: 3600000 // 1 hour in milliseconds
};

// Initialize state from storage
chrome.storage.sync.get(['exchangeRate', 'lastUpdate'], (data) => {
  if (data.exchangeRate) {
    state.exchangeRate = data.exchangeRate;
  }
  if (data.lastUpdate) {
    state.lastUpdate = data.lastUpdate;
  }
  
  // Update exchange rate if needed
  checkAndUpdateRate();
});

// Function to check and update exchange rate
async function checkAndUpdateRate() {
  const now = Date.now();
  if (!state.lastUpdate || (now - state.lastUpdate > state.updateInterval)) {
    try {
      const response = await fetch('https://cdn.jsdelivr.net/gh/fawazahmed0/currency-api@1/latest/currencies/usd/inr.json');
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const data = await response.json();
      
      if (data && data.inr) {
        state.exchangeRate = data.inr;
        state.lastUpdate = now;
        
        // Save to storage
        chrome.storage.sync.set({
          exchangeRate: state.exchangeRate,
          lastUpdate: state.lastUpdate
        });
        
        // Notify all tabs
        chrome.tabs.query({}, (tabs) => {
          tabs.forEach(tab => {
            chrome.tabs.sendMessage(tab.id, {
              action: 'updateExchangeRate',
              exchangeRate: state.exchangeRate
            }).catch(() => {});
          });
        });
      }
    } catch (error) {
      console.error('Failed to update exchange rate:', error);
    }
  }
}

// Set up periodic rate checks
setInterval(checkAndUpdateRate, 300000); // Check every 5 minutes

// Listen for messages from popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'getExchangeRate') {
    sendResponse({
      exchangeRate: state.exchangeRate,
      lastUpdate: state.lastUpdate
    });
  } else if (request.action === 'forceUpdate') {
    checkAndUpdateRate();
    sendResponse({ status: 'updating' });
  }
  return true;
});