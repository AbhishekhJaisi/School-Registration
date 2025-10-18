document.addEventListener('DOMContentLoaded', () => {
    const API_URL = 'http://localhost:3000/api';
    const messageDiv = document.getElementById('message');
    const token = localStorage.getItem('token'); // Simple session management
    const userData = JSON.parse(localStorage.getItem('userData'));

    // Utility to display messages
    const showMessage = (msg, type = 'error', element = messageDiv) => {
        if (!element) return;
        element.textContent = msg;
        element.className = type;
        element.style.display = 'block';
    };

    // --- Page Routing & Auth Checks ---
    const currentPage = window.location.pathname;

    if (userData) {
        // If logged in, redirect away from login/register pages
        if (currentPage.includes('index.html') || currentPage.includes('register.html')) {
            window.location.href = userData.role === 'admin' ? '/admin.html' : '/dashboard.html';
        }
    } else {
        // If not logged in, protect dashboard pages
        if (currentPage.includes('dashboard.html') || currentPage.includes('admin.html')) {
            window.location.href = '/index.html';
        }
    }

    // --- Event Handlers ---
    const loginForm = document.getElementById('loginForm');
    if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const username = document.getElementById('username').value;
            const password = document.getElementById('password').value;
            const response = await fetch(`${API_URL}/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password })
            });
            const data = await response.json();
            if (response.ok) {
                localStorage.setItem('userData', JSON.stringify(data));
                window.location.href = data.role === 'admin' ? '/admin.html' : '/dashboard.html';
            } else {
                showMessage(data.error);
            }
        });
    }

    const registerForm = document.getElementById('registerForm');
    if (registerForm) {
        registerForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const username = document.getElementById('username').value;
            const password = document.getElementById('password').value;
            const response = await fetch(`${API_URL}/register`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password })
            });
            const data = await response.json();
            if (response.ok) {
                showMessage('Registration successful! Please login.', 'success');
                setTimeout(() => window.location.href = '/index.html', 2000);
            } else {
                showMessage(data.error);
            }
        });
    }

    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', () => {
            localStorage.removeItem('userData');
            window.location.href = '/index.html';
        });
    }

    // --- Dashboard & Admin Page Logic ---
    if (userData) {
        document.getElementById('welcomeMessage').textContent = `Welcome, ${userData.username}!`;
    }

    // Student Dashboard Logic
    if (currentPage.includes('dashboard.html')) {
        const noticeBoard = document.getElementById('noticeBoard');
        const uploadForm = document.getElementById('uploadForm');

        // Fetch and display notices
        const loadNotices = async () => {
            const response = await fetch(`${API_URL}/notices`);
            const notices = await response.json();
            noticeBoard.innerHTML = notices.map(n => `
                <div class="notice-card">
                    <h3 class="notice-title">${n.title}</h3>
                    <p class="notice-meta">By ${n.author} on ${new Date(n.createdAt).toLocaleDateString()}</p>
                    <p class="notice-content">${n.content}</p>
                </div>
            `).join('');
        };

        // Handle file upload
        uploadForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const formData = new FormData();
            formData.append('document', document.getElementById('document').files[0]);
            formData.append('userId', userData.userId);
            formData.append('username', userData.username);

            const response = await fetch(`${API_URL}/upload`, { method: 'POST', body: formData });
            const result = await response.json();
            const uploadMessageDiv = document.getElementById('uploadMessage');
            showMessage(result.message || result.error, response.ok ? 'success' : 'error', uploadMessageDiv);
            uploadForm.reset();
        });

        loadNotices();
    }

    // Admin Dashboard Logic
    if (currentPage.includes('admin.html')) {
        const noticeForm = document.getElementById('noticeForm');
        const documentList = document.getElementById('documentList');

        // Post a new notice
        noticeForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const title = document.getElementById('noticeTitle').value;
            const content = document.getElementById('noticeContent').value;
            const response = await fetch(`${API_URL}/notices`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ title, content, author: userData.username })
            });
            const result = await response.json();
            const noticeMessageDiv = document.getElementById('noticeMessage');
            showMessage(result.message, 'success', noticeMessageDiv);
            noticeForm.reset();
        });
        
        // Fetch and display all uploaded documents
        const loadDocuments = async () => {
            const response = await fetch(`${API_URL}/documents`);
            const documents = await response.json();
            documentList.innerHTML = documents.map(doc => `
                <tr>
                    <td>${doc.username}</td>
                    <td>${doc.originalName}</td>
                    <td>${new Date(doc.uploadedAt).toLocaleString()}</td>
                    <td><a href="/${doc.filePath}" target="_blank" class="form-link">View</a></td>
                </tr>
            `).join('');
        };
        loadDocuments();
    }
});