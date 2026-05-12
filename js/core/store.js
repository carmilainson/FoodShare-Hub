class FoodShareDataStore {
    constructor() {
        this.config = window.FOODSHARE_SUPABASE || {};
        this.localKeys = {
            posts: 'foodshare_posts',
            requests: 'foodshare_requests',
            users: 'foodshare_users',
            session: 'foodshare_session'
        };
    }

    isSupabaseConfigured() {
        return Boolean(this.config.url && this.config.anonKey);
    }

    shouldUseLocalFallback() {
        return this.config.useLocalFallback !== false;
    }

    getTableName(key) {
        return this.config.tables?.[key] || key;
    }

    getHeaders() {
        return {
            apikey: this.config.anonKey,
            Authorization: `Bearer ${this.config.anonKey}`,
            'Content-Type': 'application/json'
        };
    }

    buildUrl(table, query = '') {
        return `${this.config.url}/rest/v1/${table}${query}`;
    }

    async request(table, { method = 'GET', query = '', body = null, prefer = '' } = {}) {
        const headers = this.getHeaders();
        if (prefer) {
            headers.Prefer = prefer;
        }

        const response = await fetch(this.buildUrl(table, query), {
            method,
            headers,
            body: body ? JSON.stringify(body) : undefined
        });

        const text = await response.text();
        const data = text ? JSON.parse(text) : null;

        if (!response.ok) {
            throw new Error(data?.message || data?.hint || data?.details || response.statusText);
        }

        return data;
    }

    saveLocal(key, data) {
        localStorage.setItem(this.localKeys[key], JSON.stringify(data));
    }

    loadLocal(key) {
        const raw = localStorage.getItem(this.localKeys[key]);
        if (!raw) return [];

        try {
            return JSON.parse(raw);
        } catch (error) {
            return [];
        }
    }

    getStoredSession() {
        const raw = localStorage.getItem(this.localKeys.session);
        if (!raw) return null;

        try {
            return JSON.parse(raw);
        } catch (error) {
            return null;
        }
    }

    saveSession(user) {
        const session = {
            id: user.id,
            name: user.name,
            username: user.username,
            role: user.role,
            contact: user.contact || '',
            email: user.email || '',
            address: user.address || ''
        };
        localStorage.setItem(this.localKeys.session, JSON.stringify(session));
        return session;
    }

    clearSession() {
        localStorage.removeItem(this.localKeys.session);
    }

    async initialize() {
        if (this.isSupabaseConfigured()) {
            await this.ensureAdminUser();
            return;
        }

        const users = this.loadLocal('users').filter((user) => user.username !== 'admin');
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
        this.saveLocal('users', users);

        if (!localStorage.getItem(this.localKeys.posts)) this.saveLocal('posts', []);
        if (!localStorage.getItem(this.localKeys.requests)) this.saveLocal('requests', []);
    }

    async ensureAdminUser() {
        const rows = await this.request(this.getTableName('users'), {
            query: '?select=id,username&username=eq.admin'
        });

        if (rows.length) return;

        await this.request(this.getTableName('users'), {
            method: 'POST',
            prefer: 'return=representation',
            body: {
                name: 'FoodShare Admin',
                username: 'admin',
                password: 'admin123',
                contact: '',
                email: '',
                address: 'Barangay Admin Office',
                role: 'admin'
            }
        });
    }

    mapUserRow(row) {
        return {
            id: row.id,
            name: row.name || '',
            username: row.username || '',
            contact: row.contact || '',
            email: row.email || '',
            address: row.address || '',
            password: row.password || '',
            role: row.role || 'user'
        };
    }

    mapPostRow(row) {
        return {
            id: row.id,
            ownerId: row.owner_id,
            title: row.title || '',
            foodType: row.food_type || '',
            description: row.description || '',
            quantity: row.quantity || '',
            location: row.location || '',
            availableDate: row.available_date || '',
            availableTime: row.available_time || '',
            sharerName: row.sharer_name || '',
            contactDetails: row.contact_details || '',
            image: row.image || '',
            claimed: Boolean(row.claimed),
            claimerName: row.claimer_name || '',
            claimerContact: row.claimer_contact || '',
            claimerId: row.claimer_id || '',
            timestamp: row.created_at || ''
        };
    }

    mapRequestRow(row) {
        return {
            id: row.id,
            postId: row.post_id,
            userId: row.user_id,
            title: row.title || '',
            location: row.location || '',
            pickupTime: row.pickup_time || '',
            sharerName: row.sharer_name || '',
            sharerContact: row.sharer_contact || '',
            status: row.status || 'Pending pickup',
            image: row.image || ''
        };
    }

    async loadAll() {
        if (!this.isSupabaseConfigured()) {
            return {
                users: this.loadLocal('users'),
                posts: this.loadLocal('posts'),
                requests: this.loadLocal('requests')
            };
        }

        const [userRows, postRows, requestRows] = await Promise.all([
            this.request(this.getTableName('users'), { query: '?select=*' }),
            this.request(this.getTableName('posts'), { query: '?select=*&order=created_at.desc' }),
            this.request(this.getTableName('requests'), { query: '?select=*&order=created_at.desc' })
        ]);

        const data = {
            users: userRows.map((row) => this.mapUserRow(row)),
            posts: postRows.map((row) => this.mapPostRow(row)),
            requests: requestRows.map((row) => this.mapRequestRow(row))
        };

        this.saveLocal('users', data.users);
        this.saveLocal('posts', data.posts);
        this.saveLocal('requests', data.requests);
        return data;
    }

    async createUser(user) {
        if (!this.isSupabaseConfigured()) {
            const users = this.loadLocal('users');
            const localUser = { ...user, id: `user-${Date.now()}` };
            users.push(localUser);
            this.saveLocal('users', users);
            return localUser;
        }

        const [created] = await this.request(this.getTableName('users'), {
            method: 'POST',
            prefer: 'return=representation',
            body: user
        });
        return this.mapUserRow(created);
    }

    async createPost(post) {
        if (!this.isSupabaseConfigured()) {
            const posts = this.loadLocal('posts');
            const localPost = { ...post, id: `post-${Date.now()}`, timestamp: new Date().toISOString() };
            posts.unshift(localPost);
            this.saveLocal('posts', posts);
            return localPost;
        }

        const [created] = await this.request(this.getTableName('posts'), {
            method: 'POST',
            prefer: 'return=representation',
            body: {
                owner_id: post.ownerId,
                title: post.title,
                food_type: post.foodType,
                description: post.description,
                quantity: post.quantity,
                location: post.location,
                available_date: post.availableDate,
                available_time: post.availableTime,
                sharer_name: post.sharerName,
                contact_details: post.contactDetails,
                image: post.image,
                claimed: false,
                claimer_name: '',
                claimer_contact: '',
                claimer_id: null
            }
        });
        return this.mapPostRow(created);
    }

    async claimPost(postId, claimer) {
        if (!this.isSupabaseConfigured()) {
            const posts = this.loadLocal('posts');
            const post = posts.find((item) => item.id === postId);
            if (!post) return null;

            post.claimed = true;
            post.claimerId = claimer.id;
            post.claimerName = claimer.name;
            post.claimerContact = claimer.contact || claimer.email;
            this.saveLocal('posts', posts);
            return post;
        }

        const [updated] = await this.request(this.getTableName('posts'), {
            method: 'PATCH',
            query: `?id=eq.${encodeURIComponent(postId)}`,
            prefer: 'return=representation',
            body: {
                claimed: true,
                claimer_id: claimer.id,
                claimer_name: claimer.name,
                claimer_contact: claimer.contact || claimer.email
            }
        });
        return this.mapPostRow(updated);
    }

    async createRequest(request) {
        if (!this.isSupabaseConfigured()) {
            const requests = this.loadLocal('requests');
            const localRequest = { ...request, id: `request-${Date.now()}` };
            requests.unshift(localRequest);
            this.saveLocal('requests', requests);
            return localRequest;
        }

        const [created] = await this.request(this.getTableName('requests'), {
            method: 'POST',
            prefer: 'return=representation',
            body: {
                post_id: request.postId,
                user_id: request.userId,
                title: request.title,
                location: request.location,
                pickup_time: request.pickupTime,
                sharer_name: request.sharerName,
                sharer_contact: request.sharerContact,
                status: request.status,
                image: request.image
            }
        });
        return this.mapRequestRow(created);
    }
}
