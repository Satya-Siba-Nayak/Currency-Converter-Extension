let exchangeRate = null;
let enabled = true; // Conversion enabled by default

// Get initial settings
chrome.storage.sync.get(["exchangeRate", "enabled"], (data) => {
  exchangeRate = data.exchangeRate;
  enabled = data.enabled;
  if (enabled) {
      convertExistingPrices();
  }
});

// Listen for changes from the popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "updateExchangeRate") {
    exchangeRate = request.exchangeRate;
    if (enabled) { // Only convert if enabled
        convertExistingPrices();
    }
  } else if (request.action === "toggleEnabled") {
    enabled = request.enabled;
    if (enabled) {
        convertExistingPrices();
    } else {
        revertPrices(); // Revert to original prices when disabled
    }
  }
});



function convertExistingPrices() {
    const targetElements = document.querySelectorAll('.price, .product-price, .cost'); // Example selectors
    targetElements.forEach(element => processTextNodes(element));
}


function convertUSDToINR(element) {
    if (element.dataset.originalText && element.textContent.includes("₹")) return; // Check for converted price 

    const usdRegex = /\$\s*([\d,.]+)/g;
    const usdAmount = parseFloat(element.textContent.replace(/[^0-9.-]+/g, ""));

    if (!isNaN(usdAmount)) {

        element.dataset.originalText = element.textContent; // Store original price before conversion
        const inrAmount = usdAmount * exchangeRate;
        element.textContent = element.textContent.replace(usdRegex, `$& (₹${inrAmount.toFixed(2)})`);

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
          `<span class="usd-to-inr">$1</span>` // Use captured group
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
if (enabled) {
  convertExistingPrices();
}