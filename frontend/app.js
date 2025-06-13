const API_BASE_URL = "http://localhost:8000"; // adjust if needed

document.addEventListener("DOMContentLoaded", () => {
    // --- Initialize UI Components ---
    const toastContainer = document.createElement('div');
    toastContainer.id = 'toast-container';
    document.body.appendChild(toastContainer);

    const modalContainer = document.createElement('div');
    modalContainer.id = 'modal-container';
    modalContainer.className = 'modal-container';
    modalContainer.innerHTML = `
        <div class="modal-content">
            <h3 id="modal-title"></h3>
            <div id="modal-body">
                <label id="modal-label" for="modal-input"></label>
                <input type="text" id="modal-input" />
            </div>
            <div class="modal-actions">
                <button id="modal-cancel-btn" class="btn btn-secondary">Cancel</button>
                <button id="modal-confirm-btn" class="btn btn-primary">Confirm</button>
            </div>
        </div>
    `;
    document.body.appendChild(modalContainer);

    const menu = document.createElement('div');
    menu.id = 'global-status-menu';
    menu.style.display = 'none'; 
    document.body.appendChild(menu);

    window.addEventListener('click', (e) => {
        const statusMenu = document.getElementById('global-status-menu');
        if (statusMenu && !statusMenu.contains(e.target) && !e.target.matches('.update-status-btn')) {
            statusMenu.style.display = 'none';
        }
    });

    // --- Check Login Status ---
    if (localStorage.getItem("access_token")) {
        showApp();
    } else {
        showLogin();
    }
});

// --- Toast Notification System ---
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

