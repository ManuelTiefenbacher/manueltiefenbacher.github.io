// Sidebar Navigation Logic
document.addEventListener("DOMContentLoaded", function () {
    initSidebar();
});

function initSidebar() {
    const sidebar = document.querySelector(".sidebar");
    const mainContent = document.querySelector(".main-content");
    const sidebarToggle = document.querySelector(".sidebar-toggle");
    const mobileSidebarToggle = document.querySelector(
        ".mobile-sidebar-toggle"
    );
    const sidebarOverlay = document.querySelector(".sidebar-overlay");
    const navItems = document.querySelectorAll(".nav-item");

    // Desktop sidebar toggle
    if (sidebarToggle) {
        sidebarToggle.addEventListener("click", function () {
            sidebar.classList.toggle("collapsed");
            mainContent.classList.toggle("expanded");

            // Save state to localStorage
            const isCollapsed = sidebar.classList.contains("collapsed");
            localStorage.setItem("sidebarCollapsed", isCollapsed);
        });

        // Restore sidebar state
        const savedState = localStorage.getItem("sidebarCollapsed");
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

            const page = item.getAttribute("data-page");
            const sport = item.getAttribute("data-sport");

            // First, navigate to the analysis page
            navigateToPage(page);

            // Then switch to the specific sport
            if (sport) {
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
                const savedState = localStorage.getItem("sidebarCollapsed");
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

// MOVED OUTSIDE initSidebar - now globally accessible
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

    // Update sidebar active state
    document.querySelectorAll(".nav-item[data-sport]").forEach((nav) => {
        nav.classList.remove("active");
    });
    const activeSidebarItem = document.querySelector(
        `.nav-item[data-sport="${sport}"]`
    );
    if (activeSidebarItem) {
        activeSidebarItem.classList.add("active");
    }

    // Save current sport to localStorage
    localStorage.setItem("lastVisitedSport", sport);
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

function navigateToPage(pageId) {
    // Hide all pages
    const pages = document.querySelectorAll(".content-page");
    pages.forEach((page) => page.classList.remove("active"));

    // Show selected page
    const selectedPage = document.getElementById(pageId);
    if (selectedPage) {
        selectedPage.classList.add("active");
    }

    // Update active nav item
    const navItems = document.querySelectorAll(".nav-item");
    navItems.forEach((item) => {
        if (item.getAttribute("data-page") === pageId) {
            item.classList.add("active");
        } else {
            item.classList.remove("active");
        }
    });

    // Save current page to localStorage
    localStorage.setItem("lastVisitedPage", pageId);

    // Update URL hash (optional, for bookmarking)
    window.location.hash = pageId;

    // Scroll to top
    window.scrollTo(0, 0);
}

// Support for legacy switchTab function (backwards compatibility)
function switchTab(tabName) {
    const pageMap = {
        upload: "page-upload",
        settings: "page-settings",
        analysis: "page-analysis",
        comparison: "page-comparison",
    };

    const pageId = pageMap[tabName] || `page-${tabName}`;
    navigateToPage(pageId);
}

// Initialize on page load - check for hash and restore state
window.addEventListener("load", function () {
    console.log("=== Page Load Started ===");

    const hash = window.location.hash.substring(1);
    const lastSport = localStorage.getItem("lastVisitedSport");

    console.log("URL Hash:", hash);
    console.log("Last Sport from storage:", lastSport);

    if (hash) {
        // If there's a hash, navigate to it
        console.log("Navigating to hash:", hash);
        navigateToPage(hash);

        // Restore sport type if on analysis page
        if (hash === "page-analysis" && lastSport) {
            console.log("Switching to saved sport:", lastSport);
            setTimeout(() => {
                switchSportType(lastSport);
            }, 200);
        }
    } else if (lastSport) {
        // If no hash but there's a saved sport, go to analysis with that sport
        console.log(
            "No hash, but found saved sport. Going to analysis page with sport:",
            lastSport
        );
        navigateToPage("page-analysis");
        setTimeout(() => {
            switchSportType(lastSport);
        }, 200);
    } else {
        // Default to upload page
        console.log("No hash or saved sport, going to upload");
        navigateToPage("page-upload");
    }

    console.log("=== Page Load Complete ===");
});
