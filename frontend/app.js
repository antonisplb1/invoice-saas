const API_BASE_URL = "http://localhost:8000"; // adjust if needed

// --- Global State for Filtering ---
let activeFilters = {};
let allInvoicesData = [];
// Removed allCustomersData as a global to restore original logic
let currentCustomerInvoices = [];
let currentView = ''; // To track the active view for sidebar styling

document.addEventListener("DOMContentLoaded", () => {
    // --- Initialize UI Components ---
    const toastContainer = document.createElement('div');
    toastContainer.id = 'toast-container';
    document.body.appendChild(toastContainer);

    const modalContainer = document.createElement('div');
    modalContainer.className = 'modal-container';
    modalContainer.innerHTML = `
        <div class="modal-content">
            <h3 id="modal-title"></h3>
            <div id="modal-body">
                <label id="modal-label" for="modal-input"></label>
                <input type="text" id="modal-input" />
            </div>
            <div class="modal-actions">
                <button id="modal-cancel-btn">Cancel</button>
                <button id="modal-confirm-btn">Confirm</button>
            </div>
        </div>
    `;
    document.body.appendChild(modalContainer);

    const filterMenuContainer = document.createElement('div');
    filterMenuContainer.id = 'filter-menu';
    filterMenuContainer.className = 'filter-menu';
    document.body.appendChild(filterMenuContainer);

    const menu = document.createElement('div');
    menu.id = 'global-status-menu';
    menu.style.display = 'none';
    document.body.appendChild(menu);

    const loaderContainer = document.createElement('div');
    loaderContainer.id = 'loader-container';
    loaderContainer.className = 'loader-container';
    loaderContainer.innerHTML = `<div class="loader"></div>`;
    document.body.appendChild(loaderContainer);

    // --- Global Click Listeners ---
    window.addEventListener('click', (e) => {
        const statusMenu = document.getElementById('global-status-menu');
        if (statusMenu && !statusMenu.contains(e.target) && !e.target.closest('.update-status-btn')) {
            statusMenu.style.display = 'none';
        }
        const filterMenu = document.getElementById('filter-menu');
        if (filterMenu && !filterMenu.contains(e.target) && !e.target.closest('.filter-icon')) {
            filterMenu.style.display = 'none';
        }
    });

    // --- MOBILE RESPONSIVENESS LOGIC (ADDITION) ---
    const menuToggle = document.getElementById('mobile-menu-toggle');
    const sidebar = document.querySelector('.sidebar');
    const mainContent = document.getElementById('main-content');

    if (menuToggle && sidebar) {
        menuToggle.addEventListener('click', (e) => {
            e.stopPropagation();
            sidebar.classList.toggle('is-open');
        });
    }

    if (mainContent && sidebar) {
        mainContent.addEventListener('click', () => {
            if (sidebar.classList.contains('is-open')) {
                sidebar.classList.remove('is-open');
            }
        });
    }

    // --- Initial Auth Check ---
    if (localStorage.getItem("access_token")) {
        showApp();
    } else {
        showLogin();
    }
});

// --- Delegated click handler for dynamic Edit Phone buttons ---
document.addEventListener('click', async (e) => {
    const btn = e.target.closest('.btn-edit-phone');
    if (!btn) return;

    const customerId = parseInt(btn.dataset.id, 10);
    const currentPhone = btn.dataset.phone || '';
    await editCustomerPhone(customerId, currentPhone);
});

// --- Helper function to close the sidebar on mobile (ADDITION) ---
function closeSidebar() {
    const sidebar = document.querySelector('.sidebar');
    if (sidebar) {
        sidebar.classList.remove('is-open');
    }
}

// --- Enhanced UI Functions ---
function showLoader() {
    document.getElementById('loader-container').style.display = 'flex';
}

function hideLoader() {
    document.getElementById('loader-container').style.display = 'none';
}

