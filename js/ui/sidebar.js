// Sidebar Navigation Logic
document.addEventListener("DOMContentLoaded", function () {
    console.log("DOM Content Loaded - Initializing sidebar");
    // Small delay to ensure all scripts are loaded
    setTimeout(initSidebar, 100);
});

function initSidebar() {
    console.log("initSidebar called");

    const sidebar = document.querySelector(".sidebar");
    const mainContent = document.querySelector(".main-content");
    const sidebarToggle = document.querySelector(".sidebar-toggle");
    const mobileSidebarToggle = document.querySelector(
        ".mobile-sidebar-toggle"
    );
    const sidebarOverlay = document.querySelector(".sidebar-overlay");
    const navItems = document.querySelectorAll(".nav-item");

    console.log("Found nav items:", navItems.length);

    if (navItems.length === 0) {
        console.error("No nav items found! Check your HTML structure.");
        return;
    }

    // Desktop sidebar toggle
    if (sidebarToggle) {
        sidebarToggle.addEventListener("click", function () {
            sidebar.classList.toggle("collapsed");
            mainContent.classList.toggle("expanded");

            // Save state to sessionStorage (cleared on page reload)
            const isCollapsed = sidebar.classList.contains("collapsed");
            sessionStorage.setItem("sidebarCollapsed", isCollapsed);
        });

        // Restore sidebar state
        const savedState = sessionStorage.getItem("sidebarCollapsed");
        if (savedState === "true" && window.innerWidth > 968) {
            sidebar.classList.add("collapsed");
            mainContent.classList.add("expanded");
        }
    }

    // Mobile sidebar toggle
    if (mobileSidebarToggle) {
        mobileSidebarToggle.addEventListener("click", function () {
            const isOpen = sidebar.classList.contains("mobile-open");

            if (isOpen) {
                closeMobileSidebar();
            } else {
                openMobileSidebar();
            }
        });
    }

    // Overlay click to close
    if (sidebarOverlay) {
        sidebarOverlay.addEventListener("click", closeMobileSidebar);
    }

    // Navigation items
    navItems.forEach((item) => {
        item.addEventListener("click", (e) => {
            e.preventDefault();
            e.stopPropagation();

            const page = item.getAttribute("data-page");
            const sport = item.getAttribute("data-sport");

            console.log("Nav item clicked:", page, sport);

            // Skip if no page attribute (like refresh/clear buttons)
            if (!page) {
                console.log("No page attribute, skipping navigation");
                return;
            }

            // First, navigate to the page
            console.log("About to call navigateToPage with:", page);

            // For analysis page, include sport in hash
            if (page === "page-analysis" && sport) {
                navigateToPageWithHash(page, sport);
            } else {
                navigateToPageWithHash(page);
            }

            // Then switch to the specific sport
            if (sport) {
                console.log("About to switch sport to:", sport);
                setTimeout(() => {
                    switchSportType(sport);
                }, 100);
            }

            // Update active state in sidebar
            document.querySelectorAll(".nav-item").forEach((nav) => {
                nav.classList.remove("active");
            });
            item.classList.add("active");

            // Close mobile sidebar after navigation
            closeMobileSidebar();
        });
    });

    // Close sidebar on escape key (mobile)
    document.addEventListener("keydown", function (e) {
        if (e.key === "Escape" && sidebar.classList.contains("mobile-open")) {
            closeMobileSidebar();
        }
    });

    // Handle window resize
    let resizeTimer;
    window.addEventListener("resize", function () {
        clearTimeout(resizeTimer);
        resizeTimer = setTimeout(function () {
            if (window.innerWidth > 968) {
                // Desktop: close mobile sidebar, restore collapsed state
                closeMobileSidebar();
                const savedState = sessionStorage.getItem("sidebarCollapsed");
                if (savedState === "true") {
                    sidebar.classList.add("collapsed");
                    mainContent.classList.add("expanded");
                } else {
                    sidebar.classList.remove("collapsed");
                    mainContent.classList.remove("expanded");
                }
            } else {
                // Mobile/Tablet: remove collapsed state
                sidebar.classList.remove("collapsed");
                mainContent.classList.remove("expanded");
            }
        }, 250);
    });
}

