// Derma & Bare AI - Application Frontend Script
document.addEventListener('DOMContentLoaded', () => {
    // Initialize Lucide icons
    lucide.createIcons();

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
    if (chatForm) {
        chatForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const message = chatInput.value.trim();
            if (!message) return;

            // Render User Message
            appendUserMessage(message);
            chatInput.value = '';
            chatInput.style.height = 'auto';

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

                const data = await response.json();
                showTyping(false);

                if (data.status === 'success') {
                    appendBotMessage(data.reply);
                    state.chatHistory.push({ sender: 'user', text: message });
                    state.chatHistory.push({ sender: 'bot', text: data.reply });
                } else {
                    appendBotMessage("I encountered an issue processing your request. Please try asking again!");
                }
            } catch (err) {
                showTyping(false);
                appendBotMessage("Network error communicating with Derma & Bare AI server. Please check your connection.");
            }
        });

        // Shift + Enter newline
        chatInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                chatForm.dispatchEvent(new Event('submit'));
            }
        });
    }

    function appendUserMessage(text) {
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
        lucide.createIcons();
        scrollToBottom();
    }

    function appendBotMessage(text) {
        const row = document.createElement('div');
        row.className = 'message-row bot-row';
        
        // Parse markdown text using Marked.js if available
        let parsedText = text;
        if (window.marked) {
            parsedText = marked.parse(text);
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
        lucide.createIcons();
        scrollToBottom();
    }

    function showTyping(show) {
        if (show) {
            typingIndicator.classList.remove('hidden');
        } else {
            typingIndicator.classList.add('hidden');
        }
        scrollToBottom();
    }

    function scrollToBottom() {
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }

    function getCurrentTime() {
        return new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }

    function escapeHTML(str) {
        return str.replace(/[&<>'"]/g, 
            tag => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[tag] || tag)
        );
    }

    // Quick Prompts Click Handler
    promptChips.forEach(chip => {
        chip.addEventListener('click', () => {
            const promptText = chip.getAttribute('data-prompt');
            if (promptText) {
                chatInput.value = promptText;
                chatForm.dispatchEvent(new Event('submit'));
            }
        });
    });

    if (clearChatBtn) {
        clearChatBtn.addEventListener('click', () => {
            state.chatHistory = [];
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
            lucide.createIcons();
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
            const data = await resp.json();

            if (data.status === 'success') {
                state.products = data.products;
                renderProductsGrid(data.products);
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

        if (products.length === 0) {
            productsGrid.innerHTML = `
                <div style="grid-column: 1/-1; text-align: center; padding: 40px; color: var(--text-secondary);">
                    <i data-lucide="package-search" style="width: 48px; height: 48px; margin-bottom: 12px; color: var(--text-muted);"></i>
                    <h3>No products found</h3>
                    <p>Try adjusting your search query or price filters.</p>
                </div>
            `;
            lucide.createIcons();
            return;
        }

        products.forEach(p => {
            const card = document.createElement('div');
            const isDerma = p.brand === 'The Derma Co';
            card.className = `product-card ${isDerma ? 'derma-card' : 'bare-card'}`;

            const concernsList = (p.concerns || []).map(c => `<span class="concern-tag">${c}</span>`).join('');

            card.innerHTML = `
                <div class="card-top">
                    <div class="card-badges">
                        <span class="brand-badge">${p.brand}</span>
                        <span class="size-badge">${p.size}</span>
                    </div>
                    <h3 class="product-name">${p.name}</h3>
                    <div class="product-ingredients"><strong>Actives:</strong> ${p.ingredients}</div>
                    <div class="concern-tags">${concernsList}</div>
                </div>
                <div class="card-bottom">
                    <div class="price-tag">₹${p.price}</div>
                    <button class="ask-prod-btn" data-prod-name="${escapeHTML(p.name)}" data-prod-brand="${p.brand}">
                        <i data-lucide="message-square"></i> Ask AI
                    </button>
                </div>
            `;

            productsGrid.appendChild(card);
        });

        lucide.createIcons();

        // Attach event listeners for "Ask AI" on product cards
        document.querySelectorAll('.ask-prod-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const name = btn.getAttribute('data-prod-name');
                const brand = btn.getAttribute('data-prod-brand');
                switchTab('chat-tab');
                chatInput.value = `Tell me more about ${brand} ${name}. What are its benefits, ingredients, and how should I use it?`;
                chatForm.dispatchEvent(new Event('submit'));
            });
        });
    }

    // Filter controls event listeners
    brandFilterBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            brandFilterBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            state.activeBrand = btn.getAttribute('data-brand');
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
            state.quiz.careType = opt.getAttribute('data-val');
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
            card.innerHTML = `<i data-lucide="${isSelected ? 'check-square' : 'square'}"></i> ${c}`;
            
            card.addEventListener('click', () => {
                if (state.quiz.concerns.includes(c)) {
                    state.quiz.concerns = state.quiz.concerns.filter(item => item !== c);
                    card.classList.remove('selected');
                    card.querySelector('svg').setAttribute('data-lucide', 'square');
                } else {
                    state.quiz.concerns.push(c);
                    card.classList.add('selected');
                    card.querySelector('svg').setAttribute('data-lucide', 'check-square');
                }
                lucide.createIcons();
            });

            grid.appendChild(card);
        });

        lucide.createIcons();
    }

    // Step 3 Budget selection
    document.querySelectorAll('.budget-card').forEach(b => {
        b.addEventListener('click', () => {
            document.querySelectorAll('.budget-card').forEach(card => card.classList.remove('active'));
            b.classList.add('active');
            state.quiz.budget = parseInt(b.getAttribute('data-budget'));
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

                const data = await resp.json();
                if (data.status === 'success') {
                    renderQuizResults(data.recommendations);
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
        grid.innerHTML = '';

        if (recommendations.length === 0) {
            grid.innerHTML = `<p style="grid-column:1/-1; text-align:center; padding:20px; color:var(--text-secondary);">No products directly matched your exact filter budget. Try increasing your budget or selecting fewer concerns!</p>`;
            return;
        }

        let totalPrice = 0;
        recommendations.forEach(p => {
            totalPrice += p.price;
            const card = document.createElement('div');
            card.className = `product-card ${p.brand === 'The Derma Co' ? 'derma-card' : 'bare-card'}`;
            card.innerHTML = `
                <div class="card-top">
                    <div class="card-badges">
                        <span class="brand-badge">${p.brand}</span>
                        <span class="size-badge">${p.category}</span>
                    </div>
                    <h4 style="font-family:var(--font-heading); color:#fff; margin-bottom:6px;">${p.name}</h4>
                    <p style="font-size:0.8rem; color:var(--text-secondary); margin-bottom:8px;">${p.ingredients}</p>
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
            chatInput.value = `Explain why this ${state.quiz.careType} routine works for ${concernsStr} and how I should apply these products day and night.`;
            chatForm.dispatchEvent(new Event('submit'));
        });
    }

    // Initial catalog load
    loadCatalog();
});
