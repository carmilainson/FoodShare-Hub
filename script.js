class FoodShareHub {
    constructor() {
        this.foodPostsKey = 'foodshare_posts';
        this.requestsKey = 'foodshare_requests';
        this.usersKey = 'foodshare_users';
        this.sessionKey = 'foodshare_session';
        this.impactKey = 'foodshare_impact';
        this.resetVersionKey = 'foodshare_storage_reset_version';
        this.resetVersion = '2026-03-26-full-reset-v1';
        this.pendingImageData = '';
        this.session = null;
    }

    init() {
        this.loadData();
        this.resetBrokenDatabase();
        this.seedDefaults();
        this.syncOwnedData();
        this.restoreSession();
        this.bindEvents();
        this.setDefaultAvailableDate();
        this.checkAuthRedirect();
        this.updateImpactCounter();

        if (this.isHomePage()) {
            if (this.session) {
                this.showDashboard();
            } else {
                this.showWelcome();
            }
            return;
        }

        if (this.session) {
            this.renderCurrentPage();
        }
    }

    isHomePage() {
        const pathname = window.location.pathname.split('/').pop();
        return pathname === '' || pathname === 'home.html' || pathname === 'index.html';
    }

    getCurrentPageName() {
        return window.location.pathname.split('/').pop() || 'home.html';
    }

    getElement(id) {
        return document.getElementById(id);
    }

    bindEvents() {
        document.querySelectorAll('[data-auth-view]').forEach((button) => {
            button.addEventListener('click', () => this.switchAuthView(button.dataset.authView));
        });

        const loginForm = this.getElement('loginForm');
        if (loginForm) {
            loginForm.addEventListener('submit', (event) => {
                event.preventDefault();
                this.handleLogin();
            });
        }

        const signupForm = this.getElement('signupForm');
        if (signupForm) {
            signupForm.addEventListener('submit', (event) => {
                event.preventDefault();
                this.handleSignup();
            });
        }

        const postForm = this.getElement('postForm');
        if (postForm) {
            postForm.addEventListener('submit', (event) => {
                event.preventDefault();
                this.handlePostFood();
            });
        }

        const foodImage = this.getElement('foodImage');
        if (foodImage) {
            foodImage.addEventListener('change', (event) => this.handleImagePreview(event));
        }

        document.querySelectorAll('[data-password-target]').forEach((button) => {
            button.addEventListener('click', () => this.togglePassword(button));
        });

        document.querySelectorAll('.side-link[data-page]').forEach((button) => {
            button.addEventListener('click', () => this.showDashboardPage(button.dataset.page));
        });

        document.querySelectorAll('[data-jump-page]').forEach((button) => {
            button.addEventListener('click', () => this.showDashboardPage(button.dataset.jumpPage));
        });

        document.querySelectorAll('#logoutBtn').forEach((button) => {
            button.addEventListener('click', () => this.logout());
        });
    }

    loadData() {
        if (!localStorage.getItem(this.foodPostsKey)) {
            this.saveToStorage(this.foodPostsKey, []);
        }
        if (!localStorage.getItem(this.requestsKey)) {
            this.saveToStorage(this.requestsKey, []);
        }
        if (!localStorage.getItem(this.usersKey)) {
            this.saveToStorage(this.usersKey, []);
        }
        if (!localStorage.getItem(this.impactKey)) {
            localStorage.setItem(this.impactKey, '0');
        }
    }

    resetBrokenDatabase() {
        if (localStorage.getItem(this.resetVersionKey) === this.resetVersion) {
            return;
        }

        this.saveToStorage(this.foodPostsKey, []);
        this.saveToStorage(this.requestsKey, []);
        this.saveToStorage(this.usersKey, []);
        localStorage.setItem(this.impactKey, '0');
        localStorage.removeItem(this.sessionKey);
        localStorage.setItem(this.resetVersionKey, this.resetVersion);
    }

    seedDefaults() {
        const users = this.getUsers().filter((user) => user.username !== 'admin');

        users.unshift({
            id: 'admin-default',
            name: 'FoodShare Admin',
            username: 'admin',
            password: 'admin123',
            contact: '',
            email: '',
            address: 'Barangay Admin Office',
            role: 'admin'
        });

        this.saveToStorage(this.usersKey, users);
    }

    syncOwnedData() {
        const users = this.getUsers();
        const realUserCount = users.filter((user) => user.role === 'user').length;

        if (realUserCount === 0) {
            this.saveToStorage(this.foodPostsKey, []);
            this.saveToStorage(this.requestsKey, []);
            return;
        }

        const validOwnerIds = new Set(users.map((user) => user.id));
        const posts = this.getPosts().filter((post) => validOwnerIds.has(post.ownerId));
        const validPostIds = new Set(posts.map((post) => post.id));
        const requests = this.getRequests().filter((request) => {
            return validOwnerIds.has(request.userId) && validPostIds.has(request.postId);
        });

        this.saveToStorage(this.foodPostsKey, posts);
        this.saveToStorage(this.requestsKey, requests);
    }

    restoreSession() {
        const raw = localStorage.getItem(this.sessionKey);
        if (!raw) {
            this.session = null;
            return;
        }

        try {
            const session = JSON.parse(raw);
            const matchedUser = this.getUsers().find((user) => user.id === session.id);
            this.session = matchedUser
                ? {
                    id: matchedUser.id,
                    name: matchedUser.name,
                    username: matchedUser.username,
                    role: matchedUser.role,
                    contact: matchedUser.contact || '',
                    email: matchedUser.email || '',
                    address: matchedUser.address || ''
                }
                : null;
        } catch (error) {
            this.session = null;
        }

        if (!this.session) {
            localStorage.removeItem(this.sessionKey);
        }
    }

    saveSession(user) {
        this.session = {
            id: user.id,
            name: user.name,
            username: user.username,
            role: user.role,
            contact: user.contact || '',
            email: user.email || '',
            address: user.address || ''
        };
        localStorage.setItem(this.sessionKey, JSON.stringify(this.session));
    }

    clearSession() {
        this.session = null;
        localStorage.removeItem(this.sessionKey);
    }

    saveToStorage(key, data) {
        localStorage.setItem(key, JSON.stringify(data));
    }

    loadFromStorage(key) {
        const data = localStorage.getItem(key);
        if (!data) {
            return [];
        }

        try {
            return JSON.parse(data);
        } catch (error) {
            return [];
        }
    }

    getUsers() {
        return this.loadFromStorage(this.usersKey);
    }

    getPosts() {
        return this.loadFromStorage(this.foodPostsKey);
    }

    getRequests() {
        return this.loadFromStorage(this.requestsKey);
    }

    switchAuthView(panelId) {
        document.querySelectorAll('.auth-tab').forEach((tab) => {
            tab.classList.toggle('active', tab.dataset.authView === panelId);
        });

        document.querySelectorAll('.auth-panel').forEach((panel) => {
            panel.classList.toggle('active', panel.id === panelId);
        });

        this.clearFeedback();
    }

    clearFeedback() {
        const loginMessage = this.getElement('loginMessage');
        const signupMessage = this.getElement('signupMessage');

        if (loginMessage) {
            loginMessage.textContent = '';
            loginMessage.className = 'feedback-message';
        }

        if (signupMessage) {
            signupMessage.textContent = '';
            signupMessage.className = 'feedback-message';
        }
    }

    setFeedback(elementId, message, type) {
        const element = this.getElement(elementId);
        if (!element) {
            return;
        }

        element.textContent = message;
        element.className = `feedback-message ${type}`;
    }

    handleLogin() {
        const username = this.getElement('loginUsername')?.value.trim() || '';
        const password = this.getElement('loginPassword')?.value || '';
        const users = this.getUsers();
        const user = users.find((item) => item.username === username && item.password === password);

        if (!user) {
            this.setFeedback('loginMessage', 'Invalid username or password.', 'error');
            return;
        }

        this.saveSession(user);
        this.getElement('loginForm')?.reset();
        this.setFeedback('loginMessage', 'Login successful.', 'success');
        this.showDashboard();
    }

    handleSignup() {
        const name = this.getElement('signupName')?.value.trim() || '';
        const username = this.getElement('signupUsername')?.value.trim() || '';
        const contact = this.getElement('signupContact')?.value.trim() || '';
        const email = this.getElement('signupEmail')?.value.trim() || '';
        const address = this.getElement('signupAddress')?.value.trim() || '';
        const password = this.getElement('signupPassword')?.value || '';
        const users = this.getUsers();

        if (!name || !username || !contact || !email || !address || !password) {
            this.setFeedback('signupMessage', 'Please complete all signup fields.', 'error');
            return;
        }

        if (password.length < 6) {
            this.setFeedback('signupMessage', 'Password must be at least 6 characters.', 'error');
            return;
        }

        if (users.some((user) => user.username.toLowerCase() === username.toLowerCase())) {
            this.setFeedback('signupMessage', 'That username is already in use.', 'error');
            return;
        }

        const newUser = {
            id: `user-${Date.now()}`,
            name,
            username,
            contact,
            email,
            address,
            password,
            role: 'user'
        };

        users.push(newUser);
        this.saveToStorage(this.usersKey, users);
        this.getElement('signupForm')?.reset();
        this.saveSession(newUser);
        this.setFeedback('signupMessage', 'Account created successfully.', 'success');
        this.showDashboard();
    }

    showWelcome() {
        this.getElement('welcomeShell')?.classList.remove('hidden');
        this.getElement('dashboardShell')?.classList.add('hidden');
        this.updateImpactCounter();
    }

    showDashboard() {
        if (!this.session) {
            this.showWelcome();
            return;
        }

        if (!this.isHomePage()) {
            this.renderCurrentPage();
            return;
        }

        this.getElement('welcomeShell')?.classList.add('hidden');
        this.getElement('dashboardShell')?.classList.remove('hidden');
        this.applySessionUI();
        this.renderDashboard();
        this.showDashboardPage(this.session.role === 'admin' ? 'adminPanelPage' : 'dashboardHome');
    }

    renderCurrentPage() {
        const pageName = this.getCurrentPageName();

        if (pageName === 'post.html') {
            this.prefillPostForm();
            return;
        }

        if (pageName === 'available.html') {
            this.loadFoodListings();
            return;
        }

        if (pageName === 'requests.html') {
            this.loadMyRequests();
        }
    }

    applySessionUI() {
        if (!this.session) {
            return;
        }

        const isAdmin = this.session.role === 'admin';
        const sidebarRoleTitle = this.getElement('sidebarRoleTitle');
        const sessionMeta = this.getElement('sessionMeta');

        if (sidebarRoleTitle) {
            sidebarRoleTitle.textContent = isAdmin ? 'Admin Dashboard' : 'User Dashboard';
        }

        if (sessionMeta) {
            sessionMeta.textContent = isAdmin
                ? `Signed in as ${this.session.username}`
                : `${this.session.name} | ${this.session.address || this.session.contact}`;
        }

        document.querySelectorAll('[data-admin-only]').forEach((element) => {
            element.classList.toggle('hidden', !isAdmin);
        });

        document.querySelectorAll('[data-user-only]').forEach((element) => {
            element.classList.toggle('hidden', isAdmin);
        });
    }

    showDashboardPage(pageId) {
        if (!this.session) {
            return;
        }

        const isAdmin = this.session.role === 'admin';
        const nextPageId = !isAdmin && pageId === 'adminPanelPage' ? 'dashboardHome' : pageId;

        document.querySelectorAll('.dashboard-page').forEach((page) => {
            page.classList.toggle('active', page.id === nextPageId);
        });

        document.querySelectorAll('.side-link[data-page]').forEach((button) => {
            button.classList.toggle('active', button.dataset.page === nextPageId);
        });

        if (nextPageId === 'availableFoodPage') {
            this.loadFoodListings();
        }
        if (nextPageId === 'myRequestsPage') {
            this.loadMyRequests();
        }
        if (nextPageId === 'dashboardHome' || nextPageId === 'adminPanelPage') {
            this.renderDashboard();
        }
        if (nextPageId === 'postFoodPage') {
            this.prefillPostForm();
        }
    }

    handlePostFood() {
        if (!this.session || this.session.role !== 'user') {
            window.location.href = 'home.html';
            return;
        }

        const formData = {
            id: `post-${Date.now()}`,
            ownerId: this.session.id,
            title: this.getElement('foodTitle')?.value.trim() || '',
            description: this.getElement('description')?.value.trim() || '',
            quantity: this.getElement('quantity')?.value.trim() || '',
            location: this.getElement('location')?.value.trim() || '',
            availableDate: this.getElement('availableDate')?.value || '',
            availableTime: this.getElement('availableTime')?.value || '',
            sharerName: this.getElement('sharerName')?.value.trim() || this.session.name,
            contactDetails: this.getElement('contactDetails')?.value.trim() || this.session.contact || this.session.email,
            image: this.pendingImageData,
            claimed: false,
            claimerName: '',
            claimerContact: '',
            claimerId: '',
            timestamp: new Date().toISOString()
        };

        if (!formData.title || !formData.description || !formData.quantity || !formData.location || !formData.availableDate || !formData.availableTime) {
            return;
        }

        const posts = this.getPosts();
        posts.unshift(formData);
        this.saveToStorage(this.foodPostsKey, posts);
        this.getElement('postForm')?.reset();
        this.prefillPostForm();
        this.pendingImageData = '';
        this.resetImagePreview();
        this.incrementImpact();
        this.getElement('postSuccess')?.classList.remove('hidden');

        window.setTimeout(() => {
            this.getElement('postSuccess')?.classList.add('hidden');
        }, 3000);

        if (this.isHomePage()) {
            this.renderDashboard();
            this.showDashboardPage('availableFoodPage');
        } else {
            this.renderCurrentPage();
        }
    }

    handleImagePreview(event) {
        const file = event.target.files?.[0];
        if (!file) {
            this.pendingImageData = '';
            this.resetImagePreview();
            return;
        }

        const reader = new FileReader();
        reader.onload = () => {
            this.pendingImageData = reader.result;
            const preview = this.getElement('imagePreview');
            const previewImg = this.getElement('previewImg');

            if (previewImg) {
                previewImg.src = reader.result;
            }
            if (preview) {
                preview.hidden = false;
                preview.classList.remove('hidden');
            }
        };
        reader.onerror = () => {
            this.pendingImageData = '';
            this.resetImagePreview();
        };
        reader.readAsDataURL(file);
    }

    resetImagePreview() {
        const preview = this.getElement('imagePreview');
        const previewImg = this.getElement('previewImg');

        if (previewImg) {
            previewImg.removeAttribute('src');
        }
        if (preview) {
            preview.hidden = true;
            preview.classList.add('hidden');
        }

        const foodImage = this.getElement('foodImage');
        if (foodImage) {
            foodImage.value = '';
        }
    }

    togglePassword(button) {
        const input = this.getElement(button.dataset.passwordTarget);
        if (!input) {
            return;
        }

        const isPassword = input.type === 'password';
        input.type = isPassword ? 'text' : 'password';
        button.classList.toggle('is-visible', isPassword);
        button.setAttribute('aria-label', isPassword ? 'Hide password' : 'Show password');
    }

    getAreaText(value) {
        return String(value || '')
            .toLowerCase()
            .replace(/[^a-z0-9\s]/g, ' ')
            .replace(/\s+/g, ' ')
            .trim();
    }

    isNearArea(location, userArea) {
        const normalizedLocation = this.getAreaText(location);
        const normalizedUserArea = this.getAreaText(userArea);

        if (!normalizedLocation || !normalizedUserArea) {
            return false;
        }

        return normalizedLocation.includes(normalizedUserArea) || normalizedUserArea.includes(normalizedLocation);
    }

    prioritizePostsByArea(posts, userArea) {
        return [...posts].sort((left, right) => {
            const leftNear = this.isNearArea(left.location, userArea);
            const rightNear = this.isNearArea(right.location, userArea);

            if (leftNear !== rightNear) {
                return leftNear ? -1 : 1;
            }

            return new Date(right.timestamp || 0) - new Date(left.timestamp || 0);
        });
    }

    getVisiblePostsForSession(options = {}) {
        const includeClaimed = options.includeClaimed || false;
        const posts = this.getPosts();

        if (!this.session || this.session.role !== 'user') {
            return includeClaimed ? posts : posts.filter((post) => !post.claimed);
        }

        const filtered = posts.filter((post) => {
            if (!includeClaimed && post.claimed) {
                return false;
            }
            return true;
        });

        return this.prioritizePostsByArea(filtered, this.session.address || '');
    }

    loadFoodListings() {
        const container = this.getElement('foodListings');
        if (!container) {
            return;
        }

        const visiblePosts = this.getVisiblePostsForSession();

        if (visiblePosts.length === 0) {
            container.innerHTML = '<div class="empty-card">No food posts available yet.</div>';
            return;
        }

        container.innerHTML = visiblePosts.map((post) => `
            <article class="food-card">
                ${post.image ? `<img class="food-card-image" src="${post.image}" alt="${this.escapeHtml(post.title)}">` : ''}
                <div class="food-card-body">
                    <h3>${this.escapeHtml(post.title)}</h3>
                    <p>${this.escapeHtml(post.description)}</p>
                    <div class="contact-panel">
                        <p><strong>Sharer:</strong> ${this.escapeHtml(post.sharerName)}</p>
                        <p><strong>Contact:</strong> ${this.escapeHtml(post.contactDetails)}</p>
                    </div>
                    <div class="food-meta">
                        <span>${this.escapeHtml(post.quantity)}</span>
                        <span class="food-time">${this.escapeHtml(post.availableDate)} ${this.escapeHtml(post.availableTime)}</span>
                    </div>
                    <p class="pickup-note"><strong>Pickup:</strong> ${this.escapeHtml(post.location)}</p>
                    ${this.session && this.session.role === 'user'
                        ? post.ownerId === this.session.id
                            ? '<div class="status-pill">Your post</div>'
                            : `<button type="button" class="btn btn-primary full-width claim-btn" data-id="${post.id}">Claim Food</button>`
                        : ''}
                </div>
            </article>
        `).join('');

        container.querySelectorAll('.claim-btn').forEach((button) => {
            button.addEventListener('click', () => this.handleClaim(button.dataset.id));
        });
    }

    handleClaim(postId) {
        if (!this.session || this.session.role !== 'user') {
            return;
        }

        const posts = this.getPosts();
        const post = posts.find((item) => item.id === postId);
        if (!post || post.claimed || post.ownerId === this.session.id) {
            return;
        }

        post.claimed = true;
        post.claimerId = this.session.id;
        post.claimerName = this.session.name;
        post.claimerContact = this.session.contact || this.session.email;
        this.saveToStorage(this.foodPostsKey, posts);

        const requests = this.getRequests();
        requests.unshift({
            id: `request-${post.id}-${this.session.id}`,
            postId: post.id,
            userId: this.session.id,
            title: post.title,
            location: post.location,
            pickupTime: `${post.availableDate} ${post.availableTime}`,
            sharerName: post.sharerName,
            sharerContact: post.contactDetails,
            status: 'Pending pickup',
            image: post.image || ''
        });
        this.saveToStorage(this.requestsKey, requests);

        this.incrementImpact();

        if (this.isHomePage()) {
            this.renderDashboard();
            this.showDashboardPage('myRequestsPage');
        } else {
            this.loadFoodListings();
        }

        window.alert(`Claim saved for ${post.title}.\nSharer: ${post.sharerName}\nContact: ${post.contactDetails}`);
    }

    loadMyRequests() {
        const container = this.getElement('myRequests');
        if (!container) {
            return;
        }

        const requests = this.getRequests().filter((request) => this.session && request.userId === this.session.id);

        if (requests.length === 0) {
            container.innerHTML = '<div class="empty-card">No requests yet. Browse available food to get started.</div>';
            return;
        }

        container.innerHTML = requests.map((request) => `
            <article class="food-card">
                ${request.image ? `<img class="food-card-image" src="${request.image}" alt="${this.escapeHtml(request.title)}">` : ''}
                <div class="food-card-body">
                    <h3>${this.escapeHtml(request.title)}</h3>
                    <p><strong>Pickup:</strong> ${this.escapeHtml(request.pickupTime)}</p>
                    <p><strong>Location:</strong> ${this.escapeHtml(request.location)}</p>
                    <p><strong>Sharer:</strong> ${this.escapeHtml(request.sharerName)}</p>
                    <p><strong>Contact:</strong> ${this.escapeHtml(request.sharerContact)}</p>
                    <p><strong>Status:</strong> <span class="status-pill">${this.escapeHtml(request.status)}</span></p>
                </div>
            </article>
        `).join('');
    }

    renderDashboard() {
        if (!this.session) {
            return;
        }

        const posts = this.getPosts();
        const requests = this.getRequests();
        const availablePosts = this.getVisiblePostsForSession();
        const myRequests = this.session.role === 'user'
            ? requests.filter((request) => request.userId === this.session.id)
            : requests;

        const dashboardGreeting = this.getElement('dashboardGreeting');
        const summaryAvailable = this.getElement('summaryAvailable');
        const summaryRequests = this.getElement('summaryRequests');
        const summaryClaimed = this.getElement('summaryClaimed');
        const dashboardAvailablePreview = this.getElement('dashboardAvailablePreview');
        const dashboardRequestPreview = this.getElement('dashboardRequestPreview');
        const adminUserCount = this.getElement('adminUserCount');
        const adminPublicPostCount = this.getElement('adminPublicPostCount');
        const adminPostCount = this.getElement('adminPostCount');
        const adminRequestCount = this.getElement('adminRequestCount');
        const adminRecentPosts = this.getElement('adminRecentPosts');

        if (dashboardGreeting) {
            dashboardGreeting.textContent = this.session.role === 'admin'
                ? 'Admin overview for FoodShare Hub'
                : `Welcome back, ${this.session.name}`;
        }

        if (summaryAvailable) {
            summaryAvailable.textContent = String(availablePosts.length);
        }
        if (summaryRequests) {
            summaryRequests.textContent = String(myRequests.length);
        }
        if (summaryClaimed) {
            summaryClaimed.textContent = String(posts.filter((post) => post.claimed).length);
        }

        if (dashboardAvailablePreview) {
            dashboardAvailablePreview.innerHTML = this.renderMiniList(
                availablePosts.slice(0, 3).map((post) => `${post.title} | ${post.location}`)
            );
        }

        if (dashboardRequestPreview) {
            dashboardRequestPreview.innerHTML = this.renderMiniList(
                myRequests.slice(0, 3).map((request) => `${request.title} | ${request.status}`)
            );
        }

        if (adminUserCount) {
            adminUserCount.textContent = String(this.getUsers().filter((user) => user.role === 'user').length);
        }
        if (adminPublicPostCount) {
            adminPublicPostCount.textContent = '0';
        }
        if (adminPostCount) {
            adminPostCount.textContent = String(posts.length);
        }
        if (adminRequestCount) {
            adminRequestCount.textContent = String(requests.length);
        }
        if (adminRecentPosts) {
            adminRecentPosts.innerHTML = this.renderMiniList(
                posts.slice(0, 5).map((post) => `${post.title} | ${post.sharerName}`)
            );
        }

        this.loadFoodListings();
        if (this.session.role === 'user') {
            this.loadMyRequests();
        }
    }

    renderMiniList(items) {
        if (items.length === 0) {
            return '<div class="empty-card small">Nothing to show yet.</div>';
        }

        return items.map((item) => `<div class="mini-item">${this.escapeHtml(item)}</div>`).join('');
    }

    incrementImpact() {
        const currentImpact = parseInt(localStorage.getItem(this.impactKey) || '0', 10);
        localStorage.setItem(this.impactKey, String(currentImpact + 1));
        this.updateImpactCounter();
    }

    updateImpactCounter() {
        const impact = parseInt(localStorage.getItem(this.impactKey) || '0', 10);
        const impactText = this.getElement('impactText');
        const dashboardValue = this.getElement('dashboardImpactValue');

        if (impactText) {
            impactText.textContent = impact === 0
                ? 'Start sharing to save meals.'
                : impact === 1
                    ? '1 meal saved through the community.'
                    : `${impact} meals saved through the community.`;
        }

        if (dashboardValue) {
            dashboardValue.textContent = `${impact} meals saved`;
        }
    }

    prefillPostForm() {
        if (!this.session || this.session.role !== 'user') {
            return;
        }

        const sharerName = this.getElement('sharerName');
        const contactDetails = this.getElement('contactDetails');
        const location = this.getElement('location');

        if (sharerName) {
            sharerName.value = this.session.name;
        }
        if (contactDetails) {
            contactDetails.value = this.session.contact || this.session.email || '';
        }
        if (location) {
            location.value = this.session.address || '';
        }
    }

    setDefaultAvailableDate() {
        const availableDate = this.getElement('availableDate');
        if (availableDate && !availableDate.value) {
            availableDate.valueAsDate = new Date();
        }
    }

    checkAuthRedirect() {
        const pageName = this.getCurrentPageName();
        const protectedPages = ['post.html', 'available.html', 'requests.html'];

        if (protectedPages.includes(pageName) && !this.session) {
            window.location.href = 'home.html';
        }
    }

    logout() {
        this.clearSession();
        this.pendingImageData = '';
        this.resetImagePreview();
        this.getElement('loginForm')?.reset();
        window.location.href = 'home.html';
    }

    escapeHtml(value) {
        return String(value ?? '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }
}

document.addEventListener('DOMContentLoaded', () => {
    const app = new FoodShareHub();
    app.init();
});
