// State management
let state = {
  exchangeRate: 83,
  enabled: true,
  conversionCache: new Map()
};

console.log('Content script loaded');

// Get initial settings
chrome.storage.sync.get(["exchangeRate", "enabled"], (data) => {
  state.exchangeRate = data.exchangeRate || state.exchangeRate;
  state.enabled = data.enabled ?? state.enabled;
  
  if (state.enabled) {
    convertExistingPrices();
  }
});

// Listen for changes from the popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  switch (request.action) {
    case "updateExchangeRate":
      state.exchangeRate = request.exchangeRate;
      state.conversionCache.clear(); // Clear cache when rate changes
      if (state.enabled) {
        convertExistingPrices();
      }
      break;
      
    case "toggleEnabled":
      state.enabled = request.enabled;
      if (state.enabled) {
        convertExistingPrices();
      } else {
        revertPrices();
      }
      break;
  }
});



function convertExistingPrices() {
    // Expanded selector list to catch more price elements
    const targetElements = document.querySelectorAll(
        '.price, .product-price, .cost, ' +
        '[class*="price"], [class*="Price"], ' +
        '[class*="cost"], [class*="Cost"], ' +
        '[id*="price"], [id*="Price"]'
    );
    targetElements.forEach(element => processTextNodes(element));
}


function convertUSDToINR(element) {
    // Skip if already converted
    if (element.dataset.originalText && element.textContent.includes("₹")) return;

    const originalText = element.textContent;
    const cacheKey = `${originalText}-${state.exchangeRate}`;
    
    // Check cache first
    if (state.conversionCache.has(cacheKey)) {
        element.textContent = state.conversionCache.get(cacheKey);
        element.dataset.originalText = originalText;
        return;
    }

    const usdRegex = /\$\s*([\d,.]+)/g;
    const match = usdRegex.exec(originalText);
    
    if (match) {
        const usdAmount = parseFloat(match[1].replace(/,/g, ""));
        
        if (!isNaN(usdAmount)) {
            element.dataset.originalText = originalText;
            const inrAmount = usdAmount * state.exchangeRate;
            const newText = originalText.replace(
                usdRegex,
                `$& (₹${inrAmount.toFixed(2)})`
            );
            
            // Cache the conversion
            state.conversionCache.set(cacheKey, newText);
            element.textContent = newText;
        }
    }
}

function revertPrices(){
    const convertedElements = document.querySelectorAll('[data-original-text]');

    convertedElements.forEach(element => {
        element.textContent = element.dataset.originalText;
        delete element.dataset.originalText;
    });
}

function processTextNodes(node) {
  const usdRegex = /\$\s*([\d,.]+)/g;  // Improved regex

  for (const child of node.childNodes) {
    if (child.nodeType === Node.TEXT_NODE) {
      if (usdRegex.test(child.textContent)) {
        const newSpan = document.createElement("span");
        newSpan.innerHTML = child.textContent.replace(
          usdRegex,
          `<span class="usd-to-inr">$&</span>` // Use full match to keep the $ sign
        );
        child.parentNode.replaceChild(newSpan, child);

        const usdElements = newSpan.querySelectorAll(".usd-to-inr");
        usdElements.forEach((el) => convertUSDToINR(el));
      }
    } else if (child.nodeType === Node.ELEMENT_NODE) {
      processTextNodes(child); // Recursively process child elements
    }
  }
}


// Debounced Mutation Observer
let timeoutId;
const observer = new MutationObserver((mutations) => {
  clearTimeout(timeoutId);
  timeoutId = setTimeout(() => {
    mutations.forEach((mutation) => {
      mutation.addedNodes.forEach((node) => {
        if (node.nodeType === Node.ELEMENT_NODE) {
          processTextNodes(node);
        }
      });
    });
  }, 200); // Debounce delay
});


// Observe relevant elements.  You'll need to adapt these selectors:
const targetElements = document.querySelectorAll('.price, .product-price, .cost'); // Or other appropriate selectors

targetElements.forEach(element => {
    processTextNodes(element)
    observer.observe(element, { childList: true, subtree: true });
});



// Call initially to convert prices on page load if enabled
if (state.enabled) {
  convertExistingPrices();
}