function updateActiveSidebar(view) {
    currentView = view;
    document.querySelectorAll('.sidebar button').forEach(btn => {
        btn.classList.remove('active');
    });
    const activeBtn = document.getElementById(`${view}-btn`);
    if (activeBtn) {
        activeBtn.classList.add('active');
    }
}

function showToast(message, type = 'info') {
    const toastContainer = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = `toast toast--${type}`;
    toast.textContent = message;
    toastContainer.appendChild(toast);
    setTimeout(() => {
        toast.classList.add('toast--fade-out');
        toast.addEventListener('transitionend', () => toast.remove());
    }, 4000);
}

function showPromptModal({ title, label, inputType = 'text', initialValue = '' }) {
    return new Promise((resolve) => {
        const modal = document.querySelector('.modal-container');
        const titleEl = document.getElementById('modal-title');
        const labelEl = document.getElementById('modal-label');
        const inputEl = document.getElementById('modal-input');
        const confirmBtn = document.getElementById('modal-confirm-btn');
        const cancelBtn = document.getElementById('modal-cancel-btn');

        titleEl.textContent = title;
        labelEl.textContent = label;
        inputEl.type = inputType;
        inputEl.value = initialValue;

        modal.style.display = 'flex';
        inputEl.focus();

        const onConfirm = () => {
            cleanup();
            resolve(inputEl.value);
        };
        const onCancel = () => {
            cleanup();
            resolve(null);
        };
        const onKeydown = (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                onConfirm();
            } else if (e.key === 'Escape') {
                onCancel();
            }
        };

        const cleanup = () => {
            modal.style.display = 'none';
            confirmBtn.removeEventListener('click', onConfirm);
            cancelBtn.removeEventListener('click', onCancel);
            modal.removeEventListener('keydown', onKeydown);
        };

        confirmBtn.addEventListener('click', onConfirm);
        cancelBtn.addEventListener('click', onCancel);
        modal.addEventListener('keydown', onKeydown);
    });
}

// --- Auth and Navigation ---
if (document.getElementById("login-form")) {
    document.getElementById("login-form").addEventListener("submit", async (e) => {
        e.preventDefault();
        const form = e.target;
        const email = form.email.value;
        const password = form.password.value;
        showLoader();
        try {
            const response = await fetch(`${API_BASE_URL}/auth/login`, {
                method: "POST",
                headers: { "Content-Type": "application/x-www-form-urlencoded" },
                body: new URLSearchParams({ username: email, password: password })
            });

            if (response.ok) {
                const data = await response.json();
                localStorage.setItem("access_token", data.access_token);
                showApp();
            } else {
                document.getElementById("login-error").innerText = "Invalid credentials. Please try again.";
            }
        } catch (error) {
            console.error("Login failed:", error);
            document.getElementById("login-error").innerText = "An error occurred. Please try again.";
        } finally {
            hideLoader();
        }
    });
}

async function secureFetch(url, options = {}) {
    const token = localStorage.getItem("access_token");
    if (!token) {
        logout();
        throw new Error("No access token found.");
    }
    options.headers = options.headers || {};
    options.headers["Authorization"] = `Bearer ${token}`;
    const response = await fetch(url, options);
    if (response.status === 401) {
        showToast("Session expired or unauthorized. Please log in again.", 'error');
        logout();
        throw new Error("Unauthorized");
    }
    return response;
}

function showLogin() {
    document.getElementById("login-screen").style.display = "block";
    document.getElementById("app").style.display = "none";
}

function showApp() {
    document.getElementById("login-screen").style.display = "none";
    document.getElementById("app").style.display = "flex";
    attachMenuEvents();
    loadAllInvoices();
}

function logout() {
    localStorage.removeItem("access_token");
    window.location.reload();
}

