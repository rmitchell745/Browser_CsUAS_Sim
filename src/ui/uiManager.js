// Extracted from index.html
class UIManager {
      constructor() {
        this.screens = {
          dashboard: document.getElementById("screen-dashboard"),
          wizard: document.getElementById("screen-wizard"),
          templates: document.getElementById("screen-templates"),
          run: document.getElementById("screen-run"),
          report: document.getElementById("screen-report"),
          export: document.getElementById("screen-export")
        };
        this.mainScreen = this.screens.run;
        this.sidebarIds = ["wizard", "templates", "report", "export"];
      }

      closeAllSideTrays() {
        this.sidebarIds.forEach((sidebarId) => {
          const element = this.screens[sidebarId];
          if (element) {
            element.classList.remove("sidebar-active");
          }
        });
        document.querySelectorAll(".tray-button").forEach((button) => {
          button.classList.remove("active");
        });
      }

      showScreen(screenId) {
        if (this.mainScreen) {
          this.mainScreen.classList.add("active");
          this.mainScreen.classList.toggle("map-hidden", screenId === "templates");
        }
        this.closeAllSideTrays();
        if (this.sidebarIds.includes(screenId)) {
          const element = this.screens[screenId];
          if (element) {
            element.classList.add("sidebar-active");
          }
        }
        document.querySelectorAll(".tray-button").forEach((button) => {
          button.classList.toggle("active",
            (screenId === "wizard" && button.id === "open-scenario-sidebar-btn")
            || (screenId === "templates" && button.id === "open-template-sidebar-btn")
            || (screenId === "export" && button.id === "open-export-sidebar-btn")
            || (screenId === "report" && button.id === "open-analysis-sidebar-btn")
          );
        });
      }

      closePanels() {
        this.closeAllSideTrays();
        if (this.mainScreen) {
          this.mainScreen.classList.remove("map-hidden");
        }
      }
    }
