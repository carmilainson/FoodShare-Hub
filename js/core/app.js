class FoodShareHubApp {
    constructor(pageName) {
        this.pageName = pageName;
        this.store = new FoodShareDataStore();
        this.pendingImageData = '';
        this.session = null;
        this.users = [];
        this.posts = [];
        this.requests = [];
    }

    async init() {
        try {
            await this.store.initialize();
            await this.refreshData();
        } catch (error) {
            console.error('FoodShare Hub data initialization failed:', error);
            if (!this.store.shouldUseLocalFallback()) {
                alert(`FoodShare Hub could not connect to Supabase: ${error.message}`);
            }
        }

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

    async refreshData() {
        const data = await this.store.loadAll();
        this.users = data.users || [];
        this.posts = data.posts || [];
        this.requests = data.requests || [];
    }

    isHomePage() {
        return this.pageName === 'home.html' || this.pageName === 'index.html';
    }

    getElement(id) {
        return document.getElementById(id);
    }

    getCurrentPageName() {
        return this.pageName;
    }

    getUsers() {
        return this.users;
    }

    getPosts() {
        return this.posts;
    }

    getRequests() {
        return this.requests;
    }

    restoreSession() {
        const saved = this.store.getStoredSession();
        if (!saved) {
            this.session = null;
            return;
        }

        const matchedUser = this.users.find((user) => String(user.id) === String(saved.id));
        this.session = matchedUser ? this.store.saveSession(matchedUser) : null;

        if (!this.session) {
            this.store.clearSession();
        }
    }

    saveSession(user) {
        this.session = this.store.saveSession(user);
    }

    clearSession() {
        this.session = null;
        this.store.clearSession();
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