function attachMenuEvents() {
    const createBtn = document.getElementById("create-invoice-btn");
    const allBtn = document.getElementById("all-invoices-btn");
    const custBtn = document.getElementById("customers-btn");
    const stripeBtn = document.getElementById("stripe-connect-btn");
    const dashBtn = document.getElementById("stripe-dashboard-btn");
    const logoutBtn = document.getElementById("logout-btn");

    if (createBtn) createBtn.onclick = loadCreateInvoiceForm;
    if (allBtn) allBtn.onclick = loadAllInvoices;
    if (custBtn) custBtn.onclick = loadCustomers;
    if (stripeBtn) stripeBtn.onclick = handleStripeConnect;
    if (dashBtn) dashBtn.onclick = redirectToStripeDashboard;
    if (logoutBtn) logoutBtn.onclick = logout;
}

function redirectToStripeDashboard() {
    closeSidebar(); // ADDED
    window.open("https://dashboard.stripe.com/", "_blank");
}

async function handleStripeConnect() {
    closeSidebar(); // ADDED
    const response = await secureFetch(`${API_BASE_URL}/stripe/connect-stripe-account`);
    const data = await response.json();
    window.location.href = data.url;
}

function loadCreateInvoiceForm() {
    closeSidebar(); // ADDED
    loadCreateInvoiceFormPrefilled();
}

function loadCreateInvoiceFormPrefilled(customer = null) {
    closeSidebar(); // ADDED
    updateActiveSidebar('create-invoice');
    activeFilters = {};
    const today = new Date().toISOString().split('T')[0];
    const content = `
        <h3>Create Invoice</h3>
        <form id="create-invoice-form">
            <label>Customer First Name:<input type="text" name="customer_first_name" required value="${customer ? customer.first_name : ''}"></label>
            <label>Customer Last Name:<input type="text" name="customer_last_name" required value="${customer ? customer.last_name : ''}"></label>
            <label>Customer Email:<input type="email" name="customer_email" required value="${customer ? customer.email : ''}"></label>
            <label>Amount:<input type="number" name="amount" required step="0.01"></label>
            <label>Issue Date:<input type="date" name="issue_date" value="${today}" required></label>
            <label style="display: flex; align-items: center; cursor: pointer;"><input type="checkbox" name="is_recurring"> Is Recurring</label>
            <div id="recurring-fields" style="display:none; display: flex; flex-direction: column; gap: 1.5rem;">
                <label>Frequency:
                    <select name="frequency">
                        <option value="monthly">Monthly</option>
                        <option value="yearly">Yearly</option>
                    </select>
                </label>
                <label>Recurring Amount:<input type="number" name="recurring_amount" step="0.01"></label>
            </div>
            <label>Notes:<textarea name="notes"></textarea></label>
            <button type="submit" class="btn btn-primary">Create Invoice</button>
        </form>
    `;
    document.getElementById("main-content").innerHTML = content;

    const form = document.getElementById("create-invoice-form");
    const isRecurringCheckbox = form.querySelector('input[name="is_recurring"]');
    isRecurringCheckbox.addEventListener("change", () => {
        document.getElementById("recurring-fields").style.display = isRecurringCheckbox.checked ? "flex" : "none";
    });

    form.addEventListener("submit", async (e) => {
        e.preventDefault();
        const formData = new FormData(form);
        const jsonData = Object.fromEntries(formData.entries());
        jsonData.is_recurring = !!jsonData.is_recurring;
        if (jsonData.is_recurring) {
            jsonData.recurring_amount = parseFloat(jsonData.recurring_amount);
        } else {
            delete jsonData.frequency;
            delete jsonData.recurring_amount;
        }
        showLoader();
        try {
            const response = await secureFetch(`${API_BASE_URL}/invoices/`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(jsonData)
            });
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.detail || response.statusText);
            }
            const result = await response.json();
            showToast(`Invoice Created: ID ${result.id}`, 'success');
            loadAllInvoices();
        } catch (error) {
            showToast(`Error: ${error.message}`, 'error');
        } finally {
            hideLoader();
        }
    });
}

