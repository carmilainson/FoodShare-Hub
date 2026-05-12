FoodShareHubApp.prototype.switchAuthView = function(panelId) {
    document.querySelectorAll('.auth-tab').forEach((tab) => {
        tab.classList.toggle('active', tab.dataset.authView === panelId);
    });

    document.querySelectorAll('.auth-panel').forEach((panel) => {
        panel.classList.toggle('active', panel.id === panelId);
    });

    this.clearFeedback();
};

FoodShareHubApp.prototype.clearFeedback = function() {
    ['loginMessage', 'signupMessage'].forEach((id) => {
        const element = this.getElement(id);
        if (!element) return;
        element.textContent = '';
        element.className = 'feedback-message';
    });
};

FoodShareHubApp.prototype.setFeedback = function(elementId, message, type) {
    const element = this.getElement(elementId);
    if (!element) return;
    element.textContent = message;
    element.className = `feedback-message ${type}`;
};

FoodShareHubApp.prototype.handleLogin = async function() {
    const username = this.getElement('loginUsername')?.value.trim() || '';
    const password = this.getElement('loginPassword')?.value || '';
    const user = this.users.find((item) => item.username === username && item.password === password);

    if (!user) {
        this.setFeedback('loginMessage', 'Invalid username or password.', 'error');
        return;
    }

    this.saveSession(user);
    this.getElement('loginForm')?.reset();
    this.setFeedback('loginMessage', 'Login successful.', 'success');
    this.showDashboard();
};

FoodShareHubApp.prototype.handleSignup = async function() {
    const name = this.getElement('signupName')?.value.trim() || '';
    const username = this.getElement('signupUsername')?.value.trim() || '';
    const contact = this.getElement('signupContact')?.value.trim() || '';
    const email = this.getElement('signupEmail')?.value.trim() || '';
    const address = this.getElement('signupAddress')?.value.trim() || '';
    const password = this.getElement('signupPassword')?.value || '';

    if (!name || !username || !contact || !email || !address || !password) {
        this.setFeedback('signupMessage', 'Please complete all signup fields.', 'error');
        return;
    }

    if (password.length < 6) {
        this.setFeedback('signupMessage', 'Password must be at least 6 characters.', 'error');
        return;
    }

    if (this.users.some((user) => user.username.toLowerCase() === username.toLowerCase())) {
        this.setFeedback('signupMessage', 'That username is already in use.', 'error');
        return;
    }

    try {
        const newUser = await this.store.createUser({
            name,
            username,
            contact,
            email,
            address,
            password,
            role: 'user'
        });

        await this.refreshData();
        this.getElement('signupForm')?.reset();
        this.saveSession(newUser);
        this.setFeedback('signupMessage', 'Account created successfully.', 'success');
        this.showDashboard();
    } catch (error) {
        this.setFeedback('signupMessage', `Could not create account: ${error.message}`, 'error');
    }
};
