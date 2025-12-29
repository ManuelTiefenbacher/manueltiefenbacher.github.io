// Mobile Burger Menu Functionality
document.addEventListener('DOMContentLoaded', function() {
    // Create burger menu button
    const header = document.querySelector('header');
    const tabNav = document.querySelector('.tab-nav');
    
    if (header && tabNav && window.innerWidth <= 480) {
        // Create burger button
        const burgerBtn = document.createElement('button');
        burgerBtn.className = 'mobile-menu-toggle';
        burgerBtn.setAttribute('aria-label', 'Toggle menu');
        burgerBtn.innerHTML = `
            <span></span>
            <span></span>
            <span></span>
        `;
        
        header.appendChild(burgerBtn);
        
        // Toggle menu on click
        burgerBtn.addEventListener('click', function() {
            this.classList.toggle('active');
            tabNav.classList.toggle('mobile-open');
            document.body.style.overflow = tabNav.classList.contains('mobile-open') ? 'hidden' : '';
        });
        
        // Close menu when tab is clicked
        const tabButtons = document.querySelectorAll('.tab-button');
        tabButtons.forEach(button => {
            button.addEventListener('click', function() {
                burgerBtn.classList.remove('active');
                tabNav.classList.remove('mobile-open');
                document.body.style.overflow = '';
            });
        });
        
        // Close menu on escape key
        document.addEventListener('keydown', function(e) {
            if (e.key === 'Escape' && tabNav.classList.contains('mobile-open')) {
                burgerBtn.classList.remove('active');
                tabNav.classList.remove('mobile-open');
                document.body.style.overflow = '';
            }
        });
    }
});

// Handle window resize
let resizeTimer;
window.addEventListener('resize', function() {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(function() {
        const burgerBtn = document.querySelector('.mobile-menu-toggle');
        const tabNav = document.querySelector('.tab-nav');
        
        if (window.innerWidth > 480) {
            // Desktop view - remove mobile menu
            if (burgerBtn) burgerBtn.remove();
            if (tabNav) {
                tabNav.classList.remove('mobile-open');
                document.body.style.overflow = '';
            }
        } else if (window.innerWidth <= 480 && !burgerBtn) {
            // Mobile view - add burger menu if it doesn't exist
            location.reload(); // Simplest way to reinitialize
        }
    }, 250);
});