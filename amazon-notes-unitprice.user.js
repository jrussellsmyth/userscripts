// ==UserScript==
// @name         Amazon Product Notes & Unit Price
// @namespace    http://tampermonkey.net/
// @version      1.0
// @description  Add notes to Amazon product pages and auto-calculate unit price for bulk items.
// @author       You
// @match        https://www.amazon.com/*/dp/*
// @match        https://www.amazon.com/gp/product/*
// @match        https://www.amazon.com/cart/smart-wagon*
// @match        https://www.amazon.com/s*
// @icon         https://www.amazon.com/favicon.ico
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    // Helper: Get ASIN from URL
    function getASIN() {
        // Try /dp/ASIN
        let match = window.location.pathname.match(/\/dp\/([A-Z0-9]{10})/i);
        if (match) return match[1];
        // Try /gp/product/ASIN
        match = window.location.pathname.match(/\/gp\/product\/([A-Z0-9]{10})/i);
        if (match) return match[1];
        // Try /product/ASIN
        match = window.location.pathname.match(/\/product\/([A-Z0-9]{10})/i);
        if (match) return match[1];
        return null;
    }

    // Helper: Save and load notes
    function saveNote(asin, note) {
        localStorage.setItem('amz_note_' + asin, note);
    }
    function loadNote(asin) {
        return localStorage.getItem('amz_note_' + asin) || '';
    }
    
    // Helper: Try to extract quantity from title or description
    function extractQuantity(text) {
        const match = text.match(/(\d+)\s*(pcs|count|pack|pieces|ct|pk)/i);
        return match ? parseInt(match[1], 10) : null;
    }

    // Helper: Get product price
    function getPrice() {
        // Try several selectors for price
        const selectors = [
            '#corePrice_feature_div .a-price .a-offscreen',
            '#priceblock_ourprice',
            '#priceblock_dealprice',
            '#priceblock_saleprice',
            '.a-price .a-offscreen'
        ];
        for (const sel of selectors) {
            const el = document.querySelector(sel);
            if (el) {
                const price = el.textContent.replace(/[^\d.]/g, '');
                return parseFloat(price);
            }
        }
        return null;
    }

    // Insert notes UI
    function insertNotes(asin) {
        const container = document.createElement('div');
        container.style.border = '1px solid #ccc';
        container.style.padding = '10px';
        container.style.margin = '10px 0';
        container.style.background = '#f6f6ff';
        container.style.maxWidth = '400px';

        const label = document.createElement('label');
        label.textContent = 'Your Notes for this Product:';
        label.style.fontWeight = 'bold';
        label.style.display = 'block';
        label.style.marginBottom = '5px';

        const textarea = document.createElement('textarea');
        textarea.rows = 4;
        textarea.style.width = '100%';
        textarea.value = loadNote(asin);
        textarea.placeholder = 'Type your notes here...';
        textarea.addEventListener('input', () => saveNote(asin, textarea.value));

        container.appendChild(label);
        container.appendChild(textarea);

        // Insert after title
        const title = document.getElementById('titleSection') || document.getElementById('productTitle');
        if (title) {
            title.parentNode.insertBefore(container, title.nextSibling);
        } else {
            document.body.prepend(container);
        }
    }

    // Insert unit price
    function insertUnitPrice(unitPrice, quantity) {
        const priceDiv = document.querySelector('#corePrice_feature_div') || document.querySelector('#price');
        if (priceDiv) {
            const up = document.createElement('div');
            up.style.color = '#007600';
            up.style.fontWeight = 'bold';
            up.style.marginTop = '5px';
            up.textContent = `Unit Price: $${unitPrice.toFixed(2)} per item (${quantity} pcs)`;
            priceDiv.appendChild(up);
        }
    }

    // Insert status indicator
    function insertStatusIndicator() {
        let statusDiv = document.getElementById('amz-notes-status');
        if (!statusDiv) {
            statusDiv = document.createElement('div');
            statusDiv.id = 'amz-notes-status';
            statusDiv.style.position = 'fixed';
            statusDiv.style.top = '0';
            statusDiv.style.left = '0';
            statusDiv.style.width = '100%';
            statusDiv.style.background = '#ffd700';
            statusDiv.style.color = '#222';
            statusDiv.style.fontWeight = 'bold';
            statusDiv.style.textAlign = 'center';
            statusDiv.style.zIndex = '9999';
            statusDiv.style.padding = '4px 0';
            document.body.appendChild(statusDiv);
        }
        statusDiv.textContent = 'Amazon Notes Script: Loading...';
    }

    function updateStatusIndicator(message, isError) {
        const statusDiv = document.getElementById('amz-notes-status');
        if (statusDiv) {
            statusDiv.textContent = message;
            statusDiv.style.background = isError ? '#ffcccc' : '#d4edda';
            statusDiv.style.color = isError ? '#900' : '#155724';
            if (!isError) {
                setTimeout(() => statusDiv.remove(), 2000);
            }
        }
    }

    // Enhance cart sidebar items with unit price and notes icon
    function enhanceCartSidebar() {
        // Select all cart item containers
        const cartItems = document.querySelectorAll('div.ewc-item[data-asin]');
        cartItems.forEach(item => {
            const asin = item.getAttribute('data-asin');
            if (!asin) return;
            // Try to get price from data attribute or visible price
            let price = parseFloat(item.getAttribute('data-price'));
            if (!price) {
                const priceEl = item.querySelector('.ewc-unit-price .a-size-base.a-text-bold');
                if (priceEl) {
                    price = parseFloat(priceEl.textContent.replace(/[^\d.]/g, ''));
                }
            }
            // Try to get quantity from product title (in image alt or link text)
            let quantity = null;
            let titleText = '';
            const img = item.querySelector('img.sc-product-image');
            if (img && img.alt) titleText = img.alt;
            if (!titleText) {
                const link = item.querySelector('a.sc-product-link');
                if (link) titleText = link.textContent;
            }
            if (titleText) {
                const match = titleText.match(/(\d+)\s*(pcs|count|pack|pieces|ct|pk)/i);
                if (match) quantity = parseInt(match[1], 10);
            }
            // If we have price and quantity, show unit price
            if (price && quantity) {
                let up = item.querySelector('.amz-unit-price-badge');
                if (!up) {
                    up = document.createElement('div');
                    up.className = 'amz-unit-price-badge';
                    up.style.fontSize = '12px';
                    up.style.color = '#007600';
                    up.style.fontWeight = 'bold';
                    up.style.margin = '2px 0';
                    const priceContainer = item.querySelector('.ewc-unit-price') || item.querySelector('.a-section.a-spacing-none.ewc-item-content');
                    if (priceContainer) priceContainer.appendChild(up);
                    else item.appendChild(up);
                }
                up.textContent = `Unit: $${(price/quantity).toFixed(2)}`;
            }
            // Notes icon
            let noteIcon = item.querySelector('.amz-note-icon');
            if (!noteIcon) {
                noteIcon = document.createElement('span');
                noteIcon.className = 'amz-note-icon';
                noteIcon.style.cursor = 'pointer';
                noteIcon.style.marginLeft = '8px';
                noteIcon.style.verticalAlign = 'middle';
                noteIcon.title = 'Click to view/add note';
                noteIcon.innerHTML = '📝';
                // Place after price or at end
                const priceContainer = item.querySelector('.ewc-unit-price') || item.querySelector('.a-section.a-spacing-none.ewc-item-content');
                if (priceContainer) priceContainer.appendChild(noteIcon);
                else item.appendChild(noteIcon);
            }
            // Highlight icon if note exists
            const note = loadNote(asin);
            noteIcon.style.opacity = note ? '1' : '0.4';
            noteIcon.title = note ? 'View note' : 'Add note';
            // Click to show note popup
            noteIcon.onclick = function(e) {
                e.stopPropagation();
                showNotePopup(asin, noteIcon);
            };
        });
    }

    // Enhance search results with unit price and notes icon
    function enhanceSearchResults() {
        // Select all search result items
        const searchItems = document.querySelectorAll('[data-asin]:not([data-asin=""])');
        searchItems.forEach(item => {
            const asin = item.getAttribute('data-asin');
            if (!asin) return;
            
            // Skip if already enhanced
            if (item.querySelector('.amz-note-icon')) return;
            
            // Try to get price from various selectors
            let priceEl = item.querySelector('.a-price .a-offscreen');
            if (!priceEl) return;
            
            const price = parseFloat(priceEl.textContent.replace(/[^\d.]/g, ''));
            if (!price) return;
            
            // Try to get quantity from product title
            const titleEl = item.querySelector('h2') || item.querySelector('.a-size-base-plus') || item.querySelector('.a-link-normal .a-text-normal');
            if (!titleEl) return;
            
            const titleText = titleEl.textContent;
            const quantity = extractQuantity(titleText);
            
            // Container for price info and note icon
            let infoContainer = item.querySelector('.amz-enhanced-info');
            if (!infoContainer) {
                infoContainer = document.createElement('div');
                infoContainer.className = 'amz-enhanced-info';
                infoContainer.style.fontSize = '12px';
                infoContainer.style.marginTop = '4px';
                infoContainer.style.display = 'flex';
                infoContainer.style.alignItems = 'center';
                
                // Find a good place to insert our info
                const priceContainer = priceEl.closest('.a-price').parentNode;
                if (priceContainer) {
                    if (priceContainer.nextElementSibling) {
                        priceContainer.parentNode.insertBefore(infoContainer, priceContainer.nextElementSibling);
                    } else {
                        priceContainer.parentNode.appendChild(infoContainer);
                    }
                } else {
                    // Fallback insertion
                    const actionSection = item.querySelector('.a-section.a-spacing-none.a-spacing-top-small');
                    if (actionSection) {
                        actionSection.appendChild(infoContainer);
                    } else {
                        return; // Can't find a place to insert
                    }
                }
            }
            
            // Clear container
            infoContainer.innerHTML = '';
            
            // Add unit price if quantity is available
            if (quantity) {
                const unitPrice = price / quantity;
                const upSpan = document.createElement('span');
                upSpan.className = 'amz-unit-price-badge';
                upSpan.style.color = '#007600';
                upSpan.style.fontWeight = 'bold';
                upSpan.style.marginRight = '8px';
                upSpan.textContent = `Unit: $${unitPrice.toFixed(2)}`;
                infoContainer.appendChild(upSpan);
            }
            
            // Add notes icon
            const noteIcon = document.createElement('span');
            noteIcon.className = 'amz-note-icon';
            noteIcon.style.cursor = 'pointer';
            noteIcon.style.marginLeft = '4px';
            noteIcon.style.verticalAlign = 'middle';
            noteIcon.title = 'Click to view/add note';
            noteIcon.innerHTML = '📝';
            infoContainer.appendChild(noteIcon);
            
            // Highlight icon if note exists
            const note = loadNote(asin);
            noteIcon.style.opacity = note ? '1' : '0.4';
            noteIcon.title = note ? 'View note' : 'Add note';
            
            // Click to show note popup
            noteIcon.onclick = function(e) {
                e.stopPropagation();
                e.preventDefault();
                showNotePopup(asin, noteIcon);
                return false;
            };
        });
    }

    // Show a popup for viewing/adding notes
    function showNotePopup(asin, anchorEl) {
        // Remove any existing popup
        const old = document.getElementById('amz-note-popup');
        if (old) old.remove();
        const popup = document.createElement('div');
        popup.id = 'amz-note-popup';
        popup.style.position = 'fixed';
        // Calculate left position to keep popup inside viewport
        const anchorRect = anchorEl.getBoundingClientRect();
        const popupWidth = 260;
        let left = anchorRect.left + window.scrollX - 80;
        if (left + popupWidth > window.innerWidth - 10) {
            left = window.innerWidth - popupWidth - 10;
        }
        if (left < 10) left = 10;
        popup.style.top = (anchorRect.bottom + window.scrollY + 8) + 'px';
        popup.style.left = left + 'px';
        popup.style.background = '#fffbe7';
        popup.style.border = '1px solid #ccc';
        popup.style.padding = '10px';
        popup.style.zIndex = '10000';
        popup.style.boxShadow = '0 2px 8px rgba(0,0,0,0.15)';
        popup.style.minWidth = '200px';
        popup.style.maxWidth = popupWidth + 'px';
        popup.style.borderRadius = '6px';
        // Title
        const title = document.createElement('div');
        title.textContent = 'Product Note';
        title.style.fontWeight = 'bold';
        title.style.marginBottom = '6px';
        popup.appendChild(title);
        // Textarea
        const textarea = document.createElement('textarea');
        textarea.rows = 4;
        textarea.style.width = '100%';
        textarea.value = loadNote(asin);
        textarea.placeholder = 'Type your notes here...';
        textarea.oninput = function() {
            saveNote(asin, textarea.value);
            // Update icon highlight
            anchorEl.style.opacity = textarea.value ? '1' : '0.4';
        };
        popup.appendChild(textarea);
        // Close button
        const closeBtn = document.createElement('button');
        closeBtn.textContent = 'Close';
        closeBtn.style.marginTop = '8px';
        closeBtn.onclick = function() { popup.remove(); };
        popup.appendChild(closeBtn);
        // Remove popup on outside click
        setTimeout(() => {
            document.addEventListener('mousedown', function handler(e) {
                if (!popup.contains(e.target)) {
                    popup.remove();
                    document.removeEventListener('mousedown', handler);
                }
            });
        }, 0);
        document.body.appendChild(popup);
    }

    // Main logic
    function main() {
        insertStatusIndicator();
        try {
            // Check if we're on a cart page
            if (window.location.pathname.includes('/cart/smart-wagon')) {
                updateStatusIndicator('Amazon Notes Script: Cart page detected', false);
                return; // enhanceCartSidebar is called separately
            }
            
            // Check if we're on a search page
            if (window.location.pathname.startsWith('/s') || 
                window.location.search.includes('keywords=') || 
                window.location.search.includes('k=')) {
                updateStatusIndicator('Amazon Notes Script: Search page detected', false);
                return; // enhanceSearchResults is called separately
            }
            
            const asin = getASIN();
            if (!asin) {
                updateStatusIndicator('Amazon Notes Script: ASIN not found (not a product page)', true);
                return;
            }
            insertNotes(asin);

            // Try to get quantity from title or bullet points
            let quantity = null;
            const titleEl = document.getElementById('productTitle');
            if (titleEl) quantity = extractQuantity(titleEl.textContent);
            if (!quantity) {
                const bullets = document.querySelectorAll('#feature-bullets ul li');
                for (const li of bullets) {
                    quantity = extractQuantity(li.textContent);
                    if (quantity) break;
                }
            }
            if (!quantity) {
                updateStatusIndicator('Amazon Notes Script: Loaded (no quantity found)', false);
                return;
            }

            const price = getPrice();
            if (!price) {
                updateStatusIndicator('Amazon Notes Script: Loaded (no price found)', false);
                return;
            }

            const unitPrice = price / quantity;
            insertUnitPrice(unitPrice, quantity);
            updateStatusIndicator('Amazon Notes Script: Loaded', false);
        } catch (e) {
            updateStatusIndicator('Amazon Notes Script: Error - ' + e.message, true);
        }
    }

    // Wait for DOM
    window.addEventListener('DOMContentLoaded', function() {
        main();
        enhanceCartSidebar();
        enhanceSearchResults();
    });
    setTimeout(function() {
        main();
        enhanceCartSidebar();
        enhanceSearchResults();
    }, 2000);
})();