// --- Asynchronous Modal Prompt System ---
function showPromptModal({ title, label, inputType = 'text', initialValue = '' }) {
    return new Promise((resolve) => {
        const modal = document.getElementById('modal-container');
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

document.getElementById("login-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const form = e.target;
    const email = form.email.value;
    const password = form.password.value;

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
    }
});

async function secureFetch(url, options = {}) {
    const token = localStorage.getItem("access_token");
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
}

function logout() {
    localStorage.removeItem("access_token");
    window.location.reload();
}

function showStatusOptions(invoiceId, currentStatus, customerId, buttonElement) {
    const menu = document.getElementById('global-status-menu');
    if (!menu || !buttonElement) return;

    if (menu.style.display === 'block' && menu.dataset.opener === buttonElement) {
        menu.style.display = 'none';
        return;
    }

    const hideMenuJs = "document.getElementById('global-status-menu').style.display='none';";

    let optionsHtml = '';
    if (currentStatus !== 'Paid') {
        optionsHtml += `<button class="btn btn-ghost" onclick="${hideMenuJs} updateInvoiceStatus(${invoiceId}, 'Paid', ${customerId})">Mark as Paid</button>`;
    }
    if (currentStatus !== 'Due') {
        optionsHtml += `<button class="btn btn-ghost" onclick="${hideMenuJs} updateInvoiceStatus(${invoiceId}, 'Due', ${customerId})">Mark as Due</button>`;
    }
    if (currentStatus !== 'canceled') {
        optionsHtml += `<button class="btn btn-ghost" onclick="${hideMenuJs} updateInvoiceStatus(${invoiceId}, 'canceled', ${customerId})">Cancel Invoice</button>`;
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
    
    menu.dataset.opener = buttonElement;
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

    const sidebarButtons = document.querySelectorAll('.sidebar button');
    sidebarButtons.forEach(btn => btn.classList.add('btn', 'btn-sidebar'));
}

function redirectToStripeDashboard() {
    window.open("https://dashboard.stripe.com/", "_blank");
}

async function handleStripeConnect() {
    const response = await secureFetch(`${API_BASE_URL}/stripe/connect-stripe-account`);
    const data = await response.json();
    window.location.href = data.url;
}

function loadCreateInvoiceForm() {
    loadCreateInvoiceFormPrefilled();
}

function loadCreateInvoiceFormPrefilled(customer = null) {
    const today = new Date().toISOString().split('T')[0];
    const content = `
        <h3>Create Invoice</h3>
        <form id="create-invoice-form">
            <label>Customer First Name:<input type="text" name="customer_first_name" required value="${customer ? customer.first_name : ''}"></label>
            <label>Customer Last Name:<input type="text" name="customer_last_name" required value="${customer ? customer.last_name : ''}"></label>
            <label>Customer Email:<input type="email" name="customer_email" required value="${customer ? customer.email : ''}"></label>
            <label>Amount:<input type="number" name="amount" required></label>
            <label>Issue Date:<input type="date" name="issue_date" value="${today}" required></label>
            <label><input type="checkbox" name="is_recurring"> Is Recurring</label>
            <div id="recurring-fields" style="display:none;">
                <label>Frequency:
                    <select name="frequency">
                        <option value="monthly">Monthly</option>
                        <option value="yearly">Yearly</option>
                    </select>
                </label>
                <label>Recurring Amount:<input type="number" name="recurring_amount"></label>
            </div>
            <label>Notes:<textarea name="notes"></textarea></label>
            <button type="submit" class="btn btn-primary">Create Invoice</button>
        </form>
    `;
    document.getElementById("main-content").innerHTML = content;
    attachMenuEvents();

    const form = document.getElementById("create-invoice-form");
    const isRecurringCheckbox = form.querySelector('input[name="is_recurring"]');
    isRecurringCheckbox.addEventListener("change", () => {
        document.getElementById("recurring-fields").style.display = isRecurringCheckbox.checked ? "block" : "none";
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
        try {
            const response = await secureFetch(`${API_BASE_URL}/invoices/`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(jsonData)
            });
            if (!response.ok) {
                const errorData = await response.json();
                showToast(`Error: ${errorData.detail || response.statusText}`, 'error');
                return;
            }
            const result = await response.json();
            showToast(`Invoice Created: ID ${result.id}`, 'success');
            loadAllInvoices();
        } catch (error) {
            showToast('Failed to create invoice.', 'error');
        }
    });
}

function renderAllInvoiceRows(invoicesToRender, tbody) {
    tbody.innerHTML = "";
    invoicesToRender.forEach(inv => {
        let rowClass = "";
        if (inv.status === "Paid") rowClass = 'status-paid';
        else if (inv.status === "canceled") rowClass = 'status-canceled';
        else if (inv.status === "Due") rowClass = 'status-due';

        tbody.innerHTML += `<tr class="${rowClass}">
            <td>${inv.id}</td>
            <td>${inv.status}</td>
            <td>${inv.is_recurring ? 'Yes' : 'No'}</td>
            <td>${inv.issue_date}</td>
            <td>${inv.amount}</td>
            <td>${inv.frequency}</td>
            <td>${inv.recurring_amount ?? '-'}</td>
            <td>${inv.customer_email}</td>
            <td>${inv.notes}</td>
        </tr>`;
    });
}

async function loadAllInvoices() {
    const response = await secureFetch(`${API_BASE_URL}/invoices/all`);
    const invoices = await response.json();

    const content = `
        <h3>All Invoices</h3>
        <input type="text" id="invoice-search" placeholder="Search invoices..." class="search-input">
        <div class="table-wrapper">
        <table>
            <thead>
                <tr>
                    <th>ID</th>
                    <th>Status</th>
                    <th>Is Recurring</th>
                    <th>Issue Date</th>
                    <th>Amount</th>
                    <th>Frequency</th>
                    <th>Next Payment</th>
                    <th>Customer</th>
                    <th>Notes</th>
                </tr>
            </thead>
            <tbody id="invoice-table-body"></tbody>
        </table></div>`;
    document.getElementById("main-content").innerHTML = content;
    
    const tbody = document.getElementById("invoice-table-body");
    renderAllInvoiceRows(invoices, tbody);

    attachMenuEvents();

    const input = document.getElementById("invoice-search");
    input.addEventListener("input", () => {
        const query = input.value.toLowerCase();
        const filteredInvoices = invoices.filter(inv => {
            const rowText = `${inv.id} ${inv.status} ${inv.is_recurring} ${inv.issue_date} ${inv.amount} ${inv.frequency ?? ''} ${inv.recurring_amount ?? ''} ${inv.customer_email} ${inv.notes}`.toLowerCase();
            return rowText.includes(query);
        });
        renderAllInvoiceRows(filteredInvoices, tbody);
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

    try {
        await secureFetch(`${API_BASE_URL}/invoices/${invoiceId}/recurring-amount`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ recurring_amount: newAmount })
        });
        showToast("Recurring amount updated!", 'success');
        if (customerId) {
            loadCustomerInvoices(customerId);
        } else {
            loadAllInvoices();
        }
    } catch (error) {
        showToast("Failed to update recurring amount.", 'error');
    }
}

