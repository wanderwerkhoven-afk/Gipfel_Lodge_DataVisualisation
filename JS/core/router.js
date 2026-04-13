// ./JS/core/router.js
import { state } from "./app.js";

class Router {
  constructor(routes, containerId) {
    this.routes = routes;
    this.container = document.getElementById(containerId);
    this.currentPage = null;
    this.isAnimating = false;

    window.addEventListener("hashchange", () => this.handleRoute());
  }

  async handleRoute() {
    if (this.isAnimating) return;

    const hash = window.location.hash.slice(1) || "home";
    const route = this.routes.find((r) => r.id === hash) || this.routes[0];

    if (this.currentPage && this.currentPage.id === route.id) return;

    this.cleanupCharts();
    await this.transitionTo(route);
  }

  cleanupCharts() {
    if (state.charts) {
      Object.keys(state.charts).forEach((key) => {
        if (state.charts[key] && typeof state.charts[key].destroy === "function") {
          state.charts[key].destroy();
        }
      });
      state.charts = {};
    }
  }

  async transitionTo(route) {
    this.isAnimating = true;

    // Create new page element
    const newPage = document.createElement("div");
    newPage.className = "page-wrapper incoming";
    newPage.innerHTML = route.template();

    // Determine direction for slide
    const oldIndex = this.currentPage ? this.routes.indexOf(this.currentPage) : -1;
    const newIndex = this.routes.indexOf(route);
    const direction = newIndex > oldIndex ? "right" : "left";

    if (this.currentPage) {
        newPage.classList.add(`from-${direction}`);
    }

    this.container.appendChild(newPage);

    // Initialise route logic AFTER adding to DOM so IDs are available
    if (route.init) {
      await route.init();
    }

    if (this.currentPage) {
      const oldPage = this.container.querySelector(".page-wrapper.active");
      
      // Trigger animations
      requestAnimationFrame(() => {
        newPage.classList.add("active");
        newPage.classList.remove("incoming", `from-${direction}`);
        if (oldPage) {
          oldPage.classList.add(`exit-${direction === "right" ? "left" : "right"}`);
          oldPage.classList.remove("active");
        }
      });

      // Cleanup after animation (match CSS duration)
      setTimeout(() => {
        if (oldPage) oldPage.remove();
        this.isAnimating = false;
        this.updateNav(route.id);
      }, 400); // 400ms matches CSS transition
    } else {
      // First load
      newPage.classList.add("active");
      newPage.classList.remove("incoming");
      this.isAnimating = false;
      this.updateNav(route.id);
    }

    this.currentPage = route;
    document.title = `Gipfel Lodge — ${route.title}`;
  }

  updateNav(id) {
    document.querySelectorAll(".nav-item").forEach((nav) => {
      nav.classList.toggle("active", nav.dataset.nav === id);
    });
  }

  init() {
    this.handleRoute();
  }
}

export default Router;
