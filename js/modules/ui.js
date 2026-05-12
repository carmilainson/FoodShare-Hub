FoodShareHubApp.prototype.bindEvents = function() {
    document.querySelectorAll('[data-auth-view]').forEach((button) => {
        button.addEventListener('click', () => this.switchAuthView(button.dataset.authView));
    });

    const loginForm = this.getElement('loginForm');
    if (loginForm) {
        loginForm.addEventListener('submit', async (event) => {
            event.preventDefault();
            await this.handleLogin();
        });
    }

    const signupForm = this.getElement('signupForm');
    if (signupForm) {
        signupForm.addEventListener('submit', async (event) => {
            event.preventDefault();
            await this.handleSignup();
        });
    }

    const postForm = this.getElement('postForm');
    if (postForm) {
        postForm.addEventListener('submit', async (event) => {
            event.preventDefault();
            await this.handlePostFood();
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
};

FoodShareHubApp.prototype.showWelcome = function() {
    this.getElement('welcomeShell')?.classList.remove('hidden');
    this.getElement('dashboardShell')?.classList.add('hidden');
    this.updateImpactCounter();
};

FoodShareHubApp.prototype.showDashboard = function() {
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
};

FoodShareHubApp.prototype.renderCurrentPage = function() {
    if (this.pageName === 'post.html') {
        this.prefillPostForm();
        return;
    }

    if (this.pageName === 'available.html') {
        this.loadFoodListings();
        return;
    }

    if (this.pageName === 'requests.html') {
        this.loadMyRequests();
    }
};

FoodShareHubApp.prototype.applySessionUI = function() {
    if (!this.session) return;

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
};

FoodShareHubApp.prototype.showDashboardPage = function(pageId) {
    if (!this.session) return;

    const isAdmin = this.session.role === 'admin';
    const nextPageId = !isAdmin && pageId === 'adminPanelPage' ? 'dashboardHome' : pageId;

    document.querySelectorAll('.dashboard-page').forEach((page) => {
        page.classList.toggle('active', page.id === nextPageId);
    });

    document.querySelectorAll('.side-link[data-page]').forEach((button) => {
        button.classList.toggle('active', button.dataset.page === nextPageId);
    });

    if (nextPageId === 'availableFoodPage') this.loadFoodListings();
    if (nextPageId === 'myRequestsPage') this.loadMyRequests();
    if (nextPageId === 'dashboardHome' || nextPageId === 'adminPanelPage') this.renderDashboard();
    if (nextPageId === 'postFoodPage') this.prefillPostForm();
};

FoodShareHubApp.prototype.togglePassword = function(button) {
    const input = this.getElement(button.dataset.passwordTarget);
    if (!input) return;

    const isPassword = input.type === 'password';
    input.type = isPassword ? 'text' : 'password';
    button.classList.toggle('is-visible', isPassword);
    button.setAttribute('aria-label', isPassword ? 'Hide password' : 'Show password');
};

FoodShareHubApp.prototype.setDefaultAvailableDate = function() {
    const availableDate = this.getElement('availableDate');
    if (availableDate && !availableDate.value) {
        availableDate.valueAsDate = new Date();
    }
};

FoodShareHubApp.prototype.checkAuthRedirect = function() {
    const protectedPages = ['post.html', 'available.html', 'requests.html'];

    if (protectedPages.includes(this.pageName) && !this.session) {
        window.location.href = 'index.html';
    }
};

FoodShareHubApp.prototype.logout = function() {
    this.clearSession();
    this.pendingImageData = '';
    this.resetImagePreview();
    this.getElement('loginForm')?.reset();
    window.location.href = 'index.html';
};