async function updateRecurringAmount(invoiceId, customerId, isRecurring) {
    if (!isRecurring) {
        showToast("Cannot update a non-recurring invoice.", 'error');
        return;
    }

    const newAmountStr = await showPromptModal({
        title: 'Update Recurring Amount',
        label: 'Enter the new amount:',
        inputType: 'number',
    });

    if (newAmountStr === null) return;

    const newAmount = parseFloat(newAmountStr);
    if (isNaN(newAmount) || newAmountStr.trim() === '') {
        showToast("Invalid amount entered.", 'error');
        return;
    }

    showLoader();
    try {
        await secureFetch(`${API_BASE_URL}/invoices/${invoiceId}/recurring-amount`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ recurring_amount: newAmount })
        });
        showToast("Recurring amount updated!", 'success');
        loadCustomerInvoices(customerId); // Reload to show updated data
    } catch (error) {
        showToast("Failed to update recurring amount.", 'error');
    } finally {
        hideLoader();
    }
}

async function updateInvoiceStatus(invoiceId, newStatus, customerId) {
    showLoader();
    try {
        const response = await secureFetch(`${API_BASE_URL}/invoices/${invoiceId}/status`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ status: newStatus })
        });

        if (response.ok) {
            showToast("Invoice status updated successfully!", 'success');
            if(currentView === 'all-invoices') {
                loadAllInvoices();
            } else {
                loadCustomerInvoices(customerId); 
            }
        } else {
            const errorData = await response.json();
            showToast(`Error: ${errorData.detail || 'Invalid status transition'}`, 'error');
        }
    } catch (error) {
        console.error("Failed to update invoice status:", error);
        showToast("An error occurred while updating the status.", 'error');
    } finally {
        hideLoader();
    }
}

function showStatusOptions(invoiceId, currentStatus, customerId, buttonElement) {
    const menu = document.getElementById('global-status-menu');
    if (!menu || !buttonElement) return;

    if (menu.style.display === 'block' && menu.dataset.opener === buttonElement.id) {
        menu.style.display = 'none';
        return;
    }

    const hideMenuJs = "document.getElementById('global-status-menu').style.display='none';";

    let optionsHtml = '';
    if (currentStatus !== 'Paid') {
        optionsHtml += `<button class="btn-ghost" onclick="${hideMenuJs} updateInvoiceStatus(${invoiceId}, 'Paid', ${customerId})">Mark as Paid</button>`;
    }
    if (currentStatus !== 'Due') {
        optionsHtml += `<button class="btn-ghost" onclick="${hideMenuJs} updateInvoiceStatus(${invoiceId}, 'Due', ${customerId})">Mark as Due</button>`;
    }
    if (currentStatus !== 'canceled') {
        optionsHtml += `<button class="btn-ghost" onclick="${hideMenuJs} updateInvoiceStatus(${invoiceId}, 'canceled', ${customerId})">Cancel Invoice</button>`;
    }
    menu.innerHTML = optionsHtml;
    menu.className = 'status-options';

    const buttonRect = buttonElement.getBoundingClientRect();

    menu.style.visibility = 'hidden';
    menu.style.display = 'block';
    const menuHeight = menu.offsetHeight;
    const menuWidth = menu.offsetWidth;
    menu.style.display = 'none';
    menu.style.visibility = 'visible';

    let top;
    let left = buttonRect.left;

    if ((window.innerHeight - buttonRect.bottom) < menuHeight + 10) {
        top = buttonRect.top - menuHeight - 4;
    } else {
        top = buttonRect.bottom + 4;
    }

    if ((left + menuWidth) > window.innerWidth) {
        left = buttonRect.right - menuWidth;
    }

    menu.style.top = `${top}px`;
    menu.style.left = `${left}px`;
    menu.style.display = 'block';

    menu.dataset.opener = buttonElement.id;
}

