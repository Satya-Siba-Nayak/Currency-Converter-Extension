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

// Amazon specific price classes
const AMAZON_PRICE_CLASSES = [
  'a-price-whole',
  'a-price',
  'a-offscreen',
  'a-price-fraction',
  'p13n-sc-price'
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

    // Check if the node has any of the Amazon price classes
    if (node.classList) {
      for (const className of AMAZON_PRICE_CLASSES) {
        if (node.classList.contains(className)) {
          processTextNode(node.firstChild);
          break;
        }
      }
    }

    // Process child nodes
    node.childNodes.forEach(child => processNode(child));
    state.processedNodes.add(node);
  }
}

// Process a text node for price conversion
function processTextNode(node) {
  // Skip if node is invalid, empty, or already processed
  if (!node || !node.textContent || state.processedNodes.has(node)) {
    return;
  }

  const parentElement = node.parentNode;
  // Skip if parent element is already processed
  if (parentElement && state.processedNodes.has(parentElement)) {
    return;
  }

  // Mark this node as processed immediately to prevent duplicate processing
  state.processedNodes.add(node);
  
  // Check if this is an Amazon price element
  const isAmazonPrice = parentElement && parentElement.classList && 
    AMAZON_PRICE_CLASSES.some(className => parentElement.classList.contains(className));

  // Get the text content
  const text = node.textContent.trim();
  if (!text) return;
  
  // Special handling for Amazon price components
  if (isAmazonPrice) {
    const numericValue = parseFloat(text.replace(/[^0-9.]/g, ''));
    if (isNaN(numericValue)) return;

    const inrAmount = (numericValue * state.exchangeRate).toFixed(2);
    const [whole, decimal] = inrAmount.split('.');

    let convertedText = text;
    if (parentElement.classList.contains('a-price-whole')) {
      convertedText = `₹${whole}`;
    } else if (parentElement.classList.contains('a-price-fraction')) {
      convertedText = decimal;
    } else {
      convertedText = `₹${inrAmount}`;
    }

    const span = document.createElement('span');
    span.innerHTML = convertedText;
    span.dataset.originalText = text;
    span.style.cssText = window.getComputedStyle(parentElement).cssText;
    node.parentNode.replaceChild(span, node);
    state.processedNodes.add(span);
    state.processedNodes.add(parentElement);
    return;
  }

  // For non-Amazon price elements, check cache first
  const cacheKey = `${text}-${state.exchangeRate}`;
  if (state.conversionCache.has(cacheKey)) {
    if (node.parentNode) {
      const span = document.createElement('span');
      span.innerHTML = state.conversionCache.get(cacheKey);
      span.style.cssText = window.getComputedStyle(node.parentNode).cssText;
      node.parentNode.replaceChild(span, node);
      state.processedNodes.add(span);
    }
    return;
  }

  // Process regular USD patterns
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
      span.style.cssText = window.getComputedStyle(node.parentNode).cssText;
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