function switchSportType(sport) {
    console.log("Switching to sport:", sport);

    // Hide all sport analysis sections
    document.querySelectorAll(".sport-analysis-content").forEach((section) => {
        section.style.display = "none";
        section.classList.remove("active");
    });

    // Show the selected sport section
    const sportSection = document.getElementById(`analysis-${sport}`);
    if (sportSection) {
        sportSection.style.display = "block";
        sportSection.classList.add("active");
    }

    // Update active state on sport type buttons if they exist
    document.querySelectorAll(".sport-type-button").forEach((btn) => {
        btn.classList.remove("active");
    });
    const activeBtn = document.querySelector(
        `.sport-type-button[data-sport="${sport}"]`
    );
    if (activeBtn) {
        activeBtn.classList.add("active");
    }

    // Update sidebar active state - ONLY for analysis nav items
    document
        .querySelectorAll(".nav-item[data-page='page-analysis']")
        .forEach((nav) => {
            nav.classList.remove("active");
        });
    const activeSidebarItem = document.querySelector(
        `.nav-item[data-page='page-analysis'][data-sport="${sport}"]`
    );
    if (activeSidebarItem) {
        activeSidebarItem.classList.add("active");
    }
}

function openMobileSidebar() {
    const sidebar = document.querySelector(".sidebar");
    const overlay = document.querySelector(".sidebar-overlay");
    const toggle = document.querySelector(".mobile-sidebar-toggle");

    sidebar.classList.add("mobile-open");
    overlay.classList.add("active");
    toggle.classList.add("active");
    document.body.style.overflow = "hidden";
}

function closeMobileSidebar() {
    const sidebar = document.querySelector(".sidebar");
    const overlay = document.querySelector(".sidebar-overlay");
    const toggle = document.querySelector(".mobile-sidebar-toggle");

    sidebar.classList.remove("mobile-open");
    overlay.classList.remove("active");
    toggle.classList.remove("active");
    document.body.style.overflow = "";
}

function navigateToPageWithHash(pageId, sport) {
    console.log("navigateToPageWithHash called with:", pageId, sport);

    // Hide all pages
    const pages = document.querySelectorAll(".content-page");
    pages.forEach((page) => page.classList.remove("active"));

    // Show selected page
    const selectedPage = document.getElementById(pageId);
    if (selectedPage) {
        selectedPage.classList.add("active");
        console.log("Page activated:", pageId);
    } else {
        console.error("Page not found:", pageId);
    }

    // Update active nav item - CLEAR ALL FIRST
    const navItems = document.querySelectorAll(".nav-item");
    navItems.forEach((item) => {
        item.classList.remove("active");
    });

    // Then set active based on page and sport
    if (pageId === "page-analysis" && sport) {
        // For analysis pages, activate the specific sport nav item
        const sportNavItem = document.querySelector(
            `.nav-item[data-page="${pageId}"][data-sport="${sport}"]`
        );
        if (sportNavItem) {
            sportNavItem.classList.add("active");
        }
    } else {
        // For other pages, activate by page ID only
        const activeNavItem = document.querySelector(
            `.nav-item[data-page="${pageId}"]`
        );
        if (activeNavItem) {
            activeNavItem.classList.add("active");
        }
    }

    // Update URL hash to preserve state on reload
    if (pageId === "page-analysis" && sport) {
        window.location.hash = `${pageId}-${sport}`;
    } else {
        window.location.hash = pageId;
    }
    console.log("Hash set to:", window.location.hash);

    // Scroll to top
    window.scrollTo(0, 0);
}

// Override the existing navigateToPage to use our version
if (typeof navigateToPage !== "undefined") {
    console.log("Overriding existing navigateToPage function");
}
window.navigateToPage = navigateToPageWithHash;

// Initialize on page load - stay on current page using URL hash
window.addEventListener("load", function () {
    console.log("=== Page Load Started ===");

    const hash = window.location.hash.substring(1);

    console.log("URL Hash:", hash);

    if (hash) {
        // Check if hash contains sport info (e.g., "page-analysis-run")
        if (hash.startsWith("page-analysis-")) {
            const sport = hash.replace("page-analysis-", "");
            console.log("Staying on analysis page with sport:", sport);
            navigateToPageWithHash("page-analysis", sport);
            setTimeout(() => {
                switchSportType(sport);
            }, 100);
        } else {
            // Regular page navigation
            console.log("Staying on page:", hash);
            navigateToPageWithHash(hash);
        }
    } else {
        // Only go to upload page if no hash exists (first visit)
        console.log("No hash found, going to upload page");
        navigateToPageWithHash("page-upload");
    }

    console.log("=== Page Load Complete ===");
});