function openFilterMenu(e, data, onApply) {
    const icon = e.target;
    const columnKey = icon.dataset.column;
    const columnType = icon.dataset.type || 'string';
    const menu = document.getElementById('filter-menu');

    const uniqueValues = [...new Set(data.map(item => item[columnKey]))]
        .filter(value => value !== null && value !== undefined && value !== '')
        .sort((a, b) => String(a).localeCompare(String(b), undefined, { numeric: true }));

    const currentSelections = activeFilters[columnKey] || [];

    const renderListItems = (filterText = '') => {
        const filteredValues = uniqueValues
            .filter(value => String(value).toLowerCase().includes(filterText.toLowerCase()));
        
        if (filteredValues.length === 0) {
            return `<li class="filter-menu-item">No matches found.</li>`;
        }
        
        return filteredValues.map(value => {
                let displayValue = value;
                if (columnType === 'boolean') {
                    displayValue = value ? 'Yes' : 'No';
                }
                const isChecked = currentSelections.includes(String(value));
                return `
                    <li class="filter-menu-item">
                        <label>
                            <input type="checkbox" value="${value}" ${isChecked ? 'checked' : ''}>
                            ${displayValue}
                        </label>
                    </li>`;
            }).join('');
    };

    menu.innerHTML = `
        <div class="filter-menu-search">
            <input type="text" id="filter-search-input" placeholder="Search values...">
        </div>
        <ul class="filter-menu-list">${renderListItems()}</ul>
        <div class="filter-menu-actions">
            <button id="filter-apply-btn">Apply</button>
            <button id="filter-clear-btn">Clear Filter</button>
        </div>
    `;

    const searchInput = document.getElementById('filter-search-input');
    const listElement = menu.querySelector('.filter-menu-list');
    searchInput.addEventListener('input', () => {
        listElement.innerHTML = renderListItems(searchInput.value);
    });

    const headerCell = icon.closest('th');
    const rect = headerCell.getBoundingClientRect();
    menu.style.display = 'block';
    menu.style.top = `${rect.bottom + 2}px`;
    menu.style.left = `${rect.left}px`;
    searchInput.focus();

    document.getElementById('filter-apply-btn').onclick = () => {
        const selectedValues = Array.from(menu.querySelectorAll('input[type="checkbox"]:checked'))
            .map(cb => cb.value);

        if (selectedValues.length > 0) {
            activeFilters[columnKey] = selectedValues;
        } else {
            delete activeFilters[columnKey];
        }
        menu.style.display = 'none';
        onApply();
    };

    document.getElementById('filter-clear-btn').onclick = () => {
        delete activeFilters[columnKey];
        menu.style.display = 'none';
        onApply();
    };
}

function applyAndRenderFilters(data, tbody, renderFn, extraParam = null) {
    let filteredData = [...data];

    for (const columnKey in activeFilters) {
        const filterValues = activeFilters[columnKey];
        if (filterValues && filterValues.length > 0) {
            filteredData = filteredData.filter(item =>
                filterValues.includes(String(item[columnKey]))
            );
        }
    }

    document.querySelectorAll('.filter-icon').forEach(icon => {
        if (activeFilters[icon.dataset.column]) {
            icon.classList.add('active');
        } else {
            icon.classList.remove('active');
        }
    });
    
    const clearAllBtn = document.getElementById('clear-all-filters-btn');
    if(clearAllBtn) {
        clearAllBtn.style.display = Object.keys(activeFilters).length > 0 ? 'inline-flex' : 'none';
    }

    if (extraParam !== null) {
        renderFn(filteredData, extraParam, tbody);
    } else {
        renderFn(filteredData, tbody);
    }
}

function renderAllInvoiceRows(invoicesToRender, tbody) {
    tbody.innerHTML = "";
    if (invoicesToRender.length === 0) {
        tbody.innerHTML = '<tr><td colspan="8" style="text-align:center; padding: 2rem;">No invoices match the current filters.</td></tr>';
        return;
    }
    invoicesToRender.forEach(inv => {
        tbody.innerHTML += `
            <tr>
                <td>${inv.id}</td>
                <td class="status-${inv.status.toLowerCase()}">${inv.status}</td>
                <td>${inv.is_recurring ? 'Yes' : 'No'}</td>
                <td>${inv.issue_date}</td>
                <td>${new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(inv.amount)}</td>
                <td>${inv.frequency ?? '-'}</td>
                <td>${inv.customer_email}</td>
                <td>${inv.notes ?? ''}</td>
            </tr>`;
    });
}

