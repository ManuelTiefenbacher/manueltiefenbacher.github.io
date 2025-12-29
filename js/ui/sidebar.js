// Sidebar Navigation Logic
document.addEventListener('DOMContentLoaded', function() {
    initSidebar();
});

function initSidebar() {
    const sidebar = document.querySelector('.sidebar');
    const mainContent = document.querySelector('.main-content');
    const sidebarToggle = document.querySelector('.sidebar-toggle');
    const mobileSidebarToggle = document.querySelector('.mobile-sidebar-toggle');
    const sidebarOverlay = document.querySelector('.sidebar-overlay');
    const navItems = document.querySelectorAll('.nav-item');

    // Desktop sidebar toggle
    if (sidebarToggle) {
        sidebarToggle.addEventListener('click', function() {
            sidebar.classList.toggle('collapsed');
            mainContent.classList.toggle('expanded');
            
            // Save state to localStorage
            const isCollapsed = sidebar.classList.contains('collapsed');
            localStorage.setItem('sidebarCollapsed', isCollapsed);
        });

        // Restore sidebar state
        const savedState = localStorage.getItem('sidebarCollapsed');
        if (savedState === 'true' && window.innerWidth > 968) {
            sidebar.classList.add('collapsed');
            mainContent.classList.add('expanded');
        }
    }

    // Mobile sidebar toggle
    if (mobileSidebarToggle) {
        mobileSidebarToggle.addEventListener('click', function() {
            const isOpen = sidebar.classList.contains('mobile-open');
            
            if (isOpen) {
                closeMobileSidebar();
            } else {
                openMobileSidebar();
            }
        });
    }

    // Overlay click to close
    if (sidebarOverlay) {
        sidebarOverlay.addEventListener('click', closeMobileSidebar);
    }

    // Navigation items
    navItems.forEach(item => {
        item.addEventListener('click', function(e) {
            e.preventDefault();
            const pageId = this.getAttribute('data-page');
            
            if (pageId) {
                navigateToPage(pageId);
                
                // Close mobile sidebar after navigation
                if (window.innerWidth <= 968) {
                    closeMobileSidebar();
                }
            }
        });
    });

    // Close sidebar on escape key (mobile)
    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape' && sidebar.classList.contains('mobile-open')) {
            closeMobileSidebar();
        }
    });

    // Handle window resize
    let resizeTimer;
    window.addEventListener('resize', function() {
        clearTimeout(resizeTimer);
        resizeTimer = setTimeout(function() {
            if (window.innerWidth > 968) {
                // Desktop: close mobile sidebar, restore collapsed state
                closeMobileSidebar();
                const savedState = localStorage.getItem('sidebarCollapsed');
                if (savedState === 'true') {
                    sidebar.classList.add('collapsed');
                    mainContent.classList.add('expanded');
                } else {
                    sidebar.classList.remove('collapsed');
                    mainContent.classList.remove('expanded');
                }
            } else {
                // Mobile/Tablet: remove collapsed state
                sidebar.classList.remove('collapsed');
                mainContent.classList.remove('expanded');
            }
        }, 250);
    });
}

function openMobileSidebar() {
    const sidebar = document.querySelector('.sidebar');
    const overlay = document.querySelector('.sidebar-overlay');
    const toggle = document.querySelector('.mobile-sidebar-toggle');
    
    sidebar.classList.add('mobile-open');
    overlay.classList.add('active');
    toggle.classList.add('active');
    document.body.style.overflow = 'hidden';
}

function closeMobileSidebar() {
    const sidebar = document.querySelector('.sidebar');
    const overlay = document.querySelector('.sidebar-overlay');
    const toggle = document.querySelector('.mobile-sidebar-toggle');
    
    sidebar.classList.remove('mobile-open');
    overlay.classList.remove('active');
    toggle.classList.remove('active');
    document.body.style.overflow = '';
}

function navigateToPage(pageId) {
    // Hide all pages
    const pages = document.querySelectorAll('.content-page');
    pages.forEach(page => page.classList.remove('active'));

    // Show selected page
    const selectedPage = document.getElementById(pageId);
    if (selectedPage) {
        selectedPage.classList.add('active');
    }

    // Update active nav item
    const navItems = document.querySelectorAll('.nav-item');
    navItems.forEach(item => {
        if (item.getAttribute('data-page') === pageId) {
            item.classList.add('active');
        } else {
            item.classList.remove('active');
        }
    });

    // Update URL hash (optional, for bookmarking)
    window.location.hash = pageId;

    // Scroll to top
    window.scrollTo(0, 0);
}

// Support for legacy switchTab function (backwards compatibility)
function switchTab(tabName) {
    const pageMap = {
        'upload': 'page-upload',
        'settings': 'page-settings',
        'analysis': 'page-analysis',
        'comparison': 'page-comparison'
    };
    
    const pageId = pageMap[tabName] || `page-${tabName}`;
    navigateToPage(pageId);
}

// Initialize on page load - check for hash
window.addEventListener('load', function() {
    const hash = window.location.hash.substring(1);
    if (hash) {
        navigateToPage(hash);
    } else {
        // Default to first page
        navigateToPage('page-upload');
    }
});