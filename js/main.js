/**
 * Main.js - Consolidated Logic for Antigravity/NexHaus
 * Replaced ES Modules to support file:// protocol usage.
 */

const App = (function () {

    // --- STORE (Data Persistence) ---
    const DB_KEYS = {
        AUTH: 'nexhaus_auth',
        HIDDEN_PROJECTS: 'nexhaus_hidden_projects',
        HIDDEN_BLOGS: 'nexhaus_hidden_blogs',
        CUSTOM_REVIEWS: 'nexhaus_custom_reviews',
        CUSTOM_ARTICLES: 'nexhaus_custom_articles', // NEW
        UPDATES_EXPORT: 'nexhaus_updates_export'
    };

    // In-Memory Storage
    let loadedProjects = [];
    let loadedBlogPosts = [];
    let hiddenProjectIds = [];
    let hiddenBlogIds = [];
    let loadedArticles = []; // NEW: Standalone articles
    let customReviews = []; // NEW
    let customArticles = []; // NEW (Persistent)

    const DEFAULT_REVIEWS = [
        {
            id: 1,
            client: 'Sarah Jenkins',
            role: 'CEO, Horizon Ventures',
            text: 'NexHaus transformed our vision into a tangible reality. The attention to detail and the interplay of light and space in our new headquarters is simply breathtaking.'
        },
        {
            id: 2,
            client: 'Marcus Thorne',
            role: 'Private Residence Owner',
            text: 'Living in a NexHaus home is an experience. It\'s not just a building; it\'s a sanctuary that perfectly balances modern aesthetics with comfort.'
        },
        {
            id: 3,
            client: 'Elena Rodriguez',
            role: 'Director, Art & Culture Foundation',
            text: 'The gallery space they designed is a masterpiece in itself. It enhances the art without overpowering it. Truly exceptional architectural thought.'
        }
    ];

    const Store = {
        init() {
            // Load hidden data
            try {
                const pStored = localStorage.getItem(DB_KEYS.HIDDEN_PROJECTS);
                hiddenProjectIds = pStored ? JSON.parse(pStored) : [];

                const bStored = localStorage.getItem(DB_KEYS.HIDDEN_BLOGS);
                hiddenBlogIds = bStored ? JSON.parse(bStored) : [];

                const rStored = localStorage.getItem(DB_KEYS.CUSTOM_REVIEWS);
                if (rStored) {
                    customReviews = JSON.parse(rStored);
                } else {
                    // Seed Defaults
                    customReviews = [...DEFAULT_REVIEWS];
                    localStorage.setItem(DB_KEYS.CUSTOM_REVIEWS, JSON.stringify(customReviews));
                }

                const aStored = localStorage.getItem(DB_KEYS.CUSTOM_ARTICLES);
                if (aStored) {
                    customArticles = JSON.parse(aStored);
                    // Load them into memory
                    customArticles.forEach(a => {
                        // We need duplicate check inside loadArticle
                        if (!loadedArticles.find(la => la.id === a.id)) loadedArticles.push(a);
                    });
                }

            } catch (e) {
                console.error('Failed to load hidden data', e);
                hiddenProjectIds = [];
                hiddenBlogIds = [];
                customReviews = [...DEFAULT_REVIEWS];
            }
        },
        // Register a project from an external file
        loadProject(data) {
            // Avoid duplicates
            if (loadedProjects.find(p => p.id === data.id)) return;

            loadedProjects.push(data);

            // If project has blog content, add to blog posts
            if (data.blog) {
                loadedBlogPosts.push({
                    projectId: data.id,
                    title: data.blog.title || data.title,
                    date: data.blog.date || 'Recently Added',
                    excerpt: data.blog.excerpt || data.description,
                    content: data.blog.content,
                    image: data.image
                });
            }
        },
        // Register a standalone article
        loadArticle(data) {
            // Avoid duplicates
            if (loadedArticles.find(a => a.id === data.id)) return;
            loadedArticles.push(data);
        },
        getProjects() {
            return loadedProjects.map(p => ({
                ...p,
                isHidden: hiddenProjectIds.includes(p.id)
            }));
        },
        toggleVisibility(id) {
            const index = hiddenProjectIds.indexOf(id);
            if (index > -1) hiddenProjectIds.splice(index, 1);
            else hiddenProjectIds.push(id);
            localStorage.setItem(DB_KEYS.HIDDEN_PROJECTS, JSON.stringify(hiddenProjectIds));
        },
        toggleBlogVisibility(id) {
            const index = hiddenBlogIds.indexOf(id);
            if (index > -1) hiddenBlogIds.splice(index, 1);
            else hiddenBlogIds.push(id);
            localStorage.setItem(DB_KEYS.HIDDEN_BLOGS, JSON.stringify(hiddenBlogIds));
        },
        setHiddenProjects(ids) {
            hiddenProjectIds = ids;
            // logic to persist to local storage is optional if we assume this is only called from updates.js
            // but for consistency let's update memory.
            // We do NOT save to localStorage here to avoid overwriting user's local state with file state 
            // causing confusion? Actually, file state SHOULD override local state if it's "production".
            // But let's just update memory for the session.
        },
        setHiddenBlogs(ids) {
            hiddenBlogIds = ids;
        },
        deleteProject(id) {
            loadedProjects = loadedProjects.filter(p => p.id !== id);
            loadedBlogPosts = loadedBlogPosts.filter(b => b.projectId !== id);
            const grid = document.querySelector('.projects-grid');
            if (grid) grid.innerHTML = '';
            App.initProjects();
        },
        deleteBlog(id) {
            // Could be a projectId OR an articleId
            loadedBlogPosts = loadedBlogPosts.filter(b => b.projectId !== id);
            loadedArticles = loadedArticles.filter(a => a.id !== id);

            const list = document.getElementById('blog-list');
            if (list) list.innerHTML = '';
            App.initBlog();
        },

        // Custom Article Persistence
        addCustomArticle(data) {
            // 1. Add to In-Memory for immediate display
            this.loadArticle(data);

            // 2. Add to Persistent List (if not exists)
            if (!customArticles.find(a => a.id === data.id)) {
                customArticles.push(data);
                localStorage.setItem(DB_KEYS.CUSTOM_ARTICLES, JSON.stringify(customArticles));
            }
        },
        deleteCustomArticle(id) {
            customArticles = customArticles.filter(a => a.id !== id);
            localStorage.setItem(DB_KEYS.CUSTOM_ARTICLES, JSON.stringify(customArticles));

            // Also remove from loaded memory logic
            this.deleteBlog(id);

            // Refresh Admin UI
            if (document.getElementById('article-list-admin')) App.renderAdminArticles();
        },
        getCustomArticles() { return customArticles; },

        // Review Management
        addReview(review) {
            review.id = 'rev_' + Date.now();
            customReviews.unshift(review); // Add to top
            localStorage.setItem(DB_KEYS.CUSTOM_REVIEWS, JSON.stringify(customReviews));
            return review;
        },
        deleteReview(id) {
            // Delete ANY review (default or custom)
            // Since we seeded defaults into customReviews, filtering works for all.
            customReviews = customReviews.filter(r => r.id != id); // Loose equality for number vs string ids
            localStorage.setItem(DB_KEYS.CUSTOM_REVIEWS, JSON.stringify(customReviews));

            const grid = document.getElementById('reviews-container');
            if (grid) App.initReviews();

            // Refresh Admin List
            if (document.getElementById('review-list-admin')) App.renderAdminReviews();
        },
        getReviews() {
            // All reviews are now in customReviews
            return customReviews;
        },
        getBlogPosts() {
            // Merge Project Blogs and Standalone Articles
            const projectBlogs = loadedBlogPosts.map(b => ({
                ...b,
                type: 'project',
                isHidden: hiddenBlogIds.includes(b.projectId)
            }));

            const articles = loadedArticles.map(a => ({
                ...a,
                type: 'article',
                projectId: a.projectId || null, // Preserve linked projectId if exists
                isHidden: hiddenBlogIds.includes(a.id)
            }));

            const allPosts = [...projectBlogs, ...articles];

            // Sort by Date (Newest First)
            return allPosts.sort((a, b) => new Date(b.date) - new Date(a.date));
        },
        login(password) {
            if (password === 'admin123') {
                localStorage.setItem(DB_KEYS.AUTH, 'true');
                return true;
            }
            return false;
        },
        logout() { localStorage.removeItem(DB_KEYS.AUTH); },
        isLoggedIn() { return localStorage.getItem(DB_KEYS.AUTH) === 'true'; }
    };

    // --- COMPONENTS ---
    function renderNav() {
        const nav = document.createElement('nav');
        nav.className = 'navbar';

        nav.innerHTML = `
            <div class="container flex justify-between items-center">
                <a href="index.html" class="logo-link">
                    <img src="images/nexhaus_logo.png" alt="NexHaus" style="height: 40px; width: auto;">
                </a>
                
                <button class="menu-toggle" aria-label="Toggle Navigation">
                    <span></span>
                    <span></span>
                    <span></span>
                </button>

                <ul class="nav-links">
                    <li><a href="index.html" class="nav-link">HOME</a></li>
                    <li><a href="projects.html" class="nav-link">PROJECTS</a></li>
                    <li><a href="ethosphere.html" class="nav-link">ETHOSPHERE</a></li>
                    <li><a href="about.html" class="nav-link">ABOUT</a></li>
                    <li><a href="index.html#contact" class="nav-link">CONTACT</a></li>
                    ${Store.isLoggedIn()
                ? '<li><a href="#" onclick="App.logout()" class="nav-link" style="color: red;">LOGOUT</a></li>'
                : ''}
                </ul>
            </div>
        `;
        document.body.prepend(nav);

        // Mobile Menu Logic
        const toggle = nav.querySelector('.menu-toggle');
        const navLinks = nav.querySelector('.nav-links');
        const links = nav.querySelectorAll('.nav-link');

        toggle.addEventListener('click', () => {
            navLinks.classList.toggle('active');
            toggle.classList.toggle('active');

            // Staggered animation for links
            if (navLinks.classList.contains('active')) {
                links.forEach((link, index) => {
                    link.style.transitionDelay = `${index * 0.1}s`;
                });
            } else {
                links.forEach(link => link.style.transitionDelay = '0s');
            }
        });

        // Close menu when a link is clicked
        links.forEach(link => {
            link.addEventListener('click', () => {
                navLinks.classList.remove('active');
                toggle.classList.remove('active');
            });
        });

        // Scroll Effect
        window.addEventListener('scroll', () => {
            if (window.scrollY > 50) nav.classList.add('scrolled');
            else nav.classList.remove('scrolled');
        });
    }

    function renderFooter() {
        const footer = document.createElement('footer');
        footer.style.padding = '4rem 0';
        footer.style.borderTop = '1px solid var(--border-color)';
        footer.style.marginTop = '4rem';
        footer.innerHTML = `
            <div class="container flex justify-between">
                <div>
                    <h4 style="margin-bottom: 1rem;">NEXHAUS</h4>
                    <p class="text-small">© 2026 NexHaus Architects.<br>All rights reserved.</p>
                </div>
                <div class="flex gap-2 text-small">
                    <a href="blog.html">Blog</a>
                    <a href="https://www.instagram.com/nexhaus_india/" target="_blank">Instagram</a>
                    <a href="#">LinkedIn</a>
                    <a href="admin.html">Admin</a>
                </div>
            </div>
        `;
        document.body.appendChild(footer);
    }

    // --- APP LOGIC ---
    function initHero() {
        const projects = Store.getProjects().slice(0, 5);
        const slideContainer = document.querySelector('.hero-slideshow');
        if (!slideContainer || projects.length === 0) return;

        projects.forEach((p, index) => {
            const slide = document.createElement('div');
            slide.className = `slide ${index === 0 ? 'active' : ''}`;
            slide.style.backgroundImage = `url('${p.image}')`;
            slideContainer.appendChild(slide);
        });

        const content = document.querySelector('.hero-content h1');
        if (content && projects[0]) content.textContent = projects[0].title;

        let current = 0;
        setInterval(() => {
            const slides = document.querySelectorAll('.slide');
            slides[current].classList.remove('active');
            current = (current + 1) % slides.length;
            slides[current].classList.add('active');

            if (content) {
                content.style.opacity = 0;
                setTimeout(() => {
                    content.textContent = projects[current].title;
                    content.style.opacity = 1;
                }, 500);
            }
        }, 5000);
    }


    // --- SHARED EXPANSION LOGIC ---
    function attachProjectExpanders(gridSelector) {
        const grid = document.querySelector(gridSelector);
        if (!grid) return;

        const cards = grid.querySelectorAll('.project-card');
        const projects = Store.getProjects();

        cards.forEach(card => {
            card.addEventListener('click', (e) => {
                const clickedCard = e.currentTarget;
                let id = clickedCard.dataset.id;

                if (!id) return;

                if (!id) return;

                // Use loose equality to match string IDs (from DOM) with potential number IDs (from data)
                const project = projects.find(p => p.id == id);
                if (!project) return;

                // Close existing expander
                const existing = document.querySelector('.project-details-expander');
                if (existing) {
                    if (existing.dataset.projectId == id) {
                        closeExpander(existing);
                        return;
                    }
                    existing.remove();
                }

                createProjectExpander(grid, clickedCard, project);
            });
        });
    }

    function createProjectExpander(grid, clickedCard, project) {
        const cards = Array.from(grid.querySelectorAll('.project-card'));
        const visibleCards = cards.filter(c => c.style.display !== 'none');

        const clickedIndex = visibleCards.indexOf(clickedCard);
        const rowTop = clickedCard.offsetTop;

        let insertAfterCard = clickedCard;

        for (let i = clickedIndex; i < visibleCards.length; i++) {
            if (visibleCards[i].offsetTop > rowTop) {
                break;
            }
            insertAfterCard = visibleCards[i];
        }

        const expander = document.createElement('div');
        expander.className = 'project-details-expander';
        expander.dataset.projectId = project.id;

        // Gallery Logic
        let images = project.gallery && project.gallery.length > 0 ? project.gallery : [project.image];

        // Fallback hardcoded logic
        if (!project.gallery || project.gallery.length === 0) {
            if (project.title.includes('Maya')) images = ['images/maya/maya_01.jpg', 'images/maya/maya_02.jpg', 'images/maya/maya_03.jpg', 'images/maya/maya_04.jpg', 'images/maya/maya_05.jpg'];
            else if (project.title.includes('La Casa Blanca')) images = ['images/lacasablanca/lcb_01.jpg', 'images/lacasablanca/lcb_02.jpg', 'images/lacasablanca/lcb_03.jpg', 'images/lacasablanca/lcb_04.jpg'];
            else if (project.title.includes('Nisarga')) images = ['images/nisarga/nisarga_01.png', 'images/nisarga/nisarga_02.png', 'images/nisarga/nisarga_03.jpg'];
            else if (project.title.includes('Ira')) images = ['images/ira/ira_01.jpg', 'images/ira/ira_02.jpg', 'images/ira/ira_03.jpg', 'images/ira/ira_04.jpg'];
            else if (project.title.includes('Finecraft')) images = ['images/finecraft/fc_01.jpg', 'images/finecraft/fc_02.jpg', 'images/finecraft/fc_03.jpg'];
            else if (project.title.includes('Ruhaan')) images = ['images/ruhaan/ruhaan_02.jpg', 'images/ruhaan/ruhaan_03.jpg', 'images/ruhaan/ruhaan_04.jpg'];
        }

        const galleryHtml = images.map(img => `
             <div class="gallery-item"><img src="${img}" loading="lazy"></div>
         `).join('');

        expander.innerHTML = `
             <div class="expander-header">
                 <div>
                     <h2 style="font-weight: 300; margin-bottom: 0.5rem;">${project.title}</h2>
                     <p class="text-uppercase text-small">${project.category}</p>
                     <p style="margin-top: 1rem; max-width: 600px; color: var(--secondary-text);">${project.description}</p>
                 </div>
                 <button class="expander-close">&times;</button>
             </div>
             <div class="project-gallery">
                 ${galleryHtml}
             </div>
             ${(() => {
                // Check if blog exists and is NOT hidden
                if (!project.blog) return '';

                // We need to check hidden status. 
                // Since we are inside main.js and Store is in scope (or accessible globally via App/Store closure if designed right, 
                // but here Store is private inside IIFE. However, createProjectExpander is inside the IIFE too).
                // Wait, Store is defined above in the same scope. Perfect.

                const blogPost = Store.getBlogPosts().find(b => b.projectId === project.id);
                // If blogPost exists and isHidden is false
                if (blogPost && !blogPost.isHidden) {
                    return `
                        <div style="margin-top: 2rem; text-align: right;">
                            <a href="blog.html?id=${project.id}" class="hero-btn" style="margin-top: 0; background: var(--text-color); color: #fff; font-size: 0.8rem; padding: 0.8rem 1.5rem;">
                                Read Project Story &rarr;
                            </a>
                        </div>
                     `;
                }
                return '';
            })()}
         `;

        if (insertAfterCard.nextSibling) {
            grid.insertBefore(expander, insertAfterCard.nextSibling);
        } else {
            grid.appendChild(expander);
        }

        requestAnimationFrame(() => {
            expander.classList.add('active');
            const offset = expander.getBoundingClientRect().top + window.scrollY - 100;
            window.scrollTo({ top: offset, behavior: 'smooth' });
        });

        // Drag to Scroll Logic
        const gallery = expander.querySelector('.project-gallery');
        makeDraggable(gallery);

        expander.querySelector('.expander-close').addEventListener('click', () => closeExpander(expander));
    }

    function closeExpander(el) {
        el.classList.remove('active');
        setTimeout(() => el.remove(), 500);
    }

    function initProjects() {
        const grid = document.querySelector('.projects-grid');
        if (!grid) return;

        const projects = Store.getProjects().filter(p => !p.isHidden);

        const renderGrid = () => {
            grid.innerHTML = projects.map((p, index) => `
                <div class="project-card fade-in" data-id="${p.id}" data-index="${index}">
                    <img src="${p.image}" alt="${p.title}" class="project-image" loading="lazy">
                    <div class="project-info">
                        <h3>${p.title}</h3>
                        <p class="text-small text-uppercase">${p.category}</p>
                    </div>
                </div>
            `).join('');
            attachProjectExpanders('.projects-grid');
        };

        renderGrid();

        const filters = document.querySelectorAll('.filter-btn');
        filters.forEach(btn => {
            btn.addEventListener('click', (e) => {
                const existing = document.querySelector('.project-details-expander');
                if (existing) existing.remove();

                const category = e.target.dataset.category;
                const cards = document.querySelectorAll('.project-card');
                cards.forEach((card, index) => {
                    const pIndex = card.dataset.index;
                    const p = projects[pIndex];
                    if (category === 'All' || p.category === category) {
                        card.style.display = 'block';
                    } else {
                        card.style.display = 'none';
                    }
                });
            });
        });
    }

    function initBlog() {
        const list = document.getElementById('blog-list');
        if (!list) return;
        // Check post.isHidden (DECOUPLED from project)
        const posts = Store.getBlogPosts().filter(post => !post.isHidden);

        // Helper to render grid
        const renderBlogList = () => {
            list.innerHTML = posts.map((post, index) => {
                // Find image source
                let bgImage = post.image; // Default if article
                if (post.type === 'project') {
                    const project = Store.getProjects().find(p => p.id === post.projectId);
                    if (project) bgImage = project.image;
                }

                // Gradient Faded BG
                const bgStyle = bgImage ?
                    `background-image: linear-gradient(to right, #ffffff, rgba(255,255,255,0.4), #ffffff), url('${bgImage}');` :
                    'background-color: #f9f9f9;';

                return `
                <article class="blog-entry" data-project-id="${post.type === 'project' ? post.projectId : post.id}" data-index="${index}" 
                    style="position: relative; overflow: hidden; padding: 2.5rem 2rem; border-bottom: 1px solid var(--border-color); cursor: pointer; min-height: 220px; display: flex; flex-direction: column; justify-content: center;">
                    
                    <!-- Faded Background -->
                    <div class="blog-card-bg" style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; ${bgStyle} background-size: cover; background-position: center; opacity: 0.3; pointer-events: none; transition: transform 0.6s cubic-bezier(0.165, 0.84, 0.44, 1), opacity 0.4s ease;"></div>
                    
                    <!-- Content Overlay -->
                    <div style="position: relative; z-index: 2;">
                        <span class="text-small text-uppercase" style="letter-spacing: 0.1em; font-weight: 600; color: var(--accent-color);">${post.date}</span> 
                        ${post.type === 'article' ? '<span class="text-small" style="color:var(--text-color); border:1px solid #ccc; padding:0 4px; border-radius:4px; margin-left:8px;">Article</span>' : ''}
                        
                        <h2 class="blog-title-hover" style="margin: 1rem 0; font-size: 2.5rem; max-width: 900px;">${post.title}</h2>
                        
                        <p style="color: var(--text-color); max-width: 700px; font-size: 1.1rem; line-height: 1.6; opacity: 0.8;">${post.excerpt}</p>
                        
                        <button class="text-small text-uppercase" style="margin-top: 2rem; background:none; border:none; text-decoration:underline; cursor:pointer; font-weight: 600;">Read Entry</button>
                    </div>
                </article>
            `}).join('');

            attachBlogListeners();

            // Auto-expand if URL has ?id=xyz
            const urlParams = new URLSearchParams(window.location.search);
            const autoId = urlParams.get('id');
            if (autoId) {
                // Find element with this data-project-id (which covers both projects and articles)
                const targetArticle = document.querySelector(`.blog-entry[data-project-id="${autoId}"]`);
                if (targetArticle) {
                    // We need to simulate the event structure for handleBlogClick
                    // Or just call the click handler manually if we refactored, but simulated click is easiest
                    // However, handleBlogClick expects 'e.currentTarget'

                    // Create a synthetic event object
                    const syntheticEvent = { currentTarget: targetArticle };
                    handleBlogClick(syntheticEvent);
                }
            }
        };

        const attachBlogListeners = () => {
            const articles = document.querySelectorAll('.blog-entry');
            articles.forEach(article => {
                article.addEventListener('click', handleBlogClick);
            });
        };

        const handleBlogClick = (e) => {
            const article = e.currentTarget;
            const contextId = article.dataset.projectId; // Can be projectId OR articleId

            // Determine type
            const post = posts.find(p => p.projectId == contextId || p.id == contextId);

            if (!post) return;

            // Close existing if any
            const existing = document.querySelector('.blog-details-expander');
            if (existing) {
                if (existing.dataset.contextId == contextId) {
                    closeExpander(existing);
                    return;
                }
                existing.remove();
            }

            if (post.projectId) {
                const project = Store.getProjects().find(p => p.id == post.projectId);
                // If project exists, use it. If not (e.g. broken link), fall back to article expander? 
                // Let's assume project exists if projectId is set.
                if (project) {
                    createBlogExpander(article, project, post);
                } else {
                    createArticleExpander(article, post);
                }
            } else {
                createArticleExpander(article, post);
            }
        };

        const createBlogExpander = (clickedArticle, project, post) => {
            // ... [Previous logic for Project Blogs] ...
            // Reuse existing logic, but pass post content explicitly if needed
            if (!project) return;

            const expander = document.createElement('div');
            expander.className = 'blog-details-expander';
            expander.dataset.contextId = project.id; // Use contextId for tracking

            // --- IMAGE INJECTION LOGIC (Project Gallery) ---
            const getTextHtml = () => {
                const rawText = post.content || '';
                const paragraphs = rawText.split('\n\n').filter(p => p.trim() !== '');
                const images = project.gallery && project.gallery.length > 0 ? project.gallery : [project.image];
                // ... [Same Injection Logic] ...
                let html = '';
                let imgIndex = 0;
                paragraphs.forEach((para, index) => {
                    html += `<p style="margin-bottom: 1.5rem; line-height: 1.8; font-size: 1.1rem; color: #333;">${para.trim()}</p>`;
                    // Inject image every 2 paragraphs
                    if ((index + 1) % 2 === 0 && index !== paragraphs.length - 1) {
                        const img = images[imgIndex % images.length];
                        html += `<div class="blog-inline-image-container fade-in"><img src="${img}" class="blog-inline-image" alt="Visual for ${project.title}" loading="lazy"></div>`;
                        imgIndex++;
                    }
                });
                return html;
            };

            expander.innerHTML = `
                <div class="expander-content" style="max-width: 800px; margin: 0 auto; padding: 4rem 0;">
                     <button class="expander-close" style="float: right;">&times;</button>
                     <span class="text-uppercase text-small" style="display:block; margin-bottom: 1rem;">${post.date}</span>
                     <h1 style="font-size: 2.5rem; margin-bottom: 2rem;">${post.title}</h1>
                     <div class="blog-body">${getTextHtml()}</div>
                </div>
             `;
            insertExpander(clickedArticle, expander);
        };

        const createArticleExpander = (clickedArticle, post) => {
            const expander = document.createElement('div');
            expander.className = 'blog-details-expander';
            expander.dataset.contextId = post.id;

            // Simple Text Formatting for Articles (No auto-gallery injection)
            const getTextHtml = () => {
                return post.content.split('\n\n').map(p =>
                    `<p style="margin-bottom: 1.5rem; line-height: 1.8; font-size: 1.1rem; color: #333;">${p.trim()}</p>`
                ).join('');
            };

            expander.innerHTML = `
                <div class="expander-content" style="max-width: 800px; margin: 0 auto; padding: 4rem 0;">
                     <button class="expander-close" style="float: right;">&times;</button>
                     ${post.image ? `<img src="${post.image}" style="width:100%; height: auto; margin-bottom: 2rem; border-radius: 4px;" loading="lazy">` : ''}
                     <span class="text-uppercase text-small" style="display:block; margin-bottom: 1rem;">${post.date}</span>
                     <h1 style="font-size: 2.5rem; margin-bottom: 2rem;">${post.title}</h1>
                     <div class="blog-body">${getTextHtml()}</div>
                </div>
             `;
            insertExpander(clickedArticle, expander);
        };

        const insertExpander = (clickedArticle, expander) => {
            clickedArticle.after(expander);
            requestAnimationFrame(() => {
                expander.classList.add('active');
                const offset = expander.getBoundingClientRect().top + window.scrollY - 100;
                window.scrollTo({ top: offset, behavior: 'smooth' });
            });
            expander.querySelector('.expander-close').addEventListener('click', () => closeExpander(expander));
        };

        const closeExpander = (el) => {
            el.classList.remove('active');
            setTimeout(() => el.remove(), 500);
        };

        renderBlogList();
    }

    function initReviews() {
        const container = document.getElementById('reviews-container');
        if (!container) return;

        const reviews = Store.getReviews();

        // Carousel Mode if > 3 reviews
        if (reviews.length > 3) {
            // Setup Container for Hidden Overflow
            container.className = 'review-carousel-container';
            // Clear styles that might interfere
            container.style.display = 'block';
            container.style.overflowX = 'visible';

            // Clone first 3 items for infinite loop illusion
            const clones = reviews.slice(0, 3);
            const allSlides = [...reviews, ...clones];

            container.innerHTML = `
                <div class="carousel-track-wrapper" style="overflow: hidden; width: 100%;">
                    <div class="carousel-track" style="display: flex; width: 100%;">
                        ${allSlides.map(r => `
                            <div class="review-slide" style="flex: 0 0 33.333%; padding: 0 1rem; box-sizing: border-box;">
                                <div class="review-card fade-in" style="height: 100%; display: flex; flex-direction: column; justify-content: space-between;">
                                    <p class="review-text" style="font-size: 0.95rem;">"${r.text}"</p>
                                    <div class="review-author" style="margin-top: 1rem;">
                                        <span class="client-name">${r.client}</span>
                                        <span class="client-role">${r.role}</span>
                                    </div>
                                </div>
                            </div>
                        `).join('')}
                    </div>
                </div>
                <!-- Custom Dots Controls -->
                <div class="carousel-dots" style="display: flex; justify-content: center; align-items: center; gap: 1rem; margin-top: 2rem;">
                    <button class="dot-btn prev-dot" title="Previous" style="width: 10px; height: 10px; border-radius: 50%; border: 1px solid var(--text-color); background: transparent; cursor: pointer; padding: 0;"></button>
                    <button class="dot-btn dummy-dot" style="width: 10px; height: 10px; border-radius: 50%; border: 1px solid var(--text-color); background: var(--text-color); cursor: default; padding: 0;"></button>
                    <button class="dot-btn next-dot" title="Next" style="width: 10px; height: 10px; border-radius: 50%; border: 1px solid var(--text-color); background: transparent; cursor: pointer; padding: 0;"></button>
                </div>
            `;

            // Logic
            const track = container.querySelector('.carousel-track');
            const totalOriginal = reviews.length;
            const viewSize = 3;
            let currentIndex = 0;
            let autoSlideInterval;
            let isTransitioning = false;

            const updateCarousel = (withTransition = true) => {
                if (withTransition) {
                    track.style.transition = 'transform 0.5s ease-in-out';
                } else {
                    track.style.transition = 'none';
                }
                const percent = currentIndex * (100 / viewSize);
                track.style.transform = `translateX(-${percent}%)`;
            };

            const nextSlide = () => {
                if (isTransitioning) return;
                isTransitioning = true;
                currentIndex++;
                updateCarousel(true);
                resetTimer();
            };

            const prevSlide = () => {
                if (isTransitioning) return;
                isTransitioning = true;
                if (currentIndex === 0) {
                    // Instant jump to end (clones)
                    currentIndex = totalOriginal;
                    updateCarousel(false);
                    // Force Reflow
                    track.offsetHeight;
                    // Then animate back
                    requestAnimationFrame(() => {
                        currentIndex--;
                        updateCarousel(true);
                    });
                } else {
                    currentIndex--;
                    updateCarousel(true);
                }
                resetTimer();
            };

            const handleTransitionEnd = () => {
                isTransitioning = false;
                // If we reached the clones (index == totalOriginal)
                if (currentIndex >= totalOriginal) {
                    currentIndex = 0;
                    updateCarousel(false);
                }
            };

            track.addEventListener('transitionend', handleTransitionEnd);

            const resetTimer = () => {
                clearInterval(autoSlideInterval);
                autoSlideInterval = setInterval(nextSlide, 3000);
            };

            // Controls
            container.querySelector('.prev-dot').addEventListener('click', prevSlide);
            container.querySelector('.next-dot').addEventListener('click', nextSlide);
            // Dummy dot does nothing

            // Init Timer
            resetTimer();

        } else {
            // Grid Mode (Default)
            container.className = 'grid reviews-grid';
            container.style = '';

            container.innerHTML = reviews.map(r => `
                <div class="review-card fade-in">
                    <p class="review-text">"${r.text}"</p>
                    <div class="review-author">
                        <span class="client-name">${r.client}</span>
                        <span class="client-role">${r.role}</span>
                    </div>
                </div>
            `).join('');

            // Enable drag to scroll for mobile/desktop convenience
            makeDraggable(container);
        }
    }

    function initContact() {
        const form = document.getElementById('contact-form');
        if (!form) return;

        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            const data = new FormData(form);
            try {
                const response = await fetch(form.action, {
                    method: form.method,
                    body: data,
                    headers: {
                        'Accept': 'application/json'
                    }
                });

                if (response.ok) {
                    alert('Thank you! Your message has been sent.');
                    form.reset();
                } else {
                    alert('Oops! There was a problem sending your message.');
                }
            } catch (error) {
                alert('Oops! There was a problem sending your message.');
            }
        });
    }

    function initRandomBlog() {
        const container = document.getElementById('random-blog-container');
        if (!container) return;

        // Check post.isHidden
        const posts = Store.getBlogPosts().filter(post => !post.isHidden);
        if (posts.length === 0) return;

        const randomPost = posts[Math.floor(Math.random() * posts.length)];

        container.innerHTML = `
            <div class="blog-featured-card fade-in" style="border: 1px solid var(--border-color); padding: 3rem; text-align: center; display: flex; flex-direction: column; align-items: center; background: #fafafa;">
                <span class="text-small text-uppercase" style="letter-spacing: 0.2em; margin-bottom: 1rem; display: block;">Featured Insight</span>
                <h3 style="font-size: 2rem; margin-bottom: 1.5rem; max-width: 800px;">${randomPost.title}</h3>
                <p style="color: var(--secondary-text); margin-bottom: 2rem; max-width: 600px; line-height: 1.8;">${randomPost.excerpt}</p>
                <a href="blog.html?id=${randomPost.type === 'project' ? randomPost.projectId : randomPost.id}" style="text-decoration: underline; text-underline-offset: 4px; font-weight: 500;">Read Full Article</a>
            </div>
        `;
    }

    function initAdmin() {
        const loginForm = document.getElementById('login-form');
        const dashboard = document.getElementById('dashboard');
        const projectList = document.getElementById('project-list');
        const addForm = document.getElementById('add-project-form');
        const addArticleForm = document.getElementById('add-article-form');

        if (Store.isLoggedIn()) showDashboard(); else showLogin();

        if (loginForm) {
            loginForm.addEventListener('submit', (e) => {
                e.preventDefault();
                if (Store.login(document.getElementById('password').value)) showDashboard();
                else alert('Invalid Password');
            });
        }

        if (addArticleForm) {
            // Populate Dropdown
            const projectSelect = document.getElementById('a-project-select');
            const linkCheckbox = document.getElementById('a-link-project');

            if (projectSelect && linkCheckbox) {
                const projects = Store.getProjects();
                projects.forEach(p => {
                    const opt = document.createElement('option');
                    opt.value = p.id;
                    opt.textContent = p.title;
                    projectSelect.appendChild(opt);
                });

                // Toggle Logic
                linkCheckbox.addEventListener('change', (e) => {
                    projectSelect.disabled = !e.target.checked;
                    projectSelect.style.opacity = e.target.checked ? '1' : '0.6';
                    projectSelect.style.cursor = e.target.checked ? 'pointer' : 'not-allowed';
                });

                // Auto-Populate Image
                projectSelect.addEventListener('change', (e) => {
                    const pid = e.target.value;
                    if (pid) {
                        const p = Store.getProjects().find(proj => proj.id === pid);
                        if (p) {
                            document.getElementById('a-image').value = p.image;
                        }
                    }
                });
            }

            addArticleForm.addEventListener('submit', (e) => {
                e.preventDefault();
                const aTitle = document.getElementById('a-title').value;
                const aId = aTitle.toLowerCase().replace(/[^a-z0-9]/g, '');
                const aDate = document.getElementById('a-date').value || new Date().toISOString().split('T')[0];
                const aImage = document.getElementById('a-image').value;
                const aContent = document.getElementById('a-content').value;
                const aExcerpt = aContent.substring(0, 100) + '...';

                // Project Link Data
                let linkedProjectId = null;
                if (linkCheckbox && linkCheckbox.checked) {
                    linkedProjectId = projectSelect.value;
                }

                // Conditionally add projectId field to file output
                const projectField = linkedProjectId ? `    projectId: '${linkedProjectId}',` : '';

                // Persistent Update
                Store.addCustomArticle({
                    id: aId,
                    projectId: linkedProjectId,
                    title: aTitle,
                    date: aDate,
                    excerpt: aExcerpt,
                    content: aContent,
                    image: aImage
                });

                alert('Article Added! Now click "Export Config (Publish)" to save changes permanently.');

                addArticleForm.reset();
                // Reset Checkbox state
                if (linkCheckbox) {
                    linkCheckbox.checked = false;
                    projectSelect.disabled = true;
                    projectSelect.style.opacity = '0.6';
                    projectSelect.style.cursor = 'not-allowed';
                }

                // Refresh Admin List if we add it
                if (document.getElementById('article-list-admin')) App.renderAdminArticles();
            });
        }

        if (dashboard) {
            // Check for Review Form
            const addReviewForm = document.getElementById('add-review-form');
            if (addReviewForm) {
                renderAdminReviews();

                addReviewForm.addEventListener('submit', (e) => {
                    e.preventDefault();
                    const client = document.getElementById('r-client').value;
                    const role = document.getElementById('r-role').value;
                    const text = document.getElementById('r-text').value;

                    // Add to Store
                    Store.addReview({ client, role, text });

                    alert('Review Added!');
                    addReviewForm.reset();
                    renderAdminReviews();
                });
            }
        }

        if (addForm) {
            addForm.addEventListener('submit', (e) => {
                e.preventDefault();

                // 1. Gather Data
                const pTitle = document.getElementById('p-title').value;
                const pId = pTitle.toLowerCase().replace(/[^a-z0-9]/g, '');
                const pCategory = document.getElementById('p-category').value;
                const pImage = document.getElementById('p-image').value;
                const pDesc = document.getElementById('p-desc').value;
                const pEthosphere = document.getElementById('p-ethosphere').checked;
                const pConceptual = document.getElementById('p-conceptual').checked;

                const galleryInput = document.getElementById('p-gallery').value;
                const gallery = galleryInput ? galleryInput.split(',').map(url => url.trim()).filter(url => url) : [];

                const bTitle = document.getElementById('b-title').value || pTitle;
                const bDate = document.getElementById('b-date').value || new Date().toISOString().split('T')[0];
                const bExcerpt = document.getElementById('b-excerpt').value || pDesc;
                const bContent = document.getElementById('b-content').value || '';

                // 2. Generate File Content
                // We manually construct/stringify to match the "readable" format of previous files
                const fileContent = `/* 
   INSTRUCTIONS:
   1. You can edit the text below.
   2. Keep the quotes (\` \`) around the text.
   3. Save this file to "projects/${pId}.txt"
*/

App.loadProject({
    id: '${pId}',
    title: '${pTitle.replace(/'/g, "\\'")}',
    category: '${pCategory}',
    image: '${pImage}',
    description: '${pDesc.replace(/'/g, "\\'")}',
    isEthosphere: ${pEthosphere},
    isConceptual: ${pConceptual},
    gallery: [
${gallery.map(img => `        '${img}'`).join(',\n')}
    ],
    blog: {
        title: '${bTitle.replace(/'/g, "\\'")}',
        date: '${bDate}',
        excerpt: '${bExcerpt.replace(/'/g, "\\'")}',
        content: \`
${bContent.replace(/`/g, '\\`')}
        \`
    }
});
`;

                // 3. Trigger Download
                const blob = new Blob([fileContent], { type: 'text/plain' });
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.style.display = 'none';
                a.href = url;
                a.download = `${pId}.txt`;
                document.body.appendChild(a);
                a.click();
                window.URL.revokeObjectURL(url);

                // 4. Instructions
                const scriptTag = `<script src="projects/${pId}.txt"><\/script>`;
                alert(`SUCCESS! Project file downloaded as "${pId}.txt".\n\n1. Move this file to your "projects" folder.\n2. Add this line to index.html (and others):\n\n${scriptTag}`);

                // 5. Temporary Local Update (Optional - mostly for UI feedback)
                // We construct the object for Store just so it appears in the list now
                const newProject = {
                    id: pId,
                    title: pTitle,
                    category: pCategory,
                    image: pImage,
                    description: pDesc,
                    gallery: gallery,
                    isEthosphere: pEthosphere,
                    isConceptual: pConceptual,
                    blog: { title: bTitle, date: bDate, excerpt: bExcerpt, content: bContent }
                };
                Store.addProject(newProject);
                renderProjectList();
                addForm.reset();
            });
        }

        function showLogin() {
            loginForm.classList.remove('hidden');
            loginForm.parentElement.classList.remove('hidden'); // Ensure wrapper is visible too if needed
            dashboard.classList.add('hidden');
        }

        function showDashboard() {
            loginForm.classList.add('hidden');
            loginForm.parentElement.classList.add('hidden');
            dashboard.classList.remove('hidden');
            renderProjectList();
            App.renderAdminArticles();
        }

        function renderProjectList() {
            if (!projectList) return;
            const projects = Store.getProjects();
            const blogs = Store.getBlogPosts();

            projectList.innerHTML = projects.map(p => {
                const blogPost = blogs.find(b => b.projectId === p.id);
                const blogHidden = blogPost ? blogPost.isHidden : false;

                return `
                <div class="flex justify-between items-center" style="padding: 1rem; border-bottom: 1px solid var(--border-color);">
                    <!-- Project Info -->
                    <div style="flex: 1; opacity: ${p.isHidden ? '0.5' : '1'};">
                        <div style="font-weight: 600; font-size: 1.1rem; margin-bottom: 0.5rem;">${p.title} ${p.isHidden ? '(HIDDEN)' : ''}</div>
                        <div style="font-size: 0.9rem; color: var(--secondary-text); margin-bottom: 0.5rem;">
                             ${p.isEthosphere ? '[ETHOSPHERE] ' : ''}${p.isConceptual ? '[CONCEPTUAL] ' : ''}${p.category}
                        </div>
                        <div>
                            <button onclick="App.toggleVisibility('${p.id}')" style="padding: 0.3rem 0.6rem; background: ${p.isHidden ? '#4CAF50' : '#FF9800'}; color:white; border:none; cursor:pointer; font-size: 0.8rem; margin-right: 0.5rem;">Project: ${p.isHidden ? 'Unhide' : 'Hide'}</button>
                            <button onclick="App.deleteProject('${p.id}')" style="padding: 0.3rem 0.6rem; background: #e53935; color:white; border:none; cursor:pointer; font-size: 0.8rem;">Delete</button>
                        </div>
                    </div>

                    <!-- Blog Info -->
                    <div style="flex: 1; padding-left: 1rem; border-left: 1px solid #eee; opacity: ${blogHidden ? '0.5' : '1'};">
                        ${blogPost ? `
                            <div style="font-weight: 500; margin-bottom: 0.5rem;">Blog: ${blogPost.title} ${blogHidden ? '(HIDDEN)' : ''}</div>
                             <div>
                                <button onclick="App.toggleBlogVisibility('${p.id}')" style="padding: 0.3rem 0.6rem; background: ${blogHidden ? '#4CAF50' : '#795548'}; color:white; border:none; cursor:pointer; font-size: 0.8rem; margin-right: 0.5rem;">Blog: ${blogHidden ? 'Unhide' : 'Hide'}</button>
                           </div>
                        ` : '<div style="color: #ccc;">No Blog Post</div>'}
                    </div>
                </div>
            `}).join('');
        }
    }

    function renderAdminReviews() {
        const list = document.getElementById('review-list-admin');
        if (!list) return;

        const reviews = Store.getReviews();
        list.innerHTML = reviews.map(r => `
            <div style="padding: 1rem; border-bottom: 1px solid #eee; display: flex; justify-content: space-between; align-items: start;">
                <div>
                    <strong>${r.client}</strong> <span class="text-small">(${r.role})</span>
                    <p style="color: var(--secondary-text); margin-top: 0.5rem; font-style: italic;">"${r.text}"</p>
                </div>
                <button onclick="App.deleteReview('${r.id}')" style="background: red; color: white; border: none; cursor: pointer; padding: 0.5rem; font-size: 0.8rem;">Delete</button>
            </div>
        `).join('');
    }

    function initEthosphere() {
        const grid = document.getElementById('ethosphere-grid');
        if (!grid) return;

        // Filter for premium projects AND not hidden
        const projects = Store.getProjects().filter(p => p.isEthosphere && !p.isHidden);

        if (projects.length === 0) {
            grid.innerHTML = '<p>No Ethosphere projects currently released.</p>';
            return;
        }

        grid.innerHTML = projects.map(p => `
            <div class="project-card fade-in" data-id="${p.id}">
                <img src="${p.image}" alt="${p.title}" class="project-image" loading="lazy">
                <div class="project-info">
                    <h3>${p.title}</h3>
                    <p class="text-small text-uppercase">Premium Collection</p>
                </div>
            </div>
        `).join('');

        attachProjectExpanders('#ethosphere-grid');
    }

    // Initialize Data
    Store.init();

    // --- Helper: Make Element Draggable ---
    function makeDraggable(element) {
        if (!element) return;
        let isDown = false;
        let startX;
        let scrollLeft;

        element.style.cursor = 'grab';

        element.addEventListener('mousedown', (e) => {
            isDown = true;
            element.classList.add('dragging');
            startX = e.pageX - element.offsetLeft;
            scrollLeft = element.scrollLeft;
            element.style.scrollSnapType = 'none';
            element.style.cursor = 'grabbing';
        });

        element.addEventListener('mouseleave', () => {
            isDown = false;
            element.classList.remove('dragging');
            element.style.scrollSnapType = 'x mandatory';
            element.style.cursor = 'grab';
        });

        element.addEventListener('mouseup', () => {
            isDown = false;
            element.classList.remove('dragging');
            element.style.scrollSnapType = 'x mandatory';
            element.style.cursor = 'grab';
        });

        element.addEventListener('mousemove', (e) => {
            if (!isDown) return;
            e.preventDefault();
            const x = e.pageX - element.offsetLeft;
            const walk = (x - startX) * 2;
            element.scrollLeft = scrollLeft - walk;
        });
    }

    // Public API
    return {
        renderNav,
        renderFooter,
        initHero,
        initProjects,
        initBlog,
        initAdmin,
        initEthosphere,
        initReviews,
        initContact,
        initRandomBlog,
        renderAdminReviews, // Expose for Store internal call via App ref if needed, or if external
        loadProject: Store.loadProject.bind(Store), // Expose for external scripts
        loadArticle: Store.loadArticle.bind(Store), // Expose article loader!
        deleteProject: Store.deleteProject.bind(Store), // Expose for onclick
        deleteBlog: Store.deleteBlog.bind(Store),
        deleteReview: Store.deleteReview.bind(Store), // Expose for onclick
        addReview: Store.addReview.bind(Store), // Expose if needed? mostly internal but good for debug
        deleteCustomArticle: Store.deleteCustomArticle.bind(Store), // NEW: Expose delete logic
        renderAdminArticles: () => {
            const list = document.getElementById('article-list-admin');
            if (!list) return;
            // We can check Store.getCustomArticles() or Store.getBlogPosts() filter by custom?
            // Let's use getCustomArticles() for the "Manage Your Drafts" section
            const articles = Store.getCustomArticles();

            if (articles.length === 0) {
                list.innerHTML = '<p style="color: #999; font-style: italic;">No custom articles drafted.</p>';
                return;
            }

            list.innerHTML = articles.map(a => `
                <div style="padding: 1rem; border-bottom: 1px solid #eee; display: flex; justify-content: space-between; align-items: start;">
                    <div>
                        <strong>${a.title}</strong> <span class="text-small">(${a.date})</span>
                        <div class="text-small" style="color: var(--secondary-text);">${a.excerpt.substring(0, 60)}...</div>
                    </div>
                    <button onclick="App.deleteCustomArticle('${a.id}')" style="background: red; color: white; border: none; cursor: pointer; padding: 0.5rem; font-size: 0.8rem;">Delete</button>
                </div>
             `).join('');
        },
        toggleVisibility: (id) => {
            Store.toggleVisibility(id);
            location.reload();
        },
        toggleBlogVisibility: (id) => {
            Store.toggleBlogVisibility(id);
            location.reload();
        },
        setHiddenProjects: Store.setHiddenProjects.bind(Store),
        setHiddenBlogs: Store.setHiddenBlogs.bind(Store),
        exportUpdates: () => {
            // 1. Gather Custom Reviews (exclude defaults if possible, but here we just check ID format)
            const reviews = Store.getReviews().filter(r => typeof r.id === 'string' && r.id.startsWith('rev_'));

            // 2. Gather Hidden IDs
            const hiddenP = hiddenProjectIds; // Access via closure
            const hiddenB = hiddenBlogIds;

            let content = `/* 
    UPDATES.JS - Dynamic Configuration
    Generated by Admin Panel
    Save this file to "js/updates.js" to publish changes.
*/

// 1. Hidden Content Configuration
App.setHiddenProjects(${JSON.stringify(hiddenP)});
App.setHiddenBlogs(${JSON.stringify(hiddenB)});

// 2. Custom Reviews
`;

            reviews.forEach(r => {
                content += `
App.addReview({
    client: "${r.client}",
    role: "${r.role}",
    text: \`${r.text.replace(/`/g, '\\`')}\` // Escape backticks
});
`;
            });

            // 3. Custom Articles
            const articles = customArticles;
            articles.forEach(a => {
                // Format content for updates.js
                // We need to safely stringify the content
                content += `
App.loadArticle({
    id: '${a.id}',
    projectId: ${a.projectId ? `'${a.projectId}'` : 'null'},
    title: '${a.title.replace(/'/g, "\\'")}',
    date: '${a.date}',
    image: '${a.image}',
    excerpt: '${a.excerpt.replace(/'/g, "\\'")}',
    content: \`${a.content.replace(/`/g, '\\`')}\`
});
`;
            });

            // Trigger Download
            const blob = new Blob([content], { type: 'text/javascript' });
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.style.display = 'none';
            a.href = url;
            a.download = 'updates.js';
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
        },
        logout: () => { Store.logout(); location.reload(); }
    };

})();
