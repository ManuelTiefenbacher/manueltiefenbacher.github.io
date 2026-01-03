// Mobile Sidebar Functionality
document.addEventListener("DOMContentLoaded", function () {
    const sidebar = document.querySelector(".sidebar");
    const sidebarOverlay = document.querySelector(".sidebar-overlay");
    const mobileSidebarToggle = document.querySelector(
        ".mobile-sidebar-toggle"
    );
    const sidebarToggle = document.querySelector(".sidebar-toggle");

    if (!sidebar || !mobileSidebarToggle) return;

    // Toggle sidebar on mobile button click
    mobileSidebarToggle.addEventListener("click", function (e) {
        e.stopPropagation();
        sidebar.classList.toggle("mobile-open");
        if (sidebarOverlay) sidebarOverlay.classList.toggle("active");
        document.body.style.overflow = sidebar.classList.contains("mobile-open")
            ? "hidden"
            : "";
    });

    // Desktop sidebar toggle (collapse/expand)
    if (sidebarToggle) {
        sidebarToggle.addEventListener("click", function (e) {
            e.stopPropagation();
            sidebar.classList.toggle("collapsed");
        });
    }

    // Close sidebar when any nav-item is clicked
    const navItems = document.querySelectorAll(".nav-item");
    navItems.forEach((item) => {
        item.addEventListener("click", function (e) {
            console.log("Nav item clicked:", this); // Debug log

            // Close mobile menu when navigation happens
            if (
                window.innerWidth <= 768 &&
                sidebar.classList.contains("mobile-open")
            ) {
                sidebar.classList.remove("mobile-open");
                if (sidebarOverlay) sidebarOverlay.classList.remove("active");
                document.body.style.overflow = "";
            }
        });
    });

    // Close sidebar on escape key
    document.addEventListener("keydown", function (e) {
        if (e.key === "Escape" && sidebar.classList.contains("mobile-open")) {
            sidebar.classList.remove("mobile-open");
            if (sidebarOverlay) sidebarOverlay.classList.remove("active");
            document.body.style.overflow = "";
        }
    });
});

// Handle window resize
let resizeTimer;
window.addEventListener("resize", function () {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(function () {
        const sidebar = document.querySelector(".sidebar");
        const sidebarOverlay = document.querySelector(".sidebar-overlay");

        if (window.innerWidth > 768) {
            // Desktop view - ensure mobile classes are removed
            if (sidebar) sidebar.classList.remove("mobile-open");
            if (sidebarOverlay) sidebarOverlay.classList.remove("active");
            document.body.style.overflow = "";
        }
    }, 250);
});
