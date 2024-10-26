
chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.sync.set({ exchangeRate: 83.88 }); // Initial rate
});

// Add logic later for fetching updated rates periodically