async function loadAllInvoices() {
    closeSidebar(); // ADDED
    updateActiveSidebar('all-invoices');
    activeFilters = {};

    const content = `
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem;">
            <h3 style="margin: 0;">All Invoices</h3>
            <button id="clear-all-filters-btn" style="display:none;">Clear All Filters</button>
        </div>
        <div class="table-wrapper">
            <table>
                <thead>
                    <tr>
                        <th>ID <button class="filter-icon" data-column="id">&#x25BC;</button></th>
                        <th>Status <button class="filter-icon" data-column="status">&#x25BC;</button></th>
                        <th>Recurring <button class="filter-icon" data-column="is_recurring" data-type="boolean">&#x25BC;</button></th>
                        <th>Issue Date <button class="filter-icon" data-column="issue_date">&#x25BC;</button></th>
                        <th>Amount <button class="filter-icon" data-column="amount">&#x25BC;</button></th>
                        <th>Frequency <button class="filter-icon" data-column="frequency">&#x25BC;</button></th>
                        <th>Customer <button class="filter-icon" data-column="customer_email">&#x25BC;</button></th>
                        <th>Notes <button class="filter-icon" data-column="notes">&#x25BC;</button></th>
                    </tr>
                </thead>
                <tbody id="invoice-table-body"></tbody>
            </table>
        </div>`;
    document.getElementById("main-content").innerHTML = content;

    const tbody = document.getElementById("invoice-table-body");
    const onApplyFilters = () => applyAndRenderFilters(allInvoicesData, tbody, renderAllInvoiceRows);

    document.getElementById('clear-all-filters-btn').onclick = () => {
        activeFilters = {};
        onApplyFilters();
    };

    document.querySelectorAll('.filter-icon').forEach(icon => {
        icon.addEventListener('click', (e) => {
            e.stopPropagation();
            openFilterMenu(e, allInvoicesData, onApplyFilters);
        });
    });
    
    showLoader();
    try {
        const response = await secureFetch(`${API_BASE_URL}/invoices/all`);
        allInvoicesData = await response.json();
        onApplyFilters();
    } catch (error) {
        console.error("Failed to fetch invoices:", error);
        tbody.innerHTML = '<tr><td colspan="8">Failed to load invoices.</td></tr>';
    } finally {
        hideLoader();
    }
}

function renderCustomerInvoiceRows(invoicesToRender, customerId, tbody) {
    tbody.innerHTML = "";
    if (invoicesToRender.length === 0) {
        tbody.innerHTML = '<tr><td colspan="9" style="text-align:center; padding: 2rem;">No invoices match the current filters.</td></tr>';
        return;
    }
    invoicesToRender.forEach(inv => {
        const row = document.createElement('tr');
        // The only change is adding the "btn" class to the "Update Status" button below
        row.innerHTML = `
            <td>${inv.id}</td>
            <td class="status-${inv.status.toLowerCase()}">${inv.status}</td>
            <td>${inv.is_recurring ? 'Yes' : 'No'}</td>
            <td>${inv.issue_date}</td>
            <td>${new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(inv.amount)}</td>
            <td>${inv.frequency ?? '-'}</td>
            <td>${inv.recurring_amount ? new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(inv.recurring_amount) : '-'}</td>
            <td>${inv.notes ?? ''}</td>
            <td class="actions-cell">
                <button class="btn btn-update-recurring">Update Recurring</button>
                <button class="btn update-status-btn" id="update-status-btn-${inv.id}">Update Status</button>
            </td>`;

        row.querySelector('.btn-update-recurring').onclick = () => updateRecurringAmount(inv.id, customerId, inv.is_recurring);
        row.querySelector('.update-status-btn').onclick = (e) => showStatusOptions(inv.id, inv.status, customerId, e.currentTarget);
        tbody.appendChild(row);
    });
}

