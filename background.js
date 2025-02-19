
// Initialize settings when extension is installed or updated
chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.sync.set({
    exchangeRate: 83.88,
    enabled: true,
    lastUpdated: new Date().getTime()
  });
});

// Update exchange rate periodically (every 6 hours)
async function updateExchangeRate() {
  try {
    const response = await fetch('https://api.exchangerate-api.com/v4/latest/USD');
    const data = await response.json();
    const newRate = data.rates.INR;
    
    if (newRate) {
      chrome.storage.sync.set({
        exchangeRate: newRate,
        lastUpdated: new Date().getTime()
      });
      
      // Notify content script of the update
      chrome.tabs.query({active: true}, function(tabs) {
        tabs.forEach(tab => {
          chrome.tabs.sendMessage(tab.id, {
            action: "updateExchangeRate",
            exchangeRate: newRate
          });
        });
      });
    }
  } catch (error) {
    console.error('Failed to update exchange rate:', error);
  }
}

// Check and update exchange rate every 6 hours
setInterval(updateExchangeRate, 6 * 60 * 60 * 1000);

// Initial update when browser starts
updateExchangeRate();