async function updateInvoiceStatus(invoiceId, newStatus, customerId) {
    try {
        const response = await secureFetch(`${API_BASE_URL}/invoices/${invoiceId}/status`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ status: newStatus })
        });

        if (response.ok) {
            showToast("Invoice status updated successfully!", 'success');
            loadCustomerInvoices(customerId);
        } else {
            const errorData = await response.json();
            showToast(`Error: ${errorData.detail || 'Invalid status transition'}`, 'error');
        }
    } catch (error) {
        console.error("Failed to update invoice status:", error);
        showToast("An error occurred while updating the status.", 'error');
    }
}

// --- MODIFIED --- Adds "Active" column and highlighting
function renderCustomerRows(customersToRender, tbody) {
    tbody.innerHTML = "";
    customersToRender.forEach(cust => {
        const rowClass = !cust.has_active_invoices ? 'customer-inactive' : '';

        tbody.innerHTML += `
            <tr class="${rowClass}">
                <td>${cust.first_name}</td>
                <td>${cust.last_name}</td>
                <td>${cust.email}</td>
                <td>${cust.has_active_invoices ? 'Yes' : 'No'}</td>
                <td>
                    <button class="btn btn-secondary btn-sm" onclick="loadCustomerInvoices(${cust.id})">View Invoices</button>
                    <button class="btn btn-secondary btn-sm" onclick='loadCreateInvoiceFormPrefilled(${JSON.stringify(cust)})'>Create Invoice</button>
                </td>
            </tr>
        `;
    });
}

// --- MODIFIED --- Renders filter controls and handles fetching/searching
async function loadCustomers() {
    let allCustomers = []; // Store the full list for client-side text search

    const content = `
        <h3>Customers</h3>
        <div class="controls-container">
            <div class="filter-controls">
                <span>Status:</span>
                <label><input type="radio" name="customer-status-filter" value="all" checked> All</label>
                <label><input type="radio" name="customer-status-filter" value="active"> Active</label>
                <label><input type="radio" name="customer-status-filter" value="inactive"> Inactive</label>
            </div>
            <input type="text" id="customer-search" placeholder="Search customers..." class="search-input">
        </div>
        <div class="table-wrapper">
        <table>
            <thead>
                <tr>
                    <th>First Name</th>
                    <th>Last Name</th>
                    <th>Email</th>
                    <th>Active</th>
                    <th>Actions</th>
                </tr>
            </thead>
            <tbody id="customer-table-body"></tbody>
        </table>`;
    document.getElementById("main-content").innerHTML = content;
    attachMenuEvents();
    
    const tbody = document.getElementById("customer-table-body");
    const searchInput = document.getElementById("customer-search");
    const statusFilters = document.querySelectorAll('input[name="customer-status-filter"]');

    const fetchAndRender = async (filter = 'all') => {
        let url = `${API_BASE_URL}/customers`;
        if (filter === 'active') {
            url += '?is_active=true';
        } else if (filter === 'inactive') {
            url += '?is_active=false';
        }

        const response = await secureFetch(url);
        allCustomers = await response.json();
        
        // Apply text search on the newly fetched list
        const query = searchInput.value.toLowerCase();
        const filteredByText = allCustomers.filter(cust => {
            const match = `${cust.first_name} ${cust.last_name} ${cust.email}`.toLowerCase();
            return match.includes(query);
        });
        renderCustomerRows(filteredByText, tbody);
    };
    
    // Text search listener
    searchInput.addEventListener("input", () => {
        const query = searchInput.value.toLowerCase();
        const filteredByText = allCustomers.filter(cust => {
            const match = `${cust.first_name} ${cust.last_name} ${cust.email}`.toLowerCase();
            return match.includes(query);
        });
        renderCustomerRows(filteredByText, tbody);
    });

    // Status filter listener
    statusFilters.forEach(radio => {
        radio.addEventListener('change', (e) => {
            fetchAndRender(e.target.value);
        });
    });

    // Initial load
    fetchAndRender('all');
}