async function loadCustomerInvoices(customerId) {
    closeSidebar(); // ADDED
    activeFilters = {};
    updateActiveSidebar('');

    const content = `
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem;">
             <h3>Customer Invoices</h3>
             <button id="clear-all-filters-btn" style="display:none;">Clear All Filters</button>
        </div>
        <div class="table-wrapper">
            <table>
                <thead>
                    <tr>
                        <th>ID <button class="filter-icon" data-column="id">&#x25BC;</button></th>
                        <th>Status <button class="filter-icon" data-column="status">&#x25BC;</button></th>
                        <th>Recurring <button class="filter-icon" data-column="is_recurring" data-type="boolean">&#x25BC;</button></th>
                        <th>Issue Date <button class="filter-icon" data-column="issue_date">&#x25BC;</button></th>
                        <th>Amount <button class="filter-icon" data-column="amount">&#x25BC;</button></th>
                        <th>Frequency <button class="filter-icon" data-column="frequency">&#x25BC;</button></th>
                        <th>Recurring Amt <button class="filter-icon" data-column="recurring_amount">&#x25BC;</button></th>
                        <th>Notes <button class="filter-icon" data-column="notes">&#x25BC;</button></th>
                        <th>Actions</th>
                    </tr>
                </thead>
                <tbody id="customer-invoice-table-body"></tbody>
            </table>
        </div>`;
    document.getElementById("main-content").innerHTML = content;

    const tbody = document.getElementById("customer-invoice-table-body");
    const onApplyFilters = () => applyAndRenderFilters(currentCustomerInvoices, tbody, renderCustomerInvoiceRows, customerId);

    document.getElementById('clear-all-filters-btn').onclick = () => {
        activeFilters = {};
        onApplyFilters();
    };

    document.querySelectorAll('.filter-icon').forEach(icon => {
        icon.addEventListener('click', (e) => {
            e.stopPropagation();
            openFilterMenu(e, currentCustomerInvoices, onApplyFilters);
        });
    });

    showLoader();
    try {
        const response = await secureFetch(`${API_BASE_URL}/customers/${customerId}/invoices`);
        currentCustomerInvoices = await response.json();
        onApplyFilters();
    } catch (error) {
        console.error("Failed to fetch customer invoices:", error);
        tbody.innerHTML = '<tr><td colspan="9">Failed to load invoices.</td></tr>';
    } finally {
        hideLoader();
    }
}

