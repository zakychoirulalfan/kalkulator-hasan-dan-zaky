document.addEventListener('DOMContentLoaded', () => {
    const display      = document.getElementById('display');
    const buttons      = document.querySelectorAll('.btn');
    const historyList  = document.getElementById('history-list');
    const themeToggleBtn = document.getElementById('theme-toggle');
    const angleToggleBtn = document.getElementById('angle-toggle');
    const displayResultEl = document.getElementById('display-result');
    let _rawExpr = '';
    let _isPreview = false;
    const ERROR_TEXT = 'Kesalahan';

    // angle mode: 'rad' or 'deg'
    let angleMode = localStorage.getItem('angleMode') || 'rad';
    function updateAngleUI() {
        if (!angleToggleBtn) return;
        if (angleMode === 'deg') {
            angleToggleBtn.textContent = 'Deg';
            angleToggleBtn.setAttribute('aria-pressed', 'true');
        } else {
            angleToggleBtn.textContent = 'Rad';
            angleToggleBtn.setAttribute('aria-pressed', 'false');
        }
    }
    if (angleToggleBtn) {
        angleToggleBtn.addEventListener('click', () => {
            angleMode = (angleMode === 'deg') ? 'rad' : 'deg';
            localStorage.setItem('angleMode', angleMode);
            updateAngleUI();
        });
    }
    // initialize UI
    updateAngleUI();

    // persistent history data (newest first)
    let historyData = [];
    function loadHistoryFromStorage() {
        try {
            const parsed = JSON.parse(localStorage.getItem('calcHistory') || '[]');
            historyData = Array.isArray(parsed) ? parsed : [];
        } catch (e) {
            historyData = [];
        }
        // render stored items (stored newest-first)
        historyList.innerHTML = '';
        historyData.forEach(item => renderHistoryItem(item));
    }
    function saveHistoryToStorage() {
        localStorage.setItem('calcHistory', JSON.stringify(historyData || []));
    }

    // load now
    loadHistoryFromStorage();

    // Agar fungsi Math bisa dipakai eval (sin, cos, log, exp)
    window.Math = Math;

    // --- Fungsi bantuan ---

    function sanitizeExpression(expression) {
        let sanitized = expression;

// Replace sin, cos, tan with Math.* equivalents, handling nested parentheses and degree conversion when needed
    function replaceTrigFunctions(expr) {
        let out = '';
        let i = 0;
        const len = expr.length;
        while (i < len) {
            const rest = expr.substring(i);
            const m = rest.match(/^(sin|cos|tan)\(/);
            if (m) {
                const fn = m[1];
                // move past "fn("
                i += fn.length + 1;
                let start = i;
                let depth = 1;
                while (i < len && depth > 0) {
                    const ch = expr[i];
                    if (ch === '(') depth++;
                    else if (ch === ')') depth--;
                    i++;
                }
                const end = i - 1; // index of matching ')'
                const inner = expr.substring(start, end);
                // recursively process inner content so nested trig calls are handled
                const processedInner = replaceTrigFunctions(inner);

                // If the previous character in output suggests implicit multiplication (e.g. digit, ')', or '.')
                // insert an explicit '*' so expressions like 8cos(9) -> 8*Math.cos(9)
                const prevChar = out.length ? out[out.length - 1] : '';
                const needsMul = /[0-9\.)]/.test(prevChar);
                if (needsMul) out += '*';

                if (angleMode === 'deg') {
                    out += `Math.${fn}((Math.PI/180)*(${processedInner}))`;
                } else {
                    out += `Math.${fn}(${processedInner})`;
                }
                // continue (i is positioned after the closing ')')
            } else {
                out += expr[i];
                i++;
            }
        }
        return out;
    }

    sanitized = replaceTrigFunctions(sanitized);

        // ensure Math.log10 exists if needed elsewhere
        window.Math.log10 = window.Math.log10 || ((x) => Math.log(x) / Math.log(10));

        // × dan ÷ -> * dan /
        sanitized = sanitized.replace(/×/g, '*').replace(/÷/g, '/');

        // persen: X% -> X/100
        sanitized = sanitized.replace(/%/g, '/100');

        // operator pangkat '^' -> '**' (ekspresi JS)
        sanitized = sanitized.replace(/\^/g, '**');

        return sanitized;
    }

    function calculateResult(expression) {
        const expr = String(expression || '').trim();
        if (expr === '') return '';
        try {
            const safeExpression = sanitizeExpression(expr);
            let result = eval(safeExpression);

            if (isNaN(result) || !isFinite(result)) {
                return ERROR_TEXT;
            }

            return result.toFixed(10).replace(/\.?0+$/, '');
        } catch (e) {
            return ERROR_TEXT;
        }
    }


    function updateLiveResult() {
        
    }

    
    function updateDisplay({ commit = false } = {}) {
        const raw = String(_rawExpr || '').trim();

        if (commit) {
            if (raw === '') {
                display.value = '';
                _isPreview = false;
                if (displayResultEl) displayResultEl.textContent = '';
                return;
            }
            const res = calculateResult(raw);
            if (res !== ERROR_TEXT && res !== '') {
                
                createHistoryItem(raw, res);
                display.value = String(res);
                _rawExpr = String(res);
            } else {
                display.value = res === ERROR_TEXT ? ERROR_TEXT : '';
            }
            _isPreview = false;
            if (displayResultEl) displayResultEl.textContent = '';
            return;
        }

        // untuk menampilkan preview hasil saat mengetik
        if (raw === '') {
            display.value = '';
            _isPreview = false;
            if (displayResultEl) displayResultEl.textContent = '';
            return;
        }

        
        const res = calculateResult(raw);
        display.value = raw; 

        if (res !== '' && res !== ERROR_TEXT) {
            if (displayResultEl) {
                displayResultEl.textContent = String(res);
            }
            _isPreview = true;
        } else if (res === ERROR_TEXT) {
            if (displayResultEl) displayResultEl.textContent = ERROR_TEXT;
            _isPreview = true;
        } else {
            if (displayResultEl) displayResultEl.textContent = '';
            _isPreview = false;
        }
    }

    function typeChar(ch) {
        _rawExpr = (_rawExpr || '') + String(ch);
        updateDisplay();
    }

    function backspaceRaw() {
        _rawExpr = (_rawExpr || '').slice(0, -1);
        updateDisplay();
    }

    function clearRaw() {
        _rawExpr = '';
        updateDisplay();
    }

    function commitResult() {
        updateDisplay({ commit: true });
    }

    function addToHistory(expression, result) {
        const listItem = document.createElement('li');
        listItem.textContent = `${expression} = ${result}`;

        listItem.addEventListener('click', () => {
            _rawExpr = String(result) || '';
            updateDisplay();
        });

        historyList.prepend(listItem);
    }


    // pointerdown/up to give immediate touch feedback
    buttons.forEach(button => {
        button.addEventListener('pointerdown', (e) => {
            button.classList.add('active');
        });
        button.addEventListener('pointerup', (e) => {
            button.classList.remove('active');
        });
        button.addEventListener('pointercancel', (e) => {
            button.classList.remove('active');
        });

        button.addEventListener('click', () => {
            const value = button.getAttribute('data-value');

            if (value === '=') {
                commitResult();
            } else if (value === 'C') {
                clearRaw();
            } else if (value === '←') {
                backspaceRaw();
            } else {
                typeChar(value);
            }
        });
    });

    // --- BroadcastChannel for remote control (remote.html uses same channel) ---
    let bc = null;
    if ('BroadcastChannel' in window) {
        bc = new BroadcastChannel('kalkulator');
        bc.onmessage = (ev) => {
            const msg = ev.data;
            if (!msg || !msg.type) return;

            if (msg.type === 'input') {
                // append value from remote only if it's defined
                if (msg.value != null) {
                    typeChar(String(msg.value));
                }
            } else if (msg.type === 'action') {
                if (msg.action === 'enter') {
                    commitResult();
                } else if (msg.action === 'clear') {
                    clearRaw();
                } else if (msg.action === 'backspace') {
                    backspaceRaw();
                }
            }
        };
    }
// --- menginput lewat keyboard ---

    document.addEventListener('keydown', (event) => {
        const key = event.key;

        // Handle Enter
        if (key === 'Enter') {
            event.preventDefault();
            commitResult();
            return;
        }

        // Clear and backspace
        if (key === 'c' || key === 'C') {
            event.preventDefault();
            clearRaw();
            return;
        }

        if (key === 'Backspace') {
            event.preventDefault();
            backspaceRaw();
            return;
        }

        // Printable keys (numbers and operators)
        if (key.length === 1 && /[0-9+\-*/().%\^]/.test(key)) {
            event.preventDefault();
            if (key === '*') {
                typeChar('×');
            } else if (key === '/') {
                typeChar('÷');
            } else {
                typeChar(key);
            }
            return;
        }

        // other keys fall through
    });

    // tombol untuk pindah Dark Mode ---

    if (themeToggleBtn) {
        themeToggleBtn.addEventListener('click', () => {
            document.body.classList.toggle('dark-mode');

            if (document.body.classList.contains('dark-mode')) {
                themeToggleBtn.textContent = '☀️ Mode Terang';
                localStorage.setItem('theme', 'dark');
            } else {
                themeToggleBtn.textContent = '🌙 Mode Gelap';
                localStorage.setItem('theme', 'light');
            }
        });

        // Restore saved theme
        const savedTheme = localStorage.getItem('theme');
        if (savedTheme === 'dark') {
            document.body.classList.add('dark-mode');
            themeToggleBtn.textContent = '☀️ Mode Terang';
        } else {
            document.body.classList.remove('dark-mode');
            themeToggleBtn.textContent = '🌙 Mode Gelap';
        }
    }


    
    // render a single stored item (does not modify storage)
    function renderHistoryItem(item) {
        // ignore malformed entries to avoid showing 'null' or 'undefined'
        if (!item || !item.id || item.expression == null || item.result == null) return;
        const listItem = document.createElement('li');
        listItem.className = 'history-item';
        listItem.dataset.id = item.id;

        const left = document.createElement('span');
        left.textContent = `${String(item.expression)} = ${String(item.result)}`;
        left.style.cursor = 'pointer';
        left.addEventListener('click', () => {
            _rawExpr = String(item.result) || '';
            updateDisplay();
        });

        const delBtn = document.createElement('button');
        delBtn.className = 'history-delete btn ctrl';
        delBtn.textContent = 'Hapus';
        delBtn.setAttribute('aria-label', 'Hapus riwayat');
        delBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            // remove with undo
            deleteHistoryItemWithUndo(item.id);
        });

        listItem.appendChild(left);
        listItem.appendChild(delBtn);
        historyList.prepend(listItem);
    }

    function renderAllHistory() {
        historyList.innerHTML = '';
        if (!Array.isArray(historyData)) historyData = [];
        historyData.forEach(item => renderHistoryItem(item));
    }

    // create a new history item and persist it
    function createHistoryItem(expression, result) {
        // guard against null/undefined/empty values
        if (expression == null || result == null) return;
        const exprStr = String(expression).trim();
        const resStr = String(result).trim();
        const text = `${exprStr} = ${resStr}`;
        // reject empty or literal 'null'/'undefined' strings
        if (exprStr === '' || resStr === '' || resStr === 'null' || resStr === 'undefined') return; 

        const item = {
            id: Date.now().toString(36) + Math.random().toString(36).slice(2,6),
            expression: exprStr,
            result: resStr
        };

        // add to front
        historyData.unshift(item);
        saveHistoryToStorage();
        renderHistoryItem(item);
        return item;
    }

    // Undo helpers
    let lastDeleted = null; // {type: 'item'|'clear', item, index, items}
    let undoTimeoutId = null;

    function showUndoSnackbar(message, onUndo) {
        // remove existing snackbar if any
        const existing = document.querySelector('.undo-snackbar');
        if (existing) existing.remove();

        const bar = document.createElement('div');
        bar.className = 'undo-snackbar';
        bar.setAttribute('role', 'status');
        bar.setAttribute('aria-live', 'polite');

        const txt = document.createElement('span');
        txt.textContent = message || ''; // avoid showing literal 'null' or 'undefined'

        const btn = document.createElement('button');
        btn.className = 'undo-btn btn ctrl';
        btn.textContent = 'Batal';
        btn.addEventListener('click', () => {
            if (undoTimeoutId) clearTimeout(undoTimeoutId);
            onUndo && onUndo();
            bar.remove();
        });

        bar.appendChild(txt);
        bar.appendChild(btn);
        document.body.appendChild(bar);

        // auto-dismiss after 5s
        undoTimeoutId = setTimeout(() => {
            lastDeleted = null;
            bar.remove();
        }, 5000);
    }

    function deleteHistoryItemWithUndo(id) {
        const idx = historyData.findIndex(it => it.id === id);
        if (idx === -1) return;
        const item = historyData[idx];

        // remove immediately from data and UI
        historyData.splice(idx, 1);
        saveHistoryToStorage();
        renderAllHistory();

        // store for undo
        lastDeleted = { type: 'item', item: item, index: idx };

        showUndoSnackbar('Riwayat dihapus', () => {
            // undo: reinsert at previous index
            if (!lastDeleted || lastDeleted.type !== 'item') return;
            historyData.splice(lastDeleted.index, 0, lastDeleted.item);
            saveHistoryToStorage();
            renderAllHistory();
            lastDeleted = null;
        });
    }

    // clear all history with confirmation and undo
    const clearHistoryBtn = document.getElementById('clear-history');
    if (clearHistoryBtn) {
        clearHistoryBtn.addEventListener('click', () => {
            const confirmed = window.confirm('Yakin ingin menghapus semua riwayat?');
            if (!confirmed) return;

            // keep copy for undo
            const previous = Array.isArray(historyData) ? historyData.slice() : [];

            historyData = [];
            saveHistoryToStorage();
            renderAllHistory();

            lastDeleted = { type: 'clear', items: previous };

            showUndoSnackbar('Semua riwayat dihapus', () => {
                if (!lastDeleted || lastDeleted.type !== 'clear') return;
                historyData = Array.isArray(lastDeleted.items) ? lastDeleted.items.slice() : [];
                saveHistoryToStorage();
                renderAllHistory();
                lastDeleted = null;
            });
        });
    }

    // replace addToHistory usage
    // we keep original addToHistory for compatibility but prefer new createHistoryItem
    function addToHistory(expression, result) {
        // Deprecated: kept for compatibility
        createHistoryItem(expression, result);
    }


    // Fokuskan display saat halaman dimuat
    display.focus();
    updateDisplay();
});