function renderCustomerInvoiceRows(invoicesToRender, customerId, tbody) {
    tbody.innerHTML = "";
    invoicesToRender.forEach(inv => {
        let rowClass = "";
        if (inv.status === "Paid") rowClass = 'status-paid';
        else if (inv.status === "canceled") rowClass = 'status-canceled';
        else if (inv.status === "Due") rowClass = 'status-due';

        tbody.innerHTML += `<tr class="${rowClass}">
            <td>${inv.id}</td>
            <td>${inv.status}</td>
            <td>${inv.is_recurring ? 'Yes' : 'No'}</td>
            <td>${inv.issue_date}</td>
            <td>${inv.amount}</td>
            <td>${inv.frequency ?? '-'}</td>
            <td>${inv.recurring_amount ?? '-'}</td>
            <td>${inv.notes}</td>
            <td class="actions-cell">
                <button class="btn btn-secondary btn-sm" onclick="updateRecurringAmount(${inv.id}, ${customerId}, ${inv.is_recurring})">Update Recurring</button>
                <button class="btn btn-secondary btn-sm update-status-btn" onclick="showStatusOptions(${inv.id}, '${inv.status}', ${customerId}, this)">Update Status</button>
            </td>
        </tr>`;
    });
}

async function loadCustomerInvoices(customerId) {
    const response = await secureFetch(`${API_BASE_URL}/customers/${customerId}/invoices`);
    const invoices = await response.json();

    const content = `
        <h3>Customer Invoices</h3>
        <input type="text" id="customer-invoice-search" placeholder="Search invoices..." class="search-input">
        <div class="table-wrapper">
        <table>
            <thead>
                <tr>
                    <th>ID</th>
                    <th>Status</th>
                    <th>Is Recurring</th>
                    <th>Issue Date</th>
                    <th>Amount</th>
                    <th>Frequency</th>
                    <th>Next Payment</th>
                    <th>Notes</th>
                    <th>Actions</th>
                </tr>
            </thead>
            <tbody id="customer-invoice-table-body"></tbody>
        </table></div>`;
    document.getElementById("main-content").innerHTML = content;

    const tbody = document.getElementById("customer-invoice-table-body");
    renderCustomerInvoiceRows(invoices, customerId, tbody);

    attachMenuEvents();

    const input = document.getElementById("customer-invoice-search");
    input.addEventListener("input", () => {
        const query = input.value.toLowerCase();
        const filteredInvoices = invoices.filter(inv => {
            const rowText = `${inv.id} ${inv.status} ${inv.is_recurring} ${inv.issue_date} ${inv.amount} ${inv.frequency ?? ''} ${inv.recurring_amount ?? ''} ${inv.notes}`.toLowerCase();
            return rowText.includes(query);
        });
        renderCustomerInvoiceRows(filteredInvoices, customerId, tbody);
    });
}