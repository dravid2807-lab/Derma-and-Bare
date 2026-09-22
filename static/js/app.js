// Derma & Bare AI - Application Frontend Script
document.addEventListener('DOMContentLoaded', () => {
    // Helper to safely invoke Lucide icons
    function safeCreateIcons() {
        if (typeof lucide !== 'undefined' && lucide && typeof lucide.createIcons === 'function') {
            try {
                lucide.createIcons();
            } catch (e) {
                console.warn('Lucide icon rendering warning:', e);
            }
        }
    }

    safeCreateIcons();

    // Application State
    const state = {
        chatHistory: [],
        products: [],
        activeBrand: 'all',
        quiz: {
            careType: 'skincare',
            concerns: [],
            budget: 1500
        }
    };

    // DOM Elements
    const navButtons = document.querySelectorAll('.nav-btn');
    const tabPanes = document.querySelectorAll('.tab-pane');
    
    // Chat elements
    const chatForm = document.getElementById('chat-form');
    const chatInput = document.getElementById('chat-input');
    const chatMessages = document.getElementById('chat-messages');
    const typingIndicator = document.getElementById('typing-indicator');
    const clearChatBtn = document.getElementById('clear-chat-btn');
    const promptChips = document.querySelectorAll('.prompt-chip');

    // Catalog elements
    const productsGrid = document.getElementById('products-grid');
    const catalogSearch = document.getElementById('catalog-search');
    const categoryFilter = document.getElementById('category-filter');
    const targetFilter = document.getElementById('target-filter');
    const priceRange = document.getElementById('price-range');
    const priceVal = document.getElementById('price-val');
    const brandFilterBtns = document.querySelectorAll('.brand-filter-btn');
    const resultsCountText = document.getElementById('results-count-text');

    /* ==========================================
       1. Navigation Tabs Management
    ========================================== */
    navButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            const targetTab = btn.getAttribute('data-tab');
            
            navButtons.forEach(b => b.classList.remove('active'));
            tabPanes.forEach(p => p.classList.remove('active'));

            btn.classList.add('active');
            const targetPane = document.getElementById(targetTab);
            if (targetPane) {
                targetPane.classList.add('active');
            }
        });
    });

    function switchTab(tabId) {
        const btn = document.querySelector(`.nav-btn[data-tab="${tabId}"]`);
        if (btn) btn.click();
    }

    /* ==========================================
       2. AI Chatbot Logic
    ========================================== */
    // Auto-resize chat textarea
    if (chatInput) {
        chatInput.addEventListener('input', function() {
            this.style.height = 'auto';
            this.style.height = Math.min(this.scrollHeight, 160) + 'px';
        });

        // Shift + Enter newline, Enter to send
        chatInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                submitUserMessage();
            }
        });
    }

    if (chatForm) {
        chatForm.addEventListener('submit', (e) => {
            e.preventDefault();
            submitUserMessage();
        });
    }

    async function submitUserMessage(overrideMessage = null) {
        const message = overrideMessage ? overrideMessage.trim() : (chatInput ? chatInput.value.trim() : '');
        if (!message) return;

        // Render User Message
        appendUserMessage(message);
        if (chatInput && !overrideMessage) {
            chatInput.value = '';
            chatInput.style.height = 'auto';
        }

        // Show Typing Indicator
        showTyping(true);

        // Call API
        try {
            const response = await fetch('/api/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    message: message,
                    history: state.chatHistory
                })
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();
            showTyping(false);

            if (data && data.status === 'success' && data.reply) {
                appendBotMessage(data.reply);
                state.chatHistory.push({ sender: 'user', text: message });
                state.chatHistory.push({ sender: 'bot', text: data.reply });
            } else {
                appendBotMessage("I encountered an issue processing your request. Please try asking again!");
            }
        } catch (err) {
            console.error("Chat API error:", err);
            showTyping(false);
            appendBotMessage("Network error communicating with Derma & Bare AI server. Please check your connection.");
        }
    }

    function appendUserMessage(text) {
        if (!chatMessages) return;
        const row = document.createElement('div');
        row.className = 'message-row user-row';
        row.innerHTML = `
            <div class="msg-avatar"><i data-lucide="user"></i></div>
            <div class="msg-content">
                <div class="msg-header">
                    <span class="sender-name">You</span>
                    <span class="msg-time">${getCurrentTime()}</span>
                </div>
                <div class="msg-body">${escapeHTML(text)}</div>
            </div>
        `;
        chatMessages.appendChild(row);
        safeCreateIcons();
        scrollToBottom();
    }

    function appendBotMessage(text) {
        if (!chatMessages) return;
        const row = document.createElement('div');
        row.className = 'message-row bot-row';
        
        // Parse markdown text using Marked.js if available
        let parsedText = text;
        if (typeof window.marked !== 'undefined' && typeof window.marked.parse === 'function') {
            parsedText = window.marked.parse(text);
        } else {
            parsedText = escapeHTML(text).replace(/\n/g, '<br>');
        }

        row.innerHTML = `
            <div class="msg-avatar"><i data-lucide="sparkles"></i></div>
            <div class="msg-content">
                <div class="msg-header">
                    <span class="sender-name">Derma &amp; Bare AI</span>
                    <span class="msg-time">${getCurrentTime()}</span>
                </div>
                <div class="msg-body">${parsedText}</div>
            </div>
        `;
        chatMessages.appendChild(row);
        safeCreateIcons();
        scrollToBottom();
    }

    function showTyping(show) {
        if (!typingIndicator) return;
        if (show) {
            typingIndicator.classList.remove('hidden');
        } else {
            typingIndicator.classList.add('hidden');
        }
        scrollToBottom();
    }

    function scrollToBottom() {
        if (chatMessages) {
            chatMessages.scrollTop = chatMessages.scrollHeight;
        }
    }

    function getCurrentTime() {
        return new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }

    function escapeHTML(str) {
        if (!str) return '';
        return String(str).replace(/[&<>'"]/g, 
            tag => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[tag] || tag)
        );
    }

    // Quick Prompts Click Handler
    promptChips.forEach(chip => {
        chip.addEventListener('click', () => {
            const promptText = chip.getAttribute('data-prompt');
            if (promptText) {
                switchTab('chat-tab');
                submitUserMessage(promptText);
            }
        });
    });

    if (clearChatBtn) {
        clearChatBtn.addEventListener('click', () => {
            state.chatHistory = [];
            if (chatMessages) {
                chatMessages.innerHTML = `
                    <div class="message-row bot-row">
                        <div class="msg-avatar"><i data-lucide="sparkles"></i></div>
                        <div class="msg-content">
                            <div class="msg-header">
                                <span class="sender-name">Derma &amp; Bare AI</span>
                                <span class="msg-time">Just now</span>
                            </div>
                            <div class="msg-body">
                                <p>Chat history cleared! Ask me anything about skincare or haircare routines.</p>
                            </div>
                        </div>
                    </div>
                `;
                safeCreateIcons();
            }
        });
    }

    /* ==========================================
       3. Catalog Explorer Logic
    ========================================== */
    async function loadCatalog() {
        try {
            const brand = state.activeBrand;
            const category = categoryFilter ? categoryFilter.value : 'all';
            const target = targetFilter ? targetFilter.value : 'all';
            const search = catalogSearch ? catalogSearch.value : '';
            const maxPrice = priceRange ? priceRange.value : 1500;

            const queryParams = new URLSearchParams({
                brand, category, target_type: target, search, max_price: maxPrice
            });

            const resp = await fetch(`/api/products?${queryParams.toString()}`);
            if (!resp.ok) throw new Error(`Catalog HTTP status: ${resp.status}`);

            const data = await resp.json();

            if (data && data.status === 'success') {
                state.products = data.products || [];
                renderProductsGrid(state.products);
                if (resultsCountText) {
                    resultsCountText.textContent = `Showing ${data.count} product${data.count === 1 ? '' : 's'}`;
                }
            }
        } catch (err) {
            console.error("Failed to load catalog:", err);
        }
    }

    function renderProductsGrid(products) {
        if (!productsGrid) return;
        productsGrid.innerHTML = '';

        if (!products || products.length === 0) {
            productsGrid.innerHTML = `
                <div style="grid-column: 1/-1; text-align: center; padding: 40px; color: var(--text-secondary);">
                    <i data-lucide="package-search" style="width: 48px; height: 48px; margin-bottom: 12px; color: var(--text-muted);"></i>
                    <h3>No products found</h3>
                    <p>Try adjusting your search query or price filters.</p>
                </div>
            `;
            safeCreateIcons();
            return;
        }

        products.forEach(p => {
            const card = document.createElement('div');
            const isDerma = p.brand === 'The Derma Co';
            card.className = `product-card ${isDerma ? 'derma-card' : 'bare-card'}`;

            const concernsList = (p.concerns || []).map(c => `<span class="concern-tag">${escapeHTML(c)}</span>`).join('');

            card.innerHTML = `
                <div class="card-top">
                    <div class="card-badges">
                        <span class="brand-badge">${escapeHTML(p.brand)}</span>
                        <span class="size-badge">${escapeHTML(p.size)}</span>
                    </div>
                    <h3 class="product-name">${escapeHTML(p.name)}</h3>
                    <div class="product-ingredients"><strong>Actives:</strong> ${escapeHTML(p.ingredients)}</div>
                    <div class="concern-tags">${concernsList}</div>
                </div>
                <div class="card-bottom">
                    <div class="price-tag">₹${p.price}</div>
                    <button class="ask-prod-btn" data-prod-name="${escapeHTML(p.name)}" data-prod-brand="${escapeHTML(p.brand)}">
                        <i data-lucide="message-square"></i> Ask AI
                    </button>
                </div>
            `;

            productsGrid.appendChild(card);
        });

        safeCreateIcons();

        // Attach event listeners for "Ask AI" on product cards
        productsGrid.querySelectorAll('.ask-prod-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const name = btn.getAttribute('data-prod-name');
                const brand = btn.getAttribute('data-prod-brand');
                switchTab('chat-tab');
                submitUserMessage(`Tell me more about ${brand} ${name}. What are its benefits, ingredients, and how should I use it?`);
            });
        });
    }

    // Filter controls event listeners
    brandFilterBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            brandFilterBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            state.activeBrand = btn.getAttribute('data-brand') || 'all';
            loadCatalog();
        });
    });

    if (catalogSearch) catalogSearch.addEventListener('input', debounce(loadCatalog, 300));
    if (categoryFilter) categoryFilter.addEventListener('change', loadCatalog);
    if (targetFilter) targetFilter.addEventListener('change', loadCatalog);
    if (priceRange) {
        priceRange.addEventListener('input', () => {
            if (priceVal) priceVal.textContent = `₹${priceRange.value}`;
            loadCatalog();
        });
    }

    function debounce(func, delay) {
        let timeout;
        return (...args) => {
            clearTimeout(timeout);
            timeout = setTimeout(() => func.apply(this, args), delay);
        };
    }

    /* ==========================================
       4. Routine Quiz Logic
    ========================================== */
    window.nextQuizStep = function(stepNum) {
        document.querySelectorAll('.quiz-step').forEach(s => s.classList.add('hidden'));
        const nextStep = document.getElementById(`quiz-step-${stepNum}`);
        if (nextStep) nextStep.classList.remove('hidden');

        if (stepNum === 2) {
            renderQuizConcerns();
        }
    };

    // Step 1 Option selection
    document.querySelectorAll('.quiz-option-card').forEach(opt => {
        opt.addEventListener('click', () => {
            document.querySelectorAll('.quiz-option-card').forEach(o => o.classList.remove('active'));
            opt.classList.add('active');
            state.quiz.careType = opt.getAttribute('data-val') || 'skincare';
        });
    });

    const skincareConcerns = ["Acne & Blemishes", "Pigmentation & Dark Spots", "Dryness & Hydration", "Sun Protection", "Oil & Pore Control", "Exfoliation & Anti-Aging"];
    const haircareConcerns = ["Dandruff & Scalp Care", "Hair Fall & Growth", "Frizz & Smoothness", "Curl Care & Styling", "Damage Repair & Strengthening", "Volume & Thin Hair"];

    function renderQuizConcerns() {
        const grid = document.getElementById('concerns-grid');
        if (!grid) return;
        grid.innerHTML = '';

        let concernsList = [];
        if (state.quiz.careType === 'skincare') concernsList = skincareConcerns;
        else if (state.quiz.careType === 'haircare') concernsList = haircareConcerns;
        else concernsList = [...skincareConcerns, ...haircareConcerns];

        concernsList.forEach(c => {
            const card = document.createElement('div');
            const isSelected = state.quiz.concerns.includes(c);
            card.className = `concern-card-opt ${isSelected ? 'selected' : ''}`;
            card.innerHTML = `<i data-lucide="${isSelected ? 'check-square' : 'square'}"></i> ${escapeHTML(c)}`;
            
            card.addEventListener('click', () => {
                if (state.quiz.concerns.includes(c)) {
                    state.quiz.concerns = state.quiz.concerns.filter(item => item !== c);
                    card.classList.remove('selected');
                    card.innerHTML = `<i data-lucide="square"></i> ${escapeHTML(c)}`;
                } else {
                    state.quiz.concerns.push(c);
                    card.classList.add('selected');
                    card.innerHTML = `<i data-lucide="check-square"></i> ${escapeHTML(c)}`;
                }
                safeCreateIcons();
            });

            grid.appendChild(card);
        });

        safeCreateIcons();
    }

    // Step 3 Budget selection
    document.querySelectorAll('.budget-card').forEach(b => {
        b.addEventListener('click', () => {
            document.querySelectorAll('.budget-card').forEach(card => card.classList.remove('active'));
            b.classList.add('active');
            state.quiz.budget = parseInt(b.getAttribute('data-budget') || '1500', 10);
        });
    });

    // Submit Quiz & Generate Routine
    const generateRoutineBtn = document.getElementById('generate-routine-btn');
    if (generateRoutineBtn) {
        generateRoutineBtn.addEventListener('click', async () => {
            try {
                const resp = await fetch('/api/recommend', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        care_type: state.quiz.careType,
                        concerns: state.quiz.concerns,
                        budget: state.quiz.budget
                    })
                });

                if (!resp.ok) throw new Error(`HTTP error ${resp.status}`);

                const data = await resp.json();
                if (data && data.status === 'success') {
                    renderQuizResults(data.recommendations || []);
                }
            } catch (err) {
                console.error("Quiz submission error:", err);
            }
        });
    }

    function renderQuizResults(recommendations) {
        document.querySelectorAll('.quiz-step').forEach(s => s.classList.add('hidden'));
        const resultsStep = document.getElementById('quiz-results');
        if (resultsStep) resultsStep.classList.remove('hidden');

        const grid = document.getElementById('routine-results-grid');
        if (!grid) return;
        grid.innerHTML = '';

        if (!recommendations || recommendations.length === 0) {
            grid.innerHTML = `<p style="grid-column:1/-1; text-align:center; padding:20px; color:var(--text-secondary);">No products directly matched your exact filter budget. Try increasing your budget or selecting fewer concerns!</p>`;
            return;
        }

        let totalPrice = 0;
        recommendations.forEach(p => {
            totalPrice += (p.price || 0);
            const card = document.createElement('div');
            card.className = `product-card ${p.brand === 'The Derma Co' ? 'derma-card' : 'bare-card'}`;
            card.innerHTML = `
                <div class="card-top">
                    <div class="card-badges">
                        <span class="brand-badge">${escapeHTML(p.brand)}</span>
                        <span class="size-badge">${escapeHTML(p.category)}</span>
                    </div>
                    <h4 style="font-family:var(--font-heading); color:#fff; margin-bottom:6px;">${escapeHTML(p.name)}</h4>
                    <p style="font-size:0.8rem; color:var(--text-secondary); margin-bottom:8px;">${escapeHTML(p.ingredients)}</p>
                </div>
                <div class="card-bottom">
                    <span class="price-tag">₹${p.price}</span>
                    <span style="font-size:0.75rem; color:var(--derma-glow);">Recommended Step</span>
                </div>
            `;
            grid.appendChild(card);
        });

        // Add summary card
        const summaryCard = document.createElement('div');
        summaryCard.style.cssText = `grid-column: 1/-1; background: var(--derma-bg); border:1px solid var(--derma-primary); padding:16px; border-radius:12px; display:flex; justify-content:space-between; align-items:center;`;
        summaryCard.innerHTML = `
            <div>
                <strong style="color:#fff; font-size:1.05rem;">Routine Total: ₹${totalPrice}</strong>
                <p style="font-size:0.82rem; color:var(--text-secondary);">Contains ${recommendations.length} custom active products tailored for you.</p>
            </div>
        `;
        grid.prepend(summaryCard);
    }

    window.resetQuiz = function() {
        state.quiz.concerns = [];
        window.nextQuizStep(1);
    };

    const askAiRoutineBtn = document.getElementById('ask-ai-routine-btn');
    if (askAiRoutineBtn) {
        askAiRoutineBtn.addEventListener('click', () => {
            const concernsStr = state.quiz.concerns.join(', ') || 'general maintenance';
            switchTab('chat-tab');
            submitUserMessage(`Explain why this ${state.quiz.careType} routine works for ${concernsStr} and how I should apply these products day and night.`);
        });
    }

    /* ==========================================
       5. Share Modal & Link Copying
    ========================================== */
    const shareModal = document.getElementById('share-modal');
    const openShareBtn = document.getElementById('open-share-modal-btn');
    const closeShareBtn = document.getElementById('close-share-modal-btn');
    const shareLinkInput = document.getElementById('share-link-input');
    const copyShareLinkBtn = document.getElementById('copy-share-link-btn');
    const shareQrImg = document.getElementById('share-qr-img');
    const whatsappShareBtn = document.getElementById('whatsapp-share-btn');
    const nativeShareBtn = document.getElementById('native-share-btn');

    function openShareModal() {
        if (!shareModal) return;
        const currentUrl = window.location.href;
        
        if (shareLinkInput) shareLinkInput.value = currentUrl;

        // Generate QR code via free QR code API
        if (shareQrImg) {
            shareQrImg.src = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(currentUrl)}`;
        }

        // WhatsApp share URL
        if (whatsappShareBtn) {
            const waText = `Check out Derma & Bare AI 🌟 - Intelligent Skincare & Haircare Consultant! Try it here: ${currentUrl}`;
            whatsappShareBtn.href = `https://api.whatsapp.com/send?text=${encodeURIComponent(waText)}`;
        }

        shareModal.classList.remove('hidden');
    }

    function closeShareModal() {
        if (shareModal) shareModal.classList.add('hidden');
    }

    if (openShareBtn) openShareBtn.addEventListener('click', openShareModal);
    if (closeShareBtn) closeShareBtn.addEventListener('click', closeShareModal);

    if (shareModal) {
        shareModal.addEventListener('click', (e) => {
            if (e.target === shareModal) closeShareModal();
        });
    }

    if (copyShareLinkBtn && shareLinkInput) {
        copyShareLinkBtn.addEventListener('click', () => {
            const link = shareLinkInput.value;
            if (navigator.clipboard && navigator.clipboard.writeText) {
                navigator.clipboard.writeText(link).then(() => {
                    showToast("Link copied to clipboard! Send it to your friends.");
                }).catch(() => {
                    copyFallback(link);
                });
            } else {
                copyFallback(link);
            }
        });
    }

    function copyFallback(text) {
        if (!shareLinkInput) return;
        shareLinkInput.select();
        try {
            document.execCommand('copy');
            showToast("Link copied to clipboard!");
        } catch (e) {
            showToast("Manual copy required: " + text);
        }
    }

    if (nativeShareBtn) {
        nativeShareBtn.addEventListener('click', () => {
            const currentUrl = window.location.href;
            if (navigator.share) {
                navigator.share({
                    title: 'Derma & Bare AI Advisor',
                    text: 'Try Derma & Bare AI Skincare & Haircare Consultant!',
                    url: currentUrl
                }).catch(() => {});
            } else {
                showToast("Web Share API not supported on this browser. Use Copy Link!");
            }
        });
    }

    function showToast(msg) {
        const toast = document.getElementById('toast-notification');
        const toastMsg = document.getElementById('toast-message');
        if (toast && toastMsg) {
            toastMsg.textContent = msg;
            toast.classList.remove('hidden');
            setTimeout(() => {
                toast.classList.add('hidden');
            }, 3000);
        }
    }

    // Initial catalog load
    loadCatalog();
});