// ==========================================================
// RESTORED ORIGINAL WORKING LOGIC FOR `loadCustomers` (with Phone edits)
// ==========================================================
async function loadCustomers() {
    closeSidebar(); // ADDED
    updateActiveSidebar('customers');
    let allCustomers = []; // Using local variable as in original script

    const content = `
        <h3>Customers</h3>
        <div class="controls-container" style="display: flex; flex-wrap: wrap; gap: 1rem; align-items: center; margin-bottom: 1.5rem;">
            <div class="filter-controls" style="display: flex; gap: 1rem; align-items: center;">
                <span>Status:</span>
                <label style="cursor:pointer; display:flex; align-items:center;"><input type="radio" name="customer-status-filter" value="all" checked> All</label>
                <label style="cursor:pointer; display:flex; align-items:center;"><input type="radio" name="customer-status-filter" value="active"> Active</label>
                <label style="cursor:pointer; display:flex; align-items:center;"><input type="radio" name="customer-status-filter" value="inactive"> Inactive</label>
            </div>
            <input type="text" id="customer-search" placeholder="Search customers..." class="search-input" style="flex: 1; min-width: 250px;">
        </div>
        <div class="table-wrapper">
        <table>
            <thead>
                <tr>
                    <th>First Name</th>
                    <th>Last Name</th>
                    <th>Email</th>
                    <th>Phone</th>          <!-- NEW -->
                    <th>Active</th>
                    <th>Actions</th>
                </tr>
            </thead>
            <tbody id="customer-table-body"></tbody>
        </table>
        </div>`;
    document.getElementById("main-content").innerHTML = content;
    
    const tbody = document.getElementById("customer-table-body");
    const searchInput = document.getElementById("customer-search");
    const statusFilters = document.querySelectorAll('input[name="customer-status-filter"]');

    const applyCustomerSearch = (customers) => {
        const query = searchInput.value.toLowerCase();
        const filteredByText = customers.filter(cust => {
            const match = `${cust.first_name} ${cust.last_name} ${cust.email} ${cust.phone || ''}`.toLowerCase(); // includes phone
            return match.includes(query);
        });
        renderCustomerRows(filteredByText, tbody);
    };

    const fetchAndRender = async (filter = 'all') => {
        showLoader();
        try {
            let url = `${API_BASE_URL}/customers`;
            if (filter === 'active') {
                url += '?is_active=true';
            } else if (filter === 'inactive') {
                url += '?is_active=false';
            }

            const response = await secureFetch(url);
            allCustomers = await response.json();
            applyCustomerSearch(allCustomers);
        } catch (error) {
            console.error("Failed to fetch customers:", error);
            tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;">Failed to load customers.</td></tr>';
        } finally {
            hideLoader();
        }
    };

    searchInput.addEventListener("input", () => applyCustomerSearch(allCustomers));

    statusFilters.forEach(radio => {
        radio.addEventListener('change', (e) => {
            fetchAndRender(e.target.value);
        });
    });

    fetchAndRender('all');
}

function renderCustomerRows(customersToRender, tbody) {
    tbody.innerHTML = "";
    if (customersToRender.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;">No customers found.</td></tr>';
        return;
    }
    customersToRender.forEach(cust => {
        const rowClass = !cust.has_active_invoices ? 'customer-inactive' : '';
        tbody.innerHTML += `
            <tr class="${rowClass}">
                <td>${cust.first_name}</td>
                <td>${cust.last_name}</td>
                <td>${cust.email}</td>
                <td>${cust.phone ? cust.phone : ''}</td>
                <td>${cust.has_active_invoices ? 'Yes' : 'No'}</td>
                <td class="actions-cell">
                    <button class="btn" onclick="loadCustomerInvoices(${cust.id})">View Invoices</button>
                    <button class="btn" onclick='loadCreateInvoiceFormPrefilled(${JSON.stringify(cust)})'>Create Invoice</button>
                    <button
                        class="btn btn-edit-phone"
                        data-id="${cust.id}"
                        data-phone="${(cust.phone || '').replace(/&/g,'&amp;').replace(/"/g,'&quot;')}"
                    >Edit</button>
                </td>
            </tr>
        `;
    });
}

// ---- Edit Phone handler (uses your modal + secureFetch) ----
async function editCustomerPhone(customerId, currentPhone) {
  const newPhone = await showPromptModal({
    title: 'Edit Phone',
    label: 'Phone number',
    inputType: 'text',
    initialValue: currentPhone || ''
  });
  if (newPhone === null) return; // user cancelled

  try {
    showLoader();
    const res = await secureFetch(`${API_BASE_URL}/customers/${customerId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone: newPhone.trim() || null })
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || 'Failed to update customer');
    }
    showToast('Customer updated.', 'success');
    // Reload customers with current filter
    const selected = document.querySelector('input[name="customer-status-filter"]:checked');
    if (selected) {
      // Trigger the existing fetch path with the current filter
      const value = selected.value;
      selected.checked = true;
      const evt = new Event('change');
      selected.dispatchEvent(evt);
    } else {
      loadCustomers();
    }
  } catch (e) {
    console.error(e);
    showToast('Could not update customer.', 'error');
  } finally {
    hideLoader();
  }
}
