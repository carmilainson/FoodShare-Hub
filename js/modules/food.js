FoodShareHubApp.prototype.handlePostFood = async function() {
    if (!this.session || this.session.role !== 'user') {
        window.location.href = 'index.html';
        return;
    }

    const formData = {
        ownerId: this.session.id,
        title: this.getElement('foodTitle')?.value.trim() || '',
        foodType: this.getElement('foodType')?.value || '',
        description: this.getElement('description')?.value.trim() || '',
        quantity: this.getElement('quantity')?.value.trim() || '',
        location: this.getElement('location')?.value.trim() || '',
        availableDate: this.getElement('availableDate')?.value || '',
        availableTime: this.getElement('availableTime')?.value || '',
        sharerName: this.getElement('sharerName')?.value.trim() || this.session.name,
        contactDetails: this.getElement('contactDetails')?.value.trim() || this.session.contact || this.session.email,
        image: this.pendingImageData
    };

    if (!formData.title || !formData.foodType || !formData.description || !formData.quantity || !formData.location || !formData.availableDate || !formData.availableTime) {
        return;
    }

    try {
        await this.store.createPost(formData);
        await this.refreshData();
        this.getElement('postForm')?.reset();
        this.prefillPostForm();
        this.pendingImageData = '';
        this.resetImagePreview();
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
    } catch (error) {
        alert(`Could not post food: ${error.message}`);
    }
};

FoodShareHubApp.prototype.handleImagePreview = function(event) {
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

        if (previewImg) previewImg.src = reader.result;
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
};

FoodShareHubApp.prototype.resetImagePreview = function() {
    const preview = this.getElement('imagePreview');
    const previewImg = this.getElement('previewImg');

    if (previewImg) previewImg.removeAttribute('src');
    if (preview) {
        preview.hidden = true;
        preview.classList.add('hidden');
    }

    const foodImage = this.getElement('foodImage');
    if (foodImage) foodImage.value = '';
};

FoodShareHubApp.prototype.getAreaText = function(value) {
    return String(value || '')
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
};

FoodShareHubApp.prototype.isNearArea = function(location, userArea) {
    const normalizedLocation = this.getAreaText(location);
    const normalizedUserArea = this.getAreaText(userArea);

    if (!normalizedLocation || !normalizedUserArea) return false;
    return normalizedLocation.includes(normalizedUserArea) || normalizedUserArea.includes(normalizedLocation);
};

FoodShareHubApp.prototype.prioritizePostsByArea = function(posts, userArea) {
    return [...posts].sort((left, right) => {
        const leftNear = this.isNearArea(left.location, userArea);
        const rightNear = this.isNearArea(right.location, userArea);

        if (leftNear !== rightNear) {
            return leftNear ? -1 : 1;
        }

        return new Date(right.timestamp || 0) - new Date(left.timestamp || 0);
    });
};

FoodShareHubApp.prototype.getVisiblePostsForSession = function(options = {}) {
    const includeClaimed = options.includeClaimed || false;
    const posts = this.getPosts();

    if (!this.session || this.session.role !== 'user') {
        return includeClaimed ? posts : posts.filter((post) => !post.claimed);
    }

    const filtered = posts.filter((post) => includeClaimed || !post.claimed);
    return this.prioritizePostsByArea(filtered, this.session.address || '');
};

FoodShareHubApp.prototype.getFoodSearchTerm = function() {
    const activeSearch = document.querySelector('[data-food-search]');
    return activeSearch ? activeSearch.value.trim().toLowerCase() : '';
};

FoodShareHubApp.prototype.matchesFoodSearch = function(post, searchTerm) {
    if (!searchTerm) return true;

    const searchableText = [
        post.title,
        post.foodType,
        post.description,
        post.quantity,
        post.location,
        post.sharerName,
        post.contactDetails
    ]
        .join(' ')
        .toLowerCase();

    return searchableText.includes(searchTerm);
};

