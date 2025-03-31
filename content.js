// State management with improved caching
let state = {
  exchangeRate: 83,
  enabled: true,
  conversionCache: new Map(),
  processedNodes: new WeakSet()
};

console.log('USD to INR Converter: Content script loaded');

// Initialize settings from storage
chrome.storage.sync.get(['exchangeRate', 'enabled'], (data) => {
  state.exchangeRate = data.exchangeRate || state.exchangeRate;
  state.enabled = data.enabled ?? state.enabled;
  
  if (state.enabled) {
    initializePriceConversion();
  }
});

// Listen for settings updates
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  switch (request.action) {
    case 'updateExchangeRate':
      state.exchangeRate = request.exchangeRate;
      state.conversionCache.clear();
      if (state.enabled) {
        initializePriceConversion();
      }
      break;
      
    case 'toggleEnabled':
      state.enabled = request.enabled;
      if (state.enabled) {
        initializePriceConversion();
      } else {
        revertConversions();
      }
      break;
  }
});

// Enhanced USD price detection patterns
const USD_PATTERNS = [
  /\$\s*([\d,]+(?:\.\d{2})?)/,  // $XX.XX or $XX
  /USD\s*([\d,]+(?:\.\d{2})?)/,  // USD XX.XX
  /([\d,]+(?:\.\d{2})?)\s*USD/,  // XX.XX USD
  /US\$\s*([\d,]+(?:\.\d{2})?)/  // US$XX.XX
];

// Initialize price conversion
function initializePriceConversion() {
  const priceObserver = new MutationObserver(handleDOMChanges);
  
  // Start observing the entire document for changes
  priceObserver.observe(document.body, {
    childList: true,
    subtree: true,
    characterData: true
  });
  
  // Process existing prices
  processNode(document.body);
}

// Handle DOM changes
function handleDOMChanges(mutations) {
  mutations.forEach(mutation => {
    if (mutation.type === 'characterData') {
      processTextNode(mutation.target);
    } else if (mutation.type === 'childList') {
      mutation.addedNodes.forEach(node => {
        if (node.nodeType === Node.ELEMENT_NODE || node.nodeType === Node.TEXT_NODE) {
          processNode(node);
        }
      });
    }
  });
}

// Process a DOM node and its children
function processNode(node) {
  if (node.nodeType === Node.TEXT_NODE) {
    processTextNode(node);
  } else if (node.nodeType === Node.ELEMENT_NODE) {
    // Skip already processed nodes and script/style elements
    if (state.processedNodes.has(node) || 
        node.tagName === 'SCRIPT' || 
        node.tagName === 'STYLE' || 
        node.tagName === 'NOSCRIPT') {
      return;
    }

    // Process child nodes
    node.childNodes.forEach(child => processNode(child));
    state.processedNodes.add(node);
  }
}

// Process a text node for price conversion
function processTextNode(node) {
  if (!node || !node.textContent || state.processedNodes.has(node)) {
    return;
  }

  const text = node.textContent;
  const cacheKey = `${text}-${state.exchangeRate}`;

  // Check cache first
  if (state.conversionCache.has(cacheKey)) {
    if (node.parentNode) {
      const span = document.createElement('span');
      span.innerHTML = state.conversionCache.get(cacheKey);
      node.parentNode.replaceChild(span, node);
      state.processedNodes.add(span);
    }
    return;
  }

  let converted = false;
  let convertedText = text;

  // Try each USD pattern
  for (const pattern of USD_PATTERNS) {
    convertedText = convertedText.replace(pattern, (match, amount) => {
      const usdAmount = parseFloat(amount.replace(/,/g, ''));
      if (!isNaN(usdAmount)) {
        converted = true;
        const inrAmount = (usdAmount * state.exchangeRate).toFixed(2);
        return `₹${inrAmount}`;
      }
      return match;
    });
  }

  if (converted) {
    // Cache the conversion
    state.conversionCache.set(cacheKey, convertedText);

    // Replace the text node with converted content
    if (node.parentNode) {
      const span = document.createElement('span');
      span.innerHTML = convertedText;
      span.dataset.originalText = text;
      node.parentNode.replaceChild(span, node);
      state.processedNodes.add(span);
    }
  }
}

// Revert all conversions
function revertConversions() {
  const convertedElements = document.querySelectorAll('[data-original-text]');
  convertedElements.forEach(element => {
    const textNode = document.createTextNode(element.dataset.originalText);
    element.parentNode.replaceChild(textNode, element);
    state.processedNodes.delete(element);
  });
  
  // Clear the cache and processed nodes
  state.conversionCache.clear();
  state.processedNodes = new WeakSet();
}

// Initialize conversion if enabled
if (state.enabled) {
  initializePriceConversion();
}