
// Initialize settings when extension is installed or updated
chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.sync.set({
    exchangeRate: 83.88,
    enabled: true,
    lastUpdated: new Date().getTime(),
    lastAPICall: 0,
    retryCount: 0
  });
});

// Rate limit configuration
const MIN_API_INTERVAL = 5 * 60 * 1000; // 5 minutes
const MAX_RETRIES = 3;
const RETRY_DELAY = 30 * 1000; // 30 seconds

// Update exchange rate with rate limiting and retry logic
async function updateExchangeRate() {
  try {
    // Get current state
    const state = await chrome.storage.sync.get([
      'lastAPICall',
      'retryCount',
      'exchangeRate'
    ]);

    const now = new Date().getTime();
    const timeSinceLastCall = now - (state.lastAPICall || 0);

    // Check rate limit
    if (timeSinceLastCall < MIN_API_INTERVAL) {
      console.log('Rate limit: Too soon to update exchange rate');
      return;
    }

    // Update last API call time
    await chrome.storage.sync.set({ lastAPICall: now });

    const response = await fetch('https://api.exchangerate-api.com/v4/latest/USD');
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    const newRate = data.rates.INR;
    
    if (!newRate) {
      throw new Error('Invalid exchange rate data');
    }

    // Reset retry count on success
    await chrome.storage.sync.set({
      exchangeRate: newRate,
      lastUpdated: now,
      retryCount: 0
    });
    
    // Notify all tabs of the update
    const tabs = await chrome.tabs.query({});
    tabs.forEach(tab => {
      chrome.tabs.sendMessage(tab.id, {
        action: "updateExchangeRate",
        exchangeRate: newRate
      }).catch(err => console.log(`Failed to update tab ${tab.id}:`, err));
    });

  } catch (error) {
    console.error('Failed to update exchange rate:', error);
    
    // Get current retry count
    const { retryCount } = await chrome.storage.sync.get(['retryCount']);
    
    if (retryCount < MAX_RETRIES) {
      // Increment retry count
      await chrome.storage.sync.set({ retryCount: retryCount + 1 });
      
      // Schedule retry
      setTimeout(updateExchangeRate, RETRY_DELAY);
      console.log(`Scheduling retry ${retryCount + 1}/${MAX_RETRIES}`);
    } else {
      // Reset retry count after max retries
      await chrome.storage.sync.set({ retryCount: 0 });
      console.error('Max retries reached. Will try again on next scheduled update.');
    }
  }
}

// Check and update exchange rate every 6 hours
setInterval(updateExchangeRate, 6 * 60 * 60 * 1000);

// Initial update when browser starts
updateExchangeRate();