FoodShareHubApp.prototype.loadFoodListings = function() {
    const container = this.getElement('foodListings');
    if (!container) return;

    const searchTerm = this.getFoodSearchTerm();
    const visiblePosts = this.getVisiblePostsForSession().filter((post) => this.matchesFoodSearch(post, searchTerm));

    if (!visiblePosts.length) {
        container.innerHTML = searchTerm
            ? `<div class="empty-card">No food posts match "${this.escapeHtml(searchTerm)}".</div>`
            : '<div class="empty-card">No food posts available yet.</div>';
        return;
    }

    container.innerHTML = visiblePosts.map((post) => `
        <article class="food-card">
            ${post.image ? `<img class="food-card-image" src="${post.image}" alt="${this.escapeHtml(post.title)}">` : ''}
            <div class="food-card-body">
                <h3>${this.escapeHtml(post.title)}</h3>
                <p><strong>Type:</strong> <span class="status-pill">${this.escapeHtml(post.foodType || 'Other')}</span></p>
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
        button.addEventListener('click', async () => this.handleClaim(button.dataset.id));
    });
};

FoodShareHubApp.prototype.handleClaim = async function(postId) {
    if (!this.session || this.session.role !== 'user') return;

    const post = this.posts.find((item) => String(item.id) === String(postId));
    if (!post || post.claimed || String(post.ownerId) === String(this.session.id)) return;

    try {
        const claimedPost = await this.store.claimPost(post.id, this.session);
        await this.store.createRequest({
            postId: claimedPost.id,
            userId: this.session.id,
            title: claimedPost.title,
            location: claimedPost.location,
            pickupTime: `${claimedPost.availableDate} ${claimedPost.availableTime}`,
            sharerName: claimedPost.sharerName,
            sharerContact: claimedPost.contactDetails,
            status: 'Pending pickup',
            image: claimedPost.image || ''
        });

        await this.refreshData();

        if (this.isHomePage()) {
            this.renderDashboard();
            this.showDashboardPage('myRequestsPage');
        } else {
            this.loadFoodListings();
        }

        window.alert(`Claim saved for ${claimedPost.title}.\nSharer: ${claimedPost.sharerName}\nContact: ${claimedPost.contactDetails}`);
    } catch (error) {
        alert(`Could not claim food: ${error.message}`);
    }
};

FoodShareHubApp.prototype.loadMyRequests = function() {
    const container = this.getElement('myRequests');
    if (!container) return;

    const requests = this.getRequests().filter((request) => this.session && String(request.userId) === String(this.session.id));

    if (!requests.length) {
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
};

FoodShareHubApp.prototype.renderMiniList = function(items) {
    if (!items.length) {
        return '<div class="empty-card small">Nothing to show yet.</div>';
    }

    return items.map((item) => `<div class="mini-item">${this.escapeHtml(item)}</div>`).join('');
};

FoodShareHubApp.prototype.updateImpactCounter = function() {
    const impact = this.posts.length + this.requests.length;
    const impactText = this.getElement('impactText');
    const dashboardValue = this.getElement('dashboardImpactValue');

    if (impactText) {
        impactText.textContent = impact === 0
            ? 'Start sharing to save meals.'
            : impact === 1
                ? '1 community food action completed.'
                : `${impact} community food actions completed.`;
    }

    if (dashboardValue) {
        dashboardValue.textContent = `${impact} food actions`;
    }
};

FoodShareHubApp.prototype.prefillPostForm = function() {
    if (!this.session || this.session.role !== 'user') return;

    const sharerName = this.getElement('sharerName');
    const contactDetails = this.getElement('contactDetails');
    const location = this.getElement('location');

    if (sharerName) sharerName.value = this.session.name;
    if (contactDetails) contactDetails.value = this.session.contact || this.session.email || '';
    if (location) location.value = this.session.address || '';
};

FoodShareHubApp.prototype.renderDashboard = function() {
    if (!this.session) return;

    const posts = this.getPosts();
    const requests = this.getRequests();
    const availablePosts = this.getVisiblePostsForSession();
    const myRequests = this.session.role === 'user'
        ? requests.filter((request) => String(request.userId) === String(this.session.id))
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
    const adminHomeGreeting = this.getElement('adminHomeGreeting');
    const adminStatusValue = this.getElement('adminStatusValue');
    const adminHomeUserCount = this.getElement('adminHomeUserCount');
    const adminHomeOpenPosts = this.getElement('adminHomeOpenPosts');
    const adminHomeClaimedPosts = this.getElement('adminHomeClaimedPosts');
    const adminHomeRequestCount = this.getElement('adminHomeRequestCount');
    const adminHomePostPreview = this.getElement('adminHomePostPreview');
    const adminHomeRequestPreview = this.getElement('adminHomeRequestPreview');
    const adminChecklist = this.getElement('adminChecklist');

    if (dashboardGreeting) {
        dashboardGreeting.textContent = this.session.role === 'admin'
            ? 'Admin overview for FoodShare Hub'
            : `Welcome back, ${this.session.name}`;
    }

    if (adminHomeGreeting) {
        adminHomeGreeting.textContent = `Welcome back, ${this.session.role === 'admin' ? this.session.username : this.session.name}`;
    }

    if (summaryAvailable) summaryAvailable.textContent = String(availablePosts.length);
    if (summaryRequests) summaryRequests.textContent = String(myRequests.length);
    if (summaryClaimed) summaryClaimed.textContent = String(posts.filter((post) => post.claimed).length);

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

    if (adminUserCount) adminUserCount.textContent = String(this.users.filter((user) => user.role === 'user').length);
    if (adminPublicPostCount) adminPublicPostCount.textContent = String(posts.filter((post) => !post.claimed).length);
    if (adminPostCount) adminPostCount.textContent = String(posts.length);
    if (adminRequestCount) adminRequestCount.textContent = String(requests.length);
    if (adminRecentPosts) {
        adminRecentPosts.innerHTML = this.renderMiniList(
            posts.slice(0, 5).map((post) => `${post.title} | ${post.sharerName}`)
        );
    }

    if (adminStatusValue) {
        const pendingPickups = requests.filter((request) => request.status === 'Pending pickup').length;
        adminStatusValue.textContent = pendingPickups > 5 ? 'Needs attention' : 'Stable';
    }
    if (adminHomeUserCount) adminHomeUserCount.textContent = String(this.users.filter((user) => user.role === 'user').length);
    if (adminHomeOpenPosts) adminHomeOpenPosts.textContent = String(posts.filter((post) => !post.claimed).length);
    if (adminHomeClaimedPosts) adminHomeClaimedPosts.textContent = String(posts.filter((post) => post.claimed).length);
    if (adminHomeRequestCount) adminHomeRequestCount.textContent = String(requests.length);
    if (adminHomePostPreview) {
        adminHomePostPreview.innerHTML = this.renderMiniList(
            posts.slice(0, 4).map((post) => `${post.title} | ${post.claimed ? 'Claimed' : 'Open'}`)
        );
    }
    if (adminHomeRequestPreview) {
        adminHomeRequestPreview.innerHTML = this.renderMiniList(
            requests.slice(0, 4).map((request) => `${request.title} | ${request.status}`)
        );
    }
    if (adminChecklist) {
        const checklistItems = [
            `${posts.filter((post) => !post.claimed).length} open posts ready for pickup`,
            `${requests.filter((request) => request.status === 'Pending pickup').length} requests waiting for coordination`,
            `${this.users.filter((user) => user.role === 'user').length} active community accounts`
        ];
        adminChecklist.innerHTML = this.renderMiniList(checklistItems);
    }

    this.loadFoodListings();
    if (this.session.role === 'user') {
        this.loadMyRequests();
    }
    this.updateImpactCounter();
};
